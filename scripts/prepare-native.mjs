import { readFile, writeFile, mkdir } from "node:fs/promises";
import { editPreset } from "../src/core.mjs";
await mkdir("artifacts/native", { recursive: true });
const before = new Uint8Array(await readFile("test/fixtures/original.json"));
const result = editPreset(before, "Palette", [
  { key: "paint_hex", rgba: [1, 0, 0, 1] },
  { key: "paint_rgb", rgba: [0, 1, 0, 1] },
  { key: "paint_rgba", rgba: [0, 0, 1, 0.5] },
]);
await writeFile("artifacts/native/edited.json", result.output);
await writeFile(
  "artifacts/native/receipt.json",
  JSON.stringify(result.receipt, null, 2) + "\n",
);
for (const [name, value] of [
  ["wrong-arity", "[0, 1, 0, 1]"],
  ["json-array", [0, 1, 0]],
]) {
  const data = JSON.parse(new TextDecoder().decode(result.output));
  data.parameterSets.Palette.paint_rgb = value;
  await writeFile(
    `artifacts/native/${name}.json`,
    JSON.stringify(data, null, 2) + "\n",
  );
}
console.log("Prepared only original JSON fixtures; no SCAD execution");
