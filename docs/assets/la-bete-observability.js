/* Pure projections of the existing canonical pulse and health memory. No storage or I/O. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LaBeteObservability=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const GOOD=new Set(['LIVE_VERIFIED','CROSSCHECKED']);
const validDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const latest=values=>values.filter(validDate).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||null;
function bound(live,evolution){return !!live?.snapshot_id&&evolution?.source_snapshot_id===live.snapshot_id;}
function commercial(live,evolution){
 const p=bound(live,evolution)?evolution?.self_model?.hybrid_model?.private_services:null;
 return {state:p?.state||'UNKNOWN',onboarding:p?.customer_onboarding||'UNKNOWN',payment:p?.payment||'UNKNOWN',
 label:p?.state==='DESIGN_ONLY_NOT_FOR_SALE'?'Projet de service · non ouvert à la vente · admission et paiement fermés':'Disponibilité à vérifier · souscription fermée'};
}
function sourceRows(live,evolution){
 const memory=bound(live,evolution)?evolution?.self_model?.health_memory:null;
 return (live?.sources||[]).map(source=>{
  const issue=memory?.issues?.['source:'+source.id],t=issue?.treatment||{};
  // The bound memory may retain an older success for this same source ID.
  const history=memory?.history||[];
  const checks=history.flatMap(h=>(h.source_checks||[]).filter(s=>s.id===source.id&&s.executed&&validDate(s.checked_at)).map(s=>({...s,cycle_id:h.cycle_id})));
  const attempt=latest([source.checked_at,t.last_checked_at,...checks.map(s=>s.checked_at)]);
  const success=latest([GOOD.has(source.health)?source.checked_at:null,...checks.filter(s=>GOOD.has(s.state)).map(s=>s.checked_at)]);
  const sample=checks.filter(s=>s.checked_at===attempt)[0];
  const plan=(memory?.care_plan||[]).find(x=>x.issue_id==='source:'+source.id);
  const aft=source.id.startsWith('AFT_')&&source.health==='UNAVAILABLE';
  const escalated=!!plan?.human_gate||(t.failure_streak||0)>=3;
  return {id:source.id,label:source.label,url:source.url,health:source.health,
   last_success:success,last_attempt:attempt,last_attempt_state:sample?.state||source.health,
   attempts:t.attempts??null,recoveries:issue?.recoveries??null,
   cause:source.error|| (source.health==='RETAINED_LAST_GOOD'?'Dernier état conservé ; récupération non attestée.':'Aucune erreur enregistrée dans le manifeste.'),cause_recorded_at:source.checked_at||null,
   state:escalated?'ESCALATION_REQUIRED':source.health==='UNAVAILABLE'?'DEGRADED':'OBSERVED',
   next_strategy:aft?'Réconcilier un document officiel de même périmètre ; conserver le manque et préparer la démarche AFT existante. Aucun nouvel essai automatique ajouté.':plan?.care||'Continuer le contrôle borné du pulse existant ; comparer les dates de donnée.',
   escalation_condition:'Trois essais consécutifs sans récupération ou état chronique : revue par le responsable des données.',
   owner:'Données / exploitation · pulse existant',
   replacement:aft?'Aucun remplacement récent autorisé. Le dernier état officiel conservé reste daté et distinct.':null,
   consequence:aft?(source.id==='AFT_RSS'?'Dossier France : les nouvelles publications AFT ne sont pas couvertes par ce flux.':'Dossier France : échéancier conservé ; pas de refinancement présenté comme nouvellement vérifié.'):'Dossier France : lire la date propre à la donnée avant de réutiliser ce résultat.',
   action_route:aft?'#/objet/LA_BETE_AFT_PUBLIC_DATA_ACCESS_V1':'#/sante',
   recovery_result:issue?.status==='RECOVERED'?'Deux observations saines enregistrées ; causalité du soin non prouvée.':'Aucune récupération confirmée par cet état.'};
 });
}
function clocks(live,evolution,runner){
 return {material_at:live?.freshness?.last_material_change_at||live?.updated_at||null,
 market_date:live?.freshness?.last_market_observation_date||live?.observed?.tec10_date||null,
 presentation_at:bound(live,evolution)?evolution?.verification?.at||evolution?.updated_at||null:null,
 runner:{observed_at:runner?.observed_at||null,started_at:runner?.started_at||null,result:runner?.result||'UNKNOWN',observation:runner?.observation||'UNOBSERVED'},
 page_check_is_source_recovery:false};
}
return Object.freeze({sourceRows,clocks,commercial});
});
