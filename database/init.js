const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, 'data.json');

// Initialize data if not exists
if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({ groups: [], students: [], payments: [] }));
}

function readDb() {
    return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}

function writeDb(data) {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

function generateId(tableData) {
    return tableData.length > 0 ? Math.max(...tableData.map(r => r.id)) + 1 : 1;
}

// Emulate prepared statements
const stmts = {
    // Groups
    getAllGroups: {
        all: () => {
            const db = readDb();
            return db.groups.sort((a,b) => a.school_year - b.school_year || a.lesson_day.localeCompare(b.lesson_day));
        }
    },
    getActiveGroups: {
        all: () => {
            const db = readDb();
            return db.groups.filter(g => g.is_active === 1).sort((a,b) => a.school_year - b.school_year);
        }
    },
    getGroupsByYear: {
        all: (year) => {
            const db = readDb();
            return db.groups.filter(g => g.is_active === 1 && g.school_year == year);
        }
    },
    getGroupById: {
        get: (id) => {
            const db = readDb();
            return db.groups.find(g => g.id == id);
        }
    },
    insertGroup: {
        run: (data) => {
            const db = readDb();
            const newGroup = {
                id: generateId(db.groups),
                name: data.name,
                school_year: parseInt(data.school_year),
                lesson_day: data.lesson_day,
                lesson_time: data.lesson_time,
                max_students: parseInt(data.max_students) || 30,
                current_count: 0,
                is_active: 1,
                created_at: new Date().toISOString()
            };
            db.groups.push(newGroup);
            writeDb(db);
            return { lastInsertRowid: newGroup.id };
        }
    },
    updateGroup: {
        run: (data) => {
            const db = readDb();
            const index = db.groups.findIndex(g => g.id == data.id);
            if (index !== -1) {
                db.groups[index] = { ...db.groups[index], ...data };
                db.groups[index].school_year = parseInt(db.groups[index].school_year);
                writeDb(db);
            }
        }
    },
    deleteGroup: {
        run: (id) => {
            const db = readDb();
            const index = db.groups.findIndex(g => g.id == id);
            if (index !== -1) {
                db.groups[index].is_active = 0;
                writeDb(db);
            }
        }
    },

    // Students
    getAllStudents: {
        all: () => {
            const db = readDb();
            return db.students.map(s => {
                const group = db.groups.find(g => g.id === s.group_id);
                return { ...s, group_name: group ? group.name : null, lesson_day: group ? group.lesson_day : null, lesson_time: group ? group.lesson_time : null };
            }).sort((a, b) => new Date(b.registered_at) - new Date(a.registered_at));
        }
    },
    getStudentsByGroup: {
        all: (groupId) => {
            const db = readDb();
            return db.students.filter(s => s.group_id == groupId).map(s => {
                const group = db.groups.find(g => g.id === s.group_id);
                return { ...s, group_name: group ? group.name : null };
            });
        }
    },
    getStudentsByYear: {
        all: (year) => {
            const db = readDb();
            return db.students.filter(s => s.school_year == year).map(s => {
                const group = db.groups.find(g => g.id === s.group_id);
                return { ...s, group_name: group ? group.name : null };
            });
        }
    },
    getStudentByPhone: {
        get: (phone) => {
            const db = readDb();
            return db.students.find(s => s.phone === phone);
        }
    },
    getStudentById: {
        get: (id) => {
            const db = readDb();
            return db.students.find(s => s.id == id);
        }
    },
    insertStudent: {
        run: (data) => {
            const db = readDb();
            const newStudent = {
                id: generateId(db.students),
                name: data.name,
                phone: data.phone,
                school_year: parseInt(data.school_year),
                group_id: parseInt(data.group_id),
                registered_at: new Date().toISOString()
            };
            db.students.push(newStudent);
            
            const group = db.groups.find(g => g.id == data.group_id);
            if (group) group.current_count++;
            
            writeDb(db);
            return { lastInsertRowid: newStudent.id };
        }
    },
    deleteStudent: {
        run: (id) => {
            const db = readDb();
            const index = db.students.findIndex(s => s.id == id);
            if (index !== -1) {
                const student = db.students[index];
                db.students.splice(index, 1);
                
                const group = db.groups.find(g => g.id == student.group_id);
                if (group && group.current_count > 0) group.current_count--;
                
                writeDb(db);
            }
        }
    },

    // Payments
    getPaymentsByMonth: {
        all: (month) => {
            const db = readDb();
            return db.payments.filter(p => p.month === month).map(p => {
                const student = db.students.find(s => s.id == p.student_id);
                const group = student ? db.groups.find(g => g.id == student.group_id) : null;
                return { 
                    ...p, 
                    student_name: student ? student.name : null, 
                    phone: student ? student.phone : null,
                    group_name: group ? group.name : null 
                };
            });
        }
    },
    getPaymentsByGroupAndMonth: {
        all: (groupId, month) => {
            const db = readDb();
            return db.payments.filter(p => p.month === month).filter(p => {
                const student = db.students.find(s => s.id == p.student_id);
                return student && student.group_id == groupId;
            }).map(p => {
                const student = db.students.find(s => s.id == p.student_id);
                const group = db.groups.find(g => g.id == student.group_id);
                return { 
                    ...p, 
                    student_name: student.name, 
                    phone: student.phone,
                    group_name: group.name 
                };
            });
        }
    },
    updatePayment: {
        run: (data) => {
            const db = readDb();
            const index = db.payments.findIndex(p => p.id == data.id);
            if (index !== -1) {
                db.payments[index].amount_paid = data.amount_paid;
                db.payments[index].status = data.status;
                if (data.status === 'paid') db.payments[index].paid_at = new Date().toISOString();
                writeDb(db);
            }
        }
    },
    insertPayment: {
        run: (data) => {
            const db = readDb();
            const existing = db.payments.find(p => p.student_id == data.student_id && p.month === data.month);
            if (!existing) {
                db.payments.push({
                    id: generateId(db.payments),
                    student_id: data.student_id,
                    month: data.month,
                    amount_due: data.amount_due,
                    amount_paid: 0,
                    status: 'unpaid',
                    created_at: new Date().toISOString()
                });
                writeDb(db);
                return { changes: 1 };
            }
            return { changes: 0 };
        }
    },

    // Stats
    getTotalStudents: { get: () => ({ count: readDb().students.length }) },
    getTotalGroups: { get: () => ({ count: readDb().groups.filter(g => g.is_active === 1).length }) },
    getPaidCount: { get: (month) => ({ count: readDb().payments.filter(p => p.month === month && p.status === 'paid').length }) },
    getUnpaidCount: { get: (month) => ({ count: readDb().payments.filter(p => p.month === month && p.status !== 'paid').length }) },
    getTotalCollected: { get: (month) => ({ total: readDb().payments.filter(p => p.month === month).reduce((sum, p) => sum + Number(p.amount_paid), 0) }) },
    getRecentStudents: {
        all: () => {
            const db = readDb();
            return db.students.sort((a, b) => new Date(b.registered_at) - new Date(a.registered_at)).slice(0, 10).map(s => {
                const group = db.groups.find(g => g.id === s.group_id);
                return { ...s, group_name: group ? group.name : null };
            });
        }
    },
    getAllStudentIds: { all: () => readDb().students.map(s => ({ id: s.id })) },
    getDistinctMonths: {
        all: () => {
            const db = readDb();
            const months = [...new Set(db.payments.map(p => p.month))];
            return months.sort().reverse().map(m => ({ month: m }));
        }
    }
};

const bookStudent = (studentData) => {
    const db = readDb();
    const group = db.groups.find(g => g.id == studentData.group_id);
    if (!group) throw new Error('GROUP_NOT_FOUND');
    if (group.is_active !== 1) throw new Error('GROUP_INACTIVE');
    if (group.current_count >= group.max_students) throw new Error('GROUP_FULL');

    if (db.students.find(s => s.phone === studentData.phone)) throw new Error('ALREADY_REGISTERED');

    const result = stmts.insertStudent.run(studentData);
    return { studentId: result.lastInsertRowid, group };
};

const removeStudent = (studentId) => {
    const db = readDb();
    const student = db.students.find(s => s.id == studentId);
    if (!student) throw new Error('STUDENT_NOT_FOUND');
    stmts.deleteStudent.run(studentId);
    return student;
};

const generateMonthlyPayments = (month, amountDue) => {
    const db = readDb();
    let count = 0;
    db.students.forEach(student => {
        const existing = db.payments.find(p => p.student_id == student.id && p.month === month);
        if (!existing) {
            db.payments.push({
                id: generateId(db.payments),
                student_id: student.id,
                month: month,
                amount_due: amountDue,
                amount_paid: 0,
                status: 'unpaid',
                created_at: new Date().toISOString()
            });
            count++;
        }
    });
    if (count > 0) writeDb(db);
    return count;
};

module.exports = {
    db: null, // No longer used directly
    stmts,
    bookStudent,
    removeStudent,
    generateMonthlyPayments
};
