import { useEffect, useRef, useMemo } from "react";
import type { BoardName } from "../../chess/types/boardTypes";
import type { MoveResult } from "../../chess/game/ultimateChess";
import { createStockfishEngine } from "../engines/stockfishEngine";
import type { ChessEngine } from "../engines/types";
import { findTacticalBoardMove, pickBoardForOpponent } from "../utils/tacticalBoardChoice";

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
  pendingChecks: Partial<Record<BoardName, "w" | "b">>;
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
      pendingChecks,
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

  // AI board selection for modal routing (castling-choice, loser-picks, etc.)
  useEffect(() => {
    if (mode === "multi" || isPaused) return;

    const boardsToChooseFrom = choiceBoards.length > 0 ? choiceBoards : availableBoards;
    if (!shouldShowModal || boardsToChooseFrom.length === 0) return;
    if (!decisionMaker || players[decisionMaker] !== "ai") return;

    const candidates = boardsToChooseFrom
      .filter((name): name is BoardName => Boolean(boards[name]?.fen))
      .map((name) => ({ boardName: name, fen: boards[name].fen }));

    if (candidates.length === 0) return;

    // When the AI is also the player to move on the candidate boards, prefer tactics.
    if (decisionMaker === globalTurn) {
      const tactical = findTacticalBoardMove(candidates, decisionMaker);
      if (tactical) {
        chooseBoard(tactical.boardName as BoardName);
        makeMoveOnBoard(
          tactical.boardName as BoardName,
          tactical.from,
          tactical.to,
          tactical.promotion,
        );
        return;
      }
      // No tactical found — if king board available the tactical helper may
      // return a king fallback; otherwise fall through to default choice.
    } else {
      // AI choosing for the opponent — pick a board using heuristics that
      // constrain the opponent where possible.
      const pick = pickBoardForOpponent(candidates, decisionMaker, pendingChecks);
      if (pick) {
        chooseBoard(pick as BoardName);
        return;
      }
    }

    chooseBoard(boardsToChooseFrom[0] as BoardName);
  }, [
    mode,
    shouldShowModal,
    decisionMaker,
    players,
    choiceBoards,
    availableBoards,
    chooseBoard,
    makeMoveOnBoard,
    boards,
    pendingChecks,
    globalTurn,
    isPaused,
  ]);

  const candidateBoardNames = useMemo(() => (requiredBoard ? [requiredBoard] : availableBoards), [requiredBoard, availableBoards]);
  const candidateFenKey = useMemo(
    () => candidateBoardNames.map((name) => `${name}:${boards[name]?.fen ?? ""}`).join("|"),
    [candidateBoardNames, boards]
  );
  const targetBoard = requiredBoard ?? availableBoards[0] ?? null;
  const targetBoardFen = targetBoard ? boards[targetBoard]?.fen : null;

  useEffect(() => {
    // Don't run AI in multiplayer local-client mode or when paused.
    if (mode === "multi" || isPaused) return;

    const side = globalTurn;
    if (players[side] !== "ai") return;

    const candidates = candidateBoardNames
      .filter((name): name is BoardName => Boolean(boards[name]?.fen))
      .map((name) => ({ boardName: name, fen: boards[name].fen }));

    if (candidates.length === 0) return;

    const tactical = findTacticalBoardMove(candidates, side);
    if (tactical) {
      const tacticalBoard = tactical.boardName as BoardName;
      const key = `${side}:tactical:${tacticalBoard}:${boards[tacticalBoard]?.fen}:${tactical.from}${tactical.to}${tactical.promotion ?? ""}`;
      if (inFlightRef.current[key]) return;
      inFlightRef.current[key] = true;
      makeMoveOnBoard(
        tacticalBoard,
        tactical.from,
        tactical.to,
        tactical.promotion,
      );
      inFlightRef.current[key] = false;
      return;
    }

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
  }, [
    mode,
    players,
    globalTurn,
    targetBoard,
    targetBoardFen,
    candidateBoardNames,
    candidateFenKey,
    boards,
    playerColor,
    skillLevel,
    makeMoveOnBoard,
    isPaused,
  ]);

  // The hook manages engines internally; no values are returned to avoid
  // accessing refs during render.
  return undefined;
}
