import { useEffect, useState } from 'react'

// สีกราฟแยกโหมดสว่าง/มืด (Recharts ต้องการค่าสีจริง ใช้ CSS var ตรง ๆ ไม่ได้ทุกเบราว์เซอร์)
const LIGHT = { series: '#2a78d6', grid: '#e7e6e2', axis: '#52514e', cursor: '#b9b8b2' }
const DARK = { series: '#3987e5', grid: '#33332f', axis: '#c3c2b7', cursor: '#5c5b55' }

export function useChartTheme() {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e) => setDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return dark ? DARK : LIGHT
}
