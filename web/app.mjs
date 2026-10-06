import {
  inspectPresets,
  editPreset,
  PresetError,
  LIMITS,
} from "../src/core.mjs";
import { SAMPLE_JSON } from "../src/sample.mjs";
const $ = (id) => document.getElementById(id),
  initialHTML = "<!doctype html>\n" + document.documentElement.outerHTML;
const ja = Object.fromEntries(
  [...document.querySelectorAll("[data-i18n]")].map((n) => [
    n.dataset.i18n,
    n.textContent,
  ]),
);
ja.title = "プリセットの色を、\n必要なところだけ。";
const en = {
  presetChangeHelp: "Switching presets clears the pending edits.",
  skip: "Skip to workspace",
  title: "A little color.\nOnly where you choose.",
  intro:
    "Choose a preset and existing keys in OpenSCAD Customizer JSON. Edit the color values while keeping vector arity and every unselected byte.",
  offline: "OFFLINE · LOCAL PROCESSING",
  scope:
    "No model is loaded or executed. Uses the existing value shape; model enums and numeric ranges are not validated.",
  consumer: "OpenSCAD 2026.10.05 snapshot · CLI verified",
  workspace: "PALETTE WORKSPACE",
  sample: "Try the sample",
  reset: "Clear",
  inputTitle: "Choose the preset",
  fileLabel: "Existing preset file",
  notChosen: "No file selected",
  fileHelp:
    'UTF-8 · up to 4 MiB. fileFormatVersion must be the string "1"; every parameter value must also be a string.',
  presetLabel: "Target preset",
  choosePreset: "Select a preset",
  keysTitle: "Explicitly select the keys to edit",
  searchLabel: "Filter by key name",
  candidateHelp:
    "Shows color-shaped values. Position vectors can have the same shape, so check what each key means. Up to 32 keys.",
  limits: "Formats and limits",
  formatsHelp:
    "Six-digit #RRGGBB or normalized 0–1 RGB/RGBA encoded vector strings. Short, named and eight-digit hex values are not editable in this version.",
  arityHelp:
    "Original component count is preserved. RGB and hex stay opaque; only an existing RGBA vector can change alpha.",
  limitsHelp:
    "Up to 200 presets, 10,000 parameters and depth 24. Blocks duplicate or NFC-equivalent keys and non-string parameter values.",
  editTitle: "Tune the color values",
  shapeKept: "FORMAT + ARITY PRESERVED",
  initial: "Choose JSON, then explicitly choose the preset and keys.",
  emptyEditor: "Your selected keys will appear here.",
  previewOnly: "Preview shows color values, not a rendered 3D model.",
  reviewTitle: "Review the exact changes",
  changed: "values changed",
  preserved: "values preserved",
  otherPresets: "other presets",
  stringHelp:
    "Vectors stay JSON strings. The quoted values shown here are the exact storage representation.",
  tableCaption: "Exact encoded values for your selected keys",
  key: "Key",
  before: "Before",
  after: "After",
  quantization: "Quantization Δ · RGBA",
  exportTitle: "A copy with other bytes intact",
  exportHelp:
    "Every byte outside the selected value-string tokens is preserved. Download a copy and keep the original safe.",
  loadHelp:
    "OpenSCAD normally finds a JSON file beside the model with the same basename. Place/name the copy for its matching model.",
  export: "Save JSON copy",
  receipt: "Verification receipt · JSON",
  print: "Print this review",
  notesTitle: "A small edit, with a clear boundary.",
  notesBody:
    "Presets and keys are never selected automatically. Check each key’s meaning and constraints against the matching model.",
  receiptTitle: "Keep the edit record, too",
  receiptBody:
    "The receipt includes selected keys, before/after strings, numeric RGBA and quantization, plus input/output SHA-256 hashes.",
  footer: "Change the color. Keep the rest.",
  saveOffline: "Save this tool offline",
};
let lang = "ja",
  revision = 0,
  cardId = 0,
  busy = false,
  lastReceipt = null;
const fresh = () => ({
  bytes: null,
  name: "",
  doc: null,
  preset: "",
  selected: new Map(),
  pending: false,
  error: null,
  result: null,
});
let state = fresh();
const t = (key) => (lang === "en" ? en : ja)[key] ?? key,
  m = (jp, english) => (lang === "ja" ? jp : english);
const node = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
const currentPreset = () =>
  state.doc?.presets.find((p) => p.name === state.preset);
const rgbaCSS = (rgba) =>
  `rgba(${rgba[0] * 255},${rgba[1] * 255},${rgba[2] * 255},${rgba[3]})`;
const rgbHex = (rgba) =>
  "#" +
  rgba
    .slice(0, 3)
    .map((x) =>
      Math.round(x * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
function invalidate() {
  revision++;
  busy = false;
  lastReceipt = null;
  state.result = null;
  $("export-status").textContent = "";
  $("receipt").disabled = true;
  $("export").disabled = true;
}
function selectedRGBA(entry) {
  if (entry.param.color.kind === "hex") {
    if (!/^#[0-9a-f]{6}$/i.test(entry.hex))
      throw new PresetError("HEX_COLOR", "Use six hexadecimal digits: #RRGGBB");
    return [1, 3, 5]
      .map((i) => parseInt(entry.hex.slice(i, i + 2), 16) / 255)
      .concat(1);
  }
  const a = entry.drafts.map((v) => (v.trim() === "" ? NaN : Number(v)));
  if (a.some((x) => !Number.isFinite(x) || x < 0 || x > 1))
    throw new PresetError(
      "CHANNELS",
      "Use finite numeric channels between 0 and 1",
    );
  return a;
}
function compute() {
  state.error = null;
  state.result = null;
  if (state.doc && state.preset && state.selected.size) {
    try {
      state.result = editPreset(
        state.bytes,
        state.preset,
        [...state.selected].map(([key, entry]) => ({
          key,
          rgba: selectedRGBA(entry),
        })),
      );
    } catch (error) {
      state.error = error;
    }
  }
  updateView();
}
function status() {
  let text = t("initial"),
    kind = "";
  if (state.pending)
    text = m("ファイルを読み込んでいます…", "Reading the file…");
  else if (state.error && state.error.code !== "NO_CHANGES") {
    text = `${m("入力を確認してください", "Please check the input")} · ${state.error.code ?? "INPUT_ERROR"}\n${state.error.message}`;
    kind = "error";
  } else if (state.doc && !state.preset)
    text = m(
      "対象のプリセットを、明示的に選んでください。",
      "Explicitly choose the target preset.",
    );
  else if (state.preset && !state.selected.size)
    text = m(
      "編集するキーにチェックを付けてください。",
      "Check the keys you intend to edit.",
    );
  else if (state.error?.code === "NO_CHANGES")
    text = m(
      "色を変更すると、差分と書き出しが有効になります。",
      "Change a color to enable the review and export.",
    );
  else if (state.result) {
    text = m(
      "形式と要素数を保った差分です。書き出し前に値を確認してください。",
      "The edit keeps the original representation and arity. Review the values before exporting.",
    );
    kind = "ready";
  }
  $("status").textContent = text;
  $("status").className = "status " + kind;
}
function renderPresets() {
  const select = $("preset");
  select.replaceChildren(new Option(t("choosePreset"), ""));
  for (const p of state.doc?.presets ?? [])
    select.add(new Option(p.name, p.name));
  select.disabled = !state.doc || state.pending;
  select.value = state.preset;
  $("file-summary").textContent = state.name || t("notChosen");
  const total =
    state.doc?.presets.reduce((n, p) => n + p.parameters.length, 0) ?? 0;
  $("file-meta").textContent = state.doc
    ? `${state.doc.presets.length} ${m("プリセット", "presets")} · ${total} ${m("値", "values")} · ${state.bytes.length.toLocaleString()} bytes`
    : "";
  $("key-section").hidden = !state.preset;
}
function renderKeys() {
  const preset = currentPreset(),
    query = $("search").value.toLocaleLowerCase(),
    all = preset?.parameters ?? [];
  let matches = all.filter((p) => p.key.toLocaleLowerCase().includes(query));
  if (query)
    matches.sort(
      (a, b) =>
        Number(b.key.toLocaleLowerCase() === query) -
        Number(a.key.toLocaleLowerCase() === query),
    );
  const shown = matches.slice(0, 200);
  $("key-list").replaceChildren(
    ...shown.map((param) => {
      const label = node("label", undefined, "key-row"),
        box = node("input");
      box.type = "checkbox";
      box.dataset.key = param.key;
      box.dataset.editable = String(!!param.color);
      box.checked = state.selected.has(param.key);
      box.disabled =
        !param.color || (!box.checked && state.selected.size >= 32);
      const body = node("span");
      body.append(
        node("span", param.key, "key-name"),
        node("span", JSON.stringify(param.value), "key-value"),
        node(
          "span",
          param.color
            ? `${param.color.kind.toUpperCase()} · ${param.color.arity}`
            : m("保持する文字列", "unchanged string"),
          "key-kind",
        ),
      );
      label.append(box, body);
      if (param.color) {
        const swatch = node("i", undefined, "tiny-color");
        swatch.style.backgroundColor = rgbaCSS(param.color.rgba);
        label.append(swatch);
      }
      box.addEventListener("change", () => {
        if (box.checked && state.selected.size >= 32) {
          box.checked = false;
          return;
        }
        invalidate();
        if (box.checked)
          state.selected.set(param.key, {
            param,
            hex: rgbHex(param.color.rgba),
            drafts: param.color.rgba.map(String),
          });
        else state.selected.delete(param.key);
        syncKeys();
        renderEditors();
        compute();
      });
      return label;
    }),
  );
  $("key-note").textContent =
    matches.length > 200
      ? m(
          `先頭の200件を表示しています（全${matches.length}件）。キー名を絞り込んでください。`,
          `Showing the first 200 of ${matches.length}. Refine the key name.`,
        )
      : `${shown.length} ${m("件を表示", "shown")}`;
  syncKeys();
}
function syncKeys() {
  $("selected-count").textContent = `${state.selected.size} / 32`;
  for (const box of $("key-list").querySelectorAll("input")) {
    box.checked = state.selected.has(box.dataset.key);
    box.disabled =
      box.dataset.editable !== "true" ||
      (!box.checked && state.selected.size >= 32);
  }
}
function makePreview(labelText, rgba, cls) {
  const outer = node("div"),
    label = node("span", labelText, "preview-label"),
    checker = node("div", undefined, "checker"),
    fill = node("div", undefined, "swatch-fill " + cls);
  fill.style.backgroundColor = rgbaCSS(rgba);
  checker.append(fill);
  outer.append(label, checker);
  return outer;
}
function renderEditors() {
  cardId = 0;
  $("editors").replaceChildren(
    ...[...state.selected].map(([key, entry]) => {
      const card = node("article", undefined, "color-card");
      card.dataset.key = key;
      const heading = node("div", undefined, "card-heading"),
        left = node("div");
      left.append(
        node("h3", key),
        node(
          "span",
          `${entry.param.color.kind.toUpperCase()} · ${entry.param.color.arity} ${m("要素", "components")}`,
          "key-kind",
        ),
      );
      const remove = node("button", m("外す", "Remove"));
      remove.type = "button";
      remove.setAttribute(
        "aria-label",
        m(`${key} を選択から外す`, `Remove ${key} from selection`),
      );
      remove.addEventListener("click", () => {
        invalidate();
        state.selected.delete(key);
        syncKeys();
        renderEditors();
        compute();
        const box = [...$("key-list").querySelectorAll("input")].find(
          (b) => b.dataset.key === key,
        );
        (box ?? $("search")).focus();
      });
      heading.append(left, remove);
      card.append(heading);
      const previews = node("div", undefined, "preview-pair");
      previews.append(
        makePreview(t("before"), entry.param.color.rgba, "before-swatch"),
        makePreview(t("after"), entry.param.color.rgba, "after-swatch"),
      );
      card.append(previews);
      const controls = node("div", undefined, "controls"),
        pickerWrap = node("div", undefined, "picker-wrap"),
        picker = node("input");
      picker.type = "color";
      picker.value = entry.hex;
      picker.dataset.control = "picker";
      const pickerId = `picker-${cardId++}`;
      picker.id = pickerId;
      const pickerLabel = node("label", m("色を選ぶ", "Pick RGB"));
      pickerLabel.htmlFor = pickerId;
      picker.setAttribute(
        "aria-label",
        `${key} RGB ${m("カラーピッカー", "color picker")}`,
      );
      pickerWrap.append(pickerLabel, picker);
      controls.append(pickerWrap);
      if (entry.param.color.kind === "hex") {
        const fields = node("div", undefined, "hex-wrap"),
          hexLabel = node("label", "HEX"),
          hex = node("input");
        hex.type = "text";
        hex.value = entry.hex;
        hex.maxLength = 7;
        hex.spellcheck = false;
        hex.autocomplete = "off";
        hex.dataset.control = "hex";
        hex.setAttribute("aria-label", `${key} HEX`);
        hex.addEventListener("input", () => {
          invalidate();
          entry.hex = hex.value;
          compute();
        });
        hexLabel.append(hex);
        const alphaLabel = node("label", "A · 1"),
          alpha = node("input");
        alpha.type = "number";
        alpha.value = "1";
        alpha.disabled = true;
        alpha.setAttribute(
          "aria-label",
          `${key} ${m("アルファ固定", "alpha locked")}`,
        );
        alphaLabel.append(alpha);
        fields.append(hexLabel, alphaLabel);
        controls.append(fields);
      } else {
        const fields = node("div", undefined, "channel-fields");
        for (let i = 0; i < 4; i++) {
          const label = node(
              "label",
              ["R", "G", "B", "A"][i] +
                (i === 3 && entry.param.color.arity === 3 ? " · 1" : ""),
            ),
            input = node("input");
          input.type = "number";
          input.min = "0";
          input.max = "1";
          input.step = "any";
          input.inputMode = "decimal";
          input.value = entry.drafts[i];
          input.dataset.channel = String(i);
          input.setAttribute("aria-label", `${key} ${["R", "G", "B", "A"][i]}`);
          input.disabled = i === 3 && entry.param.color.arity === 3;
          input.addEventListener("input", () => {
            invalidate();
            entry.drafts[i] = input.value;
            compute();
          });
          label.append(input);
          fields.append(label);
        }
        controls.append(fields);
      }
      picker.addEventListener("input", () => {
        invalidate();
        entry.hex = picker.value;
        const rgba = [1, 3, 5].map(
          (i) => parseInt(picker.value.slice(i, i + 2), 16) / 255,
        );
        if (entry.param.color.kind !== "hex") {
          for (let i = 0; i < 3; i++) {
            entry.drafts[i] = String(rgba[i]);
            card.querySelector(`[data-channel="${i}"]`).value = entry.drafts[i];
          }
        } else card.querySelector('[data-control="hex"]').value = entry.hex;
        compute();
      });
      card.append(controls);
      const encoded = node("div", undefined, "encoded-pair");
      for (const [which, value] of [
        ["before", entry.param.value],
        ["after", entry.param.value],
      ]) {
        const line = node("div");
        line.append(
          node("span", t(which) + " · "),
          node("code", JSON.stringify(value), which + "-code"),
        );
        encoded.append(line);
      }
      card.append(
        encoded,
        node(
          "p",
          entry.param.color.arity === 3
            ? m(
                "不透明のまま保存。要素は追加しません。",
                "Stays opaque. No component is added.",
              )
            : m(
                "アルファも、4 番目の数値として保存します。",
                "Alpha stays the fourth numeric component.",
              ),
          "card-note",
        ),
      );
      return card;
    }),
  );
  $("empty-editor").hidden = state.selected.size > 0;
  updatePreviews();
}
function updatePreviews() {
  for (const card of $("editors").children) {
    const entry = state.selected.get(card.dataset.key);
    let rgba,
      valid = true;
    try {
      rgba = selectedRGBA(entry);
    } catch {
      rgba = entry.param.color.rgba;
      valid = false;
    }
    card.querySelector(".after-swatch").style.backgroundColor = rgbaCSS(rgba);
    card
      .querySelector(".after-swatch")
      .setAttribute("aria-label", `RGBA ${rgba.join(", ")}`);
    const edit = state.result?.receipt.edits.find(
      (e) => e.key === card.dataset.key,
    );
    const encodingBlocked = state.error && state.error.code !== "NO_CHANGES";
    card.querySelector(".after-code").textContent =
      valid && !encodingBlocked
        ? JSON.stringify(edit?.after ?? entry.param.value)
        : "—";
    for (const input of card.querySelectorAll("[data-channel]")) {
      const raw = entry.drafts[Number(input.dataset.channel)];
      input.setAttribute(
        "aria-invalid",
        String(
          raw.trim() === "" ||
            !Number.isFinite(Number(raw)) ||
            Number(raw) < 0 ||
            Number(raw) > 1,
        ),
      );
    }
    const hex = card.querySelector('[data-control="hex"]');
    if (hex)
      hex.setAttribute(
        "aria-invalid",
        String(!/^#[0-9a-f]{6}$/i.test(entry.hex)),
      );
    if (valid)
      card.querySelector('[data-control="picker"]').value = rgbHex(rgba);
  }
}
function updateView() {
  status();
  updatePreviews();
  $("review").hidden = !state.result;
  if (state.result) {
    $("review-context").textContent =
      `${state.name} · ${m("プリセット", "Preset")}: ${state.preset}`;
    const r = state.result.receipt,
      total = state.doc.presets.reduce((n, p) => n + p.parameters.length, 0);
    $("changed-count").textContent = r.changedKeys.length;
    $("preserved-count").textContent = total - r.changedKeys.length;
    $("other-count").textContent = state.doc.presets.length - 1;
    $("review-rows").replaceChildren(
      ...r.edits.map((edit) => {
        const row = node("tr");
        for (const value of [
          edit.key,
          JSON.stringify(edit.before),
          JSON.stringify(edit.after),
          edit.quantizationRGBA.map((v) => Number(v.toPrecision(8))).join(", "),
        ])
          row.append(node("td", value));
        return row;
      }),
    );
  }
  $("export").disabled = !state.result || busy;
  $("receipt").disabled = !lastReceipt || busy;
}
function renderAll() {
  for (const n of document.querySelectorAll("[data-i18n]"))
    n.textContent = t(n.dataset.i18n);
  document.documentElement.lang = lang;
  $("lang-ja").setAttribute("aria-pressed", String(lang === "ja"));
  $("lang-en").setAttribute("aria-pressed", String(lang === "en"));
  renderPresets();
  renderKeys();
  renderEditors();
  updateView();
  if (lastReceipt && !busy) exportStatus();
}
async function importFile(file) {
  if (!file) return;
  invalidate();
  const token = revision;
  state = fresh();
  state.name = file.name;
  state.pending = true;
  $("search").value = "";
  renderAll();
  try {
    if (file.size > LIMITS.bytes)
      throw new PresetError("INPUT_LIMIT", "Use JSON up to 4 MiB");
    if (!/\.json$/i.test(file.name))
      throw new PresetError(
        "FILE_TYPE",
        "Choose an existing .json preset file",
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (token !== revision) return;
    state.doc = inspectPresets(bytes);
    state.bytes = bytes;
  } catch (error) {
    if (token !== revision) return;
    state.error = error;
  }
  if (token !== revision) return;
  state.pending = false;
  renderAll();
}
function download(data, type, name) {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = node("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const sha = async (bytes) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
function exportStatus() {
  $("export-status").textContent =
    `${m("コピーを保存しました", "Copy downloaded")} · ${lastReceipt.output.bytes.toLocaleString()} bytes · SHA-256 ${lastReceipt.output.sha256}`;
}
$("file-input").addEventListener("change", (e) =>
  importFile(e.currentTarget.files?.[0]),
);
$("preset").addEventListener("change", () => {
  invalidate();
  state.preset = $("preset").value;
  state.selected.clear();
  state.error = null;
  $("search").value = "";
  renderAll();
});
$("search").addEventListener("input", renderKeys);
$("sample").addEventListener("click", () => {
  invalidate();
  state = fresh();
  state.bytes = new TextEncoder().encode(SAMPLE_JSON);
  state.doc = inspectPresets(state.bytes);
  state.name = "sample-presets.json";
  $("file-input").value = "";
  $("search").value = "";
  renderAll();
});
$("reset").addEventListener("click", () => {
  invalidate();
  state = fresh();
  $("file-input").value = "";
  $("search").value = "";
  renderAll();
  $("status").textContent = m(
    "入力と編集をクリアしました。",
    "Input and edits cleared.",
  );
});
for (const value of ["ja", "en"])
  $("lang-" + value).addEventListener("click", () => {
    lang = value;
    renderAll();
  });
$("export").addEventListener("click", async () => {
  if (!state.result || busy) return;
  busy = true;
  const token = revision,
    result = state.result,
    bytes = state.bytes,
    name = state.name;
  $("export").disabled = true;
  $("receipt").disabled = true;
  $("export-status").textContent = m(
    "ハッシュを計算しています…",
    "Calculating hashes…",
  );
  try {
    const [inputHash, outputHash] = await Promise.all([
      sha(bytes),
      sha(result.output),
    ]);
    if (token !== revision || state.result !== result) return;
    const outputName = name.replace(/\.json$/i, "") + ".tinted.json";
    lastReceipt = {
      ...result.receipt,
      input: { name, bytes: bytes.length, sha256: inputHash },
      output: {
        name: outputName,
        bytes: result.output.length,
        sha256: outputHash,
      },
      scope:
        "Existing preset JSON only. No user SCAD loaded/executed. Model enums/ranges/default type compatibility not validated.",
    };
    download(result.output, "application/json", outputName);
    exportStatus();
  } catch (error) {
    if (token === revision) {
      lastReceipt = null;
      $("export-status").textContent = error.message;
    }
  } finally {
    if (token === revision) {
      busy = false;
      updateView();
    }
  }
});
$("receipt").addEventListener("click", () => {
  if (lastReceipt && !busy)
    download(
      JSON.stringify(lastReceipt, null, 2) + "\n",
      "application/json",
      lastReceipt.output.name.replace(/\.json$/, ".receipt.json"),
    );
});
$("print").addEventListener("click", () => window.print());
$("offline").addEventListener("click", () =>
  download(initialHTML, "text/html", "preset-tint.html"),
);
renderAll();
