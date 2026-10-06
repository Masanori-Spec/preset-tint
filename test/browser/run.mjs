import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const art = resolve("artifacts/browser");
await mkdir(art, { recursive: true });
await mkdir("artifacts/native", { recursive: true });
const input = await readFile("test/fixtures/original.json"),
  original = JSON.parse(input),
  expectedText = input
    .toString()
    .replace('"#000000"', '"#ff0000"')
    .replace('"[0.25, 0.5, 0.75]"', '"[0, 1, 0]"')
    .replace('"[0.5, 0.25, 0.75, 0.25]"', '"[0, 0, 1, 0.5]"');
const report = {
    status: "RUNNING",
    cases: [],
    pageErrors: [],
    networkRequests: [],
    screenshots: [],
  },
  check = (name, details = {}) => {
    report.cases.push({ name, passed: true, ...details });
    console.log("PASS", name);
  },
  sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const executablePath = process.env.CHROMIUM_PATH;
if (!executablePath) throw Error("Use hosted sandboxed Chrome");
const browser = await chromium.launch({
  executablePath,
  headless: true,
  chromiumSandbox: true,
});
report.browserVersion = browser.version();
report.chromiumSandboxRequested = true;
const commands = execFileSync("ps", ["-eo", "args"], { encoding: "utf8" })
  .split("\n")
  .filter(
    (line) =>
      line.includes("--remote-debugging-pipe") &&
      line.includes("--user-data-dir=") &&
      /chrome|chromium/.test(line),
  );
if (
  !commands.length ||
  commands.some(
    (line) =>
      line.includes("--no-sandbox") ||
      line.includes("--disable-setuid-sandbox"),
  )
)
  throw Error("Sandboxed Chrome was not established");
report.chromiumMainProcessCommands = commands;
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  acceptDownloads: true,
});
await context.setOffline(true);
const page = await context.newPage();
page.on("pageerror", (e) => report.pageErrors.push(e.message));
page.on("request", (r) => {
  if (/^https?:/.test(r.url())) report.networkRequests.push(r.url());
});
let downloads = 0;
page.on("download", () => downloads++);
const url = pathToFileURL(resolve("dist/preset-tint.html")).href,
  key = (k) => page.locator(`#key-list input[data-key="${k}"]`),
  card = (k) => page.locator(`#editors .color-card[data-key="${k}"]`);
async function shot(name) {
  await page.screenshot({ path: resolve(art, name), fullPage: true });
  report.screenshots.push(name);
}
async function load(bytes = input, name = "private-palette.json") {
  await page
    .locator("#file-input")
    .setInputFiles({ name, mimeType: "application/json", buffer: bytes });
  await expect(page.locator("#status")).not.toContainText(/Reading|読み込んで/);
}
async function choose() {
  await expect(page.locator("#preset")).toBeEnabled();
  await page.locator("#preset").selectOption("Palette");
  for (const k of ["paint_hex", "paint_rgb", "paint_rgba"])
    await key(k).check();
}
async function colors() {
  await card("paint_hex").locator("[data-control=hex]").fill("#ff0000");
  for (const [k, rgba] of [
    ["paint_rgb", [0, 1, 0]],
    ["paint_rgba", [0, 0, 1, 0.5]],
  ])
    for (let i = 0; i < rgba.length; i++)
      await card(k).locator(`[data-channel="${i}"]`).fill(String(rgba[i]));
  await expect(page.locator("#changed-count")).toHaveText("3");
  await expect(page.locator("#export")).toBeEnabled();
}
async function save(id, name, keyboard = false) {
  const wait = page.waitForEvent("download");
  if (keyboard) {
    await page.locator(id).focus();
    await page.keyboard.press("Enter");
  } else await page.locator(id).click();
  const d = await wait;
  await d.saveAs(resolve(art, name));
  return readFile(resolve(art, name));
}
try {
  await page.goto(url);
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.locator("#export")).toBeDisabled();
  await shot("01-ja-empty-desktop.png");
  check("Offline Japanese start has no automatic selection or export");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#workspace")).toBeFocused();
  const chooserWait = page.waitForEvent("filechooser");
  await page.locator("#file-input").focus();
  await page.keyboard.press("Enter");
  const chooser = await chooserWait;
  await chooser.setFiles({
    name: "private-palette.json",
    mimeType: "application/json",
    buffer: input,
  });
  await expect(page.locator("#preset")).toBeEnabled();
  await expect(page.locator("#preset")).toHaveValue("");
  await expect(page.locator("#export")).toBeDisabled();
  check(
    "Keyboard skip link and real file chooser preserve explicit preset selection",
  );
  await page.locator("#preset").selectOption("Palette");
  await expect(page.locator("#editors .color-card")).toHaveCount(0);
  await key("paint_hex").focus();
  await page.keyboard.press("Space");
  await expect(key("paint_hex")).toBeFocused();
  await key("paint_rgb").check();
  await key("paint_rgba").check();
  await expect(key("position")).toBeDisabled();
  await expect(key("width")).toBeDisabled();
  await expect(page.locator("#export")).toBeDisabled();
  check(
    "Explicit key selection keeps keyboard focus and leaves geometry strings untouched",
  );
  await colors();
  await expect(card("paint_rgb").locator('[data-channel="3"]')).toBeDisabled();
  await expect(card("paint_hex").locator("input[type=number]")).toBeDisabled();
  expect(
    await card("paint_rgba")
      .locator(".after-swatch")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgba(0, 0, 255, 0.5)");
  await shot("02-ja-edited-desktop.png");
  check(
    "Hex/RGB/RGBA controls preserve arity and display the exact half-alpha preview",
  );
  const edited = await save("#export", "browser-edited.json", true),
    receipt = JSON.parse(
      (await save("#receipt", "browser-receipt.json")).toString(),
    );
  expect(edited.toString()).toBe(expectedText);
  expect(receipt.input.sha256).toBe(sha(input));
  expect(receipt.output.sha256).toBe(sha(edited));
  expect(receipt.output.bytes).toBe(edited.length);
  expect(receipt.preset).toBe("Palette");
  expect(receipt.changedKeys).toEqual(["paint_hex", "paint_rgb", "paint_rgba"]);
  expect(receipt.edits.map((e) => [e.key, e.after, e.arity])).toEqual([
    ["paint_hex", "#ff0000", 3],
    ["paint_rgb", "[0, 1, 0]", 3],
    ["paint_rgba", "[0, 0, 1, 0.5]", 4],
  ]);
  const parsed = JSON.parse(edited);
  expect(parsed.parameterSets.Other).toEqual(original.parameterSets.Other);
  expect(parsed.parameterSets.Palette.width).toBe("7");
  expect(parsed.parameterSets.Palette.position).toBe("[13, 0, 0]");
  for (const p of Object.values(parsed.parameterSets))
    for (const value of Object.values(p)) expect(typeof value).toBe("string");
  await copyFile(
    resolve(art, "browser-edited.json"),
    "artifacts/native/edited.json",
  );
  await copyFile(
    resolve(art, "browser-receipt.json"),
    "artifacts/native/receipt.json",
  );
  report.nativeInput = {
    source: "actual sandboxed offline browser download",
    bytes: edited.length,
    sha256: sha(edited),
  };
  check(
    "Actual keyboard download matches handwritten byte patch, string types, other preset and receipt hashes",
    report.nativeInput,
  );
  await page.locator("#lang-en").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#changed-count")).toHaveText("3");
  await expect(page.locator("#receipt")).toBeEnabled();
  await expect(card("paint_rgba").locator('[data-channel="3"]')).toHaveValue(
    "0.5",
  );
  await shot("03-en-edited-desktop.png");
  check(
    "Language switch preserves numeric edits, selection and completed receipt",
  );
  for (const language of ["ja", "en"]) {
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.locator(`#lang-${language}`).click();
    await page.pdf({
      path: resolve(art, `review-${language}.pdf`),
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    const printed = execFileSync(
      "pdftotext",
      [resolve(art, `review-${language}.pdf`), "-"],
      { encoding: "utf8" },
    );
    for (const value of [
      "Palette",
      "paint_hex",
      "paint_rgb",
      "paint_rgba",
      "#ff0000",
      "[0, 1, 0]",
      "[0, 0, 1, 0.5]",
    ])
      expect(printed).toContain(value);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const bounds = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1);
      await page.locator(".table-scroll").evaluate((el) => (el.scrollLeft = 0));
      await shot(`04-${language}-mobile-${width}.png`);
      const scroll = await page.locator(".table-scroll").evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
        const a = el.getBoundingClientRect(),
          b = el.querySelector("th:last-child").getBoundingClientRect();
        return {
          left: a.left,
          right: a.right,
          cellLeft: b.left,
          cellRight: b.right,
          position: el.scrollLeft,
        };
      });
      expect(scroll.cellRight).toBeLessThanOrEqual(scroll.right + 1);
      expect(scroll.cellLeft).toBeGreaterThanOrEqual(scroll.left - 1);
      await shot(`04-${language}-mobile-${width}-quantization.png`);
      check(
        `Exact numeric review remains horizontally reachable: ${language} ${width}px`,
        scroll,
      );
    }
  }
  check(
    "JA/EN printed reviews contain preset identity and every edited encoded value",
  );
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.locator("#lang-en").click();
  const summary = await page.locator("#file-summary").textContent();
  await page.locator("#file-input").evaluate((el) => {
    el.value = "";
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#file-summary")).toHaveText(summary);
  await expect(page.locator("#export")).toBeEnabled();
  check("Dispatched empty file change preserves a valid review");
  await page.locator("#search").fill("paint_rgb");
  await expect(page.locator("#key-list input")).toHaveCount(2);
  expect(
    await page
      .locator("#key-list input")
      .evaluateAll((inputs) => inputs.map((input) => input.dataset.key)),
  ).toEqual(["paint_rgb", "paint_rgba"]);
  await expect(page.locator("#editors .color-card")).toHaveCount(3);
  await expect(page.locator("#receipt")).toBeEnabled();
  await page.locator("#search").fill("");
  check(
    "Key filtering does not change hidden selections or invalidate a valid receipt",
  );
  await page.locator("#preset").selectOption("Other");
  await expect(page.locator("#editors .color-card")).toHaveCount(0);
  await expect(page.locator("#receipt")).toBeDisabled();
  await expect(page.locator("#export")).toBeDisabled();
  await key("paint_hex").check();
  await expect(card("paint_hex").locator("[data-control=hex]")).toHaveValue(
    "#ffffff",
  );
  check(
    "Switching preset clears pending edits and restores that preset’s own values",
  );
  for (const [label, buffer, code] of [
    [
      "version",
      Buffer.from(
        input
          .toString()
          .replace('"fileFormatVersion": "1"', '"fileFormatVersion": 1'),
      ),
      "FORMAT_VERSION",
    ],
    [
      "array",
      Buffer.from(
        input.toString().replace('"[0.25, 0.5, 0.75]"', "[0.25, 0.5, 0.75]"),
      ),
      "ENCODED_STRING",
    ],
    [
      "NFC",
      Buffer.from(
        '{"fileFormatVersion":"1","parameterSets":{"P":{"é":"#000000","e\\u0301":"#ffffff"}}}',
      ),
      "PARAMETER_COLLISION",
    ],
    [
      "duplicate",
      Buffer.from(
        '{"fileFormatVersion":"1","fileFormatVersion":"1","parameterSets":{}}',
      ),
      "DUPLICATE_KEY",
    ],
    ["malformed", Buffer.from("{bad json}"), "INVALID_JSON"],
  ]) {
    await load(buffer);
    await expect(page.locator("#status")).toContainText(code);
    await expect(page.locator("#export")).toBeDisabled();
    await expect(page.locator("#receipt")).toBeDisabled();
    check(`${label} input fails closed without stale export`);
  }
  await shot("05-en-blocked.png");
  await load(input, "model.scad");
  await expect(page.locator("#status")).toContainText("FILE_TYPE");
  check("SCAD is not an accepted input");
  await load(Buffer.alloc(4 * 1024 * 1024 + 1, 32));
  await expect(page.locator("#status")).toContainText("INPUT_LIMIT");
  check("Oversized JSON blocked before parsing");
  await load();
  await choose();
  await colors();
  await card("paint_rgb").locator('[data-channel="0"]').fill("1.1");
  await expect(page.locator("#status")).toContainText("CHANNELS");
  await expect(page.locator("#export")).toBeDisabled();
  await expect(card("paint_hex").locator(".after-code")).toHaveText("—");
  expect(
    await card("paint_hex")
      .locator(".after-swatch")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(255, 0, 0)");
  check(
    "One invalid selected key blocks encoded After values without showing an old value under a new swatch",
  );
  await card("paint_rgb").locator('[data-channel="0"]').fill("0");
  await expect(card("paint_hex").locator(".after-code")).toHaveText(
    '"#ff0000"',
  );
  await card("paint_hex").locator("[data-control=hex]").fill("#ff0");
  await expect(page.locator("#status")).toContainText("HEX_COLOR");
  await expect(page.locator("#export")).toBeDisabled();
  await card("paint_hex").locator("[data-control=picker]").fill("#ff0000");
  await expect(page.locator("#export")).toBeEnabled();
  check(
    "Invalid channels/hex block export; native color input restores a valid edit",
  );
  const strange = JSON.stringify({
    fileFormatVersion: "1",
    parameterSets: { Palette: { "<img src=x onerror=alert(1)>": "#000000" } },
  });
  await load(Buffer.from(strange));
  await page.locator("#preset").selectOption("Palette");
  await expect(page.locator("#key-list")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  expect(await page.locator("#key-list img").count()).toBe(0);
  check("Imported key names render as inert text");
  const many = {
    fileFormatVersion: "1",
    parameterSets: {
      Palette: Object.fromEntries(
        Array.from({ length: 35 }, (_, i) => [`color_${i}`, "#000000"]),
      ),
    },
  };
  await load(Buffer.from(JSON.stringify(many)));
  await page.locator("#preset").selectOption("Palette");
  for (let i = 0; i < 32; i++) await key("color_" + i).check();
  await expect(key("color_32")).toBeDisabled();
  await key("color_0").uncheck();
  await expect(key("color_32")).toBeEnabled();
  check(
    "UI selection is bounded to 32 keys without changing unselected values",
  );
  const noncanonical = Buffer.from(
    input.toString().replace('"[0.25, 0.5, 0.75]"', '"[2.5e-1,0.5,0.75]"'),
  );
  await load(noncanonical);
  await page.locator("#preset").selectOption("Palette");
  await key("paint_hex").check();
  await key("paint_rgb").check();
  await expect(page.locator("#export")).toBeDisabled();
  await card("paint_hex").locator("[data-control=hex]").fill("#ff0000");
  const mixed = await save("#export", "mixed-noop.json");
  expect(mixed.toString()).toBe(
    noncanonical.toString().replace('"#000000"', '"#ff0000"'),
  );
  check(
    "Selected but unchanged color retains its exact original encoded token",
  );
  await page.evaluate(() => {
    window.__read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      await new Promise((resolve) => setTimeout(resolve, 700));
      return window.__read.call(this);
    };
  });
  await page.locator("#file-input").setInputFiles({
    name: "late-private.json",
    mimeType: "application/json",
    buffer: input,
  });
  await expect(page.locator("#status")).toContainText("Reading");
  await page.locator("#sample").click();
  await page.waitForTimeout(950);
  await expect(page.locator("#file-summary")).toHaveText("sample-presets.json");
  await expect(page.locator("#preset")).toHaveValue("");
  check("Late file read cannot overwrite a newer sample");
  await page.locator("#file-input").setInputFiles({
    name: "late-private.json",
    mimeType: "application/json",
    buffer: input,
  });
  await page.locator("#reset").click();
  await page.waitForTimeout(950);
  await expect(page.locator("#file-summary")).toHaveText("No file selected");
  await expect(page.locator("#export")).toBeDisabled();
  check("Clear invalidates pending file reads");
  await page.evaluate(() => (File.prototype.arrayBuffer = window.__read));
  await load();
  await choose();
  await colors();
  await page.evaluate(() => {
    window.__digest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = async (...args) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      return window.__digest(...args);
    };
  });
  const before = downloads;
  await page.locator("#export").click();
  await page.locator("#preset").selectOption("Other");
  await page.waitForTimeout(950);
  expect(downloads).toBe(before);
  await expect(page.locator("#receipt")).toBeDisabled();
  check("Changing preset cancels pending hash/export without a stale download");
  await page.evaluate(() => (crypto.subtle.digest = window.__digest));
  await load();
  await choose();
  await colors();
  const a = await save("#export", "repeated-1.json"),
    b = await save("#export", "repeated-2.json");
  expect(a).toEqual(b);
  expect(a).toEqual(edited);
  check("Repeated exports are byte deterministic");
  const offline = await save("#offline", "saved-offline.html");
  expect(offline.toString()).not.toContain("private-palette.json");
  const fresh = await context.newPage();
  fresh.on("pageerror", (e) => report.pageErrors.push(e.message));
  fresh.on("request", (r) => {
    if (/^https?:/.test(r.url())) report.networkRequests.push(r.url());
  });
  await fresh.goto(pathToFileURL(resolve(art, "saved-offline.html")).href);
  await expect(fresh.locator("#file-summary")).toHaveText("未選択");
  await expect(fresh.locator("#export")).toBeDisabled();
  await fresh.locator("#sample").click();
  await expect(fresh.locator("#preset")).toHaveValue("");
  await fresh.close();
  check(
    "Saved offline HTML starts clean without prior imported data or automatic selection",
  );
  expect(report.pageErrors).toEqual([]);
  expect(report.networkRequests).toEqual([]);
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.reason = error.message;
  report.stack = error.stack;
  try {
    report.layoutOverflows = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .map((el) => ({
          tag: el.tagName,
          id: el.id,
          cls: el.className,
          left: el.getBoundingClientRect().left,
          right: el.getBoundingClientRect().right,
        }))
        .filter((r) => r.right > innerWidth + 1 || r.left < -1),
    );
    await shot("99-failure.png");
  } catch {}
  throw error;
} finally {
  await writeFile(
    resolve(art, "browser-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await context.close();
  await browser.close();
}
console.log(
  "PASS actual browser JSON is ready for the same official CLI oracle",
);
