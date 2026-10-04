import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { Floor } from './Floor'
import { ObjectPlacer } from './ObjectPlacer'
import { isGizmoInteracting } from './EditableObject'
import { useEditorStore, snapToGrid } from '../../store/editorStore'
import { Person } from './Person'
import * as THREE from 'three'
let suppressMissClear = false

// Camera controller that handles 2D / 3D mode switching smoothly without FOV warping
const CameraController: React.FC<{ viewMode: '3D' | '2D' | 'FPV' }> = ({ viewMode }) => {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)
  const isTransforming = useEditorStore(state => state.isTransforming)
  const modeRef = useRef(viewMode)

  const flyKeys = useRef({ f: false, b: false, l: false, r: false, fast: false })

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = !isTransforming && viewMode !== 'FPV'
    }
  }, [isTransforming, viewMode])

  useEffect(() => {
    const typing = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null
      return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'))
    }
    const setKey = (code: string, down: boolean) => {
      const keys = flyKeys.current
      if (code === 'KeyW') keys.f = down
      if (code === 'KeyS') keys.b = down
      if (code === 'KeyA') keys.l = down
      if (code === 'KeyD') keys.r = down
      if (code === 'ShiftLeft' || code === 'ShiftRight') keys.fast = down
    }
    const onDown = (event: KeyboardEvent) => {
      if (typing(event) || useEditorStore.getState().person.isFPV) return
      setKey(event.code, true)
    }
    const onUp = (event: KeyboardEvent) => setKey(event.code, false)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  useFrame((_, delta) => {
    if (viewMode === 'FPV') return
    const keys = flyKeys.current
    if (!keys.f && !keys.b && !keys.l && !keys.r) return
    const controls = controlsRef.current
    const speed = (keys.fast ? 16 : 7) * Math.min(delta, 0.05)
    const forward = new THREE.Vector3()
    const right = new THREE.Vector3()
    if (viewMode === '2D') {
      forward.set(0, 0, -1)
      right.set(1, 0, 0)
    } else {
      camera.getWorldDirection(forward)
      right.setFromMatrixColumn(camera.matrixWorld, 0)
      forward.y = 0
      right.y = 0
      if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1)
      forward.normalize()
      right.normalize()
    }
    const move = new THREE.Vector3()
    if (keys.f) move.add(forward)
    if (keys.b) move.sub(forward)
    if (keys.r) move.add(right)
    if (keys.l) move.sub(right)
    if (move.lengthSq() < 1e-6) return
    move.normalize().multiplyScalar(speed)
    camera.position.add(move)
    if (controls?.target) {
      controls.target.add(move)
      controls.update()
    }
  })

  useEffect(() => {
    const previous = modeRef.current
    if (previous === viewMode) return
    modeRef.current = viewMode
    const controls = controlsRef.current
    const target = controls?.target?.clone() ?? new THREE.Vector3(0, 1, 0)

    if (viewMode === '2D') {
      camera.position.set(target.x, 16, target.z + 0.001)
      camera.lookAt(target.x, 0, target.z)
      if (controls) {
        controls.target.set(target.x, 0, target.z)
        controls.enableRotate = false
        controls.update()
      }
    } else if (viewMode === '3D') {
      if (previous === '2D' || previous === 'FPV') {
        camera.position.set(target.x + 7, 7, target.z + 7)
        controls?.target.set(target.x, 1, target.z)
      }
      if (controls) {
        controls.enableRotate = true
        controls.update()
      }
    }
  }, [viewMode, camera])

  if (viewMode === 'FPV') return null

  return (
    <OrbitControls 
      ref={controlsRef}
      makeDefault 
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: null as any
      }}
      enableZoom
      maxPolarAngle={viewMode === '2D' ? 0.01 : Math.PI / 2 - 0.05}
      minDistance={1}
      maxDistance={250}
    />
  )
}

// Right-Click Marquee Box Selection with 3D Oriented Bounding Box tests
const MarqueeSelection: React.FC<{ onRect: (rect: { left: number; top: number; width: number; height: number } | null) => void }> = ({ onRect }) => {
  const { selectObjects, objects } = useEditorStore()
  const { camera, gl, scene } = useThree()
  
  const [isSelecting, setIsSelecting] = useState(false)
  const [boxCoords, setBoxCoords] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  
  const isTrackingRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const multiRef = useRef(false)

  // Keep latest objects in ref so we don't re-create event listeners on object changes
  const objectsRef = useRef(objects)
  objectsRef.current = objects

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 2 || isGizmoInteracting()) return
      const rect = gl.domElement.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(scene.children, true)
      const blocked = intersects.some(hit => {
        let cur: any = hit.object
        while (cur) {
          if (cur.userData?.isSelectableObject) return true
          if (typeof cur.type === 'string' && cur.type.toLowerCase().includes('transformcontrols')) return true
          cur = cur.parent
        }
        return false
      })
      if (blocked) return

      isTrackingRef.current = true
      startPosRef.current = { x: e.clientX, y: e.clientY }
      multiRef.current = Boolean(e.ctrlKey || e.metaKey || e.shiftKey)
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (!isTrackingRef.current) return
      const startX = startPosRef.current.x
      const startY = startPosRef.current.y
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY)

      if (dist > 8) {
        setIsSelecting(true)
        setBoxCoords({
          startX,
          startY,
          currentX: e.clientX,
          currentY: e.clientY
        })
      }
    }

    const handlePointerUp = (e: PointerEvent) => {
      if (!isTrackingRef.current) {
        setIsSelecting(false)
        setBoxCoords(null)
        return
      }

      isTrackingRef.current = false
      setIsSelecting(false)

      const startX = startPosRef.current.x
      const startY = startPosRef.current.y
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY)
      setBoxCoords(null)

      const rect = gl.domElement.getBoundingClientRect()

      if (dist > 8) {
        // Marquee box selection performed
        const minX = Math.min(startX, e.clientX)
        const maxX = Math.max(startX, e.clientX)
        const minY = Math.min(startY, e.clientY)
        const maxY = Math.max(startY, e.clientY)

        const selectedIds = new Set<string>()

        objectsRef.current.forEach(obj => {
          // 1. Center check
          const center = new THREE.Vector3(...obj.position)
          center.project(camera)
          if (center.z >= -1 && center.z <= 1) {
            const screenX = (center.x * 0.5 + 0.5) * rect.width + rect.left
            const screenY = (-(center.y * 0.5) + 0.5) * rect.height + rect.top
            if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
              selectedIds.add(obj.id)
              return
            }
          }

          // 2. 8-corner oriented bounding box check
          const halfX = (obj.scale[0] || 1) / 2
          const halfY = (obj.scale[1] || 1) / 2
          const halfZ = (obj.scale[2] || 1) / 2

          const euler = new THREE.Euler(...obj.rotation)
          const localCorners = [
            new THREE.Vector3(-halfX, -halfY, -halfZ),
            new THREE.Vector3(halfX, -halfY, -halfZ),
            new THREE.Vector3(-halfX, halfY, -halfZ),
            new THREE.Vector3(halfX, halfY, -halfZ),
            new THREE.Vector3(-halfX, -halfY, halfZ),
            new THREE.Vector3(halfX, -halfY, halfZ),
            new THREE.Vector3(-halfX, halfY, halfZ),
            new THREE.Vector3(halfX, halfY, halfZ),
          ]

          let objMinX = Infinity
          let objMaxX = -Infinity
          let objMinY = Infinity
          let objMaxY = -Infinity
          let hasFrontCorner = false

          for (const corner of localCorners) {
            corner.applyEuler(euler).add(new THREE.Vector3(...obj.position))
            corner.project(camera)
            if (corner.z >= -1 && corner.z <= 1) {
              hasFrontCorner = true
              const sx = (corner.x * 0.5 + 0.5) * rect.width + rect.left
              const sy = (-(corner.y * 0.5) + 0.5) * rect.height + rect.top
              objMinX = Math.min(objMinX, sx)
              objMaxX = Math.max(objMaxX, sx)
              objMinY = Math.min(objMinY, sy)
              objMaxY = Math.max(objMaxY, sy)
            }
          }

          if (hasFrontCorner) {
            const overlaps = !(objMaxX < minX || objMinX > maxX || objMaxY < minY || objMinY > maxY)
            if (overlaps) {
              selectedIds.add(obj.id)
            }
          }
        })

        const multi = Boolean(e.ctrlKey || e.metaKey || e.shiftKey || multiRef.current)
        selectObjects(Array.from(selectedIds), multi ? 'add' : 'set')
        suppressMissClear = true
      } else if (e.button === 2) {
        selectObjects([])
      }
      onRect(null)
    }

    const handleCancel = () => {
      isTrackingRef.current = false
      setIsSelecting(false)
      setBoxCoords(null)
    }

    const dom = gl.domElement
    dom.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('mouseup', handlePointerUp as any)
    window.addEventListener('pointercancel', handleCancel)
    window.addEventListener('blur', handleCancel)
    
    const handleContextMenu = (e: Event) => e.preventDefault()
    dom.addEventListener('contextmenu', handleContextMenu)

    return () => {
      dom.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('mouseup', handlePointerUp as any)
      window.removeEventListener('pointercancel', handleCancel)
      window.removeEventListener('blur', handleCancel)
      dom.removeEventListener('contextmenu', handleContextMenu)
      handleCancel()
    }
  }, [camera, gl, scene, selectObjects, onRect])

  useEffect(() => {
    if (!isSelecting || !boxCoords) {
      onRect(null)
      return
    }
    const rect = gl.domElement.getBoundingClientRect()
    onRect({
      left: Math.min(boxCoords.startX, boxCoords.currentX) - rect.left,
      top: Math.min(boxCoords.startY, boxCoords.currentY) - rect.top,
      width: Math.abs(boxCoords.currentX - boxCoords.startX),
      height: Math.abs(boxCoords.currentY - boxCoords.startY)
    })
  }, [isSelecting, boxCoords, gl, onRect])

  return null
}

// Global Keyboard Shortcuts (Delete key, Undo/Redo, W/E/R)
const KeyboardShortcutsManager: React.FC = () => {
  const { selectedObjectIds, removeObjects, undo, redo, setTransformMode } = useEditorStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toUpperCase()
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Backspace') return

      const fpv = useEditorStore.getState().person.isFPV
      const key = e.key.toLowerCase()
      if (!e.ctrlKey && !e.metaKey && ['w', 'a', 's', 'd'].includes(key)) return
      if (fpv && !e.ctrlKey && !e.metaKey && ['e', 'r'].includes(key)) return

      if (e.key === 'Delete') {
        if (selectedObjectIds.length > 0) {
          e.preventDefault()
          removeObjects(selectedObjectIds)
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (e.key.toLowerCase() === 'e') {
        setTransformMode('rotate')
      } else if (e.key.toLowerCase() === 'r') {
        setTransformMode('scale')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedObjectIds, removeObjects, undo, redo, setTransformMode])

  return null
}

// Drag & Drop onto Floor with Grid Snapping
const DragDropManager: React.FC = () => {
  const { addObject, snap } = useEditorStore()
  const { camera, gl } = useThree()

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer!.dropEffect = 'copy'
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer?.getData('type')
      if (!type) return

      const rect = gl.domElement.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
      
      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const intersectPoint = new THREE.Vector3()
      
      if (raycaster.ray.intersectPlane(floorPlane, intersectPoint)) {
        const posX = snap ? snapToGrid(intersectPoint.x) : intersectPoint.x
        const posZ = snap ? snapToGrid(intersectPoint.z) : intersectPoint.z
        
        // Spawn with snapped X & Z. Y will automatically be set according to the item config!
        addObject(type as any, [posX, undefined as any, posZ])
      }
    }

    const dom = gl.domElement
    dom.addEventListener('dragover', handleDragOver)
    dom.addEventListener('drop', handleDrop)

    return () => {
      dom.removeEventListener('dragover', handleDragOver)
      dom.removeEventListener('drop', handleDrop)
    }
  }, [camera, gl, addObject, snap])

  return null
}

export const RoomScene: React.FC = () => {
  const { viewMode } = useEditorStore()
  const snapStep = useEditorStore(state => state.snapStep)
  const [marquee, setMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

  const handlePointerMissed = () => {
    if (isGizmoInteracting() || suppressMissClear) {
      suppressMissClear = false
    }
  }

  return (
    <div className={`w-full h-full relative overflow-hidden select-none ${viewMode === '2D' ? 'bg-[#f8fafc]' : 'bg-[#38bdf8]'}`}>
      <Canvas 
        camera={{ position: [7, 7, 7], fov: 48, near: 0.5, far: 800 }} 
        gl={{ toneMapping: THREE.LinearToneMapping, antialias: true }}
        onPointerMissed={handlePointerMissed}
        shadows
      >
        {/* Pure vivid blue sky in 3D, architectural blueprint white in 2D - zero haze/fog */}
        <color attach="background" args={[viewMode === '2D' ? '#f8fafc' : '#38bdf8']} />

        {/* Clean architectural grid: exact 100x100m scene, 0.5m cells, 2.0m sections, distinct gray lines */}
        <Grid 
          infiniteGrid={false}
          args={[100, 100]}
          cellSize={snapStep}
          sectionSize={snapStep > 0.5 ? snapStep * 4 : 2.0}
          sectionColor="#64748b" 
          cellColor="#94a3b8" 
          fadeDistance={250}
          fadeStrength={1}
          position={[0, 0.002, 0]} 
        />
        
        {/* Crisp, radiant pure-white lighting for snow-white mockup surfaces without muddy shadows */}
        <ambientLight intensity={1.5} color="#ffffff" />
        <directionalLight 
          position={[16, 24, 16]} 
          intensity={1.0} 
          castShadow 
          shadow-mapSize-width={2048} 
          shadow-mapSize-height={2048} 
          shadow-bias={-0.0001}
        />
        <directionalLight 
          position={[-16, 20, -16]} 
          intensity={0.7} 
          color="#ffffff" 
        />
        <directionalLight 
          position={[-12, 16, 16]} 
          intensity={0.5} 
          color="#ffffff" 
        />
        <hemisphereLight groundColor="#e2e8f0" color="#ffffff" intensity={0.7} />

        {/* Camera Controller (2D Plan / 3D Perspective) */}
        <CameraController viewMode={viewMode} />

        {/* Floor Plane for raycast intersection and visual bounds */}
        <Floor />
        
        {/* Objects */}
        <ObjectPlacer />

        {/* 2D FPV Character */}
        <Person />

        {/* Marquee Box Selection */}
        <MarqueeSelection onRect={setMarquee} />
        
        {/* Drag and Drop Manager */}
        <DragDropManager />

        {/* Keyboard Shortcuts */}
        <KeyboardShortcutsManager />
      </Canvas>
      {marquee && (
        <div
          style={{
            position: 'absolute',
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height,
            backgroundColor: 'rgba(59, 130, 246, 0.16)',
            border: '1.5px dashed rgba(37, 99, 235, 0.9)',
            borderRadius: '4px',
            pointerEvents: 'none',
            zIndex: 5
          }}
        />
      )}
    </div>
  )
}
