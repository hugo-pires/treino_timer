'use strict';

const PRESETS_KEY = 'treino-timer-presets-v2';
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

// ---------- Exercise list (current draft) ----------

let exercises = []; // [{name, mode: 'time'|'reps', seconds?, reps?}]
let addMode = 'time';

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
  const container = el('exercise-list');
  container.innerHTML = '';
  if (exercises.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'exercise-empty';
    empty.textContent = 'Ainda sem exercícios — adiciona abaixo.';
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
  exercises.push(
    addMode === 'reps' ? { name, mode: 'reps', reps: value } : { name, mode: 'time', seconds: value }
  );
  nameInput.value = '';
  valueInput.value = addMode === 'reps' ? '12' : '30';
  nameInput.focus();
  renderExerciseList();
});

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

function renderPresets() {
  const container = el('presets');
  container.innerHTML = '';
  const presets = loadPresets();
  for (const p of presets) {
    const chip = document.createElement('span');
    chip.className = 'preset-chip';
    chip.textContent = `${p.name} (${p.exercises.length} ex.)`;
    chip.addEventListener('click', () => applyPreset(p));

    const del = document.createElement('span');
    del.className = 'del';
    del.textContent = '✕';
    del.addEventListener('click', (ev) => {
      ev.stopPropagation();
      savePresets(loadPresets().filter((x) => x.name !== p.name));
      renderPresets();
    });
    chip.appendChild(del);
    container.appendChild(chip);
  }
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
    el('ex-name').focus();
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
});

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
  cueDone();
  showScreen('done');
}

function startWorkout() {
  if (exercises.length === 0) {
    el('ex-name').focus();
    return;
  }
  const cfg = {
    prepare: Number(el('prepare').value) || 0,
    rest: Number(el('rest').value) || 0,
    rounds: Number(el('rounds').value) || 1,
    exercises,
  };
  plan = buildPlan(cfg);
  planIndex = 0;
  remaining = plan[0].mode === 'reps' ? 0 : plan[0].duration;
  paused = false;
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
