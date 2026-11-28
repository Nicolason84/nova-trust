(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const displayMode = window.matchMedia('(display-mode: standalone)');
  const standalone = navigator.standalone === true || displayMode.matches;
  const onIPhone = /iPhone|iPod/.test(navigator.userAgent);
  const publicNotebook = window.location.origin === 'https://nicolason84.github.io' &&
    window.location.pathname === '/nova-trust/jaime/instalar.html';

  if (standalone && !publicNotebook) {
    byId('install-steps').hidden = true;
    byId('instructions-link').hidden = true;
    byId('open-link').hidden = true;
    byId('install-link-card').hidden = true;
    byId('installed-card').hidden = false;
  } else if (standalone && publicNotebook) {
    const note = byId('device-note');
    note.textContent = 'Este icono abre tu libreta local. Para abrir el asistente desde otro icono, entra en el espacio privado de abajo e instálalo desde Safari.';
    note.hidden = false;
  } else if (onIPhone) {
    const note = byId('device-note');
    note.textContent = 'Si has llegado desde otra aplicación, copia el enlace de abajo y ábrelo en Safari para añadir el icono.';
    note.hidden = false;
  }

  const copyButton = byId('copy-link');
  const link = byId('install-url');
  const status = byId('copy-status');
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    copyButton.disabled = true;
    status.textContent = '';
    try {
      if (!navigator.clipboard?.writeText || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(link.value);
      status.textContent = 'Enlace copiado. Abre Safari y pégalo en la barra de direcciones.';
    } catch {
      link.focus();
      link.select();
      link.setSelectionRange(0, link.value.length);
      status.textContent = 'Mantén pulsado el enlace seleccionado y elige Copiar. Después, pégalo en Safari.';
    } finally {
      copyButton.disabled = false;
    }
  });

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
