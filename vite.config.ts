import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";
import { withExternalBuiltins } from "vite-plugin-electron";

const packageJson = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
};

const externalMainDeps = Object.keys(packageJson.dependencies ?? {});

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: "src/main/main.ts",
        vite: withExternalBuiltins({
          build: {
            rollupOptions: {
              external: externalMainDeps
            }
          }
        })
      },
      preload: {
        input: "src/main/preload.ts"
      }
    })
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@main": resolve(__dirname, "src/main"),
      "@renderer": resolve(__dirname, "src/renderer"),
      "@shared": resolve(__dirname, "src/shared"),
      "@assets": resolve(__dirname, "assets")
    }
  },
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("@xterm")) {
            return "xterm";
          }

          if (id.includes("@radix-ui")) {
            return "radix";
          }

          return "vendor";
        }
      }
    }
  }
});
