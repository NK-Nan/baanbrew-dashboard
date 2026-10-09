// Lab 3.2–3.3 · Dashboard ยอดขายแบบ real-time จาก Firestore + ล็อกอินด้วย Google
// LiveTab (ชั้นนอก) ตรวจสถานะล็อกอิน → แสดง Dashboard เฉพาะเมื่อล็อกอินแล้ว
// Dashboard ฟัง collection "sales" ด้วย onSnapshot ตามช่วงวันที่ · กรองสาขาฝั่งเบราว์เซอร์
// การคำนวณทั้งหมดมาจาก ../lib/metrics.js (ไฟล์นี้มีแค่การจัดข้อมูลเพื่อแสดงผล)
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import {
  ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { db, auth, googleProvider } from "./firebase.js";
import { todayBangkok, addDays, nowBangkokISO } from "./time.js";
import {
  prepareRows, computeKpis, dailyRevenue, revenueByBranch,
  fmtBaht, fmtBaht2, fmtNum, fmtShortBaht,
} from "../lib/metrics.js";
import KpiCard from "../components/KpiCard.jsx";
import SaleForm from "./SaleForm.jsx";

const PRIMARY = "#b45309";
const AXIS_TICK = { fontSize: 11, fill: "#78716c" };
const HIGHLIGHT_MS = 4000;
const RECENT_LIMIT = 8;

const RANGES = [
  { id: "today", label: "วันนี้", days: 1 },
  { id: "7d", label: "7 วัน", days: 7 },
  { id: "30d", label: "30 วัน", days: 30 },
];
const ALL = "ทั้งหมด";

/** ข้อความ error ภาษาไทยตามรหัสของ Firestore */
function thaiError(e) {
  switch (e?.code) {
    case "permission-denied":
      return "Security Rules ไม่อนุญาตให้อ่าน collection sales ตรวจ Rules ใน Firebase console หรือเข้าสู่ระบบก่อน";
    case "unauthenticated":
      return "ต้องเข้าสู่ระบบก่อนจึงจะอ่านข้อมูลได้";
    case "failed-precondition":
      return "query นี้ต้องสร้าง index ก่อน เปิดลิงก์ใน Console ของเบราว์เซอร์ (F12) เพื่อสร้าง index";
    case "unavailable":
      return "เชื่อมต่อ Firestore ไม่ได้ ตรวจอินเทอร์เน็ต ระบบจะลองเชื่อมต่อใหม่เอง";
    case "resource-exhausted":
      return "ใช้โควตาการอ่านของวันนี้หมดแล้ว ลองใหม่พรุ่งนี้หรือเลือกช่วงวันที่สั้นลง";
    default:
      return `เกิดข้อผิดพลาด: ${e?.message ?? String(e)}`;
  }
}

/** วันที่ทุกวันจาก start ถึง end (ใช้เติมวันที่ไม่มียอดขายให้เป็น 0) */
function dateList(start, end) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** "2026-09-27" → "27 ก.ย." (แยกจากสตริง ไม่ผ่าน Date จึงไม่เพี้ยนตาม timezone) */
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const shortDate = (ymd) => `${Number(ymd.slice(8, 10))} ${TH_MONTHS[Number(ymd.slice(5, 7)) - 1]}`;
const timeOf = (iso) => iso.slice(11, 19); // "2026-09-27T14:05:09+07:00" → "14:05:09" เวลาไทย

// ───────────────────────── การล็อกอิน ─────────────────────────

/** ข้อความ error ของ Firebase Auth เป็นภาษาไทย · คืน null ถ้าไม่ต้องแสดงอะไร */
function thaiAuthError(e) {
  switch (e?.code) {
    case "auth/unauthorized-domain":
      return `โดเมน ${location.hostname} ยังไม่ได้รับอนุญาตให้ล็อกอิน เพิ่มที่ Firebase console → Authentication → Settings → Authorized domains`;
    case "auth/operation-not-allowed":
      return "ยังไม่ได้เปิดการล็อกอินด้วย Google เปิดที่ Firebase console → Authentication → Sign-in method → Google → Enable";
    case "auth/popup-blocked":
      return "เบราว์เซอร์บล็อกหน้าต่างล็อกอิน อนุญาตป๊อปอัปสำหรับเว็บนี้ (ไอคอนที่ช่อง URL) แล้วกดปุ่มอีกครั้ง";
    case "auth/popup-closed-by-user":
      return "หน้าต่างล็อกอินถูกปิดก่อนเสร็จ กดปุ่มอีกครั้งเพื่อเข้าสู่ระบบ";
    case "auth/cancelled-popup-request":
      return null; // กดซ้ำระหว่างที่ป๊อปอัปเปิดอยู่ ไม่ใช่ข้อผิดพลาดจริง
    case "auth/network-request-failed":
      return "เชื่อมต่ออินเทอร์เน็ตไม่ได้ ตรวจการเชื่อมต่อแล้วลองใหม่";
    default:
      return `เข้าสู่ระบบไม่สำเร็จ: ${e?.message ?? String(e)}`;
  }
}

function Centered({ children }) {
  return <div className="flex min-h-[50vh] items-center justify-center">{children}</div>;
}

function LoginCard({ onSignIn, busy, error }) {
  return (
    <Centered>
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center ring-1 ring-stone-200">
        <h1 className="text-xl font-bold">ยอดขายสด</h1>
        <p className="mt-2 text-sm text-stone-500">เข้าสู่ระบบเพื่อดูยอดขายแบบ real-time และบันทึกการขาย</p>
        <button onClick={onSignIn} disabled={busy}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-lg border border-stone-300 bg-white px-4 py-2.5 font-medium text-stone-800 hover:bg-stone-50 disabled:cursor-wait disabled:opacity-60">
          <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {busy ? "กำลังเปิดหน้าต่างล็อกอิน…" : "เข้าสู่ระบบด้วย Google"}
        </button>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-left text-sm text-red-800">{error}</p>}
      </div>
    </Centered>
  );
}

function UserChip({ user, onSignOut }) {
  const name = user.displayName || user.email || "ผู้ใช้";
  return (
    <div className="flex items-center gap-3">
      {user.photoURL ? (
        // referrerPolicy จำเป็น ไม่งั้นรูปโปรไฟล์ Google บางครั้งโหลดไม่ขึ้น (403)
        <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full ring-1 ring-stone-200" />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-700 text-sm font-semibold text-white">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="max-w-[12rem] truncate text-sm font-medium text-stone-700" title={user.email ?? ""}>{name}</span>
      <button onClick={onSignOut}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-200">
        ออกจากระบบ
      </button>
    </div>
  );
}

/** ชั้นนอก: ตรวจสถานะล็อกอินก่อน · Dashboard (และ onSnapshot) เริ่มเฉพาะเมื่อมี user */
export default function LiveTab() {
  const [user, setUser] = useState(undefined); // undefined = กำลังตรวจ, null = ยังไม่ล็อกอิน
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!auth) { setUser(null); return undefined; }
    return onAuthStateChanged(auth, (u) => setUser(u ?? null)); // คืน unsubscribe ให้ cleanup
  }, []);

  async function handleSignIn() {
    if (!auth || !googleProvider) {
      setAuthError("ยังไม่ได้ตั้งค่า Firebase Authentication ใน firebase.js");
      return;
    }
    setSigningIn(true);
    setAuthError("");
    try {
      await signInWithPopup(auth, googleProvider); // onAuthStateChanged จะอัปเดต user เอง
    } catch (e) {
      setAuthError(thaiAuthError(e) ?? "");
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
    } catch (e) {
      setAuthError(`ออกจากระบบไม่สำเร็จ: ${e?.message ?? e}`);
    }
  }

  if (user === undefined) {
    return <Centered><p className="text-stone-500">กำลังตรวจสอบการเข้าสู่ระบบ…</p></Centered>;
  }
  if (!user) return <LoginCard onSignIn={handleSignIn} busy={signingIn} error={authError} />;
  // key={user.uid}: เปลี่ยนบัญชีแล้ว Dashboard เริ่มใหม่ทั้งหมด (ตัวนับ ข้อมูล listener)
  return <Dashboard key={user.uid} user={user} onSignOut={handleSignOut} />;
}

// ───────────────────────── Dashboard ─────────────────────────

function Dashboard({ user, onSignOut }) {
  const [rangeId, setRangeId] = useState("7d");
  const [branch, setBranch] = useState(ALL);
  const [today, setToday] = useState(() => todayBangkok());
  const [docs, setDocs] = useState([]); // ข้อมูลดิบของเอกสารในช่วงที่เลือก
  const [status, setStatus] = useState("loading"); // loading | live | error
  const [error, setError] = useState("");
  const [reads, setReads] = useState(0);
  const [lastUpdate, setLastUpdate] = useState("");
  const [fresh, setFresh] = useState(() => new Set()); // id ที่เพิ่งเข้ามา (ไฮไลต์ 4 วินาที)
  const [products, setProducts] = useState(null); // null = กำลังโหลด
  const [productsError, setProductsError] = useState("");
  const timers = useRef(new Set());

  // โหลดเมนูครั้งเดียว (ไม่ต้องฟังแบบ real-time เพราะเมนูแทบไม่เปลี่ยน · อ่าน 40 เอกสาร)
  useEffect(() => {
    if (!db) return undefined;
    let alive = true;
    getDocs(collection(db, "products"))
      .then((snap) => {
        if (!alive) return;
        const list = snap.docs
          .map((d) => ({ product_id: d.id, ...d.data() }))
          .sort((a, b) => a.product_id.localeCompare(b.product_id));
        setProducts(list);
        setReads((n) => n + snap.size);
      })
      .catch((e) => alive && setProductsError(`โหลดเมนูไม่สำเร็จ: ${thaiError(e)}`));
    return () => { alive = false; };
  }, []);

  const productName = useMemo(
    () => Object.fromEntries((products ?? []).map((p) => [p.product_id, p.product_name])),
    [products],
  );

  // เปลี่ยนวันอัตโนมัติเมื่อเลยเที่ยงคืนตามเวลาไทย (ถ้าเปิดหน้าทิ้งไว้ข้ามวัน)
  useEffect(() => {
    const id = setInterval(() => setToday((t) => (todayBangkok() !== t ? todayBangkok() : t)), 60_000);
    return () => clearInterval(id);
  }, []);

  // ล้าง timer ไฮไลต์ทั้งหมดตอนออกจากหน้า
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const range = RANGES.find((r) => r.id === rangeId);
  const end = today;
  const start = addDays(today, -(range.days - 1)); // 7 วัน = วันนี้ย้อนหลัง 6 วัน รวมวันนี้

  // ---------- ฟัง Firestore ----------
  useEffect(() => {
    if (!db) {
      setStatus("error");
      setError("ยังไม่ได้ตั้งค่า Firebase จึงแสดงข้อมูลสดไม่ได้ (โหมดสาธิตยังไม่รองรับหน้านี้)");
      return undefined;
    }
    setStatus("loading");
    setError("");
    setDocs([]);

    const byId = new Map(); // เก็บเอกสารตาม id แล้วอัปเดตเฉพาะส่วนที่เปลี่ยน
    let first = true;
    const q = query(
      collection(db, "sales"),
      where("date", ">=", start),
      where("date", "<=", end),
      orderBy("date"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const changes = snap.docChanges();
        const added = [];
        for (const c of changes) {
          if (c.type === "removed") byId.delete(c.doc.id);
          else byId.set(c.doc.id, { id: c.doc.id, ...c.doc.data() });
          if (c.type === "added" && !first) added.push(c.doc.id);
        }
        // นับจำนวนเอกสารที่อ่าน (snapshot แรก = ทุกเอกสารในช่วง, หลังจากนั้น = เฉพาะที่เปลี่ยน)
        setReads((n) => n + changes.length);
        setDocs([...byId.values()]);
        setStatus("live");
        setError("");
        setLastUpdate(timeOf(nowBangkokISO()));

        if (added.length) {
          setFresh((prev) => new Set([...prev, ...added]));
          const t = setTimeout(() => {
            timers.current.delete(t);
            setFresh((prev) => {
              const next = new Set(prev);
              added.forEach((id) => next.delete(id));
              return next;
            });
          }, HIGHLIGHT_MS);
          timers.current.add(t);
        }
        first = false;
      },
      (e) => {
        setStatus("error");
        setError(thaiError(e));
      },
    );

    return unsubscribe; // ยกเลิกการฟังเมื่อเปลี่ยนช่วงวันที่หรือออกจากหน้า
  }, [start, end]);

  // ---------- คำนวณ (ใช้ฟังก์ชันจาก metrics.js ทั้งหมด) ----------
  const allRows = useMemo(() => prepareRows(docs), [docs]);
  const rows = useMemo(
    () => (branch === ALL ? allRows : allRows.filter((r) => r.branch === branch)),
    [allRows, branch],
  );
  const kpi = useMemo(() => computeKpis(rows), [rows]);
  const branches = useMemo(() => revenueByBranch(allRows), [allRows]); // ทุกสาขา ใช้เทียบกัน

  const series = useMemo(() => {
    if (rangeId === "today") {
      // รายชั่วโมง: ใช้ dailyRevenue รวมยอดเหมือนเดิม แค่ใช้ชั่วโมงเป็นกลุ่มแทนวันที่
      const pad = (h) => String(h).padStart(2, "0");
      const byHour = new Map(dailyRevenue(rows.map((r) => ({ ...r, date: pad(r.hour) }))).map((d) => [d.date, d.revenue]));
      const hours = rows.map((r) => r.hour);
      const from = Math.min(7, ...hours); // แสดงอย่างน้อย 07:00–21:00 แม้ยังไม่มียอด
      const to = Math.max(21, ...hours);
      return Array.from({ length: to - from + 1 }, (_, i) => {
        const h = pad(from + i);
        return { key: `${h}:00`, revenue: byHour.get(h) ?? 0 };
      });
    }
    const byDate = new Map(dailyRevenue(rows).map((d) => [d.date, d.revenue]));
    return dateList(start, end).map((d) => ({ key: d, label: shortDate(d), revenue: byDate.get(d) ?? 0 }));
  }, [rows, rangeId, start, end]);

  const recent = useMemo(
    () => [...rows].sort((a, b) => b.datetime.localeCompare(a.datetime)).slice(0, RECENT_LIMIT),
    [rows],
  );

  const branchOptions = useMemo(() => {
    const names = new Set(branches.map((b) => b.branch));
    if (branch !== ALL) names.add(branch); // คงสาขาที่เลือกไว้แม้ช่วงนี้ไม่มียอด
    return [ALL, ...names];
  }, [branches, branch]);

  // ---------- UI ----------
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <UserChip user={user} onSignOut={onSignOut} />
      </div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ยอดขายสด</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-stone-500">
            <span className={`inline-block h-2 w-2 rounded-full ${status === "live" ? "animate-pulse bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-stone-400"}`} />
            {status === "live" && `อัปเดตล่าสุด ${lastUpdate}`}
            {status === "loading" && "กำลังเชื่อมต่อ…"}
            {status === "error" && "หยุดรับข้อมูล"}
            <span className="text-stone-400">· {start === end ? shortDate(end) : `${shortDate(start)} – ${shortDate(end)}`}</span>
            <span className="text-stone-400">· อ่านไปแล้ว {fmtNum(reads)} เอกสาร</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-stone-200 p-1">
            {RANGES.map((r) => (
              <button key={r.id} onClick={() => setRangeId(r.id)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium ${rangeId === r.id ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"}`}>
                {r.label}
              </button>
            ))}
          </div>
          <select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="เลือกสาขา"
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">
            {branchOptions.map((b) => <option key={b} value={b}>{b === ALL ? "ทุกสาขา" : b}</option>)}
          </select>
        </div>
      </header>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">❌ {error}</p>}

      {/* 2 คอลัมน์บนจอใหญ่: ซ้าย = dashboard, ขวา = ฟอร์มบันทึกยอดขาย · มือถือเรียงต่อกัน (ฟอร์มอยู่ล่าง) */}
      <div className="grid items-start gap-5 lg:grid-cols-3">
      <div className="min-w-0 space-y-5 lg:col-span-2">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="ยอดขาย" value={fmtBaht(kpi.revenue)} />
        <KpiCard label="จำนวนบิล" value={fmtNum(kpi.bills)} />
        <KpiCard label="ยอดเฉลี่ยต่อบิล" value={fmtBaht2(kpi.avgPerBill)} />
        <KpiCard label="ลูกค้าสมาชิก" value={fmtNum(kpi.customers)} note="ไม่นับลูกค้าทั่วไป" />
      </div>

      <div className="grid gap-4">
        <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
          <h2 className="mb-3 font-semibold">{rangeId === "today" ? "ยอดขายรายชั่วโมง วันนี้" : `ยอดขายรายวัน ${range.label}ล่าสุด`}</h2>
          <div className="h-64">
            {status === "live" && rows.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-stone-500">
                {rangeId === "today" ? "วันนี้ยังไม่มียอดขาย ลองบันทึกการขายจากฟอร์มดูสิ" : "ไม่มียอดขายในช่วงนี้"}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {rangeId === "today" ? (
                  <BarChart data={series} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="#e7e5e4" vertical={false} />
                    <XAxis dataKey="key" tick={AXIS_TICK} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
                    <YAxis tickFormatter={fmtShortBaht} tick={AXIS_TICK} width={56} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [fmtBaht(v), "ยอดขาย"]} cursor={{ fill: "#fef3c7" }} />
                    <Bar dataKey="revenue" fill={PRIMARY} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                ) : (
                  <LineChart data={series} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="#e7e5e4" vertical={false} />
                    <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} minTickGap={24} />
                    <YAxis tickFormatter={fmtShortBaht} tick={AXIS_TICK} width={56} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [fmtBaht(v), "ยอดขาย"]} labelFormatter={(l, p) => p?.[0]?.payload?.key ? shortDate(p[0].payload.key) : l} />
                    <Line dataKey="revenue" stroke={PRIMARY} strokeWidth={2} dot={rangeId === "7d" ? { r: 3 } : false} isAnimationActive={false} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
          <h2 className="mb-3 font-semibold">ยอดขายแยกสาขา</h2>
          <div className="h-48">
            {branches.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-stone-500">ยังไม่มีข้อมูล</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branches} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="branch" width={80} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => [fmtBaht(v), "ยอดขาย"]} cursor={{ fill: "#fef3c7" }} />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]} isAnimationActive={false}
                       onClick={(d) => setBranch((cur) => (cur === d.branch ? ALL : d.branch))} className="cursor-pointer">
                    {branches.map((b) => (
                      <Cell key={b.branch} fill={PRIMARY} fillOpacity={branch === ALL || branch === b.branch ? 1 : 0.3} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="mt-2 text-xs text-stone-400">คลิกแท่งเพื่อกรองสาขา</p>
        </section>
      </div>

      <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
        <h2 className="mb-3 font-semibold">รายการล่าสุด</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2 pr-3 font-medium">เวลา</th>
                <th className="py-2 pr-3 font-medium">สาขา</th>
                <th className="py-2 pr-3 font-medium">เมนู</th>
                <th className="py-2 pr-3 text-right font-medium">จำนวน</th>
                <th className="py-2 pr-3 text-right font-medium">ยอด</th>
                <th className="py-2 font-medium">ชำระ</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}
                    className={`border-b border-stone-100 transition-colors duration-700 ${fresh.has(r.id) ? "bg-amber-100" : ""}`}>
                  <td className="py-2 pr-3 tabular-nums text-stone-600">
                    {rangeId === "today" ? timeOf(r.datetime) : `${shortDate(r.date)} ${timeOf(r.datetime).slice(0, 5)}`}
                    {fresh.has(r.id) && <span className="ml-2 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">ใหม่</span>}
                  </td>
                  <td className="py-2 pr-3">{r.branch}</td>
                  <td className="py-2 pr-3">{productName[r.product_id] ?? r.product_id}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(r.qty)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtBaht(r.revenue)}</td>
                  <td className="py-2 text-stone-600">{r.payment_method}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-stone-500">
                  {status === "loading" ? "กำลังโหลด…" : "ยังไม่มีรายการ"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      </div>

      <aside className="lg:sticky lg:top-20">
        <SaleForm uid={user.uid} products={products} productsError={productsError} />
      </aside>
      </div>
    </div>
  );
}
