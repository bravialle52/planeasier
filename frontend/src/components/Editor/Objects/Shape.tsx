import React from 'react'
import { Edges } from '@react-three/drei'
import type { PlacedObject } from '../../../store/editorStore'
import { WallMesh, FloorMesh, RoofMesh, WindowMesh, DoorMesh, BlockMesh, OpeningMesh } from './ArchitecturalMeshes'
import { StairsMesh, CurtainMesh, CorniceMesh, SconceMesh, ChandelierMesh } from './DecorMeshes'
import {
  SofaMesh,
  BedMesh,
  TableMesh,
  ChairMesh,
  TVUnitMesh,
  BookshelfMesh,
  WardrobeMesh,
  KitchenCounterMesh,
  FridgeMesh,
  BathtubMesh,
  SinkMesh,
  ToiletMesh,
  RackMesh,
  CeilingLampMesh,
  FloorLampMesh,
  PlantMesh,
  CarpetMesh
} from './FurnitureMeshes'

interface ShapeProps {
  obj: PlacedObject
  isGhost?: boolean
}

export const Shape: React.FC<ShapeProps> = ({ obj, isGhost }) => {
  const color = obj.color || '#ffffff'

  switch (obj.type) {
    // Architectural elements
    case 'wall':
    case 'partition':
      return <WallMesh obj={obj} isGhost={isGhost} />
    case 'floor':
      return <FloorMesh obj={obj} isGhost={isGhost} />
    case 'roof':
      return <RoofMesh obj={obj} />
    case 'window':
    case 'panoramic_window':
      return <WindowMesh obj={obj} isGhost={isGhost} />
    case 'door':
    case 'double_door':
    case 'arch':
      return <DoorMesh obj={obj} isGhost={isGhost} />
    case 'opening':
      return <OpeningMesh obj={obj} isGhost={isGhost} />
    case 'stairs_straight':
    case 'stairs_l':
    case 'stairs_spiral':
      return <StairsMesh obj={obj} />
    case 'curtain':
      return <CurtainMesh obj={obj} />
    case 'cornice':
      return <CorniceMesh obj={obj} />
    case 'sconce':
      return <SconceMesh obj={obj} />
    case 'chandelier':
      return <ChandelierMesh obj={obj} />

    // Living room
    case 'sofa':
    case 'armchair':
      return <SofaMesh obj={obj} />
    case 'coffee_table':
      return <TableMesh obj={obj} />
    case 'tv_unit':
      return <TVUnitMesh obj={obj} />
    case 'bookshelf':
      return <BookshelfMesh obj={obj} />
    case 'carpet':
      return <CarpetMesh obj={obj} />

    // Bedroom
    case 'bed_double':
    case 'bed_single':
      return <BedMesh obj={obj} />
    case 'wardrobe':
    case 'nightstand':
      return obj.type === 'wardrobe' ? <WardrobeMesh obj={obj} /> : <TableMesh obj={obj} />

    // Kitchen & Dining
    case 'dining_table':
    case 'desk':
      return <TableMesh obj={obj} />
    case 'chair':
    case 'office_chair':
      return <ChairMesh obj={obj} />
    case 'kitchen_counter':
      return <KitchenCounterMesh obj={obj} />
    case 'fridge':
      return <FridgeMesh obj={obj} />

    // Bathroom
    case 'bathtub':
      return <BathtubMesh obj={obj} />
    case 'sink':
      return <SinkMesh obj={obj} />
    case 'toilet':
      return <ToiletMesh obj={obj} />

    // Warehouse & Office
    case 'rack':
      return <RackMesh obj={obj} />

    // Decor & Lighting
    case 'ceiling_lamp':
      return <CeilingLampMesh obj={obj} />
    case 'floor_lamp':
      return <FloorLampMesh obj={obj} />
    case 'plant':
      return <PlantMesh obj={obj} />

    // Primitives
    case 'cylinder':
      return (
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[obj.scale[0] / 2, obj.scale[0] / 2, obj.scale[1], 32]} />
          <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
          <Edges color="#000000" />
        </mesh>
      )
    case 'sphere':
      return (
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[obj.scale[0] / 2, 32, 32]} />
          <meshStandardMaterial color={color} roughness={0.2} metalness={0} />
          <Edges color="#000000" />
        </mesh>
      )
    case 'block':
    default:
      return <BlockMesh obj={obj} isGhost={isGhost} />
  }
}
