/* Rich content is loaded on demand. All dependencies and formula fonts are local. */
(() => {
  'use strict';
  const rootURL = new URL('.', document.currentScript.src);
  const scripts = new Map();
  const revisions = new WeakMap();
  const maxPreview = 300000;
  let prepared;
  const resolve = (path) => new URL(path, rootURL).href;
  function loadScript(file) {
    if (scripts.has(file)) return scripts.get(file);
    const promise = new Promise((ok, fail) => {
      const script = document.createElement('script');
      script.src = resolve(`vendor/${file}`);
      script.onload = ok;
      script.onerror = () => { script.remove(); scripts.delete(file); fail(new Error('渲染组件加载失败，请检查网络或重新打开页面。')); };
      document.head.append(script);
    });
    scripts.set(file, promise);
    return promise;
  }
  function loadStyle() {
    if (document.querySelector('[data-hoshi-katex]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = resolve('vendor/katex.min.css');
    link.dataset.hoshiKatex = 'true'; document.head.append(link);
  }
  function ready() {
    if (!prepared) {
      loadStyle();
      prepared = Promise.all([loadScript('marked.min.js'), loadScript('purify.min.js'), loadScript('katex.min.js')])
        .then(() => {
          if (!window.marked || !window.DOMPurify?.isSupported || !window.katex) throw new Error('当前浏览器不支持完整预览，请更新浏览器；原文仍可保存和导出。');
        }).catch((error) => { prepared = undefined; throw error; });
    }
    return prepared;
  }
  function note(text, kind = 'info') {
    const el = document.createElement('p'); el.className = `render-notice render-${kind}`;
    el.textContent = text; return el;
  }
  function sourceNode(text) {
    const pre = document.createElement('pre'); pre.className = 'render-source';
    const code = document.createElement('code'); code.textContent = text; pre.append(code); return pre;
  }
  function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function sanitizeMarkdown(html) {
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'button', 'textarea', 'select', 'video', 'audio', 'source', 'link', 'meta', 'base'],
      FORBID_ATTR: ['style', 'id', 'name', 'srcset', 'formaction'],
      ADD_ATTR: ['data-hoshi-math'],
      ALLOW_DATA_ATTR: false
    });
  }
  function closingIndex(src, delimiter, start) {
    let position = start;
    while ((position = src.indexOf(delimiter, position)) !== -1) {
      let slashes = 0;
      for (let back = position - 1; back >= 0 && src[back] === '\\'; back--) slashes++;
      if (slashes % 2 === 0) return position;
      position += delimiter.length;
    }
    return -1;
  }
  function mathToken(src, block) {
    let open; let close;
    if (block) {
      if (src.startsWith('$$')) { open = close = '$$'; }
      else if (src.startsWith('\\[')) { open = '\\['; close = '\\]'; }
      else return;
    } else {
      if (src.startsWith('\\(')) { open = '\\('; close = '\\)'; }
      else if (src[0] === '$' && src[1] !== '$' && !/\s/.test(src[1] || ' ')) { open = close = '$'; }
      else return;
    }
    const end = closingIndex(src, close, open.length);
    if (end < 0) return;
    const text = src.slice(open.length, end);
    if (!text.trim() || (!block && text.includes('\n'))) return;
    if (open === '$' && (/\s$/.test(text) || /\d/.test(src[end + 1] || ''))) return;
    return { raw: src.slice(0, end + close.length), text, display: block };
  }
  function markdownFragment(content) {
    const maths = [];
    const capture = (token) => {
      const id = maths.push(token) - 1;
      return `<span class="hoshi-math-slot" data-hoshi-math="${id}"></span>${token.display ? '\n' : ''}`;
    };
    const parser = new marked.Marked({ gfm: true, breaks: false, extensions: [
      { name: 'hoshiMathBlock', level: 'block', start: (src) => src.search(/\$\$|\\\[/), tokenizer(src) {
        const token = mathToken(src, true); return token ? { ...token, type: 'hoshiMathBlock' } : undefined;
      }, renderer: capture },
      { name: 'hoshiMathInline', level: 'inline', start: (src) => src.search(/\$|\\\(/), tokenizer(src) {
        const token = mathToken(src, false); return token ? { ...token, type: 'hoshiMathInline' } : undefined;
      }, renderer: capture }
    ] });
    const fragment = document.createElement('div');
    fragment.innerHTML = sanitizeMarkdown(parser.parse(content));
    fragment.querySelectorAll('[data-hoshi-math]').forEach((slot) => {
      const formula = maths[Number(slot.dataset.hoshiMath)];
      if (!formula) { slot.remove(); return; }
      slot.removeAttribute('data-hoshi-math');
      drawMath(slot, formula.text, formula.display);
    });
    fragment.querySelectorAll('a').forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (!/^(https?:|mailto:|#)/i.test(href)) link.removeAttribute('href');
      if (/^https?:/i.test(href)) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    });
    fragment.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (!/^(https?:|data:image\/(?:png|jpe?g|webp|gif);base64,)/i.test(src)) img.removeAttribute('src');
      img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
    });
    fragment.querySelectorAll('input').forEach((input) => {
      if (input.type !== 'checkbox') input.remove(); else input.disabled = true;
    });
    return fragment;
  }
  function drawMath(target, formula, display) {
    target.className = display ? 'hoshi-math hoshi-math-display' : 'hoshi-math';
    try {
      katex.render(formula, target, {
        displayMode: display, output: 'htmlAndMathml', throwOnError: true,
        trust: false, strict: 'ignore', maxExpand: 1000, maxSize: 12,
        macros: Object.create(null)
      });
    } catch (error) {
      target.classList.add('formula-error');
      target.textContent = formula;
      target.setAttribute('title', `公式未能解析：${String(error.message).slice(0, 220)}`);
      target.setAttribute('aria-label', `公式语法有误，显示原文：${formula}`);
      const label = document.createElement('small'); label.textContent = '公式未能解析 · 请检查语法';
      target.append(label);
    }
  }
  function htmlFrame(content) {
    const clean = DOMPurify.sanitize(content, {
      WHOLE_DOCUMENT: true, ADD_TAGS: ['style'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'link', 'base', 'meta'],
      FORBID_ATTR: ['srcdoc', 'srcset', 'formaction'], SANITIZE_NAMED_PROPS: true
    });
    const csp = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src data:; media-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    const styles = getComputedStyle(document.documentElement);
    const text = styles.getPropertyValue('--ink').trim();
    const bg = styles.getPropertyValue('--surface').trim();
    const safeColor = (value, fallback) => /^[#\w\s(),.%/-]+$/.test(value) ? value : fallback;
    const header = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><style>:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;padding:24px;font:15px/1.85 system-ui,sans-serif;overflow-wrap:anywhere;color:${safeColor(text, '#263c34')};background:${safeColor(bg, '#fff')}}img,video,svg{max-width:100%;height:auto}pre{overflow:auto}table{border-collapse:collapse;max-width:100%}td,th{padding:8px;border:1px solid #9995}a{color:inherit}</style>`;
    const doc = clean.replace(/<head>/i, `<head>${header}`);
    const frame = document.createElement('iframe');
    frame.className = 'hoshi-html-frame'; frame.title = 'HTML 内容预览（隔离运行）';
    frame.setAttribute('sandbox', ''); frame.referrerPolicy = 'no-referrer';
    frame.srcdoc = doc.includes(header) ? doc : `<!doctype html><html><head>${header}</head><body>${clean}</body></html>`;
    return frame;
  }
  async function render(container, content, format = 'markdown') {
    if (!(container instanceof Element)) throw new TypeError('需要有效的预览容器。');
    const revision = (revisions.get(container) || 0) + 1;
    revisions.set(container, revision);
    const source = String(content ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    container.classList.add('hoshi-content');
    if (!source.trim()) { container.replaceChildren(note('写下第一句，预览就会出现在这里。')); return { ok: true, empty: true }; }
    if (source.length > maxPreview) {
      container.replaceChildren(note('内容较长，已暂停实时排版以保持编辑流畅。原文仍可完整保存和导出。', 'warning'), sourceNode(source.slice(0, 12000) + '\n…（预览节选）'));
      return { ok: false, reason: 'preview-limit' };
    }
    try {
      await ready();
      if (revisions.get(container) !== revision) return { stale: true };
      if (format === 'html') {
        container.replaceChildren(note('HTML 独立预览 · 保留样式，脚本与表单不会运行。'), htmlFrame(source));
      } else if (format === 'tex') {
        if (/\\(?:documentclass|usepackage)\b|\\begin\{document\}/.test(source)) {
          container.replaceChildren(note('这里支持 TeX 数学公式，不编译完整的 LaTeX 文档。请提取公式，或用 Markdown 排版正文；完整原文仍可保存与导出。', 'warning'), sourceNode(source));
          return { ok: false, reason: 'latex-document' };
        }
        const help = note('TeX 数学公式 · 支持常用分式、矩阵和对齐环境。');
        if (/\$\$|\\\[|\\\(|(^|[^\\])\$[^\s]/.test(source)) container.replaceChildren(help, markdownFragment(source));
        else { const equation = document.createElement('div'); drawMath(equation, source.trim(), true); container.replaceChildren(help, equation); }
      } else container.replaceChildren(markdownFragment(source));
      return { ok: true, format };
    } catch (error) {
      if (revisions.get(container) === revision) container.replaceChildren(note(error.message || '预览失败，原文仍可保存和导出。', 'warning'), sourceNode(source));
      return { ok: false, reason: 'render-failure' };
    }
  }
  // This summary helper never inserts user HTML or performs network requests.
  function plain(content, format = 'markdown') {
    const input = String(content || '');
    if (format === 'tex') return input.replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}$]/g, '').replace(/\s+/g, ' ').trim();
    return input.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, ' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`#*_>~]/g, '').replace(/\s+/g, ' ').trim();
  }
  window.HoshiRender = Object.freeze({ ready, render, plain, escapeHTML });
})();
