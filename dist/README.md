# ชุดข้อมูลจำลอง: เครือร้านกาแฟ “บ้านบรู” (Baan Brew)

ข้อมูลสมมติทั้งหมด ไม่มีบุคคลหรือร้านจริง ครอบคลุม 1 เม.ย. 2025 – 20 ก.ย. 2026 จำนวน 5 สาขาในกรุงเทพฯ ไฟล์ทั้งหมดเป็น CSV แบบ UTF-8 (มี BOM จึงเปิดด้วย Excel แล้วภาษาไทยไม่เพี้ยน)

| ไฟล์ | แถว | ใช้ในคาบ | คำอธิบาย |
|---|---|---|---|
| `sales.csv` | 53,092 | 1, 3–7, 10 | ธุรกรรมขายแบบสะอาด 1 แถว = 1 รายการสินค้าในบิล |
| `sales_raw.csv` | 53,357 | 2 | ข้อมูลเดียวกันแต่สกปรกโดยตั้งใจ สำหรับฝึก data cleaning |
| `products.csv` | 40 | 1–7 | เมนู ราคา ต้นทุน |
| `branches.csv` | 5 | 1–7 | สาขา ประเภท พิกัด วันเปิด |
| `customers.csv` | 3,000 | 4 | สมาชิก (ใช้ทำ RFM, Cohort) |
| `thai_holidays.csv` | 26 | 6 | วันหยุดราชการ สำหรับ forecast |
| `reviews_th.csv` | 1,503 | 9, 11, 13 | รีวิวภาษาไทย ไม่มี label |
| `reviews_labels.csv` | 1,503 | 9 | เฉลย sentiment / หัวข้อ / เมนูที่พูดถึง (อยู่ในชุดผู้สอน แจกหลังทำ Lab 9.2) |
| `ANSWER_KEY.md` | – | ผู้สอน | ตัวเลขที่ถูกต้องสำหรับตรวจงาน (อยู่ในชุดผู้สอนเท่านั้น) |

## sales.csv

| คอลัมน์ | ชนิด | ตัวอย่าง | หมายเหตุ |
|---|---|---|---|
| `order_id` | ข้อความ | ORD0000001 | 1 บิลอาจมีหลายแถว |
| `datetime` | ISO 8601 | 2025-04-01T18:48:40+07:00 | เวลาไทย มี timezone กำกับ |
| `branch` | ข้อความ | สยาม | ตรงกับ `branches.branch` |
| `product_id` | ข้อความ | P007 | ตรงกับ `products.product_id` |
| `qty` | จำนวนเต็ม | 1 | |
| `unit_price` | บาท | 80 | ราคาจริงที่ขาย ช่วงโปรฯ 1 แถม 1 จะเป็นครึ่งราคา |
| `customer_id` | ข้อความ | C00123 | ว่าง = ลูกค้าทั่วไป (walk-in) ไม่ใช่สมาชิก |
| `payment_method` | ข้อความ | QR พร้อมเพย์ | QR พร้อมเพย์, บัตรเครดิต, เงินสด, LINE MAN, Grab |
| `channel` | ข้อความ | หน้าร้าน | หน้าร้าน / เดลิเวอรี |

ยอดขาย = `qty × unit_price` · จำนวนบิล = จำนวน `order_id` ที่ไม่ซ้ำ · กำไรขั้นต้น = `qty × (unit_price − products.cost)`

## ไฟล์อื่น

`products.csv`: product_id, product_name, category (กาแฟ, ชา, นอนคอฟฟี่, ปั่น, โซดา, เบเกอรี่, อาหาร, อื่น ๆ), price (ราคาปกติ), cost, launched_date

`branches.csv`: branch_id, branch, branch_type (ห้าง, ออฟฟิศ, ชุมชน, สถานศึกษา), lat, lng, opened_date

`customers.csv`: customer_id, nickname, gender, age_group, home_branch_id, joined_date, phone (ปิดบังบางส่วนแล้ว ใช้คุยเรื่อง PDPA)

`reviews_th.csv`: review_id, review_date, branch, source, rating (1–5), review_text

`reviews_labels.csv`: review_id, sentiment (positive / neutral / negative), topics (คั่นด้วย `|`), menu_items, note

## ข้อควรรู้สำหรับ Lab 3 (Firestore)

แผนฟรีของ Firebase จำกัดจำนวนการเขียนต่อวัน (ตรวจตัวเลขปัจจุบันในหน้า pricing ของ Firebase) การ import ทั้ง 53,092 แถวในวันเดียวอาจเกินโควตา แนะนำให้ import เฉพาะ 3 เดือนล่าสุด หรือ import เป็นยอดสรุปรายวัน (`daily_summary`) ซึ่งเป็นแนวทางที่สอนต่อในคาบ 7 อยู่แล้ว

## สร้างข้อมูลใหม่

`python generate_data.py` ในชุดผู้สอน (ต้องมี pandas, numpy) ผลลัพธ์เหมือนเดิมทุกครั้งเพราะใช้ seed คงที่ หากต้องการชุดข้อมูลคนละชุดสำหรับแต่ละรุ่น ให้เปลี่ยนค่า `SEED`
