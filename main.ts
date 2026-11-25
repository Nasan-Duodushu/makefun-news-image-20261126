// Sum up 26 November's world news in one image: the repository holds the
// finished front-page illustration as asset.jpg — Ukraine's drone strikes on
// two Russian refineries and Putin's retaliation vow, the leaked toll of at
// least 490,000 Russian soldiers killed since 2022, tankers hit by mines in
// the Strait of Hormuz with a Houthi drone wounding 11 in Riyadh, and the
// Israeli strike that killed Hamas's internal security chief in Gaza City —
// and this program copies it to entry.png in the output directory (the file
// is a JPEG, which the rules allow: the name stays entry.png and the format
// is told by its first bytes). The four stories were verified across several
// independent outlets before the page was drawn, and the date on the
// masthead is the day the page sums up: Thursday 26 November 2026.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 1048576;
const JPEG_SOI = 0xffd8;
const JPEG_EOI = 0xffd9;
const EXPECTED_W = 1024;
const EXPECTED_H = 1024;

function fail(message: string): never {
  throw new Error(`news-image-20261126: ${message}`);
}

function readJpegDimensions(bytes: Buffer): [number, number] {
  // Walk the JPEG markers until the first SOF frame header gives width/height.
  let offset = 2;
  while (offset + 9 <= bytes.length) {
    if (bytes[offset] !== 0xff) fail("asset.jpg has a bad JPEG marker");
    const marker = bytes[offset + 1];
    if (marker === 0xd9) break; // EOI before any frame: not a picture
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      // Standalone marker with no length field: step past its two bytes.
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) fail("asset.jpg has a bad JPEG segment length");
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      return [width, height];
    }
    offset += 2 + length;
  }
  fail("asset.jpg has no JPEG frame header");
}

function loadFrontPage(here: string): Buffer {
  const source = join(here, "asset.jpg");
  if (!existsSync(source)) fail("asset.jpg is missing from the entry");
  const bytes = readFileSync(source);
  if (bytes.length > MAX_BYTES) {
    fail(`asset.jpg is ${bytes.length} bytes, over the 1 MiB limit`);
  }
  if (bytes.length < 4) fail("asset.jpg is too small to be a whole JPEG");
  if (bytes.readUInt16BE(0) !== JPEG_SOI) fail("asset.jpg does not start with a JPEG SOI marker");
  if (bytes.readUInt16BE(bytes.length - 2) !== JPEG_EOI) {
    fail("asset.jpg does not end with a JPEG EOI marker");
  }
  const [width, height] = readJpegDimensions(bytes);
  if (width !== EXPECTED_W || height !== EXPECTED_H) {
    fail(`asset.jpg is ${width}x${height}, expected ${EXPECTED_W}x${EXPECTED_H}`);
  }
  return bytes;
}

function main(): void {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const bytes = loadFrontPage(here);
  const outDir = process.env.OUTPUT_DIR ?? "/output";
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const target = join(outDir, "entry.png");
  writeFileSync(target, bytes, { mode: 0o644 });
  console.log(`wrote ${target} (${bytes.length} bytes, ${EXPECTED_W}x${EXPECTED_H} JPEG)`);
}

main();
