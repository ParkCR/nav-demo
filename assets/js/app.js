/* 公共工具：转义、复制、toast、新标签页打开、复制失败浮层、fetch JSON */

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

document.addEventListener('DOMContentLoaded', bindCopyFallback);