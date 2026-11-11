import {finite,selectLatestMeasured,selectLatestRegions,describeFlow,simulateUsage} from './episode-04-model.mjs';

const $=id=>document.getElementById(id);
const format=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1});
const timeFormat=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const api='https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/';
const cacheKey='la-bete-episode04-observations-v1';
const filieres=[['nucleaire','Nucléaire'],['hydraulique','Hydraulique'],['eolien','Éolien'],['solaire','Solaire'],['gaz','Gaz'],['bioenergies','Bioénergies'],['charbon','Charbon'],['fioul','Fioul']];
const regionalFilieres=[['nucleaire','Nucléaire'],['hydraulique','Hydraulique'],['eolien','Éolien'],['solaire','Solaire'],['thermique','Thermique'],['bioenergies','Bioénergies']];
const borders=[['ech_comm_angleterre','Grande-Bretagne'],['ech_comm_espagne','Espagne'],['ech_comm_italie','Italie'],['ech_comm_suisse','Suisse'],['ech_comm_allemagne_belgique','Allemagne / Belgique']];
const state={national:[],regional:[],nationalFetchedAt:null,regionalFetchedAt:null,nationalError:null,regionalError:null,regions:[],loading:false};
let lastScenario=null;
const numeric=value=>finite(value)===null?'—':format.format(value);
const stamp=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?timeFormat.format(date)+' (Paris)':'Horodatage indisponible';};
const append=(parent,tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;parent.append(node);return node;};
function placeholder(id,text){const node=$(id);node.replaceChildren();append(node,'p',text,'empty');}
function flowText(value){const x=describeFlow(value);if(x.direction==='missing')return 'Indisponible';if(x.direction==='balanced')return 'Solde nul';return (x.direction==='export'?'Exportateur':'Importateur')+' · '+numeric(x.mw)+' MW';}
function status(id,row,error,threshold,fetchedAt){
 const node=$(id);node.className='status';
 if(!row){node.classList.add('failed');node.textContent=error?'Données indisponibles pour le moment. Les sources officielles restent accessibles.':'Aucune consommation mesurée et datée disponible. Les prévisions ne sont pas affichées comme des mesures.';return;}
 const age=Math.max(0,Math.floor((Date.now()-Date.parse(row.date_heure))/60000));
 const parts=['Mesure du '+stamp(row.date_heure),'âge : '+age+' min'];
 if(error){node.classList.add('failed');parts.push('Actualisation échouée : dernière mesure conservée, sans garantie d’actualité.');}
 else if(age>threshold){node.classList.add('stale');parts.push('Mesure ancienne : consulter son horodatage avant utilisation.');}
 else parts.push('Donnée provisoire, corrigible par RTE.');
 if(fetchedAt)parts.push('Lecture : '+stamp(fetchedAt));
 node.textContent=parts.join(' · ');
}
function renderMix(id,row,fields){
 const host=$(id);host.replaceChildren();
 if(!row){append(host,'p','Aucune mesure disponible.','empty');return;}
 const values=fields.map(([key,label])=>({label,value:finite(row[key])}));
 const maximum=Math.max(1,...values.map(x=>x.value??0));
 for(const x of values){const line=append(host,'div',undefined,'mix-row');append(line,'span',x.label);const rail=append(line,'div',undefined,'mix-rail');rail.setAttribute('aria-hidden','true');const bar=append(rail,'div',undefined,'mix-bar');bar.style.width=x.value===null?'0%':Math.max(0,x.value)/maximum*100+'%';append(line,'strong',numeric(x.value));}
}
function renderFlows(row){
 const host=$('flow-view');host.replaceChildren();
 for(const [key,label]of borders){const f=describeFlow(row?.[key]);const line=append(host,'div',undefined,'flow-row '+f.direction);append(line,'span','France','flow-region');const middle=append(line,'div');append(middle,'div',f.direction==='import'?'←':f.direction==='export'?'→':f.direction==='balanced'?'↔':'—','flow-arrow');append(middle,'div',({import:'Import',export:'Export',balanced:'Solde nul',missing:'Indisponible'})[f.direction],'flow-direction');const right=append(line,'div',undefined,'flow-amount');append(right,'span',label,'flow-region');append(right,'strong',f.mw===null?'—':numeric(f.mw)+' MW');}
}
function renderTrend(){
 const host=$('trend-view');host.replaceChildren();
 const now=Date.now();const points=state.national.filter(r=>selectLatestMeasured([r],now)!==null).sort((a,b)=>Date.parse(b.date_heure)-Date.parse(a.date_heure)).slice(0,48).reverse();
 if(points.length<2){append(host,'p','Historique récent indisponible.','caption');return;}
 const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 600 166');svg.setAttribute('role','img');svg.setAttribute('aria-label','Consommation électrique, de '+stamp(points[0].date_heure)+' à '+stamp(points.at(-1).date_heure)+', en mégawatts. Échelle commençant à zéro.');
 const add=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;svg.append(n);};
 const maximum=Math.ceil(Math.max(...points.map(r=>r.consommation))/10000)*10000||1;const first=Date.parse(points[0].date_heure);const span=Date.parse(points.at(-1).date_heure)-first||1;
 add('line',{x1:46,x2:587,y1:132,y2:132,stroke:'#6c8493'});add('line',{x1:46,x2:587,y1:20,y2:20,stroke:'#395062'});
 add('text',{x:0,y:24,fill:'#bac8d0','font-size':13},format.format(maximum/1000)+' GW');add('text',{x:0,y:135,fill:'#bac8d0','font-size':13},'0');
 const d=points.map((r,i)=>(i?'L':'M')+(46+(Date.parse(r.date_heure)-first)/span*541).toFixed(2)+','+(132-r.consommation/maximum*112).toFixed(2)).join(' ');
 add('path',{d,fill:'none',stroke:'#67d0bd','stroke-width':3,'stroke-linejoin':'round'});
 add('text',{x:46,y:158,fill:'#bac8d0','font-size':12},timeFormat.format(new Date(first)));add('text',{x:587,y:158,fill:'#bac8d0','font-size':12,'text-anchor':'end'},timeFormat.format(new Date(points.at(-1).date_heure)));
 host.append(svg);
}
function renderNational(){
 const row=selectLatestMeasured(state.national);status('national-status',row,state.nationalError,120,state.nationalFetchedAt);
 $('consumption').textContent=numeric(row?.consommation);$('nuclear').textContent=numeric(row?.nucleaire);$('physical').textContent=numeric(row?.ech_physiques);$('carbon').textContent=numeric(row?.taux_co2);
 $('physical-direction').textContent=row?flowText(row.ech_physiques):'Importations − exportations · MW';renderFlows(row);renderMix('mix-view',row,filieres);renderTrend();
}
function renderSelectedRegion(){
 const row=state.regions.find(r=>String(r.code_insee_region)===$('region-select').value)||null;
 status('region-status',row,state.regionalError,180,state.regionalFetchedAt);$('region-name').textContent=row?.libelle_region||'Région indisponible';$('region-consumption').textContent=numeric(row?.consommation);$('region-exchange').textContent=numeric(row?.ech_physiques);$('region-direction').textContent=flowText(row?.ech_physiques);renderMix('region-mix',row,regionalFilieres);
}
function renderRegions(){
 const previous=$('region-select').value;state.regions=selectLatestRegions(state.regional);const select=$('region-select');select.replaceChildren();
 if(!state.regions.length)append(select,'option','Données indisponibles').value='';
 for(const row of state.regions){const option=append(select,'option',row.libelle_region);option.value=String(row.code_insee_region);}
 const preferred=previous||'32';if(state.regions.some(r=>String(r.code_insee_region)===preferred))select.value=preferred;
 const tbody=$('regions-table');tbody.replaceChildren();
 for(const row of state.regions){const tr=append(tbody,'tr');append(tr,'td',row.libelle_region);append(tr,'td',numeric(row.consommation));append(tr,'td',flowText(row.ech_physiques));append(tr,'td',stamp(row.date_heure));}
 renderSelectedRegion();
}
function saveCache(){try{localStorage.setItem(cacheKey,JSON.stringify({version:1,national:state.national,regional:state.regional,nationalFetchedAt:state.nationalFetchedAt,regionalFetchedAt:state.regionalFetchedAt}));}catch{}}
function restoreCache(){try{const d=JSON.parse(localStorage.getItem(cacheKey)||'null');if(d?.version!==1)return;for(const key of['national','regional']){if(Array.isArray(d[key]))state[key]=d[key];const date=d[key+'FetchedAt'];if(typeof date==='string'&&Number.isFinite(Date.parse(date))&&Date.parse(date)<=Date.now())state[key+'FetchedAt']=date;}}catch{}}
async function getRows(dataset,limit){
 const params=new URLSearchParams({where:'consommation is not null and date_heure <= now()',order_by:'date_heure desc',limit:String(limit)});
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),18000);
 try{const response=await fetch(api+dataset+'/records?'+params,{signal:controller.signal,cache:'no-store',credentials:'omit'});if(!response.ok)throw new Error('HTTP '+response.status);const data=await response.json();if(!Array.isArray(data.results))throw new Error('Format de données inattendu');return data.results;}finally{clearTimeout(timeout);}
}
async function refresh(){
 if(state.loading||document.hidden)return;state.loading=true;$('refresh').disabled=true;$('refresh').textContent='Actualisation…';
 try{const results=await Promise.allSettled([getRows('eco2mix-national-tr',60),getRows('eco2mix-regional-tr',100)]);for(let i=0;i<2;i++){const key=i?'regional':'national';const r=results[i];if(r.status==='fulfilled'){state[key]=r.value;state[key+'FetchedAt']=new Date().toISOString();state[key+'Error']=null;}else state[key+'Error']=String(r.reason?.message||'Indisponible');}saveCache();renderNational();renderRegions();}
 finally{state.loading=false;$('refresh').disabled=false;$('refresh').textContent='Actualiser les données ↗';}
}
function download(name,data){const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
function scenarioInputs(){const result={};for(const key of['fossilMWh','electricMWh','importSharePct','fossilPrice','electricPrice','investment']){const raw=$(key).value;result[key]=raw.trim()===''?NaN:Number(raw);}return result;}
function renderScenario(){
 try{if(!$('scenario-form').checkValidity())throw new RangeError('Invalid form');const inputs=scenarioInputs();const results=simulateUsage(inputs);lastScenario={inputs,results};$('scenario-error').hidden=true;$('scenario-results').hidden=false;$('avoided-imports').textContent=numeric(results.avoidedImportedMWh);$('energy-difference').textContent=numeric(results.netEnergyMWh);$('operating-saving').textContent=numeric(results.annualOperatingSaving);$('payback').textContent=results.simplePaybackYears===null?'Non atteint':numeric(results.simplePaybackYears);return true;}
 catch{lastScenario=null;$('scenario-results').hidden=true;$('scenario-error').hidden=false;$('scenario-error').textContent='Saisissez des nombres positifs ou nuls dans toutes les cases, avec une part importée comprise entre 0 et 100 %. Les résultats précédents sont masqués.';return false;}
}
$('refresh').addEventListener('click',refresh);$('region-select').addEventListener('change',renderSelectedRegion);
$('scenario-form').addEventListener('submit',e=>{e.preventDefault();if(e.currentTarget.reportValidity())renderScenario();});$('scenario-form').addEventListener('input',renderScenario);$('reset-scenario').addEventListener('click',()=>{$('scenario-form').reset();renderScenario();});
$('export-scenario').addEventListener('click',()=>{if(renderScenario()&&$('scenario-form').reportValidity())download('la-bete-episode04-scenario.json',{kind:'SCENARIO_USER_ASSUMPTIONS_NOT_OBSERVED',version:1,exportedAt:new Date().toISOString(),...lastScenario,limitations:'Même service à vérifier. Hors entretien, financement, réseau, émissions, rebond, nouvelles dépendances et évolution des prix. Aucun modèle macroéconomique.'});});
$('export-observations').addEventListener('click',()=>download('la-bete-episode04-observations.json',{kind:'RTE_ODRE_DATED_PUBLIC_OBSERVATIONS',exportedAt:new Date().toISOString(),sourceNational:api+'eco2mix-national-tr/records',sourceRegional:api+'eco2mix-regional-tr/records',nationalFetchedAt:state.nationalFetchedAt,regionalFetchedAt:state.regionalFetchedAt,nationalError:state.nationalError,regionalError:state.regionalError,national:state.national,regional:state.regional}));
restoreCache();renderNational();renderRegions();renderScenario();refresh();
let polling=null;function schedule(){clearInterval(polling);polling=null;if(!document.hidden)polling=setInterval(refresh,15*60000);}
document.addEventListener('visibilitychange',()=>{schedule();if(!document.hidden){renderNational();renderSelectedRegion();const t=Date.parse(state.nationalFetchedAt||'');if(!Number.isFinite(t)||Date.now()-t>=15*60000)refresh();}});schedule();
