import { decideClearance } from "./judgment";
import {
  correctTreatment,
  createGaitAssessment,
  createTreatment,
  voidClearancesForHorse,
} from "./records";
import type { Clearance, GaitAssessment, TreatmentRecord } from "./types";

export interface Seed {
  treatments: TreatmentRecord[];
  gaits: GaitAssessment[];
  clearances: Clearance[];
}

/**
 * 演示数据全部走与页面相同的记录/判断入口：
 * HORSE-18 退赛期未满待复查；HORSE-27 退赛期已过可参赛；
 * HORSE-31 先放行、更正末次用药时间后原放行作废、再添异常步态，完整留痕。
 */
export function buildSeed(now: Date): Seed {
  const at = (offsetHours: number) => new Date(now.getTime() + offsetHours * 3_600_000);
  const iso = (offsetHours: number) => at(offsetHours).toISOString();

  let treatments = [
    createTreatment(
      { horseId: "HORSE-18", hoof: "右前蹄", diagnosis: "蹄底脓肿", drugName: "氟尼辛葡甲胺", drugClass: "镇痛药", lastDoseAt: iso(-26), withdrawalHours: 72 },
      at(-27)
    ),
    createTreatment(
      { horseId: "HORSE-18", hoof: "右前蹄", diagnosis: "蹄底脓肿", drugName: "头孢噻呋", drugClass: "抗菌药", lastDoseAt: iso(-26), withdrawalHours: 48 },
      at(-27)
    ),
    createTreatment(
      { horseId: "HORSE-27", hoof: "左后蹄", diagnosis: "蹄底脓肿", drugName: "恩诺沙星", drugClass: "抗菌药", lastDoseAt: iso(-130), withdrawalHours: 96 },
      at(-131)
    ),
    createTreatment(
      { horseId: "HORSE-31", hoof: "右后蹄", diagnosis: "蹄底脓肿", drugName: "酮洛芬", drugClass: "镇痛药", lastDoseAt: iso(-100), withdrawalHours: 48 },
      at(-101)
    ),
    createTreatment(
      { horseId: "HORSE-31", hoof: "右后蹄", diagnosis: "蹄底脓肿", drugName: "头孢喹肟", drugClass: "抗菌药", lastDoseAt: iso(-200), withdrawalHours: 96 },
      at(-201)
    ),
  ];

  let gaits: GaitAssessment[] = [
    createGaitAssessment({ horseId: "HORSE-18", assessedAt: iso(-20), result: "正常", note: "出场慢步" }),
    createGaitAssessment({ horseId: "HORSE-18", assessedAt: iso(-6), result: "正常", note: "快步复查" }),
    createGaitAssessment({ horseId: "HORSE-27", assessedAt: iso(-30), result: "正常", note: "" }),
    createGaitAssessment({ horseId: "HORSE-27", assessedAt: iso(-8), result: "正常", note: "" }),
    createGaitAssessment({ horseId: "HORSE-31", assessedAt: iso(-60), result: "正常", note: "" }),
    createGaitAssessment({ horseId: "HORSE-31", assessedAt: iso(-55), result: "正常", note: "" }),
  ];

  // 报名核对：18 退赛期未满 → 待复查；27 期限已过且步态正常 → 可参赛
  let clearances: Clearance[] = [
    decideClearance("HORSE-18", treatments, gaits, at(-1)),
    decideClearance("HORSE-27", treatments, gaits, at(-1)),
    decideClearance("HORSE-31", treatments, gaits, at(-50)), // 更正前：可参赛
  ];

  // 更正 HORSE-31 的末次用药时间（-100h 实为 -30h），原放行作废并保留旧结论
  treatments = correctTreatment(
    treatments,
    treatments[3].id,
    { horseId: "HORSE-31", hoof: "右后蹄", diagnosis: "蹄底脓肿", drugName: "酮洛芬", drugClass: "镇痛药", lastDoseAt: iso(-30), withdrawalHours: 48 },
    at(-40)
  );
  clearances = [
    ...voidClearancesForHorse(clearances, "HORSE-31", at(-40), "治疗记录更正：末次用药时间更正"),
    decideClearance("HORSE-31", treatments, gaits, at(-40)),
  ];

  // 新增一次异常步态评估，再次作废旧结论重新核对
  gaits = [
    ...gaits,
    createGaitAssessment({ horseId: "HORSE-31", assessedAt: iso(-12), result: "异常", note: "右后蹄负重迟疑" }),
  ];
  clearances = [
    ...voidClearancesForHorse(clearances, "HORSE-31", at(-12), "新增步态评估，重新核对"),
    decideClearance("HORSE-31", treatments, gaits, at(-12)),
  ];

  return { treatments, gaits, clearances };
}
