import { fmtDateTime } from "./format";
import { activeTreatmentsOf, nextId } from "./records";
import type {
  Clearance,
  ClearanceStatus,
  DrugClass,
  GaitAssessment,
  GaitSnapshot,
  TreatmentRecord,
} from "./types";

export interface ClassDeadline {
  drugClass: DrugClass;
  deadline: Date;
  basedOn: TreatmentRecord;
}

/**
 * 退赛期限：按药物类别分组，同类药再用按更晚时间延长，
 * 即每类取 max(末次用药时间 + 退赛期)。
 */
export function withdrawalDeadlines(records: TreatmentRecord[], horseId: string): ClassDeadline[] {
  const byClass = new Map<DrugClass, ClassDeadline>();
  for (const rec of activeTreatmentsOf(records, horseId)) {
    const deadline = new Date(new Date(rec.lastDoseAt).getTime() + rec.withdrawalHours * 3_600_000);
    const prev = byClass.get(rec.drugClass);
    if (!prev || deadline.getTime() > prev.deadline.getTime()) {
      byClass.set(rec.drugClass, { drugClass: rec.drugClass, deadline, basedOn: rec });
    }
  }
  return [...byClass.values()].sort((a, b) => b.deadline.getTime() - a.deadline.getTime());
}

/** 全部类别都要满足，整匹马的有效退赛期限取各类最晚者 */
export function overallDeadline(records: TreatmentRecord[], horseId: string): Date | null {
  const list = withdrawalDeadlines(records, horseId);
  return list.length > 0 ? list[0].deadline : null;
}

export interface ClearanceVerdict {
  status: ClearanceStatus;
  reasons: string[];
  withdrawalDeadline: string | null;
  gaitWindow: GaitSnapshot[];
}

/** 报名前核对：先核对退赛期，再看赛前两次步态评估；任一不过即待复查 */
export function evaluateClearance(
  horseId: string,
  records: TreatmentRecord[],
  gaits: GaitAssessment[],
  now: Date
): ClearanceVerdict {
  const reasons: string[] = [];

  const deadline = overallDeadline(records, horseId);
  if (deadline && now.getTime() < deadline.getTime()) {
    reasons.push(`退赛期未满，须待 ${fmtDateTime(deadline)} 之后`);
  }

  const recent = gaits
    .filter((g) => g.horseId === horseId)
    .sort((a, b) => b.assessedAt.localeCompare(a.assessedAt))
    .slice(0, 2);
  if (recent.length < 2) {
    reasons.push(`赛前两次步态评估不足（现有 ${recent.length} 次）`);
  } else {
    const abnormal = recent.filter((g) => g.result === "异常");
    if (abnormal.length > 0) {
      reasons.push(`赛前步态评估异常（${abnormal.map((g) => fmtDateTime(g.assessedAt)).join("、")}）`);
    }
  }

  return {
    status: reasons.length === 0 ? "cleared" : "pending",
    reasons,
    withdrawalDeadline: deadline ? deadline.toISOString() : null,
    gaitWindow: recent.map((g) => ({ id: g.id, assessedAt: g.assessedAt, result: g.result })),
  };
}

export function decideClearance(
  horseId: string,
  records: TreatmentRecord[],
  gaits: GaitAssessment[],
  now: Date
): Clearance {
  return { id: nextId("C"), horseId, decidedAt: now.toISOString(), ...evaluateClearance(horseId, records, gaits, now) };
}
