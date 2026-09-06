import { access, cp, mkdir, rm } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("dist/", root);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const runtimeFiles = [
  "index.html",
  "lab.html",
  "home.css",
  "styles.css",
  "tokens.css",
  "home.js",
  "app.js",
  "progression.js",
  "typing-engine.js",
  "favicon.svg",
];

for (const file of runtimeFiles) {
  await cp(new URL(file, root), new URL(file, output));
}

await cp(new URL("data/", root), new URL("data/", output), { recursive: true });

const optionalFiles = ["404.html", "safety.html", "privacy.html", "robots.txt", "_headers"];
for (const file of optionalFiles) {
  try {
    await access(new URL(file, root));
    await cp(new URL(file, root), new URL(file, output));
  } catch {
    // Optional deployment metadata is copied only when it exists.
  }
}

console.log(`Built ${runtimeFiles.length} runtime files and data/ into dist/`);
