export type Script = { name: string; source: string }
type Workspace = { files: Script[]; active: string }
const key = 'rubik-lab.workspace.v1'

const example = `# Your cube, your rules.
# Try a four-move commutator.

sequence = ["R", "U", "R'", "U'"]
for action in sequence:
    move(action)

print("Solved?", cube.is_solved())
`

export function readWorkspace(): Workspace {
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? 'null') as Workspace | null
    if (data && Array.isArray(data.files) && data.files.length &&
      data.files.every(file => typeof file?.name === 'string' && typeof file.source === 'string') &&
      new Set(data.files.map(file => file.name)).size === data.files.length &&
      data.files.some(file => file.name === data.active)) return data
  } catch {
    // A fresh workspace is available when browser storage is disabled.
  }
  return { files: [{ name: 'main.py', source: example }], active: 'main.py' }
}

export function saveWorkspace(workspace: Workspace): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(workspace))
    return true
  } catch {
    return false
  }
}

export function newScript(files: Script[]): Script {
  let index = 1
  while (files.some(file => file.name === `experiment_${index}.py`)) index++
  return { name: `experiment_${index}.py`, source: '# Write a Python experiment.\n\n' }
}
