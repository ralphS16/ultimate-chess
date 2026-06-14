import type { ChessEngine } from "./types";

function goCommand(skillLevel: number): string {
  if (skillLevel < 5) return "go depth 1";
  if (skillLevel < 10) return "go depth 2";
  if (skillLevel < 15) return "go depth 3";
  const movetime = 1000 + (skillLevel - 15) * 400;
  return `go movetime ${movetime}`;
}

export function createStockfishEngine(enabled = true): ChessEngine {
  let worker: Worker | null = null;
  let ready = false;
  let resolveRef: ((move: string | null) => void) | null = null;
  const readyResolvers: Array<() => void> = [];

  const ensureWorker = () => {
    if (worker || !enabled) return;
    worker = new Worker(`${import.meta.env.BASE_URL}stockfish.js`, { type: 'classic' });
    ready = false;

    worker.onerror = (e) => {
      console.error("Stockfish worker error:", e);
      resolveRef?.(null);
      resolveRef = null;
    };

    worker.onmessage = (e: MessageEvent) => {
      const line: string = typeof e.data === "string" ? e.data : String(e.data);

      if (line === "uciok") {
        worker?.postMessage("ucinewgame");
        worker?.postMessage("isready");
      } else if (line === "readyok") {
        ready = true;
        // resolve any pending init promises
        while (readyResolvers.length) readyResolvers.shift()?.();
      } else if (line.startsWith("bestmove")) {
        const move = line.split(" ")[1] ?? null;
        const resolve = resolveRef;
        resolveRef = null;
        resolve?.(move && move !== "(none)" ? move : null);
      }
    };

    // start handshake
    worker.postMessage("uci");
  };

  const init = (): Promise<void> => {
    ensureWorker();
    if (ready) return Promise.resolve();
    return new Promise((res) => readyResolvers.push(res));
  };

  const getBestMove = (fen: string, skillLevel: number): Promise<string | null> =>
    new Promise<string | null>((resolve) => {
      ensureWorker();

      const attempt = () => {
        if (!worker) {
          resolve(null);
          return;
        }
        if (!ready) {
          setTimeout(attempt, 50);
          return;
        }

        if (resolveRef) {
          resolveRef(null);
        }
        resolveRef = resolve;

        const w = worker as Worker;
        const maxErr = Math.round(skillLevel * -0.5 + 10);
        const errProb = Math.round(skillLevel * 6.35 + 1);
        w.postMessage(`setoption name Skill Level value ${skillLevel}`);
        w.postMessage(`setoption name Skill Level Maximum Error value ${maxErr}`);
        w.postMessage(`setoption name Skill Level Probability value ${errProb}`);
        w.postMessage(`position fen ${fen}`);
        w.postMessage(goCommand(skillLevel));
      };

      attempt();
    });

  const dispose = () => {
    resolveRef?.(null);
    resolveRef = null;
    if (worker) {
      worker.terminate();
      worker = null;
      // reset ready state
      // (a new worker will be re-created if needed)
      ready = false;
    }
  };

  const chooseBoard = (availableBoards: string[]): Promise<string | null> => {
    // Board routing is handled in useAIPlayers via tactical search.
    if (availableBoards.length === 0) return Promise.resolve(null);
    return Promise.resolve(availableBoards[0]);
  };

  return { init, getBestMove, chooseBoard, dispose };
}
