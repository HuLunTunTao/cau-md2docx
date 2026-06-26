import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve(__dirname, "src/assets"), { recursive: true });
copyFileSync(
  resolve(__dirname, "../../packages/cover/cau-cover.docx"),
  resolve(__dirname, "src/assets/cau-cover.docx")
);

export default defineConfig({
  base: "/cau-md2docx/",
  plugins: [react()],
  server: {
    port: 5173
  }
});
