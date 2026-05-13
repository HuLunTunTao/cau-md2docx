import { defineConfig } from "vite";

export default defineConfig({
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
