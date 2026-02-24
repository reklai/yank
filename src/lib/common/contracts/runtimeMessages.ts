export type RuntimeMessage =
  | { type: "GET_SETTINGS" }
  | { type: "PATCH_SETTINGS"; patch: Partial<YankSettings> }
  | { type: "CONTENT_READY" };

export type RuntimeResponse =
  | { ok: true; settings: YankSettings }
  | { ok: true }
  | { ok: false; reason: string };

export type ContentRuntimeMessage =
  | { type: "SHOW_TOAST"; toast: BackgroundToast }
  | { type: "RUN_COPY_PAGE_URL" };
