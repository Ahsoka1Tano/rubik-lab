import { lazy, Suspense, useLayoutEffect, useRef } from 'react'
import { ChevronDown, Play, Plus, Square, Terminal, Trash2, X } from 'lucide-react'
import { canStop, clearOutput, startRun, stopRun, useLab } from '../../stores/lab'
import type { Script } from './files'

const Monaco = lazy(() => import('./Monaco'))
const labels = {
  idle: 'Ready', loading: 'Loading Python', running: 'Running',
  complete: 'Finished', error: 'Error', stopped: 'Stopped',
}

export function EditorPanel({ files, script, saved, onAdd, onSelect, onRemove, onChange }: {
  files: Script[]; script: Script; saved: boolean; onAdd: () => void; onSelect: (name: string) => void
  onRemove: (name: string) => void; onChange: (name: string, source: string) => void
}) {
  const output = useLab(state => state.output)
  const status = useLab(state => state.status)
  const playing = useLab(state => state.playing)
  const diagnostic = useLab(state => state.diagnostic)
  const active = status === 'loading' || status === 'running'
  const log = useRef<HTMLDivElement>(null)
  const follow = useRef(true)

  useLayoutEffect(() => {
    if (log.current && follow.current) log.current.scrollTop = log.current.scrollHeight
  }, [output])

  return <>
    <div className="editor-tabbar">
      <div className="file-tabs" aria-label="Python files">
        {files.map(file => <div className={`file-tab ${file.name === script.name ? 'selected' : ''}`} key={file.name}>
          <button className="select-file" aria-pressed={file.name === script.name} onClick={() => onSelect(file.name)}>
            <span className="python-glyph">Py</span>{file.name}
          </button>
          {files.length > 1 && <button className="close-file" aria-label={`Remove ${file.name}`} title={`Remove ${file.name}`} onClick={() => onRemove(file.name)}><X size={12} /></button>}
        </div>)}
      </div>
      <button type="button" className="icon-button add-file" title="New Python file" aria-label="New Python file" onClick={onAdd}><Plus size={16} /></button>
    </div>
    <Suspense fallback={<div className="editor-loading">Loading editor…</div>}>
      <Monaco files={files} active={script.name} diagnostic={diagnostic} onChange={onChange} />
    </Suspense>
    <div className="editor-runbar">
      <button type="button" className="run-button" onClick={() => startRun(script.name, script.source)} disabled={active || playing || !script.source.trim()}>
        <Play size={13} fill="currentColor" /> Run
      </button>
      <button type="button" className="stop-button" onClick={stopRun} disabled={!canStop()}>
        <Square size={12} /> Stop
      </button>
      <span className="run-shortcut"><kbd>Ctrl</kbd><kbd>↵</kbd></span>
      <label className="speed-label">
        <span>Speed</span>
        <Speed />
        <ChevronDown size={12} />
      </label>
    </div>
    <section className="terminal" aria-label="Python console">
      <div className="terminal-header">
        <Terminal size={15} /><h3>Console</h3>
        <button type="button" className="icon-button" title="Clear console" aria-label="Clear console" onClick={clearOutput}><Trash2 size={14} /></button>
      </div>
      <div className="terminal-log" ref={log} role="log" tabIndex={0} onScroll={event => {
        const node = event.currentTarget
        follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 20
      }}>
        {output.length === 0 ? <div className="console-empty"><span>›</span> Run a script to see its output here.</div> :
          output.map(line => <div className={`console-line ${line.kind}`} key={line.id}>{line.text}</div>)}
      </div>
    </section>
    <div className="editor-footer">
      <span><i className={`status-dot ${status}`} />{playing && !active ? 'Animating' : labels[status]}</span>
      <span>{saved ? 'Local autosave' : 'Autosave unavailable'}<b>·</b>Python 3</span>
    </div>
  </>
}

function Speed() {
  const speed = useLab(state => state.speed)
  return <select aria-label="Animation speed" value={speed} onChange={event => useLab.setState({ speed: Number(event.target.value) })}>
    {[0.5, 1, 1.5, 2, 4, 8].map(value => <option value={value} key={value}>{value}×</option>)}
  </select>
}
