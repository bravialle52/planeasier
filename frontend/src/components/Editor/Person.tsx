import React, { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEditorStore } from '../../store/editorStore'
import { Edges } from '@react-three/drei'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { isDoorType, isWallType, openingFitsWall, wallAxes, worldToWallLocal } from '../../store/wallMath'
import { fpvBeginFace, fpvEndFace, fpvMoveFace, getActiveTransformControls } from './EditableObject'

const MAP_LIMIT = 48
const BODY_RADIUS = 0.22
const BODY_HEIGHT = 1.5
const WALK_SPEED = 3
const RUN_SPEED = 6.5
const FLY_SPEED = 5
const JUMP_SPEED = 5.2
const GRAVITY = 12
const MAX_STEP = 0.08
const DOUBLE_TAP_MS = 300
/** Tallest single riser the body will step onto. Taller stair solids block like a wall. */
const MAX_CLIMB = 0.5

type Objects = ReturnType<typeof useEditorStore.getState>['objects']

/** True when the body can pass through this wall here: inside a door-type opening, or above / below the wall. */
const passesWall = (pos: THREE.Vector3, wall: Objects[number], objects: Objects) => {
  const bottom = wall.position[1] - wall.scale[1] / 2
  const top = wall.position[1] + wall.scale[1] / 2
  if (pos.y >= top - 0.05 || pos.y + BODY_HEIGHT <= bottom) return true
  return objects.some(item => {
    const hole = isDoorType(item.type) || item.type === 'opening'
    if (!hole) return false
    if (item.wallId !== wall.id && !openingFitsWall(item, wall, 0.15)) return false
    const local = worldToWallLocal(new THREE.Vector3(item.position[0], item.position[1], item.position[2]), wall)
    const here = worldToWallLocal(pos, wall)
    const doorTop = item.position[1] + item.scale[1] / 2
    return Math.abs(here.along - local.along) < item.scale[0] / 2 - BODY_RADIUS * 0.5 && pos.y + 0.2 < doorTop
  })
}

const separateFromWalls = (pos: THREE.Vector3, objects: Objects) => {
  for (const wall of objects) {
    if (!isWallType(wall.type)) continue
    if (passesWall(pos, wall, objects)) continue
    const { axisX, axisZ } = wallAxes(wall.rotation[1])
    const local = worldToWallLocal(pos, wall)
    const halfL = wall.scale[0] / 2 + BODY_RADIUS
    const halfT = wall.scale[2] / 2 + BODY_RADIUS
    if (Math.abs(local.along) >= halfL || Math.abs(local.through) >= halfT) continue
    const penL = halfL - Math.abs(local.along)
    const penT = halfT - Math.abs(local.through)
    // Push out along the axis of least penetration, away from the wall's centre.
    if (penT < penL) {
      pos.addScaledVector(axisZ, Math.sign(local.through || 1) * penT)
    } else {
      pos.addScaledVector(axisX, Math.sign(local.along || 1) * penL)
    }
  }
}

const isStair = (type: string) => type === 'stairs_straight' || type === 'stairs_l' || type === 'stairs_spiral'

type Tread = { top: number; bottom: number; hit: (x: number, z: number) => boolean }

/** Treads in the same layout as the stair meshes, so the body can walk up them. */
const stairTreads = (item: Objects[number]): Tread[] => {
  const [width, height, depth] = item.scale
  const yaw = item.rotation[1]
  const ox = item.position[0]
  const oy = item.position[1]
  const oz = item.position[2]
  const treads: Tread[] = []

  const add = (cx: number, cz: number, stepYaw: number, sx: number, sz: number, cy: number, sy: number) => {
    const top = oy + cy + sy / 2
    const bottom = oy + cy - sy / 2
    treads.push({
      top,
      bottom,
      hit: (x, z) => {
        const dx = x - ox
        const dz = z - oz
        const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw)
        const lz = dx * Math.sin(yaw) + dz * Math.cos(yaw)
        const rx = (lx - cx) * Math.cos(stepYaw) - (lz - cz) * Math.sin(stepYaw)
        const rz = (lx - cx) * Math.sin(stepYaw) + (lz - cz) * Math.cos(stepYaw)
        return Math.abs(rx) <= sx / 2 + 0.04 && Math.abs(rz) <= sz / 2 + 0.04
      }
    })
  }

  if (item.type === 'stairs_spiral') {
    const steps = 14
    const radius = Math.min(width, depth) * 0.46
    const rise = height / steps
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 1.7
      add(
        Math.sin(angle) * radius * 0.48,
        Math.cos(angle) * radius * 0.48,
        angle,
        radius * 0.92,
        radius * 0.42,
        -height / 2 + rise * (i + 0.5),
        rise * 0.9
      )
    }
    return treads
  }

  if (item.type === 'stairs_l') {
    const steps = 12
    const half = Math.ceil(steps / 2)
    const rise = height / steps
    const treadA = depth / half
    const treadB = width / (steps - half)
    for (let i = 0; i < half; i++) {
      add(-width / 2 + width * 0.28, -depth / 2 + treadA * (i + 0.5), 0, width * 0.46, treadA * 0.96, -height / 2 + rise * (i + 0.5), rise * 0.92)
    }
    for (let i = 0; i < steps - half; i++) {
      add(
        -width / 2 + width * 0.46 + treadB * (i + 0.5),
        depth / 2 - depth * 0.22,
        0,
        treadB * 0.96,
        depth * 0.4,
        -height / 2 + rise * (half + i + 0.5),
        rise * 0.92
      )
    }
    return treads
  }

  const steps = Math.max(6, Math.round(height / 0.18))
  const rise = height / steps
  const tread = depth / steps
  for (let i = 0; i < steps; i++) {
    add(0, -depth / 2 + tread * (i + 0.5), 0, width, tread * 0.98, -height / 2 + rise * (i + 0.5), rise * 0.92)
  }
  return treads
}

const eachTread = (objects: Objects, visit: (tread: Tread) => void) => {
  for (const item of objects) {
    if (!isStair(item.type)) continue
    stairTreads(item).forEach(visit)
  }
}

/** Highest floor, carpet or stair tread under (x, z) that the body can step onto from height y. */
const groundAt = (x: number, z: number, objects: Objects, y = Infinity) => {
  let ground = 0
  for (const item of objects) {
    if (item.type !== 'floor' && item.type !== 'carpet') continue
    const yaw = item.rotation[1]
    const dx = x - item.position[0]
    const dz = z - item.position[2]
    const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw)
    const lz = dx * Math.sin(yaw) + dz * Math.cos(yaw)
    if (Math.abs(lx) > item.scale[0] / 2 || Math.abs(lz) > item.scale[2] / 2) continue
    const top = item.position[1] + item.scale[1] / 2
    const bottom = item.position[1] - item.scale[1] / 2
    // A hole in this slab: it holds the body neither from above nor from below.
    if (floorOpened(objects, x, z, top)) continue
    // Still underneath the slab, so it is a ceiling, not a step to teleport onto.
    if (y < bottom - 0.05) continue
    if (top > y + MAX_CLIMB) continue
    ground = Math.max(ground, top)
  }
  eachTread(objects, tread => {
    if (!tread.hit(x, z)) return
    if (tread.top > y + MAX_CLIMB) return
    ground = Math.max(ground, tread.top)
  })
  return ground
}

/** True when a vertical drop at (x, z) goes through an opening that cuts this slab. */
const floorOpened = (objects: Objects, x: number, z: number, surfaceY: number) => {
  for (const opening of objects) {
    if (opening.type !== 'opening') continue
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(opening.rotation[0], opening.rotation[1], opening.rotation[2], 'XYZ')
    )
    const inverse = quat.clone().invert()
    const center = new THREE.Vector3(opening.position[0], opening.position[1], opening.position[2])
    // A little larger than the mesh cut, so the body falls through the hole it can see.
    const half = new THREE.Vector3(
      Math.abs(opening.scale[0]) / 2 + 0.12,
      Math.abs(opening.scale[1]) / 2 + 0.12,
      Math.abs(opening.scale[2]) / 2 + 0.12
    )
    const origin = new THREE.Vector3(x, surfaceY - 30, z).sub(center).applyQuaternion(inverse)
    const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(inverse)
    if (direction.lengthSq() < 1e-8) continue
    direction.normalize()

    let near = 0
    let far = 60
    let miss = false
    ;(['x', 'y', 'z'] as const).forEach(axis => {
      if (miss) return
      const start = origin[axis]
      const delta = direction[axis]
      const min = -half[axis]
      const max = half[axis]
      if (Math.abs(delta) < 1e-8) {
        if (start < min || start > max) miss = true
        return
      }
      let t1 = (min - start) / delta
      let t2 = (max - start) / delta
      if (t1 > t2) {
        const swap = t1
        t1 = t2
        t2 = swap
      }
      near = Math.max(near, t1)
      far = Math.min(far, t2)
      if (near > far) miss = true
    })
    if (miss || near > far) continue

    const enterY = surfaceY - 30 + near
    const exitY = surfaceY - 30 + far
    const low = Math.min(enterY, exitY) - 0.2
    const high = Math.max(enterY, exitY) + 0.2
    if (surfaceY >= low && surfaceY <= high) return true
  }
  return false
}

/** A riser taller than one step is solid: the body cannot walk through the side of a staircase. */
const stairBlocks = (x: number, z: number, feet: number, objects: Objects) => {
  let blocked = false
  eachTread(objects, tread => {
    if (blocked || !tread.hit(x, z)) return
    if (tread.top > feet + MAX_CLIMB && tread.bottom < feet + BODY_HEIGHT) blocked = true
  })
  return blocked
}

export const Person: React.FC = () => {
  // Narrow subscriptions: re-rendering on every scene edit must not disturb the running simulation.
  const person = useEditorStore(state => state.person)
  const updatePersonState = useEditorStore(state => state.updatePersonState)
  const groupRef = useRef<THREE.Group>(null)
  const { camera, gl, scene } = useThree()
  
  const moveState = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
    up: false,
    down: false,
    flying: false,
    jumpQueued: false,
    lastSpaceAt: 0
  })
  const waddleTime = useRef(0)
  const fpvControlsRef = useRef<PointerLockControls | null>(null)
  const aimDrag = useRef<'gizmo' | 'face' | null>(null)
  const centerPointer = { x: 0, y: 0, button: 0 }
  const centerMove = { x: 0, y: 0, button: -1 }
  
  const isDragging = useRef(false)
  const velocity = useRef(new THREE.Vector3())
  const lieTimer = useRef(0)
  const [spawnStage, setSpawnStage] = React.useState<'falling' | 'lying' | 'peeling' | 'done'>('done')

  const swingAngle = useRef({ x: 0, z: 0 })
  const swingVelocity = useRef({ x: 0, z: 0 })
  const prevDragPos = useRef(new THREE.Vector3())

  // Setup 2D Shape geometry - unified paper-like cutout
  const bodyGeo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.15, 0.0)
    shape.lineTo(-0.15, 0.6)
    shape.lineTo(-0.3, 0.6)
    shape.lineTo(-0.3, 1.1)
    shape.lineTo(-0.2, 1.1)
    shape.lineTo(-0.2, 1.3)
    shape.absarc(0, 1.3, 0.2, Math.PI, 0, true)
    shape.lineTo(0.2, 1.1)
    shape.lineTo(0.3, 1.1)
    shape.lineTo(0.3, 0.6)
    shape.lineTo(0.15, 0.6)
    shape.lineTo(0.15, 0.0)
    shape.lineTo(0.05, 0.0)
    shape.lineTo(0.05, 0.5)
    shape.lineTo(-0.05, 0.5)
    shape.lineTo(-0.05, 0.0)
    shape.lineTo(-0.15, 0.0)
    return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false })
  }, [])

  // Start spawn animation when activated
  useEffect(() => {
    if (person.active) {
      setSpawnStage('falling')
      velocity.current.set(0, -1, 0)
      lieTimer.current = 0
      moveState.current.flying = false
      if (groupRef.current) {
        const [x, , z] = useEditorStore.getState().person.position
        groupRef.current.position.set(x, 8, z)
        groupRef.current.rotation.y = useEditorStore.getState().person.rotation
        groupRef.current.rotation.x = -Math.PI / 2
        groupRef.current.rotation.z = (Math.random() - 0.5) * 0.4
      }
    }
  }, [person.active])

  useEffect(() => {
    if (!person.isFPV) return
    velocity.current.set(0, 0, 0)
    moveState.current.forward = false
    moveState.current.backward = false
    moveState.current.left = false
    moveState.current.right = false
    setSpawnStage('done')
    if (groupRef.current) {
      groupRef.current.rotation.x = 0
      groupRef.current.rotation.z = 0
    }
  }, [person.isFPV])

  useEffect(() => {
    if (!person.active) return
    
    const isTyping = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable))
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e)) return
      const m = moveState.current
      if (useEditorStore.getState().person.isFPV) {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') m.forward = true
        if (e.code === 'KeyS' || e.code === 'ArrowDown') m.backward = true
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') m.left = true
        if (e.code === 'KeyD' || e.code === 'ArrowRight') m.right = true
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') m.run = true
      if (e.code === 'KeyC') m.down = true
      if (useEditorStore.getState().person.isFPV) {
        const mode = e.code === 'Digit1' || e.code === 'Numpad1'
          ? 'translate'
          : e.code === 'Digit2' || e.code === 'Numpad2'
            ? 'rotate'
            : e.code === 'Digit3' || e.code === 'Numpad3'
              ? 'scale'
              : null
        if (mode) {
          e.preventDefault()
          useEditorStore.getState().setTransformMode(mode)
        }
      }
      if (e.code === 'Space') {
        // Space would otherwise "click" whatever toolbar button still has focus.
        e.preventDefault()
        if (e.repeat) return
        m.up = true
        const now = performance.now()
        if (now - m.lastSpaceAt < DOUBLE_TAP_MS) {
          m.flying = !m.flying
          m.jumpQueued = false
          m.lastSpaceAt = 0
          velocity.current.y = 0
        } else {
          m.lastSpaceAt = now
          if (!m.flying) m.jumpQueued = true
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const m = moveState.current
      if (e.code === 'KeyW' || e.code === 'ArrowUp') m.forward = false
      if (e.code === 'KeyS' || e.code === 'ArrowDown') m.backward = false
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') m.left = false
      if (e.code === 'KeyD' || e.code === 'ArrowRight') m.right = false
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') m.run = false
      if (e.code === 'KeyC') m.down = false
      if (e.code === 'Space') m.up = false
    }
    const onBlur = () => {
      const m = moveState.current
      m.forward = m.backward = m.left = m.right = m.run = m.up = m.down = false
    }
    window.addEventListener('blur', onBlur)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    
    if (person.isFPV) {
      if (!fpvControlsRef.current) {
        fpvControlsRef.current = new PointerLockControls(camera, gl.domElement)
      }
      fpvControlsRef.current.lock()

      const aimRay = () => {
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
        return raycaster
      }

      const onPointerDown = (event: PointerEvent) => {
        const controls = fpvControlsRef.current
        if (!controls) return
        if (!controls.isLocked) {
          if (event.target === gl.domElement) controls.lock()
          return
        }
        if (event.button !== 0) return
        // Keep the browser from also driving the gizmo with a frozen mouse coordinate.
        event.stopPropagation()
        event.preventDefault()
        const gizmo = getActiveTransformControls()
        if (gizmo) {
          gizmo.pointerHover(centerPointer)
          if (gizmo.axis) {
            gizmo.pointerDown(centerPointer)
            aimDrag.current = 'gizmo'
            return
          }
        }
        const hits = aimRay().intersectObjects(scene.children, true)
        for (const hit of hits) {
          let node: THREE.Object3D | null = hit.object
          while (node) {
            const handle = node.userData?.fpvHandle as { objectId: string; axis: 0 | 1 | 2; sign: 1 | -1 } | undefined
            if (handle) {
              fpvBeginFace(handle.objectId, handle.axis, handle.sign, aimRay().ray)
              aimDrag.current = 'face'
              return
            }
            node = node.parent
          }
        }
        let objectId: string | null = null
        for (const hit of hits) {
          let node: THREE.Object3D | null = hit.object
          while (node) {
            if (node.userData?.objectId) {
              objectId = node.userData.objectId as string
              break
            }
            node = node.parent
          }
          if (objectId) break
        }
        useEditorStore.getState().selectObjects(objectId ? [objectId] : [])
      }

      const onPointerUp = (event: PointerEvent) => {
        if (!fpvControlsRef.current?.isLocked && aimDrag.current === null) return
        if (event.button !== 0) return
        const gizmo = getActiveTransformControls()
        if (aimDrag.current === 'gizmo' && gizmo) gizmo.pointerUp(centerPointer)
        if (aimDrag.current === 'face') fpvEndFace()
        aimDrag.current = null
      }

      const swallowMove = (event: PointerEvent) => {
        if (fpvControlsRef.current?.isLocked) event.stopPropagation()
      }

      gl.domElement.addEventListener('pointerdown', onPointerDown, true)
      gl.domElement.ownerDocument.addEventListener('pointermove', swallowMove, true)
      gl.domElement.ownerDocument.addEventListener('pointerup', onPointerUp, true)
      
      return () => {
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
        window.removeEventListener('blur', onBlur)
        gl.domElement.removeEventListener('pointerdown', onPointerDown, true)
        gl.domElement.ownerDocument.removeEventListener('pointermove', swallowMove, true)
        gl.domElement.ownerDocument.removeEventListener('pointerup', onPointerUp, true)
        if (aimDrag.current === 'face') fpvEndFace()
        aimDrag.current = null
        fpvControlsRef.current?.unlock()
      }
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [person.active, person.isFPV, camera, gl.domElement, scene])

  useFrame((state, delta) => {
    if (!person.active || !groupRef.current) return

    // Spawn Animation Logic
    if (spawnStage === 'falling') {
      const objects = useEditorStore.getState().objects
      velocity.current.y -= 9.8 * delta
      groupRef.current.position.y += velocity.current.y * delta
      groupRef.current.rotation.x = -Math.PI / 2
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 6) * 0.35
      const ground = groundAt(groupRef.current.position.x, groupRef.current.position.z, objects)
      if (groupRef.current.position.y <= ground) {
        groupRef.current.position.y = ground
        velocity.current.y = 0
        lieTimer.current = 0
        setSpawnStage('lying')
      }
      return
    }

    if (spawnStage === 'lying') {
      groupRef.current.rotation.x = -Math.PI / 2
      groupRef.current.position.y = groundAt(groupRef.current.position.x, groupRef.current.position.z, useEditorStore.getState().objects)
      lieTimer.current += delta
      if (lieTimer.current > 0.45) setSpawnStage('peeling')
      return
    }

    if (spawnStage === 'peeling') {
      groupRef.current.rotation.x += delta * 2.2
      groupRef.current.rotation.z *= 0.9
      if (groupRef.current.rotation.x >= 0) {
        groupRef.current.rotation.x = 0
        groupRef.current.rotation.z = 0
        setSpawnStage('done')
      }
      return
    }

    const m = moveState.current
    const isMoving = m.forward || m.backward || m.left || m.right

    if (!isDragging.current) {
      const pos = groupRef.current.position
      const objects = useEditorStore.getState().objects
      const dt = Math.min(delta, 0.05)

      // Walk relative to where the camera looks; from straight above "forward" is north.
      const dir = new THREE.Vector3()
      camera.getWorldDirection(dir)
      dir.y = 0
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1)
      dir.normalize()
      const rightVec = new THREE.Vector3(-dir.z, 0, dir.x)

      const walk = new THREE.Vector3()
      if (m.forward) walk.add(dir)
      if (m.backward) walk.sub(dir)
      if (m.right) walk.add(rightVec)
      if (m.left) walk.sub(rightVec)
      if (walk.lengthSq() > 0) {
        const speed = m.flying ? (m.run ? FLY_SPEED * 2 : FLY_SPEED) : (m.run ? RUN_SPEED : WALK_SPEED)
        walk.normalize().multiplyScalar(speed)
        groupRef.current.rotation.y = person.isFPV ? Math.atan2(dir.x, dir.z) : Math.atan2(walk.x, walk.z)
      }

      const groundBefore = groundAt(pos.x, pos.z, objects, pos.y)
      const onGround = pos.y - groundBefore < 0.03
      if (m.flying) {
        velocity.current.y = (m.up ? FLY_SPEED : 0) - (m.down ? FLY_SPEED : 0)
      } else {
        if (m.jumpQueued && onGround) velocity.current.y = JUMP_SPEED
        m.jumpQueued = false
        velocity.current.y -= GRAVITY * dt
      }

      // Horizontal motion in small sub-steps so a fast run or a throw can't skip over a thin wall.
      const stepX = (walk.x + velocity.current.x) * dt
      const stepZ = (walk.z + velocity.current.z) * dt
      const steps = Math.max(1, Math.ceil(Math.hypot(stepX, stepZ) / MAX_STEP))
      for (let i = 0; i < steps; i++) {
        const prevX = pos.x
        const prevZ = pos.z
        pos.x += stepX / steps
        pos.z += stepZ / steps
        separateFromWalls(pos, objects)
        separateFromWalls(pos, objects)
        if (!m.flying && stairBlocks(pos.x, pos.z, pos.y, objects)) {
          pos.x = prevX
          pos.z = prevZ
        }
      }
      pos.y = Math.min(40, pos.y + velocity.current.y * dt)

      velocity.current.x *= Math.max(0, 1 - dt * 1.6)
      velocity.current.z *= Math.max(0, 1 - dt * 1.6)

      const flat = Math.hypot(pos.x, pos.z)
      if (flat > MAP_LIMIT) {
        velocity.current.x += (-pos.x / flat) * 8 * dt
        velocity.current.z += (-pos.z / flat) * 8 * dt
      }

      const ground = groundAt(pos.x, pos.z, objects, pos.y)
      if (pos.y <= ground) {
        pos.y = ground
        if (velocity.current.y < 0) velocity.current.y = 0
      }

      if (person.isFPV) {
        camera.position.set(pos.x, pos.y + 1.4, pos.z)
        const controls = fpvControlsRef.current
        if (controls?.isLocked) {
          const gizmo = getActiveTransformControls()
          if (aimDrag.current === 'gizmo' && gizmo?.dragging) {
            gizmo.pointerMove(centerMove)
          } else if (gizmo && !gizmo.dragging) {
            gizmo.pointerHover(centerPointer)
          }
          if (aimDrag.current === 'face') {
            const raycaster = new THREE.Raycaster()
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
            fpvMoveFace(raycaster.ray)
          }
        }
      }
    }

    if (isMoving && !isDragging.current && !m.flying) {
      waddleTime.current += delta * 15
    } else {
      waddleTime.current = 0
    }
    const waddle = Math.sin(waddleTime.current) * 0.15

    // Physics logic for doll swing
    const dt = Math.min(delta, 0.1) // prevent huge spikes on lag
    if (isDragging.current) {
      const currentPos = groupRef.current.position
      const dx = (currentPos.x - prevDragPos.current.x) / dt
      const dz = (currentPos.z - prevDragPos.current.z) / dt
      prevDragPos.current.copy(currentPos)

      const targetZ = Math.max(-1, Math.min(1, -dx * 0.1))
      const targetX = Math.max(-1, Math.min(1, dz * 0.1))
      
      const springK = 80
      const damping = 8
      
      swingVelocity.current.z += (-springK * (swingAngle.current.z - targetZ) - damping * swingVelocity.current.z) * dt
      swingVelocity.current.x += (-springK * (swingAngle.current.x - targetX) - damping * swingVelocity.current.x) * dt
      
      swingAngle.current.z += swingVelocity.current.z * dt
      swingAngle.current.x += swingVelocity.current.x * dt
      
      groupRef.current.rotation.z = swingAngle.current.z
      groupRef.current.rotation.x = swingAngle.current.x
    } else {
      const springK = 80
      const damping = 8
      swingVelocity.current.z += (-springK * swingAngle.current.z - damping * swingVelocity.current.z) * dt
      swingVelocity.current.x += (-springK * swingAngle.current.x - damping * swingVelocity.current.x) * dt
      
      swingAngle.current.z += swingVelocity.current.z * dt
      swingAngle.current.x += swingVelocity.current.x * dt
      
      groupRef.current.rotation.z = swingAngle.current.z + waddle
      groupRef.current.rotation.x = swingAngle.current.x
    }
  })

  const handlePointerDown = (e: any) => {
    if (person.isFPV || spawnStage !== 'done') return
    e.stopPropagation()
    isDragging.current = true
    if (groupRef.current) prevDragPos.current.copy(groupRef.current.position)
    useEditorStore.getState().setIsTransforming(true)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerUp = (e: any) => {
    if (isDragging.current) {
      isDragging.current = false
      useEditorStore.getState().setIsTransforming(false)
      if (groupRef.current) {
        const dt = 0.05
        velocity.current.set(
          (groupRef.current.position.x - prevDragPos.current.x) / dt,
          0,
          (groupRef.current.position.z - prevDragPos.current.z) / dt
        )
        const throwSpeed = Math.hypot(velocity.current.x, velocity.current.z)
        if (throwSpeed > 14) velocity.current.multiplyScalar(14 / throwSpeed)
        updatePersonState({
          position: [groupRef.current.position.x, groupRef.current.position.y, groupRef.current.position.z],
          rotation: groupRef.current.rotation.y
        })
      }
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    }
  }

  const handlePointerMove = (e: any) => {
    if (!isDragging.current || !groupRef.current) return
    e.stopPropagation()
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const ray = e.ray || (e.raycaster && e.raycaster.ray)
    if (!ray) return
    const target = new THREE.Vector3()
    if (ray.intersectPlane(floorPlane, target)) {
      groupRef.current.position.x = target.x
      groupRef.current.position.y = 1.3
      groupRef.current.position.z = target.z
    }
  }

  if (!person.active) return null

  const visible = !person.isFPV

  return (
    <group 
      ref={groupRef} 
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      <mesh geometry={bodyGeo} visible={visible} castShadow>
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
        <Edges color="#000000" threshold={15} />
      </mesh>
    </group>
  )
}
