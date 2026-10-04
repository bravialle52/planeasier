import React from 'react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import type { PlacedObject } from '../../../store/editorStore'

interface MeshProps {
  obj: PlacedObject
}

// 🛋️ Диван (Режим макета: белые грани, черные ребра)
export const SofaMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'

  const armWidth = 0.2
  const seatHeight = height * 0.45
  const backHeight = height * 0.55
  const backThickness = 0.22

  return (
    <group>
      {/* Base platform */}
      <mesh position={[0, -height / 2 + 0.1, 0]}>
        <boxGeometry args={[width, 0.2, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* Seat Cushions */}
      <mesh position={[0, -height / 2 + seatHeight * 0.7, backThickness / 3]}>
        <boxGeometry args={[width - armWidth * 2 - 0.04, seatHeight * 0.6, depth - backThickness - 0.05]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* Backrest */}
      <mesh position={[0, height / 2 - backHeight / 2, -depth / 2 + backThickness / 2]}>
        <boxGeometry args={[width, backHeight, backThickness]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* Left Armrest */}
      <mesh position={[-width / 2 + armWidth / 2, 0, 0.05]}>
        <boxGeometry args={[armWidth, height * 0.8, depth * 0.9]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* Right Armrest */}
      <mesh position={[width / 2 - armWidth / 2, 0, 0.05]}>
        <boxGeometry args={[armWidth, height * 0.8, depth * 0.9]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* 4 Feet */}
      {[
        [-width / 2 + 0.1, -height / 2 + 0.04, -depth / 2 + 0.1],
        [width / 2 - 0.1, -height / 2 + 0.04, -depth / 2 + 0.1],
        [-width / 2 + 0.1, -height / 2 + 0.04, depth / 2 - 0.1],
        [width / 2 - 0.1, -height / 2 + 0.04, depth / 2 - 0.1]
      ].map((pos, idx) => (
        <mesh key={idx} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.03, 0.02, 0.08, 16]} />
          <meshStandardMaterial color={color} roughness={0.6} />
          <Edges color="#000000" />
        </mesh>
      ))}
    </group>
  )
}

// 🛏️ Кровать
export const BedMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'

  const headboardHeight = height
  const frameHeight = height * 0.35
  const isDouble = obj.type === 'bed_double'

  return (
    <group>
      {/* Frame base */}
      <mesh position={[0, -height / 2 + frameHeight / 2, 0]}>
        <boxGeometry args={[width, frameHeight, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* Headboard */}
      <mesh position={[0, 0, -depth / 2 + 0.06]}>
        <boxGeometry args={[width + 0.05, headboardHeight, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* Mattress */}
      <mesh position={[0, -height / 2 + frameHeight + 0.12, 0.05]}>
        <boxGeometry args={[width - 0.08, 0.24, depth - 0.2]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* Pillows */}
      {isDouble ? (
        <>
          <mesh position={[-width * 0.25, -height / 2 + frameHeight + 0.28, -depth / 2 + 0.4]}>
            <boxGeometry args={[width * 0.4, 0.1, 0.35]} />
            <meshStandardMaterial color={color} roughness={0.6} />
            <Edges color="#000000" threshold={15} />
          </mesh>
          <mesh position={[width * 0.25, -height / 2 + frameHeight + 0.28, -depth / 2 + 0.4]}>
            <boxGeometry args={[width * 0.4, 0.1, 0.35]} />
            <meshStandardMaterial color={color} roughness={0.6} />
            <Edges color="#000000" threshold={15} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, -height / 2 + frameHeight + 0.28, -depth / 2 + 0.4]}>
          <boxGeometry args={[width * 0.7, 0.1, 0.35]} />
          <meshStandardMaterial color={color} roughness={0.6} />
          <Edges color="#000000" threshold={15} />
        </mesh>
      )}

      {/* Blanket */}
      <mesh position={[0, -height / 2 + frameHeight + 0.25, depth * 0.12]}>
        <boxGeometry args={[width - 0.06, 0.04, depth * 0.65]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>
    </group>
  )
}

// 🪑 Стол (обеденный / рабочий / журнальный)
export const TableMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const isDesk = obj.type === 'desk'
  const isCoffee = obj.type === 'coffee_table'
  const color = obj.color || '#ffffff'
  const topThickness = isCoffee ? 0.03 : 0.05
  const legThickness = 0.05

  return (
    <group>
      {/* Table top */}
      <mesh position={[0, height / 2 - topThickness / 2, 0]}>
        <boxGeometry args={[width, topThickness, depth]} />
        <meshStandardMaterial color={color} roughness={0.5} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* 4 Legs */}
      {[
        [-width / 2 + legThickness, 0, -depth / 2 + legThickness],
        [width / 2 - legThickness, 0, -depth / 2 + legThickness],
        [-width / 2 + legThickness, 0, depth / 2 - legThickness],
        [width / 2 - legThickness, 0, depth / 2 - legThickness]
      ].map((pos, idx) => (
        <mesh key={idx} position={pos as [number, number, number]}>
          <boxGeometry args={[legThickness, height - topThickness, legThickness]} />
          <meshStandardMaterial color={color} roughness={0.5} />
          <Edges color="#000000" threshold={15} />
        </mesh>
      ))}

      {/* Desk Drawer Unit */}
      {isDesk && (
        <mesh position={[width / 2 - 0.25, 0, 0]}>
          <boxGeometry args={[0.35, height * 0.7, depth * 0.8]} />
          <meshStandardMaterial color={color} roughness={0.5} />
          <Edges color="#000000" threshold={15} />
        </mesh>
      )}

      {/* Coffee table lower shelf */}
      {isCoffee && (
        <mesh position={[0, -height / 4, 0]}>
          <boxGeometry args={[width * 0.8, 0.02, depth * 0.7]} />
          <meshStandardMaterial color={color} roughness={0.5} />
          <Edges color="#000000" threshold={15} />
        </mesh>
      )}
    </group>
  )
}

// 🪑 Стул
export const ChairMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const isOffice = obj.type === 'office_chair'
  const color = obj.color || '#ffffff'

  if (isOffice) {
    return (
      <group>
        {/* Base */}
        <mesh position={[0, -height / 2 + 0.06, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.03, 8]} />
          <meshStandardMaterial color={color} roughness={0.5} />
          <Edges color="#000000" />
        </mesh>
        {/* Column */}
        <mesh position={[0, -height / 2 + 0.2, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.25, 16]} />
          <meshStandardMaterial color={color} roughness={0.5} />
          <Edges color="#000000" />
        </mesh>
        {/* Seat */}
        <mesh position={[0, -height / 2 + 0.35, 0]}>
          <boxGeometry args={[width * 0.85, 0.08, depth * 0.85]} />
          <meshStandardMaterial color={color} roughness={0.6} />
          <Edges color="#000000" threshold={15} />
        </mesh>
        {/* Backrest */}
        <mesh position={[0, 0.1, -depth * 0.35]}>
          <boxGeometry args={[width * 0.8, height * 0.45, 0.04]} />
          <meshStandardMaterial color={color} roughness={0.6} />
          <Edges color="#000000" threshold={15} />
        </mesh>
        {/* Armrests */}
        <mesh position={[-width * 0.4, -0.05, 0]}>
          <boxGeometry args={[0.05, 0.2, depth * 0.5]} />
          <meshStandardMaterial color={color} roughness={0.6} />
          <Edges color="#000000" threshold={15} />
        </mesh>
        <mesh position={[width * 0.4, -0.05, 0]}>
          <boxGeometry args={[0.05, 0.2, depth * 0.5]} />
          <meshStandardMaterial color={color} roughness={0.6} />
          <Edges color="#000000" threshold={15} />
        </mesh>
      </group>
    )
  }

  // Dining chair
  const seatY = -height / 2 + height * 0.45
  return (
    <group>
      {/* 4 Legs */}
      {[
        [-width / 2 + 0.04, -height / 4, -depth / 2 + 0.04],
        [width / 2 - 0.04, -height / 4, -depth / 2 + 0.04],
        [-width / 2 + 0.04, -height / 4, depth / 2 - 0.04],
        [width / 2 - 0.04, -height / 4, depth / 2 - 0.04]
      ].map((pos, idx) => (
        <mesh key={idx} position={pos as [number, number, number]}>
          <boxGeometry args={[0.04, height * 0.45, 0.04]} />
          <meshStandardMaterial color={color} roughness={0.6} />
          <Edges color="#000000" threshold={15} />
        </mesh>
      ))}

      {/* Seat */}
      <mesh position={[0, seatY, 0]}>
        <boxGeometry args={[width, 0.04, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* Backrest */}
      <mesh position={[0, seatY + (height * 0.5) / 2 + 0.02, -depth / 2 + 0.02]}>
        <boxGeometry args={[width * 0.9, height * 0.48, 0.03]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>
    </group>
  )
}

// 📺 ТВ-Тумба и Экран
export const TVUnitMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'
  const benchHeight = height * 0.45

  return (
    <group>
      {/* Console bench */}
      <mesh position={[0, -height / 2 + benchHeight / 2, 0]}>
        <boxGeometry args={[width, benchHeight, depth]} />
        <meshStandardMaterial color={color} roughness={0.5} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* TV Stand foot */}
      <mesh position={[0, -height / 2 + benchHeight + 0.02, 0]}>
        <boxGeometry args={[width * 0.4, 0.02, depth * 0.4]} />
        <meshStandardMaterial color={color} roughness={0.5} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      {/* TV Neck */}
      <mesh position={[0, -height / 2 + benchHeight + 0.08, 0]}>
        <boxGeometry args={[0.08, 0.12, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.5} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* Flat Screen Frame */}
      <mesh position={[0, height * 0.18, 0]}>
        <boxGeometry args={[width * 0.85, height * 0.5, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.5} />
        <Edges color="#000000" threshold={15} />
      </mesh>
    </group>
  )
}

// 📚 Книжный стеллаж
export const BookshelfMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'

  return (
    <group>
      {/* Sides, Top, Bottom, Back */}
      <mesh position={[-width / 2 + 0.02, 0, 0]}>
        <boxGeometry args={[0.04, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      <mesh position={[width / 2 - 0.02, 0, 0]}>
        <boxGeometry args={[0.04, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      <mesh position={[0, height / 2 - 0.02, 0]}>
        <boxGeometry args={[width, 0.04, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      <mesh position={[0, -height / 2 + 0.02, 0]}>
        <boxGeometry args={[width, 0.04, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      <mesh position={[0, 0, -depth / 2 + 0.01]}>
        <boxGeometry args={[width, height, 0.02]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* Shelves */}
      {[-height * 0.25, 0, height * 0.25].map((y, idx) => (
        <mesh key={idx} position={[0, y, 0]}>
          <boxGeometry args={[width - 0.08, 0.03, depth - 0.02]} />
          <meshStandardMaterial color={color} roughness={0.6} />
          <Edges color="#000000" threshold={15} />
        </mesh>
      ))}
    </group>
  )
}

// 🚪 Шкаф-купе
export const WardrobeMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'

  return (
    <group>
      {/* Box */}
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>

      {/* Center divide line */}
      <mesh position={[0, 0, depth / 2 + 0.005]}>
        <boxGeometry args={[0.01, height * 0.95, 0.01]} />
        <meshStandardMaterial color={color} roughness={0.2} />
        <Edges color="#000000" />
      </mesh>

      {/* Handles */}
      <mesh position={[-0.04, 0, depth / 2 + 0.02]}>
        <boxGeometry args={[0.02, 0.3, 0.02]} />
        <meshStandardMaterial color={color} roughness={0.2} />
        <Edges color="#000000" />
      </mesh>
      <mesh position={[0.04, 0, depth / 2 + 0.02]}>
        <boxGeometry args={[0.02, 0.3, 0.02]} />
        <meshStandardMaterial color={color} roughness={0.2} />
        <Edges color="#000000" />
      </mesh>
    </group>
  )
}

// 🍳 Кухонный гарнитур
export const KitchenCounterMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'

  return (
    <group>
      {/* Base cabinets */}
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[width, height - 0.05, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      {/* Countertop */}
      <mesh position={[0, height / 2 - 0.02, 0.02]}>
        <boxGeometry args={[width + 0.04, 0.04, depth + 0.04]} />
        <meshStandardMaterial color={color} roughness={0.4} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      {/* Sink Basin */}
      <mesh position={[-width * 0.2, height / 2 - 0.01, 0]}>
        <boxGeometry args={[0.6, 0.02, 0.45]} />
        <meshStandardMaterial color={color} roughness={0.4} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      {/* Faucet */}
      <mesh position={[-width * 0.2, height / 2 + 0.12, -0.15]}>
        <cylinderGeometry args={[0.015, 0.015, 0.25]} />
        <meshStandardMaterial color={color} roughness={0.4} />
        <Edges color="#000000" />
      </mesh>
    </group>
  )
}

// ❄️ Холодильник
export const FridgeMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'

  return (
    <group>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.5} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      {/* Freezer door divide line */}
      <mesh position={[0, height * 0.15, depth / 2 + 0.005]}>
        <boxGeometry args={[width * 0.96, 0.01, 0.01]} />
        <meshStandardMaterial color={color} roughness={0.2} />
        <Edges color="#000000" />
      </mesh>
      {/* Handles */}
      <mesh position={[width * 0.38, height * 0.25, depth / 2 + 0.02]}>
        <boxGeometry args={[0.02, 0.2, 0.02]} />
        <meshStandardMaterial color={color} roughness={0.2} />
        <Edges color="#000000" />
      </mesh>
      <mesh position={[width * 0.38, -height * 0.1, depth / 2 + 0.02]}>
        <boxGeometry args={[0.02, 0.35, 0.02]} />
        <meshStandardMaterial color={color} roughness={0.2} />
        <Edges color="#000000" />
      </mesh>
    </group>
  )
}

// 🛁 Ванна
export const BathtubMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'

  return (
    <group>
      {/* Outer shell */}
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.4} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      {/* Inner tub cavity */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[width - 0.2, height - 0.05, depth - 0.2]} />
        <meshStandardMaterial color={color} roughness={0.4} />
        <Edges color="#000000" threshold={15} />
      </mesh>
    </group>
  )
}

// 🚰 Раковина с тумбой
export const SinkMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'

  return (
    <group>
      {/* Vanity Cabinet */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[width, height - 0.1, depth]} />
        <meshStandardMaterial color={color} roughness={0.5} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      {/* Basin */}
      <mesh position={[0, height / 2 - 0.04, 0]}>
        <boxGeometry args={[width * 0.8, 0.08, depth * 0.8]} />
        <meshStandardMaterial color={color} roughness={0.3} />
        <Edges color="#000000" threshold={15} />
      </mesh>
    </group>
  )
}

// 🚽 Унитаз
export const ToiletMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'

  return (
    <group>
      {/* Base */}
      <mesh position={[0, -height * 0.2, depth * 0.1]}>
        <boxGeometry args={[width * 0.8, height * 0.5, depth * 0.7]} />
        <meshStandardMaterial color={color} roughness={0.4} />
        <Edges color="#000000" threshold={15} />
      </mesh>
      {/* Tank */}
      <mesh position={[0, height * 0.15, -depth * 0.25]}>
        <boxGeometry args={[width * 0.9, height * 0.65, depth * 0.35]} />
        <meshStandardMaterial color={color} roughness={0.4} />
        <Edges color="#000000" threshold={15} />
      </mesh>
    </group>
  )
}

// 📦 Складской стеллаж
export const RackMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height, depth] = obj.scale
  const color = obj.color || '#ffffff'
  const postThick = 0.06

  return (
    <group>
      {/* 4 Corner Uprights */}
      {[
        [-width / 2 + postThick / 2, 0, -depth / 2 + postThick / 2],
        [width / 2 - postThick / 2, 0, -depth / 2 + postThick / 2],
        [-width / 2 + postThick / 2, 0, depth / 2 - postThick / 2],
        [width / 2 - postThick / 2, 0, depth / 2 - postThick / 2]
      ].map((pos, idx) => (
        <mesh key={idx} position={pos as [number, number, number]}>
          <boxGeometry args={[postThick, height, postThick]} />
          <meshStandardMaterial color={color} roughness={0.5} />
          <Edges color="#000000" threshold={15} />
        </mesh>
      ))}

      {/* 4 Shelves */}
      {[-height * 0.35, -height * 0.1, height * 0.15, height * 0.4].map((y, idx) => (
        <mesh key={idx} position={[0, y, 0]}>
          <boxGeometry args={[width - 0.02, 0.04, depth - 0.02]} />
          <meshStandardMaterial color={color} roughness={0.5} />
          <Edges color="#000000" threshold={15} />
        </mesh>
      ))}
    </group>
  )
}

// 💡 Люстра потолочная
export const CeilingLampMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height] = obj.scale
  const color = obj.color || '#ffffff'

  return (
    <group>
      {/* Canopy */}
      <mesh position={[0, height / 2 - 0.02, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.04, 16]} />
        <meshStandardMaterial color={color} roughness={0.5} />
        <Edges color="#000000" />
      </mesh>
      {/* Cord */}
      <mesh position={[0, height * 0.1, 0]}>
        <cylinderGeometry args={[0.008, 0.008, height * 0.6, 8]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      {/* Lampshade */}
      <mesh position={[0, -height / 2 + 0.15, 0]}>
        <coneGeometry args={[width / 2, 0.3, 16, 1, true]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.5} />
        <Edges color="#000000" />
      </mesh>
      {/* Bulb */}
      <mesh position={[0, -height / 2 + 0.12, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

// 💡 Торшер напольный
export const FloorLampMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height] = obj.scale
  const color = obj.color || '#ffffff'

  return (
    <group>
      {/* Base */}
      <mesh position={[0, -height / 2 + 0.02, 0]}>
        <cylinderGeometry args={[width / 2, width / 2, 0.04, 24]} />
        <meshStandardMaterial color={color} roughness={0.5} />
        <Edges color="#000000" />
      </mesh>
      {/* Pole */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, height - 0.4, 16]} />
        <meshStandardMaterial color={color} roughness={0.5} />
        <Edges color="#000000" />
      </mesh>
      {/* Lampshade */}
      <mesh position={[0, height / 2 - 0.2, 0]}>
        <cylinderGeometry args={[width * 0.45, width * 0.45, 0.35, 24, 1, true]} />
        <meshStandardMaterial color={color} roughness={0.5} side={THREE.DoubleSide} />
        <Edges color="#000000" />
      </mesh>
    </group>
  )
}

// 🌿 Растение
export const PlantMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, height] = obj.scale
  const potHeight = height * 0.45
  const color = obj.color || '#ffffff'

  return (
    <group>
      {/* Pot */}
      <mesh position={[0, -height / 2 + potHeight / 2, 0]}>
        <cylinderGeometry args={[width * 0.4, width * 0.3, potHeight, 16]} />
        <meshStandardMaterial color={color} roughness={0.5} />
        <Edges color="#000000" />
      </mesh>
      {/* Soil */}
      <mesh position={[0, -height / 2 + potHeight - 0.02, 0]}>
        <cylinderGeometry args={[width * 0.38, width * 0.38, 0.02, 16]} />
        <meshStandardMaterial color={color} roughness={0.8} />
        <Edges color="#000000" />
      </mesh>
      {/* Leaves */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i * Math.PI * 2) / 5
        const rotX = 0.3 + (i % 2) * 0.2
        return (
          <mesh 
            key={i} 
            position={[Math.cos(angle) * 0.08, height * 0.05, Math.sin(angle) * 0.08]} 
            rotation={[rotX * Math.sin(angle), angle, rotX * Math.cos(angle)]}
          >
            <sphereGeometry args={[width * 0.25, 8, 8]} />
            <meshStandardMaterial color={color} roughness={0.6} />
            <Edges color="#000000" />
          </mesh>
        )
      })}
    </group>
  )
}

// 🧶 Ковер
export const CarpetMesh: React.FC<MeshProps> = ({ obj }) => {
  const [width, , depth] = obj.scale
  const color = obj.color || '#ffffff'

  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[width, 0.02, depth]} />
      <meshStandardMaterial color={color} roughness={0.8} />
      <Edges color="#000000" />
    </mesh>
  )
}
