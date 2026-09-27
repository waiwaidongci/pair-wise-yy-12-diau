/**
 * 页面层 · 治疗台账：用药登记、有效退赛窗口、治疗记录更正。
 * 只负责录入与展示，退赛窗口与更正留痕由记录层计算。
 */
import { useState } from "react";
import {
  effectiveWithdrawals,
  recordDeadline,
  type TreatmentPatch,
} from "../domain/treatments";
import {
  DRUG_CLASSES,
  HOOF_POSITIONS,
  type DrugClass,
  type HoofPosition,
  type TreatmentRecord,
} from "../domain/types";
import { formatDateTime, toLocalInputValue } from "../utils/datetime";

export interface NewTreatment {
  horseId: string;
  hoof: HoofPosition;
  drugName: string;
  drugClass: DrugClass;
  lastDoseAt: string;
  withdrawalHours: number;
}

interface Props {
  treatments: TreatmentRecord[];
  horses: string[];
  onAdd: (input: NewTreatment) => void;
  onCorrect: (recordId: string, patch: TreatmentPatch, note: string) => void;
}

interface FormState {
  horseId: string;
  hoof: HoofPosition;
  drugName: string;
  drugClass: DrugClass;
  lastDoseAt: string; // datetime-local
  withdrawalHours: string;
}

function blankForm(): FormState {
  return {
    horseId: "",
    hoof: "左前蹄",
    drugName: "",
    drugClass: "镇痛药",
    lastDoseAt: toLocalInputValue(new Date()),
    withdrawalHours: "72",
  };
}

const HOUR_MS = 3_600_000;

export default function TreatmentLedger({ treatments, horses, onAdd, onCorrect }: Props) {
  const [form, setForm] = useState<FormState>(blankForm);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(blankForm);
  const [editNote, setEditNote] = useState("");
  const now = new Date();

  const submit = () => {
    if (!form.horseId.trim()) return setError("请填写马号");
    if (!form.drugName.trim()) return setError("请填写药名");
    if (!form.lastDoseAt) return setError("请选择末次用药时间");
    const hours = Number(form.withdrawalHours);
    if (!Number.isFinite(hours) || hours <= 0) return setError("退赛期需为正数小时");
    onAdd({
      horseId: form.horseId.trim(),
      hoof: form.hoof,
      drugName: form.drugName.trim(),
      drugClass: form.drugClass,
      lastDoseAt: new Date(form.lastDoseAt).toISOString(),
      withdrawalHours: hours,
    });
    setForm(blankForm());
    setError("");
  };

  const editingRecord = treatments.find((t) => t.id === editingId) ?? null;

  const startEdit = (record: TreatmentRecord) => {
    setEditingId(record.id);
    setEditForm({
      horseId: record.horseId,
      hoof: record.hoof,
      drugName: record.drugName,
      drugClass: record.drugClass,
      lastDoseAt: toLocalInputValue(new Date(record.lastDoseAt)),
      withdrawalHours: String(record.withdrawalHours),
    });
    setEditNote("");
  };

  const submitEdit = () => {
    if (!editingId) return;
    const hours = Number(editForm.withdrawalHours);
    if (!Number.isFinite(hours) || hours <= 0 || !editForm.lastDoseAt) return;
    onCorrect(
      editingId,
      {
        hoof: editForm.hoof,
        drugName: editForm.drugName.trim(),
        drugClass: editForm.drugClass,
        lastDoseAt: new Date(editForm.lastDoseAt).toISOString(),
        withdrawalHours: hours,
      },
      editNote.trim() || "兽医更正"
    );
    setEditingId(null);
  };

  const sorted = [...treatments].sort(
    (a, b) => Date.parse(b.lastDoseAt) - Date.parse(a.lastDoseAt)
  );
  const windows = horses.flatMap((h) => effectiveWithdrawals(treatments, h));

  return (
    <>
      <section className="panel">
        <div className="heading">
          <div>
            <p>蹄底脓肿治疗 · 记录层</p>
            <h2>用药登记</h2>
          </div>
          <button className="primary" onClick={submit}>
            保存治疗记录
          </button>
        </div>
        <div className="field-grid">
          <label>
            <span>马号</span>
            <input
              list="horse-list"
              value={form.horseId}
              onChange={(e) => setForm({ ...form, horseId: e.target.value })}
              placeholder="如 HORSE-35"
            />
            <datalist id="horse-list">
              {horses.map((h) => (
                <option key={h} value={h} />
              ))}
            </datalist>
          </label>
          <label>
            <span>蹄位</span>
            <select
              value={form.hoof}
              onChange={(e) => setForm({ ...form, hoof: e.target.value as HoofPosition })}
            >
              {HOOF_POSITIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            <span>药名</span>
            <input
              value={form.drugName}
              onChange={(e) => setForm({ ...form, drugName: e.target.value })}
              placeholder="如 氟尼辛葡甲胺"
            />
          </label>
          <label>
            <span>药物类别</span>
            <select
              value={form.drugClass}
              onChange={(e) => setForm({ ...form, drugClass: e.target.value as DrugClass })}
            >
              {DRUG_CLASSES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <span>末次用药时间</span>
            <input
              type="datetime-local"
              value={form.lastDoseAt}
              onChange={(e) => setForm({ ...form, lastDoseAt: e.target.value })}
            />
          </label>
          <label>
            <span>退赛期（小时）</span>
            <input
              type="number"
              min="1"
              value={form.withdrawalHours}
              onChange={(e) => setForm({ ...form, withdrawalHours: e.target.value })}
            />
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <p className="muted">
          保存或更正治疗记录后，该马原有参赛放行一律作废，需重新核对才能报名。
        </p>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>同类药再用按更晚时间延长</p>
            <h2>各马有效退赛窗口</h2>
          </div>
        </div>
        <table className="ledger">
          <thead>
            <tr>
              <th>马号</th>
              <th>药物类别</th>
              <th>用药次数</th>
              <th>有效退赛截止</th>
              <th>当前状态</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((w) => {
              const remainMs = w.deadline - now.getTime();
              return (
                <tr key={`${w.horseId}-${w.drugClass}`}>
                  <td>{w.horseId}</td>
                  <td>{w.drugClass}</td>
                  <td>
                    {w.recordCount}
                    {w.recordCount > 1 && <span className="muted">（同类再用，已按更晚时间延长）</span>}
                  </td>
                  <td>{formatDateTime(w.deadline)}</td>
                  <td>
                    {remainMs <= 0 ? (
                      <span className="badge ok">已到期</span>
                    ) : (
                      <span className="badge hold">
                        未到期 · 还剩 {Math.ceil(remainMs / HOUR_MS)} 小时
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>蹄底脓肿治疗台账</p>
            <h2>治疗记录</h2>
          </div>
        </div>
        <table className="ledger">
          <thead>
            <tr>
              <th>马号</th>
              <th>蹄位</th>
              <th>药名</th>
              <th>类别</th>
              <th>末次用药</th>
              <th>退赛期</th>
              <th>退赛截止</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                <td>{r.horseId}</td>
                <td>{r.hoof}</td>
                <td>{r.drugName}</td>
                <td>{r.drugClass}</td>
                <td>{formatDateTime(r.lastDoseAt)}</td>
                <td>{r.withdrawalHours} 小时</td>
                <td>{formatDateTime(recordDeadline(r))}</td>
                <td>
                  <button onClick={() => startEdit(r)}>更正</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {editingRecord && (
        <section className="panel edit-panel">
          <div className="heading">
            <div>
              <p>更正治疗记录 · 原放行将作废并保留旧结论</p>
              <h2>
                {editingRecord.horseId} · 记录 {editingRecord.id}
              </h2>
            </div>
            <div className="actions">
              <button onClick={() => setEditingId(null)}>取消</button>
              <button className="primary" onClick={submitEdit}>
                保存更正
              </button>
            </div>
          </div>
          <div className="field-grid">
            <label>
              <span>蹄位</span>
              <select
                value={editForm.hoof}
                onChange={(e) => setEditForm({ ...editForm, hoof: e.target.value as HoofPosition })}
              >
                {HOOF_POSITIONS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              <span>药名</span>
              <input
                value={editForm.drugName}
                onChange={(e) => setEditForm({ ...editForm, drugName: e.target.value })}
              />
            </label>
            <label>
              <span>药物类别</span>
              <select
                value={editForm.drugClass}
                onChange={(e) =>
                  setEditForm({ ...editForm, drugClass: e.target.value as DrugClass })
                }
              >
                {DRUG_CLASSES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              <span>末次用药时间</span>
              <input
                type="datetime-local"
                value={editForm.lastDoseAt}
                onChange={(e) => setEditForm({ ...editForm, lastDoseAt: e.target.value })}
              />
            </label>
            <label>
              <span>退赛期（小时）</span>
              <input
                type="number"
                min="1"
                value={editForm.withdrawalHours}
                onChange={(e) => setEditForm({ ...editForm, withdrawalHours: e.target.value })}
              />
            </label>
            <label>
              <span>更正说明</span>
              <input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="如 兽医复核后延长退赛期"
              />
            </label>
          </div>
        </section>
      )}
    </>
  );
}
