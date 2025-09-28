# B4Z_node_additional_meshes

## Contributors
- B4Z

## Status
Draft

## Dependencies
Written against the glTF 2.0 specification.

## Overview
`B4Z_node_additional_meshes` allows a glTF node to reference an arbitrary number of auxiliary meshes that supplement the primary `mesh` property. The extension is intended for workflows that need to attach alternate topological representations of the same spatial object — for example point clouds, edge complexes, tetrahedral meshes, hexahedral meshes, or any other scientific or simulation meshes — without duplicating the node hierarchy.

Each additional mesh carries:

- A user defined identifier.
- An enumeration describing the topological type of the primitive set.
- A reference to the vertex positions.
- A reference to primitive indices that describe connectivity appropriate for the topology.

The data for the vertices and indices are stored in accessors exactly like any other glTF attribute or index data. This allows applications to reuse buffers, buffer views, and accessors, and it keeps binary assets GPU friendly.

## glTF Schema Updates

### Node

The `extensions` property of a node MAY contain a `B4Z_node_additional_meshes` object with the following schema:

```json
"nodes": [
  {
    "extensions": {
      "B4Z_node_additional_meshes": {
        "meshes": [
          {
            "id": "tetra_01",
            "topology": "TETRAHEDRA",
            "vertices": 3,
            "indices": 8
          }
        ]
      }
    }
  }
]
```

| Property   | Type     | Required | Description |
|------------|----------|----------|-------------|
| `meshes`   | array    | Yes      | Array of additional mesh definitions scoped to the node. |

Each element of `meshes` is defined as follows:

| Property   | Type     | Required | Description |
|------------|----------|----------|-------------|
| `id`       | string   | Yes      | Author-defined identifier that is unique within the node. Useful when multiple application subsystems refer to the same additional mesh. |
| `topology` | string   | Yes      | Enumerated identifier describing the primitive topology. Valid values: `POINTS`, `LINES`, `LINE_STRIP`, `TRIANGLES`, `TRIANGLE_STRIP`, `TRIANGLE_FAN`, `QUADS`, `QUAD_STRIP`, `POLYGONS`, `TETRAHEDRA`, `PYRAMIDS`, `WEDGES`, `PENTA_PRISMS`, `HEXAHEDRA`. |
| `vertices` | integer  | Yes      | Index of an accessor containing vertex positions for the mesh. The accessor element type MUST be `VEC3` with `FLOAT` component type and MUST be expressed in the node's coordinate space, matching the rules for the core `POSITION` attribute. |
| `indices`  | integer  | Yes      | Index of an accessor that describes the primitive connectivity for the specified topology. The accessor component type MUST be one of `UNSIGNED_BYTE`, `UNSIGNED_SHORT`, or `UNSIGNED_INT`. |
| `attributes` | object | No       | Dictionary of additional vertex attributes. Keys follow the same conventions as `mesh.primitive.attributes`. Each value MUST be the index of an accessor whose count matches the `vertices` accessor. |
| `metadata` | object   | No       | Application specific metadata. Treated as `extras` by the core spec. |

The `indices` accessor describes how vertices are grouped into primitives. Applications interpret the accessor according to `topology`:

- `POINTS`: each index represents a single vertex.
- `LINES`: consecutive pairs of indices form line segments.
- `LINE_STRIP`: indices are connected sequentially.
- `TRIANGLES`, `TRIANGLE_STRIP`, `TRIANGLE_FAN`: follow the existing glTF semantics.
- `QUADS`: consecutive groups of four indices form individual quads.
- `QUAD_STRIP`: even/odd pairs form adjacent quads. The accessor count MUST be a multiple of two.
- `POLYGONS`: the accessor MUST be accompanied by an `attributes.POLYGON_SIZES` accessor containing the vertex counts for each polygonal face.
- `TETRAHEDRA`, `PYRAMIDS`, `WEDGES`, `PENTA_PRISMS`, `HEXAHEDRA`: indices are grouped according to the number of vertices for each cell (4, 5, 6, 5, and 8 respectively). Applications MAY extend the list for additional domain specific cell types.

If `topology` requires auxiliary data (for example polygon sizes or per-cell attributes) the extension relies on the `attributes` dictionary to expose the additional accessors. Consumers that do not understand the auxiliary attributes may safely ignore them.

### Additional Accessor Semantics

To support higher dimensional cells the extension reserves the following attribute semantics:

| Semantic            | Description |
|---------------------|-------------|
| `POLYGON_SIZES`     | `SCALAR` accessor whose components define the number of vertices for each polygon in a `POLYGONS` topology. The sum of its elements MUST equal the index accessor count. |
| `CELL_IDS`          | `SCALAR` unsigned integer accessor that labels each topological cell. Useful for mapping simulation results. |
| `CELL_GROUPS`       | `SCALAR` unsigned integer accessor that groups primitives for visualization (for example material regions or boundary conditions). |

Additional custom semantics MAY be introduced by prefixing them with an application specific namespace (for example, `SIM_pressure`).

## Interactions with glTF Features

- Nodes that use `B4Z_node_additional_meshes` MAY still specify the core `mesh` property. Rendering engines that do not understand the extension ignore it and fall back to the standard mesh.
- Accessors referenced by the extension participate in the same resource reuse rules as standard accessors: they MAY be shared across multiple additional meshes or core primitives.
- Morph targets and skinning are not defined for additional meshes in this version of the extension. Future revisions MAY add support if use-cases demand it.
- The extension is purely descriptive; no additional animations or materials are defined. Applications MAY use the identifiers to cross-reference simulation data or additional metadata stored elsewhere.

## Example Implementation

A glTF-Transform authoring example that registers a custom extension and exports a mixed-topology asset is available under [`examples/typescript`](../../../examples/typescript/README.md).

## JSON Schema

A JSON schema describing the extension is provided below as guidance for validation. Integrators MAY translate it into their preferred tooling.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "B4Z_node_additional_meshes",
  "type": "object",
  "properties": {
    "meshes": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "topology", "vertices", "indices"],
        "properties": {
          "id": { "type": "string" },
          "topology": {
            "type": "string",
            "enum": [
              "POINTS", "LINES", "LINE_STRIP", "TRIANGLES", "TRIANGLE_STRIP", "TRIANGLE_FAN",
              "QUADS", "QUAD_STRIP", "POLYGONS", "TETRAHEDRA", "PYRAMIDS", "WEDGES", "PENTA_PRISMS", "HEXAHEDRA"
            ]
          },
          "vertices": {
            "type": "integer",
            "minimum": 0
          },
          "indices": {
            "type": "integer",
            "minimum": 0
          },
          "attributes": {
            "type": "object",
            "additionalProperties": {
              "type": "integer",
              "minimum": 0
            }
          },
          "metadata": {
            "type": "object"
          }
        },
        "additionalProperties": false
      }
    }
  },
  "required": ["meshes"],
  "additionalProperties": false
}
```

## Conformance

An implementation claiming support for `B4Z_node_additional_meshes` MUST adhere to the following:

1. Validate that the accessor referenced by `vertices` is a `VEC3` with floating point components and that its count matches all attribute accessors.
2. Validate that the accessor referenced by `indices` uses an unsigned integer component type and that its element count is compatible with the selected `topology`.
3. Ignore any additional mesh whose `topology` value is not recognized.
4. Advertise support by adding `"B4Z_node_additional_meshes"` to `extensionsUsed`. Add it to `extensionsRequired` if the asset cannot be meaningfully interpreted without the additional meshes.

## Notes

This draft intentionally restricts the scope to vertex positions and connectivity so that the extension can be implemented incrementally. Future revisions MAY add support for materials, morph targets, or skinning references once representative use-cases are identified.
