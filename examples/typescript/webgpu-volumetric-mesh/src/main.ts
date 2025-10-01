import {
  Accessor,
  Extension,
  ExtensionProperty,
  Graph,
  PropertyType,
  ReaderContext,
  WebIO,
} from '@gltf-transform/core';

/**
 * WebGPU volumetric mesh example.
 *
 * This demo constructs a renderable surface mesh from volumetric cells by
 * triangulating each polyhedral face. The generated primitives are rendered
 * with basic lighting, and UI sliders allow culling primitives based on the
 * position of their face centers along the X, Y, and Z axes.
 */

interface Vec3 extends Array<number> {
  0: number;
  1: number;
  2: number;
}

interface Polyhedron {
  vertices: Vec3[];
  faces: number[][];
}

interface TriangulatedPrimitive {
  positions: number[];
  normals: number[];
  centers: number[];
  indices: number[];
}

const BUFFER_USAGE = {
  COPY_DST: 0x0008,
  INDEX: 0x0010,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
} as const;

const SHADER_STAGE = {
  VERTEX: 0x1,
  FRAGMENT: 0x2,
} as const;

const TEXTURE_USAGE = {
  RENDER_ATTACHMENT: 0x10,
} as const;

const MESH_ASSET_URL = '/webgpu-volumetric-mesh.gltf';

type AdditionalMeshTopology =
  | 'POINTS'
  | 'LINES'
  | 'LINE_STRIP'
  | 'TRIANGLES'
  | 'TRIANGLE_STRIP'
  | 'TRIANGLE_FAN'
  | 'QUADS'
  | 'QUAD_STRIP'
  | 'POLYGONS'
  | 'TETRAHEDRA'
  | 'PYRAMIDS'
  | 'WEDGES'
  | 'PENTA_PRISMS'
  | 'HEXAHEDRA';

const EXTENSION_NAME = 'B4Z_node_additional_meshes';
const ROOT_ELEMENT_ID = 'app';

interface AdditionalMeshDefinition {
  id: string;
  topology: AdditionalMeshTopology;
  vertices: Accessor | null;
  indices: Accessor | null;
  attributes: Map<string, Accessor>;
}

class AdditionalMesh extends ExtensionProperty<AdditionalMeshDefinition> {
  public static EXTENSION_NAME = EXTENSION_NAME;
  public declare extensionName: typeof EXTENSION_NAME;
  public declare propertyType: 'AdditionalMesh';
  public declare parentTypes: [PropertyType.NODE];

  private _id = '';
  private _topology: AdditionalMeshTopology = 'POINTS';
  private _vertices: Accessor | null = null;
  private _indices: Accessor | null = null;
  private _attributes: Map<string, Accessor> = new Map();

  constructor(graph: Graph) {
    super(graph);
    this.extensionName = EXTENSION_NAME;
    this.propertyType = 'AdditionalMesh';
    this.parentTypes = [PropertyType.NODE];
  }

  public setId(id: string): this {
    this._id = id;
    return this;
  }

  public getId(): string {
    return this._id;
  }

  public setTopology(topology: AdditionalMeshTopology): this {
    this._topology = topology;
    return this;
  }

  public getTopology(): AdditionalMeshTopology {
    return this._topology;
  }

  public setVertices(accessor: Accessor | null): this {
    this._vertices = accessor;
    if (accessor) {
      this.attachElement('vertices', accessor);
    }
    return this;
  }

  public getVertices(): Accessor | null {
    return this._vertices;
  }

  public setIndices(accessor: Accessor | null): this {
    this._indices = accessor;
    if (accessor) {
      this.attachElement('indices', accessor);
    }
    return this;
  }

  public getIndices(): Accessor | null {
    return this._indices;
  }

  public setAttribute(semantic: string, accessor: Accessor): this {
    this._attributes.set(semantic, accessor);
    this.attachElement(`attributes/${semantic}`, accessor);
    return this;
  }

  public listAttributes(): Array<[string, Accessor]> {
    return Array.from(this._attributes.entries());
  }
}

class AdditionalMeshSet extends ExtensionProperty<null> {
  public static EXTENSION_NAME = EXTENSION_NAME;
  public declare extensionName: typeof EXTENSION_NAME;
  public declare propertyType: 'AdditionalMeshSet';
  public declare parentTypes: [PropertyType.NODE];

  private meshes: AdditionalMesh[] = [];

  constructor(graph: Graph) {
    super(graph);
    this.extensionName = EXTENSION_NAME;
    this.propertyType = 'AdditionalMeshSet';
    this.parentTypes = [PropertyType.NODE];
  }

  public addMesh(mesh: AdditionalMesh): this {
    this.meshes.push(mesh);
    mesh.setParent(this, 'meshes', this.meshes.length - 1);
    return this;
  }

  public listMeshes(): AdditionalMesh[] {
    return this.meshes;
  }
}

class B4ZNodeAdditionalMeshesExtension extends Extension {
  public readonly extensionName = EXTENSION_NAME;

  public static readonly EXTENSION_NAME = EXTENSION_NAME;

  public createAdditionalMesh(): AdditionalMesh {
    return new AdditionalMesh(this.document.getGraph());
  }

  public createAdditionalMeshSet(): AdditionalMeshSet {
    return new AdditionalMeshSet(this.document.getGraph());
  }

  public read(context: ReaderContext): this {
    const root = this.document.getRoot();
    const nodeDefs = context.jsonDoc.json.nodes ?? [];
    const nodes = root.listNodes();

    for (let nodeIndex = 0; nodeIndex < nodeDefs.length; nodeIndex++) {
      const nodeDef = nodeDefs[nodeIndex];
      const extension = nodeDef.extensions?.[EXTENSION_NAME];
      if (!extension) continue;

      const node = nodes[nodeIndex];
      if (!node) continue;

      const meshSet = this.createAdditionalMeshSet();

      for (const meshJSON of extension.meshes ?? []) {
        const mesh = this.createAdditionalMesh()
          .setId(meshJSON.id)
          .setTopology(meshJSON.topology as AdditionalMeshTopology);

        mesh.setVertices(meshJSON.vertices !== undefined ? context.readAccessor(meshJSON.vertices) : null);
        mesh.setIndices(meshJSON.indices !== undefined ? context.readAccessor(meshJSON.indices) : null);

        const attributes = meshJSON.attributes ?? {};
        for (const [semantic, accessorIndex] of Object.entries(attributes)) {
          mesh.setAttribute(semantic, context.readAccessor(accessorIndex));
        }

        meshSet.addMesh(mesh);
      }

      node.setExtension(EXTENSION_NAME, meshSet);
    }

    return this;
  }
}

const TOPOLOGY_FACE_MAP: Record<string, { verticesPerCell: number; faces: number[][] }> = {
  TETRAHEDRA: {
    verticesPerCell: 4,
    faces: [
      [0, 2, 1],
      [0, 1, 3],
      [1, 2, 3],
      [2, 0, 3],
    ],
  },
  PYRAMIDS: {
    verticesPerCell: 5,
    faces: [
      [0, 1, 2, 3],
      [0, 1, 4],
      [1, 2, 4],
      [2, 3, 4],
      [3, 0, 4],
    ],
  },
  WEDGES: {
    verticesPerCell: 6,
    faces: [
      [0, 1, 2],
      [3, 4, 5],
      [0, 3, 4, 1],
      [1, 4, 5, 2],
      [2, 5, 3, 0],
    ],
  },
  HEXAHEDRA: {
    verticesPerCell: 8,
    faces: [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [0, 4, 5, 1],
      [1, 5, 6, 2],
      [2, 6, 7, 3],
      [3, 7, 4, 0],
    ],
  },
};


async function loadVolumetricCells(): Promise<Polyhedron[]> {
  const io = new WebIO({ credentials: 'same-origin' });
  io.registerExtensions([B4ZNodeAdditionalMeshesExtension]);

  const document = await io.read(MESH_ASSET_URL);
  const cells: Polyhedron[] = [];

  for (const node of document.getRoot().listNodes()) {
    const meshSet = node.getExtension<AdditionalMeshSet>(EXTENSION_NAME);
    if (!meshSet) continue;

    for (const mesh of meshSet.listMeshes()) {
      const topology = TOPOLOGY_FACE_MAP[mesh.getTopology()];
      if (!topology) {
        console.warn(`Unsupported topology: ${mesh.getTopology()}`);
        continue;
      }

      const positionAccessor = mesh.getVertices();
      const indexAccessor = mesh.getIndices();
      if (!positionAccessor || !indexAccessor) {
        console.warn(`Mesh ${mesh.getId()} is missing vertices or indices accessors.`);
        continue;
      }

      const positionArray = positionAccessor.getArray();
      const indexArray = indexAccessor.getArray();
      if (!positionArray || !indexArray) {
        console.warn(`Mesh ${mesh.getId()} has empty accessors.`);
        continue;
      }

      if (positionAccessor.getElementSize() !== 3) {
        throw new Error(`Expected VEC3 positions for mesh ${mesh.getId()}.`);
      }

      const positions = ensureFloat32Array(positionArray);
      const indices = ensureUint32Array(indexArray);
      const stride = topology.verticesPerCell;

      if (indices.length % stride !== 0) {
        throw new Error(`Indices for mesh ${mesh.getId()} are not a multiple of ${stride}.`);
      }

      for (let offset = 0; offset < indices.length; offset += stride) {
        const cellVertices: Vec3[] = [];
        for (let i = 0; i < stride; i++) {
          const vertexIndex = indices[offset + i];
          const base = vertexIndex * 3;
          if (base + 2 >= positions.length) {
            throw new Error(`Vertex index ${vertexIndex} is out of range for mesh ${mesh.getId()}.`);
          }
          cellVertices.push([positions[base + 0], positions[base + 1], positions[base + 2]]);
        }

        const faces = topology.faces.map((face) => face.slice());
        cells.push({ vertices: cellVertices, faces });
      }
    }
  }

  if (!cells.length) {
    throw new Error('No volumetric cells found in the GLTF asset.');
  }

  return cells;
}





function ensureFloat32Array(array: ArrayLike<number>): Float32Array {
  if (array instanceof Float32Array) {
    return array;
  }

  const result = new Float32Array(array.length);
  for (let i = 0; i < array.length; i++) {
    result[i] = Number(array[i]);
  }
  return result;
}

function ensureUint32Array(array: ArrayLike<number>): Uint32Array {
  if (array instanceof Uint32Array) {
    return array;
  }

  const result = new Uint32Array(array.length);
  for (let i = 0; i < array.length; i++) {
    result[i] = Number(array[i]);
  }
  return result;
}

function triangulateMesh(cells: Polyhedron[]): TriangulatedPrimitive {
  const positions: number[] = [];
  const normals: number[] = [];
  const centers: number[] = [];
  const indices: number[] = [];

  let vertexIndex = 0;

  for (const cell of cells) {
    for (const face of cell.faces) {
      if (face.length < 3) continue;

      const faceVertices = face.map((idx) => cell.vertices[idx]);
      const faceCenter = computeCenter(faceVertices);

      for (let i = 1; i < face.length - 1; i++) {
        const a = cell.vertices[face[0]];
        const b = cell.vertices[face[i]];
        const c = cell.vertices[face[i + 1]];

        const normal = computeFaceNormal(a, b, c);

        positions.push(...a, ...b, ...c);
        normals.push(...normal, ...normal, ...normal);
        centers.push(...faceCenter, ...faceCenter, ...faceCenter);

        indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        vertexIndex += 3;
      }
    }
  }

  return { positions, normals, centers, indices };
}

function computeCenter(vertices: Vec3[]): Vec3 {
  const center: Vec3 = [0, 0, 0];
  for (const v of vertices) {
    center[0] += v[0];
    center[1] += v[1];
    center[2] += v[2];
  }
  const inv = 1 / vertices.length;
  center[0] *= inv;
  center[1] *= inv;
  center[2] *= inv;
  return center;
}

function computeFaceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const normal: Vec3 = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  const length = Math.hypot(normal[0], normal[1], normal[2]) || 1;
  normal[0] /= length;
  normal[1] /= length;
  normal[2] /= length;
  return normal;
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  canvas.style.border = '1px solid #555';
  return canvas;
}

function createSlider(
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
  onChange: (value: number) => void,
): HTMLElement {
  const container = document.createElement('label');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.fontFamily = 'sans-serif';
  container.style.fontSize = '13px';
  container.style.margin = '0 12px 8px 0';

  const title = document.createElement('span');
  title.textContent = `${label}: ${value.toFixed(2)}`;
  title.style.marginBottom = '4px';
  container.appendChild(title);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener('input', () => {
    const val = Number(input.value);
    title.textContent = `${label}: ${val.toFixed(2)}`;
    onChange(val);
  });
  container.appendChild(input);

  return container;
}

async function init(): Promise<void> {
  if (!('gpu' in navigator)) {
    throw new Error('WebGPU is not supported in this browser.');
  }

  const root = document.getElementById(ROOT_ELEMENT_ID);
  if (!root) {
    throw new Error(`Missing #${ROOT_ELEMENT_ID} element in the document.`);
  }
  root.replaceChildren();
  root.style.display = 'flex';
  root.style.flexDirection = 'column';

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'stretch';
  container.style.gap = '12px';
  container.style.padding = '12px';
  container.style.boxSizing = 'border-box';
  container.style.flex = '1 1 auto';

  root.appendChild(container);

  const controlRow = document.createElement('div');
  controlRow.style.display = 'flex';
  controlRow.style.flexWrap = 'wrap';

  container.appendChild(controlRow);

  const canvas = createCanvas();
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.flex = '1 1 auto';
  canvas.style.maxWidth = '100%';
  container.appendChild(canvas);

  const gpu = (navigator as Navigator & { gpu: any }).gpu;
  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    throw new Error('Failed to acquire GPU adapter.');
  }

  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu') as any;
  if (!context) {
    throw new Error('Unable to acquire WebGPU context.');
  }

  const presentationFormat = gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
    alphaMode: 'opaque',
  });

  const volumetricMesh = await loadVolumetricCells();
  const triangulated = triangulateMesh(volumetricMesh);
  if (!triangulated.indices.length) {
    throw new Error('No renderable primitives were generated from the volumetric mesh.');
  }
  const positions = new Float32Array(triangulated.positions);
  const normals = new Float32Array(triangulated.normals);
  const centers = new Float32Array(triangulated.centers);
  const indices = new Uint32Array(triangulated.indices);

  const vertexStride = 9 * Float32Array.BYTES_PER_ELEMENT;
  const interleaved = new Float32Array((positions.length / 3) * 9);
  for (let i = 0, v = 0; i < positions.length; i += 3, v += 9) {
    interleaved[v + 0] = positions[i + 0];
    interleaved[v + 1] = positions[i + 1];
    interleaved[v + 2] = positions[i + 2];
    interleaved[v + 3] = normals[i + 0];
    interleaved[v + 4] = normals[i + 1];
    interleaved[v + 5] = normals[i + 2];
    interleaved[v + 6] = centers[i + 0];
    interleaved[v + 7] = centers[i + 1];
    interleaved[v + 8] = centers[i + 2];
  }

  const vertexBuffer = device.createBuffer({
    size: interleaved.byteLength,
    usage: BUFFER_USAGE.VERTEX | BUFFER_USAGE.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, interleaved.buffer);

  const indexBuffer = device.createBuffer({
    size: indices.byteLength,
    usage: BUFFER_USAGE.INDEX | BUFFER_USAGE.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, indices.buffer);

  const centerBounds = getCenterBounds(centers);
  const boundsUniform = new Float32Array([
    centerBounds.min[0],
    centerBounds.min[1],
    centerBounds.min[2],
    0,
    centerBounds.max[0],
    centerBounds.max[1],
    centerBounds.max[2],
    0,
  ]);

  const uniformBufferSize = 16 * 4 + 8 * 4; // 16 floats for matrix, 8 floats for bounds
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: uniformBuffer },
      },
    ],
  });

  const shaderModule = device.createShaderModule({
    code: /* wgsl */ `
struct Uniforms {
  viewProj : mat4x4<f32>,
  boundsMin : vec3<f32>,
  padding0 : f32,
  boundsMax : vec3<f32>,
  padding1 : f32,
};

struct VSOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) normal : vec3<f32>,
  @location(1) faceCenter : vec3<f32>,
  @location(2) culled : f32,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

@vertex
fn vs(
  @location(0) position : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) faceCenter : vec3<f32>
) -> VSOutput {
  var output : VSOutput;
  let cull = any(faceCenter < uniforms.boundsMin) || any(faceCenter > uniforms.boundsMax);
  output.culled = select(0.0, 1.0, cull);
  output.normal = normal;
  output.faceCenter = faceCenter;
  output.position = uniforms.viewProj * vec4<f32>(position, 1.0);
  return output;
}

@fragment
fn fs(input : VSOutput) -> @location(0) vec4<f32> {
  if (input.culled > 0.5) {
    discard;
  }
  let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.75));
  let intensity = max(dot(normalize(input.normal), lightDir), 0.1);
  let color = vec3<f32>(0.3, 0.6, 0.9) * intensity;
  return vec4<f32>(color, 1.0);
}
    `,
  });

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: {
      module: shaderModule,
      entryPoint: 'vs',
      buffers: [
        {
          arrayStride: vertexStride,
          attributes: [
            { shaderLocation: 0, format: 'float32x3', offset: 0 },
            { shaderLocation: 1, format: 'float32x3', offset: 12 },
            { shaderLocation: 2, format: 'float32x3', offset: 24 },
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs',
      targets: [{ format: presentationFormat }],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  });

  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height, 1],
    format: 'depth24plus',
    usage: TEXTURE_USAGE.RENDER_ATTACHMENT,
  });

  const depthView = depthTexture.createView();

  const aspect = canvas.width / canvas.height;
  const projection = perspective(Math.PI / 4, aspect, 0.1, 10);
  const view = lookAt([1.5, 1.5, 2.5], [0.4, 0.1, 0], [0, 1, 0]);
  const viewProj = multiplyMat4(projection, view);

  const uniformData = new Float32Array(16 + 8);
  uniformData.set(viewProj, 0);
  uniformData.set(boundsUniform, 16);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData.buffer);

  const updateBounds = () => {
    uniformData.set(boundsUniform, 16);
    device.queue.writeBuffer(uniformBuffer, 16 * 4, boundsUniform.buffer);
  };

  const [minX, maxX] = [centerBounds.min[0], centerBounds.max[0]];
  const [minY, maxY] = [centerBounds.min[1], centerBounds.max[1]];
  const [minZ, maxZ] = [centerBounds.min[2], centerBounds.max[2]];

  controlRow.appendChild(
    createSlider('Min X', minX - 0.5, minX, 0.01, minX, (value) => {
      boundsUniform[0] = Math.min(value, boundsUniform[4] - 0.01);
      updateBounds();
    }),
  );
  controlRow.appendChild(
    createSlider('Max X', maxX, maxX + 0.5, 0.01, maxX, (value) => {
      boundsUniform[4] = Math.max(value, boundsUniform[0] + 0.01);
      updateBounds();
    }),
  );
  controlRow.appendChild(
    createSlider('Min Y', minY - 0.5, minY, 0.01, minY, (value) => {
      boundsUniform[1] = Math.min(value, boundsUniform[5] - 0.01);
      updateBounds();
    }),
  );
  controlRow.appendChild(
    createSlider('Max Y', maxY, maxY + 0.5, 0.01, maxY, (value) => {
      boundsUniform[5] = Math.max(value, boundsUniform[1] + 0.01);
      updateBounds();
    }),
  );
  controlRow.appendChild(
    createSlider('Min Z', minZ - 0.5, minZ, 0.01, minZ, (value) => {
      boundsUniform[2] = Math.min(value, boundsUniform[6] - 0.01);
      updateBounds();
    }),
  );
  controlRow.appendChild(
    createSlider('Max Z', maxZ, maxZ + 0.5, 0.01, maxZ, (value) => {
      boundsUniform[6] = Math.max(value, boundsUniform[2] + 0.01);
      updateBounds();
    }),
  );

  function frame() {
    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();

    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          loadOp: 'clear',
          clearValue: { r: 0.1, g: 0.12, b: 0.15, a: 1 },
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: depthView,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        depthClearValue: 1.0,
      },
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, 'uint32');
    pass.drawIndexed(indices.length, 1, 0, 0, 0);
    pass.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function getCenterBounds(centers: Float32Array) {
  const min: Vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: Vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

  for (let i = 0; i < centers.length; i += 3) {
    min[0] = Math.min(min[0], centers[i + 0]);
    min[1] = Math.min(min[1], centers[i + 1]);
    min[2] = Math.min(min[2], centers[i + 2]);
    max[0] = Math.max(max[0], centers[i + 0]);
    max[1] = Math.max(max[1], centers[i + 1]);
    max[2] = Math.max(max[2], centers[i + 2]);
  }

  return { min, max };
}

function perspective(fovY: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = (2 * far * near) * nf;
  return out;
}

function lookAt(eye: Vec3, target: Vec3, up: Vec3): Float32Array {
  const z0 = eye[0] - target[0];
  const z1 = eye[1] - target[1];
  const z2 = eye[2] - target[2];
  let len = Math.hypot(z0, z1, z2);
  const z = len > 0 ? [z0 / len, z1 / len, z2 / len] : [0, 0, 1];

  const x0 = up[1] * z[2] - up[2] * z[1];
  const x1 = up[2] * z[0] - up[0] * z[2];
  const x2 = up[0] * z[1] - up[1] * z[0];
  len = Math.hypot(x0, x1, x2);
  const x = len > 0 ? [x0 / len, x1 / len, x2 / len] : [1, 0, 0];

  const y0 = z[1] * x[2] - z[2] * x[1];
  const y1 = z[2] * x[0] - z[0] * x[2];
  const y2 = z[0] * x[1] - z[1] * x[0];
  const y: Vec3 = [y0, y1, y2];

  const out = new Float32Array(16);
  out[0] = x[0];
  out[1] = y[0];
  out[2] = z[0];
  out[3] = 0;
  out[4] = x[1];
  out[5] = y[1];
  out[6] = z[1];
  out[7] = 0;
  out[8] = x[2];
  out[9] = y[2];
  out[10] = z[2];
  out[11] = 0;
  out[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
  out[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
  out[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
  out[15] = 1;
  return out;
}

function multiplyMat4(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      out[col + row * 4] =
        a[row * 4 + 0] * b[col + 0] +
        a[row * 4 + 1] * b[col + 4] +
        a[row * 4 + 2] * b[col + 8] +
        a[row * 4 + 3] * b[col + 12];
    }
  }
  return out;
}

init().catch((error) => {
  console.error(error);
  const message = document.createElement('pre');
  message.textContent = String(error);
  message.style.padding = '12px';
  message.style.color = '#ff6b6b';
  const root = document.getElementById(ROOT_ELEMENT_ID) ?? document.body;
  root.appendChild(message);
});
