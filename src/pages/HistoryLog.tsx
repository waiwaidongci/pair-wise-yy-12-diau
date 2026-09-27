/**
 * 页面层 · 更正与作废：更正留痕与已作废放行结论的档案。
 * 作废结论只读留档，不再作为参赛依据。
 */
import type { ClearanceDecision, TreatmentCorrection } from "../domain/types";
import { formatDateTime } from "../utils/datetime";

interface Props {
  corrections: TreatmentCorrection[];
  decisions: ClearanceDecision[];
}

/** ISO 时间串格式化展示，其余原样 */
function formatMaybe(value: string): string {
  return value.includes("T") && !Number.isNaN(Date.parse(value))
    ? formatDateTime(value)
    : value;
}

export default function HistoryLog({ corrections, decisions }: Props) {
  const sortedCorrections = [...corrections].sort(
    (a, b) => Date.parse(b.correctedAt) - Date.parse(a.correctedAt)
  );
  const voided = decisions
    .filter((d) => d.voided)
    .sort((a, b) => Date.parse(b.voidedAt ?? "") - Date.parse(a.voidedAt ?? ""));

  return (
    <>
      <section className="panel">
        <div className="heading">
          <div>
            <p>治疗记录更正留痕</p>
            <h2>更正记录</h2>
          </div>
        </div>
        {sortedCorrections.length === 0 ? (
          <p className="muted">暂无更正。</p>
        ) : (
          <div className="cards">
            {sortedCorrections.map((c) => (
              <article className="card" key={c.id}>
                <div className="card-head">
                  <h3>
                    {c.horseId} · 记录 {c.recordId}
                  </h3>
                  <span className="badge neutral">{c.id}</span>
                </div>
                <p className="muted">
                  {formatDateTime(c.correctedAt)} · {c.note}
                </p>
                <ul className="changes">
                  {c.changes.map((ch, i) => (
                    <li key={i}>
                      {ch.field}：{formatMaybe(ch.from)} → {formatMaybe(ch.to)}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>原放行作废，旧结论保留</p>
            <h2>已作废的参赛放行</h2>
          </div>
        </div>
        {voided.length === 0 ? (
          <p className="muted">暂无作废放行。</p>
        ) : (
          <div className="cards">
            {voided.map((d) => (
              <article className="card voided" key={d.id}>
                <div className="card-head">
                  <h3>
                    {d.horseId} · {d.eventName}
                  </h3>
                  <span className="badge void">已作废</span>
                </div>
                <p>
                  旧结论：
                  <span className={`badge ${d.status === "可参赛" ? "ok" : "hold"}`}>
                    {d.status}
                  </span>
                  <span className="muted">（{formatDateTime(d.evaluatedAt)} 核对）</span>
                </p>
                <p className="muted">
                  退赛截止 {formatDateTime(d.withdrawalUntil)} · 步态：{d.gaitSummary}
                </p>
                {d.reasons.length > 0 && (
                  <ul className="reasons">
                    {d.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
                <p className="muted">
                  作废于 {formatDateTime(d.voidedAt)}：{d.voidReason}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
