// Lab 2.2 · กราฟที่ซ่อมแล้ว (เทียบซ้าย-ขวากับ BadCharts.jsx)
// หลัก: คำถาม → ตัวชี้วัดที่ยุติธรรม → กราฟที่อ่านง่ายที่สุด → ข้อสรุปที่คำนวณจากข้อมูลจริง
// ทุกตัวเลข วันที่ และชื่อในข้อความคำนวณจาก rows ไม่มีค่าตายตัว
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, LabelList, Cell,
} from "recharts";
import {
  revenueByProduct, monthlyRevenue, branchPerformance, weeklyRevenue, daysInMonth, thaiMonth,
} from "./lab2Metrics.js";
import { fmtBaht, fmtShortBaht } from "../lib/metrics.js";

const MAIN = "#2F7D5B";   // สีหลักสีเดียว
const MUTED = "#B8C9BF";  // สีเดียวกันแบบจาง ใช้บอกว่า "ข้อมูลไม่ครบ" เท่านั้น
const INK = "#44403c";
const GRID = "#eee";
const TICK = { fontSize: 12, fill: "#78716c" };

const pct = (x, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const thaiDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

/** กรอบกราฟ: ข้อสรุป 1 บรรทัดด้านบน กราฟ และหมายเหตุ (ถ้ามี) ด้านล่าง */
function Frame({ takeaway, note, children }) {
  return (
    <div className="flex h-full flex-col gap-1">
      <p className="text-sm font-semibold text-stone-800">{takeaway}</p>
      <div className="min-h-0 flex-1">{children}</div>
      {note && <p className="text-xs text-stone-500">{note}</p>}
    </div>
  );
}

/** ขีดแกนตัวเลขกลม ๆ เริ่มที่ 0 (1/2/2.5/5 × 10^n) เช่น 0, 250K, 500K … */
function niceTicks(max, count = 5) {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((x) => x >= raw);
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

const Empty = () => <Frame takeaway="ยังไม่มีข้อมูล" />;

/** วันแรกที่แต่ละสาขามียอดขาย → หาสาขาที่เปิดทีหลัง (ไม่พิมพ์ชื่อ/วันที่ตายตัว) */
function branchOpenings(rows) {
  const first = new Map();
  for (const r of rows) if (!first.has(r.branch) || r.date < first.get(r.branch)) first.set(r.branch, r.date);
  const start = [...first.values()].sort()[0];
  return [...first].filter(([, d]) => d > start).map(([branch, date]) => ({ branch, date }));
}

// ---------------------------------------------------------------------------
/** 1) Pie 40 ชิ้นสีรุ้ง → แท่งแนวนอน 10 อันดับแรก สีเดียว ป้ายบอก ฿ และ % */
export function FixedChart1({ rows, products }) {
  const all = useMemo(() => revenueByProduct(rows, products), [rows, products]);
  if (!all.length) return <Empty />;
  const top = all.slice(0, 10).map((d) => ({ ...d, label: `${fmtBaht(d.revenue)} · ${pct(d.share)}` }));
  const topShare = top.reduce((s, d) => s + d.share, 0);
  return (
    <Frame
      takeaway={`${top[0].name} ทำเงินสูงสุด ${fmtBaht(top[0].revenue)} (${pct(top[0].share)}) · ${top.length} อันดับแรกรวมกัน ${pct(topShare, 0)} ของยอดขาย`}
      note={all.length > top.length ? `อีก ${all.length - top.length} เมนูรวมกัน ${fmtBaht(all.slice(top.length).reduce((s, d) => s + d.revenue, 0))} (${pct(1 - topShare, 0)})` : null}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ top: 4, right: 150, left: 0, bottom: 0 }}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis type="category" dataKey="name" width={150} tick={TICK} interval={0} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v, _n, item) => [`${fmtBaht(v)} (${pct(item.payload.share)})`, "ยอดขาย"]} />
          <Bar dataKey="revenue" fill={MAIN} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="label" position="right" style={{ fontSize: 11, fill: INK }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
/** 2) แกนตัดที่ 500K + สีรุ้ง + เรียงตามตัวอักษร → แกนเริ่ม 0 สีเดียว เรียงมากไปน้อย */
export function FixedChart2({ rows }) {
  const data = useMemo(() => branchPerformance(rows).sort((a, b) => b.revenue - a.revenue), [rows]);
  if (!data.length) return <Empty />;
  const hi = data[0];
  const lo = data[data.length - 1];
  const maxDays = Math.max(...data.map((d) => d.days));
  const shortOpen = data.filter((d) => d.days < maxDays * 0.9); // เปิดขายน้อยกว่าสาขาอื่นชัดเจน
  const yTicks = niceTicks(hi.revenue);
  return (
    <Frame
      takeaway={`${hi.branch} ยอดรวมสูงสุด ${fmtBaht(hi.revenue)} · ${(hi.revenue / lo.revenue).toFixed(1)} เท่าของ${lo.branch} (${fmtBaht(lo.revenue)})`}
      note={shortOpen.length
        ? `ยอดรวมทั้งช่วงข้อมูล · ${shortOpen.map((d) => `${d.branch}มีข้อมูล ${d.days.toLocaleString("th-TH")} วัน`).join(", ")} จาก ${maxDays.toLocaleString("th-TH")} วัน จึงเทียบยอดรวมตรง ๆ ไม่ได้ (ดูกราฟ 5)`
        : "ยอดรวมทั้งช่วงข้อมูล"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="branch" tick={{ ...TICK, fontSize: 13 }} axisLine={{ stroke: "#d6d3d1" }} tickLine={false} />
          <YAxis tickFormatter={fmtShortBaht} width={60} ticks={yTicks} domain={[0, yTicks.at(-1)]} tick={TICK} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v, _n, item) => [`${fmtBaht(v)} (${item.payload.days} วัน)`, "ยอดขายรวม"]} />
          <Bar dataKey="revenue" fill={MAIN} radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
            <LabelList dataKey="revenue" position="top" formatter={fmtBaht} style={{ fontSize: 12, fill: INK }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
/** 3) 538 จุด เส้นหนา วันที่เบียด → รวมเป็นรายสัปดาห์ เส้นบาง แกนเป็นเดือนภาษาไทย */
export function FixedChart3({ rows }) {
  const data = useMemo(() => weeklyRevenue(rows), [rows]);
  const openings = useMemo(() => branchOpenings(rows), [rows]);
  if (data.length < 2) return <Empty />;

  const span = Math.min(13, Math.floor(data.length / 2)); // ~3 เดือน หรือครึ่งหนึ่งถ้าข้อมูลสั้น
  const avg = (xs) => xs.reduce((s, d) => s + d.revenue, 0) / xs.length;
  const first = avg(data.slice(0, span));
  const last = avg(data.slice(-span));
  const change = last / first - 1;
  const period = span === 13 ? "3 เดือน" : `${span} สัปดาห์`;

  // ป้ายแกน X: วันจันทร์แรกของแต่ละเดือน (ทุก 3 เดือนถ้าข้อมูลยาว)
  const monthStarts = data.filter((d, i) => i === 0 || d.week.slice(0, 7) !== data[i - 1].week.slice(0, 7)).map((d) => d.week);
  const step = Math.ceil(monthStarts.length / 7);
  const ticks = monthStarts.filter((_, i) => i % step === 0);

  return (
    <Frame
      takeaway={`ยอดขายเฉลี่ยต่อสัปดาห์ ${period}ล่าสุด ${fmtBaht(last)} ${change >= 0 ? "สูงกว่า" : "ต่ำกว่า"} ${period}แรก ${pct(Math.abs(change), 0)}`}
      note={`รวมเป็นรายสัปดาห์ (จันทร์–อาทิตย์) ${data.length} สัปดาห์ ตัดสัปดาห์ที่มีข้อมูลไม่ครบ 7 วันออก`
        + openings.map((o) => ` · ${o.branch}เริ่มขาย ${thaiDate(o.date)}`).join("")}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="week" ticks={ticks} tickFormatter={(w) => thaiMonth(w.slice(0, 7))} tick={TICK}
                 axisLine={{ stroke: "#d6d3d1" }} tickLine={false} />
          <YAxis tickFormatter={fmtShortBaht} width={60} domain={[0, "auto"]} tick={TICK} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={(w) => `สัปดาห์เริ่ม ${thaiDate(w)}`} formatter={(v) => [fmtBaht(v), "ยอดขายทั้งสัปดาห์"]} />
          <Line dataKey="revenue" stroke={MAIN} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
/** 4) เดือนสุดท้ายข้อมูลไม่ครบแต่ถูกป้ายว่า "ยอดตก" → ใช้ยอดเฉลี่ยต่อวัน และทำแท่งเดือนไม่ครบให้จาง */
export function FixedChart4({ rows }) {
  const data = useMemo(
    () => monthlyRevenue(rows).map((m) => ({ ...m, full: daysInMonth(m.month), partial: m.days < daysInMonth(m.month) })),
    [rows]
  );
  if (data.length < 2) return <Empty />;
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const diff = last.perDay / prev.perDay - 1;
  const verdict = Math.abs(diff) < 0.02 ? "ใกล้เคียงกับ" : diff > 0 ? "สูงกว่า" : "ต่ำกว่า";
  const partial = data.filter((d) => d.partial);

  return (
    <Frame
      takeaway={`${thaiMonth(last.month)} เฉลี่ยวันละ ${fmtBaht(last.perDay)} ${verdict} ${thaiMonth(prev.month)} (${fmtBaht(prev.perDay)}) ${diff >= 0 ? "+" : "−"}${pct(Math.abs(diff))}`}
      note={partial.length
        ? `แท่งสีจาง = เดือนที่ข้อมูลไม่ครบ: ${partial.map((d) => `${thaiMonth(d.month)} ${d.days}/${d.full} วัน`).join(", ")} · จึงเทียบยอดเฉลี่ยต่อวันแทนยอดรวม`
        : "เทียบยอดเฉลี่ยต่อวัน เพราะแต่ละเดือนมีจำนวนวันไม่เท่ากัน"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="month" tickFormatter={thaiMonth} interval={Math.max(0, Math.ceil(data.length / 8) - 1)} tick={TICK}
                 axisLine={{ stroke: "#d6d3d1" }} tickLine={false} />
          <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} tick={TICK} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={thaiMonth}
                   formatter={(v, _n, item) => [`${fmtBaht(v)} (ข้อมูล ${item.payload.days}/${item.payload.full} วัน)`, "เฉลี่ยต่อวัน"]} />
          <Bar dataKey="perDay" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.month} fill={d.partial ? MUTED : MAIN} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
/** 5) จัดอันดับด้วยยอดรวม + ป้าย "แย่ที่สุด" → ยอดเฉลี่ยต่อวันที่เปิดขาย ไม่ตีตราสาขา */
export function FixedChart5({ rows }) {
  const data = useMemo(() => branchPerformance(rows).sort((a, b) => b.perDay - a.perDay), [rows]);
  if (!data.length) return <Empty />;
  const hi = data[0];
  const lo = data[data.length - 1];
  const maxDays = Math.max(...data.map((d) => d.days));
  const shortOpen = data.filter((d) => d.days < maxDays * 0.9);

  // คู่อันดับติดกันที่ต่างกันไม่ถึง 1% ถือว่า "ใกล้เคียง" ไม่ควรตีความว่าใครดีกว่า
  const ties = data.slice(1).map((d, i) => [data[i], d]).filter(([a, b]) => a.perDay / b.perDay - 1 < 0.01);
  const tieText = ties.map(([a, b]) => `${a.branch}กับ${b.branch}ต่างกันวันละ ${fmtBaht(a.perDay - b.perDay)}`).join(", ");

  return (
    <Frame
      takeaway={`ต่อวันที่เปิดขาย ${hi.branch}สูงสุด ${fmtBaht(hi.perDay)} · ${lo.branch}ต่ำสุด ${fmtBaht(lo.perDay)}`}
      note={`ยอดขายรวม ÷ จำนวนวันที่มีการขายของแต่ละสาขา`
        + (tieText ? ` · ${tieText} ถือว่าใกล้เคียงกัน` : "")
        + (shortOpen.length ? ` · ${shortOpen.map((d) => `${d.branch}มีข้อมูล ${d.days} วัน`).join(", ")}` : "")
        + ` · ควรดูปัจจัยอื่น (ทำเล ฤดูกาล) ก่อนสรุปเรื่องผลงานผู้จัดการ`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 90, left: 0, bottom: 0 }}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis type="category" dataKey="branch" width={90} tick={{ ...TICK, fontSize: 13 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v, _n, item) => [`${fmtBaht(v)} (${item.payload.days} วัน)`, "เฉลี่ยต่อวัน"]} />
          <Bar dataKey="perDay" fill={MAIN} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="perDay" position="right" formatter={fmtBaht} style={{ fontSize: 12, fill: INK }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}
