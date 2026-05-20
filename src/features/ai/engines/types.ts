export interface ChessEngine {
  /** Initialize the engine; resolves when ready. */
  init: () => Promise<void>;

  /** Ask the engine for the best move from `fen` at `skillLevel`. */
  getBestMove: (fen: string, skillLevel: number) => Promise<string | null>;

  /** Ask the engine to choose a board from available options. Returns the chosen board name. */
  chooseBoard: (availableBoards: string[]) => Promise<string | null>;

  /** Dispose / terminate the engine and free resources. */
  dispose: () => void;
}

export type EngineFactory = (enabled?: boolean) => ChessEngine;
