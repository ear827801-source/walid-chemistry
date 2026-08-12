if (true) {
    const paymentsTbody = document.getElementById('payments-tbody');
    const monthFilter = document.getElementById('payment-month-filter');
    const groupFilter = document.getElementById('payment-group-filter');
    const searchInput = document.getElementById('payment-search-input');
    
    const generateModal = document.getElementById('payment-generate-modal');
    const generateForm = document.getElementById('payment-generate-form');
    
    const updateModal = document.getElementById('payment-update-modal');
    const updateForm = document.getElementById('payment-update-form');
    
    let currentPayments = [];
    let activeStatusFilter = null; // null (all), 'paid', 'partial', 'unpaid'

    // Initialize months dropdown
    async function initMonths() {
        try {
            const months = await fetchAPI('/payments/months');
            const currentMonth = new Date().toISOString().slice(0, 7);
            
            monthFilter.innerHTML = '';
            
            if (!months.includes(currentMonth)) {
                months.unshift(currentMonth);
            }
            
            months.forEach(m => {
                const option = document.createElement('option');
                option.value = m;
                option.textContent = m;
                monthFilter.appendChild(option);
            });
            
            monthFilter.value = currentMonth;
        } catch (err) {
            console.error('Failed to init months', err);
        }
    }

    // Populate groups filter dropdown
    async function initGroupFilter() {
        try {
            if (groupFilter.options.length <= 1) {
                const groups = await fetchAPI('/groups');
                groupFilter.innerHTML = '<option value="">كل المجموعات</option>';
                groups.forEach(g => {
                    const opt = document.createElement('option');
                    opt.value = g.id;
                    opt.textContent = g.name;
                    groupFilter.appendChild(opt);
                });
            }
        } catch (err) {
            console.error('Failed to load groups for filter', err);
        }
    }

    // Setup filter badge click listeners (الكل، تم الدفع، دفع جزئي، لم يتم الدفع)
    function setupStatusFilterBadges() {
        const badges = {
            all: document.getElementById('pay-stat-all-btn'),
            paid: document.getElementById('pay-stat-paid-btn'),
            partial: document.getElementById('pay-stat-partial-btn'),
            unpaid: document.getElementById('pay-stat-unpaid-btn')
        };

        const setStatusFilter = (status) => {
            activeStatusFilter = status;
            
            // Update active styles
            Object.keys(badges).forEach(key => {
                if (badges[key]) {
                    if ((key === 'all' && activeStatusFilter === null) || key === activeStatusFilter) {
                        badges[key].classList.add('active');
                    } else {
                        badges[key].classList.remove('active');
                    }
                }
            });

            renderPaymentsTable(currentPayments);
        };

        if (badges.all) badges.all.addEventListener('click', () => setStatusFilter(null));
        if (badges.paid) badges.paid.addEventListener('click', () => setStatusFilter('paid'));
        if (badges.partial) badges.partial.addEventListener('click', () => setStatusFilter('partial'));
        if (badges.unpaid) badges.unpaid.addEventListener('click', () => setStatusFilter('unpaid'));
    }
    
    // Call init on load
    initMonths();
    initGroupFilter();
    setupStatusFilterBadges();
    
    window.loadPayments = async function() {
        try {
            await initGroupFilter();
            const month = monthFilter.value || new Date().toISOString().slice(0, 7);
            const groupId = groupFilter.value;
            
            let query = `?month=${month}`;
            if (groupId) query += `&group_id=${groupId}`;
            
            const data = await fetchAPI(`/payments${query}`);
            currentPayments = data.payments || [];
            renderPaymentsTable(currentPayments);
        } catch (err) {
            console.error('Failed to load payments', err);
            alert('حدث خطأ في تحميل سجلات الدفع');
        }
    };
    
    function renderPaymentsTable(payments) {
        paymentsTbody.innerHTML = '';
        
        let paidCount = 0;
        let partialCount = 0;
        let unpaidCount = 0;

        const searchTerm = (searchInput ? searchInput.value : '').trim().toLowerCase();
        
        // Calculate counts across all records for the month/group
        payments.forEach(payment => {
            if (payment.status === 'paid') paidCount++;
            else if (payment.status === 'partial') partialCount++;
            else unpaidCount++;
        });

        // Filter payments by search term and selected status badge
        const filteredPayments = payments.filter(p => {
            // Filter by search
            if (searchTerm && !(p.student_name || '').toLowerCase().includes(searchTerm) &&
                !(p.group_name || '').toLowerCase().includes(searchTerm)) {
                return false;
            }
            // Filter by status badge click
            if (activeStatusFilter && p.status !== activeStatusFilter) {
                return false;
            }
            return true;
        });
        
        if (filteredPayments.length === 0) {
            paymentsTbody.innerHTML = `
                <tr><td colspan="6" style="text-align:center;">
                    لا توجد سجلات تطابق الفلتر المحدد.<br>
                    انقر على "الكل" لإظهار جميع الطلاب، أو انقر على "إنشاء كشف الشهر" لتوليد كشف جديد.
                </td></tr>`;
        } else {
            filteredPayments.forEach((payment, idx) => {
                let badgeClass = 'badge-danger';
                let statusText = 'لم يتم الدفع';
                
                if (payment.status === 'paid') {
                    badgeClass = 'badge-success';
                    statusText = 'تم الدفع ✓';
                } else if (payment.status === 'partial') {
                    badgeClass = 'badge-warning';
                    statusText = 'دفع جزئي ⚠️';
                }
                
                const tr = document.createElement('tr');
                tr.classList.add('payment-row-clickable');
                tr.title = 'اضغط على الحالة للتعليم كمدفوع | كليك يمين لتسجيل دفع جزئي أو تعديل المبلغ';
                
                tr.innerHTML = `
                    <td style="text-align: center; font-weight: bold; color: var(--accent-2);">${idx + 1}</td>
                    <td style="font-weight: 600;">${payment.student_name}</td>
                    <td>${payment.group_name || '-'}</td>
                    <td>${payment.amount_due} ج.م</td>
                    <td>${payment.amount_paid} ج.م</td>
                    <td>
                        <span class="badge ${badgeClass} direct-status-btn" 
                              style="cursor: pointer; user-select: none; transition: transform 0.15s ease;"
                              title="كليك شمال: تحويل إلى (تم الدفع) | كليك يمين: تحديد دفع جزئي">
                            ${statusText}
                        </span>
                    </td>
                `;

                // Direct action on status badge click (Left Click = Mark Paid / Unpaid toggle)
                const statusBadge = tr.querySelector('.direct-status-btn');
                statusBadge.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const newStatus = payment.status === 'paid' ? 'unpaid' : 'paid';
                    const newAmount = newStatus === 'paid' ? payment.amount_due : 0;
                    
                    try {
                        showLoading();
                        await fetchAPI(`/payments/${payment.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ amount_paid: newAmount, status: newStatus })
                        });
                        window.loadPayments();
                        if (typeof loadOverviewStats === 'function') loadOverviewStats();
                    } catch (err) {
                        alert(err.message);
                    } finally {
                        hideLoading();
                    }
                });

                // Right click (contextmenu) anywhere on row or badge to open modal for partial payment
                tr.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    openUpdateModal(payment.id, payment.student_name, payment.amount_paid, payment.status);
                });

                // Also allow left click on row to open modal
                tr.addEventListener('click', (e) => {
                    if (e.target.classList.contains('direct-status-btn')) return;
                    openUpdateModal(payment.id, payment.student_name, payment.amount_paid, payment.status);
                });

                paymentsTbody.appendChild(tr);
            });
        }
        
        // Update mini stats counters
        const allElem = document.getElementById('pay-stat-all');
        const paidElem = document.getElementById('pay-stat-paid');
        const partialElem = document.getElementById('pay-stat-partial');
        const unpaidElem = document.getElementById('pay-stat-unpaid');

        if (allElem) allElem.textContent = payments.length;
        if (paidElem) paidElem.textContent = paidCount;
        if (partialElem) partialElem.textContent = partialCount;
        if (unpaidElem) unpaidElem.textContent = unpaidCount;
    }
    
    // Event listeners for filters and search
    monthFilter.addEventListener('change', window.loadPayments);
    groupFilter.addEventListener('change', window.loadPayments);
    if (searchInput) {
        searchInput.addEventListener('input', () => renderPaymentsTable(currentPayments));
    }
    
    document.getElementById('btn-generate-payments').addEventListener('click', () => {
        document.getElementById('generate-month').value = new Date().toISOString().slice(0, 7);
        generateModal.classList.add('active');
    });
    
    generateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const month = document.getElementById('generate-month').value;
        const amount1 = document.getElementById('generate-amount-1') ? document.getElementById('generate-amount-1').value : 200;
        const amount2 = document.getElementById('generate-amount-2') ? document.getElementById('generate-amount-2').value : 220;
        const amount3 = document.getElementById('generate-amount-3') ? document.getElementById('generate-amount-3').value : 250;
        
        try {
            showLoading();
            const res = await fetchAPI('/payments/generate', {
                method: 'POST',
                body: JSON.stringify({ 
                    month, 
                    amountsByYear: { 1: amount1, 2: amount2, 3: amount3 } 
                })
            });
            
            alert(res.message);
            generateModal.classList.remove('active');
            
            // Refresh months list and set current
            await initMonths();
            monthFilter.value = month;
            window.loadPayments();
            
        } catch (err) {
            alert(err.message);
        } finally {
            hideLoading();
        }
    });
    
    function openUpdateModal(id, name, amountPaid, status) {
        document.getElementById('update-payment-id').value = id;
        document.getElementById('update-payment-student').textContent = `الطالب: ${name}`;
        document.getElementById('update-payment-amount').value = amountPaid;
        document.getElementById('update-payment-status').value = status;
        
        updateModal.classList.add('active');
    }
    
    updateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('update-payment-id').value;
        const amount_paid = document.getElementById('update-payment-amount').value;
        const status = document.getElementById('update-payment-status').value;
        
        try {
            showLoading();
            await fetchAPI(`/payments/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ amount_paid, status })
            });
            
            updateModal.classList.remove('active');
            window.loadPayments();
            if (typeof loadOverviewStats === 'function') loadOverviewStats();
        } catch (err) {
            alert(err.message);
        } finally {
            hideLoading();
        }
    });
}
