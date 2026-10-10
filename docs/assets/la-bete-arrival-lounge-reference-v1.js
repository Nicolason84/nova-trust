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
const roomLabels={desk:'La Maison',decision:'Décision',proof:'Preuves',explore:'Explorer',mission:'Votre décision'};
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
if(title)title.innerHTML='Réparer<em>le chaos.</em>';
if(headerCopy)headerCopy.innerHTML='Entrez dans la Maison.<br>Prenez le temps de regarder.';
house.querySelector('.houseHeader .houseEyebrow').textContent='LA BÊTE · UN UNIVERS À EXPLORER';
submit.textContent='Explorer ma question →';
input.setAttribute('placeholder','Quelle question souhaitez-vous éclaircir sur ce dossier public ?');

/* Discovery first. Reuse the current rooms, question node and original 3D entry. */
body.classList.add('discovery-x3');
house.classList.add('discoveryX3');
if(director)house.appendChild(director);
const deskBody=desk.querySelector('.housePaneBody');
const discoveryActions=document.createElement('div');
discoveryActions.className='discoveryActions';
discoveryActions.innerHTML=
  '<div class="discoveryPrimary"></div>'+
  '<button type="button" class="discoveryCase" id="discoveryPublicCase">Voir le dossier public <span aria-hidden="true">↗</span></button>'+
  '<button type="button" class="discoveryPrepare" id="discoveryPrepare">Et votre décision ? <span aria-hidden="true">→</span></button>'+
  '<p class="discoveryFootnote" id="discoveryEntryHint">Exploration libre · son désactivé au départ</p>';
deskBody.prepend(discoveryActions);
discoveryActions.querySelector('#discoveryPublicCase').addEventListener('click',()=>base.setRoom('decision'));
discoveryActions.querySelector('#discoveryPrepare').addEventListener('click',()=>base.setRoom('mission'));

const question=document.getElementById('dialogue-public');
const questionDisclosure=document.createElement('details');
questionDisclosure.className='discoveryQuestion';
questionDisclosure.innerHTML='<summary>Une question sur le dossier public ? <span aria-hidden="true">+</span></summary>';
question.before(questionDisclosure);
if(question._houseHome)questionDisclosure.appendChild(question._houseHome);
questionDisclosure.appendChild(question);
const initialNavigation=performance.getEntriesByType?.('navigation')[0]?.name;
if(initialNavigation&&new URL(initialNavigation).hash==='#dialogue-public')questionDisclosure.open=true;
questionDisclosure.addEventListener('toggle',()=>{
  house.classList.toggle('discovery-question-open',questionDisclosure.open);
});
const dialogueNotice=document.getElementById('beastDialogueNotice');
if(dialogueNotice?.textContent.includes('JavaScript est nécessaire'))dialogueNotice.textContent='Dialogue local · aucune demande transmise.';
document.addEventListener('click',event=>{
  if(event.target.closest?.('a[href="#dialogue-public"]')){
    questionDisclosure.open=true;
    questionDisclosure.scrollIntoView({block:'start',behavior:'instant'});
  }
});

/* FREE_REQUEST_PUBLIC_V1
   Optional structured drafting only. No network, automatic storage, identity or admission change. */
(()=>{
  const helper=document.createElement('details');
  helper.id='freeRequestHelper';helper.className='freeRequestHelper';
  const make=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
  const summary=make('summary');
  summary.append(make('span','Un coup de main gratuit'),make('span','+'));
  summary.lastElementChild.setAttribute('aria-hidden','true');
  helper.appendChild(summary);
  const panel=make('div',undefined,'freeRequestPanel');
  panel.append(make('p','UN COUP DE MAIN GRATUIT','freeRequestEyebrow'),make('h3','Préparer ma demande'),make('p','Un brouillon de demande ou de relance, à relire et à envoyer vous-même.','freeRequestLead'));
  const scope=make('p','Gardez [nom] et [référence] comme marqueurs, puis complétez vos informations personnelles dans votre propre outil après export.','freeRequestScope');
  scope.id='freeRequestScope';panel.appendChild(scope);
  const form=make('form');form.id='freeRequestForm';form.noValidate=true;form.setAttribute('autocomplete','off');form.setAttribute('aria-describedby',scope.id);
  form.appendChild(make('p','Les trois champs marqués * sont nécessaires.','freeRequestRequired'));
  const fields=[
    {key:'kind',label:'Type de message',type:'select',hint:'Choisissez une demande initiale ou le suivi d’une demande déjà faite.'},
    {key:'recipient',label:'Organisme ou interlocuteur',type:'input',max:120,optional:true,placeholder:'[organisme ou interlocuteur]',hint:'Facultatif · 120 caractères maximum. Laissez un marqueur si vous ne le connaissez pas.'},
    {key:'goal',label:'Résultat attendu',type:'textarea',min:8,max:400,rows:2,placeholder:'Exemple : obtenir une clarification sur ma commande.',hint:'8 à 400 caractères. Décrivez ce que vous souhaitez obtenir.'},
    {key:'facts',label:'Faits et démarches déjà réalisées',type:'textarea',min:12,max:800,rows:3,placeholder:'Exemple : demande envoyée le [date], réponse encore attendue.',hint:'12 à 800 caractères. Donnez seulement les faits que vous connaissez, sans pièce privée.'},
    {key:'timing',label:'Date ou échéance connue',type:'input',max:100,optional:true,placeholder:'Exemple : réponse souhaitée avant [date]',hint:'Facultatif · 100 caractères maximum. Aucun délai réglementaire n’est calculé.'},
    {key:'question',label:'Question précise à poser',type:'textarea',min:8,max:400,rows:2,placeholder:'Quel document précise la référence à retenir ?',hint:'8 à 400 caractères. Une question claire facilite la réponse.'}
  ];
  const controls=new Map();
  for(const spec of fields){
    const group=make('div',undefined,'freeRequestField');
    const label=make('label',spec.label+(spec.optional?' · facultatif':spec.min?' *':''));
    const field=make(spec.type==='input'?'input':spec.type==='select'?'select':'textarea');
    field.id='freeRequest-'+spec.key;field.name=spec.key;label.htmlFor=field.id;
    if(spec.type==='select'){
      for(const [value,text] of [['demande','Demande initiale'],['relance','Relance simple']]){
        const option=make('option',text);option.value=value;field.appendChild(option);
      }
    }else{
      if(spec.type==='input')field.type='text';
      if(spec.rows)field.rows=spec.rows;
      field.maxLength=spec.max;field.placeholder=spec.placeholder;field.autocomplete='off';field.spellcheck=true;
      if(spec.min){field.required=true;field.minLength=spec.min;}
    }
    const hint=make('p',spec.hint,'freeRequestHint');hint.id=field.id+'-hint';
    const error=make('p','','freeRequestError');error.id=field.id+'-error';error.hidden=true;
    field.setAttribute('aria-describedby',hint.id+' '+error.id);
    group.append(label,field,hint,error);form.appendChild(group);controls.set(spec.key,{spec,field,error});
  }
  const actions=make('div',undefined,'freeRequestFormActions');
  const generate=make('button','Préparer mon brouillon','freeRequestGenerate');generate.type='submit';generate.id='freeRequestGenerate';
  const reset=make('button','Effacer les champs','freeRequestReset');reset.type='button';reset.id='freeRequestReset';
  actions.append(generate,reset);form.appendChild(actions);panel.appendChild(form);
  const status=make('p','Aucun message envoyé. Vous choisissez ensuite le destinataire et le mode d’envoi.','freeRequestStatus');
  status.id='freeRequestStatus';status.setAttribute('role','status');panel.appendChild(status);
  const result=make('section',undefined,'freeRequestResult');result.id='freeRequestResult';result.hidden=true;result.tabIndex=-1;
  const resultTitle=make('h4','Votre brouillon');resultTitle.id='freeRequestResultTitle';result.setAttribute('aria-labelledby',resultTitle.id);
  const subject=make('p','','freeRequestSubject');subject.id='freeRequestSubject';
  const message=make('pre','','freeRequestMessage');message.id='freeRequestMessage';
  const checklist=make('ul',undefined,'freeRequestChecklist');checklist.id='freeRequestChecklist';
  result.append(resultTitle,make('h5','Objet'),subject,make('h5','Message'),message,make('h5','À compléter avant envoi'),checklist);
  const resultActions=make('div',undefined,'freeRequestResultActions');
  const copy=make('button','Copier le brouillon','freeRequestCopy');copy.id='freeRequestCopy';copy.type='button';copy.disabled=true;
  const download=make('button','Télécharger .txt','freeRequestDownload');download.id='freeRequestDownload';download.type='button';download.disabled=true;
  resultActions.append(copy,download);result.appendChild(resultActions);
  result.appendChild(make('p','Brouillon à relire. Cet outil organise votre demande ; il ne vérifie ni les règles de la démarche ni les délais applicables.','freeRequestLimits'));
  const mission=make('button','Aller à SUPRA Mission →','freeRequestMission');mission.id='freeRequestMission';mission.type='button';
  mission.addEventListener('click',()=>base.setRoom('mission'));result.appendChild(mission);
  panel.appendChild(result);helper.appendChild(panel);questionDisclosure.after(helper);
  let outputText='';
  function invalidate(){
    const hadResult=Boolean(outputText);outputText='';result.hidden=true;copy.disabled=true;download.disabled=true;
    subject.textContent='';message.textContent='';checklist.replaceChildren();
    if(hadResult)status.textContent='Les informations ont changé. Préparez un nouveau brouillon avant de le copier.';
  }
  for(const {field,error} of controls.values()){
    field.addEventListener('input',()=>{invalidate();field.removeAttribute('aria-invalid');error.hidden=true;error.textContent='';});
    field.addEventListener('change',invalidate);
  }
  function collect(){
    const values={};let firstInvalid=null;
    for(const [key,{spec,field,error}] of controls){
      const value=field.value.replace(/\r\n?/g,'\n').trim();let reason='';
      if(key==='kind'&&!['demande','relance'].includes(value))reason='Choisissez une demande initiale ou une relance simple.';
      else if(spec.min&&value.length<spec.min)reason='Renseignez ce champ avec au moins '+spec.min+' caractères utiles.';
      else if(spec.max&&value.length>spec.max)reason='Limitez ce champ à '+spec.max+' caractères.';
      error.textContent=reason;error.hidden=!reason;
      if(reason){field.setAttribute('aria-invalid','true');firstInvalid=firstInvalid||field;}else field.removeAttribute('aria-invalid');
      values[key]=value;
    }
    if(firstInvalid){status.textContent='Complétez les champs signalés pour préparer votre brouillon.';firstInvalid.focus();return null;}
    return values;
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();invalidate();const v=collect();if(!v)return;
    const shortGoal=v.goal.replace(/\s+/g,' ');
    const subjectText=(v.kind==='relance'?'Relance — ':'Demande — ')+(shortGoal.length>130?shortGoal.slice(0,127)+'…':shortGoal);
    const paragraphs=[
      'À l’attention de '+(v.recipient||'[organisme ou interlocuteur]')+',',
      'Bonjour,',
      (v.kind==='relance'?'Je reviens vers vous au sujet de la demande suivante :':'Je vous contacte au sujet de la demande suivante :')+'\n'+v.goal,
      'Éléments de contexte et démarches :\n'+v.facts
    ];
    if(v.timing)paragraphs.push('Date ou échéance que je souhaite vous signaler :\n'+v.timing);
    paragraphs.push('Ma question :\n'+v.question,'Merci pour votre retour et pour l’indication de la prochaine étape utile.','Cordialement,\n[nom]\n[coordonnées à compléter hors de ce site]\n[référence du dossier, si nécessaire]');
    const messageText=paragraphs.join('\n\n');
    const missing=[];
    if(!v.recipient)missing.push('Compléter [organisme ou interlocuteur] et vérifier ses coordonnées.');
    missing.push('Remplacer [nom], [coordonnées] et, si nécessaire, [référence du dossier] dans votre propre outil.');
    if(v.kind==='relance')missing.push('Vérifier les faits de la première demande ; ajouter [date du premier contact] et [référence] seulement si ces éléments sont connus.');
    if(!v.timing)missing.push('Ajouter une date utile si vous la connaissez. Aucun délai n’a été calculé.');
    missing.push('Relire les faits, adapter le ton et choisir vous-même le destinataire avant envoi.');
    subject.textContent=subjectText;message.textContent=messageText;checklist.replaceChildren(...missing.map(text=>make('li',text)));
    outputText='BROUILLON À RELIRE — AUCUN MESSAGE ENVOYÉ\n\nObjet : '+subjectText+'\n\n'+messageText+'\n\nÀ COMPLÉTER AVANT ENVOI\n'+missing.map(text=>'• '+text).join('\n')+'\n\nCet outil ne vérifie ni les règles de la démarche ni les délais applicables.\n';
    result.hidden=false;copy.disabled=false;download.disabled=false;
    status.textContent='Brouillon préparé à partir de vos champs. Aucun message envoyé.';
    result.focus({preventScroll:true});result.scrollIntoView({block:'start',behavior:'instant'});
  });
  copy.addEventListener('click',async()=>{
    if(!outputText)return;const text=outputText,restoreFocus=document.activeElement===copy;copy.disabled=true;
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else{
        const temporary=make('textarea');temporary.value=text;temporary.setAttribute('readonly','');temporary.style.cssText='position:fixed;left:-9999px;top:0';
        document.body.appendChild(temporary);temporary.select();let copied=false;
        try{copied=document.execCommand('copy');}finally{temporary.remove();}
        if(!copied)throw new Error('COPY_UNAVAILABLE');
      }
      if(outputText===text)status.textContent='Brouillon copié. Relisez-le et complétez vos marqueurs avant de l’envoyer vous-même.';
    }catch(error){if(outputText===text)status.textContent='Copie automatique indisponible. Sélectionnez le texte du brouillon ou téléchargez-le. Aucun message envoyé.';}
    finally{copy.disabled=!outputText;if(restoreFocus&&!copy.disabled&&document.activeElement===document.body)copy.focus({preventScroll:true});}
  });
  download.addEventListener('click',()=>{
    if(!outputText)return;
    const url=URL.createObjectURL(new Blob([outputText],{type:'text/plain;charset=utf-8'}));
    const link=make('a');link.href=url;link.download='demande-brouillon-local.txt';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status.textContent='Téléchargement demandé. Vérifiez le fichier enregistré ; aucun message envoyé.';
  });
  reset.addEventListener('click',()=>{
    form.reset();invalidate();
    for(const {field,error} of controls.values()){field.removeAttribute('aria-invalid');error.hidden=true;error.textContent='';}
    status.textContent='Champs effacés de ce formulaire. Les copies et fichiers déjà exportés restent sous votre contrôle.';
    controls.get('kind').field.focus();
  });
})();

/* Human contact preparation, without creating a receiver or opening private admission. */
const missionBody=house.querySelector('.housePane[data-house-room="mission"] .housePaneBody');
const missionSurface=document.getElementById('supra-mission');
const existingMissionBrief=document.getElementById('houseMissionBrief');
const invitation='Bonjour, je souhaite une démonstration de SUPRA Mission. La décision que je prépare : … Mon échéance : …';
const exchange=document.createElement('section');
exchange.className='discoveryExchange';
exchange.setAttribute('aria-labelledby','discoveryExchangeTitle');
exchange.innerHTML=
  '<div class="discoveryEyebrow">SUPRA MISSION</div>'+
  '<h2 id="discoveryExchangeTitle">Et votre décision&nbsp;?</h2>'+
  '<p>Une reprise, un financement, un développement. Préparons un premier échange autour de votre décision et de son échéance.</p>'+
  '<p class="discoveryPrice">À partir de <strong>2 500 €</strong><span>sur devis · après qualification du besoin</span></p>'+
  '<blockquote class="discoveryInvitation"></blockquote>'+
  '<button type="button" id="discoveryCopyInvite">Copier la demande de démonstration <span aria-hidden="true">↗</span></button>'+
  '<p class="discoveryContactHint">Envoyez ce message à votre contact SUPRA ou à l’auteur de votre invitation LinkedIn.</p>'+
  '<p class="discoveryCopyStatus" role="status" id="discoveryCopyStatus">Copie uniquement · aucun message envoyé depuis cette page.</p>';
exchange.querySelector('.discoveryInvitation').textContent=invitation;
missionBody.prepend(exchange);
const missionDetails=document.createElement('details');
missionDetails.className='discoveryMissionDetails';
missionDetails.innerHTML='<summary>Parcours et conditions d’accès <span aria-hidden="true">+</span></summary>';
exchange.after(missionDetails);
if(existingMissionBrief)missionDetails.appendChild(existingMissionBrief);
if(missionSurface)missionDetails.appendChild(missionSurface);
exchange.querySelector('#discoveryCopyInvite').addEventListener('click',async()=>{
  const status=exchange.querySelector('#discoveryCopyStatus');
  try{
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(invitation);
    else{
      const copy=document.createElement('textarea');copy.value=invitation;copy.setAttribute('readonly','');copy.style.cssText='position:fixed;left:-9999px;top:0';
      document.body.appendChild(copy);copy.select();let copied=false;
      try{copied=document.execCommand('copy');}finally{copy.remove();}
      if(!copied)throw new Error('Copy unavailable');
    }
    status.textContent='Message copié. Adaptez-le puis envoyez-le à votre contact. Aucune demande transmise ici.';
  }catch(error){status.textContent='La copie automatique est indisponible. Vous pouvez sélectionner le message ci-dessus. Aucune demande transmise.';}
});

const architecture=document.createElement('div');
architecture.className='arrivalRefArchitecture';
architecture.setAttribute('aria-hidden','true');
architecture.innerHTML='<span class="arrivalRefWall"></span><span class="arrivalRefHorizon"></span><span class="arrivalRefDesk"></span><span class="arrivalRefFolio"></span><span class="arrivalRefLamp"></span>';
const artwork=document.createElement('img');
artwork.className='discoveryArtwork';artwork.src='assets/supra-noir-humanoid-butterfly.webp';artwork.alt='';artwork.decoding='async';artwork.fetchPriority='high';
architecture.prepend(artwork);
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
  if(room!==lastRoom){
    animatePassage(room);
    if(!body.classList.contains('house-game-active'))window.scrollTo({top:0,behavior:'instant'});
  }
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
  if(directorRole)directorRole.textContent='Votre guide';
  if(directorStatus)directorStatus.textContent=input.value.trim()
    ?'Votre question reste dans le dialogue local.'
    :'Présence numérique ojO · les sources restent à portée de main.';
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
