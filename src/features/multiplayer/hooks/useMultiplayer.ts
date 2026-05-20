/**
 * useMultiplayer
 * Hook that encapsulates Trystero room logic and messaging for multiplayer.
 * Exposes send/receive callbacks; does not contain UI markup.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { joinRoom } from "trystero";
import { generateRoomId } from "../utils/dictionary";
import type { GameStateSnapshot } from "../utils/gameStateSync";

type MovePayload = { boardName: string; from: string; to: string; promotion?: string };
type SetupPayload = GameStateSnapshot;
type TimeoutPayload = { color: "w" | "b" };
type RematchRequestPayload = { blitz: boolean };
type RematchResponsePayload = { accepted: boolean };
type RoutingModePayload = {
  mode: "normal" | "free-pick" | "castling-choice" | "loser-picks";
  requiredBoard?: string | null;
};
type BoardChoicePayload = { boardName: string };
type ColorAssignmentPayload = { hostColor: "w" | "b" };
export type Mode = "single" | "multi";

export function useMultiplayer({
  onRemoteMove,
  onRemoteReset,
  onRemoteSetup,
  onRemoteTimeout,
  onRemoteRematchRequest,
  onRemoteRematchResponse,
  onRemoteRoutingMode,
  onRemoteBoardChoice,
  getFen,
  getBlitz,
  getClockTimes,
  getHasMoves,
}: {
  onRemoteMove: (boardName: string, from: string, to: string, promotion?: string) => boolean;
  onRemoteReset: () => void;
  /** Called on the joiner when the host sends the complete game state on connect/rejoin. */
  onRemoteSetup: (setup: GameStateSnapshot) => void;
  /** Called when the opponent's clock reaches zero. */
  onRemoteTimeout: (color: "w" | "b") => void;
  /** Called when the opponent requests a rematch. */
  onRemoteRematchRequest: (blitz: boolean) => void;
  /** Called when the opponent responds to our rematch request. */
  onRemoteRematchResponse: (accepted: boolean) => void;
  /** Called when opponent's routing mode changes (ultimate chess). */
  onRemoteRoutingMode: (mode: RoutingModePayload) => void;
  /** Called when opponent chooses a board (ultimate chess). */
  onRemoteBoardChoice: (boardName: string) => void;
  /** Returns the host's current complete game state at the moment a peer joins. */
  getFen: () => GameStateSnapshot;
  /** Returns whether blitz mode is active at the moment a peer joins. */
  getBlitz: () => boolean;
  /** Returns the current clock times (seconds) to sync to the joiner. */
  getClockTimes: () => { wt: number; bt: number };
  /** Returns whether the current game state has moves. */
  getHasMoves: () => boolean;
}) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<"w" | "b" | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  const [connected, setConnected] = useState(false);
  const [peerLeft, setPeerLeft] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isJoiner, setIsJoiner] = useState(false);

  const isHostRef = useRef(false);
  const joinedRoomIdRef = useRef<string | null>(null);
  const roomRef = useRef<ReturnType<typeof joinRoom> | null>(null);

  const sendMoveRef = useRef<((data: MovePayload) => void) | null>(null);
  const sendResetRef = useRef<((data: Record<string, never>) => void) | null>(
    null,
  );
  const sendSetupRef = useRef<((data: SetupPayload) => void) | null>(null);
  const sendTimeoutRef = useRef<((data: TimeoutPayload) => void) | null>(null);
  const sendRematchRequestRef = useRef<
    ((data: RematchRequestPayload) => void) | null
  >(null);
  const sendRematchResponseRef = useRef<
    ((data: RematchResponsePayload) => void) | null
  >(null);
  const sendRoutingModeRef = useRef<
    ((data: RoutingModePayload) => void) | null
  >(null);
  const sendBoardChoiceRef = useRef<
    ((data: BoardChoicePayload) => void) | null
  >(null);
  const sendColorAssignmentRef = useRef<
    ((data: ColorAssignmentPayload) => void) | null
  >(null);
  const sendRequestSetupRef = useRef<((data: Record<string, never>) => void) | null>(null);
  const sendPingRef = useRef<((data: { ts: number }) => void) | null>(null);
  const sendPongRef = useRef<((data: { ts: number; echo: number }) => void) | null>(
    null,
  );
  const pingIntervalRef = useRef<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const connectedRef = useRef<boolean>(false);
  const reconnectionTimeoutsRef = useRef<number[]>([]);
  const isReconnectingRef = useRef(false);

  // Store callback refs to avoid stale closures
  const onRemoteMoveRef = useRef(onRemoteMove);
  const onRemoteResetRef = useRef(onRemoteReset);
  const onRemoteSetupRef = useRef(onRemoteSetup);
  const onRemoteTimeoutRef = useRef(onRemoteTimeout);
  const onRemoteRematchRequestRef = useRef(onRemoteRematchRequest);
  const onRemoteRematchResponseRef = useRef(onRemoteRematchResponse);
  const onRemoteRoutingModeRef = useRef(onRemoteRoutingMode);
  const onRemoteBoardChoiceRef = useRef(onRemoteBoardChoice);
  const getFenRef = useRef(getFen);
  const getBlitzRef = useRef(getBlitz);
  const getClockTimesRef = useRef(getClockTimes);
  const getHasMovesRef = useRef(getHasMoves);

  // Update refs when callbacks change
  useEffect(() => {
    onRemoteMoveRef.current = onRemoteMove;
    onRemoteResetRef.current = onRemoteReset;
    onRemoteSetupRef.current = onRemoteSetup;
    onRemoteTimeoutRef.current = onRemoteTimeout;
    onRemoteRematchRequestRef.current = onRemoteRematchRequest;
    onRemoteRematchResponseRef.current = onRemoteRematchResponse;
    onRemoteRoutingModeRef.current = onRemoteRoutingMode;
    onRemoteBoardChoiceRef.current = onRemoteBoardChoice;
    getFenRef.current = getFen;
    getBlitzRef.current = getBlitz;
    getClockTimesRef.current = getClockTimes;
    getHasMovesRef.current = getHasMoves;
  }, [
    onRemoteMove,
    onRemoteReset,
    onRemoteSetup,
    onRemoteTimeout,
    onRemoteRematchRequest,
    onRemoteRematchResponse,
    onRemoteRoutingMode,
    onRemoteBoardChoice,
    getFen,
    getBlitz,
    getClockTimes,
    getHasMoves,
  ]);

  const leaveCurrentRoom = useCallback(() => {
    // Clean up persisted role for this room BEFORE nulling the ref
    try {
      if (joinedRoomIdRef.current) {
        sessionStorage.removeItem(`uc:room:${joinedRoomIdRef.current}`);
      }
    } catch {
      // sessionStorage may be unavailable in some environments
    }
    if (roomRef.current) {
      roomRef.current.leave();
      roomRef.current = null;
    }
    joinedRoomIdRef.current = null;
    sendMoveRef.current = null;
    sendResetRef.current = null;
    sendSetupRef.current = null;
    sendTimeoutRef.current = null;
    sendRematchRequestRef.current = null;
    sendRematchResponseRef.current = null;
    sendRoutingModeRef.current = null;
    sendBoardChoiceRef.current = null;
    sendColorAssignmentRef.current = null;
    sendRequestSetupRef.current = null;
    sendPingRef.current = null;
    sendPongRef.current = null;
    if (pingIntervalRef.current) {
      window.clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // Handler callbacks - defined at hook level to avoid nesting useCallback
  // These wrappers call the ref-stored callbacks with the appropriate payloads
  const createMoveHandler = useCallback(
    () => (payload: MovePayload) => {
      onRemoteMoveRef.current(payload.boardName, payload.from, payload.to, payload.promotion);
    },
    [],
  );

  const createResetHandler = useCallback(
    () => () => {
      onRemoteResetRef.current();
    },
    [],
  );

  const createSetupHandler = useCallback(
    () => (payload: SetupPayload) => {
      onRemoteSetupRef.current(payload);
    },
    [],
  );

  const createTimeoutHandler = useCallback(
    () => (payload: TimeoutPayload) => {
      onRemoteTimeoutRef.current(payload.color);
    },
    [],
  );

  const createRematchRequestHandler = useCallback(
    () => (payload: RematchRequestPayload) => {
      onRemoteRematchRequestRef.current(payload.blitz);
    },
    [],
  );

  const createRematchResponseHandler = useCallback(
    () => (payload: RematchResponsePayload) => {
      onRemoteRematchResponseRef.current(payload.accepted);
    },
    [],
  );

  const createRoutingModeHandler = useCallback(
    () => (payload: RoutingModePayload) => {
      onRemoteRoutingModeRef.current(payload);
    },
    [],
  );

  const createBoardChoiceHandler = useCallback(
    () => (payload: BoardChoicePayload) => {
      onRemoteBoardChoiceRef.current(payload.boardName);
    },
    [],
  );

  /**
   * @param rId       Room ID to join.
   * @param asHost    Whether this peer is the host.
   * @param resetGame When true (default) the host resets its local board to
   *                  the starting position.  Pass false for "resume" flows
   *                  where the current board position should be preserved.
   *                  Joiners never reset locally — they always receive the
   *                  authoritative FEN from the host via the setup action.
   * @param hostColor Optional color for the host ('w' or 'b'). If not provided,
   *                  colors are assigned randomly after both peers join.
   */
  const startMultiplayer = useCallback(
    (rId: string, asHost: boolean, resetGame = true, hostColor?: 'w' | 'b') => {
      if (joinedRoomIdRef.current === rId) return;
      leaveCurrentRoom();

      joinedRoomIdRef.current = rId;
      setRoomId(rId);
      setMode("multi");
      setConnected(false);
      setPeerLeft(false);
      isHostRef.current = asHost;
      setIsJoiner(!asHost);

      // Persist our role for this room so reloads can auto-rejoin correctly.
      try {
        sessionStorage.setItem(`uc:room:${rId}`, asHost ? "host" : "joiner");
      } catch {
        // sessionStorage may be unavailable in some environments
      }

      // ── Color assignment ────────────────────────────────────────────────
      // Colors are assigned after both peers join, not before.
      // Set playerColor to null until the host sends the assignment.
      let savedColor: "w" | "b" | null = null;
      try {
        savedColor = sessionStorage.getItem(`uc:room:${rId}:color`) as "w" | "b" | null;
      } catch {
        // sessionStorage may be unavailable in some environments
      }
      setPlayerColor(savedColor);

      // If hostColor is provided, assign it immediately; otherwise wait for random assignment
      if (asHost && hostColor) {
        setPlayerColor(hostColor);
      }

      // Only the host resets the board (and only for a fresh game, not a
      // resume).  The joiner's board will be overwritten by getSetup below.
      if (asHost && resetGame) {
        onRemoteReset();
      }

      const room = joinRoom(
        {
          appId: "ultimate-chess-ralphs16",
          rtcConfig: {
            iceServers: (() => {
              const servers: Array<{ urls: string; username?: string; credential?: string }> = [
                { urls: "stun:stun.l.google.com:19302" },
              ];
              const username = import.meta.env.VITE_TURN_USERNAME;
              const credential = import.meta.env.VITE_TURN_CREDENTIAL;
              if (!username || !credential) {
                return servers;
              }
              const turnUrls = [
                import.meta.env.VITE_TURN_URL,
                import.meta.env.VITE_TURN_URL_443,
                import.meta.env.VITE_TURNS_URL,
              ].filter((url): url is string => Boolean(url));
              for (const urls of turnUrls) {
                servers.push({ urls, username, credential });
              }
              return servers;
            })(),
          },
        },
        rId,
      );
      roomRef.current = room;

      const [sendMove, getMove] = room.makeAction<MovePayload>("move");
      const [sendReset, getReset] =
        room.makeAction<Record<string, never>>("reset");
      // "setup" carries the authoritative board position and game mode (blitz/standard).
      // Using any to satisfy Trystero's complex DataPayload constraint
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [sendSetup, getSetup] = room.makeAction<any>("setup");
      // "timeout" lets the losing player notify the winner.
      const [sendTimeout, getTimeout] =
        room.makeAction<TimeoutPayload>("timeout");
      // "rematch-req" / "rematch-res" implement the agree-to-restart protocol.
      const [sendRematchReq, getRematchReq] =
        room.makeAction<RematchRequestPayload>("rematch-req");
      const [sendRematchRes, getRematchRes] =
        room.makeAction<RematchResponsePayload>("rematch-res");
      // Ultimate chess routing and board selection
      const [sendRouteMode, getRouteMode] =
        room.makeAction<RoutingModePayload>("routing-mode");
      const [sendBoardChoice, getBoardChoice] =
        room.makeAction<BoardChoicePayload>("board-choice");
      // Color assignment: host sends assigned colors to joiner after peer joins
      const [sendColorAssignment, getColorAssignment] =
        room.makeAction<ColorAssignmentPayload>("color-assignment");

      const [sendRequestSetup, getRequestSetup] = room.makeAction<Record<string, never>>("request-setup");

      // Lightweight ping/pong for latency estimation and liveliness.
      const [sendPing, getPing] = room.makeAction<{ ts: number }>("ping");
      const [sendPong, getPong] =
        room.makeAction<{ ts: number; echo: number }>("pong");

      sendMoveRef.current = sendMove;
      sendResetRef.current = sendReset;
      sendSetupRef.current = sendSetup;
      sendTimeoutRef.current = sendTimeout;
      sendRematchRequestRef.current = sendRematchReq;
      sendRematchResponseRef.current = sendRematchRes;
      sendRoutingModeRef.current = sendRouteMode;
      sendBoardChoiceRef.current = sendBoardChoice;
      sendColorAssignmentRef.current = sendColorAssignment;
      sendRequestSetupRef.current = sendRequestSetup;

      sendPingRef.current = sendPing;
      sendPongRef.current = sendPong;

      // Create handlers using factory functions (not useCallback inside)
      const handleRemoteMove = createMoveHandler();
      const handleRemoteReset = createResetHandler();
      const handleRemoteSetup = createSetupHandler();
      const handleRemoteTimeout = createTimeoutHandler();
      const handleRemoteRematchRequest = createRematchRequestHandler();
      const handleRemoteRematchResponse = createRematchResponseHandler();
      const handleRemoteRoutingMode = createRoutingModeHandler();
      const handleRemoteBoardChoice = createBoardChoiceHandler();
      // getHostState intentionally unused in current flow

      room.onPeerJoin(() => {
        setConnected(true);
        connectedRef.current = true;
        setPeerLeft(false);
        setIsReconnecting(false);
        isReconnectingRef.current = false;
        // Clear any outstanding reconnect attempts
        reconnectionTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
        reconnectionTimeoutsRef.current = [];

        // ── Assign colors when both peers are connected ──
        if (isHostRef.current) {
          // If host already has a color assigned, send it; otherwise assign randomly
          const currentHostColor = hostColor || sessionStorage.getItem(`uc:room:${joinedRoomIdRef.current}:color`);
          if (currentHostColor) {
            // Host color was already set
            setTimeout(() => {
              sendColorAssignmentRef.current?.({ hostColor: currentHostColor as "w" | "b" });
            }, 50);
          } else {
            // Host randomly decides who gets white (50/50 chance)
            const hostGetsWhite = Math.random() > 0.5;
            const hostColor = hostGetsWhite ? "w" : "b";
            
            setPlayerColor(hostColor);
            try {
              sessionStorage.setItem(`uc:room:${joinedRoomIdRef.current}:color`, hostColor);
            } catch {
              // sessionStorage may be unavailable in some environments
            }
            
            // Send color assignment to joiner
            setTimeout(() => {
              sendColorAssignmentRef.current?.({ hostColor });
            }, 50);
          }
        }

        // Host pushes the current board position and game mode to the
        // newly connected peer. A short delay gives the peer time to
        // register its getSetup listener.
        if (isHostRef.current) {
          setTimeout(() => {
            const hasMoves = getHasMovesRef.current();
            if (hasMoves) {
              const gameState = getFenRef.current();
              sendSetupRef.current?.(gameState);
            } else {
              sendRequestSetupRef.current?.({});
            }
          }, 50);
        }

        // Start periodic pings to estimate latency
        if (pingIntervalRef.current) {
          window.clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = window.setInterval(() => {
          sendPingRef.current?.({ ts: Date.now() });
        }, 5000);
      });

      room.onPeerLeave(() => {
        setConnected(false);
        connectedRef.current = false;

        // Guard: don't start another reconnect cascade if one is already running
        if (isReconnectingRef.current) return;

        setPeerLeft(false);
        setIsReconnecting(true);
        isReconnectingRef.current = true;
        
        // Clear existing scheduled attempts
        reconnectionTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
        reconnectionTimeoutsRef.current = [];
        
        // Wait 10 seconds for the peer to reconnect (e.g. they refreshed the page)
        // If they don't, mark them as permanently left
        const id = window.setTimeout(() => {
          if (!connectedRef.current) {
            setPeerLeft(true);
            setIsReconnecting(false);
            isReconnectingRef.current = false;
          }
        }, 10000) as unknown as number;
        reconnectionTimeoutsRef.current.push(id);
      });

      getMove(handleRemoteMove);
      getReset(handleRemoteReset);

      // Joiner receives the host's board position and game mode on connect.
      // (Or host receives joiner's setup if it asked for it).
      getSetup((payload: SetupPayload) => {
        handleRemoteSetup(payload);
      });

      getRequestSetup(() => {
        setTimeout(() => {
          const gameState = getFenRef.current();
          sendSetupRef.current?.(gameState);
        }, 50);
      });

      // Either peer can receive a timeout notification from the other.
      getTimeout(handleRemoteTimeout);

      // Rematch request from the opponent.
      getRematchReq(handleRemoteRematchRequest);

      // Opponent's response to our rematch request.
      getRematchRes(handleRemoteRematchResponse);

      // Ultimate chess: opponent's routing mode changes
      getRouteMode(handleRemoteRoutingMode);

      // Ultimate chess: opponent chose a board for us to play on
      getBoardChoice(handleRemoteBoardChoice);

      // Joiner receives color assignment from host
      getColorAssignment((payload: ColorAssignmentPayload) => {
        if (!isHostRef.current) {
          // Joiner gets the opposite color from the host
          const joinerColor = payload.hostColor === "w" ? "b" : "w";
          setPlayerColor(joinerColor);
          try {
            sessionStorage.setItem(`uc:room:${joinedRoomIdRef.current}:color`, joinerColor);
          } catch {
            // sessionStorage may be unavailable in some environments
          }
        }
      });

      // Create handlers for ping/pong
      getPing((payload: { ts: number }) => {
        // Reply immediately with a pong echoing the original timestamp
        sendPongRef.current?.({ ts: Date.now(), echo: payload.ts });
      });

      getPong((payload: { ts: number; echo: number }) => {
        const rtt = Date.now() - payload.echo;
        setLatency(rtt);
      });
    },
    [
      leaveCurrentRoom,
      createMoveHandler,
      createResetHandler,
      createSetupHandler,
      createTimeoutHandler,
      createRematchRequestHandler,
      createRematchResponseHandler,
      createRoutingModeHandler,
      createBoardChoiceHandler,
      onRemoteReset,
    ],
  );

  // Auto-join if a room ID is already in the URL on mount (e.g. invite link).
  useEffect(() => {
    const rId = new URLSearchParams(window.location.search).get("room");
    if (rId) {
      // If we previously hosted this room, auto-rejoin as host on reload.
      let asHost = false;
      try {
        asHost = sessionStorage.getItem(`uc:room:${rId}`) === "host";
      } catch {
        // sessionStorage may be unavailable
      }
      startMultiplayer(rId, asHost);
    }
    // We intentionally omit startMultiplayer from deps and leaveCurrentRoom()
    // from cleanup so React 18 Strict Mode double-invokes don't disconnect the
    // Trystero room prematurely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRemoteReset]);

  /** Start a brand-new hosted game (resets the board). */
  const hostMultiplayer = useCallback((hostColor?: 'w' | 'b', resetGame = true) => {
    const rId = generateRoomId();
    // Preserve any saved FEN hash that may already be in the URL.
    window.history.replaceState(
      null,
      "",
      `?room=${rId}${window.location.hash}`,
    );
    startMultiplayer(rId, true, resetGame, hostColor);
  }, [startMultiplayer]);



  const joinMultiplayer = useCallback(
    (rId: string) => {
      const trimmed = rId.trim();
      if (!trimmed) return false;
      window.history.replaceState(
        null,
        "",
        `?room=${trimmed}${window.location.hash}`,
      );
      startMultiplayer(trimmed, false);
      return true;
    },
    [startMultiplayer],
  );

  const cancelMultiplayer = useCallback(() => {
    // Strip the room query param but keep any saved FEN hash.
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.hash,
    );
    leaveCurrentRoom();
    setMode("single");
    setConnected(false);
    setPeerLeft(false);
    setPlayerColor(null);
    // Do NOT reset the board here — the player may want to continue in
    // single-player mode from the current position.
    // Remove any persisted role for the current room
    try {
      const r = new URLSearchParams(window.location.search).get("room");
      if (r) sessionStorage.removeItem(`uc:room:${r}`);
    } catch {
      // sessionStorage may be unavailable
    }
  }, [leaveCurrentRoom]);

  const sendMove = useCallback(
    (boardName: string, from: string, to: string, promotion?: string) => {
      sendMoveRef.current?.({ boardName, from, to, promotion });
    },
    [],
  );



  /** Ask the opponent for a rematch with the given mode. */
  const sendRematchRequest = useCallback((blitz: boolean) => {
    sendRematchRequestRef.current?.({ blitz });
  }, []);

  /** Respond to the opponent's rematch request. */
  const sendRematchResponse = useCallback((accepted: boolean) => {
    sendRematchResponseRef.current?.({ accepted });
  }, []);

  /** Send routing mode update to opponent (ultimate chess). */
  const sendRoutingMode = useCallback(
    (mode: "normal" | "free-pick" | "castling-choice" | "loser-picks", _unused?: undefined, requiredBoard?: string | null) => {
      sendRoutingModeRef.current?.({ mode, requiredBoard });
    },
    [],
  );

  /** Send board choice to opponent (ultimate chess). */
  const sendBoardChoice = useCallback((boardName: string) => {
    sendBoardChoiceRef.current?.({ boardName });
  }, []);

  return {
    mode,
    roomId,
    playerColor,
    connected,
    peerLeft,
    isReconnecting,
    isJoiner,
    hostMultiplayer,
    joinMultiplayer,
    cancelMultiplayer,
    sendMove,
    sendRematchRequest,
    sendRematchResponse,
    sendRoutingMode,
    sendBoardChoice,
    latency,
  };
}
