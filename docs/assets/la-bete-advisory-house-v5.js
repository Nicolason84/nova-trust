/* LA_BETE_ADVISORY_HOUSE_SPATIAL_EXPERIENCE_V5
   Spatial presentation layer over existing governed assets. No second engine/registry/truth/memory. */
(()=>{
'use strict';
const body=document.body;
if(!body?.classList.contains('public-experience-v1')||body.classList.contains('advisory-house-v5'))return;
const byId=id=>document.getElementById(id);
const header=document.querySelector('.wrap > .top');
const intro=byId('experience-start');
const question=byId('dialogue-public');
const answer=byId('decision-twin');
const proof=byId('evidence-graph');
const explore=byId('experience-explore');
const action=byId('supra-mission');
if(!header||!question||!answer||!proof||!explore||!action)return;

const roomSpec=[
 {id:'desk',label:'Bureau',no:'01',node:question,kicker:'POINT D’ENTRÉE UNIQUE',title:'Confiez le problème une fois.',note:'SUPRA organise ensuite le dossier et n’expose que ce qui vous est utile.'},
 {id:'decision',label:'Décision',no:'02',node:answer,kicker:'DECISION ROOM',title:'La décision, avant la machine.',note:'Decision Twin reste le résultat. Les raisons et scénarios restent disponibles à la demande.'},
 {id:'proof',label:'Preuves',no:'03',node:proof,kicker:'EVIDENCE ROOM',title:'Ouvrir ce qui porte la réponse.',note:'ProofGraph + Evidence Universe restent la même colonne vertébrale probante.'},
 {id:'explore',label:'Explorer',no:'04',node:explore,kicker:'OBSERVATORY',title:'Explorer seulement quand cela aide.',note:'Cosmos reste volontaire : profondeur progressive, jamais parcours obligatoire.'},
 {id:'mission',label:'Mission',no:'05',node:action,kicker:'MISSION OFFICE',title:'Transformer le besoin en mission.',note:'Valeur d’abord, offre ensuite. Toute exécution sensible reste derrière Human Gate.'}
];
const boundRole={
 desk:{label:'Mission Director',binding:'Dialogue existant · Case context public'},
 decision:{label:'Decision',binding:'Decision Twin existant'},
 proof:{label:'Evidence',binding:'ProofGraph + Evidence Universe existants'},
 explore:{label:'Observatory',binding:'Cosmos / Explorer existants'},
 mission:{label:'Solutions',binding:'SUPRA Mission / offre existante'}
};
const state={room:'desk',orientation:'',caseState:'PUBLIC_CASE_ACTIVE',privateOffice:'BOUNDARY_ONLY',lastQuestion:''};
const house=document.createElement('section');
house.id='advisory-house-v5';
house.className='advisoryHouseV5';
house.setAttribute('aria-labelledby','houseTitle');
house.innerHTML=`
 <div class="houseHeader">
   <div>
     <div class="houseEyebrow">THE LIVING ADVISORY HOUSE · LA BÊTE → SUPRA</div>
     <h1 id="houseTitle">Bonsoir. <em>Que souhaitez-vous résoudre&nbsp;?</em></h1>
     <p>Vous décrivez le problème une fois. SUPRA garde le dossier, mobilise seulement les capacités réellement liées, vous montre la décision, la preuve et la prochaine action — sans vous demander de gérer son organisation.</p>
   </div>
   <aside class="houseIdentity" aria-label="Mission Director">
     <span class="houseIdentityOrb" aria-hidden="true"></span>
     <div><span class="houseEyebrow">RÔLE NUMÉRIQUE SUPRA</span><strong>Mission Director</strong><small>Représentation numérique d’un rôle de coordination. Aucune identité professionnelle humaine n’est simulée.</small></div>
   </aside>
 </div>
 <div class="houseCaseBar" aria-label="Contexte du dossier">
   <div class="houseCaseCell"><small>Dossier</small><strong id="houseCaseTitle">France · Dette / Taux / Refinancement</strong></div>
   <div class="houseCaseCell"><small>État utile</small><strong id="houseCaseState">Réponse disponible · preuves à contrôler</strong></div>
   <div class="houseCasePulse" id="houseCasePulse">Même dossier · même preuve · même mission.</div>
 </div>
 <div class="houseInterior">
   <aside class="houseRail">
     <section class="houseDirector" aria-live="polite">
       <span class="houseDirectorLabel">SUPRA · Mission Director</span>
       <h2 id="houseDirectorRole">Accueil du dossier</h2>
       <p id="houseDirectorStatus">Expliquez le problème une fois. Je vous oriente sans vous faire choisir une spécialité.</p>
       <span class="houseBinding" id="houseDirectorBinding">Binding : dialogue public existant · aucun nouveau moteur.</span>
       <div class="houseRoleLine" id="houseRoleLine" aria-label="Rôles liés au dossier"></div>
       <div class="houseRouteHint" id="houseRouteHint" hidden></div>
     </section>
     <nav class="houseRooms" role="tablist" aria-label="Espaces du dossier"></nav>
     <div class="housePrivateBoundary"><b>Bureau privé SUPRA</b><span>Frontière protégée.</span> Cette origine publique ne stocke ni dossier privé ni mémoire client. <a class="housePrivateDoor" id="housePrivateDoor" href="supra://private-office" aria-label="Ouvrir le Bureau privé dans SUPRA">Entrer dans mon Bureau privé →</a><small>Aucun dossier, message ou identifiant n’est transmis dans ce lien.</small></div>
   </aside>
   <div class="houseStage"></div>
 </div>`;
const roomNav=house.querySelector('.houseRooms');
const stage=house.querySelector('.houseStage');
const paneByRoom=new Map();
for(const spec of roomSpec){
 const b=document.createElement('button');
 b.type='button';b.className='houseRoomButton';b.dataset.houseRoom=spec.id;b.setAttribute('role','tab');b.setAttribute('aria-controls','house-'+spec.id);
 b.innerHTML='<span class="houseRoomNo">'+spec.no+'</span><strong>'+spec.label+'</strong><small>→</small>';
 roomNav.appendChild(b);
 const pane=document.createElement('section');pane.className='housePane';pane.id='house-'+spec.id;pane.dataset.houseRoom=spec.id;pane.setAttribute('role','tabpanel');
 const head=document.createElement('header');head.className='housePaneHead';
 head.innerHTML='<div><small>'+spec.kicker+'</small><strong>'+spec.title+'</strong></div><span>'+spec.note+'</span>';
 const bodyWrap=document.createElement('div');bodyWrap.className='housePaneBody';
 if(spec.id==='desk'){
   const pre=document.createElement('div');pre.className='houseDeskPrelude';
   pre.innerHTML='<article class="houseDeskCard"><small>Case continuity</small><strong>Un seul dossier, pas cinq formulaires.</strong><p>Votre conversation reste attachée au même contexte de page. Les pièces publiques, décisions et preuves restent les objets existants.</p></article><article class="houseDeskCard houseAttention"><small>Ask only what is missing</small><strong>Pas de répétition volontaire.</strong><p>Le dialogue actuel conserve son fil local ; une surface privée persistante n’est pas simulée ici.</p></article>';
   bodyWrap.appendChild(pre);
 }
 if(spec.id==='decision'){
   const committee=document.createElement('details');committee.className='houseCommittee';committee.id='houseCommittee';
   committee.innerHTML='<summary><span>COMITÉ · SYNTHÈSE</span><strong>Une intelligence collective, sans théâtre multi-agent.</strong></summary><div class="houseCommitteeGrid"><article><small>Consensus</small><b id="houseCommitteeConsensus">Lecture décisionnelle disponible.</b></article><article><small>Désaccords</small><b>NONE_EVIDENCED</b></article><article><small>Inconnues</small><b id="houseCommitteeUnknowns">Voir les alertes de preuve.</b></article><article><small>Options</small><b>Vérifier · comparer · décider · mission</b></article></div>';
   bodyWrap.appendChild(committee);
 }
 if(spec.id==='mission'){
   const brief=document.createElement('section');brief.className='houseMissionBrief';brief.id='houseMissionBrief';
   brief.innerHTML='<div class="houseMissionBriefHead"><small>CONVERSATIONAL SOLUTION & MISSION FACTORY</small><strong>Le produit se configure derrière la conversation.</strong></div><div class="houseMissionBriefGrid"><article><small>Need</small><b id="houseMissionNeed">Aucun besoin privé confié sur cette origine.</b></article><article><small>Existing solution</small><b>SUPRA Mission · surface existante</b></article><article><small>Capability match</small><b id="houseMissionCapability">BOUND_TO_EXISTING_MISSION_SURFACE</b></article><article><small>Evidence</small><b>Proof room + pièces privées uniquement côté SUPRA</b></article><article><small>Human Gate</small><b>onboarding · pricing · external_action</b></article><article><small>Offer</small><b id="houseMissionOffer">Voir l’offre contextualisée ci-dessous.</b></article></div>';
   bodyWrap.appendChild(brief);
 }
 bodyWrap.appendChild(spec.node);
 const footer=document.createElement('div');footer.className='houseRoomFooter';
 const truth=document.createElement('span');truth.textContent='Même vérité canonique · aucune copie de registre';
 const next=document.createElement('button');next.type='button';next.className='houseNext';next.textContent=spec.id==='mission'?'Revenir au Bureau':'Pièce suivante →';
 footer.append(truth,next);bodyWrap.appendChild(footer);
 pane.append(head,bodyWrap);stage.appendChild(pane);paneByRoom.set(spec.id,pane);
 next.addEventListener('click',()=>{const i=roomSpec.findIndex(x=>x.id===spec.id);setRoom(spec.id==='mission'?'desk':roomSpec[i+1].id,{historyMode:'push'});});
 b.addEventListener('click',()=>setRoom(spec.id,{historyMode:'push'}));
}
header.after(house);
if(intro){const archive=document.createElement('details');archive.className='houseArchive';archive.innerHTML='<summary>Voir le parcours public simplifié précédent</summary>';archive.appendChild(intro);paneByRoom.get('explore').querySelector('.housePaneBody').appendChild(archive);}

const originalLinks=[...header.querySelectorAll('.topNav a')];
const navMap=[['desk','Bureau'],['decision','Décision'],['proof','Preuves'],['explore','Explorer'],['mission','Mission']];
originalLinks.forEach((a,i)=>{const x=navMap[i];if(!x)return;a.textContent=x[1];a.href='#house-'+x[0];});
header.querySelector('.brand')?.setAttribute('href','#house-desk');

function friendlyCase(){
 const title=byId('franceBindingLabel')?.textContent?.replace(/\s+/g,' ').trim()||'Dossier public courant';
 const warn=byId('sourceAlertCount')?.textContent?.trim();
 const confidence=byId('realityConfidence')?.textContent?.trim();
 byId('houseCaseTitle').textContent=title.replace(/France\s*→\s*/,'France · ').replace(/\s*→\s*/g,' / ');
 byId('houseCaseState').textContent=warn?('Réponse disponible · '+warn.toLowerCase()):'Réponse disponible · preuve traçable';
 byId('houseCasePulse').textContent=confidence||'Même dossier · même preuve · même mission.';
}
function roleState(room){
 const line=byId('houseRoleLine');if(!line)return;
 const roles=[
  ['Mission Director',room==='desk'?'CONSULTING':'AVAILABLE'],
  ['Decision',room==='decision'?'CONSULTING':'READY'],
  ['Evidence',room==='proof'?'CONSULTING':'READY'],
  ['Solutions',room==='mission'?'CONSULTING':'AVAILABLE']
 ];
 line.replaceChildren(...roles.filter((_,i)=>i===0||roles[i][1]==='CONSULTING'||(room==='decision'&&i===2)).map(([name,status])=>{
   const chip=document.createElement('span');chip.className='houseRoleChip';chip.dataset.state=status;chip.textContent=name+' · '+status;return chip;
 }));
}
function directorCopy(room){
 const role=boundRole[room]||boundRole.desk;
 const copy={
  desk:'Expliquez le problème une fois. Je garde le fil et je ne vous demande que ce qui manque.',
  decision:'Decision Twin passe au premier plan. Evidence reste consulté, sans théâtre multi-agent.',
  proof:'La preuve passe au premier plan : source, date, transformation, incertitude.',
  explore:'Vous avez demandé plus de profondeur. Le Cosmos reste optionnel et n’est jamais une étape imposée.',
  mission:'Le besoin peut devenir une Mission contextualisée. L’exécution reste séparée de la recommandation.'
 }[room];
 byId('houseDirectorRole').textContent=role.label;
 byId('houseDirectorStatus').textContent=copy;
 byId('houseDirectorBinding').textContent='Binding : '+role.binding+' · aucun nouveau moteur / registre.';
 roleState(room);
}
function setRoom(room,{historyMode='replace',focus=false}={}){
 if(!paneByRoom.has(room))room='desk';
 state.room=room;
 for(const [id,pane] of paneByRoom){const active=id===room;pane.hidden=!active;const b=roomNav.querySelector('[data-house-room="'+id+'"]');b?.setAttribute('aria-selected',String(active));b?.setAttribute('tabindex',active?'0':'-1');}
 directorCopy(room);
 if(room==='explore'){explore.open=true;}else{window.laBeteSuspendPresence?.();}
 const hash='#house-'+room;
 if(location.hash!==hash){if(historyMode==='push')history.pushState({laBeteHouseRoom:room},'',hash);else history.replaceState({...history.state,laBeteHouseRoom:room},'',hash);}
 if(focus)paneByRoom.get(room)?.querySelector('.housePaneHead')?.scrollIntoView({block:'start',behavior:'smooth'});
}
function roomForHash(hash){
 const direct=(hash||'').match(/^#house-(desk|decision|proof|explore|mission)$/);if(direct)return direct[1];
 const id=(hash||'').replace(/^#/,'');if(!id)return null;const target=byId(id);if(!target)return null;
 if(question.contains(target)||target===question)return'desk';
 if(answer.contains(target)||target===answer)return'decision';
 if(proof.contains(target)||target===proof)return'proof';
 if(explore.contains(target)||target===explore)return'explore';
 if(action.contains(target)||target===action)return'mission';
 return explore.querySelector('.experienceExploreBody')?.contains(target)?'explore':null;
}
function updateCommittee(){
 const recommendation=answer.querySelector('.decisionRoom .card p strong')?.textContent?.trim()||byId('decisionTwinTitle')?.textContent?.trim()||'Lecture décisionnelle disponible.';
 const warnings=byId('sourceAlertCount')?.textContent?.trim()||'Inconnues explicites dans Evidence.';
 if(byId('houseCommitteeConsensus'))byId('houseCommitteeConsensus').textContent=recommendation;
 if(byId('houseCommitteeUnknowns'))byId('houseCommitteeUnknowns').textContent=warnings+' · aucune divergence inter-spécialistes n’est inventée.';
}
function updateMissionBrief(text,orientation){
 const need=byId('houseMissionNeed'),cap=byId('houseMissionCapability'),offer=byId('houseMissionOffer');
 if(need)need.textContent=text||'Aucun besoin privé confié sur cette origine.';
 const specialist=/M&A|Legal/.test(orientation?.label||'');
 if(cap)cap.textContent=specialist?'PRIVATE_SPECIALIST_BINDING_REQUIRED':'BOUND_TO_EXISTING_MISSION_SURFACE';
 const pageOffer=(action.textContent.match(/(?:à partir de|from)\s+[0-9\s .,]+\s*€/i)||[])[0];
 if(offer)offer.textContent=pageOffer?('SUPRA Mission · '+pageOffer):'SUPRA Mission · offre existante ci-dessous';
}
function orientationFor(text){
 const q=String(text||'').toLowerCase();
 if(/acheter|acquisition|reprendre|valoris|cible|m&a/.test(q))return {room:'mission',label:'Orientation proposée : M&A + Financement + Evidence. Les spécialistes ne sont pas incarnés ici tant que leur binding privé SUPRA n’est pas prouvé.'};
 if(/contrat|jurid|legal|litige|risque réglement/.test(q))return {room:'mission',label:'Orientation proposée : Legal & Risk + Evidence. Activation spécialiste privée requise ; aucun faux expert public.'};
 if(/preuve|source|justif|d'où|origine|fiab/.test(q))return {room:'proof',label:'Evidence est déjà lié à ce dossier : ouverture directe de la preuve existante.'};
 if(/taux|dette|refinanc|tec10|france emprunte|oat/.test(q))return {room:'decision',label:'Le sujet correspond au dossier public chargé : Decision Twin + Evidence peuvent être utilisés sans nouveau moteur.'};
 if(/scénario|scenario|cosmos|explor|chronolog|dans le temps/.test(q))return {room:'explore',label:'Exploration demandée explicitement : Cosmos reste un approfondissement volontaire.'};
 return {room:'desk',label:'Le besoin est conservé dans le dialogue. Aucune spécialité n’est inventée tant qu’un binding réel n’est pas prouvé.'};
}
const form=byId('beastDialogueForm'),input=byId('beastDialogueInput');
form?.addEventListener('submit',()=>{
 const text=input?.value?.trim()||'';if(!text)return;
 state.lastQuestion=text;const o=orientationFor(text);state.orientation=o.label;
 const hint=byId('houseRouteHint');hint.hidden=false;hint.textContent=o.label;
 updateMissionBrief(text,o);
 queueMicrotask(()=>setRoom(o.room,{historyMode:'push'}));
},{capture:true});
document.addEventListener('click',e=>{
 const a=e.target.closest?.('a[href^="#"]');if(!a||a.closest('.houseRooms'))return;
 const room=roomForHash(a.getAttribute('href'));if(!room)return;
 e.preventDefault();setRoom(room,{historyMode:'push',focus:true});
});
window.addEventListener('hashchange',()=>{const room=roomForHash(location.hash);if(room)setRoom(room,{historyMode:'replace'});});
window.addEventListener('popstate',()=>{const room=roomForHash(location.hash)||history.state?.laBeteHouseRoom;if(room)setRoom(room,{historyMode:'replace'});});

const observed=[byId('sourceAlertCount'),byId('realityConfidence'),byId('franceBindingLabel')].filter(Boolean);
if(observed.length){
 const observer=new MutationObserver(()=>{friendlyCase();updateCommittee();});
 observed.forEach(node=>observer.observe(node,{subtree:true,childList:true,characterData:true}));
}
friendlyCase();
updateCommittee();
updateMissionBrief('',null);
const initial=roomForHash(location.hash)||'desk';
setRoom(initial,{historyMode:'replace'});
body.classList.add('advisory-house-v5');
window.LaBeteAdvisoryHouseV5=Object.freeze({
 schema:'LA_BETE_ADVISORY_HOUSE_SPATIAL_EXPERIENCE_V5',
 mode:'PRESENTATION_ORCHESTRATION_ONLY',
 second_engine:false,second_registry:false,second_truth:false,private_storage:false,
 rooms:roomSpec.map(x=>x.id),
 state:()=>({...state}),
 setRoom:r=>setRoom(r,{historyMode:'push'}),
 route:text=>orientationFor(text)
});
})();
