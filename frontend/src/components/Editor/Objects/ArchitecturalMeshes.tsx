import React, { useLayoutEffect, useRef } from 'react'
import { Edges } from '@react-three/drei'
import { Geometry, Base, Subtraction, Addition } from '@react-three/csg'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { PlacedObject } from '../../../store/editorStore'
import { useEditorStore } from '../../../store/editorStore'
import { isOpeningType, isDoorType, isWallType, openingFitsWall, worldToWallLocal, boxesOverlap, cutterInHost } from '../../../store/wallMath'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import * as THREE from 'three'

const whiteSkin = (() => {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 4
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 4, 4)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
})()

/** Opaque white skin drawn in front of the cut edges, so the boolean stripes stay in the mesh but disappear under it. */
const SkinMaterial: React.FC<{ color: string }> = ({ color }) => (
  <meshStandardMaterial
    color={color}
    map={whiteSkin}
    roughness={0.2}
    metalness={0}
    polygonOffset
    polygonOffsetFactor={-3}
    polygonOffsetUnits={-3}
  />
)

/** While a drag is in progress, the boolean rebuilds in 10 cm steps instead of every millimetre. */
const cutNums = (values: number[], coarse: boolean) => {
  const step = coarse ? 0.1 : 0.0001
  return values.map(value => Math.round(value / step) * step).join(',')
}

interface MeshProps {
  obj: PlacedObject
  isGhost?: boolean
}

const CutEdges: React.FC<{ version: string }> = ({ version }) => {
  const ref = useRef<THREE.LineSegments>(null)

  useLayoutEffect(() => {
    const lines = ref.current
    const parent = lines?.parent as THREE.Mesh | null
    const source = parent?.geometry
    const position = source?.getAttribute('position')
    if (!lines || !parent || !source || !position || position.count < 3) return

    // Edges are taken from a copy. Replacing the mesh geometry here used to freeze the
    // first cut, so later changes to the opening never showed up in the hole.
    const welded = mergeVertices(source.clone(), 1e-3)
    welded.computeVertexNormals()
    const edges = new THREE.EdgesGeometry(welded, 25)
    welded.dispose()
    lines.geometry.dispose()
    lines.geometry = edges
  }, [version])

  return (
    <lineSegments ref={ref} raycast={() => null}>
      <bufferGeometry />
      <lineBasicMaterial color="#000000" polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} />
    </lineSegments>
  )
}

export const WallMesh: React.FC<MeshProps> = ({ obj }) => {
  const color = obj.color || '#ffffff'
  const objects = useEditorStore(state => state.objects)
  const gesture = useEditorStore(state => state.gestureOpen)
  const members = obj.groupId
    ? objects.filter(item => item.groupId === obj.groupId && isWallType(item.type))
    : [obj]
  const lead = [...members].sort((a, b) => a.id.localeCompare(b.id))[0]

  // Every wall owns an invisible box that catches the pointer, so a click on any face of the
  // room selects exactly that wall. The merged CSG body below is drawn by the lead wall only
  // and ignores the raycaster.
  const pickBox = (
    <mesh>
      <boxGeometry args={obj.scale} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )

  if (members.length > 1 && lead.id !== obj.id) {
    return pickBox
  }

  const openings = objects.filter(item => {
    if (!isOpeningType(item.type)) return false
    return members.some(wall => {
      if (item.wallId === wall.id) return true
      if (item.type === 'opening') return boxesOverlap(item, wall)
      return !item.wallId && openingFitsWall(item, wall)
    })
  })

  const version = [
    members.map(wall => `${wall.id}:${cutNums(wall.position, gesture)}:${cutNums(wall.scale, gesture)}:${cutNums([wall.rotation[1]], gesture)}`).join('|'),
    openings.map(item => `${item.id}:${cutNums(item.position, gesture)}:${cutNums(item.scale, gesture)}:${cutNums(item.rotation, gesture)}`).join('|')
  ].join('||')

  return (
    <>
    {pickBox}
    <mesh castShadow receiveShadow raycast={() => null}>
      <Geometry computeVertexNormals key={version}>
        <Base>
          <boxGeometry args={obj.scale} />
        </Base>
        {members.filter(wall => wall.id !== obj.id).map(wall => {
          const local = worldToWallLocal(new THREE.Vector3(...wall.position), obj)
          return (
            <Addition
              key={wall.id}
              position={[local.along, local.up, local.through]}
              rotation={[0, wall.rotation[1] - obj.rotation[1], 0]}
            >
              <boxGeometry args={wall.scale} />
            </Addition>
          )
        })}
        {openings.map(op => {
          if (op.type === 'opening') {
            const cut = cutterInHost(obj, op)
            return (
              <Subtraction key={op.id} position={cut.position} rotation={cut.rotation}>
                <boxGeometry args={cut.scale} />
              </Subtraction>
            )
          }
          const extraY = isDoorType(op.type) ? 0.04 : 0
          const local = worldToWallLocal(new THREE.Vector3(...op.position), obj)
          return (
            <Subtraction
              key={op.id}
              position={[local.along, local.up - extraY / 2, local.through]}
              rotation={[0, op.rotation[1] - obj.rotation[1], 0]}
            >
              <boxGeometry args={[op.scale[0], op.scale[1] + extraY, 1.6]} />
            </Subtraction>
          )
        })}
      </Geometry>
      <SkinMaterial color={color} />
      <CutEdges version={version} />
    </mesh>
    </>
  )
}

/** Free openings punched out of a solid. The cutter is the opening itself, including its turn. */
const SolidCut: React.FC<{ obj: PlacedObject; cutters: PlacedObject[] }> = ({ obj, cutters }) => {
  const color = obj.color || '#ffffff'
  const gesture = useEditorStore(state => state.gestureOpen)
  const version = [
    cutNums(obj.position, gesture),
    cutNums(obj.scale, gesture),
    cutNums([obj.rotation[1]], gesture),
    cutters.map(item => `${item.id}:${cutNums(item.position, gesture)}:${cutNums(item.scale, gesture)}:${cutNums(item.rotation, gesture)}`).join('|')
  ].join('||')

  if (cutters.length === 0) {
    return (
      <mesh receiveShadow castShadow>
        <boxGeometry args={obj.scale} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
        <Edges color="#000000" />
      </mesh>
    )
  }

  return (
    <mesh receiveShadow castShadow>
      <Geometry computeVertexNormals key={version}>
        <Base>
          <boxGeometry args={obj.scale} />
        </Base>
        {cutters.map(op => {
          const cut = cutterInHost(obj, op)
          return (
            <Subtraction key={op.id} position={cut.position} rotation={cut.rotation}>
              <boxGeometry args={cut.scale} />
            </Subtraction>
          )
        })}
      </Geometry>
      <SkinMaterial color={color} />
      <CutEdges version={version} />
    </mesh>
  )
}

/** Two slopes and gable ends, sized to the object's box. */
export const RoofMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'
  const run = Math.max(depth / 2, 0.2)
  const rise = Math.max(height, 0.2)
  const length = Math.hypot(run, rise)
  const pitch = Math.atan2(rise, run)
  const thick = Math.min(0.07, rise * 0.12)
  const slope = (side: 1 | -1) => (
    <mesh position={[0, 0, side * depth / 4]} rotation={[side * pitch, 0, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, thick, length]} />
      <meshStandardMaterial color={color} roughness={0.35} />
      <Edges color="#000000" threshold={15} />
    </mesh>
  )
  const gable = new THREE.Shape()
  gable.moveTo(-depth / 2, -height / 2)
  gable.lineTo(0, height / 2)
  gable.lineTo(depth / 2, -height / 2)
  gable.closePath()
  return (
    <group>
      {slope(-1)}
      {slope(1)}
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * (width / 2), 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
          <shapeGeometry args={[gable]} />
          <meshStandardMaterial color={color} roughness={0.35} side={THREE.DoubleSide} />
          <Edges color="#000000" threshold={20} />
        </mesh>
      ))}
    </group>
  )
}

// 🔲 Пол макета
export const FloorMesh: React.FC<MeshProps> = ({ obj }) => {
  const objects = useEditorStore(state => state.objects)
  const cutters = objects.filter(item => item.type === 'opening' && boxesOverlap(obj, item))
  return <SolidCut obj={obj} cutters={cutters} />
}

export const BlockMesh: React.FC<MeshProps> = ({ obj }) => {
  const objects = useEditorStore(state => state.objects)
  const cutters = objects.filter(item => item.type === 'opening' && item.id !== obj.id && boxesOverlap(obj, item))
  return <SolidCut obj={obj} cutters={cutters} />
}

/** Carve every mesh of a furniture piece (or stairs, a curtain, …) with the openings that overlap it. */
export const CutVolume: React.FC<{ obj: PlacedObject; children: React.ReactNode }> = ({ obj, children }) => {
  const ref = useRef<THREE.Group>(null)
  const objects = useEditorStore(state => state.objects)
  const gesture = useEditorStore(state => state.gestureOpen)
  const cutters = objects.filter(item => item.type === 'opening' && item.id !== obj.id && boxesOverlap(obj, item))
  const sig = cutters.map(item => `${item.id}:${cutNums(item.position, gesture)}:${cutNums(item.rotation, gesture)}:${cutNums(item.scale, gesture)}`).join('|')
    + `|${cutNums(obj.position, gesture)}:${cutNums(obj.rotation, gesture)}:${cutNums(obj.scale, gesture)}`

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    root.updateWorldMatrix(true, true)

    const meshes: THREE.Mesh[] = []
    root.traverse(node => {
      const mesh = node as THREE.Mesh
      if (mesh.isMesh && !mesh.userData.noCut) meshes.push(mesh)
    })
    if (meshes.length > 0 && meshes.every(mesh => mesh.geometry.userData.cutSig === sig)) return

    const evaluator = new Evaluator()
    evaluator.useGroups = false

    for (const mesh of meshes) {
      const current = mesh.geometry
      const base = (current.userData.cutBase as THREE.BufferGeometry | undefined) || current
      if (!base.getAttribute('position')) continue

      if (cutters.length === 0) {
        if (current !== base) {
          mesh.geometry = base
          if (current.userData.cutResult) current.dispose()
        }
        continue
      }

      mesh.updateWorldMatrix(true, false)
      let acc = new Brush(base.clone())
      acc.matrix.copy(mesh.matrixWorld)
      acc.matrixWorld.copy(mesh.matrixWorld)

      let failed = false
      for (const op of cutters) {
        const cutter = new Brush(new THREE.BoxGeometry(
          Math.abs(op.scale[0]) + 0.04,
          Math.abs(op.scale[1]) + 0.04,
          Math.abs(op.scale[2]) + 0.04
        ))
        const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(op.rotation[0], op.rotation[1], op.rotation[2], 'XYZ'))
        cutter.matrix.compose(new THREE.Vector3(op.position[0], op.position[1], op.position[2]), quaternion, new THREE.Vector3(1, 1, 1))
        cutter.matrixWorld.copy(cutter.matrix)
        try {
          const next = evaluator.evaluate(acc, cutter, SUBTRACTION)
          if (acc.geometry !== base) acc.geometry.dispose()
          cutter.geometry.dispose()
          acc = next
        } catch {
          cutter.geometry.dispose()
          failed = true
          break
        }
      }
      if (failed || acc.geometry === base) continue

      const result = acc.geometry
      result.computeVertexNormals()
      result.userData.cutResult = true
      result.userData.cutBase = base
      result.userData.cutSig = sig
      if (current !== base && current.userData.cutResult) current.dispose()
      mesh.geometry = result
    }
  }, [sig])

  return <group ref={ref}>{children}</group>
}

/** A free opening: a selectable frame. The hole itself is cut out of whatever solid it overlaps. */
export const OpeningMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const t = 0.04
  const bar = (position: [number, number, number], args: [number, number, number]) => (
    <mesh position={position} raycast={() => null}>
      <boxGeometry args={args} />
      <meshStandardMaterial color="#ffffff" roughness={0.2} />
      <Edges color="#000000" />
    </mesh>
  )
  return (
    <group>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      {bar([0, height / 2 - t / 2, 0], [width, t, depth])}
      {bar([0, -height / 2 + t / 2, 0], [width, t, depth])}
      {bar([-width / 2 + t / 2, 0, 0], [t, height, depth])}
      {bar([width / 2 - t / 2, 0, 0], [t, height, depth])}
    </group>
  )
}

// 🪟 Окно макета
export const WindowMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const frameThickness = 0.06
  const color = obj.color || '#ffffff'

  return (
    <group>
      {/* Top bar */}
      <mesh position={[0, height / 2 - frameThickness / 2, 0]}>
        <boxGeometry args={[width, frameThickness, depth]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      {/* Sill */}
      <mesh position={[0, -height / 2 + frameThickness / 2, 0]}>
        <boxGeometry args={[width + 0.1, frameThickness * 1.4, depth + 0.06]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      {/* Left post */}
      <mesh position={[-width / 2 + frameThickness / 2, 0, 0]}>
        <boxGeometry args={[frameThickness, height - frameThickness * 2, depth]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      {/* Right post */}
      <mesh position={[width / 2 - frameThickness / 2, 0, 0]}>
        <boxGeometry args={[frameThickness, height - frameThickness * 2, depth]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* Center vertical mullion */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[frameThickness * 0.8, height - frameThickness * 2, depth * 0.8]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      {/* Center horizontal divider */}
      <mesh position={[0, height * 0.15, 0]}>
        <boxGeometry args={[width - frameThickness * 2, frameThickness * 0.7, depth * 0.8]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* Translucent glass with depthWrite={false} to ensure ground and objects are crystal clear through window */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[width - frameThickness * 1.5, height - frameThickness * 1.5, 0.01]} />
        <meshStandardMaterial 
          color="#ffffff" 
          opacity={0.15} 
          transparent 
          depthWrite={false}
          roughness={0.05}
        />
      </mesh>
    </group>
  )
}

// 🚪 Дверь макета
export const DoorMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const jambThickness = 0.05
  const isDouble = obj.type === 'double_door'
  const isArch = obj.type === 'arch'
  const color = obj.color || '#ffffff'

  return (
    <group>
      {/* Door frame (Jamb) */}
      <mesh position={[0, height / 2 - jambThickness / 2, 0]}>
        <boxGeometry args={[width + jambThickness * 2, jambThickness, depth]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      <mesh position={[-width / 2 - jambThickness / 2, 0, 0]}>
        <boxGeometry args={[jambThickness, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      <mesh position={[width / 2 + jambThickness / 2, 0, 0]}>
        <boxGeometry args={[jambThickness, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {!isArch && (
        <>
          {/* Door leaf */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[width - 0.02, height - jambThickness, depth * 0.4]} />
            <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
            <Edges color="#000000" threshold={15} />
          </mesh>

          {/* Decorative panels (Side A: +Z) */}
          <mesh position={[0, height * 0.15, depth * 0.21]}>
            <boxGeometry args={[width * 0.65, height * 0.45, 0.01]} />
            <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
            <Edges color="#000000" threshold={15} />
          </mesh>
          <mesh position={[0, -height * 0.25, depth * 0.21]}>
            <boxGeometry args={[width * 0.65, height * 0.3, 0.01]} />
            <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
            <Edges color="#000000" threshold={15} />
          </mesh>

          {/* Decorative panels (Side B: -Z) */}
          <mesh position={[0, height * 0.15, -depth * 0.21]}>
            <boxGeometry args={[width * 0.65, height * 0.45, 0.01]} />
            <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
            <Edges color="#000000" threshold={15} />
          </mesh>
          <mesh position={[0, -height * 0.25, -depth * 0.21]}>
            <boxGeometry args={[width * 0.65, height * 0.3, 0.01]} />
            <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
            <Edges color="#000000" threshold={15} />
          </mesh>

          {/* Door handle (Side A: +Z) */}
          <group position={[isDouble ? 0.08 : width * 0.35, 0, depth * 0.25]}>
            <mesh>
              <boxGeometry args={[0.03, 0.12, 0.01]} />
              <meshStandardMaterial color="#ffffff" roughness={0.1} />
              <Edges color="#000000" />
            </mesh>
            <mesh position={[-0.04, 0.02, 0.04]}>
              <boxGeometry args={[0.1, 0.02, 0.02]} />
              <meshStandardMaterial color="#ffffff" roughness={0.1} />
              <Edges color="#000000" />
            </mesh>
          </group>

          {/* Door handle (Side B: -Z) */}
          <group position={[isDouble ? 0.08 : width * 0.35, 0, -depth * 0.25]} rotation={[0, Math.PI, 0]}>
            <mesh>
              <boxGeometry args={[0.03, 0.12, 0.01]} />
              <meshStandardMaterial color="#ffffff" roughness={0.1} />
              <Edges color="#000000" />
            </mesh>
            <mesh position={[-0.04, 0.02, 0.04]}>
              <boxGeometry args={[0.1, 0.02, 0.02]} />
              <meshStandardMaterial color="#ffffff" roughness={0.1} />
              <Edges color="#000000" />
            </mesh>
          </group>
        </>
      )}
    </group>
  )
}
