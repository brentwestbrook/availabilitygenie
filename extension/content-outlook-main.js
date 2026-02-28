/**
 * MAIN WORLD content script — injected into Outlook Web App tabs at document_start.
 *
 * Runs in the page's own JavaScript context so it can patch window.fetch and
 * XMLHttpRequest before any Outlook code executes. When Outlook makes its normal
 * API calls to Microsoft Graph, the patched functions capture the Authorization
 * Bearer token and forward it to the isolated-world content script
 * (content-outlook.js) via window.postMessage.
 *
 * No Chrome extension APIs are available here — communication is via postMessage only.
 */
(function () {
  const TOKEN_MSG = 'AG_TOKEN_CAPTURED';
  const GRAPH_HOST = 'graph.microsoft.com';

  function emitToken(token) {
    window.postMessage({ type: TOKEN_MSG, token }, '*');
  }

  // --- Patch window.fetch ---
  const origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : (input?.url ?? '');
      if (url.includes(GRAPH_HOST)) {
        let auth = '';
        const h = init?.headers ?? (input instanceof Request ? input.headers : null);
        if (h instanceof Headers) {
          auth = h.get('Authorization') ?? '';
        } else if (h && typeof h === 'object') {
          auth = h['Authorization'] ?? h['authorization'] ?? '';
        }
        if (auth.startsWith('Bearer ')) emitToken(auth.slice(7));
      }
    } catch (_) {}
    return origFetch(input, init);
  };

  // --- Patch XMLHttpRequest (belt-and-suspenders) ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__agUrl = typeof url === 'string' ? url : '';
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (
      this.__agUrl?.includes(GRAPH_HOST) &&
      name.toLowerCase() === 'authorization' &&
      typeof value === 'string' &&
      value.startsWith('Bearer ')
    ) {
      emitToken(value.slice(7));
    }
    return origSetHeader.apply(this, arguments);
  };
})();
