import { useMemo, useState } from "react";
import "./styles.css";
import { buildSeed, type SeedState } from "./data/seed";
import {
  currentDecisions,
  judgeClearance,
  voidDecisionsForHorse,
} from "./domain/clearance";
import { correctTreatment, type TreatmentPatch } from "./domain/treatments";
import type {
  ClearanceDecision,
  GaitAssessment,
  TreatmentRecord,
} from "./domain/types";
import ClearanceBoard, { type NewGait } from "./pages/ClearanceBoard";
import HistoryLog from "./pages/HistoryLog";
import TreatmentLedger, { type NewTreatment } from "./pages/TreatmentLedger";
import { makeId } from "./utils/ids";

type TabKey = "ledger" | "clearance" | "history";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "ledger", label: "治疗台账" },
  { key: "clearance", label: "参赛放行" },
  { key: "history", label: "更正与作废" },
];

function App() {
  const [state, setState] = useState<SeedState>(() => buildSeed());
  const [tab, setTab] = useState<TabKey>("clearance");

  const horses = useMemo(() => {
    const set = new Set<string>();
    for (const t of state.treatments) set.add(t.horseId);
    for (const g of state.gaits) set.add(g.horseId);
    for (const d of state.decisions) set.add(d.horseId);
    return [...set].sort();
  }, [state]);

  const current = useMemo(() => currentDecisions(state.decisions), [state.decisions]);
  const clearedCount = current.filter((d) => d.status === "可参赛").length;
  const pendingCount = current.filter((d) => d.status === "待复查").length;
  const voidedCount = state.decisions.filter((d) => d.voided).length;

  /** 记录层：新增治疗记录；用药会改变退赛窗口，该马原放行一并作废待重核 */
  const addTreatment = (input: NewTreatment) => {
    setState((prev) => {
      const now = new Date();
      const record: TreatmentRecord = {
        id: makeId("TR"),
        ...input,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      return {
        ...prev,
        treatments: [...prev.treatments, record],
        decisions: voidDecisionsForHorse(
          prev.decisions,
          record.horseId,
          `新增治疗记录 ${record.id}（${record.drugClass}·${record.drugName}），原放行作废`,
          now
        ),
      };
    });
  };

  /** 记录层更正留痕 + 判断层作废旧放行（旧结论保留） */
  const correctRecord = (recordId: string, patch: TreatmentPatch, note: string) => {
    setState((prev) => {
      const target = prev.treatments.find((t) => t.id === recordId);
      if (!target) return prev;
      const now = new Date();
      const { record, correction } = correctTreatment(target, patch, note, now);
      const changeText =
        correction.changes.map((c) => `${c.field}：${c.from} → ${c.to}`).join("；") ||
        "无字段变化";
      return {
        ...prev,
        treatments: prev.treatments.map((t) => (t.id === recordId ? record : t)),
        corrections: [...prev.corrections, correction],
        decisions: voidDecisionsForHorse(
          prev.decisions,
          record.horseId,
          `治疗记录更正（${changeText}），原放行作废`,
          now
        ),
      };
    });
  };

  /** 记录层：登记赛前步态评估 */
  const addGait = (input: NewGait) => {
    setState((prev) => {
      const round = prev.gaits.filter((g) => g.horseId === input.horseId).length + 1;
      const gait: GaitAssessment = { id: makeId("GA"), round, ...input };
      return { ...prev, gaits: [...prev.gaits, gait] };
    });
  };

  /** 判断层：报名前核对，生成一条放行结论 */
  const evaluate = (horseId: string, eventName: string) => {
    setState((prev) => {
      const now = new Date();
      const verdict = judgeClearance(horseId, prev.treatments, prev.gaits, now);
      const decision: ClearanceDecision = {
        id: makeId("CD"),
        horseId,
        eventName: eventName.trim() || "未命名赛事",
        evaluatedAt: now.toISOString(),
        ...verdict,
        voided: false,
        voidedAt: null,
        voidReason: null,
      };
      return { ...prev, decisions: [...prev.decisions, decision] };
    });
  };

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62011 · 源提示词6 · Port 62011</p>
        <h1>治疗与参赛放行台</h1>
        <span>
          蹄底脓肿治疗登记（马号、蹄位、药名、末次用药时间、退赛期）与参赛放行核对。同类药再用按更晚时间延长退赛期；报名前先核对退赛期，再看赛前两次步态评估——期限没到或步态异常的马匹只留在待复查，不进可参赛名单；治疗记录更正后原放行作废并保留旧结论。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>治疗记录</small>
          <strong>{state.treatments.length}</strong>
        </article>
        <article>
          <small>可参赛</small>
          <strong>{clearedCount}</strong>
        </article>
        <article>
          <small>待复查</small>
          <strong>{pendingCount}</strong>
        </article>
        <article>
          <small>已作废放行</small>
          <strong>{voidedCount}</strong>
        </article>
      </section>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "ledger" && (
        <TreatmentLedger
          treatments={state.treatments}
          horses={horses}
          onAdd={addTreatment}
          onCorrect={correctRecord}
        />
      )}
      {tab === "clearance" && (
        <ClearanceBoard
          horses={horses}
          treatments={state.treatments}
          gaits={state.gaits}
          decisions={state.decisions}
          onAddGait={addGait}
          onEvaluate={evaluate}
        />
      )}
      {tab === "history" && (
        <HistoryLog corrections={state.corrections} decisions={state.decisions} />
      )}
    </main>
  );
}

export default App;
