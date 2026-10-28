/* Capability descriptions are explicit: preparation is not native execution. */
export const SERVICES=Object.freeze([
 {id:'agenda',name:'Agenda et moments à deux',icon:'calendar',available:'Agenda local et préparation de partage',pending:'Agenda commun et alertes sur les deux téléphones',steps:['Préciser le jour, l’heure et le rappel souhaité.','Choisir ce qui est personnel et ce qui concerne Nicolas.','Raccorder l’agenda et vérifier les alertes avant de les considérer actives.'],route:'agenda'},
 {id:'achats',name:'Achats · tous les articles',icon:'search',available:'Liste de besoins et recherche de produits choisie',pending:'Comparaison assistée des offres actuelles et suivi des commandes',steps:['Décrire l’article, son usage, le budget et les critères.','Comparer prix total, livraison, retours et source datée.','Valider l’article, le vendeur et le montant avant tout achat.'],route:'services'},
 {id:'mails',name:'Mes mails',icon:'mail',available:'Préparer un brouillon et ouvrir sa messagerie',pending:'Lecture, classement et suivi du propre compte d’Hélène',steps:['Choisir le compte et les messages concernés.','Préparer une réponse que tu peux relire et modifier.','Confirmer le destinataire et le texte avant l’envoi.'],route:'services'},
 {id:'contrats',name:'Contrats et abonnements',icon:'doc',available:'Conserver les originaux dans le coffre et noter une échéance',pending:'Lecture assistée, comparaison et suivi des demandes',steps:['Conserver le contrat original dans ton coffre.','Repérer avec une source les échéances, montants et conditions.','Relire toute demande de modification ou de résiliation avant son envoi.'],route:'coffre'},
 {id:'assurances',name:'Mes assurances',icon:'lock',available:'Classer mes documents et préparer mes questions',pending:'Analyse des garanties et suivi avec l’assureur choisi',steps:['Choisir le contrat, l’attestation et la question.','Distinguer ce que le document dit et ce qui doit être confirmé.','Valider tout changement, déclaration ou envoi de pièce.'],route:'coffre'},
 {id:'impots',name:'Impôts et démarches',icon:'folder',available:'Documents dans le coffre et accès au portail officiel',pending:'Assistance sur les pièces choisies et les échéances vérifiées',steps:['Garder les avis et documents utiles dans ton coffre.','Vérifier les dates et les informations sur le service officiel.','Relire toute déclaration ou demande avant transmission.'],route:'coffre'},
 {id:'banque',name:'Comptes et budget',icon:'wallet',available:'Budget saisi par toi et documents dans le coffre',pending:'Connexion bancaire personnelle avec le fournisseur autorisé',steps:['Choisir ce que tu souhaites suivre et les comptes concernés.','Conserver les relevés dans ton coffre et dater les montants.','Vérifier séparément toute connexion ou opération financière.'],route:'coffre'},
 {id:'sante',name:'Médecins et pharmacie de garde',icon:'health',available:'Fiches de médecins, documents privés et annuaire de garde',pending:'Recherche assistée selon le lieu et l’heure que tu choisis',steps:['Garder les coordonnées et originaux médicaux dans ton coffre.','Pour une pharmacie de garde, choisir le lieu et l’heure de recherche.','Vérifier l’information auprès du service de garde avant le déplacement.'],route:'coffre'},
 {id:'quotidien',name:'Le quotidien et mes idées',icon:'note',available:'Notes, originaux, phrase du jour et questions',pending:'Suggestions personnelles de CAnnoNico après son raccord',steps:['Poser tes mots ou un original sans devoir le ranger d’abord.','Choisir une proposition utile et un prochain petit pas.','Garder la main sur ce qui est conservé et partagé.'],route:'elements'}
]);
export function serviceById(id){return SERVICES.find(s=>s.id===id)||SERVICES.at(-1)}
export function chooseService(text,chosen='auto'){
 if(chosen!=='auto')return serviceById(chosen);
 const t=String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const patterns=[['sante',/pharmaci|medecin|ordonnance|sante/],['impots',/impot|fiscal|declarat/],['assurances',/assuran|mutuelle/],['banque',/banqu|compte bancaire|virement|budget|releve/],['mails',/mail|courriel|messagerie/],['contrats',/contrat|abonnement|resili/],['achats',/achat|acheter|article|commande|comparer|prix/],['agenda',/agenda|rendez-vous|calendrier|rappel|notific/]];
 return serviceById(patterns.find(([,p])=>p.test(t))?.[0]||'quotidien');
}
export async function universalRequest(text,originals=[],module='auto'){
 if(typeof text!=='string'||text.length>20000||(!text.trim()&&!originals.length))throw Error('Ajoute quelques mots ou un original.');
 if(!Array.isArray(originals)||originals.length>6||originals.reduce((n,f)=>n+f.size,0)>12*1024*1024)throw Error('Six originaux et 12 Mo maximum par demande.');
 for(const f of originals)if(!f||typeof f.name!=='string'||!Number.isSafeInteger(f.size)||f.size<=0||f.size>8*1024*1024||!/^[a-f0-9]{64}$/.test(f.sha256))throw Error('Un original est incomplet.');
 const service=chooseService(text,module);
 return {schema:'ojo-helene-universal-request-v1',id:crypto.randomUUID(),createdAt:new Date().toISOString(),producer:'browser_visitor_unverified',module:service.id,text,originals:originals.map(f=>({name:f.name,type:f.type,size:f.size,sha256:f.sha256})),links:[...new Set(text.match(/https?:\/\/[^\s<>]+/g)||[])].slice(0,20),authority:{nativeAdmission:false,transmitted:false,approvedActions:[]},status:'PREPARED_ON_DEVICE',proposal:{name:service.name,steps:[...service.steps]}};
}
export function shoppingURL(query){
 if(typeof query!=='string'||!query.trim()||query.length>500)throw Error('Décris un article de 500 caractères maximum.');
 return 'https://www.google.com/search?'+new URLSearchParams({tbm:'shop',q:query.trim()});
}
export function mailDraftURL({to='',subject='',body=''}){
 if(!/^[^\s@?&\r\n]+@[^\s@?&\r\n]+\.[^\s@?&\r\n]+$/.test(to)||to.length>254)throw Error('Vérifie l’adresse du destinataire.');
 if(typeof subject!=='string'||subject.length>180||/[\r\n]/.test(subject)||typeof body!=='string'||body.length>10000)throw Error('Vérifie l’objet et le texte du brouillon.');
 return 'mailto:'+encodeURIComponent(to).replace('%40','@')+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
}
export function monthlyBudget(income,charges){
 const cents=value=>{const text=String(value).replace(',','.');if(!/^\d{1,9}(?:\.\d{1,2})?$/.test(text))throw Error('Saisis des montants positifs avec deux décimales maximum.');const [whole,fraction='']=text.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'))};
 const a=cents(income),b=cents(charges);return {income:a/100,charges:b/100,remaining:(a-b)/100,source:'user_entered',isBankConnection:false};
}
