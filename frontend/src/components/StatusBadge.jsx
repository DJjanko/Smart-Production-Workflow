export function StatusBadge({ value }) {
  return <span className={`status ${value}`}>{value}</span>;
}
