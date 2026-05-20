/**
 * gameStateSync.ts
 * Utilities for serializing and deserializing Ultimate Chess game state for multiplayer sync.
 * Used to transmit complete game state (all 6 boards, statuses, routing mode, etc.) to rejoining peers.
 */
import { type BoardName } from "../../chess/types/boardTypes";

export interface CompleteBoardState {
  [boardName: string]: {
    fen: string;
    status: "active" | "won-white" | "won-black" | "draw" | "idle";
    winner: "w" | "b" | null;
  };
}

export interface GameStateSnapshot {
  boards: CompleteBoardState;
  globalTurn: "w" | "b";
  requiredBoard: BoardName | null;
  capturedBoards: string[];
  routingMode: "normal" | "free-pick" | "castling-choice" | "loser-picks";
  decisionMaker?: "w" | "b" | null;
  shouldShowModal?: boolean;
  loserPicksWinner?: "w" | "b" | null;
  choiceBoards?: BoardName[];
  pendingChecks: { [boardName: string]: "w" | "b" };
}


