(function (root) {
  'use strict';
  // UI projection only. Cloudflare and the existing server verify identity.
  // No account, device registration, passkey, cookie or local auth flag is created.
  const paths = Object.freeze({
    'https://jaime.nova-era.fr': '/ojo/jaime',
    'https://tony.nova-era.fr': '/ojo/jaime-owner-test'
  });
  const prefix = paths[root.location?.origin];
  if (!prefix || ![prefix + '/', prefix + '/index.html'].includes(root.location.pathname)) return;
  const doc = root.document, host = doc?.querySelector('#helpDialog .help-content');
  if (!host) return;
  const publicEntry = doc.getElementById('privateAssistantDelivery');
  if (publicEntry) publicEntry.hidden = true;
  const section = doc.createElement('section'); section.className = 'personal-access-controls'; section.id = 'personalAccessControls';
  const heading = doc.createElement('h3'); heading.textContent = 'Tu acceso personal';
  const info = doc.createElement('p'); info.id = 'personalAccessExplanation';
  info.textContent = 'Cloudflare verifica tu identidad. Si tu sesión sigue siendo válida, puede reconocerte al volver. Si ha caducado o se ha revocado, tendrás que identificarte de nuevo. El nombre de tu libreta no sirve como identificación.';
  const state = doc.createElement('p'); state.id = 'personalAccessState'; state.setAttribute('aria-live', 'polite');
  const reconnect = doc.createElement('a'); reconnect.id = 'privateReconnect'; reconnect.className = 'secondary';
  reconnect.href = root.location.origin + prefix + '/'; reconnect.referrerPolicy = 'no-referrer';
  reconnect.textContent = 'Volver a entrar'; reconnect.hidden = true;
  const help = doc.createElement('p'); help.className = 'small-note';
  help.textContent = 'La clave de acceso o la biometría solo estarán disponibles si aparecen entre los métodos habilitados por el proveedor. Esta app no registra tus datos biométricos. Si pierdes el teléfono, solicita al responsable la revisión y revocación del acceso; no compartas códigos.';
  const logout = doc.createElement('a'); logout.id = 'privateLogout'; logout.className = 'subtle-link';
  logout.href = root.location.origin + '/cdn-cgi/access/logout'; logout.referrerPolicy = 'no-referrer';
  logout.textContent = 'Cerrar mi sesión de acceso';
  const logoutScope = doc.createElement('p'); logoutScope.className = 'small-note';
  logoutScope.textContent = 'La salida de Cloudflare afecta a tu sesión en las demás aplicaciones de este mismo acceso. No borra tu libreta local, que sigue sin cifrar. Evita un navegador compartido para tus notas personales.';
  logout.addEventListener('click', event => {
    if (!root.confirm('Se cerrará tu sesión de Cloudflare también en las otras aplicaciones vinculadas. Tu libreta local no se borrará. ¿Quieres cerrar la sesión?')) event.preventDefault();
  });
  section.append(heading, info, state, reconnect, help, logout, logoutScope);
  const oldAccess = host.querySelector('p');
  if (oldAccess) oldAccess.textContent = 'Este es tu acceso privado. Tu libreta y los archivos locales permanecen en este navegador, sin cifrar. El historial privado del servidor solo recibe los mensajes que envías con tu consentimiento.';
  host.prepend(section);
  function refresh() {
    const access = root.JaimeGateway?.access?.();
    state.textContent = access?.authenticated === true ? 'Acceso personal verificado en la última comprobación.'
      : access?.description || 'La conexión privada todavía no se ha verificado.';
    reconnect.hidden = !['ACCESS_REAUTH_REQUIRED', 'ACCESS_DENIED', 'ACCESS_INVALID_RESPONSE'].includes(access?.code);
    // Destinations remain fixed constants, never values returned by a server.
  }
  root.JaimeIdentityUI = Object.freeze({refresh}); refresh();
})(typeof globalThis !== 'undefined' ? globalThis : this);
