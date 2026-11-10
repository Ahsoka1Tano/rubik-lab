export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const
export type Face = typeof FACES[number]
export type Move = `${Face}${'' | "'" | '2'}`
export type Vec = readonly [number, number, number]
export type Axis = 0 | 1 | 2
export type Sticker = Readonly<{ color: Face; normal: Vec }>
export type Piece = Readonly<{ id: string; position: Vec; stickers: readonly Sticker[] }>
export type Board = readonly Piece[]
export type Facelets = Record<Face, string>
export type CubeAction = { type: 'turn'; moves: Move[] } | { type: 'reset' }

const frames: Record<Face, { normal: Vec; right: Vec; down: Vec }> = {
  U: { normal: [0, 1, 0], right: [1, 0, 0], down: [0, 0, 1] },
  R: { normal: [1, 0, 0], right: [0, 0, -1], down: [0, -1, 0] },
  F: { normal: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] },
  D: { normal: [0, -1, 0], right: [1, 0, 0], down: [0, 0, -1] },
  L: { normal: [-1, 0, 0], right: [0, 0, 1], down: [0, -1, 0] },
  B: { normal: [0, 0, -1], right: [-1, 0, 0], down: [0, -1, 0] },
}

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export const SOLVED: Board = [-1, 0, 1].flatMap(x =>
  [-1, 0, 1].flatMap(y =>
    [-1, 0, 1].filter(z => x || y || z).map(z => {
      const position: Vec = [x, y, z]
      const stickers = FACES.filter(face => dot(position, frames[face].normal) === 1)
        .map(color => ({ color, normal: frames[color].normal }))
      return { id: position.join(','), position, stickers }
    }),
  ),
)

export function parseMoves(notation: string): Move[] {
  return notation.trim().split(/\s+/).filter(Boolean).map(token => {
    if (!/^[URFDLB]['2]?$/.test(token)) {
      throw new Error(`Invalid move "${token}". Use U, R, F, D, L or B with an optional ' or 2.`)
    }
    return token as Move
  })
}

export function invert(move: Move): Move {
  if (move.endsWith('2')) return move
  if (move.endsWith("'")) return move[0] as Face
  return `${move as Face}'`
}

export function describeTurn(move: Move) {
  const normal = frames[move[0] as Face].normal
  const axis = normal.findIndex(Boolean) as Axis
  const layer = normal[axis]
  const quarters = -layer * (move.endsWith('2') ? 2 : move.endsWith("'") ? -1 : 1)
  return { axis, layer, quarters }
}

function rotate(vector: Vec, axis: Axis, quarters: number): Vec {
  const first = (axis + 1) % 3
  const second = (axis + 2) % 3
  const result: [number, number, number] = [...vector]
  for (let step = 0; step < (quarters + 4) % 4; step++) {
    const previous = result[first]
    result[first] = -result[second] || 0
    result[second] = previous
  }
  return result
}

export function turn(board: Board, move: Move): Board {
  const { axis, layer, quarters } = describeTurn(move)
  return board.map(piece => {
    if (piece.position[axis] !== layer) return piece
    return {
      id: piece.id,
      position: rotate(piece.position, axis, quarters),
      stickers: piece.stickers.map(({ color, normal }) => ({ color, normal: rotate(normal, axis, quarters) })),
    }
  })
}

export function facelets(board: Board): Facelets {
  return Object.fromEntries(FACES.map(face => {
    const { normal, right, down } = frames[face]
    const cells: Face[] = []
    for (const piece of board) {
      const sticker = piece.stickers.find(sticker => dot(sticker.normal, normal) === 1)
      if (!sticker) continue
      const row = dot(piece.position, down) + 1
      const column = dot(piece.position, right) + 1
      cells[row * 3 + column] = sticker.color
    }
    return [face, cells.join('')]
  })) as Facelets
}

export function isSolved(board: Board): boolean {
  return board.every(piece => piece.stickers.every(sticker => dot(sticker.normal, frames[sticker.color].normal) === 1))
}

export function scramble(random = Math.random): Move[] {
  const suffixes = ['', "'", '2'] as const
  const moves: Move[] = []
  let lastAxis: Axis | undefined
  for (let i = 0; i < 25; i++) {
    const faces = FACES.filter(face => describeTurn(face).axis !== lastAxis)
    const face = faces[Math.floor(random() * faces.length)]
    const suffix = suffixes[Math.floor(random() * suffixes.length)]
    moves.push(`${face}${suffix}`)
    lastAxis = describeTurn(face).axis
  }
  return moves
}
