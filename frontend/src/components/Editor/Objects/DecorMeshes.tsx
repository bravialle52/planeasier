import React from 'react'
import { Edges } from '@react-three/drei'
import type { PlacedObject } from '../../../store/editorStore'

interface MeshProps {
  obj: PlacedObject
}

const White: React.FC<{ color?: string }> = ({ color = '#ffffff' }) => (
  <meshStandardMaterial color={color} roughness={0.35} metalness={0} />
)

const Step: React.FC<{
  position: [number, number, number]
  size: [number, number, number]
  rotation?: [number, number, number]
  color: string
}> = ({ position, size, rotation, color }) => (
  <mesh position={position} rotation={rotation} castShadow receiveShadow>
    <boxGeometry args={size} />
    <White color={color} />
    <Edges color="#000000" threshold={15} />
  </mesh>
)

export const StairsMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'

  if (obj.type === 'stairs_spiral') {
    const steps = 14
    const radius = Math.min(width, depth) * 0.46
    const rise = height / steps
    return (
      <group>
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, height, 16]} />
          <White color={color} />
          <Edges color="#000000" />
        </mesh>
        {Array.from({ length: steps }, (_, i) => {
          const angle = (i / steps) * Math.PI * 1.7
          return (
            <Step
              key={i}
              color={color}
              position={[Math.sin(angle) * radius * 0.48, -height / 2 + rise * (i + 0.5), Math.cos(angle) * radius * 0.48]}
              rotation={[0, angle, 0]}
              size={[radius * 0.92, rise * 0.9, radius * 0.42]}
            />
          )
        })}
      </group>
    )
  }

  if (obj.type === 'stairs_l') {
    const steps = 12
    const half = Math.ceil(steps / 2)
    const rise = height / steps
    const treadA = depth / half
    const treadB = width / (steps - half)
    return (
      <group>
        {Array.from({ length: half }, (_, i) => (
          <Step
            key={`a${i}`}
            color={color}
            position={[
              -width / 2 + width * 0.28,
              -height / 2 + rise * (i + 0.5),
              -depth / 2 + treadA * (i + 0.5)
            ]}
            size={[width * 0.46, rise * 0.92, treadA * 0.96]}
          />
        ))}
        {Array.from({ length: steps - half }, (_, i) => (
          <Step
            key={`b${i}`}
            color={color}
            position={[
              -width / 2 + width * 0.46 + treadB * (i + 0.5),
              -height / 2 + rise * (half + i + 0.5),
              depth / 2 - depth * 0.22
            ]}
            size={[treadB * 0.96, rise * 0.92, depth * 0.4]}
          />
        ))}
      </group>
    )
  }

  const steps = Math.max(6, Math.round(height / 0.18))
  const rise = height / steps
  const tread = depth / steps
  return (
    <group>
      {Array.from({ length: steps }, (_, i) => (
        <Step
          key={i}
          color={color}
          position={[0, -height / 2 + rise * (i + 0.5), -depth / 2 + tread * (i + 0.5)]}
          size={[width, rise * 0.92, tread * 0.98]}
        />
      ))}
    </group>
  )
}

export const CurtainMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'
  const panel = width * 0.46
  return (
    <group>
      <mesh position={[0, height / 2 - 0.025, 0]} castShadow>
        <boxGeometry args={[width, 0.05, depth]} />
        <White color={color} />
        <Edges color="#000000" />
      </mesh>
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * width * 0.25, -0.02, 0]} castShadow>
          <boxGeometry args={[panel, height - 0.08, Math.max(0.04, depth * 0.55)]} />
          <White color={color} />
          <Edges color="#000000" threshold={15} />
        </mesh>
      ))}
    </group>
  )
}

export const CorniceMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'
  const rings = Math.max(3, Math.round(width / 0.35))
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[width, height, depth]} />
        <White color={color} />
        <Edges color="#000000" />
      </mesh>
      {Array.from({ length: rings }, (_, i) => {
        const x = -width / 2 + (width / (rings + 1)) * (i + 1)
        return (
          <mesh key={i} position={[x, -height / 2 - 0.02, 0]}>
            <torusGeometry args={[Math.max(0.03, depth * 0.35), 0.008, 8, 16]} />
            <White color={color} />
          </mesh>
        )
      })}
    </group>
  )
}

export const SconceMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'
  return (
    <group>
      <mesh position={[0, 0, -depth / 2 + 0.02]} castShadow>
        <boxGeometry args={[width * 0.7, height * 0.55, 0.03]} />
        <White color={color} />
        <Edges color="#000000" />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, depth * 0.55, 8]} />
        <White color={color} />
      </mesh>
      <mesh position={[0, -height * 0.12, depth * 0.2]} castShadow>
        <coneGeometry args={[width * 0.45, height * 0.45, 16, 1, true]} />
        <meshStandardMaterial color={color} side={2} roughness={0.35} />
        <Edges color="#000000" />
      </mesh>
    </group>
  )
}

export const ChandelierMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'
  const arm = Math.min(width, depth) * 0.38
  return (
    <group>
      <mesh position={[0, height / 2 - 0.02, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.04, 16]} />
        <White color={color} />
        <Edges color="#000000" />
      </mesh>
      <mesh position={[0, height * 0.15, 0]}>
        <cylinderGeometry args={[0.012, 0.012, height * 0.45, 8]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      {[0, 1, 2, 3].map(i => {
        const angle = (i / 4) * Math.PI * 2
        const x = Math.cos(angle) * arm
        const z = Math.sin(angle) * arm
        return (
          <group key={i}>
            <mesh position={[x / 2, -height * 0.05, z / 2]} rotation={[0, -angle, Math.PI / 5]}>
              <cylinderGeometry args={[0.012, 0.012, arm, 8]} />
              <White color={color} />
            </mesh>
            <mesh position={[x, -height * 0.28, z]}>
              <coneGeometry args={[0.1, 0.16, 12, 1, true]} />
              <meshStandardMaterial color={color} side={2} roughness={0.3} />
              <Edges color="#000000" />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
