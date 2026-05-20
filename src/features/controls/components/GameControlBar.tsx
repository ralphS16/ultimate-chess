import { useState, useCallback, useEffect, useMemo } from 'react';

export type NewGameMode = 'local' | 'ai' | 'host';

export interface AIConfig {
  players: { w: "human" | "ai"; b: "human" | "ai" };
  skills?: { w: number; b: number };
}

interface GameControlBarProps {
  linkCopied: boolean;
  onSaveGame: () => void;
  onStartNewGame: (mode: NewGameMode, config?: AIConfig) => void;
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
  hasSavedGame?: boolean;
  onResumeSavedGame?: () => void;
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
  hasSavedGame,
  onResumeSavedGame,
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
  const [menuPath, setMenuPath] = useState<('new' | 'local' | 'online' | 'host' | 'join')[]>([]);
  const [localGameStarted, setLocalGameStarted] = useState(false);
  const [continueLocal, setContinueLocal] = useState(false);
  // AI settings staging
  const [localAiPlayers, setLocalAiPlayers] = useState<{ w: "human" | "ai"; b: "human" | "ai" }>(() => ({ w: "human", b: "human" }));
  const [joinInput, setJoinInput] = useState("");
  const [localLinkCopied, setLocalLinkCopied] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const effectiveMenuPath = useMemo(
    () => (connected && menuPath.includes('join') ? [] : menuPath),
    [connected, menuPath]
  );

  useEffect(() => {
    const isConfiguring = effectiveMenuPath.length > 0 && !localGameStarted;
    onConfigChange?.(isConfiguring);
  }, [effectiveMenuPath, localGameStarted, onConfigChange]);

  useEffect(() => {
    if (connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsJoining(false);
    }
  }, [connected]);

  const handleCopyInvite = useCallback(() => {
    if (!roomId) return;
    const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setLocalLinkCopied(true);
      setTimeout(() => setLocalLinkCopied(false), 2000);
    });
  }, [roomId]);

  const pushMenu = (path: 'new' | 'local' | 'online' | 'host' | 'join') => {
    if (path === 'new') {
      if (menuPath.length > 0) {
        setMenuPath([]);
      } else {
        setMenuPath(['new']);
        setLocalGameStarted(false);
        setContinueLocal(false);
        if (aiPlayers) setLocalAiPlayers(aiPlayers);
      }
    } else {
      if (path === 'local' || path === 'online') {
        setMenuPath(['new', path]);
        if (path === 'local') {
          if (aiPlayers) setLocalAiPlayers(aiPlayers);
        }
      }
      else if (path === 'host' || path === 'join') setMenuPath(['new', 'online', path]);
    }
  };

  const getCombinedValue = (color: "w" | "b") => {
    const type = localAiPlayers[color];
    return type === "human" ? "human" : "ai";
  };

  const handleCombinedChange = (color: "w" | "b", value: string) => {
    const nextPlayers = { ...localAiPlayers, [color]: value as "human" | "ai" };
    setLocalAiPlayers(nextPlayers);
    if (localGameStarted) onApplyAIOptions?.({ players: nextPlayers });
  };

  const handleStartLocal = () => {
    const hasAi = localAiPlayers.w === "ai" || localAiPlayers.b === "ai";
    if (hasAi) {
      onStartNewGame("ai", { players: localAiPlayers });
    } else {
      onStartNewGame("local", { players: localAiPlayers });
    }
    setLocalGameStarted(true);
  };

  const handleResumeSavedGameClick = () => {
    onResumeSavedGame?.();
    // Keep local controls visible after resuming a saved local session.
    setMenuPath(['new', 'local']);
    setLocalGameStarted(true);
  };

  const handleContinueLocallyClick = () => {
    if (playerColor) {
      setLocalAiPlayers({
        w: playerColor === 'w' ? 'human' : 'ai',
        b: playerColor === 'b' ? 'human' : 'ai',
      });
    }
    setContinueLocal(true);
  };

  const isContinueLocal = mode === 'multi' ? continueLocal : false;

  // Reusable player selector
  const renderPlayerSelector = () => (
    <>
      <select
        value={getCombinedValue("w")}
        onChange={(e) => handleCombinedChange("w", e.target.value)}
        className="btn--toggle"
        style={{ display: 'inline-block' }}
      >
        <option value="human">Human</option>
        <option value="ai">AI</option>
      </select>
      <span className="btn--toggle" style={{ paddingLeft: '8px', paddingRight: 0, borderRight: 'none', pointerEvents: 'none', color: 'var(--color-text-dim)' }}>White:</span>

      <select
        value={getCombinedValue("b")}
        onChange={(e) => handleCombinedChange("b", e.target.value)}
        className="btn--toggle"
        style={{ display: 'inline-block' }}
      >
        <option value="human">Human</option>
        <option value="ai">AI</option>
      </select>
      <span className="btn--toggle" style={{ paddingLeft: '8px', paddingRight: 0, borderRight: 'none', pointerEvents: 'none', color: 'var(--color-text-dim)' }}>Black:</span>

    </>
  );

  return (
    <div className="control-bar-wrapper" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>

      {/* Left dynamic breadcrumb group (always rendered) */}
      <div className="toggle-group" style={{ margin: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        {effectiveMenuPath.length === 0 ? (
          <button
            className="btn--toggle"
            onClick={() => pushMenu('new')}
          >
            New Game
          </button>
        ) : (
          <>
            {effectiveMenuPath.map((seg, idx) => {
              const isLast = idx === effectiveMenuPath.length - 1;
              const label = seg === 'new' ? 'New Game' : seg === 'local' ? 'Local' : seg === 'online' ? 'Online' : seg === 'host' ? 'Host' : 'Join';
              return (
                <span key={`${seg}-${idx}`}>
                  {isLast ? (
                    <span className={`btn--toggle ${isLast ? 'btn--toggle-active' : ''}`} style={{ pointerEvents: 'none' }}>{label}</span>
                  ) : (
                    <button
                      className="btn--toggle"
                      onClick={() => setMenuPath(effectiveMenuPath.slice(0, idx + 1))}
                    >
                      {label}
                    </button>
                  )}
                  {!isLast && null}
                </span>
              );
            })}

            {/* Action area for the current (last) segment */}
            {(() => {
              const last = effectiveMenuPath[effectiveMenuPath.length - 1];
              if (last === 'new') {
                return (
                  <>
                    <button className="btn--toggle" onClick={() => pushMenu('local')}>Local Game</button>
                    <button className="btn--toggle" onClick={() => pushMenu('online')}>Online Game</button>
                  </>
                );
              }
              if (last === 'local') {
                return (
                  <>
                    {renderPlayerSelector()}
                    {!localGameStarted && (
                      <button className="btn--toggle" onClick={handleStartLocal}>Start</button>
                    )}
                    {localGameStarted && (localAiPlayers.w === 'ai' || localAiPlayers.b === 'ai') && (
                      <button className="btn--toggle" onClick={onPauseResume}>{aiPaused ? 'Resume AI' : 'Pause AI'}</button>
                    )}
                  </>
                );
              }
              if (last === 'online') {
                return (
                  <>
                    <button className="btn--toggle" onClick={() => { pushMenu('host'); onStartNewGame('host'); }}>Host Game</button>
                    <button className="btn--toggle" onClick={() => pushMenu('join')}>Join Game</button>
                  </>
                );
              }
              if (last === 'host') {
                return (
                  <>
                    <span className="btn--toggle" onClick={handleCopyInvite} style={{ cursor: 'pointer' }}>Room: {roomId || '...'}</span>
                    <button className="btn--toggle" onClick={handleCopyInvite}>{localLinkCopied ? 'Copied!' : 'Copy Link'}</button>
                  </>
                );
              }
              if (last === 'join') {
                return (
                  <>
                    <input
                      type="text"
                      placeholder="Room Name"
                      className="btn--toggle"
                      style={{ minWidth: 0, border: 'none', borderRight: '2px solid var(--color-border-primary)', outline: 'none' }}
                      value={joinInput}
                      onChange={(e) => setJoinInput(e.target.value)}
                    />
                    <button
                      className="btn--toggle"
                      disabled={!joinInput.trim() || connected || isJoining}
                      onClick={() => {
                        setIsJoining(true);
                        onJoinRoom(joinInput);
                      }}
                    >
                      {isJoining ? 'Joining...' : connected ? 'Joined' : 'Join'}
                    </button>
                  </>
                );
              }
              return null;
            })()}
          </>
        )}
      </div>

      {/* Top Level Buttons */}
      <div className="toggle-group control-top-level" style={{ margin: 0, display: 'flex', flexDirection: 'row' }}>
        {isContinueLocal && (
          <>
            {renderPlayerSelector()}
            <button className="btn--toggle btn--toggle-active" onClick={() => onContinueLocally?.({ players: localAiPlayers })}>Resume</button>
          </>
        )}

        {mode === 'multi' && !isContinueLocal && (
          <span className="btn--toggle" style={{ pointerEvents: 'none', fontWeight: 'bold' }}>
            {peerLeft && !isReconnecting ? "Opponent disconnected – game over" :
              isReconnecting ? "Opponent reconnecting..." :
                !playerColor ? (isJoiner ? "Connecting..." : "Waiting for opponent...") :
                  `Online – ${playerColor === 'w' ? 'White' : 'Black'} ${latency != null ? `(${latency}ms)` : ''}`
            }
          </span>
        )}

        {mode === 'multi' && connected && !peerLeft && !isReconnecting && (
          <>
            {!rematchSent && !rematchIncoming && (
              <button className="btn--toggle" onClick={() => onRequestRematch?.()}>Request Restart</button>
            )}
            {rematchIncoming && !rematchSent && (
              <button className="btn--toggle btn--toggle-active" onClick={() => onRequestRematch?.()}>Agree to Restart</button>
            )}
            {rematchSent && !rematchIncoming && (
              <span className="btn--toggle" style={{ pointerEvents: 'none' }}>Restart requested</span>
            )}
            {rematchSent && rematchIncoming && (
              <span className="btn--toggle btn--toggle-active" style={{ pointerEvents: 'none' }}>Restarting…</span>
            )}
          </>
        )}

        {mode === 'multi' && peerLeft && !isReconnecting && !isContinueLocal && (
          <>
            <button className="btn--toggle" onClick={onLeaveGame}>Leave Game</button>
            <button className="btn--toggle btn--toggle-active" onClick={handleContinueLocallyClick} title="Continue playing against AI after opponent disconnects">Continue Locally</button>
          </>
        )}

        {mode === 'multi' && (!peerLeft || isReconnecting) && !isContinueLocal && (
          <button className="btn--toggle" onClick={onLeaveGame}>
            Leave Game
          </button>
        )}

        {hasSavedGame && !roomId && mode !== 'multi' && (
          <button className="btn--toggle btn--toggle-active" onClick={handleResumeSavedGameClick}>
            Resume Game
          </button>
        )}


        <button
          onClick={onUndo}
          disabled={!canUndo || mode === 'multi'}
          className={`btn--toggle ${!canUndo || mode === 'multi' ? 'btn--toggle-disabled' : ''}`}
          title={mode === 'multi' ? "Undo not available in multiplayer games" : canUndo ? "Undo last move (Ctrl+Z/Cmd+Z)" : "No moves to undo"}
        >
          Undo
        </button>
        <button
          onClick={onSaveGame}
          className={`btn--toggle ${linkCopied ? "btn--toggle-active" : ""}`}
          title="Save position as shareable link (Ctrl+S/Cmd+S)"
        >
          {linkCopied ? "✓ Copied!" : "Save Game"}
        </button>
      </div>

    </div>
  );
}
