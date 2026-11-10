import { useEffect, useState, type ReactNode } from 'react'
import {
  ArrowUpToLine, BookOpen, Box, Check, Code2, Crosshair, History, Mouse,
  Redo2, RotateCcw, Shuffle, Sparkles, Undo2, X,
} from 'lucide-react'
import CubeScene from './components/CubeScene/CubeScene'
import { FloatingWindow } from './components/FloatingWindow'
import { Mentor } from './components/Mentor'
import { EditorPanel } from './components/PythonEditor/EditorPanel'
import { newScript, readWorkspace, saveWorkspace } from './components/PythonEditor/files'
import { FACES } from './core/cube'
import { cubeControls, startRun, useLab } from './stores/lab'

type Panel = 'history' | 'api'

function Tool({ label, onClick, disabled, active, icon }: {
  label: string; onClick: () => void; disabled?: boolean; active?: boolean; icon: ReactNode
}) {
  return <button type="button" className="tool-button" title={label} aria-label={label} aria-pressed={active} onClick={onClick} disabled={disabled}>{icon}</button>
}

export default function App() {
  const [workspace, setWorkspace] = useState(readWorkspace)
  const [saved, setSaved] = useState(true)
  const [editorOpen, setEditorOpen] = useState(true)
  const [mentorOpen, setMentorOpen] = useState(false)
  const [foreground, setForeground] = useState<'editor' | 'mentor'>('editor')
  const [panel, setPanel] = useState<Panel>()
  const [cameraReset, setCameraReset] = useState(0)
  const [suffix, setSuffix] = useState<'' | "'" | '2'>('')
  const status = useLab(state => state.status)
  const playing = useLab(state => state.playing)
  const solved = useLab(state => state.solved)
  const count = useLab(state => state.count)
  const canRedo = useLab(state => state.canRedo)
  const notice = useLab(state => state.toast)
  const script = workspace.files.find(file => file.name === workspace.active)!
  const running = status === 'loading' || status === 'running'
  const locked = running || playing

  useEffect(() => {
    setSaved(saveWorkspace(workspace))
  }, [workspace])

  useEffect(() => {
    function keys(event: KeyboardEvent) {
      if (event.key === 'Escape' && panel) setPanel(undefined)
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.repeat) {
        event.preventDefault()
        event.stopPropagation()
        startRun(script.name, script.source)
      }
    }
    window.addEventListener('keydown', keys, true)
    return () => window.removeEventListener('keydown', keys, true)
  }, [panel, script])

  function togglePanel(value: Panel) {
    setPanel(previous => previous === value ? undefined : value)
  }

  function addFile() {
    setWorkspace(previous => {
      const file = newScript(previous.files)
      return { files: [...previous.files, file], active: file.name }
    })
  }

  function removeFile(name: string) {
    setWorkspace(previous => {
      if (previous.files.length === 1) return previous
      const files = previous.files.filter(file => file.name !== name)
      return { files, active: previous.active === name ? files[0].name : previous.active }
    })
  }

  return <div className="lab">
    <header className="topbar">
      <div className="brand">
        <img src={`${import.meta.env.BASE_URL}cube.svg`} alt="" />
        <div><strong>Rubik Lab</strong><span>CUBE PROGRAMMING STUDIO</span></div>
      </div>
      <div className="header-actions">
        <button type="button" className="header-button api-button" onClick={() => togglePanel('api')} aria-pressed={panel === 'api'} aria-label="Python API"><BookOpen size={16} /><span>Python API</span></button>
        <button type="button" className="header-button mentor-button" onClick={() => {
          setMentorOpen(!mentorOpen)
          if (!mentorOpen) setForeground('mentor')
        }} aria-pressed={mentorOpen}><Sparkles size={16} /><span>AI Mentor</span></button>
      </div>
    </header>

    <main className={`workbench ${editorOpen ? 'editor-open' : ''}`}>
      <CubeScene editorOpen={editorOpen} cameraReset={cameraReset} />
      <div className="stage-title">
        <div className="eyebrow"><span /> INTERACTIVE WORKSPACE</div>
        <h1>Cube playground</h1>
        <p>Explore, experiment, and code in 3D.</p>
      </div>

      <aside className="tools" aria-label="Cube controls">
        <Tool label="Scramble cube" onClick={cubeControls.scramble} disabled={locked} icon={<Shuffle size={19} />} />
        <Tool label="Reset cube" onClick={cubeControls.reset} disabled={running} icon={<RotateCcw size={19} />} />
        <div className="tool-divider" />
        <Tool label="Undo turn" onClick={cubeControls.undo} disabled={locked || count === 0} icon={<Undo2 size={19} />} />
        <Tool label="Redo turn" onClick={cubeControls.redo} disabled={locked || !canRedo} icon={<Redo2 size={19} />} />
        <div className="tool-divider" />
        <Tool label="Reset camera" onClick={() => setCameraReset(value => value + 1)} icon={<Crosshair size={19} />} />
        <Tool label="Move history" onClick={() => togglePanel('history')} active={panel === 'history'} icon={<History size={19} />} />
      </aside>

      <div className="scene-tools">
        <div className="turns-label">FACE TURNS</div>
        <div className="turns" aria-label="Turn a cube face">
          {FACES.map(face => <button type="button" disabled={locked} title={`Turn ${face}${suffix}`} key={face} onClick={() => cubeControls.turn(`${face}${suffix}`)}>{face}</button>)}
          <div className="turns-divider" />
          <button type="button" title="Prime (counterclockwise)" aria-label="Prime (counterclockwise)" aria-pressed={suffix === "'"} onClick={() => setSuffix(suffix === "'" ? '' : "'")}>′</button>
          <button type="button" title="Double (180 degrees)" aria-label="Double (180 degrees)" aria-pressed={suffix === '2'} onClick={() => setSuffix(suffix === '2' ? '' : '2')}>2</button>
        </div>
      </div>

      <FloatingWindow title="Python Editor" icon={<Code2 size={17} />} label="WORKSPACE" kind="python-window" open={editorOpen} foreground={foreground === 'editor'} onFocus={() => setForeground('editor')} onCollapse={() => setEditorOpen(false)}>
        <EditorPanel files={workspace.files} script={script} saved={saved} onAdd={addFile} onRemove={removeFile}
          onSelect={name => setWorkspace(previous => ({ ...previous, active: name }))}
          onChange={(name, source) => setWorkspace(previous => {
            if (previous.files.find(file => file.name === name)?.source === source) return previous
            return { ...previous, files: previous.files.map(file => file.name === name ? { name, source } : file) }
          })}
        />
      </FloatingWindow>

      {!editorOpen && <button className="reopen-editor" onClick={() => {
        setEditorOpen(true)
        setForeground('editor')
      }}><Code2 size={17} /> Python Editor <ArrowUpToLine size={14} /></button>}

      <FloatingWindow title="AI Mentor" icon={<Sparkles size={16} />} label="LEARNING" kind="mentor-window" open={mentorOpen} foreground={foreground === 'mentor'} onFocus={() => setForeground('mentor')} onCollapse={() => setMentorOpen(false)}>
        <Mentor script={script} />
      </FloatingWindow>

      {panel && <section className={`popover ${panel}-popover`} aria-label={panel === 'api' ? 'Python API reference' : 'Move history'}>
        <header>{panel === 'api' ? <BookOpen size={16} /> : <History size={16} />}
          <h2>{panel === 'api' ? 'Python API' : 'Move history'}</h2>
          <button type="button" className="icon-button" aria-label="Close panel" onClick={() => setPanel(undefined)}><X size={15} /></button>
        </header>
        {panel === 'api' ? <ApiReference /> : <MoveHistory />}
      </section>}

      <div className="toast-area" role="status">{notice && <div className="toast"><Check size={17} /> {notice}</div>}</div>
    </main>

    <footer className="statusbar">
      <div className="camera-hints"><span><Mouse size={15} /> Drag to orbit</span><i /><span>Scroll to zoom</span></div>
      <div className="cube-status">
        <span className="cube-size"><Box size={14} /> 3 × 3</span><i />
        <span><b>{count}</b> {count === 1 ? 'move' : 'moves'}</span><i />
        <span className={solved && !playing ? 'is-solved' : ''}><em />{playing ? 'Animating' : solved ? 'Solved' : 'Unsolved'}</span>
      </div>
    </footer>
  </div>
}

function MoveHistory() {
  const history = useLab(state => state.history)
  const scramble = useLab(state => state.scramble)
  const count = useLab(state => state.count)
  return <div className="popover-body">
    {scramble && <><h3>Last scramble</h3><p className="history-notation">{scramble}</p></>}
    <h3>{count > history.length ? 'Last 100 moves' : 'Applied moves'}</h3>
    {history.length ? <p className="history-notation">{history.join(' ')}</p> : <p>No moves yet.</p>}
  </div>
}

function ApiReference() {
  return <dl className="popover-body api-reference">
    <dt><code>move("R U R' U'")</code></dt><dd>Apply one or more turns. Use U, R, F, D, L, B and add an apostrophe (') or 2 for a prime or double turn.</dd>
    <dt><code>cube.get_state()</code></dt><dd>Return a dict with keys U, R, F, D, L, B. Each value is a nine-character string, read row by row while looking straight at that face. Letters identify sticker colors by their solved faces.</dd>
    <dt><code>cube.is_solved()</code></dt><dd>Return whether all stickers are on their solved faces.</dd>
    <dt><code>cube.reset()</code></dt><dd>Restore the solved state and clear move history.</dd>
    <dt><code>cube.scramble()</code></dt><dd>Apply 25 random legal turns and return their notation.</dd>
  </dl>
}
