/**
 * chessMoves
 * Utility helpers wrapping `chess.js` move generation and move application.
 * These are low-level helpers used by both single-board hooks and the
 * UltimateChess engine; keep them engine-focused and side-effect free.
 */
import { Chess, type Move, type Square } from "chess.js";

// Cache for legal moves to avoid recalculating for unchanged board states
const MAX_CACHE_SIZE = 100;
const legalMovesCache = new Map<string, Record<string, string[]>>();

/**
 * Clears the legal moves cache. Should be called when resetting the game.
 */
export function clearLegalMovesCache(): void {
  legalMovesCache.clear();
}

/**
 * Handles castling square adjustments for king moves
 * Converts castling target squares (like "h1") to actual destination squares ("g1")
 */
function adjustCastlingSquare(game: Chess, sourceSquare: string, targetSquare: string): string {
  const piece = game.get(sourceSquare as Square);
  if (piece && piece.type === "k") {
    if (sourceSquare === "e1") {
      if (targetSquare === "h1") return "g1";
      if (targetSquare === "a1") return "c1";
    } else if (sourceSquare === "e8") {
      if (targetSquare === "h8") return "g8";
      if (targetSquare === "a8") return "c8";
    }
  }
  return targetSquare;
}

/**
 * Detects a promotion by asking chess.js for verbose legal moves from the source square.
 */
export function isPromotionMove(game: Chess, from: string, to: string): boolean {
  const piece = game.get(from as Square);
  if (!piece || piece.type !== "p") return false;

  try {
    const moves = game.moves({
      square: from as Square,
      verbose: true,
    }) as Move[];
    return moves.some((m) => m.to === to && Boolean(m.promotion));
  } catch {
    return false;
  }
}

/**
 * Validates if a move to the target square is a legal promotion
 */
function isValidPromotionMove(game: Chess, from: string, to: string): boolean {
  try {
    const moves = game.moves({
      square: from as Square,
      verbose: true,
    }) as Move[];
    return moves.some((m) => m.to === to && !!m.promotion);
  } catch {
    return false;
  }
}

/**
 * Makes a chess move with proper castling and promotion handling
 * @param game - Chess.js instance
 * @param sourceSquare - Source square (e.g., "e2")
 * @param targetSquare - Target square (e.g., "e4")
 * @param promotionPiece - Promotion piece (optional, defaults to queen)
 * @returns The move object if successful, null if failed
 */
export function makeMove(
  game: Chess,
  sourceSquare: string,
  targetSquare: string,
  promotionPiece?: string
): { move: Move | null; newGame: Chess } {
  // Clone the game to avoid mutating the original
  const newGame = new Chess(game.fen());
  
  // Adjust castling squares based on actual piece
  const toSquare = adjustCastlingSquare(newGame, sourceSquare, targetSquare);
  
  // Check for pawn promotion
  if (isPromotionMove(newGame, sourceSquare, toSquare) && !promotionPiece) {
    // This is a promotion without a piece specified - caller should handle this
    return { move: null, newGame: game };
  }
  
  // Validate promotion move if promotion piece is provided
  if (promotionPiece && !isValidPromotionMove(newGame, sourceSquare, toSquare)) {
    return { move: null, newGame: game };
  }
  
  try {
    const move = newGame.move({
      from: sourceSquare,
      to: toSquare,
      promotion: promotionPiece ?? "q",
    });
    return { move: move || null, newGame };
  } catch {
    return { move: null, newGame: game };
  }
}

/**
 * Gets all legal moves for a piece on a given square with caching
 */
export function getLegalMoves(game: Chess, square: string): string[] {
  const fen = game.fen();
  
  // Check cache first
  const boardCache = legalMovesCache.get(fen);
  if (boardCache && boardCache[square]) {
    return boardCache[square];
  }
  
  try {
    const moves = game.moves({
      square: square as Square,
      verbose: true,
    }) as Move[];
    const targets = moves.map((m) => m.to);
    
    // Add castling target squares for king
    const piece = game.get(square as Square);
    if (piece && piece.type === "k") {
      moves.forEach((m) => {
        if (m.flags.includes("k"))
          targets.push(square === "e1" ? "h1" : "h8");
        if (m.flags.includes("q"))
          targets.push(square === "e1" ? "a1" : "a8");
      });
    }
    
    // Cache the result (evict oldest entries if cache is too large)
    if (!boardCache) {
      if (legalMovesCache.size >= MAX_CACHE_SIZE) {
        // Delete the oldest entry (first key in insertion order)
        const oldestKey = legalMovesCache.keys().next().value;
        if (oldestKey !== undefined) legalMovesCache.delete(oldestKey);
      }
      legalMovesCache.set(fen, { [square]: targets });
    } else {
      boardCache[square] = targets;
    }
    
    return targets;
  } catch {
    return [];
  }
}
