// One-time asset preprocessing: slices the sourced brain mesh (public domain
// pipeline: Poly by Google "Brain", CC BY 3.0, see Requirement/asset-sources/CREDITS.md)
// into named fragment primitives sharing one position/normal buffer, plus a
// boundary attribute marking edges between fragments (used for the vermilion
// seam rendering). Run with: node scripts/build-brain-fragments.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcPath = join(root, 'Requirement/asset-sources/brain-source.glb');
const outDir = join(root, 'public/models');
mkdirSync(outDir, { recursive: true });

// --- Minimal GLB container parser (no three.js / DOM dependency needed) ---
function parseGlb(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Not a glb file');
  const length = dv.getUint32(8, true);
  let offset = 12;
  let json, bin;
  while (offset < length) {
    const chunkLength = dv.getUint32(offset, true);
    const chunkType = dv.getUint32(offset + 4, true);
    const chunkData = buf.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === 0x4e4f534a) json = JSON.parse(Buffer.from(chunkData).toString('utf8'));
    else if (chunkType === 0x004e4942) bin = chunkData;
    offset += 8 + chunkLength;
  }
  return { json, bin };
}

function readAccessor(json, bin, index) {
  const accessor = json.accessors[index];
  const view = json.bufferViews[accessor.bufferView];
  const byteOffset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const compCount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
  const TypedArray = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[accessor.componentType];
  const bytesPer = TypedArray.BYTES_PER_ELEMENT;
  const count = accessor.count;
  const stride = view.byteStride || compCount * bytesPer;
  const out = new TypedArray(count * compCount);
  const base = bin.byteOffset + byteOffset;
  const srcDv = new DataView(bin.buffer, base, view.byteLength - (accessor.byteOffset ?? 0));
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < compCount; c++) {
      const at = i * stride + c * bytesPer;
      let val;
      if (TypedArray === Float32Array) val = srcDv.getFloat32(at, true);
      else if (TypedArray === Uint16Array) val = srcDv.getUint16(at, true);
      else if (TypedArray === Uint32Array) val = srcDv.getUint32(at, true);
      else val = srcDv.getUint8(at);
      out[i * compCount + c] = val;
    }
  }
  return out;
}

const raw = readFileSync(srcPath);
const { json, bin } = parseGlb(raw);
const prim = json.meshes[0].primitives[0];
const positions = readAccessor(json, bin, prim.attributes.POSITION); // Float32Array, xyz
const indices = readAccessor(json, bin, prim.indices); // Uint16Array
const vertexCount = positions.length / 3;
const triCount = indices.length / 3;

// --- bounding box / center ---
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < vertexCount; i++) {
  for (let c = 0; c < 3; c++) {
    const v = positions[i * 3 + c];
    if (v < min[c]) min[c] = v;
    if (v > max[c]) max[c] = v;
  }
}
const center = [0, 1, 2].map(c => (min[c] + max[c]) / 2);
const extent = [0, 1, 2].map(c => max[c] - min[c]);
const height = extent[1];

// --- vertex normals (area-weighted face normals, accumulated) ---
const normals = new Float32Array(vertexCount * 3);
function tri(i) { return [indices[i * 3], indices[i * 3 + 1], indices[i * 3 + 2]]; }
function vert(i) { return [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
for (let t = 0; t < triCount; t++) {
  const [a, b, c] = tri(t);
  const pa = vert(a), pb = vert(b), pc = vert(c);
  const n = cross(sub(pb, pa), sub(pc, pa));
  for (const idx of [a, b, c]) for (let k = 0; k < 3; k++) normals[idx * 3 + k] += n[k];
}
for (let i = 0; i < vertexCount; i++) {
  const n = [normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]];
  const len = Math.hypot(...n) || 1;
  normals[i * 3] = n[0] / len; normals[i * 3 + 1] = n[1] / len; normals[i * 3 + 2] = n[2] / len;
}

// --- 10 fragment seeds spread across the mesh volume (fibonacci sphere in an ellipsoid) ---
const ROLES = ['coordinator', 'requirements', 'context', 'discussion', 'architecture', 'development-a', 'development-b', 'qa', 'implementation', 'reporting'];
const N = ROLES.length;
const seeds = [];
const golden = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2; // -1..1
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = golden * i;
  seeds.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
}
// coordinator seed pinned near the base/root of the mesh (bottom, front-center)
seeds[0] = [0, -0.85, 0.35];
const seedWorld = seeds.map(([x, y, z]) => [
  center[0] + x * extent[0] * 0.42,
  center[1] + y * extent[1] * 0.46,
  center[2] + z * extent[2] * 0.42,
]);

// --- assign each triangle to nearest seed by centroid distance ---
const triCluster = new Int32Array(triCount);
for (let t = 0; t < triCount; t++) {
  const [a, b, c] = tri(t);
  const pa = vert(a), pb = vert(b), pc = vert(c);
  const cx = (pa[0] + pb[0] + pc[0]) / 3, cy = (pa[1] + pb[1] + pc[1]) / 3, cz = (pa[2] + pb[2] + pc[2]) / 3;
  let best = 0, bestD = Infinity;
  for (let s = 0; s < N; s++) {
    const d = (cx - seedWorld[s][0]) ** 2 + (cy - seedWorld[s][1]) ** 2 + (cz - seedWorld[s][2]) ** 2;
    if (d < bestD) { bestD = d; best = s; }
  }
  triCluster[t] = best;
}

// --- boundary detection via edge adjacency (edges touching 2+ clusters) ---
const edgeMap = new Map();
function edgeKey(i, j) { return i < j ? `${i}_${j}` : `${j}_${i}`; }
for (let t = 0; t < triCount; t++) {
  const [a, b, c] = tri(t);
  for (const [i, j] of [[a, b], [b, c], [c, a]]) {
    const key = edgeKey(i, j);
    if (!edgeMap.has(key)) edgeMap.set(key, new Set());
    edgeMap.get(key).add(triCluster[t]);
  }
}
const boundary = new Float32Array(vertexCount);
for (const [key, clusters] of edgeMap) {
  if (clusters.size > 1) {
    const [i, j] = key.split('_').map(Number);
    boundary[i] = 1; boundary[j] = 1;
  }
}

// --- per-fragment triangle lists + centroid/radius ---
const fragments = ROLES.map((role, s) => {
  const triIdx = [];
  for (let t = 0; t < triCount; t++) if (triCluster[t] === s) triIdx.push(t);
  const verts = new Set();
  let cx = 0, cy = 0, cz = 0;
  for (const t of triIdx) for (const v of tri(t)) verts.add(v);
  for (const v of verts) { const p = vert(v); cx += p[0]; cy += p[1]; cz += p[2]; }
  const n = verts.size || 1;
  cx /= n; cy /= n; cz /= n;
  let radius = 0;
  for (const v of verts) radius = Math.max(radius, Math.hypot(...sub(vert(v), [cx, cy, cz])));
  return { role, triIdx, centroid: [cx, cy, cz], radius, triCount: triIdx.length, vertCount: n };
});

// --- write compact binary payload: shared positions+normals+boundary, then per-fragment index arrays ---
const header = {
  vertexCount, triCount,
  bbox: { min, max, center, height },
  fragments: fragments.map(f => ({ role: f.role, centroid: f.centroid, radius: f.radius, triCount: f.triCount, vertCount: f.vertCount })),
};
writeFileSync(join(outDir, 'brain-fragments.json'), JSON.stringify(header, null, 2));

// Binary layout: [u32 vertexCount][positions f32*3*N][normals f32*3*N][boundary f32*N]
// then for each of 10 fragments: [u32 indexCount][indices u32*count]
const parts = [];
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
parts.push(u32(vertexCount));
parts.push(Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength));
parts.push(Buffer.from(normals.buffer, normals.byteOffset, normals.byteLength));
parts.push(Buffer.from(boundary.buffer, boundary.byteOffset, boundary.byteLength));
for (const f of fragments) {
  const idx = new Uint32Array(f.triIdx.length * 3);
  f.triIdx.forEach((t, k) => { idx[k * 3] = indices[t * 3]; idx[k * 3 + 1] = indices[t * 3 + 1]; idx[k * 3 + 2] = indices[t * 3 + 2]; });
  parts.push(u32(idx.length));
  parts.push(Buffer.from(idx.buffer, idx.byteOffset, idx.byteLength));
}
writeFileSync(join(outDir, 'brain-fragments.bin'), Buffer.concat(parts));

console.log(`brain: ${vertexCount} verts, ${triCount} tris, height=${height.toFixed(1)}`);
for (const f of fragments) console.log(`  ${f.role.padEnd(14)} tris=${f.triCount} verts=${f.vertCount} centroid=[${f.centroid.map(n => n.toFixed(1))}]`);
console.log('wrote public/models/brain-fragments.json + brain-fragments.bin');
