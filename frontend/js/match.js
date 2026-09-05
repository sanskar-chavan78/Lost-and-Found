/**
 * Match Items Page Logic
 */

const MatchPage = {
  container: null,

  async init() {
    this.container = document.getElementById('matchContainer');
    if (!this.container) return;

    // Must be logged in
    Auth.restoreSession();
    if (!Auth.isLoggedIn()) {
      window.location.href = 'login.html';
      return;
    }

    await this.loadMatches();
    await updateGlobalStats();

    // Set up refresh button
    const refreshBtn = document.querySelector('button.btn-outline.btn-sm');
    if (refreshBtn && refreshBtn.textContent.includes('Refresh')) {
      refreshBtn.onclick = () => this.loadMatches();
    }
  },

  async loadMatches() {
    this.container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 0;color:var(--text-muted)">
        <div style="font-size:2rem;margin-bottom:12px">⏳</div>
        <p>Analyzing items for matches...</p>
      </div>`;

    try {
      const response = await API.get('/items/match');
      const matches = response.items || [];

      if (matches.length === 0) {
        this.container.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1">
            <div class="icon">🔍</div>
            <h3>No matches found yet</h3>
            <p>We couldn't find any close matches right now. Try posting more details or check back later!</p>
            <a href="items.html" class="btn btn-primary" style="margin-top:20px">Browse All Items</a>
          </div>`;
        return;
      }

      this.renderMatches(matches);
    } catch (err) {
      console.error('Match load error:', err);
      showGridError(this.container, 'Failed to load suggested matches.');
    }
  },

  renderMatches(matches) {
    this.container.innerHTML = '';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '24px';

    matches.forEach(match => {
      const card = this.createMatchCard(match);
      this.container.appendChild(card);
    });
  },

  createMatchCard(match) {
    const { lost, found, score } = match;
    const div = document.createElement('div');
    div.className = 'card match-card-wrapper';
    div.style.padding = '0';
    div.style.overflow = 'hidden';

    // Determine score color
    let scoreColor = '#ef4444'; // red
    if (score >= 80) scoreColor = '#10b981'; // green
    else if (score >= 60) scoreColor = '#f59e0b'; // amber

    div.innerHTML = `
      <div style="display:flex;flex-direction:column">
        <div style="background:#f8fafc;padding:12px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-weight:600;font-size:.9rem;color:#64748b">Match Confidence</span>
            <div style="height:8px;width:100px;background:#e2e8f0;border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${score}%;background:${scoreColor}"></div>
            </div>
            <span style="font-weight:700;color:${scoreColor}">${score}%</span>
          </div>
          <span class="badge" style="background:rgba(139,92,246,.1);color:#8b5cf6">#${lost.category}</span>
        </div>
        
        <div class="match-pair-grid" style="display:grid;grid-template-columns:1fr 40px 1fr;padding:20px;align-items:center;gap:15px">
          <!-- Lost Item Side -->
          <div class="match-item-side">
            <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
              <span class="badge badge-red" style="font-size:10px">LOST</span>
              <h4 style="margin:0;font-size:1rem">${lost.name}</h4>
            </div>
            <div style="font-size:.85rem;color:#64748b;margin-bottom:4px">📍 ${lost.location}</div>
            <div style="font-size:.85rem;color:#64748b">📅 ${new Date(lost.date).toLocaleDateString()}</div>
          </div>

          <!-- Connector -->
          <div style="text-align:center;font-size:1.2rem;color:#cbd5e1">↔️</div>

          <!-- Found Item Side -->
          <div class="match-item-side">
            <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
              <span class="badge badge-green" style="font-size:10px">FOUND</span>
              <h4 style="margin:0;font-size:1rem">${found.name}</h4>
            </div>
            <div style="font-size:.85rem;color:#64748b;margin-bottom:4px">📍 ${found.location}</div>
            <div style="font-size:.85rem;color:#64748b">📅 ${new Date(found.date).toLocaleDateString()}</div>
          </div>
        </div>

        <div style="padding:15px 20px;background:#fcfcfd;border-top:1px solid #f1f5f9;display:flex;justify-content:center;gap:12px">
          ${(() => {
            const user = Auth.getUser();
            const isLostOwner = user && (lost.userId === user._id || lost.userId === user.id);
            const isFoundOwner = user && (found.userId === user._id || found.userId === user.id);
            
            if (isLostOwner) {
              return `<a href="tel:${found.contact}" class="btn btn-primary btn-sm">Contact Finder</a>`;
            } else if (isFoundOwner) {
              return `<a href="tel:${lost.contact}" class="btn btn-primary btn-sm">Contact Owner</a>`;
            } else {
              return `
                <a href="tel:${found.contact}" class="btn btn-primary btn-sm">Contact Finder</a>
                <a href="tel:${lost.contact}" class="btn btn-outline btn-sm">Contact Owner</a>
              `;
            }
          })()}
          <button class="btn btn-outline btn-sm" onclick="showToast('Feature coming soon: Request item return', 'info')">Request Return</button>
        </div>
      </div>
    `;
    return div;
  }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  MatchPage.init();
});
