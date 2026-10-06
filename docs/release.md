# Verified offline release

PresetTint edits selected color-shaped values in an existing OpenSCAD Customizer
v1 JSON file. Choose a preset and keys explicitly, review the exact encoded
strings and quantization, then save a copy plus a hash receipt. Hex and RGB stay
opaque; an existing RGBA vector retains its fourth alpha component. Every byte
outside changed value-string tokens is preserved, including other presets.

The tool is one offline HTML file. It reads no SCAD or media, makes no network
requests and executes no supplied model. It preserves the existing value's arity;
it cannot validate model enums, ranges or default types. Keep the original preset
and place/name the copy for the matching model. The supported consumer is the
official **2026.10.05 snapshot**, not a claim about all OpenSCAD releases.

## Executed evidence

- Tested source: `23e0cece7a965afedead7a1e9a6fc88b43c35e43`
- [Browser download → official CLI run 37539834638](https://github.com/Masanori-Spec/preset-tint/actions/runs/37539834638)
- [Separate CLI run 37539834631](https://github.com/Masanori-Spec/preset-tint/actions/runs/37539834631)
- 39 core tests and 31 browser cases passed; zero recorded page errors or network requests
- Hosted Chrome 154.0.8037.57 ran with its sandbox requested; the retained actual
  main-process command contains neither sandbox-disabling flag
- Tested HTML SHA-256: `17f224036f28b79e7043afbf7ac99a4717714203f016c980b8560205a41e4e87`
- Actual downloaded JSON SHA-256: `f3346dbf980dceb9e0e3c133c28356cbebffb04d6de9d73a584a8717e0343c00`

The actual browser file entered the same independent literal byte and CSG oracle
as the earlier [native feasibility checkpoint](native-feasibility.md). It produced
red `[1,0,0,1]`, green `[0,1,0,1]` and half-alpha blue `[0,0,1,0.5]`, with matching
ECHO values, three 7×2×1 cubes and x translations 1/13/26. Non-color CSG stayed
unchanged. The Other preset produced byte-identical CSG before and after editing.

Two faulty RGB values were tested: a four-channel string against the fixture's
three-channel default, and a JSON array instead of a string. Both exited 0 and
fell back to `[0.2,0.3,0.4,1]`. The intended-color oracle rejected both. Exit status
alone is not acceptance. Publisher checksum, file size and SHA-256 were verified
before execution; the actual version was `OpenSCAD version 2026.10.05`. No binary
source commit is inferred from that version string.

Browser checks cover explicit selection, alpha preview, selected-token byte
identity, receipt hashes, unchanged presets, strict/NFC-ambiguous input rejection,
32-key UI bounds, invalid channels, stale reads and hashes, repeated exports and
clean offline reopening. The empty-selection test dispatches an empty file-change
event; it is not a claim about operating-system picker cancellation.

## Reviewable copies

The [provenance manifest](evidence/provenance.json) maps every retained copy to
its exact hosted artifact member and SHA-256. These are original synthetic data,
not private user input. Full six-case raw logs and outputs remain in the linked
workflow artifacts. No official vendor binary is included in this repository.

- [English desktop](evidence/desktop-en.png)
- [Japanese mobile with the rightmost numeric column visible](evidence/mobile-ja.png)
- [English mobile with the rightmost numeric column visible](evidence/mobile-en.png)
- [Blocked input](evidence/blocked-en.png)
- [Japanese print review](evidence/review-ja.pdf) and [English print review](evidence/review-en.pdf)
- [Browser report](evidence/browser-report.json), [CLI report](evidence/native-report.json),
  [downloaded JSON](evidence/browser-edited.json) and [receipt](evidence/browser-receipt.json)

This is official CLI preset-import and CSG proof, plus browser runtime/visual
review. It is not GUI authoring, rendered-image, manufacturing-validity or
arbitrary-model compatibility proof. Original code and fixtures have no reuse
license grant.
