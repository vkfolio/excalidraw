import { build } from "esbuild";

const common = {
  bundle: true,
  platform: "node",
  target: "node18",
  external: ["electron"],
  sourcemap: true,
  minify: false,
};

// Build main process
await build({
  ...common,
  entryPoints: ["src/main/index.ts"],
  outfile: "dist/main/index.js",
});

// Build preload script
await build({
  ...common,
  entryPoints: ["src/preload/index.ts"],
  outfile: "dist/preload/index.js",
});

console.log("Electron main & preload built successfully.");
