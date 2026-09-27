export type HoofPosition = "左前蹄" | "右前蹄" | "左后蹄" | "右后蹄";
export type DrugClass = "镇痛药" | "抗菌药";
export type GaitResult = "正常" | "异常";
export type ClearanceStatus = "cleared" | "pending";

/** 治疗记录：蹄底脓肿等用药登记，更正后旧记录保留并标记 corrected */
export interface TreatmentRecord {
  id: string;
  horseId: string;
  hoof: HoofPosition;
  diagnosis: string;
  drugName: string;
  drugClass: DrugClass;
  lastDoseAt: string; // ISO，末次用药时间
  withdrawalHours: number; // 退赛期（小时）
  recordedAt: string;
  status: "active" | "corrected";
  supersedesId?: string; // 本条更正了哪条旧记录
  correctedById?: string; // 本条被哪条新记录更正
}

/** 赛前步态评估 */
export interface GaitAssessment {
  id: string;
  horseId: string;
  assessedAt: string;
  result: GaitResult;
  note: string;
}

/** 放行结论里冻结的步态快照，作废后仍能还原当时依据 */
export interface GaitSnapshot {
  id: string;
  assessedAt: string;
  result: GaitResult;
}

/** 参赛放行结论：作废只打标记不删除，旧结论永久保留 */
export interface Clearance {
  id: string;
  horseId: string;
  decidedAt: string;
  status: ClearanceStatus;
  reasons: string[];
  withdrawalDeadline: string | null;
  gaitWindow: GaitSnapshot[];
  voidedAt?: string;
  voidReason?: string;
}
