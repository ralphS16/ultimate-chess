/**
 * BoardCard
 * Thin adapter between engine-backed board state and the presentational
 * `Board` component. Converts callback signatures and supplies availability
 * flags; no game rules here.
 */
import { memo, useCallback } from 'react';
import Board from './Board';
import type { BoardName } from '../types/boardTypes';

interface BoardState {
  game: { fen: () => string };
  fen: string;
  moveFrom: string | null;
}

interface BoardCardProps {
  boardName: BoardName;
  boardState: BoardState;
  isAvailable: boolean;
  isCapturedWhite: boolean;
  isCapturedBlack: boolean;
  pendingCheck: 'w' | 'b' | null;
  boardWinner: 'white' | 'black' | 'draw' | null;
  globalTurn: 'w' | 'b';
  playerColor?: 'w' | 'b' | null;
  isDisabled?: boolean;
  squareStyles: Record<string, React.CSSProperties>;
  onPieceDrop: (boardName: BoardName, sourceSquare: string, targetSquare: string | null) => boolean;
  onSquareClick: (boardName: BoardName, square: string) => void;
  isSelectableForChoice?: boolean;
  onBoardChoice?: (boardName: BoardName) => void;
  decisionMaker?: 'w' | 'b' | null;
}

const BoardCard = memo(function BoardCard({
  boardName,
  boardState,
  isAvailable,
  isCapturedWhite,
  isCapturedBlack,
  pendingCheck,
  boardWinner,
  globalTurn,
  playerColor,
  isDisabled,
  squareStyles,
  onPieceDrop,
  onSquareClick,
  isSelectableForChoice = false,
  onBoardChoice,
  decisionMaker,
}: BoardCardProps) {
  // Adapt callback signatures with useCallback so Board's memo can work
  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string | null): boolean => {
      return onPieceDrop(boardName, sourceSquare, targetSquare);
    },
    [boardName, onPieceDrop]
  );

  const handleSquareClick = useCallback(
    (square: string): void => {
      onSquareClick(boardName, square);
    },
    [boardName, onSquareClick]
  );

  const handleBoardChoice = useCallback(() => {
    if (onBoardChoice) {
      onBoardChoice(boardName);
    }
  }, [boardName, onBoardChoice]);

  return (
    <Board
      boardName={boardName}
      boardState={boardState}
      isAvailable={isAvailable}
      isCapturedWhite={isCapturedWhite}
      isCapturedBlack={isCapturedBlack}
      hasPendingCheck={pendingCheck !== null}
      pendingCheckPlayer={pendingCheck || undefined}
      boardResult={boardWinner}
      playerColor={playerColor}
      isDisabled={isDisabled}
      squareStyles={squareStyles}
      currentPlayer={globalTurn}
      onPieceDrop={handlePieceDrop}
      onSquareClick={handleSquareClick}
      isSelectableForChoice={isSelectableForChoice}
      onBoardChoice={handleBoardChoice}
      decisionMaker={decisionMaker}
    />
  );
});

export { BoardCard };
