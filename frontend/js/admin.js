/* ============================================================
   ADMIN DASHBOARD — admin.js
   Handles real-time updates and dashboard logic
   ============================================================ */

const Admin = {
  socket: null,
  currentSection: 'dashboard',
  allItems: [],
  allUsers: [],
  filteredData: [],
  currentPage: 1,
  itemsPerPage: 8,

  init() {
    this.initSocket();
    this.loadStats();
    this.setupEventListeners();
    this.showSection('dashboard');
  },

  initSocket() {
    // Determine the socket URL based on current environment
    const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin;
    this.socket = io(socketUrl);
    
    this.socket.on('connect', () => {
      console.log('Admin connected to real-time server');
      const statusEl = document.getElementById('socket-status');
      if (statusEl) {
        statusEl.style.background = '#ecfdf5';
        statusEl.style.color = '#059669';
        statusEl.innerHTML = '<span style="width:6px;height:6px;background:#10b981;border-radius:50%;box-shadow:0 0 4px #10b981"></span> Live';
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Admin disconnected from real-time server');
      const statusEl = document.getElementById('socket-status');
      if (statusEl) {
        statusEl.style.background = '#fef2f2';
        statusEl.style.color = '#dc2626';
        statusEl.innerHTML = '<span style="width:6px;height:6px;background:#ef4444;border-radius:50%"></span> Disconnected';
      }
    });

    this.socket.on('statsUpdated', () => {
      console.log('Stats updated on server, refreshing...');
      this.loadStats();
    });

    this.socket.on('itemCreated', (item) => {
      console.log('New item created:', item);
      if (this.currentSection === 'dashboard' || this.currentSection === item.type) {
        this.refreshData();
      }
      showToast(`📦 New ${item.type} item posted: ${item.name}`, 'info');
    });

    this.socket.on('itemUpdated', (data) => {
      console.log('Item updated:', data);
      this.refreshData();
      if (data.type === 'approved') {
        showToast(`✅ Item approved: ${data.item.name}`, 'success');
      }
    });

    this.socket.on('userCreated', (user) => {
      console.log('New user registered:', user);
      if (this.currentSection === 'users' || this.currentSection === 'dashboard') {
        this.refreshData();
        this.loadStats();
      }
      showToast(`👥 New user registered: ${user.name}`, 'info');
    });

    this.socket.on('userDeleted', (userId) => {
      console.log('User deleted:', userId);
      if (this.currentSection === 'users' || this.currentSection === 'dashboard') {
        this.refreshData();
        this.loadStats();
      }
    });
  },

  async loadStats() {
    try {
      const response = await API.get('/admin/stats');
      if (response.success) {
        this.updateStatsUI(response.data);
      }
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    }
  },

  updateStatsUI(data) {
    // Top Stat Cards
    const totalItemsEl = document.getElementById('stat-total-items');
    const pendingReviewEl = document.getElementById('stat-pending-review');
    const approvedItemsEl = document.getElementById('stat-approved-items');
    const totalUsersEl = document.getElementById('stat-total-users');

    if (totalItemsEl) totalItemsEl.textContent = data.totalItems.toLocaleString();
    if (pendingReviewEl) pendingReviewEl.textContent = data.pendingReview.toLocaleString();
    if (approvedItemsEl) approvedItemsEl.textContent = data.approvedItems.toLocaleString();
    if (totalUsersEl) totalUsersEl.textContent = data.totalUsers.toLocaleString();

    // Weekly Activity
    const weeklyLostVal = document.getElementById('stat-weekly-lost');
    const weeklyFoundVal = document.getElementById('stat-weekly-found');
    const weeklyMatchesVal = document.getElementById('stat-weekly-matches');

    if (weeklyLostVal) {
        weeklyLostVal.textContent = data.weeklyActivity.lost;
        const bar = weeklyLostVal.parentElement.nextElementSibling.firstElementChild;
        if (bar) bar.style.width = `${Math.min(100, (data.weeklyActivity.lost / 20) * 100)}%`;
    }
    if (weeklyFoundVal) {
        weeklyFoundVal.textContent = data.weeklyActivity.found;
        const bar = weeklyFoundVal.parentElement.nextElementSibling.firstElementChild;
        if (bar) bar.style.width = `${Math.min(100, (data.weeklyActivity.found / 20) * 100)}%`;
    }
    if (weeklyMatchesVal) {
        weeklyMatchesVal.textContent = data.weeklyActivity.matches;
        const bar = weeklyMatchesVal.parentElement.nextElementSibling.firstElementChild;
        if (bar) bar.style.width = `${Math.min(100, (data.weeklyActivity.matches / 20) * 100)}%`;
    }

    // Category Breakdown
    this.updateCategoryBreakdown(data.categoryBreakdown);
  },

  updateCategoryBreakdown(breakdown) {
    const container = document.getElementById('categoryBreakdownContainer');
    if (!container) return;

    let html = '<div style="display:flex;flex-direction:column;gap:10px">';
    const total = breakdown.reduce((sum, item) => sum + item.count, 0) || 1;

    breakdown.forEach(item => {
        const percent = Math.round((item.count / total) * 100);
        const color = categoryColor ? categoryColor(item.category) : '#4f46e5';
        html += `
            <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:.85rem">${item.category}</span>
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="width:100px;height:8px;background:var(--bg);border-radius:4px;overflow:hidden">
                    <div style="width:${percent}%;height:100%;background:${color};border-radius:4px"></div>
                  </div>
                  <span style="font-size:.8rem;font-weight:600;width:32px;text-align:right">${item.count}</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
  },

  async showSection(section) {
    this.currentSection = section;
    this.currentPage = 1;
    
    // Update Sidebar
    document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${section}`);
    if (activeNav) activeNav.classList.add('active');

    // Update Header
    const titleEl = document.querySelector('.page-title');
    const subEl = document.querySelector('.page-sub');
    
    if (section === 'dashboard') {
      titleEl.textContent = 'Dashboard Overview';
      subEl.textContent = "Welcome back, Admin! Here's what's happening today.";
      document.getElementById('dashboardView').style.display = 'block';
      document.getElementById('tableView').classList.remove('full-width'); // or whatever
      document.getElementById('tableTitle').textContent = '📋 Pending Review Items';
    } else {
      document.getElementById('dashboardView').style.display = 'none';
      if (section === 'lost') {
        titleEl.textContent = 'Lost Items Management';
        subEl.textContent = 'View and manage all lost items posted by users.';
        document.getElementById('tableTitle').textContent = '🔍 All Lost Items';
      } else if (section === 'found') {
        titleEl.textContent = 'Found Items Management';
        subEl.textContent = 'View and manage all found items posted by users.';
        document.getElementById('tableTitle').textContent = '✅ All Found Items';
      } else if (section === 'users') {
        titleEl.textContent = 'User Management';
        subEl.textContent = 'Manage registered users and their permissions.';
        document.getElementById('tableTitle').textContent = '👥 All Registered Users';
      }
    }

    await this.refreshData();
  },

  async refreshData() {
    if (this.currentSection === 'users') {
      await this.loadUsers();
    } else {
      await this.loadItems();
    }
    this.applyFilters();
  },

  async loadItems() {
    try {
      const response = await API.get('/admin/items');
      if (response.success) {
        this.allItems = response.items;
      }
    } catch (err) {
      console.error('Failed to load items:', err);
    }
  },

  async loadUsers() {
    try {
      const response = await API.get('/admin/users');
      if (response.success) {
        this.allUsers = response.data;
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  },

  applyFilters() {
    const searchTerm = document.getElementById('adminSearchInput').value.toLowerCase();
    
    if (this.currentSection === 'users') {
      this.filteredData = this.allUsers.filter(user => 
        user.name.toLowerCase().includes(searchTerm) || 
        user.email.toLowerCase().includes(searchTerm)
      );
    } else {
      let baseItems = this.allItems;
      if (this.currentSection === 'dashboard') {
        baseItems = this.allItems.filter(item => item.status === 'pending');
      } else if (this.currentSection === 'lost') {
        baseItems = this.allItems.filter(item => item.type === 'lost');
      } else if (this.currentSection === 'found') {
        baseItems = this.allItems.filter(item => item.type === 'found');
      }

      this.filteredData = baseItems.filter(item => 
        item.name.toLowerCase().includes(searchTerm) || 
        item.location.toLowerCase().includes(searchTerm) ||
        item.category.toLowerCase().includes(searchTerm)
      );
    }

    this.renderTable();
  },

  renderTable() {
    const tableHeader = document.getElementById('adminTableHeader');
    const tableBody = document.getElementById('adminTableBody');
    
    if (this.currentSection === 'users') {
      tableHeader.innerHTML = `
        <th>User</th>
        <th>Email</th>
        <th>Phone</th>
        <th>Role</th>
        <th>Joined</th>
        <th>Actions</th>
      `;
    } else {
      tableHeader.innerHTML = `
        <th>Item</th>
        <th>Category</th>
        <th>Type</th>
        <th>Location</th>
        <th>Date</th>
        <th>Status</th>
        <th>Actions</th>
      `;
    }

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const paginatedData = this.filteredData.slice(start, start + this.itemsPerPage);

    if (paginatedData.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-muted)">No data found.</td></tr>`;
    } else {
      if (this.currentSection === 'users') {
        tableBody.innerHTML = paginatedData.map(user => this.renderUserRow(user)).join('');
      } else {
        tableBody.innerHTML = paginatedData.map(item => this.renderItemRow(item)).join('');
      }
    }

    this.updatePagination();
  },

  renderItemRow(item) {
    const icon = typeof categoryIcon === 'function' ? categoryIcon(item.category) : '📦';
    return `
      <tr onclick="window.location.href='item-detail.html?id=${item._id}'" style="cursor:pointer">
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:32px;height:32px;background:var(--bg);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:1.2rem">
                ${icon}
            </div>
            <span style="font-weight:500;font-size:.85rem">${item.name}</span>
          </div>
        </td>
        <td><span class="badge badge-navy">${item.category}</span></td>
        <td><span class="badge ${item.type === 'lost' ? 'badge-red' : 'badge-green'}">${item.type}</span></td>
        <td><span style="font-size:.82rem">📍 ${item.location}</span></td>
        <td><span style="font-size:.82rem">${new Date(item.date).toLocaleDateString()}</span></td>
        <td><span class="badge ${item.status === 'pending' ? 'badge-amber' : 'badge-green'}">${item.status}</span></td>
        <td>
          <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
            ${item.status === 'pending' ? `<button class="btn btn-primary btn-sm" onclick="Admin.approveItem('${item._id}')" title="Approve">✅</button>` : ''}
            <button class="btn btn-outline btn-sm" onclick="Admin.deleteItem('${item._id}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  },

  renderUserRow(user) {
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:32px;height:32px;background:var(--teal);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600">
                ${user.name[0].toUpperCase()}
            </div>
            <span style="font-weight:500;font-size:.85rem">${user.name}</span>
          </div>
        </td>
        <td><span style="font-size:.82rem">${user.email}</span></td>
        <td><span style="font-size:.82rem">${user.phone || 'N/A'}</span></td>
        <td><span class="badge ${user.role === 'admin' ? 'badge-red' : 'badge-navy'}">${user.role}</span></td>
        <td><span style="font-size:.82rem">${new Date(user.createdAt).toLocaleDateString()}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="Admin.deleteUser('${user._id}')">🗑️</button>
        </td>
      </tr>
    `;
  },

  updatePagination() {
    const info = document.getElementById('tablePaginationInfo');
    const controls = document.getElementById('paginationControls');
    
    const total = this.filteredData.length;
    const totalPages = Math.ceil(total / this.itemsPerPage) || 1;
    const start = total === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(this.currentPage * this.itemsPerPage, total);

    info.textContent = `Showing ${start} to ${end} of ${total} entries`;

    let html = `
      <button class="btn btn-outline btn-sm" ${this.currentPage === 1 ? 'disabled' : ''} onclick="Admin.setPage(${this.currentPage - 1})">← Prev</button>
    `;

    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 5 && i > 2 && i < totalPages - 1 && Math.abs(i - this.currentPage) > 1) {
          if (i === 3 || i === totalPages - 1) html += '<span style="padding:0 5px">...</span>';
          continue;
      }
      html += `
        <button class="btn ${this.currentPage === i ? 'btn-primary' : 'btn-outline'} btn-sm" style="min-width:36px" onclick="Admin.setPage(${i})">${i}</button>
      `;
    }

    html += `
      <button class="btn btn-outline btn-sm" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="Admin.setPage(${this.currentPage + 1})">Next →</button>
    `;

    controls.innerHTML = html;
  },

  setPage(page) {
    this.currentPage = page;
    this.renderTable();
  },

  async approveItem(id) {
    if (!confirm('Are you sure you want to approve this item?')) return;
    try {
      const response = await API.patch(`/admin/items/${id}/approve`);
      if (response.success) {
        this.refreshData();
        this.loadStats();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async deleteItem(id) {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) return;
    try {
      const response = await API.delete(`/admin/items/${id}`);
      if (response.success) {
        this.refreshData();
        this.loadStats();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      const response = await API.delete(`/admin/users/${id}`);
      if (response.success) {
        this.refreshData();
        this.loadStats();
        showToast('User deleted successfully', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  setupEventListeners() {
    const searchInput = document.getElementById('adminSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.currentPage = 1;
        this.applyFilters();
      });
    }
  }
};

// Expose to global for onclick handlers
window.Admin = Admin;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
});
