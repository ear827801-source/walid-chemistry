const fs = require('fs');
const path = require('path');
const supabase = require('../database/supabase');

const dataPath = path.join(__dirname, '../database/data.json');

async function migrateData() {
    console.log('Starting migration to Supabase...');

    if (!fs.existsSync(dataPath)) {
        console.error('data.json not found!');
        return;
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    // Migrate Groups
    console.log(`Migrating ${data.groups.length} groups...`);
    for (const group of data.groups) {
        const { id, name, school_year, lesson_day, lesson_time, max_students, current_count, is_active, created_at } = group;
        const { error } = await supabase.from('groups').upsert({
            id, name, school_year, lesson_day, lesson_time, max_students, current_count, is_active, created_at
        });
        if (error) console.error(`Error migrating group ${id}:`, error.message);
    }

    // Migrate Students
    console.log(`Migrating ${data.students.length} students...`);
    for (const student of data.students) {
        const { id, name, phone, school_year, group_id, registered_at } = student;
        const { error } = await supabase.from('students').upsert({
            id, name, phone, school_year, group_id, registered_at
        });
        if (error) console.error(`Error migrating student ${id}:`, error.message);
    }

    // Migrate Payments
    console.log(`Migrating ${data.payments.length} payments...`);
    for (const payment of data.payments) {
        const { id, student_id, month, amount_due, amount_paid, status, created_at, paid_at } = payment;
        const { error } = await supabase.from('payments').upsert({
            id, student_id, month, amount_due, amount_paid, status, created_at, paid_at
        });
        if (error) console.error(`Error migrating payment ${id}:`, error.message);
    }

    console.log('Migration completed!');
}

migrateData().catch(err => console.error(err));
