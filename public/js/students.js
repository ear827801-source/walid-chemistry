if (true) {
    const studentsTbody = document.getElementById('students-tbody');
    const searchInput = document.getElementById('student-search');
    const yearFilter = document.getElementById('student-year-filter');
    const groupFilter = document.getElementById('student-group-filter');
    
    window.loadStudents = async function() {
        try {
            const year = yearFilter.value;
            const groupId = groupFilter.value;
            const search = searchInput.value;
            
            let query = '?';
            if (year) query += `year=${year}&`;
            if (groupId) query += `group_id=${groupId}&`;
            if (search) query += `search=${encodeURIComponent(search)}`;
            
            const students = await fetchAPI(`/students${query}`);
            renderStudentsTable(students);
        } catch (err) {
            console.error('Failed to load students', err);
            alert('حدث خطأ في تحميل الطلاب');
        }
    };
    
    function renderStudentsTable(students) {
        studentsTbody.innerHTML = '';
        
        if (students.length === 0) {
            studentsTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا يوجد طلاب مطابقين للبحث</td></tr>';
            return;
        }
        
        students.forEach(student => {
            const date = new Date(student.registered_at).toLocaleDateString('ar-EG');
            const yearStr = `الصف ${student.school_year === 1 ? 'الأول' : student.school_year === 2 ? 'الثاني' : 'الثالث'}`;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${student.name}</td>
                <td dir="ltr" style="text-align: right;">${student.phone}</td>
                <td>${yearStr}</td>
                <td>${student.group_name || '-'}</td>
                <td>${date}</td>
                <td>
                    <button class="btn-icon delete-student" data-id="${student.id}" style="color:var(--danger)" title="حذف الطالب">
                        <ion-icon name="person-remove-outline"></ion-icon>
                    </button>
                </td>
            `;
            studentsTbody.appendChild(tr);
        });
        
        document.querySelectorAll('.delete-student').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                deleteStudent(id);
            });
        });
    }
    
    async function deleteStudent(id) {
        if (!confirm('هل أنت متأكد من حذف هذا الطالب؟')) return;
        
        try {
            showLoading();
            await fetchAPI(`/students/${id}`, { method: 'DELETE' });
            window.loadStudents();
        } catch (err) {
            alert(err.message);
            hideLoading();
        }
    }
    
    // Add event listeners for filters with debounce for search
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            window.loadStudents();
        }, 500);
    });
    
    yearFilter.addEventListener('change', window.loadStudents);
    groupFilter.addEventListener('change', window.loadStudents);
}
