/* 总入口：读取 platforms.json 渲染平台卡片，并更新总入口免责声明 */

(async function () {
  const container = document.getElementById('platforms-list');
  if (!container) return;

  try {
    const platforms = await loadJson('data/platforms.json');
    if (!Array.isArray(platforms)) throw new Error('platforms.json 不是数组');

    const list = platforms
      .filter(p => p && p.enabled !== false)
      .sort((a, b) => {
        const oa = typeof a.order === 'number' ? a.order : Infinity;
        const ob = typeof b.order === 'number' ? b.order : Infinity;
        return oa - ob;
      });

    if (!list.length) {
      container.innerHTML = '<p class="empty">暂无可用平台</p>';
      return;
    }

    container.innerHTML = list.map(p => `
      <a class="platform-card" href="${escapeHtml(p.page)}">
        <span class="platform-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5"/>
          </svg>
        </span>
        <span class="platform-text">
          <span class="platform-name">${escapeHtml(p.name)}</span>
          ${p.fullName ? `<span class="platform-full">${escapeHtml(p.fullName)}</span>` : ''}
        </span>
        <span class="platform-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </span>
      </a>
    `).join('');

    const footer = document.getElementById('index-disclaimer');
    if (footer) {
      const names = list.map(p => p.name).join('、');
      footer.textContent = `本页面仅提供第三方线路跳转，不代理、不存储任何 ${names}内容，线路可用性由第三方决定。`;
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="empty">平台列表加载失败</p>';
  }
})();
