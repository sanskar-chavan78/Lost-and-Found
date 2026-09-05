/* ============================================================
   PARTIALS — nav & footer HTML strings
   Include via: document.getElementById('nav-placeholder').innerHTML = NAV_HTML;
   ============================================================ */

const NAV_HTML = `
<nav class="navbar">
  <div class="nav-inner">
    <a href="index.html" class="nav-logo">
      <div class="logo-icon">🔍</div>
      Lost &amp; Found
    </a>
    <div class="nav-links">
      <a href="index.html">Home</a>
      <a href="post-lost.html">Post Lost</a>
      <a href="post-found.html">Post Found</a>
      <a href="items.html">View Items</a>
      <a href="match.html">Match Items</a>
    </div>
    <div class="nav-actions">
      <div class="nav-auth">
        <a href="login.html" class="btn btn-outline btn-sm">Login</a>
        <a href="register.html" class="btn btn-amber btn-sm">Register</a>
      </div>
      <div class="nav-user">
        <span class="user-avatar" style="width:34px;height:34px;border-radius:50%;background:var(--amber);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;color:var(--navy)">U</span>
        <span class="user-name" style="font-size:.875rem;font-weight:600">User</span>
        <a href="dashboard.html" class="btn btn-ghost btn-sm">Dashboard</a>
        <a href="profile.html" class="btn btn-ghost btn-sm">Profile</a>
        <button class="btn btn-outline btn-sm btn-logout">Logout</button>
      </div>
    </div>
    <button class="nav-hamburger" id="hamburger" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>
<div class="mobile-menu" id="mobileMenu">
  <a href="index.html">🏠 Home</a>
  <a href="post-lost.html">🔍 Post Lost Item</a>
  <a href="post-found.html">✅ Post Found Item</a>
  <a href="items.html">📋 View Items</a>
  <a href="match.html">🔗 Match Items</a>
  <div class="mobile-actions mobile-auth" style="display:flex">
    <a href="login.html" class="btn btn-outline" style="flex:1;justify-content:center">Login</a>
    <a href="register.html" class="btn btn-amber" style="flex:1;justify-content:center">Register</a>
  </div>
  <div class="mobile-actions mobile-user" style="display:none">
    <a href="dashboard.html" class="btn btn-outline" style="flex:1;justify-content:center">Dashboard</a>
    <a href="profile.html" class="btn btn-outline" style="flex:1;justify-content:center">Profile</a>
    <button class="btn btn-primary btn-logout" style="flex:1;justify-content:center">Logout</button>
  </div>
</div>`;

const FOOTER_HTML = `
<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="nav-logo" style="margin-bottom:14px">
          <div class="logo-icon">🔍</div> Lost &amp; Found Portal
        </div>
        <p>A community platform to help people reconnect with their lost belongings. Post, search, and match — powered by trust.</p>
      </div>
      <div class="footer-col">
        <h4>Quick Links</h4>
        <a href="index.html">Home</a>
        <a href="post-lost.html">Report Lost Item</a>
        <a href="post-found.html">Report Found Item</a>
        <a href="items.html">Browse Items</a>
        <a href="match.html">Smart Matching</a>
      </div>
      <div class="footer-col">
        <h4>Account</h4>
        <a href="login.html">Login</a>
        <a href="register.html">Register</a>
        <a href="dashboard.html">Dashboard</a>
        <a href="profile.html">Profile</a>
      </div>
      <div class="footer-col">
        <h4>Support</h4>
        <a href="#">Help Center</a>
        <a href="#">Privacy Policy</a>
        <a href="#">Terms of Service</a>
        <a href="#">Contact Us</a>
      </div>
    </div>
    <div class="footer-bottom">
    </div>
  </div>
</footer>`;
