const supabase = require('./supabase');

// Emulate prepared statements asynchronously
const stmts = {
    // Groups
    getAllGroups: {
        all: async () => {
            const { data, error } = await supabase.from('groups').select('*').order('school_year', { ascending: true }).order('lesson_day', { ascending: true });
            if (error) throw error;
            return data;
        }
    },
    getActiveGroups: {
        all: async () => {
            const { data, error } = await supabase.from('groups').select('*').eq('is_active', 1).order('school_year', { ascending: true });
            if (error) throw error;
            return data;
        }
    },
    getGroupsByYear: {
        all: async (year) => {
            const { data, error } = await supabase.from('groups').select('*').eq('is_active', 1).eq('school_year', year);
            if (error) throw error;
            return data;
        }
    },
    getGroupById: {
        get: async (id) => {
            const { data, error } = await supabase.from('groups').select('*').eq('id', id).single();
            if (error) return null;
            return data;
        }
    },
    insertGroup: {
        run: async (data) => {
            const newGroup = {
                name: data.name,
                school_year: parseInt(data.school_year),
                lesson_day: data.lesson_day,
                lesson_time: data.lesson_time,
                max_students: parseInt(data.max_students) || 30,
                current_count: 0,
                is_active: 1
            };
            const { data: inserted, error } = await supabase.from('groups').insert(newGroup).select('id').single();
            if (error) throw error;
            return { lastInsertRowid: inserted.id };
        }
    },
    updateGroup: {
        run: async (data) => {
            const { error } = await supabase.from('groups').update({
                name: data.name,
                school_year: data.school_year ? parseInt(data.school_year) : undefined,
                lesson_day: data.lesson_day,
                lesson_time: data.lesson_time,
                max_students: data.max_students ? parseInt(data.max_students) : undefined
            }).eq('id', data.id);
            if (error) throw error;
        }
    },
    deleteGroup: {
        run: async (id) => {
            const { error } = await supabase.from('groups').update({ is_active: 0 }).eq('id', id);
            if (error) throw error;
        }
    },

    // Students
    getAllStudents: {
        all: async () => {
            const { data, error } = await supabase.from('students').select(`
                *,
                groups (name, lesson_day, lesson_time)
            `).order('registered_at', { ascending: false });
            if (error) throw error;
            return data.map(s => ({
                ...s,
                group_name: s.groups?.name || null,
                lesson_day: s.groups?.lesson_day || null,
                lesson_time: s.groups?.lesson_time || null
            }));
        }
    },
    getStudentsByGroup: {
        all: async (groupId) => {
            const { data, error } = await supabase.from('students').select(`
                *,
                groups (name)
            `).eq('group_id', groupId);
            if (error) throw error;
            return data.map(s => ({ ...s, group_name: s.groups?.name || null }));
        }
    },
    getStudentsByYear: {
        all: async (year) => {
            const { data, error } = await supabase.from('students').select(`
                *,
                groups (name)
            `).eq('school_year', year);
            if (error) throw error;
            return data.map(s => ({ ...s, group_name: s.groups?.name || null }));
        }
    },
    getStudentByPhone: {
        get: async (phone) => {
            const { data, error } = await supabase.from('students').select(`
                *,
                groups (name)
            `).eq('phone', phone).single();
            if (error) return null;
            return { ...data, group_name: data.groups?.name || null };
        }
    },
    getStudentById: {
        get: async (id) => {
            const { data, error } = await supabase.from('students').select('*').eq('id', id).single();
            if (error) return null;
            return data;
        }
    },
    deleteStudent: {
        run: async (id) => {
            const student = await stmts.getStudentById.get(id);
            if (!student) return;
            
            const { error } = await supabase.from('students').delete().eq('id', id);
            if (error) throw error;
            
            // Decrement group count
            if (student.group_id) {
                const group = await stmts.getGroupById.get(student.group_id);
                if (group && group.current_count > 0) {
                    await supabase.from('groups').update({ current_count: group.current_count - 1 }).eq('id', group.id);
                }
            }
        }
    },

    // Payments
    getPaymentsByMonth: {
        all: async (month) => {
            const { data, error } = await supabase.from('payments').select(`
                *,
                students (name, phone, groups(name))
            `).eq('month', month);
            if (error) throw error;
            return data.map(p => ({
                ...p,
                student_name: p.students?.name || null,
                phone: p.students?.phone || null,
                group_name: p.students?.groups?.name || null
            }));
        }
    },
    getPaymentsByGroupAndMonth: {
        all: async (groupId, month) => {
            // First get students in group
            const { data: students, error: err1 } = await supabase.from('students').select('id').eq('group_id', groupId);
            if (err1) throw err1;
            
            if (!students || students.length === 0) return [];
            const studentIds = students.map(s => s.id);

            const { data, error } = await supabase.from('payments').select(`
                *,
                students (name, phone, groups(name))
            `).eq('month', month).in('student_id', studentIds);
            
            if (error) throw error;
            return data.map(p => ({
                ...p,
                student_name: p.students?.name || null,
                phone: p.students?.phone || null,
                group_name: p.students?.groups?.name || null
            }));
        }
    },
    updatePayment: {
        run: async (data) => {
            const payload = {
                amount_paid: data.amount_paid,
                status: data.status
            };
            if (data.status === 'paid') {
                payload.paid_at = new Date().toISOString();
            }
            const { error } = await supabase.from('payments').update(payload).eq('id', data.id);
            if (error) throw error;
        }
    },

    // Stats
    getTotalStudents: { 
        get: async () => {
            const { count, error } = await supabase.from('students').select('*', { count: 'exact', head: true });
            if (error) throw error;
            return { count };
        }
    },
    getTotalGroups: { 
        get: async () => {
            const { count, error } = await supabase.from('groups').select('*', { count: 'exact', head: true }).eq('is_active', 1);
            if (error) throw error;
            return { count };
        }
    },
    getPaidCount: { 
        get: async (month) => {
            const { count, error } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('month', month).eq('status', 'paid');
            if (error) throw error;
            return { count };
        }
    },
    getUnpaidCount: { 
        get: async (month) => {
            const { count, error } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('month', month).neq('status', 'paid');
            if (error) throw error;
            return { count };
        }
    },
    getTotalCollected: { 
        get: async (month) => {
            const { data, error } = await supabase.from('payments').select('amount_paid').eq('month', month);
            if (error) throw error;
            const total = data.reduce((sum, p) => sum + Number(p.amount_paid), 0);
            return { total };
        }
    },
    getRecentStudents: {
        all: async () => {
            const { data, error } = await supabase.from('students').select(`
                *,
                groups (name)
            `).order('registered_at', { ascending: false }).limit(10);
            if (error) throw error;
            return data.map(s => ({ ...s, group_name: s.groups?.name || null }));
        }
    },
    getDistinctMonths: {
        all: async () => {
            const { data, error } = await supabase.from('payments').select('month');
            if (error) throw error;
            const months = [...new Set(data.map(p => p.month))];
            return months.sort().reverse().map(m => ({ month: m }));
        }
    }
};

const bookStudent = async (studentData) => {
    const group = await stmts.getGroupById.get(studentData.group_id);
    if (!group) throw new Error('GROUP_NOT_FOUND');
    if (group.is_active !== 1) throw new Error('GROUP_INACTIVE');
    if (group.current_count >= group.max_students) throw new Error('GROUP_FULL');

    const newStudent = {
        name: studentData.name,
        school_year: parseInt(studentData.school_year),
        group_id: parseInt(studentData.group_id)
    };

    // Use a unique phone key: base phone for first registration, phone_timestamp for subsequent ones
    let phoneKey = studentData.phone;
    let { data: inserted, error } = await supabase.from('students').insert({...newStudent, phone: phoneKey}).select('id').single();
    
    // If unique constraint violated, retry with a unique suffix (allows same phone to register multiple students)
    if (error && error.code === '23505') {
        phoneKey = `${studentData.phone}_${Date.now()}`;
        const retry = await supabase.from('students').insert({...newStudent, phone: phoneKey}).select('id').single();
        if (retry.error) throw retry.error;
        inserted = retry.data;
        error = null;
    } else if (error) {
        throw error;
    }

    // Increment group current_count
    await supabase.from('groups').update({ current_count: group.current_count + 1 }).eq('id', group.id);

    return { studentId: inserted.id, group };
};

const removeStudent = async (studentId) => {
    const student = await stmts.getStudentById.get(studentId);
    if (!student) throw new Error('STUDENT_NOT_FOUND');
    await stmts.deleteStudent.run(studentId);
    return student;
};

const generateMonthlyPayments = async (month, amountDue) => {
    const { data: students, error: err1 } = await supabase.from('students').select('id');
    if (err1) throw err1;

    let count = 0;
    
    // Batch insert approach to avoid too many DB calls
    const payload = [];
    
    // Check existing for this month
    const { data: existing, error: err2 } = await supabase.from('payments').select('student_id').eq('month', month);
    if (err2) throw err2;
    
    const existingIds = new Set(existing.map(p => p.student_id));

    for (const student of students) {
        if (!existingIds.has(student.id)) {
            payload.push({
                student_id: student.id,
                month: month,
                amount_due: amountDue,
                amount_paid: 0,
                status: 'unpaid'
            });
            count++;
        }
    }

    if (payload.length > 0) {
        const { error: err3 } = await supabase.from('payments').insert(payload);
        if (err3) throw err3;
    }

    return count;
};

module.exports = {
    stmts,
    bookStudent,
    removeStudent,
    generateMonthlyPayments
};
