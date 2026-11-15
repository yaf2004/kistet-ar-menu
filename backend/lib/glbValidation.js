const MAX_TRIANGLES = 200000;
const MAX_VERTICES = 250000;
const MAX_EMBEDDED_IMAGE_BYTES = 12 * 1024 * 1024;

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function validateGlb(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 20) throw invalid('The GLB file is incomplete.');
  if (buffer.toString('ascii', 0, 4) !== 'glTF') throw invalid('The file is not a valid GLB container.');
  if (buffer.readUInt32LE(4) !== 2) throw invalid('Only glTF 2.0 binary models are supported.');
  if (buffer.readUInt32LE(8) !== buffer.length) throw invalid('The GLB file length does not match its header.');

  let offset = 12;
  let json = null;
  let binaryLength = 0;
  let chunkIndex = 0;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) throw invalid('The GLB contains a truncated chunk header.');
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (chunkLength % 4 !== 0 || offset + chunkLength > buffer.length) {
      throw invalid('The GLB contains an invalid chunk length.');
    }
    if (chunkIndex === 0 && chunkType !== 0x4e4f534a) {
      throw invalid('The first GLB chunk must contain the glTF JSON document.');
    }
    if (chunkType === 0x4e4f534a) {
      if (json) throw invalid('The GLB contains more than one JSON chunk.');
      try {
        json = JSON.parse(buffer.toString('utf8', offset, offset + chunkLength).trim());
      } catch {
        throw invalid('The GLB JSON document is malformed.');
      }
    } else if (chunkType === 0x004e4942) {
      if (binaryLength) throw invalid('The GLB contains multiple binary chunks.');
      binaryLength = chunkLength;
    } else {
      throw invalid('The GLB contains an unsupported chunk type.');
    }
    offset += chunkLength;
    chunkIndex += 1;
  }

  if (!json || json.asset?.version !== '2.0') throw invalid('The GLB must contain a valid glTF 2.0 asset.');
  if ((json.buffers || []).length > 1 || (json.buffers || []).some((entry) => entry.uri)) {
    throw invalid('External or multi-buffer models are not supported. Export a self-contained GLB.');
  }
  if ((json.buffers || []).some((entry) => !Number.isInteger(entry.byteLength) || entry.byteLength > binaryLength)) {
    throw invalid('The GLB binary buffer is missing or has an invalid declared length.');
  }
  if ((json.images || []).some((entry) => {
    if (entry.uri) return !entry.uri.startsWith('data:');
    return !Number.isInteger(entry.bufferView) || !json.bufferViews?.[entry.bufferView];
  })) {
    throw invalid('External or unreferenced image files are not supported. Embed textures in the GLB.');
  }

  const accessors = json.accessors || [];
  const meshes = json.meshes || [];
  const positionAccessorIds = new Set();
  for (const mesh of meshes) {
    for (const primitive of mesh.primitives || []) {
      if (Number.isInteger(primitive.attributes?.POSITION)) positionAccessorIds.add(primitive.attributes.POSITION);
    }
  }
  const vertices = [...positionAccessorIds].reduce((total, id) => total + Number(accessors[id]?.count || 0), 0);
  let triangles = 0;
  for (const mesh of meshes) {
    for (const primitive of mesh.primitives || []) {
      if ((primitive.mode ?? 4) === 4) {
        const indexAccessor = Number.isInteger(primitive.indices) ? accessors[primitive.indices] : null;
        const positionAccessor = Number.isInteger(primitive.attributes?.POSITION) ? accessors[primitive.attributes.POSITION] : null;
        triangles += Math.floor(Number(indexAccessor?.count ?? positionAccessor?.count ?? 0) / 3);
      }
    }
  }

  const textureImages = json.images || [];
  const oversizedTexture = textureImages.some((entry) => {
    if (entry.uri?.startsWith('data:')) {
      const encoded = entry.uri.split(',')[1] || '';
      return Math.floor(encoded.length * 0.75) > MAX_EMBEDDED_IMAGE_BYTES;
    }
    const view = json.bufferViews?.[entry.bufferView];
    return view && view.byteLength > MAX_EMBEDDED_IMAGE_BYTES;
  });
  if (vertices > MAX_VERTICES) throw invalid(`This model has too many vertices (${vertices.toLocaleString()}). Reduce it to ${MAX_VERTICES.toLocaleString()} or fewer.`);
  if (triangles > MAX_TRIANGLES) throw invalid(`This model has too many polygons (${triangles.toLocaleString()} triangles). Reduce it to ${MAX_TRIANGLES.toLocaleString()} or fewer.`);
  if (oversizedTexture) throw invalid('A model texture is too large. Resize textures to 2048px or smaller and keep each texture under 12 MB.');

  return {
    format: 'glb',
    gltfVersion: '2.0',
    fileSizeBytes: buffer.length,
    vertexCount: vertices,
    triangleCount: triangles,
    meshCount: meshes.length,
    materialCount: (json.materials || []).length,
    textureCount: (json.textures || []).length,
    imageCount: textureImages.length,
    nodeCount: (json.nodes || []).length,
    validatedAt: new Date()
  };
}

module.exports = { validateGlb, MAX_TRIANGLES, MAX_VERTICES };
