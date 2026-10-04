/* Object navigation on the existing pulse. No second runner, feed, Person registry or execution. */
(function(){
'use strict';
const M=window.LaBeteExplorerModel, legacy=document.querySelector('body > .wrap');
if(!M||!legacy||typeof window.getLaBeteDialogueContext!=='function')return;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
const id=x=>document.getElementById(x), append=(p,...c)=>{c.forEach(x=>x&&p.append(x));return p;};
const button=(text,action,cls)=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',action);return b;};
const link=(label,href,cls)=>{const a=el('a',label,cls);a.href=href;if(href.startsWith('#/'))a.dataset.muRoute=href;else{a.target='_blank';a.rel='noopener noreferrer';}return a;};
const records=new Map(), moves=[], proofViews=new Map(), communeShards=new Map(), shardPromises=new Map();
let topology=null,topologyPromise=null;let serial=0,current=null,territories=null,territoryPromise=null,renderToken=0,latest=null,proofNode=null,proofScroll=0,territoryCulture=null,territoryCulturePromise=null,phiPolicy=null,phiPromise=null,territoryQuests=null,territoryQuestsPromise=null,territoryLivingIdentity=null,territoryLivingIdentityPromise=null;
const legacyChat=id('dialogue-public'), chatPlace=document.createComment('existing-dialogue-home');legacyChat.before(chatPlace);
const root=el('div',undefined,'muApp');root.id='multiunivers';
const AUDIENCE_MODES={simple:'Essentiel',explain:'Comprendre',expert:'Expert'};
const UI_LOCALES={fr:'FR',en:'EN',es:'ES',local:'Local'};
const I18N={
 en:{
  mode_simple:'Essential',mode_explain:'Understand',mode_expert:'Expert',
  nav_home:'Home',nav_public:'Understand',nav_act:'Take action',nav_decide:'Decide together',nav_services:'Personal help',nav_data:'My data',nav_mobile:'Mobile',
  ask:'Ask a question',read:'Read article',search:'Ask a question or search a topic…',
  atlas_kicker:'START WITH A QUESTION',atlas_title:'What do you want to understand?',atlas_sub:'No jargon required: start with a concrete question, then open the sources if you want to go further.',
  q_rate:'Is France borrowing at a higher rate than before?',q_when:'When does it actually hit the budget?',q_cost:'How much could it add?',q_sources:'Where do the numbers come from?',q_known:'What do we really know today?',q_ask:'Can I ask my own question?',
  q_rate_a:'The tracked 10-year rate is {rate}%. The next question is when that cost actually reaches the budget.',q_when_a:'Not all at once. Debt is refinanced progressively, so 12, 36, 60 and 120 month views show how the effect travels through time.',q_cost_a:'La Bête calculates conditional scenarios from available data. They are not forecasts; they show orders of magnitude under different rate assumptions.',q_sources_a:'Each important figure is linked to a source and a date. Missing or stale sources are flagged rather than silently filled in.',q_known_a:'{warnings} source(s) currently need attention. Observed facts, calculations and hypotheses remain separate.',q_ask_a:'Yes. The dialogue keeps the context of the page you are on without turning your question into evidence or a decision.',
  dept_kicker:'YOUR DEPARTMENT, BEYOND THE NUMBERS',dept_title:'Discover {name} differently',dept_sub:'Places, languages, heritage, skills, memory and local initiatives — with sources, and room for residents to add what the data misses.',
  phi_title:'Φ Coins · reward useful local knowledge',phi_sub:'Φ are non-monetary, non-transferable civic recognition points. They are awarded only after a contribution is verified.',contribute:'Contribute to this department',top_places:'Main communes in the loaded API data',local_lang:'Languages & local expressions',story_open:'What should this department tell better?',
  local_unverified:'Local mode is open for documented variants only; no dialect is invented automatically.'
 },
 es:{
  mode_simple:'Esencial',mode_explain:'Comprender',mode_expert:'Experto',
  nav_home:'Inicio',nav_public:'Comprender',nav_act:'Hacer una gestión',nav_decide:'Decidir juntos',nav_services:'Ayuda personalizada',nav_data:'Mis datos',nav_mobile:'Móvil',
  ask:'Hacer una pregunta',read:'Leer el artículo',search:'Haz una pregunta o busca un tema…',
  atlas_kicker:'EMPIEZA POR UNA PREGUNTA',atlas_title:'¿Qué quieres entender?',atlas_sub:'No necesitas conocer la jerga: empieza por una pregunta concreta y abre las fuentes si quieres profundizar.',
  q_rate:'¿Francia se endeuda hoy a un tipo más alto que antes?',q_when:'¿Cuándo pesa de verdad en el presupuesto?',q_cost:'¿Cuánto puede costar de más?',q_sources:'¿De dónde salen las cifras?',q_known:'¿Qué sabemos realmente hoy?',q_ask:'¿Puedo hacer mi propia pregunta?',
  q_rate_a:'El tipo a 10 años seguido aquí es {rate} %. La cuestión siguiente es cuándo ese coste llega realmente al presupuesto.',q_when_a:'No de golpe. La deuda se renueva progresivamente: los horizontes de 12, 36, 60 y 120 meses muestran cómo se transmite el efecto.',q_cost_a:'La Bête calcula escenarios condicionales con los datos disponibles. No son predicciones: muestran órdenes de magnitud según los tipos.',q_sources_a:'Cada cifra importante está vinculada a una fuente y una fecha. Si una fuente falta o envejece, La Bête lo indica en lugar de rellenar el hueco.',q_known_a:'{warnings} fuente(s) requieren atención. Hechos observados, cálculos e hipótesis siguen separados.',q_ask_a:'Sí. El diálogo conserva el contexto de la página sin convertir tu pregunta en una prueba ni en una decisión.',
  dept_kicker:'TU DEPARTAMENTO, MÁS ALLÁ DE LAS CIFRAS',dept_title:'Descubre {name} de otra manera',dept_sub:'Lugares, lenguas, patrimonio, saber hacer, memoria e iniciativas locales — con fuentes y espacio para aportar lo que los datos no cuentan.',
  phi_title:'Φ Coins · reconocer el conocimiento local útil',phi_sub:'Los Φ son puntos cívicos no monetarios y no transferibles. Solo se conceden después de verificar una contribución.',contribute:'Contribuir a este departamento',top_places:'Principales municipios en los datos API cargados',local_lang:'Lenguas y expresiones locales',story_open:'¿Qué debería contar mejor este departamento?',
  local_unverified:'El modo local solo usa variantes documentadas; nunca se inventa automáticamente un habla.'
 }
};
let audienceMode='simple',uiLocale='fr';
root.dataset.audienceMode=audienceMode;root.dataset.uiLocale=uiLocale;
const tr=(key,fallback)=>I18N[uiLocale]?.[key]||fallback;
const fill=(text,values={})=>String(text).replace(/\{(\w+)\}/g,(_,k)=>values[k]??'');
const header=el('header',undefined,'muHeader');
const mark=link('ojO','#/atlas','muBrand');mark.setAttribute('aria-label','La Bête · accueil');
const brand=append(el('div',undefined,'muBrandBlock'),mark,el('span','COMPRENDRE · VÉRIFIER · AGIR','muBrandSub'));
const searchForm=el('form',undefined,'muSearch');searchForm.setAttribute('role','search');
const searchInput=el('input');searchInput.id='muSearchInput';searchInput.type='search';searchInput.placeholder='Posez une question ou cherchez un sujet…';searchInput.maxLength=150;searchInput.setAttribute('aria-label','Rechercher une réponse, un sujet ou une source');
const searchSubmit=el('button','Chercher');searchSubmit.type='submit';append(searchForm,searchInput,searchSubmit);
const presenceShortcut=link('La Bête','#/presence','muPresenceShortcut'),askShortcut=button('Poser une question',()=>openChat(),'muPrimary'),readingShortcut=link('Lire l’article','#/lecture','muReadingLink');
const headActions=append(el('div',undefined,'muHeadActions'),presenceShortcut,askShortcut,readingShortcut);
append(header,brand,searchForm,headActions);root.append(header);
const audienceBar=el('div',undefined,'muAudienceBar');audienceBar.setAttribute('aria-label','Niveau de lecture et langue');
const audienceLabel=el('span','Niveau de lecture','muAudienceLabel');audienceBar.append(audienceLabel);
const audienceButtons=[];
for(const [key,label] of Object.entries(AUDIENCE_MODES)){const b=button(label,()=>setAudienceMode(key),'muAudienceButton');b.id='muMode-'+key;b.dataset.mode=key;audienceButtons.push(b);audienceBar.append(b);}
const localeDivider=el('span','·','muLocaleDivider');audienceBar.append(localeDivider);
const localeButtons=[];
for(const [key,label] of Object.entries(UI_LOCALES)){const b=button(label,()=>setUiLocale(key),'muLocaleButton');b.id='muLang-'+key;b.dataset.locale=key;localeButtons.push(b);audienceBar.append(b);}
root.append(audienceBar);
let navLinks=null;
function syncAudienceMode(){
 root.dataset.audienceMode=audienceMode;
 audienceButtons.forEach(b=>{b.textContent=tr('mode_'+b.dataset.mode,AUDIENCE_MODES[b.dataset.mode]);b.setAttribute('aria-pressed',String(b.dataset.mode===audienceMode));});
 searchInput.placeholder=audienceMode==='expert'?(uiLocale==='en'?'An object, a source, an identifier…':uiLocale==='es'?'Un objeto, una fuente, un identificador…':'Un objet, une source, un identifiant…'):tr('search','Posez une question ou cherchez un sujet…');
}
function syncUiLocale(){
 root.dataset.uiLocale=uiLocale;
 localeButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.locale===uiLocale)));
 askShortcut.textContent=tr('ask','Poser une question');readingShortcut.textContent=tr('read','Lire l’article');
 searchInput.placeholder=audienceMode==='expert'?(uiLocale==='en'?'An object, a source, an identifier…':uiLocale==='es'?'Un objeto, una fuente, un identificador…':'Un objet, une source, un identifiant…'):tr('search','Posez une question ou cherchez un sujet…');
 if(navLinks){navLinks.home.textContent='◉  '+tr('nav_home','Accueil');navLinks.public.textContent='○  '+tr('nav_public','Comprendre');navLinks.act.textContent='↗  '+tr('nav_act','Faire une démarche');navLinks.decide.textContent='◇  '+tr('nav_decide','Décider ensemble');navLinks.services.textContent='◆  '+tr('nav_services','Aide personnalisée');navLinks.data.textContent='◇  '+tr('nav_data','Mes données');navLinks.mobile.textContent='▣  '+tr('nav_mobile','Sur mobile');}
 syncAudienceMode();
}
function setAudienceMode(mode){
 if(!AUDIENCE_MODES[mode]||mode===audienceMode)return;
 audienceMode=mode;syncAudienceMode();if(current)renderCurrent(false,false);
}
function setUiLocale(locale){
 if(!UI_LOCALES[locale]||locale===uiLocale)return;
 uiLocale=locale;syncUiLocale();if(current)renderCurrent(false,false);
}
let mobileAccess=null;
const nav=el('nav',undefined,'muRail');nav.setAttribute('aria-label','Chemins de lecture');
navLinks={home:link('◉  Accueil','#/atlas','muRailAtlas'),public:link('○  Comprendre','#/public'),act:link('↗  Faire une démarche','#/agir'),decide:link('◇  Décider ensemble','#/scic'),services:link('◆  Aide personnalisée','#/services'),data:link('◇  Mes données','#/prive'),mobile:link('▣  Sur mobile','#/mobile')};
nav.append(navLinks.home,navLinks.public,navLinks.act,navLinks.decide,navLinks.services,navLinks.data,navLinks.mobile);
M.UNIVERSES.forEach(u=>{const a=link(u.symbol+'  '+u.label,M.route('univers',u.id),'muDeepNav');nav.append(a);});root.append(nav);syncUiLocale();
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
function graphFrom(c){return M.build(c.live,c.evolution,territories,topology,communeShards);}
function status(text){notice.textContent=text;}
function save(){if(!current)return;current.scrollY=window.scrollY;current.search=searchInput.value;current.focusId=document.activeElement?.id||null;current.focusRoute=document.activeElement?.dataset?.muRoute||null;current.details=[...stage.querySelectorAll('details')].map(d=>d.open);records.set(current.key,current);while(records.size>40)records.delete(records.keys().next().value);}
function canonicalRoute(raw){const aliases={'#reality-pulse':'#/atlas','#dialogue-public':'#/univers/idees','#demarches':'#/univers/demarches','#la-bete':'#/presence','#beast-resonance':'#/presence','#market-anatomy':'#/analyse','#evidence-graph':'#/univers/preuves','#time-machine':'#/chronologie','#refinancing-twin':'#/horizons','#autoevolution':'#/sante'};return aliases[raw]||raw||'#/atlas';}
function navigate(raw,replace=false){save();const hash=canonicalRoute(raw),base=getBase();const next={key:'mu-'+(++serial),hash,depth:replace?(current?.depth||0):(current?.depth||0)+1,scrollY:0,search:'',graph:graphFrom(base),visited:hash==='#/atlas'?[]:[...(current?.visited||[]).slice(-5),...(current?.label?[{label:current.label,hash:current.hash}]:[])]};
 current=next;const state={...(history.state||{}),mu:{key:next.key,depth:next.depth}};if(replace)history.replaceState(state,'',hash);else history.pushState(state,'',hash);renderCurrent();}
function restoreMoves(){for(const {node,placeholder}of moves.splice(0))placeholder.replaceWith(node);}
function mountExisting(section,target=stage){const n=id(section);if(!n)return false;const p=document.createComment('mounted-existing-'+section);n.before(p);moves.push({node:n,placeholder:p});target.append(n);return true;}
function routeLabel(parsed,g){if(parsed.kind==='objet')return M.resolveNode(g,parsed.id)?.label||'Objet introuvable';if(parsed.kind==='univers')return M.UNIVERSES.find(u=>u.id===parsed.id)?.label||'Univers';return ({public:'Comprendre',agir:'Faire une démarche',scic:'Décider ensemble',services:'Aide personnalisée',mobile:'Sur mobile',prive:'Mes données',atlas:'Accueil',lecture:'Lire l’article',presence:'La Bête',analyse:'Taux & scénarios',horizons:'Dans le temps',chronologie:'Ce qui a changé',sante:'Fiabilité'})[parsed.kind]||'Route inconnue';}
function title(kicker,text,sub){const head=el('div',undefined,'muTitle');append(head,el('div',kicker,'muEyebrow'),el('h1',text),sub?el('p',sub):null);stage.append(head);}
function friendlyStatus(value){const s=String(value||'').toUpperCase();const map={LIVE_VERIFIED:'Vérifié',VERIFIED:'Vérifié',UNAVAILABLE:'Source indisponible',DEGRADED:'Source à surveiller',CONTRADICTED:'À vérifier',RETAINED_LAST_GOOD:'Dernière donnée fiable conservée',DRAFT_READY:'Prêt à relire',PROPOSAL_ONLY:'Proposition',NOT_CONNECTED:'Non activé',NOT_EXECUTED:'Pas encore réalisé',TO_FORMALIZE_NOT_A_VERIFIED_REGISTERED_ENTITY:'En projet · pas encore constituée',OPERABLE_NON_BINDING:'Fonctionne en test · sans effet juridique',BLOCKED:'Fermé par sécurité',ACTIVE:'Actif'};return map[s]||(!s||s==='UNKNOWN'?'À vérifier':value);}
function card(node,relation){const a=link('',M.route('objet',node.id),'muObjectCard');a.dataset.objectId=node.id;append(a,el('span',relation||M.LABELS[node.kind]||node.kind,'muCardType'),el('strong',node.label),el('small',audienceMode==='expert'?(node.status||'Objet relié à la preuve'):friendlyStatus(node.status)),el('span','Explorer ↗','muCardArrow'));return a;}
function paginatedCards(host,items,heading,key,relationMode=false){
 if(heading)host.append(el('h2',heading,'muSubhead'));const area=el('div',undefined,relationMode?'muRelationsList':'muCards');let shown=0;const pageSize=40;
 const more=button('Afficher davantage',()=>{show();current.pages=current.pages||{};current.pages[key]=shown;});
 const count=el('p','','muFineprint');
 function show(){const stop=Math.min(items.length,shown+pageSize);for(;shown<stop;shown++){const item=items[shown];area.append(relationMode?card(item.node,(item.direction==='out'?'→ ':'← ')+item.label):card(item));}count.textContent=shown+' / '+items.length+' éléments affichés';more.hidden=shown>=items.length;}
 host.append(area,count,more);const wanted=current?.pages?.[key]||pageSize;do{show();}while(shown<wanted&&shown<items.length);
}
function listCards(nodes,heading){paginatedCards(stage,nodes,heading,'cards:'+(heading||'default'));}
function sourceStamp(g){return 'Instantané '+g.source_snapshot_id+' · état matériel '+g.updated_at+' · dates propres à chaque source';}
function humanStamp(g){return audienceMode==='expert'?sourceStamp(g):audienceMode==='explain'?'Données sourcées et datées · dernière mise à jour '+g.updated_at+' · détails complets en mode Expert.':'Données sourcées et datées · les détails techniques restent accessibles en mode Expert.';}
function qa(question,answer,href,label='Comprendre pourquoi'){
 const article=el('article',undefined,'muQuestionCard');append(article,el('h2',question),el('p',answer));
 if(href)article.append(link(label,href,'muQuestionLink'));return article;
}
function questionHub(g){
 const live=g.live||{},obs=live.observed||{},summary=live.summary||{},grid=el('section',undefined,'muQuestionGrid');
 const tec=obs.tec10_pct??obs.tec_10y_pct??obs.tec10??null,warnings=String(summary.warnings||0);
 const rateAnswer=tec!==null?fill(tr('q_rate_a','Le taux à 10 ans suivi ici est de {rate} %. La question importante est ensuite de savoir quand ce coût se transmet réellement au budget.'),{rate:tec}):(uiLocale==='en'?'The current rate is tracked, but its value is unavailable in this view.':uiLocale==='es'?'El tipo actual se sigue, pero su valor no está disponible en esta vista.':'Le taux courant est suivi, mais sa valeur n’est pas disponible dans cet affichage.');
 append(grid,
  qa(tr('q_rate','La France emprunte-t-elle plus cher qu’avant ?'),rateAnswer,'#/analyse',uiLocale==='en'?'See rates':uiLocale==='es'?'Ver tipos':'Voir les taux'),
  qa(tr('q_when','Quand est-ce que ça pèse vraiment sur le budget ?'),tr('q_when_a','Pas d’un seul coup. La dette est renouvelée progressivement : les horizons de 12, 36, 60 et 120 mois montrent comment le choc se transmet dans le temps.'),'#/horizons',uiLocale==='en'?'See transmission':uiLocale==='es'?'Ver transmisión':'Voir la transmission'),
  qa(tr('q_cost','Combien cela peut-il coûter en plus ?'),tr('q_cost_a','La Bête calcule des scénarios conditionnels à partir des données disponibles. Ce ne sont pas des prédictions : ils servent à voir l’ordre de grandeur selon les taux.'),'#/analyse',uiLocale==='en'?'Test scenarios':uiLocale==='es'?'Probar escenarios':'Tester les scénarios'),
  qa(tr('q_sources','D’où viennent les chiffres ?'),tr('q_sources_a','Chaque valeur importante est reliée à une source et à une date. Quand une source manque ou vieillit, La Bête le signale au lieu de compléter au hasard.'),'#/univers/preuves',uiLocale==='en'?'See sources':uiLocale==='es'?'Ver fuentes':'Voir les sources'),
  qa(tr('q_known','Qu’est-ce qu’on sait vraiment aujourd’hui ?'),fill(tr('q_known_a','{warnings} source(s) demandent actuellement de l’attention. Les faits observés, les calculs et les hypothèses restent séparés.'),{warnings}),'#/public',uiLocale==='en'?'What is established':uiLocale==='es'?'Qué está establecido':'Voir ce qui est établi'),
  qa(tr('q_ask','Puis-je poser ma propre question ?'),tr('q_ask_a','Oui. Le dialogue reprend le contexte de la page où vous êtes, sans transformer votre question en preuve ni en décision.'),null)
 );
 const ask=button(tr('ask','Poser ma question'),()=>openChat(),'muPrimary');grid.append(ask);return grid;
}
function phiRewardLabel(r){
 const en={verified_official_source:'Add a verified official source',material_correction:'Correct a demonstrated error',verified_translation:'Translate a page with review',local_language:'Document a local word or variant with context',heritage_story:'Add sourced heritage, skills or local memory',accessibility:'Improve accessibility or clarity',local_place_event:'Add a verifiable local place or event'};
 const es={verified_official_source:'Añadir una fuente oficial verificada',material_correction:'Corregir un error demostrado',verified_translation:'Traducir una ficha con revisión',local_language:'Documentar una palabra o variante local con contexto',heritage_story:'Añadir patrimonio, saber hacer o memoria local con fuente',accessibility:'Mejorar accesibilidad o claridad',local_place_event:'Añadir un lugar o evento local verificable'};
 return uiLocale==='en'?(en[r.id]||r.label):uiLocale==='es'?(es[r.id]||r.label):r.label;
}
function storySlotLabel(slot){
 const en={places:'Places that matter',heritage:'Heritage & memory',languages:'Languages & expressions',know_how:'Skills & crafts',people:'People & local stories',events:'Events & traditions',nature:'Landscapes, nature & risks',initiatives:'Useful initiatives today'};
 const es={places:'Lugares que importan',heritage:'Patrimonio y memoria',languages:'Lenguas y expresiones',know_how:'Saberes y oficios',people:'Personas y relatos locales',events:'Eventos y tradiciones',nature:'Paisajes, naturaleza y riesgos',initiatives:'Iniciativas útiles hoy'};
 return uiLocale==='en'?(en[slot.id]||slot.label):uiLocale==='es'?(es[slot.id]||slot.label):slot.label;
}
function questLabel(q){
 const en={language_context:'Document the local language context',local_expressions:'Document 5 local expressions',heritage_memory:'Source 3 heritage or memory items',know_how:'Tell 3 local skills or trades',people_stories:'Document 3 people or local stories',events_traditions:'Source 3 events or traditions',nature_risks:'Document 3 landscapes, environments or risks',local_initiatives:'Identify 3 useful local initiatives',translations:'Translate and review 2 languages',accessibility:'Validate 2 clarity or accessibility improvements'};
 const es={language_context:'Documentar el contexto lingüístico local',local_expressions:'Documentar 5 expresiones locales',heritage_memory:'Aportar fuentes para 3 elementos de patrimonio o memoria',know_how:'Contar 3 saberes u oficios locales',people_stories:'Documentar 3 personas o relatos locales',events_traditions:'Aportar fuentes para 3 eventos o tradiciones',nature_risks:'Documentar 3 paisajes, medios o riesgos',local_initiatives:'Identificar 3 iniciativas locales útiles',translations:'Traducir y revisar 2 idiomas',accessibility:'Validar 2 mejoras de claridad o accesibilidad'};
 return uiLocale==='en'?(en[q.id]||q.label):uiLocale==='es'?(es[q.id]||q.label):q.label;
}
function questContributionURL(dep,quest){
 return 'https://github.com/Nicolason84/nova-trust/issues/new?template=territory-contribution.yml&title='+encodeURIComponent('[TERRITOIRE '+dep+'][QUEST '+quest.id+'] ');
}
function territoryQuestPanel(code){
 const t=territoryQuests?.territories?.[code];if(!t)return null;
 const box=el('section',undefined,'muQuestPanel');
 const head=el('div',undefined,'muQuestHead');
 const titleText=uiLocale==='en'?'Φ TERRITORY QUESTS':uiLocale==='es'?'Φ MISIONES TERRITORIALES':'Φ TERRITORY QUESTS';
 const scoreLabel=uiLocale==='en'?'verified documentation':uiLocale==='es'?'documentación verificada':'documentation vérifiée';
 append(head,append(el('div'),el('div',titleText,'muEyebrow'),el('h2',t.name+' · '+t.documentation_score_pct+' % '+scoreLabel)),el('strong',t.community_phi_awarded+' Φ','muQuestPhi'));
 box.append(head);
 const bar=el('div',undefined,'muQuestProgress');const fillBar=el('span',undefined,'muQuestProgressFill');fillBar.style.width=Math.max(0,Math.min(100,t.documentation_score_pct))+'%';bar.append(fillBar);box.append(bar);
 box.append(el('p',uiLocale==='en'?'This percentage measures verified local documentation only — never wealth, population, economic performance or political value.':uiLocale==='es'?'Este porcentaje mide únicamente documentación local verificada: nunca riqueza, población, rendimiento económico ni valor político.':'Ce pourcentage mesure uniquement la documentation locale vérifiée — jamais la richesse, la population, la performance économique ou la valeur politique.','muGuard'));
 const grid=el('div',undefined,'muQuestGrid');
 for(const q of t.quests){
   const card=el('article',undefined,'muQuestCard '+(q.state==='COMPLETE'?'isComplete':'isOpen'));
   const badge=q.state==='COMPLETE'?(uiLocale==='en'?'Complete':uiLocale==='es'?'Completada':'Terminée'):(q.remaining_items+' '+(uiLocale==='en'?'left':uiLocale==='es'?'pendiente(s)':'à documenter'));
   append(card,el('span',badge,'muQuestState'),el('h3',questLabel(q)),el('p',q.verified_items+' / '+q.target+' · '+q.completion_pct+' %'),el('small','+'+q.phi_per_item+' Φ / '+(uiLocale==='en'?'verified item':uiLocale==='es'?'elemento verificado':'élément vérifié')));
   if(q.state!=='COMPLETE')card.append(link(uiLocale==='en'?'Contribute ↗':uiLocale==='es'?'Contribuir ↗':'Contribuer ↗',questContributionURL(code,q),'muQuestionLink'));
   grid.append(card);
 }
 box.append(grid);
 const foot=el('p',(uiLocale==='en'?'Community verified contributions: ':uiLocale==='es'?'Contribuciones comunitarias verificadas: ':'Contributions communautaires vérifiées : ')+t.community_verified_items+' · '+t.community_phi_awarded+' Φ','muFineprint');box.append(foot);
 return box;
}
function territoryProgressBoard(){
 if(!territoryQuests)return null;
 const box=el('section',undefined,'muTerritoryBoard'),rows=territoryQuests.progress_board||[];
 append(box,el('div','Φ · PROGRESSION NATIONALE','muEyebrow'),el('h2',uiLocale==='en'?'Which territories are being documented?':uiLocale==='es'?'¿Qué territorios se están documentando?':'Quels territoires sont en train d’être documentés ?'),el('p',uiLocale==='en'?'This is a documentation progress board, not a ranking of territories. A higher score means more local knowledge has been verified.':uiLocale==='es'?'Es un tablero de avance documental, no una clasificación de territorios. Un porcentaje más alto significa que se ha verificado más conocimiento local.':'C’est un tableau de progression documentaire, pas un classement de la valeur des territoires. Un score plus élevé signifie seulement que davantage de connaissances locales ont été vérifiées.','muGuard'));
 const grid=el('div',undefined,'muTerritoryBoardGrid');
 for(const x of rows.slice(0,12)){const a=link('',M.route('objet',M.TOPO+'#/departments/'+x.code),'muTerritoryBoardCard');append(a,el('strong',x.name),el('span',x.documentation_score_pct+' %'),el('small',x.community_verified_items+' contributions · '+x.community_phi_awarded+' Φ'));grid.append(a);}
 box.append(grid);return box;
}
function phiPanel(departmentCode=null){
 if(!phiPolicy)return null;
 const box=el('section',undefined,'muPhiPanel');
 const top=append(el('div',undefined,'muPhiTop'),el('span','Φ','muPhiSymbol'),append(el('div'),el('h2',tr('phi_title','Φ Coins · récompenser la connaissance locale utile')),el('p',tr('phi_sub','Les Φ sont des points civiques non monétaires et non transférables. Ils ne sont attribués qu’après vérification d’une contribution.'))));
 box.append(top);
 const rewards=el('div',undefined,'muPhiRewards');for(const r of (phiPolicy.rewards||[]).slice(0,5)){const c=el('div',undefined,'muPhiReward');append(c,el('strong','+'+r.phi+' Φ'),el('span',phiRewardLabel(r)));rewards.append(c);}box.append(rewards);
 box.append(el('p',uiLocale==='en'?'No wallet, no purchase, no transfer and no cash value in V1.':uiLocale==='es'?'En V1 no hay monedero, compra, transferencia ni valor en efectivo.':'V1 : aucun wallet, aucun achat, aucun transfert et aucune valeur en espèces.','muFineprint'));
 const url='https://github.com/Nicolason84/nova-trust/issues/new?template=territory-contribution.yml'+(departmentCode?'&title='+encodeURIComponent('[TERRITOIRE '+departmentCode+'] '):'');
 box.append(link(tr('contribute',departmentCode?'Contribuer à ce département':'Contribuer à un territoire')+' ↗',url,'muPrimary'));return box;
}
function humanHybrid(kind,h,g){
 const publicModel=h.public_common_good||{},coop=h.cooperative_direction||{},privateModel=h.private_services||{},auto=h.autoevolution||{},acq=g.evolution?.self_model?.acquisition||{};
 const dem=coop.democracy||{},privacy=dem.production_privacy_gate||{},membership=dem.membership||{},truth=dem.truth_firewall||{},b=coop.institutional_blueprint||{};
 const detailed=audienceMode==='explain';
 const list=(heading,items)=>{const section=el('section',undefined,'muObjectMain');section.append(el('h2',heading,'muSubhead'));const ul=el('ul',undefined,'muSteps');(items||[]).forEach(x=>ul.append(el('li',x)));section.append(ul);return section;};
 if(kind==='public'){
  title('POUR TOUT LE MONDE','Est-ce que La Bête est gratuite ?','Oui pour comprendre les informations publiques, vérifier les sources et poser des questions. Les services privés éventuels restent séparés.');
  const grid=el('section',undefined,'muQuestionGrid');append(grid,
   qa('Faut-il payer pour voir les faits et les sources ?',publicModel.paywall===false?'Non. Le noyau public est conçu pour rester accessible sans abonnement.':'Ce point n’est pas encore vérifié.'),
   qa('Quelqu’un peut-il payer pour “acheter” une vérité ?',publicModel.saleable_public_truth===false?'Non. Un client, un sponsor ou un financeur ne peut pas acheter un fait, un classement ou une conclusion.':'Ce garde-fou n’est pas vérifié.'),
   qa('Puis-je vérifier par moi-même ?','Oui. Les sources, les dates et les limites doivent rester consultables, y compris quand elles contredisent une lecture confortable.','#/univers/preuves','Voir les preuves'),
   qa('Puis-je participer ?','Oui : vous pouvez questionner, proposer une correction ou ouvrir une discussion. Une proposition ne devient jamais automatiquement une preuve.','#/univers/idees','Participer')
  );stage.append(grid);
  if(detailed)stage.append(list('Ce que le bien commun public comprend',publicModel.scope));
  return true;
 }
 if(kind==='agir'){
  title('FAIRE UNE DÉMARCHE','La Bête peut-elle agir à ma place ?','Elle peut préparer et vérifier. Elle ne doit pas vous représenter, envoyer ou engager quelque chose en votre nom sans autorisation adaptée.');
  const req=(acq.requests||[]).length,init=(acq.initiatives||[]).length;
  const grid=el('section',undefined,'muQuestionGrid');append(grid,
   qa('Que peut-elle faire seule ?','Repérer une information manquante, rassembler les faits, préparer un dossier ou un brouillon et proposer l’étape suivante.'),
   qa('Peut-elle envoyer un message sans me demander ?', 'Non par défaut. Un envoi ou une représentation extérieure exige un mandat et un destinataire vérifiés.'),
   qa('Y a-t-il déjà quelque chose de prêt ?',req+' démarche(s) d’information et '+init+' initiative(s) sont actuellement préparées ou documentées.','#/univers/demarches','Voir les démarches'),
   qa('Comment savoir si ça a vraiment marché ?','Un brouillon ou un mail envoyé ne suffit pas : le résultat utile doit être observé et vérifié.')
  );stage.append(grid);
  if(detailed)stage.append(list('Étapes normales',['Besoin ou manque documenté','Faits et contradictions','Préparation de l’action','Autorisation si nécessaire','Réponse réelle','Résultat vérifié ou blocage clair']));
  return true;
 }
 if(kind==='services'){
  title('AIDE PERSONNALISÉE','Dois-je payer pour utiliser La Bête ?','Non pour le bien commun public. Des services privés plus poussés sont envisagés séparément, mais ils ne sont pas ouverts à la vente ici.');
  const grid=el('section',undefined,'muQuestionGrid');append(grid,
   qa('Qu’est-ce qui resterait toujours gratuit ?','Les informations publiques, leurs sources, leurs limites et les outils de participation.'),
   qa('À quoi serviraient des services privés ?','À traiter un dossier personnel ou professionnel avec plus d’accompagnement, sans déplacer les faits publics derrière un paywall.'),
   qa('Puis-je déjà acheter un service ?',privateModel.payment==='NOT_CONNECTED'?'Non. Aucun paiement ni onboarding commercial n’est activé sur cette page.':'L’état commercial doit être revérifié.'),
   qa('Mes documents privés sont-ils envoyés sur cette page ?',privateModel.real_private_documents==='NOT_ACCEPTED_ON_PUBLIC_ORIGIN'?'Non. La page publique n’accepte pas vos documents privés.':'Cette frontière doit être revérifiée.','#/prive','Voir la frontière privée')
  );stage.append(grid);return true;
 }
 if(kind==='scic'){
  title('DÉCIDER ENSEMBLE','Peut-on voter ici, aujourd’hui ?','Non. Le système de décision est testé, mais aucun vrai scrutin de sociétaires n’est ouvert tant que la structure, les membres et les protections externes ne sont pas prêts.');
  const privacyClosed=privacy.production_activation===false;
  const grid=el('section',undefined,'muQuestionGrid');append(grid,
   qa('Puis-je voter maintenant ?',membership.real_enrollment_open===false?'Non. Il n’y a pas encore d’inscription réelle de sociétaires ni de vote juridiquement contraignant.':'L’ouverture réelle n’est pas vérifiée.'),
   qa('Mon identité serait-elle publiée avec mon vote ?','Non par conception : l’identité sert à vérifier le droit de participer, puis le vote doit rester séparé de cette identité. Les tests actuels utilisent des données synthétiques, pas de vraies personnes.'),
   qa('Une majorité peut-elle décider qu’un fait est vrai ?',truth.ballot_may_change_evidence===false?'Non. On peut voter sur une action, une règle ou une priorité ; pas transformer une hypothèse en fait ni effacer une preuve.':'Ce garde-fou doit être revérifié.'),
   qa('Qui aurait le pouvoir ?',(b.colleges||[]).length+' groupes de sociétaires sont proposés pour éviter qu’un seul acteur contrôle tout. Le capital ne doit pas acheter davantage de voix.'),
   qa('Pourquoi le vote réel reste-t-il fermé ?',privacyClosed?'Parce qu’il manque encore des preuves externes indépendantes : séparation réelle des opérateurs, protection matérielle des clés, revue sécurité/vie privée et cadre juridique final.':'Le niveau de protection production doit être revérifié.'),
   qa('Qu’est-ce qui est déjà démontré ?','Le parcours de vote secret, la séparation identité/vote, la prévention du double vote et le comptage par groupes ont été testés. Cela démontre le mécanisme, pas encore un scrutin réel.')
  );stage.append(grid);
  if(detailed){
   stage.append(list('Comment ça fonctionnerait concrètement',['1. Vérifier qu’une personne a le droit de participer, sans publier son identité.','2. Lui donner un droit de vote à usage unique sans inscrire son nom dans le bulletin.','3. Faire passer le bulletin par une infrastructure séparée pour réduire les liens techniques avec la personne.','4. Attendre un groupe suffisant de bulletins avant publication pour réduire les recoupements temporels.','5. Publier uniquement des résultats agrégés et vérifiables.']));
   stage.append(list('Ce qu’il manque avant un vrai scrutin',['Constituer juridiquement la SCIC et adopter ses règles.','Admettre de vrais sociétaires selon des critères vérifiés.','Faire opérer le relais réseau par une entité indépendante.','Protéger les clés de signature dans du matériel dédié avec double contrôle.','Faire auditer le protocole et le modèle de menace par des tiers indépendants.','Fixer les paramètres d’anonymat après cette revue, pas avant.']));
   if((b.colleges||[]).length)stage.append(list('Les groupes proposés',(b.colleges||[]).map(x=>x.label+' · '+x.vote_weight_pct+' % · '+x.purpose)));
  }
  return true;
 }
 return false;
}
function atlas(g){
 if(audienceMode==='simple')title(tr('atlas_kicker','COMMENCER PAR UNE QUESTION'),tr('atlas_title','Qu’est-ce que vous voulez comprendre ?'),tr('atlas_sub','Pas besoin de connaître le jargon : partez d’une question concrète, puis ouvrez les sources si vous voulez aller plus loin.'));
 else if(audienceMode==='explain')title(uiLocale==='en'?'UNDERSTAND BEFORE CONCLUDING':uiLocale==='es'?'COMPRENDER ANTES DE CONCLUIR':'COMPRENDRE AVANT DE CONCLURE',uiLocale==='en'?'La Bête, explained.':uiLocale==='es'?'La Bête, explicada.':'La Bête, expliquée.',uiLocale==='en'?'The same data and evidence, with more context and without starting from implementation jargon.':uiLocale==='es'?'Los mismos datos y pruebas, con más contexto y sin empezar por la jerga técnica.':'Les mêmes données et les mêmes preuves, avec davantage de contexte mais sans entrer d’emblée dans les détails techniques.');
 else title('LA BÊTE · AU CŒUR DES UNIVERS','La Bête.','Défendre les intérêts des personnes : comprendre, vérifier, faire entendre et agir sous mandat.');
 const map=el('div',undefined,'muAtlas muAtlasWithPresence');map.id='muAtlas';map.setAttribute('aria-label','La Bête au centre des univers explorables');
 const hero=el('section',undefined,'muAtlasPresence');hero.id='muAtlasPresence';hero.setAttribute('aria-label','Présence principale de La Bête');
 const scene=el('div',undefined,'muAtlasScene');scene.id='muAtlasScene';
 if(!mountExisting('beastStage',scene))throw Error('EXISTING_BEAST_STAGE_REQUIRED');
 const caption=el('p','Scène existante · représentation artistique · son et caméra désactivés au départ','muPresenceCaption');
 const actions=el('div',undefined,'muPresenceActions');
 const center=link('',M.route('objet',M.COUNTRY),'muAtlasCore');append(center,el('span','OBJET EXPLORÉ'),el('strong','France'),el('small','Entrer ↗'));
 append(actions,center,link('Immersion & détails','#/presence','muPresenceDetail'));
 append(hero,scene,caption,actions);map.append(hero);
 M.UNIVERSES.forEach((u,i)=>{const a=link('',M.route('univers',u.id),'muUniverse muUniverse-'+i);const count=[...g.nodes.values()].filter(n=>n.universe===u.id).length;const label=u.id==='temps'?g.live.curve_history?.length+' observations':u.id==='idees'?'Dialogue & propositions':u.id==='etat'?'Mémoire opérationnelle':u.id==='territoires'?(g.detail?g.detail.counts.communes_cog+' communes référencées':'Territoires · détail à la demande'):count+' objets documentés';append(a,el('span',u.symbol,'muSymbol'),el('strong',u.label),el('small',u.subtitle),el('span',label,'muUniverseCount'));map.append(a);});
 stage.append(map);
 if(audienceMode!=='expert')stage.append(questionHub(g));
 const phi=phiPanel();if(phi)stage.append(phi);
 // One existing canvas, one initialization. Atlas is now itself a visible presence route.
 window.laBeteEnsurePresence?.();
 if(g.nodes.has('LA_BETE_CIVIC_MISSION_V1')){const mission=el('div',undefined,'muCivicMission');append(mission,el('strong','Au service des personnes. Sans consigne politique.'),link('Mission, limites et engagements',M.route('objet','LA_BETE_CIVIC_MISSION_V1')));stage.append(mission);}
 const access=el('div',undefined,'muAccessShortcuts');access.id='muAccessShortcuts';append(access,link('Comprendre · toujours gratuit','#/public'),link('Faire une démarche','#/agir'),link('Décider ensemble','#/scic'),link('Aide personnalisée · optionnelle','#/services'),link('Mes données · protégées','#/prive'),link('Sur mobile','#/mobile'));stage.append(access);
 const path=el('div',undefined,'muSuggested');append(path,el('div','UN PREMIER PARCOURS','muEyebrow'),el('p','France → finances publiques → dette → source → manque → démarche'),link('Commencer par la France',M.route('objet',M.COUNTRY),'muPrimary'));stage.append(path);
 stage.append(el('p','La présence visuelle suit le scénario et le flux existants. Ni ses mouvements ni la position des univers ne constituent une opinion ou une causalité politique.','muFineprint'));
}

function hybridView(kind,g){
 const h=g.evolution?.self_model?.hybrid_model;
 if(!h||h.source_snapshot_id!==g.source_snapshot_id){
  title('MODÈLE HYBRIDE NON LIÉ','Cette vue attend le même instantané vérifié.','Aucun statut SCIC, service ou prix de remplacement n’est inventé.');
  return;
 }
 if(audienceMode!=='expert'){humanHybrid(kind,h,g);return;}
 const publicModel=h.public_common_good||{},coop=h.cooperative_direction||{},privateModel=h.private_services||{},bridge=h.economic_bridge||{},auto=h.autoevolution||{},acq=g.evolution?.self_model?.acquisition||{};
 const info=(label,value)=>{const row=el('div',undefined,'muObjectCard');append(row,el('span',label,'muCardType'),el('strong',value));return row;};
 const list=(heading,items)=>{const section=el('section',undefined,'muObjectMain');section.append(el('h2',heading,'muSubhead'));const ul=el('ul',undefined,'muSteps');(items||[]).forEach(x=>ul.append(el('li',x)));section.append(ul);return section;};
 const cards=(items)=>{const grid=el('div',undefined,'muCards');items.forEach(x=>grid.append(info(x[0],x[1])));stage.append(grid);};

 if(kind==='public'){
  title('BIEN COMMUN PUBLIC · GRATUIT','Comprendre, vérifier, participer.','Les faits publics, leurs sources, leurs limites et les outils de participation restent accessibles sans acheter un service privé.');
  cards([['ACCÈS',publicModel.access||'UNKNOWN'],['PAYWALL',publicModel.paywall===false?'AUCUN':'NON VÉRIFIÉ'],['VÉRITÉ PUBLIQUE VENDABLE',publicModel.saleable_public_truth===false?'NON':'NON VÉRIFIÉ'],['INFLUENCE POLITIQUE VENDABLE',publicModel.saleable_political_influence===false?'NON':'NON VÉRIFIÉ']]);
  stage.append(list('Ce qui reste dans le bien commun',publicModel.scope));
  const actions=el('div',undefined,'muActions');append(actions,link('Explorer l’Atlas','#/atlas','muPrimary'),link('Voir les preuves','#/univers/preuves'),link('Proposer / questionner','#/univers/idees'));stage.append(actions);
  stage.append(el('p','Aucun chiffre d’affaires ne peut acheter une vérité, un classement ou une recommandation politique.','muFineprint'));
 }else if(kind==='agir'){
  title('AGIR · SOUS MANDAT','Du fait vérifié à une démarche traçable.','La Bête peut détecter un manque, préparer un dossier et proposer l’étape suivante. L’envoi, la représentation et les données privées restent sous autorisation explicite.');
  const mission=acq.civic_mission||{},requests=acq.requests||[],initiatives=acq.initiatives||[],next=auto.next_best_move||{};
  cards([['DÉMARCHES PUBLIQUES PRÉPARÉES',String(requests.length)],['INITIATIVES EN PRÉPARATION',String(initiatives.length)],['ACTION EXTÉRIEURE',acq.execution||'NOT_CONNECTED'],['PROCHAIN MOUVEMENT AUTOÉVOLUTIF',next.state||'NONE']]);
  stage.append(list('Chaîne civique',mission.workflow));
  if(next.action)stage.append(list('Proposition actuelle de La Bête',[next.reason,next.action,'Cette proposition ne vaut ni mandat ni exécution.']));
  const actions=el('div',undefined,'muActions');append(actions,link('Ouvrir les démarches','#/univers/demarches','muPrimary'),link('Voir l’espace privé avant mandat','#/prive'));stage.append(actions);
 }else if(kind==='scic'){
  const b=coop.institutional_blueprint||{},dem=coop.democracy||{},pilot=dem.pilot||{},truth=dem.truth_firewall||{},ballot=dem.ballot_protocol||{},privacy=dem.production_privacy_gate||{};
  title('SCIC · DÉMOCRATIE OPÉRABLE','Délibérer, décider, mandater, vérifier.','La mécanique démocratique fonctionne en mode pré-constitution non contraignant. Aucun vote réel de sociétaire ni effet juridique n’est revendiqué tant que la SCIC, ses membres et ses statuts ne sont pas vérifiés.');
  cards([['ÉTAT JURIDIQUE',coop.state||'UNKNOWN'],['DESIGN INSTITUTIONNEL',b.state||'UNKNOWN'],['EFFET JURIDIQUE',b.binding_effect===false?'AUCUN':'NON VÉRIFIÉ'],['PONT ÉCONOMIQUE',bridge.state||'UNKNOWN']]);
  stage.append(list('Mission coopérative',[coop.mission,coop.governance_direction].filter(Boolean)));
  cards([['DÉMOCRATIE',dem.state||'UNKNOWN'],['EFFET DU SCRUTIN',dem.binding_effect===false?'NON CONTRAIGNANT':'NON VÉRIFIÉ'],['SOCIÉTAIRES JURIDIQUES',String(dem.membership?.current_legal_societaires??'UNKNOWN')],['SECOND REGISTRE',dem.second_registry===false?'NON':'NON VÉRIFIÉ']]);
  stage.append(list('Pare-feu de vérité',[
   'Principe : '+(truth.principle||'UNKNOWN'),
   'Peut être voté : '+(truth.votable_classes||[]).join(' · '),
   'Ne peut jamais être voté : '+(truth.never_votable_classes||[]).join(' · '),
   'Correction des preuves : '+(truth.evidence_correction_route||'UNKNOWN'),
   'Un amendement peut changer une preuve : '+(truth.amendment_may_change_evidence===false?'NON':'NON VÉRIFIÉ')
  ]));
  stage.append(list('Cycle démocratique',(dem.lifecycle||[]).map(x=>x.order+'. '+x.label+' — '+x.state+' — gate '+x.gate)));
  stage.append(list('Sociétariat vérifié · frontière privée',[
   'Pilote : '+(dem.membership?.pilot_state||'UNKNOWN'),
   'Inscription réelle ouverte : '+(dem.membership?.real_enrollment_open===false?'NON':'NON VÉRIFIÉ'),
   'Identité : '+(dem.membership?.identity_verification||'UNKNOWN'),
   'Éligibilité : '+(dem.membership?.eligibility_verification||'UNKNOWN'),
   'Admission : '+(dem.membership?.admission_authority||'UNKNOWN'),
   'Identité publique : '+(dem.membership?.public_identity||'UNKNOWN'),
   'Champs publics permis : '+(dem.membership?.public_receipt_fields||[]).join(' · '),
   'Jamais publics : '+(dem.membership?.public_receipt_forbidden_fields||[]).join(' · ')
  ]));
  stage.append(list('Règles de scrutin',[
   'Une personne = une voix dans son collège : '+(dem.membership?.one_member_one_vote_within_college===true?'OUI':'NON VÉRIFIÉ'),
   'Vote réel : secret ; publication : agrégée par collège.',
   'Décision ordinaire : > '+(ballot.ordinary?.support_pct??'UNKNOWN')+' % pondéré, '+(ballot.ordinary?.positive_colleges??'UNKNOWN')+' collèges favorables minimum, quorum '+(ballot.ordinary?.college_quorum_pct??'UNKNOWN')+' % par collège.',
   'Décision constitutionnelle : ≥ '+(ballot.constitutional?.support_pct??'UNKNOWN')+' % pondéré, '+(ballot.constitutional?.positive_colleges??'UNKNOWN')+' collèges favorables minimum, quorum '+(ballot.constitutional?.college_quorum_pct??'UNKNOWN')+' %.',
   'Les engagements protégés sont surmontables par bulletin : '+(ballot.protected_commitments_overrideable_by_ballot===false?'NON':'NON VÉRIFIÉ'),
   'Identité/pseudonyme dans le bulletin : '+(ballot.member_public_id_in_ballot===false?'NON':'NON VÉRIFIÉ'),
   'Jeton privé à usage unique : '+(ballot.one_time_private_ballot_token===true?'OUI':'NON VÉRIFIÉ'),
   'Secret vis-à-vis du registre public : '+(ballot.public_registry_unlinkability||'UNKNOWN'),
   'Unlinkability cryptographique transcript → bulletin : '+(ballot.issuer_level_cryptographic_unlinkability||'UNKNOWN'),
   'Unlinkability métadonnées émetteur → urne : '+(ballot.issuer_level_metadata_unlinkability||'UNKNOWN')
  ]));
  const anon=ballot.anonymous_credential||{};
  stage.append(list('Credential anonyme · séparation émetteur / urne',[
   'État : '+(anon.state||'UNKNOWN'),
   'Activation production : '+(anon.production_activation===false?'NON':'NON VÉRIFIÉ'),
   'Architecture : '+(anon.architecture||[]).join(' → '),
   'Processus séparés prouvés : '+(anon.separate_processes_proven===true?'OUI':'NON VÉRIFIÉ'),
   'Stockages séparés prouvés : '+(anon.separate_stores_proven===true?'OUI':'NON VÉRIFIÉ'),
   'L’Issuer reçoit l’identité : '+(anon.issuer_receives_member_identity===false?'NON':'NON VÉRIFIÉ'),
   'L’Issuer reçoit le pseudonyme public : '+(anon.issuer_receives_member_public_id===false?'NON':'NON VÉRIFIÉ'),
   'L’Issuer reçoit le serial final : '+(anon.issuer_receives_ballot_serial===false?'NON':'NON VÉRIFIÉ'),
   'L’urne reçoit l’entitlement : '+(anon.ballot_box_receives_entitlement===false?'NON':'NON VÉRIFIÉ'),
   'Preuve transcript↔token : '+(anon.transcript_token_matching||'UNKNOWN'),
   'Matrice de compatibilité : '+(anon.compatibility_matrix||'UNKNOWN'),
   'Ensemble d’anonymat même collège prouvé : '+String(anon.same_college_anonymity_set_proven??'UNKNOWN'),
   'Schéma de preuve : '+(anon.scheme||'UNKNOWN'),
   'Conformité RFC 9474 revendiquée : '+(anon.rfc9474_conformance===false?'NON':'NON VÉRIFIÉ'),
   'Risque restant : '+(anon.metadata_unlinkability||'UNKNOWN'),
   'Révocation après émission : '+(anon.revocation_model||'UNKNOWN')
  ]));
  cards([['PRIMITIVE RFC',privacy.cryptographic_gate?.state||'UNKNOWN'],['BINDING RUNTIME',privacy.cryptographic_gate?.runtime_binding||'UNKNOWN'],['RÉSEAU OHTTP',privacy.network_gate?.state||'UNKNOWN'],['PRODUCTION',privacy.production_activation===false?'BLOQUÉE':'NON VÉRIFIÉE']]);
  stage.append(list('Production Privacy Gate · fail-closed',[
   'Verdict : '+(privacy.current_verdict||'UNKNOWN'),
   'Backend standard : '+(privacy.cryptographic_gate?.backend||'UNKNOWN')+' '+(privacy.cryptographic_gate?.backend_version||''),
   'Profil RFC9578 : '+(privacy.cryptographic_gate?.profile||'UNKNOWN'),
   'Variante RFC9474 : '+(privacy.cryptographic_gate?.variant||'UNKNOWN'),
   'CI primitive : '+(privacy.cryptographic_gate?.project_ci||'UNKNOWN')+' · vecteurs upstream : '+(privacy.cryptographic_gate?.upstream_rfc9474_vectors||'UNKNOWN')+' · cross-check RSA-PSS : '+(privacy.cryptographic_gate?.standard_rsa_pss_crosscheck||'UNKNOWN'),
   'Binding CIRCL au runtime : '+(privacy.cryptographic_gate?.runtime_binding||'UNKNOWN'),
   'Runtime OHTTP : '+(privacy.network_gate?.runtime_binding||'UNKNOWN')+' · backend '+(privacy.network_gate?.backend||'UNKNOWN')+' '+(privacy.network_gate?.backend_version||''),
   'Binary HTTP : '+(privacy.network_gate?.bhttp_profile||'UNKNOWN')+' · '+(privacy.network_gate?.bhttp_validation||'UNKNOWN'),
   'TLS local deux hops : '+(privacy.network_gate?.local_https_transport||'UNKNOWN'),
   'Minimisation headers relay : '+(privacy.network_gate?.local_header_minimization||'UNKNOWN'),
   'Contexte HPKE frais : '+(privacy.network_gate?.fresh_hpke_context_per_request||'UNKNOWN'),
   'Endpoints TLS publics : '+(privacy.network_gate?.public_tls_endpoints||'UNKNOWN'),
   'Opérateur relay indépendant : '+(privacy.network_gate?.independent_operator||'UNKNOWN'),
   'Relay voit le plaintext sonde : '+(privacy.network_gate?.relay_plaintext_probe===false?'NON':'NON VÉRIFIÉ'),
   'Déploiement réseau : '+(privacy.network_gate?.state||'UNKNOWN'),
   'Relais réseau cible : '+(privacy.network_gate?.profile||'UNKNOWN'),
   'Relais et gateway même opérateur autorisés : '+(privacy.network_gate?.relay_gateway_same_operator_allowed===false?'NON':'NON VÉRIFIÉ'),
   'Batching : '+(privacy.anonymity_gate?.mechanism||'UNKNOWN')+' · '+(privacy.anonymity_gate?.runtime_binding||'UNKNOWN'),
   'Persistance batch après redémarrage : '+(privacy.anonymity_gate?.persistence_restart_proven===true?'PROUVÉE':'NON VÉRIFIÉE'),
   'Petit ensemble : '+(privacy.anonymity_gate?.small_set_behavior||privacy.anonymity_gate?.small_set_release||'UNKNOWN'),
   'Seuil de production : '+String(privacy.anonymity_gate?.production_minimum_set_size??'UNKNOWN'),
   'Fenêtre de production : '+String(privacy.anonymity_gate?.production_window_seconds??'UNKNOWN'),
   'Key custody : '+(privacy.key_gate?.state||'UNKNOWN')+' · provider '+(privacy.key_gate?.current_provider||'UNKNOWN')+' · verdict '+(privacy.key_gate?.custody_verdict||'UNKNOWN'),
   'Threat model interne : '+(privacy.review_gate?.internal_threat_model||'UNKNOWN'),
   'Audit pack : '+(privacy.review_gate?.audit_pack||'UNKNOWN'),
   'Audit cryptographique externe : '+(privacy.review_gate?.external_cryptographic_review||'UNKNOWN')
  ]));
  stage.append(list('Pourquoi la production reste fermée',privacy.blocking_reasons));
  stage.append(list('Standards de référence',privacy.standards));
  stage.append(list('Constitution protégée',b.protected_commitments));
  const colleges=el('section',undefined,'muObjectMain');colleges.append(el('h2','5 collèges proposés · 100 % des voix','muSubhead'));
  const collegeGrid=el('div',undefined,'muCards');for(const c of b.colleges||[]){const x=el('article',undefined,'muObjectCard');append(x,el('span',c.id,'muCardType'),el('strong',c.label+' · '+c.vote_weight_pct+' %'),el('small',c.purpose));collegeGrid.append(x);}colleges.append(collegeGrid);stage.append(colleges);
  const institutions=el('section',undefined,'muObjectMain');institutions.append(el('h2','Institutions proposées','muSubhead'));
  const institutionGrid=el('div',undefined,'muCards');for(const x of b.institutions||[]){const c=el('article',undefined,'muObjectCard');append(c,el('span',x.authority,'muCardType'),el('strong',x.label),el('small',x.role));institutionGrid.append(c);}institutions.append(institutionGrid);stage.append(institutions);
  const d=b.decision_constitution||{};
  stage.append(list('Règles de décision',[
   'Faits vérifiés : '+(d.verified_facts||'UNKNOWN'),
   'Décisions ordinaires : '+(d.ordinary_decisions||'UNKNOWN'),
   'Mission / constitution : '+(d.mission_or_constitutional_changes||'UNKNOWN'),
   'Sources et affirmations : '+(d.truth_source_or_claim_changes||'UNKNOWN'),
   'Action au nom d’une personne : '+(d.external_action_for_a_person||'UNKNOWN'),
   'Cadre commercial : '+(d.commercial_framework||'UNKNOWN')
  ]));
  stage.append(list('Anti-capture',b.anti_capture));
  const econ=b.economics||{};
  stage.append(list('Économie du bien commun',[
   'Noyau public : '+(econ.public_core||'UNKNOWN'),
   'Réserve statutaire minimale proposée comme garde légale : '+(econ.statutory_reserve_min_after_legal_reserve_pct??'UNKNOWN')+' % après réserve légale',
   'Services privés : '+(econ.private_services||'UNKNOWN'),
   'Pont commercial : '+(econ.commercial_bridge||'UNKNOWN'),
   'Contribution au bien commun : '+(econ.contribution_rate_to_common_good||'UNKNOWN'),
   'Contrôle exclusif de la vérité publique : '+(econ.exclusive_transfer_of_public_truth_control||'UNKNOWN')
  ]));
  stage.append(list('Transparence institutionnelle',b.transparency));
  if(pilot.id){
   const dry=el('section',undefined,'muObjectMain');dry.append(el('h2','Dossier pilote · chaîne complète sans faux vote réel','muSubhead'));
   append(dry,el('p',pilot.title,'muGuard'),el('p',pilot.problem,'muFineprint'));
   const pc=el('div',undefined,'muCards');append(pc,info('DÉCISION',pilot.decision?.state||'UNKNOWN'),info('EFFET JURIDIQUE',pilot.decision?.legal_effect||'UNKNOWN'),info('EXÉCUTION',pilot.execution?.state||'UNKNOWN'),info('RÉSULTAT',pilot.result?.state||'UNKNOWN'));dry.append(pc);
   dry.append(list('Débat fixture',[...(pilot.debate?.arguments_for||[]).map(x=>'POUR · '+x),...(pilot.debate?.arguments_against||[]).map(x=>'CONTRE · '+x),...(pilot.debate?.questions||[]).map(x=>'QUESTION · '+x)]));
   const tally=pilot.tally||{};dry.append(el('p','Scrutin de test — données synthétiques, aucune personne réelle : soutien pondéré '+(tally.weighted_support_pct??'UNKNOWN')+' % · '+(tally.positive_colleges??'UNKNOWN')+' collèges favorables.','muGuard'));
   const tg=el('div',undefined,'muCards');for(const row of tally.colleges||[]){const c=el('article',undefined,'muObjectCard');append(c,el('span',row.weight_pct+' % DU TOTAL','muCardType'),el('strong',row.label+' · '+row.support_pct+' % oui/non'),el('small','Participation '+row.turnout_pct+' % · '+row.yes+' oui · '+row.no+' non · '+row.abstain+' abst.'));tg.append(c);}dry.append(tg);
   dry.append(list('Mandat puis résultat',[
    'Le vote vaut exécution : '+(dem.decision_to_execution?.vote_is_execution===false?'NON':'NON VÉRIFIÉ'),
    'Mandat explicite requis : '+(dem.decision_to_execution?.mandate_required===true?'OUI':'NON VÉRIFIÉ'),
    'Action extérieure automatique : '+(dem.decision_to_execution?.automatic_external_action===false?'NON':'NON VÉRIFIÉ'),
    pilot.result?.outcome
   ].filter(Boolean)));
   stage.append(dry);
  }
  const ledger=dem.public_result_registry||[];stage.append(list('Registre public des résultats',ledger.map(x=>x.decision_id+' — '+x.decision_state+' → '+x.execution_state+' → '+x.result_state+' · binding '+x.binding)));
  const participation=el('div',undefined,'muActions');append(participation,link('Déposer une proposition publique ↗',dem.participation?.proposal_url||'https://github.com/Nicolason84/nova-trust/issues','muPrimary'),button('Dialoguer avant de proposer',()=>openChat()),button('Exporter le protocole démocratique',()=>download(dem,'la-bete-scic-democracy-v1.json')));stage.append(participation);
  stage.append(el('p','Une proposition GitHub ouvre un débat public ; elle ne crée ni sociétaire, ni vote contraignant, ni mandat. Le canal de vote réel restera fermé jusqu’à identité de sociétaire vérifiée et activation juridique.','muGuard'));
  stage.append(list('Chemin vers la SCIC réelle',(b.formation_path||[]).map(x=>x.step+'. '+x.label+' — '+x.state)));
  const law=el('section',undefined,'muObjectMain');law.append(el('h2','Ancrages juridiques à relire avant constitution','muSubhead'));
  for(const x of b.legal_basis||[]){const row=el('p',undefined,'muFineprint');append(row,el('strong',x.article+' — '),el('span',x.rule+' '),link('Légifrance ↗',x.url));law.append(row);}stage.append(law);
  stage.append(list('Séparation à préserver',h.separation_guards));
  if(bridge.principle)stage.append(list('Principe économique',[bridge.principle,'L’information publique reste gratuite : '+(bridge.public_information_remains_free===true?'OUI':'NON VÉRIFIÉ')]));
 }else if(kind==='services'){
  title('SERVICES PRIVÉS · OPTIONNELS','Aider davantage sans privatiser le bien commun.','Le catalogue est une architecture de service, pas une offre commerciale ouverte. Aucun prix, paiement ni onboarding citoyen n’est activé ici.');
  cards([['ÉTAT',privateModel.state||'UNKNOWN'],['ONBOARDING',privateModel.customer_onboarding||'UNKNOWN'],['PAIEMENT',privateModel.payment||'UNKNOWN'],['DONNÉES PRIVÉES SUR ORIGINE PUBLIQUE',privateModel.real_private_documents||'UNKNOWN']]);
  const grid=el('div',undefined,'muCards');for(const service of privateModel.families||[]){const c=el('article',undefined,'muObjectCard');append(c,el('span',service.id,'muCardType'),el('strong',service.label),el('small',service.scope));grid.append(c);}stage.append(grid);
  stage.append(list('Garde juridique',[privateModel.reserved_legal_acts,'Aucun acte réservé n’est revendiqué par cette couche. Un professionnel qualifié doit prendre le relais lorsque la matière l’exige.']));
  const actions=el('div',undefined,'muActions');append(actions,link('Voir la frontière de l’espace privé','#/prive','muPrimary'),link('Revenir au bien commun','#/public'));stage.append(actions);
 }
 const cadence=el('p','Autoévolution : '+(auto.engine||'UNKNOWN')+' · second runtime : '+(auto.second_runtime===false?'NON':'NON VÉRIFIÉ')+' · prochaine action : proposition seulement.','muSnapshot');stage.append(cadence);
}
function factTable(node,g){const dl=el('dl',undefined,'muFacts');for(const [k,v]of M.facts(node,g))append(dl,el('dt',k),el('dd',v));return dl;}
function territoryExternalURL(value){
 try{const u=new URL(value);const hosts=new Set(['commons.wikimedia.org','creativecommons.org','oise.fr','www.oisetourisme.com','archives.oise.fr']);return u.protocol==='https:'&&hosts.has(u.hostname)?u.href:null;}catch(_){return null;}
}
function territoryAsset(value){const v=String(value||'');return /^assets\/territory\/[a-z0-9/_\-.]+$/i.test(v)?v:null;}
function territoryMediaCard(item){
 const card=el('figure',undefined,'muTerritoryMediaCard'),asset=territoryAsset(item?.asset);if(!asset)return null;
 const img=el('img');img.src=asset;img.alt=item.label||'Image territoriale';img.loading='lazy';img.decoding='async';append(card,img);
 const cap=el('figcaption'),meta=el('span',(item.author||'Auteur à vérifier')+' · '+(item.license||'licence à vérifier'),'muFineprint');append(cap,el('strong',item.label||'Lieu documenté'),item.caption?el('span',item.caption):null,meta);
 const source=territoryExternalURL(item.source_page),license=territoryExternalURL(item.license_url);if(source)cap.append(link('Source image ↗',source,'muQuestionLink'));if(license)cap.append(link('Licence ↗',license,'muQuestionLink'));card.append(cap);return card;
}
function territorySoulPanel(code){
 const living=territoryLivingIdentity?.departments?.[code];if(!living)return null;
 const box=el('section',undefined,'muTerritorySoul');box.dataset.territoryState=living.state||'UNKNOWN';
 const identity=living.palette?.identity||{},modes=territoryLivingIdentity?.reading_modes||[];
 if(identity.state!=='VERIFIED_EDITORIAL_SYNTHESIS_FROM_SOURCED_MOTIFS'){
  append(box,el('div','IDENTITÉ LOCALE À SOURCER','muTerritoryEyebrow'),el('h2','Aucune couleur locale inventée.'),el('p','La structure est prête, mais les couleurs, images, lieux et initiatives restent ouverts aux preuves et contributions vérifiées.','muGuard'));
  const modeRow=el('div',undefined,'muTerritoryModes');for(const m of modes)modeRow.append(el('span',m.label));box.append(modeRow);return box;
 }
 const colors=identity.colors||[];const byId=Object.fromEntries(colors.map(x=>[x.id,x.hex]));for(const [key,value] of Object.entries({accent:byId.forest,stone:byId.stone,water:byId.water,mist:byId.mist,earth:byId.earth}))if(/^#[0-9A-Fa-f]{6}$/.test(String(value||'')))box.style.setProperty('--territory-'+key,value);
 const media=living.media?.items||[],hero=media.find(x=>x.id===living.media?.hero_media_id)||media[0];
 append(box,el('div','TERRITORY SOUL · IDENTITÉ SOURCÉE','muTerritoryEyebrow'));
 const modeRow=el('div',undefined,'muTerritoryModes');for(const m of modes)modeRow.append(el('span',m.label));box.append(modeRow);
 if(hero){const heroCard=territoryMediaCard(hero);if(heroCard){heroCard.classList.add('muTerritoryHero');box.append(heroCard);}}
 append(box,el('h2','Les couleurs et les lieux ne sont plus un décor.'),el('p','Cette identité visuelle est une synthèse éditoriale de motifs documentés. Elle reste distincte des couleurs officielles, de la météo réelle et de toute hiérarchie entre territoires.','muFineprint'));
 const palette=el('div',undefined,'muPaletteGrid');for(const c of colors){const sw=el('div',undefined,'muPaletteSwatch');if(/^#[0-9A-Fa-f]{6}$/.test(c.hex))sw.style.setProperty('--swatch',c.hex);append(sw,el('i'),el('span',c.label),el('small',c.hex));palette.append(sw);}box.append(palette);
 const others=media.filter(x=>x!==hero),gallery=el('div',undefined,'muTerritoryMediaGrid');for(const item of others){const card=territoryMediaCard(item);if(card)gallery.append(card);}if(gallery.children.length){append(box,el('h3','Images de présence et de culture'),gallery);}
 const makeCards=(titleText,items,kind)=>{if(!items?.length)return;const section=el('section',undefined,'muLivingSection');section.append(el('h3',titleText));const grid=el('div',undefined,'muLivingGrid');for(const item of items){const card=el('article',undefined,'muLivingCard');append(card,el('span',(item.family||kind||'LOCAL').replaceAll('_',' '),'muCardType'),el('strong',item.label),el('small',item.state||'À vérifier'));const u=territoryExternalURL(item.source);if(u)card.append(link('Vérifier la source ↗',u,'muQuestionLink'));grid.append(card);}section.append(grid);box.append(section);};
 makeCards('Explorer · points d’intérêt',living.points_of_interest,'lieu');
 makeCards('Vivre · communs utiles',living.commons_useful,'commun');
 makeCards('Construire · opportunités à valider',living.opportunities,'opportunité');
 const connections=living.connections||[];if(connections.length)makeCards('Relier · communes et usages partagés',connections,'relation');
 box.append(el('p','Une “opportunité” désigne ici une piste documentable ou contributive : elle ne prouve ni demande de marché, ni rentabilité, ni besoin économique.','muGuard'));
 return box;
}
function communeLivingPanel(node,g){
 const d=node.data||{},dep=territoryLivingIdentity?.departments?.[d.department_code],overlay=territoryLivingIdentity?.commune_overlays?.[d.code],box=el('section',undefined,'muCommuneLiving');
 append(box,el('div','COMMUNE VIVANTE','muTerritoryEyebrow'),el('h2','Ce qu’on peut faire, partager et mieux raconter ici.'));
 const mediaIds=new Set(overlay?.media_ids||[]),media=(dep?.media?.items||[]).filter(x=>mediaIds.has(x.id));if(media.length){const gallery=el('div',undefined,'muTerritoryMediaGrid');for(const item of media){const card=territoryMediaCard(item);if(card)gallery.append(card);}box.append(gallery);}
 const actionSection=el('section',undefined,'muLivingSection');actionSection.append(el('h3','Ce qu’on peut y faire'));const actions=el('div',undefined,'muLivingGrid');
 const rows=overlay?.things_to_do?.length?overlay.things_to_do:['Visiter','Se promener','Apprendre','Se rencontrer','Entreprendre','Participer'].map(label=>({label,state:'À DOCUMENTER LOCALEMENT'}));
 for(const item of rows){const c=el('article',undefined,'muLivingCard');append(c,el('strong',item.label),el('small',item.state));const u=territoryExternalURL(item.source);if(u)c.append(link('Source ↗',u,'muQuestionLink'));actions.append(c);}actionSection.append(actions);box.append(actionSection);
 const shared=el('section',undefined,'muLivingSection');shared.append(el('h3','Ce qu’elle partage avec d’autres communes'));const relations=el('div',undefined,'muLivingGrid');
 if(d.epci_code){const c=el('article',undefined,'muLivingCard');append(c,el('span','BASSIN DE VIE','muCardType'),el('strong','Intercommunalité '+d.epci_code),el('small','Relation administrative présente dans le référentiel chargé.'));relations.append(c);}
 for(const code of overlay?.shared_links||[]){const row=M.communeIndex(g.detail).get(code);if(!row)continue;const a=link('',M.route('objet',M.TOPO+'#/communes/'+code),'muLivingCard');append(a,el('span','LIEN LOCAL SOURCÉ','muCardType'),el('strong',row[1]),el('small','Explorer la relation documentée ↗'));relations.append(a);}
 if(!relations.children.length)relations.append(el('p','Aucune relation locale supplémentaire n’est encore documentée ici.','muFineprint'));shared.append(relations);box.append(shared);
 const gaps=territoryQuests?.territories?.[d.department_code]?.quests?.filter(x=>x.state!=='COMPLETE').slice(0,4)||[],missing=el('section',undefined,'muLivingSection');missing.append(el('h3','Ce qui manque encore'));const mg=el('div',undefined,'muLivingGrid');
 for(const q of gaps){const c=el('article',undefined,'muLivingCard');append(c,el('span','QUÊTE Φ','muCardType'),el('strong',q.label),el('small',q.remaining_items+' élément(s) à vérifier dans le département'));mg.append(c);}if(!mg.children.length)mg.append(el('p','Aucun manque vérifié n’est affiché dans le contexte chargé.','muFineprint'));missing.append(mg);box.append(missing);
 return box;
}
function departmentPortrait(node,g){
 const d=node.data||{},profile=territoryCulture?.departments?.[d.code],shard=g.communeShards?.get(d.code),box=el('div',undefined,'muDepartmentPortrait');
 const stats=el('div',undefined,'muDepartmentStats');
 const stat=(value,label)=>{const c=el('div',undefined,'muDepartmentStat');append(c,el('strong',value),el('span',label));return c;};
 append(stats,stat(d.commune_count??'—',uiLocale==='en'?'communes':uiLocale==='es'?'municipios':'communes'),stat(d.epci_codes?.length??'—',uiLocale==='en'?'inter-municipal groups':uiLocale==='es'?'intercomunalidades':'intercommunalités'),stat(Number.isFinite(d.population_sum)?d.population_sum.toLocaleString(uiLocale==='en'?'en-US':uiLocale==='es'?'es-ES':'fr-FR'):'—',uiLocale==='en'?'people in API sum*':uiLocale==='es'?'personas en suma API*':'habitants dans la somme API*'));
 const soul=territorySoulPanel(d.code);if(soul)box.append(soul);
 box.append(stats,el('p',uiLocale==='en'?'*The API response does not provide the population vintage here; this is not presented as a dated census.':uiLocale==='es'?'*La respuesta API no aporta aquí el año de población; no se presenta como un censo fechado.':'*Le millésime de population n’est pas fourni dans cette réponse API : ce total n’est pas présenté comme un recensement daté.','muFineprint'));
 if(shard?.communes?.length){const top=shard.communes.filter(c=>Number.isFinite(c.population)).sort((a,b)=>b.population-a.population).slice(0,6),section=el('section',undefined,'muDepartmentSection');section.append(el('h2',tr('top_places','Communes principales dans les données API chargées')));const grid=el('div',undefined,'muLocalPlaces');for(const c of top){const a=link('',M.route('objet',M.TOPO+'#/communes/'+c.code),'muLocalPlace');append(a,el('strong',c.name),el('span',c.population.toLocaleString(uiLocale==='en'?'en-US':uiLocale==='es'?'es-ES':'fr-FR')+' · API'));grid.append(a);}section.append(grid);box.append(section);}
 const local=profile?.local_language,language=el('section',undefined,'muDepartmentSection');language.append(el('h2',tr('local_lang','Langues & expressions locales')));
 if(local?.options?.length){const chips=el('div',undefined,'muLanguageChips');for(const option of local.options)chips.append(el('span',option.label,'muLanguageChip'));language.append(chips,el('p',local.warning,'muFineprint'));const source=local.options[0]?.source;if(source)language.append(link(uiLocale==='en'?'Official linguistic context ↗':uiLocale==='es'?'Contexto lingüístico oficial ↗':'Contexte linguistique officiel ↗',source,'muQuestionLink'));}
 else language.append(el('p',tr('local_unverified','Mode local ouvert uniquement aux variantes documentées : aucun patois n’est inventé automatiquement.'),'muGuard'));
 if(uiLocale==='local')language.prepend(el('p',local?.options?.length?(uiLocale==='local'?'Mode local : contexte régional disponible, traduction locale à construire avec des locuteurs et des sources.':''):'','muLocalModeNotice'));
 box.append(language);
 const story=el('section',undefined,'muDepartmentSection');story.append(el('h2',tr('story_open','Que devrait mieux raconter ce département ?')));const sg=el('div',undefined,'muStorySlots');for(const slot of profile?.story_slots||[]){const c=el('article',undefined,'muStorySlot');append(c,el('strong',storySlotLabel(slot)),el('span',uiLocale==='en'?'Open for verified local contributions':uiLocale==='es'?'Abierto a contribuciones locales verificadas':'Ouvert aux contributions locales vérifiées'));sg.append(c);}story.append(sg);box.append(story);
 const quests=territoryQuestPanel(d.code);if(quests)box.append(quests);const phi=phiPanel(d.code);if(phi)box.append(phi);return box;
}
function objectView(node,g){
 const isDepartment=node.kind==='DEPARTMENT',isCommune=node.kind==='COMMUNE',humanDepartment=isDepartment&&audienceMode!=='expert',humanCommune=isCommune&&audienceMode!=='expert',profile=isDepartment?territoryCulture?.departments?.[node.data?.code]:null;
 if(humanDepartment)title(tr('dept_kicker','VOTRE DÉPARTEMENT, AU-DELÀ DES CHIFFRES'),fill(tr('dept_title','Découvrez {name} autrement'),{name:node.label}),tr('dept_sub','Lieux, langues, patrimoine, savoir-faire, mémoire et initiatives locales — avec des sources, et une place pour ce que les habitants savent mieux que les bases de données.'));
 else if(humanCommune)title('VOTRE COMMUNE, CONCRÈTEMENT',node.label,'Que peut-on y faire, que partage-t-elle avec ses voisines, et qu’est-ce qui reste à mieux documenter ?');
 else title((M.LABELS[node.kind]||node.kind).toUpperCase(),node.label,node.kind==='REGION'?'Une fiche territoriale descriptive. Aucun taux national ne lui est attribué.':'Un objet, ses éléments documentés et les chemins qui le relient au reste.');
 const layout=el('div',undefined,'muObjectLayout'),main=el('section',undefined,'muObjectMain'),aside=el('aside',undefined,'muRelations');
 main.append(el('span',humanDepartment?(profile?.region_name||'Territoire'):humanCommune?'Commune · '+(node.data?.department_code||'territoire'):node.status||'CONTEXTE DOCUMENTÉ','muTag'));
 if(humanDepartment)main.append(departmentPortrait(node,g));else if(humanCommune)main.append(communeLivingPanel(node,g),factTable(node,g));else main.append(factTable(node,g));
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
 if(['INITIATIVE','EDITORIAL_PROPOSAL'].includes(node.kind)){
  const d=node.data;if(d.contact){main.append(el('p','Contact institutionnel à revérifier avant tout envoi : '+d.contact.organization+' · '+d.contact.email,'muFineprint'));const url=M.safeURL(d.contact.source_url);if(url)main.append(link('Source publique du contact ↗',url));}
  if(d.draft){const box=el('details',undefined,'muDraft');append(box,el('summary','Lire le courrier préparé · non envoyé'),el('pre','Objet : '+d.subject+'\n\n'+d.draft));main.append(box);}
  if(d.transcript){const box=el('details',undefined,'muDraft');append(box,el('summary','Lire le texte éditorial préparé'),el('pre',d.transcript));main.append(box);}
  if(d.storyboard){const shots=el('ol',undefined,'muSteps');for(const x of d.storyboard)shots.append(el('li',x.scene+' — '+x.caption));main.append(el('h3','Découpage proposé'),shots);}
  const row=el('div',undefined,'muActions');append(row,button('Exporter le dossier de revue',()=>download(d,d.id+'.json')),button('Copier le brouillon',async()=>{try{await navigator.clipboard.writeText(d.draft||d.transcript||'');status('Brouillon copié. Aucun envoi ni diffusion effectué.');}catch(e){status('Sélectionnez le texte dans le dossier.');}}));main.append(row);
  main.append(el('p','Préparation automatique dans la boucle existante. Ni envoi, ni partenariat, ni publication sociale n’est attesté. Un accord éventuel avec une mairie n’est pas un soutien politique.','muGuard'));
 }
 if(node.kind==='CIVIC_MISSION'){
  const rules=el('ol',undefined,'muSteps');for(const text of node.data.principles||[])rules.append(el('li',text));append(main,el('h2','Engagements de fonctionnement'),rules,el('p',(node.data.workflow||[]).join(' → '),'muGuard'),button('Poser une question ou proposer une correction',()=>openChat(),'muPrimary'));
 }
 if(node.kind==='HISTORICAL_OBSERVATION'||node.kind==='CLAIM'&&Array.isArray(node.data.value)){const table=el('table',undefined,'muTable');const h=el('tr');append(h,el('th','Échéance (années)'),el('th','Taux (%)'));table.append(h);for(const x of (node.kind==='HISTORICAL_OBSERVATION'?node.data.curve:node.data.value)||[]){const row=el('tr');append(row,el('td',x.tenor_years),el('td',x.rate_pct));table.append(row);}main.append(table);}
 if(node.kind==='COUNTRY'&&!territories)main.append(button('Charger les régions documentées',async()=>{await ensureTerritories();renderCurrent(true);},'muPrimary'));
 const relations=M.neighbors(g,node.id);append(aside,el('h2','Traverser une relation'),el('p','Chaque lien indique ce qui relie les objets. Ce n’est pas une causalité implicite.','muFineprint'));
 paginatedCards(aside,relations,null,'relations:'+node.id,true);
 if(!relations.length)aside.append(el('p','Aucune relation supplémentaire dans le contexte chargé.'));
 append(layout,main,aside);stage.append(layout);
}
async function ensureTerritoryCulture(){
 if(territoryCulture)return territoryCulture;if(territoryCulturePromise)return territoryCulturePromise;
 territoryCulturePromise=(async()=>{const r=await window.laBeteReadCanonicalJSON('data/la-bete-territory-culture-v1.json',{cache:'no-cache'});if(!r.ok)throw Error('TERRITORY_CULTURE_HTTP_'+r.status);const j=await r.json();if(j.schema!=='LA_BETE_TERRITORY_CULTURE_V1'||j.departments_count!==101||Object.keys(j.departments||{}).length!==101)throw Error('TERRITORY_CULTURE_SCHEMA');territoryCulture=j;return j;})().catch(e=>{territoryCulturePromise=null;throw e;});return territoryCulturePromise;
}
async function ensurePhiPolicy(){
 if(phiPolicy)return phiPolicy;if(phiPromise)return phiPromise;
 phiPromise=(async()=>{const r=await window.laBeteReadCanonicalJSON('data/phi-coins-v1.json',{cache:'no-cache'});if(!r.ok)throw Error('PHI_HTTP_'+r.status);const j=await r.json(),f=j.financial_status||{};if(j.schema!=='LA_BETE_PHI_COINS_V1'||f.money!==false||f.cryptoasset!==false||f.transferable!==false||f.purchasable!==false||f.redeemable_for_cash!==false)throw Error('PHI_POLICY_UNSAFE');phiPolicy=j;return j;})().catch(e=>{phiPromise=null;throw e;});return phiPromise;
}
async function ensureTerritoryQuests(){
 if(territoryQuests)return territoryQuests;if(territoryQuestsPromise)return territoryQuestsPromise;
 territoryQuestsPromise=(async()=>{const r=await window.laBeteReadCanonicalJSON('data/phi-territory-quests-v1.json',{cache:'no-cache'});if(!r.ok)throw Error('TERRITORY_QUESTS_HTTP_'+r.status);const j=await r.json(),c=j.score_contract||{};if(j.schema!=='LA_BETE_PHI_TERRITORY_QUESTS_V1'||Object.keys(j.territories||{}).length!==101||c.economic_inputs!==false||c.wealth_inputs!==false||c.political_inputs!==false)throw Error('TERRITORY_QUESTS_SCHEMA');territoryQuests=j;return j;})().catch(e=>{territoryQuestsPromise=null;throw e;});return territoryQuestsPromise;
}
async function ensureTerritoryLivingIdentity(){
 if(territoryLivingIdentity)return territoryLivingIdentity;if(territoryLivingIdentityPromise)return territoryLivingIdentityPromise;
 territoryLivingIdentityPromise=(async()=>{const r=await window.laBeteReadCanonicalJSON('data/la-bete-territory-living-identity-v1.json',{cache:'no-cache'});if(!r.ok)throw Error('TERRITORY_LIVING_IDENTITY_HTTP_'+r.status);const j=await r.json(),guards=j.guards||{};if(j.schema!=='LA_BETE_TERRITORY_LIVING_IDENTITY_V1'||j.departments_count!==101||Object.keys(j.departments||{}).length!==101||guards.no_random_identity_color!==true||guards.no_unlicensed_image!==true||guards.empty_is_better_than_fabricated!==true)throw Error('TERRITORY_LIVING_IDENTITY_SCHEMA');territoryLivingIdentity=j;return j;})().catch(e=>{territoryLivingIdentityPromise=null;throw e;});return territoryLivingIdentityPromise;
}
async function ensureTerritories(){
 if(territories)return territories;if(territoryPromise)return territoryPromise;
 territoryPromise=(async()=>{const response=await window.laBeteReadCanonicalJSON('data/france-organism.json',{cache:'no-cache'});if(!response.ok)throw Error('TERRITORY_HTTP_'+response.status);const j=await response.json();if(j.schema!=='OJO_FRANCE_ORGANISM_V1'||!Array.isArray(j.topology?.regions)||j.topology.regions.length>100)throw Error('TERRITORY_SCHEMA');const seen=new Set();for(const r of j.topology.regions){if(typeof r.name!=='string'||!/^\d{2,3}$/.test(String(r.code))||seen.has(String(r.code)))throw Error('TERRITORY_IDENTITY');seen.add(String(r.code));}territories=j;return j;})().catch(e=>{territoryPromise=null;throw e;});return territoryPromise;
}
async function ensureTopology(){
 if(topology)return topology;if(topologyPromise)return topologyPromise;
 topologyPromise=(async()=>{await ensureTerritories();const r=await window.laBeteReadCanonicalJSON('data/france-topology.json',{cache:'no-cache'});if(!r.ok)throw Error('TOPOLOGY_HTTP_'+r.status);const t=await r.json(),d=t.detail;
 if(t.schema!==M.TOPO||d?.schema!=='OJO_FRANCE_TOPOLOGY_DETAIL_V1'||!Array.isArray(d.commune_index)||d.commune_index.length>100000||!Array.isArray(d.departments)||d.departments.length>150||!Array.isArray(d.epcis)||d.epcis.length>3000)throw Error('TOPOLOGY_DETAIL_SCHEMA');
 const codes=new Set();for(const x of d.commune_index){if(!Array.isArray(x)||x.length!==5||!/^[0-9AB]{5}$/.test(x[0])||typeof x[1]!=='string'||codes.has(x[0])||!d.shards?.[x[2]])throw Error('TOPOLOGY_INDEX_INVALID');codes.add(x[0]);}
 if(d.counts?.communes_cog!==codes.size)throw Error('TOPOLOGY_COUNT');topology=t;return t;})().catch(e=>{topologyPromise=null;throw e;});return topologyPromise;
}
async function ensureDepartmentShard(dep){
 await ensureTopology();if(communeShards.has(dep))return communeShards.get(dep);if(shardPromises.has(dep))return shardPromises.get(dep);
 const descriptor=topology.detail.shards[dep];if(!descriptor||!/^(?:\d{2,3}|2[AB])$/.test(dep)||!new RegExp('^data/france-topology-detail/'+dep+'-[a-f0-9]{20}\\.json$').test(descriptor.path)||!/^[a-f0-9]{64}$/.test(descriptor.sha256))throw Error('SHARD_LOCATION');
 const pending=(async()=>{const r=await window.laBeteReadCanonicalJSON(descriptor.path,{cache:'force-cache',expectedSHA256:descriptor.sha256,maxBytes:3000000});if(!r.ok)throw Error('SHARD_HTTP_'+r.status);const payload=await r.json();if(payload.schema!=='OJO_FRANCE_COMMUNES_SHARD_V1'||payload.department_code!==dep||payload.communes?.length!==descriptor.count)throw Error('SHARD_SCHEMA');
 const seen=new Set();for(const c of payload.communes){const ref=M.communeIndex(topology.detail).get(c.code);if(!ref||seen.has(c.code)||ref[1]!==c.name||ref[2]!==c.department_code||ref[3]!==c.region_code||ref[4]!==c.epci_code)throw Error('SHARD_INDEX_MISMATCH');seen.add(c.code);}communeShards.set(dep,payload);return payload;})().finally(()=>shardPromises.delete(dep));shardPromises.set(dep,pending);return pending;
}
async function ensureCommune(code){
 await ensureTopology();const row=M.communeIndex(topology.detail).get(code);if(!row)throw Error('COMMUNE_NOT_IN_COG');return ensureDepartmentShard(row[2]);
}
function universeView(universe,g){const u=M.UNIVERSES.find(x=>x.id===universe);title('UNIVERS EXPLORABLE',u.label,u.subtitle+'. Les objets sont des vues des documents existants, pas de nouvelles copies de la vérité.');
 const nodes=[...g.nodes.values()].filter(n=>n.universe===universe);
 if(universe==='territoires'){
  const d=g.detail;stage.append(el('p',d?d.counts.regions+' régions · '+d.counts.departments+' départements · '+d.counts.epcis_catalog+' entrées au catalogue des intercommunalités · '+d.counts.communes_cog+' communes du COG. Les fiches détaillées communales se chargent à la demande.':'Le référentiel détaillé n’est pas disponible ; aucune fiche locale ne sera inventée.','muGuard'));
  const board=territoryProgressBoard();if(board)stage.append(board);
  const search=el('form',undefined,'muTerritorySearch');search.setAttribute('role','search');const input=el('input');input.type='search';input.placeholder='Nom ou code Insee d’une commune…';input.setAttribute('aria-label','Rechercher une commune');input.id='muCommuneSearch';const submit=el('button','Trouver une commune');submit.type='submit';append(search,input,submit);search.addEventListener('submit',e=>{e.preventDefault();searchInput.value=input.value;searchForm.requestSubmit();});stage.append(search);
  listCards(nodes.filter(n=>n.kind==='COUNTRY'||n.kind==='REGION'),'Pays et régions');
  const detail=el('details',undefined,'muCatalogDetails');detail.append(el('summary','Catalogue des départements et intercommunalités'));stage.append(detail);
  paginatedCards(detail,nodes.filter(n=>n.kind==='DEPARTMENT'),'Départements','all-departments');paginatedCards(detail,nodes.filter(n=>n.kind==='EPCI'),'Intercommunalités','all-epcis');return;
 }
 if(universe==='sources'){listCards(nodes.filter(n=>n.kind==='ORGANIZATION_VIEW'),'Organismes · regroupements de sources');listCards(nodes.filter(n=>n.kind!=='ORGANIZATION_VIEW'),'Publications et accès');}
 else if(universe==='demarches'){listCards(nodes.filter(n=>n.kind==='INITIATIVE'),'Initiatives de collaboration');listCards(nodes.filter(n=>n.kind==='REQUEST'),'Demandes préparées');listCards(nodes.filter(n=>n.kind==='GAP'),'Manques documentés');if(!g.evolution)stage.append(el('p','L’évolution vérifiée ne correspond pas au même instantané. Les démarches ne sont pas présentées comme à jour.','muGuard'));}
 else if(universe==='temps'){const actions=el('div',undefined,'muFeatureCards');append(actions,link('◷  Ouvrir la chronologie existante','#/chronologie'),link('◇  Explorer les horizons 12 / 36 / 60 / 120 mois','#/horizons'),link('⌁  Manipuler les scénarios de taux','#/analyse'));stage.append(actions);listCards(nodes);stage.append(el('p','Les scénarios sont conditionnels. Ils ne prédisent ni résultats électoraux ni causalité politique.','muGuard'));}
 else if(universe==='idees'){
  const p=el('div',undefined,'muIdeaIntro');append(p,el('h2','Une question peut ouvrir un chemin.'),el('p','Le dialogue reste disponible depuis chaque objet. Les messages gardent leur contexte ; une proposition n’est ni une preuve ni une décision.'),button('Ouvrir mon échange',()=>openChat(),'muPrimary'),el('p','Version actuelle : réponses structurées par règles, sans modèle de langage généraliste ni nouvelle recherche web.','muFineprint'),link('Consulter les fils publics GitHub ↗','https://github.com/Nicolason84/nova-trust/issues?q=is%3Aissue+%22%5BLA+B%C3%8ATE%5D%22'));stage.append(p);listCards(nodes.filter(n=>n.kind==='CIVIC_MISSION'),'Mission et engagements');listCards(nodes.filter(n=>n.kind==='EDITORIAL_PROPOSAL'),'Podcasts et vidéos · projets à valider');
 }else if(universe==='etat'){
  const p=el('div',undefined,'muFeatureCards');append(p,link('◈  Mémoire et santé opérationnelle','#/sante'),link('◇  Explorer la présence 3D existante','#/presence'));stage.append(p);stage.append(el('p','La Bête est visible dès l’Atlas. La vue détaillée réutilise la même scène ; aucun accès caméra, micro ou son n’est activé par la navigation.','muGuard'));listCards(nodes,'Éléments réellement observés');
 }else listCards(nodes);
}
function contextForChat(){const g=current?.graph;if(current?.parsed?.snapshot&&current.parsed.snapshot!==g?.source_snapshot_id)return {live:{},evolution:null,object:null,context_label:'Instantané demandé indisponible'};const node=g?M.resolveNode(g,current?.parsed?.id):null;return {live:g?.live,evolution:g?.evolution,object:M.dialogueContext(node,g),route:current?.hash||'#/atlas',context_label:node?.label||current?.label||'Atlas'};}
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
  if(p.kind==='atlas'){try{await Promise.all([ensurePhiPolicy(),ensureTerritoryQuests()]);}catch(e){status('Φ indisponible : '+e.message);}if(token!==renderToken)return;}
  const departmentPrefix=M.TOPO+'#/departments/',communePrefix=M.TOPO+'#/communes/';
  if(p.kind==='univers'&&p.id==='territoires'||p.kind==='objet'&&(p.id.startsWith('OJO_FRANCE_ORGANISM_V1#/topology/regions/')||p.id.startsWith(M.TOPO+'#/'))){
   if(!territories){status('Chargement du document territorial existant…');try{await ensureTerritories();}catch(e){status('Document territorial indisponible. Aucun détail de remplacement n’est inventé.');}}
   try{
    await ensureTopology();
    if(p.kind==='univers'&&p.id==='territoires')await ensureTerritoryQuests();
    if(p.kind==='objet'&&p.id.startsWith(departmentPrefix)){const dep=p.id.slice(departmentPrefix.length);await Promise.all([ensureDepartmentShard(dep),ensureTerritoryCulture(),ensurePhiPolicy(),ensureTerritoryQuests(),ensureTerritoryLivingIdentity()]);}
    else if(p.kind==='objet'&&p.id.startsWith(communePrefix)){const code=p.id.slice(communePrefix.length);await Promise.all([ensureCommune(code),ensureTerritoryQuests(),ensureTerritoryLivingIdentity()]);}
   }catch(e){status('Détail non disponible ou non vérifié : '+e.message);}
   if(token!==renderToken)return;g=current.graph=M.build(g.live,g.evolution,territories,topology,communeShards);
  }
  if(!['presence','lecture'].includes(p.kind)||current.isSearch)window.laBeteSuspendPresence?.();
  restoreMoves();root.classList.toggle('mu-atlas-home',p.kind==='atlas'&&!current.isSearch&&(!p.snapshot||p.snapshot===g.source_snapshot_id));stage.replaceChildren();legacy.hidden=true;legacy.inert=true;workspace.hidden=false;document.body.classList.remove('mu-reading');root.classList.remove('mu-reading');
  if(p.kind==='lecture'){
   legacy.hidden=false;legacy.inert=false;workspace.hidden=true;chatPlace.after(legacyChat);document.body.classList.add('mu-reading');root.classList.add('mu-reading');window.laBeteEnsurePresence?.();
  }else if(p.snapshot&&p.snapshot!==g.source_snapshot_id){
   title('INSTANTANÉ NON DISPONIBLE','Ce lien vise une autre version.','Version demandée : '+p.snapshot+'. Version chargée : '+g.source_snapshot_id+'. Aucun remplacement silencieux.');stage.append(button('Ouvrir explicitement la version chargée',()=>renderCurrent(true),'muPrimary'));
  }else if(current.isSearch){title('RECHERCHE DANS LE CONTEXTE CHARGÉ',current.search,'Résultats conservés au retour.');listCards(M.search(g,current.search));}
  else if(p.kind==='atlas')atlas(g);
  else if(p.kind==='mobile'||p.kind==='prive'){
   try{
    if(!window.LaBeteAccess)throw Error('ACCESS_MODULE_UNAVAILABLE');
    if(!mobileAccess){const response=await window.laBeteReadCanonicalJSON('data/la-bete-mobile-access.json',{cache:'no-cache'});if(!response.ok)throw Error('ACCESS_MANIFEST_UNAVAILABLE');mobileAccess=window.LaBeteAccess.validate(await response.json());}
    if(token!==renderToken)return;window.LaBeteAccess.render(stage,mobileAccess,p.kind);
   }catch(e){title('ACCÈS NON VÉRIFIÉ','Les liens ne sont pas disponibles.','Aucun formulaire privé ni téléchargement de remplacement n’est proposé.');}
  }
  else if(['public','agir','scic','services'].includes(p.kind))hybridView(p.kind,g);
  else if(p.kind==='univers')universeView(p.id,g);
  else if(p.kind==='objet'){const node=M.resolveNode(g,p.id);if(node)objectView(node,g);else{title('OBJET NON TROUVÉ','Ce point n’est pas documenté ici.','Le lien n’est pas remplacé par un objet inventé.');stage.append(link('Revenir à l’atlas','#/atlas','muPrimary'));}}
  else if(['presence','analyse','horizons','chronologie','sante'].includes(p.kind)){
   const section={presence:'la-bete',analyse:'market-anatomy',horizons:'refinancing-twin',chronologie:'time-machine',sante:'autoevolution'}[p.kind];
   if(audienceMode==='expert')title('COMPOSANT EXISTANT · MÊME FLUX',routeLabel(p,g),'Ce composant est réutilisé, non recopié. Ses valeurs suivent le flux existant ; les objets et preuves disposent de leur propre instantané.');
   else {
    const copy={
     presence:['LA BÊTE','Pourquoi cette forme bouge-t-elle ?','La représentation visuelle réagit aux états déjà calculés. Elle aide à explorer ; elle ne constitue ni un diagnostic ni une opinion.'],
     analyse:['TAUX & SCÉNARIOS','Que se passe-t-il si les taux changent ?','Comparez des scénarios pour voir des ordres de grandeur. Ils décrivent des conditions possibles, pas l’avenir.'],
     horizons:['DANS LE TEMPS','Quand le coût se transmet-il vraiment ?','La dette se renouvelle progressivement : cette vue montre pourquoi une hausse de taux ne frappe pas tout le budget le même jour.'],
     chronologie:['CE QUI A CHANGÉ','Comment la situation a-t-elle évolué ?','Remontez les observations et les scénarios sans confondre une date de donnée avec une prédiction.'],
     sante:['FIABILITÉ','Les données sont-elles à jour ?','Cette vue montre ce qui est disponible, ce qui manque et ce que La Bête conserve comme dernière information fiable.']
    }[p.kind];title(copy[0],copy[1],copy[2]);
   }
   mountExisting(section);
   if(p.kind==='presence')window.laBeteEnsurePresence?.();
  }else {title('ROUTE INCONNUE','Reprendre un chemin documenté.','Cette adresse ne correspond à aucun objet ou univers pris en charge.');stage.append(link('Ouvrir l’atlas','#/atlas','muPrimary'));}
  current.label=routeLabel(p,g);trail.replaceChildren(link('Accueil','#/atlas'));
  for(const v of current.visited||[])if(v.hash!==current.hash&&!['Atlas','Accueil'].includes(v.label))append(trail,el('span','/'),link(v.label,v.hash));append(trail,el('span','/'),el('span',current.label));
  [...nav.querySelectorAll('a')].forEach(a=>{const target=a.dataset.muRoute;const active=(['atlas','public','agir','scic','services','mobile','prive'].includes(p.kind)&&target===M.route(p.kind))||(p.kind==='univers'&&target===M.route('univers',p.id))||(p.kind==='objet'&&target===M.route('univers',M.resolveNode(g,p.id)?.universe));if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.title=current.label+' · La Bête · ojO';refreshChatLabel();updateBar.hidden=true;
  if(!workspace.hidden){stage.append(el('p',humanStamp(g),'muSnapshot'));}
  if(restore){searchInput.value=current.search||'';[...stage.querySelectorAll('details')].forEach((d,i)=>d.open=!!current.details?.[i]);window.scrollTo({top:current.scrollY||0,behavior:'instant'});const f=current.focusId?id(current.focusId):[...document.querySelectorAll('[data-mu-route]')].find(a=>a.dataset.muRoute===current.focusRoute);f?.focus({preventScroll:true});}
  else {window.scrollTo({top:0,behavior:'instant'});if(!workspace.hidden)stage.focus({preventScroll:true});searchInput.value=current.search||'';}
  status('');records.set(current.key,current);
 }catch(error){restoreMoves();chatPlace.after(legacyChat);document.body.classList.remove('mu-active');legacy.hidden=false;legacy.inert=false;root.hidden=true;console.error('MULTIUNIVERS_SAFE_FALLBACK',String(error.message));}
}
searchForm.addEventListener('submit',async event=>{event.preventDefault();save();const q=searchInput.value.trim();if(!q){status('Écrivez un nom, un identifiant ou un thème.');return;}const key=current.key;try{await ensureTopology();}catch(e){status('Recherche dans les objets disponibles uniquement.');}if(current.key!==key)return;current.graph=M.build(current.graph.live,current.graph.evolution,territories,topology,communeShards);const results=M.search(current.graph,q);window.laBeteSuspendPresence?.();root.classList.remove('mu-atlas-home');restoreMoves();stage.replaceChildren();legacy.hidden=true;legacy.inert=true;workspace.hidden=false;title('RECHERCHE DANS LE CONTEXTE CHARGÉ',q,results.length+' objet(s) trouvé(s). Recherche dans les objets et l’index communal publiés. Au plus 200 résultats, affichés par groupes de 40.');listCards(results);current.search=q;current.isSearch=true;status('');});
root.addEventListener('click',event=>{const a=event.target.closest?.('a[data-mu-route]');if(!a||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(a.dataset.muRoute);});
document.addEventListener('click',event=>{if(!document.body.classList.contains('mu-active')||event.defaultPrevented)return;const a=event.target.closest?.('a[href^="#"]');if(!a||a.dataset.muRoute||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const mapped=canonicalRoute(a.getAttribute('href'));if(mapped.startsWith('#/')){event.preventDefault();navigate(mapped);}});
window.addEventListener('popstate',()=>{save();const key=history.state?.mu?.key,cached=records.get(key);current=cached||{key:key||'mu-'+(++serial),hash:canonicalRoute(location.hash),depth:history.state?.mu?.depth||0,scrollY:0,graph:graphFrom(getBase()),visited:[]};renderCurrent(false,true);});
window.addEventListener('hashchange',()=>{const hash=canonicalRoute(location.hash);if(hash!==current?.hash)navigate(hash,true);});
window.addEventListener('pagehide',()=>{save();});
window.LaBeteExplorer=Object.freeze({getDialogueContext:contextForChat,navigate,openChat,update(c){latest=c;if(!current||!c?.live)return;const changed=c.live.snapshot_id!==current.graph.source_snapshot_id||c.evolution?.generation!==current.graph.evolution?.generation;updateBar.hidden=!changed;},state:()=>({route:current?.hash,object:current?.parsed?.id||null,snapshot:current?.graph.source_snapshot_id,territoriesLoaded:!!territories,historyEntries:records.size})});
try{const g=graphFrom(getBase());current={key:'mu-'+(++serial),hash:canonicalRoute(location.hash),depth:0,scrollY:0,search:'',graph:g,visited:[]};history.replaceState({...history.state,mu:{key:current.key,depth:0}},'',current.hash);document.body.classList.add('mu-active');renderCurrent();}catch(e){restoreMoves();chatPlace.after(legacyChat);root.hidden=true;legacy.hidden=false;legacy.inert=false;history.scrollRestoration=savedRestoration;console.error('MULTIUNIVERS_BOOT_FALLBACK',String(e.message));}
})();
