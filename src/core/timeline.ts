import { invert, SOLVED, turn, type Board, type CubeAction, type Move } from './cube'

export type Frame = { before: Board; after: Board; move?: Move }

export class Timeline {
  board = SOLVED
  history: Move[] = []
  cursor = 0

  private apply(move: Move): Frame {
    const before = this.board
    this.board = turn(before, move)
    return { before, after: this.board, move }
  }

  dispatch(action: CubeAction): Frame[] {
    if (action.type === 'reset') {
      const frame = { before: this.board, after: SOLVED }
      this.board = SOLVED
      this.history = []
      this.cursor = 0
      return [frame]
    }
    if (!action.moves.length) return []
    this.history.length = this.cursor
    this.history.push(...action.moves)
    this.cursor = this.history.length
    return action.moves.map(move => this.apply(move))
  }

  undo(): Frame[] {
    if (this.cursor === 0) return []
    return [this.apply(invert(this.history[--this.cursor]))]
  }

  redo(): Frame[] {
    if (this.cursor === this.history.length) return []
    return [this.apply(this.history[this.cursor++])]
  }
}
