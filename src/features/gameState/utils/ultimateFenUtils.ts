/**
 * ultimateFenUtils
 * Utilities for encoding/decoding Ultimate Chess game state to/from a compact URL hash format.
 * Allows sharing game positions via URL fragments.
 */

import { type BoardName, BOARD_NAMES } from "../../chess/types/boardTypes";

export interface UltimateFenState {
  boards: Record<BoardName, string>; // FEN for each board
  turn: "w" | "b";
  requiredBoard: BoardName | null;
  routingMode: "normal" | "free-pick" | "castling-choice" | "loser-picks";
  boardStatuses: Record<BoardName, "active" | "won-white" | "won-black" | "draw">;
  boardWinners: Record<BoardName, "w" | "b" | null>;
  capturedBoardsWhite: BoardName[];
  capturedBoardsBlack: BoardName[];
}

/**
 * Encode Ultimate Chess game state to a compact Base64 string suitable for URLs.
 * This allows game positions to be shared via URL fragments.
 */
export function encodeFenToHash(state: UltimateFenState): string {
  const data = {
    b: BOARD_NAMES.map((name) => state.boards[name]), // boards
    t: state.turn === "w" ? 0 : 1, // turn (0=white, 1=black)
    r: state.requiredBoard, // required board
    m: encodeRoutingMode(state.routingMode), // routing mode (0=normal, 1=free-pick, 2=castling-choice, 3=loser-picks)
    s: BOARD_NAMES.map((name) =>
      state.boardStatuses[name] === "active"
        ? 0
        : state.boardStatuses[name] === "won-white"
          ? 1
          : state.boardStatuses[name] === "won-black"
            ? 2
            : 3
    ), // statuses
    w: BOARD_NAMES.map((name) =>
      state.boardWinners[name] === "w" ? 1 : state.boardWinners[name] === "b" ? 2 : 0
    ), // winners
    cw: state.capturedBoardsWhite, // captured white
    cb: state.capturedBoardsBlack, // captured black
  };

  const json = JSON.stringify(data);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // URL-safe Base64 encode
}

/**
 * Decode a hash back to Ultimate Chess game state.
 * Returns null if the hash is invalid.
 */
export function decodeHashToFen(hash: string): UltimateFenState | null {
  try {
    let base64 = hash.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const json = atob(base64); // Base64 decode
    const data = JSON.parse(json);

    if (
      !Array.isArray(data.b) ||
      data.b.length !== BOARD_NAMES.length ||
      typeof data.t !== "number" ||
      (data.r !== null && typeof data.r !== "string") ||
      typeof data.m !== "number"
    ) {
      return null;
    }

    const routingModes = ["normal", "free-pick", "castling-choice", "loser-picks"] as const;
    const routingMode = routingModes[data.m];

    const statusMap = ["active", "won-white", "won-black", "draw"] as const;
    const winnerMap: Record<number, "w" | "b" | null> = { 0: null, 1: "w", 2: "b" };

    const boards: Record<BoardName, string> = Object.fromEntries(
      BOARD_NAMES.map((name, i) => [name, data.b[i]])
    ) as Record<BoardName, string>;

    const statuses: Record<BoardName, "active" | "won-white" | "won-black" | "draw"> = Object.fromEntries(
      BOARD_NAMES.map((name, i) => [name, statusMap[data.s?.[i] ?? 0]])
    ) as Record<BoardName, "active" | "won-white" | "won-black" | "draw">;

    const winners: Record<BoardName, "w" | "b" | null> = Object.fromEntries(
      BOARD_NAMES.map((name, i) => [name, winnerMap[data.w?.[i] ?? 0]])
    ) as Record<BoardName, "w" | "b" | null>;

    if (data.r !== null && !BOARD_NAMES.includes(data.r as BoardName)) {
      return null;
    }

    const capturedWhite = Array.isArray(data.cw) ? (data.cw as BoardName[]) : [];
    const capturedBlack = Array.isArray(data.cb) ? (data.cb as BoardName[]) : [];

    return {
      boards,
      turn: data.t === 0 ? "w" : "b",
      requiredBoard: data.r ? (data.r as BoardName) : null,
      routingMode: routingMode || "normal",
      boardStatuses: statuses,
      boardWinners: winners,
      capturedBoardsWhite: capturedWhite,
      capturedBoardsBlack: capturedBlack,
    };
  } catch {
    return null;
  }
}

function encodeRoutingMode(
  mode: "normal" | "free-pick" | "castling-choice" | "loser-picks"
): number {
  const map = {
    normal: 0,
    "free-pick": 1,
    "castling-choice": 2,
    "loser-picks": 3,
  };
  return map[mode];
}
