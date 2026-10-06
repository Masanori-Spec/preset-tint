# PresetTint

Native-first feasibility for an offline editor of **existing OpenSCAD Customizer
preset color values**. No product UI is present yet; the official CLI gate must
pass first.

Select one existing preset and explicitly select existing keys. The bounded core
edits six-digit RGB hex or normalized RGB/RGBA vector values while preserving
representation, vector arity and every byte outside the selected JSON string
tokens. It preserves all unselected parameters and presets.

The native format is `fileFormatVersion: "1"` with
`parameterSets: { presetName: { key: "encoded value" } }`.
Vector values are strings such as `"[0, 1, 0]"`, **not JSON arrays**.

## Scope

- Existing v1 JSON only; no new preset/key creation or general model editing
- Six-digit `#RRGGBB`, or 3/4 normalized numeric channels in encoded vector strings
- RGB/hex stays opaque; alpha edits require an existing RGBA vector
- Explicit receipt of requested and encoded channels, including hex quantization
- Strict JSON, duplicate decoded keys and native NFC-equivalent parameter keys rejected, UTF-8, bounded size/depth/count
- No user SCAD is read, executed, rewritten or uploaded by the tool
- No claim to validate a model's enums, ranges, default types or vector lengths;
  arity is preserved from the existing encoded preset value

Short/named/eight-digit hex and noncanonical vector number forms are not editable
in this version. They can remain unchanged as ordinary unselected string values.
A shape that resembles a color is not proof of a parameter's model semantics.

## Native acceptance contract

The hosted workflow verifies the official OpenSCAD snapshot's publisher checksum,
size and SHA-256 **before execution**, then records the actual `--version` output.
It runs only the original synthetic `test/fixtures/fixture.scad` with the existing
JSON, edited JSON and unselected preset.

`-o out.csg -p edited.json -P Palette fixture.scad` must produce exact handwritten
RGBA color values, matching ECHO values, cube dimensions and translation matrices.
All non-color CSG must remain unchanged; the other preset's CSG must match exactly.

Two deliberate faults replace only the RGB preset value: a four-component encoded
string where the model expects three, and a JSON array instead of an encoded
string. The checker requires the exact fallback RGB default and rejects it against
the intended-color oracle. Exit 0 alone is never acceptance.

This is official **CLI** compatibility proof, not a claim of GUI authoring or
visual rendering. Native success is pending until the hosted run and actual
artifacts are independently accepted.

```sh
npm ci --ignore-scripts
npm test
npm run prepare:native
python3 scripts/verify-presets.py
```

Original source and synthetic fixtures have no reuse license grant. Official
vendor binaries are downloaded only into the hosted runner's temporary directory
and are excluded from the public source and evidence payload.
