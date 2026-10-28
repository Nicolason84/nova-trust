/* Espace personnel ojO. Aucun registre canonique ni moteur d'assistance.
   sha256 : fonction reprise à l'identique de LEGAD_P0/dist/vault.mjs
   (source cce732042647344175f9630cb34b802f465af22acaf249ad1631220c963e1dea).
   La conservation entre les visites est assurée sur cet appareil par IndexedDB. */
export const FORMAT='ojo-helene-space-v1';
export const MAX_FILE=8*1024*1024, MAX_TOTAL=12*1024*1024, MAX_JSON=20*1024*1024;
export async function sha256(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')}
export const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
const assert=(x,m)=>{if(!x)throw Error(m)};
const safeId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(x);
export const uid=()=>crypto.randomUUID();
export function b64(bytes){let s='';const b=new Uint8Array(bytes);for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s)}
export function un64(s){assert(typeof s==='string'&&s.length<=Math.ceil(MAX_FILE*4/3)+4&&s.length%4===0&&/^[A-Za-z0-9+/]*={0,2}$/.test(s),'Original encodé non valide.');return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
export async function original(name,type,bytes){const b=new Uint8Array(bytes);assert(b.byteLength>0&&b.byteLength<=MAX_FILE,'Chaque fichier doit contenir de 1 octet à 8 Mo.');return Object.freeze({name:String(name).slice(0,240),type:String(type||'application/octet-stream').slice(0,120),size:b.length,sha256:await sha256(b),base64:b64(b)})}
export function emptyState(){return {format:FORMAT,items:[],board:[],pinned:[],door:null}}
export async function makeItem({title='',text='',next='',files=[],links=[],demo=false}){
 assert(typeof text==='string'&&text.length<=20000,'La note est limitée à 20 000 caractères.');
 assert(text.trim()||files.length,'Ajoute quelques mots ou un fichier.');
 assert(files.length<=6,'Six fichiers au maximum par élément.');
 assert(files.reduce((n,f)=>n+f.size,0)<=MAX_TOTAL,'Les originaux de cet élément dépassent 12 Mo.');
 return {id:uid(),title:String(title.trim()||text.trim().split('\n')[0]||files[0]?.name||'Sans titre').slice(0,180),createdAt:new Date().toISOString(),originalText:text,originalTextSha256:await sha256(new TextEncoder().encode(text)),description:'',nextStep:String(next).slice(0,300),originals:files,links:[...new Set(links)],demo:Boolean(demo)};
}
export function searchItems(items,q,filter='all'){const n=normalize(q.trim());return items.filter(i=>(filter==='all'||(filter==='file'&&i.originals.length)||(filter==='note'&&!i.originals.length))&&normalize([i.title,i.originalText,i.description,...i.originals.map(f=>f.name)].join(' ')).includes(n))}
export function essential(state){return state.pinned.map(id=>state.items.find(i=>i.id===id)).filter(Boolean).slice(0,3)}
export function pin(state,id){assert(state.items.some(i=>i.id===id),'Élément introuvable.');if(state.pinned.includes(id))state.pinned=state.pinned.filter(x=>x!==id);else{assert(state.pinned.length<3,'Ton essentiel contient déjà trois éléments. Retire-en un pour faire de la place.');state.pinned.push(id)}}
export function addBoard(state,kind,text){assert(['question','objection','suggestion'].includes(kind),'Type de contribution non valide.');assert(typeof text==='string'&&text.trim()&&text.length<=4000,'Écris entre 1 et 4 000 caractères.');assert(state.board.length<100,'Ton espace peut garder 100 questions, objections ou suggestions dans cette version.');const b={id:uid(),kind,text,createdAt:new Date().toISOString(),producer:'account_visitor',delivery:'draft_only'};state.board.push(b);return b}
function textField(x,max){return typeof x==='string'&&x.length<=max}
export async function validateState(v){
 assert(v&&v.format===FORMAT&&Array.isArray(v.items)&&v.items.length<=80&&Array.isArray(v.board)&&v.board.length<=100&&Array.isArray(v.pinned)&&v.pinned.length<=3,'Format ou taille de l’export non valide.');
 assert(v.door===null||['daily','documents','understand'].includes(v.door),'Choix d’accueil non valide.');
 const ids=new Set(),boardIds=new Set();let total=0;
 for(const i of v.items){
  assert(i&&safeId(i.id)&&!ids.has(i.id),'Identifiant d’élément non valide ou dupliqué.');ids.add(i.id);
  assert(textField(i.title,180)&&textField(i.originalText,20000)&&textField(i.description,20000)&&textField(i.nextStep,300)&&typeof i.createdAt==='string'&&Number.isFinite(Date.parse(i.createdAt))&&typeof i.demo==='boolean','Métadonnées d’élément non valides.');
  assert(await sha256(new TextEncoder().encode(i.originalText))===i.originalTextSha256,'Le texte original a été altéré.');
  assert(Array.isArray(i.originals)&&i.originals.length<=6&&Array.isArray(i.links)&&i.links.length<=80,'Index d’originaux ou liens non valide.');
  for(const f of i.originals){assert(f&&textField(f.name,240)&&textField(f.type,120)&&Number.isSafeInteger(f.size)&&f.size>0&&f.size<=MAX_FILE,'Métadonnées de fichier non valides.');const b=un64(f.base64);assert(b.length===f.size&&await sha256(b)===f.sha256,'Un fichier original a été altéré.');total+=b.length;assert(total<=MAX_TOTAL,'Les originaux dépassent 12 Mo.');}
 }
 assert(new Set(v.pinned).size===v.pinned.length&&v.pinned.every(id=>ids.has(id)),'Repères épinglés non valides.');
 for(const i of v.items)assert(i.links.every(id=>ids.has(id)&&id!==i.id)&&new Set(i.links).size===i.links.length,'Un lien ne correspond pas à un élément.');
 for(const b of v.board){assert(b&&safeId(b.id)&&!boardIds.has(b.id)&&['question','objection','suggestion'].includes(b.kind)&&textField(b.text,4000)&&b.text.trim()&&typeof b.createdAt==='string'&&Number.isFinite(Date.parse(b.createdAt))&&['account_visitor','visitor_demo'].includes(b.producer)&&b.delivery==='draft_only','Contribution non valide.');boardIds.add(b.id);}
 return v;
}
export async function exportState(v){await validateState(v);const payload=JSON.stringify(v);return JSON.stringify({format:FORMAT,exportedAt:new Date().toISOString(),checksum:await sha256(new TextEncoder().encode(payload)),data:v},null,2)}
export async function importState(text){assert(typeof text==='string'&&new TextEncoder().encode(text).length<=MAX_JSON,'L’export dépasse 20 Mo.');const o=JSON.parse(text);assert([FORMAT,'ojo-helene-review-v1'].includes(o.format)&&o.data&&typeof o.checksum==='string','Ce fichier n’est pas un export de ton espace ojO.');assert(await sha256(new TextEncoder().encode(JSON.stringify(o.data)))===o.checksum,'L’export est incomplet ou a été modifié.');if(o.format==='ojo-helene-review-v1'){assert(o.data.format===o.format,'Format de l’ancien export invalide.');o.data.format=FORMAT}return validateState(o.data)}
export async function demoState(){
 const s=emptyState();
 const a=await makeItem({title:'Un coin lecture à imaginer',text:'Exemple fictif\n\nJ’aimerais un endroit calme près de la fenêtre. Garder quelques idées, sans décider tout de suite.',next:'Garder une première idée de disposition.'});
 const file=await original('Ma-liste-exemple.txt','text/plain',new TextEncoder().encode('EXEMPLE FICTIF\nMa petite liste de la semaine\n- Mettre mes idées au clair\n- Retrouver un document\n- Garder du temps libre\n'));
 const b=await makeItem({title:'Ma petite liste de la semaine',text:'Exemple fictif : une liste, son fichier original et une première étape choisie.',next:'Choisir une seule chose pour commencer.',files:[file],links:[a.id]});
 const c=await makeItem({title:'Une question à garder',text:'Exemple fictif\n\nQu’est-ce qui a réellement changé depuis la dernière présentation ?',next:'Comparer les documents et leurs dates.',links:[b.id]});
 s.items=[a,b,c].map(i=>({...i,demo:true}));s.pinned=[a.id,b.id,c.id];return s;
}
