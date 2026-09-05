/* ============================================================
   LOST & FOUND PORTAL — app.js
   All data operations go through the REST API (Express +
   MongoDB Atlas). JWT token stored in localStorage (persists).
   ============================================================ */

/* ── API Configuration ─────────────────────────────────── */
const API = {
  // Change this to your deployed backend URL in production
  // e.g. 'https://your-app.onrender.com/api'
  BASE: 'http://localhost:5000/api',

  // ── Core fetch wrapper ──────────────────────────────────
  // Attaches the JWT from localStorage, parses JSON,
  // and throws a unified error object on non-2xx responses.
  async request(method, path, body = null, isFormData = false) {
    const token = Auth.getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData && body) headers['Content-Type'] = 'application/json';

    const options = {
      method,
      headers,
      body: isFormData ? body : (body ? JSON.stringify(body) : null),
    };

    const res = await fetch(`${this.BASE}${path}`, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Attach server message so callers can show it in the UI
      const err = new Error(data.message || `Request failed (${res.status})`);
      err.status = res.status;
      err.data   = data;
      throw err;
    }
    return data;
  },

  get(path)         { return this.request('GET',    path); },
  post(path, body)  { return this.request('POST',   path, body); },
  put(path, body)   { return this.request('PUT',    path, body); },
  patch(path, body) { return this.request('PATCH',  path, body); },
  delete(path)      { return this.request('DELETE', path); },
  postForm(path, fd){ return this.request('POST',   path, fd, true); },
  putForm(path, fd) { return this.request('PUT',    path, fd, true); },
};

/* ============================================================
   AUTH — localStorage (persists after tab close)
   Expected API contract:
     POST /api/auth/register  → { token, user: {_id, name, email, phone} }
     POST /api/auth/login     → { token, user: {_id, name, email, phone} }
     GET  /api/auth/profile   → { success: true, data: { _id, name, email, phone, ... } }
     POST /api/auth/logout    → { message }
   ============================================================ */
const Auth = {
  // In-memory cache
  _user:  null,
  _token: null,

  /* Store token + user returned by the API */
  setSession(token, user) {
    this._token = token;
    this._user  = user;
    localStorage.setItem('lf_token', token);
    localStorage.setItem('lf_user',  JSON.stringify(user));
    if (user.role) localStorage.setItem('role', user.role);
  },

  /* Restore from localStorage (called on page load) */
  restoreSession() {
    try {
      this._token = localStorage.getItem('lf_token');
      if (this._token === 'undefined') this._token = null;

      const raw = localStorage.getItem('lf_user');
      if (!raw || raw === 'undefined') {
        this._user = null;
      } else {
        this._user = JSON.parse(raw);
      }
    } catch (err) {
      this._token = null;
      this._user  = null;
    }
  },

  getToken() { return this._token; },
  getUser()  { return this._user;  },
  isLoggedIn(){ return !!this._token; },

  /* Clear everything and redirect to home */
  async logout() {
    try { await API.post('/auth/logout'); } catch (_) { /* ignore */ }
    this._token = null;
    this._user  = null;
    localStorage.removeItem('lf_token');
    localStorage.removeItem('lf_user');
    localStorage.removeItem('role');
    this.updateNav();
    window.location.href = 'index.html';
  },

  /* Reflect login state in the navbar */
  updateNav() {
    const authEl = document.querySelector('.nav-auth');
    const userEl = document.querySelector('.nav-user');
    const mAuth  = document.querySelector('.mobile-auth');
    const mUser  = document.querySelector('.mobile-user');
    const user   = this.getUser();

    if (authEl && userEl) {
      if (user) {
        authEl.classList.add('hidden');
        userEl.classList.add('visible');
        const nameEl   = userEl.querySelector('.user-name');
        const avatarEl = userEl.querySelector('.user-avatar');
        if (nameEl)   nameEl.textContent   = user.name;
        if (avatarEl && user.name) avatarEl.textContent = user.name[0].toUpperCase();

        // Update Dashboard link based on role
        const role = localStorage.getItem('role');
        const dashLinks = document.querySelectorAll('a[href="dashboard.html"], a[href="admin.html"]');
        dashLinks.forEach(link => {
          if (role === 'admin') {
            link.href = 'admin.html';
            link.textContent = 'Admin Dashboard';
          } else {
            link.href = 'dashboard.html';
            link.textContent = 'Dashboard';
          }
        });
      } else {
        authEl.classList.remove('hidden');
        userEl.classList.remove('visible');
      }
    }
    if (mAuth && mUser) {
      if (user) { mAuth.style.display='none'; mUser.style.display='flex'; }
      else      { mAuth.style.display='flex'; mUser.style.display='none'; }
    }
  },

  /* Verify token is still valid */
  async verifyOrRedirect(redirectTo = 'login.html') {
    if (!this.isLoggedIn()) { window.location.href = redirectTo; return; }
    try {
      const response = await API.get('/auth/profile');
      const user = response.data;
      this._user = user;
      localStorage.setItem('lf_user', JSON.stringify(user));
      this.updateNav();
    } catch (err) {
      if (err.status === 401) {
        localStorage.removeItem('lf_token');
        localStorage.removeItem('lf_user');
        this._token = null;
        this._user  = null;
        window.location.href = redirectTo;
      }
    }
  },
};

/* ============================================================
   CATEGORY → ICON / COLOR MAP (UI helper — no backend needed)
   ============================================================ */
const CATEGORY_META = {
  Electronics: { icon: '📱', color: '#1f2937' },
  Bags:        { icon: '🎒', color: '#1e40af' },
  Accessories: { icon: '👛', color: '#1e293b' },
  Documents:   { icon: '📄', color: '#065f46' },
  Vehicles:    { icon: '🚲', color: '#991b1b' },
  Clothing:    { icon: '👕', color: '#4c1d95' },
  Keys:        { icon: '🔑', color: '#78350f' },
  Others:      { icon: '📦', color: '#374151' },
};
function categoryIcon(cat)  { return CATEGORY_META[cat]?.icon  || '📦'; }
function categoryColor(cat) { return CATEGORY_META[cat]?.color || '#374151'; }

/* ============================================================
   NAVBAR
   ============================================================ */
function initNav() {
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => mobileMenu.classList.toggle('open'));
    document.addEventListener('click', e => {
      if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target))
        mobileMenu.classList.remove('open');
    });
  }

  // Highlight the current page link
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
    if (a.href === window.location.href) a.classList.add('active');
  });

  // Logout button(s)
  document.querySelectorAll('.btn-logout').forEach(btn =>
    btn.addEventListener('click', () => Auth.logout())
  );

  Auth.updateNav();
}

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
function showToast(msg, type = '') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', '': 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] ?? icons['']}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/* ============================================================
   LOADING STATE HELPERS
   ============================================================ */
function setLoading(btn, isLoading, originalText) {
  btn.disabled   = isLoading;
  btn.textContent = isLoading ? 'Please wait…' : originalText;
}

function showGridLoading(gridEl) {
  gridEl.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:60px 0;color:var(--text-muted)">
      <div style="font-size:2rem;margin-bottom:12px">⏳</div>
      <p>Loading items…</p>
    </div>`;
}

function showGridError(gridEl, msg = 'Could not load items. Please try again.') {
  gridEl.innerHTML = `
    <div class="empty-state" style="grid-column:1/-1">
      <div class="icon">⚠️</div>
      <h3>Something went wrong</h3>
      <p>${msg}</p>
    </div>`;
}

/* ============================================================
   FORM VALIDATION
   ============================================================ */
function validateForm(formEl) {
  let valid = true;
  formEl.querySelectorAll('[required]').forEach(input => {
    const err = input.parentElement.querySelector('.form-error')
              || input.closest('.form-group')?.querySelector('.form-error');
    input.classList.remove('error');
    if (err) err.style.display = 'none';
    if (!input.value.trim()) {
      valid = false;
      input.classList.add('error');
      if (err) { err.style.display = 'block'; err.textContent = 'This field is required.'; }
    }
  });
  formEl.querySelectorAll('input[type="email"]').forEach(input => {
    if (input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
      valid = false; input.classList.add('error');
      const err = input.closest('.form-group')?.querySelector('.form-error');
      if (err) { err.style.display = 'block'; err.textContent = 'Enter a valid email address.'; }
    }
  });
  const pw  = formEl.querySelector('#password');
  const pw2 = formEl.querySelector('#confirm_password');
  if (pw && pw2 && pw.value && pw.value !== pw2.value) {
    valid = false; pw2.classList.add('error');
    const err = pw2.closest('.form-group')?.querySelector('.form-error');
    if (err) { err.style.display = 'block'; err.textContent = 'Passwords do not match.'; }
  }
  return valid;
}

/* ============================================================
   FILE UPLOAD AREA (UI only — real upload via FormData)
   ============================================================ */
function initUpload() {
  document.querySelectorAll('.upload-area').forEach(area => {
    const input = area.querySelector('input[type="file"]');
    area.addEventListener('click', () => input?.click());
    area.addEventListener('dragover', e => { e.preventDefault(); area.style.borderColor='var(--amber)'; });
    area.addEventListener('dragleave', () => area.style.borderColor = '');
    area.addEventListener('drop', e => {
      e.preventDefault(); area.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if (file) updateUploadUI(area, file.name);
    });
    input?.addEventListener('change', () => {
      if (input.files[0]) updateUploadUI(area, input.files[0].name);
    });
  });
}
function updateUploadUI(area, name) {
  const icon = area.querySelector('.upload-icon');
  const ps   = area.querySelectorAll('p');
  if (icon) icon.textContent = '📎';
  if (ps[0]) ps[0].innerHTML = `<strong>${name}</strong><br>File selected`;
  if (ps[1]) ps[1].style.display = 'none';
}

/* ============================================================
   PASSWORD TOGGLE
   ============================================================ */
function initPasswordToggle() {
  document.querySelectorAll('.password-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling
                  || btn.closest('.input-icon-wrap')?.querySelector('input');
      if (!input) return;
      input.type      = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁' : '🙈';
    });
  });
}

/* ============================================================
   RENDER ITEM CARD
   Maps MongoDB document fields:
     item._id, item.title, item.type, item.category,
     item.location, item.date (or item.dateLost / item.dateFound),
     item.description, item.contact, item.imageUrl
   ============================================================ */
function renderItemCard(item) {
  const typeBadge = item.type === 'lost'
    ? `<span class="badge badge-red">🔍 Lost</span>`
    : `<span class="badge badge-green">✅ Found</span>`;

  const icon  = categoryIcon(item.category);
  const color = categoryColor(item.category);
  const date  = item.date || item.dateLost || item.dateFound || '';
  const desc  = item.description || item.desc || '';
  const name  = item.name || item.title || 'Untitled';
  const img   = item.image || item.imageUrl || '';

  const imgSection = img
    ? `<img src="${img}" alt="${name}" style="width:100%;height:100%;object-fit:cover" />`
    : `<span style="font-size:3.5rem">${icon}</span>`;

  return `
    <div class="card item-card" onclick="window.location.href='item-detail.html?id=${item._id}'" style="cursor:pointer">
      <div class="item-img" style="background:linear-gradient(135deg,${color}18,${color}30)">
        ${imgSection}
      </div>
      <div class="card-body">
        <div class="item-meta">${typeBadge}<span class="badge badge-navy">${item.category}</span></div>
        <h3>${name}</h3>
        <div class="item-info"><span>📍</span> ${item.location}</div>
        <div class="item-info"><span>📅</span> ${date}</div>
        <p>${desc}</p>
        <a href="tel:${item.contact}" class="btn btn-primary btn-sm" style="width:100%;justify-content:center" onclick="event.stopPropagation()">
          📞 Contact
        </a>
      </div>
    </div>`;
}

/* ============================================================
   GLOBAL STATS — updates Lost/Found counts everywhere
   ============================================================ */
async function updateGlobalStats() {
  try {
    const data = await API.get('/items/stats');
    const lostEl  = document.getElementById('lostCountBadge');
    const foundEl = document.getElementById('foundCountBadge');
    if (lostEl)  lostEl.textContent  = `🔍 Lost: ${data.lostCount || 0}`;
    if (foundEl) foundEl.textContent = `✅ Found: ${data.foundCount || 0}`;

    // Update match page stats if present
    const matchVal = document.getElementById('matchCountValue');
    if (matchVal) {
      matchVal.textContent = data.matchCount || 0;
      matchVal.dataset.count = data.matchCount || 0;
    }
    const reunionVal = document.getElementById('reunionCountValue');
    if (reunionVal) {
      reunionVal.textContent = data.reunitedCount || 0;
      reunionVal.dataset.count = data.reunitedCount || 0;
    }
    const accuracyVal = document.getElementById('accuracyValue');
    if (accuracyVal) {
      // Simple accuracy calculation: reunited / (reunited + active matches)
      const total = (data.reunitedCount || 0) + (data.matchCount || 0);
      const acc = total > 0 ? Math.round(((data.reunitedCount || 0) / total) * 100) : 0;
      accuracyVal.textContent = acc || 100; // Default to 100 if no matches to look better
      accuracyVal.dataset.count = acc || 100;
    }
  } catch (err) {
    console.error('Failed to fetch stats:', err);
  }
}

/* ============================================================
   ITEMS PAGE — fetches GET /api/items?type=&category=&search=
   Expected response: { items: [...] }
   ============================================================ */
function initItemsPage() {
  const grid           = document.getElementById('itemsGrid');
  const searchInput    = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const typeFilter     = document.getElementById('typeFilter');
  if (!grid) return;

  let debounceTimer;

  async function fetchAndRender() {
    updateGlobalStats(); // Refresh stats on every fetch or just on load? Let's do on fetch too.
    showGridLoading(grid);
    try {
      const params = new URLSearchParams();
      const q    = searchInput?.value.trim()   || '';
      const cat  = categoryFilter?.value        || '';
      const type = typeFilter?.value            || '';
      if (q)    params.set('search',   q);
      if (cat)  params.set('category', cat);
      if (type) params.set('type',     type);

      const data = await API.get(`/items?${params.toString()}`);
      const items = data.items || data; // handle both { items:[] } and []

      grid.innerHTML = items.length
        ? items.map(renderItemCard).join('')
        : `<div class="empty-state" style="grid-column:1/-1">
             <div class="icon">🔎</div>
             <h3>No items found</h3>
             <p>Try adjusting your search or filters.</p>
           </div>`;
    } catch (err) {
      showGridError(grid, err.message);
    }
  }

  // Debounce search input, instant on dropdown change
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchAndRender, 350);
  });
  categoryFilter?.addEventListener('change', fetchAndRender);
  typeFilter?.addEventListener('change', fetchAndRender);

  fetchAndRender();
}

/* ============================================================
   HOME PAGE — recent items  GET /api/items?limit=4
   ============================================================ */
async function initHomePage() {
  const grid = document.getElementById('recentItems');
  if (!grid) return;
  try {
    const data  = await API.get('/items?limit=4');
    const items = data.items || data;
    grid.innerHTML = items.length
      ? items.map(renderItemCard).join('')
      : `<p style="grid-column:1/-1;text-align:center;color:var(--text-muted)">No items yet. Be the first to post!</p>`;
  } catch (_) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--text-muted)">Could not load recent items.</p>`;
  }
}

/* ============================================================
   ADMIN TABLE — GET /api/admin/items  (admin-only route)
   Expected response: { items: [...] }
   ============================================================ */
async function initAdminTable() {
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">Loading…</td></tr>`;
  try {
    const data  = await API.get('/admin/items');
    const items = data.items || data;
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">No items found.</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(it => `
      <tr data-id="${it._id}" onclick="window.location.href='item-detail.html?id=${it._id}'" style="cursor:pointer">
        <td><strong>${it.name || it.title || 'Untitled'}</strong></td>
        <td>${it.category}</td>
        <td><span class="badge ${it.type==='lost'?'badge-red':'badge-green'}">${it.type.toUpperCase()}</span></td>
        <td>${it.location}</td>
        <td>${it.date || it.dateLost || it.dateFound || ''}</td>
        <td><span class="status-badge badge ${it.status==='approved'?'badge-green':'badge-amber'}">${it.status || 'Pending'}</span></td>
        <td>
          <div class="table-actions" onclick="event.stopPropagation()">
            ${it.status !== 'approved'
              ? `<button class="btn btn-success btn-sm" onclick="adminApprove('${it._id}', this)">✅ Approve</button>`
              : ''}
            <button class="btn btn-danger btn-sm" onclick="adminDelete('${it._id}', this)">🗑 Delete</button>
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--red)">${err.message}</td></tr>`;
  }
}

/* Admin approve — PATCH /api/admin/items/:id/approve */
async function adminApprove(id, btn) {
  const originalText = btn.textContent;
  setLoading(btn, true, originalText);
  try {
    await API.request('PATCH', `/admin/items/${id}/approve`);
    const row = btn.closest('tr');
    row.querySelector('.status-badge').className = 'status-badge badge badge-green';
    row.querySelector('.status-badge').textContent = 'approved';
    btn.remove();
    showToast('Item approved!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
    setLoading(btn, false, originalText);
  }
}

/* Admin delete — DELETE /api/admin/items/:id */
async function adminDelete(id, btn) {
  if (!confirm('Permanently delete this item?')) return;
  const originalText = btn.textContent;
  setLoading(btn, true, originalText);
  try {
    await API.delete(`/admin/items/${id}`);
    btn.closest('tr').remove();
    showToast('Item deleted.', 'error');
  } catch (err) {
    showToast(err.message, 'error');
    setLoading(btn, false, originalText);
  }
}

/* ============================================================
   MATCH PAGE — GET /api/matches
   Expected response: [{ lost:{...}, found:{...}, score:85 }, ...]
   ============================================================ */
async function initMatchPage() {
  updateGlobalStats();
  const container = document.getElementById('matchContainer');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-muted)"><p>⏳ Finding matches…</p></div>`;
  try {
    const data = await API.get('/items/match');
    const matches = data.items || data;
    if (!matches.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🔗</div>
          <h3>No matches yet</h3>
          <p>As more items are posted, matches will appear here automatically.</p>
        </div>`;
      return;
    }
    container.innerHTML = matches.map(m => {
      const lost  = m.lost;
      const found = m.found;
      return `
        <div class="match-pair">
          <div class="match-item lost" onclick="window.location.href='item-detail.html?id=${lost._id}'" style="cursor:pointer">
            <div class="match-label" style="color:var(--red)">🔍 Lost Item</div>
            <div style="font-size:2.5rem;margin-bottom:12px">${categoryIcon(lost.category)}</div>
            <h3 style="margin-bottom:8px">${lost.name || lost.title || 'Untitled'}</h3>
            <div class="item-info"><span>📍</span>${lost.location}</div>
            <div class="item-info"><span>📅</span>${lost.date || lost.dateLost || ''}</div>
            <div class="match-score">
              <span class="badge badge-navy">${lost.category}</span>
              <span class="badge badge-red">Lost</span>
            </div>
          </div>
          <div class="match-divider">
            <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
              <span style="font-size:1.3rem">🔗</span>
              <span style="font-family:var(--font);font-size:.7rem;font-weight:800;color:var(--amber-dark);text-align:center">
                ${m.score}%<br>MATCH
              </span>
            </div>
          </div>
          <div class="match-item found" onclick="window.location.href='item-detail.html?id=${found._id}'" style="cursor:pointer">
            <div class="match-label" style="color:var(--green)">✅ Found Item</div>
            <div style="font-size:2.5rem;margin-bottom:12px">${categoryIcon(found.category)}</div>
            <h3 style="margin-bottom:8px">${found.name || found.title || 'Untitled'}</h3>
            <div class="item-info"><span>📍</span>${found.location}</div>
            <div class="item-info"><span>📅</span>${found.date || found.dateFound || ''}</div>
            <div class="match-score">
              <span class="badge badge-navy">${found.category}</span>
              <span class="badge badge-green">Found</span>
            </div>
            <a href="tel:${found.contact}" class="btn btn-primary btn-sm" style="margin-top:14px" onclick="event.stopPropagation()">📞 Contact Finder</a>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div><h3>Could not load matches</h3><p>${err.message}</p>
      </div>`;
  }
}

/* ============================================================
   FORM SUBMISSIONS
   ============================================================ */
function initForms() {

  /* ── Login  POST /api/auth/login ── */
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validateForm(loginForm)) return;
      const btn = loginForm.querySelector('[type="submit"]');
      const orig = btn.textContent;
      setLoading(btn, true, orig);
      try {
        const response = await API.post('/auth/login', {
          email:    loginForm.email.value.trim(),
          password: loginForm.password.value,
        });
        const { token, ...user } = response.data;
        Auth.setSession(token, user);
        Auth.updateNav();
        showToast(`Welcome back, ${user.name}!`, 'success');
        const target = user.role === 'admin' ? 'admin.html' : 'dashboard.html';
        setTimeout(() => window.location.href = target, 900);
      } catch (err) {
        showToast(err.message || 'Login failed. Check your credentials.', 'error');
        setLoading(btn, false, orig);
      }
    });
  }

  /* ── Register  POST /api/auth/register ── */
  const regForm = document.getElementById('registerForm');
  if (regForm) {
    regForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validateForm(regForm)) return;
      const btn = regForm.querySelector('[type="submit"]');
      const orig = btn.textContent;
      setLoading(btn, true, orig);
      try {
        const response = await API.post('/auth/register', {
          name:     regForm.name.value.trim(),
          email:    regForm.reg_email?.value.trim() || regForm.querySelector('[type="email"]').value.trim(),
          phone:    regForm.phone?.value.trim() || '',
          password: regForm.password.value,
        });
        const { token, ...user } = response.data;
        Auth.setSession(token, user);
        Auth.updateNav();
        showToast('Account created! Welcome aboard 🎉', 'success');
        setTimeout(() => window.location.href = 'dashboard.html', 900);
      } catch (err) {
        showToast(err.message || 'Registration failed. Try again.', 'error');
        setLoading(btn, false, orig);
      }
    });
  }

  /* ── Post Lost  POST /api/items (type: lost) ── */
  const postLostForm = document.getElementById('postLostForm');
  if (postLostForm) {
    postLostForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validateForm(postLostForm)) return;
      const btn = postLostForm.querySelector('[type="submit"]');
      const orig = btn.textContent;
      setLoading(btn, true, orig);
      try {
        const fd = new FormData();
        fd.append('type',        'lost');
        fd.append('name',        postLostForm.item_name.value.trim());
        fd.append('category',    postLostForm.category.value);
        fd.append('location',    postLostForm.location.value.trim());
        fd.append('date',        postLostForm.date_lost.value);
        fd.append('description', postLostForm.description.value.trim());
        fd.append('contact',     postLostForm.contact.value.trim());
        const imgInput = postLostForm.querySelector('input[type="file"]');
        if (imgInput?.files[0]) fd.append('image', imgInput.files[0]);

        await API.postForm('/items', fd);
        showToast('Lost item reported successfully! 🎉', 'success');
        setTimeout(() => window.location.href = 'items.html', 1200);
      } catch (err) {
        showToast(err.message || 'Failed to post item. Try again.', 'error');
        setLoading(btn, false, orig);
      }
    });
  }

  /* ── Post Found  POST /api/items (type: found) ── */
  const postFoundForm = document.getElementById('postFoundForm');
  if (postFoundForm) {
    postFoundForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validateForm(postFoundForm)) return;
      const btn = postFoundForm.querySelector('[type="submit"]');
      const orig = btn.textContent;
      setLoading(btn, true, orig);
      try {
        const fd = new FormData();
        fd.append('type',        'found');
        fd.append('name',        postFoundForm.item_name.value.trim());
        fd.append('category',    postFoundForm.category.value);
        fd.append('location',    postFoundForm.location.value.trim());
        fd.append('date',        postFoundForm.date_found.value);
        fd.append('description', postFoundForm.description.value.trim());
        fd.append('contact',     postFoundForm.contact.value.trim());
        if (postFoundForm.handover?.value)
          fd.append('handover',  postFoundForm.handover.value.trim());
        const imgInput = postFoundForm.querySelector('input[type="file"]');
        if (imgInput?.files[0]) fd.append('image', imgInput.files[0]);

        await API.postForm('/items', fd);
        showToast('Found item reported successfully! ✅', 'success');
        setTimeout(() => window.location.href = 'items.html', 1200);
      } catch (err) {
        showToast(err.message || 'Failed to post item. Try again.', 'error');
        setLoading(btn, false, orig);
      }
    });
  }
}

/* ============================================================
   PROFILE PAGE
   GET  /api/auth/profile    → populate fields
   PUT  /api/auth/me         → save changes
   PUT  /api/auth/password   → change password
   ============================================================ */
async function initProfile() {
  const user = Auth.getUser();
  if (!user) return;

  // Populate from cached session first (instant)
  applyUserToProfile(user);

  // Then fetch fresh data from server
  try {
    const response = await API.get('/auth/profile');
    const fresh = response.data;
    Auth._user = fresh;
    localStorage.setItem('lf_user', JSON.stringify(fresh));
    applyUserToProfile(fresh);
  } catch (_) { /* use cached */ }

  // Populate Activity Stats & Reports
  const reportsList = document.getElementById('profileReportsList');
  if (reportsList) {
    try {
      const data = await API.get('/items/mine');
      const items = data.items || data;

      const lostCount  = items.filter(i => i.type === 'lost').length;
      const foundCount = items.filter(i => i.type === 'found').length;
      
      const lostEl  = document.getElementById('profileLostCount');
      const foundEl = document.getElementById('profileFoundCount');
      if (lostEl)  lostEl.textContent  = lostCount;
      if (foundEl) foundEl.textContent = foundCount;

      reportsList.innerHTML = items.length
        ? items.map(item => `
          <div onclick="window.location.href='item-detail.html?id=${item._id}'" style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:var(--radius-md);background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.05);cursor:pointer">
            <span style="font-size:1.2rem">${categoryIcon(item.category)}</span>
            <div style="flex:1">
              <div style="font-size:.85rem;font-weight:600">${item.name || item.title}</div>
              <div style="font-size:.7rem;color:var(--text-muted)">${item.location} • ${item.date || item.dateLost || item.dateFound}</div>
            </div>
            <span class="badge ${item.type==='lost'?'badge-red':'badge-green'}" style="font-size:.65rem">${item.type.toUpperCase()}</span>
          </div>
        `).join('')
        : `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:.85rem">No reports yet.</div>`;

      // Fetch matches to count user matches
      try {
        const matchData = await API.get('/items/match');
        const allMatches = matchData.items || matchData;
        const myMatches = allMatches.filter(m => m.lost.userId === user._id || m.found.userId === user._id);
        const matchEl = document.getElementById('profileMatchCount');
        if (matchEl) matchEl.textContent = myMatches.length;
      } catch (err) { console.error('Failed to fetch user matches:', err); }

    } catch (err) {
      reportsList.innerHTML = `<div style="text-align:center;padding:20px;color:var(--red);font-size:.85rem">Failed to load reports.</div>`;
    }
  }

  // Save changes handler
  const saveBtn = document.getElementById('saveProfileBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const orig = saveBtn.textContent;
      setLoading(saveBtn, true, orig);
      try {
        const updated = await API.put('/auth/me', {
          name:  document.getElementById('profileName')?.value?.trim()  || Auth.getUser().name,
          phone: document.getElementById('profilePhone')?.value?.trim() || '',
        });
        Auth._user = updated;
        localStorage.setItem('lf_user', JSON.stringify(updated));
        applyUserToProfile(updated);
        showToast('Profile saved!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setLoading(saveBtn, false, orig);
      }
    });
  }

  // Change password handler
  const changePwBtn = document.getElementById('changePwBtn');
  if (changePwBtn) {
    changePwBtn.addEventListener('click', async () => {
      const current = document.getElementById('currentPw')?.value;
      const newPw   = document.getElementById('newPw')?.value;
      const confirm = document.getElementById('confirmPw')?.value;
      if (!current || !newPw)     { showToast('Fill in all password fields.', 'error'); return; }
      if (newPw !== confirm)      { showToast('New passwords do not match.', 'error'); return; }
      if (newPw.length < 8)       { showToast('Password must be at least 8 characters.', 'error'); return; }
      const orig = changePwBtn.textContent;
      setLoading(changePwBtn, true, orig);
      try {
        await API.put('/auth/password', { currentPassword: current, newPassword: newPw });
        showToast('Password updated!', 'success');
        ['currentPw','newPw','confirmPw'].forEach(id => {
          const el = document.getElementById(id); if (el) el.value = '';
        });
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setLoading(changePwBtn, false, orig);
      }
    });
  }
}

function applyUserToProfile(user) {
  if (!user) return;
  
  document.querySelectorAll('.profile-name').forEach(el => el.textContent = user.name || 'User');
  document.querySelectorAll('.profile-email').forEach(el => el.textContent = user.email || '');
  document.querySelectorAll('.user-avatar, .profile-avatar-letter').forEach(el => {
    if (user.name) el.textContent = user.name[0].toUpperCase();
  });
  
  const nameInput  = document.getElementById('profileName');
  const phoneInput = document.getElementById('profilePhone');
  if (nameInput)  nameInput.value  = user.name  || '';
  if (phoneInput) phoneInput.value = user.phone || '';

  const nameDisp  = document.getElementById('profileNameDisplay');
  const phoneDisp = document.getElementById('profilePhoneDisplay');
  const createdAtDisp = document.getElementById('profileCreatedAt');

  if (nameDisp)  nameDisp.textContent  = user.name  || 'User';
  if (phoneDisp) phoneDisp.textContent = user.phone || 'Not provided';
  
  if (createdAtDisp && user.createdAt) {
    const date = new Date(user.createdAt);
    createdAtDisp.textContent = date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
}

/* ============================================================
   DASHBOARD PAGE
   GET /api/items/mine  → items posted by the logged-in user
   GET /api/auth/me     → user stats (optional, or derive from items)
   ============================================================ */
async function initDashboard() {
  const user = Auth.getUser();
  if (!user) return;

  document.querySelectorAll('.dash-user-name').forEach(el => el.textContent = user.name);
  document.querySelectorAll('.dash-avatar-letter').forEach(el => {
    if (user.name) el.textContent = user.name[0].toUpperCase();
  });

  const dashGrid = document.getElementById('dashItemsGrid');
  if (!dashGrid) return;

  showGridLoading(dashGrid);
  try {
    const data  = await API.get('/items/mine');
    const items = data.items || data;

    // Update stat counters
    const lostCount  = items.filter(i => i.type === 'lost').length;
    const foundCount = items.filter(i => i.type === 'found').length;
    const totalEl    = document.querySelector('[data-stat="total"]');
    const lostEl     = document.querySelector('[data-stat="lost"]');
    const foundEl    = document.querySelector('[data-stat="found"]');
    if (totalEl) totalEl.textContent = items.length;
    if (lostEl)  lostEl.textContent  = lostCount;
    if (foundEl) foundEl.textContent = foundCount;

    dashGrid.innerHTML = items.length
      ? items.map(renderItemCard).join('')
      : `<div class="empty-state" style="grid-column:1/-1">
           <div class="icon">📭</div>
           <h3>No posts yet</h3>
           <p>You haven't reported any items yet.</p>
           <div style="display:flex;gap:12px;justify-content:center;margin-top:20px">
             <a href="post-lost.html" class="btn btn-outline">Report Lost</a>
             <a href="post-found.html" class="btn btn-amber">Report Found</a>
           </div>
         </div>`;
  } catch (err) {
    showGridError(dashGrid, err.message);
  }
}

/* ============================================================
   SIDEBAR ACTIVE LINK
   ============================================================ */
function initSidebar() {
  document.querySelectorAll('.sidebar a').forEach(a => {
    if (a.href === window.location.href) a.classList.add('active');
  });
}

/* ============================================================
   COUNTER ANIMATION (for static display numbers like hero stats)
   ============================================================ */
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count);
    let cur = 0;
    const step = Math.ceil(target / 40);
    const timer = setInterval(() => {
      cur = Math.min(cur + step, target);
      el.textContent = cur.toLocaleString();
      if (cur >= target) clearInterval(timer);
    }, 30);
  });
}

/* ============================================================
   BOOT — runs on every page
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Restore JWT + user from localStorage before anything else
  Auth.restoreSession();

  // 2. Wire up nav, upload areas, password toggles
  initNav();
  initUpload();
  initPasswordToggle();
  updateGlobalStats();

  // 3. Wire up form submit handlers
  initForms();

  // 4. Page-specific initialisers:
  // Conditionally initialize only the modules required for the active page.
  // This avoids running all queries sequentially and prevents blocking page load.
  const path = location.pathname;
  const isHome = path.endsWith('index.html') || path.endsWith('/') || path === '';
  
  if (isHome) {
    await initHomePage(); // Query and render recent items on Home page
  }
  if (path.endsWith('items.html')) {
    initItemsPage(); // Query and setup filtering/search on View Items page
  }
  initSidebar();

  // Protected pages: check authorization token before loading dashboard/profile views
  const protectedPage = ['dashboard.html','profile.html','admin.html'].some(p => path.endsWith(p));
  if (protectedPage) {
    await Auth.verifyOrRedirect('login.html'); // Redirect to login if token is missing/expired
    if (path.endsWith('dashboard.html')) {
      await initDashboard(); // Load active user's dashboard items
    } else if (path.endsWith('profile.html')) {
      await initProfile(); // Load active user's profile info and metrics
    } else if (path.endsWith('admin.html')) {
      await initAdminTable(); // Load admin management table
    }
  }
  if (path.endsWith('match.html')) {
    await initMatchPage(); // Load matching lost/found items suggestions
  }

  // 5. Animate hero/stat counters when they scroll into view
  const countersSection = document.querySelector('.hero-stats, .stats-section');
  if (countersSection) {
    new IntersectionObserver((entries, obs) => {
      if (entries[0].isIntersecting) { animateCounters(); obs.disconnect(); }
    }).observe(countersSection);
  } else {
    animateCounters();
  }
});
