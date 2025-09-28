# TypeScript example: B4Z_node_additional_meshes

This example shows how to implement support for the `B4Z_node_additional_meshes` extension with [glTF-Transform](https://gltf-transform.donmccurdy.com/). The accompanying TypeScript source demonstrates how to:

- Declare a custom `Extension` and `ExtensionProperty` pair that mirror the extension schema.
- Populate a document with additional mesh data (vertices, indices, and auxiliary attributes) shared across multiple topologies.
- Register the extension with `NodeIO` to serialize the authoring result as a `.gltf` asset.

> **Note**
> The code focuses on the authoring workflow; production-ready tooling should add further validation and cover the JSON reader path.

## Running the example

1. Install dependencies (glTF-Transform v3.7 or newer is recommended):
   ```bash
   npm install @gltf-transform/core @gltf-transform/extensions
   ```
2. Compile the TypeScript source:
   ```bash
   npx tsc b4z-node-additional-meshes-extension.ts --target ES2020 --moduleResolution node --module commonjs
   ```
3. Execute the generated JavaScript file to emit `mixed-topologies.gltf`:
   ```bash
   node b4z-node-additional-meshes-extension.js
   ```

Inspect the resulting asset to see the serialized `B4Z_node_additional_meshes` payload on the root node.
