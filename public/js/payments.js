if (true) {
    const paymentsTbody = document.getElementById('payments-tbody');
    const monthFilter = document.getElementById('payment-month-filter');
    const groupFilter = document.getElementById('payment-group-filter');
    
    const generateModal = document.getElementById('payment-generate-modal');
    const generateForm = document.getElementById('payment-generate-form');
    
    const updateModal = document.getElementById('payment-update-modal');
    const updateForm = document.getElementById('payment-update-form');
    
    // Initialize months dropdown
    async function initMonths() {
        try {
            const months = await fetchAPI('/payments/months');
            const currentMonth = new Date().toISOString().slice(0, 7);
            
            monthFilter.innerHTML = '';
            
            // Ensure current month is always available
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
    
    // Call init on load
    initMonths();
    
    window.loadPayments = async function() {
        try {
            const month = monthFilter.value || new Date().toISOString().slice(0, 7);
            const groupId = groupFilter.value;
            
            let query = `?month=${month}`;
            if (groupId) query += `&group_id=${groupId}`;
            
            const data = await fetchAPI(`/payments${query}`);
            renderPaymentsTable(data.payments);
        } catch (err) {
            console.error('Failed to load payments', err);
            alert('حدث خطأ في تحميل سجلات الدفع');
        }
    };
    
    function renderPaymentsTable(payments) {
        paymentsTbody.innerHTML = '';
        
        let paidCount = 0;
        let unpaidCount = 0;
        
        if (payments.length === 0) {
            paymentsTbody.innerHTML = `
                <tr><td colspan="6" style="text-align:center;">
                    لا توجد سجلات دفع لهذا الشهر.<br>
                    انقر على "إنشاء كشف الشهر" لتوليد سجلات لجميع الطلاب.
                </td></tr>`;
        } else {
            payments.forEach(payment => {
                if (payment.status === 'paid') paidCount++;
                else unpaidCount++;
                
                let badgeClass = 'badge-danger';
                let statusText = 'لم يتم الدفع';
                
                if (payment.status === 'paid') {
                    badgeClass = 'badge-success';
                    statusText = 'تم الدفع';
                } else if (payment.status === 'partial') {
                    badgeClass = 'badge-warning';
                    statusText = 'دفع جزئي';
                }
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div>${payment.student_name}</div>
                        <div class="text-muted" dir="ltr" style="text-align:right">${payment.phone}</div>
                    </td>
                    <td>${payment.group_name || '-'}</td>
                    <td>${payment.amount_due} ج.م</td>
                    <td>${payment.amount_paid} ج.م</td>
                    <td><span class="badge ${badgeClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-outline btn-sm update-payment" 
                            data-id="${payment.id}"
                            data-name="${payment.student_name}"
                            data-paid="${payment.amount_paid}"
                            data-status="${payment.status}">
                            تحديث الدفع
                        </button>
                    </td>
                `;
                paymentsTbody.appendChild(tr);
            });
            
            // Bind update buttons
            document.querySelectorAll('.update-payment').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const ds = e.currentTarget.dataset;
                    openUpdateModal(ds.id, ds.name, ds.paid, ds.status);
                });
            });
        }
        
        // Update mini stats
        document.getElementById('pay-stat-paid').textContent = paidCount;
        document.getElementById('pay-stat-unpaid').textContent = unpaidCount;
    }
    
    // Event listeners
    monthFilter.addEventListener('change', window.loadPayments);
    groupFilter.addEventListener('change', window.loadPayments);
    
    document.getElementById('btn-generate-payments').addEventListener('click', () => {
        document.getElementById('generate-month').value = new Date().toISOString().slice(0, 7);
        generateModal.classList.add('active');
    });
    
    generateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const month = document.getElementById('generate-month').value;
        const amount_due = document.getElementById('generate-amount').value;
        
        try {
            showLoading();
            const res = await fetchAPI('/payments/generate', {
                method: 'POST',
                body: JSON.stringify({ month, amount_due })
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
            loadOverviewStats(); // Update global stats
        } catch (err) {
            alert(err.message);
        } finally {
            hideLoading();
        }
    });
}
