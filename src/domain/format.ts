const pad = (n: number) => String(n).padStart(2, "0");

export function fmtDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local 输入框需要的本地时间串 */
export function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function remainingText(deadline: Date, now: Date): string {
  const diffMs = deadline.getTime() - now.getTime();
  const hours = Math.floor(Math.abs(diffMs) / 3_600_000);
  const days = Math.floor(hours / 24);
  const span = days > 0 ? `${days} 天 ${hours % 24} 小时` : `${hours} 小时`;
  return diffMs > 0 ? `剩余 ${span}` : `已过 ${span}`;
}
