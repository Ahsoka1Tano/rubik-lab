import { create } from 'zustand'
import { isSolved, parseMoves, scramble, type CubeAction, type Move } from '../core/cube'
import { Timeline, type Frame } from '../core/timeline'
import { runPython, stopPython } from '../python/client'
import type { RunEvent } from '../python/protocol'

type Status = 'idle' | 'loading' | 'running' | 'complete' | 'error' | 'stopped'
type Output = { id: number; kind: 'system' | 'stdout' | 'stderr'; text: string }
export type Diagnostic = { filename: string; source: string; text: string; line?: number; column?: number }

export const useLab = create<{
  status: Status
  playing: boolean
  speed: number
  count: number
  solved: boolean
  canRedo: boolean
  history: Move[]
  scramble: string
  output: Output[]
  diagnostic?: Diagnostic
  toast: string
}>(() => ({
  status: 'idle', playing: false, speed: 1, count: 0, solved: true, canRedo: false,
  history: [], scramble: '', output: [], toast: '',
}))

const timeline = new Timeline()
let frames: Frame[] = []
let cursor = 0
let sceneRevision = 0
let sceneAnchor = timeline.board
let runId = 0
let outputId = 0
let current: { id: number; filename: string; source: string; failed: boolean } | undefined
let playbackRun = false
let toastTimer: ReturnType<typeof setTimeout>
let pendingOutput: Output[] = []
let outputTimer: ReturnType<typeof setTimeout> | undefined

function flushOutput() {
  outputTimer = undefined
  if (!pendingOutput.length) return
  useLab.setState(state => ({ output: [...state.output, ...pendingOutput].slice(-600) }))
  pendingOutput = []
}

function write(kind: Output['kind'], text: string) {
  pendingOutput.push({ id: ++outputId, kind, text })
  outputTimer ??= setTimeout(flushOutput, 20)
}

export function clearOutput() {
  clearTimeout(outputTimer)
  outputTimer = undefined
  pendingOutput = []
  useLab.setState({ output: [] })
}

function toast(text: string) {
  clearTimeout(toastTimer)
  useLab.setState({ toast: text })
  toastTimer = setTimeout(() => useLab.setState({ toast: '' }), 2300)
}

function enqueue(next: Frame[]) {
  if (!next.length) return
  for (const frame of next) frames.push(frame)
  useLab.setState({
    playing: true,
    count: timeline.cursor,
    canRedo: timeline.cursor < timeline.history.length,
    history: timeline.history.slice(Math.max(0, timeline.cursor - 100), timeline.cursor),
  })
}

export const playback = {
  get revision() { return sceneRevision },
  get anchor() { return sceneAnchor },
  get speed() { return useLab.getState().speed },
  take() {
    if (cursor === frames.length) return undefined
    return frames[cursor++]
  },
  finish(frame: Frame) {
    sceneAnchor = frame.after
    const solved = isSolved(frame.after)
    useLab.setState({ solved })
    if (frame.move && solved && !isSolved(frame.before)) toast('Cube solved!')
    if (cursor < frames.length) return
    frames = []
    cursor = 0
    playbackRun = false
    useLab.setState({ playing: false })
  },
  skip() {
    frames = []
    cursor = 0
    sceneAnchor = timeline.board
    sceneRevision++
    playbackRun = false
    useLab.setState({ playing: false, solved: isSolved(timeline.board) })
  },
}

function dispatch(action: CubeAction) {
  if (action.type === 'reset') useLab.setState({ scramble: '' })
  enqueue(timeline.dispatch(action))
}

export const cubeControls = {
  turn(notation: string) {
    if (current || useLab.getState().playing) return
    dispatch({ type: 'turn', moves: parseMoves(notation) })
  },
  scramble() {
    if (current || useLab.getState().playing) return
    const moves = scramble()
    useLab.setState({ scramble: moves.join(' ') })
    dispatch({ type: 'turn', moves })
  },
  reset() {
    if (current) return
    dispatch({ type: 'reset' })
    playback.skip()
    toast('')
  },
  undo() {
    if (!current && !useLab.getState().playing) enqueue(timeline.undo())
  },
  redo() {
    if (!current && !useLab.getState().playing) enqueue(timeline.redo())
  },
}

function receive(event: RunEvent) {
  if (event.id !== current?.id) return
  switch (event.type) {
    case 'ready':
      useLab.setState({ status: 'running' })
      break
    case 'action':
      playbackRun = true
      if (event.scramble) useLab.setState({ scramble: event.scramble })
      dispatch(event.action)
      break
    case 'stdout':
    case 'stderr':
      write(event.type, event.text)
      break
    case 'error':
      current.failed = true
      write('stderr', event.text)
      useLab.setState({
        diagnostic: { filename: current.filename, source: current.source, text: event.text, line: event.line, column: event.column },
      })
      break
    case 'done': {
      const failed = current.failed
      current = undefined
      write('system', failed ? 'Run finished with an error.' : `Finished in ${(event.elapsed / 1000).toFixed(2)} s`)
      useLab.setState({ status: failed ? 'error' : 'complete' })
      break
    }
  }
}

export function startRun(filename: string, source: string) {
  if (current || useLab.getState().playing || !source.trim()) return
  const id = ++runId
  current = { id, filename, source, failed: false }
  useLab.setState({ status: 'loading', diagnostic: undefined })
  write('system', `$ python ${filename}`)
  try {
    runPython({ id, filename, source, board: timeline.board }, receive)
  } catch (error) {
    stopPython()
    receive({ id, type: 'error', text: (error as Error).message })
    receive({ id, type: 'done', elapsed: 0 })
  }
}

export function canStop() {
  return Boolean(current || playbackRun)
}

export function stopRun() {
  if (!canStop()) return
  current = undefined
  stopPython()
  playback.skip()
  useLab.setState({ status: 'stopped' })
  write('system', 'Stopped. Applied cube moves were kept.')
}
