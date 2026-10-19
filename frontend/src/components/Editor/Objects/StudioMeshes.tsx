import React from 'react'
import type { PlacedObject } from '../../../store/editorStore'

interface MeshProps {
  obj: PlacedObject
}

/** Shaded part. Color and texture are applied later by the object wrapper, so every part stays paintable. */
const Part: React.FC<{
  position: [number, number, number]
  size: [number, number, number]
  rotation?: [number, number, number]
  color?: string
}> = ({ position, size, rotation, color = '#2f6fe0' }) => (
  <mesh position={position} rotation={rotation} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={0.55} metalness={0.02} />
  </mesh>
)

/** Three-seat loft sofa: frame, three cushions, back, arms and legs. */
export const LoftSofaMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const fabric = obj.color && obj.color !== '#ffffff' ? obj.color : '#2f6fe0'
  const wood = '#c4a574'
  const seat = height * 0.42
  return (
    <group>
      <Part position={[0, -height * 0.28, 0]} size={[width * 0.92, height * 0.16, depth * 0.82]} color={wood} />
      <Part position={[0, height * 0.08, -depth * 0.28]} size={[width, height * 0.72, depth * 0.22]} color={fabric} />
      {[-0.32, 0, 0.32].map(offset => (
        <Part key={offset} position={[width * offset, -height * 0.02, depth * 0.08]} size={[width * 0.28, seat * 0.45, depth * 0.55]} color={fabric} />
      ))}
      <Part position={[-width * 0.46, 0, 0.02]} size={[width * 0.1, height * 0.55, depth * 0.9]} color={fabric} />
      <Part position={[width * 0.46, 0, 0.02]} size={[width * 0.1, height * 0.55, depth * 0.9]} color={fabric} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <Part
          key={`${sx}${sz}`}
          position={[sx * width * 0.4, -height * 0.42, sz * depth * 0.32]}
          size={[0.06, height * 0.16, 0.06]}
          color={wood}
        />
      ))}
    </group>
  )
}

/** Matching armchair, built from the same parts at a smaller footprint. */
export const LoftArmchairMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const fabric = obj.color && obj.color !== '#ffffff' ? obj.color : '#3d7eea'
  return (
    <group>
      <Part position={[0, -height * 0.22, 0]} size={[width * 0.8, height * 0.14, depth * 0.75]} color="#c4a574" />
      <Part position={[0, height * 0.12, -depth * 0.28]} size={[width, height * 0.7, depth * 0.2]} color={fabric} />
      <Part position={[0, -height * 0.02, depth * 0.06]} size={[width * 0.62, height * 0.22, depth * 0.55]} color={fabric} />
      <Part position={[-width * 0.4, 0, 0]} size={[width * 0.16, height * 0.5, depth]} color={fabric} />
      <Part position={[width * 0.4, 0, 0]} size={[width * 0.16, height * 0.5, depth]} color={fabric} />
    </group>
  )
}

/** Open shelf with five boards and a back panel. */
export const ShelfWmsMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const board = obj.color && obj.color !== '#ffffff' ? obj.color : '#8fb4e8'
  const levels = [0.05, 0.28, 0.5, 0.72, 0.92]
  return (
    <group>
      <Part position={[0, 0, -depth * 0.45]} size={[width, height, 0.02]} color="#d5e4f5" />
      <Part position={[-width * 0.48, 0, 0]} size={[0.04, height, depth]} color={board} />
      <Part position={[width * 0.48, 0, 0]} size={[0.04, height, depth]} color={board} />
      {levels.map(level => (
        <Part key={level} position={[0, -height / 2 + height * level, 0]} size={[width * 0.92, 0.03, depth * 0.9]} color={board} />
      ))}
    </group>
  )
}

/** Bed with a tall headboard, mattress and two pillows. */
export const LoftBedMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const linen = obj.color && obj.color !== '#ffffff' ? obj.color : '#d9e6f5'
  return (
    <group>
      <Part position={[0, -height * 0.32, 0]} size={[width, height * 0.16, depth]} color="#c4a574" />
      <Part position={[0, -height * 0.12, depth * 0.04]} size={[width * 0.92, height * 0.22, depth * 0.82]} color={linen} />
      <Part position={[0, height * 0.1, -depth * 0.42]} size={[width, height * 0.7, depth * 0.08]} color="#2f6fe0" />
      <Part position={[-width * 0.22, height * 0.02, -depth * 0.28]} size={[width * 0.28, height * 0.12, depth * 0.16]} color="#ffffff" />
      <Part position={[width * 0.22, height * 0.02, -depth * 0.28]} size={[width * 0.28, height * 0.12, depth * 0.16]} color="#ffffff" />
    </group>
  )
}

/** Table top plus a rectangular metal frame. */
export const LoftTableMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const top = obj.color && obj.color !== '#ffffff' ? obj.color : '#e7d3b0'
  return (
    <group>
      <Part position={[0, height * 0.42, 0]} size={[width, height * 0.08, depth]} color={top} />
      <Part position={[-width * 0.42, -height * 0.05, -depth * 0.38]} size={[0.05, height * 0.84, 0.05]} color="#5c6b7a" />
      <Part position={[width * 0.42, -height * 0.05, -depth * 0.38]} size={[0.05, height * 0.84, 0.05]} color="#5c6b7a" />
      <Part position={[-width * 0.42, -height * 0.05, depth * 0.38]} size={[0.05, height * 0.84, 0.05]} color="#5c6b7a" />
      <Part position={[width * 0.42, -height * 0.05, depth * 0.38]} size={[0.05, height * 0.84, 0.05]} color="#5c6b7a" />
      <Part position={[0, -height * 0.2, 0]} size={[width * 0.8, 0.04, depth * 0.7]} color="#5c6b7a" />
    </group>
  )
}
