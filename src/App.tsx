/**
 * App
 * Root React component for the Ultimate Chess UI.
 * Renders boards and modals and reacts to the engine snapshot exposed by `useBoardSet()`.
 * Game rules live in the engine (`UltimateChessGame`) and the UI only invokes actions and shows state.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { type Square } from "chess.js";
import { useBoardSet } from "./features/chess/hooks/useBoardSet";
import { useMultiplayer } from "./features/multiplayer/hooks/useMultiplayer";
import { isPromotionMove } from "./features/chess/utils/chessMoves";
import { PromotionDialog } from "./features/chess/components/PromotionDialog";
import { useAIPlayers } from "./features/ai/hooks/useAIPlayers";
import { BoardCard } from "./features/chess/components/BoardCard";
import { GameControlBar, type AIConfig } from "./features/controls/components/GameControlBar";
import { OpponentChoosingOverlay } from "./features/multiplayer/components/MultiplayerUI";
import {
  getUltimateGameFromStorage,
  saveUltimateGameToStorage,
  getUltimateStorageEnabledPreference,
  deleteUltimateGameFromStorage,
  type UltimateCurrentGame,
} from "./features/gameState/utils/ultimateStorageUtils";
import { encodeFenToHash, decodeHashToFen, type UltimateFenState } from "./features/gameState/utils/ultimateFenUtils";
import type { GameStateSnapshot } from "./features/multiplayer/utils/gameStateSync";
import {
  BOARD_NAMES,
  BOARD_DISPLAY_NAMES,
  BOARD_COLORS,
  type BoardName,
  type BoardStatus,
} from "./features/chess/types/boardTypes";
import type { RoutingMode } from "./features/chess/game/ultimateChess";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

// (storage helpers removed — unused)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function App() {
  // ── Board set ────────────────────────────────────────────────────────────
  const {
    boards,
    globalTurn,
    capturedBoards,
    ultimateWinner,
    pendingChecks,
    moveHistory,
    getBoardWinner,
    requiredBoard,
    availableBoards,
    choiceBoards,
    routingMode,
    decisionMaker,
    shouldShowModal,
    makeMoveOnBoard,
    chooseBoard,
    setMoveFromSquare,
    allSquareStyles,
    completePromotion,
    resetAllBoards,
    loadGame,
    undo,
    canUndo,
  } = useBoardSet();

  // ── Storage state ─────────────────────────────────────────────────────────
  const [storageEnabled] = useState(() =>
    getUltimateStorageEnabledPreference()
  );
  const gameStartedAt = useRef<number>(0);
  useEffect(() => {
    gameStartedAt.current = Date.now();
  }, []);
  const moveHistoryContainerRef = useRef<HTMLDivElement>(null);

  // Keep a ref of boards for stable callbacks
  const boardsRef = useRef(boards);
  useEffect(() => {
    boardsRef.current = boards;
  }, [boards]);

  useEffect(() => {
    if (moveHistoryContainerRef.current) {
      moveHistoryContainerRef.current.scrollTop = moveHistoryContainerRef.current.scrollHeight;
    }
  }, [moveHistory.length]);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [pendingPromotion, setPendingPromotion] = useState<{
    board: BoardName;
    from: string;
    to: string;
  } | null>(null);

  const [linkCopied, setLinkCopied] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    const rulesSeenKey = "ultimate-chess-rules-seen";

    try {
      if (window.localStorage.getItem(rulesSeenKey)) return;

      window.localStorage.setItem(rulesSeenKey, "true");
      setShowRules(true);
    } catch {
      setShowRules(true);
    }
  }, []);

  // AI config
  const [aiPlayers, setAiPlayers] = useState<{ w: "human" | "ai"; b: "human" | "ai" }>(() => ({ w: "human", b: "human" }));
  const [aiSkill, setAiSkill] = useState<{ w: number; b: number }>({ w: 10, b: 10 });
  const [rematchSent, setRematchSent] = useState(false);
  const [rematchIncoming, setRematchIncoming] = useState(false);

  // ── Multiplayer state ───────────────────────────────────────────────────
  // (Modals removed to comply with plan.md)

  // ── Multiplayer ──────────────────────────────────────────────────────────
  const onRemoteMove = useCallback((boardName: string, from: string, to: string, promotion?: string) => {
    // In multiplayer, remote moves are applied to the board specified by the sender
    const result = makeMoveOnBoard(boardName as BoardName, from, to, promotion);
    return result.success;
  }, [makeMoveOnBoard]);

  const onRemoteReset = useCallback(() => {
    resetAllBoards();
    gameStartedAt.current = Date.now();
    deleteUltimateGameFromStorage();
    setRematchSent(false);
    setRematchIncoming(false);
  }, [resetAllBoards]);

  const onRemoteSetup = useCallback((setup: GameStateSnapshot) => {
    // Host-sent complete game snapshot received — apply received setup
    try {
      const boardsArr = BOARD_NAMES.map((name) => ({
        name,
        fen: setup.boards[name].fen,
        status: setup.boards[name].status as BoardStatus,
        winner: setup.boards[name].winner,
      }));

      const pendingChecksLocal: Partial<Record<BoardName, "w" | "b">> = {};
      if (setup.pendingChecks) {
        for (const [b, c] of Object.entries(setup.pendingChecks)) {
          pendingChecksLocal[b as BoardName] = c as "w" | "b";
        }
      }

      loadGame(
        boardsArr,
        setup.globalTurn,
        pendingChecksLocal,
        (setup.requiredBoard as BoardName | null),
        {
          routingMode: setup.routingMode,
          decisionMaker: setup.decisionMaker ?? null,
          shouldShowModal: setup.shouldShowModal ?? false,
          loserPicksWinner: setup.loserPicksWinner ?? null,
          choiceBoards: (setup.choiceBoards ?? []).filter(
            (name): name is BoardName => BOARD_NAMES.includes(name as BoardName)
          ),
        }
      );
      gameStartedAt.current = Date.now();
    } catch {
      // Fallback: reset if applying snapshot fails
      resetAllBoards();
    }
  }, [loadGame, resetAllBoards]);

  const onRemoteRematchRequest = useCallback(() => {
    // Opponent requested a restart in the same room. Mark incoming request
    // and let an effect handle the actual agreed reset once both sides have
    // requested.
    setRematchIncoming(true);
  }, []);
  

  const onRemoteRematchResponse = useCallback(() => {
    // Not used for the simple "both press to agree" flow.
  }, []);

  const onRemoteRoutingMode = useCallback((payload: { mode: string; requiredBoard?: string | null }) => {
    // Routing mode messages are intentionally ignored.
    // State sync is driven by move replication and board-choice messages.
    void payload;
  }, []);

  const onRemoteBoardChoice = useCallback((boardName: string) => {
    // Opponent chose a board for us to play on
    if (!BOARD_NAMES.includes(boardName as BoardName)) return;
    chooseBoard(boardName as BoardName);
  }, [chooseBoard]);

  const getFen = useCallback(() => {
    // Return current game state for multiplayer sync
    return {
      boards: Object.fromEntries(
        BOARD_NAMES.map((name) => [
          name,
          {
            fen: boards[name].fen,
            status: boards[name].status,
            winner: boards[name].winner === "draw" ? null : boards[name].winner,
          },
        ])
      ),
      globalTurn,
      requiredBoard,
      capturedBoards: [...capturedBoards.white, ...capturedBoards.black],
      pendingChecks,
      routingMode: routingMode as RoutingMode,
      decisionMaker,
      shouldShowModal,
      loserPicksWinner: routingMode === "loser-picks" ? decisionMaker : null,
      choiceBoards,
    };
  }, [boards, globalTurn, requiredBoard, capturedBoards, pendingChecks, routingMode, decisionMaker, shouldShowModal, choiceBoards]);

  const getHasMoves = useCallback(() => {
    return moveHistory.length > 0;
  }, [moveHistory]);

  const {
    sendMove,
    sendBoardChoice,
    playerColor,
    mode,
    roomId,
    connected,
    peerLeft,
    isReconnecting,
    latency,
    isJoiner,
    hostMultiplayer,
    joinMultiplayer,
    cancelMultiplayer,
    sendRematchRequest,
    sendReset,
  } =
    useMultiplayer({
      onRemoteMove,
      onRemoteReset,
      onRemoteSetup,
      onRemoteRematchRequest,
      onRemoteRematchResponse,
      onRemoteRoutingMode,
      onRemoteBoardChoice,
      getFen,
      getHasMoves,
    });

  // When both sides have requested a rematch, the host should broadcast a
  // reset and both clients should reset locally. We run this in an effect so
  // it has access to `isJoiner` and `sendReset` which are provided by
  // `useMultiplayer`.
  useEffect(() => {
    if (rematchSent && rematchIncoming && !isJoiner) {
      // perform authoritative reset from host
      sendReset?.();
      resetAllBoards();
      gameStartedAt.current = Date.now();
      deleteUltimateGameFromStorage();
      // clear UI state
      const t = window.setTimeout(() => {
        setRematchSent(false);
        setRematchIncoming(false);
      }, 50);
      return () => clearTimeout(t);
    }
    // If both sides requested but we're the joiner, we'll just wait for the host's reset.
    return undefined;
  }, [rematchSent, rematchIncoming, isJoiner, sendReset, resetAllBoards]);

  const [aiPaused, setAiPaused] = useState(false);
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const hasAI = mode !== "multi" && (aiPlayers.w === "ai" || aiPlayers.b === "ai");

  useEffect(() => {
    // If no AI remains active, clear paused state.
    if (!hasAI && aiPaused) {
      const t = window.setTimeout(() => setAiPaused(false), 0);
      return () => clearTimeout(t);
    }
  }, [hasAI, aiPaused]);

  // ── AI players (simple config)
  // Defaults: white human, black AI (single-player only). Change as desired.
  useAIPlayers({
    mode: mode === "multi" ? "multi" : "local",
    playerColor,
    players: aiPlayers,
    skillLevel: aiSkill,
    boards: Object.fromEntries(BOARD_NAMES.map((n) => [n, { fen: boards[n].fen }])) as Record<BoardName, { fen: string }>,
    globalTurn,
    requiredBoard,
    availableBoards,
    choiceBoards,
    decisionMaker,
    shouldShowModal,
    chooseBoard,
    makeMoveOnBoard,
    isPaused: isConfiguring || aiPaused,
  });

  useEffect(() => {
    if (storageEnabled) {
      const saved = getUltimateGameFromStorage();
      if (saved) {
        const t = window.setTimeout(() => setHasSavedGame(true), 0);
        return () => clearTimeout(t);
      }
    }

    // Load from URL hash if present
    const hash = window.location.hash.slice(1); // Remove the '#'
    if (hash) {
      const fenState = decodeHashToFen(hash);
      if (fenState) {
        loadGame(
          BOARD_NAMES.map((name) => ({
            name,
            fen: fenState.boards[name],
            status: fenState.boardStatuses[name],
            winner: fenState.boardWinners[name],
          })),
          fenState.turn,
          {}, // pendingChecks - not stored in hash for simplicity
          fenState.requiredBoard
        );
        gameStartedAt.current = Date.now();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // ── Persist game after every move ────────────────────────────────────────
  useEffect(() => {
    if (!storageEnabled || moveHistory.length === 0 || ultimateWinner) return;

    const currentBoards = boardsRef.current;
    const gameToSave: UltimateCurrentGame = {
      version: 1,
      boards: BOARD_NAMES.map((name) => ({
        name,
        fen: currentBoards[name].fen,
        status:
          currentBoards[name].status === "active"
            ? "active"
            : currentBoards[name].status === "draw"
              ? "draw"
              : currentBoards[name].status === "won-white"
                ? "won-white"
                : currentBoards[name].status === "won-black"
                  ? "won-black"
                  : "idle",
        winner:
          currentBoards[name].winner === "w"
            ? "white"
            : currentBoards[name].winner === "b"
              ? "black"
              : "none",
      })),
      routing: {
        currentBoard: requiredBoard,
        currentPlayer: globalTurn,
        pendingChecks: Object.entries(pendingChecks).map(([board, color]) => ({
          board: board as BoardName,
          color: color === "w" ? "white" : "black",
        })),
      },
      meta: {
        startedAt: gameStartedAt.current,
        totalMoves: moveHistory.length,
        whitePlayer: "human",
        blackPlayer: "human",
      },
    };

    saveUltimateGameToStorage(gameToSave);
  }, [storageEnabled, globalTurn, pendingChecks, moveHistory.length, ultimateWinner, requiredBoard]);

  // ── Storage handlers ───────────────────────────────────────────────────────
  // NOTE: Storage handlers are commented out but available for future UI controls
  /*
  const handleToggleStorage = useCallback((enabled: boolean) => {
    setStorageEnabled(enabled);
    setUltimateStorageEnabledPreference(enabled);
    if (!enabled) deleteUltimateGameFromStorage();
  }, []);

  const handleClearStorage = useCallback(() => {
    deleteUltimateGameFromStorage();
  }, []);
  */

  // ── Move handlers ─────────────────────────────────────────────────────────
  const canMoveOnBoard = useCallback(
    (boardName: BoardName): boolean => {
      if (ultimateWinner) return false;
      if (routingMode === "castling-choice" || routingMode === "loser-picks") return false;
      // In multiplayer, only allow moves once we've been assigned a color
      if (mode === "multi") {
        if (!playerColor || !connected || peerLeft || isReconnecting) return false;
        if (playerColor !== globalTurn) return false;
      }
      return availableBoards.includes(boardName);
    },
    [ultimateWinner, routingMode, availableBoards, mode, playerColor, connected, peerLeft, isReconnecting, globalTurn]
  );

  const onPieceDrop = useCallback(
    (boardName: BoardName, sourceSquare: string, targetSquare: string | null): boolean => {
      if (!canMoveOnBoard(boardName)) return false;
      if (!targetSquare) {
        setMoveFromSquare(boardName, null);
        return false;
      }

      const boardState = boardsRef.current[boardName];
      const piece = boardState.game.get(sourceSquare as Square);

      // Intercept promotion through chess.js legal move generation
      if (piece?.type === "p" && isPromotionMove(boardState.game, sourceSquare, targetSquare)) {
        setPendingPromotion({ board: boardName, from: sourceSquare, to: targetSquare });
        return false;
      }

      const result = makeMoveOnBoard(boardName, sourceSquare, targetSquare);
      if (!result.success) {
        setMoveFromSquare(boardName, null);
        return false;
      }

      if (mode === "multi" && playerColor) {
        sendMove(boardName, sourceSquare, targetSquare);
      }

      return true;
    },
    [canMoveOnBoard, makeMoveOnBoard, setMoveFromSquare, mode, playerColor, sendMove]
  );

  const onSquareClick = useCallback(
    (boardName: BoardName, square: string) => {
      if (!canMoveOnBoard(boardName) || pendingPromotion) return;
      const boardState = boardsRef.current[boardName];
      const targetPiece = boardState.game.get(square as Square);

      // Select or reselect piece
      if (
        !boardState.moveFrom ||
        (targetPiece && targetPiece.color === boardState.game.turn())
      ) {
        // Deselect if clicking the already selected piece
        if (boardState.moveFrom === square) {
          setMoveFromSquare(boardName, null);
          return;
        }

        const hasMoves = boardState.game.moves({ square: square as Square }).length > 0;
        setMoveFromSquare(boardName, hasMoves ? square : null);
        return;
      }

      // Intercept promotion
      const piece = boardState.game.get(boardState.moveFrom as Square);
      if (piece?.type === "p" && isPromotionMove(boardState.game, boardState.moveFrom, square)) {
        setPendingPromotion({ board: boardName, from: boardState.moveFrom, to: square });
        return;
      }

      const result = makeMoveOnBoard(boardName, boardState.moveFrom, square);
      if (!result.success) {
        setMoveFromSquare(boardName, null);
      } else if (mode === "multi" && playerColor) {
        sendMove(boardName, boardState.moveFrom, square);
      }
    },
    [canMoveOnBoard, makeMoveOnBoard, pendingPromotion, setMoveFromSquare, mode, playerColor, sendMove]
  );

  const handlePromote = useCallback(
    (pieceType: string) => {
      if (!pendingPromotion) return;
      const result = completePromotion(
        pendingPromotion.board,
        pendingPromotion.from,
        pendingPromotion.to,
        pieceType
      );
      setPendingPromotion(null);

      if (result.success && mode === "multi" && playerColor) {
        sendMove(pendingPromotion.board, pendingPromotion.from, pendingPromotion.to, pieceType);
      }

      if (!result.success) {
        setMoveFromSquare(pendingPromotion.board, null);
      }
    },
    [pendingPromotion, completePromotion, setMoveFromSquare, mode, playerColor, sendMove]
  );

  // ── Board choice handler (for inline selection) ─────────────────────────
  const handleBoardChoice = useCallback(
    (chosen: BoardName) => {
      const applied = chooseBoard(chosen);
      if (!applied) return;
      if (playerColor) {
        sendBoardChoice(chosen);
      }
    },
    [chooseBoard, playerColor, sendBoardChoice]
  );


  const handleNewGame = useCallback(() => {
    // In single-player or disconnected, just reset
    resetAllBoards();
    gameStartedAt.current = Date.now();
    deleteUltimateGameFromStorage();
    setAiPaused(false);
  }, [resetAllBoards]);

  const handleUndo = useCallback(() => {
    const success = undo();
    if (success && hasAI) {
      // Prevent immediate re-move loops after undoing an AI move.
      setAiPaused(true);
    }
    return success;
  }, [undo, hasAI]);

  const handleConfigChange = useCallback((configuring: boolean) => {
    setIsConfiguring(configuring);
    if (configuring) {
      resetAllBoards();
      deleteUltimateGameFromStorage();
    }
  }, [resetAllBoards]);

  // ── Multiplayer ────────────────────────────────────────────────────────────
  const handleHostOnline = useCallback((resetGame = false) => {
    // Host with random color assignment
    hostMultiplayer(undefined, resetGame);
    if (resetGame) {
      resetAllBoards();
      gameStartedAt.current = Date.now();
      deleteUltimateGameFromStorage();
    }
  }, [hostMultiplayer, resetAllBoards]);

  const handleContinueLocally = useCallback((config: AIConfig) => {
    // Exit multiplayer and continue in single-player mode
    cancelMultiplayer();
    setAiPlayers(config.players);
    if (config.skills) {
      setAiSkill(config.skills);
    }
    // Don't delete storage, let it be saved on next move
  }, [cancelMultiplayer]);

  const handleJoinGame = useCallback((rId: string) => {
    joinMultiplayer(rId);
  }, [joinMultiplayer]);

  const requestRematch = useCallback(() => {
    if (!sendRematchRequest) return;
    sendRematchRequest();
    setRematchSent(true);
    // If opponent already requested and we're host, perform reset now
    if (rematchIncoming && !isJoiner) {
      setTimeout(() => {
        sendReset?.();
        resetAllBoards();
        gameStartedAt.current = Date.now();
        deleteUltimateGameFromStorage();
        setRematchSent(false);
        setRematchIncoming(false);
      }, 50);
    }
  }, [sendRematchRequest, rematchIncoming, isJoiner, sendReset, resetAllBoards]);



  const handleCopyLink = useCallback(() => {
    // Encode current game state to URL hash
    const hash = encodeFenToHash({
      boards: Object.fromEntries(
        BOARD_NAMES.map((name) => [name, boards[name].fen])
      ) as UltimateFenState['boards'],
      turn: globalTurn,
      requiredBoard,
      routingMode,
      boardStatuses: Object.fromEntries(
        BOARD_NAMES.map((name) => [name, boards[name].status])
      ) as UltimateFenState['boardStatuses'],
      boardWinners: Object.fromEntries(
        BOARD_NAMES.map((name) => [name, boards[name].winner || null])
      ) as UltimateFenState['boardWinners'],
      capturedBoardsWhite: capturedBoards.white,
      capturedBoardsBlack: capturedBoards.black,
    });

    const link = `${window.location.origin}${window.location.pathname}#${hash}`;
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [
    boards,
    globalTurn,
    requiredBoard,
    routingMode,
    capturedBoards,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          handleUndo();
        }
      }
      // Ctrl+S or Cmd+S for save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleCopyLink();
      }
      // Close rules on Escape
      if (e.key === 'Escape') {
        setShowRules(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, handleUndo, handleCopyLink]);

  // Clear rematch state when leaving multiplayer or when room changes
  useEffect(() => {
    if (mode !== 'multi' || !connected) {
      const t = window.setTimeout(() => {
        setRematchSent(false);
        setRematchIncoming(false);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [mode, connected, roomId]);


  // ── Derived display values ────────────────────────────────────────────────
  const currentlyAvailableBoards = availableBoards;

  // Don't show board choice modals when AI is the decision maker
  const isAIDecisionMaker = decisionMaker && aiPlayers[decisionMaker] === "ai";

  // Determine effective player color for board orientation (e.g. flip board if playing black vs API)
  let displayPlayerColor = playerColor;
  if (mode !== "multi") {
    if (aiPlayers.w === "ai" && aiPlayers.b === "human") {
      displayPlayerColor = "b";
    }
  }

  const isMultiplayerDisabled = mode === "multi" && (!connected || peerLeft || isReconnecting || !playerColor);

  const handleResumeSavedGame = useCallback(() => {
    const saved = getUltimateGameFromStorage();
    if (saved) {
      const savedPendingChecks: Partial<Record<BoardName, "w" | "b">> = {};
      for (const pc of saved.routing.pendingChecks) {
        savedPendingChecks[pc.board] = pc.color === "white" ? "w" : "b";
      }
      loadGame(
        saved.boards.map((b) => ({
          name: b.name,
          fen: b.fen,
          status: b.status as BoardStatus,
          winner:
            b.winner === "white" ? "w" : b.winner === "black" ? "b" : null,
        })),
        saved.routing.currentPlayer,
        savedPendingChecks,
        saved.routing.currentBoard,
        {
          routingMode: "normal",
          decisionMaker: null,
          shouldShowModal: false,
          loserPicksWinner: null,
          choiceBoards: [],
        }
      );
      gameStartedAt.current = saved.meta.startedAt;
      setAiPlayers({ w: "human", b: "human" }); // default to human vs human
      setHasSavedGame(false); // remove the button
    }
  }, [loadGame]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-container ultimate-chess">
      {/* ── Header ── */}
      <div className="ultimate-header-container">
        <div className="ultimate-header-top">
          <div className="ultimate-header">
            <h1 className="ultimate-title">ultimate chess</h1>
          </div>

          <div className="ultimate-header-actions">
            <button
              type="button"
              className="rules-link"
              onClick={() => setShowRules(true)}
            >
              rules
            </button>

            {ultimateWinner && (
              <div className="game-winner-banner" style={{ margin: 0 }}>
                {ultimateWinner === 'w' ? 'White Wins!' : 'Black Wins!'}
              </div>
            )}
          </div>
        </div>

        {/* ── Control Bar (second row) ── */}
        <div className="ultimate-control-row">
          <GameControlBar
            linkCopied={linkCopied}
            onStartNewGame={(newGameMode, config) => {
              if (newGameMode === "local" || newGameMode === "ai") {
                cancelMultiplayer();
                if (config) {
                  setAiPlayers(config.players);
                  if (config.skills) {
                    setAiSkill(config.skills);
                  }
                } else {
                  setAiPlayers({ w: "human", b: "human" });
                  setAiSkill({ w: 10, b: 10 });
                }
                handleNewGame();
              } else if (newGameMode === "host") {
                handleHostOnline();
              }
            }}
            roomId={roomId}
            connected={connected}
            onJoinRoom={handleJoinGame}
            onSaveGame={handleCopyLink}
            aiPlayers={aiPlayers}
            onApplyAIOptions={(config) => {
              setAiPlayers(config.players);
              if (config.skills) {
                setAiSkill(config.skills);
              }
              if (config.players.w !== "ai" && config.players.b !== "ai") {
                setAiPaused(false);
              }
            }}
            mode={mode}
            isJoiner={isJoiner}
            playerColor={playerColor}
            latency={latency}
            onConfigChange={handleConfigChange}
            canUndo={canUndo()}
            onUndo={handleUndo}
            hasSavedGame={hasSavedGame}
            onResumeSavedGame={handleResumeSavedGame}
            aiPaused={aiPaused}
            onPauseResume={() => setAiPaused(p => !p)}
            peerLeft={peerLeft}
            isReconnecting={isReconnecting}
            onLeaveGame={cancelMultiplayer}
            onContinueLocally={handleContinueLocally}
            rematchSent={rematchSent}
            rematchIncoming={rematchIncoming}
            onRequestRematch={requestRematch}
          />
        </div>
      </div>

      {/* ── Main ── */}
      <div className="ultimate-main">
        <div className="ultimate-boards-container">
          {/* Board grid */}
          <div className="ultimate-boards-grid">
            {BOARD_NAMES.map((boardName) => (
              <BoardCard
                key={boardName}
                boardName={boardName}
                boardState={boards[boardName]}
                isAvailable={currentlyAvailableBoards.includes(boardName)}
                isCapturedWhite={capturedBoards.white.includes(boardName)}
                isCapturedBlack={capturedBoards.black.includes(boardName)}
                pendingCheck={pendingChecks[boardName] ?? null}
                boardWinner={getBoardWinner(boardName)}
                globalTurn={globalTurn}
                playerColor={displayPlayerColor}
                isDisabled={isMultiplayerDisabled}
                squareStyles={allSquareStyles[boardName]}
                onPieceDrop={onPieceDrop}
                onSquareClick={onSquareClick}
                isSelectableForChoice={shouldShowModal && !isAIDecisionMaker && choiceBoards.includes(boardName)}
                onBoardChoice={handleBoardChoice}
                decisionMaker={decisionMaker}
              />
            ))}
          </div>

          {/* Move history */}
          <div className="move-history-section">
            <h3 className="move-history-title">Move History</h3>
            <div className="move-history-list" ref={moveHistoryContainerRef}>
              {moveHistory.length === 0 ? (
                <div className="move-history-empty">No moves yet</div>
              ) : (
                moveHistory.map((entry, index) => (
                  <div key={index} className="move-history-entry">
                    <span className="move-number">{entry.moveNumber}.</span>
                    <span
                      className="move-board"
                      style={{ color: BOARD_COLORS[entry.boardName] }}
                    >
                      [{BOARD_DISPLAY_NAMES[entry.boardName]}]
                    </span>
                    <span className={`move-player move-player--${entry.player}`}>
                      {entry.player === "w" ? "White" : "Black"}
                    </span>
                    <span className="move-san">{entry.move}</span>
                    {entry.gaveCheck && <span className="move-check">+</span>}
                    {entry.wasCastling && <span className="move-castling">🏰</span>}
                    <span className="move-arrow">→</span>
                    <span
                      className="move-next-board"
                      style={{ color: BOARD_COLORS[entry.nextBoard] }}
                    >
                      {BOARD_DISPLAY_NAMES[entry.nextBoard]}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Opponent choosing overlay ── */}
      {/* ── Promotion dialog ── */}
      {
        pendingPromotion && (
          <div className="ultimate-promotion-overlay">
            <PromotionDialog
              isOpen
              targetSquare={pendingPromotion.to}
              onPromote={handlePromote}
              isLoading={false}
            />
          </div>
        )
      }
      <OpponentChoosingOverlay
        routingMode={routingMode ? { kind: routingMode } : null}
        playerColor={playerColor}
        globalTurn={globalTurn}
        show={!!(shouldShowModal && playerColor && decisionMaker !== playerColor)}
      />

      {showRules && (
        <div className="modal-backdrop" onClick={() => setShowRules(false)} style={{ zIndex: 1000 }}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px", padding: "1rem", gap: "0.5em" }}>
            <h2 className="modal-title">Ultimate Chess</h2>
            <div style={{ maxHeight: "60vh", overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none", textAlign: "justify", fontSize: "0.95rem", color: "var(--color-text-primary)" }}>
              <p>Ultimate chess is a variant of <a href="https://en.wikipedia.org/wiki/Chess">chess</a> inspired by <a href="https://en.wikipedia.org/wiki/Ultimate_tic-tac-toe">ultimate tic-tac-toe</a>. The game consists of six interlinked chess boards, one for each type of piece (Pawn, Rook, Knight, Bishop, Queen, and King). The goal is to checkmate your opponent's king on the King board.</p>
              <p>Standard rules of chess apply when playing on each board, with the following modification: on each turn, when a player moves a piece, the opponent must play their next move on the board corresponding to that piece. Then, the piece that the opponent moves determines the next board, and so on.</p> <p>There are four additional rules governing special situations:</p>
              <ul>
                <li>A player cannot play on a board where they are currently giving check to the opponent's king (as this would kinda break the usual game). If a player is routed to such a board, they may instead choose any other valid board to play on.</li>
                <li>If a player is routed to a board where the game has already ended (by checkmate or draw), two cases arise: <ul>
                  <li>If they won or drew that board, they may choose any other valid board.</li>
                  <li>If they lost that board, their opponent chooses a valid board for them to play on.</li>
                </ul>
                </li>
                <li>When a player castles, they may choose whether the opponent is routed to the King board or the Rook board. The rules above may then apply to the chosen board (sometimes automatically).</li>
                <li>When a pawn reaches the final rank and is promoted, the move still counts as a pawn move for the purpose of determining the next board. (I write this now because it might change later.)</li>
              </ul>
              <hr style={{ borderTop: "2px solid var(--color-border-primary)", borderBottom: "none", margin: "0.5rem 0" }} />
              <p style={{ fontSize: "0.85rem", fontStyle: "italic" }}>
                <strong>NB:</strong> This is a work in progress and it was completely vibecoded, so there will be bugs. The multiplayer functionality is implemented via peer-to-peer WebRTC, so it does not use any server that stores your data after connection is established. The AI uses the stockfish engine (run locally via Stockfish.js) on each board independently, so it does not understand how the boards are interlinked and can easily be beaten.
              </p>
            </div>
            <button className="btn btn--primary" onClick={() => setShowRules(false)}>Close</button>
          </div>
        </div>
      )
      }

    </div >
  );
}
