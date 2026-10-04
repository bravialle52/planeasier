import React from 'react'
import { Edges } from '@react-three/drei'

export const Chair: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      {/* Seat */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.5, 0.05, 0.5]} />
        <meshBasicMaterial color="white" />
        <Edges color="black" />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.9, -0.225]}>
        <boxGeometry args={[0.5, 0.4, 0.05]} />
        <meshBasicMaterial color="white" />
        <Edges color="black" />
      </mesh>
      {/* Legs */}
      {[[-0.2, 0.25, -0.2], [0.2, 0.25, -0.2], [-0.2, 0.25, 0.2], [0.2, 0.25, 0.2]].map((pos, idx) => (
        <mesh key={idx} position={pos as [number, number, number]}>
          <boxGeometry args={[0.05, 0.5, 0.05]} />
          <meshBasicMaterial color="white" />
          <Edges color="black" />
        </mesh>
      ))}
    </group>
  )
}
