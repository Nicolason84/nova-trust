/* Navigation selectors over existing canonical objects. No storage, fetch or execution. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LaBeteExplorerModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const COUNTRY='OJO_FRANCE_ORGANISM_V1#/identity', FINANCE='OJO_FRANCE_ORGANISM_V1#/physiology/systems/finance', DEBT='OJO_FRANCE_DEBT_RATE_LIVE_V1';
const UNIVERSES=Object.freeze([
 {id:'territoires',label:'Territoires',subtitle:'Entrer dans les lieux',symbol:'◎'},
 {id:'finances',label:'Finances publiques',subtitle:'Lire les mécanismes',symbol:'◇'},
 {id:'sources',label:'Sources & organismes',subtitle:'Remonter à la provenance',symbol:'⌘'},
 {id:'preuves',label:'Preuves',subtitle:'Vérifier chaque affirmation',symbol:'⌁'},
 {id:'confiance',label:'Confiance & cohérence',subtitle:'Pourquoi cette information tient — et ce qui lui manque',symbol:'◫'},
 {id:'temps',label:'Temps & scénarios',subtitle:'Explorer sans prédire',symbol:'◷'},
 {id:'demarches',label:'Démarches',subtitle:'Du manque à la demande',symbol:'↗'},
 {id:'idees',label:'Questions & idées',subtitle:'Proposer, préciser, examiner',symbol:'✧'},
 {id:'etat',label:'État de La Bête',subtitle:'Mémoire, limites et présence',symbol:'◈'}]);
const COSMOS_GALAXIES=Object.freeze([
 {id:'knowledge',label:'Preuves & savoirs',kinds:Object.freeze(['SOURCE','CLAIM','DOCUMENT','ARCHIVE','VIDEO','AUDIO']),position:Object.freeze([-12,3,-3])},
 {id:'people',label:'Personnes & organisations',kinds:Object.freeze(['PERSON','ORGANIZATION','COMPANY','RELATION']),position:Object.freeze([11,4,-7])},
 {id:'territory',label:'Territoires & vivant',kinds:Object.freeze(['TERRITORY_CANDIDATE','TERRITORY_MEDIA_CANDIDATE','VERIFIED_LIVING_MEDIA']),position:Object.freeze([-7,-8,-11])},
 {id:'action',label:'Initiatives & décisions',kinds:Object.freeze(['INITIATIVE','OPPORTUNITY','DECISION','CONTRIBUTION']),position:Object.freeze([10,-7,-5])}
]);
const LABELS={CIVIC_MISSION:'Mission civique',DEPARTMENT:'Département',EPCI:'Intercommunalité',COMMUNE:'Commune',FINANCIAL_METRIC:'Donnée du flux',HORIZON:'Horizon de refinancement',HISTORICAL_OBSERVATION:'Observation datée',SCENARIO_DETAIL:'Scénario conditionnel',HEALTH_DIMENSION:'État opérationnel',INITIATIVE:'Initiative proposée',EDITORIAL_PROPOSAL:'Projet éditorial',SOURCE:'Source',PUBLICATION:'Publication',CLAIM:'Affirmation',COUNTRY:'Pays',REGION:'Région',SYSTEM:'Système',ORGAN:'Objet instrumenté',ORGANIZATION_VIEW:'Organisme · regroupement de sources',REQUEST:'Démarche préparée',GAP:'Information manquante',METRIC:'Mesure',DERIVED_METRIC:'Mesure dérivée',SCENARIO:'Scénario conditionnel',OUTPUT:'Synthèse'};
const RELATIONS={CONTAINS:'contient',INSTRUMENTED_BY:'est documenté par',PROJECTS:'est présenté dans',OBSERVES:'observe',CROSSCHECKS:'recoupe',DERIVES:'permet de dériver',PARAMETERIZES:'paramètre',INFORMS:'informe',STRESSES:'applique un scénario à',SOURCE_FOR:'documente',PUBLISHED_BY:'est publié par',HAS_GAP:'présente un manque',ADDRESSES:'cherche à résoudre',PART_OF:'fait partie de',MEMBER_OF:'est membre de',RECORDED_AT:'est observé à la date',HAS_HORIZON:'est décrit à l’horizon',HAS_SCENARIO:'est exploré selon',HAS_STATE:'décrit son état',PROPOSES:'propose d’examiner'};
const clean=x=>String(x??'');
const normalize=x=>clean(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function safeURL(value){try{const u=new URL(value);const allowed=['www.aft.gouv.fr','www.banque-france.fr','webstat.banque-france.fr','data.economie.gouv.fr','www.assemblee-nationale.fr','www.insee.fr','geo.api.gouv.fr','www.data.gouv.fr','www.economie.gouv.fr','lannuaire.service-public.gouv.fr','www.nogentsuroise.fr','nicolason84.github.io','github.com'];return u.protocol==='https:'&&!u.username&&!u.password&&allowed.includes(u.hostname)?u.href:null;}catch(_){return null;}}
function route(kind,id,snapshot){const path=kind==='objet'?'#/objet/'+encodeURIComponent(id):kind==='univers'?'#/univers/'+encodeURIComponent(id):'#/'+kind;return path+(snapshot?'?snapshot='+encodeURIComponent(snapshot):'');}
function parseRoute(hash){
 try{const raw=clean(hash)||'#/atlas';const index=raw.indexOf('?');const parts=(index<0?raw:raw.slice(0,index)).replace(/^#\/?/,'').split('/').map(decodeURIComponent);const q=new URLSearchParams(index<0?'':raw.slice(index+1));const snapshot=q.get('snapshot');if(snapshot&&!/^OJO-[A-Za-z0-9-]{1,100}$/.test(snapshot))return {kind:'invalid'};
 if(parts[0]==='objet'&&parts.length===2&&parts[1]&&parts[1].length<500)return {kind:'objet',id:parts[1],snapshot};
 if(parts[0]==='univers'&&parts.length===2&&UNIVERSES.some(u=>u.id===parts[1]))return {kind:'univers',id:parts[1],snapshot};
 if(['atlas','public','agir','scic','services','lecture','presence','analyse','horizons','chronologie','sante','mobile','prive'].includes(parts[0])&&parts.length===1)return {kind:parts[0],snapshot};
 return {kind:'invalid'};
 }catch(_){return {kind:'invalid'};}
}
function build(live,evolution,territories,topology=null,communeShards=new Map()){
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
 // Recover already documented fields as object views, not new estimates.
 const metrics=[
 ['debt_negotiable_eur','Encours négociable de l’État','€','debt_date','OBSERVED','AFT_SNAPSHOT'],
 ['debt_avg_life_years','Vie moyenne du stock · années','années','debt_avg_life_date','OBSERVED','AFT_SNAPSHOT'],
 ['weighted_oat_issuance_pct','Taux moyen pondéré des émissions OAT','%','weighted_oat_date','OBSERVED','AFT_SNAPSHOT'],
 ['financing_need_2027_bne','Besoin de financement · millésime 2027','Md€',null,'OFFICIAL_BUDGET_VINTAGE','AFT_SNAPSHOT'],
 ['issuance_mlt_2027_bne','Émissions à moyen et long terme · millésime 2027','Md€',null,'OFFICIAL_BUDGET_VINTAGE','AFT_SNAPSHOT'],
 ['debt_charge_2027_bne','Charge de la dette · hypothèse budgétaire 2027','Md€',null,'OFFICIAL_BUDGET_VINTAGE','AFT_SNAPSHOT'],
 ['debt_charge_2026_bne','Charge de la dette · hypothèse budgétaire 2026','Md€',null,'OFFICIAL_BUDGET_VINTAGE','AFT_SNAPSHOT'],
 ['plf2026_end_2026_10y_assumption_pct','Hypothèse de taux à 10 ans · PLF 2026','%',null,'BUDGET_ASSUMPTION','PAP2026']];
 for(const [key,label,unit,dateKey,type,source]of metrics){if(!Number.isFinite(live.observed?.[key]))continue;const id=DEBT+'#/observed/'+key;
  add(id,label,'FINANCIAL_METRIC','finances',{key,value:live.observed[key],unit,type,date:dateKey?live.observed[dateKey]:null,source},{ref:'data/france-debt-rate-live.json#/observed/'+key,status:type,date:dateKey?live.observed[dateKey]:null});edge(id,DEBT,'INFORMS');if(nodes.has(source))edge(source,id,'SOURCE_FOR');}
 for(const v of live.refinancing_twin?.views||[]){const id=DEBT+'#/refinancing_twin/views/'+v.horizon_months;
  add(id,'Refinancement · '+v.horizon_months+' mois','HORIZON','finances',v,{ref:'data/france-debt-rate-live.json#/refinancing_twin',status:v.coverage,date:live.refinancing_twin.as_of});edge(DEBT,id,'HAS_HORIZON');if(nodes.has('MATURITY_LADDER'))edge('MATURITY_LADDER',id,'INFORMS');}
 for(const h of live.curve_history||[]){if(!/^\d{4}-\d{2}-\d{2}$/.test(h.date||''))continue;const id=DEBT+'#/curve_history/'+h.date;
  add(id,'Courbe des taux · '+h.date,'HISTORICAL_OBSERVATION','temps',h,{ref:'data/france-debt-rate-live.json#/curve_history',status:'OBSERVED_HISTORY',date:h.date});edge('TEC_CURVE',id,'RECORDED_AT');}
 for(const [key,x] of Object.entries(live.sensitivity?.stress_shapes||{})){const id=DEBT+'#/sensitivity/stress_shapes/'+key;
  add(id,x.label||key,'SCENARIO_DETAIL','temps',{...x,key},{ref:'data/france-debt-rate-live.json#/sensitivity/stress_shapes/'+key,status:'STRESS_NOT_FORECAST'});edge(DEBT,id,'HAS_SCENARIO');}
 const pub=live.budget_execution;if(pub?.url_fichier&&safeURL(pub.url_fichier)){const id=DEBT+'#/budget_execution';add(id,pub.titre_document||'Situation mensuelle de l’État','PUBLICATION','preuves',pub,{ref:'data/france-debt-rate-live.json#/budget_execution',url:safeURL(pub.url_fichier),status:pub.publication_date_state,date:pub.date_publication});if(nodes.has('DGFIP_EXECUTION'))edge('DGFIP_EXECUTION',id,'SOURCE_FOR');}
 if(bound){for(const d of evolution.self_model?.wellbeing?.dimensions||[]){const id='OJO_LA_BETE_OPERATIONAL_SELF_MODEL_V1#/wellbeing/'+d.id;add(id,d.label,'HEALTH_DIMENSION','etat',d,{ref:'data/france-debt-rate-evolution.json#/self_model/wellbeing',status:d.state,date:evolution.updated_at});edge(DEBT,id,'HAS_STATE');}
  const civic=evolution.self_model?.acquisition?.civic_mission;if(civic?.id==='LA_BETE_CIVIC_MISSION_V1'&&civic.external_authority_granted===false){add(civic.id,civic.title,'CIVIC_MISSION','idees',civic,{ref:'data/france-debt-rate-evolution.json#/self_model/acquisition/civic_mission',status:civic.status});edge(DEBT,civic.id,'INFORMS');}
  for(const x of evolution.self_model?.acquisition?.initiatives||[]){add(x.id,x.title,x.kind==='EDITORIAL'?'EDITORIAL_PROPOSAL':'INITIATIVE',x.kind==='EDITORIAL'?'idees':'demarches',x,{ref:'data/france-debt-rate-evolution.json#/self_model/acquisition/initiatives',status:x.state});edge(DEBT,x.id,'PROPOSES');}
 }
 const detail=topology?.detail?.schema==='OJO_FRANCE_TOPOLOGY_DETAIL_V1'?topology.detail:null;
 if(detail){
  for(const d of detail.departments||[]){const id=TOPO+'#/departments/'+d.code;add(id,d.name,'DEPARTMENT','territoires',d,{ref:'data/france-topology.json#/detail/departments',url:'https://geo.api.gouv.fr/departements/'+d.code,status:detail.health,date:detail.observed_at});const region='OJO_FRANCE_ORGANISM_V1#/topology/regions/'+d.region_code;if(nodes.has(region))edge(region,id,'CONTAINS');}
  for(const e of detail.epcis||[]){const id=TOPO+'#/epcis/'+e.code;add(id,e.name,'EPCI','territoires',e,{ref:'data/france-topology.json#/detail/epcis',url:'https://geo.api.gouv.fr/epcis/'+e.code,status:detail.health,date:detail.observed_at});for(const dep of e.member_department_codes||[])if(nodes.has(TOPO+'#/departments/'+dep))edge(TOPO+'#/departments/'+dep,id,'INFORMS');}
 }
 return {nodes,edges,live,evolution:bound?evolution:null,territories,topology,detail,communeShards:new Map(communeShards),source_snapshot_id:live.snapshot_id,updated_at:live.updated_at};
}
const TOPO='OJO_FRANCE_TOPOLOGY_V2';
const indexCache=new WeakMap();
function communeIndex(detail){if(!detail)return new Map();if(!indexCache.has(detail))indexCache.set(detail,new Map(detail.commune_index.map(r=>[r[0],r])));return indexCache.get(detail);}
function resolveNode(g,id){if(g.nodes.has(id))return g.nodes.get(id);const prefix=TOPO+'#/communes/';if(!id?.startsWith(prefix)||!g.detail)return null;const code=id.slice(prefix.length),r=communeIndex(g.detail).get(code);if(!r)return null;
 const shard=g.communeShards.get(r[2]);const full=shard?.communes?.find(c=>c.code===code);const d=full||{code:r[0],name:r[1],department_code:r[2],region_code:r[3],epci_code:r[4],index_only:true};return {id,label:r[1],kind:'COMMUNE',universe:'territoires',data:d,ref:g.detail.shards[r[2]]?.path+'#/communes/'+code,url:'https://geo.api.gouv.fr/communes/'+code,status:full?g.detail.health:'INDEX_ONLY',date:g.detail.observed_at};}
function neighbors(graph,id){const result=graph.edges.filter(e=>e.from===id||e.to===id).map(e=>({node:resolveNode(graph,e.from===id?e.to:e.from),relation:e.relation,label:e.label,direction:e.from===id?'out':'in'})).filter(x=>x.node);
 const n=resolveNode(graph,id);const append=(other,relation,direction)=>{const node=resolveNode(graph,other);if(node)result.push({node,relation,label:RELATIONS[relation]||relation,direction});};
 if(n?.kind==='COMMUNE'){append(TOPO+'#/departments/'+n.data.department_code,'CONTAINS','in');append('OJO_FRANCE_ORGANISM_V1#/topology/regions/'+n.data.region_code,'CONTAINS','in');if(n.data.epci_code)append(TOPO+'#/epcis/'+n.data.epci_code,'MEMBER_OF','out');}
 if(n&&['DEPARTMENT','EPCI'].includes(n.kind)){for(const r of graph.detail?.commune_index||[])if(n.kind==='DEPARTMENT'?r[2]===n.data.code:r[4]===n.data.code)append(TOPO+'#/communes/'+r[0],n.kind==='DEPARTMENT'?'CONTAINS':'MEMBER_OF',n.kind==='DEPARTMENT'?'out':'in');}
 return result;
}
function search(graph,query){const q=normalize(query).trim().slice(0,150);if(!q)return [];const found=[...graph.nodes.values()].filter(n=>normalize(n.label+' '+n.id+' '+n.kind).includes(q));for(const r of graph.detail?.commune_index||[])if(normalize(r[1]+' '+r[0]).includes(q)){found.push(resolveNode(graph,TOPO+'#/communes/'+r[0]));if(found.length>=200)break;}return found.slice(0,200);}
function facts(node,graph){const d=node.data||{},rows=[];const add=(k,v)=>{if(v!==undefined&&v!==null&&v!=='')rows.push([k,typeof v==='object'?JSON.stringify(v):clean(v)]);};
 if(node.kind==='COUNTRY'){add('Objet canonique',COUNTRY);add('Portée','France ; pas d’imputation locale du signal national');if(graph.territories){for(const [k,v]of Object.entries(graph.territories.topology?.counts||{}))add(({regions:'Régions',departments:'Départements',epcis:'Intercommunalités',communes:'Communes'})[k]||k,v);add('Date de la topologie',graph.territories.topology?.source_generated_at);}else add('Détail territorial','Chargement à la demande, depuis le document territorial existant');}
 if(node.kind==='SYSTEM'){add('Relation','Finances publiques → dette, taux et refinancement');add('Données disponibles','Un objet instrumenté dans ce parcours ; autres politiques publiques non évaluées');}
 if(node.kind==='ORGAN'){const o=graph.live.observed||{};add('Encours négociable de l’État',Number.isFinite(o.debt_negotiable_eur)?o.debt_negotiable_eur.toLocaleString('fr-FR')+' €':null);add('Date de l’encours',o.debt_date);add('TEC10',Number.isFinite(o.tec10_pct)?o.tec10_pct.toLocaleString('fr-FR')+' %':null);add('Date du TEC10',o.tec10_date);add('Portée','La dette négociable de l’État n’est pas toute la dette publique. Le TEC10 n’est pas le coût moyen du stock.');}
 if(node.kind==='SOURCE'||node.kind==='PUBLICATION'){add('Publication / jeu de données',node.label);add('Éditeur',d.publisher);add('État',d.health);add('Dernière vérification enregistrée',d.checked_at);add('Millésime',d.vintage||d.published_through);add('Limite signalée',d.reason||d.error);add('Empreinte',d.digest);add('Période du document',d.period);add('Date de publication réconciliée',d.date_publication);add('État de réconciliation',d.publication_date_state);}
 if(node.kind==='CLAIM'){add('Type de donnée',d.type);add('État',d.state);add('Date',d.date);add('Unité',d.unit);if(!Array.isArray(d.value))add('Valeur du flux',d.value);add('Identifiant observation',d.observation_id);add('Transformation',d.transformation_id);add('Source de la valeur',d.metric_ref);}
 if(node.kind==='REGION'){add('Code territorial',d.code);add('Population dans le document chargé',d.population);add('Départements',d.departments);add('Intercommunalités',d.epcis);add('Communes',d.communes);add('Date de topologie',graph.territories?.topology?.source_generated_at);add('Effet local dette/taux','NON DOCUMENTÉ. Aucune répartition du taux national par région.');add('Niveau inférieur',graph.detail?'Départements, intercommunalités et communes sont reliés au référentiel détaillé ; les fiches communales se chargent à la demande.':'Les détails ne sont pas encore chargés ; ouvrir l’univers territorial.');}
 if(node.kind==='ORGANIZATION_VIEW'){add('Domaine officiel de regroupement',d.host);add('Nature','Vue des sources du flux partageant ce domaine ; pas un registre Person ou une identité ajoutée.');}
 if(node.kind==='GAP'){add('Ressource concernée',d.label);add('État enregistré',d.health);add('Vérification',d.checked_at);add('Obstacle enregistré',d.error||d.reason||'À préciser');add('Interprétation','Un accès bloqué depuis le collecteur ne prouve pas une indisponibilité pour tous les visiteurs.');}
 if(node.kind==='REQUEST'){add('Organisme',d.organization);add('État',d.state);add('Action externe',d.external_action);add('Mandat',d.mandate);add('Étape suivante',d.next_action);add('Empreinte du brouillon',d.draft_sha256);}
 if(node.kind==='DEPARTMENT'){add('Code département',d.code);add('Région',d.region_code);add('Communes dans le périmètre COG',d.commune_count);add('EPCI reliés par leurs communes',d.epci_codes?.length);add('Population agrégée des communes API',d.population_sum);add('Méthode population','Somme des populations présentes ; millésime non fourni par cette réponse API, ne pas assimiler à un recensement daté.');add('Effet local dette/taux','NON DOCUMENTÉ');}
 if(node.kind==='EPCI'){add('Code SIREN de l’intercommunalité',d.code);add('Type API',d.type);add('Population API',d.population);add('Communes du périmètre COG',d.member_count_in_cog_scope);add('Départements des communes membres',d.member_department_codes?.join(', '));add('Régions des communes membres',d.member_region_codes?.join(', '));add('Portée','Les EPCI peuvent traverser les limites départementales. Le catalogue API n’est pas le décompte des seuls EPCI à fiscalité propre.');add('Effet local dette/taux','NON DOCUMENTÉ');}
 if(node.kind==='COMMUNE'){add('Code Insee',d.code);add('Département',d.department_code);add('Région',d.region_code);add('Intercommunalité',d.epci_code||'NON RENSEIGNÉ');if(d.index_only){add('Détails','NON CHARGÉS : la fiche ne contient ici que les identifiants du catalogue.');}else{add('Population dans la réponse API',d.population);add('Millésime de population','NON FOURNI dans cette réponse ; la date de collecte n’est pas le millésime démographique.');add('Codes postaux',d.postal_codes?.join(', '));add('SIREN',d.siren);add('Surface brute API',d.surface_api);add('Unité de surface','À vérifier dans le dictionnaire source ; aucune conversion implicite.');add('Centre géographique [longitude, latitude]',d.center);add('Date de collecte',graph.detail?.observed_at);}add('Effet local dette/taux','NON DOCUMENTÉ. Aucune inférence à partir du taux national.');}
 if(node.kind==='FINANCIAL_METRIC'){add('Valeur',d.value);add('Unité',d.unit);add('Type',d.type);add('Date propre au champ',d.date||'Se reporter au millésime de la publication');add('Portée','Valeur du flux existant. Une hypothèse budgétaire n’est pas un résultat exécuté.');}
 if(node.kind==='HORIZON'){add('Horizon',d.horizon_months+' mois');add('Encours échéant (Md€)',d.maturity_stock_bne);add('Couverture',d.coverage);add('Années réellement incluses',d.included_years?.join(', '));add('Besoin de financement (Md€)',d.financing_need_bne??'UNKNOWN');add('Périmètre du besoin',d.financing_need_scope);add('Limite','Encours à échéance ≠ besoin total. Couverture partielle conservée explicitement.');}
 if(node.kind==='HISTORICAL_OBSERVATION'){add('Date de marché',d.date);add('Collecté à',d.captured_at);add('Points de courbe',d.curve?.length);for(const p of d.curve||[])add(p.tenor_years+' ans',p.rate_pct+' %');add('Portée','Observation historique, non prévision.');}
 if(node.kind==='SCENARIO_DETAIL'){add('Scénario',d.label||d.key);add('Géométrie des chocs (points de base)',d.tenor_shock_bps);add('Nature','STRESS CONDITIONNEL, PAS UNE PRÉVISION');add('Montant budgétaire',d.key==='parallel'?'Voir la sensibilité officielle parallèle, à son millésime.':'UNKNOWN : aucun montant publié pour cette forme dans le flux.');}
 if(node.kind==='HEALTH_DIMENSION'){add('État opérationnel',d.state);add('Éléments constatés',d.evidence);add('Portée','Description du système et de ses sources, pas un diagnostic des personnes ou du pays.');}
 if(['INITIATIVE','EDITORIAL_PROPOSAL'].includes(node.kind)){add('Objectif',d.purpose);add('État',d.state);add('Pourquoi cette initiative',d.trigger);add('Canal envisagé',d.channel);add('Action externe',d.external_action);add('Validation nécessaire',d.approval_required);add('Étape suivante',d.next_action);}
 if(node.kind==='CIVIC_MISSION'){add('Mission',d.mission);add('Autorité',d.authority);add('Limites',d.limits);add('Capacité actuelle',d.current_execution);add('Résultats de défense individuelle revendiqués',d.outcomes_verified);add('Périmètre',d.outcomes_scope);}
 if(d.civic_contract){const c=d.civic_contract;add('Personnes concernées',c.beneficiaries);add('Origine du besoin',c.need_status);add('Bénéfice à vérifier',c.benefit_to_verify);add('Coûts et arbitrages',c.costs_and_tradeoffs);add('Résultat vérifié',c.verified_result);add('Mandat de représentation',c.representation_mandate);}
 if(!rows.length){add('Nature',LABELS[node.kind]||node.kind);add('Provenance',node.ref);add('Interprétation','Projection du graphe de preuve chargé ; une relation n’est pas une causalité politique.');}
 return rows;
}
function dialogueContext(node,graph){return node?{id:node.id,label:node.label,kind:node.kind,snapshot_id:graph.source_snapshot_id,version:['REGION','DEPARTMENT','EPCI','COMMUNE'].includes(node.kind)?(graph.detail?.snapshot_id||graph.territories?.topology?.source_generated_at):graph.updated_at,status:node.status||null,facts:facts(node,graph),references:neighbors(graph,node.id).filter(x=>x.node.url).map(x=>({label:x.node.label,url:x.node.url,status:x.node.status||'UNKNOWN',checked_at:x.node.date||null})).slice(0,5)}:null;}
function cosmosTruthState(objectId,obj,graph){
 const raw=String(objectId||'').replace(/^(source|claim):/,'');
 const node=graph?.nodes?.get?.(raw),values=[node?.data?.type,node?.data?.state,node?.status,obj?.evidence_state].map(x=>String(x||'').toUpperCase());
 if(values.includes('RETAINED_LAST_GOOD'))return 'RETAINED_LAST_GOOD';
 if(values.includes('UNAVAILABLE'))return 'SOURCE_UNAVAILABLE';
 for(const truth of ['OBSERVED','DERIVED','HYPOTHESIS','STRESS','UNKNOWN'])if(values.some(x=>x===truth||x.startsWith(truth+'_')||x.endsWith('_'+truth)||x.includes('_'+truth+'_')))return truth;
 return 'UNSPECIFIED';
}
function spatialProjection(graph,evidence){
 if(!graph||!evidence||evidence.schema!=='LA_BETE_EVIDENCE_UNIVERSE_V1'||evidence.state!=='READ_ONLY_PUBLIC_PROOFGRAPH_DERIVED_PROJECTION')throw Error('COSMOS_EVIDENCE_UNIVERSE_REQUIRED');
 const contract=evidence.contract||{},model=evidence.object_model||{},objects=evidence.objects||{},entries=Object.entries(objects);
 if(model.single_registry!==true||contract.proofgraph_is_spine!==true||contract.second_runtime!==false||contract.second_registry!==false||contract.second_scheduler!==false||entries.length!==(evidence.coverage?.objects_total||-1))throw Error('COSMOS_SINGLE_REGISTRY_CONTRACT');
 const kindToGalaxy=new Map();for(const galaxy of COSMOS_GALAXIES)for(const kind of galaxy.kinds)kindToGalaxy.set(kind,galaxy.id);
 const galaxyMap=new Map(COSMOS_GALAXIES.map(g=>[g.id,{id:g.id,label:g.label,position:[...g.position],systems:[],planet_count:0}]));
 const systemMap=new Map(),planets=[],planetById=new Map(),kindOrder=new Map((model.supported_kinds||[]).map((k,i)=>[k,i])),byGalaxy=new Map(COSMOS_GALAXIES.map(g=>[g.id,[]]));
 for(const [objectId,obj] of entries){const galaxyId=kindToGalaxy.get(obj.kind);if(!galaxyId)throw Error('COSMOS_UNMAPPED_KIND:'+obj.kind);if(obj.object_id!==objectId)throw Error('COSMOS_OBJECT_IDENTITY_MISMATCH:'+objectId);byGalaxy.get(galaxyId).push([objectId,obj]);}
 for(const galaxy of COSMOS_GALAXIES){
  const rows=byGalaxy.get(galaxy.id).sort((a,b)=>(kindOrder.get(a[1].kind)??999)-(kindOrder.get(b[1].kind)??999)||a[0].localeCompare(b[0])),kinds=[...new Set(rows.map(x=>x[1].kind))];
  kinds.forEach((kind,si)=>{const systemId='system:'+galaxy.id+':'+kind.toLowerCase(),angle=(Math.PI*2*si/Math.max(1,kinds.length))+.33,gp=galaxy.position,system={id:systemId,galaxy_id:galaxy.id,kind,label:(LABELS[kind]||kind.replaceAll('_',' ')),position:[gp[0]+Math.cos(angle)*4.2,gp[1]+Math.sin(angle)*3.2,gp[2]+Math.sin(angle*.7)*2.2],planet_ids:[]};systemMap.set(systemId,system);galaxyMap.get(galaxy.id).systems.push(systemId);
   const same=rows.filter(x=>x[1].kind===kind);same.forEach(([objectId,obj],pi)=>{const orbit=1.05+Math.floor(pi/20)*.34,pa=pi*2.399963229728653+si*.71,pos=[system.position[0]+Math.cos(pa)*orbit,system.position[1]+Math.sin(pa)*orbit*.72,system.position[2]+Math.sin(pa*.63)*orbit*.58],planet={id:'planet:'+objectId,object_id:objectId,label:obj.label,kind:obj.kind,galaxy_id:galaxy.id,system_id:systemId,position:pos,object:obj,truth_state:cosmosTruthState(objectId,obj,graph),canonical_route:null},raw=objectId.replace(/^(source|claim):/,'');if(graph.nodes?.has(raw))planet.canonical_route=route('objet',raw);planets.push(planet);planetById.set(objectId,planet);system.planet_ids.push(objectId);galaxyMap.get(galaxy.id).planet_count++;});});
 }
 function resolveObjectRef(ref){const raw=clean(ref);if(!raw)return null;if(planetById.has(raw))return raw;for(const prefix of ['source:','claim:','document:','person:','organization:','company:','initiative:','opportunity:','decision:','video:','audio:','archive:','contribution:','relation:'])if(planetById.has(prefix+raw))return prefix+raw;return null;}
 const moons=[],moonKeys=new Set(),wormholes=[],wormholeKeys=new Set();
 for(const planet of planets){const obj=planet.object,proofs=Array.isArray(obj.proofgraph?.proof_refs)?obj.proofgraph.proof_refs:[],refs=Array.isArray(obj.object_refs)?obj.object_refs:[];
  proofs.forEach((proofRef,i)=>{const key=planet.object_id+'|'+proofRef;if(moonKeys.has(key))return;moonKeys.add(key);const a=i*2.399963229728653+.4,r=1.38+(i%4)*.12,target=resolveObjectRef(proofRef);moons.push({id:'moon:'+planet.object_id+':'+i,planet_id:planet.object_id,proof_ref:clean(proofRef),target_object_id:target,position:[planet.position[0]+Math.cos(a)*r,planet.position[1]+Math.sin(a)*r*.55,planet.position[2]+Math.sin(a*.7)*r*.48]});if(target&&target!==planet.object_id){const wk=planet.object_id+'|'+target+'|PROOF_REF';if(!wormholeKeys.has(wk)){wormholeKeys.add(wk);wormholes.push({id:'wormhole:'+wormholes.length,from_object_id:planet.object_id,to_object_id:target,relation:'PROOF_REF',proof_ref:clean(proofRef)});}}});
  refs.forEach(ref=>{const target=resolveObjectRef(ref);if(!target||target===planet.object_id)return;const wk=planet.object_id+'|'+target+'|OBJECT_REF';if(wormholeKeys.has(wk))return;wormholeKeys.add(wk);wormholes.push({id:'wormhole:'+wormholes.length,from_object_id:planet.object_id,to_object_id:target,relation:'OBJECT_REF',proof_ref:null});});
 }
 const preferred=wormholes.find(w=>w.relation==='PROOF_REF'&&w.from_object_id.startsWith('claim:')&&w.to_object_id.startsWith('source:'))||wormholes.find(w=>w.relation==='PROOF_REF')||wormholes[0]||null;let traversal=null;
 if(preferred){const from=planetById.get(preferred.from_object_id),to=planetById.get(preferred.to_object_id),moon=moons.find(m=>m.planet_id===from.object_id&&(m.proof_ref===preferred.proof_ref||m.target_object_id===to.object_id));traversal={galaxy_id:from.galaxy_id,system_id:from.system_id,planet_id:from.object_id,moon_id:moon?.id||null,proof_ref:preferred.proof_ref,wormhole_id:preferred.id,target_object_id:to.object_id,target_galaxy_id:to.galaxy_id,target_system_id:to.system_id};}
 return Object.freeze({schema:'LA_BETE_COSMOS_SPATIAL_PROJECTION_V1',state:'DERIVED_VIEW_ONLY',source_projection_fingerprint:evidence.projection_fingerprint,contract:Object.freeze({second_runtime:false,second_registry:false,second_scheduler:false,proofgraph_is_spine:true,persistent_spatial_registry:false,truth_mutation:false}),galaxies:[...galaxyMap.values()],systems:[...systemMap.values()],planets,moons,wormholes,traversal,planetById});
}
return Object.freeze({COUNTRY,FINANCE,DEBT,UNIVERSES,COSMOS_GALAXIES,LABELS,RELATIONS,route,parseRoute,build,resolveNode,communeIndex,TOPO,neighbors,search,facts,dialogueContext,spatialProjection,safeURL});
});
