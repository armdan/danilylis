// public/js/navbar-loader.js
// Bootstrap 5–ready navbar injector + hydrator (logo + lab name)
// Safe to include on every page.

(() => {
  // Prevent duplicate initialization
  if (window.__NAVBAR_LOADER__) return;
  window.__NAVBAR_LOADER__ = true;

  // Endpoints your backend can expose (optional but recommended)
  const ENDPOINTS = {
    settings: '/api/settings',       // -> { settings: { labName: "Matrix Labs", ... } }
    logo: '/api/settings/logo',      // -> { url: "https://..." } or 404 if none
    logout: '/api/logout'
  };

  const LS = {
    labName: 'labName',
  };

  // Public API (if other pages want to call it)
  window.loadNavbar = function(callback) {
    if (document.getElementById('app-navbar')) {
      initNavbar().then(() => callback && callback());
      return;
    }
    fetch('/navbar.html', { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error(`Failed to load navbar.html: ${r.status}`);
        return r.text();
      })
      .then(html => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html.trim();
        const nav = wrapper.querySelector('#app-navbar');
        const spacer = wrapper.querySelector('div[style*="height"]');
        if (!nav) throw new Error('#app-navbar not found in navbar.html');

        // Insert at top of <body> so it's independent of pages
        document.body.insertBefore(nav, document.body.firstChild);
        if (spacer) document.body.insertBefore(spacer, nav.nextSibling);
      })
      .then(initNavbar)
      .then(() => callback && callback())
      .catch(err => console.error('Navbar load error:', err));
  };

  // Initialize dropdowns, brand values, user menu, etc.
  async function initNavbar() {
    try {
      initBootstrapDropdowns();
      await hydrateBrand();     // logo + lab name
      updateNavbarUser();       // show user full name if available
      checkAdminAccess();       // show Settings for admins
      highlightActive();        // mark current page
      wireLogout();             // logout button
      listenForLiveUpdates();   // react to settings changes without reload
    } catch (e) {
      console.error('Navbar init failed:', e);
    }
  }

  function initBootstrapDropdowns() {
    // Requires Bootstrap 5 bundle JS loaded globally
    if (!window.bootstrap) return;
    document.querySelectorAll('#app-navbar [data-bs-toggle="dropdown"]')
      .forEach(el => new bootstrap.Dropdown(el));
  }

  async function hydrateBrand() {
    const nameEl = document.getElementById('labNameText');
    const logoEl = document.getElementById('navbarLogo');
    const fallbackIcon = document.getElementById('navbarFallbackIcon');

    // 1) Local-first labName
    let labName = (localStorage.getItem(LS.labName) || '').trim();
    // 2) Try server if missing (or keep local if present)
    const headers = getAuthHeadersSafe();

    try {
      if (!labName) {
        const r = await fetch(ENDPOINTS.settings, { credentials: 'include', headers });
        if (r.ok) {
          const j = await r.json();
          const n = j?.settings?.labName || j?.labName || '';
          if (n) {
            labName = String(n).trim();
            localStorage.setItem(LS.labName, labName);
          }
        }
      }
    } catch (e) {
      // ignore fetch errors; we still have defaults
    }

    // Apply lab name (if any)
    if (nameEl && labName) nameEl.textContent = labName;

    // Fetch logo (if any)
    let logoUrl = '';
    try {
      const lr = await fetch(ENDPOINTS.logo, { credentials: 'include', headers });
      if (lr.ok) {
        const lj = await lr.json();
        logoUrl = (lj && lj.url) ? String(lj.url) : '';
      }
    } catch (e) {
      // ignore
    }

    // Show logo if present; otherwise show fallback icon
    if (logoEl) {
      if (logoUrl) {
        logoEl.src = logoUrl;
        logoEl.style.display = 'inline-block';
        if (fallbackIcon) fallbackIcon.style.display = 'none';
      } else {
        logoEl.removeAttribute('src');
        logoEl.style.display = 'none';
        if (fallbackIcon) fallbackIcon.style.display = '';
      }
    }
  }

  function updateNavbarUser() {
    try {
      // If your auth layer exposes a global AuthManager:
      if (typeof AuthManager !== 'undefined' && AuthManager.getUser) {
        const user = AuthManager.getUser();
        const el = document.getElementById('userName');
        if (user && el) {
          const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
          el.textContent = full || user.username || user.email || 'User';
        }
      }
    } catch {
      // no-op
    }
  }

  function checkAdminAccess() {
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.getUser) {
        const user = AuthManager.getUser();
        if (user && (user.role === 'admin' || user.isAdmin === true)) {
          const li = document.getElementById('settingsNavItem');
          if (li) li.style.display = '';
        }
      }
    } catch {
      // no-op
    }
  }

  function highlightActive() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    document.querySelectorAll('#app-navbar .nav-link').forEach(a => {
      try {
        const href = new URL(a.getAttribute('href'), location.origin)
          .pathname.replace(/\/+$/, '') || '/';
        a.classList.toggle('active', href === path);
      } catch {
        /* ignore */
      }
    });
  }

  function wireLogout() {
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        await fetch(ENDPOINTS.logout, { method: 'POST', credentials: 'include', headers: getAuthHeadersSafe() });
      } catch {
        // ignore network errors; still continue
      } finally {
        try { localStorage.removeItem('authToken'); } catch {}
        try { localStorage.removeItem('user'); } catch {}
        location.href = '/login';
      }
    });
  }

  function listenForLiveUpdates() {
    // Your Settings page can dispatch this after saving:
    // window.dispatchEvent(new CustomEvent('labSettingsUpdated', { detail: { labName, labLogoUrl } }));
    window.addEventListener('labSettingsUpdated', (ev) => {
      const { labName, labLogoUrl } = ev.detail || {};
      const nameEl = document.getElementById('labNameText');
      const logoEl = document.getElementById('navbarLogo');
      const fallbackIcon = document.getElementById('navbarFallbackIcon');

      if (labName && nameEl) {
        localStorage.setItem(LS.labName, labName);
        nameEl.textContent = labName;
      }

      if (logoEl) {
        if (labLogoUrl) {
          logoEl.src = labLogoUrl;
          logoEl.style.display = 'inline-block';
          if (fallbackIcon) fallbackIcon.style.display = 'none';
        } else {
          logoEl.removeAttribute('src');
          logoEl.style.display = 'none';
          if (fallbackIcon) fallbackIcon.style.display = '';
        }
      }
    });
  }

  function getAuthHeadersSafe() {
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.getAuthHeaders) {
        return AuthManager.getAuthHeaders();
      }
    } catch { /* ignore */ }
    return {}; // fallback
  }

  // Auto-mount on every page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.loadNavbar());
  } else {
    window.loadNavbar();
  }
})();
