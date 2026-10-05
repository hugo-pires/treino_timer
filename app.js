'use strict';

const PRESETS_KEY = 'treino-timer-presets-v2';
const HISTORY_KEY = 'treino-timer-history-v1';
const HISTORY_MAX_ENTRIES = 200;
const CATALOG_KEY = 'treino-timer-exercise-catalog-v1';
const RING_CIRCUMFERENCE = 2 * Math.PI * 108; // r=108, matches SVG in index.html

const el = (id) => document.getElementById(id);

const screens = {
  setup: el('screen-setup'),
  run: el('screen-run'),
  done: el('screen-done'),
};

function showScreen(name) {
  for (const s of Object.values(screens)) s.classList.remove('active');
  screens[name].classList.add('active');
}

// ---------- Tabs ----------

const TAB_KEY = 'treino-timer-tab-v1';
const LAST_PLAN_KEY = 'treino-timer-last-plan-v1';
const TABS = ['treino', 'plano', 'catalogo', 'historico'];

function showTab(name) {
  if (!TABS.includes(name)) name = 'treino';
  for (const t of TABS) {
    el(`tab-${t}`).classList.toggle('active', t === name);
  }
  for (const b of el('tabbar').querySelectorAll('.tab-btn')) {
    b.classList.toggle('active', b.dataset.tab === name);
  }
  el('tab-' + name).scrollTop = 0;
  el('tab-' + name).parentElement.scrollTop = 0;
  try { localStorage.setItem(TAB_KEY, name); } catch { /* storage unavailable */ }
}

el('tabbar').addEventListener('click', (ev) => {
  const btn = ev.target.closest('.tab-btn');
  if (btn) showTab(btn.dataset.tab);
});

let toastTimer = null;

function toast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 1600);
}

// ---------- Exercise list (current draft) ----------

let exercises = []; // [{name, mode: 'time'|'reps', seconds?, reps?}]
let addMode = 'time';
let editingCatalog = null; // catalog entry name being edited via the add-exercise form (Catálogo tab)

const modeToggle = el('mode-toggle');
modeToggle.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.mode-btn');
  if (!btn) return;
  addMode = btn.dataset.mode;
  for (const b of modeToggle.querySelectorAll('.mode-btn')) {
    b.classList.toggle('active', b === btn);
  }
  const valueInput = el('ex-value');
  const valueLabel = el('ex-value-label');
  if (addMode === 'reps') {
    valueLabel.textContent = 'Repetições';
    valueInput.value = '12';
    valueInput.max = '999';
  } else {
    valueLabel.textContent = 'Segundos';
    valueInput.value = '30';
    valueInput.max = '3600';
  }
});

function exerciseValueText(ex) {
  return ex.mode === 'reps' ? `× ${ex.reps}` : `${ex.seconds}s`;
}

function renderExerciseList() {
  renderDraftCard();
  const container = el('exercise-list');
  container.innerHTML = '';
  if (exercises.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'exercise-empty';
    empty.textContent = 'Ainda sem exercícios — escolhe do catálogo abaixo.';
    container.appendChild(empty);
    return;
  }
  exercises.forEach((ex, i) => {
    const row = document.createElement('div');
    row.className = ex.mode === 'reps' ? 'exercise-row reps-row' : 'exercise-row';

    const order = document.createElement('span');
    order.className = 'order';
    order.textContent = `${i + 1}.`;

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = ex.name;

    const value = document.createElement('span');
    value.className = 'value';
    value.textContent = exerciseValueText(ex);

    const up = document.createElement('span');
    up.className = 'move';
    up.textContent = '↑';
    up.addEventListener('click', () => {
      if (i === 0) return;
      [exercises[i - 1], exercises[i]] = [exercises[i], exercises[i - 1]];
      renderExerciseList();
    });

    const down = document.createElement('span');
    down.className = 'move';
    down.textContent = '↓';
    down.addEventListener('click', () => {
      if (i === exercises.length - 1) return;
      [exercises[i + 1], exercises[i]] = [exercises[i], exercises[i + 1]];
      renderExerciseList();
    });

    const del = document.createElement('span');
    del.className = 'del';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      exercises.splice(i, 1);
      renderExerciseList();
    });

    row.append(order, name, value, up, down, del);
    container.appendChild(row);
  });
}

el('add-exercise-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const nameInput = el('ex-name');
  const valueInput = el('ex-value');
  const name = nameInput.value.trim();
  const value = Number(valueInput.value);
  if (!name || !value || value <= 0) {
    nameInput.focus();
    return;
  }
  const newEx = addMode === 'reps' ? { name, mode: 'reps', reps: value } : { name, mode: 'time', seconds: value };
  if (editingCatalog) {
    // Came from "editar": rename/replace the original entry.
    saveCatalog(loadCatalog().filter((e) => e.name !== editingCatalog));
    editingCatalog = null;
    toast('Catálogo actualizado');
  } else {
    toast(`${name} guardado no catálogo`);
  }
  upsertCatalogEntry({ ...newEx });
  nameInput.value = '';
  valueInput.value = addMode === 'reps' ? '12' : '30';
  nameInput.focus();
});

el('pick-exercise-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const entry = loadCatalog().find((e) => e.name === el('plan-pick').value);
  if (!entry) {
    showTab('catalogo');
    el('ex-name').focus();
    return;
  }
  exercises.push({ ...entry });
  renderExerciseList();
});

// ---------- Exercise catalog (reusable exercise definitions) ----------

function loadCatalog() {
  try {
    return JSON.parse(localStorage.getItem(CATALOG_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCatalog(catalog) {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
}

function upsertCatalogEntry(entry) {
  const catalog = loadCatalog();
  const i = catalog.findIndex((e) => e.name === entry.name);
  if (i >= 0) catalog[i] = entry; else catalog.push(entry);
  saveCatalog(catalog);
  renderCatalog();
}

function renderPlanPicker(catalog) {
  const pick = el('plan-pick');
  const previous = pick.value;
  pick.innerHTML = '';
  if (catalog.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Catálogo vazio — cria exercícios no Catálogo';
    pick.appendChild(opt);
    return;
  }
  for (const entry of catalog) {
    const opt = document.createElement('option');
    opt.value = entry.name;
    opt.textContent = `${entry.name} (${exerciseValueText(entry)})`;
    pick.appendChild(opt);
  }
  if (catalog.some((e) => e.name === previous)) pick.value = previous;
}

function renderCatalog() {
  const container = el('catalog');
  container.innerHTML = '';
  const catalog = loadCatalog().slice().sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  renderPlanPicker(catalog);

  if (catalog.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'exercise-empty';
    empty.textContent = 'Ainda sem exercícios guardados — cria um abaixo.';
    container.appendChild(empty);
    return;
  }

  for (const entry of catalog) {
    const row = document.createElement('div');
    row.className = entry.mode === 'reps' ? 'exercise-row reps-row' : 'exercise-row';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = entry.name;

    const value = document.createElement('span');
    value.className = 'value';
    value.textContent = exerciseValueText(entry);

    const add = document.createElement('span');
    add.className = 'act';
    add.textContent = '+ plano';
    add.addEventListener('click', () => {
      exercises.push({ ...entry });
      renderExerciseList();
      toast(`${entry.name} adicionado ao plano`);
    });

    const edit = document.createElement('span');
    edit.className = 'act';
    edit.textContent = 'editar';
    edit.addEventListener('click', () => editCatalogEntry(entry));

    const del = document.createElement('span');
    del.className = 'del';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      saveCatalog(loadCatalog().filter((e) => e.name !== entry.name));
      renderCatalog();
    });

    row.append(name, value, add, edit, del);
    container.appendChild(row);
  }
}

// Loads a catalog entry into the add-exercise form; submitting it upserts by name.
function editCatalogEntry(entry) {
  editingCatalog = entry.name;
  const btn = modeToggle.querySelector(`[data-mode="${entry.mode}"]`);
  btn.click();
  el('ex-name').value = entry.name;
  el('ex-value').value = entry.mode === 'reps' ? entry.reps : entry.seconds;
  showTab('catalogo');
  el('ex-name').focus();
}

// ---------- Presets (saved plans) ----------

function loadPresets() {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY)) || [];
  } catch {
    return [];
  }
}

function savePresets(presets) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function lastPlanName() {
  try { return localStorage.getItem(LAST_PLAN_KEY); } catch { return null; }
}

function planMetaText(p) {
  const rounds = p.rounds > 1 ? ` · ${p.rounds} séries` : '';
  return `${p.exercises.length} ex.${rounds}`;
}

function buildPlanCard({ title, meta, highlight, onStart, onEdit, onDelete }) {
  const card = document.createElement('div');
  card.className = highlight ? 'plan-card last' : 'plan-card';

  const info = document.createElement('div');
  info.className = 'info';
  const t = document.createElement('div');
  t.className = 'title';
  t.textContent = title;
  const m = document.createElement('div');
  m.className = 'meta';
  m.textContent = meta;
  info.append(t, m);

  const start = document.createElement('button');
  start.type = 'button';
  start.className = 'primary';
  start.textContent = 'Começar';
  start.addEventListener('click', onStart);

  card.append(info, start);

  if (onEdit) {
    const edit = document.createElement('span');
    edit.className = 'act';
    edit.textContent = 'editar';
    edit.addEventListener('click', onEdit);
    card.appendChild(edit);
  }
  if (onDelete) {
    const del = document.createElement('span');
    del.className = 'del';
    del.textContent = '✕';
    del.addEventListener('click', onDelete);
    card.appendChild(del);
  }
  return card;
}

function renderPresets() {
  const container = el('presets');
  container.innerHTML = '';
  const presets = loadPresets();
  if (presets.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'exercise-empty';
    empty.textContent = 'Ainda sem planos guardados — cria um no separador Plano.';
    container.appendChild(empty);
    return;
  }
  const last = lastPlanName();
  // Most recently used plan first.
  presets.sort((a, b) => (b.name === last) - (a.name === last));
  for (const p of presets) {
    container.appendChild(buildPlanCard({
      title: p.name,
      meta: planMetaText(p) + (p.name === last ? ' · último usado' : ''),
      highlight: p.name === last,
      onStart: () => {
        applyPreset(p);
        startWorkout();
      },
      onEdit: () => {
        applyPreset(p);
        showTab('plano');
      },
      onDelete: () => {
        savePresets(loadPresets().filter((x) => x.name !== p.name));
        renderPresets();
      },
    }));
  }
}

// Card for the unsaved plan currently being built in the Plano tab.
function renderDraftCard() {
  const container = el('draft-card');
  container.innerHTML = '';
  const name = el('preset-name').value.trim();
  const saved = loadPresets().find((p) => p.name === name);
  const unchanged = saved && JSON.stringify(saved.exercises) === JSON.stringify(exercises);
  el('draft-label').hidden = exercises.length === 0 || unchanged;
  if (exercises.length === 0 || unchanged) return;
  container.appendChild(buildPlanCard({
    title: el('preset-name').value.trim() || 'Plano actual',
    meta: `${exercises.length} ex. · não guardado`,
    onStart: startWorkout,
    onEdit: () => showTab('plano'),
  }));
}

function applyPreset(p) {
  el('prepare').value = p.prepare;
  el('rest').value = p.rest;
  el('rounds').value = p.rounds;
  el('preset-name').value = p.name;
  exercises = p.exercises.map((e) => ({ ...e }));
  renderExerciseList();
}

el('btn-save-preset').addEventListener('click', () => {
  const name = el('preset-name').value.trim();
  if (!name) {
    el('preset-name').focus();
    return;
  }
  if (exercises.length === 0) {
    el('plan-pick').focus();
    return;
  }
  const preset = {
    name,
    prepare: Number(el('prepare').value),
    rest: Number(el('rest').value),
    rounds: Number(el('rounds').value),
    exercises: exercises.map((e) => ({ ...e })),
  };
  const presets = loadPresets().filter((p) => p.name !== name);
  presets.push(preset);
  savePresets(presets);
  renderPresets();
  renderDraftCard();
  toast('Plano guardado');
});

// ---------- History (completed workouts) ----------

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function formatHistoryDate(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

function exerciseDetailText(ex) {
  return ex.mode === 'reps' ? `${ex.name} — × ${ex.reps}` : `${ex.name} — ${ex.seconds}s`;
}

function startOfWeek(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d;
}

function renderHistoryStats(history) {
  const weekStart = startOfWeek(new Date());
  const thisWeek = history.filter((h) => new Date(h.date) >= weekStart).length;
  const totalMinutes = Math.round(history.reduce((sum, h) => sum + h.durationSeconds, 0) / 60);
  const stats = [
    [thisWeek, 'esta semana'],
    [history.length, 'treinos'],
    [`${totalMinutes}'`, 'tempo total'],
  ];
  const container = el('history-stats');
  container.innerHTML = '';
  for (const [num, lbl] of stats) {
    const box = document.createElement('div');
    box.className = 'stat';
    const n = document.createElement('div');
    n.className = 'num';
    n.textContent = num;
    const l = document.createElement('div');
    l.className = 'lbl';
    l.textContent = lbl;
    box.append(n, l);
    container.appendChild(box);
  }
}

function renderHistory() {
  const container = el('history-list');
  container.innerHTML = '';
  const history = loadHistory();
  renderHistoryStats(history);

  if (history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'Ainda sem treinos registados.';
    container.appendChild(empty);
    return;
  }

  history.forEach((entry, i) => {
    const item = document.createElement('div');
    item.className = 'history-entry';

    const summary = document.createElement('div');
    summary.className = 'history-summary';

    const date = document.createElement('span');
    date.className = 'history-date';
    date.textContent = formatHistoryDate(entry.date);

    const name = document.createElement('span');
    name.className = 'history-name';
    name.textContent = entry.planName || 'Treino livre';

    const meta = document.createElement('span');
    meta.className = 'history-meta';
    meta.textContent = `${entry.exercises.length} ex. · ${formatTime(entry.durationSeconds)}`;

    const del = document.createElement('span');
    del.className = 'del';
    del.textContent = '✕';
    del.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const h = loadHistory();
      h.splice(i, 1);
      saveHistory(h);
      renderHistory();
    });

    summary.append(date, name, meta, del);

    const details = document.createElement('div');
    details.className = 'history-details';
    details.hidden = true;
    entry.exercises.forEach((ex) => {
      const line = document.createElement('div');
      line.textContent = exerciseDetailText(ex);
      details.appendChild(line);
    });

    summary.addEventListener('click', () => {
      details.hidden = !details.hidden;
    });

    item.append(summary, details);
    container.appendChild(item);
  });

  const actions = document.createElement('div');
  actions.className = 'history-actions';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'secondary';
  clearBtn.textContent = 'Limpar histórico';
  clearBtn.addEventListener('click', () => {
    saveHistory([]);
    renderHistory();
  });
  actions.appendChild(clearBtn);
  container.appendChild(actions);
}

function recordHistory() {
  if (!currentCfg) return;
  const entry = {
    date: new Date().toISOString(),
    planName: el('preset-name').value.trim() || null,
    durationSeconds: Math.max(0, Math.round((Date.now() - workoutStartTime) / 1000)),
    rounds: currentCfg.rounds,
    exercises: currentCfg.exercises.map((e) => ({ ...e })),
  };
  const history = loadHistory();
  history.unshift(entry);
  if (history.length > HISTORY_MAX_ENTRIES) history.length = HISTORY_MAX_ENTRIES;
  saveHistory(history);
  renderHistory();
}

// ---------- Audio / vibration ----------

let audioCtx = null;

function beep(freq, durationMs) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0.25;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + durationMs / 1000);
    osc.stop(audioCtx.currentTime + durationMs / 1000);
  } catch {
    /* audio unavailable, ignore */
  }
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function cueTick() {
  beep(880, 100);
}

function cuePhaseChange(isWork) {
  beep(isWork ? 1200 : 600, 250);
  vibrate(isWork ? [80] : [40, 60, 40]);
}

function cueDone() {
  beep(1500, 200);
  setTimeout(() => beep(1500, 200), 250);
  setTimeout(() => beep(1500, 350), 500);
  vibrate([100, 80, 100, 80, 200]);
}

// ---------- Wake lock ----------

let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch {
    /* not available / denied, ignore */
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && screens.run.classList.contains('active')) {
    requestWakeLock();
  }
});

// ---------- Timer state machine ----------

let plan = [];       // list of {phase: 'prepare'|'work'|'rest', duration, label, round, totalRounds}
let planIndex = 0;
let remaining = 0;   // seconds left in current step
let ticking = null;  // interval handle
let paused = false;
let currentCfg = null;    // cfg used to build the running plan, kept for history logging
let workoutStartTime = 0; // Date.now() when the workout started, for actual elapsed duration

function buildPlan(cfg) {
  const steps = [];
  if (cfg.prepare > 0) {
    steps.push({ phase: 'prepare', mode: 'time', duration: cfg.prepare, label: 'Preparar', round: 0, totalRounds: cfg.rounds });
  }
  for (let r = 1; r <= cfg.rounds; r++) {
    cfg.exercises.forEach((ex, i) => {
      if (ex.mode === 'reps') {
        steps.push({ phase: 'work', mode: 'reps', reps: ex.reps, label: ex.name, round: r, totalRounds: cfg.rounds });
      } else {
        steps.push({ phase: 'work', mode: 'time', duration: ex.seconds, label: ex.name, round: r, totalRounds: cfg.rounds });
      }
      const isLastExerciseOfLastRound = r === cfg.rounds && i === cfg.exercises.length - 1;
      if (cfg.rest > 0 && !isLastExerciseOfLastRound) {
        steps.push({ phase: 'rest', mode: 'time', duration: cfg.rest, label: 'Descanso', round: r, totalRounds: cfg.rounds });
      }
    });
  }
  return steps;
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function phaseText(step) {
  if (step.phase === 'prepare') return 'PREPARAR';
  if (step.phase === 'rest') return 'DESCANSO';
  return step.label.toUpperCase();
}

function applyPhaseClass(phase) {
  screens.run.classList.remove('phase-prepare', 'phase-work', 'phase-rest');
  screens.run.classList.add(`phase-${phase}`);
}

function setRingProgress(fraction) {
  const ring = el('ring-progress');
  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  ring.style.strokeDashoffset = String(offset);
}

function renderStep() {
  const step = plan[planIndex];
  const isReps = step.mode === 'reps';

  el('phase-label').textContent = phaseText(step);
  applyPhaseClass(step.phase);
  el('round-label').textContent = step.phase === 'prepare'
    ? 'Prepara-te...'
    : `Série ${step.round} / ${step.totalRounds}`;

  el('ring-wrap').classList.toggle('manual', isReps);
  el('time-display').hidden = isReps;
  el('reps-count').hidden = !isReps;
  el('reps-hint').hidden = !isReps;
  el('run-actions-time').hidden = isReps;
  el('run-actions-reps').hidden = !isReps;

  if (isReps) {
    el('reps-count').textContent = `× ${step.reps}`;
    setRingProgress(1);
  } else {
    el('time-display').textContent = formatTime(remaining);
    setRingProgress(remaining / step.duration);
  }
}

function startTicking() {
  clearInterval(ticking);
  ticking = setInterval(() => {
    if (paused) return;
    const step = plan[planIndex];
    if (step.mode === 'reps') return; // manual step, advanced only via "Concluído"
    remaining -= 1;
    if (remaining <= 3 && remaining > 0) cueTick();
    if (remaining <= 0) {
      advanceStep();
      return;
    }
    el('time-display').textContent = formatTime(remaining);
    setRingProgress(remaining / step.duration);
  }, 1000);
}

function advanceStep() {
  planIndex += 1;
  if (planIndex >= plan.length) {
    finishWorkout();
    return;
  }
  const step = plan[planIndex];
  remaining = step.mode === 'reps' ? 0 : step.duration;
  cuePhaseChange(step.phase === 'work');
  renderStep();
}

function finishWorkout() {
  clearInterval(ticking);
  releaseWakeLock();
  recordHistory();
  cueDone();
  showScreen('done');
}

function startWorkout() {
  if (exercises.length === 0) {
    showTab('plano');
    el('plan-pick').focus();
    return;
  }
  const cfg = {
    prepare: Number(el('prepare').value) || 0,
    rest: Number(el('rest').value) || 0,
    rounds: Number(el('rounds').value) || 1,
    exercises,
  };
  const planName = el('preset-name').value.trim();
  if (planName && loadPresets().some((p) => p.name === planName)) {
    try { localStorage.setItem(LAST_PLAN_KEY, planName); } catch { /* storage unavailable */ }
    renderPresets();
  }
  plan = buildPlan(cfg);
  planIndex = 0;
  remaining = plan[0].mode === 'reps' ? 0 : plan[0].duration;
  paused = false;
  currentCfg = cfg;
  workoutStartTime = Date.now();
  showPauseIcon();
  renderStep();
  showScreen('run');
  requestWakeLock();
  startTicking();
}

el('btn-start').addEventListener('click', startWorkout);

function showPauseIcon() {
  el('icon-pause').hidden = false;
  el('icon-play').hidden = true;
}

function showPlayIcon() {
  el('icon-pause').hidden = true;
  el('icon-play').hidden = false;
}

el('btn-pause').addEventListener('click', () => {
  paused = !paused;
  if (paused) showPlayIcon(); else showPauseIcon();
});

el('btn-skip').addEventListener('click', () => {
  advanceStep();
});

el('btn-stop').addEventListener('click', stopWorkout);
el('btn-stop-reps').addEventListener('click', stopWorkout);
el('btn-done').addEventListener('click', () => advanceStep());

function stopWorkout() {
  clearInterval(ticking);
  releaseWakeLock();
  showScreen('setup');
}

el('btn-again').addEventListener('click', () => {
  showScreen('setup');
});

// ---------- init ----------

renderExerciseList();
renderPresets();
renderHistory();
renderCatalog();
try { showTab(localStorage.getItem(TAB_KEY)); } catch { showTab('treino'); }

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
