/**
 * 判断层：报名前核对与放行结论的作废。
 * 纯函数，只依据记录层给出的事实做判断，不修改台账。
 */
import { formatDateTime } from "../utils/datetime";
import { effectiveWithdrawals } from "./treatments";
import type {
  ClearanceDecision,
  ClearanceStatus,
  GaitAssessment,
  TreatmentRecord,
} from "./types";

/** 报名前需要的步态评估次数 */
export const REQUIRED_GAIT_ROUNDS = 2;

/** 取某匹马最近两次赛前步态评估 */
export function latestGaitPair(
  gaits: GaitAssessment[],
  horseId: string
): GaitAssessment[] {
  return gaits
    .filter((g) => g.horseId === horseId)
    .sort((a, b) => Date.parse(b.assessedAt) - Date.parse(a.assessedAt))
    .slice(0, REQUIRED_GAIT_ROUNDS);
}

export interface ClearanceVerdict {
  status: ClearanceStatus;
  withdrawalOk: boolean;
  withdrawalUntil: string | null;
  gaitOk: boolean;
  gaitSummary: string;
  reasons: string[];
}

/**
 * 报名前核对：
 * 1. 先核对退赛期——同类药按更晚时间延长后的有效截止必须全部到期；
 * 2. 再看赛前两次步态评估——两次都要正常。
 * 期限没到或步态异常，只能留在待复查，不能进入可参赛名单。
 */
export function judgeClearance(
  horseId: string,
  treatments: TreatmentRecord[],
  gaits: GaitAssessment[],
  now: Date
): ClearanceVerdict {
  // 1) 退赛期
  const windows = effectiveWithdrawals(treatments, horseId);
  const withdrawalUntil =
    windows.length > 0 ? Math.max(...windows.map((w) => w.deadline)) : null;
  const withdrawalOk = withdrawalUntil === null || withdrawalUntil <= now.getTime();

  // 2) 赛前两次步态评估
  const pair = latestGaitPair(gaits, horseId);
  const abnormal = pair.filter((g) => g.result === "异常");
  const gaitOk = pair.length >= REQUIRED_GAIT_ROUNDS && abnormal.length === 0;
  const gaitSummary =
    pair.length === 0
      ? "暂无步态评估"
      : pair.map((g) => `第${g.round}次${g.result}`).join("，");

  const reasons: string[] = [];
  if (!withdrawalOk && withdrawalUntil !== null) {
    reasons.push(`退赛期未到，${formatDateTime(withdrawalUntil)} 后才可报名`);
  }
  if (pair.length < REQUIRED_GAIT_ROUNDS) {
    reasons.push(`赛前步态评估不足${REQUIRED_GAIT_ROUNDS}次（已有 ${pair.length} 次）`);
  } else if (abnormal.length > 0) {
    reasons.push("赛前步态评估存在异常");
  }

  return {
    status: withdrawalOk && gaitOk ? "可参赛" : "待复查",
    withdrawalOk,
    withdrawalUntil:
      withdrawalUntil === null ? null : new Date(withdrawalUntil).toISOString(),
    gaitOk,
    gaitSummary,
    reasons,
  };
}

/**
 * 治疗记录新增/更正后，该马原有放行一律作废。
 * 旧结论不删改，只打作废标记与原因，留档可查。
 */
export function voidDecisionsForHorse(
  decisions: ClearanceDecision[],
  horseId: string,
  reason: string,
  now: Date
): ClearanceDecision[] {
  return decisions.map((d) =>
    d.horseId === horseId && !d.voided
      ? { ...d, voided: true, voidedAt: now.toISOString(), voidReason: reason }
      : d
  );
}

/** 每匹马当前有效的放行结论（最新一条未作废的） */
export function currentDecisions(decisions: ClearanceDecision[]): ClearanceDecision[] {
  const byHorse = new Map<string, ClearanceDecision>();
  const sorted = [...decisions].sort(
    (a, b) => Date.parse(a.evaluatedAt) - Date.parse(b.evaluatedAt)
  );
  for (const d of sorted) {
    if (!d.voided) byHorse.set(d.horseId, d);
  }
  return [...byHorse.values()];
}
