# نظام حجز وإدارة المجموعات 🎓 (Teacher WhatsApp Booking System)

نظام متكامل لإدارة حجوزات مجموعات أ/ وليد قنديل - مادة الكيمياء.

## المميزات ✨

1. **بوت واتساب (WhatsApp Bot)**: بوت آلي للرد على الطلاب وتأكيد الحجوزات.
2. **لوحة تحكم (Admin Dashboard)**: لوحة بتصميم احترافي (Dark Glassmorphism) لإدارة الطلاب والمجموعات.
3. **قاعدة بيانات SQLite**: خفيفة وسريعة لتخزين كل البيانات.
4. **متابعة الدفع (Payments Tracker)**: تتبع المدفوعات الشهرية لكل طالب.

## التثبيت ⚙️

1. تأكد من تثبيت [Node.js](https://nodejs.org/) على جهازك.
2. افتح مجلد المشروع `d:\walid` في موجه الأوامر (Terminal/CMD).
3. قم بتثبيت الحزم المطلوبة:
```bash
npm install
```
4. قم ببدء الخادم:
```bash
npm start
```
(أو `npm run dev` للعمل في وضع التطوير).

## لوحة التحكم 💻

بعد تشغيل السيرفر، افتح المتصفح على الرابط:
`http://localhost:3000`

**بيانات الدخول الافتراضية:**
- اسم المستخدم: `admin`
- كلمة المرور: `walid2026`

*(يمكنك تغييرها من ملف `.env`)*

## صورة المدرس خلفية للوحة التحكم 🖼️
تأكد من وضع صورة المدرس التي أرسلتها في المسار التالي حتى تظهر في خلفية صفحة تسجيل الدخول ولوحة التحكم:
`d:\walid\public\assets\teacher-photo.jpg`

## إعداد واتساب (WhatsApp Cloud API) 📱

لكي يعمل البوت، تحتاج إلى ربطه مع Meta:

1. اذهب إلى [Meta for Developers](https://developers.facebook.com/) وقم بإنشاء تطبيق جديد (App) من نوع Business.
2. أضف منتج WhatsApp إلى التطبيق.
3. انسخ الـ `Phone Number ID` والـ `Access Token` وأضفهم في ملف `.env`.
4. استخدم أداة مثل [ngrok](https://ngrok.com/) لفتح بورت 3000 على الإنترنت:
```bash
ngrok http 3000
```
5. في لوحة تحكم Meta، اذهب إلى Webhooks:
   - ضع رابط ngrok مع إضافة `/webhook` في النهاية (مثال: `https://abcd.ngrok-free.app/webhook`).
   - ضع كلمة سر التحقق (`Verify Token`): `walid_chem_verify_token_2026`
   - حدد الاشتراك في أحداث الرسائل (`messages`).
