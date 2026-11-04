/* Local appearance preferences. Values are validated before becoming CSS variables. */
(() => {
  'use strict';
  const KEY = 'hoshi-appearance-v2';
  const presets = [
    { id: 'moon', name: '月光银', note: '雾紫 · 通透', accent: '#8068bf', background: '#f1f0f7', text: '#302d41', mode: 'light' },
    { id: 'sakura', name: '樱花信', note: '柔粉 · 温柔', accent: '#b6537e', background: '#faf0f3', text: '#4a2e3e', mode: 'light' },
    { id: 'ocean', name: '海盐蓝', note: '天蓝 · 清澈', accent: '#397caa', background: '#edf5fa', text: '#243d51', mode: 'light' },
    { id: 'amber', name: '落日邮局', note: '琥珀 · 温暖', accent: '#ad652c', background: '#faf3e9', text: '#4e3928', mode: 'light' },
    { id: 'forest', name: '森林来信', note: '苔绿 · 安静', accent: '#53764c', background: '#eff4ed', text: '#2f4231', mode: 'light' },
    { id: 'night', name: '深空电台', note: '靛蓝 · 夜色', accent: '#b5a2ee', background: '#1b1b2b', text: '#eeeaf8', mode: 'dark' }
  ];
  const defaults = { version: 2, preset: 'moon', mode: 'light', accent: '#8068bf', background: '#f1f0f7', text: '#302d41', opacity: 76, blur: 18, motion: true, lowEffects: false };
  const root = document.documentElement;
  let state = { ...defaults };
  let panel;
  let contrastCorrected = false;
  let storageError = false;
  let restorePalette = null;
  const color = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const hex = (values) => '#' + values.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, proportion) => hex(rgb(a).map((v, i) => v * (1 - proportion) + rgb(b)[i] * proportion));
  const luminance = (value) => rgb(value).map((v) => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  function readable(desired, backgrounds, minimum = 4.5) {
    if (backgrounds.every((b) => contrast(desired, b) >= minimum)) return desired;
    const dark = Math.min(...backgrounds.map((b) => contrast('#000000', b)));
    const light = Math.min(...backgrounds.map((b) => contrast('#ffffff', b)));
    const target = dark >= light ? '#000000' : '#ffffff';
    for (let step = .05; step <= 1; step += .05) {
      const candidate = mix(desired, target, Math.min(step, 1));
      if (backgrounds.every((b) => contrast(candidate, b) >= minimum)) return candidate;
    }
    return target;
  }
  function validate(value, strict = false) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('这不是有效的主题文件。');
    if (strict && (!color(value.accent) || !color(value.background) || !color(value.text))) throw new Error('主题文件需要有效的强调色、背景色和文字色。');
    const out = { ...defaults };
    for (const key of ['accent', 'background', 'text']) if (color(value[key])) out[key] = value[key].toLowerCase();
    out.mode = value.mode === 'dark' ? 'dark' : 'light';
    out.preset = presets.some((p) => p.id === value.preset) ? value.preset : 'custom';
    for (const [key, low, high] of [['opacity', 55, 100], ['blur', 0, 30]]) {
      if (typeof value[key] === 'number' && Number.isFinite(value[key])) out[key] = Math.round(Math.min(high, Math.max(low, value[key])));
    }
    if (typeof value.motion === 'boolean') out.motion = value.motion;
    if (typeof value.lowEffects === 'boolean') out.lowEffects = value.lowEffects;
    return out;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); storageError = false; }
    catch { storageError = true; }
  }
  function apply(value, options = {}) {
    state = validate(value, options.strict === true);
    const background = state.background;
    // Keep both backgrounds on the same side of the readable black/white boundary.
    const darkBackground = contrast('#ffffff', background) >= contrast('#000000', background);
    state.mode = darkBackground ? 'dark' : 'light';
    const surface = mix(background, darkBackground ? '#000000' : '#ffffff', darkBackground ? .08 : .80);
    const ink = readable(state.text, [background, surface]);
    const muted = readable(mix(ink, background, .27), [background, surface]);
    const accentInk = readable(state.accent, [background, surface]);
    const onAccent = contrast('#ffffff', state.accent) > contrast('#000000', state.accent) ? '#ffffff' : '#000000';
    const values = {
      '--bg': background, '--surface': surface, '--ink': ink, '--muted': muted,
      '--green': accentInk, '--accent': state.accent, '--accent-ink': accentInk, '--on-accent': onAccent,
      '--soft': mix(surface, state.accent, .11), '--line': mix(surface, ink, .14),
      '--surface-rgb': rgb(surface).join(', '), '--bg-rgb': rgb(background).join(', '), '--accent-rgb': rgb(state.accent).join(', '),
      '--glass-opacity': String(state.lowEffects ? 1 : state.opacity / 100),
      '--glass-blur': `${state.lowEffects ? 0 : state.blur}px`,
      '--shadow': `0 12px 35px rgba(${rgb(ink).join(', ')}, .07)`,
      '--motion-time': state.motion && !state.lowEffects ? '260ms' : '0ms'
    };
    Object.entries(values).forEach(([name, val]) => root.style.setProperty(name, val));
    root.dataset.theme = state.mode;
    root.dataset.motion = state.motion && !state.lowEffects ? 'on' : 'off';
    root.dataset.effects = state.lowEffects ? 'low' : 'full';
    root.style.colorScheme = state.mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = background;
    contrastCorrected = ink.toLowerCase() !== state.text.toLowerCase();
    const toggle = document.querySelector('#theme-toggle');
    if (toggle) {
      toggle.setAttribute('aria-label', state.mode === 'dark' ? '切换日间模式' : '切换夜间模式');
      toggle.title = toggle.getAttribute('aria-label');
      toggle.querySelector('use')?.setAttribute('href', state.mode === 'dark' ? '#i-sun' : '#i-moon');
    }
    if (options.persist !== false) save();
    syncControls();
    window.dispatchEvent(new CustomEvent('hoshi:themechange', { detail: { ...state } }));
    return { ...state };
  }
  function status(message, error = false) {
    const node = panel?.querySelector('#theme-status');
    if (storageError) { message = '外观已预览，但浏览器未允许自动保存；请导出配色保留设置。'; error = true; }
    if (node) { node.textContent = message; node.dataset.error = String(error); }
  }
  function syncControls() {
    if (!panel) return;
    for (const name of ['accent', 'background', 'text']) {
      panel.querySelector(`#theme-${name}`).value = state[name];
      const textInput = panel.querySelector(`#theme-${name}-hex`);
      if (document.activeElement !== textInput) textInput.value = state[name].toUpperCase();
    }
    for (const name of ['opacity', 'blur']) {
      panel.querySelector(`#theme-${name}`).value = state[name];
      panel.querySelector(`#theme-${name}-output`).textContent = state[name] + (name === 'opacity' ? '%' : ' px');
    }
    for (const name of ['motion', 'lowEffects']) panel.querySelector(`#theme-${name}`).checked = state[name];
    panel.querySelectorAll('[data-theme-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.themeMode === state.mode)));
    panel.querySelectorAll('[data-theme-preset]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.themePreset === state.preset)));
    const feedback = panel.querySelector('#theme-contrast');
    feedback.textContent = contrastCorrected ? '已自动调整显示文字色，让这套配色仍然清晰可读。' : '文字对比度良好 · 小字也清晰';
    panel.querySelector('#theme-opacity').disabled = state.lowEffects;
    panel.querySelector('#theme-blur').disabled = state.lowEffects;
    if (storageError) status('浏览器未允许保存外观；请导出主题文件保留设置。', true);
  }
  function changeMode(mode) {
    if (state.mode === mode) return;
    if (mode === 'dark') {
      restorePalette = { background: state.background, text: state.text };
      apply({ ...state, mode, background: mix('#171721', state.accent, .08), text: '#eeeaf8', preset: 'custom' });
    } else {
      apply({ ...state, mode, ...(restorePalette || { background: mix('#fafafd', state.accent, .06), text: '#302d41' }), preset: 'custom' });
      restorePalette = null;
    }
  }
  function download() {
    const blob = new Blob([JSON.stringify({ type: 'hoshi-theme', ...state }, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = '星间小记-我的配色.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('主题文件已导出，可以在其他浏览器导入。');
  }
  function buildPanel() {
    panel = document.createElement('dialog');
    panel.id = 'theme-panel'; panel.className = 'theme-panel';
    panel.setAttribute('aria-labelledby', 'theme-panel-title');
    panel.innerHTML = `<div class="theme-panel-top"><div><span class="theme-kicker">YOUR SPACE, YOUR COLORS</span><h2 id="theme-panel-title">给小宇宙换个心情</h2><p>从一套配色开始，再调成你喜欢的样子。</p></div><button class="icon-button" id="theme-panel-close" aria-label="关闭外观设置"><svg><use href="#i-close"/></svg></button></div>
      <div class="theme-panel-body"><section class="theme-presets-section" aria-labelledby="theme-presets-title"><h3 id="theme-presets-title">灵感配色 <span>06 PALETTES</span></h3><div class="theme-presets"></div></section>
      <section aria-labelledby="theme-colors-title"><div class="theme-section-heading"><h3 id="theme-colors-title">自由调色</h3><div class="theme-mode-switch" aria-label="明暗模式"><button data-theme-mode="light" aria-pressed="true">日间</button><button data-theme-mode="dark" aria-pressed="false">夜间</button></div></div>
      <div class="theme-color-list">${[['accent','强调色','按钮、选中状态和小细节'],['background','背景色','整个页面的底色'],['text','文字色','自动保持清晰的阅读对比度']].map(([key,label,hint]) => `<div class="theme-color-row"><div><label for="theme-${key}">${label}</label><small>${hint}</small></div><div class="theme-color-input"><input type="color" id="theme-${key}" aria-label="选择${label}"><input id="theme-${key}-hex" aria-label="${label}十六进制色值" maxlength="7" pattern="#[0-9A-Fa-f]{6}" spellcheck="false"></div></div>`).join('')}</div><p class="theme-contrast" id="theme-contrast"></p></section>
      <section aria-labelledby="theme-material-title"><h3 id="theme-material-title">光感与材质 <span>SOFT GLASS</span></h3><div class="theme-slider-row"><label for="theme-opacity">面板不透明度</label><output id="theme-opacity-output"></output><input id="theme-opacity" type="range" min="55" max="100" step="1"></div><div class="theme-slider-row"><label for="theme-blur">背景虚化</label><output id="theme-blur-output"></output><input id="theme-blur" type="range" min="0" max="30" step="1"></div>
      <label class="theme-check"><span><strong>柔和动效</strong><small>轻盈的浮动、渐显与过渡</small></span><input type="checkbox" id="theme-motion" role="switch"></label><label class="theme-check"><span><strong>轻量模式</strong><small>关闭模糊与动效，保持相同配色</small></span><input type="checkbox" id="theme-lowEffects" role="switch"></label><p class="theme-system-note">会遵循设备的“减少动态效果”设置。</p></section>
      <p class="theme-status" id="theme-status" role="status" aria-live="polite">调整会自动保存到当前浏览器。</p></div>
      <div class="theme-panel-bottom"><button class="button secondary" id="theme-reset">恢复默认</button><div><button class="button secondary" id="theme-import">导入</button><button class="button primary" id="theme-export">导出配色 ↗</button></div></div><input type="file" id="theme-file" accept=".json,application/json" hidden>`;
    document.body.append(panel);
    const grid = panel.querySelector('.theme-presets');
    presets.forEach((preset) => {
      const button = document.createElement('button'); button.className = 'theme-preset'; button.dataset.themePreset = preset.id; button.setAttribute('aria-pressed', 'false');
      const colors = document.createElement('span'); colors.className = 'theme-preset-colors';
      [preset.background, mix(preset.background, preset.accent, .23), preset.accent].forEach((value) => { const dot = document.createElement('i'); dot.style.background = value; colors.append(dot); });
      const name = document.createElement('strong'); name.textContent = preset.name;
      const note = document.createElement('small'); note.textContent = preset.note;
      button.append(colors, name, note); grid.append(button);
      button.addEventListener('click', () => { apply({ ...state, ...preset, preset: preset.id }); status(`已应用「${preset.name}」，你还可以继续微调。`); });
    });
    panel.querySelector('#theme-panel-close').addEventListener('click', () => panel.close());
    panel.addEventListener('click', (event) => { if (event.target !== panel) return; const bounds = panel.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) panel.close(); });
    panel.addEventListener('close', () => { document.body.classList.remove('theme-open'); document.querySelector('#theme-settings-open')?.focus({ preventScroll: true }); });
    panel.querySelectorAll('[data-theme-mode]').forEach((button) => button.addEventListener('click', () => changeMode(button.dataset.themeMode)));
    ['accent', 'background', 'text'].forEach((key) => {
      panel.querySelector(`#theme-${key}`).addEventListener('input', (event) => { apply({ ...state, [key]: event.target.value, preset: 'custom' }); status('已保存你的自定义配色。'); });
      panel.querySelector(`#theme-${key}-hex`).addEventListener('change', (event) => {
        if (!color(event.target.value)) { event.target.setAttribute('aria-invalid', 'true'); status('请输入 # 加六位色值，例如 #8068BF。', true); return; }
        event.target.removeAttribute('aria-invalid'); apply({ ...state, [key]: event.target.value, preset: 'custom' }); status('已保存你的自定义配色。');
      });
    });
    ['opacity','blur'].forEach((key) => panel.querySelector(`#theme-${key}`).addEventListener('input', (event) => apply({ ...state, [key]: Number(event.target.value) })));
    ['motion','lowEffects'].forEach((key) => panel.querySelector(`#theme-${key}`).addEventListener('change', (event) => apply({ ...state, [key]: event.target.checked })));
    panel.querySelector('#theme-reset').addEventListener('click', () => { apply(defaults); status('已恢复月光银默认配色。'); });
    panel.querySelector('#theme-export').addEventListener('click', download);
    panel.querySelector('#theme-import').addEventListener('click', () => panel.querySelector('#theme-file').click());
    panel.querySelector('#theme-file').addEventListener('change', async (event) => {
      const file = event.target.files[0]; if (!file) return;
      try { if (file.size > 100000) throw new Error('主题文件过大，请选择导出的配色 JSON 文件。'); apply(JSON.parse(await file.text()), { strict: true }); status('配色已导入并保存。'); }
      catch (error) { status(error.message || '无法读取这个主题文件。', true); }
      finally { event.target.value = ''; }
    });
    syncControls();
  }
  function open() { if (!panel) buildPanel(); syncControls(); if (!panel.open) { panel.showModal(); document.body.classList.add('theme-open'); } }
  try { const stored = localStorage.getItem(KEY); if (stored) state = validate(JSON.parse(stored)); } catch { /* Keep the valid default when storage is unavailable. */ }
  apply(state, { persist: false });
  document.querySelector('#theme-settings-open')?.addEventListener('click', open);
  document.querySelector('#theme-toggle')?.addEventListener('click', () => changeMode(state.mode === 'dark' ? 'light' : 'dark'));
  window.HoshiTheme = { get: () => ({ ...state }), apply: (value) => apply(value, { strict: true }), reset: () => apply(defaults), open, export: download, validate: (value) => validate(value, true) };
})();
