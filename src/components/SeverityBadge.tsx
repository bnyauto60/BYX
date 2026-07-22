import { severityLabel, severityColor } from "@/lib/ref/severity";

const COLOR_CLASSES: Record<string, string> = {
  muted: "bg-panelAlt text-muted border-line",
  safe: "bg-safe/10 text-safe border-safe/40",
  warn: "bg-warn/10 text-warn border-warn/40",
  danger: "bg-danger/10 text-danger border-danger/40"
};

export function SeverityBadge({ severity }: { severity: number }) {
  const color = severityColor(severity);
  return (
    <span className={`text-xs px-2 py-1 rounded-sm border ${COLOR_CLASSES[color]}`}>
      {severityLabel(severity)}
    </span>
  );
}
