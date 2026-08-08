const { sendTextMessage, sendInteractiveList } = require('./whatsapp');
const sessionManager = require('./sessions');
const { stmts, bookStudent } = require('../database/init');

/**
 * Conversation flow steps:
 * 1. WELCOME        → Ask for school year
 * 2. SELECT_YEAR    → Show available groups
 * 3. SELECT_GROUP   → Ask for full name
 * 4. ENTER_NAME     → Confirm booking
 */

const YEAR_LABELS = {
  1: 'الصف الأول الثانوي',
  2: 'الصف الثاني الثانوي',
  3: 'الصف الثالث الثانوي'
};

const DAY_ORDER = {
  'السبت': 0, 'الأحد': 1, 'الاثنين': 2, 'الثلاثاء': 3,
  'الأربعاء': 4, 'الخميس': 5, 'الجمعة': 6
};

/**
 * Handle an incoming WhatsApp message.
 * @param {object} messageData - { from, messageBody, messageType, name }
 */
async function handleMessage(messageData) {
  const { from, messageBody, name: waName } = messageData;
  const text = messageBody.trim();

  // Check if student is already registered
  const existingStudent = stmts.getStudentByPhone.get(from);

  // Get current session
  let session = sessionManager.get(from);

  // ── Reset command ──
  if (['إلغاء', 'الغاء', 'تغيير', 'reset', 'cancel'].includes(text.toLowerCase())) {
    sessionManager.delete(from);
    await sendTextMessage(from,
      '🔄 تم إلغاء العملية.\n\nاكتب "حجز" لبدء حجز جديد.'
    );
    return;
  }

  // ── If no session, start fresh ──
  if (!session) {
    // If student already registered and didn't type a booking keyword
    if (existingStudent && !isBookingKeyword(text)) {
      const group = stmts.getGroupById.get(existingStudent.group_id);
      await sendTextMessage(from,
        `أهلاً ${existingStudent.name}! 👋\n\n` +
        `أنت مسجل بالفعل في:\n` +
        `📚 ${group ? group.name : 'مجموعة'}\n` +
        `📅 ${group ? group.lesson_day : ''} الساعة ${group ? group.lesson_time : ''}\n\n` +
        `إذا أردت تغيير المجموعة، اكتب "تغيير".`
      );
      return;
    }

    // Start booking flow
    sessionManager.set(from, { step: 'SELECT_YEAR' });

    await sendTextMessage(from,
      `أهلاً وسهلاً! 🎓\n` +
      `مرحباً بك في نظام حجز مجموعات الكيمياء\n` +
      `أ / وليد قنديل\n\n` +
      `من فضلك اختار السنة الدراسية:\n\n` +
      `1️⃣  الصف الأول الثانوي\n` +
      `2️⃣  الصف الثاني الثانوي\n` +
      `3️⃣  الصف الثالث الثانوي\n\n` +
      `اكتب الرقم (1 أو 2 أو 3)`
    );
    return;
  }

  // ── Step: SELECT_YEAR ──
  if (session.step === 'SELECT_YEAR') {
    const yearNum = parseInt(text);

    if (![1, 2, 3].includes(yearNum)) {
      await sendTextMessage(from,
        '⚠️ من فضلك اكتب رقم صحيح:\n\n' +
        '1️⃣  الصف الأول الثانوي\n' +
        '2️⃣  الصف الثاني الثانوي\n' +
        '3️⃣  الصف الثالث الثانوي'
      );
      return;
    }

    // Get available groups for this year
    const groups = stmts.getGroupsByYear.all(yearNum);
    const availableGroups = groups.filter(g => g.current_count < g.max_students);

    if (availableGroups.length === 0) {
      await sendTextMessage(from,
        `😔 للأسف لا توجد مجموعات متاحة حالياً لـ ${YEAR_LABELS[yearNum]}.\n\n` +
        `يمكنك التواصل مع المدرس مباشرة أو المحاولة لاحقاً.\n` +
        `اكتب "حجز" للبدء من جديد.`
      );
      sessionManager.delete(from);
      return;
    }

    // Save year in session and move to group selection
    sessionManager.update(from, {
      step: 'SELECT_GROUP',
      schoolYear: yearNum,
      availableGroups: availableGroups
    });

    // Build groups message
    let groupsMsg = `📚 المجموعات المتاحة لـ ${YEAR_LABELS[yearNum]}:\n\n`;
    availableGroups.forEach((g, i) => {
      const remaining = g.max_students - g.current_count;
      groupsMsg += `${i + 1}️⃣  ${g.name}\n`;
      groupsMsg += `   📅 ${g.lesson_day} - الساعة ${g.lesson_time}\n`;
      groupsMsg += `   👥 باقي ${remaining} مكان\n\n`;
    });
    groupsMsg += `اكتب رقم المجموعة للاختيار:`;

    await sendTextMessage(from, groupsMsg);
    return;
  }

  // ── Step: SELECT_GROUP ──
  if (session.step === 'SELECT_GROUP') {
    const groupIdx = parseInt(text) - 1;
    const groups = session.availableGroups;

    if (isNaN(groupIdx) || groupIdx < 0 || groupIdx >= groups.length) {
      await sendTextMessage(from,
        `⚠️ من فضلك اكتب رقم صحيح من 1 إلى ${groups.length}`
      );
      return;
    }

    const selectedGroup = groups[groupIdx];

    // Double-check availability (might have changed)
    const freshGroup = stmts.getGroupById.get(selectedGroup.id);
    if (!freshGroup || freshGroup.current_count >= freshGroup.max_students) {
      await sendTextMessage(from,
        '😔 للأسف هذه المجموعة امتلأت للتو.\n' +
        'اكتب "حجز" للاختيار مرة أخرى.'
      );
      sessionManager.delete(from);
      return;
    }

    sessionManager.update(from, {
      step: 'ENTER_NAME',
      selectedGroupId: selectedGroup.id,
      selectedGroupName: selectedGroup.name,
      selectedGroupDay: selectedGroup.lesson_day,
      selectedGroupTime: selectedGroup.lesson_time
    });

    await sendTextMessage(from,
      `✅ اخترت: ${selectedGroup.name}\n` +
      `📅 ${selectedGroup.lesson_day} - الساعة ${selectedGroup.lesson_time}\n\n` +
      `من فضلك اكتب اسمك بالكامل:`
    );
    return;
  }

  // ── Step: ENTER_NAME ──
  if (session.step === 'ENTER_NAME') {
    const studentName = text;

    // Validate name (at least 2 characters, no numbers only)
    if (studentName.length < 2 || /^\d+$/.test(studentName)) {
      await sendTextMessage(from,
        '⚠️ من فضلك اكتب اسمك الكامل بشكل صحيح:'
      );
      return;
    }

    try {
      // Atomic booking transaction
      const result = bookStudent({
        name: studentName,
        phone: from,
        school_year: session.schoolYear,
        group_id: session.selectedGroupId
      });

      // Success! Clear session
      sessionManager.delete(from);

      await sendTextMessage(from,
        `✅ تم تأكيد الحجز بنجاح! 🎉\n\n` +
        `📋 بيانات الحجز:\n` +
        `👤 الاسم: ${studentName}\n` +
        `🎓 السنة: ${YEAR_LABELS[session.schoolYear]}\n` +
        `📚 المجموعة: ${session.selectedGroupName}\n` +
        `📅 الموعد: ${session.selectedGroupDay} - الساعة ${session.selectedGroupTime}\n\n` +
        `شكراً لك ونتمنى لك التوفيق! 🙏\n` +
        `أ / وليد قنديل - الكيمياء 🧪`
      );
    } catch (err) {
      sessionManager.delete(from);

      if (err.message === 'ALREADY_REGISTERED') {
        const existing = stmts.getStudentByPhone.get(from);
        const group = stmts.getGroupById.get(existing.group_id);
        await sendTextMessage(from,
          `⚠️ أنت مسجل بالفعل!\n\n` +
          `📚 المجموعة: ${group ? group.name : 'مجموعة'}\n` +
          `📅 الموعد: ${group ? group.lesson_day : ''} الساعة ${group ? group.lesson_time : ''}\n\n` +
          `للتغيير، اكتب "تغيير".`
        );
      } else if (err.message === 'GROUP_FULL') {
        await sendTextMessage(from,
          '😔 للأسف المجموعة امتلأت.\nاكتب "حجز" لاختيار مجموعة أخرى.'
        );
      } else {
        console.error('Booking error:', err);
        await sendTextMessage(from,
          '❌ حدث خطأ أثناء الحجز. يرجى المحاولة مرة أخرى.\nاكتب "حجز" للبدء من جديد.'
        );
      }
    }
    return;
  }
}

/**
 * Check if the message text is a booking keyword.
 */
function isBookingKeyword(text) {
  const keywords = ['حجز', 'book', 'booking', 'سجل', 'تسجيل', 'اشتراك', 'hi', 'hello', 'مرحبا', 'السلام عليكم'];
  return keywords.includes(text.toLowerCase());
}

module.exports = { handleMessage };
