/* Local writing studio: all records stay in this browser's IndexedDB. */
(() => {
  'use strict';
  const DB_NAME = 'hoshi-journal-v2';
  const STORE = 'docs';
  const MAX_SOURCE = 2 * 1024 * 1024;
  const MAX_BACKUP = 10 * 1024 * 1024;
  const formats = ['markdown', 'tex', 'html'];
  const categories = ['日常碎片', '二次元', '折腾手记'];
  let dbPromise;
  let current = null;
  let documents = [];
  let dirty = false;
  let revision = 0;
  let saveTimer;
  let previewTimer;
  let composing = false;
  let renderRevision = 0;
  let queue = Promise.resolve();
  let opening = false;
  let originFocus;

  const makeId = () => `local-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
  const blank = () => ({ id: makeId(), title: '', content: '', format: 'markdown', category: '日常碎片', updatedAt: new Date().toISOString(), visible: true });
  function database() {
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('此浏览器无法使用本机储存。仍可编辑和导出文件。')); return; }
      let request;
      try { request = indexedDB.open(DB_NAME, 1); } catch { reject(new Error('无法打开本机储存。请允许网站储存数据，或先导出文件。')); return; }
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' }); };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(new Error('无法打开本机储存。请先导出文件，避免丢失内容。'));
      request.onblocked = () => reject(new Error('另一个窗口正在更新写作储存，请关闭其他博客窗口后刷新。'));
    });
    return dbPromise;
  }
  async function transaction(mode, action) {
    const db = await database();
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = db.transaction(STORE, mode); } catch (error) { reject(error); return; }
      let result;
      try { const request = action(tx.objectStore(STORE)); if (request) request.onsuccess = () => { result = request.result; }; }
      catch (error) { tx.abort(); reject(error); return; }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(new Error('本机保存失败，可能是储存空间不足。请导出文件或整库备份。'));
      tx.onabort = () => reject(new Error('保存未完成；内容仍留在编辑器中，请先导出。'));
    });
  }
  const list = async () => (await transaction('readonly', store => store.getAll())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const get = async id => transaction('readonly', store => store.get(String(id)));
  function changed() { window.dispatchEvent(new CustomEvent('hoshi:documents-changed')); }
  const dlg = document.createElement('dialog');
  dlg.id = 'writing-studio';
  dlg.className = 'studio-dialog';
  dlg.setAttribute('aria-labelledby', 'studio-heading');
  dlg.innerHTML = `
    <header class="studio-header"><div><span class="studio-kicker">YOUR CREATIVE SPACE</span><h2 id="studio-heading">写作工作台 <span>本机</span></h2></div><div class="studio-header-actions"><button type="button" id="studio-save" class="button primary">保存到本机</button><button type="button" id="studio-close" class="icon-button" aria-label="关闭写作工作台">×</button></div></header>
    <div class="studio-layout"><aside class="studio-library" aria-label="本机文稿列表"><div class="studio-library-top"><strong>我的文稿 <span id="studio-count">0</span></strong><button type="button" id="studio-new" class="studio-small-button" aria-label="新建文稿">＋ 新建</button></div><div class="studio-library-tools"><button type="button" id="studio-import">导入文件</button><button type="button" id="studio-backup">整库备份</button><button type="button" id="studio-restore">恢复备份</button></div><div id="studio-list" class="studio-document-list"></div><p class="studio-local-note">本机保存。清理浏览器数据会移除文稿，请定期导出备份。</p></aside>
    <section class="studio-writing"><div class="studio-document-settings"><label class="studio-title-label"><span class="sr-only">文章标题</span><input id="studio-title" maxlength="120" placeholder="给这篇小记起个名字…" autocomplete="off"></label><div class="studio-options"><label>格式 <select id="studio-format"><option value="markdown">Markdown</option><option value="tex">TeX 公式</option><option value="html">HTML</option></select></label><label>分类 <select id="studio-category"><option>日常碎片</option><option>二次元</option><option>折腾手记</option></select></label><label class="studio-visible-label"><input type="checkbox" id="studio-visible"> 显示在本机首页</label><button type="button" id="studio-export" class="studio-small-button">导出原文件 ↗</button></div></div>
    <div class="studio-toolbar" role="group" aria-label="插入格式"><button type="button" data-studio-insert="heading" title="插入标题">H₂ <span>标题</span></button><button type="button" data-studio-insert="bold" title="插入粗体"><b>B</b> <span>粗体</span></button><button type="button" data-studio-insert="list" title="插入列表">☷ <span>列表</span></button><button type="button" data-studio-insert="link" title="插入链接">↗ <span>链接</span></button><button type="button" data-studio-insert="code" title="插入代码">〈〉 <span>代码</span></button><button type="button" data-studio-insert="math" title="插入公式">∑ <span>公式</span></button><button type="button" data-studio-insert="table" title="插入表格">▦ <span>表格</span></button><button type="button" id="studio-template" class="studio-template-button">＋ 新建示例</button></div>
    <div class="studio-mode-tabs" role="group" aria-label="写作视图"><button type="button" data-studio-view="edit" aria-pressed="true">编辑</button><button type="button" data-studio-view="preview" aria-pressed="false">预览</button></div>
    <div class="studio-editor-grid" data-view="edit"><section class="studio-source-pane"><div class="studio-pane-label"><label for="studio-source">原文</label><span id="studio-word-count">0 字</span></div><textarea id="studio-source" spellcheck="false" placeholder="从一句话开始。上方的工具栏，可以帮你插入标题、列表和公式。"></textarea></section><section class="studio-preview-pane" aria-label="文章实时预览"><div class="studio-pane-label"><span>实时预览</span><span id="studio-preview-state">随写随看</span></div><div id="studio-preview" class="studio-render"></div></section></div>
    <footer class="studio-status-bar"><span id="studio-status" role="status" aria-live="polite">写下想留住的东西。</span><button type="button" id="studio-delete" class="studio-delete">删除这篇</button></footer><p class="studio-format-help" id="studio-format-help"></p>
    </section></div><input type="file" id="studio-file" accept=".md,.markdown,.tex,.html,.htm,.txt" hidden><input type="file" id="studio-backup-file" accept=".json,application/json" hidden>`;
  document.body.append(dlg);
  const $ = selector => dlg.querySelector(selector);
  const titleInput = $('#studio-title');
  const sourceInput = $('#studio-source');
  const formatInput = $('#studio-format');
  const categoryInput = $('#studio-category');
  const visibleInput = $('#studio-visible');

  function status(message, error = false) {
    $('#studio-status').textContent = message;
    $('#studio-status').classList.toggle('studio-error', error);
  }
  function report(error) { status(error?.message || '操作没有完成，请先导出当前内容。', true); }
  function safeName(title) { return (title || '未命名小记').replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').slice(0, 80); }
  function download(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function exportCurrent() {
    collect();
    const extensions = { markdown: 'md', tex: 'tex', html: 'html' };
    download(current.content, `${safeName(current.title)}.${extensions[current.format]}`, current.format === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8');
    status('已发起原文件下载；本机文稿仍保留。');
  }
  function collect() {
    if (!current) return;
    current.title = titleInput.value;
    current.content = sourceInput.value;
    current.format = formatInput.value;
    current.category = categoryInput.value;
    current.visible = visibleInput.checked;
  }
  function updateFormatHelp() {
    $('#studio-format-help').textContent = current.format === 'tex'
      ? '支持常用 TeX 数学公式与矩阵；不是完整的 LaTeX 文档排版引擎。切换格式不会转换原文。'
      : current.format === 'html'
        ? '支持 HTML 与样式预览；脚本、表单和外部嵌入不会运行。切换格式不会转换原文。'
        : '支持标题、列表、表格、代码块与 $行内公式$、$$独立公式$$。Ctrl / ⌘ + S 保存。';
    const tex = current.format === 'tex';
    ['heading', 'list', 'link', 'code'].forEach(name => { $(`[data-studio-insert="${name}"]`).disabled = tex; });
    $(`[data-studio-insert="table"]`).title = tex ? '插入矩阵' : '插入表格';
    $(`[data-studio-insert="math"]`).disabled = current.format === 'html';
    $(`[data-studio-insert="math"]`).title = current.format === 'html' ? '公式请使用 Markdown 或 TeX 格式' : '插入公式';
  }
  function setDocument(doc) {
    current = { ...doc };
    titleInput.value = doc.title;
    sourceInput.value = doc.content;
    formatInput.value = doc.format;
    categoryInput.value = doc.category;
    visibleInput.checked = !!doc.visible;
    dirty = false;
    revision++;
    updateFormatHelp();
    drawList();
    updatePreview();
    status(doc.content || doc.title ? '已打开本机文稿。修改后会自动保存。' : '新文稿 · 输入后自动保存到本机。');
  }
  function drawList() {
    const holder = $('#studio-list'); holder.replaceChildren();
    $('#studio-count').textContent = String(documents.length);
    if (!documents.length) {
      const empty = document.createElement('div'); empty.className = 'studio-list-empty';
      const symbol = document.createElement('span'); symbol.textContent = '✧';
      const message = document.createElement('p'); message.textContent = '文稿还空着。写一点，或导入你已有的文件。';
      empty.append(symbol, message); holder.append(empty); return;
    }
    documents.forEach(doc => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'studio-document-item';
      button.classList.toggle('active', current?.id === doc.id); button.setAttribute('aria-current', current?.id === doc.id ? 'true' : 'false');
      const title = document.createElement('strong'); title.textContent = doc.title || '未命名小记';
      const meta = document.createElement('span');
      const date = new Date(doc.updatedAt);
      meta.textContent = `${doc.format === 'markdown' ? 'MD' : doc.format.toUpperCase()} · ${Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} · ${doc.visible ? '本机首页' : '草稿'}`;
      button.append(title, meta); button.addEventListener('click', async () => {
        if (doc.id === current?.id) return;
        if (!await saveCurrent()) return;
        const latest = await get(doc.id); if (latest) setDocument(latest);
      }); holder.append(button);
    });
  }
  async function refreshList() { documents = await list(); drawList(); }
  async function updatePreview() {
    clearTimeout(previewTimer);
    if (!current) return;
    collect();
    $('#studio-word-count').textContent = `${Array.from(current.content).length.toLocaleString('zh-CN')} 字`;
    const token = ++renderRevision;
    const content = current.content;
    const format = current.format;
    const target = $('#studio-preview');
    if (!content.trim()) {
      target.replaceChildren(); const empty = document.createElement('div'); empty.className = 'studio-preview-empty';
      const mark = document.createElement('span'); mark.textContent = '✧';
      const text = document.createElement('p'); text.textContent = '你的文字，会在这里长成文章。'; empty.append(mark, text); target.append(empty);
      $('#studio-preview-state').textContent = '随写随看'; return;
    }
    $('#studio-preview-state').textContent = '排版中…';
    try {
      if (!window.HoshiRender) throw new Error('排版组件尚未就绪，请稍后再试。原文已保留。');
      const fragment = document.createElement('div'); fragment.className = 'studio-preview-content';
      const result = await window.HoshiRender.render(fragment, content, format);
      if (token !== renderRevision) return;
      target.replaceChildren(fragment);
      $('#studio-preview-state').textContent = result?.ok === false ? '请查看预览提示 · 原文保留' : '预览已更新';
    } catch (error) {
      if (token !== renderRevision) return;
      target.replaceChildren(); const errorText = document.createElement('p'); errorText.className = 'studio-error'; errorText.textContent = error.message || '预览暂不可用；原文可以正常保存。'; target.append(errorText);
      $('#studio-preview-state').textContent = '预览未完成';
    }
  }
  async function saveCurrent(explicit = false) {
    clearTimeout(saveTimer);
    if (!current) return true;
    collect();
    if (!dirty && !explicit) return true;
    if (new Blob([current.content]).size > MAX_SOURCE) { status('正文超过 2 MB，暂未保存。请导出原文件并精简内容。', true); dirty = true; return false; }
    const snapshot = { ...current, title: current.title.trim(), updatedAt: new Date().toISOString() };
    const savingRevision = revision;
    status('正在保存到本机…');
    const action = queue.catch(() => {}).then(() => transaction('readwrite', store => store.put(snapshot)));
    queue = action;
    try {
      await action;
      if (current?.id === snapshot.id && revision === savingRevision) { dirty = false; current.updatedAt = snapshot.updatedAt; status('已保存到本机 · 不会自动同步到其他设备'); }
      await refreshList(); changed(); return true;
    } catch (error) { dirty = true; report(error); return false; }
  }
  function edited() {
    collect(); dirty = true; revision++;
    status('有新修改 · 即将自动保存');
    clearTimeout(saveTimer); clearTimeout(previewTimer);
    if (!composing) { saveTimer = setTimeout(() => saveCurrent(), 800); previewTimer = setTimeout(updatePreview, 220); }
  }
  async function newDocument(sample = false) {
    if (!await saveCurrent()) return;
    const format = current?.format || 'markdown';
    const doc = blank(); doc.format = format;
    if (sample) {
      doc.title = format === 'tex' ? '一页公式练习' : format === 'html' ? '一张小小明信片' : '从这里开始写';
      doc.content = format === 'tex' ? String.raw`\begin{aligned}
E &= mc^2 \\
\int_0^1 x^2\,dx &= \frac{1}{3} \\
\sum_{n=1}^{\infty}\frac{1}{n^2} &= \frac{\pi^2}{6}
\end{aligned}` : format === 'html' ? `<article style="max-width:600px;margin:auto;padding:28px;border:1px solid #b6a7df;border-radius:20px;background:#f4f0ff;color:#302b41;font-family:system-ui;line-height:1.8">
  <p style="letter-spacing:3px;font-size:12px">A LITTLE POSTCARD</p>
  <h1>给今天，留一点空白。</h1>
  <p>把这句话，换成你想说的话。</p>
  <blockquote>平凡的一天，也可以是故事的开头。</blockquote>
</article>` : `# 你好，新的一页

从一句话开始。选中文字，点击上方的 **粗体**、标题或列表，就能轻松排版。

## 今天想留下什么？

- [ ] 一个很喜欢的瞬间
- [ ] 一点突然出现的灵感
- [x] 给自己留一个写作的地方

> 不必一次写完。这里会自动保存到当前浏览器。

| 心情 | 关键词 |
| --- | --- |
| 晴朗 | 慢慢来 |

公式也可以写进来：$E=mc^2$。

$$
\\int_0^1 x^2\\,dx = \\frac{1}{3}
$$

\`\`\`js
const today = 'a little better';
\`\`\`
`;
    }
    setDocument(doc);
    if (sample) { dirty = true; revision++; await saveCurrent(); }
    titleInput.focus();
  }
  async function open(id) {
    if (opening) return;
    opening = true;
    try {
      if (dlg.open && !await saveCurrent()) return;
      if (!dlg.open) { originFocus = document.activeElement; dlg.showModal(); document.body.classList.add('studio-open'); }
      await refreshList();
      if (id) { const doc = await get(id); if (doc) setDocument(doc); else { setDocument(current || blank()); status('这篇本机文稿已不存在。', true); } }
      else if (!current) setDocument(documents[0] || blank());
      else drawList();
      titleInput.focus({ preventScroll: true });
    } catch (error) {
      if (!current) setDocument(blank()); report(error);
    } finally { opening = false; }
  }
  async function close() {
    if (composing) { composing = false; edited(); }
    if (!await saveCurrent()) return;
    dlg.close();
  }
  function insert(kind) {
    const start = sourceInput.selectionStart, end = sourceInput.selectionEnd;
    const selection = sourceInput.value.slice(start, end);
    const fmt = current.format;
    const text = selection || '文字';
    const snippets = fmt === 'html' ? {
      heading: `\n<h2>${text}</h2>\n`, bold: `<strong>${text}</strong>`, list: `\n<ul>\n  <li>${selection || '第一项'}</li>\n  <li>第二项</li>\n</ul>\n`, link: `<a href="https://example.com">${selection || '链接文字'}</a>`, code: `\n<pre><code>${selection || '在这里输入代码'}</code></pre>\n`, math: `\n<p>\\( ${selection || 'E=mc^2'} \\)</p>\n`, table: '\n<table><thead><tr><th>列一</th><th>列二</th></tr></thead><tbody><tr><td>内容</td><td>内容</td></tr></tbody></table>\n'
    } : fmt === 'tex' ? {
      bold: `\\mathbf{${selection || 'x'}}`, math: selection || '\\frac{a}{b}', table: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'
    } : {
      heading: `\n## ${text}\n`, bold: `**${text}**`, list: `\n- ${selection || '第一项'}\n- 第二项\n`, link: `[${selection || '链接文字'}](https://example.com)`, code: `\n\`\`\`\n${selection || '在这里输入代码'}\n\`\`\`\n`, math: `\n$$\n${selection || 'E=mc^2'}\n$$\n`, table: '\n| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |\n'
    };
    if (snippets[kind] == null) return;
    sourceInput.setRangeText(snippets[kind], start, end, 'end'); sourceInput.focus(); edited();
  }
  function validateDocument(value) {
    if (!value || typeof value !== 'object' || typeof value.title !== 'string' || typeof value.content !== 'string' || !formats.includes(value.format)) throw new Error('备份文稿格式不正确，请选择此工作台导出的 JSON。');
    if (value.title.length > 120 || new Blob([value.content]).size > MAX_SOURCE) throw new Error('备份中有文稿超过大小限制（标题 120 字，正文 2 MB）。');
    return { id: makeId(), title: value.title, content: value.content, format: value.format, category: categories.includes(value.category) ? value.category : categories[0], updatedAt: new Date().toISOString(), visible: value.visible === true };
  }
  async function importSource(file) {
    if (!file) return;
    if (file.size > MAX_SOURCE) throw new Error('文件超过 2 MB，请缩小后再导入。');
    if (!/\.(md|markdown|tex|html|htm|txt)$/i.test(file.name)) throw new Error('请选择 .md、.tex、.html 或 .txt 文件。');
    const content = await file.text();
    if (content.includes('\uFFFD')) throw new Error('文件编码可能不是 UTF-8，请转换为 UTF-8 后重新导入。');
    if (!await saveCurrent()) return;
    const doc = blank(); doc.title = file.name.replace(/\.[^.]+$/, '').slice(0, 120); doc.content = content;
    doc.format = /\.tex$/i.test(file.name) ? 'tex' : /\.html?$/i.test(file.name) ? 'html' : 'markdown';
    await transaction('readwrite', store => store.put(doc));
    await refreshList(); setDocument(doc); changed(); status('文件已导入并保存到本机。');
  }
  async function exportBackup() {
    // Include the open editor even if disk storage is unavailable, so export remains a recovery path.
    collect();
    let all;
    try { all = await list(); } catch { all = documents.map(doc => ({ ...doc })); }
    if (current && (dirty || current.content || current.title)) {
      const snapshot = { ...current, updatedAt: new Date().toISOString() };
      const index = all.findIndex(doc => doc.id === snapshot.id);
      if (index >= 0) all[index] = snapshot; else all.unshift(snapshot);
    }
    const backup = { app: 'hoshi-journal', version: 1, exportedAt: new Date().toISOString(), documents: all, theme: window.HoshiTheme?.get?.() || null };
    const json = JSON.stringify(backup, null, 2);
    if (new Blob([json]).size > MAX_BACKUP) throw new Error('整库超过 10 MB，请先分别导出大文稿，精简后再备份。');
    download(json, `星间小记-备份-${new Date().toISOString().slice(0, 10)}.json`, 'application/json;charset=utf-8');
    status(`已发起备份下载：${all.length} 篇文稿和当前配色。`);
  }
  async function restoreBackup(file) {
    if (!file) return;
    if (file.size > MAX_BACKUP) throw new Error('备份超过 10 MB，无法导入。');
    let backup; try { backup = JSON.parse(await file.text()); } catch { throw new Error('无法读取 JSON 备份，请检查文件。'); }
    if (backup?.app !== 'hoshi-journal' || backup.version !== 1 || !Array.isArray(backup.documents) || backup.documents.length > 500) throw new Error('这不是兼容的星间小记备份（最多 500 篇）。');
    const restored = backup.documents.map(validateDocument);
    if (!await saveCurrent()) return;
    await transaction('readwrite', store => { restored.forEach(doc => store.put(doc)); });
    await refreshList();
    if (restored[0]) setDocument(restored[0]);
    let themeRestored = false;
    if (backup.theme && window.HoshiTheme?.apply) { try { window.HoshiTheme.apply(backup.theme); themeRestored = true; } catch { /* Documents remain restored if a theme is incompatible. */ } }
    changed(); status(`已合并 ${restored.length} 篇文稿，原有内容未覆盖${themeRestored ? '，配色已恢复' : ''}。`);
  }
  async function removeCurrent() {
    if (!current || !window.confirm(`删除「${current.title || '未命名小记'}」？这只影响当前浏览器，删除后无法撤回。`)) return;
    clearTimeout(saveTimer); clearTimeout(previewTimer);
    await queue.catch(() => {});
    await transaction('readwrite', store => store.delete(current.id));
    dirty = false; await refreshList(); setDocument(documents[0] || blank()); changed(); status('文稿已从本机删除。');
  }

  document.getElementById('studio-open')?.addEventListener('click', () => open());
  $('#studio-close').addEventListener('click', close);
  dlg.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dlg.addEventListener('close', () => { document.body.classList.remove('studio-open'); if (originFocus?.isConnected) originFocus.focus({ preventScroll: true }); });
  dlg.addEventListener('keydown', event => {
    // Keep blog-wide keyboard shortcuts out of the writing workspace.
    event.stopPropagation();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveCurrent(true); }
  });
  titleInput.addEventListener('input', edited); sourceInput.addEventListener('input', edited);
  [sourceInput, titleInput].forEach(input => {
    input.addEventListener('compositionstart', () => { composing = true; clearTimeout(saveTimer); clearTimeout(previewTimer); });
    input.addEventListener('compositionend', () => { composing = false; edited(); });
  });
  formatInput.addEventListener('change', () => { edited(); updateFormatHelp(); updatePreview(); });
  categoryInput.addEventListener('change', edited); visibleInput.addEventListener('change', edited);
  $('#studio-save').addEventListener('click', () => saveCurrent(true));
  $('#studio-new').addEventListener('click', () => newDocument());
  $('#studio-template').addEventListener('click', () => newDocument(true));
  $('#studio-export').addEventListener('click', exportCurrent);
  $('#studio-import').addEventListener('click', () => $('#studio-file').click());
  $('#studio-restore').addEventListener('click', () => $('#studio-backup-file').click());
  $('#studio-backup').addEventListener('click', () => exportBackup().catch(report));
  $('#studio-file').addEventListener('change', event => { importSource(event.target.files[0]).catch(report).finally(() => { event.target.value = ''; }); });
  $('#studio-backup-file').addEventListener('change', event => { restoreBackup(event.target.files[0]).catch(report).finally(() => { event.target.value = ''; }); });
  $('#studio-delete').addEventListener('click', () => removeCurrent().catch(report));
  dlg.querySelectorAll('[data-studio-insert]').forEach(button => button.addEventListener('click', () => insert(button.dataset.studioInsert)));
  dlg.querySelectorAll('[data-studio-view]').forEach(button => button.addEventListener('click', () => {
    $('.studio-editor-grid').dataset.view = button.dataset.studioView;
    dlg.querySelectorAll('[data-studio-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    if (button.dataset.studioView === 'preview') updatePreview();
  }));
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  window.HoshiStudio = { list, get, open };
})();
