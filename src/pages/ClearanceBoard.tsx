import { useState, type FormEvent } from "react";
import { fmtDateTime, remainingText, toLocalInputValue } from "../domain/format";
import { withdrawalDeadlines } from "../domain/judgment";
import type { GaitInput, TreatmentInput } from "../domain/records";
import type {
  Clearance,
  DrugClass,
  GaitResult,
  HoofPosition,
  TreatmentRecord,
} from "../domain/types";

const HOOVES: HoofPosition[] = ["左前蹄", "右前蹄", "左后蹄", "右后蹄"];
const DRUG_CLASSES: DrugClass[] = ["镇痛药", "抗菌药"];
const DRUG_HINTS: Record<DrugClass, string> = {
  镇痛药: "如 氟尼辛葡甲胺 / 酮洛芬",
  抗菌药: "如 头孢噻呋 / 恩诺沙星",
};
const STATUS_TEXT: Record<Clearance["status"], string> = {
  cleared: "可参赛",
  pending: "待复查",
};

interface ClearanceBoardProps {
  treatments: TreatmentRecord[];
  gaits: import("../domain/types").GaitAssessment[];
  clearances: Clearance[];
  onAddTreatment: (input: TreatmentInput) => void;
  onCorrectTreatment: (id: string, patch: TreatmentInput) => void;
  onAddGait: (input: GaitInput) => void;
  onRecheck: (horseId: string) => void;
}

export function ClearanceBoard(props: ClearanceBoardProps) {
  const { treatments, gaits, clearances } = props;
  const [correcting, setCorrecting] = useState<TreatmentRecord | null>(null);
  const now = new Date();

  const horseIds = [...new Set([...treatments, ...gaits, ...clearances].map((r) => r.horseId))].sort();

  const currentOf = (horseId: string): Clearance | undefined =>
    clearances
      .filter((c) => c.horseId === horseId && !c.voidedAt)
      .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))[0];

  // 名单只认当前有效结论：可参赛与待复查互斥，未通过核对的马进不了可参赛名单
  const eligible = horseIds.filter((id) => currentOf(id)?.status === "cleared");
  const pending = horseIds.filter((id) => currentOf(id)?.status === "pending");
  const voidedHistory = clearances
    .filter((c) => c.voidedAt)
    .sort((a, b) => (b.voidedAt ?? "").localeCompare(a.voidedAt ?? ""));

  const latestActiveTreatment = (horseId: string) =>
    treatments
      .filter((t) => t.horseId === horseId && t.status === "active")
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];

  const recentGaits = (horseId: string) =>
    gaits
      .filter((g) => g.horseId === horseId)
      .sort((a, b) => b.assessedAt.localeCompare(a.assessedAt))
      .slice(0, 2);

  const submitTreatment = (input: TreatmentInput) => {
    if (correcting) {
      props.onCorrectTreatment(correcting.id, input);
      setCorrecting(null);
    } else {
      props.onAddTreatment(input);
    }
  };

  return (
    <div className="stack">
      <datalist id="horse-id-options">
        {horseIds.map((h) => (
          <option key={h} value={h} />
        ))}
      </datalist>

      <div className="board">
        <TreatmentForm
          key={correcting ? correcting.id : "new"}
          correcting={correcting}
          onSubmit={submitTreatment}
          onCancel={() => setCorrecting(null)}
        />
        <GaitForm onSubmit={props.onAddGait} />
      </div>

      <section className="panel">
        <div className="heading">
          <div>
            <p>报名前核对</p>
            <h2>放行总览</h2>
          </div>
          <span className="note">先核对退赛期，再看赛前两次步态评估</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>马号</th>
                <th>蹄位 / 诊断</th>
                <th>退赛期限（同类再用取更晚）</th>
                <th>赛前两次步态</th>
                <th>当前结论</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {horseIds.map((id) => {
                const treatment = latestActiveTreatment(id);
                const deadlines = withdrawalDeadlines(treatments, id);
                const gaitWindow = recentGaits(id);
                const current = currentOf(id);
                return (
                  <tr key={id}>
                    <td>
                      <strong>{id}</strong>
                    </td>
                    <td>{treatment ? `${treatment.hoof} · ${treatment.diagnosis}` : "—"}</td>
                    <td>
                      {deadlines.length === 0
                        ? "无在案用药"
                        : deadlines.map((d) => (
                            <div key={d.drugClass}>
                              {d.drugClass} 至 {fmtDateTime(d.deadline)}{" "}
                              <span className="sub-line">
                                （{remainingText(d.deadline, now)} · {d.basedOn.drugName}）
                              </span>
                            </div>
                          ))}
                    </td>
                    <td>
                      {gaitWindow.length === 0
                        ? "未评估"
                        : gaitWindow.map((g) => (
                            <div key={g.id}>
                              <span className={`badge ${g.result === "正常" ? "badge-ok" : "badge-warn"}`}>
                                {g.result}
                              </span>{" "}
                              {fmtDateTime(g.assessedAt)}
                            </div>
                          ))}
                    </td>
                    <td>
                      {current ? (
                        <>
                          <span className={`badge ${current.status === "cleared" ? "badge-ok" : "badge-warn"}`}>
                            {STATUS_TEXT[current.status]}
                          </span>
                          {current.reasons.length > 0 && (
                            <ul className="reason-list">
                              {current.reasons.map((r) => (
                                <li key={r}>{r}</li>
                              ))}
                            </ul>
                          )}
                          <div className="sub-line">核对于 {fmtDateTime(current.decidedAt)}</div>
                        </>
                      ) : (
                        <span className="badge badge-muted">未核对</span>
                      )}
                    </td>
                    <td>
                      <button type="button" onClick={() => props.onRecheck(id)}>
                        报名核对
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="list-grid">
        <section className="panel list-ok">
          <div className="heading">
            <div>
              <p>可参赛名单</p>
              <h2>{eligible.length} 匹</h2>
            </div>
          </div>
          <div className="card-stack">
            {eligible.length === 0 && <p className="empty">暂无符合要求的马匹</p>}
            {eligible.map((id) => {
              const c = currentOf(id)!;
              return (
                <article key={id} className="horse-card ok">
                  <h3>{id}</h3>
                  <p>退赛期已过 · 赛前两次步态评估正常</p>
                  <p className="sub-line">核对于 {fmtDateTime(c.decidedAt)}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="panel list-warn">
          <div className="heading">
            <div>
              <p>待复查</p>
              <h2>{pending.length} 匹</h2>
            </div>
          </div>
          <div className="card-stack">
            {pending.length === 0 && <p className="empty">暂无待复查马匹</p>}
            {pending.map((id) => {
              const c = currentOf(id)!;
              return (
                <article key={id} className="horse-card warn">
                  <h3>{id}</h3>
                  <ul className="reason-list">
                    {c.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <p className="sub-line">核对于 {fmtDateTime(c.decidedAt)}</p>
                </article>
              );
            })}
          </div>
          <p className="note">退赛期未满或步态异常的马匹只留在待复查，不会出现在可参赛名单。</p>
        </section>
      </div>

      <section className="panel">
        <div className="heading">
          <div>
            <p>治疗档案</p>
            <h2>治疗记录（更正留痕）</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>记录号</th>
                <th>马号</th>
                <th>蹄位</th>
                <th>诊断</th>
                <th>药名</th>
                <th>类别</th>
                <th>末次用药</th>
                <th>退赛期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {[...treatments]
                .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
                .map((t) => (
                  <tr key={t.id} className={t.status === "corrected" ? "row-muted" : ""}>
                    <td>{t.id}</td>
                    <td>{t.horseId}</td>
                    <td>{t.hoof}</td>
                    <td>{t.diagnosis}</td>
                    <td>{t.drugName}</td>
                    <td>{t.drugClass}</td>
                    <td>{fmtDateTime(t.lastDoseAt)}</td>
                    <td>{t.withdrawalHours} 小时</td>
                    <td>
                      {t.status === "active" ? (
                        <span className="badge badge-ok">在案</span>
                      ) : (
                        <span className="badge badge-muted">已更正 → {t.correctedById}</span>
                      )}
                      {t.supersedesId && <div className="sub-line">更正自 {t.supersedesId}</div>}
                    </td>
                    <td>
                      {t.status === "active" && (
                        <button type="button" onClick={() => setCorrecting(t)}>
                          更正
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>步态档案</p>
            <h2>步态评估记录</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>马号</th>
                <th>评估时间</th>
                <th>结果</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {[...gaits]
                .sort((a, b) => b.assessedAt.localeCompare(a.assessedAt))
                .map((g) => (
                  <tr key={g.id}>
                    <td>{g.horseId}</td>
                    <td>{fmtDateTime(g.assessedAt)}</td>
                    <td>
                      <span className={`badge ${g.result === "正常" ? "badge-ok" : "badge-warn"}`}>
                        {g.result}
                      </span>
                    </td>
                    <td>{g.note || "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>判断留痕</p>
            <h2>作废放行（保留旧结论）</h2>
          </div>
        </div>
        {voidedHistory.length === 0 ? (
          <p className="empty">暂无作废放行</p>
        ) : (
          <div className="records">
            {voidedHistory.map((c) => (
              <article key={c.id}>
                <b>{c.id.replace("C-", "")}</b>
                <div>
                  <h3>
                    {c.horseId} · 旧结论：{STATUS_TEXT[c.status]}
                  </h3>
                  <p>
                    判定依据：{c.reasons.length > 0 ? c.reasons.join("；") : "退赛期已过，两次步态评估正常"}
                    <br />
                    当时退赛期限：{c.withdrawalDeadline ? fmtDateTime(c.withdrawalDeadline) : "无在案用药"} · 当时步态：
                    {c.gaitWindow.length > 0
                      ? c.gaitWindow.map((g) => `${g.result} ${fmtDateTime(g.assessedAt)}`).join("，")
                      : "无"}
                    <br />
                    核对于 {fmtDateTime(c.decidedAt)} · 作废于 {c.voidedAt ? fmtDateTime(c.voidedAt) : ""} · 原因：
                    {c.voidReason}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface TreatmentFormProps {
  correcting: TreatmentRecord | null;
  onSubmit: (input: TreatmentInput) => void;
  onCancel: () => void;
}

function TreatmentForm({ correcting, onSubmit, onCancel }: TreatmentFormProps) {
  const [horseId, setHorseId] = useState(correcting?.horseId ?? "");
  const [hoof, setHoof] = useState<HoofPosition>(correcting?.hoof ?? "右前蹄");
  const [diagnosis, setDiagnosis] = useState(correcting?.diagnosis ?? "蹄底脓肿");
  const [drugClass, setDrugClass] = useState<DrugClass>(correcting?.drugClass ?? "镇痛药");
  const [drugName, setDrugName] = useState(correcting?.drugName ?? "");
  const [lastDoseAt, setLastDoseAt] = useState(() =>
    correcting ? toLocalInputValue(new Date(correcting.lastDoseAt)) : toLocalInputValue(new Date())
  );
  const [withdrawalHours, setWithdrawalHours] = useState(
    correcting ? String(correcting.withdrawalHours) : "48"
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const hours = Number(withdrawalHours);
    if (!horseId.trim() || !drugName.trim() || !lastDoseAt || !Number.isFinite(hours) || hours < 0) return;
    onSubmit({
      horseId: horseId.trim(),
      hoof,
      diagnosis: diagnosis.trim() || "蹄底脓肿",
      drugClass,
      drugName: drugName.trim(),
      lastDoseAt: new Date(lastDoseAt).toISOString(),
      withdrawalHours: hours,
    });
    if (!correcting) setDrugName("");
  };

  return (
    <form className="panel form-panel" onSubmit={submit}>
      <div className="heading">
        <div>
          <p>治疗登记</p>
          <h2>{correcting ? "更正治疗记录" : "登记治疗用药"}</h2>
        </div>
        <div className="form-actions">
          {correcting && (
            <button type="button" onClick={onCancel}>
              取消
            </button>
          )}
          <button className="primary" type="submit">
            {correcting ? "保存更正" : "保存记录"}
          </button>
        </div>
      </div>
      {correcting && (
        <p className="banner">
          正在更正 {correcting.id}（{correcting.drugName} · 末次用药 {fmtDateTime(correcting.lastDoseAt)}）。
          保存后原记录标记“已更正”，{correcting.horseId} 的原有放行作废并保留旧结论，系统按更正后的记录重新核对。
        </p>
      )}
      <div className="field-grid">
        <label>
          <span>马号</span>
          <input
            list="horse-id-options"
            value={horseId}
            onChange={(e) => setHorseId(e.target.value)}
            placeholder="如 HORSE-18"
            disabled={Boolean(correcting)}
            required
          />
        </label>
        <label>
          <span>蹄位</span>
          <select value={hoof} onChange={(e) => setHoof(e.target.value as HoofPosition)}>
            {HOOVES.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>诊断</span>
          <input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="蹄底脓肿" />
        </label>
        <label>
          <span>药物类别</span>
          <select value={drugClass} onChange={(e) => setDrugClass(e.target.value as DrugClass)}>
            {DRUG_CLASSES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>药名</span>
          <input
            value={drugName}
            onChange={(e) => setDrugName(e.target.value)}
            placeholder={DRUG_HINTS[drugClass]}
            required
          />
        </label>
        <label>
          <span>末次用药时间</span>
          <input
            type="datetime-local"
            value={lastDoseAt}
            onChange={(e) => setLastDoseAt(e.target.value)}
            required
          />
        </label>
        <label>
          <span>退赛期（小时）</span>
          <input
            type="number"
            min="0"
            step="1"
            value={withdrawalHours}
            onChange={(e) => setWithdrawalHours(e.target.value)}
            required
          />
        </label>
      </div>
    </form>
  );
}

function GaitForm({ onSubmit }: { onSubmit: (input: GaitInput) => void }) {
  const [horseId, setHorseId] = useState("");
  const [assessedAt, setAssessedAt] = useState(() => toLocalInputValue(new Date()));
  const [result, setResult] = useState<GaitResult>("正常");
  const [note, setNote] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!horseId.trim() || !assessedAt) return;
    onSubmit({
      horseId: horseId.trim(),
      assessedAt: new Date(assessedAt).toISOString(),
      result,
      note: note.trim(),
    });
    setNote("");
  };

  return (
    <form className="panel form-panel" onSubmit={submit}>
      <div className="heading">
        <div>
          <p>步态评估</p>
          <h2>登记赛前步态</h2>
        </div>
        <button className="primary" type="submit">
          保存评估
        </button>
      </div>
      <div className="field-grid">
        <label>
          <span>马号</span>
          <input
            list="horse-id-options"
            value={horseId}
            onChange={(e) => setHorseId(e.target.value)}
            placeholder="如 HORSE-31"
            required
          />
        </label>
        <label>
          <span>评估时间</span>
          <input
            type="datetime-local"
            value={assessedAt}
            onChange={(e) => setAssessedAt(e.target.value)}
            required
          />
        </label>
        <label>
          <span>步态结果</span>
          <select value={result} onChange={(e) => setResult(e.target.value as GaitResult)}>
            <option value="正常">正常</option>
            <option value="异常">异常</option>
          </select>
        </label>
        <label>
          <span>备注</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="如 右后蹄负重迟疑" />
        </label>
      </div>
      <p className="note">报名核对时取最近两次评估，两次均正常才算通过；新评估保存后该马重新核对。</p>
    </form>
  );
}
