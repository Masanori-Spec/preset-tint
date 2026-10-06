# Accepted native CLI checkpoint

- Tested source commit: fcd59d87c8ad2b1ef29aea15ce33c8a0be6087fd
- [Official CLI run37459866371](https://github.com/Masanori-Spec/preset-tint/actions/runs/37459866371)
- Artifact11412665265, SHA-256 f7af1793af1f19cd02b571a0c4273d1bd08c4fb13c87b2eb9a414ec04fec2862
- Actual `--version`: `OpenSCAD version 2026.10.05`
- Official snapshot file size84552184 and SHA-256388c33da0848e54ec0b46b8e1e4ed05d83bd79865188db9ceba5ea5efdf619f3,
  matched to the publisher's checksum before any execution

The original synthetic fixture and existing preset produced edited CSG colors
`[1,0,0,1]`, `[0,1,0,1]` and `[0,0,1,0.5]` for hex, RGB and RGBA respectively.
The exact ECHO values, cube dimensions7×2×1 and x translations1/13/26 matched
independent handwritten expectations. CSG outside color values was unchanged;
the Other preset produced byte-identical CSG before/after the edit.

Two deliberately invalid RGB values both exited0: a four-component encoded string
where the fixture requires three, and a JSON array instead of an encoded string.
Both genuinely fell back to the model default RGB0.2/0.3/0.4. The independent
positive-color oracle rejected both, while their unaffected geometry and other
colors remained correct. A zero exit status is therefore insufficient proof.

The independent Python byte oracle also verified exact selected-token-only JSON
changes and preserved all other parameters/presets.37 core tests passed at this
checkpoint, including native NFC key-collision rejection without key rewriting.

This is official CLI preset-import/CSG proof on original synthetic SCAD. It is not
GUI-authoring, rendered-image, manufacturing-validity or arbitrary-model-schema
proof. A later UI needs a fresh gate using its actual downloaded JSON. The binary's
source commit is not inferred from its date/version string.
