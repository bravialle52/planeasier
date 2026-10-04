import React from 'react'
import { Edges } from '@react-three/drei'

export const Block: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <mesh position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="white" />
      <Edges color="black" />
    </mesh>
  )
}
