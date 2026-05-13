import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/cau-md2docx/",
  plugins: [react()],
  server: {
    port: 5173
  }
});
