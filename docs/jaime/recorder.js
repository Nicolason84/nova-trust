/* Real, local audio capture. No transcription, network or automatic sending.
 * Feature detection: https://webkit.org/blog/11353/mediarecorder-api/
 * Final data precedes stop: https://www.w3.org/TR/mediastream-recording/
 */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JaimeRecorder = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function (root) {
  'use strict';
  const MIME_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
  const MESSAGES = {
    UNSUPPORTED: 'Este navegador no permite grabar aquí. Puedes añadir un audio guardado.',
    INSECURE: 'Abre la aplicación con una conexión HTTPS para usar el micrófono. También puedes añadir un audio guardado.',
    CONTEXT_REQUIRED: 'Abre un tema antes de grabar.',
    PERMISSION_PENDING: 'Responde al aviso de permiso del navegador antes de volver a grabar.',
    PERMISSION_TIMEOUT: 'La solicitud sigue sin respuesta. No se ha grabado nada. Responde al aviso del navegador antes de volver a grabar.',
    PERMISSION_DENIED: 'No se ha autorizado el micrófono. Revisa el permiso en el navegador o añade un audio guardado.',
    NO_MICROPHONE: 'No se ha encontrado un micrófono disponible. Puedes añadir un audio guardado.',
    MICROPHONE_BUSY: 'El micrófono no está disponible. Comprueba si otra aplicación lo está usando o añade un audio guardado.',
    START_FAILED: 'No se pudo iniciar la grabación. Vuelve a intentarlo o añade un audio guardado.',
    EMPTY_RECORDING: 'No se ha recibido audio. Vuelve a grabar y comprueba el permiso del micrófono.',
    FINALIZATION_FAILED: 'No se pudo finalizar este audio. Vuelve a grabarlo o añade un audio guardado.',
    FINALIZATION_TIMEOUT: 'El navegador no ha terminado de preparar el audio. Esta grabación no se ha guardado. Vuelve a intentarlo.',
    TOO_LARGE: 'Este audio supera el límite de tamaño y no se ha guardado. Graba un mensaje más corto.',
    CAPTURE_REVOKED: 'El navegador ha retirado el acceso al audio. Esta grabación no se ha guardado.',
    HANDOFF_FAILED: 'El audio se grabó, pero no se pudo guardar. Vuelve a intentarlo o añade un audio guardado.'
  };

  function create(options = {}) {
    const env = Object.assign({
      mediaDevices: root.navigator && root.navigator.mediaDevices,
      MediaRecorder: root.MediaRecorder,
      Blob: root.Blob,
      isSecureContext: root.isSecureContext,
      now: () => Date.now(),
      setTimeout: root.setTimeout.bind(root), clearTimeout: root.clearTimeout.bind(root),
      setInterval: root.setInterval.bind(root), clearInterval: root.clearInterval.bind(root),
      document: root.document, lifecycleTarget: root
    }, options.env || {});
    const maxBytes = positive(options.maxBytes, 25 * 1024 * 1024);
    const maxDurationMs = positive(options.maxDurationMs, 600000);
    const permissionTimeoutMs = positive(options.permissionTimeoutMs, 60000);
    const stopTimeoutMs = positive(options.stopTimeoutMs, 4000);
    const reserveBytes = Math.min(256 * 1024, Math.floor(maxBytes * 0.05));
    let session = null, pendingPermission = null, disposed = false;
    const lifecycleCleanups = [];

    function positive(value, fallback) { return Number.isFinite(value) && value > 0 ? value : fallback; }
    function safeCall(callback, payload) { try { if (typeof callback === 'function') callback(payload); } catch (_) { /* UI errors must not retain a microphone. */ } }
    function error(code, s, audio) {
      if (!disposed) safeCall(options.onError, {code, message: MESSAGES[code], contextId: s ? s.contextId : null, ...(audio ? {audio} : {})});
    }
    function snapshot() {
      const s = session;
      return {
        state: disposed ? 'disposed' : s ? s.phase : 'idle',
        isBusy: !!s, canStart: !disposed && !s && !pendingPermission,
        permissionPending: !!pendingPermission,
        contextId: s ? s.contextId : null,
        elapsedMs: s && s.startedAt !== null ? Math.max(0, (s.endedAt === null ? env.now() : s.endedAt) - s.startedAt) : 0,
        bytesReceived: s ? s.bytes : 0, reason: s ? s.reason : null
      };
    }
    function emit() { if (!disposed) safeCall(options.onState, snapshot()); }
    function listen(target, name, listener, cleanups) {
      if (!target || typeof target.addEventListener !== 'function') return;
      target.addEventListener(name, listener);
      cleanups.push(() => target.removeEventListener(name, listener));
    }
    function stopTracks(stream) {
      if (!stream || typeof stream.getTracks !== 'function') return;
      for (const track of stream.getTracks()) {
        try { track.stop(); } catch (_) { /* Close every other track even if one fails. */ }
      }
    }
    function release(s) {
      env.clearTimeout(s.permissionTimer); env.clearTimeout(s.stopTimer);
      env.clearTimeout(s.durationTimer); env.clearInterval(s.tickTimer);
      s.cleanups.splice(0).forEach(fn => fn());
      if (!s.tracksClosed) { s.tracksClosed = true; stopTracks(s.stream); }
      if (s.resolveStart) { s.resolveStart(false); s.resolveStart = null; }
      s.done = true;
      if (session === s) session = null;
    }
    function discard(s, code) {
      if (!s || s.done) return;
      // Detach callbacks before stop(): cancellation must never create an attachment.
      const recorder = s.recorder;
      release(s);
      try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch (_) { /* Tracks are already closed. */ }
      s.chunks.length = 0;
      emit();
      if (code) error(code, s);
    }
    function closeCapture(s) {
      if (!s.tracksClosed) { s.tracksClosed = true; stopTracks(s.stream); }
    }
    function requestFinish(s, reason, interrupted) {
      if (session !== s || s.done) return;
      if (s.phase === 'requesting') { discard(s); return; }
      if (interrupted) s.interrupted = true;
      if (s.phase === 'stopping') return;
      s.reason = reason; s.phase = 'stopping'; s.endedAt = env.now();
      env.clearInterval(s.tickTimer); env.clearTimeout(s.durationTimer);
      s.stopTimer = env.setTimeout(() => discard(s, 'FINALIZATION_TIMEOUT'), stopTimeoutMs);
      emit();
      try {
        if (s.recorder.state !== 'inactive') s.recorder.stop();
      } catch (_) {
        discard(s, 'FINALIZATION_FAILED');
      } finally {
        // Release the microphone immediately; final data/stop are delivered asynchronously.
        closeCapture(s);
      }
    }
    function finish(s) {
      if (session !== s || s.done) return;
      if (s.phase !== 'stopping') {
        s.interrupted = true; s.reason = 'capture-ended'; s.endedAt = env.now();
      }
      const durationMs = s.startedAt === null ? 0 : Math.max(0, s.endedAt - s.startedAt);
      let blob;
      try {
        const mimeType = s.recorder.mimeType || (s.chunks.find(b => b.type) || {}).type || 'application/octet-stream';
        blob = new env.Blob(s.chunks, {type: mimeType});
      } catch (_) { discard(s, 'FINALIZATION_FAILED'); return; }
      release(s); s.chunks.length = 0; emit();
      if (!blob.size) { error('EMPTY_RECORDING', s); return; }
      if (blob.size > maxBytes) { error('TOO_LARGE', s); return; }
      const mimeType = blob.type;
      const extension = /mp4/i.test(mimeType) ? 'm4a' : /webm/i.test(mimeType) ? 'webm' : /ogg/i.test(mimeType) ? 'ogg' : /wav/i.test(mimeType) ? 'wav' : 'audio';
      const timestamp = new Date(env.now()).toISOString().slice(0, 19).replace(/:/g, '-');
      const audio = {blob, mimeType, filename: `Voz-${timestamp}.${extension}`, contextId: s.contextId, durationMs,
        interrupted: s.interrupted, reason: s.reason || 'user-stop', requiresReview: true};
      // A completed container still needs listening; no claim of transcription or analysis.
      if (typeof options.onAudio === 'function') {
        try { Promise.resolve(options.onAudio(audio)).catch(() => error('HANDOFF_FAILED', s, audio)); }
        catch (_) { error('HANDOFF_FAILED', s, audio); }
      }
    }
    function permissionError(exception) {
      if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(exception && exception.name)) return 'PERMISSION_DENIED';
      if (['NotFoundError', 'DevicesNotFoundError'].includes(exception && exception.name)) return 'NO_MICROPHONE';
      if (['NotReadableError', 'TrackStartError'].includes(exception && exception.name)) return 'MICROPHONE_BUSY';
      return 'START_FAILED';
    }
    function acceptStream(s, stream) {
      if (pendingPermission === s) pendingPermission = null;
      env.clearTimeout(s.permissionTimer);
      if (disposed || session !== s || s.done) { stopTracks(stream); emit(); return; }
      s.stream = stream;
      try {
        const tracks = stream.getAudioTracks();
        if (!tracks.length || tracks.every(t => t.readyState === 'ended')) { discard(s, 'NO_MICROPHONE'); return; }
        let mimeType;
        if (typeof env.MediaRecorder.isTypeSupported === 'function') {
          mimeType = MIME_TYPES.find(type => {
            try { return env.MediaRecorder.isTypeSupported(type); } catch (_) { return false; }
          });
        }
        try { s.recorder = new env.MediaRecorder(stream, mimeType ? {mimeType} : {}); }
        catch (exception) {
          if (!mimeType || exception.name !== 'NotSupportedError') throw exception;
          s.recorder = new env.MediaRecorder(stream);
        }
        listen(s.recorder, 'dataavailable', event => {
          if (session !== s || s.done || !event.data || !event.data.size) return;
          s.bytes += event.data.size;
          if (s.bytes > maxBytes) { discard(s, 'TOO_LARGE'); return; }
          s.chunks.push(event.data);
          if (s.bytes >= maxBytes - reserveBytes) requestFinish(s, 'size-limit', false);
        }, s.cleanups);
        listen(s.recorder, 'stop', () => finish(s), s.cleanups);
        listen(s.recorder, 'error', event => {
          if (session !== s || s.done) return;
          if (event.error && event.error.name === 'SecurityError') { discard(s, 'CAPTURE_REVOKED'); return; }
          requestFinish(s, 'recorder-error', true);
        }, s.cleanups);
        for (const track of tracks) {
          listen(track, 'ended', () => requestFinish(s, 'microphone-ended', true), s.cleanups);
          // A silent interruption must not look like an ongoing successful recording.
          listen(track, 'mute', () => requestFinish(s, 'microphone-muted', true), s.cleanups);
        }
        s.phase = 'recording'; s.startedAt = env.now();
        s.recorder.start(1000);
        if (session !== s || s.done || s.phase !== 'recording') return;
        s.tickTimer = env.setInterval(() => {
          if (session !== s || s.phase !== 'recording') return;
          if (env.now() - s.startedAt >= maxDurationMs) requestFinish(s, 'duration-limit', false);
          else emit();
        }, 500);
        s.durationTimer = env.setTimeout(() => requestFinish(s, 'duration-limit', false), maxDurationMs);
        if (s.resolveStart) { s.resolveStart(true); s.resolveStart = null; }
        emit();
      } catch (_) { discard(s, 'START_FAILED'); }
    }
    function start({contextId} = {}) {
      if (disposed || session) return Promise.resolve(false);
      if (pendingPermission) { error('PERMISSION_PENDING', pendingPermission); return Promise.resolve(false); }
      if (typeof contextId !== 'string' || !contextId) { error('CONTEXT_REQUIRED'); return Promise.resolve(false); }
      if (env.isSecureContext === false) { error('INSECURE'); return Promise.resolve(false); }
      if (!env.mediaDevices || typeof env.mediaDevices.getUserMedia !== 'function' || typeof env.MediaRecorder !== 'function' || typeof env.Blob !== 'function') {
        error('UNSUPPORTED'); return Promise.resolve(false);
      }
      const s = {contextId, phase: 'requesting', startedAt: null, endedAt: null, reason: null,
        stream: null, recorder: null, chunks: [], bytes: 0, cleanups: [], done: false, interrupted: false, tracksClosed: false};
      session = s; pendingPermission = s;
      const started = new Promise(resolve => { s.resolveStart = resolve; });
      s.permissionTimer = env.setTimeout(() => discard(s, 'PERMISSION_TIMEOUT'), permissionTimeoutMs);
      emit();
      try {
        // A getUserMedia promise cannot be canceled. Late grants are explicitly closed.
        Promise.resolve(env.mediaDevices.getUserMedia({audio: true, video: false})).then(
          stream => acceptStream(s, stream),
          exception => {
            if (pendingPermission === s) pendingPermission = null;
            if (session === s && !s.done) discard(s, permissionError(exception));
            else emit();
          }
        );
      } catch (exception) { pendingPermission = null; discard(s, permissionError(exception)); }
      return started;
    }
    function stop() { if (session) requestFinish(session, 'user-stop', false); }
    function cancel() { if (session) discard(session); }
    function interrupt(reason = 'interrupted') { if (session) requestFinish(session, reason, true); }
    function contextChanged(contextId) {
      if (session && session.contextId !== contextId) {
        if (session.phase === 'requesting') cancel();
        else if (session.phase === 'recording') interrupt('context-changed');
      }
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      if (session) discard(session);
      lifecycleCleanups.splice(0).forEach(fn => fn());
    }
    if (options.listenLifecycle !== false) {
      listen(env.lifecycleTarget, 'pagehide', () => interrupt('page-hidden'), lifecycleCleanups);
      listen(env.document, 'visibilitychange', () => {
        // Permission UI may temporarily obscure the page; do not cancel its request here.
        if (env.document.visibilityState === 'hidden' && session && session.phase === 'recording') interrupt('page-hidden');
      }, lifecycleCleanups);
    }
    return Object.freeze({start, stop, cancel, interrupt, contextChanged, dispose, getSnapshot: snapshot});
  }
  return Object.freeze({create});
});
