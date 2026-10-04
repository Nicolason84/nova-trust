/* LA_BETE_LIVING_ADVISORY_HOUSE_PREMIUM_EXPERIENCE_V1
   Presentation-only premium spatial layer over the proven V5 house. */
(()=>{
'use strict';
const body=document.body;
const base=window.LaBeteAdvisoryHouseV5;
const house=document.getElementById('advisory-house-v5');
if(!body||!base||!house||body.classList.contains('premium-house-v1'))return;

const byId=id=>document.getElementById(id);
const stage=house.querySelector('.houseStage');
const rail=house.querySelector('.houseRail');
const director=house.querySelector('.houseDirector');
const roomNav=house.querySelector('.houseRooms');
const privateBoundary=house.querySelector('.housePrivateBoundary');
const privateDoor=byId('housePrivateDoor');
const bindingProof=base.specialist_binding_proof;
if(!stage||!rail||!director||!roomNav||!privateBoundary||!privateDoor||!bindingProof)return;

body.classList.add('premium-house-v1');
house.classList.add('premiumHouseV1');
house.dataset.activeRoom=base.state().room||'desk';

const atmosphere=document.createElement('div');
atmosphere.className='premiumAtmosphere';
atmosphere.setAttribute('aria-hidden','true');
house.prepend(atmosphere);

const veil=document.createElement('div');
veil.className='premiumRoomVeil';
veil.setAttribute('aria-hidden','true');
stage.prepend(veil);

const figure=document.createElement('span');
figure.className='premiumPresenceFigure';
figure.setAttribute('aria-hidden','true');
director.prepend(figure);

const orientation=document.createElement('div');
orientation.className='premiumOrientation';
orientation.id='premiumOrientation';
orientation.hidden=true;
director.appendChild(orientation);

const bindingLine=byId('houseDirectorBinding');
const roleLine=byId('houseRoleLine');
if(bindingLine||roleLine){
 const trace=document.createElement('details');
 trace.className='premiumExpertTrace';
 const summary=document.createElement('summary');
 summary.textContent='Trace experte';
 trace.appendChild(summary);
 if(bindingLine)trace.appendChild(bindingLine);
 if(roleLine)trace.appendChild(roleLine);
 director.appendChild(trace);
}

const specialists=document.createElement('section');
specialists.className='premiumSpecialists';
specialists.id='premiumSpecialists';
specialists.setAttribute('aria-label','Spécialistes numériques réellement liés au dossier');
specialists.innerHTML='<div class="premiumSpecialistsTitle">Présences liées au dossier</div>';
roomNav.before(specialists);

privateDoor.dataset.premiumDoor='private-supra';
privateDoor.setAttribute('aria-description','Transition explicite vers l’espace privé SUPRA. Aucun payload de dossier n’est transmis.');

const decisionHead=house.querySelector('.housePane[data-house-room="decision"] .housePaneHead');
if(decisionHead&&!decisionHead.querySelector('.premiumProofJump')){
 const jump=document.createElement('button');
 jump.type='button';
 jump.className='premiumProofJump';
 jump.textContent='Prouvez-le-moi →';
 jump.addEventListener('click',()=>base.setRoom('proof'));
 decisionHead.appendChild(jump);
}

const missionBrief=byId('houseMissionBrief');
let missionSummary=null;
if(missionBrief){
 const head=missionBrief.querySelector('.houseMissionBriefHead');
 if(head&&!head.querySelector('.premiumMissionMoment')){
   const p=document.createElement('p');
   p.className='premiumMissionMoment';
   p.textContent='Ce dossier est suffisamment défini pour devenir une Mission SUPRA. La Maison réutilise ce qui est déjà connu et ne redemande que les pièces manquantes.';
   head.appendChild(p);
 }
 missionSummary=document.createElement('div');
 missionSummary.className='premiumMissionSummary';
 missionSummary.innerHTML=
   '<article><small>Votre objectif</small><b id="premiumMissionObjective">Dossier à préciser.</b></article>'+
   '<article><small>Ce que nous savons déjà</small><b>Décision, contexte public et preuves disponibles restent attachés au même dossier.</b></article>'+
   '<article><small>Spécialistes mobilisés</small><b id="premiumMissionSpecialists">Solutions</b></article>'+
   '<article><small>Ce qu’il reste à vérifier</small><b id="premiumMissionMissing">Les inconnues critiques restent visibles dans Evidence.</b></article>'+
   '<article><small>Résultat attendu</small><b>Décision défendable, dossier de preuve et prochaine action claire.</b></article>'+
   '<article><small>Prochaine étape</small><b id="premiumMissionOffer">Voir l’offre contextualisée après la valeur.</b></article>';
 const grid=missionBrief.querySelector('.houseMissionBriefGrid');
 if(grid){
   const expert=document.createElement('details');
   expert.className='premiumMissionExpert';
   expert.innerHTML='<summary>Détails techniques et gouvernance</summary>';
   grid.before(missionSummary);
   expert.appendChild(grid);
   missionBrief.appendChild(expert);
 }else{
   missionBrief.appendChild(missionSummary);
 }
}

const rawRouteHint=byId('houseRouteHint');

function safeSpecialistsForState(){
 const st=base.state();
 const question=st.lastQuestion||'';
 const route=question?base.route(question):null;
 const binding=route?.bindingRole&&bindingProof.roles?.[route.bindingRole];
 if(binding)return binding.split('+').map(x=>x.trim()).filter(Boolean);
 const room=st.room;
 if(room==='decision')return ['Decision','Evidence'];
 if(room==='proof')return ['Evidence'];
 if(room==='explore')return ['Evidence'];
 if(room==='mission')return ['Solutions'];
 return ['Mission Director'];
}

function cleanOrientation(){
 const raw=base.state().orientation||'';
 if(!raw)return'';
 return raw.split(/\s+Binding\s+/i)[0].replace(/\s*;\s*routage.*$/i,'').trim();
}

function renderSpecialists(){
 const names=safeSpecialistsForState();
 const title=specialists.querySelector('.premiumSpecialistsTitle');
 specialists.replaceChildren(title);
 for(const name of names){
   const item=document.createElement('div');
   item.className='premiumSpecialist';
   item.dataset.active='true';
   const label=document.createElement('span');
   label.textContent=name;
   const meta=document.createElement('small');
   meta.textContent='rôle numérique lié';
   item.append(label,meta);
   specialists.appendChild(item);
 }
 specialists.hidden=names.length===0;
 const missionNames=byId('premiumMissionSpecialists');
 if(missionNames)missionNames.textContent=names.join(' · ');
}

function renderMission(){
 if(!missionBrief)return;
 const st=base.state();
 missionBrief.classList.toggle('is-contextual',Boolean(st.lastQuestion));
 const objective=byId('premiumMissionObjective');
 if(objective)objective.textContent=st.lastQuestion||'Dossier à préciser.';
 const missing=byId('premiumMissionMissing');
 const alert=byId('sourceAlertCount')?.textContent?.trim();
 if(missing)missing.textContent=alert?alert+' · compléter uniquement les pièces qui changeraient la décision.':'Compléter uniquement les pièces qui changeraient la décision.';
 const offer=byId('premiumMissionOffer');
 const canonicalOffer=byId('houseMissionOffer')?.textContent?.trim();
 if(offer)offer.textContent=canonicalOffer||'SUPRA Mission · offre existante ci-dessous.';
}

function renderOrientation(){
 const clean=cleanOrientation();
 orientation.hidden=!clean;
 orientation.textContent=clean;
 if(rawRouteHint)rawRouteHint.classList.add('premiumRawRouteHint');
}

const mobileMedia=window.matchMedia?.('(max-width: 900px)');
function placePrivateBoundary(){
 if(!mobileMedia)return;
 if(mobileMedia.matches){
   if(privateBoundary.parentElement!==house)house.appendChild(privateBoundary);
 }else{
   if(privateBoundary.parentElement!==rail)rail.appendChild(privateBoundary);
 }
}
mobileMedia?.addEventListener?.('change',placePrivateBoundary);
placePrivateBoundary();

let roomTimer=0;
let previousRoom=house.dataset.activeRoom;
const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function syncRoom(){
 const current=base.state().room||[...house.querySelectorAll('.housePane')].find(x=>!x.hidden)?.dataset.houseRoom||'desk';
 house.dataset.activeRoom=current;
 if(current!==previousRoom){
   if(!reduced){
     clearTimeout(roomTimer);
     house.classList.remove('is-room-transitioning');
     void house.offsetWidth;
     house.classList.add('is-room-transitioning');
     roomTimer=setTimeout(()=>house.classList.remove('is-room-transitioning'),380);
   }
   previousRoom=current;
 }
 renderSpecialists();
 renderOrientation();
 renderMission();
}

const observer=new MutationObserver(syncRoom);
for(const pane of house.querySelectorAll('.housePane'))observer.observe(pane,{attributes:true,attributeFilter:['hidden']});
if(rawRouteHint)observer.observe(rawRouteHint,{subtree:true,childList:true,characterData:true});

document.addEventListener('submit',e=>{
 if(e.target?.id==='beastDialogueForm')queueMicrotask(syncRoom);
},{capture:true});
window.addEventListener('popstate',()=>queueMicrotask(syncRoom));
window.addEventListener('hashchange',()=>queueMicrotask(syncRoom));

syncRoom();

window.LaBetePremiumExperienceV1=Object.freeze({
 schema:'LA_BETE_LIVING_ADVISORY_HOUSE_PREMIUM_EXPERIENCE_V1',
 mode:'PRESENTATION_ONLY_OVER_PROVEN_V5',
 second_engine:false,
 second_registry:false,
 second_truth:false,
 private_storage:false,
 execution_authority_promoted:false,
 decision_twin_sovereign:true,
 proofgraph_unchanged_spine:true,
 cosmos_voluntary:true,
 specialist_binding_proof:bindingProof,
 state:()=>({room:base.state().room,specialists:safeSpecialistsForState(),privateOfficeHref:privateDoor.getAttribute('href')})
});
})();