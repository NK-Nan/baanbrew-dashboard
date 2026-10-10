// Lab 4.4 · การ์ดพยากรณ์ (รายวัน / รายสัปดาห์ + แถบช่วงคาดการณ์) และการ์ด "ควรเตรียมของเท่าไร"
// ใช้ฟังก์ชันเดิมใน forecast.js ทั้งหมด ส่วนการรวมรายสัปดาห์/แผนเตรียมของอยู่ใน forecastViews.js
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, BarChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Card, Pending, Insight, GREEN, MAIN, MUTED, INK, pct } from "./ui.jsx";
import KpiCard from "../components/KpiCard.jsx"; // ← ถ้า KpiCard อยู่ที่อื่น แก้ path บรรทัดนี้
import { fmtBaht } from "../lib/metrics.js";
import { backtest, seasonalForecast } from "../lib/analytics/forecast.js";
import { weeklyAccuracy, bandNote, prepPlan } from "../lib/analytics/forecastViews.js";

const TH_MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
/** "2026-02-16" → "16 ก.พ." (ตัดสตริงตรง ๆ ไม่ผ่าน Date จึงไม่มีปัญหาโซนเวลา) */
const fmtDay = (ymd) => `${+ymd.slice(8, 10)} ${TH_MON[+ymd.slice(5, 7) - 1]}`;
const fmtPct = (v) => (v == null ? "–" : `${v.toFixed(1)}%`);
const fmtK = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`);

function Toggle({ value, onChange }) {
  const opt = [["daily", "รายวัน"], ["weekly", "รายสัปดาห์"]];
  return (
    <div role="radiogroup" aria-label="มุมมอง" className="inline-flex rounded-lg bg-stone-100 p-0.5 text-sm">
      {opt.map(([k, label]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)}
                className={`rounded-md px-3 py-1 ${value === k ? "bg-white font-medium text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------- การ์ดพยากรณ์ ----------------
/**
 * @param series   ยอดรายวัน [{ date, revenue }] (เช่น toSeries(daily) หรือ toSeries(daily, สาขา))
 * @param horizon  จำนวนวันที่ย้อนทดสอบ (ค่าเริ่มต้น 28)
 * @param ahead    จำนวนวันที่พยากรณ์ไปข้างหน้า (ค่าเริ่มต้น 14)
 */
export function ForecastCard({ series, horizon = 28, ahead = 14 }) {
  const [view, setView] = useState("daily");
  const result = useMemo(() => {
    try {
      const bt = backtest(series, horizon);
      return { bt, acc: weeklyAccuracy(bt), future: seasonalForecast(series, ahead) };
    } catch (e) {
      return { error: e };
    }
  }, [series, horizon, ahead]);

  if (!series?.length || result.error) {
    return <Card title="พยากรณ์ยอดขาย"><Pending lab="Lab 4.4" error={result.error ?? new Error("ไม่มีข้อมูลยอดขาย")} /></Card>;
  }
  const { bt, acc, future } = result;
  const k = bt.band; // สัดส่วน เช่น 0.12

  // รายวัน: ช่วงย้อนทดสอบ (มียอดจริง) ต่อด้วยวันข้างหน้า (มีแต่ค่าพยากรณ์) · range = [ล่าง, บน] ของแถบ
  const daily = [
    ...bt.test.map((t) => ({ date: t.date, actual: t.actual, seasonal: t.seasonal, flat: t.flat, range: [t.seasonal * (1 - k), t.seasonal * (1 + k)] })),
    ...future.map((f) => ({ date: f.date, seasonal: f.forecast, range: [f.forecast * (1 - k), f.forecast * (1 + k)] })),
  ];
  const weekly = acc.weekly.map((w) => ({ ...w, label: `${fmtDay(w.from)}–${fmtDay(w.to)}${w.full ? "" : ` (${w.days} วัน)`}` }));

  return (
    <Card title="พยากรณ์ยอดขาย"
          sub={view === "daily"
            ? `ย้อนทดสอบ ${bt.test.length} วันล่าสุด แล้วพยากรณ์ต่อ ${future.length} วัน · แถบสีอ่อน = ช่วงคาดการณ์ ±${(bt.band * 100).toFixed(1)}%`
            : "รวมยอดจริงและยอดคาดการณ์เป็นรายสัปดาห์ (จันทร์–อาทิตย์) ในช่วงย้อนทดสอบ"}>
      <div className="mb-3 flex justify-end"><Toggle value={view} onChange={setView} /></div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {view === "daily" ? (
            <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#eee" />
              <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tickFormatter={fmtK} width={44} tick={{ fontSize: 12 }} />
              <Tooltip labelFormatter={fmtDay}
                       formatter={(v, n) => [Array.isArray(v) ? `${fmtBaht(v[0])} – ${fmtBaht(v[1])}` : fmtBaht(v), n]} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Area name="ช่วงคาดการณ์" dataKey="range" stroke="none" fill={GREEN[1]} fillOpacity={0.6} isAnimationActive={false} />
              <Line name="ยอดจริง" dataKey="actual" stroke={INK} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
              <Line name="พยากรณ์ (วันเดียวกันของสัปดาห์)" dataKey="seasonal" stroke={MAIN} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line name="เส้นตรง (ค่าเฉลี่ย 28 วัน)" dataKey="flat" stroke={MUTED} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            </ComposedChart>
          ) : (
            <BarChart data={weekly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tickFormatter={fmtK} width={48} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v, n) => [fmtBaht(v), n]} cursor={{ fill: "#f5f5f4" }} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar name="ยอดจริง" dataKey="actual" fill={INK} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar name="พยากรณ์ (วันเดียวกันของสัปดาห์)" dataKey="seasonal" fill={MAIN} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar name="เส้นตรง" dataKey="flat" fill={MUTED} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* MAPE รายวันเทียบรายสัปดาห์ */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="MAPE รายวัน · พยากรณ์" value={fmtPct(acc.daily.seasonal)} note={`${bt.test.length} วัน`} />
        <KpiCard label="MAPE รายสัปดาห์ · พยากรณ์" value={fmtPct(acc.weeklyMape.seasonal)}
                 note={`${acc.weeksCounted} สัปดาห์${acc.usedPartial ? " (รวมสัปดาห์ไม่ครบ)" : "ที่ครบ 7 วัน"}`} />
        <KpiCard label="MAPE รายวัน · เส้นตรง" value={fmtPct(acc.daily.flat)} />
        <KpiCard label="MAPE รายสัปดาห์ · เส้นตรง" value={fmtPct(acc.weeklyMape.flat)} />
      </div>

      <Insight>
        รายสัปดาห์คลาดเคลื่อน {fmtPct(acc.weeklyMape.seasonal)} เทียบกับรายวัน {fmtPct(acc.daily.seasonal)} เพราะวันที่ทายเกินกับทายขาดหักล้างกันเมื่อรวมทั้งสัปดาห์
        {acc.weeklyMape.flat != null && acc.daily.flat != null && acc.daily.flat > 2 * acc.weeklyMape.flat
          ? ` · เส้นตรงดูแม่นขึ้นมากเมื่อดูรายสัปดาห์ (${fmtPct(acc.weeklyMape.flat)}) แต่รายวันพลาด ${fmtPct(acc.daily.flat)} จึงใช้สั่งของหรือจัดคนรายวันไม่ได้`
          : ""}
      </Insight>

      {/* คำอธิบายที่มาของแถบช่วงคาดการณ์ */}
      <p className="mt-3 border-t border-stone-100 pt-3 text-xs leading-relaxed text-stone-500">{bandNote(bt)}</p>
    </Card>
  );
}

// ---------------- ควรเตรียมของเท่าไร ----------------
/**
 * @param series    ยอดรายวัน [{ date, revenue }] ชุดเดียวกับการ์ดพยากรณ์
 * @param abc       ผล computeAbc ในรูป { items } หรือ { error } (เหมือน d.abc ใน CustomersTab)
 * @param products  [{ product_id, price }] ใช้แปลงยอดเงินเป็นจำนวนแก้ว
 */
export function PrepCard({ series, abc, products = [], horizon = 28 }) {
  const result = useMemo(() => {
    if (!series?.length || !abc?.items) return null;
    let band = 0;
    try { band = backtest(series, horizon).band; } catch { /* ข้อมูลน้อยเกินย้อนทดสอบ → ไม่เผื่อ */ }
    return { band, plan: prepPlan(series, abc.items, products, { days: 7, band }) };
  }, [series, abc, products, horizon]);

  if (abc?.error) return <Card title="ควรเตรียมของเท่าไร"><Pending lab="Lab 4.2" error={abc.error} /></Card>;
  if (!result) return <Card title="ควรเตรียมของเท่าไร"><Pending lab="Lab 4.4" error={new Error("ยังไม่มียอดขายหรือผล ABC")} /></Card>;

  const { band, plan } = result;
  const missingPrice = plan.rows.filter((r) => r.units == null).length;

  return (
    <Card title="ควรเตรียมของเท่าไร"
          sub={`7 วันข้างหน้า (${fmtDay(plan.from)}–${fmtDay(plan.to)}) · ยอดคาดการณ์รวม ${fmtBaht(plan.total)} × สัดส่วนยอดขายของเมนูกลุ่ม A`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-stone-500">
            <tr>
              <th className="py-1 font-medium">เมนู</th>
              <th className="text-right font-medium">สัดส่วนยอด</th>
              <th className="text-right font-medium">ยอดคาดการณ์</th>
              <th className="text-right font-medium">ราคา</th>
              <th className="text-right font-medium">ควรเตรียม</th>
              <th className="text-right font-medium">เผื่อ (+{(band * 100).toFixed(0)}%)</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((r) => (
              <tr key={r.product_id} className="border-t border-stone-100">
                <td className="py-1.5">{r.name}</td>
                <td className="text-right tabular-nums">{pct(r.share, 1)}</td>
                <td className="text-right tabular-nums">{fmtBaht(r.expectedRevenue)}</td>
                <td className="text-right tabular-nums text-stone-500">{r.price == null ? "–" : fmtBaht(r.price)}</td>
                <td className="text-right font-medium tabular-nums">{r.units == null ? "–" : `${r.units.toLocaleString()} แก้ว`}</td>
                <td className="text-right tabular-nums text-stone-600">{r.unitsSafe == null ? "–" : `${r.unitsSafe.toLocaleString()} แก้ว`}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-200 text-stone-600">
              <td className="py-1.5">รวมกลุ่ม A</td>
              <td className="text-right tabular-nums">{pct(plan.shareA, 1)}</td>
              <td className="text-right tabular-nums">{fmtBaht(plan.total * plan.shareA)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
      <Insight>
        "ควรเตรียม" = ยอดคาดการณ์ของเมนู ÷ ราคา ปัดขึ้น · "เผื่อ" ใช้ขอบบนของแถบช่วงคาดการณ์ ซึ่งยอดจริงควรไม่เกินราว 9 ใน 10 วัน
        · สัดส่วนเมนูมาจากยอดขายในอดีต ถ้ามีโปรโมชันหรือเมนูใหม่ ตัวเลขจะคลาดเคลื่อน
        {missingPrice > 0 && ` · ${missingPrice} เมนูไม่พบราคาใน products จึงแสดงเฉพาะยอดเงิน`}
      </Insight>
    </Card>
  );
}
