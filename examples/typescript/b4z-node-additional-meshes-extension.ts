import {
  Accessor,
  Document,
  Extension,
  ExtensionProperty,
  Graph,
  IProperty,
  NodeIO,
  PropertyType,
  WriterContext,
} from '@gltf-transform/core';

const EXTENSION_NAME = 'B4Z_node_additional_meshes';

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

interface IAdditionalMesh extends IProperty {
  id: string;
  topology: AdditionalMeshTopology;
  vertices: Accessor | null;
  indices: Accessor | null;
  attributes: Map<string, Accessor>;
}

class AdditionalMesh extends ExtensionProperty<IAdditionalMesh> {
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

  public setVertices(accessor: Accessor): this {
    this._vertices = accessor;
    this.attachElement('vertices', accessor);
    return this;
  }

  public getVertices(): Accessor | null {
    return this._vertices;
  }

  public setIndices(accessor: Accessor): this {
    this._indices = accessor;
    this.attachElement('indices', accessor);
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

  public toJSON(context: WriterContext) {
    if (!this._vertices || !this._indices) {
      throw new Error('Additional meshes require both vertices and indices accessors.');
    }

    const attributes: Record<string, number> = {};
    for (const [semantic, accessor] of this._attributes) {
      attributes[semantic] = context.accessorIndexMap.get(accessor)!;
    }

    return {
      id: this._id,
      topology: this._topology,
      vertices: context.accessorIndexMap.get(this._vertices)!,
      indices: context.accessorIndexMap.get(this._indices)!,
      attributes: Object.keys(attributes).length ? attributes : undefined,
    };
  }
}

class AdditionalMeshSet extends ExtensionProperty<IProperty> {
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

export class B4ZNodeAdditionalMeshesExtension extends Extension {
  public readonly extensionName = EXTENSION_NAME;
  public static readonly EXTENSION_NAME = EXTENSION_NAME;

  public createAdditionalMesh(): AdditionalMesh {
    return new AdditionalMesh(this.document.getGraph());
  }

  public createAdditionalMeshSet(): AdditionalMeshSet {
    return new AdditionalMeshSet(this.document.getGraph());
  }

  public write(context: WriterContext): this {
    const root = this.document.getRoot();
    const jsonDoc = context.jsonDoc;

    const used = new Set<string>(jsonDoc.json.extensionsUsed ?? []);
    used.add(EXTENSION_NAME);
    jsonDoc.json.extensionsUsed = Array.from(used);

    for (const node of root.listNodes()) {
      const meshSet = node.getExtension<AdditionalMeshSet>(EXTENSION_NAME);
      if (!meshSet) continue;

      const nodeIndex = context.nodeIndexMap.get(node);
      if (nodeIndex === undefined) continue;

      const nodeDef = jsonDoc.json.nodes![nodeIndex];
      nodeDef.extensions = nodeDef.extensions || {};
      nodeDef.extensions[EXTENSION_NAME] = {
        meshes: meshSet.listMeshes().map((mesh) => mesh.toJSON(context)),
      };
    }

    return this;
  }
}

async function main() {
  const document = new Document();
  const root = document.getRoot();

  const extension = document.createExtension(B4ZNodeAdditionalMeshesExtension);

  // Create shared vertex accessor.
  const vertexAccessor = document
    .createAccessor('shared-positions')
    .setType(Accessor.Type.VEC3)
    .setArray(new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
      1, 1, 0,
      0, 1, 1,
      1, 0, 1,
      1, 1, 1,
    ]));

  // Topology-specific index accessors.
  const tetraAccessor = document
    .createAccessor('tetra-cells')
    .setType(Accessor.Type.SCALAR)
    .setArray(new Uint16Array([
      0, 1, 2, 3,
    ]));

  const hexaAccessor = document
    .createAccessor('hex-cells')
    .setType(Accessor.Type.SCALAR)
    .setArray(new Uint16Array([
      0, 1, 4, 2, 3, 6, 7, 5,
    ]));

  const tetraCellIds = document
    .createAccessor('tetra-cell-ids')
    .setType(Accessor.Type.SCALAR)
    .setArray(new Uint32Array([100]));

  const hexCellIds = document
    .createAccessor('hex-cell-ids')
    .setType(Accessor.Type.SCALAR)
    .setArray(new Uint32Array([200]));

  const node = document.createNode('MixedTopology');
  root.addNode(node);

  const meshSet = extension.createAdditionalMeshSet();

  meshSet.addMesh(
    extension
      .createAdditionalMesh()
      .setId('tetra_cluster')
      .setTopology('TETRAHEDRA')
      .setVertices(vertexAccessor)
      .setIndices(tetraAccessor)
      .setAttribute('CELL_IDS', tetraCellIds),
  );

  meshSet.addMesh(
    extension
      .createAdditionalMesh()
      .setId('hex_core')
      .setTopology('HEXAHEDRA')
      .setVertices(vertexAccessor)
      .setIndices(hexaAccessor)
      .setAttribute('CELL_IDS', hexCellIds),
  );

  node.setExtension(EXTENSION_NAME, meshSet);

  const io = new NodeIO().registerExtensions([B4ZNodeAdditionalMeshesExtension]);
  await io.writeJSON('mixed-topologies.gltf', document);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
