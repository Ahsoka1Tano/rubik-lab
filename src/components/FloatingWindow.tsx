import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Maximize2, Minimize2, Minus } from 'lucide-react'

type Bounds = { left: number; top: number; width: number; height: number }

export function FloatingWindow({ title, icon, label, kind, open, onCollapse, children }: {
  title: string; icon: ReactNode; label: string; kind: string; open: boolean
  onCollapse: () => void; children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const [bounds, setBounds] = useState<Bounds>()
  const [maximized, setMaximized] = useState(false)
  const drag = useRef<{ mode: 'move' | 'resize'; x: number; y: number; initial: Bounds }>(null)

  function fit(value: Bounds): Bounds {
    const parent = ref.current?.parentElement
    if (!parent) return value
    const width = Math.min(value.width, parent.clientWidth - 16)
    const height = Math.min(value.height, parent.clientHeight - 16)
    return {
      left: Math.max(8, Math.min(value.left, parent.clientWidth - width - 8)),
      top: Math.max(8, Math.min(value.top, parent.clientHeight - height - 8)),
      width, height,
    }
  }

  useEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent) return
    const observer = new ResizeObserver(() => setBounds(previous => previous && fit(previous)))
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  function begin(event: PointerEvent<HTMLElement>, mode: 'move' | 'resize') {
    if (event.button !== 0 || maximized || (event.target as Element).closest('button')) return
    event.preventDefault()
    const panel = ref.current!
    const rect = panel.getBoundingClientRect()
    const parent = panel.parentElement!.getBoundingClientRect()
    drag.current = {
      mode, x: event.clientX, y: event.clientY,
      initial: { left: rect.left - parent.left, top: rect.top - parent.top, width: rect.width, height: rect.height },
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function update(event: PointerEvent<HTMLElement>) {
    const gesture = drag.current
    if (!gesture) return
    const dx = event.clientX - gesture.x
    const dy = event.clientY - gesture.y
    const { initial } = gesture
    if (gesture.mode === 'move') {
      setBounds(fit({ ...initial, left: initial.left + dx, top: initial.top + dy }))
    } else {
      const parent = ref.current!.parentElement!
      const width = Math.min(Math.max(Math.min(300, initial.width), initial.width + dx), parent.clientWidth - initial.left - 8)
      const height = Math.min(Math.max(Math.min(290, initial.height), initial.height + dy), parent.clientHeight - initial.top - 8)
      setBounds(fit({ ...initial, width, height }))
    }
  }

  const clear = () => { drag.current = null }
  const gesture = { onPointerMove: update, onPointerUp: clear, onPointerCancel: clear, onLostPointerCapture: clear }
  return <section
    ref={ref} aria-label={title} hidden={!open}
    className={`floating-window ${kind} ${maximized ? 'maximized' : ''}`}
    style={maximized ? undefined : bounds}
  >
    <header className="window-titlebar" onPointerDown={event => begin(event, 'move')} {...gesture}>
      <span className="window-icon">{icon}</span>
      <h2>{title}</h2>
      <span className="window-label">{label}</span>
      <div className="window-actions">
        <button type="button" className="icon-button" title={`Collapse ${title}`} aria-label={`Collapse ${title}`} onClick={onCollapse}><Minus size={15} /></button>
        <button type="button" className="icon-button" title={maximized ? 'Restore window size' : 'Maximize window'} aria-label={maximized ? 'Restore window size' : 'Maximize window'} onClick={() => setMaximized(value => !value)}>
          {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
    </header>
    {children}
    {!maximized && <div className="window-resize" aria-hidden="true" onPointerDown={event => begin(event, 'resize')} {...gesture} />}
  </section>
}
