const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { stmts, removeStudent, generateMonthlyPayments, bookStudent } = require('../database/init');

// All API routes require authentication
router.use(authMiddleware);

// ═══════════════════════════════════════
//  DASHBOARD STATS
// ═══════════════════════════════════════

/**
 * GET /api/stats
 * Returns overview statistics for the dashboard.
 */
router.get('/stats', (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // e.g., "2026-08"

    const totalStudents = stmts.getTotalStudents.get().count;
    const totalGroups = stmts.getTotalGroups.get().count;
    const paidCount = stmts.getPaidCount.get(currentMonth).count;
    const unpaidCount = stmts.getUnpaidCount.get(currentMonth).count;
    const totalCollected = stmts.getTotalCollected.get(currentMonth).total;
    const recentStudents = stmts.getRecentStudents.all();

    res.json({
      totalStudents,
      totalGroups,
      paidCount,
      unpaidCount,
      totalCollected,
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

/**
 * GET /api/groups
 * List all groups, optionally filtered by year or active status.
 */
router.get('/groups', (req, res) => {
  try {
    const { year, active } = req.query;

    let groups;
    if (year) {
      groups = stmts.getGroupsByYear.all(parseInt(year));
    } else if (active === 'true') {
      groups = stmts.getActiveGroups.all();
    } else {
      groups = stmts.getAllGroups.all();
    }

    res.json(groups);
  } catch (err) {
    console.error('Groups list error:', err);
    res.status(500).json({ error: 'حدث خطأ في جلب المجموعات' });
  }
});

/**
 * POST /api/groups
 * Create a new group.
 */
router.post('/groups', (req, res) => {
  try {
    const { name, school_year, lesson_day, lesson_time, max_students } = req.body;

    if (!name || !school_year || !lesson_day || !lesson_time) {
      return res.status(400).json({ error: 'يرجى ملء جميع الحقول المطلوبة' });
    }

    const result = stmts.insertGroup.run({
      name,
      school_year: parseInt(school_year),
      lesson_day,
      lesson_time,
      max_students: parseInt(max_students) || 30
    });

    const group = stmts.getGroupById.get(result.lastInsertRowid);
    res.status(201).json(group);
  } catch (err) {
    console.error('Group create error:', err);
    res.status(500).json({ error: 'حدث خطأ في إنشاء المجموعة' });
  }
});

/**
 * PUT /api/groups/:id
 * Update an existing group.
 */
router.put('/groups/:id', (req, res) => {
  try {
    const { name, school_year, lesson_day, lesson_time, max_students } = req.body;
    const id = parseInt(req.params.id);

    const existing = stmts.getGroupById.get(id);
    if (!existing) {
      return res.status(404).json({ error: 'المجموعة غير موجودة' });
    }

    stmts.updateGroup.run({
      id,
      name: name || existing.name,
      school_year: parseInt(school_year) || existing.school_year,
      lesson_day: lesson_day || existing.lesson_day,
      lesson_time: lesson_time || existing.lesson_time,
      max_students: parseInt(max_students) || existing.max_students
    });

    const updated = stmts.getGroupById.get(id);
    res.json(updated);
  } catch (err) {
    console.error('Group update error:', err);
    res.status(500).json({ error: 'حدث خطأ في تحديث المجموعة' });
  }
});

/**
 * DELETE /api/groups/:id
 * Soft-delete a group (marks as inactive).
 */
router.delete('/groups/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = stmts.getGroupById.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'المجموعة غير موجودة' });
    }

    stmts.deleteGroup.run(id);
    res.json({ message: 'تم حذف المجموعة بنجاح' });
  } catch (err) {
    console.error('Group delete error:', err);
    res.status(500).json({ error: 'حدث خطأ في حذف المجموعة' });
  }
});

// ═══════════════════════════════════════
//  STUDENTS MANAGEMENT
// ═══════════════════════════════════════

/**
 * GET /api/students
 * List all students, optionally filtered by group or year.
 */
router.get('/students', (req, res) => {
  try {
    const { group_id, year, search } = req.query;
    let students;

    if (group_id) {
      students = stmts.getStudentsByGroup.all(parseInt(group_id));
    } else if (year) {
      students = stmts.getStudentsByYear.all(parseInt(year));
    } else {
      students = stmts.getAllStudents.all();
    }

    // Apply search filter if provided
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

/**
 * POST /api/students
 * Manually add a student (from dashboard).
 */
router.post('/students', (req, res) => {
  try {
    const { name, phone, school_year, group_id } = req.body;

    if (!name || !phone || !school_year || !group_id) {
      return res.status(400).json({ error: 'يرجى ملء جميع الحقول المطلوبة' });
    }

    const result = bookStudent({
      name,
      phone,
      school_year: parseInt(school_year),
      group_id: parseInt(group_id)
    });

    const student = stmts.getStudentByPhone.get(phone);
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

/**
 * DELETE /api/students/:id
 * Remove a student and decrement group count.
 */
router.delete('/students/:id', (req, res) => {
  try {
    const student = removeStudent(parseInt(req.params.id));
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

/**
 * GET /api/payments
 * List payments, filtered by month and optionally by group.
 */
router.get('/payments', (req, res) => {
  try {
    const { month, group_id } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    let payments;
    if (group_id) {
      payments = stmts.getPaymentsByGroupAndMonth.all(parseInt(group_id), targetMonth);
    } else {
      payments = stmts.getPaymentsByMonth.all(targetMonth);
    }

    res.json({ month: targetMonth, payments });
  } catch (err) {
    console.error('Payments list error:', err);
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات الدفع' });
  }
});

/**
 * PUT /api/payments/:id
 * Update payment status (mark as paid/partial/unpaid).
 */
router.put('/payments/:id', (req, res) => {
  try {
    const { amount_paid, status } = req.body;
    const id = parseInt(req.params.id);

    let paymentStatus = status;
    if (!paymentStatus) {
      // Auto-determine status based on amount
      paymentStatus = amount_paid > 0 ? 'paid' : 'unpaid';
    }

    stmts.updatePayment.run({
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

/**
 * POST /api/payments/generate
 * Generate payment records for all students for a given month.
 */
router.post('/payments/generate', (req, res) => {
  try {
    const { month, amount_due } = req.body;

    if (!month || amount_due === undefined) {
      return res.status(400).json({ error: 'يرجى تحديد الشهر والمبلغ المطلوب' });
    }

    const count = generateMonthlyPayments(month, parseFloat(amount_due));
    res.json({ message: `تم إنشاء ${count} سجل دفع جديد لشهر ${month}` });
  } catch (err) {
    console.error('Payment generate error:', err);
    res.status(500).json({ error: 'حدث خطأ في إنشاء سجلات الدفع' });
  }
});

/**
 * GET /api/payments/months
 * Get list of months that have payment records.
 */
router.get('/payments/months', (req, res) => {
  try {
    const months = stmts.getDistinctMonths.all().map(m => m.month);
    res.json(months);
  } catch (err) {
    console.error('Payment months error:', err);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

module.exports = router;
