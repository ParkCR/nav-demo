/* 平台页：读取 ?id=，加载对应平台的 routes / follows，渲染交互 */

(function () {
  const TYPE_LABELS = {
    redirect: '直接打开',
    manual_copy: '复制用户名后打开'
  };

  /* 线路类型图标（内联 SVG，stroke 跟随 currentColor） */
  const TYPE_ICONS = {
    redirect: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    manual_copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  };

  const DEFAULT_USERNAME_PATTERN = /^[A-Za-z0-9._]+$/;

  const state = {
    config: null,
    routes: [],
    follows: [],
    currentRouteIndex: 0,
    selectedTags: new Set(),
    searchText: '',
    grouped: false,
    parsedUsername: ''
  };

  /* ---------- 解析 ---------- */

  function getDomains(config) {
    if (!config) return [];
    if (Array.isArray(config.domains) && config.domains.length) return config.domains;
    if (config.domain) return [config.domain];
    return [];
  }

  function hostMatches(host, domain) {
    return host === domain || host.endsWith('.' + domain);
  }

  function normalizeUsername(s, config) {
    if (!s) return '';
    const pattern = config && config.usernamePattern
      ? new RegExp(config.usernamePattern)
      : DEFAULT_USERNAME_PATTERN;
    return pattern.test(s) ? s : '';
  }

  function parseUsername(raw, config) {
    if (raw == null) return '';
    let s = String(raw).trim();
    if (!s) return '';
    if (s.startsWith('@')) s = s.slice(1).trim();
    if (!s) return '';

    const domains = getDomains(config);

    const urlLike =
      /^https?:\/\//i.test(s) ||
      /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\//i.test(s);

    if (urlLike) {
      if (!domains.length) return '';
      let url;
      try {
        url = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
      } catch (e) {
        return '';
      }
      const host = url.hostname.toLowerCase();
      if (!domains.some(d => hostMatches(host, d))) return '';

      const segs = url.pathname.split('/').filter(Boolean);
      if (!segs.length) return '';

      const reserved = (config.reservedPaths || []).map(p => String(p).toLowerCase());
      if (reserved.includes(segs[0].toLowerCase())) return '';

      const idx = (config.pathSegment || 1) - 1;
      if (!segs[idx]) return '';
      return normalizeUsername(segs[idx], config);
    }

    return normalizeUsername(s, config);
  }

  /* ---------- 页面元信息 ---------- */

  function setPageTitle(config) {
    const title = document.getElementById('page-title');
    if (title) title.textContent = config.name + ' web';
    document.title = config.name + ' web - nav-demo';
  }

  function setDisclaimer(config) {
    const el = document.getElementById('disclaimer');
    if (!el) return;
    const full = config.fullName || config.name || '该平台';
    el.textContent = `本页面仅提供第三方线路跳转，不代理、不存储任何 ${full}内容，线路可用性由第三方决定。`;
  }

  /* ---------- 线路 ---------- */

  function renderRouteSelector() {
    const select = document.getElementById('route-select');
    if (!select) return;
    if (!state.routes.length) {
      select.innerHTML = '<option value="">无可用线路</option>';
      return;
    }
    select.innerHTML = state.routes.map((r, i) =>
      `<option value="${i}">${escapeHtml(r.name)}</option>`
    ).join('');
    select.value = String(state.currentRouteIndex);
    updateRouteBadge();
  }

  function updateRouteBadge() {
    const badge = document.getElementById('route-badge');
    if (!badge) return;
    const route = state.routes[state.currentRouteIndex];
    if (!route) {
      badge.textContent = '';
      badge.className = 'badge';
      return;
    }
    badge.textContent = TYPE_LABELS[route.type] || route.type;
    badge.className = 'badge badge-' + (route.type || '');
  }

  function renderParsedRoutes() {
    const routesEl = document.getElementById('parse-routes');
    if (!routesEl) return;
    routesEl.innerHTML = state.routes.map((r, i) => {
      const active = i === state.currentRouteIndex ? ' active' : '';
      return `<button type="button" class="route-btn${active}" data-index="${i}">
        <span class="route-ico" aria-hidden="true">${TYPE_ICONS[r.type] || ''}</span>
        ${escapeHtml(r.name)}
        <span class="badge badge-${r.type}">${TYPE_LABELS[r.type] || ''}</span>
      </button>`;
    }).join('');
  }

  function updateParse(raw) {
    const resultBox = document.getElementById('parse-result');
    const errorBox = document.getElementById('parse-error');
    const nameEl = document.getElementById('parsed-name');
    if (!resultBox || !errorBox || !nameEl) return;

    const parsed = parseUsername(raw, state.config);
    state.parsedUsername = parsed;

    if (!parsed) {
      resultBox.hidden = true;
      const trimmed = String(raw || '').trim();
      if (!trimmed) {
        errorBox.hidden = true;
      } else {
        errorBox.hidden = false;
        errorBox.textContent = '请输入用户名或主页链接';
      }
      return;
    }

    errorBox.hidden = true;
    resultBox.hidden = false;
    nameEl.textContent = parsed;
    renderParsedRoutes();
  }

  /* ---------- 关注列表 ---------- */

  function getFilteredFollows() {
    let list = state.follows;
    const q = state.searchText.trim().toLowerCase();
    if (q) {
      list = list.filter(f => {
        const u = (f.username || '').toLowerCase();
        const d = (f.displayName || '').toLowerCase();
        const n = (f.note || '').toLowerCase();
        return u.includes(q) || d.includes(q) || n.includes(q);
      });
    }
    if (state.selectedTags.size > 0) {
      list = list.filter(f => (f.tags || []).some(t => state.selectedTags.has(t)));
    }
    return list;
  }

  function followCardHtml(f) {
    const displayName = (f.displayName || f.username || '').trim();
    const initial = (displayName || f.username || '?').charAt(0).toUpperCase();
    const route = state.routes[state.currentRouteIndex];

    const tags = (f.tags || []).map(t =>
      `<span class="tag">${escapeHtml(t)}</span>`
    ).join('');

    const note = f.note
      ? `<div class="card-note" title="${escapeHtml(f.note)}">${escapeHtml(f.note)}</div>`
      : '';

    return `
      <article class="follow-card" data-username="${escapeHtml(f.username)}"
               tabindex="0" role="button" aria-label="打开 ${escapeHtml(f.username)}">
        <div class="avatar" aria-hidden="true">${escapeHtml(initial)}</div>
        <div class="card-body">
          <div class="card-title" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</div>
          <div class="card-username">@${escapeHtml(f.username)}</div>
          ${note}
          ${tags ? `<div class="card-tags">${tags}</div>` : ''}
          ${route ? `
          <div class="card-spacer" aria-hidden="true"></div>
          <div class="card-route">
            <span class="route-ico" aria-hidden="true">${TYPE_ICONS[route.type] || ''}</span>
            <span class="route-name">当前线路：${escapeHtml(route.name)}</span>
            <svg class="route-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </div>` : ''}
        </div>
      </article>
    `;
  }

  function renderTagFilter() {
    const container = document.getElementById('tag-filter');
    if (!container) return;
    const allTags = new Set();
    for (const f of state.follows) {
      (f.tags || []).forEach(t => allTags.add(t));
    }
    container.innerHTML = Array.from(allTags).map(t => {
      const active = state.selectedTags.has(t) ? ' active' : '';
      return `<button type="button" class="tag-chip${active}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`;
    }).join('');
  }

  function renderFollows() {
    const container = document.getElementById('follows-list');
    if (!container) return;
    const list = getFilteredFollows();

    if (!list.length) {
      container.innerHTML = '<p class="empty">没有匹配的博主</p>';
      return;
    }

    if (!state.grouped) {
      container.innerHTML = `<div class="cards-grid">${list.map(followCardHtml).join('')}</div>`;
      return;
    }

    const groups = new Map();
    const untagged = [];
    for (const f of list) {
      const tags = f.tags || [];
      if (!tags.length) { untagged.push(f); continue; }
      for (const t of tags) {
        if (!groups.has(t)) groups.set(t, []);
        groups.get(t).push(f);
      }
    }

    let html = '';
    for (const [tag, items] of groups) {
      html += `
        <div class="group">
          <h3 class="group-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>${escapeHtml(tag)}</h3>
          <div class="cards-grid">${items.map(followCardHtml).join('')}</div>
        </div>
      `;
    }
    if (untagged.length) {
      html += `
        <div class="group">
          <h3 class="group-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>未分类</h3>
          <div class="cards-grid">${untagged.map(followCardHtml).join('')}</div>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  /* ---------- 线路执行 ---------- */

  async function executeRoute(route, username) {
    if (!route || !username) return;

    if (route.type === 'redirect') {
      if (!route.urlTemplate) return;
      const url = route.urlTemplate.replace('{username}', encodeURIComponent(username));
      openInNewTab(url);
      return;
    }

    if (route.type === 'manual_copy') {
      if (!route.openUrl) return;
      openInNewTab(route.openUrl);
      const ok = await copyText(username);
      if (ok) {
        showToast('已复制 ' + username);
      } else {
        showCopyFallback(username);
      }
    }
  }

  /* ---------- 事件 ---------- */

  function bindEvents() {
    const select = document.getElementById('route-select');
    if (select) {
      select.addEventListener('change', e => {
        state.currentRouteIndex = Number(e.target.value) || 0;
        updateRouteBadge();
        renderFollows();
        renderParsedRoutes();
      });
    }

    const search = document.getElementById('search-input');
    if (search) {
      search.addEventListener('input', e => {
        state.searchText = e.target.value;
        renderFollows();
      });
    }

    const groupToggle = document.getElementById('group-toggle');
    if (groupToggle) {
      groupToggle.addEventListener('change', e => {
        state.grouped = !!e.target.checked;
        renderFollows();
      });
    }

    const tagFilter = document.getElementById('tag-filter');
    if (tagFilter) {
      tagFilter.addEventListener('click', e => {
        const btn = e.target.closest('.tag-chip');
        if (!btn) return;
        const tag = btn.dataset.tag;
        if (state.selectedTags.has(tag)) state.selectedTags.delete(tag);
        else state.selectedTags.add(tag);
        renderTagFilter();
        renderFollows();
      });
    }

    const followsList = document.getElementById('follows-list');
    if (followsList) {
      followsList.addEventListener('click', e => {
        const card = e.target.closest('.follow-card');
        if (!card) return;
        executeRoute(state.routes[state.currentRouteIndex], card.dataset.username);
      });
      followsList.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const card = e.target.closest('.follow-card');
        if (!card) return;
        e.preventDefault();
        executeRoute(state.routes[state.currentRouteIndex], card.dataset.username);
      });
    }

    const input = document.getElementById('username-input');
    if (input) {
      input.addEventListener('input', e => updateParse(e.target.value));
    }

    const parseRoutes = document.getElementById('parse-routes');
    if (parseRoutes) {
      parseRoutes.addEventListener('click', async e => {
        const btn = e.target.closest('.route-btn');
        if (!btn) return;
        const idx = Number(btn.dataset.index) || 0;
        const username = state.parsedUsername;
        if (!username) return;

        state.currentRouteIndex = idx;
        if (select) select.value = String(idx);
        updateRouteBadge();
        renderFollows();
        renderParsedRoutes();

        await executeRoute(state.routes[idx], username);
      });
    }
  }

  /* ---------- 初始化 ---------- */

  function showPlatformError() {
    const title = document.getElementById('page-title');
    if (title) title.textContent = '平台不存在';
    document.title = '平台不存在 - nav-demo';

    const content = document.getElementById('platform-content');
    const error = document.getElementById('platform-error');
    if (content) content.hidden = true;
    if (error) error.hidden = false;

    const disclaimer = document.getElementById('disclaimer');
    if (disclaimer && !disclaimer.textContent) {
      disclaimer.textContent = '本页面仅提供第三方线路跳转，不代理、不存储任何平台内容，线路可用性由第三方决定。';
    }
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    const platformId = (params.get('id') || '').trim();
    if (!platformId) {
      showPlatformError();
      return;
    }

    try {
      const platforms = await loadJson('data/platforms.json');
      if (!Array.isArray(platforms)) throw new Error('platforms.json 不是数组');

      const config = platforms.find(p => p && p.id === platformId && p.enabled !== false);
      if (!config) {
        showPlatformError();
        return;
      }

      state.config = config;
      setPageTitle(config);
      setDisclaimer(config);

      const [routesRaw, followsRaw] = await Promise.all([
        loadJson('data/' + config.id + '/routes.json'),
        loadJson('data/' + config.id + '/follows.json')
      ]);

      if (!Array.isArray(routesRaw)) throw new Error('routes.json 不是数组');
      if (!Array.isArray(followsRaw)) throw new Error('follows.json 不是数组');

      state.routes = routesRaw.filter(r => r && r.enabled !== false && r.name && r.type);
      state.follows = followsRaw.filter(f => f && typeof f.username === 'string' && f.username.trim());
      state.currentRouteIndex = 0;

      const content = document.getElementById('platform-content');
      if (content) content.hidden = false;

      renderRouteSelector();
      renderTagFilter();
      renderFollows();
      bindEvents();
    } catch (err) {
      console.error(err);
      showPlatformError();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
