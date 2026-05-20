import { useEffect, useRef } from "react";
import type { BoardName } from "../../chess/types/boardTypes";
import type { MoveResult } from "../../chess/game/ultimateChess";
import { createStockfishEngine } from "../engines/stockfishEngine";
import type { ChessEngine } from "../engines/types";

type PlayerKind = "human" | "ai";

interface UseAIPlayersOptions {
  mode: "local" | "multi";
  playerColor: "w" | "b" | null | undefined;
  players: { w: PlayerKind; b: PlayerKind };
  skillLevel?: { w: number; b: number };
  boards: Record<BoardName, { fen: string }>;
  globalTurn: "w" | "b";
  requiredBoard: BoardName | null;
  availableBoards: BoardName[];
  choiceBoards: BoardName[];
  // AI decision making for board selection
  decisionMaker: "w" | "b" | null;
  shouldShowModal: boolean;
  chooseBoard: (boardName: BoardName) => void;
  // action to make a move
  makeMoveOnBoard: (
    boardName: BoardName,
    source: string,
    target: string,
    promotion?: string
  ) => MoveResult;
  isPaused?: boolean;
}

/**
 * Simple AI manager that creates one engine per board (using stockfish by default)
 * and, when configured, makes moves for AI-controlled sides. The implementation
 * is intentionally minimal so other engine implementations can be plugged in.
 */
export function useAIPlayers(opts: UseAIPlayersOptions) {
  const {
    mode,
    playerColor,
    players,
    skillLevel = { w: 10, b: 10 },
    boards,
    globalTurn,
    requiredBoard,
    availableBoards,
    choiceBoards,
    decisionMaker,
    shouldShowModal,
    chooseBoard,
    makeMoveOnBoard,
    isPaused,
  } = opts;

  // engines per board
  const enginesRef = useRef<Record<BoardName, ChessEngine | null>>({
    pawn: null,
    knight: null,
    bishop: null,
    rook: null,
    queen: null,
    king: null,
  } as Record<BoardName, ChessEngine | null>);

  // track in-flight AI calculation to avoid duplicates
  const inFlightRef = useRef<Record<string, boolean>>({});

  // create engines when AI is needed
  useEffect(() => {
    const hasAI = mode !== "multi" && (players.w === "ai" || players.b === "ai");
    const map = enginesRef.current;
    
    if (hasAI) {
      for (const b of Object.keys(map) as BoardName[]) {
        if (!map[b]) {
          map[b] = createStockfishEngine(true);
          map[b]?.init().catch(() => {});
        }
      }
    } else {
      for (const b of Object.keys(map) as BoardName[]) {
        if (map[b]) {
          map[b]?.dispose();
          map[b] = null;
        }
      }
      inFlightRef.current = {};
    }
  }, [mode, players.w, players.b]);

  // unmount cleanup
  useEffect(() => {
    const map = enginesRef.current;
    return () => {
      for (const b of Object.keys(map) as BoardName[]) {
        if (map[b]) {
          map[b]?.dispose();
          map[b] = null;
        }
      }
    };
  }, []);

  // Helper: parse UCI move like e2e4 or e7e8q
  const parseUci = (uci: string): { from: string; to: string; promotion?: string } | null => {
    if (!uci || uci.length < 4) return null;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    return { from, to, promotion };
  };

  // AI board selection: when AI is the decisionMaker, ask the engine to choose
  useEffect(() => {
    // Don't run AI in multiplayer local-client mode or when paused.
    if (mode === "multi" || isPaused) return;

    // Use choiceBoards if available (during castling-choice, loser-picks), otherwise fall back to availableBoards
    const boardsToChooseFrom = choiceBoards.length > 0 ? choiceBoards : availableBoards;
    
    // Only proceed if there's a modal showing and we have boards to choose from
    if (!shouldShowModal || boardsToChooseFrom.length === 0) return;

    // Only proceed if there's a decision maker and it's an AI
    if (!decisionMaker || players[decisionMaker] !== "ai") return;

    // Use any available engine to make the board choice decision
    const engine = enginesRef.current[boardsToChooseFrom[0]];
    if (!engine) return;

    // Ask the engine to choose a board
    engine.chooseBoard(boardsToChooseFrom).then((chosenBoard) => {
      if (chosenBoard) {
        chooseBoard(chosenBoard as BoardName);
      }
    });
  }, [mode, shouldShowModal, decisionMaker, players, choiceBoards, availableBoards, chooseBoard, isPaused]);

  // Derive a stable key for the target board's FEN to avoid JSON.stringify in deps
  const targetBoard = requiredBoard ?? availableBoards[0] ?? null;
  const targetBoardFen = targetBoard ? boards[targetBoard]?.fen : null;

  useEffect(() => {
    // Don't run AI in multiplayer local-client mode or when paused.
    if (mode === "multi" || isPaused) return;

    const side = globalTurn;
    if (players[side] !== "ai") return;

    if (!targetBoard || !targetBoardFen) return;

    // Avoid firing multiple times for same position
    const key = `${side}:${targetBoard}:${targetBoardFen}`;
    if (inFlightRef.current[key]) return;
    inFlightRef.current[key] = true;

    const engine = enginesRef.current[targetBoard];
    if (!engine) {
      inFlightRef.current[key] = false;
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const currentSkill = skillLevel[side];
        const uci = await engine.getBestMove(targetBoardFen, currentSkill);
        if (cancelled) return;
        if (!uci) return;
        const parsed = parseUci(uci);
        if (!parsed) return;
        makeMoveOnBoard(targetBoard, parsed.from, parsed.to, parsed.promotion);
      } catch {
        // swallow
      } finally {
        inFlightRef.current[key] = false;
      }
    })();

    const currentInFlight = inFlightRef.current;
    return () => {
      cancelled = true;
      currentInFlight[key] = false;
    };
  }, [mode, players, globalTurn, targetBoard, targetBoardFen, playerColor, skillLevel, makeMoveOnBoard, isPaused]);

  // The hook manages engines internally; no values are returned to avoid
  // accessing refs during render.
  return undefined;
}
