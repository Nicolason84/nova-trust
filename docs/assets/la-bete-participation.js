/* A view on the existing canonical pulse. No polling, tracking or private API. */
(function () {
  'use strict';
  const D = window.LaBeteDialogue;
  const form = document.getElementById('beastDialogueForm');
  if (!D || !form) return;
  const byId = id => document.getElementById(id);
  const history = [];
  let last = null, current = {live: {}, evolution: {}};
  function element(tag, value, cls) {
    const e = document.createElement(tag);
    if (value !== undefined) e.textContent = String(value);
    if (cls) e.className = cls;
    return e;
  }
  // One active draft augments this module's existing history; no browser storage.
  let draft=null, restored=false, ioBusy=false;
  const draftPanel=element('details',undefined,'beastDraftPanel');draftPanel.id='beastDraftPanel';
  const draftSummary=element('summary','Continuité du brouillon');draftPanel.append(draftSummary);
  const draftIdentity=element('p',undefined,'beastStatus');draftIdentity.id='beastDraftIdentity';draftPanel.append(draftIdentity);
  const draftFields={};
  for(const [key,labelText] of Object.entries({objective:'Objectif du brouillon',expected_outcome:'Résultat attendu',horizon:'Horizon',constraints:'Contraintes (ou aucune déclarée)'})){
    const label=element('label',labelText),field=element('textarea');field.id='beastDraft-'+key;field.rows=2;field.maxLength=1500;label.htmlFor=field.id;draftPanel.append(label,field);draftFields[key]=field;
    field.addEventListener('change',()=>{
      try{const base=draft||D.Draft.create();draft=D.Draft.revise(base,{[key]:field.value.trim()});renderDraft();announceDraft();}
      catch(err){field.value=draft?.[key]||'';byId('beastDialogueNotice').textContent='Modification refusée : '+err.message;}
    });
  }
  const scopeLabel=element('label',undefined,'beastConsent'),scopeCheck=element('input');scopeCheck.type='checkbox';scopeCheck.id='beastDraftScopeConsent';
  scopeLabel.append(scopeCheck,document.createTextNode(' Je confirme : données publiques ou synthétiques uniquement, sans informations privées.'));
  draftPanel.append(scopeLabel,element('p','Reprise par un fichier que vous conservez. Pas de sauvegarde automatique ni de compte privé sur cette page. Le contrôle ne détecte pas toutes les informations sensibles. Une empreinte vérifie le fichier, pas la vérité de son contenu.','beastHint'));
  byId('beastDialogueLog').before(draftPanel);
  const newDraft=element('button','Nouveau brouillon'),importDraft=element('button','Reprendre un fichier');
  newDraft.type=importDraft.type='button';newDraft.id='beastNewDraft';importDraft.id='beastImportDraft';
  const fileInput=element('input');fileInput.type='file';fileInput.accept='.json,application/json';fileInput.hidden=true;fileInput.id='beastDraftFile';
  const draftActions=element('div',undefined,'beastDraftActions');
  draftActions.append(byId('beastExportDialogue'),newDraft,importDraft,byId('beastClearDialogue'),fileInput);draftPanel.append(draftActions);
  function draftState(){return draft?{meta:{...draft},qualification:D.Draft.qualification(draft),restored,turn_count:history.length,last_status:history.at(-1)?.result.status||null}:null;}
  function announceDraft(reason='edit'){document.dispatchEvent(new CustomEvent('la-bete-draft-context',{detail:{state:draftState(),reason}}));}
  function renderDraft(){
    const q=D.Draft.qualification(draft);draftSummary.textContent='Brouillon · '+q.label;
    draftIdentity.textContent=draft?draft.id+' · version '+draft.version+' · '+(restored?'archive importée, non revérifiée':'session locale')+' · aucune mission admise':'Aucun brouillon actif · rien de sauvegardé';
    for(const [key,field] of Object.entries(draftFields))field.value=draft?.[key]||'';
    byId('beastExportDialogue').disabled=!draft;byId('beastExportDialogue').textContent='Exporter le brouillon';
  }
  function resetDraft(){
    history.splice(0);last=null;draft=null;restored=false;byId('beastDialogueLog').replaceChildren();byId('beastDialogueInput').value='';byId('beastPublicConsent').checked=false;scopeCheck.checked=false;updateShare();renderDraft();announceDraft('reset');
  }
  function confirmReplace(){return !draft||window.confirm('Le brouillon actif sera retiré de cette page. Conservez d’abord son export ; le téléchargement ne garantit pas que vous l’avez enregistré. Continuer ?');}
  newDraft.addEventListener('click',()=>{if(ioBusy)return;if(!confirmReplace())return;resetDraft();byId('beastDialogueNotice').textContent='Nouveau contexte vide. Les fichiers déjà exportés ne sont pas supprimés.';byId('beastDialogueInput').focus();});
  importDraft.addEventListener('click',()=>{if(ioBusy)return;if(!scopeCheck.checked){draftPanel.open=true;byId('beastDialogueNotice').textContent='Confirmez le caractère public ou synthétique du fichier, sans données privées.';scopeCheck.focus();return;}fileInput.click();});
  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files?.[0];if(!file||ioBusy)return;const starting=draft?draft.id+':'+draft.version:'';ioBusy=true;
    try{
      if(!scopeCheck.checked)throw Error('DRAFT_SCOPE_CONFIRMATION_REQUIRED');if(file.size>D.Draft.MAX_BYTES)throw Error('DRAFT_FILE_LIMIT');
      const data=await D.Draft.open(await file.text(),scopeCheck.checked);
      if(starting!==(draft?draft.id+':'+draft.version:''))throw Error('DRAFT_CHANGED_DURING_IMPORT');
      if(!confirmReplace())return;
      // Validate fully BEFORE any replacement. Imported text never fires a live-result event.
      resetDraft();draft=data.meta;history.push(...data.conversation);restored=true;
      for(const row of history){message('user',row.text);message('assistant',{...row.result,archive_unverified:true});}
      last=null;byId('beastPublicConsent').checked=false;updateShare();renderDraft();announceDraft('import');
      byId('beastDialogueNotice').textContent='Brouillon repris · empreinte concordante, pas une signature. Réponses archivées non revérifiées ; aucune mission, permission ou publication importée.';
    }catch(err){byId('beastDialogueNotice').textContent='Reprise refusée sans remplacer le brouillon actif : '+err.message;}
    finally{ioBusy=false;fileInput.value='';}
  });
  async function exportDraft(){
    if(ioBusy)return;if(!scopeCheck.checked){draftPanel.open=true;byId('beastDialogueNotice').textContent='Avant export : confirmez données publiques ou synthétiques uniquement.';scopeCheck.focus();return;}
    ioBusy=true;
    try{const data=D.Draft.payload(draft,history,scopeCheck.checked);const pack=await D.Draft.seal(data);if(new TextEncoder().encode(JSON.stringify(pack,null,2)+'\n').byteLength>D.Draft.MAX_BYTES)throw Error('DRAFT_FILE_LIMIT');exportJSON(pack,data.meta.id+'-v'+data.meta.version+'.json');byId('beastDialogueNotice').textContent='Export demandé. Conservez le fichier pour reprendre après fermeture ; ce brouillon n’est pas un dossier privé SUPRA.';}
    catch(err){byId('beastDialogueNotice').textContent='Export refusé : '+err.message;}
    finally{ioBusy=false;}
  }
  // One shared, stateless numerical module, recovered verbatim from the existing laboratory.
  const cashModel=window.OJOCashModel,cashFields={};let liveCashHash=null,cashEdit=0;
  const cashOpen=element('button','Tester le laboratoire de trésorerie');cashOpen.type='button';cashOpen.id='beastCashOpen';cashOpen.hidden=true;byId('beastDialogueLog').before(cashOpen);
  const cashPanel=element('details',undefined,'beastCashPanel');cashPanel.id='beastCashPanel';cashPanel.append(element('summary','Laboratoire · Qui finance le plein ?'));
  cashPanel.append(element('p','Hypothèses synthétiques uniquement. Même calcul que le laboratoire original, sans modèle distant ni décision de crédit. Horizon : 180 jours.','beastHint'));
  const main=element('div',undefined,'beastCashFields'),advanced=element('details'),extra=element('div',undefined,'beastCashFields');advanced.append(element('summary','Toutes les hypothèses, unités et bornes'),extra);cashPanel.append(main,advanced);
  for(const[k,[labelText,unit]]of Object.entries(D.Cash.fields)){
    const label=element('label',labelText+' · '+unit),input=element('input');input.type='number';input.id='beastCash-'+k;input.value=cashModel?.DEFAULTS[k]??'';input.min=cashModel?.RULES[k][0]??'';input.max=cashModel?.RULES[k][1]??'';input.step=cashModel?.INTS.includes(k)?'1':'any';label.htmlFor=input.id;
    label.append(input,element('small','Bornes du modèle : '+input.min+' à '+input.max,'beastStatus'));(['sales','cash','credit','rise','client','fuelDays'].includes(k)?main:extra).append(label);cashFields[k]=input;
    input.addEventListener('input',()=>{cashEdit++;liveCashHash=null;renderCash();cashNotice.textContent='Hypothèse modifiée : ancien résultat conservé, nouveau calcul requis.';});
  }
  const consentLabel=element('label',undefined,'beastConsent'),cashConsent=element('input');cashConsent.type='checkbox';cashConsent.id='beastCashSynthetic';consentLabel.append(cashConsent,document.createTextNode(' Ces hypothèses sont synthétiques et sans données privées.'));
  const cashRun=element('button','Calculer et rattacher au brouillon');cashRun.id='beastCashRun';cashRun.type='button';cashRun.disabled=!cashModel;
  const cashNotice=element('p',cashModel?'Aucun calcul effectué.':'Module du laboratoire indisponible.','beastHint');cashNotice.id='beastCashNotice';cashNotice.setAttribute('role','status');
  const cashResults=element('div');cashResults.id='beastCashResults';cashPanel.append(consentLabel,cashRun,cashNotice,cashResults);draftPanel.append(cashPanel);
  function latestCash(){return [...history].reverse().find(x=>x.result.cash_receipt)?.result.cash_receipt||null;}
  function cashContext(){const receipt=latestCash();if(!receipt||!draft||receipt.draft_id!==draft.id)return null;const challenged=history.some(x=>x.result.status==='METHOD_CHALLENGE'&&x.result.cash_ref===receipt.receipt_sha256);return{receipt,state:challenged?'CHALLENGED':liveCashHash===receipt.receipt_sha256?'EXECUTED_CURRENT':restored?'IMPORTED_ARCHIVE':'RECHECK_REQUIRED'};}
  function resetCash(){liveCashHash=null;cashEdit++;cashConsent.checked=false;cashPanel.open=false;for(const[k,e]of Object.entries(cashFields))e.value=cashModel?.DEFAULTS[k]??'';}
  function renderCash(){
    cashOpen.hidden=!draft||(!/transport|tresorerie|trésorerie|carburant|gazole|cash/i.test(draft.objective)&&!latestCash());cashResults.replaceChildren();
    const rows=history.filter(x=>x.result.cash_receipt),current=cashContext();if(!rows.length){cashResults.append(element('p','Aucun calcul rattaché à ce brouillon.','beastHint'));return;}
    cashResults.append(element('p',rows.length+' calcul(s) synthétique(s) dans ce brouillon ; aucune pièce d’entreprise réelle vérifiée.','beastStatus'));
    for(const row of [...rows].reverse()){const r=row.result.cash_receipt,last=r.receipt_sha256===current?.receipt.receipt_sha256,state=last?current.state:'PREVIOUS_VERSION';
      const card=element('article',undefined,'beastMessage');card.dataset.cashReceipt=r.receipt_sha256;card.dataset.cashState=state;
      const labels={EXECUTED_CURRENT:'Calcul exécuté localement',CHALLENGED:'Résultat contesté · réexamen requis',IMPORTED_ARCHIVE:'Archive importée · non revérifiée',PREVIOUS_VERSION:'Version antérieure conservée',RECHECK_REQUIRED:'Hypothèses modifiées · recalcul requis'};
      card.append(element('strong',labels[state]),element('p',D.Cash.summarize(r)),element('small',r.draft_id+' · v'+r.draft_version+' · '+r.executed_at,'beastStatus'));
      const previous=rows.find(x=>x.result.cash_receipt.receipt_sha256===r.previous_receipt_sha256)?.result.cash_receipt;
      if(previous){const diff=D.Cash.changes(previous,r);card.append(element('p',diff.length?diff.length+' hypothèse(s) modifiée(s) : '+diff.map(k=>D.Cash.fields[k][0]).join(', ')+'. Besoin hors ligne : '+previous.outputs.stress.unfunded.toLocaleString('fr-FR')+' → '+r.outputs.stress.unfunded.toLocaleString('fr-FR')+' EUR.':'Hypothèses identiques recalculées. Cela ne confirme pas leur réalité.'));}
      const proof=element('details');proof.append(element('summary','Pourquoi ce résultat ? Hypothèses, méthode et limites'));const link=element('a','Ouvrir le laboratoire original');link.href=D.Cash.PATH;link.target='_blank';link.rel='noopener noreferrer';proof.append(link);
      proof.append(element('p','Méthode '+r.method+' · '+r.method_sha256),element('p','Hypothèses '+r.inputs_sha256),element('p','Journal quotidien '+r.ledger_sha256),element('p','Reçu '+r.receipt_sha256+' · empreinte, pas signature.'));
      const list=element('ul');for(const[k,v]of Object.entries(r.inputs))list.append(element('li',D.Cash.fields[k][0]+' : '+v+' '+D.Cash.fields[k][1]));for(const limit of D.Cash.limits)list.append(element('li',limit));proof.append(list);card.append(proof);
      if(last){const button=element('button','Marquer à réexaminer');button.id='beastCashChallenge';button.type='button';button.disabled=state==='CHALLENGED';button.addEventListener('click',()=>challengeCash(r));card.append(button);}cashResults.append(card);
    }
  }
  cashOpen.addEventListener('click',()=>{draftPanel.open=true;cashPanel.open=true;renderCash();cashPanel.scrollIntoView({block:'start',behavior:'instant'});});
  function cashResult(summary,status){return{version:D.VERSION,mode:'LOCAL_STRUCTURED_NO_LLM',status,adoption:'NOT_ADOPTED',external_action:'NONE',political_recommendation:'NONE',summary,retained:[],limits:[...D.Cash.limits],evolution:[],next:'Consulter le reçu puis comparer une hypothèse. Aucune mission native ni action extérieure.',references:[],snapshot_id:null,snapshot_at:null};}
  function appendCash(next,result,textValue){
    const c={id:null,label:'Trésorerie · hypothèses synthétiques',snapshot_id:null};result.object_context=c;result.draft_ref={id:next.id,version:next.version,method:D.VERSION};
    const row={text:textValue,kind:'QUESTION',object_context:c,result,draft_id:next.id,draft_version:next.version,recorded_at:next.updated_at};D.Draft.payload(next,[...history,row],true);
    draft=next;history.push(row);last=null;byId('beastPublicConsent').checked=false;updateShare();message('user',textValue);message('assistant',result);renderDraft();announceDraft('method');
  }
  cashRun.addEventListener('click',async()=>{
    if(ioBusy)return;if(!draft){cashNotice.textContent='Décrire d’abord un objectif.';return;}if(!cashConsent.checked){cashNotice.textContent='Confirmation des hypothèses synthétiques requise.';cashConsent.focus();return;}
    const initial=draft.id+':'+draft.version,generation=cashEdit;ioBusy=true;cashRun.disabled=true;
    try{const inputs=Object.fromEntries(Object.entries(cashFields).map(([k,e])=>[k,e.value.trim()===''?NaN:Number(e.value)]));const next=D.Draft.revise(draft),receipt=await D.Cash.run(cashModel,inputs,next,latestCash());
      if(initial!==draft.id+':'+draft.version||generation!==cashEdit)throw Error('CASH_CONTEXT_CHANGED');
      const result=cashResult(D.Cash.summarize(receipt),'LOCAL_METHOD_RESULT');result.cash_receipt=receipt;appendCash(next,result,'Calcul explicite du scénario synthétique de trésorerie.');liveCashHash=receipt.receipt_sha256;renderCash();cashNotice.textContent='Calcul rattaché à la version '+draft.version+'. Journal contrôlé ; aucune validation professionnelle.';
    }catch(err){cashNotice.textContent='Calcul non rattaché : '+err.message+'. Reçu précédent conservé.';}finally{ioBusy=false;cashRun.disabled=!cashModel;}
  });
  function challengeCash(receipt){if(ioBusy||!draft)return;try{const next=D.Draft.revise(draft),result=cashResult('Réexamen demandé localement. Le résultat antérieur est conservé ; il ne doit plus être utilisé comme résultat courant.','METHOD_CHALLENGE');result.cash_ref=receipt.receipt_sha256;appendCash(next,result,'Je demande le réexamen du calcul synthétique.');liveCashHash=null;renderCash();cashNotice.textContent='Réexamen conservé. Recalcul explicite requis avant toute réponse chiffrée dépendante.';}catch(err){cashNotice.textContent='Réexamen non enregistré : '+err.message;}}
  document.addEventListener('la-bete-draft-context',event=>{const reason=event.detail?.reason;if(reason==='reset')resetCash();else if(reason==='import'){resetCash();const r=latestCash();if(r)for(const[k,v]of Object.entries(r.inputs))cashFields[k].value=v;}else if(reason==='edit')liveCashHash=null;renderCash();});
  function context() {
    if (window.LaBeteExplorer?.getDialogueContext) return window.LaBeteExplorer.getDialogueContext();
    if (typeof window.getLaBeteDialogueContext === 'function') {
      const c = window.getLaBeteDialogueContext();
      if (c?.live) return c;
    }
    return current;
  }
  function message(role, value) {
    const card = element('article', undefined, 'beastMessage beastMessage-' + role);
    card.append(element('strong', role === 'user' ? 'Vous' : 'La Bête'));
    if (typeof value === 'string') card.append(element('p', value));
    else {
      if(value.archive_unverified)card.append(element('strong','ARCHIVE IMPORTÉE · NON REVÉRIFIÉE','beastArchiveWarning'));
      if(value.draft_ref)card.append(element('small',value.draft_ref.id+' · v'+value.draft_ref.version+' · méthode '+value.draft_ref.method,'beastStatus'));
      if (value.object_context) card.append(element('small', 'Réponse rattachée à : ' + value.object_context.label + ' · ' + (value.object_context.snapshot_id || 'non chargé'), 'beastStatus'));
      card.append(element('p', value.summary));
      const parts = [['Ce qui est retenu pour examen', value.retained], ['Pourquoi pas encore / limites', value.limits], ['Comment faire évoluer la proposition', value.evolution]];
      parts.forEach(([title, rows]) => {
        if (!rows?.length) return;
        card.append(element('h4', title));
        const list = element('ul');
        rows.forEach(row => list.append(element('li', row)));
        card.append(list);
      });
      if (value.next) { card.append(element('h4', 'Prochaine étape')); card.append(element('p', value.next)); }
      if (value.references?.length) {
        const list = element('div', undefined, 'beastReferences');
        list.append(element('h4', 'Contexte chargé · sources et limites'));
        value.references.forEach(ref => {
          const href = D.safeURL(ref.url);
          if (!href) return;
          const a = element('a', ref.label + ' · ' + ref.status);
          a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
          list.append(a);
          if (ref.checked_at) list.append(element('small', 'Vérification enregistrée : ' + ref.checked_at));
        });
        card.append(list);
      }
      card.append(element('small', value.status + ' · proposition non adoptée · aucune action externe', 'beastStatus'));
    }
    byId('beastDialogueLog').append(card);
    while (byId('beastDialogueLog').children.length > 20) byId('beastDialogueLog').firstElementChild.remove();
    return card;
  }
  function updateShare() {
    byId('beastShareIdea').disabled = !last || !byId('beastPublicConsent').checked || D.sensitive(last.text);
  }
  function submit(value, kind) {
    if(ioBusy){byId('beastDialogueNotice').textContent='Terminez la reprise ou l’export avant de modifier le brouillon.';return false;}
    if(history.length>=D.Draft.MAX_TURNS){byId('beastDialogueNotice').textContent='Limite de 40 échanges atteinte. Exportez puis ouvrez un nouveau brouillon ; aucun échange supprimé.';return false;}
    const c = context();
    const localHistory = history.filter(x => (x.object_context?.id || null) === (c.object?.id || null) && (x.object_context?.snapshot_id || null) === (c.object?.snapshot_id || c.live?.snapshot_id || null) && (x.object_context?.version || null) === (c.object?.version || null));
    const result = D.analyze(value, {...c, kind, history: localHistory,draftMeta:draft,cashEvidence:cashContext()});
    const methodAnswer=['LOCAL_METHOD_CONTEXT','METHOD_RECHECK_REQUIRED'].includes(result.status);
    const objectContext = methodAnswer?{id:null,label:'Trésorerie · hypothèses synthétiques',snapshot_id:null}:c.object ? {id:c.object.id,label:c.object.label,snapshot_id:c.object.snapshot_id,version:c.object.version} : {id:null,label:c.context_label || "Flux général",snapshot_id:c.live?.snapshot_id || null};
    result.object_context = objectContext;
    if (['INVALID_INPUT','PRIVATE_DATA_REVIEW','OUTSIDE_AUTHORITY'].includes(result.status)) { last=null;byId('beastPublicConsent').checked=false;updateShare();byId('beastDialogueNotice').textContent=result.summary+' Le texte n’est pas ajouté au brouillon.';return false; }
    let nextDraft,row;
    try{nextDraft=D.Draft.revise(draft||D.Draft.create(value));result.draft_ref={id:nextDraft.id,version:nextDraft.version,method:D.VERSION};row={text:value,kind,object_context:objectContext,result,draft_id:nextDraft.id,draft_version:nextDraft.version,recorded_at:nextDraft.updated_at};D.Draft.payload(nextDraft,[...history,row],true);}
    catch(err){byId('beastDialogueNotice').textContent='Message non enregistré : '+err.message;return false;}
    draft=nextDraft;
    const userCard = message('user', value);
    userCard.append(element('small', 'Contexte : ' + objectContext.label + ' · ' + (objectContext.snapshot_id || 'non chargé'), 'beastStatus'));
    message('assistant', result);
    last = {text: value, kind};
    history.push(row);
    renderDraft();renderCash();
    byId('beastPublicConsent').checked = false;
    byId('beastDialogueNotice').textContent = 'Réponse locale. Rien n’a été envoyé ni ajouté au système partagé.';
    byId('beastExportDialogue').disabled = false;
    updateShare();
    document.dispatchEvent(new CustomEvent('la-bete-dialogue-result',{detail:{text:value,result,context:c}}));
    const log=byId('beastDialogueLog');log.scrollTop=log.lastElementChild.offsetTop-log.offsetTop;
    return true;
  }
  function exportJSON(value, name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], {type: 'application/json'}));
    const a = element('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function update(live, evolution) {
    current = {live: live || {}, evolution: evolution || {}};
    const host = byId('beastAcquisitionList');
    if (!host) return;
    host.replaceChildren();
    if (!live || evolution?.source_snapshot_id !== live.snapshot_id || evolution?.status !== 'ACTIVE') {
      host.append(element('p', 'Démarches indisponibles : le flux et l’évolution vérifiée doivent correspondre au même instantané.')); return;
    }
    const acquisition = evolution.self_model?.acquisition;
    const records = acquisition?.requests || [];
    byId('beastAcquisitionStatus').textContent = records.length + ' dossier(s) préparé(s) · aucun envoi attesté';
    if (!records.length) host.append(element('p', 'Aucun dossier actif dans cette projection. Cela ne prouve pas l’absence de tout besoin.'));
    records.forEach(record => {
      const card = element('article', undefined, 'beastAcquisitionCard');
      card.append(element('span', record.state + ' · ' + record.id, 'beastStatus'));
      card.append(element('h3', record.organization));
      card.append(element('p', record.purpose));
      card.append(element('p', record.source_ids.length + ' accès regroupés ; une seule demande préparée.'));
      const list = element('ol', undefined, 'beastSteps');
      (record.steps || []).forEach(s => list.append(element('li', s.name + ' — ' + s.state)));
      card.append(list);
      const details = element('details'); details.append(element('summary', 'Lire la demande écrite préparée'));
      const pre = element('pre', 'Objet : ' + record.subject + '\n\n' + record.draft); details.append(pre); card.append(details);
      const actions = element('div', undefined, 'beastActionRow');
      const copy = element('button', 'Copier le brouillon'); copy.type = 'button';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText('Objet : ' + record.subject + '\n\n' + record.draft); copy.textContent = 'Brouillon copié · non envoyé'; }
        catch (_) { details.open = true; copy.textContent = 'Sélectionner le texte pour le copier'; }
      });
      const download = element('button', 'Exporter le dossier public'); download.type = 'button';
      download.addEventListener('click', () => exportJSON(record, record.id + '.json'));
      actions.append(copy, download); card.append(actions);
      const officialContact = D.safeURL(record.contact?.url);
      if (officialContact) { const a = element('a', 'Ouvrir le formulaire officiel AFT · validation humaine'); a.href = officialContact; a.target = '_blank'; a.rel = 'noopener noreferrer'; card.append(a); }
      card.append(element('p', 'À débloquer dans l’espace privé : ' + record.next_action, 'beastGate'));
      host.append(card);
    });
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const value = byId('beastDialogueInput').value.trim();
    if(submit(value, byId('beastDialogueKind').value))byId('beastDialogueInput').value = '';
  });
  document.querySelectorAll('[data-beast-question]').forEach(button => button.addEventListener('click', () => {
    byId('beastDialogueInput').value = button.dataset.beastQuestion;
    byId('beastDialogueKind').value = button.dataset.beastKind || 'QUESTION';
    byId('beastDialogueInput').focus();
  }));
  byId('beastPublicConsent').addEventListener('change', updateShare);
  byId('beastShareIdea').addEventListener('click', () => {
    try {
      const payload = D.sharePayload(last?.text, last?.kind, byId('beastPublicConsent').checked);
      const url = D.issueURL(payload);
      const a = element('a', 'Ouvrir le brouillon public sur GitHub');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      const notice = byId('beastDialogueNotice'); notice.replaceChildren(element('span', 'Pas encore publié. Un compte GitHub et une confirmation sur GitHub sont nécessaires. '), a);
      a.click();
    } catch (err) { byId('beastDialogueNotice').textContent = 'Publication non préparée : ' + err.message; }
  });
  byId('beastExportDialogue').addEventListener('click', exportDraft);
  byId('beastClearDialogue').addEventListener('click', () => {
    if(ioBusy)return;resetDraft();byId('beastDialogueNotice').textContent='Brouillon retiré de cette page. Les fichiers exportés et les contributions déjà publiées ne sont pas supprimés.';
  });
  byId('beastDialogueSubmit').disabled = false;
  window.LaBeteParticipation = Object.freeze({update,draftState,cashState:()=>JSON.parse(JSON.stringify(cashContext()))});
  renderDraft();
  const c = context(); update(c.live, c.evolution);
})();
