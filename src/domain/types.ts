/** 蹄位 */
export type HoofPosition = "左前蹄" | "右前蹄" | "左后蹄" | "右后蹄";

export const HOOF_POSITIONS: HoofPosition[] = ["左前蹄", "右前蹄", "左后蹄", "右后蹄"];

/** 药物类别：同类药再用时退赛期按更晚时间延长 */
export type DrugClass = "镇痛药" | "抗菌药";

export const DRUG_CLASSES: DrugClass[] = ["镇痛药", "抗菌药"];

/** 治疗记录：蹄底脓肿用药台账的一行 */
export interface TreatmentRecord {
  id: string;
  horseId: string; // 马号
  hoof: HoofPosition; // 蹄位
  drugName: string; // 药名
  drugClass: DrugClass; // 药物类别
  lastDoseAt: string; // 末次用药时间 ISO
  withdrawalHours: number; // 退赛期（小时）
  createdAt: string;
  updatedAt: string;
}

/** 治疗记录更正留痕：每个字段的旧值与新值都保留 */
export interface TreatmentCorrection {
  id: string;
  recordId: string;
  horseId: string;
  correctedAt: string;
  changes: Array<{ field: string; from: string; to: string }>;
  note: string;
}

export type GaitResult = "正常" | "异常";

/** 赛前步态评估 */
export interface GaitAssessment {
  id: string;
  horseId: string;
  round: number; // 第几次评估
  result: GaitResult;
  assessor: string;
  assessedAt: string;
}

export type ClearanceStatus = "可参赛" | "待复查";

/** 参赛放行结论；作废后旧结论保留，仅打作废标记，不再作为参赛依据 */
export interface ClearanceDecision {
  id: string;
  horseId: string;
  eventName: string;
  evaluatedAt: string;
  status: ClearanceStatus;
  withdrawalOk: boolean;
  withdrawalUntil: string | null; // 最晚退赛到期时间 ISO
  gaitOk: boolean;
  gaitSummary: string;
  reasons: string[];
  voided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
}
