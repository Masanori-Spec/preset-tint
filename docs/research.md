# Scope and primary-source research

Checked 2026-10-06. PresetTint focuses on explicitly selected existing preset
color-string values, with preserved other values/presets and no model execution.
This is a narrower workflow than a general OpenSCAD model customizer.

## Native format and compatibility limits

At source commit `c0ac8289f1c9db6f70891da5df3b4085b7eaf8b6`,
[ParameterSet.cc](https://github.com/openscad/openscad/blob/c0ac8289f1c9db6f70891da5df3b4085b7eaf8b6/src/core/customizer/ParameterSet.cc)
uses the version 1 preset container and normalizes parameter keys to NFC on native import. The editor rejects NFC-equivalent key collisions within a preset without rewriting the original keys. [ParameterObject.cc](https://github.com/openscad/openscad/blob/c0ac8289f1c9db6f70891da5df3b4085b7eaf8b6/src/core/customizer/ParameterObject.cc)
exports vectors as encoded strings and imports them only when decoded component
count matches the existing model vector. Failed imports can retain defaults.
Model enum/range constraints are model-dependent. This editor does not read SCAD,
so it cannot claim to validate those constraints or that an original preset was
already compatible with an unseen model. It preserves the existing value's arity.

The vector reader removes ordinary spaces. The editor therefore rejects editable
vectors containing other whitespace, expressions, trailing commas or unsupported
numeric syntax. All selected replacements remain JSON strings.

## Why this bounded tool

[Issue #6679](https://github.com/openscad/openscad/issues/6679) remains open and requests
integrated color selection. [PR #6604](https://github.com/openscad/openscad/pull/6604)
closed unmerged on 2026-06-23. The checked
[widget factory](https://github.com/openscad/openscad/blob/c0ac8289f1c9db6f70891da5df3b4085b7eaf8b6/src/gui/parameter/ParameterWidget.cc#L418-L440)
creates generic typed controls. The
[ColorList actions](https://github.com/openscad/openscad/blob/c0ac8289f1c9db6f70891da5df3b4085b7eaf8b6/src/gui/ColorList.cc#L354-L361)
copy a color name or hex string to the clipboard.

The [official Playground](https://github.com/openscad/openscad-playground/blob/012111f06bb6d8dac2b8d30318512494d87d6932/src/components/CustomizerPanel.tsx)
and community tools are relevant alternatives. [OpenSCadCustomizer](https://github.com/jakebullet70/OpenSCadCustomizer)
is a GUI for changing model variables and generating models.
[openscad-customizer-web](https://github.com/TheFehr/openscad-customizer-web)
generates model controls and provides browser model previews/exports.
PresetTint's intended distinction is the bounded existing-color-file workflow and
an auditable patch, without executing a model. This is not an exhaustive claim
that no other tool can perform any of these operations.

## Official snapshot pin

The [official publisher checksum](https://files.openscad.org/snapshots/OpenSCAD-2026.10.05-x86_64.AppImage.sha256)
was read directly and matched the explicit pin:

- OpenSCAD-2026.10.05-x86_64.AppImage
- 84552184 bytes
- SHA-256 388c33da0848e54ec0b46b8e1e4ed05d83bd79865188db9ceba5ea5efdf619f3

The hosted downloader repeats that publisher-metadata check and verifies every
archive byte before extraction/execution. The actual CLI `--version` output is
recorded separately; the filename and research source commit are not treated as
proof of the binary's exact version/commit.

The independent Python oracle contains literal colors, dimensions, matrices and
ECHO values. It does not import the editing core or derive expectations from the
receipt. Wrong-arity and JSON-array fault cases require exact fallback colors,
then must fail the positive color expectation despite a zero exit status.
