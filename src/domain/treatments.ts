/**
 * 记录层：治疗台账的登记、退赛窗口计算与更正留痕。
 * 只做事实记录的存取与派生，不做参赛判断。
 */
import { makeId } from "../utils/ids";
import type { DrugClass, TreatmentCorrection, TreatmentRecord } from "./types";

const HOUR_MS = 3_600_000;

/** 单条记录的退赛到期时间 = 末次用药时间 + 退赛期 */
export function recordDeadline(record: TreatmentRecord): number {
  return new Date(record.lastDoseAt).getTime() + record.withdrawalHours * HOUR_MS;
}

/** 某匹马、某类药的有效退赛窗口 */
export interface WithdrawalWindow {
  horseId: string;
  drugClass: DrugClass;
  recordCount: number; // 该类药用药次数
  deadline: number; // 有效退赛截止（毫秒时间戳）
  sourceRecordId: string; // 决定该截止时间的记录
}

/**
 * 同类药再用按更晚时间延长：
 * 同一匹马、同一药物类别下，有效退赛截止取各条记录到期时间的最晚值。
 */
export function effectiveWithdrawals(
  records: TreatmentRecord[],
  horseId: string
): WithdrawalWindow[] {
  const windows = new Map<DrugClass, WithdrawalWindow>();
  for (const record of records) {
    if (record.horseId !== horseId) continue;
    const deadline = recordDeadline(record);
    const existing = windows.get(record.drugClass);
    if (!existing) {
      windows.set(record.drugClass, {
        horseId,
        drugClass: record.drugClass,
        recordCount: 1,
        deadline,
        sourceRecordId: record.id,
      });
    } else {
      existing.recordCount += 1;
      if (deadline > existing.deadline) {
        existing.deadline = deadline;
        existing.sourceRecordId = record.id;
      }
    }
  }
  return [...windows.values()].sort((a, b) => b.deadline - a.deadline);
}

/** 可更正的字段及中文名 */
export const TREATMENT_FIELD_LABELS = {
  hoof: "蹄位",
  drugName: "药名",
  drugClass: "药物类别",
  lastDoseAt: "末次用药时间",
  withdrawalHours: "退赛期(小时)",
} as const;

export type TreatmentPatch = Partial<
  Pick<TreatmentRecord, keyof typeof TREATMENT_FIELD_LABELS>
>;

/**
 * 更正治疗记录：返回更新后的记录与更正留痕。
 * 更正不改写历史，changes 里逐项保留旧值与新值。
 */
export function correctTreatment(
  record: TreatmentRecord,
  patch: TreatmentPatch,
  note: string,
  now: Date
): { record: TreatmentRecord; correction: TreatmentCorrection } {
  const next: TreatmentRecord = { ...record, ...patch, updatedAt: now.toISOString() };
  const changes: TreatmentCorrection["changes"] = [];
  const fields = Object.keys(TREATMENT_FIELD_LABELS) as Array<
    keyof typeof TREATMENT_FIELD_LABELS
  >;
  for (const field of fields) {
    if (patch[field] === undefined) continue;
    const from = String(record[field]);
    const to = String(next[field]);
    if (from !== to) {
      changes.push({ field: TREATMENT_FIELD_LABELS[field], from, to });
    }
  }
  return {
    record: next,
    correction: {
      id: makeId("TC"),
      recordId: record.id,
      horseId: record.horseId,
      correctedAt: now.toISOString(),
      changes,
      note,
    },
  };
}
