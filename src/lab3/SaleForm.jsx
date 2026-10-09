// Lab 3.2 · ฟอร์มบันทึกยอดขาย → เขียนลง Firestore collection "sales"
// ตรวจด้วย validateSaleForm และสร้างเอกสารด้วย buildSale (โครงสร้างเดียวกับข้อมูลที่ import ใน Lab 3.1)
// เมนู (products) โหลดครั้งเดียวใน LiveTab แล้วส่งเข้ามาเป็น props
import { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";
import { BRANCHES, PAYMENTS, MAX_QTY, validateSaleForm, buildSale } from "./saleModel.js";
import { fmtBaht } from "../lib/metrics.js";

const EMPTY = { branch: "", product_id: "", qty: "1", payment_method: PAYMENTS[0], customer_id: "" };
const FIELD =
  "mt-1 w-full rounded-lg border bg-white px-3 py-2 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600/30 disabled:bg-stone-50";

function FieldError({ text }) {
  return text ? <p className="mt-1 text-xs text-red-700">{text}</p> : null;
}

/** ข้อความเมื่อบันทึกไม่สำเร็จ */
function saveErrorText(err) {
  if (err?.code === "permission-denied") {
    return "ถูกปฏิเสธโดย Security Rules ตรวจว่า Rules อนุญาตให้เขียน collection sales และข้อมูลผ่านเงื่อนไข";
  }
  if (err?.code === "unavailable") return "บันทึกไม่สำเร็จ: เชื่อมต่อ Firestore ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่";
  return `บันทึกไม่สำเร็จ: ${err?.message ?? String(err)}`;
}

/**
 * @param {{ uid: string, products: object[] | null, productsError?: string }} props
 *   uid = user.uid ของผู้ที่ล็อกอิน (บันทึกเป็น created_by) · products = null ระหว่างโหลด
 */
export default function SaleForm({ uid, products, productsError = "" }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null); // { type: "ok" | "error", text }
  const [busy, setBusy] = useState(false);

  const list = products ?? [];
  const product = list.find((p) => p.product_id === form.product_id);
  const qtyText = form.qty.trim();
  const qtyOk = /^\d+$/.test(qtyText) && Number(qtyText) >= 1 && Number(qtyText) <= MAX_QTY;
  const disabled = busy || !uid || !products || !!productsError;

  // แก้ช่องไหน ลบ error ของช่องนั้นทันที
  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((errs) => {
      if (!errs[key]) return errs;
      const { [key]: _removed, ...rest } = errs;
      return rest;
    });
  };

  async function submit(e) {
    e.preventDefault();
    if (busy) return; // กันกดซ้ำ

    const errs = validateSaleForm(form, list);
    setErrors(errs);
    setStatus(null);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const { id, data } = buildSale(form, product, { uid });
      await setDoc(doc(db, "sales", id), { ...data, created_at: serverTimestamp() });
      setStatus({ type: "ok", text: `บันทึกแล้ว ${data.order_id} · ${fmtBaht(data.revenue)}` });
      // จำสาขาและวิธีชำระเงินไว้ เพราะพนักงานมักบันทึกต่อเนื่องที่สาขาเดิม
      setForm((f) => ({ ...EMPTY, branch: f.branch, payment_method: f.payment_method }));
    } catch (err) {
      setStatus({ type: "error", text: saveErrorText(err) });
    } finally {
      setBusy(false);
    }
  }

  const border = (key) => (errors[key] ? "border-red-400" : "border-stone-300");

  return (
    <form onSubmit={submit} noValidate className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
      <h2 className="text-lg font-semibold">บันทึกยอดขาย</h2>
      <p className="mb-3 text-sm text-stone-500">กดบันทึกแล้วดูตัวเลขและกราฟทางซ้ายขยับเอง</p>

      {productsError && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">{productsError}</p>
      )}

      <fieldset disabled={disabled} className="space-y-3">
        <label className="block text-sm font-medium">
          สาขา
          <select className={`${FIELD} ${border("branch")}`} value={form.branch} onChange={set("branch")}>
            <option value="">เลือกสาขา</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <FieldError text={errors.branch} />
        </label>

        <label className="block text-sm font-medium">
          เมนู
          <select className={`${FIELD} ${border("product_id")}`} value={form.product_id} onChange={set("product_id")}>
            <option value="">{products ? "เลือกเมนู" : "กำลังโหลดเมนู…"}</option>
            {list.map((p) => (
              <option key={p.product_id} value={p.product_id}>
                {p.product_name} · {fmtBaht(Number(p.price))}
              </option>
            ))}
          </select>
          <FieldError text={errors.product_id} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            จำนวน
            <input type="number" min="1" max={MAX_QTY} step="1" inputMode="numeric"
                   className={`${FIELD} ${border("qty")}`} value={form.qty} onChange={set("qty")} />
            <FieldError text={errors.qty} />
          </label>
          <label className="block text-sm font-medium">
            วิธีชำระเงิน
            <select className={`${FIELD} ${border("payment_method")}`} value={form.payment_method} onChange={set("payment_method")}>
              {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <FieldError text={errors.payment_method} />
          </label>
        </div>

        <label className="block text-sm font-medium">
          รหัสสมาชิก <span className="font-normal text-stone-400">(ไม่บังคับ)</span>
          <input className={`${FIELD} ${border("customer_id")}`} placeholder="C01234" autoComplete="off"
                 value={form.customer_id} onChange={set("customer_id")} />
          <FieldError text={errors.customer_id} />
        </label>
      </fieldset>

      <div className="mt-4 flex items-baseline justify-between border-t border-stone-100 pt-3">
        <span className="text-sm text-stone-500">
          ยอดรวม{product && qtyOk ? ` (${qtyText} × ${fmtBaht(Number(product.price))})` : ""}
        </span>
        <span className="text-2xl font-semibold tabular-nums">
          {product && qtyOk ? fmtBaht(Number(product.price) * Number(qtyText)) : "–"}
        </span>
      </div>

      <button type="submit" disabled={disabled}
              className="mt-3 w-full rounded-lg bg-amber-700 py-2.5 font-medium text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? "กำลังบันทึก…" : "บันทึกยอดขาย"}
      </button>

      {status && (
        <p role="status"
           className={`mt-3 rounded-lg px-3 py-2 text-sm ${status.type === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {status.type === "ok" ? "✅ " : "❌ "}{status.text}
        </p>
      )}
    </form>
  );
}
