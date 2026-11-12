import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";

await mkdir(new URL("../assets/", import.meta.url), { recursive: true });
const source = await readFile(new URL("../assets/kitchen-icon.svg", import.meta.url));
await sharp(source).resize(1024, 1024).png().toFile(new URL("../assets/icon.png", import.meta.url).pathname);
console.log("Generated TimC's Kitchen iOS/Android app icon.");
