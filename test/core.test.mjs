import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  inspectPresets,
  editPreset,
  colorValue,
  PresetError,
  LIMITS,
} from "../src/core.mjs";
const input = new Uint8Array(
    readFileSync(new URL("./fixtures/original.json", import.meta.url)),
  ),
  text = new TextDecoder().decode(input),
  enc = (s) => new TextEncoder().encode(s);
const edits = [
  { key: "paint_hex", rgba: [1, 0, 0, 1] },
  { key: "paint_rgb", rgba: [0, 1, 0, 1] },
  { key: "paint_rgba", rgba: [0, 0, 1, 0.5] },
];
const code = (c) => (e) => e instanceof PresetError && e.code === c;
test("literal selected values change and every other byte stays identical", () => {
  const r = editPreset(input, "Palette", edits);
  const expected = text
    .replace('"#000000"', '"#ff0000"')
    .replace('"[0.25, 0.5, 0.75]"', '"[0, 1, 0]"')
    .replace('"[0.5, 0.25, 0.75, 0.25]"', '"[0, 0, 1, 0.5]"');
  assert.equal(new TextDecoder().decode(r.output), expected);
  assert.deepEqual(r.receipt.changedKeys, [
    "paint_hex",
    "paint_rgb",
    "paint_rgba",
  ]);
  assert.deepEqual(
    JSON.parse(expected).parameterSets.Other,
    JSON.parse(text).parameterSets.Other,
  );
});
test("BOM, CRLF and escaped names preserve all untouched bytes", () => {
  const source =
    "\uFEFF" +
    text.replaceAll("\n", "\r\n").replace('"Palette"', '"P\\u0061lette"');
  const r = editPreset(enc(source), "Palette", [edits[0]]);
  assert.equal(
    new TextDecoder("utf-8", { ignoreBOM: true }).decode(r.output),
    source.replace('"#000000"', '"#ff0000"'),
  );
});
test("prototype-like names are data, never object assignment", () => {
  const source =
    '{"fileFormatVersion":"1","parameterSets":{"__proto__":{"constructor":"#000000","__proto__":"opaque"}}}';
  const r = editPreset(enc(source), "__proto__", [
    { key: "constructor", rgba: [1, 0, 0, 1] },
  ]);
  assert.equal(
    JSON.parse(new TextDecoder().decode(r.output)).parameterSets.__proto__
      .constructor,
    "#ff0000",
  );
  assert.equal({}.polluted, undefined);
});
test("RGBA alpha remains fourth component, RGB remains three", () => {
  const r = editPreset(input, "Palette", edits);
  const p = JSON.parse(new TextDecoder().decode(r.output)).parameterSets
    .Palette;
  assert.equal(p.paint_rgb, "[0, 1, 0]");
  assert.equal(p.paint_rgba, "[0, 0, 1, 0.5]");
  assert.equal(typeof p.paint_rgb, "string");
});
test("hex quantization is explicit in the receipt", () => {
  const r = editPreset(input, "Palette", [
    { key: "paint_hex", rgba: [0.5, 0, 0, 1] },
  ]);
  assert.equal(r.receipt.edits[0].after, "#800000");
  assert.equal(r.receipt.edits[0].encodedRGBA[0], 128 / 255);
  assert.notEqual(r.receipt.edits[0].quantizationRGBA[0], 0);
});
for (const key of ["paint_hex", "paint_rgb"])
  test(`${key} rejects alpha loss`, () =>
    assert.throws(
      () => editPreset(input, "Palette", [{ key, rgba: [1, 0, 0, 0.5] }]),
      code("ALPHA_LOSS"),
    ));
for (const rgba of [
  [0, 0, 0],
  [-1, 0, 0, 1],
  [0, 2, 0, 1],
  [0, 0, 0, Infinity],
  [0, 0, 0, NaN],
  ["0", 0, 0, 1],
])
  test(`bad channels ${String(rgba)}`, () =>
    assert.throws(
      () => editPreset(input, "Palette", [{ key: "paint_rgb", rgba }]),
      code("CHANNELS"),
    ));
for (const value of [
  "red",
  "#fff",
  "#ff000080",
  "[255, 0, 0]",
  "[0, 1]",
  "[0, 1, 0, 1, 0]",
  '[0, 1, 0] + import("x")',
  "[0, 1, 0,]",
  "[0,\t1,0]",
  "\n[0,1,0]",
  "[0, .5, 1]",
  "[0, NaN, 1]",
])
  test(`unsupported candidate ${JSON.stringify(value)}`, () =>
    assert.equal(colorValue(value), null));
test("ordinary encoded scientific notation is recognized", () =>
  assert.deepEqual(colorValue("[1e-1, 0, 1]").rgba, [0.1, 0, 1, 1]));
test("geometry is not implicitly selected", () => {
  const doc = inspectPresets(input);
  const p = doc.presets.find((x) => x.name === "Palette");
  assert.equal(p.parameters.find((x) => x.key === "position").color, null);
  assert.throws(
    () => editPreset(input, "Palette", [{ key: "width", rgba: [1, 0, 0, 1] }]),
    code("UNSUPPORTED_COLOR"),
  );
});
test("missing or duplicate explicit selection blocks editing", () => {
  assert.throws(
    () => editPreset(input, "Absent", edits),
    code("PRESET_SELECTION"),
  );
  assert.throws(() => editPreset(input, "Palette", []), code("CHANGE_LIMIT"));
  assert.throws(
    () => editPreset(input, "Palette", [edits[0], edits[0]]),
    code("KEY_SELECTION"),
  );
  assert.throws(
    () =>
      editPreset(input, "Palette", [{ key: "missing", rgba: [1, 0, 0, 1] }]),
    code("KEY_SELECTION"),
  );
});
test("semantic no-op reports no changes", () =>
  assert.throws(
    () =>
      editPreset(input, "Palette", [{ key: "paint_hex", rgba: [0, 0, 0, 1] }]),
    code("NO_CHANGES"),
  ));
test("JSON arrays/numbers/objects are never native encoded value strings", () => {
  for (const value of [[0, 1, 0], 12, {}, null]) {
    const obj = JSON.parse(text);
    obj.parameterSets.Palette.paint_rgb = value;
    assert.throws(
      () => inspectPresets(enc(JSON.stringify(obj))),
      code("ENCODED_STRING"),
    );
  }
});
test("duplicate decoded keys are rejected at every level", () => {
  for (const s of [
    '{"fileFormatVersion":"1","fileFormatVersion":"1","parameterSets":{}}',
    '{"fileFormatVersion":"1","parameterSets":{"A":{"x":"#000000","\\u0078":"#ffffff"}}}',
  ])
    assert.throws(() => inspectPresets(enc(s)), code("DUPLICATE_KEY"));
});
test("only exact version string1 is supported", () => {
  for (const value of [1, "2", null])
    assert.throws(
      () =>
        inspectPresets(
          enc(
            text.replace(
              '"fileFormatVersion": "1"',
              `"fileFormatVersion": ${JSON.stringify(value)}`,
            ),
          ),
        ),
      code("FORMAT_VERSION"),
    );
});
test("strict JSON rejects trailing syntax and unpaired surrogates", () => {
  for (const s of [
    text + "x",
    text.replace('"7"', '"7",'),
    text.replace('"7"', '"\\uD800"'),
  ])
    assert.throws(() => inspectPresets(enc(s)), PresetError);
  assert.throws(() => inspectPresets(new Uint8Array([255])), code("ENCODING"));
  assert.throws(() => inspectPresets(enc("null")), code("PRESET_SHAPE"));
});
test("resource limits fail closed", () => {
  assert.throws(
    () => inspectPresets(new Uint8Array(LIMITS.bytes + 1)),
    code("INPUT_LIMIT"),
  );
  assert.throws(
    () => inspectPresets(enc('{"x":'.repeat(26) + "null" + "}".repeat(26))),
    code("STRUCTURE_LIMIT"),
  );
  const x = JSON.parse(text);
  x.metadata = "x".repeat(LIMITS.string + 1);
  assert.throws(
    () => inspectPresets(enc(JSON.stringify(x))),
    code("STRING_LIMIT"),
  );
});

test("native NFC-equivalent parameter keys reject without rewriting", () => {
  const source =
    '{"fileFormatVersion":"1","parameterSets":{"Palette":{"é":"#000000","e\\u0301":"#ffffff"}}}';
  assert.throws(() => inspectPresets(enc(source)), code("PARAMETER_COLLISION"));
});
test("a single decomposed key retains its original encoded bytes", () => {
  const source =
    '{"fileFormatVersion":"1","parameterSets":{"Palette":{"e\\u0301":"#000000"}}}';
  const r = editPreset(enc(source), "Palette", [
    { key: "e\u0301", rgba: [1, 0, 0, 1] },
  ]);
  assert.equal(
    new TextDecoder().decode(r.output),
    source.replace('"#000000"', '"#ff0000"'),
  );
});
test("normalized names in separate presets remain independent", () => {
  const source =
    '{"fileFormatVersion":"1","parameterSets":{"A":{"é":"#000000"},"B":{"e\\u0301":"#ffffff"}}}';
  assert.equal(inspectPresets(enc(source)).presets.length, 2);
});
