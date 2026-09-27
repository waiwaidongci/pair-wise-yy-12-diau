const pad2 = (n: number) => String(n).padStart(2, "0");

/** 统一展示格式：YYYY-MM-DD HH:mm（本地时间） */
export function formatDateTime(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** datetime-local 输入框需要的本地时间初值 */
export function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
