let counter = 0;

/** 前端台账本地编号 */
export function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
