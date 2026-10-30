(function (root) {
  'use strict';
  // Intentionally disconnected in the private review build. This file neither
  // calls an AI API nor forwards private material to an unrelated endpoint.
  const status = Object.freeze({
    ok: false,
    mode: 'private-prototype',
    label: 'Prototipo privado · análisis aún sin conectar',
    capabilities: Object.freeze({text: false, image: false, document: false, audio: false, video: false, research: false})
  });
  const gateway = Object.freeze({
    async health() { return status; },
    async send() {
      const error = new Error('La conexión de análisis aún no está activada. Tu idea sigue guardada en este dispositivo. Puedes añadir información y probar los números.');
      error.code = 'ANALYSIS_NOT_CONNECTED';
      throw error;
    }
  });
  root.JaimeGateway = gateway;
  if (typeof module !== 'undefined' && module.exports) module.exports = gateway;
})(typeof globalThis !== 'undefined' ? globalThis : this);
