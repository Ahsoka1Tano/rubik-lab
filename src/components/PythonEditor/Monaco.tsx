import { useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import 'monaco-editor/esm/vs/editor/editor.all.js'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker'
import type { Diagnostic } from '../../stores/lab'
import type { Script } from './files'

self.MonacoEnvironment = { getWorker: () => new EditorWorker() }

monaco.editor.defineTheme('rubik-lab', {
  base: 'vs-dark', inherit: true,
  rules: [
    { token: 'comment', foreground: '838D9E', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'C3A7F5' },
    { token: 'string', foreground: 'AADE93' },
    { token: 'number', foreground: 'ECC081' },
    { token: 'identifier', foreground: 'DADEE8' },
    { token: 'delimiter', foreground: 'A0A9B9' },
  ],
  colors: {
    'editor.background': '#15171D', 'editor.foreground': '#DADEE8',
    'editorLineNumber.foreground': '#697384', 'editorLineNumber.activeForeground': '#9AA7B9',
    'editor.lineHighlightBackground': '#1D2128', 'editor.selectionBackground': '#344437',
    'editorIndentGuide.background1': '#2B303B', 'editorIndentGuide.activeBackground1': '#434B58',
    'editorCursor.foreground': '#B1ED9A', 'editorError.foreground': '#F47782',
  },
})

export default function Monaco({ files, active, diagnostic, onChange }: {
  files: Script[]; active: string; diagnostic?: Diagnostic; onChange: (name: string, source: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const editor = useRef<monaco.editor.IStandaloneCodeEditor>(null)
  const models = useRef(new Map<string, monaco.editor.ITextModel>())
  const views = useRef(new Map<string, monaco.editor.ICodeEditorViewState | null>())
  const change = useRef(onChange)
  change.current = onChange

  useEffect(() => {
    const code = monaco.editor.create(host.current!, {
      theme: 'rubik-lab', automaticLayout: true, minimap: { enabled: false },
      fontFamily: '"JetBrains Mono", monospace', fontSize: 13, lineHeight: 24,
      tabSize: 4, insertSpaces: true, detectIndentation: false, wordWrap: 'on',
      padding: { top: 14, bottom: 12 }, scrollBeyondLastLine: false,
      renderLineHighlight: 'line', roundedSelection: true, lineNumbersMinChars: 3,
      glyphMargin: false, folding: true, ariaLabel: 'Python source editor',
    })
    editor.current = code
    const subscription = code.onDidChangeModelContent(() => {
      const model = code.getModel()
      if (model) change.current(model.uri.path.slice(1), model.getValue())
    })
    const liveModels = models.current
    return () => {
      subscription.dispose()
      code.dispose()
      liveModels.forEach(model => model.dispose())
      liveModels.clear()
      editor.current = null
    }
  }, [])

  useEffect(() => {
    const code = editor.current
    if (!code) return
    for (const file of files) {
      if (!models.current.has(file.name)) {
        const model = monaco.editor.createModel(file.source, 'python', monaco.Uri.file(`/${file.name}`))
        model.updateOptions({ tabSize: 4, insertSpaces: true })
        models.current.set(file.name, model)
      }
    }
    const previous = code.getModel()
    const next = models.current.get(active)
    if (next && next !== previous) {
      if (previous) views.current.set(previous.uri.path.slice(1), code.saveViewState())
      code.setModel(next)
      const view = views.current.get(active)
      if (view) code.restoreViewState(view)
    }
    for (const [name, model] of models.current) {
      const file = files.find(item => item.name === name)
      if (!file) {
        model.dispose()
        models.current.delete(name)
        views.current.delete(name)
        continue
      }
      const line = diagnostic?.filename === name && diagnostic.source === file.source ? diagnostic.line : undefined
      const markers: monaco.editor.IMarkerData[] = []
      if (line && line <= model.getLineCount()) {
        const max = model.getLineMaxColumn(line)
        const column = Math.max(1, Math.min(diagnostic?.column || model.getLineFirstNonWhitespaceColumn(line), max))
        markers.push({
          severity: monaco.MarkerSeverity.Error, message: diagnostic!.text,
          startLineNumber: line, startColumn: column, endLineNumber: line, endColumn: max,
        })
      }
      monaco.editor.setModelMarkers(model, 'rubik-python', markers)
    }
  }, [files, active, diagnostic])

  return <div className="monaco-host" ref={host} />
}
