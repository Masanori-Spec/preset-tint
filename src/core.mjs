export const LIMITS = Object.freeze({
  bytes: 4 * 1024 * 1024,
  depth: 24,
  nodes: 30000,
  presets: 200,
  parameters: 10000,
  changes: 256,
  string: 65536,
});
export class PresetError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PresetError";
    this.code = code;
  }
}
const fail = (code, message) => {
  throw new PresetError(code, message);
};
const validUnicode = (text) => {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = text.charCodeAt(++i);
      if (!(d >= 0xdc00 && d <= 0xdfff)) return false;
    } else if (c >= 0xdc00 && c <= 0xdfff) return false;
  }
  return true;
};
// Strict JSON spans preserve every byte outside the explicitly replaced string tokens.
function parse(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length > LIMITS.bytes)
    fail("INPUT_LIMIT", "Use UTF-8 JSON up to 4 MiB");
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    fail("ENCODING", "Preset JSON must be valid UTF-8");
  }
  let at = text.startsWith("\uFEFF") ? 1 : 0,
    nodes = 0;
  const white = () => {
    while (/[ \t\r\n]/.test(text[at] ?? "x")) at++;
  };
  function string() {
    const start = at++;
    let escaped = false;
    while (at < text.length) {
      const c = text[at++];
      if (c === '"' && !escaped) {
        let value;
        try {
          value = JSON.parse(text.slice(start, at));
        } catch {
          fail("INVALID_JSON", "Invalid JSON string");
        }
        if (value.length > LIMITS.string)
          fail("STRING_LIMIT", "JSON strings must fit within 65536 characters");
        if (!validUnicode(value))
          fail("ENCODING", "Unpaired Unicode surrogate is unsupported");
        return { type: "string", value, start, end: at };
      }
      if (c === "\\" && !escaped) escaped = true;
      else escaped = false;
    }
    fail("INVALID_JSON", "Unterminated JSON string");
  }
  function value(depth) {
    white();
    if (depth > LIMITS.depth || ++nodes > LIMITS.nodes)
      fail(
        "STRUCTURE_LIMIT",
        "Preset JSON nesting or item count exceeds limits",
      );
    const start = at,
      c = text[at];
    if (c === '"') return string();
    if (c === "{") {
      at++;
      white();
      const entries = new Map();
      if (text[at] === "}") {
        at++;
        return { type: "object", entries, start, end: at };
      }
      while (true) {
        white();
        if (text[at] !== '"') fail("INVALID_JSON", "Expected object key");
        const key = string().value;
        if (entries.has(key))
          fail("DUPLICATE_KEY", "Duplicate decoded JSON key");
        white();
        if (text[at++] !== ":") fail("INVALID_JSON", "Expected colon");
        entries.set(key, value(depth + 1));
        white();
        const sep = text[at++];
        if (sep === "}") break;
        if (sep !== ",")
          fail("INVALID_JSON", "Expected comma or closing brace");
      }
      return { type: "object", entries, start, end: at };
    }
    if (c === "[") {
      at++;
      white();
      const items = [];
      if (text[at] === "]") {
        at++;
        return { type: "array", items, start, end: at };
      }
      while (true) {
        items.push(value(depth + 1));
        white();
        const sep = text[at++];
        if (sep === "]") break;
        if (sep !== ",")
          fail("INVALID_JSON", "Expected comma or closing bracket");
      }
      return { type: "array", items, start, end: at };
    }
    const m =
      /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
        text.slice(at),
      );
    if (!m) fail("INVALID_JSON", "Unexpected JSON value");
    at += m[0].length;
    const v = JSON.parse(m[0]);
    if (typeof v === "number" && !Number.isFinite(v))
      fail("INVALID_JSON", "Non-finite JSON number");
    return { type: v === null ? "null" : typeof v, value: v, start, end: at };
  }
  const root = value(0);
  white();
  if (at !== text.length)
    fail("INVALID_JSON", "Unexpected trailing JSON content");
  return { text, root };
}
const object = (node, label) => {
  if (node?.type !== "object")
    fail("PRESET_SHAPE", `${label} must be an object`);
  return node.entries;
};
export function colorValue(encoded) {
  if (typeof encoded !== "string" || encoded.length > 128) return null;
  if (/^#[0-9a-f]{6}$/i.test(encoded))
    return {
      kind: "hex",
      arity: 3,
      rgba: [1, 3, 5]
        .map((i) => parseInt(encoded.slice(i, i + 2), 16) / 255)
        .concat(1),
    };
  const number = "-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?";
  const expr = new RegExp(
    "^[ ]*\\[[ ]*(" + number + ")(?:[ ]*,[ ]*" + number + "){2,3}[ ]*\\][ ]*$",
  );
  if (!expr.test(encoded)) return null;
  const channels = encoded
    .trim()
    .slice(1, -1)
    .split(",")
    .map((x) => Number(x.trim()));
  if (
    ![3, 4].includes(channels.length) ||
    channels.some((x) => !Number.isFinite(x) || x < 0 || x > 1)
  )
    return null;
  return {
    kind: channels.length === 3 ? "rgb" : "rgba",
    arity: channels.length,
    rgba: channels.length === 3 ? [...channels, 1] : channels,
  };
}
export function inspectPresets(bytes) {
  const parsed = parse(bytes),
    root = object(parsed.root, "Root");
  if (
    root.get("fileFormatVersion")?.type !== "string" ||
    root.get("fileFormatVersion").value !== "1"
  )
    fail("FORMAT_VERSION", 'Only fileFormatVersion string "1" is supported');
  const sets = object(root.get("parameterSets"), "parameterSets");
  if (!sets.size || sets.size > LIMITS.presets)
    fail("PRESET_LIMIT", "Use 1–200 existing presets");
  const presets = [];
  let count = 0;
  for (const [name, node] of sets) {
    if (!name || name.length > 256 || /[\x00-\x1f\x7f]/.test(name))
      fail(
        "PRESET_NAME",
        "Preset names must be nonempty printable text up to 256 characters",
      );
    const entries = object(node, `Preset ${name}`),
      parameters = [];
    const normalizedKeys = new Set();
    for (const [key, token] of entries) {
      const normalizedKey = key.normalize("NFC");
      if (normalizedKeys.has(normalizedKey))
        fail(
          "PARAMETER_COLLISION",
          "Parameter keys collide after native NFC normalization",
        );
      normalizedKeys.add(normalizedKey);
      if (++count > LIMITS.parameters)
        fail("PARAMETER_LIMIT", "Too many preset parameters");
      if (!key || key.length > 256 || /[\x00-\x1f\x7f]/.test(key))
        fail(
          "PARAMETER_NAME",
          "Parameter keys must be nonempty printable text up to 256 characters",
        );
      if (token.type !== "string")
        fail(
          "ENCODED_STRING",
          "Every preset parameter value must be an encoded string, never a JSON array/object/number",
        );
      parameters.push({
        key,
        value: token.value,
        color: colorValue(token.value),
        token,
      });
    }
    presets.push({ name, parameters });
  }
  return { ...parsed, presets };
}
export function editPreset(bytes, presetName, changes) {
  const doc = inspectPresets(bytes),
    preset = doc.presets.find((p) => p.name === presetName);
  if (!preset)
    fail("PRESET_SELECTION", "Explicitly select one existing preset");
  if (
    !Array.isArray(changes) ||
    !changes.length ||
    changes.length > LIMITS.changes
  )
    fail("CHANGE_LIMIT", "Explicitly choose 1–256 existing color keys");
  const seen = new Set(),
    patches = [],
    edits = [];
  for (const change of changes) {
    if (!change || typeof change.key !== "string" || seen.has(change.key))
      fail("KEY_SELECTION", "Select each existing key once");
    seen.add(change.key);
    const param = preset.parameters.find((p) => p.key === change.key);
    if (!param) fail("KEY_SELECTION", "Cannot create an unknown parameter");
    if (!param.color)
      fail(
        "UNSUPPORTED_COLOR",
        "Selected value must be #RRGGBB or a normalized RGB/RGBA encoded vector string",
      );
    const rgba = change.rgba;
    if (
      !Array.isArray(rgba) ||
      rgba.length !== 4 ||
      rgba.some(
        (x) => typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > 1,
      )
    )
      fail(
        "CHANNELS",
        "Use four finite normalized RGBA channels between 0 and 1",
      );
    if (param.color.arity === 3 && rgba[3] !== 1)
      fail(
        "ALPHA_LOSS",
        "An existing RGB/hex value cannot carry alpha; its representation and arity must remain unchanged",
      );
    const encoded =
      param.color.kind === "hex"
        ? "#" +
          rgba
            .slice(0, 3)
            .map((x) =>
              Math.round(x * 255)
                .toString(16)
                .padStart(2, "0"),
            )
            .join("")
        : "[" +
          rgba
            .slice(0, param.color.arity)
            .map((x) => (Object.is(x, -0) ? "0" : String(x)))
            .join(", ") +
          "]";
    const next = colorValue(encoded);
    if (
      !next ||
      next.kind !== param.color.kind ||
      next.arity !== param.color.arity
    )
      fail("INTERNAL_ENCODING", "Output representation mismatch");
    edits.push({
      preset: presetName,
      key: change.key,
      kind: param.color.kind,
      arity: param.color.arity,
      before: param.value,
      after: encoded,
      requestedRGBA: [...rgba],
      encodedRGBA: next.rgba,
      quantizationRGBA: rgba.map((x, i) => next.rgba[i] - x),
    });
    if (encoded !== param.value)
      patches.push({
        start: param.token.start,
        end: param.token.end,
        replacement: JSON.stringify(encoded),
        key: param.key,
      });
  }
  if (!patches.length) fail("NO_CHANGES", "No selected encoded value changed");
  patches.sort((a, b) => b.start - a.start);
  let text = doc.text;
  for (const p of patches)
    text = text.slice(0, p.start) + p.replacement + text.slice(p.end);
  const output = new TextEncoder().encode(text);
  if (output.length > LIMITS.bytes)
    fail("OUTPUT_LIMIT", "Edited JSON would exceed 4 MiB");
  inspectPresets(output);
  return {
    output,
    receipt: {
      tool: "PresetTint",
      version: "0.1.0",
      formatVersion: "1",
      preset: presetName,
      edits,
      changedKeys: patches.map((p) => p.key).sort(),
      selectedKeys: [...seen],
      preserved:
        "Every original byte outside selected value-string tokens; all other presets and parameters unchanged",
      modelValidation:
        "No SCAD is read or executed; model enums, ranges and default types are not validated",
      hexPolicy:
        "Six-digit RGB hex; each channel rounded to nearest 8-bit integer; alpha must remain1",
      patches: patches.map(({ start, end, key }) => ({
        key,
        startUTF16: start,
        endUTF16: end,
      })),
    },
  };
}
