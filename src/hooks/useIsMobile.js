import { useEffect, useState } from 'react'

// true เมื่อจอกว้างน้อยกว่า 640px (ตรงกับ breakpoint sm ของ Tailwind)
// ใช้ปรับค่าที่ Tailwind คุมไม่ได้ เช่น ขนาดตัวอักษรและความกว้างแกนใน Recharts
const QUERY = '(max-width: 639px)'

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = (e) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
