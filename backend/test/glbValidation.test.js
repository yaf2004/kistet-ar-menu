const test = require('node:test');
const assert = require('node:assert/strict');
const { validateGlb } = require('../lib/glbValidation');

function makeGlb(document) {
  const json = Buffer.from(JSON.stringify(document));
  const paddedLength = Math.ceil(json.length / 4) * 4;
  const jsonChunk = Buffer.alloc(paddedLength, 0x20);
  json.copy(jsonChunk);
  const header = Buffer.alloc(12);
  header.write('glTF', 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + paddedLength, 8);
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.writeUInt32LE(paddedLength, 0);
  chunkHeader.writeUInt32LE(0x4e4f534a, 4);
  return Buffer.concat([header, chunkHeader, jsonChunk]);
}

test('validates a self-contained glTF 2.0 binary model and returns metadata', () => {
  const buffer = makeGlb({
    asset: { version: '2.0' },
    buffers: [],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ type: 'VEC3', count: 300 }],
    materials: [{}],
    textures: [{}],
    nodes: [{ mesh: 0 }]
  });
  const metadata = validateGlb(buffer);
  assert.equal(metadata.format, 'glb');
  assert.equal(metadata.vertexCount, 300);
  assert.equal(metadata.triangleCount, 100);
  assert.equal(metadata.meshCount, 1);
  assert.equal(metadata.materialCount, 1);
});

test('rejects non-GLB content and invalid container lengths', () => {
  assert.throws(() => validateGlb(Buffer.from('not a model')), /incomplete|valid GLB/);
  const buffer = makeGlb({ asset: { version: '2.0' } });
  buffer.writeUInt32LE(buffer.length + 10, 8);
  assert.throws(() => validateGlb(buffer), /length does not match/);
});

test('rejects external model buffers and images', () => {
  assert.throws(() => validateGlb(makeGlb({
    asset: { version: '2.0' },
    buffers: [{ uri: 'https://example.com/model.bin', byteLength: 4 }]
  })), /External or multi-buffer/);
  assert.throws(() => validateGlb(makeGlb({
    asset: { version: '2.0' },
    images: [{ uri: 'https://example.com/texture.png' }]
  })), /External or unreferenced image files/);
});

test('rejects models that exceed the triangle budget', () => {
  assert.throws(() => validateGlb(makeGlb({
    asset: { version: '2.0' },
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [{ type: 'VEC3', count: 3 }, { type: 'SCALAR', count: 600003 }]
  })), /too many polygons/);
});
