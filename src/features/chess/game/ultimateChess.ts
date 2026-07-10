/**
 * UltimateChessGame
 * Core multi-board Ultimate Chess engine and routing logic.
 * This module contains the authoritative game rules and exposes a snapshot
 * intended for UI consumption. Keep rule changes here, not in UI code.
 */
import { Chess } from "chess.js";
import { makeMove } from "../utils/chessMoves";
import {
  BOARD_NAMES,
  VALID_START_BOARDS,
  PIECE_TO_BOARD,
  type BoardName,
  type BoardStatus,
} from "../types/boardTypes";

export type BoardWinner = "w" | "b" | "draw" | null;

export type RoutingMode = "normal" | "free-pick" | "castling-choice" | "loser-picks";

export interface BoardState {
  game: Chess;
  fen: string;
  status: BoardStatus;
  winner: BoardWinner;
}

export interface MoveHistoryEntry {
  moveNumber: number;
  boardName: BoardName;
  player: "w" | "b";
  move: string;
  nextBoard: BoardName;
  gaveCheck: boolean;
  wasCastling: boolean;
}

export interface UltimateChessSnapshot {
  boards: Record<BoardName, BoardState>;
  requiredBoard: BoardName | null;
  globalTurn: "w" | "b";
  capturedBoards: { white: BoardName[]; black: BoardName[] };
  pendingChecks: Partial<Record<BoardName, "w" | "b">>;
  moveHistory: MoveHistoryEntry[];
  routingMode: RoutingMode;
  decisionMaker: "w" | "b" | null;  // Who decides the next board (null if auto-decided)
  shouldShowModal: boolean;  // Whether to show a board selection modal
  loserPicksWinner: "w" | "b" | null;  // For loser-picks modal
  ultimateWinner: "w" | "b" | "draw" | null;
  availableBoards: BoardName[];
  choiceBoards: BoardName[];  // Boards available for selection during choice modes (castling-choice, loser-picks)
}

export interface SavedRoutingState {
  routingMode: RoutingMode;
  decisionMaker: "w" | "b" | null;
  shouldShowModal: boolean;
  loserPicksWinner: "w" | "b" | null;
  choiceBoards: BoardName[];
}

export interface MoveResult {
  success: boolean;
  movedPieceType: string | null;
  wasCastling: boolean;
  gaveCheck: boolean;
}

function getNextPlayer(player: "w" | "b"): "w" | "b" {
  return player === "w" ? "b" : "w";
}

export function statusToWinner(status: BoardStatus): BoardWinner {
  switch (status) {
    case "active":
      return null;
    case "won-white":
      return "w";
    case "won-black":
      return "b";
    case "draw":
      return "draw";
  }
}

function createInitialBoard(): BoardState {
  const game = new Chess();
  return {
    game,
    fen: game.fen(),
    status: "active",
    winner: null,
  };
}

function createInitialBoards(): Record<BoardName, BoardState> {
  const boards = {} as Record<BoardName, BoardState>;
  for (const boardName of BOARD_NAMES) {
    boards[boardName] = createInitialBoard();
  }
  return boards;
}

export class UltimateChessGame {
  private boards: Record<BoardName, BoardState> = createInitialBoards();
  private requiredBoard: BoardName | null = null;
  private globalTurn: "w" | "b" = "w";
  private capturedBoards: { white: BoardName[]; black: BoardName[] } = { white: [], black: [] };
  private pendingChecks: Partial<Record<BoardName, "w" | "b">> = {};
  private moveHistory: MoveHistoryEntry[] = [];
  private moveCounter: number = 1;
  private routingMode: RoutingMode = "normal";
  private decisionMaker: "w" | "b" | null = null;  // Who decides the next board
  private shouldShowModal: boolean = false;  // Whether to show a modal
  private loserPicksWinner: "w" | "b" | null = null;  // For loser-picks modal
  private ultimateWinner: "w" | "b" | "draw" | null = null;
  private choiceBoards: BoardName[] = [];  // Boards available for selection during choice modes
  private historyStack: UltimateChessSnapshot[] = [];  // Stack for undo functionality

  constructor() {
    this.reset();
  }

  reset(): void {
    this.boards = createInitialBoards();
    this.requiredBoard = null;
    this.globalTurn = "w";
    this.capturedBoards = { white: [], black: [] };
    this.pendingChecks = {};
    this.moveHistory = [];
    this.moveCounter = 1;
    this.routingMode = "normal";
    this.decisionMaker = null;
    this.shouldShowModal = false;
    this.loserPicksWinner = null;
    this.ultimateWinner = null;
    this.choiceBoards = [];
    this.historyStack = [];
  }

  undo(): boolean {
    if (this.historyStack.length === 0) {
      return false;
    }

    const previousState = this.historyStack.pop()!;
    this.restoreFromSnapshot(previousState);
    return true;
  }

  canUndo(): boolean {
    return this.historyStack.length > 0;
  }

  private restoreFromSnapshot(snapshot: UltimateChessSnapshot): void {
    // Restore boards
    for (const name of BOARD_NAMES) {
      const boardState = snapshot.boards[name];
      const game = new Chess(boardState.fen);
      this.boards[name] = {
        game,
        fen: boardState.fen,
        status: boardState.status,
        winner: boardState.winner,
      };
    }

    // Restore other state
    this.requiredBoard = snapshot.requiredBoard;
    this.globalTurn = snapshot.globalTurn;
    this.capturedBoards = {
      white: [...snapshot.capturedBoards.white],
      black: [...snapshot.capturedBoards.black],
    };
    this.pendingChecks = { ...snapshot.pendingChecks };
    this.moveHistory = [...snapshot.moveHistory];
    this.routingMode = snapshot.routingMode;
    this.decisionMaker = snapshot.decisionMaker;
    this.shouldShowModal = snapshot.shouldShowModal;
    this.loserPicksWinner = snapshot.loserPicksWinner;
    this.ultimateWinner = snapshot.ultimateWinner;
    this.choiceBoards = [...snapshot.choiceBoards];
    
    // Recalculate move counter from move history
    this.moveCounter = snapshot.moveHistory.length > 0 ? snapshot.moveHistory[snapshot.moveHistory.length - 1].moveNumber + 1 : 1;
  }

  getSnapshot(): UltimateChessSnapshot {
    // Return shallow clones of mutable collections so that React state
    // comparisons work correctly and old snapshots are not mutated.
    const boardsCopy = {} as Record<BoardName, BoardState>;
    for (const name of BOARD_NAMES) {
      boardsCopy[name] = { ...this.boards[name] };
    }
    return {
      boards: boardsCopy,
      requiredBoard: this.requiredBoard,
      globalTurn: this.globalTurn,
      capturedBoards: {
        white: [...this.capturedBoards.white],
        black: [...this.capturedBoards.black],
      },
      pendingChecks: { ...this.pendingChecks },
      moveHistory: [...this.moveHistory],
      routingMode: this.routingMode,
      decisionMaker: this.decisionMaker,
      shouldShowModal: this.shouldShowModal,
      loserPicksWinner: this.loserPicksWinner,
      ultimateWinner: this.ultimateWinner,
      availableBoards: this.getAvailableBoards(),
      choiceBoards: [...this.choiceBoards],
    };
  }

  getBoardWinner(boardName: BoardName): BoardWinner {
    return statusToWinner(this.boards[boardName].status);
  }

  getAvailableBoards(): BoardName[] {
    if (this.ultimateWinner) return [];

    // Get all active boards
    const activeBoards = BOARD_NAMES.filter(
      (name) => this.boards[name].status === "active"
    );

    // Starting position - can play on pawn or knight board
    if (this.moveHistory.length === 0 && !this.requiredBoard) {
      return [...VALID_START_BOARDS];
    }

    // During modal/choice modes - no direct board selection
    if (this.routingMode === "castling-choice" || this.routingMode === "loser-picks") {
      return [];
    }

    // Normal routing mode
    if (this.routingMode === "normal") {
      // If required board is set, can only play there
      if (this.requiredBoard && activeBoards.includes(this.requiredBoard)) {
        return [this.requiredBoard];
      }
      return activeBoards;
    }

    // Free-pick mode - can play on any active board EXCEPT where the current player
    // is *checking* their opponent (pendingChecks stores the player in check).
    const availableForCurrentPlayer = activeBoards.filter(
      (name) => this.pendingChecks[name] !== getNextPlayer(this.globalTurn)
    );

    return availableForCurrentPlayer;
  }

  canMoveOnBoard(boardName: BoardName): boolean {
    return this.getAvailableBoards().includes(boardName);
  }

  chooseBoard(boardName: BoardName): boolean {
    if (this.boards[boardName].status !== "active") return false;
    const canChooseFromAvailable = this.getAvailableBoards().includes(boardName);
    const canChooseFromModalOptions =
      (this.routingMode === "castling-choice" || this.routingMode === "loser-picks") &&
      this.choiceBoards.includes(boardName);
    if (!canChooseFromAvailable && !canChooseFromModalOptions) {
      return false;
    }
    // Ensure the chosen board's turn matches the global turn
    this.syncBoardTurn(boardName, this.globalTurn);
    this.requiredBoard = boardName;
    this.routingMode = "normal";
    this.decisionMaker = null;
    this.shouldShowModal = false;
    this.choiceBoards = [];
    this.loserPicksWinner = null;
    return true;
  }

  makeMoveOnBoard(
    boardName: BoardName,
    sourceSquare: string,
    targetSquare: string,
    promotionPiece?: string
  ): MoveResult {
    if (!this.canMoveOnBoard(boardName)) {
      return { success: false, movedPieceType: null, wasCastling: false, gaveCheck: false };
    }

    const boardState = this.boards[boardName];
    const moveResult = makeMove(boardState.game, sourceSquare, targetSquare, promotionPiece);
    if (!moveResult.move || !moveResult.newGame) {
      return { success: false, movedPieceType: null, wasCastling: false, gaveCheck: false };
    }

    // Save current state to history before applying the successful move
    this.historyStack.push(this.getSnapshot());
    // Limit history stack to 100 moves to prevent memory issues
    if (this.historyStack.length > 100) {
      this.historyStack.shift();
    }

    const newGame = moveResult.newGame;
    const movedPieceType = moveResult.move.piece ?? null;
    const wasCastling = moveResult.move.flags.includes("k") || moveResult.move.flags.includes("q");
    const gaveCheck = newGame.inCheck();
    const currentPlayer = this.globalTurn;
    const nextPlayer = getNextPlayer(currentPlayer);

    this.boards[boardName] = {
      ...boardState,
      game: newGame,
      fen: newGame.fen(),
    };

    if (this.pendingChecks[boardName]) {
      delete this.pendingChecks[boardName];
    }

    if (gaveCheck) {
      this.pendingChecks[boardName] = newGame.turn();
    }

    this.updateBoardStatus(boardName);

    this.moveHistory.push({
      moveNumber: this.moveCounter,
      boardName,
      player: currentPlayer,
      move: moveResult.move.san,
      nextBoard: movedPieceType ? PIECE_TO_BOARD[movedPieceType] ?? boardName : boardName,
      gaveCheck,
      wasCastling,
    });
    this.moveCounter += 1;

    this.updateRoutingAfterMove(boardName, movedPieceType, wasCastling, currentPlayer, nextPlayer);

    return { success: true, movedPieceType, wasCastling, gaveCheck };
  }

  loadGame(
    savedBoards: Array<{ name: BoardName; fen: string; status: BoardStatus; winner: BoardWinner }>,
    savedTurn: "w" | "b",
    savedPendingChecks: Partial<Record<BoardName, "w" | "b">>,
    currentBoard: BoardName | null,
    savedRouting?: SavedRoutingState
  ): void {
    const restoredBoards = {} as Record<BoardName, BoardState>;
    for (const saved of savedBoards) {
      try {
        const game = new Chess(saved.fen);
        restoredBoards[saved.name] = {
          game,
          fen: saved.fen,
          status: saved.status,
          winner: saved.winner,
        };
      } catch {
        const game = new Chess();
        restoredBoards[saved.name] = {
          game,
          fen: game.fen(),
          status: "active",
          winner: null,
        };
      }
    }

    for (const boardName of BOARD_NAMES) {
      if (!restoredBoards[boardName]) {
        restoredBoards[boardName] = createInitialBoard();
      }
    }

    this.boards = restoredBoards;
    
    // Sync all active boards to the saved global turn
    for (const boardName of BOARD_NAMES) {
      if (this.boards[boardName].status === "active" && this.boards[boardName].game.turn() !== savedTurn) {
        this.syncBoardTurn(boardName, savedTurn);
      }
    }

    this.globalTurn = savedTurn;
    this.pendingChecks = { ...savedPendingChecks };
    this.requiredBoard =
      currentBoard && this.boards[currentBoard].status === "active" ? currentBoard : null;
    this.routingMode = "normal";
    this.decisionMaker = null;
    this.shouldShowModal = false;
    this.loserPicksWinner = null;
    this.choiceBoards = [];
    if (savedRouting) {
      this.routingMode = savedRouting.routingMode;
      this.decisionMaker = savedRouting.decisionMaker;
      this.shouldShowModal = savedRouting.shouldShowModal;
      this.loserPicksWinner = savedRouting.loserPicksWinner;
      this.choiceBoards = savedRouting.choiceBoards.filter(
        (name) => this.boards[name].status === "active"
      );
    }
    this.moveHistory = [];
    this.moveCounter = 1;
    this.capturedBoards = this.computeCapturedBoards();
    const kingStatus = this.boards["king"].status;
    this.ultimateWinner = kingStatus === "won-white" ? "w" : kingStatus === "won-black" ? "b" : kingStatus === "draw" ? "draw" : null;
    this.historyStack = []; // Clear history stack when loading a game
  }

  private computeCapturedBoards(): { white: BoardName[]; black: BoardName[] } {
    const captured = { white: [] as BoardName[], black: [] as BoardName[] };
    for (const boardName of BOARD_NAMES) {
      const winner = this.getBoardWinner(boardName);
      if (winner === "w") captured.white.push(boardName);
      if (winner === "b") captured.black.push(boardName);
    }
    return captured;
  }

  private updateBoardStatus(boardName: BoardName): void {
    const boardState = this.boards[boardName];
    const game = boardState.game;
    if (!game.isGameOver() || boardState.status !== "active") {
      return;
    }

    let status: BoardStatus = "draw";
    let winner: BoardWinner = "draw";

    if (game.isCheckmate()) {
      winner = game.turn() === "w" ? "b" : "w";
      status = winner === "w" ? "won-white" : "won-black";
    } else if (game.isDraw()) {
      status = "draw";
      winner = "draw";
    } else {
      status = "draw";
      winner = "draw";
    }

    this.boards[boardName] = {
      ...boardState,
      status,
      winner,
    };

    if (winner === "w" && !this.capturedBoards.white.includes(boardName)) {
      this.capturedBoards.white.push(boardName);
    }
    if (winner === "b" && !this.capturedBoards.black.includes(boardName)) {
      this.capturedBoards.black.push(boardName);
    }

    if (boardName === "king" && winner !== null) {
      this.ultimateWinner = winner;
    }
  }

  private syncBoardTurn(boardName: BoardName, expectedTurn: "w" | "b"): void {
    const boardState = this.boards[boardName];
    if (boardState.game.turn() !== expectedTurn) {
      try {
        // Setting the turn can throw in chess.js if the resulting state would be invalid
        // (for example trying to set a turn when a player is currently in check).
        boardState.game.setTurn(expectedTurn);
        this.boards[boardName] = {
          ...boardState,
          game: boardState.game,
          fen: boardState.game.fen(),
        };
      } catch (err) {
        // Fail-safe: don't let a chess.js exception crash the app. Keep the board state
        // as-is and update the FEN so the UI stays consistent. Log a warning so
        // we can diagnose cases where setTurn is not allowed by chess.js.
        console.warn(`syncBoardTurn failed for ${boardName} -> ${expectedTurn}:`, err);
        this.boards[boardName] = {
          ...boardState,
          fen: boardState.game.fen(),
        };
      }
    }
  }

  /**
   * Compute available boards for nextPlayer, considering only active boards
   * (excluding where nextPlayer is giving check)
   */
  private getAvailableBoardsForPlayer(player: "w" | "b"): BoardName[] {
    const activeBoards = BOARD_NAMES.filter(
      (name) => this.boards[name].status === "active"
    );

    // A player cannot play on a board where they are *checking* their opponent.
    // `pendingChecks[board]` holds the color of the player who is in check.
    // If that value equals the opponent, then `player` is checking the opponent
    // on that board and therefore cannot play there.
    return activeBoards.filter((name) => this.pendingChecks[name] !== getNextPlayer(player));
  }

  private checkBlockedState(nextPlayer: "w" | "b"): void {
    const activeBoards = BOARD_NAMES.filter(
      (name) => this.boards[name].status === "active"
    );

    // If opponent has no available boards to play on, current player draws
    if (activeBoards.length > 0) {
      const availableForNext = this.getAvailableBoardsForPlayer(nextPlayer);
      if (availableForNext.length === 0) {
        this.ultimateWinner = "draw";
      }
    }
  }

  private updateRoutingAfterMove(
    fromBoard: BoardName,
    movedPieceType: string | null,
    wasCastling: boolean,
    currentPlayer: "w" | "b",
    nextPlayer: "w" | "b"
  ): void {
    this.globalTurn = nextPlayer;

    // CASLING: Player makes a choice
    if (wasCastling) {
      const boardsAvailableForRookKing = [
        this.boards["rook"].status === "active" && this.pendingChecks["rook"] !== getNextPlayer(nextPlayer) ? "rook" : null,
        this.boards["king"].status === "active" && this.pendingChecks["king"] !== getNextPlayer(nextPlayer) ? "king" : null,
      ].filter(Boolean) as BoardName[];

      if (boardsAvailableForRookKing.length === 0) {
        // No valid choice after castling - auto choose from active boards if available
        const availableForOpponent = this.getAvailableBoardsForPlayer(nextPlayer);
        if (availableForOpponent.length === 1) {
          this.syncBoardTurn(availableForOpponent[0], nextPlayer);
          this.requiredBoard = availableForOpponent[0];
          this.routingMode = "normal";
          this.decisionMaker = null;
          this.shouldShowModal = false;
        } else {
          // Free pick from available boards
          this.routingMode = "free-pick";
          this.requiredBoard = null;
          this.decisionMaker = nextPlayer;
          // If the decision-maker is the same as the player to move, do not show
          // a modal — highlight available boards instead. Only show a modal when
          // the decider is choosing where the opponent will play.
          this.shouldShowModal = this.decisionMaker !== this.globalTurn && availableForOpponent.length > 1;
          for (const board of availableForOpponent) {
            this.syncBoardTurn(board, nextPlayer);
          }
        }
        return;
      }

      if (boardsAvailableForRookKing.length === 1) {
        // Only one option - no modal needed
        this.syncBoardTurn(boardsAvailableForRookKing[0], nextPlayer);
        this.requiredBoard = boardsAvailableForRookKing[0];
        this.routingMode = "normal";
        this.decisionMaker = null;
        this.shouldShowModal = false;
        return;
      }

      // Both rook and king available - show modal for castling choice
      this.routingMode = "castling-choice";
      this.requiredBoard = null;
      this.decisionMaker = currentPlayer;  // Current player chooses
      this.shouldShowModal = true;
      this.choiceBoards = boardsAvailableForRookKing;  // Store the boards available for choice
      // Sync both options
      for (const board of ["rook", "king"] as BoardName[]) {
        if (boardsAvailableForRookKing.includes(board)) {
          this.syncBoardTurn(board, nextPlayer);
        }
      }
      return;
    }

    // FORCED RANDOM MOVE (no piece type indicated)
    if (!movedPieceType) {
      // Free pick mode - currentPlayer just moved non-standard piece
      this.routingMode = "free-pick";
      this.requiredBoard = null;
      this.decisionMaker = nextPlayer;
      const availableForOpponent = this.getAvailableBoardsForPlayer(nextPlayer);
      this.shouldShowModal = this.decisionMaker !== this.globalTurn && availableForOpponent.length > 1;
      for (const board of availableForOpponent) {
        this.syncBoardTurn(board, nextPlayer);
      }
      return;
    }

    // NORMAL PIECE ROUTING
    const defaultBoard = PIECE_TO_BOARD[movedPieceType] ?? fromBoard;
    const defaultBoardWinner = this.getBoardWinner(defaultBoard);

    // DEFAULT BOARD IS FINISHED
    if (defaultBoardWinner !== null) {
      // If the default board is finished, decide routing based on who owns it.
      // If the board was won by the player who just moved (`currentPlayer`), that
      // player chooses where the opponent (`nextPlayer`) must play (loser-picks).
      // Otherwise (won by nextPlayer or draw), the nextPlayer gets to pick.

      const availableForNextPlayer = this.getAvailableBoardsForPlayer(nextPlayer);
      const availableForOpponent = availableForNextPlayer; // same set; clearer naming below

      if (defaultBoardWinner === currentPlayer) {
        // Winner chooses where the loser (nextPlayer) must play.
        if (availableForOpponent.length === 0) {
          this.routingMode = "normal";
          this.requiredBoard = null;
          this.checkBlockedState(nextPlayer);
          return;
        }
        if (availableForOpponent.length === 1) {
          this.syncBoardTurn(availableForOpponent[0], nextPlayer);
          this.requiredBoard = availableForOpponent[0];
          this.routingMode = "normal";
          this.decisionMaker = null;
          this.shouldShowModal = false;
          return;
        }
        this.routingMode = "loser-picks";
        this.requiredBoard = null;
        this.decisionMaker = currentPlayer; // Winner chooses
        this.loserPicksWinner = currentPlayer;
        this.shouldShowModal = true;
        this.choiceBoards = availableForOpponent;  // Store the boards available for choice
        for (const board of availableForOpponent) {
          this.syncBoardTurn(board, nextPlayer);
        }
        return;
      }

      // Default board is either won by nextPlayer or is a draw — nextPlayer chooses where to play.
      if (availableForNextPlayer.length === 0) {
        this.routingMode = "normal";
        this.requiredBoard = null;
        this.checkBlockedState(nextPlayer);
        return;
      }
      if (availableForNextPlayer.length === 1) {
        this.syncBoardTurn(availableForNextPlayer[0], nextPlayer);
        this.requiredBoard = availableForNextPlayer[0];
        this.routingMode = "normal";
        this.decisionMaker = null;
        this.shouldShowModal = false;
        return;
      }
      this.routingMode = "free-pick";
      this.requiredBoard = null;
      this.decisionMaker = nextPlayer;
      this.shouldShowModal = this.decisionMaker !== this.globalTurn && availableForNextPlayer.length > 1;
      for (const board of availableForNextPlayer) {
        this.syncBoardTurn(board, nextPlayer);
      }
      return;
    }

    // DEFAULT BOARD IS ACTIVE
    // If nextPlayer is IN CHECK on the default board, they must respond there.
    if (this.pendingChecks[defaultBoard] === nextPlayer) {
      this.syncBoardTurn(defaultBoard, nextPlayer);
      this.requiredBoard = defaultBoard;
      this.routingMode = "normal";
      this.decisionMaker = null;
      this.shouldShowModal = false;
      return;
    }

    // If nextPlayer is the one CHECKING on the default board (i.e. the board lists the opponent
    // as being in check), they cannot be forced to play there — allow them to choose elsewhere.
    if (this.pendingChecks[defaultBoard] === getNextPlayer(nextPlayer)) {
      const availableForNextPlayer = this.getAvailableBoardsForPlayer(nextPlayer);
      if (availableForNextPlayer.length === 0) {
        this.routingMode = "normal";
        this.requiredBoard = null;
        this.checkBlockedState(nextPlayer);
        return;
      }
      if (availableForNextPlayer.length === 1) {
        this.syncBoardTurn(availableForNextPlayer[0], nextPlayer);
        this.requiredBoard = availableForNextPlayer[0];
        this.routingMode = "normal";
        this.decisionMaker = null;
        this.shouldShowModal = false;
        return;
      }
      // Multiple options - show modal
      this.routingMode = "free-pick";
      this.requiredBoard = null;
      this.decisionMaker = nextPlayer;
      this.shouldShowModal = this.decisionMaker !== this.globalTurn && availableForNextPlayer.length > 1;
      for (const board of availableForNextPlayer) {
        this.syncBoardTurn(board, nextPlayer);
      }
      return;
    }

    // NORMAL CASE: nextPlayer plays on defaultBoard (not finished, and no conflicting checks)
    this.syncBoardTurn(defaultBoard, nextPlayer);
    this.requiredBoard = defaultBoard;
    this.routingMode = "normal";
    this.decisionMaker = null;
    this.shouldShowModal = false;
  }
}
