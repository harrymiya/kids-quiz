/* =====================================================================
   《深入理解 AI Agent》知识图谱 — 主题切换脚本 (theme.js)
   亮/暗双主题切换 · localStorage 记忆 · 防闪烁
   用法：每个页面在 <head> 引入 + 在 topbar spacer 后放
   <button class="theme-toggle" id="themeToggle" title="切换主题">☀️</button>
   ===================================================================== */
(function () {
  var KEY = 'aiagent-theme';

  function getTheme() {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (saved === 'light' || saved === 'dark') return saved;
    // 未设置过：跟随系统，默认深色
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    } catch (e) {}
    return 'dark';
  }

  function apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(KEY, t); } catch (e) {}
    var btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = t === 'light' ? '☀️' : '🌙';
    // 通知页面其他元素（可选）
    document.documentElement.dispatchEvent(new CustomEvent('themechange', { detail: t }));
  }

  // 立即设置（head 同步执行，避免 FOUC 闪白/闪黑）
  apply(getTheme());

  // DOM 就绪后绑定按钮
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
  function bind() {
    var btn = document.getElementById('themeToggle');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme');
        apply(cur === 'light' ? 'dark' : 'light');
      });
    }
  }
})();
