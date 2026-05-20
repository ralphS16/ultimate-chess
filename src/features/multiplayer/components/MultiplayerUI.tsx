/**
 * Multiplayer UI components and overlays.
 * Presents room state and remote-player indicators. Pure UI — does not handle transport.
 */

export function OpponentChoosingOverlay({
  routingMode,
  playerColor,
  globalTurn,
  show,
}: {
  routingMode?: { kind: "normal" | "free-pick" | "castling-choice" | "loser-picks"; winner?: "w" | "b" } | null;
  playerColor: "w" | "b" | null;
  globalTurn: "w" | "b";
  show: boolean;
}) {
  if (!show || !routingMode || !playerColor) return null;

  const isOpponentTurn = globalTurn !== playerColor;
  if (!isOpponentTurn) return null;

  const routingDescription = {
    "free-pick": "Choose a board",
    "castling-choice": "Choose between rook and king",
    "loser-picks": "Choose where you play next",
  } as const;

  const description = routingDescription[routingMode.kind as keyof typeof routingDescription];

  return (
    <div
      className="opponent-choosing-overlay"
      role="status"
      aria-live="polite"
    >
      <div className="opponent-choosing-overlay__content">
        <span className="opponent-choosing-overlay__dot">●</span>
        <span>Opponent is {description}...</span>
      </div>
    </div>
  );
}
