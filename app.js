/* ============================================================================
   Raveone Careers — Shared Client
   ============================================================================ */

(function () {
  const ATS = {
    API_URL: 'https://script.google.com/macros/s/AKfycbx_REPLACE_ME/exec',

    async getJobs() {
      try {
        const r = await fetch(this.API_URL + '?action=jobs', { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.json();
      } catch (e) { console.error('getJobs:', e); return []; }
    },

    async getJob(jobId) {
      try {
        const r = await fetch(this.API_URL + '?action=job&id=' + encodeURIComponent(jobId), { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        return data && data.error ? null : data;
      } catch (e) { console.error('getJob:', e); return null; }
    },

    async post(action, payload) {
      try {
        const r = await fetch(this.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(Object.assign({ action: action }, payload || {}))
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.json();
      } catch (e) {
        console.error('POST ' + action + ':', e);
        return { ok: false, error: e.message || 'Network error' };
      }
    },

    /* ── Session ── */
    saveSession(key, data) { try { localStorage.setItem('ats_' + key, JSON.stringify(data)); } catch (e) {} },
    getSession(key) { try { const r = localStorage.getItem('ats_' + key); return r ? JSON.parse(r) : null; } catch (e) { return null; } },
    clearSession(key) { try { localStorage.removeItem('ats_' + key); } catch (e) {} },
    isLoggedIn(portal) { const s = this.getSession(portal); return !!(s && s.token); },
    requireAuth(portal, loginUrl) {
      if (!this.isLoggedIn(portal)) { window.location.replace(loginUrl); return false; }
      return true;
    },

    /* ── UI ── */
    esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },

    toast(msg, type) {
      let el = document.getElementById('ats-snackbar');
      if (!el) {
        el = document.createElement('div');
        el.id = 'ats-snackbar';
        el.className = 'm3-snackbar';
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.className = 'm3-snackbar' + (type ? ' ' + type : '');
      requestAnimationFrame(() => el.classList.add('show'));
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove('show'), 3200);
    },

    fmtDate(iso) {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch (e) { return String(iso); }
    },

    toIsoDate(any) {
      if (!any) return new Date().toISOString().split('T')[0];
      if (any instanceof Date && !isNaN(any.getTime())) return any.toISOString().split('T')[0];
      const months = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
                       jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
      const m = String(any).match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
      if (m) {
        const mo = months[m[2].substring(0, 3).toLowerCase()];
        if (mo) return m[3] + '-' + mo + '-' + String(m[1]).padStart(2, '0');
      }
      const d = new Date(any);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      return new Date().toISOString().split('T')[0];
    },

    addDays(isoDate, days) {
      const d = new Date(isoDate + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().split('T')[0];
    },

    statusClass(status) {
      const s = String(status || '').toLowerCase().replace(/\s+/g, '-');
      const map = {
        'sourced': 'm3-status-sourced',
        'jd-shared': 'm3-status-jd-shared',
        'shortlisted': 'm3-status-shortlisted',
        'submitted-to-client': 'm3-status-submitted',
        'interview-scheduled': 'm3-status-interview',
        'offered': 'm3-status-offered',
        'hired': 'm3-status-hired',
        'rejected': 'm3-status-rejected',
        'withdrawn': 'm3-status-withdrawn'
      };
      return map[s] || 'm3-chip-neutral';
    },

    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          const base64 = result.indexOf(',') !== -1 ? result.split(',')[1] : result;
          resolve({ base64: base64, name: file.name, size: file.size, type: file.type });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    on(eventName, selector, handler) {
      document.addEventListener(eventName, function (e) {
        const target = e.target.closest(selector);
        if (target) handler.call(target, e);
      });
    },

    /* ── Password strength (shared between portals) ── */
    passwordStrength(pw) {
      const checks = {
        length: pw.length >= 8,
        letter: /[a-zA-Z]/.test(pw),
        number: /[0-9]/.test(pw)
      };
      const score = Object.values(checks).filter(Boolean).length;
      return {
        checks: checks,
        score: score,  // 0..3
        level: score === 3 ? 'strong' : score === 2 ? 'fair' : 'weak',
        valid: checks.length && checks.letter && checks.number
      };
    },

    /* Detect session expiry and redirect */
    handleAuthError(res, portal, loginUrl) {
      if (!res.ok && /not authenticated|invalid session|session expired|deactivated/i.test(res.error || '')) {
        this.toast('Your session expired. Please sign in again.', 'error');
        this.clearSession(portal);
        setTimeout(() => window.location.replace(loginUrl), 800);
        return true;
      }
      return false;
    }
  };

  window.ATS = ATS;
})();
