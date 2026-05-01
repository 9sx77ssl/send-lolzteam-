// ==UserScript==
// @name         !send lolzteam analog cryptobot
// @namespace    https://img.lolz.work/
// @version      3.0.0
// @description  конверт бабок из lzt.market/currency как в кб 
// @author       lolz.live/gay1234
// @match        https://*lolz.live/*
// @grant        GM_xmlhttpRequest
// @connect      img.lolz.work
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function() {
  'use strict';
  const API_BASE = 'https://img.lolz.work';
  const PROC_ATTR = 'data-lzt-processing';
  const SEND_RE = /!send\s+([\d.]+)\s*([A-Za-z]+)\s+to\s+([A-Za-z]+)/i;
  const EDIT_SEL = 'div.fr-element.fr-view';
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
      const hidden = f.querySelector('textarea[name="message_html"], input[name="message_html"]');
      if (hidden) hidden.value = html;
      if (window.jQuery) { window.jQuery(ed).trigger('input').trigger('change'); window.jQuery(f).trigger('change'); }
    }
  };
  const notify = (m, err) => { if (window.XenForo?.alert) window.XenForo.alert(m, '', 3500); else console[err ? 'warn' : 'log'](`[LZT] ${m}`); };
  const findAndReplaceSend = async (ed) => {
    const text = getText(ed);
    const match = text.match(SEND_RE);
    if (!match) return false;
    try {
      const [, amount, from, to] = match;
      const query = `${amount}${from} to ${to}`;
      const d = await fetchJ(`${API_BASE}/api/convert?q=${encodeURIComponent(query)}`);
      const url = d.card_url;
      const cap = d.formatted?.caption || `${amount} ${from} = ${d.result} ${to}`;
      const cardHtml = `<img src="${esc(url)}" alt="${esc(cap)}" class="fr-fic fr-dib"/>`;
      const newContent = text.replace(SEND_RE, `<p>${cardHtml}</p><p><strong>${esc(cap)}</strong></p>`);
      setHtml(ed, newContent);
      return true;
    } catch(e) { notify(`❌ !send: ${e.message}`, true); return false; }
  };
  const forceSubmit = (form, btn) => {
    if (!form || form.hasAttribute(PROC_ATTR)) return;
    form.setAttribute(PROC_ATTR, '1');
    const submitBtn = btn || form.querySelector('.sendMessageContainer button[type="submit"], button.lzt-fe-se-sendMessageButton') || document.querySelector('.sendMessageContainer button[type="submit"], button.lzt-fe-se-sendMessageButton');
    setTimeout(() => {
      if (submitBtn && !submitBtn.disabled) {
        const e1 = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, buttons: 1 });
        const e2 = new MouseEvent('click', { bubbles: true, cancelable: true, view: window, detail: 1, buttons: 1 });
        submitBtn.dispatchEvent(e1);
        submitBtn.dispatchEvent(e2);
        submitBtn.focus();
        setTimeout(() => { if (form.hasAttribute(PROC_ATTR)) { const hidden = form.querySelector('textarea[name="message_html"], input[name="message_html"]'); if (hidden?.value) form.submit(); } }, 100);
      } else if (typeof form.requestSubmit === 'function') {
        form.requestSubmit(submitBtn);
      } else {
        form.submit();
      }
      setTimeout(() => form.removeAttribute(PROC_ATTR), 3000);
    }, 200);
  };
  const wait = (node, sel, cb) => {
    const obs = new MutationObserver((_, o) => { const el = node.querySelector(sel); if (el) { cb(el); o.disconnect(); } });
    obs.observe(node, { childList: true, subtree: true });
  };
  const initEditor = (container) => {
    wait(container, EDIT_SEL, (editor) => {
      editor.addEventListener('keydown', async (e) => {
        if (e.repeat || e.key !== 'Enter' || e.ctrlKey || e.shiftKey) return;
        if (!SEND_RE.test(getText(editor))) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const form = editor.closest('form');
        if (!form || form.hasAttribute(PROC_ATTR)) return;
        const ok = await findAndReplaceSend(editor);
        if (ok) { await new Promise(r => setTimeout(r, 200)); forceSubmit(form, null); }
      }, true);
      const wrap = editor.closest('.defEditor') || editor.closest('.fr-box.messageText') || editor.closest('form') || document.body;
      const sendBtn = wrap.querySelector('.sendMessageContainer button[type="submit"], button.lzt-fe-se-sendMessageButton') || document.querySelector('.sendMessageContainer button[type="submit"], button.lzt-fe-se-sendMessageButton');
      if (sendBtn) {
        sendBtn.addEventListener('click', async (e) => {
          if (editor.hasAttribute('data-busy')) return;
          editor.setAttribute('data-busy', '1');
          if (!SEND_RE.test(getText(editor))) { editor.removeAttribute('data-busy'); return; }
          const form = editor.closest('form');
          if (!form || form.hasAttribute(PROC_ATTR)) { editor.removeAttribute('data-busy'); return; }
          const ok = await findAndReplaceSend(editor);
          editor.removeAttribute('data-busy');
          if (ok) { e.preventDefault(); e.stopImmediatePropagation(); await new Promise(r => setTimeout(r, 200)); forceSubmit(form, sendBtn); }
        }, true);
      }
    });
  };
  const initAll = () => { document.querySelectorAll('div.defEditor, div.fr-box.messageText').forEach(initEditor); };
  initAll();
  new MutationObserver(ms => { ms.forEach(m => { m.addedNodes.forEach(n => { if (n.nodeType !== 1) return; if (n.classList?.contains('defEditor') || n.classList?.contains('messageText')) initEditor(n); n.querySelectorAll?.('div.defEditor, div.fr-box.messageText').forEach(initEditor); }); }); }).observe(document.body, { childList: true, subtree: true });
})();
