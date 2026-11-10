import { describe, expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import { FACES, SOLVED, parseMoves, turn, type Board } from '../../core/cube'
import { CubeRig } from './CubeRig'

function matches(rig: CubeRig, board: Board) {
  rig.root.updateMatrixWorld(true)
  for (const piece of board) {
    const view = rig.pieces.get(piece.id)!
    const position = view.group.getWorldPosition(new Vector3())
    expect(position.distanceTo(new Vector3(...piece.position))).toBeLessThan(1e-10)
    for (const sticker of piece.stickers) {
      const mesh = view.stickers.get(sticker.color)!
      const direction = new Vector3(0, 0, 1).applyQuaternion(mesh.getWorldQuaternion(new Quaternion()))
      expect(direction.distanceTo(new Vector3(...sticker.normal))).toBeLessThan(1e-10)
    }
  }
}

describe('Three.js cube rig', () => {
  it('moves only the nine layer pieces and matches model positions and normals at every endpoint', () => {
    const allTurns = FACES.map(face => `${face} ${face}' ${face}2`).join(' ')
    const moves = parseMoves(`R U2 F' D L2 B ${allTurns} U F R B2 L' `.repeat(8))
    const rig = new CubeRig(SOLVED)
    let board = SOLVED
    try {
      for (const move of moves) {
        rig.begin(board, move)
        expect(rig.pivot.children).toHaveLength(9)
        rig.pose(0.5)
        const stationary = board.filter(piece => rig.pieces.get(piece.id)!.group.parent !== rig.pivot)
        matches(rig, stationary)
        const after = turn(board, move)
        rig.pose(1)
        matches(rig, after)
        rig.sync(after)
        expect(rig.pivot.children).toHaveLength(0)
        matches(rig, after)
        board = after
      }
    } finally {
      rig.dispose()
    }
  })
})
