# Ultimate Chess

![Screenshot of game of ultimate chess](/src/image.png)

Ultimate chess is a variant of [chess](https://en.wikipedia.org/wiki/Chess) inspired by [ultimate tic-tac-toe](https://en.wikipedia.org/wiki/Ultimate_tic-tac-toe). The game consists of six interlinked chess boards, one for each type of piece (Pawn, Rook, Knight, Bishop, Queen, and King). The goal is to checkmate your opponent's king on the King board.

Standard rules of chess apply when playing on each board, with the following modification: on each turn, when a player moves a piece, the opponent must play their next move on the board corresponding to that piece. Then, the piece that the opponent moves determines the next board, and so on.

There are four additional rules governing special situations:

- A player cannot play on a board where they are currently giving check to the opponent's king (as this would kinda break the usual game). If a player is routed to such a board, they may instead choose any other valid board to play on.
- If a player is routed to a board where the game has already ended (by checkmate or draw), two cases arise:
  - If they won or drew that board, they may choose any other valid board.
  - If they lost that board, their opponent chooses a valid board for them to play on.
- When a player castles, they may choose whether the opponent is routed to the King board or the Rook board. The rules above may then apply to the chosen board (sometimes automatically).
- When a pawn reaches the final rank and is promoted, the move still counts as a pawn move for the purpose of determining the next board. (I write this now because it might change later.)

---

**NB:** *This is a work in progress and it was completely vibecoded, so there will be bugs. The multiplayer functionality is implemented via peer-to-peer WebRTC, so it does not use any server that stores your data after connection is established. The AI uses the stockfish engine (run locally via Stockfish.js) on each board independently, so it does not understand how the boards are interlinked and can easily be beaten.*