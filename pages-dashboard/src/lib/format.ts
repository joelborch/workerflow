import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export function pct(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return "0.0";
  }
  return ((numerator / denominator) * 100).toFixed(1);
}

export function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function fmtTs(iso: string | null) {
  if (!iso) {
    return "-";
  }
  const d = dayjs(iso);
  if (!d.isValid()) {
    return "-";
  }
  return `${d.format("MMM D, HH:mm")} (${d.fromNow()})`;
}

export function clampText(value: string, max = 120) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}
