import { Group, Mesh, MeshStandardMaterial, Shape, ShapeGeometry, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { describeTurn, SOLVED, type Board, type Face, type Move } from '../../core/cube'

const colors: Record<Face, number> = {
  U: 0xf5f4e8, R: 0xeb3548, F: 0x1fbd70, D: 0xf4c530, L: 0xf77734, B: 0x3476ea,
}
const front = new Vector3(0, 0, 1)
const normal = new Vector3()
const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), front]

function roundedSticker() {
  const edge = 0.416
  const shoulder = edge - 0.083
  const shape = new Shape()
  shape.moveTo(-shoulder, -edge)
  shape.lineTo(shoulder, -edge)
  shape.quadraticCurveTo(edge, -edge, edge, -shoulder)
  shape.lineTo(edge, shoulder)
  shape.quadraticCurveTo(edge, edge, shoulder, edge)
  shape.lineTo(-shoulder, edge)
  shape.quadraticCurveTo(-edge, edge, -edge, shoulder)
  shape.lineTo(-edge, -shoulder)
  shape.quadraticCurveTo(-edge, -edge, -shoulder, -edge)
  return new ShapeGeometry(shape, 6)
}

export class CubeRig {
  readonly root = new Group()
  readonly pivot = new Group()
  readonly pieces = new Map<string, { group: Group; stickers: Map<Face, Mesh> }>()
  private bodyGeometry = new RoundedBoxGeometry(0.982, 0.982, 0.982, 3, 0.074)
  private stickerGeometry = roundedSticker()
  private plastic = new MeshStandardMaterial({ color: 0x111319, roughness: 0.38, metalness: 0.08 })
  private palette = new Map(Object.entries(colors).map(([face, color]) =>
    [face as Face, new MeshStandardMaterial({ color, roughness: 0.62 })] as const,
  ))
  private rotation?: ReturnType<typeof describeTurn>

  constructor(board: Board) {
    this.root.add(this.pivot)
    for (const piece of SOLVED) {
      const group = new Group()
      group.add(new Mesh(this.bodyGeometry, this.plastic))
      const stickers = new Map<Face, Mesh>()
      for (const { color } of piece.stickers) {
        const sticker = new Mesh(this.stickerGeometry, this.palette.get(color))
        stickers.set(color, sticker)
        group.add(sticker)
      }
      this.pieces.set(piece.id, { group, stickers })
    }
    this.sync(board)
  }

  sync(board: Board) {
    this.pivot.quaternion.identity()
    this.rotation = undefined
    for (const piece of board) {
      const { group, stickers } = this.pieces.get(piece.id)!
      if (group.parent !== this.root) this.root.add(group)
      group.position.set(...piece.position)
      group.quaternion.identity()
      for (const { color, normal: direction } of piece.stickers) {
        const sticker = stickers.get(color)!
        normal.set(...direction)
        sticker.position.copy(normal).multiplyScalar(0.493)
        sticker.quaternion.setFromUnitVectors(front, normal)
      }
    }
  }

  begin(board: Board, move: Move) {
    this.rotation = describeTurn(move)
    const { axis, layer } = this.rotation
    for (const piece of board) {
      if (piece.position[axis] === layer) this.pivot.add(this.pieces.get(piece.id)!.group)
    }
  }

  pose(progress: number) {
    if (!this.rotation) return
    const { axis, quarters } = this.rotation
    this.pivot.quaternion.setFromAxisAngle(axes[axis], progress * quarters * Math.PI / 2)
  }

  dispose() {
    this.bodyGeometry.dispose()
    this.stickerGeometry.dispose()
    this.plastic.dispose()
    this.palette.forEach(material => material.dispose())
  }
}
