/**
 * Board
 * Presentation component wrapping `react-chessboard` for a single board.
 * Receives engine state (FEN, styles, availability) via props and emits user
 * actions (onPieceDrop/onSquareClick). It must not contain routing or rule
 * logic — that belongs in `UltimateChessGame`.
 */
import { memo, useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { BOARD_COLORS, BOARD_DISPLAY_NAMES, type BoardName } from '../types/boardTypes';

interface BoardProps {
  boardName: BoardName;
  boardState: {
    game: { fen: () => string };
    fen: string;
    moveFrom: string | null;
  };
  isAvailable: boolean;
  isCapturedWhite: boolean;
  isCapturedBlack: boolean;
  hasPendingCheck: boolean;
  pendingCheckPlayer?: 'w' | 'b';
  boardResult: 'white' | 'black' | 'draw' | null;
  playerColor?: 'w' | 'b' | null;
  isDisabled?: boolean;
  squareStyles: Record<string, React.CSSProperties>;
  currentPlayer: 'w' | 'b';
  onPieceDrop: (sourceSquare: string, targetSquare: string | null) => boolean;
  onSquareClick: (square: string) => void;
  isSelectableForChoice?: boolean;
  onBoardChoice?: () => void;
  decisionMaker?: 'w' | 'b' | null;
}

const Board = memo(function Board({
  boardName,
  boardState,
  isAvailable,
  isCapturedWhite,
  isCapturedBlack,
  hasPendingCheck,
  pendingCheckPlayer,
  boardResult,
  playerColor,
  isDisabled,
  squareStyles,
  currentPlayer,
  onPieceDrop,
  onSquareClick,
  isSelectableForChoice = false,
  onBoardChoice,
  decisionMaker,
}: BoardProps) {
  const isFinished = boardResult !== null;
  const boardOrientation = (playerColor === 'b' ? 'black' : 'white') as 'white' | 'black';

  // Board title - show "board won" for finished boards
  const boardTitle = isFinished
    ? `${BOARD_DISPLAY_NAMES[boardName]} — ${
        boardResult === 'draw' ? 'Draw' :
        boardResult === 'white' ? 'White Won' : 'Black Won'
      }`
    : BOARD_DISPLAY_NAMES[boardName];
  const checkLabel = hasPendingCheck && pendingCheckPlayer && !isFinished
    ? `${pendingCheckPlayer === 'w' ? 'White' : 'Black'} in Check`
    : null;

  const handleBoardClick = () => {
    if (isSelectableForChoice && onBoardChoice) {
      onBoardChoice();
    }
  };

  const chessboardOptions = useMemo(() => ({
    position: boardState.fen,
    boardOrientation: boardOrientation,
    onPieceDrop: isFinished || isSelectableForChoice
      ? undefined
      : (args: { sourceSquare: string; targetSquare: string | null }) =>
        onPieceDrop(args.sourceSquare, args.targetSquare),
    onSquareClick: isFinished || isSelectableForChoice
      ? undefined
      : (args: { square: string }) => onSquareClick(args.square),
    onPieceClick: isFinished || isSelectableForChoice
      ? undefined
      : (args: { square: string | null }) => { if (args.square) onSquareClick(args.square); },
    allowDrawingArrows: false,
    showNotation: false,
    boardStyle: { boxShadow: "0 2px 8px rgba(0,0,0,0.2)" },
    lightSquareStyle: { backgroundColor: "#ddd" },
    darkSquareStyle: { backgroundColor: "#777" },
    squareStyles,
  }), [boardState.fen, boardOrientation, isFinished, isSelectableForChoice, onPieceDrop, onSquareClick, squareStyles]);

  return (
    <div
      className={`ultimate-board ${isAvailable && !isFinished ? "ultimate-board--available" : ""} ${isCapturedWhite ? "ultimate-board--captured-white" : ""
        } ${isCapturedBlack ? "ultimate-board--captured-black" : ""} ${hasPendingCheck && !isFinished ? "ultimate-board--pending-check" : ""
        } ${isFinished ? "ultimate-board--finished" : ""} ${isSelectableForChoice ? "ultimate-board--selectable" : ""}`}
      style={{
        borderColor: isAvailable && !isDisabled ? BOARD_COLORS[boardName] : undefined,
        opacity: isDisabled ? 0.5 : (isAvailable ? 1 : 0.6),
        pointerEvents: isDisabled ? 'none' : undefined,
        filter: isDisabled ? 'grayscale(0.8)' : undefined,
        position: 'relative',
        cursor: isSelectableForChoice && !isDisabled ? 'pointer' : undefined,
        boxShadow: isSelectableForChoice && !isDisabled ? 'inset 0 0 0 4px rgba(100, 200, 100, 0.8)' : undefined,
      }}
      onClick={handleBoardClick}
    >
      <div
        className="ultimate-board__header"
        style={{
          backgroundColor: isAvailable ? BOARD_COLORS[boardName] : undefined,
          color: isAvailable ? "#fff" : undefined,
        }}
      >
        <span className="ultimate-board__title">{boardTitle}</span>
        {checkLabel && (
          <span className="ultimate-board__badge ultimate-board__badge--check">
            {checkLabel}
          </span>
        )}
        {isSelectableForChoice && decisionMaker && (
          <span className="ultimate-board__badge" style={{ backgroundColor: 'rgba(100, 200, 100, 0.8)' }}>
            {decisionMaker === 'w' ? 'WHITE PICKS' : 'BLACK PICKS'}
          </span>
        )}
        {!isSelectableForChoice && isAvailable && !isFinished && (
          <span
            className="ultimate-board__badge"
            title={checkLabel ?? undefined}
          >
            {currentPlayer === 'w' ? 'WHITE TURN' : 'BLACK TURN'}
            {isCapturedWhite && <span className="ultimate-board__capture-indicator">White Won</span>}
            {isCapturedBlack && <span className="ultimate-board__capture-indicator">Black Won</span>}
          </span>
        )}
      </div>
      <div className="ultimate-board__content" style={{ position: 'relative' }}>
        <Chessboard options={chessboardOptions} />
      </div>
    </div>
  );
});

export default Board;
