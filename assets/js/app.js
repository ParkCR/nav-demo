/* 公共工具：转义、复制、toast、新标签页打开、复制失败浮层、fetch JSON、主题切换 */

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { toast.hidden = true; }, 2200);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fallback */ }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

function openInNewTab(url) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function showCopyFallback(username) {
  const box = document.getElementById('copy-fallback');
  const input = document.getElementById('copy-fallback-input');
  if (!box || !input) return;
  input.value = username;
  box.hidden = false;
  setTimeout(() => { input.focus(); input.select(); }, 0);
}

function bindCopyFallback() {
  const box = document.getElementById('copy-fallback');
  const input = document.getElementById('copy-fallback-input');
  const retry = document.getElementById('copy-fallback-retry');
  const close = document.getElementById('copy-fallback-close');
  if (!box || !input || !retry || !close) return;

  retry.addEventListener('click', async () => {
    input.select();
    const ok = await copyText(input.value);
    if (ok) {
      showToast('已复制 ' + input.value);
      box.hidden = true;
    } else {
      showToast('复制失败，请手动选择复制');
    }
  });

  close.addEventListener('click', () => { box.hidden = true; });
}

async function loadJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error('加载失败：' + path + ' (' + res.status + ')');
  return res.json();
}

/* ---------- 主题切换：默认跟随系统 + 手动覆盖 + localStorage 持久化 ---------- */
function initTheme() {
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');
  const KEY = 'theme';
  const mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function getStoredTheme() {
    try {
      const v = localStorage.getItem(KEY);
      return (v === 'light' || v === 'dark') ? v : null;
    } catch (e) {
      return null;
    }
  }

  function systemTheme() {
    return (mql && mql.matches) ? 'dark' : 'light';
  }

  function effectiveTheme() {
    return getStoredTheme() || systemTheme();
  }

  function updateButton(theme) {
    if (!btn) return;
    const isDark = theme === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.setAttribute('aria-label', isDark ? '切换到亮色模式' : '切换到暗色模式');
    btn.setAttribute('title', isDark ? '切换到亮色模式' : '切换到暗色模式');
    btn.setAttribute('aria-pressed', String(isDark));
  }

  function syncFromStorage() {
    const stored = getStoredTheme();
    if (stored) {
      root.setAttribute('data-theme', stored);
    } else {
      // 无存储时移除手动主题，让 CSS 的 prefers-color-scheme 接管
      root.removeAttribute('data-theme');
    }
    updateButton(effectiveTheme());
  }

  // head 内防闪烁脚本已提前设置 data-theme，这里同步按钮并兜底
  syncFromStorage();

  if (btn) {
    btn.addEventListener('click', function () {
      const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (e) { /* 隐私模式忽略 */ }
      root.setAttribute('data-theme', next);
      updateButton(next);
    });
  }

  // 无手动存储时，系统主题变化只更新按钮，CSS 自动跟随
  if (mql) {
    const onChange = function () {
      if (!getStoredTheme()) updateButton(systemTheme());
    };
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
    } else if (mql.addListener) {
      mql.addListener(onChange);
    }
  }
}

document.addEventListener('DOMContentLoaded', function () {
  bindCopyFallback();
  initTheme();
});
