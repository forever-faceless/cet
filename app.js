let DATA = null;

function getGM(e) {
  return e.ranks.GM || e.ranks.GMH || e.ranks.GMR || e.ranks.GMK || null;
}

function get3AG(e) {
  return e.ranks['3AG'] || e.ranks['3AH'] || e.ranks['3AR'] || e.ranks['3AK'] || null;
}

function queryKCET({ rank, year, round, course, limit }) {
  const matches = DATA.entries.filter(e => {
    if (year && e.year !== year) return false;
    if (round && e.round !== round) return false;
    if (course && e.course !== course) return false;
    if (e.source === 'comedk_only') return false;
    const gm = getGM(e);
    const cat3a = get3AG(e);
    return (gm && gm >= rank) || (cat3a && cat3a >= rank);
  });
  matches.sort((a, b) => (getGM(a) || 999999) - (getGM(b) || 999999));
  return limit ? matches.slice(0, limit) : matches;
}

function queryCOMEDK({ rank, year, course, limit }) {
  const matches = DATA.entries.filter(e => {
    if (!e.comedkRank) return false;
    if (year && e.year !== year) return false;
    if (course && e.course !== course) return false;
    return e.comedkRank >= rank;
  });
  const seen = new Set();
  const deduped = [];
  for (const e of matches) {
    const key = `${e.year}_${e.college}_${e.course}`;
    if (!seen.has(key)) { seen.add(key); deduped.push(e); }
  }
  deduped.sort((a, b) => a.comedkRank - b.comedkRank);
  return limit ? deduped.slice(0, limit) : deduped;
}

function populateFilters() {
  const yearEl = document.getElementById('year');
  const courseEl = document.getElementById('course');
  const years = [...new Set(DATA.entries.map(e => e.year))].sort((a, b) => b - a);
  const courses = [...new Set(DATA.entries.map(e => e.course))].sort();

  for (const y of years) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    yearEl.appendChild(opt);
  }
  for (const c of courses) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    courseEl.appendChild(opt);
  }

  document.getElementById('stats-info').textContent =
    `Dataset: ${DATA.metadata.totalEntries.toLocaleString()} entries across ${DATA.metadata.uniqueColleges} colleges and ${DATA.metadata.uniqueCourses} courses.`;
}

function renderKCET(results) {
  const tbody = document.querySelector('#kcet-table tbody');
  const empty = document.getElementById('kcet-empty');
  const wrap = document.querySelector('#kcet-panel .table-wrap');
  tbody.innerHTML = '';

  document.getElementById('kcet-count').textContent = results.length;

  if (results.length === 0) {
    empty.hidden = false;
    wrap.hidden = true;
    return;
  }
  empty.hidden = true;
  wrap.hidden = false;

  for (let i = 0; i < results.length; i++) {
    const e = results[i];
    const gm = getGM(e);
    const cat3a = get3AG(e);
    const ck = e.comedkRank;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-num">${i + 1}</td>
      <td class="col-college"><div class="college-name">${esc(e.college)}</div>${e.collegeCode ? `<div class="college-code">${esc(e.collegeCode)}</div>` : ''}</td>
      <td class="col-course">${esc(e.course)}</td>
      <td class="col-year">${e.year}</td>
      <td class="col-round">${e.round}</td>
      <td class="col-rank rank-gm">${gm != null ? gm.toLocaleString() : '—'}</td>
      <td class="col-rank rank-3ag">${cat3a != null ? cat3a.toLocaleString() : '—'}</td>
      <td class="col-rank rank-ck">${ck != null ? ck.toLocaleString() : '—'}</td>`;
    tbody.appendChild(tr);
  }
}

function renderCOMEDK(results) {
  const tbody = document.querySelector('#comedk-table tbody');
  const empty = document.getElementById('comedk-empty');
  const wrap = document.querySelector('#comedk-panel .table-wrap');
  tbody.innerHTML = '';

  document.getElementById('comedk-count').textContent = results.length;

  if (results.length === 0) {
    empty.hidden = false;
    wrap.hidden = true;
    return;
  }
  empty.hidden = true;
  wrap.hidden = false;

  for (let i = 0; i < results.length; i++) {
    const e = results[i];
    const gm = getGM(e);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-num">${i + 1}</td>
      <td class="col-college"><div class="college-name">${esc(e.college)}</div>${e.collegeCode ? `<div class="college-code">${esc(e.collegeCode)}</div>` : ''}</td>
      <td class="col-course">${esc(e.course)}</td>
      <td class="col-year">${e.year}</td>
      <td class="col-rank rank-ck">${e.comedkRank.toLocaleString()}</td>
      <td class="col-rank rank-gm">${gm != null ? gm.toLocaleString() : '—'}</td>`;
    tbody.appendChild(tr);
  }
}

function esc(s) {
  const el = document.createElement('span');
  el.textContent = s;
  return el.innerHTML;
}

let lastKCETResults = [];
let lastCOMEDKResults = [];

function doSearch() {
  const kcetRank = parseInt(document.getElementById('kcet-rank').value) || 0;
  const comedkRank = parseInt(document.getElementById('comedk-rank').value) || 0;
  const year = parseInt(document.getElementById('year').value) || 0;
  const round = document.getElementById('round').value;
  const course = document.getElementById('course').value;
  const limitVal = parseInt(document.getElementById('limit').value);
  const limit = limitVal === 0 ? 0 : limitVal;

  if (!kcetRank && !comedkRank) {
    alert('Enter a KCET rank and/or COMEDK rank');
    return;
  }

  document.getElementById('results').hidden = false;

  if (kcetRank) {
    lastKCETResults = queryKCET({ rank: kcetRank, year, round, course, limit });
    renderKCET(lastKCETResults);
    const parts = [`Showing colleges for KCET rank ${kcetRank.toLocaleString()} (GM + 3AG)`];
    if (year) parts.push(`${year}`);
    if (round) parts.push(round);
    if (course) parts.push(course);
    document.getElementById('kcet-summary').textContent = parts.join(' · ') + ` — ${lastKCETResults.length} results`;
  } else {
    lastKCETResults = [];
    renderKCET([]);
    document.getElementById('kcet-summary').textContent = '';
  }

  if (comedkRank) {
    lastCOMEDKResults = queryCOMEDK({ rank: comedkRank, year, course, limit });
    renderCOMEDK(lastCOMEDKResults);
    const parts = [`Showing colleges for COMEDK rank ${comedkRank.toLocaleString()}`];
    if (year) parts.push(`${year}`);
    if (course) parts.push(course);
    document.getElementById('comedk-summary').textContent = parts.join(' · ') + ` — ${lastCOMEDKResults.length} results`;

    if (!kcetRank) switchTab('comedk');
  } else {
    lastCOMEDKResults = [];
    renderCOMEDK([]);
    document.getElementById('comedk-summary').textContent = '';
  }
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === tab + '-panel'));
}

function setupSorting() {
  document.querySelectorAll('#kcet-table th.sortable').forEach(th => {
    th.addEventListener('click', () => sortTable('kcet', th));
  });
  document.querySelectorAll('#comedk-table th.sortable').forEach(th => {
    th.addEventListener('click', () => sortTable('comedk', th));
  });
}

function sortTable(type, th) {
  const table = type === 'kcet' ? document.getElementById('kcet-table') : document.getElementById('comedk-table');
  const results = type === 'kcet' ? lastKCETResults : lastCOMEDKResults;
  const field = th.dataset.sort;

  const wasAsc = th.classList.contains('sorted-asc');
  table.querySelectorAll('th').forEach(h => { h.classList.remove('sorted-asc', 'sorted-desc'); });
  const dir = wasAsc ? 'desc' : 'asc';
  th.classList.add('sorted-' + dir);

  const sortFn = (a, b) => {
    let va, vb;
    switch (field) {
      case 'college': va = a.college; vb = b.college; break;
      case 'course': va = a.course; vb = b.course; break;
      case 'year': va = a.year; vb = b.year; break;
      case 'round': va = a.round; vb = b.round; break;
      case 'gm': va = getGM(a) || 999999; vb = getGM(b) || 999999; break;
      case '3ag': va = get3AG(a) || 999999; vb = get3AG(b) || 999999; break;
      case 'comedk': va = a.comedkRank || 999999; vb = b.comedkRank || 999999; break;
      default: return 0;
    }
    if (typeof va === 'string') {
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return dir === 'asc' ? va - vb : vb - va;
  };

  results.sort(sortFn);
  if (type === 'kcet') renderKCET(results);
  else renderCOMEDK(results);
}

document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');

  try {
    const resp = await fetch('kcet_cs_data.json');
    DATA = await resp.json();
    loading.hidden = true;
    populateFilters();
    setupSorting();

    document.getElementById('search-btn').addEventListener('click', doSearch);

    document.querySelectorAll('.filters input').forEach(input => {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    });

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
  } catch (err) {
    loading.textContent = 'Failed to load data. Make sure kcet_cs_data.json is served from the same origin.';
    console.error(err);
  }
});
