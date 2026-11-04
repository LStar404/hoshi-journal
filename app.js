'use strict';

// Replace these sample articles with your own writing. Plain text is rendered safely.
const posts = [
  { id: 'first-page', category: '日常碎片', title: '还没想好写什么，那就先开始吧。', date: '2026 年 11 月 4 日', blocks: [
    ['p', '一个空白页面，其实很像一本刚拆封的笔记本。明明有很多想写的东西，真正打开时，却又不知道第一句话该放在哪里。'],
    ['p', '想写点日常，担心太普通；想认真聊一个喜欢的东西，又怕自己还没有想清楚。于是“等准备好再开始”，就变成了一句特别顺口的话。'],
    ['h3', '给不完整的想法，一个位置'],
    ['p', '也许一个个人博客，并不需要从一篇像样的宣言开始。它可以先装下一张天空、一句突然想到的话，或是一段还没有结论的小小好奇。'],
    ['quote', '不必每一次记录都有意义。愿意留住它的那一刻，就已经足够。'],
    ['p', '完整的文章很好，三五句话也不错。今天不想写的时候，留白也算这个地方的一部分。这里没有必须更新的频率，也没有需要完成的漂亮人设。'],
    ['h3', '从今天的一小格开始'],
    ['p', '如果不知道第一篇应该写什么，就先问自己：今天，有没有哪个瞬间，我不希望明天就忘记？'],
    ['p', '可以是路边一片很好看的叶子，可以是一段恰好听懂的旋律，也可以是“终于给自己留了一个地方”。'],
    ['p', '先写下来吧。等回头看的时候，这些零零碎碎的小事，说不定已经连成了一段很喜欢的生活。']
  ]},
  { id: 'ordinary-magic', category: '二次元', title: '有些故事，让普通的一天发光', date: '2026 年 11 月 3 日', blocks: [
    ['p', '有一种故事，没有急着拯救世界，也没有一定要抵达的远方。它只是认真地画一朵云、一段放学的路，和两个人并肩走着的背影。'],
    ['p', '明明什么大事都没有发生，画面结束的时候，却会忽然觉得：今天好像也可以过得慢一点。'],
    ['h3', '喜欢那些被认真看见的小事'],
    ['p', '日常系故事的魔法，也许就在于注意力。夏天的光落在窗台上，便利店门口响起熟悉的提示音，杯子里的冰块轻轻碰了一下。那些本来会被忽略的声音和颜色，突然都有了自己的位置。'],
    ['quote', '不是每一个镜头都要推动剧情。有时候，停留本身就很好。'],
    ['p', '当故事愿意为一个微小的瞬间多停几秒，屏幕外的人也会慢慢学会，重新留意自己的日常。'],
    ['h3', '把一点温柔带回现实'],
    ['p', '走出故事之后，世界并没有立刻变得不一样。要处理的事情还在，天气也不一定晴朗。但也许下一次走到路口时，会愿意抬头看一看云。'],
    ['p', '一部作品留下来的，不一定是一句多么深刻的台词。有时候，只是让人觉得普通的一天，也值得好好度过。'],
    ['p', '那就把这种感觉，先收进口袋里。']
  ]},
  { id: 'little-site', category: '折腾手记', title: '从一个念头，到自己的小站', date: '2026 年 11 月 2 日', blocks: [
    ['p', '“想要一个自己的小站”，可能只是一闪而过的念头。真正开始想的时候，又会冒出许多问题：叫什么名字，用什么颜色，第一篇写什么，要不要准备好所有栏目？'],
    ['p', '这些问题都可以慢慢回答。第一版，只要先能让人舒服地读完一段文字，就已经迈出了一大步。'],
    ['h3', '先留下最想要的部分'],
    ['p', '一个有一点二次元气息的首页，一块安静的阅读区域，几处不打扰人的小细节。把想要的氛围先放进去，再决定接下来要长出什么。'],
    ['quote', '小站不一定要像一件完成的作品。它也可以是一个一直在生长的房间。'],
    ['p', '今天放一篇文章，明天改一行介绍。某天忽然喜欢上另一种颜色，再把它换掉。属于自己的地方，当然可以随着自己变化。'],
    ['h3', '轻一点，才更容易出发'],
    ['p', '漂亮和轻快，不需要互相让步。把图片做得合适一些，少一点不必要的加载，给文字留出空间，让每一次打开都尽量简单。'],
    ['p', '之后可以补上真实的自我介绍，整理喜欢的作品，写一份自己的折腾记录。现在，就先从这个小小的 Hello world 开始。'],
    ['p', '欢迎来到，一个还在慢慢生长的小世界。']
  ]}
];

(() => {
  const $ = (selector) => document.querySelector(selector);
  let category = '全部', localDocs = [], current = null, focusBeforeReader, routeVersion = 0;
  const dialog = $('#reader'), searchInput = $('#search-input');
  function notice(message) { $('#app-notice').textContent = message; $('#app-notice').hidden = !message; }
  function filterPosts() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    let count = 0;
    document.querySelectorAll('.post-card').forEach(card => {
      const post = card.dataset.local ? localDocs.find(p => p.id === card.dataset.local) : posts.find(p => p.id === card.dataset.id);
      if (!post) return;
      const isLocal = !!card.dataset.local;
      const content = isLocal ? post.content : post.blocks.map(b => b[1]).join(' ');
      const matches = (category === '全部' || post.category === category) && (!query || `${post.title} ${post.category} ${content}`.toLocaleLowerCase().includes(query));
      card.hidden = !(matches && (isLocal || $('#show-samples').checked));
      if (!card.hidden) count++;
    });
    $('#empty-state').hidden = count > 0;
    $('#results-status').textContent = `找到 ${count} 篇文章`;
    $('.section-counter').textContent = `${String(count).padStart(2,'0')} 篇小记`;
    document.querySelector('.filter[data-category="全部"] span').textContent = localDocs.filter(p=>p.visible).length + ($('#show-samples').checked ? posts.length : 0);
  }
  function localCard(doc) {
    const card = document.createElement('article'); card.className='post-card local-post'; card.dataset.local=doc.id;
    const body = document.createElement('div'); body.className='post-copy';
    const top = document.createElement('div'); top.className='post-topline';
    const cat = document.createElement('span'); cat.className='category-label'; cat.textContent=doc.category;
    const format = document.createElement('span'); format.className='format-badge'; format.textContent=doc.format.toUpperCase(); top.append(cat,format);
    const h = document.createElement('h3'); const link = document.createElement('a'); link.href=`#local/${encodeURIComponent(doc.id)}`; link.textContent=doc.title||'未命名小记'; h.append(link);
    const excerpt = document.createElement('p'); excerpt.className='local-excerpt'; excerpt.textContent=(window.HoshiRender?.plain(doc.content,doc.format)||doc.content).slice(0,135)||'留一点空白，给下一次灵感。';
    const meta = document.createElement('div'); meta.className='post-meta';
    const date = document.createElement('span'); date.textContent=new Date(doc.updatedAt).toLocaleDateString('zh-CN');
    const status=document.createElement('span'); status.className='demo-label';status.textContent='仅本机';
    const edit=document.createElement('button');edit.className='local-edit';edit.textContent='编辑';edit.addEventListener('click',()=>window.HoshiStudio.open(doc.id));
    const arrow=document.createElement('a');arrow.className='post-arrow';arrow.href=link.href;arrow.setAttribute('aria-label',`阅读：${doc.title}`);arrow.textContent='↗';meta.append(date,status,edit,arrow);
    body.append(top,h,excerpt,meta);card.append(body);return card;
  }
  async function refreshDocs() {
    try {
      localDocs = (await window.HoshiStudio.list()).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
      document.querySelectorAll('.local-post').forEach(e=>e.remove());
      $('#article-grid').prepend(...localDocs.filter(d=>d.visible).map(localCard));
      filterPosts();
    } catch(error) { notice('本机文章暂时无法读取。你仍可阅读示例，或打开写作台查看保存状态。'); }
  }
  document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{
    category=button.dataset.category;
    document.querySelectorAll('.filter').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-pressed',String(item===button));});filterPosts();
  }));
  try { $('#show-samples').checked = localStorage.getItem('hoshi-show-samples') !== 'false'; } catch {}
  $('#show-samples').addEventListener('change',()=>{try{localStorage.setItem('hoshi-show-samples',String($('#show-samples').checked));}catch{}filterPosts();});
  function openSearch(){ $('#search-area').hidden=false;$('#journal').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});searchInput.focus({preventScroll:true}); }
  $('#search-toggle').addEventListener('click',openSearch);searchInput.addEventListener('input',filterPosts);
  $('#search-clear').addEventListener('click',()=>{searchInput.value='';filterPosts();searchInput.focus();});
  $('#reset-filters').addEventListener('click',()=>{searchInput.value='';$('#show-samples').checked=true;document.querySelector('.filter[data-category="全部"]').click();});
  document.addEventListener('keydown',event=>{
    if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!document.querySelector('dialog[open]')&&!event.target.matches('input,textarea,[contenteditable="true"]')){event.preventDefault();openSearch();}
  });
  function showReader(title,category,meta,local=false){
    $('#reader-title').textContent=title;$('#reader-category').textContent=category;$('#reader-meta').textContent=meta;
    $('.sample-notice').textContent=local?'本机文章 · 内容保存在当前浏览器，记得在写作台导出备份。':'这是一篇用于展示阅读体验的示例文章，可替换成你的真实内容。';
    $('#reader-edit').hidden=!local;
    if(!dialog.open){focusBeforeReader=document.activeElement;dialog.showModal();document.body.classList.add('reading');}
    dialog.scrollTop=0;document.title=`${title} · 星间小记`;$('#reader-close').focus({preventScroll:true});
  }
  async function syncRoute(){
    const version=++routeVersion;const hash=location.hash;
    if(hash.startsWith('#local/')){
      try {
        const doc=await window.HoshiStudio.get(decodeURIComponent(hash.slice(7)));
        if(version!==routeVersion)return;
        if(!doc){notice('这篇文章不在当前浏览器中。可在写作台导入对应备份。');if(dialog.open)dialog.close();return;}
        current={type:'local',id:doc.id};showReader(doc.title,doc.category,`${new Date(doc.updatedAt).toLocaleDateString('zh-CN')} · ${doc.format.toUpperCase()}`,true);
        $('#reader-body').classList.add('rich-content');await window.HoshiRender.render($('#reader-body'),doc.content,doc.format);
      }catch(error){notice(`文章暂时无法打开：${error.message}`);}
      return;
    }
    if(hash.startsWith('#post/')){
      const index=posts.findIndex(p=>p.id===hash.slice(6));
      if(index>=0){const post=posts[index];current={type:'sample',index};showReader(post.title,post.category,`${post.date} · 约 2 分钟阅读`);
        const body=$('#reader-body');body.classList.remove('rich-content');body.replaceChildren(...post.blocks.map(([kind,text])=>{const node=document.createElement(kind==='quote'?'blockquote':kind);node.textContent=text;return node;}));return;}
    }
    if(dialog.open)dialog.close();
  }
  function closeReader(){dialog.close();}
  $('#reader-close').addEventListener('click',closeReader);$('#reader-back').addEventListener('click',closeReader);$('#reader-home').addEventListener('click',closeReader);
  $('#reader-edit').addEventListener('click',()=>{const id=current?.id;closeReader();window.HoshiStudio.open(id);});
  $('#reader-next').addEventListener('click',()=>{
    if(current?.type==='local'){const docs=localDocs.filter(d=>d.visible);const next=docs[(docs.findIndex(d=>d.id===current.id)+1)%docs.length];if(next)location.hash=`local/${encodeURIComponent(next.id)}`;}
    else location.hash=`post/${posts[((current?.index||0)+1)%posts.length].id}`;
  });
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeReader();});
  dialog.addEventListener('close',()=>{++routeVersion;document.body.classList.remove('reading');document.title='星间小记 · 把喜欢的事，慢慢写成生活';if(/^#(?:post|local)\//.test(location.hash))history.replaceState(null,'','#journal');if(focusBeforeReader?.isConnected)focusBeforeReader.focus({preventScroll:true});});
  $('#wander').addEventListener('click',()=>{const routes=[...posts.map(p=>`post/${p.id}`),...localDocs.filter(d=>d.visible).map(d=>`local/${encodeURIComponent(d.id)}`)];location.hash=routes[Math.floor(Math.random()*routes.length)];});
  $('#workspace-open').addEventListener('click',()=>window.HoshiStudio.open());
  window.addEventListener('hashchange',syncRoute);window.addEventListener('hoshi:documents-changed',refreshDocs);
  document.querySelectorAll('.nav-link').forEach(link=>link.addEventListener('click',()=>document.querySelectorAll('.nav-link').forEach(item=>item.classList.toggle('active',item===link))));
  document.querySelectorAll('a[href="#home"]').forEach(link=>link.addEventListener('click',()=>document.querySelectorAll('.nav-link').forEach(item=>item.classList.toggle('active',item.hash==='#home'))));
  refreshDocs().then(syncRoute);filterPosts();
})();

