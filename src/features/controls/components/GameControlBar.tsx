import { useCallback, useEffect, useState } from "react";

export type NewGameMode = "local" | "ai" | "host";
export type GameSessionState = "idle" | "loaded-paused" | "active" | "finished";

export interface AIConfig {
  players: { w: "human" | "ai"; b: "human" | "ai" };
  skills?: { w: number; b: number };
}

interface GameControlBarProps {
  linkCopied: boolean;
  onSaveGame: () => void;
  onStartNewGame: (mode: NewGameMode, config?: AIConfig) => void;
  onResumeLoadedGame: () => void;
  sessionState: GameSessionState;
  optionsOpen: boolean;
  onOptionsOpenChange: (open: boolean) => void;
  roomId?: string | null;
  connected?: boolean;
  onJoinRoom: (roomId: string) => void;
  aiPlayers?: { w: "human" | "ai"; b: "human" | "ai" };
  mode?: "single" | "multi";
  isJoiner?: boolean;
  playerColor?: "w" | "b" | null;
  latency?: number | null;
  onApplyAIOptions?: (config: AIConfig) => void;
  onConfigChange?: (configuring: boolean) => void;
  canUndo?: boolean;
  onUndo?: () => boolean;
  canSave?: boolean;
  aiPaused?: boolean;
  onPauseResume?: () => void;
  peerLeft?: boolean;
  isReconnecting?: boolean;
  onLeaveGame?: () => void;
  onContinueLocally?: (config: AIConfig) => void;
  rematchSent?: boolean;
  rematchIncoming?: boolean;
  onRequestRematch?: () => void;
}

export function GameControlBar({
  linkCopied,
  onSaveGame,
  onStartNewGame,
  onResumeLoadedGame,
  sessionState,
  optionsOpen,
  onOptionsOpenChange,
  roomId,
  connected,
  onJoinRoom,
  aiPlayers,
  onApplyAIOptions,
  mode,
  isJoiner,
  playerColor,
  latency,
  onConfigChange,
  canUndo = false,
  onUndo,
  canSave = false,
  aiPaused,
  onPauseResume,
  peerLeft,
  isReconnecting,
  onLeaveGame,
  onContinueLocally,
  rematchSent,
  rematchIncoming,
  onRequestRematch,
}: GameControlBarProps) {
  const [setupMode, setSetupMode] = useState<"local" | "online">("local");
  const [onlineAction, setOnlineAction] = useState<"host" | "join">("host");
  const [localAiPlayers, setLocalAiPlayers] = useState<{ w: "human" | "ai"; b: "human" | "ai" }>(
    () => aiPlayers ?? { w: "human", b: "human" }
  );
  const [joinInput, setJoinInput] = useState("");
  const [localLinkCopied, setLocalLinkCopied] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const isSetupVisible = optionsOpen || sessionState === "idle" || sessionState === "loaded-paused" || mode === "multi";
  const isLoadedPaused = sessionState === "loaded-paused";
  const hasAi = localAiPlayers.w === "ai" || localAiPlayers.b === "ai";

  useEffect(() => {
    if (aiPlayers) {
      const t = window.setTimeout(() => setLocalAiPlayers(aiPlayers), 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [aiPlayers]);

  useEffect(() => {
    onConfigChange?.(isSetupVisible && mode !== "multi" && sessionState !== "active");
  }, [isSetupVisible, mode, sessionState, onConfigChange]);

  useEffect(() => {
    if (connected) {
      const t = window.setTimeout(() => setIsJoining(false), 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [connected]);

  const handleCopyInvite = useCallback(() => {
    if (!roomId) return;
    const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setLocalLinkCopied(true);
      setTimeout(() => setLocalLinkCopied(false), 2000);
    });
  }, [roomId]);

  const handlePlayerChange = (color: "w" | "b", value: string) => {
    const nextPlayers = { ...localAiPlayers, [color]: value as "human" | "ai" };
    setLocalAiPlayers(nextPlayers);
    if (sessionState === "active" && mode !== "multi") {
      onApplyAIOptions?.({ players: nextPlayers });
    }
  };

  const handleStartLocal = () => {
    onStartNewGame(hasAi ? "ai" : "local", { players: localAiPlayers });
    onOptionsOpenChange(false);
  };

  const handleResume = () => {
    onResumeLoadedGame();
    onOptionsOpenChange(false);
  };

  const handleHost = () => {
    onStartNewGame("host");
    onOptionsOpenChange(true);
    setSetupMode("online");
    setOnlineAction("host");
  };

  const handleJoin = () => {
    const trimmed = joinInput.trim();
    if (!trimmed) return;
    setIsJoining(true);
    onJoinRoom(trimmed);
  };

  const handleNewLocalFromMultiplayer = () => {
    onStartNewGame(hasAi ? "ai" : "local", { players: localAiPlayers });
    onOptionsOpenChange(false);
  };

  const handleContinueLocally = () => {
    const players = playerColor
      ? {
          w: playerColor === "w" ? "human" as const : "ai" as const,
          b: playerColor === "b" ? "human" as const : "ai" as const,
        }
      : localAiPlayers;

    setLocalAiPlayers(players);
    onContinueLocally?.({ players });
    onOptionsOpenChange(false);
  };

  const multiplayerStatus =
    peerLeft && !isReconnecting
      ? "Opponent disconnected - game over"
      : isReconnecting
        ? "Opponent reconnecting..."
        : !playerColor
          ? isJoiner ? "Connecting..." : "Waiting for opponent..."
          : `Online - ${playerColor === "w" ? "White" : "Black"}${latency != null ? ` (${latency}ms)` : ""}`;

  const restartLabel =
    rematchSent && rematchIncoming
      ? "Restarting..."
      : rematchIncoming
        ? "Agree to Restart"
        : rematchSent
          ? "Restart requested"
          : "Request Restart";

  return (
    <div className="control-shell">
      <div className="toggle-group control-top-level">
        <button
          className={`btn--toggle ${optionsOpen ? "btn--toggle-active" : ""}`}
          onClick={() => onOptionsOpenChange(!optionsOpen)}
        >
          New Game
        </button>
        <button
          onClick={onUndo}
          disabled={!canUndo || mode === "multi" || sessionState !== "active"}
          className={`btn--toggle ${!canUndo || mode === "multi" || sessionState !== "active" ? "btn--toggle-disabled" : ""}`}
          title={mode === "multi" ? "Undo not available in multiplayer games" : canUndo ? "Undo last move (Ctrl+Z/Cmd+Z)" : "No moves to undo"}
        >
          Undo
        </button>
        <button
          onClick={onSaveGame}
          disabled={!canSave || sessionState !== "active"}
          className={`btn--toggle ${linkCopied ? "btn--toggle-active" : ""} ${!canSave || sessionState !== "active" ? "btn--toggle-disabled" : ""}`}
          title="Save position as shareable link (Ctrl+S/Cmd+S)"
        >
          {linkCopied ? "Copied!" : "Save Game"}
        </button>
      </div>

      {isSetupVisible && (
        <div className="control-options-row">
          {mode === "multi" && sessionState === "active" && (
            <div className="toggle-group control-options-group">
              <span className="btn--toggle control-status">{multiplayerStatus}</span>
              <button
                className={`btn--toggle ${rematchIncoming ? "btn--toggle-active" : ""}`}
                onClick={onRequestRematch}
                disabled={!connected || !!peerLeft || !!isReconnecting || rematchSent}
              >
                {restartLabel}
              </button>
              <button className="btn--toggle" onClick={handleNewLocalFromMultiplayer}>
                Local Game
              </button>
              {peerLeft && !isReconnecting && (
                <button className="btn--toggle" onClick={handleContinueLocally}>
                  Continue Locally
                </button>
              )}
              <button className="btn--toggle" onClick={handleHost}>
                New Room
              </button>
              <button className="btn--toggle" onClick={onLeaveGame}>
                Leave Room
              </button>
            </div>
          )}

          {mode !== "multi" && (
            <>
              <div className="toggle-group control-options-group">
                <button
                  className={`btn--toggle ${setupMode === "local" ? "btn--toggle-active" : ""}`}
                  onClick={() => setSetupMode("local")}
                >
                  Local
                </button>
                <button
                  className={`btn--toggle ${setupMode === "online" ? "btn--toggle-active" : ""}`}
                  onClick={() => setSetupMode("online")}
                >
                  Online
                </button>
              </div>

              {setupMode === "local" && (
                <div className="toggle-group control-options-group">
                  <span className="btn--toggle control-label">White</span>
                  <select
                    value={localAiPlayers.w}
                    onChange={(e) => handlePlayerChange("w", e.target.value)}
                    className="btn--toggle control-select"
                  >
                    <option value="human">Human</option>
                    <option value="ai">AI</option>
                  </select>
                  <span className="btn--toggle control-label">Black</span>
                  <select
                    value={localAiPlayers.b}
                    onChange={(e) => handlePlayerChange("b", e.target.value)}
                    className="btn--toggle control-select"
                  >
                    <option value="human">Human</option>
                    <option value="ai">AI</option>
                  </select>
                  <button className="btn--toggle btn--toggle-active" onClick={isLoadedPaused ? handleResume : handleStartLocal}>
                    {isLoadedPaused ? "Resume" : "Start"}
                  </button>
                  {sessionState === "active" && hasAi && (
                    <button className="btn--toggle" onClick={onPauseResume}>
                      {aiPaused ? "Resume AI" : "Pause AI"}
                    </button>
                  )}
                </div>
              )}

              {setupMode === "online" && (
                <>
                  <div className="toggle-group control-options-group">
                    <button
                      className={`btn--toggle ${onlineAction === "host" ? "btn--toggle-active" : ""}`}
                      onClick={() => setOnlineAction("host")}
                    >
                      Host
                    </button>
                    <button
                      className={`btn--toggle ${onlineAction === "join" ? "btn--toggle-active" : ""}`}
                      onClick={() => setOnlineAction("join")}
                    >
                      Join
                    </button>
                  </div>

                  {onlineAction === "host" && (
                    <div className="toggle-group control-options-group">
                      {roomId ? (
                        <>
                          <button className="btn--toggle" onClick={handleCopyInvite}>
                            Room: {roomId}
                          </button>
                          <button className="btn--toggle" onClick={handleCopyInvite}>
                            {localLinkCopied ? "Copied!" : "Copy Link"}
                          </button>
                        </>
                      ) : (
                        <button className="btn--toggle btn--toggle-active" onClick={handleHost}>
                          Host Game
                        </button>
                      )}
                    </div>
                  )}

                  {onlineAction === "join" && (
                    <div className="toggle-group control-options-group">
                      <input
                        type="text"
                        placeholder="Room Name"
                        className="btn--toggle control-room-input"
                        value={joinInput}
                        onChange={(e) => setJoinInput(e.target.value)}
                      />
                      <button
                        className="btn--toggle btn--toggle-active"
                        disabled={!joinInput.trim() || connected || isJoining}
                        onClick={handleJoin}
                      >
                        {isJoining ? "Joining..." : connected ? "Joined" : "Join"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
