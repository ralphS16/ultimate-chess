/**
 * tacticalBoardChoice
 * Scans candidate boards for immediate checkmate or check opportunities.
 */
import { Chess, type Move } from "chess.js";

export interface TacticalBoardMove {
  boardName: string;
  from: string;
  to: string;
  promotion?: string;
  kind: "mate" | "check";
}

interface BoardCandidate {
  boardName: string;
  fen: string;
}

/**
 * Returns the best immediate tactic across boards for `player`.
 * Prefers checkmate; does NOT prefer check-in-1 (avoid draw-prone checks).
 */
export function findTacticalBoardMove(
  candidates: BoardCandidate[],
  player: "w" | "b",
): TacticalBoardMove | null {
  // store a non-tactical move on the king board to prefer when no tactics exist
  let kingBoardFallback: TacticalBoardMove | null = null;

  for (const { boardName, fen } of candidates) {
    let game: Chess;
    try {
      game = new Chess(fen);
    } catch {
      continue;
    }

    if (game.turn() !== player || game.isGameOver()) continue;

    const moves = game.moves({ verbose: true }) as Move[];
    for (const move of moves) {
      const trial = new Chess(fen);
      try {
        trial.move({
          from: move.from,
          to: move.to,
          ...(move.promotion ? { promotion: move.promotion } : {}),
        });
      } catch {
        continue;
      }

      if (trial.isCheckmate()) {
        // Prefer mate on the king board first
        if (boardName === "king") {
          return {
            boardName,
            from: move.from,
            to: move.to,
            promotion: move.promotion,
            kind: "mate",
          };
        }

        return {
          boardName,
          from: move.from,
          to: move.to,
          promotion: move.promotion,
          kind: "mate",
        };
      }

      // Intentionally ignore in-check (check-in-1) tactical suggestions —
      // these often lead to draws and are not prioritized here.
    }

    // Save a simple fallback move on the king board (first legal move)
    if (!kingBoardFallback && boardName === "king" && !game.isGameOver() && game.turn() === player) {
      const legal = game.moves({ verbose: true }) as Move[];
      if (legal && legal.length > 0) {
        const m = legal[0];
        kingBoardFallback = {
          boardName,
          from: m.from,
          to: m.to,
          promotion: m.promotion,
          kind: "check", // semantic placeholder (not necessarily a check)
        };
      }
    }
  }

  // Prefer mate found earlier; if none, prefer playing on the king board
  if (kingBoardFallback) return kingBoardFallback;
  return null;
}

/**
 * Choose a board to send the opponent to based on heuristics.
 * Ranking (high -> low):
 * - board where opponent's only available moves are king moves
 * - board where opponent has no mate-in-1
 * - board where opponent has no check-in-1
 * - arbitrary board
 * - deprioritize boards where opponent is currently in check
 */
export function pickBoardForOpponent(
  candidates: BoardCandidate[],
  opponent: "w" | "b",
  pendingChecks: Partial<Record<string, "w" | "b">> = {},
): string | null {
  type ScoreEntry = { boardName: string; score: number };
  const scores: ScoreEntry[] = [];

  for (const { boardName, fen } of candidates) {
    let game: Chess;
    try {
      game = new Chess(fen);
    } catch {
      continue;
    }

    // Ensure the board turn is set to the opponent for evaluation where possible
    try {
      game.setTurn(opponent);
    } catch {
      // ignore failures — we'll still evaluate moves from current perspective
    }

    if (game.isGameOver()) {
      scores.push({ boardName, score: 0 });
      continue;
    }

    const moves = game.moves({ verbose: true }) as Move[];

    const onlyKingMove = moves.length > 0 && moves.every((m) => m.piece === "k");

    let hasMateIn1 = false;
    let hasCheckIn1 = false;
    for (const move of moves) {
      const trial = new Chess(fen);
      try {
        trial.setTurn(opponent);
      } catch {
        // ignore
      }
      try {
        trial.move({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) });
      } catch {
        continue;
      }
      if (trial.isCheckmate()) hasMateIn1 = true;
      if (trial.inCheck()) hasCheckIn1 = true;
      if (hasMateIn1 && hasCheckIn1) break;
    }

    let score = 0;
    if (onlyKingMove) score += 1000;
    if (!hasMateIn1) score += 200;
    if (!hasCheckIn1) score += 100;
    if (pendingChecks[boardName] === opponent) score -= 50; // deprioritize boards where opponent is already in check

    scores.push({ boardName, score });
  }

  if (scores.length === 0) return null;
  scores.sort((a, b) => b.score - a.score);
  return scores[0].boardName;
}
