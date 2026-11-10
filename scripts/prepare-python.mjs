import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const source = dirname(require.resolve('pyodide'))
const target = new URL('../public/pyodide/', import.meta.url)
await mkdir(target, { recursive: true })
const assets = (await readdir(source)).filter(name => /^(pyodide|python_stdlib)/.test(name) && /\.(mjs|js|wasm|zip|json)$/.test(name))
await Promise.all(assets.map(name => copyFile(join(source, name), new URL(name, target))))
