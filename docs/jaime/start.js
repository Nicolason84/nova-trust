(() => {
  'use strict';
  const form = document.getElementById('entryForm');
  const name = document.getElementById('entryName');
  let storage = null; try {storage = window.localStorage;} catch {}
  const local = window.JaimeLegacy.loadProfile(storage);
  const publicDelivery = window.location.origin === 'https://nicolason84.github.io' && /^\/nova-trust\/jaime\/(?:start\.html)?$/.test(window.location.pathname);
  if (local && !publicDelivery) {window.location.replace('./index.html'); return;}
  if (publicDelivery) {
    document.getElementById('privateAccessChoice').hidden = false;
    if (local) name.value = local.name;
  }
  const previous = local ? {profile:null} : window.JaimeLegacy.stored(storage);
  if (!local && previous.profile?.name) {
    document.getElementById('oldProfileBox').hidden = false;
    document.getElementById('oldProfileText').textContent = `Hay un perfil anterior guardado en este navegador: ${previous.profile.name}.`;
    document.getElementById('useOldProfile').addEventListener('click', () => {name.value = previous.profile.name; name.focus();});
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      window.JaimeLegacy.saveProfile(storage, name.value || 'Jaime');
      window.location.assign('./index.html');
    } catch {
      const error = document.getElementById('entryError');
      error.textContent = 'No se ha podido guardar tu nombre. Revisa si el navegador permite guardar datos e inténtalo de nuevo.';
      error.hidden = false;
    }
  });
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
