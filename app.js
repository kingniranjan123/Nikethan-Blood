// ── CONFIG & STATE ──
const CORRECT_PASSWORD = 'Niketh@n@123';
let packages = [], prices = [];
let currentLang = localStorage.getItem('srineevi_lang') || 'ta';

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setLang(currentLang);
  setupNavScroll();
  setupLoginModal();
  document.getElementById('todayTests').textContent = Math.floor(Math.random() * 20) + 10;
});

async function loadData() {
  try {
    const [pkgRes, priceRes] = await Promise.all([
      fetch('data/packages.json'),
      fetch('data/prices.json')
    ]);
    packages = await pkgRes.json();
    prices = await priceRes.json();
  } catch(e) {
    console.warn('Could not load data files — using fallback');
    packages = getFallbackPackages();
    prices = getFallbackPrices();
  }
}

// ── LANGUAGE SWITCHER ──
function setLang(lang) {
  if (!TRANSLATIONS[lang]) lang = 'en';
  currentLang = lang;
  localStorage.setItem('srineevi_lang', lang);
  document.documentElement.lang = lang;

  // Update buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  // Update static text
  const t = TRANSLATIONS[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.innerHTML = t[key];
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) el.placeholder = t[key];
  });

  // Re-render dynamic content
  const activeFilter = document.querySelector('.filter-btn.active')?.dataset?.filter || 'all';
  renderPackages(activeFilter);
  renderPriceTable();
}

// ── NAVBAR SCROLL ──
function setupNavScroll() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
  });
}

// ── PACKAGES ──
function renderPackages(filter) {
  const grid = document.getElementById('packagesGrid');
  if (!grid) return;
  const filtered = filter === 'all' ? packages : packages.filter(p => p.gender === filter || p.gender === 'Both');
  const t = TRANSLATIONS[currentLang];
  
  grid.innerHTML = filtered.map(pkg => {
    const genderKey = pkg.gender === 'Both' ? 'genderBoth' : pkg.gender === 'Male' ? 'genderMale' : 'genderFemale';
    const genderTag = t[genderKey] || pkg.gender;
    const savings = Math.round((1 - pkg.price/pkg.originalPrice)*100);
    
    return `
    <div class="package-card ${pkg.popular ? 'popular' : ''}" style="border-top:3px solid ${pkg.color}">
      ${pkg.popular ? `<div class="popular-badge">⭐ ${t.cardPop || 'Popular'}</div>` : ''}
      <div class="package-header">
        <div class="package-gender-tag">${genderTag}</div>
        <div class="package-name">${pkg.name}</div>
        <div class="package-price-row">
          <div class="package-price" style="color:${pkg.color}">₹${pkg.price.toLocaleString()}</div>
          <div class="package-original">₹${pkg.originalPrice.toLocaleString()}</div>
          <div class="tag green" style="font-size:.7rem;margin-left:.25rem">${savings}${t.off || '% OFF'}</div>
        </div>
        <p style="font-size:.82rem;color:var(--text-secondary)">${pkg.description}</p>
      </div>
      <div class="package-divider"></div>
      <ul class="package-tests">
        ${pkg.tests.slice(0, 5).map(tst => `<li>${tst}</li>`).join('')}
        ${pkg.tests.length > 5 ? `<li class="more" onclick="showAllTests('${pkg.id}')">+${pkg.tests.length - 5} ${t.tests || 'more tests'} →</li>` : ''}
      </ul>
      <div class="package-cta">
        <a href="tel:+919700200044" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:1rem">${t.bookNow || 'Book Now'} — ₹${pkg.price}</a>
      </div>
    </div>
  `}).join('');

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
    btn.onclick = () => renderPackages(btn.dataset.filter);
  });
}

function showAllTests(pkgId) {
  const pkg = packages.find(p => p.id === pkgId);
  if (!pkg) return;
  alert(`${pkg.name} — ${pkg.tests.length} ${TRANSLATIONS[currentLang].tests || 'Tests'}:\n\n` + pkg.tests.map((t,i) => `${i+1}. ${t}`).join('\n'));
}

// ── PRICE TABLE ──
function renderPriceTable() {
  const tbody = document.getElementById('priceTableBody');
  if (!tbody) return;
  tbody.innerHTML = prices.map((p, i) => `
    <tr style="border-bottom:1px solid var(--border);transition:background .2s" 
        onmouseover="this.style.background='rgba(255,255,255,0.03)'" 
        onmouseout="this.style.background='transparent'">
      <td style="padding:.9rem 1rem;color:var(--text-muted);font-size:.85rem">${p.id}</td>
      <td style="padding:.9rem 1rem;font-weight:500">${p.test}</td>
      <td style="padding:.9rem 1rem;text-align:right;color:var(--text-muted)">${p.mrp ? '₹'+p.mrp : '—'}</td>
      <td style="padding:.9rem 1rem;text-align:right;color:var(--text-secondary)">₹${p.splPrice}</td>
      <td style="padding:.9rem 1rem;text-align:right;font-weight:700;color:var(--accent)">₹${p.ourPrice}</td>
    </tr>
  `).join('');
}

// ── LOGIN MODAL ──
function setupLoginModal() {
  const modal = document.getElementById('loginModal');
  const loginBtn = document.getElementById('loginBtn');
  const closeBtn = document.getElementById('modalClose');
  const submitBtn = document.getElementById('loginSubmit');
  const pwInput = document.getElementById('pwInput');
  const pwError = document.getElementById('pwError');
  const togglePw = document.getElementById('togglePw');

  loginBtn.addEventListener('click', () => modal.classList.add('active'));
  closeBtn.addEventListener('click', () => closeModal());
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  togglePw.addEventListener('click', () => {
    const isText = pwInput.type === 'text';
    pwInput.type = isText ? 'password' : 'text';
    togglePw.textContent = isText ? '👁' : '🙈';
  });

  submitBtn.addEventListener('click', handleLogin);
  pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  pwInput.addEventListener('input', () => {
    pwInput.classList.remove('error');
    pwError.classList.remove('show');
  });

  function handleLogin() {
    const val = pwInput.value;
    if (val === CORRECT_PASSWORD) {
      sessionStorage.setItem('qnq_admin_session', 'true');
      submitBtn.textContent = '✅';
      submitBtn.style.background = 'var(--success)';
      setTimeout(() => { window.location.href = 'admin.html'; }, 600);
    } else {
      pwInput.classList.add('error');
      pwError.classList.add('show');
      pwInput.value = '';
      pwInput.focus();
      const m = document.querySelector('.modal');
      m.style.animation = 'shake 0.4s ease';
      setTimeout(() => m.style.animation = '', 400);
    }
  }

  function closeModal() {
    modal.classList.remove('active');
    pwInput.value = '';
    pwInput.classList.remove('error');
    pwError.classList.remove('show');
    submitBtn.style.background = '';
    // reset button text
    const t = TRANSLATIONS[currentLang];
    submitBtn.textContent = t.loginBtn || 'Access Dashboard →';
  }
}

// ── FALLBACKS ──
function getFallbackPackages() {
  return [
    { id:'all-in-one-single', name:'All in one package - Single Checkup', price:1499, originalPrice:2999, gender:'Both', color:'#059669', popular:true, tests:['Complete Blood Count','Liver Function Test','Renal Function Test','Lipid Profile','Thyroid Profile','Urine Analysis'], testCount:6, description:'Comprehensive single checkup for overall health.' },
    { id:'all-in-one-followup', name:'All in one package - Followup upto an year', price:4999, originalPrice:8999, gender:'Both', color:'#7C3AED', popular:false, tests:['Complete Blood Count','Liver Function Test','Renal Function Test','Lipid Profile','Thyroid Profile','HbA1c','Quarterly Follow-up Checkups'], testCount:7, description:'Annual health monitoring with periodic follow-ups.' },
    { id:'diabetic-thyroid-basic', name:'Diabetic, thyroid and basic blood test', price:999, originalPrice:1999, gender:'Both', color:'#2563EB', popular:false, tests:['Fasting Blood Sugar','Post Prandial Blood Sugar','HbA1c','Thyroid Profile (T3, T4, TSH)','Complete Blood Count'], testCount:5, description:'Essential screening for diabetes and thyroid function.' }
  ];
}
function getFallbackPrices() {
  return [
    {id:1,test:'Hb',mrp:120,splPrice:70,ourPrice:100},
    {id:2,test:'FBS',mrp:60,splPrice:30,ourPrice:40},
    {id:3,test:'CBC',mrp:400,splPrice:100,ourPrice:300}
  ];
}

// CSS shake animation
const style = document.createElement('style');
style.textContent = '@keyframes shake{0%,100%{transform:none}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}} .why-slide{display:none} .why-slide.active{display:block} .why-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--border,#e2e8f0);cursor:pointer;transition:all .25s} .why-dot.active{width:20px;border-radius:4px;background:var(--primary,#dc2626)}';
document.head.appendChild(style);

// ── WHY-CHOOSE-US HERO SLIDES ──
(function(){
  let cur = 0;
  const total = 3;
  window.goWhySlide = function(idx){
    const slides = document.querySelectorAll('.why-slide');
    const dots   = document.querySelectorAll('.why-dot');
    if(!slides.length) return;
    slides.forEach(s=>s.classList.remove('active'));
    dots.forEach(d=>d.classList.remove('active'));
    cur = (idx + total) % total;
    slides[cur]?.classList.add('active');
    dots[cur]?.classList.add('active');
  };
  setInterval(()=>{ goWhySlide(cur+1); }, 4000);
})();

// ── ENQUIRY FORM ──
window.submitEnquiry = function(e){
  e.preventDefault();
  const nameEl  = document.getElementById('enqName');
  const phoneEl = document.getElementById('enqPhone');
  const nameErr  = document.getElementById('enqNameErr');
  const phoneErr = document.getElementById('enqPhoneErr');
  let valid = true;

  // Name validation
  const name = (nameEl?.value||'').trim();
  if(name.length < 2){
    nameErr.style.display = 'block';
    nameEl.style.borderColor = '#dc2626';
    valid = false;
  } else {
    nameErr.style.display = 'none';
    nameEl.style.borderColor = '#059669';
  }

  // Phone validation — 10-digit Indian mobile
  const phone = (phoneEl?.value||'').trim().replace(/\s|-/g,'');
  const phoneRegex = /^[6-9]\d{9}$/;
  if(!phoneRegex.test(phone)){
    phoneErr.style.display = 'block';
    phoneEl.style.borderColor = '#dc2626';
    valid = false;
  } else {
    phoneErr.style.display = 'none';
    phoneEl.style.borderColor = '#059669';
  }

  if(!valid) return;

  // Save to localStorage
  const enquiries = JSON.parse(localStorage.getItem('sn_enquiries')||'[]');
  enquiries.unshift({
    id: Date.now(),
    name,
    phone,
    date: new Date().toLocaleString('en-IN'),
    status: 'New'
  });
  localStorage.setItem('sn_enquiries', JSON.stringify(enquiries));

  // Show success
  document.getElementById('enquiryForm').style.display = 'none';
  document.getElementById('enquirySuccess').style.display = 'block';

  // Reset form
  if(nameEl) nameEl.value = '';
  if(phoneEl) phoneEl.value = '';
};

document.head.appendChild(style);
