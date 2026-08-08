document.addEventListener('DOMContentLoaded', () => {
    

    // Set current date in overview
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('ar-EG', dateOptions);

    // Tab Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Update active state in nav
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Show corresponding tab
            const targetTab = item.dataset.tab;
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === `tab-${targetTab}`) {
                    pane.classList.add('active');
                }
            });

            // Load data for the selected tab
            loadTabData(targetTab);
        });
    });

    // Global Modal handling
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        });
    });

    // Initial load
    loadOverviewStats();
});

// Loading indicator functions
function showLoading() {
    document.getElementById('loadingIndicator').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingIndicator').style.display = 'none';
}

// Central tab data loader
function loadTabData(tabName) {
    showLoading();
    
    let loadPromise;
    switch (tabName) {
        case 'overview':
            loadPromise = loadOverviewStats();
            break;
        case 'groups':
            loadPromise = window.loadGroups ? window.loadGroups() : Promise.resolve();
            break;
        case 'students':
            loadPromise = window.loadStudents ? window.loadStudents() : Promise.resolve();
            break;
        case 'payments':
            loadPromise = window.loadPayments ? window.loadPayments() : Promise.resolve();
            break;
        default:
            loadPromise = Promise.resolve();
    }
    
    loadPromise.finally(hideLoading);
}

// Load Overview Statistics
async function loadOverviewStats() {
    try {
        const stats = await fetchAPI('/stats');
        
        // Update counters
        document.getElementById('stat-total-students').textContent = stats.totalStudents;
        document.getElementById('stat-total-groups').textContent = stats.totalGroups;
        document.getElementById('stat-total-collected').textContent = stats.totalCollected;
        
        // Update recent students table
        const tbody = document.getElementById('recent-students-tbody');
        tbody.innerHTML = '';
        
        if (stats.recentStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا يوجد طلاب مسجلين بعد</td></tr>';
            return;
        }
        
        stats.recentStudents.forEach(student => {
            const date = new Date(student.registered_at).toLocaleDateString('ar-EG');
            const row = `
                <tr>
                    <td>${student.name}</td>
                    <td dir="ltr" style="text-align: right;">${student.phone}</td>
                    <td>الصف ${student.school_year === 1 ? 'الأول' : student.school_year === 2 ? 'الثاني' : 'الثالث'}</td>
                    <td>${student.group_name || '-'}</td>
                    <td>${date}</td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });
        
    } catch (err) {
        console.error('Error loading stats:', err);
    }
}
