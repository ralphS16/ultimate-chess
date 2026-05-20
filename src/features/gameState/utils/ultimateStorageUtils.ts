/**
 * ultimateCookieUtils
 * Helpers to encode/decode Ultimate Chess multi-board state for sessionStorage storage.
 * Pure data serialization logic separate from UI and engine rules.
 */
// Ultimate Chess sessionStorage utilities - stores multi-board game state
// Format: VERSION|BOARDS|ROUTING|META (Base64 encoded)

import { BOARD_NAMES, type BoardName } from '../../chess/types/boardTypes';

const CURRENT_VERSION = 1;

const ULTIMATE_GAME_STORAGE_KEY = 'ultimate_chess_game';
const ULTIMATE_STORAGE_ENABLED_KEY = 'ultimate_chess_storage_enabled';

// SessionStorage helper functions
function setStorageItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // sessionStorage may be unavailable in some environments
  }
}

function getStorageItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function deleteStorageItem(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // sessionStorage may be unavailable
  }
}

// ============================================================================
// Types
// ============================================================================

export type UltimateBoardStatus = 'active' | 'idle' | 'won-white' | 'won-black' | 'draw';
export type UltimateBoardWinner = 'white' | 'black' | 'draw' | 'none';

export interface UltimateBoardSnapshot {
  name: BoardName;
  fen: string;
  status: UltimateBoardStatus;
  winner: UltimateBoardWinner;
}

export interface UltimateRoutingState {
  currentBoard: BoardName | null;
  currentPlayer: 'w' | 'b';
  pendingChecks: Array<{ board: BoardName; color: 'white' | 'black' }>;
}

export interface UltimateGameMeta {
  startedAt: number;
  totalMoves: number;
  whitePlayer: 'human' | 'ai';
  blackPlayer: 'human' | 'ai';
}

export interface UltimateCurrentGame {
  version: number;
  boards: UltimateBoardSnapshot[];
  routing: UltimateRoutingState;
  meta: UltimateGameMeta;
}

// ============================================================================
// Encode/Decode Functions
// ============================================================================

/**
 * Encode UltimateCurrentGame to a compact Base64 JSON string
 */
export function encodeUltimateGame(game: UltimateCurrentGame): string {
  try {
    return btoa(JSON.stringify(game));
  } catch {
    return "";
  }
}

/**
 * Decode a Base64 JSON string back to UltimateCurrentGame
 * Returns null if invalid
 */
export function decodeUltimateGame(encoded: string): UltimateCurrentGame | null {
  try {
    // Base64 decode and parse JSON
    const decoded = atob(encoded);
    const game = JSON.parse(decoded) as Partial<UltimateCurrentGame>;
    
    // Structural validation
    if (!game || typeof game !== 'object') return null;
    if (typeof game.version !== 'number' || game.version > CURRENT_VERSION) return null;
    if (!Array.isArray(game.boards) || game.boards.length !== 6) return null;
    if (!game.routing || typeof game.routing !== 'object') return null;
    if (!game.meta || typeof game.meta !== 'object') return null;

    const validStatus: UltimateBoardStatus[] = ['active', 'idle', 'won-white', 'won-black', 'draw'];
    const validWinner: UltimateBoardWinner[] = ['white', 'black', 'draw', 'none'];
    const seenBoards = new Set<BoardName>();
    const boardsValid = game.boards.every((b) => {
      if (!b || typeof b !== 'object') return false;
      if (!BOARD_NAMES.includes(b.name as BoardName)) return false;
      if (seenBoards.has(b.name as BoardName)) return false;
      if (typeof b.fen !== 'string' || b.fen.length === 0) return false;
      if (!validStatus.includes(b.status as UltimateBoardStatus)) return false;
      if (!validWinner.includes(b.winner as UltimateBoardWinner)) return false;
      seenBoards.add(b.name as BoardName);
      return true;
    });
    if (!boardsValid || seenBoards.size !== BOARD_NAMES.length) return null;

    if (
      game.routing.currentBoard !== null &&
      !BOARD_NAMES.includes(game.routing.currentBoard as BoardName)
    ) {
      return null;
    }
    if (game.routing.currentPlayer !== 'w' && game.routing.currentPlayer !== 'b') return null;
    if (!Array.isArray(game.routing.pendingChecks)) return null;
    const pendingChecksValid = game.routing.pendingChecks.every((pc) => {
      if (!pc || typeof pc !== 'object') return false;
      if (!BOARD_NAMES.includes(pc.board as BoardName)) return false;
      return pc.color === 'white' || pc.color === 'black';
    });
    if (!pendingChecksValid) return null;

    if (
      typeof game.meta.startedAt !== 'number' ||
      typeof game.meta.totalMoves !== 'number' ||
      !Number.isFinite(game.meta.startedAt) ||
      !Number.isFinite(game.meta.totalMoves)
    ) {
      return null;
    }
    if (game.meta.whitePlayer !== 'human' && game.meta.whitePlayer !== 'ai') return null;
    if (game.meta.blackPlayer !== 'human' && game.meta.blackPlayer !== 'ai') return null;

    return game as UltimateCurrentGame;
  } catch {
    return null;
  }
}

// ============================================================================
// Cookie Functions
// ============================================================================

/**
 * Save Ultimate Chess game state to sessionStorage
 */
export function saveUltimateGameToStorage(game: UltimateCurrentGame | null): void {
  if (game === null) {
    deleteStorageItem(ULTIMATE_GAME_STORAGE_KEY);
    return;
  }
  
  const encoded = encodeUltimateGame(game);
  setStorageItem(ULTIMATE_GAME_STORAGE_KEY, encoded);
}

/**
 * Get Ultimate Chess game state from sessionStorage
 */
export function getUltimateGameFromStorage(): UltimateCurrentGame | null {
  const storageData = getStorageItem(ULTIMATE_GAME_STORAGE_KEY);
  if (!storageData) return null;
  
  return decodeUltimateGame(storageData);
}

/**
 * Delete Ultimate Chess game from sessionStorage
 */
export function deleteUltimateGameFromStorage(): void {
  deleteStorageItem(ULTIMATE_GAME_STORAGE_KEY);
}

/**
 * Get whether storage is enabled for Ultimate Chess
 */
export function getUltimateStorageEnabledPreference(): boolean {
  const storageData = getStorageItem(ULTIMATE_STORAGE_ENABLED_KEY);
  if (storageData === null) {
    // Default to enabled if not set
    setStorageItem(ULTIMATE_STORAGE_ENABLED_KEY, 'true');
    return true;
  }
  return storageData === 'true';
}

/**
 * Set whether storage is enabled for Ultimate Chess
 */
export function setUltimateStorageEnabledPreference(enabled: boolean): void {
  setStorageItem(ULTIMATE_STORAGE_ENABLED_KEY, String(enabled));
}
