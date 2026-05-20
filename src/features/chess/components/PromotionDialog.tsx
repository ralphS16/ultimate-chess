/**
 * PromotionDialog
 * Simple UI for choosing a promotion piece. Presentation-only; the caller
 * should apply the selected promotion via engine actions.
 */
interface PromotionDialogProps {
  isOpen: boolean;
  targetSquare: string | null;
  onPromote: (piece: string) => void;
  isLoading?: boolean;
}

const PROMOTION_PIECES = [
  { type: "q", whiteSymbol: "♕", blackSymbol: "♛" },
  { type: "r", whiteSymbol: "♖", blackSymbol: "♜" },
  { type: "b", whiteSymbol: "♗", blackSymbol: "♝" },
  { type: "n", whiteSymbol: "♘", blackSymbol: "♞" },
] as const;

export function PromotionDialog({
  isOpen,
  targetSquare,
  onPromote,
  isLoading = false,
}: PromotionDialogProps) {
  if (!isOpen || !targetSquare) return null;

  const promotingColor = targetSquare[1] === "8" ? "w" : "b";

  return (
    <div className="promotion-dialog">
      {PROMOTION_PIECES.map(({ type, whiteSymbol, blackSymbol }) => {
        const symbol = promotingColor === "w" ? whiteSymbol : blackSymbol;
        return (
          <button
            key={type}
            onClick={() => onPromote(type)}
            title={type.toUpperCase()}
            disabled={isLoading}
            className={`promotion-piece ${promotingColor === "w" ? "promotion-piece--white" : ""} ${isLoading ? "promotion-piece--disabled" : ""}`}
          >
            {symbol}
          </button>
        );
      })}
    </div>
  );
}
