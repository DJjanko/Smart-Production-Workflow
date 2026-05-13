import { statusLabel } from "../utils/i18n.js";

export function StatusBadge({ value }) {
  return <span className={`status ${value}`}>{statusLabel(value)}</span>;
}
