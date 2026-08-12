require('dotenv').config();
const { sendTextMessage } = require('./whatsapp');
const sessionManager = require('./sessions');
const { stmts, bookStudent } = require('../database/init');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Handle an incoming WhatsApp message.
 * @param {object} messageData - { from, messageBody, messageType, name }
 */
async function handleMessage(messageData) {
  const { from, messageBody } = messageData;
  const text = messageBody.trim();

  if (!text) return; // Ignore empty messages

  let session = sessionManager.get(from);

  // Check booking trigger if no active session
  const isBookingTrigger = /(حجز|احجز|أحجز|إحجز|الحجز)/i.test(text);

  if (!session && !isBookingTrigger) {
    try {
      // Use OpenAI to reply to general messages
      const completion = await openai.chat.completions.create({
        messages: [
          { role: 'system', content: 'أنت مساعد ذكي لمركز مستر وليد قنديل للكيمياء. تجيب بأسلوب مهذب ومختصر. إذا سأل الطالب عن الحجز، أخبره أن يكتب كلمة "حجز" للبدء في التسجيل.' },
          { role: 'user', content: text }
        ],
        model: 'gpt-4o-mini',
      });
      const aiResponse = completion.choices[0].message.content;
      console.log(`🤖 AI replied to ${from}: "${aiResponse}"`);
      await sendTextMessage(from, aiResponse);
    } catch (err) {
      console.error('OpenAI Error:', err.message);
      await sendTextMessage(from, 'عفواً، لا يمكنني الرد الآن. إذا كنت ترغب في الحجز، فقط اكتب كلمة "حجز".');
    }
    return;
  }

  // (No blocking for already-registered students — allow re-registration)

  // Try processing via rule-based flow first for instant and reliable database integration
  try {
    await processBookingFlow(from, text, session);
  } catch (error) {
    console.error('Error processing booking flow:', error);
    await sendTextMessage(from, 'عذراً، حدث خطأ أثناء معالجة الطلب. يرجى المحاولة لاحقاً.');
  }
}

/**
 * Deterministic booking step-by-step state machine with database integration
 */
async function processBookingFlow(from, text, session) {
  // Step 1: Start booking
  if (!session) {
    sessionManager.set(from, { step: 'AWAITING_YEAR' });
    const welcomeMsg = 
      `مرحباً بك في مركز مستر وليد قنديل للكيمياء 🧪\n\n` +
      `يرجى اختيار صفك الدراسي لإظهار المواعيد المتاحة:\n` +
      `1️⃣ الصف الأول الثانوي\n` +
      `2️⃣ الصف الثاني الثانوي\n` +
      `3️⃣ الصف الثالث الثانوي\n\n` +
      `(ارسل الرقم 1 أو 2 أو 3)`;

    await sendTextMessage(from, welcomeMsg);
    return;
  }

  // Step 2: Receive Year Selection
  if (session.step === 'AWAITING_YEAR') {
    let year = null;
    if (text.includes('1') || text.includes('أول') || text.includes('اول')) year = 1;
    else if (text.includes('2') || text.includes('ثاني') || text.includes('ثانى')) year = 2;
    else if (text.includes('3') || text.includes('ثالث')) year = 3;

    if (!year) {
      await sendTextMessage(
        from,
        `يرجى اختيار الصف الدراسي بكتابة الرقم:\n1️⃣ الأول الثانوي\n2️⃣ الثاني الثانوي\n3️⃣ الثالث الثانوي`
      );
      return;
    }

    const groups = await stmts.getGroupsByYear.all(year);
    if (!groups || groups.length === 0) {
      sessionManager.delete(from);
      await sendTextMessage(from, 'عذراً، لا توجد مجموعات متاحة حالياً لهذا الصف.');
      return;
    }

    const group = groups[0];
    sessionManager.update(from, { step: 'AWAITING_NAME', school_year: year, group_id: group.id });

    const msg = 
      `رائع! موعد مجموعة ${group.name}:\n` +
      `🗓 الموعد: ${group.lesson_day} الساعة ${group.lesson_time}.\n\n` +
      `لتأكيد الحجز وتسجيلك في المجموعة، يرجى كتابة اسمك بالكامل:`;

    await sendTextMessage(from, msg);
    return;
  }

  // Step 3: Receive Full Name and Book Student into DB
  if (session.step === 'AWAITING_NAME') {
    const studentName = text.trim();

    if (studentName.length < 3) {
      await sendTextMessage(from, 'يرجى كتابة الاسم الثلاثي أو الرباعي بشكل صحيح:');
      return;
    }

    try {
      const group = await stmts.getGroupById.get(session.group_id);
      
      // Save student to Supabase database and update group current_count
      const bookingResult = await bookStudent({
        name: studentName,
        phone: from,
        school_year: session.school_year,
        group_id: session.group_id
      });

      console.log(`✅ Student successfully booked: ${studentName} (${from}) in group ${group.name}`);

      sessionManager.delete(from);

      const confirmationMsg = 
        `تم حجزك بنجاح! 🎉\n\n` +
        `👤 الطالب: ${studentName}\n` +
        `📚 المجموعة: ${group.name}\n` +
        `🗓 الموعد: ${group.lesson_day} (الساعة ${group.lesson_time})\n\n` +
        `تم إضافة بياناتك إلى لوحة تحكم المجموعات. نراك في الموعد! 🧪`;

      await sendTextMessage(from, confirmationMsg);
    } catch (err) {
      sessionManager.delete(from);

      if (err.message === 'ALREADY_REGISTERED') {
        await sendTextMessage(from, 'هذا الرقم مسجل بالفعل في مجموعة سابقة.');
      } else if (err.message === 'GROUP_FULL') {
        await sendTextMessage(from, 'عذراً، اكتمل العدد في هذه المجموعة.');
      } else {
        console.error('Booking DB error:', err);
        await sendTextMessage(from, 'حدث خطأ أثناء حفظ بيانات الحجز، يرجى التواصل معنا.');
      }
    }
  }
}

module.exports = { handleMessage };
