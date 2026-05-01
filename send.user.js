// ==UserScript==
// @name         !send lolzteam analog cryptobot
// @namespace    https://img.lolz.work/
// @version      2.0.0
// @description  конверт бабок из lzt.market/currency как в кб + чат
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
  const FORUM_EDIT_SEL = "div.fr-element.fr-view";
  const CHAT_EDIT_SEL = "div.tiptap.ProseMirror[contenteditable='true']";
  const esc = v => String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const fetchJ = url => new Promise((ok, no) => {
    GM_xmlhttpRequest({ method: 'GET', url, timeout: 8000,
      onload: r => { try { const j = JSON.parse(r.responseText || '{}'); (r.status >= 200 && r.status < 300 && j.ok) ? ok(j) : no(new Error(j.error || `HTTP ${r.status}`)); } catch(e) { no(e); } },
      onerror: () => no(new Error('net')), ontimeout: () => no(new Error('to')) });
  });
  const getText = ed => (ed.innerText || ed.textContent || '').replace(/\u00a0/g, ' ').trim();
  const setForumHtml = (ed, html) => {
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
  const setChatHtml = (ed, html) => {
    ed.innerHTML = html;
    ed.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertHTML' }));
    ed.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const notify = (m, err) => { if (window.XenForo?.alert) window.XenForo.alert(m, '', 3500); else console[err ? 'warn' : 'log'](`[LZT] ${m}`); };
  const process = async (ed, isChat) => {
    const t = getText(ed), m = t.match(SEND_RE);
    if (!m) return false;
    try {
      const q = m[1].trim(), d = await fetchJ(`${API_BASE}/api/convert?q=${encodeURIComponent(q)}`);
      const url = d.card_url, cap = d.formatted?.caption || `${d.amount} ${d.from} = ${d.result} ${d.to}`;
      const html = `<p><img src="${esc(url)}" alt="${esc(cap)}" class="fr-fic fr-dib"/></p><p><strong>${esc(cap)}</strong></p>`;
      isChat ? setChatHtml(ed, html) : setForumHtml(ed, html);
      return true;
    } catch(e) { notify(`❌ !send: ${e.message}`, true); return false; }
  };
  const doForumSubmit = (form, btn) => {
    if (form.hasAttribute(PROC_ATTR)) return;
    form.setAttribute(PROC_ATTR, '1');
    setTimeout(() => {
      const b = btn || form.querySelector('.sendMessageContainer button[type="submit"], button.lzt-fe-se-sendMessageButton');
      if (b && !b.disabled) {
        b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, detail: 1 }));
        setTimeout(() => { if (!form.hasAttribute(PROC_ATTR)) b.click(); }, 20);
      } else if (typeof form.requestSubmit === 'function') {
        form.requestSubmit(btn || b);
      } else { form.submit(); }
      setTimeout(() => form.removeAttribute(PROC_ATTR), 2000);
    }, 100);
  };
  const doChatSubmit = (btn) => {
    if (btn.hasAttribute(PROC_ATTR)) return;
    btn.setAttribute(PROC_ATTR, '1');
    setTimeout(() => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, detail: 1 }));
      setTimeout(() => { if (!btn.hasAttribute(PROC_ATTR)) btn.click(); }, 20);
      setTimeout(() => btn.removeAttribute(PROC_ATTR), 2000);
    }, 100);
  };
  const wait = (node, sel, cb) => {
    const obs = new MutationObserver((_, o) => { const el = node.querySelector(sel); if (el) { cb(el); o.disconnect(); } });
    obs.observe(node, { childList: true, subtree: true });
  };
  const initForumEditor = (container) => {
    wait(container, FORUM_EDIT_SEL, (editor) => {
      editor.addEventListener('keydown', async (e) => {
        if (e.repeat || e.key !== 'Enter' || e.ctrlKey || e.shiftKey) return;
        const t = getText(editor);
        if (!SEND_RE.test(t)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const form = editor.closest('form');
        if (!form || form.hasAttribute(PROC_ATTR)) return;
        const ok = await process(editor, false);
        if (ok) { await new Promise(r => setTimeout(r, 120)); doForumSubmit(form, null); }
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
          const ok = await process(editor, false);
          editor.removeAttribute('data-busy');
          if (ok) { e.preventDefault(); e.stopImmediatePropagation(); await new Promise(r => setTimeout(r, 120)); doForumSubmit(form, btn); }
        }, true);
      }
    });
  };
  const initChatEditor = (container) => {
    wait(container, CHAT_EDIT_SEL, (editor) => {
      editor.addEventListener('keydown', async (e) => {
        if (e.repeat || e.key !== 'Enter' || e.ctrlKey || e.shiftKey || e.metaKey) return;
        const t = getText(editor);
        if (!SEND_RE.test(t)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const ok = await process(editor, true);
        if (ok) { await new Promise(r => setTimeout(r, 120)); editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); }
      }, true);
      const chatBox = editor.closest('.editor-box') || document.body;
      const btn = chatBox.querySelector('button.submit-btn[aria-label="send-message"], button.lztng-9nis60');
      if (btn) {
        btn.addEventListener('click', async (e) => {
          if (editor.hasAttribute('data-busy') || e.detail !== 1) return;
          editor.setAttribute('data-busy', '1');
          const t = getText(editor);
          if (!SEND_RE.test(t)) { editor.removeAttribute('data-busy'); return; }
          const ok = await process(editor, true);
          editor.removeAttribute('data-busy');
          if (ok) { e.preventDefault(); e.stopImmediatePropagation(); await new Promise(r => setTimeout(r, 120)); doChatSubmit(btn); }
        }, true);
      }
    });
  };
  document.querySelectorAll('div.defEditor').forEach(initForumEditor);
  document.querySelectorAll('div.tiptap.ProseMirror').forEach(ed => { if (ed.isContentEditable) initChatEditor(ed.closest('.editor-box') || ed); });
  new MutationObserver(ms => {
    ms.forEach(m => {
      m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.classList?.contains('defEditor')) initForumEditor(n);
        if (n.querySelector?.('div.tiptap.ProseMirror')) n.querySelectorAll('div.tiptap.ProseMirror').forEach(ed => { if (ed.isContentEditable) initChatEditor(ed.closest('.editor-box') || ed); });
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
})();
