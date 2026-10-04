import React from 'react'
import { Edges } from '@react-three/drei'

export const Table: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      {/* Table top */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[2, 0.1, 1]} />
        <meshBasicMaterial color="white" />
        <Edges color="black" />
      </mesh>
      {/* Legs */}
      {[[-0.9, 0.45, -0.4], [0.9, 0.45, -0.4], [-0.9, 0.45, 0.4], [0.9, 0.45, 0.4]].map((pos, idx) => (
        <mesh key={idx} position={pos as [number, number, number]}>
          <boxGeometry args={[0.1, 0.9, 0.1]} />
          <meshBasicMaterial color="white" />
          <Edges color="black" />
        </mesh>
      ))}
    </group>
  )
}
