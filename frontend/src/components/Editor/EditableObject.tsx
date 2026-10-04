import React, { useRef, useEffect, useState } from 'react'
import { TransformControls, Edges } from '@react-three/drei'
import { useEditorStore, snapToGrid, snapFootprint, getMinY } from '../../store/editorStore'
import { magnetOffset, restingY, restsOnSurfaces, wallSupportY } from '../../store/storeys'
import type { PlacedObject } from '../../store/editorStore'
import { isOpeningType, isWallType } from '../../store/wallMath'
import { CutVolume } from './Objects/ArchitecturalMeshes'
import * as THREE from 'three'

interface EditableObjectProps {
  obj: PlacedObject
  isGhost?: boolean
  children: React.ReactNode
}

let activeTransformControls: any = null

// Global map to access 3D Groups of objects for real-time synchronized movement
export const objectGroupRefs = new Map<string, THREE.Group>()

// Wall handles share the canvas with the TransformControls gizmo (whose centre sits on the wall
// centre, right under the face handle in the 2D plan). While a handle drags, the gizmo must not.
const suspendGizmo = () => {
  if (activeTransformControls) activeTransformControls.enabled = false
}
const resumeGizmo = () => {
  if (activeTransformControls) activeTransformControls.enabled = true
}

export const getActiveTransformControls = () => activeTransformControls

export const isGizmoInteracting = (): boolean => {
  if (useEditorStore.getState().isTransforming) return true
  if ((window as any).__isTransforming) return true
  if (activeTransformControls) {
    if (activeTransformControls.dragging) return true
    if (activeTransformControls.axis !== null && activeTransformControls.axis !== undefined) return true
  }
  return false
}

export const EditableObject: React.FC<EditableObjectProps> = ({ obj, isGhost, children }) => {
  const { 
    selectedObjectIds, 
    selectObjects, 
    transformMode, 
    snap, 
    updateObjectTransform,
    setIsTransforming,
    snapAndJoinWalls,
    snapOpening,
    beginGesture,
    endGesture
  } = useEditorStore()
  const fpv = useEditorStore(state => state.person.isFPV)
  
  const groupRef = useRef<THREE.Group>(null)
  const transformRef = useRef<any>(null)
  const dragInitialRef = useRef<{
    posX: number
    posY: number
    posZ: number
    rotY: number
    structural: boolean
    scaleSigns: [number, number, number] | null
    siblings: Array<{ id: string; relX: number; relY: number; relZ: number; relRotY: number }>
  } | null>(null)
  
  // Register 3D group ref for real-time multi-object synchronization
  useEffect(() => {
    if (groupRef.current) {
      objectGroupRefs.set(obj.id, groupRef.current)
    }
    return () => {
      objectGroupRefs.delete(obj.id)
    }
  }, [obj.id])

  const isSelected = selectedObjectIds.includes(obj.id)
  const isPrimarySelected = selectedObjectIds[0] === obj.id
  const isWall = obj.type === 'wall' || obj.type === 'partition'
  const isOpening = isOpeningType(obj.type)

  // Apply ghost transparency to all materials in this object
  useEffect(() => {
    if (groupRef.current) {
      // Need a small timeout to let children mount their materials first
      setTimeout(() => {
        if (groupRef.current) {
          groupRef.current.traverse((child: any) => {
            if ((child.isMesh || child.isLine) && child.material) {
              const applyGhost = (m: any) => {
                if (m._originalOpacity === undefined) {
                  m._originalOpacity = m.opacity
                  m._originalDepthWrite = m.depthWrite
                  m._originalTransparent = m.transparent
                }
                m.transparent = isGhost ? true : m._originalTransparent
                // Proportional, so invisible pick boxes stay invisible on other storeys.
                m.opacity = isGhost ? m._originalOpacity * 0.2 : m._originalOpacity
                m.depthWrite = isGhost ? false : m._originalDepthWrite
                m.needsUpdate = true
              }
              if (Array.isArray(child.material)) {
                child.material.forEach(applyGhost)
              } else {
                applyGhost(child.material)
              }
            }
          })
        }
      }, 0)
    }
  }, [isGhost, children])

  // Register active controls globally
  useEffect(() => {
    if (!isPrimarySelected) return

    const controls = transformRef.current
    if (!controls) return

    activeTransformControls = controls

    const handleDraggingChanged = (event: any) => {
      const isDragging = Boolean(event.value)
      ;(window as any).__isTransforming = isDragging
      setIsTransforming(isDragging)

      if (isDragging && groupRef.current) {
        beginGesture()
        const curPos = groupRef.current.position
        const curRot = groupRef.current.rotation
        const allObjects = useEditorStore.getState().objects

        // Find all sibling objects in the same group or multi-selection
        const siblingIds = obj.groupId 
          ? allObjects.filter(o => o.groupId === obj.groupId && o.id !== obj.id).map(o => o.id)
          : selectedObjectIds.filter(id => id !== obj.id)

        const siblings = siblingIds.map(sid => {
          const sObj = allObjects.find(o => o.id === sid)
          if (!sObj) return null
          return {
            id: sid,
            relX: sObj.position[0] - obj.position[0],
            relY: sObj.position[1] - obj.position[1],
            relZ: sObj.position[2] - obj.position[2],
            relRotY: sObj.rotation[1] - obj.rotation[1]
          }
        }).filter(Boolean) as Array<{ id: string; relX: number; relY: number; relZ: number; relRotY: number }>

        const structural = isWallType(obj.type) || siblings.some(s => {
          const sObj = allObjects.find(o => o.id === s.id)
          return Boolean(sObj && isWallType(sObj.type))
        })

        // Scale grows from the grabbed side only: remember which side of each axis the handle was on.
        let scaleSigns: [number, number, number] | null = null
        if (useEditorStore.getState().transformMode === 'scale') {
          const axis: string = controls.axis || ''
          const local = controls.pointStart
            ? controls.pointStart.clone().applyQuaternion(groupRef.current.quaternion.clone().invert())
            : new THREE.Vector3()
          scaleSigns = axis === 'XYZ'
            ? [0, 1, 0]
            : [
                axis.includes('X') ? Math.sign(local.x) : 0,
                axis.includes('Y') ? (Math.sign(local.y) || 1) : 0,
                axis.includes('Z') ? Math.sign(local.z) : 0,
              ]
        }

        dragInitialRef.current = {
          posX: curPos.x,
          posY: curPos.y,
          posZ: curPos.z,
          rotY: curRot.y,
          structural,
          scaleSigns,
          siblings
        }
      } else if (!isDragging) {
        dragInitialRef.current = null
      }
    }

    const handleMouseDown = () => {
      ;(window as any).__isTransforming = true
      setIsTransforming(true)
    }

    const handleMouseUpLocal = () => {
      ;(window as any).__isTransforming = false
      setIsTransforming(false)
      dragInitialRef.current = null
    }

    controls.addEventListener('dragging-changed', handleDraggingChanged)
    controls.addEventListener('mouseDown', handleMouseDown)
    controls.addEventListener('mouseUp', handleMouseUpLocal)

    return () => {
      controls.removeEventListener('dragging-changed', handleDraggingChanged)
      controls.removeEventListener('mouseDown', handleMouseDown)
      controls.removeEventListener('mouseUp', handleMouseUpLocal)
      if (activeTransformControls === controls) {
        activeTransformControls = null
      }
      ;(window as any).__isTransforming = false
      setIsTransforming(false)
      endGesture()
      dragInitialRef.current = null
    }
  }, [isPrimarySelected, transformMode, setIsTransforming, obj.groupId, obj.position, obj.rotation, selectedObjectIds, beginGesture, endGesture])

  const handlePointerDown = (e: any) => {
    // Left click selects; right button is reserved for the marquee in RoomScene.
    if (e.button !== 0) return
    // If clicking on or dragging any TransformControls gizmo arrow, DO NOT deselect or switch object!
    if (isGizmoInteracting()) return

    e.stopPropagation()
    const isMultiKey = Boolean(e.nativeEvent?.ctrlKey || e.nativeEvent?.metaKey || e.nativeEvent?.shiftKey)
    selectObjects([obj.id], isMultiKey ? 'toggle' : 'set')
  }

  // Real-time clamping during drag and 60fps synchronous group sibling transformation
  const handleTransformChange = () => {
    if (groupRef.current) {
      const g = groupRef.current
      const init = dragInitialRef.current
      const objects = useEditorStore.getState().objects

      if (transformMode === 'scale') {
        if (!init?.scaleSigns) return
        const step = useEditorStore.getState().snapStep
        const sizes = [0, 1, 2].map(i => {
          const orig = obj.scale[i]
          let size = orig * Math.abs(g.scale.getComponent(i))
          if (snap && Math.abs(size - orig) > 0.0001) size = orig + Math.round((size - orig) / step) * step
          size = Math.max(0.05, size)
          g.scale.setComponent(i, size / orig)
          return size
        })
        // Shift the centre by half the growth towards the grabbed side, so the opposite side stays put.
        const shift = new THREE.Vector3(
          init.scaleSigns[0] * (sizes[0] - obj.scale[0]) / 2,
          init.scaleSigns[1] * (sizes[1] - obj.scale[1]) / 2,
          init.scaleSigns[2] * (sizes[2] - obj.scale[2]) / 2,
        ).applyQuaternion(g.quaternion)
        g.position.set(init.posX + shift.x, init.posY + shift.y, init.posZ + shift.z)
        if (restsOnSurfaces(obj.type)) {
          g.position.y = restingY(objects, obj, [g.position.x, g.position.y, g.position.z], sizes[1])
        }
        return
      }

      if (transformMode === 'translate') {
        if (snap) {
          const step = useEditorStore.getState().snapStep
          const [sx, sz] = snapFootprint(g.position.x, g.position.z, g.rotation.y, obj.scale[0], obj.scale[2], step)
          g.position.x = sx
          g.position.z = sz
        }
        // Walls stick end to end, slabs edge to edge; pulling further breaks free.
        const magnet = magnetOffset(objects, obj, g.position.x, g.position.z, g.rotation.y)
        g.position.x += magnet.dx
        g.position.z += magnet.dz
      }

      if (isWall) {
        const support = wallSupportY(objects, { ...obj, position: [g.position.x, g.position.y, g.position.z] })
        if (g.position.y - obj.scale[1] / 2 < support) g.position.y = support + obj.scale[1] / 2
      } else {
        const minY = getMinY(obj.type, obj.scale[1])
        if (g.position.y < minY) g.position.y = minY
        if (init?.structural && !isOpening) {
          g.position.y = init.posY
        } else if (restsOnSurfaces(obj.type)) {
          g.position.y = restingY(objects, obj, [g.position.x, g.position.y, g.position.z], obj.scale[1])
        }
      }

      // Synchronize all siblings in real time!
      if (dragInitialRef.current && dragInitialRef.current.siblings.length > 0) {
        const curX = groupRef.current.position.x
        const curY = groupRef.current.position.y
        const curZ = groupRef.current.position.z
        const curRotY = groupRef.current.rotation.y

        const dRotY = curRotY - dragInitialRef.current.rotY
        const cosA = Math.cos(dRotY)
        const sinA = Math.sin(dRotY)

        dragInitialRef.current.siblings.forEach(sib => {
          const sibGroup = objectGroupRefs.get(sib.id)
          if (sibGroup) {
            const rotRelX = sib.relX * cosA - sib.relZ * sinA
            const rotRelZ = sib.relX * sinA + sib.relZ * cosA
            const sibY = dragInitialRef.current!.structural
              ? dragInitialRef.current!.posY + sib.relY
              : curY + sib.relY
            sibGroup.position.set(curX + rotRelX, sibY, curZ + rotRelZ)
            sibGroup.rotation.y = curRotY + sib.relRotY
          }
        })
      }
    }
  }

  const handleMouseUp = () => {
    if (groupRef.current) {
      const obj3d = groupRef.current

      // Handle interactive scale mode
      if (transformMode === 'scale') {
        const sx = Math.abs(obj3d.scale.x)
        const sy = Math.abs(obj3d.scale.y)
        const sz = Math.abs(obj3d.scale.z)

        // Never flip, never collapse; the bound stays under the 4 cm floor thickness.
        const newScale: [number, number, number] = [
          Math.max(0.01, Math.round(obj.scale[0] * sx * 100) / 100),
          Math.max(0.01, Math.round(obj.scale[1] * sy * 100) / 100),
          Math.max(0.01, Math.round(obj.scale[2] * sz * 100) / 100)
        ]

        // Reset group local scale back to [1, 1, 1]
        obj3d.scale.set(1, 1, 1)

        const newY = Math.max(getMinY(obj.type, newScale[1]), obj3d.position.y)

        updateObjectTransform(
          obj.id,
          [obj3d.position.x, newY, obj3d.position.z],
          [obj3d.rotation.x, obj3d.rotation.y, obj3d.rotation.z],
          newScale
        )
        endGesture()
        return
      }

      // Translate / rotate: the gizmo already applied grid snap and magnets during the drag.
      const newX = obj3d.position.x
      let newY = obj3d.position.y
      const newZ = obj3d.position.z

      if (isWall) {
        const support = wallSupportY(useEditorStore.getState().objects, { ...obj, position: [newX, newY, newZ] })
        if (newY - obj.scale[1] / 2 < support) newY = support + obj.scale[1] / 2
      } else {
        const minY = getMinY(obj.type, obj.scale[1])
        newY = Math.max(minY, newY)
      }

      // Sync position back to Three.js group
      obj3d.position.set(newX, newY, newZ)

      updateObjectTransform(
        obj.id,
        [newX, newY, newZ],
        [obj3d.rotation.x, obj3d.rotation.y, obj3d.rotation.z],
        [obj.scale[0], obj.scale[1], obj.scale[2]]
      )

      if (isOpening) snapOpening(obj.id)
      if (isWall) snapAndJoinWalls(obj.id)
      endGesture()
      dragInitialRef.current = null
    }
  }

  return (
    <>
      {/* Group holding the object meshes. Note: NO scale={obj.scale} here to prevent double-scaling! */}
      <group 
        ref={groupRef}
        position={obj.position} 
        rotation={new THREE.Euler(...obj.rotation)} 
        userData={{ isSelectableObject: true, objectId: obj.id }}
        onPointerDown={isGhost ? undefined : handlePointerDown}
      >
        {isWall || isOpening || obj.type === 'floor' || obj.type === 'block' ? children : (
          <CutVolume obj={obj}>{children}</CutVolume>
        )}

        {/* Visual outline indicator for selected objects in multi-selection */}
        {isSelected && !isPrimarySelected && (
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...obj.scale)]} />
            <lineBasicMaterial color="#3b82f6" />
          </lineSegments>
        )}

        {isPrimarySelected && !isGhost && <FaceHandles obj={obj} />}

      </group>

      {/* TransformControls with proper ref and dragging protection */}
      {isPrimarySelected && transformMode !== 'scale' && (
        <TransformControls 
          ref={transformRef}
          object={groupRef as any}
          mode={transformMode}
          translationSnap={null}
          rotationSnap={snap ? Math.PI / 4 : null}
          size={fpv ? 1.15 : 0.65}
          onChange={handleTransformChange}
          onMouseUp={handleMouseUp}
        />
      )}

    </>
  )
}

const FACE_LIST: { axis: 0 | 1 | 2; sign: 1 | -1 }[] = [
  { axis: 0, sign: 1 },
  { axis: 0, sign: -1 },
  { axis: 1, sign: 1 },
  { axis: 1, sign: -1 },
  { axis: 2, sign: 1 },
  { axis: 2, sign: -1 },
]

/** The same six face handles on every object: each one grows only the side you pull. */
const FaceHandles: React.FC<{ obj: PlacedObject }> = ({ obj }) => (
  <>
    {FACE_LIST.map(face => (
      <FaceHandle key={`${face.axis}:${face.sign}`} obj={obj} axis={face.axis} sign={face.sign} />
    ))}
  </>
)

type FaceSession = {
  id: string
  axis: 0 | 1 | 2
  sign: 1 | -1
  plane: THREE.Plane
  hit: THREE.Vector3
  anchor: THREE.Vector3
  worldAxis: THREE.Vector3
  size: number
  scale: [number, number, number]
  pos: THREE.Vector3
  rot: [number, number, number]
}

let faceSession: FaceSession | null = null

const facePlane = (axis: 0 | 1 | 2, center: THREE.Vector3, ray: THREE.Ray) => {
  if (axis === 1) {
    const camDir = ray.direction.clone()
    camDir.y = 0
    if (camDir.lengthSq() < 1e-6) camDir.set(0, 0, 1)
    return new THREE.Plane().setFromNormalAndCoplanarPoint(camDir.normalize(), center)
  }
  return new THREE.Plane(new THREE.Vector3(0, 1, 0), -center.y)
}

export const fpvBeginFace = (objectId: string, axis: 0 | 1 | 2, sign: 1 | -1, ray: THREE.Ray) => {
  const store = useEditorStore.getState()
  const obj = store.objects.find(item => item.id === objectId)
  if (!obj) return
  suspendGizmo()
  ;(window as any).__isTransforming = true
  store.setIsTransforming(true)
  store.beginGesture()
  const worldAxis = new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0)
    .applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2])))
  const center = new THREE.Vector3(...obj.position)
  const plane = facePlane(axis, center, ray)
  const hit = new THREE.Vector3()
  if (!ray.intersectPlane(plane, hit)) hit.copy(center)
  faceSession = {
    id: objectId,
    axis,
    sign,
    plane,
    hit,
    anchor: center.clone().addScaledVector(worldAxis, -sign * obj.scale[axis] / 2),
    worldAxis,
    size: obj.scale[axis],
    scale: [...obj.scale] as [number, number, number],
    pos: center,
    rot: [...obj.rotation] as [number, number, number],
  }
}

export const fpvMoveFace = (ray: THREE.Ray) => {
  const begun = faceSession
  if (!begun) return
  const hit = new THREE.Vector3()
  if (!ray.intersectPlane(begun.plane, hit)) return
  const store = useEditorStore.getState()
  const obj = store.objects.find(item => item.id === begun.id)
  if (!obj) return
  const step = store.snapStep
  const wall = isWallType(obj.type)

  if (wall && begun.axis === 2) {
    let travel = hit.clone().sub(begun.hit).dot(begun.worldAxis)
    if (store.snap) travel = snapToGrid(travel, step)
    const live = store.objects.find(item => item.id === begun.id) || obj
    const current = new THREE.Vector3(live.position[0], 0, live.position[2])
    const wanted = new THREE.Vector3(begun.pos.x, 0, begun.pos.z).addScaledVector(begun.worldAxis, travel)
    const delta = wanted.sub(current).dot(begun.worldAxis)
    if (Math.abs(delta) > 0.0001) store.offsetWall(begun.id, delta)
    return
  }

  const along = hit.clone().sub(begun.anchor).dot(begun.worldAxis)
  let size = begun.sign > 0 ? along : -along
  const min = begun.axis === 1 ? 0.05 : (store.snap ? step : 0.05)
  if (store.snap) size = begun.size + snapToGrid(size - begun.size, step)
  size = Math.max(min, size)

  if (wall && begun.axis === 0) {
    store.setWallLength(begun.id, size, begun.sign > 0 ? 'left' : 'right')
    return
  }

  const nextScale: [number, number, number] = [...begun.scale]
  nextScale[begun.axis] = size
  const nextPos = begun.anchor.clone().addScaledVector(begun.worldAxis, begun.sign * size / 2)
  store.updateObjectTransform(begun.id, [nextPos.x, nextPos.y, nextPos.z], begun.rot, nextScale)
}

export const fpvEndFace = () => {
  const begun = faceSession
  if (!begun) return
  const store = useEditorStore.getState()
  ;(window as any).__isTransforming = false
  store.setIsTransforming(false)
  store.endGesture()
  resumeGizmo()
  const obj = store.objects.find(item => item.id === begun.id)
  if (obj && isWallType(obj.type) && begun.axis === 0) store.snapAndJoinWalls(begun.id)
  faceSession = null
}

const FaceHandle: React.FC<{ obj: PlacedObject; axis: 0 | 1 | 2; sign: 1 | -1 }> = ({ obj, axis, sign }) => {
  const [hovered, setHovered] = useState(false)
  const dragging = useRef(false)

  const onDown = (e: any) => {
    if (e.button !== 0) return
    e.stopPropagation()
    dragging.current = true
    fpvBeginFace(obj.id, axis, sign, e.ray)
    if (e.target?.setPointerCapture) e.target.setPointerCapture(e.pointerId)
  }

  const onMove = (e: any) => {
    if (!dragging.current) return
    e.stopPropagation()
    fpvMoveFace(e.ray)
  }

  const onUp = (e: any) => {
    if (!dragging.current) return
    dragging.current = false
    fpvEndFace()
    if (e.target?.releasePointerCapture) e.target.releasePointerCapture(e.pointerId)
  }

  const at = obj.scale[axis] / 2
  const position: [number, number, number] = [0, 0, 0]
  position[axis] = sign * (at + 0.02)
  const knob = hovered ? 0.16 : 0.12

  return (
    <mesh
      position={position}
      userData={{ fpvHandle: { objectId: obj.id, axis, sign } }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[knob, knob, knob]} />
      <meshStandardMaterial color={hovered ? '#966853' : '#538896'} roughness={0.3} />
      <Edges color="#ffffff" />
    </mesh>
  )
}
