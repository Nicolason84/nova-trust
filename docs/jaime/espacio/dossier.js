/* JAIME: private case work inside the existing authenticated account vault. */
(() => {
  'use strict';
  const VERSION='2026.11.20-r1', MAX=1450000;
  const copy=v=>JSON.parse(JSON.stringify(v));
  const fail=(ok,msg)=>{if(!ok)throw Error(msg||'El dossier no tiene un formato válido.');};
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const str=(v,max=20000)=>typeof v==='string'&&v.length<=max;
  const arr=(v,max=200)=>Array.isArray(v)&&v.length<=max;
  const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
  const hex=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
  const safeURL=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}catch(_){return false;}};
  const bytes=b64=>Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
  const statuses=['Pendiente','En curso','Acreditado','No procede'];
  const lanes=['Prestación','Seguro','Recargo','Daños','Expediente'];
  function validate(d){
    fail(obj(d)&&d.kind==='jaime-legal-dossier'&&d.version===1&&str(d.id,120)&&d.id.length>3);
    fail(new TextEncoder().encode(JSON.stringify(d)).length<=MAX,'El dossier supera el tamaño admitido.');
    fail(obj(d.meta)&&['title','person','lawyer','court','procedure','judgment','summary'].every(k=>str(d.meta[k],4000))&&date(d.meta.date));
    fail(arr(d.sections,30)&&d.sections.every(x=>obj(x)&&str(x.title,160)&&arr(x.blocks,25)&&x.blocks.every(b=>obj(b)&&str(b.title,180)&&str(b.body,12000)&&str(b.source,500))));
    fail(arr(d.facts,60)&&d.facts.every(x=>obj(x)&&['date','title','body','source','status'].every(k=>str(x[k],3000))));
    fail(arr(d.tasks,80)&&d.tasks.every(x=>obj(x)&&str(x.id,80)&&str(x.title,250)&&str(x.detail,4000)&&str(x.owner,120)&&lanes.includes(x.lane)&&statuses.includes(x.status)&&str(x.evidence,2000)&&str(x.due,10)&&(x.due===''||date(x.due))));
    fail(arr(d.drafts,20)&&d.drafts.every(x=>obj(x)&&str(x.id,80)&&str(x.title,180)&&str(x.to,180)&&str(x.body,20000)));
    fail(arr(d.sources,60)&&d.sources.every(x=>obj(x)&&str(x.id,40)&&str(x.title,200)&&str(x.detail,4000)&&str(x.url,1000)&&(!x.url||safeURL(x.url))));
    fail(arr(d.attachments,8)&&d.attachments.every(x=>obj(x)&&str(x.id,80)&&str(x.name,180)&&x.mime==='application/pdf'&&Number.isSafeInteger(x.size)&&x.size>0&&x.size<=750*1024&&hex(x.sha256)&&str(x.b64,1024000)&&x.b64.length===4*Math.ceil(x.size/3)));
    fail(arr(d.events,250)&&d.events.every(x=>obj(x)&&str(x.id,80)&&date(x.date)&&str(x.author,100)&&str(x.body,4000)&&str(x.source,2000)));
    fail(arr(d.payments,200)&&d.payments.every(x=>obj(x)&&str(x.id,80)&&date(x.date)&&lanes.includes(x.lane)&&str(x.payer,120)&&str(x.period,120)&&Number.isSafeInteger(x.cents)&&x.cents>0&&x.cents<1000000000&&str(x.evidence,2000)&&!!x.evidence.trim()));
    fail(arr(d.attachments.map(x=>x.id))&&new Set(d.attachments.map(x=>x.id)).size===d.attachments.length);
    for(const k of ['tasks','drafts','events','payments'])fail(new Set(d[k].map(x=>x.id)).size===d[k].length);
    return d;
  }
  async function readPackage(file){
    fail(file&&file.size>0&&file.size<=MAX,'Elige el archivo privado .json de tu dossier (máximo 1,45 MB).');
    let d;try{d=JSON.parse(await file.text());}catch(_){throw Error('El archivo elegido no es un dossier JSON.');}
    validate(d);
    for(const a of d.attachments){const b=bytes(a.b64);fail(b.length===a.size&&new TextDecoder().decode(b.slice(0,5))==='%PDF-'&&await hash(b)===a.sha256,'Un PDF no coincide con la huella del dossier. Se conserva el contenido anterior.');}
    return copy(d);
  }
  function changedTask(d,id,status,evidence,due){
    const next=copy(d),t=next.tasks.find(x=>x.id===id);
    fail(t&&statuses.includes(status),'Actuación no válida.');
    fail(str(evidence,2000)&&str(due,10)&&(!due||date(due)),'Revisa la fecha o la referencia.');
    fail(!['Acreditado','No procede'].includes(status)||!!evidence.trim(),'Añade el justificante o el criterio del abogado antes de cerrar esta actuación.');
    t.status=status;t.evidence=evidence.trim();t.due=due;return validate(next);
  }
  function payment(d,p){
    fail(/^\d{1,7}(?:[.,]\d{1,2})?$/.test(p.amount),'Escribe un importe recibido positivo, con un máximo de dos decimales.');
    const cents=Math.round(Number(p.amount.replace(',','.'))*100);
    const next=copy(d);next.payments.push({id:crypto.randomUUID(),date:p.date,lane:p.lane,payer:p.payer.trim(),period:p.period.trim(),cents,evidence:p.evidence.trim()});
    return validate(next);
  }
  function receiptTotal(d){validate(d);return d.payments.reduce((n,p)=>n+p.cents,0);}
  const make=(tag,text,cl)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cl)n.className=cl;return n;};
  const button=(text,fn,cl)=>{const b=make('button',text,cl);b.type='button';b.addEventListener('click',fn);return b;};
  const field=(label,type='text',value='',max=2000)=>{const box=make('label',label),input=make(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.value=value;input.maxLength=max;box.append(input);return {box,input};};
  const pick=(label,values,current)=>{const box=make('label',label),input=make('select');for(const value of values){const op=make('option',value);op.value=value;input.append(op);}input.value=current;box.append(input);return {box,input};};
  const humanDate=d=>date(d)?d.split('-').reverse().join('/'):d;
  const money=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(n/100);
  function download(content,type,name){const u=URL.createObjectURL(new Blob([content],{type})),a=make('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);}
  function render(o){
    let live=true;const urls=[];const root=make('div',undefined,'jd');o.mount.append(root);
    const d=o.state.legalDossier;
    if(!o.expanded){
      const card=make('div',undefined,'jd-launch');card.append(make('p','SEGUIMIENTO PRIVADO','jd-kicker'),make('h2',d?d.meta.title:'Mi dossier jurídico'),make('p',d?'Sentencia, actuaciones, escritos y justificantes en un solo expediente.':'Abre el dossier preparado para ti y sigue tus gestiones hasta el pago.'),button(d?'Abrir mi dossier':'Cargar mi dossier',o.open,'ja-primary'));root.append(card);return ()=>{live=false;};
    }
    const alert=make('p',undefined,'jd-feedback');alert.setAttribute('role','status');alert.setAttribute('aria-live','polite');
    const run=fn=>async()=>{try{await fn();}catch(e){if(live)alert.textContent=e.message||'No se ha guardado el cambio.';}};
    const top=make('div',undefined,'jd-top');top.append(button('← Mis documentos',o.close),make('span','Dossier privado · '+VERSION,'jd-small'));root.append(top,alert);
    function upload(){
      const box=make('div',undefined,'jd-import');box.append(make('h2',d?'Añadir una revisión preparada':'Abre tu dossier privado'),make('p','Elige el archivo del dossier que recibiste. Se comprobarán los PDF antes de guardarlo, cifrado, en la cuenta abierta. No necesitas una invitación.'));
      const input=make('input');input.type='file';input.accept='.json,application/json';input.setAttribute('aria-label','Archivo privado del dossier');box.append(input);
      const preview=make('div');box.append(preview);
      input.addEventListener('change',run(async()=>{preview.replaceChildren();const file=input.files?.[0];if(!file)return;const incoming=await readPackage(file);if(!live)return;
        if(d){fail(d.id===incoming.id,'Esta revisión pertenece a otro dossier. Se conserva el expediente actual.');
          fail(d.events.length===0&&d.payments.length===0&&d.tasks.every(t=>!t.evidence&&t.status==='Pendiente'),'Tu dossier ya contiene gestiones. Guarda una copia cifrada y conserva esta revisión como documento; no se sobrescribirán tus avances.');}
        preview.append(make('p',incoming.meta.person+' · '+incoming.meta.judgment+' · '+incoming.attachments.length+' PDF verificados'),button('Guardar en mi cuenta y abrir',run(async()=>{await o.commit(s=>{s.legalDossier=incoming;},'Dossier guardado cifrado en este dispositivo. Guarda también una copia cifrada.');}),'ja-primary'));
      }));root.append(box);
    }
    if(!d){upload();return ()=>{live=false;urls.forEach(URL.revokeObjectURL);};}
    validate(d);
    const hero=make('section',undefined,'jd-hero');hero.append(make('p','EXPEDIENTE PERSONAL','jd-kicker'),make('h2',d.meta.title),make('p',d.meta.person+' · '+d.meta.judgment),make('p',d.meta.court+' · '+d.meta.procedure,'jd-small'));
    const metrics=make('div',undefined,'jd-metrics');
    for(const [n,t] of [[d.tasks.filter(t=>t.status==='Acreditado').length+'/'+d.tasks.length,'Actuaciones acreditadas'],[d.payments.length?money(receiptTotal(d)):'Sin registrar','Pagos con referencia'],[humanDate(d.meta.date),'Base documental']]){const c=make('div');c.append(make('strong',String(n)),make('span',t));metrics.append(c);}hero.append(metrics);root.append(hero);
    const controls=make('div',undefined,'jd-controls');
    if(o.backup)controls.append(button('Guardar copia cifrada',run(o.backup),'ja-primary'));
    root.append(controls,make('p','Guardado cifrado en este dispositivo. Las novedades de esta página se actualizan al registrarlas aquí. Este dossier completo no se sincroniza automáticamente con otro teléfono ni con el abogado.','jd-storage'));
    const menu=make('nav',undefined,'jd-nav');menu.setAttribute('aria-label','Secciones del dossier');
    const pane=make('section',undefined,'jd-pane');root.append(menu,pane);
    const sections=[['resumen','Resumen'],['sentencia','Sentencia'],['acciones','Actuaciones'],['escritos','Para el abogado'],['pagos','Pagos'],['fuentes','Fuentes']];
    let active=o.ui?.section||'resumen';
    function list(container,items){const ul=make('ul');for(const s of items)ul.append(make('li',s));container.append(ul);}
    function show(){
      pane.replaceChildren();for(const b of menu.children){if(b.dataset.key===active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
      if(active==='resumen'){
        const brief=make('div',undefined,'jd-callout');brief.append(make('h3','Qué está reconocido'),make('p',d.meta.summary));pane.append(brief);
        for(const s of d.sections){const details=make('details');details.open=d.sections.indexOf(s)<2;details.append(make('summary',s.title));for(const b of s.blocks){const a=make('article');a.append(make('h4',b.title),make('p',b.body));if(b.source)a.append(make('p',b.source,'jd-source'));details.append(a);}pane.append(details);}
      }
      if(active==='sentencia'){
        pane.append(make('h3','Original y dossier profesional'),make('p','Los PDF se abren completos. Las huellas verifican la integridad del archivo; no certifican la firma judicial ni la firmeza.'));
        for(const a of d.attachments){const box=make('article',undefined,'jd-document');const u=URL.createObjectURL(new Blob([bytes(a.b64)],{type:a.mime}));urls.push(u);const open=make('a','Abrir PDF completo');open.href=u;open.target='_blank';open.rel='noopener noreferrer';const save=make('a','Guardar PDF');save.href=u;save.download=a.name;
          box.append(make('h4',a.name.replace(/_/g,' ')),open,save,make('p',a.size.toLocaleString('es-ES')+' bytes · SHA-256 '+a.sha256,'jd-hash'));pane.append(box);}
        pane.append(make('h3','Cronología contrastada'));
        for(const f of d.facts){const a=make('article',undefined,'jd-timeline');a.append(make('p',f.date+' · '+f.status,'jd-kicker'),make('h4',f.title),make('p',f.body),make('p',f.source,'jd-source'));pane.append(a);}
      }
      if(active==='acciones'){
        pane.append(make('h3','De la sentencia al cobro'),make('p','Cada cierre necesita una referencia. Las fechas procesales deben verificarse con el abogado; la aplicación no calcula vencimientos desde la fecha de la sentencia.'));
        for(const t of d.tasks){const a=make('details');a.append(make('summary',t.lane+' · '+t.title+' — '+t.status),make('p',t.detail),make('p','Responsable previsto: '+t.owner,'jd-small'));const f=make('form'),status=pick('Estado',statuses,t.status),evidence=field('Justificante o criterio del abogado','textarea',t.evidence),due=field('Fecha confirmada por el abogado (opcional)','date',t.due);const b=make('button','Guardar actuación');b.type='submit';f.append(status.box,evidence.box,due.box,b);f.addEventListener('submit',e=>{e.preventDefault();run(async()=>{b.disabled=true;try{await o.commit(s=>{s.legalDossier=changedTask(s.legalDossier,t.id,status.input.value,evidence.input.value,due.input.value);},'Actuación guardada.');}finally{b.disabled=false;}})();});a.append(f);pane.append(a);}
        pane.append(make('h3','Novedades y notas de revisión'));
        for(const e of [...d.events].reverse()){const a=make('article',undefined,'jd-event');a.append(make('strong',humanDate(e.date)+' · '+e.author),make('p',e.body),make('p','Referencia: '+e.source,'jd-source'));pane.append(a);}
        const f=make('form'),dt=field('Fecha','date',new Date().toISOString().slice(0,10)),author=field('Anotado por','text','',100),body=field('Qué ha cambiado','textarea','',4000),source=field('Documento o comunicación que lo acredita','text','',2000);for(const x of [dt,author,body,source])x.input.required=true;const b=make('button','Registrar novedad');b.type='submit';f.append(dt.box,author.box,body.box,source.box,b);f.addEventListener('submit',e=>{e.preventDefault();run(async()=>{b.disabled=true;try{await o.commit(s=>{s.legalDossier.events.push({id:crypto.randomUUID(),date:dt.input.value,author:author.input.value.trim(),body:body.input.value.trim(),source:source.input.value.trim()});validate(s.legalDossier);},'Novedad guardada en tu dossier. No se ha enviado ningún mensaje.');}finally{b.disabled=false;}})();});pane.append(f);
      }
      if(active==='escritos'){
        pane.append(make('h3','Preparado para la revisión del abogado'),make('p','Borradores sin enviar. Rafael debe completar los destinatarios, decidir la vía y validar los plazos y el contenido antes de utilizarlos.'));
        for(const draft of d.drafts){const a=make('details');a.append(make('summary',draft.title),make('p','Destino previsto: '+draft.to,'jd-source'),make('pre',draft.body),button('Descargar borrador',()=>download(draft.body,'text/plain;charset=utf-8',draft.id+'_BORRADOR.txt')));pane.append(a);}
        const room=make('div',undefined,'jd-callout');room.append(make('h3','Acceso conjunto con Rafael'),make('p','Pendiente de autorización de Jaime y de verificar el destinatario. Ningún abogado tiene acceso por abrir esta página.'),make('p','El modelo de autorización está preparado. La autorización no activa por sí sola una sala compartida. Las notas de esta edición se conservan en la cuenta abierta; aún no hay conversación ni sincronización en directo con Rafael.'));pane.append(room);
      }
      if(active==='pagos'){
        pane.append(make('h3','Cobros comprobables'),make('p','Registra únicamente dinero recibido y su justificante. La base reguladora, una oferta o un capital solicitado no son un pago.'));
        if(!d.payments.length)pane.append(make('p','No se han registrado cobros en este dossier. Esto no significa que no exista una pensión anterior.','jd-callout'));
        for(const p of d.payments){const a=make('article',undefined,'jd-event');a.append(make('strong',money(p.cents)+' · '+p.lane),make('p',humanDate(p.date)+' · '+p.payer+' · '+p.period),make('p','Justificante: '+p.evidence,'jd-source'));pane.append(a);}
        const f=make('form'),dt=field('Fecha del ingreso','date'),lane=pick('Concepto',lanes.slice(0,4),'Prestación'),payer=field('Pagador','text','',120),period=field('Periodo o concepto detallado','text','',120),amount=field('Importe recibido (€)','text','',12),evidence=field('Referencia del justificante','text','',2000);amount.input.inputMode='decimal';for(const x of [dt,payer,period,amount,evidence])x.input.required=true;const b=make('button','Registrar pago recibido');b.type='submit';f.append(dt.box,lane.box,payer.box,period.box,amount.box,evidence.box,b);f.addEventListener('submit',e=>{e.preventDefault();run(async()=>{b.disabled=true;try{await o.commit(s=>{s.legalDossier=payment(s.legalDossier,{date:dt.input.value,lane:lane.input.value,payer:payer.input.value,period:period.input.value,amount:amount.input.value,evidence:evidence.input.value});},'Pago y referencia guardados.');}finally{b.disabled=false;}})();});pane.append(f);
      }
      if(active==='fuentes'){
        pane.append(make('h3','Fuentes y alcance'),make('p','Se distinguen el original judicial, el testimonio, las fuentes oficiales y los puntos pendientes. No se ha verificado la firma electrónica judicial ni el expediente procesal en línea.'));
        for(const s of d.sources){const a=make('article');a.append(make('h4',s.id+' · '+s.title),make('p',s.detail));if(s.url){const l=make('a','Consultar fuente oficial');l.href=s.url;l.target='_blank';l.rel='noopener noreferrer';a.append(l);}pane.append(a);}
        const details=make('details');details.append(make('summary','Portabilidad del dossier'),make('p','La copia cifrada completa se obtiene con el botón superior. Para conservar una copia legible, usa los PDF. Los PDF y borradores descargados contienen datos privados y no deben publicarse.'));pane.append(details);
      }
    }
    for(const [k,t] of sections){const b=button(t,()=>{active=k;if(o.ui)o.ui.section=k;show();});b.dataset.key=k;menu.append(b);}show();
    return ()=>{live=false;urls.forEach(u=>URL.revokeObjectURL(u));};
  }
  const api=Object.freeze({VERSION,validate,readPackage,changedTask,payment,receiptTotal,render});
  if(typeof window!=='undefined'){
    window.JaimeDossier=api;
    try{if(new URL(location.href).searchParams.get('dossier')==='1')sessionStorage.setItem('jaime.dossier.intent','1');}catch(_){}
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
