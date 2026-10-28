/* Local agenda and editorial phrases. No network, delivery or scheduler. */
export const PHRASES=Object.freeze([
  'Tu peux avancer doucement et avancer quand même.',
  'Une chose à la fois, c’est déjà une direction.',
  'Tu as le droit de garder du temps pour toi.',
  'Une petite joie a toute sa place dans une journée.',
  'Tu peux commencer sans avoir tout prévu.',
  'Ce que tu fais aujourd’hui peut simplement te faciliter demain.',
  'Tu peux changer d’avis et choisir autrement.',
  'Les jours tranquilles comptent aussi.',
  'Tu n’as pas à tout porter en même temps.',
  'Un petit pas choisi vaut la peine d’être reconnu.',
  'Ton rythme mérite d’être respecté.',
  'Tu peux laisser une place à ce qui te fait du bien.',
  'Faire une pause fait aussi partie du chemin.',
  'Un moment partagé peut rendre la journée plus légère.',
  'Tu as le droit de dire ce dont tu as besoin.',
  'Aujourd’hui peut commencer par quelque chose de simple.',
  'Tes questions ont leur place.',
  'Tu peux être fière des petites choses accomplies.',
  'Il reste de la place pour une bonne surprise.',
  'Prendre soin de toi mérite une place dans ton agenda.',
  'Tu peux choisir ce que tu gardes et ce que tu laisses.',
  'Tu n’as pas besoin de tout réussir pour apprécier ta journée.',
  'Un peu de douceur peut suffire pour commencer.',
  'Les moments ordinaires peuvent devenir de bons souvenirs.',
  'Tu peux demander de l’aide avec tes propres mots.',
  'Ce qui compte pour toi mérite ton attention.',
  'Tu peux faire de la place à une envie, même petite.',
  'Tes efforts existent, même quand ils sont discrets.',
  'Tu peux te laisser le temps de comprendre.',
  'Cette journée t’appartient aussi.'
]);
const check=(v,m)=>{if(!v)throw Error(m)};
export function dayKey(date=new Date()){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')}
export function phraseForDay(day=dayKey()){
  check(/^\d{4}-\d{2}-\d{2}$/.test(day),'Date non valide.');
  return PHRASES[Math.floor(Date.parse(day+'T12:00:00Z')/86400000)%PHRASES.length];
}
function wallTime(value){
  check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value),'Choisis une date et une heure.');
  const date=new Date(value);
  check(Number.isFinite(date.getTime())&&dayKey(date)+'T'+String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0')===value,'Cette date ou cette heure n’existe pas dans le fuseau de ton appareil.');
  return date;
}
export function makeAppointment({title,start,end,place='',note='',kind='personal',attendee='',reminder=30,id=crypto.randomUUID(),createdAt=new Date().toISOString()}){
  check(typeof title==='string'&&title.trim()&&title.length<=180,'Donne un titre de 180 caractères maximum.');
  check(['personal','together'].includes(kind),'Choisis personnel ou à deux.');
  check(typeof place==='string'&&place.length<=300&&typeof note==='string'&&note.length<=4000,'Le lieu ou les précisions sont trop longs.');
  check(typeof attendee==='string'&&attendee.length<=254&&(!attendee||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee)),'Vérifie l’adresse de la personne à inviter.');
  reminder=reminder===null?null:Number(reminder);check([null,0,10,30,60,1440].includes(reminder),'Choisis un délai de rappel proposé.');
  const a=wallTime(start),b=wallTime(end);check(b>a&&b-a<=7*86400000,'La fin doit suivre le début, avec une durée de sept jours maximum.');
  return {id,title:title.trim(),start,end,startUTC:a.toISOString(),endUTC:b.toISOString(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Paris',place,note,kind,attendee:kind==='together'?attendee.trim():'',reminder,createdAt,updatedAt:new Date().toISOString(),delivery:'local_only'};
}
export function validateAppointments(items){
  check(Array.isArray(items)&&items.length<=200,'L’agenda peut garder 200 rendez-vous dans cette version.');
  const ids=new Set();
  for(const i of items){
    check(i&&typeof i.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(i.id)&&!ids.has(i.id),'Identifiant de rendez-vous non valide ou dupliqué.');ids.add(i.id);
    check(typeof i.title==='string'&&i.title.trim()&&i.title.length<=180&&typeof i.place==='string'&&i.place.length<=300&&typeof i.note==='string'&&i.note.length<=4000,'Rendez-vous incomplet.');
    check(['personal','together'].includes(i.kind)&&typeof i.attendee==='string'&&i.attendee.length<=254&&(!i.attendee||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.attendee))&&[null,0,10,30,60,1440].includes(i.reminder)&&i.delivery==='local_only','Choix de partage ou de rappel non valide.');
    check(typeof i.start==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(i.start)&&typeof i.end==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(i.end),'Dates de rendez-vous non valides.');
    const a=Date.parse(i.startUTC),b=Date.parse(i.endUTC);
    check(Number.isFinite(a)&&Number.isFinite(b)&&b>a&&b-a<=7*86400000&&typeof i.timeZone==='string'&&i.timeZone.length<=100,'Heures du rendez-vous non valides.');
    try{const wall=iso=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:i.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso));const get=k=>parts.find(p=>p.type===k).value;return get('year')+'-'+get('month')+'-'+get('day')+'T'+get('hour')+':'+get('minute')};check(wall(i.startUTC)===i.start&&wall(i.endUTC)===i.end,'Dates et fuseau du rendez-vous incohérents.')}catch(e){throw Error(e.message==='Dates et fuseau du rendez-vous incohérents.'?e.message:'Fuseau horaire non valide.')}
    check(typeof i.createdAt==='string'&&typeof i.updatedAt==='string'&&Number.isFinite(Date.parse(i.createdAt))&&Number.isFinite(Date.parse(i.updatedAt)),'Date d’enregistrement non valide.');
  }
  return items;
}
export const upcoming=(items,now=new Date())=>items.filter(i=>Date.parse(i.endUTC)>=now.getTime()).sort((a,b)=>Date.parse(a.startUTC)-Date.parse(b.startUTC));
const stamp=x=>new Date(x).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const escapeText=x=>String(x).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function fold(line){let out='',bytes=0;for(const c of line){const size=new TextEncoder().encode(c).length;if(bytes+size>75){out+='\r\n ';bytes=1}out+=c;bytes+=size}return out}
export function calendarFile(items){
  validateAppointments(items);
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ojO//Helene local agenda//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for(const i of items){
    lines.push('BEGIN:VEVENT','UID:'+i.id+'@ojo-helene.local','DTSTAMP:'+stamp(i.updatedAt),'DTSTART:'+stamp(i.startUTC),'DTEND:'+stamp(i.endUTC),'SUMMARY:'+escapeText(i.title),'LOCATION:'+escapeText(i.place),'DESCRIPTION:'+escapeText(i.note),'CLASS:PRIVATE');
    if(i.reminder!==null)lines.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Rappel de rendez-vous','TRIGGER:'+(i.reminder===0?'PT0S':'-PT'+i.reminder+'M'),'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
export function appointmentShareText(i){
  validateAppointments([i]);
  const date=new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeStyle:'short',timeZone:i.timeZone}).format(new Date(i.startUTC));
  return i.title+'\n'+date+'\n'+(i.place?'Lieu : '+i.place+'\n':'')+(i.note?i.note+'\n':'')+'\nProposition de rendez-vous · à confirmer ensemble. Aucun rappel ni invitation automatique n’a été envoyé.';
}
