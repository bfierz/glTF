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

The `webgpu-volumetric-mesh/` folder contains a standalone Vite project that turns the volumetric cells stored in the `B4Z_node_additional_meshes` extension into a renderable WebGPU surface mesh. Each polyhedral face is triangulated into primitives, the resulting mesh is shaded with a simple directional light, and three UI sliders provide per-axis culling based on each primitive's face center.

To run the example locally:

1. Change into the project directory and install dependencies:
   ```bash
   cd webgpu-volumetric-mesh
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev -- --host
   ```
   The command prints a local URL that serves both the compiled module and the sample `webgpu-volumetric-mesh.gltf` asset.
3. Open the displayed URL in a Chromium-based browser with WebGPU enabled to experiment with the volumetric mesh and culling controls.
