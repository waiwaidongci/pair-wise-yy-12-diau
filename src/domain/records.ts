import type { Clearance, DrugClass, GaitAssessment, GaitResult, HoofPosition, TreatmentRecord } from "./types";

let counter = 0;
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${String(counter).padStart(4, "0")}`;
}

export interface TreatmentInput {
  horseId: string;
  hoof: HoofPosition;
  diagnosis: string;
  drugName: string;
  drugClass: DrugClass;
  lastDoseAt: string;
  withdrawalHours: number;
}

export interface GaitInput {
  horseId: string;
  assessedAt: string;
  result: GaitResult;
  note: string;
}

export function createTreatment(input: TreatmentInput, now: Date): TreatmentRecord {
  return { id: nextId("T"), status: "active", recordedAt: now.toISOString(), ...input };
}

/**
 * 更正治疗记录：旧记录不删不改内容，只标记 corrected 并指向新记录；
 * 新记录携带 supersedesId 形成更正链。
 */
export function correctTreatment(
  records: TreatmentRecord[],
  id: string,
  patch: TreatmentInput,
  now: Date
): TreatmentRecord[] {
  const fresh: TreatmentRecord = { ...createTreatment(patch, now), supersedesId: id };
  return [
    ...records.map((r) =>
      r.id === id ? { ...r, status: "corrected" as const, correctedById: fresh.id } : r
    ),
    fresh,
  ];
}

export function createGaitAssessment(input: GaitInput): GaitAssessment {
  return { id: nextId("G"), ...input };
}

/** 作废旧放行：结论内容原样保留，只补作废时间与原因 */
export function voidClearancesForHorse(
  clearances: Clearance[],
  horseId: string,
  now: Date,
  reason: string
): Clearance[] {
  return clearances.map((c) =>
    c.horseId === horseId && !c.voidedAt
      ? { ...c, voidedAt: now.toISOString(), voidReason: reason }
      : c
  );
}

export function activeTreatmentsOf(records: TreatmentRecord[], horseId: string): TreatmentRecord[] {
  return records.filter((r) => r.horseId === horseId && r.status === "active");
}
