import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowUp, FileUp, Paperclip, Sparkles, X } from 'lucide-react'
import { cubeControls, useLab } from '../stores/lab'
import type { Script } from './PythonEditor/files'

type Message = { role: 'user' | 'assistant'; content: string }
type Lesson = { name: string; format: 'text' | 'json'; content: string }
const contextOptions = ['Source code', 'Latest error', 'Cube state', 'Move history'] as const
type Option = typeof contextOptions[number]
const endpoint = import.meta.env.VITE_MENTOR_ENDPOINT?.trim()
const configured = Boolean(endpoint?.startsWith('/') && !endpoint.startsWith('//') && !endpoint.includes('\\'))

export function Mentor({ script }: { script: Script }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [prompt, setPrompt] = useState('')
  const [selected, setSelected] = useState<Option[]>([])
  const [lesson, setLesson] = useState<Lesson>()
  const [includeLesson, setIncludeLesson] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function loadLesson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    try {
      if (file.size > 256 * 1024) throw new Error('Choose a lesson file under 256 KB.')
      const format = /\.json$/i.test(file.name) ? 'json' : 'text'
      const content = await file.text()
      if (format === 'json') JSON.parse(content)
      setLesson({ name: file.name, format, content })
      setIncludeLesson(false)
    } catch (failure) {
      setError(`Could not load lesson. ${(failure as Error).message}`)
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault()
    const content = prompt.trim()
    if (!configured || busy || !content) return
    const next: Message[] = [...messages, { role: 'user', content }]
    const context = {
      script: selected.includes('Source code') ? script : undefined,
      error: selected.includes('Latest error') ? useLab.getState().diagnostic?.text : undefined,
      cube: selected.includes('Cube state') ? cubeControls.snapshot() : undefined,
      moves: selected.includes('Move history') ? cubeControls.moveHistory() : undefined,
      lesson: includeLesson ? lesson : undefined,
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch(endpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, context }),
        redirect: 'error',
        signal: AbortSignal.timeout(45_000),
      })
      if (!response.ok) throw new Error(`Mentor request failed (HTTP ${response.status}).`)
      const data: { reply?: unknown } = await response.json()
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('The mentor returned an empty reply.')
      setMessages([...next, { role: 'assistant', content: data.reply }])
      setPrompt('')
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="mentor-body">
    <div className="mentor-scroll" aria-live="polite">
      {messages.length ? messages.map((message, index) => <div className={`chat-message ${message.role}`} key={index}>
        <strong>{message.role === 'user' ? 'You' : 'Mentor'}</strong>
        <p>{message.content}</p>
      </div>) : <div className="mentor-empty">
        <div className="mentor-orb"><Sparkles size={22} /></div>
        <h3>{configured ? 'What are you exploring?' : 'AI mentor is not connected'}</h3>
        <p>{configured ? 'Ask about a permutation, a commutator, or a Python error.' : 'Connect a mentor endpoint to discuss your cube and Python experiments.'}</p>
      </div>}
    </div>
    <details className="mentor-context">
      <summary><Paperclip size={14} /> Share workspace context</summary>
      <div className="context-options">
        {contextOptions.map(option => <label key={option}>
          <input type="checkbox" checked={selected.includes(option)} onChange={event =>
            setSelected(previous => event.target.checked ? [...previous, option] : previous.filter(value => value !== option))
          } />
          {option}
        </label>)}
      </div>
      <input ref={input} type="file" accept=".txt,.json,text/plain,application/json" hidden onChange={loadLesson} />
      {lesson ? <div className="lesson-file">
        <label><input type="checkbox" checked={includeLesson} onChange={event => setIncludeLesson(event.target.checked)} /> {lesson.name}</label>
        <button type="button" className="icon-button" aria-label="Remove lesson" onClick={() => setLesson(undefined)}><X size={14} /></button>
      </div> : <button type="button" className="text-button" onClick={() => input.current?.click()}><FileUp size={14} /> Load lesson (.txt or .json)</button>}
    </details>
    {error && <p className="mentor-error" role="alert">{error}</p>}
    <form className="mentor-input" onSubmit={send}>
      <input aria-label="Message for the mentor" placeholder={configured ? 'Ask a question…' : 'Mentor endpoint required'} value={prompt} disabled={!configured || busy} onChange={event => setPrompt(event.target.value)} />
      <button className="run-button" type="submit" aria-label="Send message" disabled={!configured || busy || !prompt.trim()}><ArrowUp size={16} /></button>
    </form>
  </div>
}
