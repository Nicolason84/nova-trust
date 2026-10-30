'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../docs/jaime/communications.js');
const eml = lines => lines.join('\r\n');
const codes = result => result.notices.map(n => n.code);

test('plain EML keeps source identity unverified and respects the stated timezone', () => {
  const r = C.parseEml(eml(['From: "Clara Ejemplo" <clara@example.test>','To: Jaime <jaime@example.test>','Subject: Información del proveedor','Date: Fri, 30 Oct 2026 08:15:00 +0200','Content-Type: text/plain; charset=UTF-8','','Hola Jaime,','¿Puedes llamarme?']));
  assert.equal(r.items.length,1);
  assert.equal(r.items[0].contact,'Clara Ejemplo');
  assert.equal(r.items[0].email,'clara@example.test');
  assert.equal(r.items[0].body,'Hola Jaime,\n¿Puedes llamarme?');
  assert.equal(r.items[0].receivedAt,'2026-10-30T06:15:00.000Z');
  assert.equal(r.meta.identityVerified,false);
  assert.equal(r.items[0].meta.headers.to,'Jaime <jaime@example.test>');
});

test('folded RFC 2047 headers and quoted-printable body decode without treating text as markup', () => {
  const r = C.parseEml(eml(['From: =?UTF-8?Q?Clara_Mu=C3=B1oz?= <clara@example.test>','Subject: =?UTF-8?Q?Informaci=C3=B3n?=',' =?UTF-8?Q?_del_d=C3=ADa?=','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: quoted-printable','','Caf=C3=A9 y transporte.','=3Cscript=3Eno ejecutar=3C/script=3E','Texto =','continuado.']));
  assert.equal(r.items[0].contact,'Clara Muñoz');
  assert.equal(r.items[0].subject,'Información del día');
  assert.equal(r.items[0].body,'Café y transporte.\n<script>no ejecutar</script>\nTexto continuado.');
});

test('multipart alternative prefers text and reports attachments without importing their bytes', () => {
  const r = C.parseEml(eml(['From: Clara <clara@example.test>','Subject: Propuesta','Content-Type: multipart/mixed; boundary="outer"','','--outer','Content-Type: multipart/alternative; boundary="inner"','','--inner','Content-Type: text/plain','','Importe por confirmar.','--inner','Content-Type: text/html','','<b>Importe por confirmar.</b>','--inner--','--outer','Content-Type: application/pdf; name="propuesta.pdf"','Content-Disposition: attachment; filename="propuesta.pdf"','Content-Transfer-Encoding: base64','','JVBERi0xLjc=','--outer--']));
  assert.equal(r.items[0].body,'Importe por confirmar.');
  assert.deepEqual(r.meta.attachments,[{name:'propuesta.pdf',type:'application/pdf'}]);
  assert.ok(codes(r).includes('HTML_ALTERNATIVE'));
  assert.ok(codes(r).includes('ATTACHMENTS_NOT_IMPORTED'));
  assert.ok(!JSON.stringify(r.items).includes('JVBER'));
});

test('base64 Latin-1 text decodes; malformed base64 is kept with a notice', () => {
  const r = C.parseEml(eml(['From: clara@example.test','Content-Type: text/plain; charset=ISO-8859-1','Content-Transfer-Encoding: base64','','Q2Fm6Q==']));
  assert.equal(r.items[0].body,'Café');
  const broken = C.parseEml(eml(['From: clara@example.test','Content-Type: text/plain','Content-Transfer-Encoding: base64','','%%%broken%%%']));
  assert.equal(broken.items[0].body,'%%%broken%%%');
  assert.ok(codes(broken).includes('TRANSFER_DECODE_FAILED'));
});

test('HTML-only and mixed HTML content remain literal text; no part disappears silently', () => {
  const html = '<img src="https://example.test/pixel"><script>throw 1</script><p>Hola</p>';
  const r = C.parseEml(eml(['From: clara@example.test','Content-Type: text/html','',''+html]));
  assert.equal(r.items[0].body,html);
  assert.equal(r.items[0].meta.bodyKind,'html_source');
  assert.ok(codes(r).includes('HTML_AS_TEXT'));
  const mixed = C.parseEml(eml(['From: clara@example.test','Content-Type: multipart/mixed; boundary=m','','--m','Content-Type: text/plain','','Primera parte','--m','Content-Type: text/html','','<p>Segunda parte</p>','--m--']));
  assert.equal(mixed.items[0].body,'Primera parte\n\n<p>Segunda parte</p>');
  assert.equal(mixed.items[0].meta.bodyKind,'mixed_text_html_source');
});

test('unreadable dates and encrypted messages are explicit rather than fabricated', () => {
  const r = C.parseEml(eml(['From: clara@example.test','Date: 31 Feb 2026 10:00:00 +0000','Content-Type: multipart/encrypted; boundary=x','','--x','encrypted','--x--']));
  assert.equal(r.items[0].receivedAt,null);
  assert.equal(r.items[0].dateText,'31 Feb 2026 10:00:00 +0000');
  assert.equal(r.items[0].body,'');
  assert.ok(codes(r).includes('ENCRYPTED_EMAIL'));
  assert.ok(codes(r).includes('DATE_UNCONFIRMED'));
  assert.ok(codes(r).includes('BODY_UNAVAILABLE'));
  const noZone=C.parseEml(eml(['From: clara@example.test','Date: 30 Oct 2026 10:00:00 -0000','','Hola']));
  assert.equal(noZone.items[0].receivedAt,null);
  assert.ok(codes(noZone).includes('DATE_UNCONFIRMED'));
});

test('an invalid or ambiguous From never becomes a guessed partial recipient', () => {
  for (const from of ['josé@example.test','alice@example.test, bob@example.test','Alice <alice@example.test>, Bob <bob@example.test>','Alice <alice@example.test>; bcc=other@example.test']) {
    const r = C.parseEml(eml(['From: '+from,'Subject: Test','','Body']));
    assert.equal(r.items[0].email,'',from);
    assert.ok(codes(r).includes('SENDER_CONFIRMATION'));
  }
});

test('Reply-To and malformed MIME are flagged, not silently substituted', () => {
  const r = C.parseEml(eml(['From: Clara <clara@example.test>','Reply-To: other@example.test','Content-Type: multipart/mixed; boundary="x"','','--x','Content-Type: text/plain','','Only available part']));
  assert.equal(r.items[0].email,'clara@example.test');
  assert.equal(r.items[0].body,'Only available part');
  assert.ok(codes(r).includes('REPLY_TO_PRESENT'));
  assert.ok(codes(r).includes('INCOMPLETE_MIME'));
});

test('invalid, oversized or binary EML is rejected', () => {
  assert.throws(()=>C.parseEml('x'.repeat(C.limits.maxBytes+1)), e=>e.code==='FILE_TOO_LARGE');
  assert.throws(()=>C.parseEml('Una nota sin cabeceras'), e=>e.code==='INVALID_EML');
  assert.throws(()=>C.parseEml('PK\u0003\u0004abcdef'), e=>e.code==='BINARY_INPUT');
});

test('normalization validates dates and emails without mutating the source object', () => {
  const raw={contact:'Clara',channel:'email',email:'Clara@EXAMPLE.TEST',body:'Hola',nextFollowUpAt:'2026-11-01',meta:{source:'test'}};
  const normalized=C.normalizeItem(raw);
  assert.equal(normalized.email,'Clara@example.test');
  normalized.meta.source='changed';
  assert.equal(raw.meta.source,'test');
  assert.equal(raw.id,undefined);
  assert.equal(normalized.status,'to_reply');
  assert.throws(()=>C.normalizeItem({...raw,receivedAt:'2026-02-30T10:00:00'}),e=>e.code==='INVALID_DATE');
  assert.throws(()=>C.normalizeItem({...raw,email:'clara@example.test\nBcc: other@example.test'}),e=>e.code==='INVALID_EMAIL');
  assert.throws(()=>C.normalizeItem({...raw,email:'clara@example.test\n'}),e=>e.code==='INVALID_EMAIL');
  assert.throws(()=>C.normalizeItem({...raw,body:'x'.repeat(C.limits.maxBodyCharacters+1)}),e=>e.code==='FIELD_TOO_LONG');
});

test('draft helpers are labelled templates, keep placeholders and invent no price or meeting date', () => {
  const item={contact:'Clara',channel:'email',body:'Can you quote 400 euros?'};
  for (const intent of ['reply','ask_info','follow_up','schedule']) {
    const draft=C.makeDraft(item,{intent:intent,name:'Jaime',language:'es'});
    assert.equal(draft.label,'Plantilla para revisar');
    assert.equal(draft.isTemplate,true);
    assert.equal(draft.readyToSend,false);
    assert.ok(draft.text.includes('['));
    assert.ok(draft.text.includes('Jaime'));
    assert.ok(!draft.text.includes('400'));
  }
  assert.ok(C.makeDraft(item,{language:'fr',tone:'professional',intent:'ask_info'}).text.includes('pourriez-vous'));
});

test('mailto only prepares one validated recipient, safely encodes subject/body and rejects placeholders', () => {
  const item={contact:'Clara',channel:'email',email:'clara+negocio@example.test',subject:'Tarifa & transporte?',body:'Hola'};
  const uri=C.buildMailto(item,'Hola Clara,\nNecesito confirmar el precio.');
  assert.match(uri,/^mailto:clara%2Bnegocio@example\.test\?/);
  const query=new URLSearchParams(uri.slice(uri.indexOf('?')+1));
  assert.equal(query.get('subject'),'Re: Tarifa & transporte?');
  assert.equal(query.get('body'),'Hola Clara,\r\nNecesito confirmar el precio.');
  assert.equal(query.has('bcc'),false);
  assert.match(C.buildMailto(item,'Sobre la referencia [ABC-123], necesito confirmar el precio.'),/^mailto:/);
  assert.throws(()=>C.buildMailto(item,C.makeDraft(item)),e=>e.code==='UNFILLED_TEMPLATE');
  assert.throws(()=>C.buildMailto({...item,subject:'Asunto\nBcc: other@example.test'},'Hola'),e=>e.code==='INVALID_SUBJECT');
  assert.throws(()=>C.buildMailto({...item,email:'clara@example.test?bcc=other@example.test'},'Hola'),e=>e.code==='INVALID_EMAIL');
  assert.throws(()=>C.buildMailto(item,'x'.repeat(9000)),e=>e.code==='DRAFT_TOO_LONG_FOR_LINK');
});
