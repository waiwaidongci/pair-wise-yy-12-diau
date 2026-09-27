import { useState } from "react";
import "./styles.css";
import { decideClearance, overallDeadline } from "./domain/judgment";
import {
  correctTreatment,
  createGaitAssessment,
  createTreatment,
  voidClearancesForHorse,
  type GaitInput,
  type TreatmentInput,
} from "./domain/records";
import { buildSeed } from "./domain/seed";
import type { Clearance, GaitAssessment, TreatmentRecord } from "./domain/types";
import { ClearanceBoard } from "./pages/ClearanceBoard";

const seed = buildSeed(new Date());

function App() {
  const [treatments, setTreatments] = useState<TreatmentRecord[]>(seed.treatments);
  const [gaits, setGaits] = useState<GaitAssessment[]>(seed.gaits);
  const [clearances, setClearances] = useState<Clearance[]>(seed.clearances);

  // 记录变更后：作废旧放行（保留旧结论）→ 按最新记录重新核对 → 追加新结论
  const recheck = (
    horseId: string,
    reason: string,
    nextTreatments: TreatmentRecord[],
    nextGaits: GaitAssessment[]
  ) => {
    const now = new Date();
    setClearances((prev) => [
      ...voidClearancesForHorse(prev, horseId, now, reason),
      decideClearance(horseId, nextTreatments, nextGaits, now),
    ]);
  };

  const handleAddTreatment = (input: TreatmentInput) => {
    const next = [...treatments, createTreatment(input, new Date())];
    setTreatments(next);
    recheck(input.horseId, "新增治疗记录，重新核对", next, gaits);
  };

  const handleCorrectTreatment = (id: string, patch: TreatmentInput) => {
    const next = correctTreatment(treatments, id, patch, new Date());
    setTreatments(next);
    recheck(patch.horseId, "治疗记录更正，原放行作废", next, gaits);
  };

  const handleAddGait = (input: GaitInput) => {
    const next = [...gaits, createGaitAssessment(input)];
    setGaits(next);
    recheck(input.horseId, "新增步态评估，重新核对", treatments, next);
  };

  const handleRecheck = (horseId: string) =>
    recheck(horseId, "报名前人工核对", treatments, gaits);

  const horseIds = [...new Set([...treatments, ...gaits, ...clearances].map((r) => r.horseId))].sort();
  const currentClearances = horseIds
    .map((id) =>
      clearances
        .filter((c) => c.horseId === id && !c.voidedAt)
        .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))[0]
    )
    .filter((c): c is Clearance => Boolean(c));
  const nowMs = Date.now();
  const metrics: Array<[string, number]> = [
    ["可参赛", currentClearances.filter((c) => c.status === "cleared").length],
    ["待复查", currentClearances.filter((c) => c.status === "pending").length],
    [
      "退赛期内",
      horseIds.filter((id) => {
        const d = overallDeadline(treatments, id);
        return d !== null && d.getTime() > nowMs;
      }).length,
    ],
    ["作废放行", clearances.filter((c) => c.voidedAt).length],
  ];

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62011 · 源提示词6 · Port 62011 · 马术蹄铁修整档案</p>
        <h1>治疗与参赛放行台</h1>
        <span>
          蹄底脓肿用药不再只留修蹄结果：登记马号、蹄位、药名、末次用药时间与退赛期，同类药再用按更晚时间延长退赛期；报名前先核对退赛期，再看赛前两次步态评估，期限没到或步态异常的马匹只留在待复查，不进入可参赛名单；治疗记录更正后，原有放行作废并保留旧结论。
        </span>
      </section>

      <section className="metrics">
        {metrics.map(([label, value]) => (
          <article key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <ClearanceBoard
        treatments={treatments}
        gaits={gaits}
        clearances={clearances}
        onAddTreatment={handleAddTreatment}
        onCorrectTreatment={handleCorrectTreatment}
        onAddGait={handleAddGait}
        onRecheck={handleRecheck}
      />
    </main>
  );
}

export default App;
