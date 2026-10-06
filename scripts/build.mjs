import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const sample = await readFile("test/fixtures/original.json", "utf8");
await writeFile(
  "src/sample.mjs",
  "// Original synthetic preset data. No SCAD or external runtime dependency.\nexport const SAMPLE_JSON=" +
    JSON.stringify(sample) +
    ";\n",
);
const result = await build({
  entryPoints: ["web/app.mjs"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome110", "firefox115", "safari16"],
  write: false,
  minify: false,
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script"),
  css = await readFile("web/styles.css", "utf8");
let html = await readFile("web/index.html", "utf8");
html = html
  .replace(
    /<link rel="stylesheet" href="styles\.css"\s*\/?\s*>/,
    () => "<style>" + css + "</style>",
  )
  .replace(
    '<script src="app.js"></script>',
    () => "<script>" + js + "</script>",
  );
if (/href="styles\.css"|src="app\.js"/.test(html))
  throw Error("Offline template not fully bundled");
await mkdir("dist", { recursive: true });
await writeFile("dist/preset-tint.html", html);
console.log(`Built standalone offline HTML (${Buffer.byteLength(html)} bytes)`);
