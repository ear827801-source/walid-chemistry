if (true) {
    const groupsTbody = document.getElementById('groups-tbody');
    const groupModal = document.getElementById('group-modal');
    const groupForm = document.getElementById('group-form');
    
    // Make loadGroups globally accessible to app.js
    window.loadGroups = async function() {
        try {
            const groups = await fetchAPI('/groups');
            renderGroupsTable(groups);
            
            // Also update the group filters in other tabs
            updateGroupFilters(groups);
        } catch (err) {
            console.error('Failed to load groups', err);
            alert('حدث خطأ في تحميل المجموعات');
        }
    };
    
    function renderGroupsTable(groups) {
        groupsTbody.innerHTML = '';
        
        if (groups.length === 0) {
            groupsTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">لا توجد مجموعات بعد</td></tr>';
            return;
        }
        
        groups.forEach(group => {
            const isFull = group.current_count >= group.max_students;
            const statusBadge = group.is_active 
                ? (isFull ? '<span class="badge badge-warning">مكتملة</span>' : '<span class="badge badge-success">متاحة</span>')
                : '<span class="badge badge-danger">مغلقة</span>';
                
            const yearStr = `الصف ${group.school_year === 1 ? 'الأول' : group.school_year === 2 ? 'الثاني' : 'الثالث'}`;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${group.name}</td>
                <td>${yearStr}</td>
                <td>${group.lesson_day}</td>
                <td dir="ltr" style="text-align: right;">${group.lesson_time}</td>
                <td>${group.current_count} / ${group.max_students}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn-icon edit-group" data-id="${group.id}" title="تعديل">
                        <ion-icon name="create-outline"></ion-icon>
                    </button>
                    <button class="btn-icon delete-group" data-id="${group.id}" style="color:var(--danger)" title="حذف">
                        <ion-icon name="trash-outline"></ion-icon>
                    </button>
                </td>
            `;
            groupsTbody.appendChild(tr);
        });
        
        // Add event listeners to buttons
        document.querySelectorAll('.edit-group').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const group = groups.find(g => g.id == id);
                if (group) openGroupModal(group);
            });
        });
        
        document.querySelectorAll('.delete-group').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                deleteGroup(id);
            });
        });
    }
    
    function updateGroupFilters(groups) {
        const filters = [
            document.getElementById('student-group-filter'),
            document.getElementById('payment-group-filter')
        ];
        
        filters.forEach(filter => {
            if (!filter) return;
            const currentVal = filter.value;
            filter.innerHTML = '<option value="">كل المجموعات</option>';
            
            groups.forEach(g => {
                const option = document.createElement('option');
                option.value = g.id;
                option.textContent = g.name;
                filter.appendChild(option);
            });
            
            filter.value = currentVal;
        });
    }
    
    function openGroupModal(group = null) {
        document.getElementById('group-modal-title').textContent = group ? 'تعديل مجموعة' : 'إضافة مجموعة جديدة';
        
        document.getElementById('group-id').value = group ? group.id : '';
        document.getElementById('group-name').value = group ? group.name : '';
        document.getElementById('group-year').value = group ? group.school_year : '1';
        
        if (group && group.lesson_day) {
            const parts = group.lesson_day.split(' و');
            document.getElementById('group-day-1').value = parts[0] ? parts[0].trim() : 'السبت';
            document.getElementById('group-day-2').value = parts[1] ? parts[1].trim() : 'الثلاثاء';
        } else {
            document.getElementById('group-day-1').value = 'السبت';
            document.getElementById('group-day-2').value = 'الثلاثاء';
        }

        document.getElementById('group-time').value = group ? group.lesson_time : '';
        document.getElementById('group-max').value = group ? group.max_students : '30';
        
        groupModal.classList.add('active');
    }
    
    document.getElementById('btn-add-group').addEventListener('click', () => {
        openGroupModal();
    });
    
    groupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('group-id').value;
        const day1 = document.getElementById('group-day-1').value;
        const day2 = document.getElementById('group-day-2').value;
        const lesson_day = day1 === day2 ? day1 : `${day1} و${day2}`;

        const groupData = {
            name: document.getElementById('group-name').value,
            school_year: document.getElementById('group-year').value,
            lesson_day: lesson_day,
            lesson_time: document.getElementById('group-time').value,
            max_students: document.getElementById('group-max').value
        };
        
        try {
            showLoading();
            if (id) {
                await fetchAPI(`/groups/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(groupData)
                });
            } else {
                await fetchAPI('/groups', {
                    method: 'POST',
                    body: JSON.stringify(groupData)
                });
            }
            
            groupModal.classList.remove('active');
            window.loadGroups();
        } catch (err) {
            alert(err.message);
        } finally {
            hideLoading();
        }
    });
    
    async function deleteGroup(id) {
        if (!confirm('هل أنت متأكد من حذف هذه المجموعة؟ لا يمكن التراجع عن هذا الإجراء.')) return;
        
        try {
            showLoading();
            await fetchAPI(`/groups/${id}`, { method: 'DELETE' });
            window.loadGroups();
        } catch (err) {
            alert(err.message);
            hideLoading();
        }
    }
}
