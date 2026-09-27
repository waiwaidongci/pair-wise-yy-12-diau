/**
 * 页面层 · 参赛放行：报名前核对、步态评估登记、可参赛/待复查名单。
 * 结论一律由判断层产出，页面不自行放宽规则。
 */
import { useMemo, useState } from "react";
import {
  currentDecisions,
  judgeClearance,
  REQUIRED_GAIT_ROUNDS,
} from "../domain/clearance";
import type {
  ClearanceDecision,
  GaitAssessment,
  GaitResult,
  TreatmentRecord,
} from "../domain/types";
import { formatDateTime, toLocalInputValue } from "../utils/datetime";

export interface NewGait {
  horseId: string;
  result: GaitResult;
  assessor: string;
  assessedAt: string;
}

interface Props {
  horses: string[];
  treatments: TreatmentRecord[];
  gaits: GaitAssessment[];
  decisions: ClearanceDecision[];
  onAddGait: (input: NewGait) => void;
  onEvaluate: (horseId: string, eventName: string) => void;
}

const HOUR_MS = 3_600_000;

export default function ClearanceBoard({
  horses,
  treatments,
  gaits,
  decisions,
  onAddGait,
  onEvaluate,
}: Props) {
  const [eventName, setEventName] = useState("秋季场地障碍赛");
  const [gaitHorse, setGaitHorse] = useState(horses[0] ?? "");
  const [gaitResult, setGaitResult] = useState<GaitResult>("正常");
  const [assessor, setAssessor] = useState("王兽医");
  const [assessedAt, setAssessedAt] = useState(toLocalInputValue(new Date()));
  const now = new Date();

  const current = useMemo(() => currentDecisions(decisions), [decisions]);
  const cleared = current.filter((d) => d.status === "可参赛");
  const pending = current.filter((d) => d.status === "待复查");
  const unchecked = horses.filter((h) => !current.some((d) => d.horseId === h));

  const previews = horses.map((h) => ({
    horseId: h,
    verdict: judgeClearance(h, treatments, gaits, now),
  }));

  const submitGait = () => {
    if (!gaitHorse || !assessedAt) return;
    onAddGait({
      horseId: gaitHorse,
      result: gaitResult,
      assessor: assessor.trim() || "未署名",
      assessedAt: new Date(assessedAt).toISOString(),
    });
    setAssessedAt(toLocalInputValue(new Date()));
  };

  return (
    <>
      <section className="panel">
        <div className="heading">
          <div>
            <p>判断层 · 先退赛期，再赛前{REQUIRED_GAIT_ROUNDS}次步态评估</p>
            <h2>报名前核对</h2>
          </div>
          <label className="inline-field">
            <span>赛事名称</span>
            <input value={eventName} onChange={(e) => setEventName(e.target.value)} />
          </label>
        </div>
        <table className="ledger">
          <thead>
            <tr>
              <th>马号</th>
              <th>有效退赛截止</th>
              <th>退赛期核对</th>
              <th>最近两次步态</th>
              <th>实时预判</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {previews.map(({ horseId, verdict }) => (
              <tr key={horseId}>
                <td>{horseId}</td>
                <td>
                  {verdict.withdrawalUntil
                    ? formatDateTime(verdict.withdrawalUntil)
                    : "无用药记录"}
                </td>
                <td>
                  {verdict.withdrawalUntil === null ? (
                    "—"
                  ) : verdict.withdrawalOk ? (
                    <span className="badge ok">已到期</span>
                  ) : (
                    <span className="badge hold">未到期</span>
                  )}
                </td>
                <td>{verdict.gaitSummary}</td>
                <td>
                  <span className={`badge ${verdict.status === "可参赛" ? "ok" : "hold"}`}>
                    {verdict.status}
                  </span>
                </td>
                <td>
                  <button onClick={() => onEvaluate(horseId, eventName)}>
                    生成放行结论
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {unchecked.length > 0 && (
          <p className="muted">尚未核对的马匹：{unchecked.join("、")}（不会出现在任何名单中）</p>
        )}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>赛前步态评估</p>
            <h2>评估登记</h2>
          </div>
          <button className="primary" onClick={submitGait}>
            保存评估
          </button>
        </div>
        <div className="field-grid">
          <label>
            <span>马号</span>
            <select value={gaitHorse} onChange={(e) => setGaitHorse(e.target.value)}>
              {horses.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </label>
          <label>
            <span>评估结果</span>
            <select
              value={gaitResult}
              onChange={(e) => setGaitResult(e.target.value as GaitResult)}
            >
              <option>正常</option>
              <option>异常</option>
            </select>
          </label>
          <label>
            <span>评估人</span>
            <input value={assessor} onChange={(e) => setAssessor(e.target.value)} />
          </label>
          <label>
            <span>评估时间</span>
            <input
              type="datetime-local"
              value={assessedAt}
              onChange={(e) => setAssessedAt(e.target.value)}
            />
          </label>
        </div>
      </section>

      <div className="board-lists">
        <section className="panel">
          <div className="heading">
            <div>
              <p>可参赛名单</p>
              <h2>{cleared.length} 匹</h2>
            </div>
          </div>
          <div className="cards">
            {cleared.length === 0 && <p className="muted">暂无可参赛马匹。</p>}
            {cleared.map((d) => (
              <article className="card cleared" key={d.id}>
                <div className="card-head">
                  <h3>{d.horseId}</h3>
                  <span className="badge ok">可参赛</span>
                </div>
                <p className="muted">
                  {d.eventName} · 核对于 {formatDateTime(d.evaluatedAt)}
                </p>
                <p className="muted">
                  退赛截止 {formatDateTime(d.withdrawalUntil)} · 步态：{d.gaitSummary}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="heading">
            <div>
              <p>待复查 · 期限没到或步态异常只留在这里</p>
              <h2>{pending.length} 匹</h2>
            </div>
          </div>
          <div className="cards">
            {pending.length === 0 && <p className="muted">暂无待复查马匹。</p>}
            {pending.map((d) => {
              const remainMs = d.withdrawalUntil
                ? Date.parse(d.withdrawalUntil) - now.getTime()
                : 0;
              return (
                <article className="card pending" key={d.id}>
                  <div className="card-head">
                    <h3>{d.horseId}</h3>
                    <span className="badge hold">待复查</span>
                  </div>
                  <p className="muted">
                    {d.eventName} · 核对于 {formatDateTime(d.evaluatedAt)}
                  </p>
                  <ul className="reasons">
                    {d.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <p className="muted">
                    步态：{d.gaitSummary}
                    {remainMs > 0 && ` · 退赛期还剩 ${Math.ceil(remainMs / HOUR_MS)} 小时`}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
