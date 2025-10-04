# WebGPU volumetric mesh viewer

This Vite project loads the sample `webgpu-volumetric-mesh.gltf` file, expands the `B4Z_node_additional_meshes` extension into renderable triangle primitives, and renders the result with WebGPU. Each face primitive is culled according to three UI sliders that clamp the primitive centers along the X, Y, and Z axes.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer.
- A Chromium-based browser with WebGPU enabled (for example, Chrome 113+ with the `--enable-unsafe-webgpu` flag).

## Getting started

From this folder, install the project dependencies and start the Vite development server:

```bash
npm install
npm run dev -- --host
```

Vite will print a local URL such as `http://localhost:5173/`. Open that address in your WebGPU-enabled browser to view the sample. The development server also hosts the `public/webgpu-volumetric-mesh.gltf` asset needed by the viewer.

## Building for production

To emit a static build suitable for deployment, run:

```bash
npm run build
```

Vite will output the compiled assets to `dist/`. Preview the production build locally with:

```bash
npm run preview
```

This command starts a local server that serves the optimized bundle.
