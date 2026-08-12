if (true) {
    const paymentsTbody = document.getElementById('payments-tbody');
    const monthFilter = document.getElementById('payment-month-filter');
    const groupFilter = document.getElementById('payment-group-filter');
    const searchInput = document.getElementById('payment-search-input');
    
    const generateModal = document.getElementById('payment-generate-modal');
    const generateForm = document.getElementById('payment-generate-form');
    
    const updateModal = document.getElementById('payment-update-modal');
    const updateForm = document.getElementById('payment-update-form');

    const btnExportUnpaid = document.getElementById('btn-export-unpaid');
    
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

        // Right-click (contextmenu) on unpaid badge to trigger PDF export directly
        if (badges.unpaid) {
            badges.unpaid.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                exportUnpaidPDF();
            });
        }
    }

    // Export printable document / PDF of unpaid students
    function exportUnpaidPDF() {
        const month = monthFilter.value || new Date().toISOString().slice(0, 7);
        const selectedGroupText = groupFilter.options[groupFilter.selectedIndex] ? groupFilter.options[groupFilter.selectedIndex].text : 'كل المجموعات';
        
        // Filter students who haven't paid or paid partially
        const unpaidStudents = currentPayments.filter(p => p.status === 'unpaid' || p.status === 'partial');

        if (unpaidStudents.length === 0) {
            alert('🎉 رائع! لا يوجد طلاب غير مسددين لهذا الشهر والفلتر المحدد.');
            return;
        }

        const printWindow = window.open('', '_blank');
        const todayStr = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        let rowsHtml = '';
        unpaidStudents.forEach((student, idx) => {
            const due = Number(student.amount_due) || 0;
            const paid = Number(student.amount_paid) || 0;
            const remaining = due - paid;

            let statusText = `لم يدفع (${due} ج.م)`;
            if (student.status === 'partial') {
                statusText = `دفع جزئي (متبقي ${remaining} ج.م من ${due})`;
            }
            
            rowsHtml += `
                <tr>
                    <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                    <td style="font-weight: bold; font-size: 15px;">${student.student_name}</td>
                    <td>${student.group_name || '-'}</td>
                    <td dir="ltr" style="text-align: right; font-family: monospace;">${student.phone || '-'}</td>
                    <td style="color: #c0392b; font-weight: bold;">${statusText}</td>
                    <td style="width: 140px;"></td>
                </tr>
            `;
        });

        const docHtml = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>كشف غير المسددين - ${month}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                    body {
                        font-family: 'Tajawal', sans-serif;
                        margin: 20px;
                        color: #111;
                        background: #fff;
                        direction: rtl;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 2px solid #222;
                        padding-bottom: 12px;
                        margin-bottom: 18px;
                    }
                    .header h1 {
                        margin: 0 0 5px 0;
                        font-size: 22px;
                        color: #111;
                    }
                    .header h2 {
                        margin: 0;
                        font-size: 16px;
                        color: #555;
                    }
                    .meta-info {
                        display: flex;
                        justify-content: space-between;
                        font-size: 13px;
                        margin-bottom: 15px;
                        background: #f8f9fa;
                        padding: 10px 15px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                    }
                    th, td {
                        border: 1px solid #333;
                        padding: 9px 12px;
                        text-align: right;
                        font-size: 13px;
                    }
                    th {
                        background-color: #eee;
                        font-weight: bold;
                    }
                    .footer {
                        margin-top: 25px;
                        display: flex;
                        justify-content: space-between;
                        font-size: 13px;
                        font-weight: bold;
                        border-top: 1px solid #ccc;
                        padding-top: 10px;
                    }
                    @media print {
                        @page { margin: 12mm; size: A4 portrait; }
                        body { margin: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🧪 مركز أ / وليد قنديل للكيمياء</h1>
                    <h2>كشف مراجعة وتأكيد اشتراكات الطلاب غير المسددين</h2>
                </div>

                <div class="meta-info">
                    <div><strong>الشهر:</strong> ${month}</div>
                    <div><strong>المجموعة:</strong> ${selectedGroupText}</div>
                    <div><strong>تاريخ التصدير:</strong> ${todayStr}</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;">م</th>
                            <th>اسم الطالب</th>
                            <th>المجموعة</th>
                            <th>رقم الواتساب</th>
                            <th>المبلغ / حالة الدفع</th>
                            <th style="width: 140px;">ملاحظات / التوقيع في الحصة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <div class="footer">
                    <div>إجمالي الطلاب المطلوبين للمتابعة: ${unpaidStudents.length} طالب</div>
                    <div>توقيع الأستاذ / المساعد: .......................................</div>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 300);
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(docHtml);
        printWindow.document.close();
    }
    
    // Call init on load
    initMonths();
    initGroupFilter();
    setupStatusFilterBadges();

    if (btnExportUnpaid) {
        btnExportUnpaid.addEventListener('click', exportUnpaidPDF);
    }
    
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
            let emptyMsg = 'لا توجد سجلات تطابق الفلتر المحدد.';
            if (activeStatusFilter === 'unpaid') emptyMsg = '🎉 لا يوجد طلاب بحالة (لم يتم الدفع) لهذا الشهر والحمد لله!';
            else if (activeStatusFilter === 'partial') emptyMsg = 'لا يوجد طلاب بحالة (دفع جزئي) لهذا الشهر.';
            else if (activeStatusFilter === 'paid') emptyMsg = 'لا يوجد طلاب بحالة (تم الدفع) لهذا الشهر بعد.';

            paymentsTbody.innerHTML = `
                <tr><td colspan="6" style="text-align:center; padding: 20px;">
                    ${emptyMsg}<br>
                    <small style="opacity: 0.8;">انقر على "الكل" لإظهار جميع الطلاب.</small>
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
