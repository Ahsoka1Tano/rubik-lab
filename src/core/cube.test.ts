import { describe, expect, it } from 'vitest'
import {
  describeTurn, facelets, FACES, invert, isSolved, parseMoves, scramble, SOLVED, turn, type Board, type Move,
} from './cube'
import { Timeline } from './timeline'

export function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x100000000
  }
}

const parity = (permutation: number[]) => permutation.reduce(
  (sum, value, index) => sum + permutation.slice(index + 1).filter(next => next < value).length, 0,
) % 2

function invariants(board: Board) {
  const edges = board.filter(piece => piece.stickers.length === 2)
  const corners = board.filter(piece => piece.stickers.length === 3)
  const ids = (pieces: Board) => pieces.map(piece => piece.id)
  const positions = (pieces: Board) => pieces.map(piece => piece.position.join(','))
  const permutationParity = (pieces: Board) => {
    const order = ids(pieces)
    return parity(positions(pieces).map(position => order.indexOf(position)))
  }
  const edgeFlips = edges.filter(piece => {
    const sticker = piece.stickers.find(({ color }) => color === 'U' || color === 'D')
      ?? piece.stickers.find(({ color }) => color === 'F' || color === 'B')!
    const primaryAxis = piece.position[1] ? 1 : 2
    return sticker.normal[primaryAxis] === 0
  }).length
  const cornerTwists = corners.reduce((sum, piece) => {
    const [x, y, z] = piece.position
    const primary = piece.stickers.find(({ color }) => color === 'U' || color === 'D')!
    const order = x * y * z > 0 ? [1, 2, 0] : [1, 0, 2]
    return sum + order.indexOf(primary.normal.findIndex(Boolean))
  }, 0)
  return {
    edgeParity: permutationParity(edges),
    cornerParity: permutationParity(corners),
    flips: edgeFlips % 2,
    twists: cornerTwists % 3,
  }
}

describe('cube engine', () => {
  it.each(FACES)('%s has order four and is canceled by its prime move', face => {
    const four = Array<Move>(4).fill(face).reduce(turn, SOLVED)
    expect(four).toEqual(SOLVED)
    expect(turn(turn(SOLVED, face), invert(face))).toEqual(SOLVED)
    expect(isSolved(turn(SOLVED, face))).toBe(false)
  })

  it.each(FACES)('%s2 is its own inverse and equals two quarter-turns', face => {
    const double: Move = `${face}2`
    expect(turn(SOLVED, double)).toEqual(turn(turn(SOLVED, face), face))
    expect(turn(turn(SOLVED, double), double)).toEqual(SOLVED)
  })

  it('serializes a known right turn in face-local row-major order', () => {
    expect(facelets(turn(SOLVED, 'R'))).toEqual({
      U: 'UUFUUFUUF', R: 'RRRRRRRRR', F: 'FFDFFDFFD',
      D: 'DDBDDBDDB', L: 'LLLLLLLLL', B: 'UBBUBBUBB',
    })
  })

  it('parses full sequences and rejects a bad token before making any moves', () => {
    expect(parseMoves("  R\tU\nR' F2  ")).toEqual(['R', 'U', "R'", 'F2'])
    expect(parseMoves('')).toEqual([])
    expect(() => parseMoves('R X F')).toThrow(/Invalid move "X"/)
    expect(() => parseMoves('R2\'')).toThrow(/Invalid move/)
  })

  it('reverses thousands of turns without accumulating rounding error', () => {
    const random = seededRandom(2026)
    const moves = Array.from({ length: 120 }, () => scramble(random)).flat()
    const mixed = moves.reduce(turn, SOLVED)
    expect(isSolved(mixed)).toBe(false)
    const inverse = [...moves].reverse().map(invert)
    expect(inverse.reduce(turn, mixed)).toEqual(SOLVED)
  })

  it('preserves sticker counts, pieces, orientation sums, and permutation parity during scrambles', () => {
    const random = seededRandom(911)
    for (let i = 0; i < 24; i++) {
      const moves = scramble(random)
      expect(moves).toHaveLength(25)
      expect(moves.every((move, index) => index === 0 || describeTurn(move).axis !== describeTurn(moves[index - 1]).axis)).toBe(true)
      let board = SOLVED
      for (const move of moves) {
        board = turn(board, move)
        expect(new Set(board.map(piece => piece.position.join(','))).size).toBe(26)
        expect(board.map(piece => piece.id)).toEqual(SOLVED.map(piece => piece.id))
        const stickers = Object.values(facelets(board))
        expect(stickers.map(face => face.length)).toEqual([9, 9, 9, 9, 9, 9])
        for (const face of FACES) expect(stickers.join('').split(face)).toHaveLength(10)
        const { edgeParity, cornerParity, flips, twists } = invariants(board)
        expect(edgeParity).toBe(cornerParity)
        expect(flips).toBe(0)
        expect(twists).toBe(0)
      }
    }
  })
})

describe('timeline', () => {
  it('keeps consecutive frame endpoints and supports undo, redo, branching, and reset', () => {
    const timeline = new Timeline()
    const frames = timeline.dispatch({ type: 'turn', moves: ['R', "U'", 'F2'] })
    expect(frames[0].before).toBe(SOLVED)
    expect(frames[1].before).toBe(frames[0].after)
    expect(frames[2].before).toBe(frames[1].after)
    expect(timeline.undo()[0].after).toEqual(frames[1].after)
    expect(timeline.redo()[0].after).toEqual(frames[2].after)
    timeline.undo()
    timeline.dispatch({ type: 'turn', moves: ['D'] })
    expect(timeline.redo()).toEqual([])
    expect(timeline.history).toEqual(['R', "U'", 'D'])
    expect(timeline.dispatch({ type: 'reset' })[0].after).toBe(SOLVED)
    expect(timeline.history).toEqual([])
    expect(timeline.undo()).toEqual([])
  })
})
