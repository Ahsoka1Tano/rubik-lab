import type { RunEvent, RunRequest } from './protocol'

let worker: Worker | undefined
let current: number | undefined

export function runPython(request: RunRequest, receive: (event: RunEvent) => void) {
  worker ??= new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  const runningWorker = worker
  current = request.id
  runningWorker.onmessage = ({ data }: MessageEvent<RunEvent>) => {
    if (worker !== runningWorker || data.id !== current) return
    if (data.type === 'done') current = undefined
    receive(data)
  }
  runningWorker.onerror = event => {
    if (worker !== runningWorker || request.id !== current) return
    stopPython()
    receive({ id: request.id, type: 'error', text: event.message || 'Could not start the Python worker.' })
    receive({ id: request.id, type: 'done', elapsed: 0 })
  }
  runningWorker.postMessage(request)
}

export function stopPython() {
  current = undefined
  worker?.terminate()
  worker = undefined
}
