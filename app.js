/* ============================================================================
   Raveone Careers — app.js (2026 rebuild)
   Shared client for: index.html, job.html, portal-login.html,
   portal-app.html, client-login.html, client-app.html

   ⚠️ This file was rebuilt from scratch based on what the HTML files call.
   If your old app.js had extra features, report them.
   ============================================================================ */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════


const API_URL = "https://script.google.com/macros/s/AKfycbzFSGlT2DgPg-U_vL2UsyNdX2cH9nflQ0X7sgmOTc97giY553WByUmxzppCAgBOq9aAiw/exec";

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatExp(min, max) {
  const mn = String(min || '').trim();
  const mx = String(max || '').trim();
  if (mn && mx) return mn + ' – ' + mx + ' yrs';
  if (mn) return mn + '+ yrs';
  if (mx) return 'Up to ' + mx + ' yrs';
  return 'Any experience';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim());
}

// ═══════════════════════════════════════════════════════════════════════════
// PHONE VALIDATION — THE CRITICAL FIX
// Accepts: 9148330562, +91 91483 30562, 09148330562, 919148330562
// Rejects: anything that isn't exactly 10 digits starting with 6-9
// ═══════════════════════════════════════════════════════════════════════════

function validateIndianMobile(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  let normalized = digits;
  // Only strip "91" when the total is 12 digits (country code present)
  if (digits.length === 12 && digits.startsWith('91')) normalized = digits.slice(2);
  // Only strip leading "0" when the total is 11 digits
  else if (digits.length === 11 && digits.startsWith('0')) normalized = digits.slice(1);
  // Final check
  return /^[6-9]\d{9}$/.test(normalized) ? normalized : null;
}

window.validateIndianMobile = validateIndianMobile;

// ═══════════════════════════════════════════════════════════════════════════
// FILE READER
// ═══════════════════════════════════════════════════════════════════════════

function readFileAsDataURL(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = function () { reject(new Error('Could not read file')); };
    reader.readAsDataURL(file);
  });
}

function getQueryParam(name) {
  return new URLSearchParams(location.search).get(name);
}

// ═══════════════════════════════════════════════════════════════════════════
// ATS — shared API client
// ═══════════════════════════════════════════════════════════════════════════

const ATS = {
  API_URL: API_URL,

  async post(action, payload) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action: action }, payload || {}))
      });
      let data;
      try { data = await res.json(); }
      catch (e) { return { ok: false, error: 'Invalid server response' }; }
      return data || { ok: false, error: 'Empty response' };
    } catch (e) {
      return { ok: false, error: 'Network error: ' + (e.message || 'unknown') };
    }
  },

  saveSession(key, data) {
    try {
      const k = key === 'client' ? 'ats_client' : 'ats_candidate';
      localStorage.setItem(k, JSON.stringify(data));
    } catch (e) {}
  },

  getSession(key) {
    try {
      const k = key === 'client' ? 'ats_client' : 'ats_candidate';
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  isLoggedIn(key) {
    const s = ATS.getSession(key);
    return !!(s && s.token);
  },

  clearSession(key) {
    try {
      const k = key === 'client' ? 'ats_client' : 'ats_candidate';
      localStorage.removeItem(k);
    } catch (e) {}
  },

  passwordStrength(pw) {
    const checks = {
      length: String(pw || '').length >= 8,
      letter: /[a-zA-Z]/.test(pw || ''),
      number: /\d/.test(pw || '')
    };
    const score = [checks.length, checks.letter, checks.number].filter(Boolean).length;
    return {
      valid: checks.length && checks.letter && checks.number,
      score: score,
      level: score >= 3 ? 'strong' : score >= 2 ? 'fair' : 'weak',
      checks: checks
    };
  },

  toast(msg, type) {
    let el = document.getElementById('__atsToast');
    if (!el) {
      el = document.createElement('div');
      el.id = '__atsToast';
      el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
        'padding:12px 20px;border-radius:999px;font-size:13px;font-weight:600;' +
        'color:#fff;background:#1E293B;box-shadow:0 8px 24px rgba(0,0,0,.2);' +
        'z-index:9999;opacity:0;transition:opacity .2s;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = type === 'error' ? '#DC2626'
      : type === 'success' ? '#16A34A'
      : '#1E293B';
    el.style.opacity = '1';
    clearTimeout(el.__timer);
    el.__timer = setTimeout(function () { el.style.opacity = '0'; }, 3200);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// AUTH GUARDS — required by client-app.html / portal-app.html
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Guard used at the top of app pages.
 * Redirects to login if no valid session exists.
 * Returns true if OK to continue; false if a redirect happened.
 */
ATS.requireAuth = function (key, loginPage) {
  if (!ATS.isLoggedIn(key)) {
    window.location.replace(loginPage || 'client-login.html');
    return false;
  }
  return true;
};

/**
 * Inspects an API response. If it indicates an expired or invalid session,
 * clears the stored session and redirects to login. Otherwise does nothing.
 *
 * Usage:
 *   const res = await ATS.post('clientGetDashboard', { token });
 *   if (ATS.handleAuthError(res, 'client', 'client-login.html')) return;
 *
 * Returns true  → session invalid, redirect happened, caller should return
 * Returns false → session fine, or error is not auth-related
 */
ATS.handleAuthError = function (res, key, loginPage) {
  if (!res || res.ok === false) {
    const msg = String((res && res.error) || '').toLowerCase();
    if (msg.indexOf('invalid session') !== -1 ||
        msg.indexOf('session expired') !== -1 ||
        msg.indexOf('not authenticated') !== -1 ||
        msg.indexOf('missing token') !== -1) {
      ATS.clearSession(key);
      window.location.replace(loginPage || 'client-login.html');
      return true;
    }
  }
  return false;
};

/**
 * Alias for the standalone escapeHtml, exposed on ATS for template strings.
 * client-app.html uses ATS.esc(...) inside innerHTML blocks.
 */
ATS.esc = function (str) {
  return escapeHtml(str);
};
/**
 * Map a candidate status to the correct Material 3 chip class.
 * Used by client-app.html for status badges everywhere.
 */
ATS.statusClass = function (status) {
  const s = String(status || '').toLowerCase();
  if (s === 'submitted to client')   return 'm3-chip-warning';
  if (s === 'shortlisted')            return 'm3-chip-success';
  if (s === 'interview scheduled')    return 'm3-chip-primary';
  if (s === 'offered')                return 'm3-chip-success';
  if (s === 'hired')                  return 'm3-chip-success';
  if (s === 'rejected')               return 'm3-chip-error';
  if (s === 'withdrawn')              return 'm3-chip-neutral';
  if (s === 'sourced')                return 'm3-chip-neutral';
  if (s === 'jd shared')              return 'm3-chip-neutral';
  return 'm3-chip-neutral';
};

window.ATS = ATS;

// ═══════════════════════════════════════════════════════════════════════════
// INDEX PAGE — job listing (full-featured)
// ═══════════════════════════════════════════════════════════════════════════

let _allJobs = [];
let _filteredJobs = [];
let _currentFilters = { search: '', location: '', category: '', exp: '', company: '', type: '' };
let _currentSort = 'recent';

window.initIndex = async function () {
  const board = document.getElementById('jobsGrid');
  if (!board) return;

  board.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94A3B8">Loading jobs…</div>';

  try {
    const res = await fetch(API_URL + '?action=jobs');
    const jobs = await res.json();
    _allJobs = Array.isArray(jobs) ? jobs : [];

    // ── Hide skeleton grid (fixes the 4 blank blocks) ──
    const skel = document.getElementById('skeletonGrid');
    if (skel) skel.style.display = 'none';

    // ── Populate everything ──
    populateIndexStats(_allJobs);
    populateIndexFilterDropdowns(_allJobs);
    populateIndexPopularTags(_allJobs);
    wireIndexControls();
    hideIndexLoadMore();

    // ── Initial render (all jobs) ──
    applyIndexFiltersAndRender();

  } catch (e) {
    board.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#DC2626">Failed to load jobs: ' + escapeHtml(e.message) + '</div>';
  }
};

/* ── Stats strip (Open Roles / Hiring Partners / Cities) ── */
function populateIndexStats(jobs) {
  const statJobs = document.getElementById('statJobs');
  const statClients = document.getElementById('statClients');
  const statCities = document.getElementById('statCities');

  if (statJobs) statJobs.textContent = jobs.length;

  if (statClients) {
    const uniq = {};
    jobs.forEach(function (j) { if (j.company) uniq[j.company.toLowerCase()] = true; });
    statClients.textContent = Object.keys(uniq).length;
  }

  if (statCities) {
    const uniq = {};
    jobs.forEach(function (j) { if (j.location) uniq[j.location.toLowerCase()] = true; });
    statCities.textContent = Object.keys(uniq).length;
  }
}

/* ── Populate filter dropdowns (Location / Category / Company) ── */
function populateIndexFilterDropdowns(jobs) {
  // Location
  const locSel = document.getElementById('filterLocation');
  if (locSel && locSel.options.length <= 1) {
    const seen = {};
    jobs.forEach(function (j) { if (j.location) seen[j.location] = true; });
    Object.keys(seen).sort().forEach(function (loc) {
      const opt = document.createElement('option');
      opt.value = loc;
      opt.textContent = loc;
      locSel.appendChild(opt);
    });
  }

  // Category
  const catSel = document.getElementById('filterCategory');
  if (catSel && catSel.options.length <= 1) {
    const seen = {};
    jobs.forEach(function (j) { if (j.category) seen[j.category] = true; });
    Object.keys(seen).sort().forEach(function (cat) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      catSel.appendChild(opt);
    });
  }

  // Company
  const compSel = document.getElementById('filterCompany');
  if (compSel && compSel.options.length <= 1) {
    const seen = {};
    jobs.forEach(function (j) { if (j.company) seen[j.company] = true; });
    Object.keys(seen).sort().forEach(function (comp) {
      const opt = document.createElement('option');
      opt.value = comp;
      opt.textContent = comp;
      compSel.appendChild(opt);
    });
  }
}

/* ── Popular tags under the hero ── */
function populateIndexPopularTags(jobs) {
  const container = document.getElementById('popularTags');
  if (!container) return;

  // Count occurrences of each category, take top 5
  const counts = {};
  jobs.forEach(function (j) {
    if (j.category) {
      const key = j.category;
      counts[key] = (counts[key] || 0) + 1;
    }
  });

  const topCats = Object.keys(counts)
    .sort(function (a, b) { return counts[b] - counts[a]; })
    .slice(0, 5);

  if (!topCats.length) { container.style.display = 'none'; return; }

  container.innerHTML =
    '<span class="popular-label">Popular:</span>' +
    topCats.map(function (c) {
      return '<button type="button" class="popular-tag" data-cat="' + escapeHtml(c) + '">' +
             escapeHtml(c) + ' <span style="opacity:.6;font-size:11px">(' + counts[c] + ')</span>' +
             '</button>';
    }).join('');

  container.querySelectorAll('.popular-tag').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const cat = btn.getAttribute('data-cat');
      _currentFilters.category = cat;
      const catSel = document.getElementById('filterCategory');
      if (catSel) catSel.value = cat;
      applyIndexFiltersAndRender();
      const jobsSection = document.getElementById('jobs');
      if (jobsSection) jobsSection.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/* ── Wire all filter/sort/search controls ── */
function wireIndexControls() {
  // Sidebar search
  const fSearch = document.getElementById('filterSearch');
  if (fSearch) {
    fSearch.addEventListener('input', function () {
      _currentFilters.search = fSearch.value.trim();
      applyIndexFiltersAndRender();
    });
  }

  // Location
  const fLoc = document.getElementById('filterLocation');
  if (fLoc) {
    fLoc.addEventListener('change', function () {
      _currentFilters.location = fLoc.value;
      applyIndexFiltersAndRender();
    });
  }

  // Category
  const fCat = document.getElementById('filterCategory');
  if (fCat) {
    fCat.addEventListener('change', function () {
      _currentFilters.category = fCat.value;
      applyIndexFiltersAndRender();
    });
  }

  // Experience
  const fExp = document.getElementById('filterExp');
  if (fExp) {
    fExp.addEventListener('change', function () {
      _currentFilters.exp = fExp.value;
      applyIndexFiltersAndRender();
    });
  }

  // Company
  const fComp = document.getElementById('filterCompany');
  if (fComp) {
    fComp.addEventListener('change', function () {
      _currentFilters.company = fComp.value;
      applyIndexFiltersAndRender();
    });
  }

  // Type
  const fType = document.getElementById('filterType');
  if (fType) {
    fType.addEventListener('change', function () {
      _currentFilters.type = fType.value;
      applyIndexFiltersAndRender();
    });
  }

  // Sort
  const sortSel = document.getElementById('sortSelect');
  if (sortSel) {
    sortSel.addEventListener('change', function () {
      _currentSort = sortSel.value;
      applyIndexFiltersAndRender();
    });
  }

  // Hero search form
  const heroForm = document.getElementById('searchForm');
  const heroInput = document.getElementById('heroSearch');
  if (heroForm && heroInput) {
    heroForm.addEventListener('submit', function (e) {
      e.preventDefault();
      _currentFilters.search = heroInput.value.trim();
      const fs = document.getElementById('filterSearch');
      if (fs) fs.value = _currentFilters.search;
      applyIndexFiltersAndRender();
      const jobsSection = document.getElementById('jobs');
      if (jobsSection) jobsSection.scrollIntoView({ behavior: 'smooth' });
    });
    // '/' keyboard shortcut
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== heroInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        heroInput.focus();
      }
    });
  }

  // Clear filters buttons
  const clearBtn = document.getElementById('clearFilters');
  if (clearBtn) clearBtn.addEventListener('click', clearAllIndexFilters);

  const emptyClear = document.getElementById('emptyClear');
  if (emptyClear) emptyClear.addEventListener('click', clearAllIndexFilters);

  // Mobile filter toggle
  const mobileFilterBtn = document.getElementById('mobileFilterBtn');
  const filtersAside = document.querySelector('.filters');
  if (mobileFilterBtn && filtersAside) {
    mobileFilterBtn.addEventListener('click', function () {
      filtersAside.classList.toggle('mobile-open');
    });
  }
}

/* ── Hide load-more (single-page listing) ── */
function hideIndexLoadMore() {
  const el = document.getElementById('loadMoreWrap');
  if (el) el.hidden = true;
}

/* ── Clear everything ── */
function clearAllIndexFilters() {
  _currentFilters = { search: '', location: '', category: '', exp: '', company: '', type: '' };
  ['filterSearch', 'filterLocation', 'filterCategory', 'filterExp', 'filterCompany', 'filterType'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const heroSearch = document.getElementById('heroSearch');
  if (heroSearch) heroSearch.value = '';
  applyIndexFiltersAndRender();
}

/* ── Apply filters + sort + render ── */
function applyIndexFiltersAndRender() {
  const f = _currentFilters;
  const q = f.search.toLowerCase();

  _filteredJobs = _allJobs.filter(function (j) {
    // Search across title/company/location/skills/jobId/category
    if (q) {
      const hay = [
        j.title || '', j.company || '', j.location || '',
        j.jobId || '', j.category || '', j.industry || '',
        Array.isArray(j.skills) ? j.skills.join(' ') : ''
      ].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }

    if (f.location && j.location !== f.location) return false;
    if (f.category && j.category !== f.category) return false;
    if (f.company && j.company !== f.company) return false;
    if (f.type && j.employmentType !== f.type) return false;

    // Experience bucket
    if (f.exp) {
      const minE = parseFloat(j.minExp) || 0;
      const maxE = parseFloat(j.maxExp) || 999;
      if (f.exp === '0-2' && minE > 2) return false;
      if (f.exp === '2-5' && !(minE <= 5 && maxE >= 2)) return false;
      if (f.exp === '5-10' && !(minE <= 10 && maxE >= 5)) return false;
      if (f.exp === '10+' && maxE < 10) return false;
    }
    return true;
  });

  // Sort
  if (_currentSort === 'salary-high') {
    _filteredJobs.sort(function (a, b) {
      return (parseFloat(b.maxSalary) || 0) - (parseFloat(a.maxSalary) || 0);
    });
  } else if (_currentSort === 'exp-low') {
    _filteredJobs.sort(function (a, b) {
      return (parseFloat(a.minExp) || 0) - (parseFloat(b.minExp) || 0);
    });
  } else if (_currentSort === 'recent') {
    _filteredJobs.sort(function (a, b) {
      return String(b.postedDate || '').localeCompare(String(a.postedDate || ''));
    });
  }

  renderIndexJobCards(_filteredJobs);
  updateIndexCount(_filteredJobs.length, _allJobs.length);
  updateIndexEmptyState(_filteredJobs.length);
  updateIndexActiveFiltersBar();
  updateIndexFilterInfo(_filteredJobs.length, _allJobs.length);
}

/* ── Render job cards ── */
function renderIndexJobCards(jobs) {
  const board = document.getElementById('jobsGrid');
  if (!board) return;

  if (!jobs.length) {
    board.innerHTML = '';
    return;
  }

  board.innerHTML = jobs.map(function (j) {
    const url = 'job.html?job=' + encodeURIComponent(j.jobId);
    return '<a href="' + url + '" class="job-card" style="text-decoration:none;color:inherit">' +
      '<div class="job-card-head">' +
        '<div class="job-card-id">' + escapeHtml(j.jobId) + '</div>' +
        '<div class="job-card-type">' + escapeHtml(j.employmentType || 'Full Time') + '</div>' +
      '</div>' +
      '<h3 class="job-card-title">' + escapeHtml(j.title) + '</h3>' +
      '<p class="job-card-company">' + escapeHtml(j.company) + ' · ' + escapeHtml(j.location) + '</p>' +
      '<div class="job-card-meta">' +
        '<span>💰 ' + escapeHtml(j.salaryDisplay || 'Not disclosed') + '</span>' +
        '<span>🧭 ' + escapeHtml(formatExp(j.minExp, j.maxExp)) + '</span>' +
      '</div>' +
    '</a>';
  }).join('');
}

/* ── List count ── */
function updateIndexCount(shown, total) {
  const el = document.getElementById('listCount');
  if (!el) return;
  if (shown === total) {
    el.textContent = shown + ' position' + (shown === 1 ? '' : 's');
  } else {
    el.textContent = shown + ' of ' + total + ' position' + (total === 1 ? '' : 's');
  }
}

/* ── Empty state visibility ── */
function updateIndexEmptyState(shown) {
  const empty = document.getElementById('emptyState');
  const board = document.getElementById('jobsGrid');
  if (!empty) return;
  if (shown === 0) {
    empty.hidden = false;
    if (board) board.style.display = 'none';
  } else {
    empty.hidden = true;
    if (board) board.style.display = '';
  }
}

/* ── Filter sidebar info line ── */
function updateIndexFilterInfo(shown, total) {
  const el = document.getElementById('filterInfo');
  if (!el) return;
  if (shown === total) {
    el.textContent = 'Showing all ' + total + ' job' + (total === 1 ? '' : 's');
  } else {
    el.textContent = 'Showing ' + shown + ' of ' + total + ' job' + (total === 1 ? '' : 's');
  }
}

/* ── Active filters bar (chips above the list) ── */
function updateIndexActiveFiltersBar() {
  const bar = document.getElementById('activeFiltersBar');
  if (!bar) return;

  const f = _currentFilters;
  const tags = [];
  if (f.search) tags.push({ key: 'search', label: 'Search: ' + f.search });
  if (f.location) tags.push({ key: 'location', label: '📍 ' + f.location });
  if (f.category) tags.push({ key: 'category', label: '🏷 ' + f.category });
  if (f.exp) tags.push({ key: 'exp', label: '🧭 ' + f.exp + ' yrs' });
  if (f.company) tags.push({ key: 'company', label: '🏢 ' + f.company });
  if (f.type) tags.push({ key: 'type', label: '💼 ' + f.type });

  if (!tags.length) {
    bar.innerHTML = '';
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  bar.innerHTML = tags.map(function (t) {
    return '<button type="button" class="active-filter-tag" data-key="' + t.key + '">' +
      escapeHtml(t.label) + ' <span style="opacity:.6">×</span></button>';
  }).join('') +
  '<button type="button" class="active-filter-clear">Clear all</button>';

  bar.querySelectorAll('.active-filter-tag').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const key = btn.getAttribute('data-key');
      _currentFilters[key] = '';
      const map = {
        search: 'filterSearch', location: 'filterLocation',
        category: 'filterCategory', exp: 'filterExp',
        company: 'filterCompany', type: 'filterType'
      };
      const fieldId = map[key];
      if (fieldId) {
        const el = document.getElementById(fieldId);
        if (el) el.value = '';
      }
      if (key === 'search') {
        const hs = document.getElementById('heroSearch');
        if (hs) hs.value = '';
      }
      applyIndexFiltersAndRender();
    });
  });

  const clearBtn = bar.querySelector('.active-filter-clear');
  if (clearBtn) clearBtn.addEventListener('click', clearAllIndexFilters);
}
// ═══════════════════════════════════════════════════════════════════════════
// JOB DETAIL PAGE
// ═══════════════════════════════════════════════════════════════════════════

let _currentJob = null;

window.initJobDetail = async function () {
  const jobId = getQueryParam('job');
  if (!jobId) {
    showJobError('No job ID specified');
    return;
  }

  try {
    const res = await fetch(API_URL + '?action=job&id=' + encodeURIComponent(jobId));
    const job = await res.json();
    if (!job || !job.jobId) {
      showJobError('Job not found or no longer available');
      return;
    }
    _currentJob = job;
    renderJobDetail(job);
    setupApplyForm(job);
    setupShareButtons(job);
    setupSaveButton(job);
    updateDocumentMeta(job);
    loadSimilarJobs(job);
    hideMobileBarUntilScroll();
  } catch (e) {
    showJobError('Failed to load job: ' + e.message);
  }
};

function showJobError(msg) {
  document.getElementById('jobLoading').hidden = true;
  const err = document.getElementById('jobError');
  err.hidden = false;
  document.getElementById('errorMessage').textContent = msg;
}

function renderJobDetail(job) {
  document.getElementById('jobLoading').hidden = true;
  document.getElementById('jobContent').hidden = false;

  // Chips
  document.getElementById('jobIdChip').textContent = job.jobId;
  document.getElementById('jobTypeChip').textContent = job.employmentType || 'Full Time';
  if (job.positions > 1) {
    const chip = document.getElementById('jobPositionsChip');
    chip.hidden = false;
    chip.textContent = job.positions + ' openings';
  }

  // Title + subtitle
  document.getElementById('jobTitle').textContent = job.title || 'Role';
  document.getElementById('jobCompany').textContent = job.company || '';
  document.getElementById('jobLocationTop').textContent = job.location || '';
  if (job.industry) {
    document.getElementById('jobIndustryDot').hidden = false;
    document.getElementById('jobIndustryTop').textContent = job.industry;
  }

  // Quick meta
  document.getElementById('jobSalary').textContent = job.salaryDisplay || 'Not disclosed';
  document.getElementById('jobExp').textContent = formatExp(job.minExp, job.maxExp);
  document.getElementById('jobLocationMeta').textContent = job.location || '—';
  document.getElementById('jobPostedDate').textContent = job.postedDate || '—';

  // Breadcrumb
  document.getElementById('crumbCurrent').textContent = job.title || 'Job';

  // Description
  document.getElementById('jobDescription').innerHTML = formatTextToHtml(job.description);

  // Requirements
  if (job.requirements) {
    document.getElementById('blockRequirements').hidden = false;
    document.getElementById('jobRequirements').innerHTML = formatTextToHtml(job.requirements);
  } else {
    document.getElementById('blockRequirements').hidden = true;
  }

  // Skills
  if (Array.isArray(job.skills) && job.skills.length) {
    document.getElementById('jobSkills').innerHTML = job.skills
      .map(function (s) { return '<span class="skill-pill">' + escapeHtml(s) + '</span>'; })
      .join('');
  } else {
    document.getElementById('blockSkills').hidden = true;
  }

  // Education
  if (job.education) {
    document.getElementById('blockEducation').hidden = false;
    document.getElementById('jobEducation').textContent = job.education;
  } else {
    document.getElementById('blockEducation').hidden = true;
  }

  // Benefits
  if (Array.isArray(job.benefits) && job.benefits.length) {
    document.getElementById('jobBenefits').innerHTML = job.benefits
      .map(function (b) { return '<span class="benefit-pill">✓ ' + escapeHtml(b) + '</span>'; })
      .join('');
  } else {
    document.getElementById('blockBenefits').hidden = true;
  }

  // Industry
  if (job.industry) {
    document.getElementById('jobIndustry').textContent = job.industry;
  } else {
    document.getElementById('blockIndustry').hidden = true;
  }

  // Company
  document.getElementById('companyName').textContent = job.company || '—';
  document.getElementById('companyAddress').textContent = job.address || '';
  if (job.website) {
    document.getElementById('companyWebsite').href = job.website.startsWith('http') ? job.website : 'https://' + job.website;
    document.getElementById('companyWebsite').style.display = '';
  } else {
    document.getElementById('companyWebsite').style.display = 'none';
  }

  // Mobile bar
  document.getElementById('mobileJobTitle').textContent = job.title;
  document.getElementById('mobileJobSalary').textContent = job.salaryDisplay || '';
  document.getElementById('fJobId').value = job.jobId;

  // JSON-LD schema
  injectJobSchema(job);
}

function formatTextToHtml(text) {
  if (!text) return '';
  return escapeHtml(text)
    .split(/\n\n+/)
    .map(function (para) { return '<p>' + para.replace(/\n/g, '<br>') + '</p>'; })
    .join('');
}

function updateDocumentMeta(job) {
  const title = job.title + ' at ' + job.company + ' — Raveone Careers';
  const desc = (job.description || '').slice(0, 155) + (job.description && job.description.length > 155 ? '…' : '');
  document.title = title;

  const baseUrl = 'https://career.raveone.in/job.html?job=' + encodeURIComponent(job.jobId);
  const ogTitle = document.getElementById('ogTitleMeta');
  const ogDesc = document.getElementById('ogDescription');
  const ogUrl = document.getElementById('ogUrl');
  const canonical = document.getElementById('canonicalLink');
  const metaDesc = document.getElementById('metaDescription');

  if (ogTitle) ogTitle.setAttribute('content', title);
  if (ogDesc) ogDesc.setAttribute('content', desc);
  if (ogUrl) ogUrl.setAttribute('content', baseUrl);
  if (canonical) canonical.setAttribute('href', baseUrl);
  if (metaDesc) metaDesc.setAttribute('content', desc);
}

function injectJobSchema(job) {
  const container = document.getElementById('jobSchemaContainer');
  if (!container) return;

  const schema = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    'title': job.title,
    'description': job.description,
    'datePosted': job.postedDate || new Date().toISOString().split('T')[0],
    'employmentType': job.employmentType === 'Full Time' ? 'FULL_TIME' : 'CONTRACTOR',
    'hiringOrganization': { '@type': 'Organization', 'name': job.company },
    'jobLocation': {
      '@type': 'Place',
      'address': {
        '@type': 'PostalAddress',
        'addressLocality': job.location,
        'addressCountry': 'IN'
      }
    }
  };
  if (job.minSalary || job.maxSalary) {
    schema.baseSalary = {
      '@type': 'MonetaryAmount',
      'currency': 'INR',
      'value': {
        '@type': 'QuantitativeValue',
        'minValue': job.minSalary,
        'maxValue': job.maxSalary,
        'unitText': 'YEAR'
      }
    };
  }
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  container.appendChild(script);
}

// ═══════════════════════════════════════════════════════════════════════════
// APPLY FORM
// ═══════════════════════════════════════════════════════════════════════════

function setupApplyForm(job) {
  const form = document.getElementById('applyForm');
  if (!form) return;

  const resumeInput = document.getElementById('fResume');
  if (resumeInput) {
    resumeInput.addEventListener('change', function () {
      const fileName = document.getElementById('uploadFileName');
      const zone = document.getElementById('uploadZone');
      const file = resumeInput.files[0];
      if (file) {
        fileName.textContent = file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
        zone.classList.add('has-file');
        if (file.size > 5 * 1024 * 1024) {
          fileName.textContent = '❌ File too large — max 5 MB';
          fileName.style.color = '#DC2626';
          resumeInput.value = '';
        } else {
          fileName.style.color = '';
        }
      } else {
        fileName.textContent = '';
        zone.classList.remove('has-file');
      }
    });
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    await handleApplySubmit(job);
  });
}

async function handleApplySubmit(job) {
  const btn = document.getElementById('submitBtn');
  const btnText = btn.querySelector('.btn-apply-text') || btn;
  const originalText = btnText.textContent;

  const name = (document.getElementById('fName').value || '').trim();
  const phoneRaw = (document.getElementById('fPhone').value || '').trim();
  const email = (document.getElementById('fEmail').value || '').trim().toLowerCase();
  const location = (document.getElementById('fLocation').value || '').trim();
  const education = (document.getElementById('fEducation').value || '').trim();
  const totalExp = (document.getElementById('fTotalExp').value || '').trim();
  const relExp = (document.getElementById('fRelExp').value || '').trim();
  const currentCtc = (document.getElementById('fCurrentCtc').value || '').trim();
  const expectedCtc = (document.getElementById('fExpectedCtc').value || '').trim();
  const notice = (document.getElementById('fNotice').value || '').trim();
  const reason = (document.getElementById('fReason').value || '').trim();
  const resumeFile = document.getElementById('fResume').files[0];

  if (!name || name.length < 2) {
    alert('Please enter your full name');
    document.getElementById('fName').focus();
    return;
  }

  const phone = validateIndianMobile(phoneRaw);
  if (!phone) {
    alert('Please enter a valid 10-digit Indian mobile number.\n\nAcceptable formats:\n• 9148330562\n• +91 91483 30562\n• 09148330562');
    document.getElementById('fPhone').focus();
    return;
  }

  if (!isValidEmail(email)) {
    alert('Please enter a valid email address');
    document.getElementById('fEmail').focus();
    return;
  }

  if (!totalExp) {
    alert('Please enter your total experience');
    document.getElementById('fTotalExp').focus();
    return;
  }

  if (!notice) {
    alert('Please enter your notice period');
    document.getElementById('fNotice').focus();
    return;
  }

  if (!resumeFile) {
    alert('Please attach your resume');
    document.getElementById('fResume').focus();
    return;
  }

  if (resumeFile.size > 5 * 1024 * 1024) {
    alert('Resume is too large. Please keep it under 5 MB.');
    return;
  }

  btn.disabled = true;
  btnText.textContent = 'Submitting…';

  try {
    const resumeDataUri = await readFileAsDataURL(resumeFile);

    const payload = {
      action: 'submitCandidate',
      candidateName: name,
      phone: phone,
      email: email,
      jobId: job.jobId,
      resumeData: resumeDataUri,
      resumeName: resumeFile.name,
      CURRENT_LOCATION: location,
      Education: education,
      Total_Experience: totalExp,
      Relevant_Experience: relExp,
      Current_CTC: currentCtc,
      Expected_CTC: expectedCtc,
      Notice_Period: notice,
      Reason_for_Leaving: reason
    };

    const res = await ATS.post('submitCandidate', payload);

    if (!res || !res.ok) {
      const errMsg = (res && res.error) || 'Submission failed. Please try again.';

      const m = errMsg.match(/(APP-\d+)/);
      if (m) {
        const cleanMsg = errMsg.replace(/\.?\s*(?:Reference|Ref)[:\s]*APP-\d+\.?/i, '').trim() + '.';
        alert(cleanMsg + '\n\nYour reference: ' + m[1] +
          '\n\nYou can track it at career.raveone.in/portal-login.html');
        btn.disabled = false;
        btnText.textContent = originalText;
        return;
      }

      alert(errMsg);
      btn.disabled = false;
      btnText.textContent = originalText;
      return;
    }

    document.getElementById('applyForm').hidden = true;
    document.getElementById('applySuccess').hidden = false;
    document.getElementById('successAppId').textContent = res.applicationId || '—';
    btn.disabled = false;
    btnText.textContent = originalText;

    document.getElementById('applySuccess').scrollIntoView({ behavior: 'smooth', block: 'center' });

  } catch (e) {
    alert('Error: ' + (e.message || 'Something went wrong'));
    btn.disabled = false;
    btnText.textContent = originalText;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARE / SAVE / COPY
// ═══════════════════════════════════════════════════════════════════════════

function setupShareButtons(job) {
  const shareUrl = 'https://career.raveone.in/job.html?job=' + encodeURIComponent(job.jobId);
  const shareText = job.title + ' at ' + job.company;

  const popover = document.getElementById('sharePopover');
  const shareBtn = document.getElementById('shareBtn');
  const copyBtn = document.getElementById('copyLinkBtn');
  const shareClose = document.getElementById('shareClose');

  if (shareBtn && popover) {
    shareBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      popover.hidden = !popover.hidden;
    });
  }

  if (shareClose) {
    shareClose.addEventListener('click', function () { popover.hidden = true; });
  }

  document.addEventListener('click', function (e) {
    if (popover && !popover.hidden && !popover.contains(e.target) && e.target !== shareBtn) {
      popover.hidden = true;
    }
  });

  const wa = document.getElementById('shareWhatsapp');
  if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent(shareText + ' — ' + shareUrl);

  const em = document.getElementById('shareEmail');
  if (em) em.href = 'mailto:?subject=' + encodeURIComponent(shareText) +
    '&body=' + encodeURIComponent('Check out this job: ' + shareUrl);

  const li = document.getElementById('shareLinkedin');
  if (li) li.href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl);

  const copyShare = document.getElementById('shareCopy');
  if (copyShare) {
    copyShare.addEventListener('click', function () {
      copyToClipboard(shareUrl);
      popover.hidden = true;
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () { copyToClipboard(shareUrl); });
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      ATS.toast('Link copied', 'success');
    }).catch(function () {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); ATS.toast('Link copied', 'success'); }
  catch (e) { alert('Copy failed. Please copy manually: ' + text); }
  document.body.removeChild(ta);
}

function setupSaveButton(job) {
  const btn = document.getElementById('saveBtn');
  const text = document.getElementById('saveBtnText');
  if (!btn) return;

  const saved = getSavedJobs();
  const isSaved = saved.indexOf(job.jobId) !== -1;
  if (isSaved) {
    btn.classList.add('saved');
    if (text) text.textContent = 'Saved';
  }

  btn.addEventListener('click', function () {
    const list = getSavedJobs();
    const idx = list.indexOf(job.jobId);
    if (idx === -1) {
      list.push(job.jobId);
      btn.classList.add('saved');
      if (text) text.textContent = 'Saved';
      ATS.toast('Job saved', 'success');
    } else {
      list.splice(idx, 1);
      btn.classList.remove('saved');
      if (text) text.textContent = 'Save';
      ATS.toast('Removed from saved', 'success');
    }
    localStorage.setItem('ats_saved_jobs', JSON.stringify(list));
  });
}

function getSavedJobs() {
  try {
    return JSON.parse(localStorage.getItem('ats_saved_jobs') || '[]');
  } catch (e) { return []; }
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMILAR JOBS
// ═══════════════════════════════════════════════════════════════════════════

async function loadSimilarJobs(job) {
  try {
    const res = await fetch(API_URL + '?action=jobs');
    const all = await res.json();
    if (!Array.isArray(all)) return;

    const similar = all
      .filter(function (j) {
        if (j.jobId === job.jobId) return false;
        if (j.category && job.category && j.category === job.category) return true;
        if (j.location && job.location && j.location === job.location) return true;
        return false;
      })
      .slice(0, 3);

    if (!similar.length) {
      document.getElementById('blockSimilar').hidden = true;
      return;
    }

    document.getElementById('similarJobs').innerHTML = similar.map(function (j) {
      return '<a href="job.html?job=' + encodeURIComponent(j.jobId) + '" class="similar-card" style="text-decoration:none;color:inherit">' +
        '<div class="similar-id">' + escapeHtml(j.jobId) + '</div>' +
        '<h4 class="similar-title">' + escapeHtml(j.title) + '</h4>' +
        '<p class="similar-company">' + escapeHtml(j.company) + ' · ' + escapeHtml(j.location) + '</p>' +
      '</a>';
    }).join('');

  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE APPLY BAR
// ═══════════════════════════════════════════════════════════════════════════

function hideMobileBarUntilScroll() {
  const bar = document.getElementById('mobileApplyBar');
  const btn = document.getElementById('mobileApplyBtn');
  if (!bar || !btn) return;

  const sidebar = document.getElementById('applySidebar');
  const checkScroll = function () {
    if (window.innerWidth > 900 || !sidebar) { bar.hidden = true; return; }
    const rect = sidebar.getBoundingClientRect();
    bar.hidden = rect.top < window.innerHeight && rect.bottom > 0;
  };

  window.addEventListener('scroll', checkScroll, { passive: true });
  checkScroll();

  btn.addEventListener('click', function () {
    sidebar.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-INIT
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function () {
  const y = document.getElementById('footerYear');
  if (y) y.textContent = new Date().getFullYear();

  if (document.getElementById('jobDetail') && !window.__jobDetailInit) {
    window.__jobDetailInit = true;
    if (typeof window.initJobDetail === 'function') window.initJobDetail();
  }

  if ((document.getElementById('jobBoard') || document.getElementById('jobsGrid')) && !window.__indexInit) {
    window.__indexInit = true;
    if (typeof window.initIndex === 'function') window.initIndex();
  }
});
