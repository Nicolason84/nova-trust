// This view projects the common owner contract. It has no network or scheduler.
// Only closed signal names cross the SDK boundary; personal contents stay here.
export function evolutionUI({render,esc,toast,snapshot,storage}){
  let engine=null,problem='',lastFacts=null,review='',choicesOpen=false;
  try{
    if(!globalThis.NovaEvolution)throw Error('COMMON_MODULE_UNAVAILABLE');
    engine=globalThis.NovaEvolution.create({appId:'helene',scope:'personal',storage:storage===undefined?globalThis.localStorage:storage,clock:()=>new Date().toISOString()});
    if(engine.status().storage==='CORRUPT_REQUIRES_FORGET')problem='Ces réglages sont illisibles. Tu peux utiliser « Oublier ces choix et ce bilan » pour repartir sans effacer tes notes ni ton coffre.';
  }catch{
    problem='Ces réglages ne peuvent pas être conservés dans ce navigateur. Tes éléments restent disponibles.';
  }
  const flags=()=>engine?.consent()||{memory:false,observations:false,suggestions:false,technicalSharing:false};
  const preferences=()=>({language:'fr',detail:'standard',cadence:'on_open',...engine?.preferences()});
  function storageNotice(){
    if(['UNAVAILABLE','SESSION_ONLY'].includes(engine.status().storage)){
      problem='Ce choix est actif pour cette visite. Le navigateur n’a pas pu le conserver pour une prochaine ouverture.';
      return false;
    }
    return true;
  }
  function observe(signal){
    if(!engine||!flags().observations)return;
    try{engine.observe(signal)}catch{problem='Le bilan local n’a pas pu être actualisé. Tes éléments sont conservés.'}
  }
  function facts(){
    if(!flags().observations)return {pendingSteps:0};
    const value=snapshot();
    return {pendingSteps:Number.isSafeInteger(value.pendingSteps)&&value.pendingSteps>0?value.pendingSteps:0};
  }
  function refresh(){
    if(!engine||!flags().observations){lastFacts=null;return}
    const value=facts(),key=String(value.pendingSteps);
    if(key!==lastFacts){lastFacts=key;if(value.pendingSteps)observe('PENDING_TASK')}
  }
  function suggestions(){
    if(!engine||!flags().suggestions||preferences().cadence==='off')return [];
    const value=engine.suggest();
    return Array.isArray(value)?value:Array.isArray(value?.suggestions)?value.suggestions:[];
  }
  function checked(key){return flags()[key]?' checked':''}
  function home(){
    refresh();
    const f=flags(),p=preferences(),pending=f.observations?facts().pendingSteps:0;
    const rows=suggestions();
    const cards=rows.map(row=>{
      if(typeof row.id!=='string')return '';
      const signal=row.signal||row.code||row.kind;
      if(signal==='PENDING_TASK'&&!pending)return '';
      const title=signal==='PENDING_TASK'?'Reprendre un prochain petit pas':row.title||'Une piste pour simplifier ton espace';
      const text=signal==='PENDING_TASK'?'Tu as gardé une étape à reprendre dans tes éléments. Tu peux la retrouver tranquillement, quand tu le souhaites.':row.message||row.summary||'Tu peux examiner cette proposition et choisir de la garder ou de la laisser.';
      const state=row.state||row.status;
      const refused=state==='REFUSED',approved=state==='APPROVED_NOT_EXECUTED';
      return `<article class="evolution-suggestion"><h3>${esc(title)}</h3>${p.detail==='short'?'':`<p>${esc(text)}</p>`}<p class="small muted">${refused?'Piste mise de côté':approved?'Piste gardée pour examen':state==='CANCELLED'?'Choix annulé':'Proposition à examiner'} · aucune action extérieure</p><div class="button-row">${refused?'':`<button type="button" class="button secondary" data-evolution-decision="accept" data-proposal="${esc(row.id)}">${approved?'Garder cette piste':'Examiner'}</button><button type="button" class="text-button" data-evolution-decision="refuse" data-proposal="${esc(row.id)}">Pas pour moi</button>`}<button type="button" class="text-button" data-evolution-decision="cancel" data-proposal="${esc(row.id)}">Annuler mon choix</button>${approved&&signal==='PENDING_TASK'?'<a class="text-button" href="#elements">Retrouver mes prochains petits pas</a>':''}</div></article>`;
    }).join('');
    return `<section class="evolution-panel" aria-labelledby="evolution-title"><span class="eyebrow">À TON RYTHME</span><h2 id="evolution-title">Un compagnon qui s’adapte à tes choix.</h2><p>Tu choisis ce que cet appareil peut retenir pour te proposer une aide au bon moment.</p>${cards||`<p class="small muted">${p.cadence==='off'?'Tu as choisi de masquer les propositions.':f.suggestions?'Les propositions apparaissent ici quand une piste utile est repérée.':'Les suggestions sont désactivées. Tu peux les autoriser ci-dessous.'}</p>`}<details data-evolution-settings${choicesOpen?' open':''}><summary>Choisir ce que je souhaite retenir</summary><p class="small muted">Ces choix restent dans ce navigateur. Le contenu de tes notes, de tes conversations et de ton coffre n’entre pas dans le bilan technique.</p><div class="evolution-choices">${[['memory','Retenir mes préférences d’affichage'],['observations','Retenir les états techniques et les étapes à reprendre, sans leur texte'],['suggestions','Me proposer des pistes à l’ouverture'],['technicalSharing','Autoriser la préparation d’un bilan technique sans mes contenus']].map(([key,label])=>`<label class="evolution-choice"><input type="checkbox" data-evolution-consent="${key}"${checked(key)}${engine?'':' disabled'}><span>${esc(label)}</span></label>`).join('')}</div><form id="evolution-preferences"><label for="evolution-detail">Détail des propositions</label><select id="evolution-detail"${f.memory?'':' disabled'}><option value="standard"${p.detail==='standard'?' selected':''}>Avec une courte explication</option><option value="short"${p.detail==='short'?' selected':''}>Quelques mots seulement</option></select><label for="evolution-cadence">Quand les afficher</label><select id="evolution-cadence"${f.memory?'':' disabled'}><option value="on_open"${p.cadence==='on_open'?' selected':''}>Dans mon espace, à l’ouverture</option><option value="off"${p.cadence==='off'?' selected':''}>Les masquer</option></select><button type="submit" class="button secondary"${f.memory?'':' disabled'}>Garder mes préférences</button></form><p class="small muted">Aucune notification ni aucun message externe n’est envoyé.</p><div class="button-row"><button type="button" class="text-button" data-evolution-review${f.technicalSharing?'':' disabled'}>Voir le bilan que je pourrais partager</button><button type="button" class="text-button" data-evolution-forget${engine?'':' disabled'}>Oublier ces choix et ce bilan</button></div>${review?`<pre class="evolution-review" aria-label="Bilan technique préparé">${esc(review)}</pre><p class="small muted">Ce bilan est affiché ici. Il n’a pas été envoyé.</p>`:''}</details>${problem?`<p class="error" role="status">${esc(problem)}</p>`:''}</section>`;
  }
  document.addEventListener('change',event=>{
    const key=event.target.dataset?.evolutionConsent;
    if(!key||!engine)return;
    try{engine.setConsent({...flags(),[key]:event.target.checked});if(key==='observations')lastFacts=null;review='';problem='';storageNotice();render()}
    catch{problem='Ce choix n’a pas pu être conservé. Réessaie quand tu le souhaites.';render()}
  });
  document.addEventListener('submit',event=>{
    if(event.target.id!=='evolution-preferences')return;
    event.preventDefault();if(!engine||!flags().memory)return;
    try{engine.setPreferences({language:'fr',detail:document.getElementById('evolution-detail').value,cadence:document.getElementById('evolution-cadence').value});problem='';const saved=storageNotice();render();if(saved)toast('Tes préférences sont gardées sur cet appareil.')}
    catch{problem='Les préférences n’ont pas pu être gardées.';render()}
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||!engine)return;
    try{
      if(button.hasAttribute('data-evolution-forget')){engine.forget();lastFacts=null;review='';problem='';render();toast('Ces choix et ce bilan sont oubliés. Tes notes et ton coffre sont conservés.');return}
      if(button.hasAttribute('data-evolution-review')){review=JSON.stringify(engine.exportTechnical(),null,2);choicesOpen=true;render();return}
      const decision=button.dataset.evolutionDecision;
      if(decision){engine.decide(button.dataset.proposal,decision);render();toast(decision==='accept'?'Cette piste est gardée pour examen. Aucune action n’a été lancée.':decision==='refuse'?'Ton choix est pris en compte.':'Ton choix a été annulé.');return}
    }catch{problem='Ce choix n’a pas pu être appliqué. Aucune action extérieure n’a été lancée.';render()}
  });
  document.addEventListener('toggle',event=>{
    if(event.target.matches?.('[data-evolution-settings]')&&event.target.isConnected)choicesOpen=event.target.open;
  },true);
  globalThis.addEventListener('storage',event=>{
    if(event.key!=='nova:ojo:evolution:v1:helene:personal')return;
    review='';render();
  });
  return {home,refresh,observe};
}
