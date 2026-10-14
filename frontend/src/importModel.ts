import { unzipSync } from 'fflate'
import { createExtractorFromData } from 'node-unrar-js'
import unrarWasmUrl from 'node-unrar-js/esm/js/unrar.wasm?url'
import { maxToGlb } from './importMax'

const WHITE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

/** A glTF was chosen without the .bin (or other buffer) that sits next to it. */
export class MissingBufferError extends Error {
  fileName: string
  constructor(fileName: string) {
    super(fileName)
    this.fileName = fileName
  }
}

/** The archive or the Max scene did not contain a mesh we could read. */
export class UnreadableModelError extends Error {}

function fileNameOf(uri: string): string {
  const clean = uri.split('?')[0].split('#')[0]
  return decodeURIComponent(clean.split(/[/\\]/).pop() || clean).toLowerCase()
}

function baseName(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() || path
}

let unrarWasm: Promise<ArrayBuffer> | null = null

/** The RAR decoder is WebAssembly, loaded once from the app bundle. */
function loadUnrarWasm() {
  if (!unrarWasm) {
    unrarWasm = fetch(unrarWasmUrl).then(response => {
      if (!response.ok) throw new Error('wasm')
      return response.arrayBuffer()
    })
  }
  return unrarWasm
}

/** Files inside a .rar, using each file's own name so a glTF can find its .bin. */
async function expandRar(file: File): Promise<File[]> {
  const extractor = await createExtractorFromData({
    data: await file.arrayBuffer(),
    wasmBinary: await loadUnrarWasm()
  })
  const opened: File[] = []
  for (const entry of extractor.extract().files) {
    if (entry.fileHeader.flags.directory || !entry.extraction) continue
    const bytes = entry.extraction
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    opened.push(new File([copy], baseName(entry.fileHeader.name)))
  }
  return opened
}

/** Files inside a .zip. */
async function expandZip(file: File): Promise<File[]> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const opened: File[] = []
  for (const [path, bytes] of Object.entries(entries)) {
    if (path.endsWith('/')) continue
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    opened.push(new File([copy], baseName(path)))
  }
  return opened
}

function pad4(length: number) {
  return (4 - (length % 4)) % 4
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let cursor = 0
  for (const part of parts) {
    out.set(part, cursor)
    cursor += part.length
  }
  return out
}

/** glTF json plus one binary chunk. Images sit in that same chunk, so nothing is fetched later. */
function encodeGlb(json: object, bin: Uint8Array): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json))
  const jsonPad = pad4(jsonBytes.length)
  const binPad = pad4(bin.length)
  const binLength = bin.length + binPad
  const total = 12 + 8 + jsonBytes.length + jsonPad + 8 + binLength
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, total, true)
  view.setUint32(12, jsonBytes.length + jsonPad, true)
  view.setUint32(16, 0x4e4f534a, true)
  out.set(jsonBytes, 20)
  out.fill(0x20, 20 + jsonBytes.length, 20 + jsonBytes.length + jsonPad)
  const binHeader = 20 + jsonBytes.length + jsonPad
  view.setUint32(binHeader, binLength, true)
  view.setUint32(binHeader + 4, 0x004e4942, true)
  out.set(bin, binHeader + 8)
  return out.buffer
}

/** One GLB: the .bin and the pictures from the archive are stored inside the file. */
async function embedGltf(files: File[], gltf: File): Promise<File> {
  const json = JSON.parse(await gltf.text()) as {
    buffers?: { uri?: string; byteLength?: number }[]
    images?: { uri?: string; bufferView?: number; mimeType?: string }[]
    bufferViews?: { buffer: number; byteOffset?: number; byteLength: number }[]
  }
  const byName = new Map(files.map(file => [file.name.toLowerCase(), file]))
  const parts: Uint8Array[] = []
  let cursor = 0
  const push = (bytes: Uint8Array) => {
    const padding = pad4(cursor)
    if (padding) {
      parts.push(new Uint8Array(padding))
      cursor += padding
    }
    const start = cursor
    parts.push(bytes)
    cursor += bytes.length
    return start
  }
  json.bufferViews = json.bufferViews || []
  for (const buffer of json.buffers || []) {
    if (!buffer.uri || buffer.uri.startsWith('data:')) continue
    const sibling = byName.get(fileNameOf(buffer.uri))
    if (!sibling) throw new MissingBufferError(fileNameOf(buffer.uri))
    push(new Uint8Array(await sibling.arrayBuffer()))
    delete buffer.uri
  }
  for (const image of json.images || []) {
    if (!image.uri || image.uri.startsWith('data:')) continue
    const sibling = byName.get(fileNameOf(image.uri))
    const bytes = sibling ? new Uint8Array(await sibling.arrayBuffer()) : Uint8Array.from(atob(WHITE_PNG.split(',')[1]), char => char.charCodeAt(0))
    const start = push(bytes)
    image.bufferView = json.bufferViews.length
    image.mimeType = (image.uri || '').toLowerCase().endsWith('.jpg') || (image.uri || '').toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'image/png'
    delete image.uri
    json.bufferViews.push({ buffer: 0, byteOffset: start, byteLength: bytes.length })
  }
  json.buffers = [{ byteLength: cursor }]
  const base = gltf.name.replace(/\.gltf$/i, '') || 'model'
  return new File([encodeGlb(json, concatBytes(parts))], `${base}.glb`, { type: 'model/gltf-binary' })
}

async function expandOne(file: File): Promise<File[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.rar')) return expandRar(file)
  if (name.endsWith('.zip')) return expandZip(file)
  return [file]
}

/**
 * Turn whatever the user picked into files the editor can place.
 * An archive is unpacked first. A .max scene is converted to GLB. A glTF keeps its .bin and images.
 */
export async function packUploads(files: File[]): Promise<File[]> {
  const expanded: File[] = []
  for (const file of files) expanded.push(...await expandOne(file))
  if (expanded.length === 0) throw new UnreadableModelError()
  const lower = (file: File) => file.name.toLowerCase()
  const packed: File[] = []
  for (const gltf of expanded.filter(file => lower(file).endsWith('.gltf'))) packed.push(await embedGltf(expanded, gltf))
  packed.push(...expanded.filter(file => /\.(glb|fbx|obj)$/i.test(file.name)))
  for (const max of expanded.filter(file => lower(file).endsWith('.max'))) packed.push(await maxToGlb(max))
  if (packed.length === 0) throw new UnreadableModelError()
  return packed
}
