// Lab 3.2 · ตรวจฟอร์มและสร้างเอกสารยอดขายใหม่
// ใช้ AI เขียนฟังก์ชันในไฟล์นี้ (Prompt 3.2A) จนกว่า npm test จะผ่านทุกข้อ
// เอกสารที่ได้ต้องมีโครงสร้างเดียวกับข้อมูลที่ import ใน Lab 3.1 เพื่อให้ metrics.js จาก Lab 1 ใช้ต่อได้
import { nowBangkokISO } from "./time.js";

export const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];
export const PAYMENTS = ["QR พร้อมเพย์", "บัตรเครดิต", "เงินสด", "LINE MAN", "Grab"];
export const MAX_QTY = 20;

const DELIVERY_PAYMENTS = ["LINE MAN", "Grab"];
const QTY_RE = /^\d+$/;               // ตัวเลขล้วน ไม่มีจุด ไม่มีเครื่องหมายลบ
const CUSTOMER_RE = /^C\d{5}$/i;       // C + 5 หลัก รับตัวพิมพ์เล็ก
const ID_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
// "2026-09-27T03:30:05+07:00" → วันที่ / ชั่วโมง / นาที / วินาที
const BKK_ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\+07:00$/;

const text = (v) => String(v ?? "").trim();

/** ทำรหัสสมาชิกให้เป็นรูปแบบเดียว: ตัดช่องว่าง + ตัวพิมพ์ใหญ่ · ว่าง = null */
const normalizeCustomerId = (v) => {
  const s = text(v).toUpperCase();
  return s === "" ? null : s;
};

/** แยกเวลาไทยจาก nowBangkokISO เป็นส่วน ๆ (ใช้ร่วมกันทั้งเลขบิลและฟิลด์วันที่) */
function bangkokParts(now) {
  const iso = nowBangkokISO(now);
  const m = BKK_ISO_RE.exec(iso);
  if (!m) throw new Error(`nowBangkokISO คืนรูปแบบที่ไม่รู้จัก: "${iso}"`);
  const [, y, mo, d, h, mi, s] = m;
  return { iso, date: `${y}-${mo}-${d}`, hour: Number(h), compact: { ymd: `${y}${mo}${d}`, hms: `${h}${mi}${s}` } };
}

/**
 * ตรวจฟอร์ม { branch, product_id, qty, payment_method, customer_id } (ค่าเป็นข้อความจาก input)
 * คืน {} ถ้าถูกต้อง หรือ { ชื่อฟิลด์: ข้อความภาษาไทย } ถ้าผิด
 */
export function validateSaleForm(form, products) {
  const errors = {};

  if (!BRANCHES.includes(text(form.branch))) errors.branch = "กรุณาเลือกสาขา";

  const productId = text(form.product_id);
  if (!productId) errors.product_id = "กรุณาเลือกเมนู";
  else if (!(products ?? []).some((p) => p.product_id === productId)) errors.product_id = "ไม่พบเมนูนี้";

  const qtyText = text(form.qty);
  const qty = Number(qtyText);
  if (qtyText === "") errors.qty = "กรุณาใส่จำนวน";
  else if (!QTY_RE.test(qtyText) || qty < 1 || qty > MAX_QTY) {
    errors.qty = `จำนวนต้องเป็นจำนวนเต็ม 1–${MAX_QTY}`;
  }

  if (!PAYMENTS.includes(text(form.payment_method))) errors.payment_method = "กรุณาเลือกวิธีชำระเงิน";

  const customerId = text(form.customer_id);
  if (customerId !== "" && !CUSTOMER_RE.test(customerId)) {
    errors.customer_id = "รหัสสมาชิกต้องเป็น C ตามด้วยตัวเลข 5 หลัก เช่น C01234 (เว้นว่างได้ถ้าไม่ใช่สมาชิก)";
  }

  return errors;
}

/** เลขบิลจากเวลาไทย รูปแบบ WEB-YYYYMMDD-HHMMSS-XXXX (XXXX = ตัวเลข/อักษรพิมพ์ใหญ่สุ่ม 4 ตัว) */
export function makeOrderId(now = new Date(), rand = Math.random) {
  const { ymd, hms } = bangkokParts(now).compact;
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    // Math.min กันกรณี rand() คืน 1 พอดี ซึ่งจะเกินขอบอาร์เรย์
    suffix += ID_CHARS[Math.min(ID_CHARS.length - 1, Math.floor(rand() * ID_CHARS.length))];
  }
  return `WEB-${ymd}-${hms}-${suffix}`;
}

/**
 * สร้าง { id, data } จากฟอร์มที่ผ่านการตรวจแล้ว
 * - ราคามาจาก product.price เสมอ · revenue = qty × ราคา · ตัวเลขทุกตัวเป็น number
 * - datetime/date/hour เป็นเวลาไทย (ใช้ nowBangkokISO)
 * - channel = "เดลิเวอรี" ถ้าจ่ายด้วย LINE MAN หรือ Grab ไม่งั้น "หน้าร้าน"
 * - source = "web", created_by = uid · ยังไม่ต้องใส่ created_at (ใส่ตอนบันทึกด้วย serverTimestamp())
 */
export function buildSale(form, product, { uid, now = new Date(), rand = Math.random }) {
  if (!uid) throw new Error("ต้องเข้าสู่ระบบก่อนบันทึกยอดขาย");
  if (!product) throw new Error("ไม่พบเมนู");

  const qty = Number(text(form.qty));
  const unitPrice = Number(product.price); // ไม่ใช้ราคาจากฟอร์ม กันการแก้ราคาจากฝั่งผู้ใช้
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error(`ราคาเมนู ${product.product_id} ไม่ถูกต้อง`);

  const { iso, date, hour } = bangkokParts(now);
  const orderId = makeOrderId(now, rand); // ใช้ now ตัวเดียวกัน เลขบิลกับ datetime จึงตรงกันเสมอ
  const paymentMethod = text(form.payment_method);

  return {
    id: `${orderId}-${product.product_id}`, // รูปแบบเดียวกับ Lab 3.1
    data: {
      order_id: orderId,
      datetime: iso,
      date,
      hour,
      branch: text(form.branch),
      product_id: product.product_id,
      qty,
      unit_price: unitPrice,
      revenue: Math.round(qty * unitPrice * 100) / 100,
      customer_id: normalizeCustomerId(form.customer_id),
      payment_method: paymentMethod,
      channel: DELIVERY_PAYMENTS.includes(paymentMethod) ? "เดลิเวอรี" : "หน้าร้าน",
      source: "web",
      created_by: uid,
    },
  };
}
