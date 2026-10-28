import test from 'node:test';
import assert from 'node:assert/strict';
import {createVault,unlockVault,addMemory,readMedia,exportVault,parseBackup,changePassword,sha256} from '../docs/helene/vendor/legad-vault.mjs';
import {makeAppointment,validateAppointments,calendarFile,phraseForDay,appointmentShareText,upcoming} from '../docs/helene/everyday.mjs';
import {emptyState,makeItem,exportState,importState} from '../docs/helene/core.mjs';
import {universalRequest,chooseService,mailDraftURL,monthlyBudget,shoppingURL} from '../docs/helene/services.mjs';

const pass='Quatre mots uniquement pour le test 2026';
const secretNote='FICHE SYNTHÉTIQUE — Dr Essai, 0102030405';
const bytes=new Uint8Array([0,1,2,13,10,127,128,254,255]);
async function fixture(){
 const initial=await createVault(pass,{name:'Coffre de test synthétique'});
 const result=await addMemory(initial.vault,initial.key,{title:'Coordonnées de test',note:secretNote,collection:'doctor',ownerConsent:true},[new File([bytes],'original-synthetique.bin',{type:'application/octet-stream'})]);
 return {...initial,vault:result.vault,item:result.item};
}
test('coffre : titres, coordonnées et octets restent chiffrés au repos et se retrouvent après export/restauration',async()=>{
 const f=await fixture(),text=await exportVault(f.vault);
 for(const clear of [pass,secretNote,'Coordonnées de test','original-synthetique.bin','0102030405'])assert.equal(text.includes(clear),false);
 const restored=await unlockVault(await parseBackup(text),pass,{full:true});
 assert.equal(restored.items[0].note,secretNote);assert.equal(restored.items[0].consent.owner,true);assert.equal('guardian' in restored.items[0].consent,false);
 assert.deepEqual(new Uint8Array(await (await readMedia(restored.vault,restored.key,restored.items[0].id,restored.items[0].attachments[0].id)).arrayBuffer()),bytes);
});
test('coffre : phrase incorrecte refusée, sans réparation silencieuse',async()=>{
 const f=await fixture();await assert.rejects(unlockVault(f.vault,'Une autre phrase de test bien distincte'));
});
test('coffre : altération d’un original refusée même après recalcul du checksum public',async()=>{
 const f=await fixture(),v=structuredClone(f.vault);const c=v.records[0].media[0].chunks[0].cipher;v.records[0].media[0].chunks[0].cipher=(c[0]==='A'?'B':'A')+c.slice(1);
 const backup=await exportVault(v),parsed=await parseBackup(backup);await assert.rejects(unlockVault(parsed,pass,{full:true}));
});
test('coffre : suppression d’un enregistrement refusée par le manifeste authentifié',async()=>{
 const f=await fixture(),v=structuredClone(f.vault);v.records=[];
 await assert.rejects(unlockVault(await parseBackup(await exportVault(v)),pass,{full:true}));
});
test('coffre : le code de secours retrouve une copie sans la phrase',async()=>{
 const f=await fixture(),restored=await unlockVault(await parseBackup(await exportVault(f.vault)),f.recoveryCode,{recovery:true,full:true});
 assert.equal(restored.items[0].note,secretNote);
});
test('coffre : changement de phrase conserve originaux et code de secours, refuse l’ancienne phrase',async()=>{
 const f=await fixture(),newPass='Une nouvelle longue phrase de test 2026';
 const changed=await changePassword(f.vault,f.key,pass,newPass);await assert.rejects(unlockVault(changed,pass));
 const opened=await unlockVault(changed,newPass),recovery=await unlockVault(changed,f.recoveryCode,{recovery:true});
 assert.equal(opened.items[0].attachments[0].sha256,await sha256(bytes));assert.equal(recovery.items[0].note,secretNote);
});
const appointment=()=>makeAppointment({id:'synthetic-appointment',title:'Balade de test',start:'2026-10-31T10:00',end:'2026-10-31T11:00',kind:'together',attendee:'fixture@example.invalid',reminder:30});
test('agenda : rendez-vous à deux conservé comme local, sans preuve d’envoi ni de notification',()=>{
 const i=appointment();assert.equal(i.delivery,'local_only');assert.equal(i.kind,'together');assert.equal(i.reminder,30);
 assert.match(appointmentShareText(i),/Aucun rappel ni invitation automatique/);
 assert.equal(upcoming([i],new Date('2026-10-30T00:00:00Z')).length,1);assert.equal(upcoming([i],new Date('2026-11-01T00:00:00Z')).length,0);
});
test('agenda : dates impossibles, fin antérieure, destinataire et choix de rappel invalides refusés',()=>{
 for(const changes of [{start:'2026-02-31T10:00'},{end:'2026-10-31T09:00'},{attendee:'mauvaise adresse'},{reminder:123}])assert.throws(()=>makeAppointment({...appointment(),...changes}));
 assert.throws(()=>validateAppointments([appointment(),appointment()]));
});
test('agenda : changement d’heure français traité à la création',()=>{
 if(Intl.DateTimeFormat().resolvedOptions().timeZone!=='Europe/Paris')return;
 assert.throws(()=>makeAppointment({title:'Test DST',start:'2026-03-29T02:30',end:'2026-03-29T04:00'}));
 assert.equal(appointment().startUTC,'2026-10-31T09:00:00.000Z');
});
test('agenda : ICS avec rappel demandé, texte échappé, lignes UTF-8 bornées et aucune invitation',()=>{
 const i=makeAppointment({...appointment(),title:'Été à deux, '+ 'é'.repeat(100)+'\nATTENDEE:injection',note:'ligne 1\nligne 2; virgule, et \\'}),ics=calendarFile([i]);
 assert.match(ics,/BEGIN:VALARM\r\nACTION:DISPLAY/);assert.match(ics,/TRIGGER:-PT30M/);assert.equal(/\r\nATTENDEE:/.test(ics),false);
 for(const line of ics.split('\r\n'))assert.ok(new TextEncoder().encode(line).length<=75);
 assert.match(ics,/CLASS:PRIVATE/);assert.match(ics,/METHOD:PUBLISH/);
});
test('ancien espace : notes, originaux et objections conservés, agenda vide ajouté sans effacement',async()=>{
 const s=emptyState();s.items=[await makeItem({title:'Note existante',text:'Mes mots exacts, déjà présents.'})];delete s.agenda;delete s.comfort;
 const data=JSON.stringify(s),text=JSON.stringify({format:s.format,data:s,checksum:await sha256(new TextEncoder().encode(data))});
 const restored=await importState(text);assert.equal(restored.items[0].originalText,s.items[0].originalText);assert.deepEqual(restored.agenda,[]);assert.equal(restored.comfort,true);
 restored.agenda=[appointment()];assert.equal((await importState(await exportState(restored))).agenda[0].id,'synthetic-appointment');
});
test('phrase du jour : déterministe par date, différente le lendemain, sans service extérieur',()=>{
 assert.equal(phraseForDay('2026-10-28'),phraseForDay('2026-10-28'));assert.notEqual(phraseForDay('2026-10-28'),phraseForDay('2026-10-29'));assert.throws(()=>phraseForDay('pas une date'));
});
test('entrées universelles : originaux référencés avec empreintes, aucune identité ni action native fabriquée',async()=>{
 const request=await universalRequest('Une question sur mon assurance https://example.invalid/contrat',[{name:'synthetique.pdf',type:'application/pdf',size:9,sha256:await sha256(bytes)}]);
 assert.equal(request.module,'assurances');assert.equal(request.status,'PREPARED_ON_DEVICE');assert.equal(request.authority.nativeAdmission,false);assert.equal(request.authority.transmitted,false);assert.deepEqual(request.authority.approvedActions,[]);assert.equal(request.producer,'browser_visitor_unverified');assert.equal('base64' in request.originals[0],false);assert.deepEqual(request.links,['https://example.invalid/contrat']);
 await assert.rejects(universalRequest('',[]));await assert.rejects(universalRequest('Test',[{name:'bad',size:1,sha256:'invalide'}]));
});
test('modules : choix explicite respecté, parcours de pharmacie, mails, achats et banque disponibles',()=>{
 assert.equal(chooseService('Une pharmacie de garde').id,'sante');assert.equal(chooseService('Mes mails').id,'mails');assert.equal(chooseService('Acheter un canapé').id,'achats');assert.equal(chooseService('Mon budget').id,'banque');assert.equal(chooseService('Mon budget','quotidien').id,'quotidien');
});
test('brouillon mail : destinataire et en-tête vérifiés, contenu encodé, aucune action d’envoi',()=>{
 const url=mailDraftURL({to:'fixture@example.invalid',subject:'Un objet à relire',body:'Ligne 1\nLigne 2 & suite'});assert.ok(url.startsWith('mailto:fixture@example.invalid?subject='));assert.ok(url.includes('%20'));assert.ok(url.includes('%0A'));assert.ok(url.includes('%26'));
 assert.throws(()=>mailDraftURL({to:'a@example.invalid\nBcc:other@example.invalid'}));assert.throws(()=>mailDraftURL({to:'fixture@example.invalid',subject:'Objet\r\nBcc:injection'}));
});
test('budget : centimes exacts sur montants fournis, aucune connexion ou inférence de solde',()=>{
 const result=monthlyBudget('10.10','0,20');assert.equal(result.remaining,9.9);assert.equal(result.isBankConnection,false);assert.equal(result.source,'user_entered');assert.throws(()=>monthlyBudget('1.005','0'));assert.throws(()=>monthlyBudget('-1','0'));
});
test('achat : seuls les mots choisis forment une recherche ; aucune offre ou commande inventée',()=>{
 const url=new URL(shoppingURL('Table & chaises 300 €'));assert.equal(url.hostname,'www.google.com');assert.equal(url.searchParams.get('q'),'Table & chaises 300 €');assert.equal(url.searchParams.get('tbm'),'shop');assert.throws(()=>shoppingURL(''));
});
