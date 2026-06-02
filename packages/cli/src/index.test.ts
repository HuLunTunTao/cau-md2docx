import { describe, expect, it } from "vitest";
import { readImageDimensions } from "./index";

describe("readImageDimensions", () => {
  it("reads SVG dimensions from width and height attributes", async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="980" height="210"></svg>'
    );

    await expect(readImageDimensions(svg, "image/svg+xml")).resolves.toEqual({
      widthPx: 980,
      heightPx: 210
    });
  });

  it("reads SVG dimensions from viewBox when explicit dimensions are missing", async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 180"></svg>'
    );

    await expect(readImageDimensions(svg, "image/svg+xml")).resolves.toEqual({
      widthPx: 640,
      heightPx: 180
    });
  });

  it("reads PNG dimensions from the image header", async () => {
    const pngHeader = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10,
      0, 0, 0, 13,
      73, 72, 68, 82,
      0, 0, 3, 208,
      0, 0, 0, 210
    ]);

    await expect(readImageDimensions(pngHeader, "image/png")).resolves.toEqual({
      widthPx: 976,
      heightPx: 210
    });
  });
});
