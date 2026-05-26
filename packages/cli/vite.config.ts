import { defineConfig } from "vite";
import { builtinModules } from "node:module";

export default defineConfig({
  plugins: [
    {
      name: "node-builtin-imports",
      enforce: "pre",
      resolveId(source) {
        if (builtinModules.includes(source) && !source.startsWith("node:")) {
          return { id: `node:${source}`, external: true };
        }
      }
    }
  ],
  ssr: {
    noExternal: true
  },
  build: {
    ssr: "src/index.ts",
    target: "node20",
    emptyOutDir: false,
    rollupOptions: {
      external: [/^node:/],
      output: {
        banner: "#!/usr/bin/env node",
        entryFileNames: "md2doc-cli.mjs"
      }
    }
  }
});
