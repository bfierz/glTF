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

## WebGPU volumetric mesh viewer

The `webgpu-volumetric-mesh.ts` script demonstrates how to consume volumetric cell data in the browser. Each polyhedral face is triangulated into renderable primitives, and the resulting mesh is displayed with WebGPU. UI sliders expose per-axis culling thresholds using each primitive's face center.

To try it locally:

1. Compile the TypeScript source into an ES module:
   ```bash
   npx tsc webgpu-volumetric-mesh.ts --target ES2022 --module ES2022 --lib dom,dom.iterable,es2022 --outDir .
   ```
   The command emits `webgpu-volumetric-mesh.js` next to the original source.
2. Serve the directory with any static web server (for example, `npx http-server .`). Ensure `webgpu-volumetric-mesh.gltf` is
   hosted alongside the compiled script so the viewer can fetch the volumetric dataset.
3. Open `webgpu-volumetric-mesh.html` in a recent Chromium-based browser with WebGPU enabled to explore the mesh and interactive
   culling controls.
