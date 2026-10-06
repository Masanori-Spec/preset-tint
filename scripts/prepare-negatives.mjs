// Faults alter only the RGB key of the actual browser-downloaded preset JSON.
import { readFile, writeFile } from "node:fs/promises";
const source = JSON.parse(
  await readFile("artifacts/native/edited.json", "utf8"),
);
for (const [name, value] of [
  ["wrong-arity", "[0, 1, 0, 1]"],
  ["json-array", [0, 1, 0]],
]) {
  const data = structuredClone(source);
  data.parameterSets.Palette.paint_rgb = value;
  await writeFile(
    `artifacts/native/${name}.json`,
    JSON.stringify(data, null, 2) + "\n",
  );
}
