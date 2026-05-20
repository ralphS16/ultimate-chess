/**
 * useStockfish
 * Hook that manages a Stockfish web worker and exposes `getBestMove`.
 * This file is AI/engine integration code and contains no UI markup.
 */
import { useEffect, useRef, useCallback } from "react";
import { createStockfishEngine } from "../engines/stockfishEngine";
import type { ChessEngine } from "../engines/types";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStockfish(enabled: boolean): {
  getBestMove: (fen: string, skillLevel: number) => Promise<string | null>;
} {
  const engineRef = useRef<ChessEngine | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const engine = createStockfishEngine(true);
    engineRef.current = engine;
    // start init in background
    engine.init().catch(() => {
      /* swallow init errors; callers will get null moves */
    });

    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [enabled]);

  const getBestMove = useCallback((fen: string, skillLevel: number) => {
    if (!engineRef.current) return Promise.resolve<string | null>(null);
    return engineRef.current.getBestMove(fen, skillLevel);
  }, []);

  return { getBestMove };
}
