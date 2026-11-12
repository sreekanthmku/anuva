/* Cookie / analytics consent banner (Google Consent Mode v2).
 *
 * The consent DEFAULT (everything denied) is set by the inline script in each
 * page's <head>, before gtm.js loads; that script also re-applies a stored
 * "granted" choice. This file only shows the banner when no choice is stored,
 * records the visitor's choice, and re-opens the banner from any element with
 * a data-cookie-settings attribute (the "Cookie settings" footer link).
 *
 * Stored in localStorage under "anuva.cookieConsent": "granted" | "denied".
 * The site does no advertising, so only analytics_storage is ever granted.
 */
(function () {
  'use strict';

  var KEY = 'anuva.cookieConsent';
  var banner = null;
  var returnFocusTo = null;

  function readChoice() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function storeChoice(value) {
    try { window.localStorage.setItem(KEY, value); } catch (e) { /* private mode etc. */ }
  }
  function clearChoice() {
    try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  function gtag() {
    if (typeof window.gtag === 'function') {
      window.gtag.apply(window, arguments);
    } else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(arguments);
    }
  }

  // On withdrawal, remove Google Analytics cookies already set (_ga, _ga_<id>, _gid, _gat*)
  // on this host and its parent domains.
  function removeAnalyticsCookies() {
    var names = document.cookie.split(';').map(function (c) {
      return c.split('=')[0].trim();
    }).filter(function (n) { return /^(_ga|_gid|_gat)/.test(n); });
    if (!names.length) return;
    var parts = window.location.hostname.split('.');
    var domains = [''];
    for (var i = 0; i < parts.length - 1; i++) {
      domains.push('; domain=.' + parts.slice(i).join('.'));
    }
    names.forEach(function (name) {
      domains.forEach(function (d) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
      });
    });
  }

  var CSS =
    '.cc-banner{position:fixed;z-index:10000;' +
      'left:calc(16px + env(safe-area-inset-left,0px));right:calc(16px + env(safe-area-inset-right,0px));' +
      'bottom:calc(16px + env(safe-area-inset-bottom,0px));' +
      'max-width:720px;margin:0 auto;box-sizing:border-box;' +
      'background:#FBF6F0;color:#3E2542;border:1px solid rgba(94,53,102,.15);border-radius:20px;' +
      'box-shadow:0 18px 36px rgba(94,53,102,.16);padding:18px 20px;' +
      'display:flex;flex-wrap:wrap;align-items:center;gap:14px 20px;' +
      "font-family:'Mulish',-apple-system,system-ui,sans-serif;font-size:14.5px;line-height:1.55;text-align:left}" +
    '.cc-banner[hidden]{display:none}' +
    '.cc-banner:focus{outline:none}' +
    '.cc-banner p{margin:0;flex:1 1 300px;min-width:0;color:#5C4A66}' +
    '.cc-banner a{color:#5E3566;font-weight:700;text-decoration:underline;text-underline-offset:2px}' +
    '.cc-banner a:hover{color:#472852}' +
    '.cc-actions{display:flex;flex-wrap:wrap;gap:10px;flex:1 1 auto;justify-content:flex-end}' +
    '.cc-btn{flex:1 1 130px;display:inline-flex;align-items:center;justify-content:center;' +
      'min-height:44px;padding:10px 22px;border-radius:9999px;border:1.5px solid #5E3566;' +
      'background:#5E3566;color:#FBF6F0;margin:0;' +
      "font-family:'Mulish',-apple-system,system-ui,sans-serif;font-size:15px;font-weight:700;line-height:1.2;" +
      'cursor:pointer;transition:background .2s,box-shadow .2s}' +
    '.cc-btn:hover{background:#472852;border-color:#472852;box-shadow:0 8px 20px rgba(94,53,102,.24)}' +
    '.cc-btn:focus-visible,.cc-banner a:focus-visible{outline:3px solid #C97E92;outline-offset:2px}' +
    '@media (max-width:480px){.cc-banner{padding:16px;font-size:14px}.cc-actions{width:100%}}' +
    '@media print{.cc-banner{display:none}}';

  function injectStyles() {
    if (document.getElementById('cc-style')) return;
    var style = document.createElement('style');
    style.id = 'cc-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function buildBanner() {
    injectStyles();
    var el = document.createElement('div');
    el.className = 'cc-banner';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Cookie choices');
    el.tabIndex = -1;
    el.innerHTML =
      '<p>We use analytics cookies to understand how people use this site, so we can improve it. ' +
      'They are off unless you allow them. <a href="/privacy#cookies">Privacy Policy</a></p>' +
      '<div class="cc-actions">' +
        '<button type="button" class="cc-btn" data-cc-choice="granted">Allow analytics</button>' +
        '<button type="button" class="cc-btn" data-cc-choice="denied">No thanks</button>' +
      '</div>';
    el.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-cc-choice]');
      if (btn) choose(btn.getAttribute('data-cc-choice'));
    });
    document.body.appendChild(el);
    return el;
  }

  function show(moveFocus) {
    if (!banner) banner = buildBanner();
    banner.hidden = false;
    if (moveFocus) banner.focus();
  }

  function hide() {
    if (banner) banner.hidden = true;
    if (returnFocusTo && document.contains(returnFocusTo)) returnFocusTo.focus();
    returnFocusTo = null;
  }

  function choose(value) {
    storeChoice(value);
    if (value === 'granted') {
      gtag('consent', 'update', { analytics_storage: 'granted' });
    } else {
      gtag('consent', 'update', { analytics_storage: 'denied' });
      removeAnalyticsCookies();
    }
    hide();
  }

  // "Cookie settings": forget the stored choice and ask again.
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest && e.target.closest('[data-cookie-settings]');
    if (!trigger) return;
    e.preventDefault();
    clearChoice();
    returnFocusTo = trigger;
    show(true);
  });

  function init() {
    var stored = readChoice();
    if (stored !== 'granted' && stored !== 'denied') show(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
