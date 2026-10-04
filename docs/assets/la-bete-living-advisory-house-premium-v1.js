/* LA_BETE_LIVING_ADVISORY_HOUSE_PREMIUM_EXPERIENCE_V1_1
   Radical spatial presentation over the proven V5 house.
   No second engine, registry, truth, memory, network or execution authority. */
(()=>{
'use strict';

const body=document.body;
const base=window.LaBeteAdvisoryHouseV5;
const house=document.getElementById('advisory-house-v5');
if(!body||!base||!house||body.classList.contains('premium-house-v11'))return;

const byId=id=>document.getElementById(id);
const stage=house.querySelector('.houseStage');
const rail=house.querySelector('.houseRail');
const director=house.querySelector('.houseDirector');
const roomNav=house.querySelector('.houseRooms');
const caseBar=house.querySelector('.houseCaseBar');
const privateBoundary=house.querySelector('.housePrivateBoundary');
const privateDoor=byId('housePrivateDoor');
const bindingProof=base.specialist_binding_proof;
if(!stage||!rail||!director||!roomNav||!caseBar||!privateBoundary||!privateDoor||!bindingProof)return;

body.classList.add('premium-house-v1','premium-house-v11');
house.classList.add('premiumHouseV11');
house.dataset.activeRoom=base.state().room||'desk';

/* ---------- one scene, no second navigation ---------- */
const scene=document.createElement('div');
scene.className='premiumScene';
scene.setAttribute('aria-hidden','true');
scene.innerHTML='<span class="premiumWall premiumWallLeft"></span><span class="premiumWall premiumWallRight"></span><span class="premiumCeiling"></span><span class="premiumFloor"></span><span class="premiumWindow"></span><span class="premiumLight"></span>';
house.prepend(scene);

const veil=document.createElement('div');
veil.className='premiumRoomVeil';
veil.setAttribute('aria-hidden','true');
stage.prepend(veil);

const dock=document.createElement('div');
dock.className='premiumPortalDock';
dock.setAttribute('aria-label','Passages de la Maison');
house.appendChild(dock);
dock.appendChild(roomNav);

house.appendChild(privateBoundary);
stage.prepend(director);
rail.hidden=true;

/* ---------- truthful digital presence ---------- */
const figure=document.createElement('span');
figure.className='premiumPresenceFigure';
figure.setAttribute('aria-hidden','true');
figure.innerHTML='<i class="premiumHead"></i><i class="premiumShoulders"></i><i class="premiumGesture"></i>';
director.prepend(figure);

const orientation=document.createElement('p');
orientation.className='premiumOrientation';
orientation.hidden=true;
director.appendChild(orientation);

const bindingLine=byId('houseDirectorBinding');
const roleLine=byId('houseRoleLine');
if(bindingLine||roleLine){
  const expert=document.createElement('details');
  expert.className='premiumExpertTrace';
  expert.innerHTML='<summary>Provenance du rôle</summary>';
  if(bindingLine)expert.appendChild(bindingLine);
  if(roleLine)expert.appendChild(roleLine);
  director.appendChild(expert);
}

const specialists=document.createElement('div');
specialists.className='premiumSpecialists';
specialists.setAttribute('aria-label','Spécialistes numériques réellement liés au dossier');
director.appendChild(specialists);

/* ---------- proof stays one cognitive step away ---------- */
const decisionHead=house.querySelector('.housePane[data-house-room="decision"] .housePaneHead');
if(decisionHead&&!decisionHead.querySelector('.premiumProofJump')){
  const jump=document.createElement('button');
  jump.type='button';
  jump.className='premiumProofJump';
  jump.textContent='Prouvez-le-moi';
  jump.addEventListener('click',()=>base.setRoom('proof'));
  decisionHead.appendChild(jump);
}

/* ---------- mission moment, value before offer ---------- */
const missionBrief=byId('houseMissionBrief');
if(missionBrief){
  const grid=missionBrief.querySelector('.houseMissionBriefGrid');
  const head=missionBrief.querySelector('.houseMissionBriefHead');
  if(head&&!head.querySelector('.premiumMissionMoment')){
    const p=document.createElement('p');
    p.className='premiumMissionMoment';
    p.textContent='Ce dossier est assez défini pour devenir une Mission SUPRA. La Maison réutilise ce qui est déjà connu et ne redemande que ce qui peut changer la décision.';
    head.appendChild(p);
  }
  if(grid&&!missionBrief.querySelector('.premiumMissionSummary')){
    const summary=document.createElement('div');
    summary.className='premiumMissionSummary';
    summary.innerHTML=
      '<article><small>Votre objectif</small><b id="premiumMissionObjective">Dossier à préciser.</b></article>'+
      '<article><small>Déjà acquis</small><b>Décision, contexte public et preuves disponibles restent dans le même dossier.</b></article>'+
      '<article><small>Spécialistes mobilisés</small><b id="premiumMissionSpecialists">Solutions</b></article>'+
      '<article><small>À vérifier</small><b id="premiumMissionMissing">Seulement les inconnues qui changeraient la décision.</b></article>'+
      '<article><small>Résultat attendu</small><b>Décision défendable, dossier de preuve et prochaine action claire.</b></article>'+
      '<article><small>Prochaine étape</small><b id="premiumMissionOffer">Voir l’offre après la valeur.</b></article>';
    grid.before(summary);
    const expert=document.createElement('details');
    expert.className='premiumMissionExpert';
    expert.innerHTML='<summary>Détails techniques et gouvernance</summary>';
    expert.appendChild(grid);
    missionBrief.appendChild(expert);
  }
}

/* ---------- collapse web-like technical copy ---------- */
const rawHint=byId('houseRouteHint');
if(rawHint)rawHint.classList.add('premiumRawRouteHint');

privateDoor.dataset.premiumDoor='private-supra';
privateDoor.setAttribute('aria-description','Transition explicite vers le Bureau privé SUPRA. Aucun payload de dossier n’est transmis.');

function safeSpecialists(){
  const st=base.state();
  const route=st.lastQuestion?base.route(st.lastQuestion):null;
  const binding=route?.bindingRole&&bindingProof.roles?.[route.bindingRole];
  if(binding)return binding.split('+').map(x=>x.trim()).filter(Boolean);
  if(st.room==='decision')return ['Decision','Evidence'];
  if(st.room==='proof')return ['Evidence'];
  if(st.room==='explore')return ['Evidence'];
  if(st.room==='mission')return ['Solutions'];
  return ['Mission Director'];
}

function publicOrientation(){
  const raw=base.state().orientation||'';
  if(!raw)return'';
  return raw
    .split(/\s+Binding\s+/i)[0]
    .replace(/Orientation proposée\s*:\s*/i,'')
    .replace(/\s*;\s*routage.*$/i,'')
    .trim();
}

function renderSpecialists(){
  const names=safeSpecialists();
  specialists.replaceChildren();
  if(names.length===1&&names[0]==='Mission Director')return;
  const label=document.createElement('small');
  label.textContent='Avec';
  specialists.appendChild(label);
  for(const name of names){
    const chip=document.createElement('span');
    chip.textContent=name;
    specialists.appendChild(chip);
  }
  const missionNames=byId('premiumMissionSpecialists');
  if(missionNames)missionNames.textContent=names.join(' · ');
}

function renderOrientation(){
  const copy=publicOrientation();
  orientation.hidden=!copy;
  orientation.textContent=copy;
}

function renderMission(){
  if(!missionBrief)return;
  const st=base.state();
  missionBrief.classList.toggle('is-contextual',Boolean(st.lastQuestion));
  const objective=byId('premiumMissionObjective');
  if(objective)objective.textContent=st.lastQuestion||'Dossier à préciser.';
  const missing=byId('premiumMissionMissing');
  const alert=byId('sourceAlertCount')?.textContent?.trim();
  if(missing)missing.textContent=alert
    ?alert+' · compléter uniquement ce qui peut changer la décision.'
    :'Compléter uniquement ce qui peut changer la décision.';
  const offer=byId('premiumMissionOffer');
  const canonical=byId('houseMissionOffer')?.textContent?.trim();
  if(offer)offer.textContent=canonical||'SUPRA Mission · offre existante';
}

function syncPrivateDoor(){
  privateBoundary.classList.add('premiumPrivateDoor');
}

let timer=0;
let previous=house.dataset.activeRoom;
const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;

function syncRoom(){
  const current=base.state().room||'desk';
  house.dataset.activeRoom=current;
  body.dataset.houseRoom=current;

  if(current!==previous&&!reduced){
    clearTimeout(timer);
    house.classList.remove('is-room-transitioning');
    void house.offsetWidth;
    house.classList.add('is-room-transitioning');
    timer=setTimeout(()=>house.classList.remove('is-room-transitioning'),360);
  }
  previous=current;

  renderSpecialists();
  renderOrientation();
  renderMission();
  syncPrivateDoor();

  const active=house.querySelector('.housePane:not([hidden])');
  active?.querySelector('.housePaneBody')?.scrollTo?.({top:0,behavior:'instant'});
}

const observer=new MutationObserver(syncRoom);
for(const pane of house.querySelectorAll('.housePane'))observer.observe(pane,{attributes:true,attributeFilter:['hidden']});
if(rawHint)observer.observe(rawHint,{subtree:true,childList:true,characterData:true});

document.addEventListener('submit',event=>{
  if(event.target?.id==='beastDialogueForm')queueMicrotask(syncRoom);
},{capture:true});
window.addEventListener('popstate',()=>queueMicrotask(syncRoom));
window.addEventListener('hashchange',()=>queueMicrotask(syncRoom));

syncRoom();

window.LaBetePremiumExperienceV1=Object.freeze({
  schema:'LA_BETE_LIVING_ADVISORY_HOUSE_PREMIUM_EXPERIENCE_V1_1',
  mode:'FULL_VIEWPORT_SPATIAL_PRESENTATION_OVER_PROVEN_V5',
  second_engine:false,
  second_registry:false,
  second_truth:false,
  private_storage:false,
  execution_authority_promoted:false,
  decision_twin_sovereign:true,
  proofgraph_unchanged_spine:true,
  cosmos_voluntary:true,
  specialist_binding_proof:bindingProof,
  state:()=>({
    room:base.state().room,
    specialists:safeSpecialists(),
    privateOfficeHref:privateDoor.getAttribute('href')
  })
});
})();