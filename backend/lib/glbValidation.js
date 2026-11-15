const MAX_TRIANGLES = 200000;
const MAX_VERTICES = 250000;
const MAX_TEXTURE_DIMENSION = 2048;
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
        json = JSON.parse(buffer.toString('utf8', offset, offset + chunkLength).replace(/[\\u0000\\u0020]+$/g, ''));
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
  if ((json.images || []).some((entry) => entry.uri && !entry.uri.startsWith('data:'))) {
    throw invalid('External image files are not supported. Embed textures in the GLB.');
  }

  const accessors = json.accessors || [];
  const meshes = json.meshes || [];
  const vertices = accessors.reduce((total, accessor) => total + (accessor.type === 'VEC3' ? Number(accessor.count || 0) : 0), 0);
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

  const dimensions = (json.images || []).map((image) => {
    const view = json.bufferViews?.[image.bufferView];
    return view?.extras?.width && view?.extras?.height
      ? { width: view.extras.width, height: view.extras.height }
      : null;
  }).filter(Boolean);
  if (dimensions.some((size) => size.width > MAX_TEXTURE_DIMENSION || size.height > MAX_TEXTURE_DIMENSION)) {
    throw invalid('Model textures must be 2048 × 2048 pixels or smaller.');
  }

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

module.exports = { validateGlb, MAX_TRIANGLES, MAX_VERTICES, MAX_TEXTURE_DIMENSION };
