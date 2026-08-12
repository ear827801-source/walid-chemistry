const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { stmts, removeStudent, generateMonthlyPayments, bookStudent } = require('../database/init');

// All API routes require authentication
router.use(authMiddleware);

// ═══════════════════════════════════════
//  DASHBOARD STATS
// ═══════════════════════════════════════

router.get('/stats', async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const [totalStudents, totalGroups, paidCount, unpaidCount, totalCollected, recentStudents] = await Promise.all([
        stmts.getTotalStudents.get(),
        stmts.getTotalGroups.get(),
        stmts.getPaidCount.get(currentMonth),
        stmts.getUnpaidCount.get(currentMonth),
        stmts.getTotalCollected.get(currentMonth),
        stmts.getRecentStudents.all()
    ]);

    res.json({
      totalStudents: totalStudents.count,
      totalGroups: totalGroups.count,
      paidCount: paidCount.count,
      unpaidCount: unpaidCount.count,
      totalCollected: totalCollected.total,
      currentMonth,
      recentStudents
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'حدث خطأ في جلب الإحصائيات' });
  }
});

// ═══════════════════════════════════════
//  GROUPS MANAGEMENT
// ═══════════════════════════════════════

router.get('/groups', async (req, res) => {
  try {
    const { year, active } = req.query;

    let groups;
    if (year) {
      groups = await stmts.getGroupsByYear.all(parseInt(year));
    } else if (active === 'true') {
      groups = await stmts.getActiveGroups.all();
    } else {
      groups = await stmts.getAllGroups.all();
    }

    res.json(groups);
  } catch (err) {
    console.error('Groups list error:', err);
    res.status(500).json({ error: 'حدث خطأ في جلب المجموعات' });
  }
});

router.post('/groups', async (req, res) => {
  try {
    const { name, school_year, lesson_day, lesson_time, max_students } = req.body;

    if (!name || !school_year || !lesson_day || !lesson_time) {
      return res.status(400).json({ error: 'يرجى ملء جميع الحقول المطلوبة' });
    }

    const result = await stmts.insertGroup.run({
      name,
      school_year: parseInt(school_year),
      lesson_day,
      lesson_time,
      max_students: parseInt(max_students) || 30
    });

    const group = await stmts.getGroupById.get(result.lastInsertRowid);
    res.status(201).json(group);
  } catch (err) {
    console.error('Group create error:', err);
    res.status(500).json({ error: 'حدث خطأ في إنشاء المجموعة' });
  }
});

router.put('/groups/:id', async (req, res) => {
  try {
    const { name, school_year, lesson_day, lesson_time, max_students } = req.body;
    const id = parseInt(req.params.id);

    const existing = await stmts.getGroupById.get(id);
    if (!existing) {
      return res.status(404).json({ error: 'المجموعة غير موجودة' });
    }

    await stmts.updateGroup.run({
      id,
      name: name || existing.name,
      school_year: school_year ? parseInt(school_year) : existing.school_year,
      lesson_day: lesson_day || existing.lesson_day,
      lesson_time: lesson_time || existing.lesson_time,
      max_students: max_students ? parseInt(max_students) : existing.max_students
    });

    const updated = await stmts.getGroupById.get(id);
    res.json(updated);
  } catch (err) {
    console.error('Group update error:', err);
    res.status(500).json({ error: 'حدث خطأ في تحديث المجموعة' });
  }
});

router.delete('/groups/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await stmts.getGroupById.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'المجموعة غير موجودة' });
    }

    await stmts.deleteGroup.run(id);
    res.json({ message: 'تم حذف المجموعة بنجاح' });
  } catch (err) {
    console.error('Group delete error:', err);
    res.status(500).json({ error: 'حدث خطأ في حذف المجموعة' });
  }
});

// ═══════════════════════════════════════
//  STUDENTS MANAGEMENT
// ═══════════════════════════════════════

router.get('/students', async (req, res) => {
  try {
    const { group_id, year, search } = req.query;
    let students;

    if (group_id) {
      students = await stmts.getStudentsByGroup.all(parseInt(group_id));
    } else if (year) {
      students = await stmts.getStudentsByYear.all(parseInt(year));
    } else {
      students = await stmts.getAllStudents.all();
    }

    if (search) {
      const searchLower = search.toLowerCase();
      students = students.filter(s =>
        s.name.toLowerCase().includes(searchLower) ||
        s.phone.includes(search)
      );
    }

    res.json(students);
  } catch (err) {
    console.error('Students list error:', err);
    res.status(500).json({ error: 'حدث خطأ في جلب الطلاب' });
  }
});

router.post('/students', async (req, res) => {
  try {
    const { name, phone, school_year, group_id } = req.body;

    if (!name || !phone || !school_year || !group_id) {
      return res.status(400).json({ error: 'يرجى ملء جميع الحقول المطلوبة' });
    }

    await bookStudent({
      name,
      phone,
      school_year: parseInt(school_year),
      group_id: parseInt(group_id)
    });

    const student = await stmts.getStudentByPhone.get(phone);
    res.status(201).json(student);
  } catch (err) {
    if (err.message === 'ALREADY_REGISTERED') {
      return res.status(409).json({ error: 'هذا الرقم مسجل بالفعل' });
    }
    if (err.message === 'GROUP_FULL') {
      return res.status(409).json({ error: 'المجموعة ممتلئة' });
    }
    console.error('Student create error:', err);
    res.status(500).json({ error: 'حدث خطأ في إضافة الطالب' });
  }
});

router.delete('/students/:id', async (req, res) => {
  try {
    const student = await removeStudent(parseInt(req.params.id));
    res.json({ message: `تم حذف الطالب ${student.name} بنجاح` });
  } catch (err) {
    if (err.message === 'STUDENT_NOT_FOUND') {
      return res.status(404).json({ error: 'الطالب غير موجود' });
    }
    console.error('Student delete error:', err);
    res.status(500).json({ error: 'حدث خطأ في حذف الطالب' });
  }
});

// ═══════════════════════════════════════
//  PAYMENTS MANAGEMENT
// ═══════════════════════════════════════

router.get('/payments', async (req, res) => {
  try {
    const { month, group_id } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    // Auto-sync missing payment records for any newly registered students for this month
    await generateMonthlyPayments(targetMonth, 200).catch(() => {});

    let payments;
    if (group_id) {
      payments = await stmts.getPaymentsByGroupAndMonth.all(parseInt(group_id), targetMonth);
    } else {
      payments = await stmts.getPaymentsByMonth.all(targetMonth);
    }

    res.json({ month: targetMonth, payments });
  } catch (err) {
    console.error('Payments list error:', err);
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات الدفع' });
  }
});

router.put('/payments/:id', async (req, res) => {
  try {
    const { amount_paid, status } = req.body;
    const id = parseInt(req.params.id);

    let paymentStatus = status;
    if (!paymentStatus) {
      paymentStatus = amount_paid > 0 ? 'paid' : 'unpaid';
    }

    await stmts.updatePayment.run({
      id,
      amount_paid: parseFloat(amount_paid) || 0,
      status: paymentStatus
    });

    res.json({ message: 'تم تحديث الدفع بنجاح' });
  } catch (err) {
    console.error('Payment update error:', err);
    res.status(500).json({ error: 'حدث خطأ في تحديث بيانات الدفع' });
  }
});

router.post('/payments/generate', async (req, res) => {
  try {
    const { month, amountsByYear, amount_due } = req.body;

    if (!month) {
      return res.status(400).json({ error: 'يرجى تحديد الشهر' });
    }

    const payload = amountsByYear || parseFloat(amount_due) || 200;
    const count = await generateMonthlyPayments(month, payload);
    res.json({ message: `تم إنشاء ${count} سجل دفع جديد لشهر ${month}` });
  } catch (err) {
    console.error('Payment generate error:', err);
    res.status(500).json({ error: 'حدث خطأ في إنشاء سجلات الدفع' });
  }
});

router.get('/payments/months', async (req, res) => {
  try {
    const result = await stmts.getDistinctMonths.all();
    const months = result.map(m => m.month);
    res.json(months);
  } catch (err) {
    console.error('Payment months error:', err);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

module.exports = router;
