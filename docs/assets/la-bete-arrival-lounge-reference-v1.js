/* LA_BETE_ARRIVAL_LOUNGE_SPATIAL_REFERENCE_V1
   Presentation-only refinement of the existing desk room. */
(()=>{
'use strict';
const body=document.body;
const house=document.getElementById('advisory-house-v5');
const premium=window.LaBetePremiumExperienceV1;
const base=window.LaBeteAdvisoryHouseV5;
if(!body||!house||!premium||!base||body.classList.contains('arrival-reference-v1'))return;
const desk=house.querySelector('.housePane[data-house-room="desk"]');
const stage=house.querySelector('.houseStage');
const roomLabels={desk:'Private Advisory Desk',decision:'Decision Room',proof:'Evidence Room',explore:'Observatory',mission:'Mission Office'};
const roleSpec={
  decision:{label:'Decision',note:'Rôle numérique SUPRA · lecture et arbitrage du Decision Twin'},
  proof:{label:'Evidence',note:'Rôle numérique SUPRA · preuves, sources, incertitudes'},
  explore:{label:'Observatory',note:'Rôle numérique SUPRA · exploration volontaire du Cosmos'},
  mission:{label:'Solutions',note:'Rôle numérique SUPRA · passage vers SUPRA Mission'}
};
const input=document.getElementById('beastDialogueInput');
const submit=document.getElementById('beastDialogueSubmit');
const headerCopy=house.querySelector('.houseHeader>div:first-child p');
const title=house.querySelector('.houseHeader h1');
const directorRole=document.getElementById('houseDirectorRole');
const directorStatus=document.getElementById('houseDirectorStatus');
const director=house.querySelector('.houseDirector');
if(director&&!director.querySelector('.arrivalDirectorAvatar')){
  const directorAvatar=document.createElement('img');
  directorAvatar.className='arrivalDirectorAvatar';
  directorAvatar.src='assets/supra-human-butterfly.svg';
  directorAvatar.alt='';
  directorAvatar.setAttribute('aria-hidden','true');
  director.prepend(directorAvatar);
}
if(!desk||!input||!submit)return;

body.classList.add('arrival-reference-v1');
house.classList.add('arrivalReferenceV1');
if(title)title.innerHTML='Entrez. <em>Quel dossier devons-nous résoudre&nbsp;?</em>';
if(headerCopy)headerCopy.textContent='Posez une question. La Maison précise ce qu’elle peut traiter, avec les sources disponibles.';
submit.textContent='Confier le dossier →';
input.setAttribute('placeholder','Décrivez le problème, la décision à prendre ou le risque à éclaircir…');

const architecture=document.createElement('div');
architecture.className='arrivalRefArchitecture';
architecture.setAttribute('aria-hidden','true');
architecture.innerHTML='<span class="arrivalRefWall"></span><span class="arrivalRefHorizon"></span><span class="arrivalRefDesk"></span><span class="arrivalRefFolio"></span><span class="arrivalRefLamp"></span>';
house.prepend(architecture);

const whisper=document.createElement('p');
whisper.className='arrivalWhisper';
whisper.textContent='Question publique · sans pièce privée';
const form=document.getElementById('beastDialogueForm');
form?.before(whisper);

const door=document.createElement('button');
door.type='button';
door.className='arrivalDecisionDoor';
door.setAttribute('aria-label','Passer dans la Decision Room');
door.innerHTML='<span>02</span><b>DECISION ROOM</b>';
desk.appendChild(door);
door.addEventListener('click',()=>base.setRoom('decision'));

const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;

const passage=document.createElement('div');
passage.className='arrivalPassage';
passage.setAttribute('aria-hidden','true');
passage.innerHTML='<div class="arrivalPassageCenter"><small>THE LIVING ADVISORY HOUSE</small><strong id="arrivalPassageLabel">Decision Room</strong><i></i></div>';
house.appendChild(passage);
const passageLabel=passage.querySelector('#arrivalPassageLabel');

const avatars=new Map();
for(const [room,spec] of Object.entries(roleSpec)){
  const pane=house.querySelector('.housePane[data-house-room="'+room+'"]');
  if(!pane)continue;
  const avatar=document.createElement('aside');
  avatar.className='arrivalRoomAvatar';
  avatar.dataset.role=room;
  avatar.setAttribute('aria-label',spec.label+' · présence numérique SUPRA');
  avatar.innerHTML=
    '<span class="arrivalAvatarHalo" aria-hidden="true"></span>'+
    '<img class="arrivalAvatarWing" src="assets/supra-human-butterfly.svg" alt="" aria-hidden="true">'+
    '<img class="arrivalAvatarBody" src="assets/supra-human-butterfly.svg" alt="" aria-hidden="true">'+
    '<div class="arrivalAvatarCaption"><small>Présence numérique SUPRA</small><strong>'+spec.label+'</strong><span>'+spec.note+'</span></div>';
  pane.appendChild(avatar);
  avatars.set(room,avatar);
}

let passageTimer=0;
let lastRoom=base.state().room||'desk';
function animatePassage(destination){
  if(reduced||destination===lastRoom)return;
  if(passageLabel)passageLabel.textContent=roomLabels[destination]||destination;
  clearTimeout(passageTimer);
  house.classList.remove('is-passage');
  void house.offsetWidth;
  house.classList.add('is-passage');
  passageTimer=setTimeout(()=>house.classList.remove('is-passage'),820);
}
function syncRoomAvatar(){
  const room=base.state().room||'desk';
  if(room!==lastRoom)animatePassage(room);
  for(const [id,avatar] of avatars){
    const active=id===room;
    avatar.classList.toggle('is-visible',active);
    avatar.classList.remove('is-arriving','is-directing');
    if(active&&!reduced){
      void avatar.offsetWidth;
      avatar.classList.add('is-arriving');
      setTimeout(()=>avatar.classList.remove('is-arriving'),760);
    }
  }
  lastRoom=room;
}
function isDesk(){return base.state().room==='desk';}
function syncDirector(){
  if(!isDesk())return;
  if(directorRole)directorRole.textContent='Mission Director';
  if(directorStatus)directorStatus.textContent=input.value.trim()
    ?'Je garde ce dossier. La prochaine pièce s’ouvre seulement quand elle apporte quelque chose.'
    :'Présence numérique SUPRA · coordination du dossier, sans identité humaine simulée.';
}
input.addEventListener('focus',()=>{if(!isDesk())return;house.classList.add('arrival-engaged');syncDirector();});
input.addEventListener('input',()=>{if(!isDesk())return;house.classList.add('arrival-engaged');syncDirector();});
input.addEventListener('blur',()=>{if(!input.value.trim())house.classList.remove('arrival-engaged');syncDirector();});
door.addEventListener('pointerenter',()=>house.classList.add('arrival-door-focus'));
door.addEventListener('pointerleave',()=>house.classList.remove('arrival-door-focus'));
door.addEventListener('focus',()=>house.classList.add('arrival-door-focus'));
door.addEventListener('blur',()=>house.classList.remove('arrival-door-focus'));
form?.addEventListener('submit',()=>{
  if(!isDesk())return;
  house.classList.add('arrival-directing');
  if(!reduced)setTimeout(()=>house.classList.remove('arrival-directing'),520);
},{capture:true});

if(!reduced){
  let raf=0,px=0,py=0;
  house.addEventListener('pointermove',event=>{
    if(!isDesk()||event.pointerType==='touch')return;
    const rect=house.getBoundingClientRect();
    px=((event.clientX-rect.left)/rect.width-.5)*4;
    py=((event.clientY-rect.top)/rect.height-.5)*3;
    if(raf)return;
    raf=requestAnimationFrame(()=>{
      architecture.style.setProperty('--arrival-px',px.toFixed(2)+'px');
      architecture.style.setProperty('--arrival-py',py.toFixed(2)+'px');
      raf=0;
    });
  });
  house.addEventListener('pointerleave',()=>{
    architecture.style.setProperty('--arrival-px','0px');
    architecture.style.setProperty('--arrival-py','0px');
  });
}

const roomObserver=new MutationObserver(()=>{
  house.classList.remove('arrival-door-focus','arrival-directing');
  if(!isDesk())house.classList.remove('arrival-engaged');
  syncDirector();
  syncRoomAvatar();
});
for(const pane of house.querySelectorAll('.housePane'))roomObserver.observe(pane,{attributes:true,attributeFilter:['hidden']});
syncDirector();
syncRoomAvatar();

document.addEventListener('click',event=>{
  const jump=event.target.closest?.('.premiumProofJump,.houseNext,.houseRoomButton,.arrivalDecisionDoor');
  if(!jump)return;
  const room=base.state().room;
  const avatar=avatars.get(room);
  if(avatar&&!reduced){
    avatar.classList.remove('is-directing');
    void avatar.offsetWidth;
    avatar.classList.add('is-directing');
    setTimeout(()=>avatar.classList.remove('is-directing'),600);
  }
},{capture:true});

window.LaBeteArrivalLoungeReferenceV1=Object.freeze({
  schema:'LA_BETE_ARRIVAL_LOUNGE_SPATIAL_REFERENCE_V1',
  mode:'PRESENTATION_ONLY_OVER_EXISTING_HOUSE',
  base_commit:'d47ea87d3d9a4c5002df9fb6a4f45182d575acfc',
  active_room:'desk',
  second_engine:false,
  second_registry:false,
  second_truth:false,
  execution_authority_promoted:false,
  decision_twin_sovereign:true,
  proofgraph_unchanged:true,
  cosmos_voluntary:true,
  private_boundary_preserved:true
});
})();
