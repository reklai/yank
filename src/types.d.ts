declare module "*.css" {
  const content: string;
  export default content;
}

type SiteRuleMode = "blacklist" | "whitelist";
type JsonToolingModeSelection = "off" | "mode1" | "mode2" | "mode3";

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
}

interface ShortcutSettings {
  switchToAutoCopy: string;
  jsonToolingPrettyPrint: string;
  jsonToolingPathCopy: string;
  jsonToolingMarkdownTable: string;
  copyPageUrl: string;
  copyCleanCodeBlock: string;
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
