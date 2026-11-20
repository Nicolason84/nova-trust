/* The public reader handles only the signed edition and the two existing encrypted envelopes. */
'use strict';
window.JaimePortable = (() => {
  const magic = new TextEncoder().encode('JAIME-PORTABLE/1\n');
  const offset = magic.byteLength + 4;
  const maxHeader = 4 * 1024 * 1024;
  const maxEdition = 82 * 1024 * 1024;
  const invalid = () => new Error('La copia está incompleta o su formato no es compatible.');
  const exact = (obj, names) => obj && typeof obj === 'object' && !Array.isArray(obj) &&
    Object.keys(obj).sort().join(',') === names.slice().sort().join(',');
  const base64 = (s,min,max) => typeof s === 'string' && s.length >= min && s.length <= max &&
    s.length % 4 !== 1 && /^[A-Za-z0-9_-]+$/.test(s);
  function envelope(v, max) {
    return exact(v,['v','alg','iv','ct']) && v.v === 1 && v.alg === 'A256GCM' &&
      base64(v.iv,16,16) && base64(v.ct,23,max);
  }
  function valid(contents) {
    if (!exact(contents,['format','v','kit','snapshot']) || contents.format !== 'jaime-portable' || contents.v !== 1) return false;
    const {kit,snapshot} = contents;
    return exact(kit,['format','v','edition','id','rounds','salt','content']) &&
      kit.format === 'jaime-recovery' && kit.v === 1 && kit.rounds === 320000 &&
      typeof kit.id === 'string' && /^[0-9a-f]{32}$/.test(kit.id) &&
      typeof kit.edition === 'string' && /^[0-9a-f]{16}$/.test(kit.edition) &&
      base64(kit.salt,22,22) && envelope(kit.content,6500) &&
      exact(snapshot,['format','v','edition','id','envelope']) && snapshot.format === 'jaime-snapshot' &&
      snapshot.v === 1 && snapshot.id === kit.id && snapshot.edition === kit.edition && envelope(snapshot.envelope,4000000);
  }
  async function unpack(file) {
    if (!(file instanceof Blob)) throw invalid();
    const start = new Uint8Array(await file.slice(0,offset).arrayBuffer());
    if (!magic.every((byte,i) => start[i] === byte)) {
      if (/\.jaime$/i.test(file.name || '')) throw invalid();
      return {edition:file,contents:null};
    }
    if (start.length !== offset) throw invalid();
    const length = new DataView(start.buffer).getUint32(magic.length);
    const editionAt = offset + length;
    if (length === 0 || length > maxHeader || file.size - editionAt < 10000 || file.size - editionAt > maxEdition) throw invalid();
    let contents;
    try {contents = JSON.parse(await file.slice(offset,editionAt).text());} catch (_) {throw invalid();}
    if (!valid(contents)) throw invalid();
    return {edition:file.slice(editionAt,file.size,'text/html;charset=utf-8'),contents};
  }
  function pack(edition,contents) {
    if (!(edition instanceof Blob) || edition.size < 10000 || edition.size > maxEdition || !valid(contents)) throw invalid();
    const json = new TextEncoder().encode(JSON.stringify(contents));
    if (json.length > maxHeader) throw invalid();
    const len = new DataView(new ArrayBuffer(4)); len.setUint32(0,json.length);
    return new Blob([magic,len.buffer,json,edition],{type:'application/octet-stream'});
  }
  function save(edition,contents) {
    const blob=pack(edition,contents), date=new Date().toISOString().replace(/[:.]/g,'-');
    const a=document.createElement('a'), url=URL.createObjectURL(blob);
    a.href=url;a.download='Mi_espacio_'+date+'.jaime';document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    return true;
  }
  return Object.freeze({unpack,save,pack});
})();
