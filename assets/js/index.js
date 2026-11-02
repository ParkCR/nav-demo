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
        <span class="platform-name">${escapeHtml(p.name)}</span>
        <span class="platform-arrow">→</span>
      </a>
    `).join('');

    const footer = document.getElementById('index-disclaimer');
    if (footer) {
      const names = list.map(p => p.fullName || p.name).join('、');
      footer.textContent = `本页面仅提供第三方线路跳转，不代理、不存储任何 ${names}内容，线路可用性由第三方决定。`;
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="empty">平台列表加载失败</p>';
  }
})();