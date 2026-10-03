/* Navigation selectors over existing canonical objects. No storage, fetch or execution. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LaBeteExplorerModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const COUNTRY='OJO_FRANCE_ORGANISM_V1#/identity', FINANCE='OJO_FRANCE_ORGANISM_V1#/physiology/systems/finance', DEBT='OJO_FRANCE_DEBT_RATE_LIVE_V1';
const UNIVERSES=Object.freeze([
 {id:'territoires',label:'Territoires',subtitle:'Entrer dans les lieux',symbol:'◎'},
 {id:'finances',label:'Finances publiques',subtitle:'Lire les mécanismes',symbol:'◇'},
 {id:'sources',label:'Sources & organismes',subtitle:'Remonter à la provenance',symbol:'⌘'},
 {id:'preuves',label:'Preuves',subtitle:'Vérifier chaque affirmation',symbol:'⌁'},
 {id:'temps',label:'Temps & scénarios',subtitle:'Explorer sans prédire',symbol:'◷'},
 {id:'demarches',label:'Démarches',subtitle:'Du manque à la demande',symbol:'↗'},
 {id:'idees',label:'Questions & idées',subtitle:'Proposer, préciser, examiner',symbol:'✧'},
 {id:'etat',label:'État de La Bête',subtitle:'Mémoire, limites et présence',symbol:'◈'}]);
const LABELS={SOURCE:'Source',PUBLICATION:'Publication',CLAIM:'Affirmation',COUNTRY:'Pays',REGION:'Région',SYSTEM:'Système',ORGAN:'Objet instrumenté',ORGANIZATION_VIEW:'Organisme · regroupement de sources',REQUEST:'Démarche préparée',GAP:'Information manquante',METRIC:'Mesure',DERIVED_METRIC:'Mesure dérivée',SCENARIO:'Scénario conditionnel',OUTPUT:'Synthèse'};
const RELATIONS={CONTAINS:'contient',INSTRUMENTED_BY:'est documenté par',PROJECTS:'est présenté dans',OBSERVES:'observe',CROSSCHECKS:'recoupe',DERIVES:'permet de dériver',PARAMETERIZES:'paramètre',INFORMS:'informe',STRESSES:'applique un scénario à',SOURCE_FOR:'documente',PUBLISHED_BY:'est publié par',HAS_GAP:'présente un manque',ADDRESSES:'cherche à résoudre',PART_OF:'fait partie de'};
const clean=x=>String(x??'');
const normalize=x=>clean(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function safeURL(value){try{const u=new URL(value);const allowed=['www.aft.gouv.fr','www.banque-france.fr','webstat.banque-france.fr','data.economie.gouv.fr','www.assemblee-nationale.fr','www.insee.fr','geo.api.gouv.fr','www.data.gouv.fr','nicolason84.github.io','github.com'];return u.protocol==='https:'&&!u.username&&!u.password&&allowed.includes(u.hostname)?u.href:null;}catch(_){return null;}}
function route(kind,id,snapshot){const path=kind==='objet'?'#/objet/'+encodeURIComponent(id):kind==='univers'?'#/univers/'+encodeURIComponent(id):'#/'+kind;return path+(snapshot?'?snapshot='+encodeURIComponent(snapshot):'');}
function parseRoute(hash){
 try{const raw=clean(hash)||'#/atlas';const index=raw.indexOf('?');const parts=(index<0?raw:raw.slice(0,index)).replace(/^#\/?/,'').split('/').map(decodeURIComponent);const q=new URLSearchParams(index<0?'':raw.slice(index+1));const snapshot=q.get('snapshot');if(snapshot&&!/^OJO-[A-Za-z0-9-]{1,100}$/.test(snapshot))return {kind:'invalid'};
 if(parts[0]==='objet'&&parts.length===2&&parts[1]&&parts[1].length<500)return {kind:'objet',id:parts[1],snapshot};
 if(parts[0]==='univers'&&parts.length===2&&UNIVERSES.some(u=>u.id===parts[1]))return {kind:'univers',id:parts[1],snapshot};
 if(['atlas','lecture','presence','analyse','horizons','chronologie','sante'].includes(parts[0])&&parts.length===1)return {kind:parts[0],snapshot};
 return {kind:'invalid'};
 }catch(_){return {kind:'invalid'};}
}
function build(live,evolution,territories){
 if(live?.schema!==DEBT||live.policy?.political_recommendation!=='NONE'||live.france_binding?.territorial_imputation!==false)throw Error('VERIFIED_CANON_REQUIRED');
 const nodes=new Map(),edges=[]; const edgeKeys=new Set();
 const add=(id,label,kind,universe,data,extra={})=>{if(!id||nodes.has(id))return nodes.get(id);const n={id,label,kind,universe,data,...extra};nodes.set(id,n);return n;};
 const edge=(from,to,relation)=>{const key=[from,to,relation].join('|');if(!edgeKeys.has(key)){edgeKeys.add(key);edges.push({from,to,relation,label:RELATIONS[relation]||relation});}};
 add(COUNTRY,'France','COUNTRY','territoires',territories?.identity||live.france_binding,{ref:'data/france-organism.json#/identity'});
 add(FINANCE,'Finances publiques','SYSTEM','finances',live.france_binding,{ref:'data/france-organism.json#/physiology/systems/finance'});
 add(DEBT,'Dette · taux · refinancement','ORGAN','finances',live,{ref:'data/france-debt-rate-live.json',status:'INSTANTANÉ DOCUMENTÉ'});
 edge(COUNTRY,FINANCE,'CONTAINS');edge(FINANCE,DEBT,'INSTRUMENTED_BY');
 for(const s of live.sources||[]){
  add(s.id,s.label,'SOURCE','sources',s,{ref:'data/france-debt-rate-live.json#/sources/'+(live.sources||[]).indexOf(s),url:safeURL(s.url),status:s.health,date:s.checked_at});
  edge(s.id,DEBT,'INFORMS');
  const u=safeURL(s.url);if(u){let host=new URL(u).hostname;if(host==='webstat.banque-france.fr')host='www.banque-france.fr';const id='source-domain:'+host;const label=host==='www.aft.gouv.fr'?'Agence France Trésor':host==='www.banque-france.fr'?'Banque de France':s.publisher;
   add(id,label,'ORGANIZATION_VIEW','sources',{host},{ref:'data/france-debt-rate-live.json#/sources',status:'REGROUPEMENT PAR DOMAINE'});edge(s.id,id,'PUBLISHED_BY');}
 }
 for(const [id,p] of Object.entries(live.evidence_graph?.publication_refs||{})){add(id,p.label||id,'PUBLICATION','preuves',p,{url:safeURL(p.url),status:p.health,date:p.vintage,ref:'data/france-debt-rate-live.json#/evidence_graph/publication_refs/'+id});}
 for(const c of live.claims||[]){add(c.claim_id,c.label,'CLAIM','preuves',c,{status:c.state,date:c.date,ref:c.metric_ref?.replace(/^docs\//,'')||'data/france-debt-rate-live.json'});for(const id of c.source_ids||[])if(nodes.has(id))edge(id,c.claim_id,'SOURCE_FOR');edge(c.claim_id,DEBT,'INFORMS');}
 for(const n of live.evidence_graph?.nodes||[]){add(n.id,n.label,n.kind,n.kind==='SCENARIO'?'temps':'preuves',n,{ref:'data/france-debt-rate-live.json#/evidence_graph'});}
 for(const e of live.evidence_graph?.edges||[])if(nodes.has(e.from)&&nodes.has(e.to))edge(e.from,e.to,e.relation);
 const bound=evolution?.status==='ACTIVE'&&evolution.verification?.generation===evolution.generation&&evolution.source_snapshot_id===live.snapshot_id;
 if(bound){for(const req of evolution.self_model?.acquisition?.requests||[]){
  add(req.id,req.subject,'REQUEST','demarches',req,{ref:'data/france-debt-rate-evolution.json#/self_model/acquisition',status:req.state});
  for(const sid of req.source_ids||[]){const source=nodes.get(sid);if(!source)continue;const gap='source:'+sid;
   add(gap,'Accès à vérifier · '+source.label,'GAP','demarches',source.data,{ref:source.ref,status:'MANQUE DOCUMENTÉ'});edge(sid,gap,'HAS_GAP');edge(req.id,gap,'ADDRESSES');}
 }}
 if(territories?.schema==='OJO_FRANCE_ORGANISM_V1'){for(const [index,r] of (territories.topology?.regions||[]).entries()){
  const id='OJO_FRANCE_ORGANISM_V1#/topology/regions/'+clean(r.code);add(id,r.name,'REGION','territoires',r,{status:'TOPOLOGIE DESCRIPTIVE',date:territories.topology.source_generated_at,ref:'data/france-organism.json#/topology/regions/'+index});edge(COUNTRY,id,'CONTAINS');
 }}
 return {nodes,edges,live,evolution:bound?evolution:null,territories,source_snapshot_id:live.snapshot_id,updated_at:live.updated_at};
}
function neighbors(graph,id){return graph.edges.filter(e=>e.from===id||e.to===id).map(e=>({node:graph.nodes.get(e.from===id?e.to:e.from),relation:e.relation,label:e.label,direction:e.from===id?'out':'in'})).filter(x=>x.node);}
function search(graph,query){const q=normalize(query).trim().slice(0,150);if(!q)return [];return [...graph.nodes.values()].filter(n=>normalize(n.label+' '+n.id+' '+n.kind).includes(q)).slice(0,30);}
function facts(node,graph){const d=node.data||{},rows=[];const add=(k,v)=>{if(v!==undefined&&v!==null&&v!=='')rows.push([k,typeof v==='object'?JSON.stringify(v):clean(v)]);};
 if(node.kind==='COUNTRY'){add('Objet canonique',COUNTRY);add('Portée','France ; pas d’imputation locale du signal national');if(graph.territories){for(const [k,v]of Object.entries(graph.territories.topology?.counts||{}))add(({regions:'Régions',departments:'Départements',epcis:'Intercommunalités',communes:'Communes'})[k]||k,v);add('Date de la topologie',graph.territories.topology?.source_generated_at);}else add('Détail territorial','Chargement à la demande, depuis le document territorial existant');}
 if(node.kind==='SYSTEM'){add('Relation','Finances publiques → dette, taux et refinancement');add('Données disponibles','Un objet instrumenté dans ce parcours ; autres politiques publiques non évaluées');}
 if(node.kind==='ORGAN'){const o=graph.live.observed||{};add('Encours négociable de l’État',Number.isFinite(o.debt_negotiable_eur)?o.debt_negotiable_eur.toLocaleString('fr-FR')+' €':null);add('Date de l’encours',o.debt_date);add('TEC10',Number.isFinite(o.tec10_pct)?o.tec10_pct.toLocaleString('fr-FR')+' %':null);add('Date du TEC10',o.tec10_date);add('Portée','La dette négociable de l’État n’est pas toute la dette publique. Le TEC10 n’est pas le coût moyen du stock.');}
 if(node.kind==='SOURCE'||node.kind==='PUBLICATION'){add('Publication / jeu de données',node.label);add('Éditeur',d.publisher);add('État',d.health);add('Dernière vérification enregistrée',d.checked_at);add('Millésime',d.vintage||d.published_through);add('Limite signalée',d.reason||d.error);add('Empreinte',d.digest);}
 if(node.kind==='CLAIM'){add('Type de donnée',d.type);add('État',d.state);add('Date',d.date);add('Unité',d.unit);if(!Array.isArray(d.value))add('Valeur du flux',d.value);add('Identifiant observation',d.observation_id);add('Transformation',d.transformation_id);add('Source de la valeur',d.metric_ref);}
 if(node.kind==='REGION'){add('Code territorial',d.code);add('Population dans le document chargé',d.population);add('Départements',d.departments);add('Intercommunalités',d.epcis);add('Communes',d.communes);add('Date de topologie',graph.territories?.topology?.source_generated_at);add('Effet local dette/taux','NON DOCUMENTÉ. Aucune répartition du taux national par région.');add('Niveau inférieur','Les nombres sont présents ; les fiches détaillées départements, EPCI et communes ne sont pas fournies par ce document.');}
 if(node.kind==='ORGANIZATION_VIEW'){add('Domaine officiel de regroupement',d.host);add('Nature','Vue des sources du flux partageant ce domaine ; pas un registre Person ou une identité ajoutée.');}
 if(node.kind==='GAP'){add('Ressource concernée',d.label);add('État enregistré',d.health);add('Vérification',d.checked_at);add('Obstacle enregistré',d.error||d.reason||'À préciser');add('Interprétation','Un accès bloqué depuis le collecteur ne prouve pas une indisponibilité pour tous les visiteurs.');}
 if(node.kind==='REQUEST'){add('Organisme',d.organization);add('État',d.state);add('Action externe',d.external_action);add('Mandat',d.mandate);add('Étape suivante',d.next_action);add('Empreinte du brouillon',d.draft_sha256);}
 if(!rows.length){add('Nature',LABELS[node.kind]||node.kind);add('Provenance',node.ref);add('Interprétation','Projection du graphe de preuve chargé ; une relation n’est pas une causalité politique.');}
 return rows;
}
function dialogueContext(node,graph){return node?{id:node.id,label:node.label,kind:node.kind,snapshot_id:graph.source_snapshot_id,version:node.kind==='REGION'?graph.territories?.topology?.source_generated_at:graph.updated_at,status:node.status||null,facts:facts(node,graph),references:neighbors(graph,node.id).filter(x=>x.node.url).map(x=>({label:x.node.label,url:x.node.url,status:x.node.status||'UNKNOWN',checked_at:x.node.date||null})).slice(0,5)}:null;}
return Object.freeze({COUNTRY,FINANCE,DEBT,UNIVERSES,LABELS,RELATIONS,route,parseRoute,build,neighbors,search,facts,dialogueContext,safeURL});
});
