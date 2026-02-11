import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgrPlugin from "vite-plugin-svgr";
import { ViteEjsPlugin } from "vite-plugin-ejs";
import checker from "vite-plugin-checker";
import { createHtmlPlugin } from "vite-plugin-html";
import { woff2BrowserPlugin } from "../scripts/woff2/woff2-vite-plugins";

// Electron-specific Vite config:
// - No VitePWA (no service worker)
// - No Sitemap
// - base: './' for file:// protocol
// - Outputs to build-electron/

export default defineConfig(({ mode }) => {
  const envVars = loadEnv(mode, `../`);

  return {
    base: "./",
    server: {
      port: Number(envVars.VITE_APP_PORT || 3000),
      open: false,
    },
    envDir: "../",
    resolve: {
      alias: [
        {
          find: /^@excalidraw\/common$/,
          replacement: path.resolve(
            __dirname,
            "../packages/common/src/index.ts",
          ),
        },
        {
          find: /^@excalidraw\/common\/(.*?)/,
          replacement: path.resolve(__dirname, "../packages/common/src/$1"),
        },
        {
          find: /^@excalidraw\/element$/,
          replacement: path.resolve(
            __dirname,
            "../packages/element/src/index.ts",
          ),
        },
        {
          find: /^@excalidraw\/element\/(.*?)/,
          replacement: path.resolve(__dirname, "../packages/element/src/$1"),
        },
        {
          find: /^@excalidraw\/excalidraw$/,
          replacement: path.resolve(
            __dirname,
            "../packages/excalidraw/index.tsx",
          ),
        },
        {
          find: /^@excalidraw\/excalidraw\/(.*?)/,
          replacement: path.resolve(__dirname, "../packages/excalidraw/$1"),
        },
        {
          find: /^@excalidraw\/math$/,
          replacement: path.resolve(__dirname, "../packages/math/src/index.ts"),
        },
        {
          find: /^@excalidraw\/math\/(.*?)/,
          replacement: path.resolve(__dirname, "../packages/math/src/$1"),
        },
        {
          find: /^@excalidraw\/utils$/,
          replacement: path.resolve(
            __dirname,
            "../packages/utils/src/index.ts",
          ),
        },
        {
          find: /^@excalidraw\/utils\/(.*?)/,
          replacement: path.resolve(__dirname, "../packages/utils/src/$1"),
        },
      ],
    },
    build: {
      outDir: "build-electron",
      rollupOptions: {
        input: path.resolve(__dirname, "index.electron.html"),
        output: {
          assetFileNames(chunkInfo) {
            if (chunkInfo?.name?.endsWith(".woff2")) {
              const family = chunkInfo.name.split("-")[0];
              return `fonts/${family}/[name][extname]`;
            }
            return "assets/[name]-[hash][extname]";
          },
          manualChunks(id) {
            if (
              id.includes("packages/excalidraw/locales") &&
              id.match(/en.json|percentages.json/) === null
            ) {
              const index = id.indexOf("locales/");
              return `locales/${id.substring(index + 8)}`;
            }
            if (id.includes("@excalidraw/mermaid-to-excalidraw")) {
              return "mermaid-to-excalidraw";
            }
          },
        },
      },
      sourcemap: false,
      assetsInlineLimit: 0,
    },
    plugins: [
      woff2BrowserPlugin(),
      react(),
      checker({
        typescript: true,
        eslint: undefined,
        overlay: {
          initialIsOpen: false,
        },
      }),
      svgrPlugin(),
      ViteEjsPlugin(),
      createHtmlPlugin({
        minify: true,
      }),
    ],
    publicDir: "../public",
    define: {
      "import.meta.env.VITE_APP_DISABLE_SENTRY": JSON.stringify("true"),
      "import.meta.env.VITE_APP_IS_ELECTRON": JSON.stringify("true"),
    },
  };
});
