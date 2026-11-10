import type { loadPyodide } from 'pyodide'
import { facelets, isSolved, parseMoves, scramble, SOLVED, turn, type Move } from '../core/cube'
import type { Emit, RunRequest } from './protocol'
import runner from './runner.py?raw'

const indexURL = new URL('pyodide/', new URL(import.meta.env.BASE_URL, self.location.origin)).href
let runtime: ReturnType<typeof loadPyodide> | undefined

async function initializeRuntime() {
  const moduleURL = new URL('pyodide.mjs', indexURL).href
  const pyodide: typeof import('pyodide') = await import(/* @vite-ignore */ moduleURL)
  return pyodide.loadPyodide({ indexURL })
}

self.onmessage = async ({ data }: MessageEvent<RunRequest>) => {
  const { id, source, filename } = data
  const emit: Emit = event => self.postMessage({ id, ...event })
  let start = performance.now()

  try {
    runtime ??= initializeRuntime().catch(error => {
      runtime = undefined
      throw error
    })
    const python = await runtime
    start = performance.now()
    emit({ type: 'ready' })

    let board = data.board
    let actionCount = 0
    let outputCount = 0
    const limit = 'The 10,000 cube actions per run limit was reached.'

    const output = (type: 'stdout' | 'stderr', text: string) => {
      outputCount++
      if (outputCount <= 2000) emit({ type, text: text.slice(0, 4000) })
      if (outputCount === 2001) emit({ type: 'stderr', text: 'Output limit reached. Further lines were omitted.' })
    }
    python.setStdout({ batched: text => output('stdout', text) })
    python.setStderr({ batched: text => output('stderr', text) })

    const apply = (moves: Move[], scramble?: string) => {
      if (actionCount + moves.length > 10_000) return limit
      if (moves.length) {
        actionCount += moves.length
        board = moves.reduce(turn, board)
        emit({ type: 'action', action: { type: 'turn', moves }, scramble })
      }
      return ''
    }

    const globals = python.runPython('dict()')
    try {
      globals.set('_source', source)
      globals.set('_filename', filename)
      globals.set('_turn', (notation: string) => {
        try {
          return apply(parseMoves(notation))
        } catch (error) {
          return (error as Error).message
        }
      })
      globals.set('_state', () => JSON.stringify(facelets(board)))
      globals.set('_solved', () => isSolved(board))
      globals.set('_reset', () => {
        if (actionCount >= 10_000) return limit
        actionCount++
        board = SOLVED
        emit({ type: 'action', action: { type: 'reset' } })
        return ''
      })
      globals.set('_scramble', () => {
        const moves = scramble()
        const notation = moves.join(' ')
        return `${apply(moves, notation)}\n${notation}`
      })
      globals.set('_failure', (text: string, line: number, column: number) => {
        emit({ type: 'error', text, line, column })
      })
      await python.runPythonAsync(runner, { globals, filename: '_rubik_runner.py' })
    } finally {
      globals.destroy()
    }
  } catch (error) {
    emit({ type: 'error', text: (error as Error).message })
  } finally {
    emit({ type: 'done', elapsed: performance.now() - start })
  }
}
