import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {original,makeItem,emptyState,demoState,exportState,importState,validateState,addBoard,pin,essential,searchItems,un64,sha256} from '../docs/helene/core.mjs';

test('export et restauration conservent les octets originaux et les mots exacts',async()=>{
 const bytes=Uint8Array.from([0,255,13,10,2,3,128]);
 const file=await original('essai.bin','application/octet-stream',bytes);
 const text='  Mes mots : éèà\n\nSans reformulation.  ';
 const s=emptyState();s.items.push(await makeItem({text,title:'Un original',files:[file]}));
 const objection='  Je ne suis pas d’accord.\nPourquoi ?  ';addBoard(s,'objection',objection);
 const restored=await importState(await exportState(s));
 assert.deepEqual(un64(restored.items[0].originals[0].base64),bytes);
 assert.equal(restored.items[0].originalText,text);assert.equal(restored.board[0].text,objection);
 assert.equal(restored.board[0].delivery,'draft_only');
});
test('un export modifié est refusé sans le réparer silencieusement',async()=>{
 const s=await demoState(),o=JSON.parse(await exportState(s));o.data.items[0].title='Titre modifié';
 await assert.rejects(importState(JSON.stringify(o)),/modifié/);
});
test('un original altéré reste refusé même si le checksum du conteneur est recalculé',async()=>{
 const s=await demoState();s.items[1].originals[0]={...s.items[1].originals[0],base64:'AAAA'};
 await assert.rejects(validateState(s),/altéré/);
});
test('trois éléments choisis au maximum et aucune addition implicite',async()=>{
 const s=await demoState();const fourth=await makeItem({text:'Quatrième essai'});s.items.push(fourth);
 assert.equal(essential(s).length,3);assert.throws(()=>pin(s,fourth.id),/trois/);
 pin(s,s.pinned[0]);pin(s,fourth.id);assert.equal(essential(s).length,3);assert.equal(essential(s)[2].id,fourth.id);
});
test('recherche locale insensible aux accents, filtrage des fichiers',async()=>{
 const s=await demoState();assert.equal(searchItems(s.items,'fenetre').length,1);
 assert.equal(searchItems(s.items,'ma-liste-exemple','file').length,1);
 assert.equal(searchItems(s.items,'ma-liste-exemple','note').length,0);
});
test('les identifiants dupliqués et liens vers des éléments absents sont refusés',async()=>{
 const s=await demoState();s.items[1].id=s.items[0].id;await assert.rejects(validateState(s),/dupliqué/);
 const t=await demoState();t.items[0].links=['inconnu'];await assert.rejects(validateState(t),/lien/);
});
test('adaptateur voix réutilisé sans modification depuis LEGAD et Deivid',async()=>{
 const bytes=await readFile(new URL('../docs/helene/vendor/voice-capture.mjs',import.meta.url));
 assert.equal(await sha256(bytes),'f3f8a53b31b4bc77545048a9456782605c0cedf5970e8d62849597fbba959ae5');
});
test('les entrées vides et fichiers hors limite sont refusés',async()=>{
 await assert.rejects(makeItem({text:'  '}),/quelques mots/);
 await assert.rejects(original('vide.txt','text/plain',new Uint8Array()),/octet/);
 const s=emptyState();assert.throws(()=>addBoard(s,'objection','  '),/Écris/);
});
test('les exports de la revue précédente restent restaurables sans changer les originaux',async()=>{
 const s=await demoState();s.format='ojo-helene-review-v1';const checksum=await sha256(new TextEncoder().encode(JSON.stringify(s)));
 const restored=await importState(JSON.stringify({format:s.format,checksum,data:s}));
 assert.equal(restored.format,'ojo-helene-space-v1');assert.equal(restored.items[0].originalText,s.items[0].originalText);assert.equal(restored.items[0].demo,true);
});
