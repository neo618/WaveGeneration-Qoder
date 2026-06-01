// ====== Multi-Channel Waveform CSV Generator ======

// ----- constants -----
const CHANNEL_COLORS = [
  '#00bcd4','#ff9100','#e040fb','#ffea00',
  '#ff5252','#69f0ae','#ff6e40','#40c4ff','#b388ff','#ffb74d'
];

const WAVE_TYPES = [
  { value: 'sine',     i18n: 'waveSine' },
  { value: 'square',   i18n: 'waveSquare' },
  { value: 'triangle', i18n: 'waveTriangle' },
  { value: 'random',   i18n: 'waveRandom' }
];

// Per-wave-type default configs (used by getDefaultChannelConfig)
const WAVE_DEFAULTS = {
  sine:     { amplitude: 10, frequency: 0.05, dcOffset: 0, initialPhase: 0 },
  square:   { amplitude: 1,  frequency: 0.05, dcOffset: 0, initialPhase: 0 },
  triangle: { amplitude: 1,  frequency: 0.05, dcOffset: 0, initialPhase: 0 },
  random:   { randomMin: -1, randomMax: 1 }
};

function getDefaultChannelConfig(index) {
  const type = index === 0 ? 'sine' : 'square';
  return { waveType: type, visible: true, ...WAVE_DEFAULTS[type] };
}

// ----- i18n -----
const i18n = {
  zh: {
    appTitle: '多通道波形CSV生成工具', systemReady: '系统就绪',
    globalParams: '全局参数配置', timeInterval: '时间间隔', dataLength: '数据长度',
    channelCount: '通道数', points: '个', channels: '路',
    channelConfig: '通道波形配置', presets: '参数预设管理',
    presetPlaceholder: '输入预设名称...', savePreset: '保存预设',
    selectPreset: '-- 选择预设 --', loadPreset: '加载预设', generate: '生 成',
    wavePreview: '波形预览', waveSine: '正弦波', waveSquare: '方波',
    waveTriangle: '三角波', waveRandom: '均匀随机数',
    amplitude: '幅值', frequency: '频率', dcOffset: '偏移', initialPhase: '相位',
    randomMin: '下限', randomMax: '上限',
    timeAxis: '时间(ms)', csvHeader: '时间(ms)',
    showHide_hide: '点击隐藏', showHide_show: '点击显示',
    legend_hide: '点击隐藏', legend_show: '点击显示',
    csvSaved: '已保存: ', csvFailed: '生成失败',
  },
  en: {
    appTitle: 'Multi-Channel Waveform CSV Generator', systemReady: 'SYSTEM READY',
    globalParams: 'Global Parameters', timeInterval: 'Time Interval', dataLength: 'Data Length',
    channelCount: 'Channels', points: 'pts', channels: 'ch',
    channelConfig: 'Channel Configuration', presets: 'Presets',
    presetPlaceholder: 'Preset name...', savePreset: 'Save',
    selectPreset: '-- Select Preset --', loadPreset: 'Load', generate: 'Generate',
    wavePreview: 'Waveform Preview', waveSine: 'Sine', waveSquare: 'Square',
    waveTriangle: 'Triangle', waveRandom: 'Uniform Random',
    amplitude: 'Amplitude', frequency: 'Frequency', dcOffset: 'Offset', initialPhase: 'Phase',
    randomMin: 'Min', randomMax: 'Max',
    timeAxis: 'Time(ms)', csvHeader: 'Time(ms)',
    showHide_hide: 'Hide', showHide_show: 'Show',
    legend_hide: 'Click to hide', legend_show: 'Click to show',
    csvSaved: 'Saved: ', csvFailed: 'Generate Failed',
  }
};

let lang = 'zh';
const t = (key) => i18n[lang]?.[key] || i18n.zh[key] || key;

function setLang(l) {
  lang = l;
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  const btn = document.getElementById('btnLang');
  if (btn) btn.textContent = l === 'zh' ? 'EN' : '中文';
  applyI18n();
  renderChannels();
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.title = t('appTitle');
}

// ----- state -----
let state = {
  globalParams: { timeInterval: 2, dataLength: 2048, channelCount: 2 },
  channels: [getDefaultChannelConfig(0), getDefaultChannelConfig(1)],
  zoom: { level: 1.0, offsetX: 0 }
};

// ----- DOM refs -----
const $ = (id) => document.getElementById(id);
const timeIntervalInput = $('timeInterval');
const dataLengthInput    = $('dataLength');
const channelCountInput  = $('channelCount');
const channelContainer   = $('channelContainer');
const canvas             = $('waveCanvas');
const ctx                = canvas.getContext('2d');
const legendContainer    = $('legendContainer');
const presetNameInput    = $('presetName');
const presetSelect       = $('presetSelect');
const btnSavePreset      = $('btnSavePreset');
const btnLoadPreset      = $('btnLoadPreset');
const btnGenerate        = $('btnGenerate');
const btnZoomIn          = $('btnZoomIn');
const btnZoomOut         = $('btnZoomOut');
const btnZoomReset       = $('btnZoomReset');

// ----- utilities -----
const parseFloatSafe = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
const parseIntSafe   = (v, d) => { const n = parseInt(v, 10); return isNaN(n) ? d : n; };
const clamp           = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

function filterNumericInput(e) {
  if (!/[0-9.\-]/.test(e.key) && e.key.length === 1 && !e.ctrlKey && !e.metaKey) e.preventDefault();
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
}

// normalize phase: wrap into [0, 1) putting initialPhase into a fractional cycle offset
function calcPhase(tMs, freqKHz, initialPhase) {
  return ((tMs * freqKHz) + initialPhase / (2 * Math.PI)) % 1;
}

// ----- wave generators (pure functions, no state) -----
function genSine(n, dt, amp, fKHz, dc, ph) {
  const d = new Float64Array(n);
  const w = 2 * Math.PI * fKHz;
  for (let i = 0; i < n; i++) d[i] = amp * Math.sin(w * i * dt + ph) + dc;
  return d;
}

function genSquare(n, dt, amp, fKHz, dc, ph) {
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) d[i] = (calcPhase(i * dt, fKHz, ph) < 0.5 ? 1 : -1) * amp + dc;
  return d;
}

function genTriangle(n, dt, amp, fKHz, dc, ph) {
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = calcPhase(i * dt, fKHz, ph);
    const val = p < 0.5 ? 1 - 4 * p : -1 + 4 * (p - 0.5);
    d[i] = val * amp + dc;
  }
  return d;
}

function genRandom(n, lo, hi) {
  const d = new Float64Array(n);
  const range = hi - lo;
  for (let i = 0; i < n; i++) d[i] = lo + Math.random() * range;
  return d;
}

function genChannel(ch, n, dt) {
  const a = parseFloatSafe(ch.amplitude,     WAVE_DEFAULTS[ch.waveType]?.amplitude ?? 1);
  const f = parseFloatSafe(ch.frequency,     WAVE_DEFAULTS[ch.waveType]?.frequency ?? 0.05);
  const d = parseFloatSafe(ch.dcOffset,      WAVE_DEFAULTS[ch.waveType]?.dcOffset ?? 0);
  const p = parseFloatSafe(ch.initialPhase,  WAVE_DEFAULTS[ch.waveType]?.initialPhase ?? 0);
  switch (ch.waveType) {
    case 'sine':     return genSine(n, dt, a, f, d, p);
    case 'square':   return genSquare(n, dt, a, f, d, p);
    case 'triangle': return genTriangle(n, dt, a, f, d, p);
    case 'random':   return genRandom(n, parseFloatSafe(ch.randomMin, -1), parseFloatSafe(ch.randomMax, 1));
    default:         return new Float64Array(n);
  }
}

// ----- channel visibility helper (DRY) -----
function setChannelVisibility(idx, visible) {
  state.channels[idx].visible = visible !== false;

  const cb = channelContainer.querySelector(`.channel-visibility[data-channel-index="${idx}"]`);
  if (cb) { cb.checked = visible !== false; cb.title = t(visible !== false ? 'showHide_hide' : 'showHide_show'); }

  const card = channelContainer.querySelector(`.channel-card[data-channel-index="${idx}"]`);
  if (card) card.className = 'channel-card' + (visible === false ? ' channel-hidden' : '');

  debouncedUpdatePreview();
}

// ----- channel UI rendering -----
function renderChannels() {
  const count = clamp(parseIntSafe(state.globalParams.channelCount, 2), 1, 10);
  state.globalParams.channelCount = count;

  while (state.channels.length < count) state.channels.push(getDefaultChannelConfig(state.channels.length));
  if (state.channels.length > count) state.channels.length = count;

  channelContainer.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const ch = state.channels[i];
    const card = document.createElement('div');
    card.className = 'channel-card' + (ch.visible === false ? ' channel-hidden' : '');
    card.dataset.channelIndex = i;

    // header row
    const header = document.createElement('div');
    header.className = 'channel-header';

    const vis = document.createElement('input');
    vis.type = 'checkbox'; vis.className = 'channel-visibility';
    vis.checked = ch.visible !== false;
    vis.title = t(ch.visible !== false ? 'showHide_hide' : 'showHide_show');
    vis.dataset.channelIndex = i;
    vis.addEventListener('change', () => setChannelVisibility(i, vis.checked));

    const lbl = document.createElement('span');
    lbl.className = 'channel-label'; lbl.textContent = `V${i + 1}`;

    const sel = document.createElement('select');
    sel.className = 'channel-select'; sel.dataset.channelIndex = i;
    WAVE_TYPES.forEach(wt => {
      const o = document.createElement('option');
      o.value = wt.value; o.textContent = t(wt.i18n);
      if (wt.value === ch.waveType) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.channelIndex);
      state.channels[idx].waveType = e.target.value;
      renderChannels();
    });

    header.append(vis, lbl, sel);
    card.appendChild(header);

    // params row
    const params = document.createElement('div');
    params.className = 'channel-params';

    if (ch.waveType === 'random') {
      params.innerHTML =
        `<div class="channel-param-item"><span class="channel-param-label">${t('randomMin')}</span><input type="text" class="channel-param-input" data-channel="${i}" data-param="randomMin" value="${ch.randomMin}"></div>` +
        `<div class="channel-param-item"><span class="channel-param-label">${t('randomMax')}</span><input type="text" class="channel-param-input" data-channel="${i}" data-param="randomMax" value="${ch.randomMax}"></div>`;
    } else {
      params.innerHTML =
        `<div class="channel-param-item"><span class="channel-param-label">${t('amplitude')}</span><input type="text" class="channel-param-input" data-channel="${i}" data-param="amplitude" value="${ch.amplitude}"></div>` +
        `<div class="channel-param-item"><span class="channel-param-label">${t('frequency')}</span><input type="text" class="channel-param-input" data-channel="${i}" data-param="frequency" value="${ch.frequency}"><span class="channel-param-unit">kHz</span></div>` +
        `<div class="channel-param-item"><span class="channel-param-label">${t('dcOffset')}</span><input type="text" class="channel-param-input" data-channel="${i}" data-param="dcOffset" value="${ch.dcOffset}"></div>` +
        `<div class="channel-param-item"><span class="channel-param-label">${t('initialPhase')}</span><input type="text" class="channel-param-input" data-channel="${i}" data-param="initialPhase" value="${ch.initialPhase}"><span class="channel-param-unit">rad</span></div>`;
    }

    card.appendChild(params);
    channelContainer.appendChild(card);
  }

  channelContainer.querySelectorAll('.channel-param-input').forEach(inp => {
    inp.addEventListener('input', e => {
      const idx = parseInt(e.target.dataset.channel);
      const param = e.target.dataset.param;
      state.channels[idx][param] = e.target.value;
      debouncedUpdatePreview();
    });
    inp.addEventListener('keydown', filterNumericInput);
  });

  debouncedUpdatePreview();
}

// ----- global param handler -----
function onGlobalParamInput() {
  state.globalParams.timeInterval = parseFloatSafe(timeIntervalInput.value, 2);
  state.globalParams.dataLength   = parseIntSafe(dataLengthInput.value, 2048);
  const newCount = clamp(parseIntSafe(channelCountInput.value, 2), 1, 10);
  channelCountInput.value = newCount;
  if (newCount !== state.globalParams.channelCount) {
    state.globalParams.channelCount = newCount;
    renderChannels();
  } else {
    debouncedUpdatePreview();
  }
}

// ----- zoom -----
function applyZoom(clampOffset) {
  if (state.zoom.level <= 1.0) { state.zoom.level = 1.0; state.zoom.offsetX = 0; }
  else if (clampOffset) { state.zoom.offsetX = clamp(state.zoom.offsetX, 0, 1 - 1 / state.zoom.level); }
  debouncedUpdatePreview();
}

function zoomIn()  { state.zoom.level = Math.min(state.zoom.level * 1.5, 50); applyZoom(false); }
function zoomOut() { state.zoom.level = Math.max(state.zoom.level / 1.5, 1); applyZoom(true); }
function zoomReset() { state.zoom.level = 1.0; state.zoom.offsetX = 0; debouncedUpdatePreview(); }

function onCanvasWheel(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = clamp((e.clientX - rect.left) / rect.width, 0, 1);
  const old = state.zoom.level;
  const dir = e.deltaY < 0 ? 1.2 : 1 / 1.2;
  state.zoom.level = old * dir;

  if (state.zoom.level > 1.01) {
    state.zoom.level = Math.min(state.zoom.level, 50);
    const ratio = state.zoom.level / old;
    state.zoom.offsetX = mx - (mx - state.zoom.offsetX) / ratio;
    state.zoom.offsetX = clamp(state.zoom.offsetX, 0, 1 - 1 / state.zoom.level);
  } else {
    state.zoom.level = 1.0; state.zoom.offsetX = 0;
  }
  debouncedUpdatePreview();
}

// ----- canvas -----
const debouncedUpdatePreview = debounce(updatePreview, 60);

function resizeCanvas() {
  const r = canvas.parentElement.getBoundingClientRect();
  const w = Math.floor(r.width), h = Math.floor(r.height);
  if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
    canvas.width = w; canvas.height = h;
    updatePreview();
  }
}

function updatePreview() {
  const numPoints   = parseIntSafe(state.globalParams.dataLength, 2048);
  const dt          = parseFloatSafe(state.globalParams.timeInterval, 2);
  const channelCnt  = parseIntSafe(state.globalParams.channelCount, 2);
  const w = canvas.width, h = canvas.height;
  if (!w || !h) return;

  // ---- layout ----
  const margin = { top: 28, right: 18, bottom: 38, left: 56 };
  const plotW = w - margin.left - margin.right;
  const plotH = h - margin.top - margin.bottom;
  if (plotW <= 0 || plotH <= 0) return;

  // ---- zoom range ----
  const zl = state.zoom.level;
  const totalPts = Math.min(numPoints, 2000);
  const visPts = Math.max(2, Math.round(totalPts / zl));
  const maxStart = totalPts - visPts;
  const start = clamp(Math.round(state.zoom.offsetX * maxStart), 0, maxStart);

  // ---- generate & find Y range ----
  let yMin = Infinity, yMax = -Infinity;
  const allData = [];
  for (let i = 0; i < channelCnt; i++) {
    const data = genChannel(state.channels[i], totalPts, dt);
    allData.push(data);
    if (state.channels[i].visible !== false) {
      for (let j = start, end = start + visPts; j < end && j < data.length; j++) {
        if (data[j] < yMin) yMin = data[j];
        if (data[j] > yMax) yMax = data[j];
      }
    }
  }
  if (yMin === Infinity) { yMin = -1; yMax = 1; }
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const pad = (yMax - yMin) * 0.08;
  yMin -= pad; yMax += pad;

  // ---- draw background + grid ----
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#1e2833'; ctx.lineWidth = 1;
  const gridX = 10, gridY = 8;
  ctx.beginPath();
  for (let i = 0; i <= gridX; i++) {
    const x = margin.left + (plotW / gridX) * i;
    ctx.moveTo(x, margin.top); ctx.lineTo(x, margin.top + plotH);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i <= gridY; i++) {
    const y = margin.top + (plotH / gridY) * i;
    ctx.moveTo(margin.left, y); ctx.lineTo(margin.left + plotW, y);
  }
  ctx.stroke();

  // border
  ctx.strokeStyle = '#3a4050';
  ctx.strokeRect(margin.left, margin.top, plotW, plotH);

  // ---- axis labels ----
  ctx.fillStyle = '#6a7080'; ctx.font = '10px Consolas, monospace';
  ctx.textAlign = 'center';

  const tStart = start * dt, tEnd = (start + visPts) * dt;
  for (let i = 0; i <= gridX; i++) {
    ctx.fillText(
      (tStart + (tEnd - tStart) * (i / gridX)).toFixed(0),
      margin.left + (plotW / gridX) * i,
      margin.top + plotH + 14
    );
  }
  ctx.fillText(t('timeAxis'), margin.left + plotW / 2, margin.top + plotH + 30);

  ctx.textAlign = 'right';
  for (let i = 0; i <= gridY; i++) {
    const y = margin.top + (plotH / gridY) * i;
    const val = yMax - (yMax - yMin) * (i / gridY);
    ctx.fillText(val.toFixed(1), margin.left - 6, y + 3);
  }

  // zoom badge (cyan instead of green)
  if (zl > 1.01) {
    ctx.fillStyle = 'rgba(0,188,212,0.75)'; ctx.font = 'bold 10px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('x' + zl.toFixed(1), margin.left + 4, margin.top + 13);
  }

  // ---- curves ----
  for (let ch = 0; ch < channelCnt; ch++) {
    if (state.channels[ch].visible === false) continue;
    const data = allData[ch];
    const color = CHANNEL_COLORS[ch % CHANNEL_COLORS.length];
    ctx.strokeStyle = color; ctx.lineWidth = 1.6;
    ctx.beginPath();

    for (let i = 0; i < visPts; i++) {
      const idx = start + i;
      if (idx >= data.length) break;
      const x = margin.left + (i / (visPts - 1)) * plotW;
      const y = margin.top + (1 - (data[idx] - yMin) / (yMax - yMin)) * plotH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  updateLegend(channelCnt);
}

// ----- legend (clickable) -----
function updateLegend(channelCnt) {
  legendContainer.innerHTML = '';
  for (let i = 0; i < channelCnt; i++) {
    const ch = state.channels[i];
    const item = document.createElement('div');
    item.className = 'legend-item' + (ch.visible === false ? ' legend-hidden' : '');
    item.title = t(ch.visible !== false ? 'legend_hide' : 'legend_show') + ' V' + (i + 1);

    const dot = document.createElement('div');
    dot.className = 'legend-dot';
    dot.style.backgroundColor = CHANNEL_COLORS[i % CHANNEL_COLORS.length];

    const txt = document.createElement('span');
    txt.textContent = 'V' + (i + 1);

    item.append(dot, txt);
    item.addEventListener('click', () => setChannelVisibility(i, state.channels[i].visible === false));
    legendContainer.appendChild(item);
  }
}

// ----- CSV generation -----
async function generateCSV() {
  const numPoints   = parseIntSafe(state.globalParams.dataLength, 2048);
  const dt          = parseFloatSafe(state.globalParams.timeInterval, 2);
  const channelCnt  = parseIntSafe(state.globalParams.channelCount, 2);

  let header = t('csvHeader');
  for (let i = 0; i < channelCnt; i++) header += ',V' + (i + 1);

  const allData = [];
  for (let i = 0; i < channelCnt; i++) allData.push(genChannel(state.channels[i], numPoints, dt));

  const lines = [header];
  for (let i = 0; i < numPoints; i++) {
    let line = (i * dt).toFixed(2);
    for (let ch = 0; ch < channelCnt; ch++) line += ',' + allData[ch][i].toFixed(2);
    lines.push(line);
  }

  const result = await window.waveAPI.generateCSV(lines.join('\n'));
  $('headerStatus').textContent = result.success
    ? t('csvSaved') + result.path
    : t('csvFailed');
}

// ----- presets -----
async function savePreset() {
  const name = presetNameInput.value.trim();
  if (!name) return;
  await window.waveAPI.savePreset({
    name,
    globalParams: { ...state.globalParams },
    channels: state.channels.map(ch => ({ ...ch }))
  });
  await refreshPresetList();
  presetNameInput.value = '';
}

async function loadPreset() {
  const name = presetSelect.value;
  if (!name) return;
  const r = await window.waveAPI.loadPresets();
  if (!r.success) return;
  const p = r.presets.find(p => p.name === name);
  if (!p) return;
  state.globalParams = { ...p.globalParams };
  state.channels = p.channels.map(ch => ({ ...ch, visible: ch.visible !== false }));
  timeIntervalInput.value = state.globalParams.timeInterval;
  dataLengthInput.value    = state.globalParams.dataLength;
  channelCountInput.value  = state.globalParams.channelCount;
  renderChannels();
}

async function refreshPresetList() {
  const r = await window.waveAPI.loadPresets();
  presetSelect.innerHTML = '<option value="">' + t('selectPreset') + '</option>';
  if (r.success && r.presets) {
    r.presets.forEach(p => {
      const o = document.createElement('option');
      o.value = p.name; o.textContent = p.name;
      presetSelect.appendChild(o);
    });
  }
}

// ----- init -----
function init() {
  [timeIntervalInput, dataLengthInput, channelCountInput].forEach(el => {
    el.addEventListener('input', onGlobalParamInput);
    el.addEventListener('keydown', filterNumericInput);
  });

  btnSavePreset.addEventListener('click', savePreset);
  btnLoadPreset.addEventListener('click', loadPreset);
  btnGenerate.addEventListener('click', generateCSV);
  btnZoomIn.addEventListener('click', zoomIn);
  btnZoomOut.addEventListener('click', zoomOut);
  btnZoomReset.addEventListener('click', zoomReset);
  canvas.addEventListener('wheel', onCanvasWheel, { passive: false });

  const btnLang = $('btnLang');
  if (btnLang) btnLang.addEventListener('click', () => setLang(lang === 'zh' ? 'en' : 'zh'));

  window.addEventListener('resize', () => requestAnimationFrame(resizeCanvas));
  new ResizeObserver(() => requestAnimationFrame(resizeCanvas)).observe(canvas.parentElement);

  applyI18n();
  renderChannels();
  refreshPresetList();
  requestAnimationFrame(() => requestAnimationFrame(resizeCanvas));
}

document.addEventListener('DOMContentLoaded', init);
