// One-off: shrink the supplied perfume_bottle.glb for web delivery.
// Strips unused UV sets, downsizes textures, converts to WebP, quantizes + meshopt-compresses geometry.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress, prune, dedup, quantize, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
const [,, src, dst] = process.argv;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(src);
for (const mesh of doc.getRoot().listMeshes())
  for (const prim of mesh.listPrimitives())
    for (const sem of prim.listSemantics()) if (/^TEXCOORD_([1-9])$/.test(sem)) prim.setAttribute(sem, null);
await doc.transform(prune(), dedup(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(dst, doc);
