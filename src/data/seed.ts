/**
 * 演示数据：时间均相对当前时刻，保证退赛期/步态的四种典型情形随时可见。
 * 放行结论通过判断层真实计算生成，保证与规则一致。
 */
import { judgeClearance } from "../domain/clearance";
import type {
  ClearanceDecision,
  GaitAssessment,
  TreatmentCorrection,
  TreatmentRecord,
} from "../domain/types";

const HOUR = 3_600_000;
const EVENT_NAME = "秋季场地障碍赛";

export interface SeedState {
  treatments: TreatmentRecord[];
  corrections: TreatmentCorrection[];
  gaits: GaitAssessment[];
  decisions: ClearanceDecision[];
}

export function buildSeed(now: Date = new Date()): SeedState {
  const base = now.getTime();
  const at = (hoursAgo: number) => new Date(base - hoursAgo * HOUR).toISOString();

  const treatments: TreatmentRecord[] = [
    {
      id: "TR-001",
      horseId: "HORSE-18",
      hoof: "右前蹄",
      drugName: "氟尼辛葡甲胺",
      drugClass: "镇痛药",
      lastDoseAt: at(120),
      withdrawalHours: 96, // 退赛截止已在 24 小时前到期
      createdAt: at(120),
      updatedAt: at(120),
    },
    {
      id: "TR-002",
      horseId: "HORSE-27",
      hoof: "左后蹄",
      drugName: "头孢噻呋",
      drugClass: "抗菌药",
      lastDoseAt: at(30),
      withdrawalHours: 72, // 退赛截止在 42 小时后，期限没到
      createdAt: at(30),
      updatedAt: at(30),
    },
    // HORSE-31：同类药（镇痛药）再用，有效退赛截止按更晚时间延长
    {
      id: "TR-003",
      horseId: "HORSE-31",
      hoof: "右后蹄",
      drugName: "保泰松",
      drugClass: "镇痛药",
      lastDoseAt: at(200),
      withdrawalHours: 72,
      createdAt: at(200),
      updatedAt: at(200),
    },
    {
      id: "TR-004",
      horseId: "HORSE-31",
      hoof: "右后蹄",
      drugName: "保泰松",
      drugClass: "镇痛药",
      lastDoseAt: at(120),
      withdrawalHours: 96, // 更晚到期（24 小时前），覆盖 TR-003 的截止
      createdAt: at(120),
      updatedAt: at(120),
    },
    {
      id: "TR-005",
      horseId: "HORSE-42",
      hoof: "左前蹄",
      drugName: "恩诺沙星",
      drugClass: "抗菌药",
      lastDoseAt: at(200),
      withdrawalHours: 96, // 更正后的值，更正留痕见 TC-001
      createdAt: at(200),
      updatedAt: at(48),
    },
  ];

  const corrections: TreatmentCorrection[] = [
    {
      id: "TC-001",
      recordId: "TR-005",
      horseId: "HORSE-42",
      correctedAt: at(48),
      changes: [{ field: "退赛期(小时)", from: "48", to: "96" }],
      note: "兽医复核药代动力学后延长退赛期",
    },
  ];

  const gaits: GaitAssessment[] = [
    { id: "GA-001", horseId: "HORSE-18", round: 1, result: "正常", assessor: "王兽医", assessedAt: at(26) },
    { id: "GA-002", horseId: "HORSE-18", round: 2, result: "正常", assessor: "王兽医", assessedAt: at(10) },
    { id: "GA-003", horseId: "HORSE-27", round: 1, result: "正常", assessor: "王兽医", assessedAt: at(26) },
    { id: "GA-004", horseId: "HORSE-27", round: 2, result: "正常", assessor: "李兽医", assessedAt: at(10) },
    { id: "GA-005", horseId: "HORSE-31", round: 1, result: "正常", assessor: "王兽医", assessedAt: at(26) },
    { id: "GA-006", horseId: "HORSE-31", round: 2, result: "异常", assessor: "李兽医", assessedAt: at(10) },
    // HORSE-42：更正前的两次评估 + 更正后重新核对前的两次评估
    { id: "GA-007", horseId: "HORSE-42", round: 1, result: "正常", assessor: "王兽医", assessedAt: at(80) },
    { id: "GA-008", horseId: "HORSE-42", round: 2, result: "正常", assessor: "王兽医", assessedAt: at(74) },
    { id: "GA-009", horseId: "HORSE-42", round: 3, result: "正常", assessor: "王兽医", assessedAt: at(30) },
    { id: "GA-010", horseId: "HORSE-42", round: 4, result: "正常", assessor: "李兽医", assessedAt: at(28) },
  ];

  /** 用判断层在指定历史时刻生成一条有效结论 */
  const evaluated = (id: string, horseId: string, hoursAgo: number): ClearanceDecision => {
    const evaluatedAt = at(hoursAgo);
    return {
      id,
      horseId,
      eventName: EVENT_NAME,
      evaluatedAt,
      ...judgeClearance(horseId, treatments, gaits, new Date(evaluatedAt)),
      voided: false,
      voidedAt: null,
      voidReason: null,
    };
  };

  const decisions: ClearanceDecision[] = [
    // HORSE-42 更正前的旧放行：已作废，旧结论保留
    {
      id: "CD-001",
      horseId: "HORSE-42",
      eventName: EVENT_NAME,
      evaluatedAt: at(72),
      status: "可参赛",
      withdrawalOk: true,
      withdrawalUntil: at(152), // 末次用药 200 小时前 + 当时退赛期 48 小时
      gaitOk: true,
      gaitSummary: "第2次正常，第1次正常",
      reasons: [],
      voided: true,
      voidedAt: at(48),
      voidReason: "治疗记录更正（退赛期(小时)：48 → 96），原放行作废",
    },
    evaluated("CD-002", "HORSE-42", 24), // 更正后重新核对：可参赛
    evaluated("CD-003", "HORSE-18", 6), // 退赛期已过 + 步态正常：可参赛
    evaluated("CD-004", "HORSE-27", 6), // 退赛期没到：待复查
    evaluated("CD-005", "HORSE-31", 6), // 步态异常：待复查
  ];

  return { treatments, corrections, gaits, decisions };
}
