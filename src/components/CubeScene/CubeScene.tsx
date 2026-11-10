import { useEffect, useRef, useState } from 'react'
import {
  AmbientLight, CanvasTexture, DirectionalLight, FogExp2, GridHelper, HemisphereLight,
  Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Scene, WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { Frame } from '../../core/timeline'
import { playback } from '../../stores/lab'
import { CubeRig } from './CubeRig'

function contactShadow() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.84)')
  gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.48)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const map = new CanvasTexture(canvas)
  const mesh = new Mesh(new PlaneGeometry(7.6, 7.6), new MeshBasicMaterial({ map, transparent: true, depthWrite: false, fog: false }))
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = -1.553
  return mesh
}

export default function CubeScene({ editorOpen, cameraReset }: { editorOpen: boolean; cameraReset: number }) {
  const element = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<OrbitControls>(null)
  const reframe = useRef<() => void>(null)
  const showEditor = useRef(editorOpen)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    showEditor.current = editorOpen
    reframe.current?.()
  }, [editorOpen])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    controls.enableDamping = false
    controls.update()
    controls.reset()
    controls.enableDamping = true
  }, [cameraReset])

  useEffect(() => {
    const host = element.current!
    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      setUnavailable(true)
      const timer = window.setInterval(() => {
        for (let frame = playback.take(); frame; frame = playback.take()) playback.finish(frame)
      }, 60)
      return () => window.clearInterval(timer)
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearAlpha(0)
    host.appendChild(renderer.domElement)
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D Rubik’s Cube. Drag to orbit and scroll to zoom.')
    renderer.domElement.setAttribute('role', 'img')

    const scene = new Scene()
    scene.fog = new FogExp2(0x171a20, 0.043)
    const camera = new PerspectiveCamera(38, 1, 0.1, 90)
    camera.position.set(5.55, 4.15, 7.15)
    const controls = new OrbitControls(camera, renderer.domElement)
    controlsRef.current = controls
    controls.enableDamping = true
    controls.dampingFactor = 0.11
    controls.enablePan = false
    controls.minDistance = 5.25
    controls.maxDistance = 19
    controls.rotateSpeed = 0.68
    controls.zoomSpeed = 0.77
    controls.update()
    controls.saveState()

    const rig = new CubeRig(playback.anchor)
    scene.add(rig.root)
    const grid = new GridHelper(64, 64, 0x353943, 0x30343e)
    grid.position.y = -1.56
    grid.material.transparent = true
    grid.material.opacity = 0.38
    grid.material.depthWrite = false
    const shadow = contactShadow()
    shadow.renderOrder = 1
    scene.add(grid, shadow)
    scene.add(new HemisphereLight(0xffffff, 0x9c9cad, 1.82), new AmbientLight(0xc8d4ea, 0.28))
    const key = new DirectionalLight(0xffffff, 1.85)
    key.position.set(-3, 8, 5)
    const fill = new DirectionalLight(0xf8eeff, 0.74)
    fill.position.set(6, 2, -4)
    scene.add(key, fill)

    let needsRender = true
    const markDirty = () => { needsRender = true }
    controls.addEventListener('change', markDirty)
    const resize = () => {
      const { clientWidth: width, clientHeight: height } = host
      if (!width || !height) return
      renderer.setSize(width, height, false)
      const narrow = width <= 760
      const editorWidth = showEditor.current && !narrow ? Math.min(480, Math.max(350, width * 0.355)) : 0
      const x = editorWidth * 0.51
      const y = showEditor.current && narrow ? height * 0.265 : 0
      const baseFov = narrow && showEditor.current ? 70 : 38
      const sceneWidth = width - editorWidth
      const scale = Math.min(1, 0.74 * sceneWidth / (0.64 * height))
      camera.fov = 360 / Math.PI * Math.atan(Math.tan(baseFov * Math.PI / 360) / scale)
      camera.setViewOffset(width, height, x, y, width, height)
      camera.updateProjectionMatrix()
      markDirty()
    }
    reframe.current = resize
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    let animation: Frame | undefined
    let progress = 0
    let revision = playback.revision
    let last = performance.now()
    renderer.setAnimationLoop(now => {
      const delta = Math.max(0, Math.min(64, now - last))
      last = now
      if (revision !== playback.revision) {
        revision = playback.revision
        animation = undefined
        rig.sync(playback.anchor)
        markDirty()
      }
      if (!animation) {
        animation = playback.take()
        progress = 0
        if (animation?.move) rig.begin(animation.before, animation.move)
      }
      if (animation) {
        markDirty()
        const duration = animation.move?.endsWith('2') ? 245 : 170
        progress = animation.move ? Math.min(1, progress + delta * playback.speed / duration) : 1
        rig.pose(progress * progress * (3 - 2 * progress))
        if (progress === 1) {
          rig.sync(animation.after)
          playback.finish(animation)
          animation = undefined
        }
      }
      controls.update()
      if (needsRender) {
        renderer.render(scene, camera)
        needsRender = false
      }
    })

    return () => {
      renderer.setAnimationLoop(null)
      observer.disconnect()
      controls.removeEventListener('change', markDirty)
      controls.dispose()
      rig.dispose()
      grid.geometry.dispose()
      grid.material.dispose()
      shadow.geometry.dispose()
      shadow.material.map?.dispose()
      shadow.material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      controlsRef.current = null
      reframe.current = null
    }
  }, [])

  return <div className="cube-scene" ref={element}>
    {unavailable && <div className="scene-error">WebGL could not start. The Python workspace and cube state are still available.</div>}
  </div>
}
