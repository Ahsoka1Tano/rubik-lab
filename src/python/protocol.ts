import type { Board, CubeAction } from '../core/cube'

export type RunRequest = { id: number; board: Board; filename: string; source: string }
type EventPayload =
  | { type: 'ready' }
  | { type: 'action'; action: CubeAction; scramble?: string }
  | { type: 'stdout' | 'stderr'; text: string }
  | { type: 'error'; text: string; line?: number; column?: number }
  | { type: 'done'; elapsed: number }

export type RunEvent = EventPayload & { id: number }
export type Emit = (event: EventPayload) => void
