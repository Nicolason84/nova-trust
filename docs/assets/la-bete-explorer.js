/* Object navigation on the existing pulse. No second runner, feed, Person registry or execution. */
(function(){
'use strict';
const M=window.LaBeteExplorerModel, legacy=document.querySelector('body > .wrap');
if(!M||!legacy||typeof window.getLaBeteDialogueContext!=='function')return;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
const id=x=>document.getElementById(x), append=(p,...c)=>{c.forEach(x=>x&&p.append(x));return p;};
const button=(text,action,cls)=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',action);return b;};
const link=(label,href,cls)=>{const a=el('a',label,cls);a.href=href;if(href.startsWith('#/'))a.dataset.muRoute=href;else{a.target='_blank';a.rel='noopener noreferrer';}return a;};
const records=new Map(), moves=[], proofViews=new Map();let serial=0,current=null,territories=null,territoryPromise=null,renderToken=0,latest=null,proofNode=null,proofScroll=0;
const legacyChat=id('dialogue-public'), chatPlace=document.createComment('existing-dialogue-home');legacyChat.before(chatPlace);
const root=el('div',undefined,'muApp');root.id='multiunivers';
const header=el('header',undefined,'muHeader');
const mark=link('ojO','#/atlas','muBrand');mark.setAttribute('aria-label','La Bête · atlas');
const brand=append(el('div',undefined,'muBrandBlock'),mark,el('span','LA BÊTE / MULTIUNIVERS','muBrandSub'));
const searchForm=el('form',undefined,'muSearch');searchForm.setAttribute('role','search');
const searchInput=el('input');searchInput.id='muSearchInput';searchInput.type='search';searchInput.placeholder='Un objet, une source, une question…';searchInput.maxLength=150;searchInput.setAttribute('aria-label','Rechercher dans les objets documentés');
const searchSubmit=el('button','Rechercher');searchSubmit.type='submit';append(searchForm,searchInput,searchSubmit);
const headActions=append(el('div',undefined,'muHeadActions'),link('La Bête','#/presence','muPresenceShortcut'),button('Dialoguer',()=>openChat(),'muPrimary'),link('Mode lecture','#/lecture','muReadingLink'));
append(header,brand,searchForm,headActions);root.append(header);
const nav=el('nav',undefined,'muRail');nav.setAttribute('aria-label','Univers explorables');nav.append(link('◉  Atlas','#/atlas','muRailAtlas'));
M.UNIVERSES.forEach(u=>nav.append(link(u.symbol+'  '+u.label,M.route('univers',u.id))));root.append(nav);
const workspace=el('div',undefined,'muWorkspace');
const trailbar=el('div',undefined,'muTrailbar');
const back=button('← Retour',()=>{if(current?.depth>0)history.back();else navigate('#/atlas');},'muBack');back.id='muBack';
const trail=el('nav',undefined,'muBreadcrumb');trail.setAttribute('aria-label','Chemin d’exploration');trail.id='muBreadcrumb';
const share=button('Partager ce point',shareRoute,'muShare');share.id='muShare';append(trailbar,back,trail,share);
const updateBar=el('div',undefined,'muUpdate');updateBar.id='muUpdate';updateBar.hidden=true;append(updateBar,el('span','Un nouvel état est disponible. Votre lecture reste en place.'),button('Actualiser cet objet',()=>renderCurrent(true)));
const stage=el('main',undefined,'muStage');stage.id='muStage';stage.tabIndex=-1;stage.setAttribute('aria-label','Objet ou univers exploré');
const notice=el('p','','muNotice');notice.id='muNotice';notice.setAttribute('role','status');
append(workspace,trailbar,updateBar,stage,notice);root.append(workspace);
const chat=el('dialog',undefined,'muChat');chat.id='muChat';chat.setAttribute('aria-label','Dialogue contextuel avec La Bête');
const chatContext=el('p','','muChatContext');chatContext.id='muChatContext';
append(chat,append(el('div',undefined,'muDialogHead'),el('strong','Dialoguer, sans perdre le fil'),button('Fermer',()=>chat.close())),chatContext,legacyChat);
const proof=el('dialog',undefined,'muProof');proof.id='muProof';proof.setAttribute('aria-label','Pièce et provenance sélectionnées');
const proofBody=el('div',undefined,'muProofBody');proofBody.id='muProofBody';
append(proof,append(el('div',undefined,'muDialogHead'),el('strong','Pièce / provenance'),button('Fermer',()=>proof.close())),proofBody);
root.append(chat,proof);legacy.before(root);legacy.id='legacyReadingDocument';
const savedRestoration=history.scrollRestoration;history.scrollRestoration='manual';
function getBase(){const c=window.getLaBeteDialogueContext();if(!c?.live)throw Error('CANON_NOT_LOADED');return c;}
function graphFrom(c){return M.build(c.live,c.evolution,territories);}
function status(text){notice.textContent=text;}
function save(){if(!current)return;current.scrollY=window.scrollY;current.search=searchInput.value;current.focusId=document.activeElement?.id||null;current.focusRoute=document.activeElement?.dataset?.muRoute||null;current.details=[...stage.querySelectorAll('details')].map(d=>d.open);records.set(current.key,current);while(records.size>40)records.delete(records.keys().next().value);}
function canonicalRoute(raw){const aliases={'#reality-pulse':'#/atlas','#dialogue-public':'#/univers/idees','#demarches':'#/univers/demarches','#la-bete':'#/presence','#beast-resonance':'#/presence','#market-anatomy':'#/analyse','#evidence-graph':'#/univers/preuves','#time-machine':'#/chronologie','#refinancing-twin':'#/horizons','#autoevolution':'#/sante'};return aliases[raw]||raw||'#/atlas';}
function navigate(raw,replace=false){save();const hash=canonicalRoute(raw),base=getBase();const next={key:'mu-'+(++serial),hash,depth:replace?(current?.depth||0):(current?.depth||0)+1,scrollY:0,search:'',graph:graphFrom(base),visited:hash==='#/atlas'?[]:[...(current?.visited||[]).slice(-5),...(current?.label?[{label:current.label,hash:current.hash}]:[])]};
 current=next;const state={...(history.state||{}),mu:{key:next.key,depth:next.depth}};if(replace)history.replaceState(state,'',hash);else history.pushState(state,'',hash);renderCurrent();}
function restoreMoves(){for(const {node,placeholder}of moves.splice(0))placeholder.replaceWith(node);}
function mountExisting(section,target=stage){const n=id(section);if(!n)return false;const p=document.createComment('mounted-existing-'+section);n.before(p);moves.push({node:n,placeholder:p});target.append(n);return true;}
function routeLabel(parsed,g){if(parsed.kind==='objet')return g.nodes.get(parsed.id)?.label||'Objet introuvable';if(parsed.kind==='univers')return M.UNIVERSES.find(u=>u.id===parsed.id)?.label||'Univers';return ({atlas:'Atlas',lecture:'Mode lecture',presence:'Présence de La Bête',analyse:'Analyse des taux',horizons:'Horizons de refinancement',chronologie:'Temps & scénarios',sante:'État et mémoire'})[parsed.kind]||'Route inconnue';}
function title(kicker,text,sub){const head=el('div',undefined,'muTitle');append(head,el('div',kicker,'muEyebrow'),el('h1',text),sub?el('p',sub):null);stage.append(head);}
function card(node,relation){const a=link('',M.route('objet',node.id),'muObjectCard');a.dataset.objectId=node.id;append(a,el('span',relation||M.LABELS[node.kind]||node.kind,'muCardType'),el('strong',node.label),el('small',node.status||'Objet relié à la preuve'),el('span','Explorer ↗','muCardArrow'));return a;}
function listCards(nodes,heading){if(heading)stage.append(el('h2',heading,'muSubhead'));const grid=el('div',undefined,'muCards');nodes.forEach(n=>grid.append(card(n)));stage.append(grid);}
function sourceStamp(g){return 'Instantané '+g.source_snapshot_id+' · état matériel '+g.updated_at+' · dates propres à chaque source';}
function atlas(g){
 title('LA BÊTE · AU CŒUR DES UNIVERS','La Bête.','Explorez les univers autour de sa présence. Les objets et leurs preuves restent accessibles.');
 const map=el('div',undefined,'muAtlas muAtlasWithPresence');map.id='muAtlas';map.setAttribute('aria-label','La Bête au centre des univers explorables');
 const hero=el('section',undefined,'muAtlasPresence');hero.id='muAtlasPresence';hero.setAttribute('aria-label','Présence principale de La Bête');
 const scene=el('div',undefined,'muAtlasScene');scene.id='muAtlasScene';
 if(!mountExisting('beastStage',scene))throw Error('EXISTING_BEAST_STAGE_REQUIRED');
 const caption=el('p','Scène existante · représentation artistique · son et caméra désactivés au départ','muPresenceCaption');
 const actions=el('div',undefined,'muPresenceActions');
 const center=link('',M.route('objet',M.COUNTRY),'muAtlasCore');append(center,el('span','OBJET EXPLORÉ'),el('strong','France'),el('small','Entrer ↗'));
 append(actions,center,link('Immersion & détails','#/presence','muPresenceDetail'));
 append(hero,scene,caption,actions);map.append(hero);
 M.UNIVERSES.forEach((u,i)=>{const a=link('',M.route('univers',u.id),'muUniverse muUniverse-'+i);const count=[...g.nodes.values()].filter(n=>n.universe===u.id).length;const label=u.id==='temps'?g.live.curve_history?.length+' observations':u.id==='idees'?'Dialogue & propositions':u.id==='etat'?'Mémoire opérationnelle':u.id==='territoires'&&!territories?'Pays · détail à la demande':count+' objets documentés';append(a,el('span',u.symbol,'muSymbol'),el('strong',u.label),el('small',u.subtitle),el('span',label,'muUniverseCount'));map.append(a);});
 stage.append(map);
 // One existing canvas, one initialization. Atlas is now itself a visible presence route.
 window.laBeteEnsurePresence?.();
 const path=el('div',undefined,'muSuggested');append(path,el('div','UN PREMIER PARCOURS','muEyebrow'),el('p','France → finances publiques → dette → source → manque → démarche'),link('Commencer par la France',M.route('objet',M.COUNTRY),'muPrimary'));stage.append(path);
 stage.append(el('p','La présence visuelle suit le scénario et le flux existants. Ni ses mouvements ni la position des univers ne constituent une opinion ou une causalité politique.','muFineprint'));
}
function factTable(node,g){const dl=el('dl',undefined,'muFacts');for(const [k,v]of M.facts(node,g))append(dl,el('dt',k),el('dd',v));return dl;}
function objectView(node,g){
 title((M.LABELS[node.kind]||node.kind).toUpperCase(),node.label,node.kind==='REGION'?'Une fiche territoriale descriptive. Aucun taux national ne lui est attribué.':'Un objet, ses éléments documentés et les chemins qui le relient au reste.');
 const layout=el('div',undefined,'muObjectLayout'),main=el('section',undefined,'muObjectMain'),aside=el('aside',undefined,'muRelations');
 append(main,el('span',node.status||'CONTEXTE DOCUMENTÉ','muTag'),factTable(node,g));
 const actions=el('div',undefined,'muActions');append(actions,button('Interroger cet objet',()=>openChat(),'muPrimary'),button('Voir la pièce / provenance',()=>openProof(node,g)));
 if(node.url)actions.append(link('Ouvrir la source officielle ↗',node.url));
 if(node.id===M.DEBT)append(actions,link('Courbes & stress','#/analyse'),link('Horizons','#/horizons'),link('Explorer les dates','#/chronologie'));
 main.append(actions);
 if(node.kind==='REQUEST'){
  const d=node.data,steps=el('ol',undefined,'muSteps');(d.steps||[]).forEach(s=>steps.append(el('li',s.name+' — '+s.state)));main.append(steps);
  const details=el('details',undefined,'muDraft');append(details,el('summary','Demande écrite préparée · non envoyée'),el('pre','Objet : '+d.subject+'\n\n'+d.draft));main.append(details);
  const draftActions=el('div',undefined,'muActions');append(draftActions,button('Copier la demande',async()=>{try{await navigator.clipboard.writeText('Objet : '+d.subject+'\n\n'+d.draft);status('Brouillon copié. Aucun envoi effectué.');}catch(_){details.open=true;status('Sélectionnez le texte du brouillon pour le copier.');}}),button('Exporter le dossier',()=>download(node.data,node.id+'.json')));main.append(draftActions);
  const contact=M.safeURL(d.contact?.url);if(contact)main.append(link('Formulaire officiel · validation humaine ↗',contact));
  main.append(el('p','L’envoi administratif n’est pas raccordé. Une demande préparée ne vaut ni mandat, ni envoi, ni information obtenue.','muGuard'));
 }
 if(node.kind==='CLAIM'&&Array.isArray(node.data.value)){const table=el('table',undefined,'muTable');const h=el('tr');append(h,el('th','Échéance (années)'),el('th','Taux (%)'));table.append(h);for(const x of node.data.value){const row=el('tr');append(row,el('td',x.tenor_years),el('td',x.rate_pct));table.append(row);}main.append(table);}
 if(node.kind==='COUNTRY'&&!territories)main.append(button('Charger les régions documentées',async()=>{await ensureTerritories();renderCurrent(true);},'muPrimary'));
 const relations=M.neighbors(g,node.id);append(aside,el('h2','Traverser une relation'),el('p','Chaque lien indique ce qui relie les objets. Ce n’est pas une causalité implicite.','muFineprint'));
 for(const r of relations)aside.append(card(r.node,(r.direction==='out'?'→ ':'← ')+r.label));
 if(!relations.length)aside.append(el('p','Aucune relation supplémentaire dans le contexte chargé.'));
 append(layout,main,aside);stage.append(layout);
}
async function ensureTerritories(){
 if(territories)return territories;if(territoryPromise)return territoryPromise;
 territoryPromise=(async()=>{const response=await window.laBeteReadCanonicalJSON('data/france-organism.json',{cache:'no-cache'});if(!response.ok)throw Error('TERRITORY_HTTP_'+response.status);const j=await response.json();if(j.schema!=='OJO_FRANCE_ORGANISM_V1'||!Array.isArray(j.topology?.regions)||j.topology.regions.length>100)throw Error('TERRITORY_SCHEMA');const seen=new Set();for(const r of j.topology.regions){if(typeof r.name!=='string'||!/^\d{2,3}$/.test(String(r.code))||seen.has(String(r.code)))throw Error('TERRITORY_IDENTITY');seen.add(String(r.code));}territories=j;return j;})().catch(e=>{territoryPromise=null;throw e;});return territoryPromise;
}
function universeView(universe,g){const u=M.UNIVERSES.find(x=>x.id===universe);title('UNIVERS EXPLORABLE',u.label,u.subtitle+'. Les objets sont des vues des documents existants, pas de nouvelles copies de la vérité.');
 const nodes=[...g.nodes.values()].filter(n=>n.universe===universe);
 if(universe==='territoires')stage.append(el('p',territories?'Les régions sont disponibles. Les nombres de départements, EPCI et communes ne constituent pas des fiches locales ; aucun détail absent n’est inventé.':'Le document territorial n’a pas pu être chargé. Seul l’objet France est disponible ; aucune région de remplacement n’est inventée.','muGuard'));
 if(universe==='sources'){listCards(nodes.filter(n=>n.kind==='ORGANIZATION_VIEW'),'Organismes · regroupements de sources');listCards(nodes.filter(n=>n.kind!=='ORGANIZATION_VIEW'),'Publications et accès');}
 else if(universe==='demarches'){listCards(nodes.filter(n=>n.kind==='REQUEST'),'Demandes préparées');listCards(nodes.filter(n=>n.kind==='GAP'),'Manques documentés');if(!g.evolution)stage.append(el('p','L’évolution vérifiée ne correspond pas au même instantané. Les démarches ne sont pas présentées comme à jour.','muGuard'));}
 else if(universe==='temps'){const actions=el('div',undefined,'muFeatureCards');append(actions,link('◷  Ouvrir la chronologie existante','#/chronologie'),link('◇  Explorer les horizons 12 / 36 / 60 / 120 mois','#/horizons'),link('⌁  Manipuler les scénarios de taux','#/analyse'));stage.append(actions);listCards(nodes);stage.append(el('p','Les scénarios sont conditionnels. Ils ne prédisent ni résultats électoraux ni causalité politique.','muGuard'));}
 else if(universe==='idees'){
  const p=el('div',undefined,'muIdeaIntro');append(p,el('h2','Une question peut ouvrir un chemin.'),el('p','Le dialogue reste disponible depuis chaque objet. Les messages gardent leur contexte ; une proposition n’est ni une preuve ni une décision.'),button('Ouvrir mon échange',()=>openChat(),'muPrimary'),el('p','Version actuelle : réponses structurées par règles, sans modèle de langage généraliste ni nouvelle recherche web.','muFineprint'),link('Consulter les fils publics GitHub ↗','https://github.com/Nicolason84/nova-trust/issues?q=is%3Aissue+%22%5BLA+B%C3%8ATE%5D%22'));stage.append(p);
 }else if(universe==='etat'){
  const p=el('div',undefined,'muFeatureCards');append(p,link('◈  Mémoire et santé opérationnelle','#/sante'),link('◇  Explorer la présence 3D existante','#/presence'));stage.append(p);stage.append(el('p','La Bête est visible dès l’Atlas. La vue détaillée réutilise la même scène ; aucun accès caméra, micro ou son n’est activé par la navigation.','muGuard'));
 }else listCards(nodes);
}
function contextForChat(){const g=current?.graph;if(current?.parsed?.snapshot&&current.parsed.snapshot!==g?.source_snapshot_id)return {live:{},evolution:null,object:null,context_label:'Instantané demandé indisponible'};const node=g?.nodes.get(current?.parsed?.id);return {live:g?.live,evolution:g?.evolution,object:M.dialogueContext(node,g),route:current?.hash||'#/atlas',context_label:node?.label||current?.label||'Atlas'};}
function refreshChatLabel(){const c=contextForChat();chatContext.textContent='Objet courant : '+c.context_label+' · '+(c.live?.snapshot_id||'sans instantané')+'. Les anciens messages conservent leur propre attribution.';}
function openChat(){if(!legacyChat.isConnected||legacyChat.parentNode!==chat)chat.append(legacyChat);refreshChatLabel();if(!chat.open)chat.showModal();id('beastDialogueInput')?.focus({preventScroll:true});}
function openProof(node,g){proofNode={node,g,key:node.id+'|'+g.source_snapshot_id};const saved=proofViews.get(proofNode.key)||{};proofBody.replaceChildren();append(proofBody,el('h2',node.label),el('p',sourceStamp(g),'muFineprint'),factTable(node,g));
 if(node.url)append(proofBody,link('Consulter le document original ↗',node.url),el('p','Le document externe s’ouvre sur son site. Ce panneau affiche les éléments présents dans le flux ; il ne prétend pas avoir téléchargé ni validé à nouveau la pièce.','muFineprint'));
 const d=el('details');append(d,el('summary','Voir l’enregistrement source exact'),el('pre',JSON.stringify(node.data,null,2)));proofBody.append(d);
 append(proofBody,el('p','Référence : '+node.ref,'muMono'),button('Copier la référence',async()=>{try{await navigator.clipboard.writeText(node.ref+'\n'+sourceStamp(g));status('Référence copiée.');}catch(_){status(node.ref);}}));
 d.open=!!saved.expanded;if(!proof.open)proof.showModal();proofBody.scrollTop=saved.scrollTop||0;
}
proof.addEventListener('close',()=>{if(proofNode){proofViews.set(proofNode.key,{scrollTop:proofBody.scrollTop,expanded:!!proofBody.querySelector('details')?.open});while(proofViews.size>40)proofViews.delete(proofViews.keys().next().value);}});
function download(value,name){const u=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'})),a=el('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(u);}
async function shareRoute(){const p=current?.parsed;if(!p)return;let hash=M.route(p.kind,p.id,current.graph.source_snapshot_id);const url=new URL(location.href);url.hash=hash;try{await navigator.clipboard.writeText(url.href);status('Lien copié avec son instantané. Une version absente ne sera pas reconstituée artificiellement.');}catch(_){notice.replaceChildren(el('span','Lien vers ce point : '),link('ouvrir / copier',url.href));}}
async function renderCurrent(useLatest=false,restore=false){
 const token=++renderToken;try{
  if(useLatest){current.graph=graphFrom(getBase());current.hash=current.hash.replace(/\?snapshot=.*$/,'');history.replaceState(history.state,'',current.hash);}
  current.parsed=M.parseRoute(current.hash);const p=current.parsed;let g=current.graph;
  if(p.kind==='univers'&&p.id==='territoires'||p.kind==='objet'&&p.id.startsWith('OJO_FRANCE_ORGANISM_V1#/topology/regions/')){
   if(!territories){status('Chargement du document territorial existant…');try{await ensureTerritories();}catch(e){status('Document territorial indisponible. Aucun détail de remplacement n’est inventé.');}}
   if(token!==renderToken)return;g=current.graph=M.build(g.live,g.evolution,territories);
  }
  if(!['presence','lecture'].includes(p.kind)||current.isSearch)window.laBeteSuspendPresence?.();
  restoreMoves();root.classList.toggle('mu-atlas-home',p.kind==='atlas'&&!current.isSearch&&(!p.snapshot||p.snapshot===g.source_snapshot_id));stage.replaceChildren();legacy.hidden=true;legacy.inert=true;workspace.hidden=false;document.body.classList.remove('mu-reading');root.classList.remove('mu-reading');
  if(p.kind==='lecture'){
   legacy.hidden=false;legacy.inert=false;workspace.hidden=true;chatPlace.after(legacyChat);document.body.classList.add('mu-reading');root.classList.add('mu-reading');window.laBeteEnsurePresence?.();
  }else if(p.snapshot&&p.snapshot!==g.source_snapshot_id){
   title('INSTANTANÉ NON DISPONIBLE','Ce lien vise une autre version.','Version demandée : '+p.snapshot+'. Version chargée : '+g.source_snapshot_id+'. Aucun remplacement silencieux.');stage.append(button('Ouvrir explicitement la version chargée',()=>renderCurrent(true),'muPrimary'));
  }else if(current.isSearch){title('RECHERCHE DANS LE CONTEXTE CHARGÉ',current.search,'Résultats conservés au retour.');listCards(M.search(g,current.search));}
  else if(p.kind==='atlas')atlas(g);
  else if(p.kind==='univers')universeView(p.id,g);
  else if(p.kind==='objet'){const node=g.nodes.get(p.id);if(node)objectView(node,g);else{title('OBJET NON TROUVÉ','Ce point n’est pas documenté ici.','Le lien n’est pas remplacé par un objet inventé.');stage.append(link('Revenir à l’atlas','#/atlas','muPrimary'));}}
  else if(['presence','analyse','horizons','chronologie','sante'].includes(p.kind)){
   const section={presence:'la-bete',analyse:'market-anatomy',horizons:'refinancing-twin',chronologie:'time-machine',sante:'autoevolution'}[p.kind];
   title('COMPOSANT EXISTANT · MÊME FLUX',routeLabel(p,g),'Ce composant est réutilisé, non recopié. Ses valeurs suivent le flux existant ; les objets et preuves disposent de leur propre instantané.');mountExisting(section);
   if(p.kind==='presence')window.laBeteEnsurePresence?.();
  }else {title('ROUTE INCONNUE','Reprendre un chemin documenté.','Cette adresse ne correspond à aucun objet ou univers pris en charge.');stage.append(link('Ouvrir l’atlas','#/atlas','muPrimary'));}
  current.label=routeLabel(p,g);trail.replaceChildren(link('Atlas','#/atlas'));
  for(const v of current.visited||[])if(v.hash!==current.hash&&v.label!=='Atlas')append(trail,el('span','/'),link(v.label,v.hash));append(trail,el('span','/'),el('span',current.label));
  [...nav.querySelectorAll('a')].forEach(a=>{const target=a.dataset.muRoute;const active=(p.kind==='atlas'&&target==='#/atlas')||(p.kind==='univers'&&target===M.route('univers',p.id))||(p.kind==='objet'&&target===M.route('univers',g.nodes.get(p.id)?.universe));if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.title=current.label+' · La Bête · ojO';refreshChatLabel();updateBar.hidden=true;
  if(!workspace.hidden){stage.append(el('p',sourceStamp(g),'muSnapshot'));}
  if(restore){searchInput.value=current.search||'';[...stage.querySelectorAll('details')].forEach((d,i)=>d.open=!!current.details?.[i]);window.scrollTo({top:current.scrollY||0,behavior:'instant'});const f=current.focusId?id(current.focusId):[...document.querySelectorAll('[data-mu-route]')].find(a=>a.dataset.muRoute===current.focusRoute);f?.focus({preventScroll:true});}
  else {window.scrollTo({top:0,behavior:'instant'});if(!workspace.hidden)stage.focus({preventScroll:true});searchInput.value=current.search||'';}
  status('');records.set(current.key,current);
 }catch(error){restoreMoves();chatPlace.after(legacyChat);document.body.classList.remove('mu-active');legacy.hidden=false;legacy.inert=false;root.hidden=true;console.error('MULTIUNIVERS_SAFE_FALLBACK',String(error.message));}
}
searchForm.addEventListener('submit',event=>{event.preventDefault();save();const q=searchInput.value.trim();if(!q){status('Écrivez un nom, un identifiant ou un thème.');return;}const results=M.search(current.graph,q);window.laBeteSuspendPresence?.();root.classList.remove('mu-atlas-home');restoreMoves();stage.replaceChildren();legacy.hidden=true;legacy.inert=true;workspace.hidden=false;title('RECHERCHE DANS LE CONTEXTE CHARGÉ',q,results.length+' objet(s) trouvé(s). La recherche ne visite aucun site externe.');listCards(results);current.search=q;current.isSearch=true;status('');});
root.addEventListener('click',event=>{const a=event.target.closest?.('a[data-mu-route]');if(!a||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(a.dataset.muRoute);});
document.addEventListener('click',event=>{if(!document.body.classList.contains('mu-active')||event.defaultPrevented)return;const a=event.target.closest?.('a[href^="#"]');if(!a||a.dataset.muRoute||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const mapped=canonicalRoute(a.getAttribute('href'));if(mapped.startsWith('#/')){event.preventDefault();navigate(mapped);}});
window.addEventListener('popstate',()=>{save();const key=history.state?.mu?.key,cached=records.get(key);current=cached||{key:key||'mu-'+(++serial),hash:canonicalRoute(location.hash),depth:history.state?.mu?.depth||0,scrollY:0,graph:graphFrom(getBase()),visited:[]};renderCurrent(false,true);});
window.addEventListener('hashchange',()=>{const hash=canonicalRoute(location.hash);if(hash!==current?.hash)navigate(hash,true);});
window.addEventListener('pagehide',()=>{save();});
window.LaBeteExplorer=Object.freeze({getDialogueContext:contextForChat,navigate,openChat,update(c){latest=c;if(!current||!c?.live)return;const changed=c.live.snapshot_id!==current.graph.source_snapshot_id||c.evolution?.generation!==current.graph.evolution?.generation;updateBar.hidden=!changed;},state:()=>({route:current?.hash,object:current?.parsed?.id||null,snapshot:current?.graph.source_snapshot_id,territoriesLoaded:!!territories,historyEntries:records.size})});
try{const g=graphFrom(getBase());current={key:'mu-'+(++serial),hash:canonicalRoute(location.hash),depth:0,scrollY:0,search:'',graph:g,visited:[]};history.replaceState({...history.state,mu:{key:current.key,depth:0}},'',current.hash);document.body.classList.add('mu-active');renderCurrent();}catch(e){restoreMoves();chatPlace.after(legacyChat);root.hidden=true;legacy.hidden=false;legacy.inert=false;history.scrollRestoration=savedRestoration;console.error('MULTIUNIVERS_BOOT_FALLBACK',String(e.message));}
})();
