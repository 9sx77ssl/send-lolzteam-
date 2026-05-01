// ==UserScript==
// @name         !send lolzteam analog cryptobot
// @namespace    https://img.lolz.work/
// @version      1.5.0
// @description  конверт бабок из lzt.market/currency как в кб
// @author       lolz.live/gay1234
// @match        https://lolz.live/*
// @match        https://*.lolz.live/*
// @grant        GM_xmlhttpRequest
// @connect      img.lolz.work
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function() {
  'use strict';
  const API_BASE = 'https://img.lolz.work';
  const PROC_ATTR = 'data-lzt-processing';
  const SEND_RE = /^\s*!send\s+(.+?)\s*$/i;
  const EDIT_SEL = "div.fr-element.fr-view";
  const esc = v => String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const fetchJ = url => new Promise((ok, no) => {
    GM_xmlhttpRequest({ method: 'GET', url, timeout: 8000,
      onload: r => { try { const j = JSON.parse(r.responseText || '{}'); (r.status >= 200 && r.status < 300 && j.ok) ? ok(j) : no(new Error(j.error || `HTTP ${r.status}`)); } catch(e) { no(e); } },
      onerror: () => no(new Error('net')), ontimeout: () => no(new Error('to')) });
  });
  const getText = ed => (ed.innerText || ed.textContent || '').replace(/\u00a0/g, ' ').trim();
  const setHtml = (ed, html) => {
    ed.innerHTML = html;
    ed.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertHTML' }));
    ed.dispatchEvent(new Event('change', { bubbles: true }));
    const f = ed.closest('form');
    if (f) {
      f.querySelectorAll('textarea[name="message_html"], input[name="message_html"]').forEach(x => x.value = html);
      if (window.jQuery) window.jQuery(f).trigger('change');
    }
    if (window.jQuery) window.jQuery(ed).trigger('input').trigger('change');
  };
  const notify = (m, err) => { if (window.XenForo?.alert) window.XenForo.alert(m, '', 3500); else console[err ? 'warn' : 'log'](`[LZT] ${m}`); };
  const process = async (ed) => {
    const t = getText(ed), m = t.match(SEND_RE);
    if (!m) return false;
    try {
      const q = m[1].trim(), d = await fetchJ(`${API_BASE}/api/convert?q=${encodeURIComponent(q)}`);
      const url = d.card_url, cap = d.formatted?.caption || `${d.amount} ${d.from} = ${d.result} ${d.to}`;
      setHtml(ed, `<p><img src="${esc(url)}" alt="${esc(cap)}" class="fr-fic fr-dib"/></p><p><strong>${esc(cap)}</strong></p>`);
      return true;
    } catch(e) { notify(`❌ !send: ${e.message}`, true); return false; }
  };
  const doSubmit = (form, btn) => {
    if (form.hasAttribute(PROC_ATTR)) return;
    form.setAttribute(PROC_ATTR, '1');
    setTimeout(() => {
      if (btn && !btn.disabled) {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, detail: 1 }));
        setTimeout(() => { if (!form.hasAttribute(PROC_ATTR)) btn.click(); }, 20);
      } else if (typeof form.requestSubmit === 'function') {
        form.requestSubmit(btn);
      } else { form.submit(); }
      setTimeout(() => form.removeAttribute(PROC_ATTR), 2000);
    }, 100);
  };
  const wait = (node, sel, cb) => {
    const obs = new MutationObserver((_, o) => { const el = node.querySelector(sel); if (el) { cb(el); o.disconnect(); } });
    obs.observe(node, { childList: true, subtree: true });
  };
  const init = (container) => {
    wait(container, EDIT_SEL, (editor) => {
      editor.addEventListener('keydown', async (e) => {
        if (e.repeat || e.key !== 'Enter' || e.ctrlKey || e.shiftKey) return;
        const t = getText(editor);
        if (!SEND_RE.test(t)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const form = editor.closest('form');
        if (!form || form.hasAttribute(PROC_ATTR)) return;
        const ok = await process(editor);
        if (ok) {
          await new Promise(r => setTimeout(r, 120));
          doSubmit(form, null);
        }
      }, true);
      const wrap = editor.closest('.defEditor') || editor.closest('form') || document.body;
      const btn = wrap.querySelector('.sendMessageContainer button[type="submit"], button.lzt-fe-se-sendMessageButton');
      if (btn) {
        btn.addEventListener('click', async (e) => {
          if (editor.hasAttribute('data-busy') || e.detail !== 1) return;
          editor.setAttribute('data-busy', '1');
          const t = getText(editor);
          if (!SEND_RE.test(t)) { editor.removeAttribute('data-busy'); return; }
          const form = editor.closest('form');
          if (!form || form.hasAttribute(PROC_ATTR)) { editor.removeAttribute('data-busy'); return; }
          const ok = await process(editor);
          editor.removeAttribute('data-busy');
          if (ok) {
            e.preventDefault();
            e.stopImmediatePropagation();
            await new Promise(r => setTimeout(r, 120));
            doSubmit(form, btn);
          }
        }, true);
      }
    });
  };
  document.querySelectorAll('div.defEditor').forEach(init);
  new MutationObserver(ms => { ms.forEach(m => { m.addedNodes.forEach(n => { if (n.nodeType !== 1) return; if (n.classList?.contains('defEditor')) init(n); n.querySelectorAll?.('div.defEditor').forEach(init); }); }); }).observe(document.body, { childList: true, subtree: true });
})();
