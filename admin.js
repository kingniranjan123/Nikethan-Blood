// ── STATE ──
let clients = [], packages = [], prices = [];
let editingClientIdx = -1, editingPkgIdx = -1;
let currentLang = localStorage.getItem('srineevi_lang') || 'ta';

// Pagination State
const ITEMS_PER_PAGE = 20;
let pageState = { clients: 1, packages: 1, prices: 1 };

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  if (sessionStorage.getItem('qnq_admin_session') !== 'true') {
    window.location.href = 'index.html'; return;
  }
  document.getElementById('topbarDate').textContent = new Date().toLocaleDateString('en-IN', {weekday:'short',day:'numeric',month:'short',year:'numeric'});
  
  await loadAll();
  setLang(currentLang);
  setupNav();
  setupClientPage();
  setupPkgPage();
  setupPricePage();
  setupAnalytics();
  updateEnquiryBadge();
  updateMissingReportsBadge();

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('qnq_admin_session');
    window.location.href = 'index.html';
  });
});

// ── LANGUAGE SWITCHER ──
function setLang(lang) {
  if (!TRANSLATIONS[lang]) lang = 'en';
  currentLang = lang;
  localStorage.setItem('srineevi_lang', lang);
  document.documentElement.lang = lang;

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  const t = TRANSLATIONS[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.innerHTML = t[key];
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) el.placeholder = t[key];
  });

  // Re-render to apply localized content
  const activePage = document.querySelector('.sidebar-nav a.active').dataset.page;
  if (activePage === 'clients') renderClients();
  if (activePage === 'packages') renderPackages('all');
  if (activePage === 'prices') renderPrices();
}

async function fetchCSV(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const csvText = await response.text();
  return new Promise(resolve => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: results => resolve(results.data)
    });
  });
}

async function loadAll() {
  try {
    const [c, p, pr] = await Promise.all([
      fetchCSV('Client List/clients_master.csv').catch(()=>[]),
      fetchCSV('Package list/package_list.csv').catch(()=>[]),
      fetchCSV('Price List/price_list.csv').catch(()=>[])
    ]);

    // Map CSV columns to JS state
    clients = c.map(row => ({
      date: row['Date'] || '',
      serial: row['Serial No'] || '',
      name: row['Name'] || row['Patient Name'] || '',
      age: row['Age'] || '',
      gender: row['Gender'] || '',
      phone: row['Phone'] || '',
      package: row['Package'] || row['Tests'] || '',
      address: row['Address'] || '',
      status: row['Status'] || 'Active'
    }));

    packages = p.map(row => ({
      id: (row['Package Name'] || '').toLowerCase().replace(/\s+/g,'-'),
      name: row['Package Name'] || '',
      price: parseInt(row['Price']) || parseInt(row['Price (INR)']) || 0,
      originalPrice: parseInt(row['Original Price']) || parseInt(row['Price']) * 2 || 0,
      gender: row['Gender'] || 'Both',
      tests: (row['Tests Included'] || '').split(/[,|]/).map(t=>t.trim()),
      description: row['Description'] || '',
      color: '#7C3AED', popular: false
    }));

    prices = pr.map(row => ({
      id: row['S.NO'] || row['NO'] || '',
      test: row['INVESTIGATION NAME'] || row['Test Name'] || '',
      mrp: parseInt(row['MRP']) || parseInt(row['MRP (INR)']) || null,
      splPrice: parseInt(row['SPL PRICE']) || parseInt(row['Special Price (INR)']) || 0,
      ourPrice: parseInt(row['Our Price (INR)']) || parseInt(row['SPL PRICE']) || parseInt(row['MRP']) || 0
    })).filter(p => p.test && p.test.trim() !== '');

  } catch(e) {
    console.error("Error loading CSV files:", e);
    toast("Failed to load CSV files", "error");
  }
}

// ── NAVIGATION ──
function setupNav() {
  const titles = {
    analytics:'&#128202; Analytics Dashboard',
    clients:'&#128101; Client List',
    packages:'&#128230; Package List',
    prices:'&#128176; Price List',
    enquiries:'&#128221; Customer Enquiries',
    billing:'&#128179; Billing',
    reports:'&#128203; Reports History',
    settings:'&#9881;&#65039; Settings'
  };
  document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const pg = link.dataset.page;
      if (pg === 'parser') return;
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('[data-page]').forEach(l => l.classList.remove('active'));
      document.getElementById('page-' + pg).classList.add('active');
      link.classList.add('active');
      document.getElementById('topbarTitle').innerHTML = titles[pg] || pg;
      if (pg === 'analytics') setupAnalytics();
      if (pg === 'clients')   renderClients();
      if (pg === 'packages')  renderPackages('all');
      if (pg === 'prices')    renderPrices();
      if (pg === 'enquiries') renderEnquiries();
      if (pg === 'billing')   { setupBillingPage(); }
      if (pg === 'reports')   { setupReportsPage(); }
      if (pg === 'settings')  { loadSettingsPage(); }
    });
  });
  updateEnquiryBadge();
}

// ── PAGINATION CONTROLS ──
function createPaginationHTML(type, totalItems, currentPage) {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) return '';
  return `
    <div class="pagination-controls" style="display:flex;justify-content:center;gap:1rem;margin-top:1rem;align-items:center">
      <button class="btn btn-ghost btn-sm" onclick="changePage('${type}', ${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>← Previous</button>
      <span style="font-size:0.85rem;color:var(--text-muted)">Page ${currentPage} of ${totalPages}</span>
      <button class="btn btn-ghost btn-sm" onclick="changePage('${type}', ${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>
    </div>
  `;
}

window.changePage = function(type, newPage) {
  pageState[type] = newPage;
  if (type === 'clients') renderClients();
  if (type === 'packages') renderPackages();
  if (type === 'prices') renderPrices();
}

// ── CLIENTS PAGE ──
function setupClientPage() {
  document.getElementById('addClientBtn').addEventListener('click', () => openClientModal());
  document.getElementById('exportClientsBtn').addEventListener('click', () => exportCSV(buildClientCSV(), 'client_list.csv'));
  document.getElementById('clientSearch').addEventListener('input', () => { pageState.clients = 1; renderClients(); });
  document.getElementById('clientGenderFilter').addEventListener('change', () => { pageState.clients = 1; renderClients(); });
  document.getElementById('clientPkgFilter').addEventListener('change', () => { pageState.clients = 1; renderClients(); });
  document.getElementById('saveClientBtn').addEventListener('click', saveClient);
  // CSV import handler
  document.getElementById('clientCsvInput').addEventListener('change', function(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = Papa.parse(ev.target.result, {header:true, skipEmptyLines:true}).data;
      let added = 0, updated = 0;
      rows.forEach(row => {
        const name = (row['Name'] || row['Patient Name'] || '').trim();
        const phone = (row['Phone'] || '').trim();
        if (!name) return;
        const obj = {
          date: row['Date'] || '', serial: row['Serial No'] || '',
          name, age: row['Age'] || '', gender: row['Gender'] || '',
          phone, package: row['Package'] || '', address: row['Address'] || '', status: row['Status'] || 'Active'
        };
        const existingIdx = phone ? clients.findIndex(c => c.phone === phone) : -1;
        if (existingIdx >= 0) { clients[existingIdx] = obj; updated++; } else { clients.push(obj); added++; }
      });
      document.getElementById('clientImportStatus').textContent = `Imported: ${added} new, ${updated} updated.`;
      renderClients();
      toast(`Clients imported: ${added} new, ${updated} updated`, 'success');
    };
    reader.readAsText(file);
  });
  renderClients();
}

function renderClients() {
  const search = (document.getElementById('clientSearch').value || '').toLowerCase();
  const gf = document.getElementById('clientGenderFilter').value;
  const pf = document.getElementById('clientPkgFilter').value;
  
  let filtered = clients.filter(c => {
    const matchSearch = !search || [c.name,c.phone,c.package,c.date].join(' ').toLowerCase().includes(search);
    const matchGender = !gf || c.gender === gf;
    const matchPkg = !pf || (c.package||'').toLowerCase().includes(pf.toLowerCase());
    return matchSearch && matchGender && matchPkg;
  });

  const startIdx = (pageState.clients - 1) * ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const tbody = document.getElementById('clientsBody');
  if (!paginated.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="icon">📂</div><h3>No clients found</h3><p>Try changing filters.</p></div></td></tr>`;
  } else {
    tbody.innerHTML = paginated.map((c, i) => {
      const globalIdx = startIdx + i;
      return `<tr>
        <td>${globalIdx+1}</td>
        <td>${c.date||'—'}</td>
        <td><strong>${c.name||'—'}</strong></td>
        <td>${c.age||'—'}</td>
        <td><span class="badge ${c.gender==='M'?'badge-blue':'badge-red'}">${c.gender||'—'}</span></td>
        <td>${c.phone||'—'}</td>
        <td><span class="badge badge-purple">${c.package||'—'}</span></td>
        <td>${c.address||'—'}</td>
        <td><span class="badge badge-green">Active</span></td>
        <td style="display:flex;gap:.4rem">
          <button class="btn btn-danger btn-sm" onclick="deleteClient(${globalIdx})">🗑</button>
        </td>
      </tr>`;
    }).join('');
  }
  
  // Pagination
  let countText = document.getElementById('clientCount');
  countText.innerHTML = `Showing ${startIdx + 1}-${Math.min(startIdx + ITEMS_PER_PAGE, filtered.length)} of ${filtered.length} records`;
  countText.innerHTML += createPaginationHTML('clients', filtered.length, pageState.clients);

  // Stats
  const dates = new Set(clients.map(c => c.date).filter(Boolean));
  document.getElementById('sc-total').textContent = clients.length;
  document.getElementById('sc-dates').textContent = dates.size;
}

function openClientModal() {
  const modal = document.getElementById('clientModal');
  document.getElementById('fDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('fSerial').value = '';
  document.getElementById('fName').value = '';
  document.getElementById('fAge').value = '';
  document.getElementById('fGender').value = '';
  document.getElementById('fPhone').value = '';
  document.getElementById('fPackage').value = '';
  const fAddr = document.getElementById('fAddress'); if (fAddr) fAddr.value = '';
  modal.classList.add('active');
}

function closeClientModal() { document.getElementById('clientModal').classList.remove('active'); }

function saveClient() {
  const name = document.getElementById('fName').value.trim();
  if (!name) { toast('Name is required', 'error'); return; }
  clients.push({
    date: document.getElementById('fDate').value,
    serial: document.getElementById('fSerial').value.trim(),
    name, age: document.getElementById('fAge').value,
    gender: document.getElementById('fGender').value,
    phone: document.getElementById('fPhone').value.trim(),
    package: document.getElementById('fPackage').value.trim(),
    address: document.getElementById('fAddress').value.trim()
  });
  closeClientModal();
  renderClients();
  toast('Client added', 'success');
}

function deleteClient(idx) {
  if (!confirm(`Delete client "${clients[idx].name}"?`)) return;
  clients.splice(idx, 1);
  renderClients();
  toast('Client deleted', 'success');
}

function buildClientCSV() {
  const header = ['Date','Serial No','Patient Name','Age','Gender','Phone','Package','Address'];
  const rows = clients.map(c => [c.date||'',c.serial||'',c.name||'',c.age||'',c.gender||'',c.phone||'',c.package||'',c.address||'']);
  return [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
}

// ── PACKAGES PAGE ──
function setupPkgPage() {
  document.getElementById('addPkgBtn').addEventListener('click', () => openPkgModal());
  document.getElementById('exportPkgBtn').addEventListener('click', () => exportCSV(buildPkgCSV(), 'packages.csv'));
  document.getElementById('savePkgBtn').addEventListener('click', savePkg);
  document.getElementById('pkgSearch').addEventListener('input', () => { pageState.packages = 1; renderPackages(); });
  document.getElementById('pkgGenderFilter').addEventListener('change', () => { pageState.packages = 1; renderPackages(); });
  // CSV import handler
  document.getElementById('pkgCsvInput').addEventListener('change', function(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = Papa.parse(ev.target.result, {header:true, skipEmptyLines:true}).data;
      let added = 0, updated = 0;
      rows.forEach(row => {
        const name = (row['Package Name'] || row['name'] || '').trim();
        if (!name) return;
        const existing = packages.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
        const obj = {
          id: name.toLowerCase().replace(/\s+/g,'-'), name,
          price: parseInt(row['Price']) || 0,
          originalPrice: parseInt(row['Original Price']) || parseInt(row['Price'])*2 || 0,
          gender: row['Gender'] || 'Both',
          tests: (row['Tests Included'] || '').split(/[|,]/).map(t=>t.trim()).filter(Boolean),
          description: row['Description'] || '', color: '#7C3AED', popular: false
        };
        if (existing >= 0) { packages[existing] = obj; updated++; } else { packages.push(obj); added++; }
      });
      document.getElementById('pkgImportStatus').textContent = `Imported: ${added} new, ${updated} updated.`;
      renderPackages();
      toast(`Packages imported: ${added} new, ${updated} updated`, 'success');
    };
    reader.readAsText(file);
  });
  renderPackages();
}

function renderPackages() {
  const body = document.getElementById('pkgsBody');
  const countEl = document.getElementById('pkgCount');
  if (!body) return;
  const searchVal = (document.getElementById('pkgSearch')?.value || '').toLowerCase();
  const genderVal = document.getElementById('pkgGenderFilter')?.value || '';
  const filtered = packages.filter(p => {
    const matchGender = !genderVal || p.gender === genderVal || (genderVal === 'Both' && p.gender === 'Both');
    const matchSearch = !searchVal ||
      p.name.toLowerCase().includes(searchVal) ||
      (p.tests || []).some(t => t.toLowerCase().includes(searchVal)) ||
      (p.description || '').toLowerCase().includes(searchVal);
    return matchGender && matchSearch;
  });
  if (!filtered.length) { body.innerHTML = '<tr><td colspan="8" class="no-data"><div class="empty-state"><div class="icon">📦</div><h3>No packages found</h3></div></td></tr>'; if(countEl) countEl.textContent=''; return; }
  const startIdx = (pageState.packages - 1) * ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  body.innerHTML = paginated.map((pkg, i) => {
    const globalIdx = packages.indexOf(pkg);
    const savings = pkg.originalPrice > 0 ? Math.round((1-pkg.price/pkg.originalPrice)*100) : 0;
    const testList = (pkg.tests||[]).slice(0,3).join(', ') + ((pkg.tests||[]).length > 3 ? ` +${pkg.tests.length-3} more` : '');
    return `<tr>
      <td style="color:var(--text-muted)">${startIdx+i+1}</td>
      <td><strong>${pkg.name}</strong></td>
      <td style="color:var(--primary);font-weight:700">&#8377;${(pkg.price||0).toLocaleString()}</td>
      <td style="color:var(--text-muted);text-decoration:line-through">&#8377;${(pkg.originalPrice||0).toLocaleString()}</td>
      <td><span style="background:rgba(37,99,235,.1);color:#2563eb;padding:.15rem .5rem;border-radius:100px;font-size:.78rem">${pkg.gender}</span></td>
      <td style="font-size:.82rem;max-width:260px">${testList}</td>
      <td style="font-size:.82rem;color:var(--text-muted)">${pkg.description||''}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deletePkg(${globalIdx})">&#128465;</button></td>
    </tr>`;
  }).join('');
  const grid = document.getElementById('pkgsBody')?.closest('.table-wrap')?.parentElement;
  const oldPagination = document.getElementById('pkgPaginationCtrl');
  if (oldPagination) oldPagination.remove();
  if (filtered.length > ITEMS_PER_PAGE && grid) {
    const pc = document.createElement('div'); pc.id='pkgPaginationCtrl';
    pc.innerHTML = createPaginationHTML('packages', filtered.length, pageState.packages);
    grid.appendChild(pc);
  }
  if (countEl) countEl.textContent = `Showing ${startIdx+1}–${Math.min(startIdx+ITEMS_PER_PAGE, filtered.length)} of ${filtered.length} packages`;
}

function openPkgModal() {
  document.getElementById('pfName').value = '';
  document.getElementById('pfPrice').value = '';
  document.getElementById('pfTests').value = '';
  document.getElementById('pkgModal').classList.add('active');
}

function closePkgModal() { document.getElementById('pkgModal').classList.remove('active'); }

function savePkg() {
  const name = document.getElementById('pfName').value.trim();
  const price = parseInt(document.getElementById('pfPrice').value);
  const testsRaw = document.getElementById('pfTests').value.trim();
  if (!name || !price || !testsRaw) { toast('Name, price and tests are required', 'error'); return; }
  packages.push({
    id: name.toLowerCase().replace(/\s+/g,'-'),
    name, gender: document.getElementById('pfGender').value,
    price, originalPrice: parseInt(document.getElementById('pfOriginal').value) || price * 2,
    description: document.getElementById('pfDesc').value.trim(),
    tests: testsRaw.split('\n').map(t => t.trim()).filter(Boolean),
  });
  closePkgModal();
  renderPackages('all');
  toast('Package added', 'success');
}

function deletePkg(idx) {
  if (!confirm(`Delete package "${packages[idx].name}"?`)) return;
  packages.splice(idx, 1);
  renderPackages('all');
  toast('Package deleted', 'success');
}

function buildPkgCSV() {
  const header = ['Package Name','Price (INR)','Original Price','Gender','Tests Included','Test Count','Description'];
  const rows = packages.map(p => [p.name, p.price, p.originalPrice, p.gender, p.tests.join(' | '), p.tests.length, p.description||'']);
  return [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
}

// ── PRICES PAGE ──
function setupPricePage() {
  document.getElementById('addPriceBtn').addEventListener('click', () => {
    prices.push({ id: prices.length + 1, test: 'New Test', mrp: null, splPrice: 0, ourPrice: 0 });
    renderPrices();
    toast('Row added', 'success');
  });
  document.getElementById('exportPriceBtn').addEventListener('click', () => exportCSV(buildPriceCSV(), 'price_list.csv'));
  // CSV import handler
  document.getElementById('priceCsvInput').addEventListener('change', function(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = Papa.parse(ev.target.result, {header:true, skipEmptyLines:true}).data;
      let added = 0, updated = 0;
      rows.forEach(row => {
        const name = (row['INVESTIGATION NAME'] || row['Test Name'] || row['test'] || '').trim();
        if (!name) return;
        const obj = {
          id: row['S.NO'] || row['NO'] || '',
          test: name,
          mrp: parseInt(row['MRP']) || null,
          splPrice: parseInt(row['SPL PRICE']) || parseInt(row['Special Price (INR)']) || 0,
          ourPrice: parseInt(row['Our Price (INR)']) || parseInt(row['SPL PRICE']) || 0
        };
        const existingIdx = prices.findIndex(p => p.test.toLowerCase() === name.toLowerCase());
        if (existingIdx >= 0) { prices[existingIdx] = obj; updated++; } else { prices.push(obj); added++; }
      });
      document.getElementById('priceImportStatus').textContent = `Imported: ${added} new, ${updated} updated.`;
      renderPrices();
      toast(`Prices imported: ${added} new, ${updated} updated`, 'success');
    };
    reader.readAsText(file);
  });
  renderPrices();
}

function renderPrices() {
  const startIdx = (pageState.prices - 1) * ITEMS_PER_PAGE;
  const paginated = prices.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const tbody = document.getElementById('priceBody');
  tbody.innerHTML = paginated.map((p, i) => {
    const globalIdx = startIdx + i;
    return `
    <tr class="price-edit-row">
      <td>${p.id}</td>
      <td><input value="${p.test||''}" onchange="prices[${globalIdx}].test=this.value" style="width:100%;background:transparent;border:none;color:var(--text);font-family:inherit;font-size:.85rem"/></td>
      <td><input type="number" value="${p.mrp||''}" onchange="prices[${globalIdx}].mrp=this.value?parseInt(this.value):null" style="width:80px;background:transparent;border:none;color:var(--text-secondary);font-family:inherit;font-size:.85rem;text-align:right"/></td>
      <td><input type="number" value="${p.splPrice||''}" onchange="prices[${globalIdx}].splPrice=parseInt(this.value)||0" style="width:80px;background:transparent;border:none;color:var(--text);font-family:inherit;font-size:.85rem;text-align:right"/></td>
      <td><input type="number" value="${p.ourPrice||''}" onchange="prices[${globalIdx}].ourPrice=parseInt(this.value)||0" style="width:80px;background:transparent;border:none;color:var(--accent);font-weight:700;font-family:inherit;font-size:.85rem;text-align:right"/></td>
      <td><button class="btn btn-danger btn-sm" onclick="deletePrice(${globalIdx})">🗑</button></td>
    </tr>`}).join('');

  const tableWrap = tbody.parentElement.parentElement;
  let paginationEl = document.getElementById('pricePagination');
  if (!paginationEl) {
    paginationEl = document.createElement('div');
    paginationEl.id = 'pricePagination';
    tableWrap.appendChild(paginationEl);
  }
  paginationEl.innerHTML = createPaginationHTML('prices', prices.length, pageState.prices);
}

function deletePrice(idx) { prices.splice(idx, 1); renderPrices(); toast('Row deleted', 'success'); }

function buildPriceCSV() {
  const header = ['No','Test Name','MRP (INR)','Special Price (INR)','Our Price (INR)'];
  const rows = prices.map(p => [p.id, p.test, p.mrp||'', p.splPrice, p.ourPrice]);
  return [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
}

// ── ANALYTICS PAGE ──
let salesChartInst, repeatsChartInst, testsChartInst;
function setupAnalytics() {
  if (!clients.length) return;

  // 1. Process Data & Calculate Timeframes
  let sortedClients = [...clients].filter(c => c.date).sort((a,b) => {
    const [d1,m1,y1] = a.date.split('/'); const [d2,m2,y2] = b.date.split('/');
    return new Date(y1,m1-1,d1) - new Date(y2,m2-1,d2);
  });
  if (!sortedClients.length) return;

  const [sd, sm, sy] = sortedClients[0].date.split('/');
  const startDate = new Date(sy, sm-1, sd);
  
  let weeklyData = {}; // key: "Week X", value: { revenue:0, repeats:0, tests:{}, visits:0 }
  let seenPhones = new Set();
  let totalRevenue = 0;
  let totalRepeats = 0;
  let allTestCounts = {};
  let lastWeekKey = "Week 1";
  let genders = { M:0, F:0 };

  sortedClients.forEach(c => {
    if (!c.date) return;
    const [d,m,y] = c.date.split('/');
    const currDate = new Date(y, m-1, d);
    const diffTime = Math.abs(currDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weekNum = Math.floor(diffDays / 7) + 1;
    const weekKey = `Week ${weekNum}`;
    lastWeekKey = weekKey;
    
    if (!weeklyData[weekKey]) {
      const ws = new Date(startDate.getTime() + (weekNum - 1) * 7 * 24 * 60 * 60 * 1000);
      const we = new Date(ws.getTime() + 6 * 24 * 60 * 60 * 1000);
      const fmt = d => d.toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'});
      weeklyData[weekKey] = { revenue:0, repeats:0, tests:{}, visits:0, dateRange: `${fmt(ws)} - ${fmt(we)}` };
    }
    weeklyData[weekKey].visits++;

    // Calculate revenue
    let visitRevenue = 0;
    const pkgStr = (c.package || '').toLowerCase();
    
    // Estimate based on packages
    if (pkgStr.includes('mini')) visitRevenue += 499;
    else if (pkgStr.includes('value')) visitRevenue += 1499;
    else if (pkgStr.includes('basic')) visitRevenue += 999;
    else if (pkgStr.includes('premium')) visitRevenue += 2499;
    else if (pkgStr.includes('elite')) visitRevenue += 3999;
    else {
      // Default fallback for custom tests if not a package
      visitRevenue += 250; 
    }
    weeklyData[weekKey].revenue += visitRevenue;
    totalRevenue += visitRevenue;

    // Track repeated customers
    const phone = c.phone || c.name; // fallback to name if no phone
    if (seenPhones.has(phone)) {
      weeklyData[weekKey].repeats++;
      totalRepeats++;
    } else {
      seenPhones.add(phone);
    }

    // Track test types
    const typesToTrack = ['Thyroid', 'HbA1c', 'PPBS', 'FBS', 'Lipid', 'CBC', 'Mini', 'Basic', 'Value', 'RBS'];
    typesToTrack.forEach(type => {
      if (pkgStr.includes(type.toLowerCase())) {
        weeklyData[weekKey].tests[type] = (weeklyData[weekKey].tests[type] || 0) + 1;
        allTestCounts[type] = (allTestCounts[type] || 0) + 1;
      }
    });

    if (c.gender === 'M' || c.gender === 'F') genders[c.gender]++;
  });

  // Prepare Chart Arrays
  const labels = Object.keys(weeklyData).sort((a,b) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]));
  const revenueData = labels.map(l => weeklyData[l].revenue);
  const repeatsData = labels.map(l => weeklyData[l].repeats);
  
  // Update Bullet Stats
  document.getElementById('as-users').textContent = seenPhones.size;
  document.getElementById('as-repeats').textContent = totalRepeats;
  document.getElementById('as-revenue').textContent = `₹${totalRevenue.toLocaleString()}`;
  document.getElementById('as-avg').textContent = `₹${Math.round(totalRevenue/sortedClients.length).toLocaleString()}`;
  
  // Top 3 Tests Last Week
  const lastWeekTests = weeklyData[lastWeekKey].tests;
  const topLastWeek = Object.entries(lastWeekTests).sort((a,b)=>b[1]-a[1]).slice(0,3);
  document.getElementById('as-top-tests').innerHTML = topLastWeek.length ? 
    topLastWeek.map(t => `<li><span style="color:var(--primary-light);font-weight:700">${t[0]}</span> <span style="float:right">${t[1]} tests</span></li>`).join('') :
    '<li style="color:var(--text-muted)">No specific tests identified last week.</li>';

  // Other Key Stats
  let maxVisits = 0, busyWeek = '';
  labels.forEach(l => { if(weeklyData[l].visits > maxVisits) { maxVisits = weeklyData[l].visits; busyWeek = l; } });
  document.getElementById('as-busy-week').textContent = `${busyWeek} (${maxVisits} visits)`;
  
  const popPkg = Object.entries(allTestCounts).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('as-pop-pkg').textContent = popPkg ? `${popPkg[0]} (${popPkg[1]} times)` : '—';
  document.getElementById('as-gender-ratio').textContent = `${genders.M} Male / ${genders.F} Female`;

  // Render Charts
  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#1e293b',
          font: { size: 13, weight: '600', family: "'Inter', sans-serif" },
          padding: 22,
          usePointStyle: true,
          pointStyleWidth: 12
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.92)',
        titleColor: '#f1f5f9',
        titleFont: { size: 13, weight: '700' },
        bodyColor: '#94a3b8',
        bodyFont: { size: 12 },
        padding: 12,
        borderColor: 'rgba(220,38,38,0.4)',
        borderWidth: 1,
        callbacks: {
          title: function(context) {
            const label = context[0].label;
            return label + ' (' + (weeklyData[label] ? weeklyData[label].dateRange : '') + ')';
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#475569', font: { size: 11 }, maxRotation: 45 },
        grid: { color: 'rgba(0,0,0,0.06)' }
      },
      y: {
        ticks: { color: '#475569', font: { size: 11 } },
        grid: { color: 'rgba(0,0,0,0.06)' }
      }
    }
  };

  if (salesChartInst) salesChartInst.destroy();
  salesChartInst = new Chart(document.getElementById('salesChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Total Revenue (₹)',
        data: revenueData,
        borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)',
        tension: 0.3, fill: true
      }]
    }, options: chartOptions
  });

  if (repeatsChartInst) repeatsChartInst.destroy();
  repeatsChartInst = new Chart(document.getElementById('repeatsChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Repeated Customers',
        data: repeatsData,
        borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.1)',
        tension: 0.3, fill: true
      }]
    }, options: chartOptions
  });

  // Test Types Multi-Line Chart
  const testTypes = ['Mini', 'Basic', 'Value', 'Thyroid', 'HbA1c'];
  const testColors = ['#7C3AED', '#3B82F6', '#10B981', '#EC4899', '#F59E0B'];
  const testDatasets = testTypes.map((type, i) => {
    return {
      label: type,
      data: labels.map(l => weeklyData[l].tests[type] || 0),
      borderColor: testColors[i], backgroundColor: 'transparent',
      tension: 0.3
    };
  });

  if (testsChartInst) testsChartInst.destroy();
  testsChartInst = new Chart(document.getElementById('testsChart'), {
    type: 'line',
    data: { labels, datasets: testDatasets },
    options: chartOptions
  });
}

// ── UTILS ──
function exportCSV(csv, filename) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast(`${filename} downloaded!`, 'success');
}

function toast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(100%)'; el.style.transition = 'all .3s'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ── ENQUIRY BADGE (used before billing.js loads) ──
function updateEnquiryBadge() {
  const enquiries = JSON.parse(localStorage.getItem('sn_enquiries') || '[]');
  const openCount = enquiries.filter(e => !e.status || e.status === 'Open' || e.status === 'New').length;
  const badge = document.getElementById('enquiryBadge');
  if (badge) { badge.textContent = openCount > 0 ? openCount : ''; }
}

// renderEnquiries, openRejectModal, confirmRejectEnquiry,
// convertEnquiryToBilling, deleteEnquiry are in billing.js

