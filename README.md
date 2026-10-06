# PresetTint

An offline editor of **existing OpenSCAD Customizer preset color values**.
The official CLI feasibility gate has passed. The new standalone UI is a candidate
awaiting its own actual browser-download → official CLI proof.

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
visual rendering. The [native feasibility run37459866371](https://github.com/Masanori-Spec/preset-tint/actions/runs/37459866371)
and its actual artifacts were independently accepted. See
[the native checkpoint](docs/native-feasibility.md).

```sh
npm ci --ignore-scripts
npm run verify
npm run prepare:native
python3 scripts/verify-presets.py
```

Original source and synthetic fixtures have no reuse license grant. Official
vendor binaries are downloaded only into the hosted runner's temporary directory
and are excluded from the public source and evidence payload.

## Offline UI candidate

Open `dist/preset-tint.html` locally. Choose existing JSON, explicitly select a
preset and up to 32 existing color-shaped keys, then edit hex or normalized numeric
channels. Preview alpha against a checkerboard and inspect the exact quoted
encoded strings before downloading a copy and hash receipt. Choosing a different
preset clears pending edits. No preset or key is automatically selected.

The tool does not load or execute SCAD. A shape resembling a color is not proof of
a key's meaning. The model's enums/ranges/default types still need to match the
existing preset. Keep the original JSON safe and place/name the copy for its
matching model. OpenSCAD normally reads a sidecar sharing the model's basename.

Japanese/English, keyboard controls, 320/390px layouts, print review, stale async
guards and clean offline reopening are covered by the hosted browser test plan.
Those browser results remain pending until the browser-native workflow passes.
That workflow uses the actual UI-downloaded JSON directly in the accepted six
official CLI cases, rather than replacing it with the prototype editor output.
