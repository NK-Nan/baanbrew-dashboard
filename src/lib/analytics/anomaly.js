// Lab 4.5 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.5A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.5 · หาวันที่ยอดขายผิดปกติ
// เทียบกับ "ค่ากลางของวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ก่อน" ไม่ใช่ค่าเฉลี่ย 28 วัน
// เพราะสาขาออฟฟิศกับห้างขายวันธรรมดาและเสาร์-อาทิตย์ต่างกันมาก
import { addDays } from "../../lab3/time.js";

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

/**
 * คะแนนความผิดปกติ = ln((จริง + SMOOTH) / (คาดหวัง + SMOOTH))
 * SMOOTH กันไม่ให้วันยอดน้อย ๆ (เช่น 50 บาท เทียบ 100 บาท) ดูผิดปกติเกินจริง
 * @param daily    [{ date, branch, revenue }] จาก dailyByBranch()
 * @param holidays { "YYYY-MM-DD": "ชื่อวันหยุด" } วันหยุดจะไม่ถูกจัดอันดับ แต่ติดป้ายไว้
 * @returns ทุกวันที่คำนวณได้ เรียงจากผิดปกติมากไปน้อย:
 *   { date, branch, actual, expected, change (สัดส่วน เช่น -0.9 = ต่ำกว่าปกติ 90%), score, holiday }
 */
export function scoreAnomalies(daily, holidays = {}, { weeks = 8, minWeeks = 4, smooth = 1000 } = {}) {
  // 1) ยอดรายวันแยกตามสาขา: branch -> Map(date -> revenue) · ถ้ามีหลายแถววันเดียวกันให้รวมกัน
  const byBranch = new Map();
  for (const r of daily) {
    if (!byBranch.has(r.branch)) byBranch.set(r.branch, new Map());
    const m = byBranch.get(r.branch);
    m.set(r.date, (m.get(r.date) ?? 0) + (Number(r.revenue) || 0));
  }

  const out = [];
  for (const [branch, m] of byBranch) {
    for (const [date, actual] of m) {
      // 2) ยอดของวันเดียวกันของสัปดาห์ ย้อนหลัง 1..weeks สัปดาห์ (ย้อนทีละ 7 วันจึงได้วันในสัปดาห์เดียวกันเสมอ)
      //    วันที่ไม่มีข้อมูล (ยังไม่เปิดสาขา/ไม่มีในชุดข้อมูล) ไม่นับ ไม่ถือว่าเป็น 0
      const past = [];
      for (let k = 1; k <= weeks; k++) {
        const v = m.get(addDays(date, -7 * k));
        if (v !== undefined) past.push(v);
      }
      if (past.length < minWeeks) continue; // ประวัติไม่พอ ยังให้คะแนนไม่ได้

      // 3) ค่าคาดหวัง = median ไม่ใช่ค่าเฉลี่ย เพื่อให้วันผิดปกติในอดีต (เช่นไฟดับ) ไม่ดึงค่าคาดหวังเพี้ยน
      const expected = median(past);
      out.push({
        date,
        branch,
        actual,
        expected,
        change: expected ? actual / expected - 1 : null, // คาดหวัง 0 → คิดเป็นสัดส่วนไม่ได้
        score: Math.log((actual + smooth) / (expected + smooth)),
        holiday: holidays[date] ?? null,
      });
    }
  }

  // 4) เรียงจากผิดปกติมากไปน้อย (ทั้งสูงและต่ำกว่าปกติ) · เท่ากันให้วันใหม่กว่ามาก่อน
  return out.sort(
    (a, b) => Math.abs(b.score) - Math.abs(a.score) || b.date.localeCompare(a.date) || String(a.branch).localeCompare(String(b.branch))
  );
}

/** อันดับวันผิดปกติที่ควรตรวจสอบ (ไม่รวมวันหยุด) */
export function topAnomalies(daily, holidays = {}, n = 15, opts) {
  return scoreAnomalies(daily, holidays, opts).filter((a) => !a.holiday).slice(0, n);
}
