import { useState, useCallback, useMemo, type CSSProperties } from "react";
import { type Chess, type Square } from "chess.js";
import { getLegalMoves, clearLegalMovesCache } from "../utils/chessMoves";
import {
  BOARD_NAMES,
  type BoardName,
  type BoardStatus,
} from "../types/boardTypes";
import {
  UltimateChessGame,
  statusToWinner,
  type BoardState as EngineBoardState,
  type BoardWinner,
  type SavedRoutingState,
  type UltimateChessSnapshot,
  type MoveResult,
} from "../game/ultimateChess";

interface BoardState extends EngineBoardState {
  moveFrom: string | null;
}

export interface UseBoardSetReturn extends UltimateChessSnapshot {
  boards: Record<BoardName, BoardState>;
  getBoardWinner: (boardName: BoardName) => 'white' | 'black' | 'draw' | null;
  chooseBoard: (boardName: BoardName) => boolean;
  makeMoveOnBoard: (
    boardName: BoardName,
    sourceSquare: string,
    targetSquare: string,
    promotionPiece?: string
  ) => MoveResult;
  setMoveFromSquare: (boardName: BoardName, square: string | null) => void;
  getSquareLegalMoves: (boardName: BoardName, square: string) => string[];
  getSquareStyles: (boardName: BoardName) => Record<string, CSSProperties>;
  allSquareStyles: Record<BoardName, Record<string, CSSProperties>>;
  completePromotion: (boardName: BoardName, fromSquare: string, toSquare: string, pieceType: string) => MoveResult;
  resetAllBoards: () => void;
  loadGame: (
    boards: Array<{ name: BoardName; fen: string; status: BoardStatus; winner: BoardWinner }>,
    currentPlayer: 'w' | 'b',
    pendingChecks: Partial<Record<BoardName, 'w' | 'b'>>,
    currentBoard: BoardName | null,
    routingState?: SavedRoutingState
  ) => void;
  undo: () => boolean;
  canUndo: () => boolean;
}



function findKingSquare(game: Chess, color: "w" | "b"): string | null {
  const board = game.board();
  const files = "abcdefgh";

  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank][file];
      if (piece?.type === "k" && piece.color === color) {
        return `${files[file]}${8 - rank}`;
      }
    }
  }

  return null;
}

const createInitialMoveFromState = (): Record<BoardName, string | null> => {
  return BOARD_NAMES.reduce((acc, boardName) => {
    acc[boardName] = null;
    return acc;
  }, {} as Record<BoardName, string | null>);
};

/**
 * useBoardSet
 * React hook that provides a UI-friendly snapshot of the `UltimateChessGame`
 * engine and exposes action methods. All routing and game rules are executed
 * inside `UltimateChessGame`; this hook merely forwards actions and refreshes
 * a snapshot for the UI to consume (including modal state fields).
 */
export function useBoardSet(): UseBoardSetReturn {
  const [engine] = useState(() => new UltimateChessGame());
  const [engineSnapshot, setEngineSnapshot] = useState<UltimateChessSnapshot>(
    () => engine.getSnapshot()
  );
  const [moveFromByBoard, setMoveFromByBoard] = useState<Record<BoardName, string | null>>(createInitialMoveFromState);

  const refreshSnapshot = useCallback(() => {
    setEngineSnapshot(engine.getSnapshot());
  }, [engine]);

  const getBoardWinner = useCallback(
    (boardName: BoardName): 'white' | 'black' | 'draw' | null => {
      const w = statusToWinner(engineSnapshot.boards[boardName].status);
      if (w === 'w') return 'white';
      if (w === 'b') return 'black';
      return w; // 'draw' | null
    },
    [engineSnapshot.boards]
  );

  const makeMoveOnBoard = useCallback(
    (
      boardName: BoardName,
      sourceSquare: string,
      targetSquare: string,
      promotionPiece?: string
    ) => {
      const result = engine.makeMoveOnBoard(boardName, sourceSquare, targetSquare, promotionPiece);
      refreshSnapshot();
      setMoveFromByBoard((prev) => ({ ...prev, [boardName]: null }));
      return result;
    },
    [engine, refreshSnapshot]
  );

  const chooseBoard = useCallback(
    (boardName: BoardName) => {
      const success = engine.chooseBoard(boardName);
      refreshSnapshot();
      return success;
    },
    [engine, refreshSnapshot]
  );

  const completePromotion = useCallback(
    (boardName: BoardName, fromSquare: string, toSquare: string, pieceType: string) => {
      return makeMoveOnBoard(boardName, fromSquare, toSquare, pieceType);
    },
    [makeMoveOnBoard]
  );

  const setMoveFromSquare = useCallback((boardName: BoardName, square: string | null) => {
    setMoveFromByBoard((prev) => ({
      ...prev,
      [boardName]: square,
    }));
  }, []);

  const getSquareLegalMoves = useCallback(
    (boardName: BoardName, square: string): string[] => {
      return getLegalMoves(engineSnapshot.boards[boardName].game, square);
    },
    [engineSnapshot.boards]
  );

  const getSquareStyles = useCallback(
    (boardName: BoardName): Record<string, CSSProperties> => {
      const boardState = engineSnapshot.boards[boardName];
      const squareStyles: Record<string, CSSProperties> = {};
      const moveFrom = moveFromByBoard[boardName];

      if (moveFrom) {
        squareStyles[moveFrom] = { backgroundColor: "rgba(255, 255, 0, 0.4)" };
        const legalMoves = getLegalMoves(boardState.game, moveFrom);
        legalMoves.forEach((m) => {
          const hasPiece = boardState.game.get(m as Square);
          squareStyles[m] = hasPiece
            ? { ...squareStyles[m], backgroundColor: "rgba(255, 165, 0, 0.6)" }
            : {
                ...squareStyles[m],
                background:
                  "radial-gradient(circle, rgba(0,0,0,0.3) 25%, transparent 30%)",
                borderRadius: "50%",
              };
        });
      }

      if (boardState.game.inCheck()) {
        const turn = boardState.game.turn();
        const kingSquare = findKingSquare(boardState.game, turn);
        if (kingSquare) {
          squareStyles[kingSquare] = {
            ...squareStyles[kingSquare],
            backgroundColor: "rgba(255, 0, 0, 0.5)",
          };
        }
      }

      const pendingCheckPlayer = engineSnapshot.pendingChecks[boardName];
      if (pendingCheckPlayer) {
        const kingSquare = findKingSquare(boardState.game, pendingCheckPlayer);
        if (kingSquare) {
          squareStyles[kingSquare] = {
            ...squareStyles[kingSquare],
            backgroundColor: 'rgba(255, 0, 0, 0.5)',
          };
        }
      }

      return squareStyles;
    },
    [engineSnapshot.boards, engineSnapshot.pendingChecks, moveFromByBoard]
  );

  const resetAllBoards = useCallback(() => {
    engine.reset();
    clearLegalMovesCache();
    refreshSnapshot();
    setMoveFromByBoard(createInitialMoveFromState());
  }, [engine, refreshSnapshot]);

  const loadGame = useCallback(
    (
      savedBoards: Array<{ name: BoardName; fen: string; status: BoardStatus; winner: BoardWinner }>,
      currentPlayer: 'w' | 'b',
      pendingChecks: Partial<Record<BoardName, 'w' | 'b'>>,
      currentBoard: BoardName | null,
      routingState?: SavedRoutingState
    ) => {
      engine.loadGame(savedBoards, currentPlayer, pendingChecks, currentBoard, routingState);
      clearLegalMovesCache();
      refreshSnapshot();
      setMoveFromByBoard(createInitialMoveFromState());
    },
    [engine, refreshSnapshot]
  );

  const undo = useCallback(() => {
    const success = engine.undo();
    if (success) {
      refreshSnapshot();
      setMoveFromByBoard(createInitialMoveFromState());
    }
    return success;
  }, [engine, refreshSnapshot]);

  const canUndo = useCallback(() => {
    return engine.canUndo();
  }, [engine]);

  const pawnBoard = useMemo(() => ({
    ...engineSnapshot.boards.pawn,
    moveFrom: moveFromByBoard.pawn,
  }), [engineSnapshot.boards.pawn, moveFromByBoard.pawn]);

  const rookBoard = useMemo(() => ({
    ...engineSnapshot.boards.rook,
    moveFrom: moveFromByBoard.rook,
  }), [engineSnapshot.boards.rook, moveFromByBoard.rook]);

  const knightBoard = useMemo(() => ({
    ...engineSnapshot.boards.knight,
    moveFrom: moveFromByBoard.knight,
  }), [engineSnapshot.boards.knight, moveFromByBoard.knight]);

  const bishopBoard = useMemo(() => ({
    ...engineSnapshot.boards.bishop,
    moveFrom: moveFromByBoard.bishop,
  }), [engineSnapshot.boards.bishop, moveFromByBoard.bishop]);

  const queenBoard = useMemo(() => ({
    ...engineSnapshot.boards.queen,
    moveFrom: moveFromByBoard.queen,
  }), [engineSnapshot.boards.queen, moveFromByBoard.queen]);

  const kingBoard = useMemo(() => ({
    ...engineSnapshot.boards.king,
    moveFrom: moveFromByBoard.king,
  }), [engineSnapshot.boards.king, moveFromByBoard.king]);

  const boards = useMemo(() => ({
    pawn: pawnBoard,
    rook: rookBoard,
    knight: knightBoard,
    bishop: bishopBoard,
    queen: queenBoard,
    king: kingBoard,
  }), [pawnBoard, rookBoard, knightBoard, bishopBoard, queenBoard, kingBoard]);

  // Pre-compute square styles for all boards so callers get stable references
  const allSquareStyles = useMemo(() => {
    const styles = {} as Record<BoardName, Record<string, CSSProperties>>;
    for (const boardName of BOARD_NAMES) {
      styles[boardName] = getSquareStyles(boardName);
    }
    return styles;
  }, [getSquareStyles]);

  return {
    ...engineSnapshot,
    boards,
    getBoardWinner,
    chooseBoard,
    makeMoveOnBoard,
    setMoveFromSquare,
    getSquareLegalMoves,
    getSquareStyles,
    allSquareStyles,
    completePromotion,
    resetAllBoards,
    loadGame,
    undo,
    canUndo,
  };
}
