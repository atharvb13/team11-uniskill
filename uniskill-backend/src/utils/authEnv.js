/**
 * Opt-in only. Default is false so sign-in requires a confirmed email
 * (dashboard “Confirm”, confirmation link, etc.).
 */
export function isAutoConfirmEmailEnabled() {
  const raw = (process.env.AUTO_CONFIRM_EMAIL ?? "false").trim().toLowerCase();
  return ["true", "1", "yes", "on"].includes(raw);
}
