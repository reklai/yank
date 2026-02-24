import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function readJson(pathFromRoot) {
  return JSON.parse(readFileSync(resolve(root, pathFromRoot), "utf8"));
}

test("manifests are aligned for cross-browser build", () => {
  const v2 = readJson("esBuildConfig/manifest_v2.json");
  const v3 = readJson("esBuildConfig/manifest_v3.json");

  assert.equal(v2.name, v3.name);
  assert.equal(v2.version, v3.version);
  assert.equal(v2.options_ui.page, "optionsPage/optionsPage.html");
  assert.equal(v3.options_ui.page, "optionsPage/optionsPage.html");
  assert.equal(v2.browser_action.default_popup, "toolbarPopup/toolbarPopup.html");
  assert.equal(v3.action.default_popup, "toolbarPopup/toolbarPopup.html");
});
