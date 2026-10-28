/* Explicit, reviewable context for the existing private Deivid conversation.
 * No network calls, generated answers, installation actions or automatic sends.
 */
(function (root) {
  'use strict';
  const plain = (v, max) => String(v == null ? '' : v).slice(0, max);
  const clone = value => JSON.parse(JSON.stringify(value));
  const isPersonalOrigin = () => root.location?.origin === 'https://deivid.nova-era.fr' && /^\/ojo\/deivid(?:\/|$)/.test(root.location.pathname);
  function estimate(message, context) {
    return new TextEncoder().encode(JSON.stringify({schema:'OJO_DEIVID_CHAT_REQUEST_V1',request_id:'00000000-0000-4000-8000-000000000000',message:String(message).trim(),selected_context:context})).length;
  }
  function catalogueContext(product) {
    if (!product) return [];
    const sources = (product.provenance || []).slice(0, 2).map(p => plain(p.source, 90) + (p.physical_page ? ', p. ' + p.physical_page : p.sheet ? ', ' + plain(p.sheet, 30) : '')).join('; ');
    const note = 'Ficha seleccionada: ' + plain(product.reference,128) + '. ' + plain(product.description,250) + '. Precio documental: ' + plain(product.source_price_eur,20) + ' EUR; unidad, IVA y condiciones de venta por confirmar. No demuestra compatibilidad ni stock. Fuente: ' + sources + '.';
    return [{kind:'catalogue_reference',reference:plain(product.reference,128)},{kind:'note',text:note.slice(0,950)}];
  }
  function projectContext(project) {
    const room = project.room || {}, dims = ['length','width','height'].map(k => plain(room[k],24) || 'sin indicar');
    const refs = (project.selectedReferences || []).slice(0,5).map(r => plain(typeof r === 'string' ? r : r.reference,100));
    return 'Resumen elegido del proyecto actual (sin nombre del cliente ni archivos): largo × ancho × alto: ' + dims.join(' × ') + ' m; medidas ' + (room.confirmed === true ? 'confirmadas por el usuario' : 'pendientes de confirmar') + '. Estilo: ' + plain(room.style,80) + '. ' + (project.inputs || []).length + ' fuentes guardadas localmente, no adjuntas. Referencias elegidas (máximo 5): ' + (refs.join(', ') || 'ninguna') + '. La selección no confirma compatibilidad.';
  }
  function moduleContext(registry) {
    const available = (registry?.available || []).map(m => plain(m.name,60)).join('; ');
    return ('Funciones presentes: ' + available + '. Límites: 3D paramétrica desde medidas revisadas, no reconstrucción desde fotos. Dictado según navegador; archivos de audio importados sin transcripción automática. Radar requiere red y revisión. Promos: animación sin audio. Propuestas pendientes: reconstrucción 3D, transcripción de archivos, pedidos al proveedor. Gratis para Deivid; sin compras ni suscripción. Propón mejoras como ideas, explica utilidad y datos necesarios, y pide su opinión. Una conversación no instala módulos, no confirma su desarrollo y no envía presupuestos.').slice(0,1000);
  }
  function mount(container, options) {
    const store = options.store;
    const el = (tag, className, text) => { const n=document.createElement(tag); if(className)n.className=className; if(text!=null)n.textContent=text; return n; };
    let project=store.getProject(), prepared=null, lastProjectId=project.id;
    container.classList.add('dc-context');
    const heading=el('h3',null,'Dale contexto a tu pregunta'), help=el('p','subtle','Elige lo que quieres añadir y revisa el texto completo antes de enviarlo.');
    const makeChoice=(label,id)=>{const row=el('label','chat-checkline'),input=el('input');input.type='checkbox';input.id=id;row.append(input,el('span',null,label));input.onchange=()=>options.onChange?.();container.append(row);return input;};
    container.append(heading,help);
    const roomChoice=makeChoice('Resumen del proyecto actual, sin datos del cliente','chat-share-project');
    const modulesChoice=makeChoice('Funciones disponibles y mejoras por estudiar','chat-share-modules');
    const preparedWrap=el('div','dc-prepared hidden'), preparedLabel=el('label','chat-checkline'), preparedChoice=el('input');preparedChoice.type='checkbox';preparedChoice.id='chat-share-request';
    preparedLabel.append(preparedChoice,el('span',null,'Contexto de la solicitud preparada'));preparedChoice.onchange=()=>options.onChange?.();
    const preparedTitle=el('p','subtle'), remove=el('button','text-button','Desvincular esta solicitud del mensaje');remove.type='button';remove.onclick=()=>{prepared=null;render();options.onChange?.();};preparedWrap.append(preparedLabel,preparedTitle,remove);container.append(preparedWrap);
    const scope=el('p','dc-scope','Un solo hilo personal con ojO. Cambiar de proyecto no borra lo que ya se compartió en esa conversación.');container.append(scope);
    function render(){preparedWrap.classList.toggle('hidden',!prepared);if(prepared)preparedTitle.textContent='Solicitud preparada en este proyecto. Revisa también el mensaje; puedes editarlo antes de enviar.';}
    function notes(){const result=[];if(roomChoice.checked)result.push({kind:'note',text:projectContext(project).slice(0,1000)});if(modulesChoice.checked)result.push({kind:'note',text:moduleContext(options.getModules?.())});if(prepared&&prepared.projectId===project.id&&preparedChoice.checked)for(const note of prepared.contextNotes)result.push({kind:'note',text:note});return result;}
    const unsubscribe=store.subscribe(p=>{project=p;if(p.id!==lastProjectId){lastProjectId=p.id;roomChoice.checked=false;prepared=null;}render();options.onChange?.();});
    return Object.freeze({ready:store.ready,notes,prepare(value){prepared={requestId:plain(value.requestId,160),projectId:project.id,contextNotes:(value.contextNotes||[]).map(n=>plain(n,1000)).slice(0,4)};preparedChoice.checked=true;render();options.onChange?.();},pendingRequest(){return prepared&&prepared.projectId===project.id?clone(prepared):null;},clearPrepared(){prepared=null;render();options.onChange?.();},refresh(){project=store.getProject();render();options.onChange?.();},destroy(){unsubscribe?.();}});
  }
  root.DeividChatContext=Object.freeze({isPersonalOrigin,estimate,catalogueContext,mount});
})(typeof globalThis !== 'undefined' ? globalThis : this);
