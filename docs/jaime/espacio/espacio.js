/* Componentes de la carpeta personal. Sólo el anfitrión autenticado proporciona almacenamiento. */
(() => {
 'use strict';
 const FILE_LIMIT=750*1024, FILE_TOTAL=1024*1024, STATE_LIMIT=1800000;
 const formats={'application/pdf':'PDF','text/plain':'Texto UTF-8','image/png':'PNG','image/jpeg':'JPEG','image/webp':'WebP'};
 const active=new WeakMap();
 const fresh=()=>({version:1,kind:'personal-space',folders:[],documents:[],notes:[],projects:[],chat:[]});
 const copy=o=>JSON.parse(JSON.stringify(o));
 const id=()=>crypto.randomUUID(),now=()=>new Date().toISOString();
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const trim=(v,max)=>String(v||'').trim().slice(0,max);
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
 const check=(p,message)=>{if(!p)throw Error(message);};
 const text=(s,max,empty=false)=>typeof s==='string'&&s.length<=max&&(empty||!!s.trim());
 const typed=(s,keys)=>keys.every(k=>text(s[k],128));
 const emptyKey=s=>typeof s==='string'&&s.length<=128;
 const iso=s=>text(s,48)&&Number.isFinite(Date.parse(s));
 const bytesOf=b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0));
 function base64(bytes){let str='';for(let i=0;i<bytes.length;i+=16384)str+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(str);}
 const ascii=(a,b,e)=>String.fromCharCode(...a.slice(b,e));
 function mime(bytes,name){
  if(ascii(bytes,0,5)==='%PDF-'&&ascii(bytes,-1500).includes('%%EOF'))return 'application/pdf';
  if(bytes.length>=24&&ascii(bytes,12,16)==='IHDR'&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(ascii(bytes,0,4)==='RIFF'&&ascii(bytes,8,12)==='WEBP')return 'image/webp';
  if(/\.txt$/i.test(name)){try{const s=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s))return 'text/plain';}catch(_){}}
  throw Error('Elige un PDF completo, un .txt en UTF-8 o una foto JPEG, PNG o WebP.');
 }
 function capacity(rows,size){
  check(Number.isSafeInteger(size)&&size>0&&size<=FILE_LIMIT,'Cada archivo admite entre 1 byte y 750 KiB.');
  check(rows.length<100&&rows.reduce((n,d)=>n+d.size,0)+size<=FILE_TOTAL,'La carpeta admite 100 archivos y 1 MiB de originales en total.');
 }
 async function documentFrom(file,title,folder,rows){
  check(file&&text(title,120)&&text(file.name,200),'Elige un archivo y escribe un título de hasta 120 caracteres.');
  capacity(rows,file.size);const b=new Uint8Array(await file.arrayBuffer());check(b.length===file.size,'No se ha podido leer el archivo completo.');
  return {id:id(),title:title.trim(),name:file.name,size:b.length,mime:mime(b,file.name),folder,date:now(),b64:base64(b)};
 }
 function validate(raw){
  if(raw===null)return fresh();
  const error='No se puede abrir este formato de espacio personal.';
  check(object(raw)&&raw.kind==='personal-space'&&raw.version===1&&['folders','documents','notes','projects','chat'].every(k=>Array.isArray(raw[k])),error);
  check(new TextEncoder().encode(JSON.stringify(raw)).length<=STATE_LIMIT,'El espacio personal supera el límite de 1.800.000 bytes.');
  const ids=new Set(),claim=k=>{check(text(k,128)&&!ids.has(k),error);ids.add(k);};
  raw.folders.forEach(x=>{check(object(x)&&text(x.title,120),error);claim(x.id);});
  let total=0;check(raw.documents.length<=100,error);
  raw.documents.forEach(d=>{check(object(d)&&text(d.title,120)&&text(d.name,200)&&emptyKey(d.folder)&&iso(d.date)&&Object.hasOwn(formats,d.mime)&&Number.isSafeInteger(d.size)&&d.size>0&&d.size<=FILE_LIMIT&&typeof d.b64==='string'&&d.b64.length===4*Math.ceil(d.size/3),error);claim(d.id);total+=d.size;const b=bytesOf(d.b64);check(b.length===d.size&&base64(b)===d.b64&&mime(b,d.name)===d.mime,error);});
  check(total<=FILE_TOTAL,error);
  raw.notes.forEach(n=>{check(object(n)&&text(n.title,120)&&text(n.body,2400)&&iso(n.date),error);claim(n.id);});
  raw.projects.forEach(p=>{check(object(p)&&text(p.title,120)&&typeof p.done==='boolean'&&Array.isArray(p.steps),error);claim(p.id);p.steps.forEach(s=>{check(object(s)&&text(s.title,350)&&typeof s.done==='boolean',error);claim(s.id);});});
  raw.chat.forEach(m=>{check(object(m)&&['user','assistant'].includes(m.role)&&text(m.body,5200)&&iso(m.date)&&Array.isArray(m.refs)&&m.refs.length<=12&&m.refs.every(x=>object(x)&&['note','doc'].includes(x.kind)&&typed(x,['id','label'])),error);});
  return copy(raw);
 }
 const ignore=new Set('que cual cuales como cuando donde puedes puedo sobre para los las del una uno unos unas mis mi por para con que hay tienes muestra dime quiero saber dice buscar busca encuentra encontraste texto documento documentos nota notas archivo archivos personal tengo fuente fuentes favor'.split(' '));
 const tokens=s=>[...new Set(norm(s).match(/[a-z0-9]{2,}/g)||[])].filter(x=>!ignore.has(x));
 function passage(body,terms){
  const plain=norm(body);let pos=terms.map(x=>plain.indexOf(x)).filter(x=>x>=0).sort((a,b)=>a-b)[0]??0;
  const start=Math.max(0,pos-64),end=Math.min(body.length,start+225);
  return (start?'…':'')+body.slice(start,end).trim()+(end<body.length?'…':'');
 }
 function answer(question,s){
  const q=norm(question),latest=[...s.chat].reverse().find(m=>m.role==='assistant'&&m.refs.length);
  const sourceRows=[...s.notes.map(n=>({id:n.id,kind:'note',title:n.title,body:n.body})),
   ...s.documents.map(d=>({id:d.id,kind:'doc',title:d.title,body:d.mime==='text/plain'?new TextDecoder().decode(bytesOf(d.b64)):'',name:d.name}))];
  const terms=tokens(q),follow=/^(?:[¿? ]*)?(?:y (?:la |las |esa |esta )?(?:fuente|referencia)|(?:muestrame|abre|ver) (?:esa |la |las |esta )?(?:fuente|referencia)|y que mas|dime mas)/.test(q);
  let rows;
  if(follow&&latest){rows=latest.refs.map(r=>sourceRows.find(x=>x.id===r.id)).filter(Boolean);}
  else if(!terms.length&&/mis (notas|documentos|archivos)/.test(q)){const kind=q.includes('notas')?'note':'doc';rows=sourceRows.filter(x=>x.kind===kind).reverse().slice(0,4);}
  else{rows=sourceRows.map(x=>({x,score:terms.reduce((n,w)=>n+(norm(x.title+' '+(x.name||'')).includes(w)?4:0)+(norm(x.body).includes(w)?1:0),0)})).filter(v=>v.score>0).sort((a,b)=>b.score-a.score).slice(0,3).map(v=>v.x);}
  if(!rows.length)return {body:sourceRows.length?'No encuentro un pasaje para esa pregunta. Prueba con una palabra que recuerdes o con el título del archivo.':'Tu espacio está vacío. Puedes guardar una nota aquí o añadir un texto en Mis expedientes para consultarlo.',refs:[]};
  return {body:rows.map(x=>x.body?x.title+'\n«'+passage(x.body,terms)+'»':x.title+'\nCoincidencia en el nombre o título. Abre el original para consultarlo.').join('\n\n'),refs:rows.map(x=>({kind:x.kind,id:x.id,label:x.title}))};
 }
 const make=(tag,txt,cl)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;if(cl)n.className=cl;return n;};
 const button=(txt,fn,cl)=>{const b=make('button',txt,cl);b.type='button';b.addEventListener('click',fn);return b;};
 const label=(txt,input)=>{const l=make('label',txt);l.append(input);return l;};
 const field=(tag,type,max)=>{const n=make(tag);if(type)n.type=type;if(max)n.maxLength=max;n.required=true;return n;};
 const human=n=>Math.round(n/102.4)/10+' KiB';
 async function open(o){
  check(o&&o.mount&&typeof o.load==='function'&&typeof o.save==='function','Se requiere un espacio de cuenta autenticado.');
  const mount=o.mount,previous=active.get(mount);
  let alive=true,loaded=false,s=null,tail=Promise.resolve(),tab='chat',account=false,currentFolder='*',selectedProject='',selectedNote='',selectedDoc='',url='',query='';
  const scope=make('section',undefined,'ja-space'),head=make('header'),nav=make('nav'),main=make('main'),notice=make('p',undefined,'ja-status');
  scope.setAttribute('lang','es');nav.setAttribute('aria-label','Mi espacio');notice.setAttribute('role','status');
  scope.append(head,nav,notice,main);
  const setStatus=t=>{if(alive)notice.textContent=t;};
  const clearBlob=()=>{if(url)URL.revokeObjectURL(url);url='';};
  const flush=()=>tail;
  async function close(){
   const wasOpen=alive;alive=false;clearBlob();if(active.get(mount)===handle){active.delete(mount);mount.replaceChildren();}
   if(wasOpen)await tail.catch(()=>{});s=null;
  }
  const handle={flush,close};const priorClose=previous?.close();active.set(mount,handle);mount.replaceChildren(scope);setStatus('Abriendo tu espacio…');
  if(priorClose)await priorClose;
  if(!alive||active.get(mount)!==handle)return handle;
  function act(fn){return async()=>{try{await fn();}catch(err){setStatus(err?.message||'No se pudo completar la operación.');}};}
  function commit(change,msg){
   if(!alive||!loaded)return Promise.resolve(false);
   const task=tail.catch(()=>{}).then(async()=>{
    const next=copy(s);change(next);check(new TextEncoder().encode(JSON.stringify(next)).length<=STATE_LIMIT,'El espacio supera 1.800.000 bytes. Reduce el tamaño del contenido antes de guardar.');
    const result=await o.save(copy(next));check(result!==false,'No se pudo guardar el cambio.');s=next;
    if(alive){setStatus(msg||'Guardado.');render();}return true;
   });tail=task.catch(()=>{});return task;
  }
  function resultText(result,fallback){
   if(typeof result==='string')return result;
   if(result&&typeof result.message==='string')return result.message;
   if(result&&typeof result.status==='string')return result.status;
   return fallback;
  }
  function refreshFrom(action,message){
   const task=tail.catch(()=>{}).then(async()=>{
    const result=await action();if(result===false)throw Error('La operación no se ha completado.');
    const snapshot=await o.load();if(snapshot!==null)s=validate(snapshot);
    if(alive){render();setStatus(resultText(result,message));}
   });tail=task.catch(()=>{});return task;
  }
  function sync(){return refreshFrom(o.onSync,'Sincronización completada.');}
  function go(t){clearBlob();account=false;tab=t;selectedDoc='';selectedNote='';setStatus('');render();}
  function form(parent,controls,submitText,fn){
   const f=make('form');f.append(...controls);const b=make('button',submitText,'ja-primary');b.type='submit';f.append(b);
   f.addEventListener('submit',async e=>{e.preventDefault();if(b.disabled)return;b.disabled=true;try{await fn();}catch(err){setStatus(err?.message||'No se pudo guardar.');}finally{b.disabled=false;}});parent.append(f);return f;
  }
  function details(host,name){const d=make('details'),summary=make('summary',name);d.append(summary);host.append(d);return d;}
  function section(title){main.append(make('h1',title));}
  function row(parent,title,actions){const r=make('div',undefined,'ja-row');r.append(make('strong',title),...actions);parent.append(r);return r;}
  function confirm(host,question,callback){host.replaceChildren(make('p',question),button('Cancelar',render),button('Confirmar',act(callback),'ja-danger'));}
  function openRef(ref){
   const exists=(ref.kind==='doc'?s.documents:s.notes).find(x=>x.id===ref.id);
   if(!exists){setStatus('Esta fuente ya no está en tu espacio.');return;}
   clearBlob();tab='dossiers';account=false;selectedDoc=ref.kind==='doc'?ref.id:'';selectedNote=ref.kind==='note'?ref.id:'';if(selectedDoc)currentFolder=exists.folder;
   render();main.querySelector('.ja-detail')?.scrollIntoView({block:'nearest'});
  }
  function renderChat(){
   section('¿Por dónde quieres empezar?');const thread=make('div',undefined,'ja-thread');thread.setAttribute('role','log');thread.setAttribute('aria-live','polite');main.append(thread);
   if(!s.chat.length)thread.append(make('p','Puedes preguntarme por un tema de tus notas o de tus archivos de texto.','ja-muted'));
   for(const m of s.chat){const a=make('article',undefined,'ja-bubble ja-'+m.role);a.append(make('strong',m.role==='user'?'Tú':'Tu espacio'),make('p',m.body));for(const ref of m.refs)a.append(button(ref.label,()=>openRef(ref),'ja-ref'));thread.append(a);}
   const prompt=field('textarea',null,1500);prompt.placeholder='Escribe tu pregunta';form(main,[label('Tu mensaje',prompt)],'Enviar',async()=>{
    const q=trim(prompt.value,1500);check(q,'Escribe un mensaje.');await commit(state=>{
     const note=q.match(/^\s*(?:guarda(?: una)? nota|anota|recuerda que)\s*[:–-]?\s+(.+)$/is);let reply;
     if(note){const body=trim(note[1],2400),n={id:id(),title:body.slice(0,80),body,date:now()};state.notes.push(n);reply={body:'He guardado tu nota. Puedes abrirla desde aquí.',refs:[{id:n.id,label:n.title,kind:'note'}]};}
     else reply=answer(q,state);
     state.chat.push({role:'user',body:q,refs:[],date:now()},{role:'assistant',...reply,date:now()});
    },'');});
   main.append(make('p','La búsqueda consulta tus notas y el contenido de los .txt. Los PDF y las fotos se localizan por título o nombre.','ja-muted'));
   thread.scrollTop=thread.scrollHeight;
  }
  function selectFolders(value){
   const pick=make('select'),list=[{id:'',title:'Sin carpeta'},...s.folders];
   for(const x of list){const opt=make('option',x.title);opt.value=x.id;pick.append(opt);}pick.value=value;return pick;
  }
  function renderDoc(d){
   const box=make('section',undefined,'ja-detail');box.append(make('h2',d.title),make('p',formats[d.mime]+' · '+human(d.size)+' · '+d.name,'ja-muted'));
   const bytes=bytesOf(d.b64);url=URL.createObjectURL(new Blob([bytes],{type:d.mime}));
   if(d.mime==='text/plain')box.append(make('pre',new TextDecoder().decode(bytes)));
   if(d.mime.startsWith('image/')){const img=make('img');img.src=url;img.alt=d.title;box.append(img);}
   const controls=make('div',undefined,'ja-actions');
   if(d.mime==='application/pdf'){const openPDF=make('a','Abrir PDF completo');openPDF.href=url;openPDF.target='_blank';openPDF.rel='noopener noreferrer';controls.append(openPDF);}
   const download=make('a','Guardar una copia');download.href=url;download.download=d.name;controls.append(download,button('Cerrar',()=>{selectedDoc='';render();}));box.append(controls);
   const move=selectFolders(d.folder);move.addEventListener('change',act(async()=>{const k=move.value;await commit(x=>{const item=x.documents.find(v=>v.id===d.id);if(item)item.folder=k;currentFolder=k;},'Documento desplazado.');}));box.append(label('Carpeta del documento',move));
   const remove=make('div');remove.append(button('Eliminar documento…',()=>confirm(remove,'¿Eliminar este original de tu espacio?',()=>commit(x=>{x.documents=x.documents.filter(v=>v.id!==d.id);selectedDoc='';},'Documento eliminado.')),'ja-danger'));box.append(remove);main.append(box);
  }
  function renderDossiers(){
   section('Mis expedientes');
   const folder=selectFolders(currentFolder),empty=make('option','Todas las carpetas');empty.value='*';folder.prepend(empty);folder.value=currentFolder==='*'?'*':currentFolder;
   folder.addEventListener('change',()=>{currentFolder=folder.value;selectedDoc='';render();});main.append(label('Mostrar carpeta',folder));
   const addFolder=details(main,'Crear una carpeta'),folderName=field('input','text',120);
   form(addFolder,[label('Nombre',folderName)],'Crear carpeta',()=>{const title=trim(folderName.value,120);check(title,'Escribe un nombre.');return commit(x=>{check(!x.folders.some(f=>norm(f.title)===norm(title)),'Ya existe una carpeta con este nombre.');const k=id();x.folders.push({id:k,title});currentFolder=k;});});
   const add=details(main,'Añadir un documento'),file=field('input','file'),title=field('input','text',120),pick=selectFolders(currentFolder==='*'?'':currentFolder);file.accept='.pdf,.txt,.png,.jpg,.jpeg,.webp';file.addEventListener('change',()=>{if(file.files[0]&&!title.value)title.value=file.files[0].name.replace(/\.[^.]+$/,'').slice(0,120);});
   add.append(make('p','Hasta 750 KiB por archivo y 1 MiB de originales en total.','ja-muted'));
   form(add,[label('PDF, foto o .txt',file),label('Título para encontrarlo',title),label('Guardar en',pick)],'Guardar original',async()=>{const doc=await documentFrom(file.files[0],trim(title.value,120),pick.value,s.documents);if(!alive)return;await commit(x=>{capacity(x.documents,doc.size);x.documents.push(doc);currentFolder=doc.folder;},'Original guardado.');});
   const filter=field('input','search',160);filter.required=false;filter.value=query;main.append(label('Buscar por título o nombre',filter));
   const list=make('div');main.append(list);
   function showList(){list.replaceChildren();const q=norm(query);const found=s.documents.filter(d=>(currentFolder==='*'||d.folder===currentFolder)&&norm(d.title+' '+d.name).includes(q));
    if(!found.length)list.append(make('p',s.documents.length?'No hay documentos para esta selección.':'Todavía no has añadido documentos.','ja-muted'));
    for(const d of found)row(list,d.title,[button('Ver',()=>{selectedDoc=d.id;selectedNote='';render();})]);
   }filter.addEventListener('input',()=>{query=filter.value;showList();});showList();
   const doc=s.documents.find(d=>d.id===selectedDoc);if(doc)renderDoc(doc);
   main.append(make('h2','Mis notas'));const addNote=details(main,'Escribir una nota'),nt=field('input','text',120),nb=field('textarea',null,2400);
   form(addNote,[label('Título',nt),label('Nota',nb)],'Guardar nota',()=>{const title=trim(nt.value,120),body=trim(nb.value,2400);check(title&&body,'Escribe el título y la nota.');return commit(x=>x.notes.push({id:id(),title,body,date:now()}));});
   if(!s.notes.length)main.append(make('p','Las notas que guardes también se pueden consultar en Hablar.','ja-muted'));
   for(const n of [...s.notes].reverse()){row(main,n.title,[button('Leer',()=>{selectedNote=n.id;selectedDoc='';render();})]);if(n.id===selectedNote){const pane=make('section',undefined,'ja-detail');pane.append(make('h3',n.title),make('p',n.body));const del=make('div');del.append(button('Eliminar nota…',()=>confirm(del,'¿Eliminar esta nota?',()=>commit(x=>{x.notes=x.notes.filter(v=>v.id!==n.id);selectedNote='';})),'ja-danger'));pane.append(del);main.append(pane);}}
  }
  function renderProjects(){
   section('Mis proyectos');const formBox=details(main,'Crear un proyecto'),title=field('input','text',120);
   form(formBox,[label('Nombre del proyecto',title)],'Crear proyecto',()=>{const name=trim(title.value,120);check(name,'Escribe un nombre.');return commit(x=>{const k=id();x.projects.push({id:k,title:name,done:false,steps:[]});selectedProject=k;});});
   if(!s.projects.length)main.append(make('p','Puedes empezar con un proyecto y un único paso.','ja-muted'));
   for(const p of s.projects)row(main,p.title,[make('span',p.done?'Terminado':'En curso','ja-muted'),button('Abrir',()=>{selectedProject=p.id;render();})]);
   const current=s.projects.find(p=>p.id===selectedProject);if(!current)return;
   const pane=make('section',undefined,'ja-detail');pane.append(make('h2',current.title));main.append(pane);
   for(const st of current.steps){const ck=field('input','checkbox');ck.checked=st.done;ck.disabled=current.done;ck.addEventListener('change',act(()=>commit(x=>{const p=x.projects.find(v=>v.id===current.id);const v=p?.steps.find(v=>v.id===st.id);if(v&&!p.done)v.done=ck.checked;})));const l=label(st.title,ck);l.className='ja-step';pane.append(l);}
   if(!current.done){const step=field('input','text',350);form(pane,[label('Siguiente paso',step)],'Añadir paso',()=>{const t=trim(step.value,350);check(t,'Escribe un paso.');return commit(x=>{const p=x.projects.find(v=>v.id===current.id);if(p&&!p.done)p.steps.push({id:id(),title:t,done:false});});});}
   pane.append(button(current.done?'Reanudar proyecto':'Marcar como terminado',act(()=>commit(x=>{const p=x.projects.find(v=>v.id===current.id);if(p)p.done=!p.done;}))));
  }
  async function leave(fn){await tail;if(!alive)return;await fn();await close();}
  function renderAccount(){
   section('Mi cuenta');const block=make('div',undefined,'ja-actions');main.append(block);
   if(typeof o.enableDevice==='function')block.append(button('Activar acceso con este dispositivo',act(async()=>{const r=await o.enableDevice();setStatus(r===false?'La activación no se ha completado.':'Solicitud de acceso con el dispositivo completada.');})));
   if(typeof o.onSync==='function'){block.append(button('Sincronizar ahora',act(sync)));main.append(make('p','La sincronización rápida admite hasta unos 5 KiB. Para trasladar originales más grandes, usa una copia cifrada.','ja-muted'));}
   if(typeof o.openEdition==='function')block.append(button('Abrir mi expediente profesional',act(async()=>{await tail;await o.openEdition();})));
   if(typeof o.lock==='function')block.append(button('Bloquear el espacio',act(()=>leave(o.lock))));
   if(typeof o.logout==='function')block.append(button('Cerrar sesión',act(()=>leave(o.logout))));
   if(typeof o.downloadBackup==='function'||typeof o.restoreBackup==='function'){
    const box=details(main,'Copias cifradas');box.append(make('p','Los archivos grandes permanecen cifrados en este dispositivo. Puedes llevarlos a otro dispositivo con una copia y la misma cuenta.','ja-muted'));
    if(typeof o.downloadBackup==='function')box.append(button('Descargar copia cifrada',act(async()=>{await tail;const result=await o.downloadBackup();if(result===false)throw Error('No se ha preparado la copia.');setStatus(resultText(result,'Copia cifrada preparada.'));})));
    if(typeof o.restoreBackup==='function'){
     const f=field('input','file');f.accept='.json,application/json';const pending=make('div');box.append(label('Elegir una copia JSON para restaurar',f),pending);
     f.addEventListener('change',()=>{pending.replaceChildren();const file=f.files?.[0];if(!file)return;
      if(!/\.json$/i.test(file.name)&&file.type!=='application/json'){f.value='';setStatus('Elige una copia cifrada en formato JSON.');return;}
      pending.append(make('p','¿Restaurar «'+file.name+'» y sustituir el contenido personal de este dispositivo?'),
       button('Cancelar',()=>{f.value='';pending.replaceChildren();}),button('Restaurar esta copia',act(async()=>{const selected=file;f.value='';pending.replaceChildren();await refreshFrom(()=>o.restoreBackup(selected),'Copia cifrada restaurada.');}),'ja-danger'));
     });
    }
   }
   const memory=make('section',undefined,'ja-detail');memory.append(make('h2','Mi memoria'),make('p',s.notes.length+' notas · '+s.documents.length+' documentos · '+s.chat.length+' mensajes.'));
   memory.append(button('Ver mis notas y documentos',()=>go('dossiers')));
   if(s.chat.length){const del=make('div');del.append(button('Borrar conversación…',()=>confirm(del,'¿Borrar todos los mensajes guardados?',()=>commit(x=>{x.chat=[];},'Conversación borrada.')),'ja-danger'));memory.append(del);}main.append(memory);
  }
  function render(){if(!alive||!loaded)return;clearBlob();head.replaceChildren(make('strong','Mi espacio'),button('Mi cuenta',()=>{account=true;setStatus('');render();},'ja-account'));nav.replaceChildren();main.replaceChildren();
   for(const [k,t] of [['chat','Hablar'],['dossiers','Mis expedientes'],['projects','Mis proyectos']]){const b=button(t,()=>go(k));if(!account&&tab===k)b.setAttribute('aria-current','page');nav.append(b);}
   if(account)renderAccount();else if(tab==='chat')renderChat();else if(tab==='dossiers')renderDossiers();else renderProjects();
  }
  try{const restored=validate(await o.load());if(!alive||active.get(mount)!==handle)return handle;s=restored;loaded=true;setStatus('');render();}
  catch(_){if(alive){setStatus('No se pudo abrir tu espacio. Vuelve a entrar para reintentar.');if(typeof o.logout==='function')main.append(button('Cerrar sesión',act(()=>leave(o.logout))));}}
  return handle;
 }
 if(typeof window!=='undefined')window.JaimeAccountView=Object.freeze({open});
 if(typeof module!=='undefined'&&module.exports)module.exports={fresh,validate,capacity,documentFrom,answer,open};
})();
