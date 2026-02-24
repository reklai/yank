import browser from "webextension-polyfill";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
} from "../../common/contracts/settings";

const STORAGE_SETTINGS_KEY = "yank_settings";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class YankDomain {
  private settings: YankSettings = clone(DEFAULT_SETTINGS);

  async init(): Promise<void> {
    const stored = await browser.storage.local.get([STORAGE_SETTINGS_KEY]);
    this.settings = mergeSettings(stored[STORAGE_SETTINGS_KEY] as Partial<YankSettings> | undefined);
  }

  private async persistSettings(): Promise<void> {
    await browser.storage.local.set({ [STORAGE_SETTINGS_KEY]: this.settings });
  }

  getSettings(): YankSettings {
    return clone(this.settings);
  }

  async patchSettings(patch: Partial<YankSettings>): Promise<void> {
    this.settings = mergeSettings({
      ...this.settings,
      ...patch,
      urlCopy: { ...this.settings.urlCopy, ...(patch.urlCopy || {}) },
      autoCopy: { ...this.settings.autoCopy, ...(patch.autoCopy || {}) },
      jsonTooling: { ...this.settings.jsonTooling, ...(patch.jsonTooling || {}) },
      shortcuts: { ...this.settings.shortcuts, ...(patch.shortcuts || {}) },
    });
    await this.persistSettings();
  }
}
