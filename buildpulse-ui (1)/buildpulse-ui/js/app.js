// BuildPulse clickable prototype – plain JS, hash routing, no build step.
const $ = (s) => document.querySelector(s);
const API = 'http://localhost:8000/api/v1';   // FastAPI backend (backend/main.py)
const state = {
  user: null,
  weights: STAGES.map((s) => s.w),
  draft: null,
  queue: QUEUE.map((q) => ({ ...q })),
  users: USERS.map((u) => ({ ...u })),
  table: false,
  setup: 1,
  up: { step: 'form', floor: 3, files: [], pct: [] },
};
const STATUS = {
  ok: ['✔', 'On Track', 'ok'],
  risk: ['⚠', 'At Risk', 'risk'],
  late: ['✖', 'Delayed', 'late'],
  none: ['–', 'No data', 'none'],
};
const badge = (k) => `<span class="badge ${STATUS[k][2]}"><span aria-hidden="true">${STATUS[k][0]}</span> ${STATUS[k][1]}</span>`;
const prog = (arr) => arr.reduce((t, c, i) => t + (c * state.weights[i]) / 100, 0);
const f1 = (x) => x.toFixed(1);

function info(f) {
  const plan = prog(f.p);
  if (!f.a) return { ...f, prog: null, plan, v: null, st: 'none' };
  const p = prog(f.a), v = p - plan;
  return { ...f, prog: p, plan, v, st: v >= -5 ? 'ok' : v >= -10 ? 'risk' : 'late' };
}
const floors = () => FLOORS.map(info);
function building() {
  const d = floors().filter((f) => f.prog !== null);
  const avg = (k) => d.reduce((t, f) => t + f[k], 0) / d.length;
  return { prog: avg('prog'), plan: avg('plan'), n: d.length };
}
const alerts = () => floors().filter((f) => f.st === 'risk' || f.st === 'late');
function stageImpact(f) {
  return STAGES.map((s, i) => ({ name: s.name, w: state.weights[i], p: f.p[i], a: f.a[i], impact: (state.weights[i] * (f.p[i] - f.a[i])) / 100 }))
    .sort((x, y) => y.impact - x.impact);
}
function toast(m) {
  const t = $('#toast'); t.textContent = m; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}
const photo = (l, src) => `<div class="ph">${src ? `<img src="${src}" alt="${l}">` : `Demo photo<br>${l}`}</div>`;
const bar = (v) => `<div class="bar" role="img" aria-label="${f1(v)} percent"><i style="width:${v}%"></i></div>`;

/* ---------- shell ---------- */
const NAV = [['dashboard', '▦', 'Dashboard'], ['upload', '⬆', 'Upload'], ['alerts', '🔔', 'Alerts'], ['review', '☑', 'Review'],
  ['weights', '⚖', 'Weights'], ['setup', '🛠', 'Setup'], ['projects', '🏗', 'Projects'], ['admin', '👥', 'Admin']];
function shell(html, active) {
  return `<div class="app"><aside><div class="brand">BuildPulse</div>
  <nav aria-label="Main">${NAV.map(([k, i, l]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}"><b aria-hidden="true">${i}</b>${l}${k === 'review' && state.queue.length ? ` (${state.queue.length})` : ''}</a>`).join('')}</nav>
  <div class="who">${state.user}<br><a href="#/login">Sign out</a></div>
  <div class="demo">Demo data – not a real site</div></aside><main>${html}</main></div>`;
}
const back = (h, l) => `<p><a href="${h}">← ${l}</a></p>`;

/* ---------- views ---------- */
const V = {};
V.login = () => `<div class="center"><h1 style="color:var(--pri);font-size:1.8rem">BuildPulse</h1>
  <p class="mut">Photo-based construction progress and delay alerts.</p>
  <div class="card"><label for="em">Email</label><input id="em" type="email" value="taha@buildpulse.demo" autocomplete="username">
  <label for="pw">Password</label><input id="pw" type="password" value="demo-password-123" autocomplete="current-password">
  <p><button class="btn full" data-act="signin">Sign in</button></p>
  <p class="mut" style="margin:0">Invitation only. <a href="#/login" data-act="reset">Forgot password?</a></p></div></div>`;

V.projects = () => `<h1>Projects</h1>${PROJECTS.map((p) => `<a class="card row" style="text-decoration:none;color:inherit" href="#/dashboard">
  <div><h3>${p.name}</h3><span class="mut">${p.loc} · ${p.floors} floors</span></div><span class="badge none">Demo</span></a>`).join('')}
  <a class="btn full" href="#/setup">+ New project</a>`;

V.setup = () => {
  const s = state.setup;
  const bodies = [`<label for="pn">Project name</label><input id="pn" value="Marina Heights Tower"><label for="pl">Location</label><input id="pl" value="Dubai Marina">
    <label for="pf">Number of floors (1–80)</label><input id="pf" type="number" min="1" max="80" value="12">`,
    `<p>Default stage weights (reviewed by civil advisor). Total must be 100%.</p>${STAGES.map((x, i) => `<div class="row"><span>${x.name}</span><b>${state.weights[i]}%</b></div>`).join('')}<p><a href="#/weights">Edit weights</a></p>`,
    `<p>Upload a schedule CSV (floor, stage, planned_start, planned_finish) or enter dates per floor.</p><div class="note">Dates are shown in Gulf Standard Time (UTC+4).</div>
    <label for="cs">Schedule CSV</label><input id="cs" type="file" accept=".csv"><p class="mut">Sample: 20 floors imported in under 10 seconds.</p>`];
  return `<h1>Project setup</h1><div class="steps" aria-label="Step ${s} of 3">${[1, 2, 3].map((i) => `<span class="${i <= s ? 'on' : ''}"></span>`).join('')}</div>
  <div class="card"><h2>Step ${s} of 3 – ${['Project details', 'Stage weights', 'Schedule'][s - 1]}</h2>${bodies[s - 1]}</div>
  <div class="row"><button class="btn sec" data-act="setback" ${s === 1 ? 'disabled' : ''}>Back</button><button class="btn" data-act="setnext">${s === 3 ? 'Create project' : 'Next'}</button></div>`;
};

V.upload = () => {
  const u = state.up, fl = info(FLOORS[u.floor - 1]);
  if (u.step === 'busy') return `<h1>Uploading…</h1>${u.files.map((f, i) => `<div class="card"><div class="row"><span>${f.name}</span><span>${Math.round(u.pct[i])}%</span></div>${bar(u.pct[i])}</div>`).join('')}`;
  if (u.step === 'error') return `<h1>Analysis failed</h1><div class="card"><p>✖ ${u.err}</p><button class="btn" data-act="upretry">Try again</button></div>`;
  if (u.step === 'ai') return `<h1>Analysing photos…</h1><div class="card"><p>Uploading and running the stage-detection model.</p>${bar(60)}</div>`;
  if (u.step === 'done') {
    const conf = (u.result ? u.result.stages : []).map((x) => x.confidence);
    const warn = u.result && u.result.warnings.length ? `<div class="note">⚠ ${u.result.warnings.join('; ')}</div>` : '';
    return `<h1>Result – Floor ${fl.n}</h1>${warn}<div class="card"><div class="row"><div><div class="mut">Floor progress</div><div class="big">${f1(fl.prog)}%</div></div>${badge(fl.st)}</div>
    ${bar(fl.prog)}<p class="mut">Planned ${f1(fl.plan)}% · variance ${f1(fl.v)} pts · based on visible work only</p></div>
    <div class="card"><h2>Detected stages</h2><div class="scroll"><table><tr><th>Stage</th><th>Done</th><th>Confidence</th></tr>${STAGES.map((s, i) => `<tr><td>${s.name}</td><td>${fl.a[i]}%</td><td>${conf[i]}${u.result.stages[i].needs_review ? ' ⚠ review' : ''}</td></tr>`).join('')}</table></div><p class="mut">Model: ${u.result.model_version}${u.result.pending_review ? ' · ' + u.result.pending_review + ' stage(s) sent to the review queue and excluded from progress' : ''}</p></div>
    <div class="row"><a class="btn sec" href="#/floor/${fl.n}">Floor detail</a>${fl.st !== 'ok' ? `<a class="btn" href="#/alerts/${fl.n}">Open alert – see why</a>` : `<a class="btn" href="#/dashboard">Dashboard</a>`}</div>`;
  }
  return `<h1>Upload floor photos</h1><div class="card"><label for="fl">Floor</label><select id="fl" data-act="pickfloor">${FLOORS.map((f) => `<option value="${f.n}" ${f.n === u.floor ? 'selected' : ''}>Floor ${f.n}</option>`).join('')}</select>
  <label for="dt">Capture date</label><input id="dt" type="date" value="2026-11-12" max="2026-11-12">
  <label for="ph">Photos (1–20, JPEG/PNG/HEIC, max 15 MB)</label><input id="ph" type="file" accept="image/*" capture="environment" multiple data-act="pickfiles">
  <div class="photos" style="margin-top:10px">${u.files.length ? u.files.map((f) => photo(f.name, f.url)).join('') : photo('No photos chosen yet')}</div>
  <label for="nt">Note (optional)</label><textarea id="nt" rows="2"></textarea>
  <p><button class="btn full" data-act="upload">Upload &amp; analyse</button></p></div>`;
};

V.review = () => `<h1>Review queue</h1><p class="mut">Results below 0.60 confidence are excluded from progress until confirmed.</p>
  ${state.queue.length ? state.queue.map((q, i) => `<div class="card">${photo(`Floor ${q.floor} · ${q.stage}`)}
  <div class="row" style="margin:10px 0"><div><h3>Floor ${q.floor} – ${q.stage}</h3><span class="mut">Suggested ${q.sug}%</span></div><span class="badge risk"><span aria-hidden="true">⚠</span> Confidence ${q.conf}</span></div>
  <label for="c${i}">Corrected completion (%)</label><input id="c${i}" type="number" min="0" max="100" value="${q.sug}">
  <div class="row" style="margin-top:10px"><button class="btn" data-act="rv" data-i="${i}" data-a="confirm">Confirm</button><button class="btn sec" data-act="rv" data-i="${i}" data-a="correct">Save correction</button><button class="btn bad" data-act="rv" data-i="${i}" data-a="reject">Reject</button></div></div>`).join('')
  : '<div class="card">✔ Nothing waiting for review.</div>'}`;

V.weights = () => {
  const d = state.draft || state.weights, t = d.reduce((a, b) => a + b, 0);
  return `<h1>Stage weights</h1><div class="note">Changing weights recalculates progress and delay alerts.</div>
  <div class="card">${STAGES.map((s, i) => `<label for="w${i}">${s.name} (%)</label><input id="w${i}" type="number" min="0" max="100" step="0.1" value="${d[i]}" data-act="w" data-i="${i}">`).join('')}
  <p><b id="tot" class="${t === 100 ? 'ok' : 'late'} badge">${t === 100 ? '✔' : '✖'} Total ${t}%</b> <span id="diff" class="mut">${t === 100 ? '' : `Off by ${f1(100 - t)}`}</span></p>
  <button id="sv" class="btn full" data-act="savew" ${t === 100 ? '' : 'disabled'}>Save weights</button></div>`;
};

function chart() {
  const b = building(), act = [...HISTORY.actual, b.prog], X = (i) => 28 + i * 40, Y = (v) => 130 - v * 1.1;
  const pts = (a) => a.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
  const svg = `<svg viewBox="0 0 320 160" width="100%" role="img" aria-label="Planned versus actual progress, week 1 to 8. Actual ${f1(b.prog)} percent, planned ${f1(HISTORY.planned[7])} percent.">
   ${[0, 50, 100].map((v) => `<line x1="28" x2="308" y1="${Y(v)}" y2="${Y(v)}" stroke="#dde2ea"/><text x="2" y="${Y(v) + 4}" font-size="10" fill="#5b6678">${v}%</text>`).join('')}
   ${WEEKS.map((w, i) => `<text x="${X(i) - 8}" y="150" font-size="10" fill="#5b6678">${w}</text>`).join('')}
   <polyline points="${pts(HISTORY.planned)}" fill="none" stroke="#5b6678" stroke-width="2" stroke-dasharray="5 4"/>
   <polyline points="${pts(act)}" fill="none" stroke="#1d4ed8" stroke-width="3"/></svg>
   <p class="mut" style="margin:0">— Actual (solid) &nbsp; - - Planned (dashed)</p>`;
  const tbl = `<div class="scroll"><table><tr><th>Week</th><th>Planned %</th><th>Actual %</th></tr>${act.map((v, i) => `<tr><td>${WEEKS[i]}</td><td>${HISTORY.planned[i]}</td><td>${f1(v)}</td></tr>`).join('')}</table></div>`;
  return state.table ? tbl : svg;
}

V.dashboard = () => {
  const b = building(), fs = floors(), al = alerts();
  return `<div class="row"><h1>Marina Heights Tower</h1><span class="badge none">Demo data</span></div>
  <p class="mut">Last updated: 12 Nov 2026, 09:40 GST · Progress covers visible work only</p>
  <div class="dash"><div>
  <div class="card"><div class="row"><div><div class="mut">Building progress</div><div class="big">${f1(b.prog)}%</div><span class="mut">Planned ${f1(b.plan)}% · ${f1(b.prog - b.plan)} pts</span></div>${badge(b.prog - b.plan >= -5 ? 'ok' : b.prog - b.plan >= -10 ? 'risk' : 'late')}</div>${bar(b.prog)}
   <h3 style="margin-top:14px">Forecast finish range</h3><div id="fc" class="mut">Loading forecast…</div></div>
  <div class="card"><div class="row"><h2>Planned vs actual</h2><button class="btn sec" data-act="tbl">${state.table ? 'Show chart' : 'Table view'}</button></div>${chart()}</div></div>
  <div><div class="card"><div class="row"><h2>Open alerts (${al.length})</h2><a href="#/alerts">View all</a></div>${al.map((f) => `<a href="#/alerts/${f.n}" class="row" style="text-decoration:none;color:inherit;min-height:44px;border-top:1px solid var(--line);padding:8px 0"><span>Floor ${f.n} · ${f1(f.v)} pts</span>${badge(f.st)}</a>`).join('')}</div>
  <a class="card row" style="text-decoration:none;color:inherit" href="#/review"><span>☑ Waiting for review</span><b>${state.queue.length}</b></a>
  <div class="card"><h2>Floors</h2><div class="floors">${fs.map((f) => `<a class="tile" href="#/floor/${f.n}"><b>F${f.n}</b><div class="mut">${f.prog === null ? '—' : f1(f.prog) + '%'}</div>${badge(f.st)}</a>`).join('')}</div></div></div></div>`;
};

V.alerts = (id) => {
  if (id) {
    const f = floors()[id - 1], im = stageImpact(f), top = im[0];
    return `${back('#/alerts', 'All alerts')}<h1>Why Floor ${f.n} is flagged</h1><div class="card"><div class="row">${badge(f.st)}<b>${f1(f.v)} pts vs plan</b></div>
    <p><b>Floor ${f.n} is ${f1(Math.abs(f.v))} percentage points behind schedule.</b> ${top.name} is ${top.a}% complete but the plan expects ${top.p}%.</p>
    <p class="mut">Actual ${f1(f.prog)}% · Planned ${f1(f.plan)}% · Evidence: 2 photos, confidence above 0.60</p></div>
    <div class="card"><h2>Stages ranked by impact on delay</h2><div class="scroll"><table><tr><th>Stage</th><th>Weight</th><th>Plan</th><th>Actual</th><th>Impact</th></tr>
    ${im.map((s) => `<tr><td>${s.name}</td><td>${s.w}%</td><td>${s.p}%</td><td>${s.a}%</td><td><b>${f1(s.impact)} pts</b></td></tr>`).join('')}</table></div>
    <p class="mut">Impact = weight × (planned − actual) ÷ 100</p></div>
    <div class="card"><h2>Supporting photos</h2><div class="photos">${photo('Floor ' + f.n + ' · 10 Nov')}${photo('Floor ' + f.n + ' · 12 Nov')}</div></div>
    <a class="btn full" href="#/floor/${f.n}">Open floor detail</a>`;
  }
  const al = alerts();
  return `<h1>Alerts</h1>${al.length ? al.map((f) => { const t = stageImpact(f)[0];
    return `<a class="card" style="display:block;text-decoration:none;color:inherit" href="#/alerts/${f.n}"><div class="row"><h3>Floor ${f.n}</h3>${badge(f.st)}</div>
    <p>${t.name} ${t.a}% done, plan expects ${t.p}%.</p><span class="mut">${f1(f.v)} pts · tap to see why</span></a>`; }).join('') : '<div class="card">✔ No open alerts.</div>'}`;
};

V.floor = (n) => {
  const f = info(FLOORS[n - 1]);
  if (!f.a) return `${back('#/dashboard', 'Dashboard')}<h1>Floor ${n}</h1><div class="card">${badge('none')}<p>No accepted photos yet. Upload a photo to start tracking.</p><a class="btn" href="#/upload">Upload photos</a></div>`;
  return `${back('#/dashboard', 'Dashboard')}<div class="row"><h1>Floor ${n}</h1>${badge(f.st)}</div><div class="two"><div class="card"><div class="big">${f1(f.prog)}%</div>${bar(f.prog)}
  <p class="mut">Planned ${f1(f.plan)}% · variance ${f1(f.v)} pts</p>${photo('Latest photo · 12 Nov')}</div>
  <div class="card"><h2>How this is calculated</h2><div class="scroll"><table><tr><th>Stage</th><th>Weight</th><th>Done</th><th>Adds</th></tr>
  ${STAGES.map((s, i) => `<tr><td>${s.name}</td><td>${state.weights[i]}%</td><td>${f.a[i]}%</td><td>${f1((f.a[i] * state.weights[i]) / 100)}</td></tr>`).join('')}
  <tr><td colspan="3"><b>Floor progress</b></td><td><b>${f1(f.prog)}</b></td></tr></table></div></div></div>
  ${f.st !== 'ok' ? `<a class="btn full" href="#/alerts/${n}">See the alert for this floor</a>` : ''}`;
};

V.admin = () => `<h1>User management</h1><div class="card"><div class="scroll"><table><tr><th>User</th><th>Role</th></tr>
  ${state.users.map((u, i) => `<tr><td>${u.name}<br><span class="mut">${u.email}</span></td><td><select aria-label="Role for ${u.name}" data-act="role" data-i="${i}">${['Administrator', 'Project Manager', 'Site Engineer', "Owner's Representative"].map((r) => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select></td></tr>`).join('')}</table></div></div>
  <div class="card"><h2>Invite a user</h2><label for="iv">Email</label><input id="iv" type="email" placeholder="name@company.com"><p><button class="btn full" data-act="invite">Send invitation</button></p></div>`;

/* ---------- router ---------- */
function render() {
  const [, pg = 'login', arg] = location.hash.slice(1).split('/');
  const page = V[pg] ? pg : 'login';
  if (!state.user && page !== 'login') return (location.hash = '#/login');
  if (page === 'weights' && !state.draft) state.draft = [...state.weights];
  const html = V[page](arg ? +arg || arg : undefined);
  $('#root').innerHTML = page === 'login' ? html : shell(html, page === 'floor' ? 'dashboard' : page);
  window.scrollTo(0, 0);
  if (page === 'dashboard') loadForecast();
}
window.addEventListener('hashchange', () => { state.draft = null; render(); });

/* ---------- actions ---------- */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]'); if (!t || t.tagName === 'INPUT' || t.tagName === 'SELECT') return;
  const a = t.dataset.act, i = +t.dataset.i;
  if (a === 'signin') { state.user = 'taha@buildpulse.demo'; location.hash = '#/projects'; }
  else if (a === 'reset') { e.preventDefault(); toast('Reset link sent (demo)'); }
  else if (a === 'setnext') { if (state.setup === 3) { state.setup = 1; toast('Project created'); location.hash = '#/dashboard'; } else { state.setup++; render(); } }
  else if (a === 'setback') { state.setup--; render(); }
  else if (a === 'tbl') { state.table = !state.table; render(); }
  else if (a === 'upload') startUpload();
  else if (a === 'upretry') { state.up.step = 'form'; render(); }
  else if (a === 'rv') {
    const q = state.queue[i], word = { confirm: 'confirmed', correct: 'corrected', reject: 'rejected' }[t.dataset.a];
    if (t.dataset.a === 'reject' && !confirm('Reject this result? It will not count toward progress.')) return;
    state.queue.splice(i, 1); toast(`Floor ${q.floor} ${q.stage} ${word}`); render();
  }
  else if (a === 'savew') { state.weights = [...state.draft]; toast('Weights saved – progress recalculated'); location.hash = '#/dashboard'; }
  else if (a === 'invite') { const v = $('#iv').value.trim(); if (!v.includes('@')) return toast('Enter a valid email'); state.users.push({ name: v.split('@')[0], email: v, role: 'Site Engineer' }); toast('Invitation sent'); render(); }
});
document.addEventListener('change', (e) => {
  const t = e.target, a = t.dataset.act, u = state.up;
  if (a === 'pickfloor') u.floor = +t.value;
  if (a === 'pickfiles') { u.files = [...t.files].slice(0, 20).map((f) => ({ name: f.name, url: URL.createObjectURL(f), file: f })); render(); }
  if (a === 'role') { if (confirm(`Change role to ${t.value}?`)) { state.users[+t.dataset.i].role = t.value; toast('Role updated'); } else render(); }
});
document.addEventListener('input', (e) => {
  if (e.target.dataset.act !== 'w') return;
  state.draft[+e.target.dataset.i] = +e.target.value || 0;
  const t = Math.round(state.draft.reduce((a, b) => a + b, 0) * 10) / 10, ok = t === 100;
  $('#tot').className = `badge ${ok ? 'ok' : 'late'}`; $('#tot').textContent = `${ok ? '✔' : '✖'} Total ${t}%`;
  $('#diff').textContent = ok ? '' : `Off by ${f1(100 - t)}`; $('#sv').disabled = !ok;
});
async function startUpload() {
  const u = state.up;
  if (!u.files.length) return toast('Choose at least one photo');
  u.step = 'ai'; render();
  const fd = new FormData();
  u.files.forEach((f) => fd.append('files', f.file));
  fd.append('weights', JSON.stringify(state.weights));
  fd.append('stages', JSON.stringify(STAGES.map((x) => x.name.toLowerCase())));
  try {
    const r = await fetch(API + '/analyse', { method: 'POST', body: fd });
    const j = await r.json();
    if (!r.ok) throw new Error(typeof j.detail === 'string' ? j.detail : 'Analysis failed');
    u.result = j;
    const fl = FLOORS[u.floor - 1];
    fl.a = j.stages.map((x) => (x.needs_review ? 0 : x.completion));            // unreviewed low-confidence stages excluded (REQ-1.5)
    j.stages.forEach((x, i) => { if (x.needs_review) state.queue.push({ floor: u.floor, stage: STAGES[i].name, sug: Math.round(x.completion), conf: x.confidence }); });
    u.step = 'done'; render(); toast('Analysis complete');
  } catch (e) {
    u.err = e instanceof TypeError ? 'Cannot reach the backend. Start it with: cd backend && uvicorn main:app --port 8000' : e.message;
    u.step = 'error'; render();
  }
}
async function loadForecast() {                       // real XGBoost forecast from the API
  const el = $('#fc'); if (!el) return;
  const b = building(), act = [...HISTORY.actual, b.prog], START = '2026-09-24';
  try {
    const r = await fetch(API + '/forecast', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: act.map((p, i) => ({ day: i * 7, progress: p })), plan_days: 88, start_date: START }) });
    const j = await r.json(); if (!r.ok) throw 0;
    const el2 = $('#fc'); if (!el2) return;
    const d0 = new Date(START), pos = (iso) => Math.max(0, Math.min(100, ((new Date(iso) - d0) / 864e5 - 60) / 70 * 100));
    const fmt = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const lo = pos(j.earliest), hi = pos(j.latest), rep = j.model_report;
    el2.innerHTML = `<div class="track" role="img" aria-label="Planned finish ${fmt(j.planned_finish)}. Forecast ${fmt(j.earliest)} to ${fmt(j.latest)}."><div class="rng" style="left:${lo}%;width:${Math.max(hi - lo, 2)}%"></div><div class="pl" style="left:${pos(j.planned_finish)}%"></div></div>
    <div class="row mut"><span>Planned: ${fmt(j.planned_finish)}</span><b style="color:var(--ink)">${fmt(j.earliest)} – ${fmt(j.latest)} (${j.range_days} days)</b></div>
    <p class="mut" style="margin:6px 0 0">Expected ${fmt(j.expected)} · ${j.method === 'xgboost' ? 'XGBoost P10–P90' : 'baseline'}${j.low_confidence ? ' · <b>Low confidence</b>' : ''}${rep ? ` · median error ${rep.median_abs_error_days_xgboost} d vs ${rep.median_abs_error_days_baseline} d baseline (simulated test set)` : ''}</p>`;
  } catch (e) { const x = $('#fc'); if (x) x.innerHTML = '✖ Forecast unavailable. Start the backend (see README).'; }
}
const origHash = () => { if (state.up.step === 'done' && !location.hash.startsWith('#/upload')) state.up = { step: 'form', floor: 3, files: [], pct: [] }; };
window.addEventListener('hashchange', origHash);
render();
