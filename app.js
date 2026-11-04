'use strict';

// Projects shown on the homepage. Every entry mirrors a real public repository.
const projects = [
  {
    id: 'tournament-hamiltonian-paths', category: '研究', title: '竞赛图哈密顿路径的常数因子界',
    date: '2026 年 10 月 30 日', lang: 'Lean', stars: 4,
    url: 'https://github.com/LStar404/tournament-hamiltonian-paths',
    blocks: [
      ['p', '竞赛图里任意两个顶点之间恰有一条有向边。这个仓库研究其中哈密顿路径的常数因子上界。'],
      ['h3', '仓库里有什么'],
      ['p', '中英双语的研究手稿、证明审计脚本，以及一套可复现的诊断流程。关键推理用 Lean 形式化，改动之后可以重新检查，而不是只靠读一遍。'],
      ['quote', '证明能跑通，才算写完。'],
      ['p', '手稿、脚本和检查结果放在一起，是为了让结论可以被别人复算，而不只是被相信。']
    ]
  },
  {
    id: 'note-gen', category: '工具', title: 'PDF 变成可回溯的笔记',
    date: '2026 年 10 月 19 日', lang: 'Python', stars: 0,
    url: 'https://github.com/LStar404/note-gen',
    blocks: [
      ['p', '把 PDF 拆成模块化的 Markdown / LaTeX 笔记：章节、公式、图表各自成为可编辑的块。'],
      ['h3', '双向定位'],
      ['p', '每个笔记块都记得自己来自原文的哪一页哪一段，点一下就能跳回去核对；反过来，原文的位置也能找到对应的笔记。'],
      ['p', '笔记可以增、删、改，顺序变了也不会丢掉和原文的对应关系。']
    ]
  },
  {
    id: 'pdf-compact', category: '工具', title: '不重扫一遍的 PDF 压缩',
    date: '2026 年 10 月 26 日', lang: 'Python', stars: 0,
    url: 'https://github.com/LStar404/pdf-compact',
    blocks: [
      ['p', '常见的 PDF 压缩会先光栅化再重新生成，文字和书签就没了。这个仓库走另一条路：只在文件结构层面做减重。'],
      ['h3', '具体做什么'],
      ['p', '合并重复的 TrueType 子集、对相同的数据流去重、把对象重新打包进对象流。整个过程纯 Python，不渲染页面。'],
      ['p', '结果是文件变小，文字仍然是文字，可以继续搜索和复制。']
    ]
  },
  {
    id: 'freenodesdaily', category: '网络', title: '每天测速、按速度排的免费节点',
    date: '2026 年 10 月 18 日', lang: 'Kotlin', stars: 0,
    url: 'https://github.com/LStar404/FreeNodesDaily',
    blocks: [
      ['p', '每天抓取公开的免费节点，逐个做真实隧道测速，按实测速度排序，剔除已经失效的。'],
      ['h3', '输出'],
      ['p', '按客户端格式分别导出 Clash / mihomo、sing-box、v2rayN 等订阅，附 Windows 流水线与 Android 端「节点管家」。'],
      ['p', '这个仓库是从上游 fork 之后继续维护的版本。']
    ]
  }
];

(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const grid = $('#article-grid');
  const dialog = $('#reader');
  const searchInput = $('#search-input');
  let category = '全部';
  let localDocs = [];
  let current = null;
  let focusBeforeReader = null;
  let routeVersion = 0;

  function notice(message) {
    const box = $('#app-notice');
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
  }

  function filterCards() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    let count = 0;
    $$('#article-grid > .post-card').forEach(card => {
      const id = card.dataset.id;
      const project = projects.find(item => item.id === id);
      const local = localDocs.find(item => item.id === card.dataset.local);
      const source = project || local;
      if (!source) { card.hidden = true; return; }
      const body = project
        ? project.blocks.map(block => block[1]).join(' ')
        : (window.HoshiRender?.plain(local.content, local.format) || local.content);
      const text = `${source.title} ${source.category} ${source.lang || ''} ${body}`.toLocaleLowerCase();
      const matchesCategory = category === '全部' || source.category === category;
      const matchesQuery = !query || text.includes(query);
      card.hidden = !(matchesCategory && matchesQuery);
      if (!card.hidden) count++;
    });
    $('#empty-state').hidden = count > 0;
    $('#results-status').textContent = `找到 ${count} 个项目`;
    const counter = $('.section-counter');
    if (counter) counter.textContent = `${String(count).padStart(2, '0')} 个项目`;
  }

  function localCard(doc) {
    const card = document.createElement('article');
    card.className = 'post-card local-post';
    card.dataset.local = doc.id;
    card.dataset.category = doc.category;
    const body = document.createElement('div');
    body.className = 'post-copy';
    const top = document.createElement('div');
    top.className = 'post-topline';
    const cat = document.createElement('span');
    cat.className = 'category-label';
    cat.textContent = doc.category;
    const format = document.createElement('span');
    format.className = 'format-badge';
    format.textContent = doc.format.toUpperCase();
    top.append(cat, format);
    const heading = document.createElement('h3');
    const link = document.createElement('a');
    link.href = `#local/${encodeURIComponent(doc.id)}`;
    link.textContent = doc.title || '未命名笔记';
    heading.append(link);
    const excerpt = document.createElement('p');
    excerpt.className = 'local-excerpt';
    excerpt.textContent = (window.HoshiRender?.plain(doc.content, doc.format) || doc.content).slice(0, 135) || '留一点空白，给下一次灵感。';
    const meta = document.createElement('div');
    meta.className = 'post-meta';
    const date = document.createElement('span');
    date.textContent = new Date(doc.updatedAt).toLocaleDateString('zh-CN');
    const status = document.createElement('span');
    status.className = 'demo-label';
    status.textContent = '仅本机';
    const edit = document.createElement('button');
    edit.className = 'local-edit';
    edit.textContent = '编辑';
    edit.addEventListener('click', () => window.HoshiStudio.open(doc.id));
    const arrow = document.createElement('a');
    arrow.className = 'post-arrow';
    arrow.href = link.href;
    arrow.setAttribute('aria-label', `阅读：${doc.title}`);
    arrow.textContent = '↗';
    meta.append(date, status, edit, arrow);
    body.append(top, heading, excerpt, meta);
    card.append(body);
    return card;
  }

  async function refreshDocs() {
    try {
      localDocs = (await window.HoshiStudio.list()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      $$('.local-post').forEach(node => node.remove());
      grid.prepend(...localDocs.filter(doc => doc.visible).map(localCard));
      filterCards();
    } catch {
      notice('本机笔记暂时无法读取。项目详情仍然可以查看。');
    }
  }

  $$('.filter').forEach(button => button.addEventListener('click', () => {
    category = button.dataset.category;
    $$('.filter').forEach(item => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    filterCards();
  }));

  function openSearch() {
    $('#search-area').hidden = false;
    $('#work').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    searchInput.focus({ preventScroll: true });
  }
  $('#search-toggle').addEventListener('click', openSearch);
  searchInput.addEventListener('input', filterCards);
  $('#search-clear').addEventListener('click', () => { searchInput.value = ''; filterCards(); searchInput.focus(); });
  $('#reset-filters').addEventListener('click', () => {
    searchInput.value = '';
    $('.filter[data-category="全部"]').click();
  });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !document.querySelector('dialog[open]') && !event.target.matches('input,textarea,[contenteditable="true"]')) {
      event.preventDefault();
      openSearch();
    }
  });

  function showReader(title, categoryName, meta, local = false) {
    $('#reader-title').textContent = title;
    $('#reader-category').textContent = categoryName;
    $('#reader-meta').textContent = meta;
    $('.sample-notice').textContent = local
      ? '本机笔记 · 内容保存在当前浏览器，记得在写作台导出备份。'
      : '项目详情，代码与提交记录在 GitHub。';
    $('#reader-edit').hidden = !local;
    if (!dialog.open) {
      focusBeforeReader = document.activeElement;
      dialog.showModal();
      document.body.classList.add('reading');
    }
    dialog.scrollTop = 0;
    document.title = `${title} · 星辰`;
    $('#reader-close').focus({ preventScroll: true });
  }

  async function syncRoute() {
    const version = ++routeVersion;
    const hash = location.hash;
    if (hash.startsWith('#local/')) {
      try {
        const doc = await window.HoshiStudio.get(decodeURIComponent(hash.slice(7)));
        if (version !== routeVersion) return;
        if (!doc) {
          notice('这篇笔记不在当前浏览器中。可在写作台导入对应备份。');
          if (dialog.open) dialog.close();
          return;
        }
        current = { type: 'local', id: doc.id };
        showReader(doc.title, doc.category, `${new Date(doc.updatedAt).toLocaleDateString('zh-CN')} · ${doc.format.toUpperCase()}`, true);
        $('#reader-repo').hidden = true;
        $('#reader-body').classList.add('rich-content');
        await window.HoshiRender.render($('#reader-body'), doc.content, doc.format);
      } catch (error) {
        notice(`笔记暂时无法打开：${error.message}`);
      }
      return;
    }
    if (hash.startsWith('#post/')) {
      const project = projects.find(item => item.id === hash.slice(6));
      if (project) {
        current = { type: 'project', id: project.id };
        showReader(project.title, project.category, `${project.date} 更新 · ${project.lang}${project.stars ? ` · ★ ${project.stars}` : ''}`);
        const repo = $('#reader-repo');
        repo.hidden = false;
        repo.href = project.url;
        const body = $('#reader-body');
        body.classList.remove('rich-content');
        body.replaceChildren(...project.blocks.map(([kind, text]) => {
          const node = document.createElement(kind === 'quote' ? 'blockquote' : kind);
          node.textContent = text;
          return node;
        }));
        return;
      }
    }
    if (dialog.open) dialog.close();
  }

  function closeReader() { dialog.close(); }
  $('#reader-close').addEventListener('click', closeReader);
  $('#reader-back').addEventListener('click', closeReader);
  $('#reader-home').addEventListener('click', closeReader);
  $('#reader-edit').addEventListener('click', () => { const id = current?.id; closeReader(); window.HoshiStudio.open(id); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeReader();
  });
  dialog.addEventListener('close', () => {
    ++routeVersion;
    document.body.classList.remove('reading');
    document.title = '星辰 · LStar404';
    if (/^#(?:post|local)\//.test(location.hash)) history.replaceState(null, '', '#work');
    if (focusBeforeReader?.isConnected) focusBeforeReader.focus({ preventScroll: true });
  });
  $('#wander')?.addEventListener('click', () => {
    const routes = [...projects.map(item => `post/${item.id}`), ...localDocs.filter(doc => doc.visible).map(doc => `local/${encodeURIComponent(doc.id)}`)];
    location.hash = routes[Math.floor(Math.random() * routes.length)];
  });
  $('#workspace-open')?.addEventListener('click', () => window.HoshiStudio.open());
  window.addEventListener('hashchange', syncRoute);
  window.addEventListener('hoshi:documents-changed', refreshDocs);
  $$('.nav-link').forEach(link => link.addEventListener('click', () => $$('.nav-link').forEach(item => item.classList.toggle('active', item === link))));
  $$('a[href="#home"]').forEach(link => link.addEventListener('click', () => $$('.nav-link').forEach(item => item.classList.toggle('active', item.hash === '#home'))));
  refreshDocs().then(syncRoute);
  filterCards();
})();
