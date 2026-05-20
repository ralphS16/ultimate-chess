/**
 * Board types and constants for Ultimate Chess
 * Shared typedefs and mappings used by both engine and UI.
 */

export type BoardName = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';

export type BoardStatus = 'active' | 'won-white' | 'won-black' | 'draw';

export const BOARD_NAMES: BoardName[] = ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king'];

export const BOARD_DISPLAY_NAMES: Record<BoardName, string> = {
  pawn: 'Pawn Board',
  rook: 'Rook Board',
  knight: 'Knight Board',
  bishop: 'Bishop Board',
  queen: 'Queen Board',
  king: 'King Board',
};

export const BOARD_COLORS: Record<BoardName, string> = {
  pawn: '#8B4513',    // Saddle brown
  rook: '#2F4F4F',   // Dark slate gray
  knight: '#556B2F',  // Dark olive green
  bishop: '#483D8B',  // Dark slate blue
  queen: '#800080',   // Purple
  king: '#8B0000',    // Dark red
};

export const VALID_START_BOARDS: BoardName[] = ['pawn', 'knight'];

/** Maps piece types to their corresponding board names */
export const PIECE_TO_BOARD: Record<string, BoardName> = {
  p: 'pawn',
  r: 'rook',
  n: 'knight',
  b: 'bishop',
  q: 'queen',
  k: 'king',
};
