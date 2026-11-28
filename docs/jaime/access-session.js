/* NOVA ERA access-session transport. This module never authenticates an identity.
 * Reuses the existing same-origin personal / continuous gateway request contract.
 * No persistence, credential discovery, navigation, polling, retry or logging. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NovaAccessSession = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (runtime) {
  'use strict';

  const OPERATIONS = Object.freeze({
    personal: Object.freeze(['status', 'session', 'chat']),
    continuous: Object.freeze(['status', 'session', 'chat', 'history', 'resume', 'renew', 'close'])
  });
  const CSRF_HEADERS = Object.freeze(['x-supra-jaime-session', 'x-supra-helene-session']);
  const MAX_ERROR_BODY_BYTES = 16384;
  const MESSAGES = Object.freeze({
    ACCESS_REAUTH_REQUIRED: 'Access must be renewed.',
    ACCESS_DENIED: 'Access is not permitted.',
    ACCESS_OFFLINE: 'The device is offline.',
    ACCESS_TIMEOUT: 'The access request timed out.',
    ACCESS_NETWORK_ERROR: 'The access request could not be completed.',
    ACCESS_RATE_LIMITED: 'The service is receiving too many requests.',
    ACCESS_SERVICE_UNAVAILABLE: 'The service is unavailable.',
    ACCESS_INVALID_RESPONSE: 'The service returned an invalid response.'
  });

  class AccessSessionError extends Error {
    constructor(code, httpStatus = null, accepted = null) {
      super(MESSAGES[code]);
      Object.defineProperties(this, {
        name: {value: 'AccessSessionError'},
        code: {value: code, enumerable: true},
        httpStatus: {value: httpStatus, enumerable: true},
        accepted: {value: accepted, enumerable: true}
      });
    }
  }

  class CancelledRequest extends Error {
    constructor() {
      super('The access request was cancelled.');
      Object.defineProperty(this, 'name', {value: 'AbortError'});
    }
  }

  function invalidConfiguration() { return new TypeError('Invalid access-session configuration.'); }
  function invalidRequest() { return new TypeError('Invalid access-session request.'); }

  function isJSONResponse(response) {
    try {
      const type = (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
      return type === 'application/json' || /^application\/[a-z0-9!#$&^_.+-]+\+json$/.test(type);
    } catch (_) { return false; }
  }

  async function errorAccepted(response, signal) {
    // Only this boolean leaves this function. No error text, auth URL, receipt,
    // identity or other body field is retained. Inability to bound/read => unknown.
    if (!isJSONResponse(response) || !response.body || typeof response.body.getReader !== 'function' ||
        typeof runtime.TextDecoder !== 'function') return null;
    let reader, cancel;
    try {
      const size = response.headers.get('content-length');
      if (size && /^\d+$/.test(size) && Number(size) > MAX_ERROR_BODY_BYTES) return null;
      reader = response.body.getReader();
      cancel = () => { try { Promise.resolve(reader.cancel()).catch(() => {}); } catch (_) {} };
      signal.addEventListener('abort', cancel, {once: true});
      if (signal.aborted) { cancel(); return null; }
      const decoder = new runtime.TextDecoder('utf-8', {fatal: true});
      let text = '', bytes = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_ERROR_BODY_BYTES) { cancel(); return null; }
        text += decoder.decode(chunk.value, {stream: true});
      }
      text += decoder.decode();
      const value = JSON.parse(text);
      return value && typeof value === 'object' && !Array.isArray(value) &&
        Object.prototype.hasOwnProperty.call(value, 'accepted') && typeof value.accepted === 'boolean' ? value.accepted : null;
    } catch (_) { return null; }
    finally {
      if (cancel) signal.removeEventListener('abort', cancel);
      if (reader) { try { reader.releaseLock(); } catch (_) {} }
    }
  }

  function create(options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw invalidConfiguration();
    const {location, origin, pathPrefix, fetch: transportFetch,
      timeoutMs = 105000, online = () => true, onFailure = () => {}, apiNamespace = 'personal'} = options;
    if (typeof origin !== 'string' || typeof pathPrefix !== 'string' || pathPrefix.trim() !== pathPrefix ||
        !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(pathPrefix) ||
        typeof apiNamespace !== 'string' || !Object.prototype.hasOwnProperty.call(OPERATIONS, apiNamespace) ||
        typeof transportFetch !== 'function' || typeof online !== 'function' || typeof onFailure !== 'function' ||
        !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2147483647 ||
        typeof runtime.AbortController !== 'function') throw invalidConfiguration();
    let parsedOrigin;
    try { parsedOrigin = new runtime.URL(origin); } catch (_) { throw invalidConfiguration(); }
    if (parsedOrigin.protocol !== 'https:' || parsedOrigin.origin !== origin ||
        parsedOrigin.username || parsedOrigin.password || parsedOrigin.search || parsedOrigin.hash) throw invalidConfiguration();

    function assertLocation() {
      try {
        if (!location || location.origin !== origin || typeof location.pathname !== 'string' ||
            !location.pathname.startsWith(pathPrefix + '/')) throw invalidConfiguration();
      } catch (_) { throw invalidConfiguration(); }
    }
    assertLocation();
    const baseURL = origin + pathPrefix + '/v1/ojo/' + apiNamespace + '/';

    function notifyFailure(code) {
      try {
        const result = onFailure(code);
        if (result && typeof result.then === 'function') Promise.resolve(result).catch(() => {});
      } catch (_) { /* A UI callback must not replace or expose the transport failure. */ }
    }

    function prepare(operation, requestOptions) {
      if (typeof operation !== 'string' || !OPERATIONS[apiNamespace].includes(operation) ||
          !requestOptions || typeof requestOptions !== 'object' || Array.isArray(requestOptions) ||
          Object.keys(requestOptions).some(key => !['body', 'csrf', 'csrfHeader', 'signal'].includes(key))) throw invalidRequest();
      const {body, csrf, csrfHeader, signal} = requestOptions;
      if (signal !== undefined && (!signal || typeof signal.aborted !== 'boolean' ||
          typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function')) throw invalidRequest();
      const headers = {'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest'};
      if (csrf !== undefined || csrfHeader !== undefined) {
        if (typeof csrfHeader !== 'string' || !CSRF_HEADERS.includes(csrfHeader.toLowerCase()) ||
            typeof csrf !== 'string' || !csrf || /[\u0000-\u0020\u007f-\uffff]/.test(csrf)) throw invalidRequest();
        headers[csrfHeader] = csrf;
      }
      const init = {method: body === undefined ? 'GET' : 'POST', headers,
        credentials: 'same-origin', mode: 'same-origin', cache: 'no-store', redirect: 'manual', referrerPolicy: 'no-referrer'};
      if (body !== undefined) {
        try { init.body = JSON.stringify(body); } catch (_) { throw invalidRequest(); }
        if (typeof init.body !== 'string') throw invalidRequest();
        headers['Content-Type'] = 'application/json';
      }
      return {url: baseURL + operation, init, signal};
    }

    async function perform(url, init, rememberHTTPFailure) {
      let response;
      try { response = await transportFetch(url, init); }
      catch (_) { throw new AccessSessionError('ACCESS_NETWORK_ERROR'); }
      let httpStatus = null;
      try {
        if (!response || typeof response !== 'object') throw new AccessSessionError('ACCESS_INVALID_RESPONSE');
        if (response.type === 'opaqueredirect') throw new AccessSessionError('ACCESS_REAUTH_REQUIRED');
        if (Number.isInteger(response.status) && response.status >= 100 && response.status <= 599) httpStatus = response.status;
        const httpFailureCode = httpStatus === 401 ? 'ACCESS_REAUTH_REQUIRED' :
          httpStatus === 403 ? 'ACCESS_DENIED' : httpStatus === 429 ? 'ACCESS_RATE_LIMITED' :
          httpStatus >= 500 ? 'ACCESS_SERVICE_UNAVAILABLE' : null;
        if (httpFailureCode) {
          rememberHTTPFailure(new AccessSessionError(httpFailureCode, httpStatus));
          const accepted = await errorAccepted(response, init.signal);
          throw new AccessSessionError(httpFailureCode, httpStatus, accepted);
        }
        if (response.redirected === true || (httpStatus >= 300 && httpStatus < 400)) throw new AccessSessionError('ACCESS_REAUTH_REQUIRED', httpStatus);
        if (httpStatus === null || httpStatus < 200 || !response.headers ||
            typeof response.headers.get !== 'function' || typeof response.json !== 'function') throw new AccessSessionError('ACCESS_INVALID_RESPONSE', httpStatus);
        if (response.url && response.url !== url) throw new AccessSessionError('ACCESS_INVALID_RESPONSE', httpStatus);
        if (!isJSONResponse(response)) throw new AccessSessionError('ACCESS_INVALID_RESPONSE', httpStatus);
        const value = await response.json();
        // An HTTP 200 or a JSON field named "ok" proves no identity, tenant or admission.
        // Adapters retain responsibility for their complete status/session/proof contract.
        return {response, value};
      } catch (error) {
        if (error instanceof AccessSessionError) throw error;
        throw new AccessSessionError('ACCESS_INVALID_RESPONSE', httpStatus);
      }
    }

    async function request(operation, requestOptions = {}) {
      assertLocation();
      const {url, init, signal} = prepare(operation, requestOptions);
      if (signal && signal.aborted) throw new CancelledRequest();
      let timer = null, externalAbort = null, stoppedBy = null, knownHTTPFailure = null;
      const controller = new runtime.AbortController();
      init.signal = controller.signal;
      try {
        if (online() === false) throw new AccessSessionError('ACCESS_OFFLINE');
        let rejectStopped;
        const stopped = new Promise((_, reject) => { rejectStopped = reject; });
        const stop = cause => {
          if (stoppedBy !== null) return;
          stoppedBy = cause;
          rejectStopped(cause === 'external' ? new CancelledRequest() : knownHTTPFailure || new AccessSessionError('ACCESS_TIMEOUT'));
          controller.abort();
        };
        timer = runtime.setTimeout(() => stop('timeout'), timeoutMs);
        if (signal) {
          externalAbort = () => stop('external');
          signal.addEventListener('abort', externalAbort, {once: true});
          if (signal.aborted) externalAbort();
        }
        const transfer = stoppedBy === null ? perform(url, init, failure => { knownHTTPFailure = failure; }) : Promise.reject(new CancelledRequest());
        return await Promise.race([transfer, stopped]);
      } catch (error) {
        if (stoppedBy === 'external' || error instanceof CancelledRequest) throw new CancelledRequest();
        const failure = stoppedBy === 'timeout' ? knownHTTPFailure || new AccessSessionError('ACCESS_TIMEOUT') :
          error instanceof AccessSessionError ? error : new AccessSessionError('ACCESS_NETWORK_ERROR');
        notifyFailure(failure.code);
        throw failure;
      } finally {
        if (timer !== null) runtime.clearTimeout(timer);
        if (signal && externalAbort) {
          try { signal.removeEventListener('abort', externalAbort); } catch (_) {}
        }
      }
    }

    return Object.freeze({
      request,
      reconnectURL() { return origin + pathPrefix + '/'; },
      // This is the Cloudflare Access logout for the whole origin. The UI must
      // explain that scope before navigating; this module never navigates.
      logoutURL() { return origin + '/cdn-cgi/access/logout'; }
    });
  }

  return Object.freeze({create});
});
