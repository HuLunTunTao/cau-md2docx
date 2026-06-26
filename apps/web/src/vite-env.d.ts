/// <reference types="vite/client" />

declare module "*.docx?url" {
  const src: string;
  export default src;
}
