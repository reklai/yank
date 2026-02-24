declare module "*.css" {
  const content: string;
  export default content;
}

type SiteRuleMode = "blacklist" | "whitelist";
type JsonToolingModeSelection = "off" | "mode1" | "mode2" | "mode3";

interface JsonToolingPickerShortcutSettings {
  off: string;
  mode1: string;
  mode2: string;
  mode3: string;
}

interface UrlCopySettings {
  showToast: boolean;
  toastDismissMs: number;
}

interface AutoCopySettings {
  enabled: boolean;
  plainTextMode: boolean;
  appendMode: boolean;
  sourceTagMode: boolean;
  siteRuleMode: SiteRuleMode;
  siteRules: string[];
  appendSeparator: string;
  showSelectionCountBadge: boolean;
}

interface JsonToolingSettings {
  prettyPrintEnabled: boolean;
  tableFromArrayEnabled: boolean;
  decorateJsonBlocks: boolean;
  rootPathPrefix: string;
  pickerShortcuts: JsonToolingPickerShortcutSettings;
}

interface ShortcutSettings {
  switchToAutoCopy: string;
  switchToJsonTooling: string;
  copyPageUrl: string;
  copyCleanCodeBlock: string;
  copyAsFetch: string;
  copyAsCurl: string;
}

interface YankSettings {
  urlCopy: UrlCopySettings;
  autoCopy: AutoCopySettings;
  jsonTooling: JsonToolingSettings;
  shortcuts: ShortcutSettings;
}

interface BackgroundToast {
  message: string;
  kind?: "success" | "warning" | "error";
}

interface Window {
  __yankCleanup?: () => void;
}
