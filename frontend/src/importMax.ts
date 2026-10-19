interface Chunk {
  type: number
  children: Chunk[]
  data: Uint8Array | null
}

/** Read one OLE stream. 3ds Max keeps the geometry in the stream named Scene. */
function readOleStream(file: Uint8Array, streamName: string): Uint8Array | null {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength)
  const sectorSize = 1 << view.getUint16(0x1e, true)
  const fat: number[] = []
  for (let index = 0; index < 109; index++) {
    const sector = view.getUint32(0x4c + index * 4, true)
    if (sector === 0xffffffff) break
    const offset = (sector + 1) * sectorSize
    for (let byte = 0; byte < sectorSize; byte += 4) fat.push(view.getUint32(offset + byte, true))
  }
  const readChain = (start: number, size: number) => {
    const parts: Uint8Array[] = []
    let sector = start
    let got = 0
    const seen = new Set<number>()
    while (sector < 0xfffffff0 && !seen.has(sector) && got < size) {
      seen.add(sector)
      const offset = (sector + 1) * sectorSize
      parts.push(file.subarray(offset, offset + sectorSize))
      got += sectorSize
      sector = fat[sector] ?? 0xfffffffe
    }
    const joined = new Uint8Array(Math.min(got, size))
    let cursor = 0
    for (const part of parts) {
      const take = Math.min(part.length, joined.length - cursor)
      joined.set(part.subarray(0, take), cursor)
      cursor += take
    }
    return joined
  }
  const directory = readChain(view.getUint32(0x30, true), sectorSize * 8)
  const dirView = new DataView(directory.buffer, directory.byteOffset, directory.byteLength)
  for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
    const nameLength = dirView.getUint16(offset + 64, true)
    if (nameLength < 4) continue
    const name = new TextDecoder('utf-16le').decode(directory.subarray(offset, offset + nameLength - 2))
    if (name !== streamName) continue
    return readChain(dirView.getUint32(offset + 116, true), dirView.getUint32(offset + 120, true))
  }
  return null
}

/** Max scene chunks: a negative size means the payload is more chunks. */
function readChunks(data: Uint8Array): Chunk[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const chunks: Chunk[] = []
  let offset = 0
  while (offset + 6 <= data.length) {
    const type = view.getUint16(offset, true)
    let size = view.getInt32(offset + 2, true)
    let header = 6
    let chunkSize = size & 0x7fffffff
    if (size === 0) {
      const big = view.getBigInt64(offset + 6, true)
      header = 14
      chunkSize = Number(big & 0x7fffffffffffffffn)
      size = big < 0n ? -1 : 1
    }
    if (chunkSize < header || offset + chunkSize > data.length) break
    const payload = data.subarray(offset + header, offset + chunkSize)
    chunks.push({
      type,
      children: size < 0 ? readChunks(payload) : [],
      data: size < 0 ? null : payload
    })
    offset += chunkSize
  }
  return chunks
}

function findAll(chunks: Chunk[], type: number, found: Chunk[] = []): Chunk[] {
  for (const chunk of chunks) {
    if (chunk.type === type) found.push(chunk)
    if (chunk.children.length > 0) findAll(chunk.children, type, found)
  }
  return found
}

/** Positions stored as a skipped integer plus three floats. Max is Z-up, the editor is Y-up. */
function readPositions(data: Uint8Array, into: number[]) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let offset = 4
  while (offset + 16 <= data.length) {
    offset += 4
    into.push(view.getFloat32(offset, true), view.getFloat32(offset + 8, true), -view.getFloat32(offset + 4, true))
    offset += 12
  }
}

/** Polygon corners. Each record is a count, the indices, then a flag word that adds optional fields. */
function readPolygons(data: Uint8Array): number[][] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const polygons: number[][] = []
  let offset = 4
  while (offset + 8 <= data.length) {
    const count = view.getInt32(offset, true)
    offset += 4
    if (count < 3 || count > 16 || offset + count * 4 + 2 > data.length) break
    const corners: number[] = []
    for (let index = 0; index < count; index++) {
      corners.push(view.getInt32(offset, true))
      offset += 4
    }
    const flags = view.getUint16(offset, true)
    offset += 2
    if (flags & 0x01) offset += 4
    if (flags & 0x08) offset += 2
    if (flags & 0x10) offset += 4
    if (flags & 0x20) offset += 8 * (count - 3)
    polygons.push(corners)
  }
  return polygons
}

function buildNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
  const normals = new Float32Array(positions.length)
  for (let index = 0; index < indices.length; index += 3) {
    const a = indices[index] * 3
    const b = indices[index + 1] * 3
    const c = indices[index + 2] * 3
    const ax = positions[b] - positions[a]
    const ay = positions[b + 1] - positions[a + 1]
    const az = positions[b + 2] - positions[a + 2]
    const bx = positions[c] - positions[a]
    const by = positions[c + 1] - positions[a + 1]
    const bz = positions[c + 2] - positions[a + 2]
    const nx = ay * bz - az * by
    const ny = az * bx - ax * bz
    const nz = ax * by - ay * bx
    normals[a] += nx
    normals[a + 1] += ny
    normals[a + 2] += nz
    normals[b] += nx
    normals[b + 1] += ny
    normals[b + 2] += nz
    normals[c] += nx
    normals[c + 1] += ny
    normals[c + 2] += nz
  }
  for (let index = 0; index < normals.length; index += 3) {
    const length = Math.hypot(normals[index], normals[index + 1], normals[index + 2]) || 1
    normals[index] /= length
    normals[index + 1] /= length
    normals[index + 2] /= length
  }
  return normals
}

/** A binary glTF with one mesh, so the editor loader does not need a second file. */
function encodeGlb(positions: Float32Array, normals: Float32Array, indices: Uint32Array): ArrayBuffer {
  let min = [Infinity, Infinity, Infinity]
  let max = [-Infinity, -Infinity, -Infinity]
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], positions[index + axis])
      max[axis] = Math.max(max[axis], positions[index + axis])
    }
  }
  const positionBytes = positions.byteLength
  const normalOffset = (positionBytes + 3) & ~3
  const indexOffset = (normalOffset + normals.byteLength + 3) & ~3
  const binLength = (indexOffset + indices.byteLength + 3) & ~3
  const bin = new Uint8Array(binLength)
  bin.set(new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength), 0)
  bin.set(new Uint8Array(normals.buffer, normals.byteOffset, normals.byteLength), normalOffset)
  bin.set(new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength), indexOffset)
  const json = JSON.stringify({
    asset: { version: '2.0', generator: 'planeasier' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.86, 0.89, 0.93, 1], metallicFactor: 0, roughnessFactor: 0.55 } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0, mode: 4 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5125, count: indices.length, type: 'SCALAR' }
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionBytes, target: 34962 },
      { buffer: 0, byteOffset: normalOffset, byteLength: normals.byteLength, target: 34962 },
      { buffer: 0, byteOffset: indexOffset, byteLength: indices.byteLength, target: 34963 }
    ],
    buffers: [{ byteLength: binLength }]
  })
  const jsonBytes = new TextEncoder().encode(json)
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4
  const total = 12 + 8 + jsonBytes.length + jsonPad + 8 + binLength
  const out = new ArrayBuffer(total)
  const header = new DataView(out)
  header.setUint32(0, 0x46546c67, true)
  header.setUint32(4, 2, true)
  header.setUint32(8, total, true)
  header.setUint32(12, jsonBytes.length + jsonPad, true)
  header.setUint32(16, 0x4e4f534a, true)
  new Uint8Array(out).set(jsonBytes, 20)
  new Uint8Array(out).fill(0x20, 20 + jsonBytes.length, 20 + jsonBytes.length + jsonPad)
  const binHeader = 20 + jsonBytes.length + jsonPad
  header.setUint32(binHeader, binLength, true)
  header.setUint32(binHeader + 4, 0x004e4942, true)
  new Uint8Array(out).set(bin, binHeader + 8)
  return out
}

/** Convert a 3ds Max scene into a GLB the same loader already understands. */
export async function maxToGlb(file: File): Promise<File> {
  const scene = readOleStream(new Uint8Array(await file.arrayBuffer()), 'Scene')
  if (!scene) throw new Error('max')
  const positions: number[] = []
  const indices: number[] = []
  for (const poly of findAll(readChunks(scene), 0x08fe)) {
    const coordinates = poly.children.find(child => child.type === 0x0100 && child.data)
    const faces = poly.children.find(child => child.type === 0x011a && child.data)
    if (!coordinates?.data || !faces?.data) continue
    const base = positions.length / 3
    const before = positions.length
    readPositions(coordinates.data, positions)
    const vertexCount = (positions.length - before) / 3
    for (const corners of readPolygons(faces.data)) {
      if (corners.some(index => index < 0 || index >= vertexCount)) continue
      for (let corner = 1; corner < corners.length - 1; corner++) {
        indices.push(base + corners[0], base + corners[corner], base + corners[corner + 1])
      }
    }
  }
  if (positions.length === 0 || indices.length === 0) throw new Error('max')
  const positionArray = new Float32Array(positions)
  const indexArray = new Uint32Array(indices)
  const binary = encodeGlb(positionArray, buildNormals(positionArray, indexArray), indexArray)
  const base = file.name.replace(/\.max$/i, '') || 'model'
  return new File([binary], `${base}.glb`, { type: 'model/gltf-binary' })
}
