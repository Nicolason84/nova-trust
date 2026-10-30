/* Local, deterministic communication preparation. No network, DOM or sending.
 * MIME subset: RFC 2046 / RFC 2047. Draft URI: RFC 6068.
 * Imported content is untrusted reference text. Render it with textContent.
 */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JaimeCommunications = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const MAX_BYTES = 5 * 1024 * 1024;
  const MAX_MESSAGES = 500;
  const MAX_BODY = 200000;
  const CHANNELS = ['email', 'other', 'sms', 'phone'];
  const STATUSES = ['to_reply', 'draft', 'waiting', 'done'];
  const SOURCES = ['manual', 'eml'];
  const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};

  function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
  function value(v, max, label) {
    if (v === undefined || v === null) return '';
    if (typeof v !== 'string') fail('INVALID_FIELD', 'El campo «' + label + '» debe ser texto.');
    if (v.length > max) fail('FIELD_TOO_LONG', 'El campo «' + label + '» es demasiado largo. Divide el contenido antes de guardarlo.');
    if (/\u0000/.test(v)) fail('BINARY_INPUT', 'Este contenido no parece un texto válido.');
    return v.replace(/\r\n?/g, '\n');
  }
  function line(v, max, label) { return value(v, max, label).replace(/[\r\n\t]+/g, ' ').trim(); }
  function byteLength(v) {
    if (typeof root.TextEncoder === 'function') return new root.TextEncoder().encode(v).length;
    return unescape(encodeURIComponent(v)).length;
  }
  function input(v) {
    if (typeof v !== 'string') fail('TEXT_REQUIRED', 'Selecciona un archivo de texto.');
    if (v.length > MAX_BYTES || byteLength(v) > MAX_BYTES) fail('FILE_TOO_LARGE', 'El archivo supera 5 MB. Divide la exportación antes de recuperarla.');
    if (/\u0000/.test(v) || /^PK\u0003\u0004/.test(v)) fail('BINARY_INPUT', 'Este importador acepta texto o .eml. Extrae el .txt de un ZIP antes de importarlo.');
    return v.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  }
  function notice(list, code, message, count) {
    const existing = list.find(n => n.code === code);
    if (existing) { if (count) existing.count = (existing.count || 0) + count; return; }
    list.push(Object.assign({code:code, message:message}, count ? {count:count} : {}));
  }
  function stableHash(v) {
    let a = 0x811c9dc5, b = 0x9e3779b9;
    for (let i = 0; i < v.length; i++) {
      a = Math.imul(a ^ v.charCodeAt(i), 0x01000193);
      b = Math.imul(b ^ v.charCodeAt(i), 0x85ebca6b);
    }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0') + '-' + v.length;
  }
  // Import deduplication helper, not a cryptographic identifier or identity proof.
  function fingerprint(item) {
    const o = item || {};
    return 'comms-' + stableHash(JSON.stringify([
      o.source || 'manual', o.channel || 'other', o.contact || '', o.email || '',
      o.phone || '', o.subject || '', o.body || '', o.receivedAt || '',
      o.dateText || '', o.messageKind || 'message', o.meta && o.meta.headers ? o.meta.headers.messageId || '' : ''
    ]));
  }
  function email(v) {
    const original = value(v, 254, 'email');
    if (/[\r\n]/.test(original)) fail('INVALID_EMAIL', 'La dirección de correo no puede contener saltos de línea.');
    const s = original.trim();
    if (!s) return '';
    if (/[\r\n\s,;<>]/.test(s) || /%(?:0a|0d)/i.test(s)) fail('INVALID_EMAIL', 'Revisa la dirección de correo. Usa una sola dirección, sin saltos de línea.');
    const parts = s.split('@');
    if (parts.length !== 2 || !parts[0] || parts[0].length > 64 || !/^[A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+$/.test(parts[0]) || /^\.|\.$|\.\./.test(parts[0])) fail('INVALID_EMAIL', 'La dirección de correo no tiene un formato compatible.');
    const labels = parts[1].split('.');
    if (labels.length < 2 || labels.some(v => !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(v))) fail('INVALID_EMAIL', 'Revisa el dominio de la dirección de correo.');
    return parts[0] + '@' + parts[1].toLowerCase();
  }
  function calendarDate(year, month, day) {
    const d = new Date(Date.UTC(year, month - 1, day));
    return year >= 1900 && year <= 2199 && d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
  }
  function isoDate(v, dateOnly) {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v !== 'string') fail('INVALID_DATE', 'La fecha debe ser texto.');
    const re = dateOnly ? /^(\d{4})-(\d{2})-(\d{2})$/ : /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;
    const m = v.match(re);
    if (!m || !calendarDate(+m[1], +m[2], +m[3]) || (m[4] !== undefined && (+m[4] > 23 || +m[5] > 59 || +(m[6] || 0) > 59))) fail('INVALID_DATE', 'La fecha no es válida. Usa año-mes-día.');
    if (m[7] && m[7] !== 'Z' && (+m[7].slice(1,3) > 23 || +m[7].slice(4,6) > 59)) fail('INVALID_DATE', 'La zona horaria no es válida.');
    return v;
  }
  function normalizeItem(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_ITEM', 'El mensaje no tiene un formato válido.');
    const channel = raw.channel || 'other', status = raw.status || 'to_reply', source = raw.source || 'manual';
    if (!CHANNELS.includes(channel) || !STATUSES.includes(status) || !SOURCES.includes(source)) fail('INVALID_ITEM', 'Revisa el canal, el estado o el origen del mensaje.');
    const item = {
      id: line(raw.id, 160, 'identificador'), sourceKey: line(raw.sourceKey, 240, 'origen'),
      contact: line(raw.contact, 240, 'contacto'), channel:channel,
      email: email(raw.email), phone: line(raw.phone, 80, 'teléfono'),
      subject: line(raw.subject, 500, 'asunto'), body: value(raw.body, MAX_BODY, 'mensaje'),
      receivedAt:isoDate(raw.receivedAt, false), dateText:line(raw.dateText, 240, 'fecha original'),
      status:status, draft:value(raw.draft, MAX_BODY, 'borrador'), nextFollowUpAt:isoDate(raw.nextFollowUpAt, true),
      source:source, imported:source !== 'manual' || raw.imported === true,
      direction:['incoming','outgoing'].includes(raw.direction) ? raw.direction : 'unknown',
      messageKind:['system','unparsed'].includes(raw.messageKind) ? raw.messageKind : 'message'
    };
    if (raw.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta)) item.meta = JSON.parse(JSON.stringify(raw.meta));
    if (!item.sourceKey) item.sourceKey = fingerprint(item);
    if (!item.id) item.id = item.sourceKey;
    return item;
  }

  function decodeBytes(bytes, charset, notices) {
    try { return new root.TextDecoder(charset || 'utf-8', {fatal:true}).decode(bytes); }
    catch (_) {
      notice(notices, 'CHARSET_FALLBACK', 'No se pudo confirmar toda la codificación del texto. Revisa los acentos y conserva el archivo original.');
      try { return new root.TextDecoder('utf-8').decode(bytes); }
      catch (_) { return Array.from(bytes, x => String.fromCharCode(x)).join(''); }
    }
  }
  function base64Bytes(s) {
    let clean = s.replace(/\s/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 === 1 || /=/.test(clean.slice(0,-2))) throw new Error('Invalid base64');
    clean += '='.repeat((4 - clean.length % 4) % 4);
    const decoded = typeof root.atob === 'function' ? root.atob(clean) : Buffer.from(clean, 'base64').toString('binary');
    return Uint8Array.from(decoded, c => c.charCodeAt(0));
  }
  function qpBytes(s, header) {
    const v = (header ? s.replace(/_/g, ' ') : s).replace(/=\n/g, '');
    const bytes = [];
    for (let i = 0; i < v.length; i++) {
      if (v[i] === '=' && /^[0-9a-f]{2}$/i.test(v.slice(i+1,i+3))) { bytes.push(parseInt(v.slice(i+1,i+3),16)); i += 2; }
      else if (v.charCodeAt(i) <= 127) bytes.push(v.charCodeAt(i));
      else {
        const cp = v.codePointAt(i), ch = String.fromCodePoint(cp);
        for (const byte of new root.TextEncoder().encode(ch)) bytes.push(byte);
        if (cp > 0xffff) i++;
      }
    }
    return Uint8Array.from(bytes);
  }
  function decodeHeader(s, notices) {
    return String(s || '').replace(/(\?=)[ \t]+(?==\?)/g, '$1').replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, function (all, charset, encoding, data) {
      try { return decodeBytes(encoding.toLowerCase() === 'b' ? base64Bytes(data) : qpBytes(data, true), charset, notices); }
      catch (_) { notice(notices, 'HEADER_ENCODING', 'Una cabecera codificada no se pudo leer. Se conserva su texto original.'); return all; }
    });
  }
  function splitPart(raw, notices) {
    const at = raw.indexOf('\n\n');
    const headerText = at < 0 ? raw : raw.slice(0,at);
    if (headerText.length > 65536) fail('HEADERS_TOO_LARGE', 'Las cabeceras del correo son demasiado largas para esta importación.');
    const headers = Object.create(null);
    let current = null;
    for (const l of headerText.split('\n')) {
      if (/^[ \t]/.test(l) && current) { headers[current][headers[current].length-1] += ' ' + l.trim(); continue; }
      const m = l.match(/^([A-Za-z0-9-]+):[ \t]*(.*)$/);
      if (!m) { if (l.trim()) notice(notices, 'UNREADABLE_HEADER', 'Hay líneas de cabecera no reconocidas. Revisa el archivo original.'); current = null; continue; }
      current = m[1].toLowerCase();
      (headers[current] || (headers[current] = [])).push(m[2]);
    }
    return {headers:headers, body:at < 0 ? '' : raw.slice(at+2), rawHeaders:headerText};
  }
  function first(headers, name, notices) {
    const values = headers[name] || [];
    if (values.length > 1) notice(notices, 'DUPLICATE_HEADER', 'El correo contiene cabeceras repetidas. Se utiliza la primera y deben revisarse los datos originales.');
    return values[0] || '';
  }
  function mediaType(v, fallback) {
    const s = v || fallback, parameters = Object.create(null);
    const re = /;\s*([A-Za-z0-9_-]+)\s*=\s*(?:"((?:\\.|[^"])*)"|([^;]*))/g;
    let m;
    while ((m = re.exec(s))) parameters[m[1].toLowerCase()] = (m[2] !== undefined ? m[2].replace(/\\(.)/g,'$1') : m[3].trim());
    return {type:s.split(';')[0].trim().toLowerCase(), parameters:parameters};
  }
  function transfer(body, encoding, charset, notices) {
    try {
      if (encoding === 'base64') return decodeBytes(base64Bytes(body), charset, notices);
      if (encoding === 'quoted-printable') return decodeBytes(qpBytes(body, false), charset, notices);
      if (encoding && !['7bit','8bit','binary'].includes(encoding)) notice(notices, 'UNSUPPORTED_ENCODING', 'Hay una codificación no compatible. Ese contenido se conserva como texto sin decodificar.');
      if (body.includes('\ufffd')) notice(notices, 'REPLACEMENT_CHARACTERS', 'El archivo contiene caracteres que no se han podido recuperar. Revisa el original.');
      return body;
    } catch (_) { notice(notices, 'TRANSFER_DECODE_FAILED', 'No se pudo decodificar una parte del correo. Se conserva su contenido codificado para revisión.'); return body; }
  }
  function mailbox(raw, notices) {
    const s = decodeHeader(raw, notices).trim();
    const angled = s.match(/^([^<>]*?)<([^<>]+)>(?:\s*\([^)]*\))?$/);
    const annotated = !angled && s.match(/^(\S+@\S+)\s+\(([^)]*)\)$/);
    let addressText = angled ? angled[2] : annotated ? annotated[1] : s;
    let name = angled ? angled[1].trim().replace(/^"(.*)"$/,'$1') : annotated ? annotated[2] : '';
    let address = '';
    try {address = email(addressText);} catch (_) {
      notice(notices, 'SENDER_CONFIRMATION', 'No se ha identificado una única dirección válida del remitente. Confírmala antes de preparar el correo.');
      if (!name) name = s;
    }
    return {name:name, address:address, raw:raw};
  }
  function emlDate(s, notices) {
    if (!s) return null;
    const raw = s.replace(/\s*\([^)]*\)\s*$/,'').trim();
    const m = raw.match(/^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+)?(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+([+-]\d{4}|UT|UTC|GMT)$/i);
    if (!m || months[m[2].toLowerCase()] === undefined || !calendarDate(+m[3], months[m[2].toLowerCase()]+1, +m[1]) || +m[4] > 23 || +m[5] > 59 || +(m[6] || 0) > 59) {
      notice(notices, 'DATE_UNCONFIRMED', 'La fecha o su zona horaria no se pudo confirmar. Se conserva la fecha original.');
      return null;
    }
    if (m[7] === '-0000') {notice(notices, 'DATE_UNCONFIRMED', 'El correo no especifica una zona horaria conocida. Se conserva su fecha original.'); return null;}
    let offset = 0;
    if (/^[+-]/.test(m[7])) {
      const hh = +m[7].slice(1,3), mm = +m[7].slice(3,5);
      if (hh > 23 || mm > 59) {notice(notices, 'DATE_UNCONFIRMED', 'La zona horaria del correo no es válida.'); return null;}
      offset = (hh*60+mm) * (m[7][0] === '-' ? -1 : 1);
    }
    return new Date(Date.UTC(+m[3], months[m[2].toLowerCase()], +m[1], +m[4], +m[5], +(m[6] || 0)) - offset*60000).toISOString();
  }
  function parseEml(text) {
    const raw = input(text), notices = [], top = splitPart(raw, notices);
    if (!['from','to','subject','date','mime-version','content-type'].some(k => top.headers[k])) fail('INVALID_EML', 'No se reconocen cabeceras de correo. Importa un .eml o pega el mensaje manualmente.');
    const attachments = [], unsupportedParts = [], counter = {parts:0};
    function walk(part, depth) {
      if (depth > 8 || ++counter.parts > 100) fail('MIME_LIMIT', 'El correo tiene demasiadas partes anidadas. Abre el original y copia el texto que necesitas.');
      const h = part.headers, ct = mediaType(first(h,'content-type',notices), 'text/plain'), cd = mediaType(first(h,'content-disposition',notices), '');
      const fileName = decodeHeader(cd.parameters.filename || ct.parameters.name || '', notices);
      if (cd.type === 'attachment' || fileName) {
        attachments.push({name:fileName || 'Archivo adjunto', type:ct.type});
        notice(notices,'ATTACHMENTS_NOT_IMPORTED','Los archivos adjuntos se han identificado, pero no se importan ni se analizan. Conserva el .eml original.',1);
        return [];
      }
      if (ct.type === 'multipart/encrypted') {notice(notices,'ENCRYPTED_EMAIL','El correo está cifrado. Este importador no puede descifrarlo.'); return [];}
      if (ct.type.startsWith('multipart/')) {
        const boundary = ct.parameters.boundary;
        if (!boundary || boundary.length > 200) {notice(notices,'MIME_BOUNDARY','No se pudo identificar el separador de las partes del correo. El cuerpo no se ha recuperado.'); return [];}
        const chunks = [], lines = part.body.split('\n');
        let current = null, ended = false;
        for (const l of lines) {
          if (l.replace(/[ \t]+$/,'') === '--'+boundary) {if (current) chunks.push(current.join('\n')); current = []; }
          else if (l.replace(/[ \t]+$/,'') === '--'+boundary+'--') {if (current) chunks.push(current.join('\n')); current = null; ended = true; break;}
          else if (current) current.push(l);
        }
        if (current && current.length) chunks.push(current.join('\n'));
        if (!chunks.length) notice(notices,'MIME_BOUNDARY','No se pudo separar el cuerpo del correo. Abre el original para revisarlo.');
        if (!ended) notice(notices,'INCOMPLETE_MIME','El final MIME no está completo. El contenido recuperado puede estar incompleto.');
        let output = chunks.flatMap(chunk => walk(splitPart(chunk,notices),depth+1));
        if (ct.type === 'multipart/alternative' && output.some(p => p.kind === 'plain')) {
          if (output.some(p => p.kind === 'html')) notice(notices,'HTML_ALTERNATIVE','Se conserva la versión de texto. La versión HTML alternativa no se incluye.');
          output = output.filter(p => p.kind === 'plain');
        }
        if (ct.type === 'multipart/signed') notice(notices,'SIGNATURE_NOT_VERIFIED','La firma digital del correo no se ha verificado.');
        return output;
      }
      if (ct.type === 'text/plain' || ct.type === 'text/html') {
        const content = transfer(part.body, first(h,'content-transfer-encoding',notices).trim().toLowerCase(), ct.parameters.charset || 'utf-8', notices);
        return [{kind:ct.type === 'text/html' ? 'html' : 'plain', text:content}];
      }
      unsupportedParts.push(ct.type);
      notice(notices,'UNSUPPORTED_PART','Hay partes del correo que no se importan (por ejemplo, firmas, calendarios o mensajes adjuntos). Revísalas en el original.',1);
      return [];
    }
    const parts = walk(top,0), hasPlain = parts.some(p => p.kind === 'plain'), hasHtml = parts.some(p => p.kind === 'html');
    const chosen = parts;
    if (hasHtml) notice(notices,'HTML_AS_TEXT','Hay contenido HTML. Se conserva como texto literal, sin ejecutar código, cargar imágenes ni abrir enlaces.');
    const body = chosen.map(p => p.text.trim()).join('\n\n');
    if (!body) notice(notices,'BODY_UNAVAILABLE','No se ha recuperado un cuerpo de texto. Comprueba el correo original y sus adjuntos.');
    const fromRaw = first(top.headers,'from',notices), from = mailbox(fromRaw,notices);
    const subject = decodeHeader(first(top.headers,'subject',notices),notices);
    const dateText = first(top.headers,'date',notices), toRaw = decodeHeader(first(top.headers,'to',notices),notices);
    const replyTo = decodeHeader(first(top.headers,'reply-to',notices),notices);
    if (replyTo && replyTo !== fromRaw) notice(notices,'REPLY_TO_PRESENT','El correo incluye una dirección Reply-To. Revísala en el original; no se ha seleccionado automáticamente.');
    const item = normalizeItem({
      contact:from.name || from.address || 'Remitente por confirmar', channel:'email', email:from.address,
      subject:subject, body:body, dateText:dateText, receivedAt:emlDate(dateText,notices),
      source:'eml', status:'to_reply',
      meta:{headers:{from:fromRaw,to:toRaw,subject:subject,date:dateText,replyTo:replyTo,messageId:first(top.headers,'message-id',notices)},attachments:attachments,bodyKind:hasPlain&&hasHtml?'mixed_text_html_source':hasPlain?'plain':chosen.length?'html_source':'none'}
    });
    return {items:[item],notices:notices,meta:{format:'eml',sizeBytes:byteLength(raw),messageCount:1,attachments:attachments,unsupportedParts:unsupportedParts,identityVerified:false}};
  }

  function makeDraft(raw, options) {
    const item = normalizeItem(raw), o = options || {};
    const intent = ['reply','ask_info','follow_up','schedule'].includes(o.intent) ? o.intent : 'reply';
    const language = o.language === 'fr' ? 'fr' : 'es', professional = o.tone === 'professional';
    const name = line(o.name === undefined ? 'Jaime' : o.name,80,'firma') || (language === 'fr' ? '[Ton nom]' : '[Tu nombre]');
    const contact = item.contact && !['Remitente por confirmar','Texto sin fecha'].includes(item.contact) ? item.contact : '';
    let text;
    if (language === 'fr') {
      const greeting = (professional ? 'Bonjour' : 'Salut') + (contact ? ' '+contact : '') + ',';
      const bodies = {
        reply:'Merci pour ton message.\n[Écris ici ta réponse et vérifie les informations avant l’envoi.]',
        ask_info:'Pour te répondre, pourrais-tu me confirmer [information dont tu as besoin] ?',
        follow_up:'Je reviens vers toi au sujet de [sujet à reprendre].\nPeux-tu me dire où cela en est ?',
        schedule:'Est-ce que [jour et créneau que tu proposes] te conviendrait pour en parler ?\nSinon, quel horaire te conviendrait ?'
      };
      let body = bodies[intent];
      if (professional) body = body.replace(/\bton\b/g,'votre').replace(/\bte\b/g,'vous').replace(/\btoi\b/g,'vous').replace(/pourrais-tu/g,'pourriez-vous').replace(/Peux-tu/g,'Pouvez-vous').replace(/\btu as\b/g,'vous avez').replace(/\btu proposes\b/g,'vous proposez');
      text = greeting+'\n\n'+body+'\n\n'+(professional?'Bien cordialement,':'À bientôt,')+'\n'+name;
    } else {
      const greeting = 'Hola'+(contact?', '+contact:'')+':';
      const bodies = {
        reply:'Gracias por tu mensaje.\n[Escribe aquí tu respuesta y comprueba los datos antes de enviarla.]',
        ask_info:'Para poder responderte, ¿podrías confirmarme [dato que necesitas]?',
        follow_up:'Te escribo sobre [asunto que quieres retomar].\n¿Podrías decirme en qué punto está?',
        schedule:'¿Te vendría bien hablar [día y franja horaria que propones]?\nSi no, dime qué horario te viene mejor.'
      };
      let body = bodies[intent];
      if (professional) body = body.replace(/\btu mensaje\b/g,'su mensaje').replace(/\bresponderte\b/g,'responderle').replace(/\bpodrías\b/g,'podría').replace(/\bPodrías\b/g,'Podría').replace(/^Te escribo/,'Le escribo').replace(/¿Te vendría/,'¿Le vendría').replace(/dime qué horario te viene/,'dígame qué horario le viene');
      text = greeting+'\n\n'+body+'\n\n'+(professional?'Un saludo cordial,':'Un saludo,')+'\n'+name;
    }
    return {text:text,label:'Plantilla para revisar',isTemplate:true,needsReview:true,readyToSend:false,intent:intent,language:language};
  }
  function buildMailto(raw, draft) {
    const item = normalizeItem(raw), address = email(item.email);
    if (!address) fail('EMAIL_REQUIRED','Añade y comprueba la dirección del destinatario antes de abrir el correo.');
    const body = value(typeof draft === 'object' && draft ? draft.text : draft, MAX_BODY, 'borrador');
    if (!body.trim()) fail('EMPTY_DRAFT','Escribe o prepara una respuesta antes de abrir el correo.');
    if (/\[(?:Escribe aquí|dato que necesitas|asunto que quieres retomar|día y franja horaria|Écris ici|information dont|sujet à reprendre|jour et créneau|Ton nom|Tu nombre)[^\]\n]*\]/i.test(body)) fail('UNFILLED_TEMPLATE','Completa los campos entre corchetes antes de abrir el correo. También puedes copiar el borrador para seguir preparándolo.');
    if (/[\r\n]/.test(raw.subject || '')) fail('INVALID_SUBJECT','El asunto del correo debe ocupar una sola línea.');
    const subject = item.subject ? (/^re:/i.test(item.subject) ? item.subject : 'Re: '+item.subject) : '';
    const uri = 'mailto:'+encodeURIComponent(address).replace(/%40/g,'@')+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body.replace(/\r?\n/g,'\r\n'));
    if (uri.length > 8000) fail('DRAFT_TOO_LONG_FOR_LINK','Este borrador es demasiado largo para abrirlo mediante un enlace. Cópialo y pégalo en tu correo.');
    return uri;
  }
  return Object.freeze({parseEml:parseEml,normalizeItem:normalizeItem,makeDraft:makeDraft,buildMailto:buildMailto,fingerprint:fingerprint,limits:Object.freeze({maxBytes:MAX_BYTES,maxMessages:MAX_MESSAGES,maxBodyCharacters:MAX_BODY})});
});
