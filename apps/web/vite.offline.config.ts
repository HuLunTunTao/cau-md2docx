import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react(), singleHtmlPlugin()],
  build: {
    outDir: "dist-offline",
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});

function singleHtmlPlugin(): Plugin {
  return {
    name: "md2doc-single-html",
    enforce: "post",
    generateBundle(_, bundle) {
      const htmlAsset = Object.values(bundle).find(
        (item) => item.type === "asset" && item.fileName.endsWith(".html")
      );
      if (!htmlAsset || htmlAsset.type !== "asset" || typeof htmlAsset.source !== "string") return;

      let html = htmlAsset.source;
      for (const item of Object.values(bundle)) {
        if (item.type === "chunk" && item.fileName.endsWith(".js")) {
          html = html.replace(
            new RegExp(`<script type="module" crossorigin src="./${escapeRegExp(item.fileName)}"></script>`),
            `<script type="module">\n${item.code}\n</script>`
          );
          delete bundle[item.fileName];
        }
        if (item.type === "asset" && item.fileName.endsWith(".css") && typeof item.source === "string") {
          html = html.replace(
            new RegExp(`<link rel="stylesheet" crossorigin href="./${escapeRegExp(item.fileName)}">`),
            `<style>\n${item.source}\n</style>`
          );
          delete bundle[item.fileName];
        }
      }

      htmlAsset.fileName = "md2doc-offline.html";
      htmlAsset.source = html;
    }
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
