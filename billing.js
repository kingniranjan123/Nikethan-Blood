// ══════════════════════════════════════════
// SETTINGS — STORAGE
// ══════════════════════════════════════════
function getSettings() {
  return JSON.parse(localStorage.getItem('sn_settings') || '{}');
}
function getPaymentSettings() {
  return JSON.parse(localStorage.getItem('sn_payment_settings') || '{}');
}

// ── Account Tab ──
function saveAccountSettings() {
  const s = {
    ...getSettings(),
    labName:    document.getElementById('sLabName').value.trim()    || 'Sri Neevi Diagnostics',
    tagline:    document.getElementById('sTagline').value.trim()    || 'Your Health, Our Priority',
    phone:      document.getElementById('sPhone').value.trim()      || '',
    email:      document.getElementById('sEmail').value.trim()      || '',
    address:    document.getElementById('sAddress').value.trim()    || '',
    emailPublicKey:       document.getElementById('sEmailPublicKey').value.trim(),
    emailServiceId:       document.getElementById('sEmailServiceId').value.trim(),
    emailTemplateInvoice: document.getElementById('sEmailTemplateInvoice').value.trim(),
    emailTemplateReport:  document.getElementById('sEmailTemplateReport').value.trim(),
  };
  localStorage.setItem('sn_settings', JSON.stringify(s));
  toast('Account settings saved!', 'success');
}

// Keep old name as alias for backward compat
function saveSettings() { saveAccountSettings(); }

// ── Payment Tab ──
function savePaymentSettings() {
  const ps = {
    ...getPaymentSettings(),
    upiId:     document.getElementById('sUpiId').value.trim()      || 'srineevi@upi',
    payeeName: document.getElementById('sPayeeName').value.trim()  || 'Sri Neevi Diagnostics',
    qrCodes:   qrSlotsTemp.map(s => ({ ...s })),
  };
  // Also persist upiId/payeeName in sn_settings for QR generation fallback
  const s = { ...getSettings(), upiId: ps.upiId, payeeName: ps.payeeName };
  localStorage.setItem('sn_settings', JSON.stringify(s));
  localStorage.setItem('sn_payment_settings', JSON.stringify(ps));
  toast('Payment settings saved!', 'success');
  refreshQR();
}

// ── Tab Switcher ──
window.switchSettingsTab = function(tab) {
  ['account','payment'].forEach(t => {
    document.getElementById('stab-' + t).classList.toggle('active', t === tab);
    document.getElementById('stab-content-' + t).classList.toggle('active', t === tab);
  });
  if (tab === 'payment') renderQRCodesManager();
};

// ── Load Both Tabs ──
function loadSettingsPage() {
  const s  = getSettings();
  const ps = getPaymentSettings();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  // Account
  set('sLabName',               s.labName);
  set('sTagline',               s.tagline);
  set('sPhone',                 s.phone);
  set('sEmail',                 s.email);
  set('sAddress',               s.address);
  set('sEmailPublicKey',        s.emailPublicKey);
  set('sEmailServiceId',        s.emailServiceId);
  set('sEmailTemplateInvoice',  s.emailTemplateInvoice);
  set('sEmailTemplateReport',   s.emailTemplateReport);
  // Payment
  set('sUpiId',    ps.upiId    || s.upiId);
  set('sPayeeName',ps.payeeName|| s.payeeName);
  // Load QR slots into temp
  qrSlotsTemp = (ps.qrCodes || []).map(q => ({ ...q }));
  // Always open on Account tab
  switchSettingsTab('account');
}


// ══════════════════════════════════════════
// QR CODE
// ══════════════════════════════════════════
let qrInstance = null;

function refreshQR() {
  const s  = getSettings();
  const ps = getPaymentSettings();
  const container = document.getElementById('qrCodeContainer');
  const upiEl     = document.getElementById('qrUpiDisplay');
  if (!container) return;

  // Prefer uploaded primary QR image
  const primaryQR = (ps.qrCodes || []).find(q => q.isPrimary && q.imageData);
  container.innerHTML = '';

  if (primaryQR) {
    const img = document.createElement('img');
    img.src = primaryQR.imageData;
    img.style.cssText = 'width:180px;height:180px;object-fit:contain;border-radius:12px;border:3px solid var(--border);display:block;margin:0 auto .75rem';
    container.appendChild(img);
    if (upiEl) upiEl.textContent = primaryQR.label || (ps.upiId || s.upiId || 'srineevi@upi');
  } else {
    // Auto-generate from UPI ID
    const upi   = ps.upiId || s.upiId || 'srineevi@upi';
    const payee = ps.payeeName || s.payeeName || 'Sri Neevi';
    const upiUrl = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(payee)}&cu=INR`;
    if (upiEl) upiEl.textContent = upi;
    if (typeof QRCode !== 'undefined') {
      qrInstance = new QRCode(container, {
        text: upiUrl, width: 180, height: 180,
        colorDark: '#0f172a', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      container.innerHTML = `<div style="width:180px;height:180px;display:flex;align-items:center;justify-content:center;background:#f1f5f9;border-radius:12px;font-size:.75rem;color:#94a3b8;text-align:center;padding:1rem">QR library<br>loading...</div>`;
    }
  }

  // Render backup QR thumbnails
  _renderBillingBackupQRs(ps);
}

function _renderBillingBackupQRs(ps) {
  const old = document.getElementById('billingBackupQRs');
  if (old) old.remove();
  const backups = (ps.qrCodes || []).filter(q => !q.isPrimary && q.imageData);
  if (!backups.length) return;
  const panel = document.querySelector('.qr-panel');
  if (!panel) return;
  const sec = document.createElement('div');
  sec.id = 'billingBackupQRs';
  sec.style.cssText = 'margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem';
  sec.innerHTML = `
    <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:.6rem;text-align:center">Backup QR Codes</div>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;justify-content:center">
      ${backups.map(q => `
        <div title="${q.label||'Backup'}" style="text-align:center;cursor:pointer" onclick="_swapToQR('${q.id}')">
          <img src="${q.imageData}" style="width:56px;height:56px;border-radius:8px;border:2px solid var(--border);object-fit:contain;transition:border-color .2s" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'"/>
          <div style="font-size:.6rem;color:var(--text-muted);margin-top:.2rem;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${q.label||'Backup'}</div>
        </div>`).join('')}
    </div>
    <div style="font-size:.68rem;color:var(--text-muted);text-align:center;margin-top:.5rem">Tap a backup if the primary QR fails</div>`;
  panel.appendChild(sec);
}

// Temporarily swap active QR to a backup on billing page
window._swapToQR = function(qrId) {
  const ps = getPaymentSettings();
  const qr = (ps.qrCodes || []).find(q => q.id === qrId);
  if (!qr || !qr.imageData) return;
  const container = document.getElementById('qrCodeContainer');
  const upiEl     = document.getElementById('qrUpiDisplay');
  if (!container) return;
  container.innerHTML = '';
  const img = document.createElement('img');
  img.src = qr.imageData;
  img.style.cssText = 'width:180px;height:180px;object-fit:contain;border-radius:12px;border:3px solid var(--primary);display:block;margin:0 auto .75rem';
  container.appendChild(img);
  if (upiEl) upiEl.textContent = qr.label || 'Backup QR';
  toast('Switched to: ' + (qr.label || 'Backup QR'), 'success');
};

// ══════════════════════════════════════════
// BILLING PAGE SETUP
// ══════════════════════════════════════════
function setupBillingPage() {
  populateBillingDropdowns();
  populateLocationDatalist();
  refreshQR();
  updateMissingReportsBadge();
  document.getElementById('generateInvoiceBtn').addEventListener('click', generateInvoice);
  document.getElementById('openHistoryBtn').addEventListener('click', () => openHistoryDrawer(false));
}

function populateLocationDatalist() {
  const dl = document.getElementById('tnLocationsList');
  if (!dl || typeof TN_LOCATIONS === 'undefined') return;
  dl.innerHTML = TN_LOCATIONS.map(loc => `<option value="${loc}">`).join('');
}

function populateBillingDropdowns() {
  const pkgSel = document.getElementById('bPackageSelect');
  const testSel = document.getElementById('bTestSelect');
  if (!pkgSel || !testSel) return;
  pkgSel.innerHTML = '<option value="">— Choose a package —</option>' +
    packages.map(p => `<option value="${p.id}" data-price="${p.price}">${p.name} — ₹${p.price}</option>`).join('');
  testSel.innerHTML = '<option value="">— Choose a test —</option>' +
    prices.map((p, i) => `<option value="${i}" data-price="${p.ourPrice}">${p.test} — ₹${p.ourPrice}</option>`).join('');
}

window.onTestTypeChange = function() {
  const isPackage = document.getElementById('bTypePackage').checked;
  document.getElementById('bPackageGroup').style.display    = isPackage ? '' : 'none';
  document.getElementById('bIndividualGroup').style.display = isPackage ? 'none' : '';
  updateBillingAmount();
};

window.updateBillingAmount = function() {
  const isPackage = document.getElementById('bTypePackage').checked;
  let price = 0, name = '';
  if (isPackage) {
    const sel = document.getElementById('bPackageSelect');
    const opt = sel.options[sel.selectedIndex];
    if (opt && opt.dataset.price) { price = parseInt(opt.dataset.price) || 0; name = opt.text.split(' — ')[0]; }
  } else {
    const sel = document.getElementById('bTestSelect');
    const opt = sel.options[sel.selectedIndex];
    if (opt && opt.dataset.price) { price = parseInt(opt.dataset.price) || 0; name = opt.text.split(' — ')[0]; }
  }
  const discount = parseInt(document.getElementById('bDiscount').value) || 0;
  const final = Math.max(0, price - discount);
  document.getElementById('billingAmountDisplay').textContent = '₹' + final.toLocaleString('en-IN');
  document.getElementById('billingTestNameDisplay').textContent = name || 'Select a test or package';
};

// Pre-fill billing form from enquiry data
window.prefillBillingFromEnquiry = function(enq) {
  document.getElementById('bName').value    = enq.name    || '';
  document.getElementById('bPhone').value   = enq.phone   || '';
  document.getElementById('bEmail').value   = enq.email   || '';
  document.getElementById('bAddress').value = enq.address || '';
  document.getElementById('bDiscount').value = '0';
  // Switch to billing page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('[data-page]').forEach(l => l.classList.remove('active'));
  document.getElementById('page-billing').classList.add('active');
  document.getElementById('nav-billing').classList.add('active');
  document.getElementById('topbarTitle').innerHTML = '&#128179; Billing';
  updateBillingAmount();
  toast('Enquiry pre-filled into billing form', 'success');
};

// ══════════════════════════════════════════
// INVOICE GENERATION
// ══════════════════════════════════════════
function getInvoices() { return JSON.parse(localStorage.getItem('sn_invoices') || '[]'); }
function saveInvoices(arr) { localStorage.setItem('sn_invoices', JSON.stringify(arr)); }

function generateInvoiceId() {
  const invoices = getInvoices();
  const year = new Date().getFullYear();
  const num = String(invoices.length + 1).padStart(3, '0');
  return `INV-${year}-${num}`;
}

function generateInvoice() {
  const name  = document.getElementById('bName').value.trim();
  const phone = document.getElementById('bPhone').value.trim();
  if (!name)  { toast('Client name is required', 'error'); return; }
  if (!phone) { toast('Phone number is required', 'error'); return; }

  const isPackage = document.getElementById('bTypePackage').checked;
  let testName = '', testType = '', amount = 0, testsArr = [];

  if (isPackage) {
    const sel = document.getElementById('bPackageSelect');
    const idx = sel.selectedIndex;
    if (!idx) { toast('Please select a package', 'error'); return; }
    const pkgId = sel.value;
    const pkg = packages.find(p => p.id === pkgId);
    if (pkg) { testName = pkg.name; testsArr = pkg.tests || []; amount = pkg.price; }
    testType = 'package';
  } else {
    const sel = document.getElementById('bTestSelect');
    const idx = sel.selectedIndex;
    if (!idx) { toast('Please select a test', 'error'); return; }
    const priceItem = prices[parseInt(sel.value)];
    if (priceItem) { testName = priceItem.test; amount = priceItem.ourPrice; testsArr = [priceItem.test]; }
    testType = 'individual';
  }

  const discount = parseInt(document.getElementById('bDiscount').value) || 0;
  const finalAmount = Math.max(0, amount - discount);

  const invoice = {
    id:          generateInvoiceId(),
    date:        new Date().toLocaleDateString('en-IN'),
    createdAt:   new Date().toISOString(),
    client: {
      name:     name,
      age:      document.getElementById('bAge').value || '',
      gender:   document.getElementById('bGender').value || '',
      location: document.getElementById('bLocation').value.trim(),
      address:  document.getElementById('bAddress').value.trim(),
      phone:    phone,
      altPhone: document.getElementById('bAltPhone').value.trim(),
      email:    document.getElementById('bEmail').value.trim(),
    },
    testType,
    testName,
    tests:          testsArr,
    amount:         finalAmount,
    originalAmount: amount,
    discount:       discount,
    paymentStatus:  'paid',
    reportFiles:    [],
    reportUploaded: false,
    emailSent:      false,
    enquiryId:      null
  };

  const invoices = getInvoices();
  invoices.unshift(invoice);
  saveInvoices(invoices);

  // Also save client to client list
  const existing = clients.findIndex(c => c.phone === phone);
  const clientObj = {
    date: invoice.date, serial: '', name, age: invoice.client.age,
    gender: invoice.client.gender, phone,
    package: testName, address: invoice.client.address, status: 'Active'
  };
  if (existing >= 0) clients[existing] = { ...clients[existing], ...clientObj };
  else clients.push(clientObj);

  toast(`Invoice ${invoice.id} generated!`, 'success');
  sendInvoiceEmail(invoice);
  updateMissingReportsBadge();
  resetBillingForm();
  openInvoiceModal(invoice, true); // auto-print on generation
}

function resetBillingForm() {
  ['bName','bAge','bLocation','bAddress','bPhone','bAltPhone','bEmail'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('bGender').value = '';
  document.getElementById('bDiscount').value = '0';
  document.getElementById('bPackageSelect').selectedIndex = 0;
  document.getElementById('bTestSelect').selectedIndex = 0;
  document.getElementById('bTypePackage').checked = true;
  onTestTypeChange();
  updateBillingAmount();
}

// ══════════════════════════════════════════
// INVOICE MODAL / PRINT
// ══════════════════════════════════════════
window.openInvoiceModal = function(invoice, autoPrint = false) {
  const s = getSettings();
  const labName = s.labName || 'Sri Neevi Diagnostics';
  const labAddr = s.address || 'Chennai, Tamil Nadu';
  const labPhone= s.phone   || '1800 570 8888';
  const labEmail= s.email   || '';

  const rows = invoice.tests.length
    ? invoice.tests.map((t, i) => `<tr><td>${i+1}</td><td>${t}</td><td style="text-align:right">—</td></tr>`).join('')
    : `<tr><td>1</td><td>${invoice.testName}</td><td style="text-align:right">₹${invoice.originalAmount.toLocaleString('en-IN')}</td></tr>`;

  document.getElementById('invoicePrintArea').innerHTML = `
    <div class="invoice-print-container">
      <div class="invoice-print-header">
        <div>
          <div class="invoice-lab-name">🩸 ${labName}</div>
          <div class="invoice-lab-sub">${labAddr}${labPhone ? ' &bull; ' + labPhone : ''}${labEmail ? ' &bull; ' + labEmail : ''}</div>
        </div>
        <div class="invoice-meta">
          <div class="invoice-id-label">Invoice</div>
          <div class="invoice-id-value">${invoice.id}</div>
          <div class="invoice-date">${invoice.date}</div>
        </div>
      </div>
      <div class="invoice-client-box">
        <div class="invoice-client-field"><label>Patient Name</label><span>${invoice.client.name}</span></div>
        <div class="invoice-client-field"><label>Age / Gender</label><span>${invoice.client.age || '—'} / ${invoice.client.gender || '—'}</span></div>
        <div class="invoice-client-field"><label>Phone</label><span>${invoice.client.phone}${invoice.client.altPhone ? ' / ' + invoice.client.altPhone : ''}</span></div>
        <div class="invoice-client-field"><label>Location</label><span>${invoice.client.location || '—'}</span></div>
        <div class="invoice-client-field" style="grid-column:1/-1"><label>Address</label><span>${invoice.client.address || '—'}</span></div>
      </div>
      <table class="invoice-tests-table">
        <thead><tr><th>#</th><th>Test / Package</th><th style="text-align:right">Price</th></tr></thead>
        <tbody>
          ${rows}
          ${invoice.discount > 0 ? `<tr><td colspan="2" style="text-align:right;color:#94a3b8;font-size:.82rem">Discount</td><td style="text-align:right;color:#dc2626">- ₹${invoice.discount.toLocaleString('en-IN')}</td></tr>` : ''}
        </tbody>
      </table>
      <div class="invoice-total-row">
        <div class="invoice-total-box">
          <div class="invoice-total-label">Total Amount Paid</div>
          <div class="invoice-total-amount">₹${invoice.amount.toLocaleString('en-IN')}</div>
        </div>
      </div>
      <div class="invoice-footer">
        <div>Thank you for choosing ${labName}.<br>For queries: ${labPhone}</div>
        <div class="invoice-signature">
          <div style="height:2.5rem"></div>
          <div class="invoice-signature-line">Authorised Signatory</div>
          <div style="font-size:.72rem;color:#94a3b8;margin-top:.25rem">${labName}</div>
        </div>
      </div>
    </div>`;

  document.getElementById('invoiceModalOverlay').classList.add('open');
  if (autoPrint) { setTimeout(() => window.print(), 650); }
};

window.closeInvoiceModal = function() {
  document.getElementById('invoiceModalOverlay').classList.remove('open');
};

// Both buttons call window.print() — user selects "Save as PDF" or printer
window.downloadInvoicePDF = function() { window.print(); };
window.printInvoice        = function() { window.print(); };

// ══════════════════════════════════════════
// MISSING REPORTS BADGE
// ══════════════════════════════════════════
function updateMissingReportsBadge() {
  const invoices = getInvoices();
  const missing = invoices.filter(inv => !inv.reportUploaded).length;
  const banner       = document.getElementById('missingReportsBanner');
  const countEl      = document.getElementById('missingReportsCount');
  const sidebarBadge = document.getElementById('missingReportsBadge');
  const reportsBadge = document.getElementById('reportsAlertBadge');
  if (banner)  { banner.classList.toggle('hidden', missing === 0); }
  if (countEl) { countEl.textContent = missing; }
  if (sidebarBadge) { sidebarBadge.style.display = missing > 0 ? '' : 'none'; sidebarBadge.textContent = missing; }
  if (reportsBadge) { reportsBadge.style.display = missing > 0 ? '' : 'none'; reportsBadge.textContent = missing; }
}

// ══════════════════════════════════════════
// HISTORY DRAWER
// ══════════════════════════════════════════
let histFilter = 'all';

function setHistFilter(f) {
  histFilter = f;
  document.getElementById('histFilterAll').classList.toggle('btn-primary', f === 'all');
  document.getElementById('histFilterAll').classList.toggle('btn-ghost', f !== 'all');
  document.getElementById('histFilterMissing').classList.toggle('btn-primary', f === 'missing');
  document.getElementById('histFilterMissing').classList.toggle('btn-ghost', f !== 'missing');
  renderHistoryDrawer();
}

window.openHistoryDrawer = function(showMissing) {
  if (showMissing) setHistFilter('missing');
  else setHistFilter('all');
  renderHistoryDrawer();
  document.getElementById('historyDrawer').classList.add('open');
  document.getElementById('historyDrawerOverlay').classList.add('open');
};

window.closeHistoryDrawer = function() {
  document.getElementById('historyDrawer').classList.remove('open');
  document.getElementById('historyDrawerOverlay').classList.remove('open');
};

window.renderHistoryDrawer = function() {
  const search = (document.getElementById('historySearch').value || '').toLowerCase();
  let invoices = getInvoices();
  if (histFilter === 'missing') invoices = invoices.filter(inv => !inv.reportUploaded);
  if (search) invoices = invoices.filter(inv =>
    inv.id.toLowerCase().includes(search) ||
    inv.client.name.toLowerCase().includes(search) ||
    inv.client.phone.includes(search)
  );
  const body = document.getElementById('historyDrawerBody');
  if (!invoices.length) {
    body.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:3rem">${histFilter==='missing'?'No missing reports 🎉':'No invoices found.'}</div>`;
    return;
  }
  body.innerHTML = invoices.map((inv, i) => {
    const reportHtml = inv.reportUploaded
      ? inv.reportFiles.map((f, fi) => `
          <div class="report-uploaded-file">
            <span>📄 ${f.name}</span>
            <button class="btn btn-sm btn-success" style="margin-left:auto;padding:.2rem .5rem;font-size:.7rem" onclick="downloadReport('${inv.id}',${fi})">⬇ Download</button>
          </div>`).join('')
      : `<label class="report-upload-zone" for="rptUpload_${i}">📤 Upload Lab Report (PDF / Image)</label>
         <input type="file" id="rptUpload_${i}" accept=".pdf,image/*" style="display:none" onchange="uploadReport('${inv.id}', this)"/>`;

    const statusColor = inv.reportUploaded ? '#047857' : '#f59e0b';
    return `<div class="invoice-card" id="inv-card-${inv.id}">
      <div class="invoice-card-header">
        <div>
          <div class="invoice-card-id">${inv.id}</div>
          <div class="invoice-card-name">${inv.client.name}</div>
        </div>
        <div class="invoice-card-amount">₹${inv.amount.toLocaleString('en-IN')}</div>
      </div>
      <div class="invoice-card-meta">
        <span>📅 ${inv.date}</span>
        <span>📞 ${inv.client.phone}</span>
        <span>🧪 ${inv.testName}</span>
        <span style="color:${statusColor};font-weight:700">${inv.reportUploaded ? '✅ Report Uploaded' : '⚠ Report Missing'}</span>
      </div>
      <div class="invoice-card-actions">
        <button class="btn btn-sm btn-primary" onclick='openInvoiceModal(${JSON.stringify(inv)})'>🖨 View Invoice</button>
        ${inv.client.email && !inv.emailSent ? `<button class="btn btn-sm btn-accent" onclick="resendEmail('${inv.id}')">📧 Resend Email</button>` : ''}
      </div>
      ${reportHtml}
    </div>`;
  }).join('');
};

window.uploadReport = function(invoiceId, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const invoices = getInvoices();
    const idx = invoices.findIndex(inv => inv.id === invoiceId);
    if (idx < 0) return;
    invoices[idx].reportFiles = invoices[idx].reportFiles || [];
    invoices[idx].reportFiles.push({ name: file.name, data: ev.target.result, type: file.type });
    invoices[idx].reportUploaded = true;
    saveInvoices(invoices);
    toast(`Report "${file.name}" uploaded for ${invoiceId}`, 'success');
    updateMissingReportsBadge();
    renderHistoryDrawer();
    // Notify client about report
    sendReportReadyEmail(invoices[idx]);
  };
  reader.readAsDataURL(file);
};

window.downloadReport = function(invoiceId, fileIndex) {
  const invoices = getInvoices();
  const inv = invoices.find(i => i.id === invoiceId);
  if (!inv || !inv.reportFiles[fileIndex]) return;
  const f = inv.reportFiles[fileIndex];
  const a = document.createElement('a');
  a.href = f.data; a.download = f.name; a.click();
};

// ══════════════════════════════════════════
// EMAIL (EmailJS)
// ══════════════════════════════════════════
function sendInvoiceEmail(invoice) {
  const s = getSettings();
  if (!s.emailPublicKey || !s.emailServiceId || !s.emailTemplateInvoice) return;
  if (!invoice.client.email) return;
  if (typeof emailjs === 'undefined') return;
  emailjs.init(s.emailPublicKey);
  emailjs.send(s.emailServiceId, s.emailTemplateInvoice, {
    to_email:    invoice.client.email,
    to_name:     invoice.client.name,
    invoice_id:  invoice.id,
    invoice_date:invoice.date,
    test_name:   invoice.testName,
    amount:      '₹' + invoice.amount.toLocaleString('en-IN'),
    lab_name:    s.labName || 'Sri Neevi Diagnostics',
    lab_phone:   s.phone   || '1800 570 8888',
  }).then(() => {
    const invoices = getInvoices();
    const idx = invoices.findIndex(i => i.id === invoice.id);
    if (idx >= 0) { invoices[idx].emailSent = true; saveInvoices(invoices); }
    toast('Invoice email sent to ' + invoice.client.email, 'success');
  }).catch(err => {
    console.error('Email error:', err);
    toast('Email failed — check EmailJS settings', 'error');
  });
}

function sendReportReadyEmail(invoice) {
  const s = getSettings();
  if (!s.emailPublicKey || !s.emailServiceId || !s.emailTemplateReport) return;
  if (!invoice.client.email) return;
  if (typeof emailjs === 'undefined') return;
  emailjs.init(s.emailPublicKey);
  emailjs.send(s.emailServiceId, s.emailTemplateReport, {
    to_email:  invoice.client.email,
    to_name:   invoice.client.name,
    invoice_id:invoice.id,
    lab_name:  s.labName || 'Sri Neevi Diagnostics',
    lab_phone: s.phone   || '1800 570 8888',
  }).then(() => {
    toast('Report-ready email sent to ' + invoice.client.email, 'success');
  }).catch(() => {
    toast('Report email failed — check EmailJS settings', 'error');
  });
}

window.resendEmail = function(invoiceId) {
  const invoices = getInvoices();
  const inv = invoices.find(i => i.id === invoiceId);
  if (inv) sendInvoiceEmail(inv);
};

// ══════════════════════════════════════════
// ENHANCED ENQUIRIES
// ══════════════════════════════════════════
function renderEnquiries() {
  const enquiries = JSON.parse(localStorage.getItem('sn_enquiries') || '[]');
  const tbody = document.getElementById('enquiriesTableBody');
  if (!tbody) return;

  const today = new Date().toLocaleDateString('en-IN');
  const todayCount   = enquiries.filter(e => e.date && e.date.startsWith(today)).length;
  const openCount    = enquiries.filter(e => (!e.status || e.status === 'Open' || e.status === 'New')).length;
  const billedCount  = enquiries.filter(e => e.status === 'Billing').length;
  const rejectedCount= enquiries.filter(e => e.status === 'Rejected').length;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('enqTotal',    enquiries.length);
  set('enqNew',      openCount);
  set('enqToday',    todayCount);
  set('enqBilled',   billedCount);
  set('enqRejected', rejectedCount);
  updateEnquiryBadge();

  if (!enquiries.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:3rem;color:var(--text-muted)">No enquiries yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = enquiries.map((enq, i) => {
    const status = enq.status || 'Open';
    let badge = '';
    if (status === 'Billing')  badge = '<span class="enq-status-billing">✓ Billed</span>';
    else if (status === 'Rejected') badge = '<span class="enq-status-rejected">✕ Rejected</span>';
    else badge = '<span class="enq-status-open">● Open</span>';

    const reasonCell = status === 'Rejected'
      ? `<span class="reason-cell" title="${enq.rejectionReason || ''}">${enq.rejectionReason || '—'}</span>`
      : status === 'Billing' && enq.invoiceId
        ? `<span style="font-family:monospace;font-size:.75rem;color:var(--success)">${enq.invoiceId}</span>`
        : '—';

    const actions = status === 'Open' || status === 'New'
      ? `<button onclick="convertEnquiryToBilling(${i})" class="btn btn-sm btn-success" title="Convert to Billing">💳 Bill</button>
         <button onclick="openRejectModal(${i})" class="btn btn-sm btn-danger" title="Reject">✕ Reject</button>`
      : `<button onclick="deleteEnquiry(${i})" class="btn btn-ghost btn-sm" style="color:#dc2626;font-size:.75rem">🗑</button>`;

    return `<tr style="background:${status==='Open'||status==='New'?'rgba(37,99,235,.03)':''}">
      <td>${i+1}</td>
      <td style="font-weight:700">${enq.name}</td>
      <td><a href="tel:+91${enq.phone}" style="color:var(--primary);font-weight:700">${enq.phone}</a></td>
      <td style="font-size:.82rem;color:var(--text-muted)">${enq.date}</td>
      <td>${badge}</td>
      <td>${reasonCell}</td>
      <td style="display:flex;gap:.4rem;flex-wrap:wrap">${actions}</td>
    </tr>`;
  }).join('');

  document.getElementById('clearEnquiriesBtn').onclick = () => {
    if (confirm('Clear all enquiries? This cannot be undone.')) {
      localStorage.setItem('sn_enquiries', '[]');
      renderEnquiries();
      toast('All enquiries cleared');
    }
  };
  document.getElementById('exportEnquiriesBtn').onclick = () => {
    const csv = 'Name,Phone,Date,Status,Reason,InvoiceID\n' +
      enquiries.map(e => `"${e.name}","${e.phone}","${e.date}","${e.status||'Open'}","${e.rejectionReason||''}","${e.invoiceId||''}"`).join('\n');
    exportCSV(csv, 'enquiries.csv');
  };
}

window.convertEnquiryToBilling = function(idx) {
  const enquiries = JSON.parse(localStorage.getItem('sn_enquiries') || '[]');
  if (!enquiries[idx]) return;
  enquiries[idx].status = 'Billing';
  enquiries[idx].convertedAt = new Date().toISOString();
  localStorage.setItem('sn_enquiries', JSON.stringify(enquiries));
  renderEnquiries();
  prefillBillingFromEnquiry(enquiries[idx]);
};

window.openRejectModal = function(idx) {
  document.getElementById('rejectEnqIndex').value = idx;
  document.getElementById('rejectReasonInput').value = '';
  document.getElementById('rejectModal').classList.add('active');
};

window.closeRejectModal = function() {
  document.getElementById('rejectModal').classList.remove('active');
};

window.confirmRejectEnquiry = function() {
  const reason = document.getElementById('rejectReasonInput').value.trim();
  if (!reason) { toast('Rejection reason is mandatory', 'error'); return; }
  const idx = parseInt(document.getElementById('rejectEnqIndex').value);
  const enquiries = JSON.parse(localStorage.getItem('sn_enquiries') || '[]');
  if (!enquiries[idx]) return;
  enquiries[idx].status = 'Rejected';
  enquiries[idx].rejectionReason = reason;
  enquiries[idx].rejectedAt = new Date().toISOString();
  localStorage.setItem('sn_enquiries', JSON.stringify(enquiries));
  closeRejectModal();
  renderEnquiries();
  toast('Enquiry rejected', 'success');
};

window.deleteEnquiry = function(idx) {
  const enquiries = JSON.parse(localStorage.getItem('sn_enquiries') || '[]');
  enquiries.splice(idx, 1);
  localStorage.setItem('sn_enquiries', JSON.stringify(enquiries));
  renderEnquiries();
  toast('Enquiry deleted');
};

// ══════════════════════════════════════════
// QR CODES MANAGER (Settings → Payment tab)
// ══════════════════════════════════════════
let qrSlotsTemp = [];

window.addQRSlot = function() {
  qrSlotsTemp.push({
    id: 'qr_' + Date.now(),
    label: '',
    imageData: null,
    isPrimary: qrSlotsTemp.length === 0  // first one auto-primary
  });
  renderQRCodesManager();
};

function renderQRCodesManager() {
  const container = document.getElementById('qrCodesManager');
  if (!container) return;

  if (!qrSlotsTemp.length) {
    container.innerHTML = `
      <div class="qr-empty-state">
        <div class="icon">📷</div>
        <strong>No QR Codes Added Yet</strong>
        <p style="font-size:.82rem;margin-top:.25rem">Click "+ Add QR Code" below to upload your payment QR image</p>
      </div>`;
    return;
  }

  container.innerHTML = qrSlotsTemp.map((slot, i) => `
    <div class="qr-setting-card ${slot.isPrimary ? 'is-primary' : ''}" id="qrcard-${slot.id}">
      <div style="flex-shrink:0">
        ${slot.imageData
          ? `<img src="${slot.imageData}" class="qr-setting-card-preview" onclick="_triggerQRUpload('${slot.id}')" title="Click to change image"/>`
          : `<div class="qr-setting-card-empty" onclick="_triggerQRUpload('${slot.id}')">
               <span style="font-size:1.8rem">📷</span>
               <span>Upload QR</span>
             </div>`
        }
        <input type="file" id="qrfile-${slot.id}" accept="image/*" style="display:none" onchange="_onQRFile('${slot.id}',this)"/>
      </div>
      <div class="qr-setting-card-info">
        ${slot.isPrimary ? '<div class="qr-primary-badge">⭐ PRIMARY — Shown on billing page</div>' : ''}
        <div class="form-group" style="margin-bottom:.5rem">
          <label style="font-size:.75rem">Label / App Name</label>
          <input type="text" class="form-input" style="padding:.4rem .75rem;font-size:.82rem"
            value="${slot.label || ''}"
            placeholder="e.g. PhonePe, GPay, Paytm, Bank QR..."
            oninput="qrSlotsTemp[${i}].label = this.value"/>
        </div>
        <div style="font-size:.75rem;color:${slot.imageData ? 'var(--success)' : 'var(--text-muted)'}">
          ${slot.imageData ? '✅ QR image uploaded — click image to replace' : '👆 Click the area on the left to upload your QR code image'}
        </div>
      </div>
      <div class="qr-setting-card-actions">
        ${!slot.isPrimary ? `<button class="btn btn-sm btn-ghost" onclick="_setQRPrimary('${slot.id}')">⭐ Set Primary</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="_removeQRSlot('${slot.id}')">🗑 Remove</button>
      </div>
    </div>`).join('');
}

window._triggerQRUpload = function(id) {
  document.getElementById('qrfile-' + id).click();
};

window._onQRFile = function(id, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const slot = qrSlotsTemp.find(s => s.id === id);
    if (slot) { slot.imageData = ev.target.result; renderQRCodesManager(); }
  };
  reader.readAsDataURL(file);
};

window._setQRPrimary = function(id) {
  qrSlotsTemp.forEach(s => s.isPrimary = (s.id === id));
  renderQRCodesManager();
  toast('Primary QR set — click Save Payment Settings to apply', 'success');
};

window._removeQRSlot = function(id) {
  const idx = qrSlotsTemp.findIndex(s => s.id === id);
  if (idx < 0) return;
  const wasPrimary = qrSlotsTemp[idx].isPrimary;
  qrSlotsTemp.splice(idx, 1);
  if (wasPrimary && qrSlotsTemp.length > 0) qrSlotsTemp[0].isPrimary = true;
  renderQRCodesManager();
};

// ══════════════════════════════════════════
// REPORTS PAGE
// ══════════════════════════════════════════
const REPORTS_PER_PAGE = 20;
let reportsPage = 1;

function setupReportsPage() {
  renderReports();
  // Wire search & filters
  const search   = document.getElementById('reportSearch');
  const status   = document.getElementById('reportStatusFilter');
  const month    = document.getElementById('reportMonthFilter');
  if (search) { search.oninput  = () => { reportsPage = 1; renderReports(); }; }
  if (status) { status.onchange = () => { reportsPage = 1; renderReports(); }; }
  if (month)  { month.onchange  = () => { reportsPage = 1; renderReports(); }; }
}

function renderReports() {
  const invoices = getInvoices();
  const search   = (document.getElementById('reportSearch')?.value || '').toLowerCase().trim();
  const status   = document.getElementById('reportStatusFilter')?.value || '';
  const month    = document.getElementById('reportMonthFilter')?.value  || '';

  populateReportMonthFilter(invoices);

  // ── Stat cards ──
  const totalRevenue = invoices.reduce((s, i) => s + (i.amount || 0), 0);
  const uploaded     = invoices.filter(i => i.reportUploaded).length;
  const missing      = invoices.length - uploaded;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('rp-total',    invoices.length);
  set('rp-uploaded', uploaded);
  set('rp-missing',  missing);
  set('rp-revenue',  '₹' + totalRevenue.toLocaleString('en-IN'));

  // ── Filter ──
  const filtered = invoices.filter(inv => {
    const matchSearch = !search ||
      inv.client.name.toLowerCase().includes(search) ||
      inv.client.phone.includes(search);
    const matchStatus = !status ||
      (status === 'missing'  && !inv.reportUploaded) ||
      (status === 'uploaded' &&  inv.reportUploaded);
    // date stored as DD/MM/YYYY — month key is MM/YYYY
    const invMonth = inv.date ? inv.date.substring(3) : '';  // strips DD/
    const matchMonth = !month || invMonth === month;
    return matchSearch && matchStatus && matchMonth;
  });

  // ── Paginate ──
  const start     = (reportsPage - 1) * REPORTS_PER_PAGE;
  const paginated = filtered.slice(start, start + REPORTS_PER_PAGE);

  const tbody = document.getElementById('reportsBody');
  if (!tbody) return;

  if (!paginated.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="no-data">
      <div class="empty-state">
        <div class="icon">📋</div>
        <h3>No records found</h3>
        <p>Try clearing the search or changing the filter.</p>
      </div></td></tr>`;
  } else {
    tbody.innerHTML = paginated.map((inv, i) => {
      const statusBadge = inv.reportUploaded
        ? `<span class="badge badge-green">✅ Uploaded</span>`
        : `<span class="badge badge-amber">⚠ Missing</span>`;

      const invJson = JSON.stringify(inv).replace(/'/g, '&#39;');
      const uploadAction = inv.reportUploaded
        ? `<button class="btn btn-sm btn-success" onclick="_rpDownload('${inv.id}')" title="Download Report">⬇ Report</button>`
        : `<label class="btn btn-sm btn-ghost" for="rpu_${inv.id}" title="Upload Report" style="cursor:pointer">📤 Upload</label>
           <input type="file" id="rpu_${inv.id}" accept=".pdf,image/*" style="display:none" onchange="_rpUpload('${inv.id}',this)"/>`;

      return `<tr>
        <td style="color:var(--text-muted);font-size:.8rem">${start + i + 1}</td>
        <td><span style="font-family:monospace;font-size:.75rem;color:var(--primary);font-weight:700">${inv.id}</span></td>
        <td style="font-size:.8rem;white-space:nowrap">${inv.date}</td>
        <td><strong style="font-size:.88rem">${inv.client.name}</strong><br>
            <span style="font-size:.72rem;color:var(--text-muted)">${inv.client.location || ''}</span></td>
        <td style="font-size:.82rem">${inv.client.phone}</td>
        <td><span class="badge badge-purple" style="font-size:.72rem">${inv.testName}</span></td>
        <td style="font-weight:700;color:var(--success);font-size:.88rem">₹${(inv.amount||0).toLocaleString('en-IN')}</td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex;gap:.35rem;flex-wrap:wrap;align-items:center">
            <button class="btn btn-sm btn-primary" onclick='openInvoiceModal(${invJson})' title="View Invoice">🖨 Invoice</button>
            ${uploadAction}
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  // ── Count + Pagination ──
  const countEl = document.getElementById('reportsCount');
  if (countEl) {
    const end = Math.min(start + REPORTS_PER_PAGE, filtered.length);
    const totalPages = Math.ceil(filtered.length / REPORTS_PER_PAGE);
    let paginationHtml = '';
    if (totalPages > 1) {
      const pages = [];
      for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || Math.abs(p - reportsPage) <= 2) {
          pages.push(`<button class="btn btn-sm ${p === reportsPage ? 'btn-primary' : 'btn-ghost'}"
            onclick="changeReportsPage(${p})" ${p === reportsPage ? 'disabled' : ''}>${p}</button>`);
        } else if (pages[pages.length - 1] !== '…') {
          pages.push('…');
        }
      }
      paginationHtml = `
        <div style="display:flex;justify-content:center;align-items:center;gap:.4rem;margin-top:1rem;flex-wrap:wrap">
          <button class="btn btn-sm btn-ghost" onclick="changeReportsPage(${reportsPage - 1})" ${reportsPage === 1 ? 'disabled' : ''}>← Prev</button>
          ${pages.join('')}
          <button class="btn btn-sm btn-ghost" onclick="changeReportsPage(${reportsPage + 1})" ${reportsPage === totalPages ? 'disabled' : ''}>Next →</button>
        </div>`;
    }
    countEl.innerHTML = `<span>Showing <strong>${start + 1}–${end}</strong> of <strong>${filtered.length}</strong> invoices</span>${paginationHtml}`;
  }
}

function populateReportMonthFilter(invoices) {
  const sel = document.getElementById('reportMonthFilter');
  if (!sel || sel.dataset.populated === 'true') return;
  const months = new Set();
  invoices.forEach(inv => {
    if (inv.date) months.add(inv.date.substring(3)); // MM/YYYY
  });
  const opts = Array.from(months).sort((a, b) => {
    const [am, ay] = a.split('/'); const [bm, by] = b.split('/');
    return (by - ay) || (bm - am); // newest first
  }).map(m => {
    const [mm, yyyy] = m.split('/');
    const label = new Date(yyyy, parseInt(mm) - 1, 1)
      .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return `<option value="${m}">${label}</option>`;
  }).join('');
  sel.innerHTML = `<option value="">All Time</option>${opts}`;
  sel.dataset.populated = 'true';
}

window.changeReportsPage = function(p) { reportsPage = p; renderReports(); };

// Upload a report from the Reports page
window._rpUpload = function(invId, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const invoices = getInvoices();
    const inv = invoices.find(i => i.id === invId);
    if (!inv) return;
    if (!inv.reportFiles) inv.reportFiles = [];
    inv.reportFiles.push({ name: file.name, data: ev.target.result, date: new Date().toISOString() });
    inv.reportUploaded = true;
    saveInvoices(invoices);
    updateMissingReportsBadge();
    toast('Report uploaded!', 'success');
    renderReports();
  };
  reader.readAsDataURL(file);
};

// Download a report from the Reports page (first file)
window._rpDownload = function(invId) {
  const invoices = getInvoices();
  const inv = invoices.find(i => i.id === invId);
  if (!inv || !inv.reportFiles || !inv.reportFiles.length) { toast('No report file found', 'error'); return; }
  const f = inv.reportFiles[0];
  const a = document.createElement('a');
  a.href = f.data; a.download = f.name || `${invId}_report.pdf`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

// Export all filtered reports as CSV
window.exportReportsCSV = function() {
  const invoices = getInvoices();
  const header   = 'Invoice ID,Date,Patient Name,Age,Gender,Phone,Location,Test,Amount,Report Status';
  const rows     = invoices.map(inv =>
    `"${inv.id}","${inv.date}","${inv.client.name}","${inv.client.age||''}","${inv.client.gender||''}","${inv.client.phone}","${inv.client.location||''}","${inv.testName}","${inv.amount}","${inv.reportUploaded ? 'Uploaded' : 'Missing'}"`
  ).join('\n');
  const blob = new Blob([header + '\n' + rows], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `SriNeevi_Reports_${new Date().toLocaleDateString('en-IN').replace(/\//g,'-')}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast('Reports exported as CSV!', 'success');
};
