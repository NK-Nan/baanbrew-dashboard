// Lab 3.1 · แปลงแถวจาก sales.csv (ผลลัพธ์ Lab 2.1) เป็นเอกสาร Firestore
// ใช้ AI เขียนฟังก์ชันในไฟล์นี้ (Prompt 3.1 ใน PROMPTS_LAB3.md) จนกว่า npm test จะผ่านทุกข้อ
// scripts/seed.mjs เรียกใช้ฟังก์ชันเหล่านี้ ไม่ต้องแก้ seed.mjs
import { addDays, daysBetween } from "../src/lab3/time.js";

export const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];

// รูปแบบ datetime ที่ยอมรับ: 20YY-MM-DDTHH:MM:SS+07:00 (ปี ค.ศ. และเวลาไทยเท่านั้น)
// แยกส่วนวันที่ (กลุ่ม 1) กับส่วนเวลา+เขตเวลา (กลุ่ม 2) ไว้ใช้ตอนเลื่อนวัน
const DATETIME_RE = /^(20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))(T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\+07:00)$/;
const POS_INT_RE = /^[1-9]\d*$/;           // จำนวนเต็มบวก ไม่มีเลข 0 นำหน้า
const POS_NUM_RE = /^\d+(?:\.\d+)?$/;      // ตัวเลขล้วน มีทศนิยมได้ ไม่มีหน่วยหรือจุลภาค

const text = (v) => String(v ?? "").trim();

/** แยกส่วนวันที่และเวลาจาก datetime · throw ถ้าไม่ตรงรูปแบบ */
function parseDateTime(iso) {
  const m = DATETIME_RE.exec(text(iso));
  if (!m) throw new Error(`datetime ไม่ใช่รูปแบบ 20YY-MM-DDTHH:MM:SS+07:00: "${iso}"`);
  return { date: m[1], rest: m[2] };
}

/** ดึงวันที่ YYYY-MM-DD จาก datetime โดยตัดสตริง (ไม่ผ่าน Date จึงไม่กลายเป็น UTC) */
const dateOf = (iso) => parseDateTime(iso).date;

/**
 * เลือกเฉพาะ N วันล่าสุดของข้อมูล นับจากวันล่าสุดในไฟล์ (ไม่ใช่วันนี้) รวมวันสุดท้ายด้วย
 * @returns {{ rows: object[], start: string, end: string }}  start/end เป็น YYYY-MM-DD
 */
export function selectLastDays(rows, days) {
  if (!Number.isInteger(days) || days < 1) throw new Error(`days ต้องเป็นจำนวนเต็มบวก: ${days}`);
  if (!rows.length) throw new Error("ไม่มีข้อมูลให้เลือก");

  // วันที่รูปแบบ YYYY-MM-DD เทียบแบบสตริงได้ตรงกับลำดับเวลา
  const dates = rows.map((r) => dateOf(r.datetime));
  const end = dates.reduce((max, d) => (d > max ? d : max));
  const start = addDays(end, -(days - 1)); // รวมวันสุดท้าย: 3 วัน = end-2 ถึง end

  return {
    rows: rows.filter((_, i) => dates[i] >= start && dates[i] <= end),
    start,
    end,
  };
}

/** จำนวนวันที่ต้องเลื่อน ให้วันล่าสุดของข้อมูลกลายเป็น "เมื่อวาน" ของ today · ห้ามติดลบ */
export function computeShift(lastDataDate, today) {
  const yesterday = addDays(today, -1);
  return Math.max(0, daysBetween(lastDataDate, yesterday));
}

/** เลื่อนวันที่ใน datetime ("2026-09-20T16:05:09+07:00") ไป days วัน โดยคงเวลาและ +07:00 */
export function shiftDateTime(iso, days) {
  const { date, rest } = parseDateTime(iso);
  if (!days) return `${date}${rest}`;
  return `${addDays(date, days)}${rest}`; // เปลี่ยนเฉพาะส่วนวันที่ ส่วนเวลาและ +07:00 ต่อท้ายเหมือนเดิม
}

/**
 * แปลง 1 แถว CSV (ทุกค่าเป็นข้อความ) เป็น { id, data }
 * id = order_id + "-" + product_id
 * data มีฟิลด์: order_id, datetime, date, hour, branch, product_id, qty, unit_price, revenue,
 *               customer_id (ว่าง = null), payment_method, channel, source = "import"
 * ต้อง throw Error ถ้าข้อมูลยังไม่สะอาด: qty ไม่ใช่จำนวนเต็มบวก, ราคาไม่ใช่ตัวเลขบวก,
 * สาขาไม่อยู่ใน BRANCHES, datetime ไม่ใช่ 20YY-MM-DDTHH:MM:SS+07:00
 */
export function toSaleDoc(row, shiftDays = 0) {
  const orderId = text(row.order_id);
  const productId = text(row.product_id);
  const ref = `${orderId || "?"}-${productId || "?"}`; // ใช้ในข้อความ error ให้หาแถวที่ผิดได้
  if (!orderId || !productId) throw new Error(`แถว ${ref}: ไม่มี order_id หรือ product_id`);

  const qtyText = text(row.qty);
  if (!POS_INT_RE.test(qtyText)) throw new Error(`แถว ${ref}: qty ไม่ใช่จำนวนเต็มบวก "${row.qty}"`);
  const qty = Number(qtyText);

  const priceText = text(row.unit_price);
  const unitPrice = Number(priceText);
  if (!POS_NUM_RE.test(priceText) || !(unitPrice > 0)) {
    throw new Error(`แถว ${ref}: unit_price ไม่ใช่ตัวเลขบวก "${row.unit_price}"`);
  }

  const branch = text(row.branch);
  if (!BRANCHES.includes(branch)) throw new Error(`แถว ${ref}: ไม่รู้จักสาขา "${row.branch}"`);

  const datetime = shiftDateTime(row.datetime, shiftDays); // throw เองถ้ารูปแบบผิด
  const { date, rest } = parseDateTime(datetime);
  const hour = Number(rest.slice(1, 3)); // "T16:05:09+07:00" → 16 (ชั่วโมงตามเวลาไทย)

  const customerId = text(row.customer_id);

  return {
    id: `${orderId}-${productId}`,
    data: {
      order_id: orderId,
      datetime,
      date,
      hour,
      branch,
      product_id: productId,
      qty,
      unit_price: unitPrice,
      revenue: Math.round(qty * unitPrice * 100) / 100, // ปัดเป็นสตางค์ กันทศนิยมลอยตัว
      customer_id: customerId === "" ? null : customerId,
      payment_method: text(row.payment_method),
      channel: text(row.channel),
      source: "import",
    },
  };
}

/** สรุป: { docs, bills (นับ order_id ไม่ซ้ำ), revenue, byBranch: {สาขา: ยอด}, start, end } */
export function summarize(docs) {
  const bills = new Set();
  const byBranchSatang = {};
  let revenueSatang = 0; // รวมเป็นสตางค์ (จำนวนเต็ม) แล้วค่อยแปลงกลับ ยอดจะตรงกับ Firestore
  let start = null;
  let end = null;

  for (const { data } of docs) {
    const satang = Math.round(data.revenue * 100);
    bills.add(data.order_id);
    revenueSatang += satang;
    byBranchSatang[data.branch] = (byBranchSatang[data.branch] ?? 0) + satang;
    if (start === null || data.date < start) start = data.date;
    if (end === null || data.date > end) end = data.date;
  }

  return {
    docs: docs.length,
    bills: bills.size,
    revenue: revenueSatang / 100,
    byBranch: Object.fromEntries(Object.entries(byBranchSatang).map(([b, s]) => [b, s / 100])),
    start,
    end,
  };
}
