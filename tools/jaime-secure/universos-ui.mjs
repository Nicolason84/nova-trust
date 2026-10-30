import {createDocumentVault,DocumentVaultError,DOCUMENT_LIMITS} from './document-vault.mjs';
import {createLowLightCamera} from './camera-controller.mjs';
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const vault=createDocumentVault();
const categories={juridico:'Mis derechos',caza:'Caza',tauromaquia:'Tauromaquia',finanzas:'Dinero y facturas',negocios:'Ideas y negocios',viajes:'Viajes',fotos:'Fotos',audio:'Audios',video:'Vídeos',documentos:'Documentos',salud:'Personal · salud',fe:'Mi fe',otros:'Otros'};
const statuses={TEXT_ANALYZED:'Texto indexado · reglas locales',TEXT_LIMITED:'Texto indexado con límites',ORIGINAL_ONLY:'Original guardado · contenido sin analizar'};
const lossLabels={TEXT_OVER_2_MIB:'El archivo supera el límite de lectura de texto de 2 MiB.',NO_FORMAT_EXTRACTOR:'Este formato se conserva, pero su contenido no se extrae.',NOT_VALID_UTF8:'No es un texto UTF-8 compatible.',BINARY_CONTENT:'El contenido no se trata como texto.',REDUCTION_FIRST_10000_LINES:'CAnnoNico solo ha clasificado las primeras 10 000 líneas.',SEARCH_FIRST_64_KIB:'La búsqueda en el contenido se limita a los primeros 64 KiB.'};
const sources={
  legal:[
    {title:'Asistencia jurídica gratuita · Cáceres',owner:'Colegio de la Abogacía · orientación, cita y documentos para la solicitud',url:'https://icac.es/index.php/ciudadanos'},
    {title:'España · Reglamento de asistencia jurídica gratuita',owner:'BOE · consultar la versión vigente',url:'https://www.boe.es/eli/es/rd/2021/03/09/141/con'},
    {title:'Francia · Aide juridictionnelle',owner:'Service Public · condiciones y procedimiento',url:'https://www.service-public.fr/particuliers/vosdroits/F18074'},
  ],
  hunting:[
    {title:'Extremadura · Licencia de caza',owner:'Junta de Extremadura · requisitos y trámite oficial',url:'https://www.juntaex.es/w/1780'},
    {title:'Francia · Validación del permiso de caza',owner:'Service Public · comprobar la temporada y los requisitos',url:'https://www.service-public.gouv.fr/particuliers/vosdroits/F2091'},
    {title:'Francia · Seguro de responsabilidad civil de caza',owner:'Service Public · documentación y cobertura obligatoria',url:'https://www.service-public.gouv.fr/particuliers/vosdroits/F2146'},
  ],
  bullfighting:[
    {title:'Las culturas del toro',owner:'Ministerio de Cultura · museos, archivos y patrimonio',url:'https://www.cultura.gob.es/cultura/areas/tauromaquia/mc/culturas-toro/presentacion.html'},
    {title:'Tauromaquia · Patrimonio cultural',owner:'Ministerio de Cultura · documentación cultural',url:'https://www.portalinmaterial.cultura.gob.es/pci-nacional/tauromaquia/'},
    {title:'Marco legal · Ley 18/2013',owner:'BOE · abrir el texto consolidado y revisar su vigencia',url:'https://www.boe.es/buscar/act.php?id=BOE-A-2013-11837'},
  ],
};
let universe='files',filter='',currentFile=null,rows=[],uiEpoch=0,searchTurn=0,busy=false,legalDraft='',pendingBackup=null,backupPickEpoch=null;
const fileIntents=new Map();
let toastTimer=null,backgroundTimer=null,backgroundAt=0;
const urls=new Set();
const today=()=>new Date().toISOString().slice(0,10);
function toast(message){clearTimeout(toastTimer);$('universeToast').textContent=message;$('universeToast').hidden=false;toastTimer=setTimeout(()=>{$('universeToast').hidden=true;},5500);}
function errorMessage(error){
  const code=error?.code||error?.message;
  const map={DOC_LOCKED:'Abre primero tu archivo privado con tu frase.',DOC_PHRASE:'Usa una frase única de al menos 14 caracteres.',DOC_AUTH:'La frase no abre el archivo, o la copia está dañada. No se ha cambiado su contenido.',DOC_FORMAT:'El archivo o la copia no tiene un formato válido. Se conservan los datos anteriores.',DOC_UNSUPPORTED:'Este navegador no dispone del almacenamiento o cifrado necesarios. Usa un navegador actual con HTTPS.',DOC_LOCKS_UNAVAILABLE:'Este navegador no puede coordinar los archivos entre pestañas. Utiliza una versión actual.',DOC_STORAGE:'No se pudo guardar o leer. Comprueba el espacio disponible y conserva una copia.',DOC_BUSY:'Otra pestaña impide abrir el archivo. Ciérrala y vuelve a intentarlo.',DOC_STALE:'El archivo ha cambiado en otra pestaña. Vuelve a abrirlo.',DOC_FILE_TOO_LARGE:'Este archivo supera 25 MiB. Se ha conservado en su lugar de origen.',DOC_LIMIT:'Se alcanzó un límite de tamaño o cantidad. Conserva una copia y añade menos archivos.',DOC_NOT_FOUND:'No se ha encontrado este archivo. Actualiza la búsqueda.',DOC_CANCELLED:'La operación se detuvo al bloquear el archivo.',PHRASE_MISMATCH:'Las dos frases no coinciden. Compruébalas antes de abrir.',TOO_MANY_FILES:'Elige hasta 100 archivos cada vez. No se ha importado ninguno de esta selección.',CAMERA_PERMISSION:'No se ha autorizado la cámara. Puedes permitirla en los ajustes del navegador o elegir una foto existente.',CAMERA_UNAVAILABLE:'La cámara no está disponible. Comprueba los permisos, HTTPS y que otra app no la esté usando.',CAMERA_FRAME_UNAVAILABLE:'Espera a que la cámara muestre una imagen antes de guardar.',TORCH_UNAVAILABLE:'Este teléfono o navegador no permite controlar la linterna desde aquí.'};
  return map[code]||'No se pudo completar la operación. Tus originales se conservan.';
}
function showError(id,error){if(error?.message==='CAMERA_CANCELLED')return;$(id).textContent=errorMessage(error);$(id).hidden=false;}
function clearError(id){$(id).textContent='';$(id).hidden=true;}
function showDialog(id){if(!$(id).open)$(id).showModal();}
function bytes(size){return size<1024?`${size} B`:size<1048576?`${(size/1024).toFixed(1)} KB`:`${(size/1048576).toFixed(1)} MB`;}
function setBusy(value){busy=value;$('vaultOpenButton').disabled=value;$('addFilesButton').disabled=value;$('exportDocumentBackup').disabled=value;$('importDocumentBackup').disabled=value;$('pickFolderButton').disabled=value;}
function checkTurn(turn){if(turn!==uiEpoch||document.hidden)throw new DocumentVaultError('DOC_CANCELLED');}
function showUniverse(name){
  if(!['files','camera','legal','hunting','bullfighting'].includes(name))return;
  if(name!=='camera')camera.stop();universe=name;
  for(const id of ['files','camera','legal','hunting','bullfighting'])$(id+'Universe').hidden=id!==name;
  document.querySelectorAll('[data-universe]').forEach(button=>{if(button.dataset.universe===name)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
}
document.querySelectorAll('[data-universe]').forEach(button=>button.addEventListener('click',()=>showUniverse(button.dataset.universe)));
document.querySelectorAll('[data-universe-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.universeClose).close()));
for(const [section,items] of Object.entries(sources)){
  const root=$(section+'Sources');
  for(const source of items){const link=el('a','universe-source');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';link.append(el('strong','',source.title+' ↗'),el('span','',source.owner));root.append(link);}
}
function renderVaultState(){
  $('vaultEntry').hidden=vault.isUnlocked;$('vaultWorkspace').hidden=!vault.isUnlocked;
  $('vaultStatus').textContent=vault.isUnlocked?'Abierto en este dispositivo':'Archivo cerrado';
  if(!vault.isUnlocked){rows=[];$('fileResults').replaceChildren();$('fileCount').textContent='';}
}
function lockVault(){
  uiEpoch++;searchTurn++;vault.lock();camera.stop();currentFile=null;pendingBackup=null;backupPickEpoch=null;fileIntents.clear();legalDraft='';rows=[];
  for(const url of urls)URL.revokeObjectURL(url);urls.clear();
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  $('fileDetailContent').replaceChildren();$('fileDetailTitle').textContent='Mi archivo';$('legalDraftText').textContent='';$('legalDraftPanel').hidden=true;
  for(const id of ['vaultError','cameraError','restoreDocumentError'])clearError(id);
  for(const id of ['restoreDocumentInfo','cameraStatus'])$(id).textContent='';
  for(const id of ['vaultPhrase','vaultPhraseConfirm','fileSearch','backupPhrase','legalFacts','legalGoal','legalDeadline','huntingPlace','huntingDate','huntingNote','bullfightingTitleInput','bullfightingDate','bullfightingNote'])$(id).value='';
  $('vaultProgress').textContent='';renderVaultState();
}
$('lockVaultButton').addEventListener('click',()=>{lockVault();toast('Archivo bloqueado. Tus documentos guardados permanecen cifrados.');});
$('vaultUnlockForm').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;clearError('vaultError');setBusy(true);const turn=uiEpoch;let phrase=$('vaultPhrase').value;
  try{
    if(!window.isSecureContext)throw new DocumentVaultError('DOC_UNSUPPORTED');
    if($('vaultPhraseConfirm').value&&$('vaultPhraseConfirm').value!==phrase)throw new Error('PHRASE_MISMATCH');
    const result=await vault.unlock(phrase);checkTurn(turn);renderVaultState();await renderFiles();checkTurn(turn);
    toast(result.created?'Tu archivo cifrado está creado. Guarda una copia cuando añadas documentos.':'Tu archivo está abierto en este dispositivo.');
  }catch(error){if(turn===uiEpoch){vault.lock();renderVaultState();showError('vaultError',error);}}
  finally{phrase='';$('vaultPhrase').value='';$('vaultPhraseConfirm').value='';setBusy(false);}
});
async function renderFiles(){
  if(!vault.isUnlocked)return;const turn=uiEpoch,request=++searchTurn;
  try{
    const found=await vault.search($('fileSearch').value);if(turn!==uiEpoch||request!==searchTurn||document.hidden)return;
    rows=found.filter(item=>!filter||item.category===filter);const root=$('fileResults');root.replaceChildren();
    $('fileCount').textContent=`${rows.length} ${rows.length===1?'archivo':'archivos'} · original conservado en tu archivo cifrado`;
    if(!rows.length){root.append(el('div','file-empty',$('fileSearch').value?'No hay coincidencias. Prueba otro nombre o una palabra del texto compatible.':'Aquí irá lo que quieras guardar. Una foto, un contrato, un cartel, una nota…'));return;}
    for(const item of rows){const card=el('article','file-card');const ext=item.name.includes('.')?item.name.split('.').pop().slice(0,5).toUpperCase():'FILE';card.append(el('span','',ext));const body=el('div');body.append(el('h3','',item.nameDisplay||item.name),el('p','',`${categories[item.category]||item.category} · ${bytes(item.size)}`),el('p','',statuses[item.analysisStatus]||'Original conservado'));const button=el('button','','Abrir ↗');button.type='button';button.setAttribute('aria-label','Abrir '+(item.nameDisplay||item.name));button.addEventListener('click',()=>void openFile(item.id));card.append(body,button);root.append(card);}
  }catch(error){if(turn===uiEpoch)showError('vaultError',error);}
}
let searchTimer;
$('fileSearch').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>void renderFiles(),180);});
function setFilter(category){filter=category;document.querySelectorAll('[data-file-filter]').forEach(button=>{const active=button.dataset.fileFilter===category;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});void renderFiles();}
document.querySelectorAll('[data-file-filter]').forEach(button=>button.addEventListener('click',()=>setFilter(button.dataset.fileFilter)));
function requireVault(){if(vault.isUnlocked)return true;showUniverse('files');toast('Abre primero tu archivo privado. No se ha guardado ni enviado nada.');$('vaultPhrase').focus();return false;}
function chooseFiles(id,category=''){if(busy||!requireVault())return;fileIntents.set(id,{epoch:uiEpoch,category});$(id).click();}
$('addFilesButton').addEventListener('click',()=>chooseFiles('universalFileInput'));
$('pickFolderButton').addEventListener('click',()=>chooseFiles('universalFolderInput'));
document.querySelectorAll('[data-add-category]').forEach(button=>button.addEventListener('click',()=>chooseFiles('universalFileInput',button.dataset.addCategory)));
document.querySelectorAll('[data-open-category]').forEach(button=>button.addEventListener('click',()=>{showUniverse('files');setFilter(button.dataset.openCategory);}));
async function importPicked(input){
  const files=Array.from(input.files||[]),intent=fileIntents.get(input.id);input.value='';fileIntents.delete(input.id);
  if(!files.length||!intent||intent.epoch!==uiEpoch||document.hidden||!vault.isUnlocked)return;clearError('vaultError');
  if(files.length>100){showError('vaultError',new Error('TOO_MANY_FILES'));return;}
  const turn=uiEpoch,category=intent.category;setBusy(true);let count=0,failed=[];
  try{for(const [position,file] of files.entries()){checkTurn(turn);$('vaultProgress').textContent=`Guardando ${position+1} de ${files.length}…`;try{await vault.importFile(file,category?{category}:{});checkTurn(turn);count++;}catch(error){checkTurn(turn);failed.push(`${file.name}: ${errorMessage(error)}`);}}
    $('vaultProgress').textContent=`${count} ${count===1?'archivo guardado':'archivos guardados'}${failed.length?` · ${failed.length} no se han podido añadir`:''}.`;
    if(failed.length){$('vaultError').textContent=failed.slice(0,8).join('\n')+(failed.length>8?'\nHay más archivos no importados. Conserva la selección original.':'');$('vaultError').hidden=false;}
    if(category)setFilter(category);await renderFiles();
  }catch(error){if(turn===uiEpoch)showError('vaultError',error);}finally{setBusy(false);}
}
$('universalFileInput').addEventListener('change',event=>void importPicked(event.target));
$('universalFolderInput').addEventListener('change',event=>void importPicked(event.target));
async function openFile(id){
  const turn=uiEpoch;currentFile=id;
  try{
    const detail=await vault.details(id);checkTurn(turn);if(currentFile!==id)return;const item=detail.document;
    $('fileDetailTitle').textContent=item.nameDisplay||item.name;const root=$('fileDetailContent');root.replaceChildren();
    const dl=el('dl');for(const [label,value] of [['Original',item.name],['Categoría',categories[item.category]||item.category],['Tamaño',bytes(item.size)],['Lectura',statuses[item.analysisStatus]],['Guardado',new Date(item.addedAt).toLocaleString('es-ES')],['SHA-256',item.hash]]){dl.append(el('dt','',label),el('dd','',value));}root.append(dl);
    if(detail.limitations?.length)for(const limitation of detail.limitations)root.append(el('p','universe-small',lossLabels[limitation]||'La lectura tiene una limitación de formato o tamaño.'));
    if(detail.reduction){root.append(el('h3','','CAnnoNico · lectura por reglas'));const summary=detail.reduction.signals?.map(signal=>`${signal.field}: ${signal.count}`).join(' · ');if(summary)root.append(el('p','universe-small',summary));root.append(el('p','universe-small','La clasificación no sustituye una revisión humana. Las líneas sin clasificar y el original se conservan.'));}
    if(typeof detail.text==='string'){const preview=el('pre','',detail.text.slice(0,6000));root.append(preview);if(detail.text.length>6000)root.append(el('p','universe-small','Vista de los primeros 6 000 caracteres. Recupera el original para leer todo.'));}
    const form=el('form','universe-form'),label=el('label','','Dónde guardarlo'),select=el('select');select.id='fileCategoryEdit';label.htmlFor=select.id;
    const choices={...categories};if(!choices[item.category])choices[item.category]=item.category;
    for(const [key,text] of Object.entries(choices)){const option=el('option','',text);option.value=key;option.selected=key===item.category;select.append(option);}
    const tagsLabel=el('label','','Palabras para encontrarlo, separadas por comas'),tags=el('input');tags.id='fileTagsEdit';tagsLabel.htmlFor=tags.id;tags.value=(item.tags||[]).join(', ');tags.maxLength=700;
    const submit=el('button','universe-secondary','Guardar clasificación');submit.type='submit';form.append(label,select,tagsLabel,tags,submit);
    form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{checkTurn(turn);await vault.updateMetadata(id,{category:select.value,tags:tags.value.split(',').map(s=>s.trim()).filter(Boolean)});checkTurn(turn);toast('Clasificación guardada. El original no se ha modificado.');await renderFiles();}catch(error){if(turn===uiEpoch)toast(errorMessage(error));}finally{submit.disabled=false;}});root.append(form);showDialog('fileDetailDialog');
  }catch(error){if(turn===uiEpoch)showError('vaultError',error);}
}
function download(name,blob){const url=URL.createObjectURL(new Blob([blob],{type:'application/octet-stream'}));urls.add(url);const link=el('a');link.href=url;link.download=name.replace(/[\u0000-\u001f\u007f/\\]/g,'_').slice(0,240)||'archivo';document.body.append(link);link.click();link.remove();setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},30000);}
$('downloadOriginalButton').addEventListener('click',async()=>{if(!currentFile)return;const id=currentFile,turn=uiEpoch;try{const detail=await vault.details(id),blob=await vault.retrieve(id);checkTurn(turn);if(currentFile!==id)return;download(detail.document.name,blob);toast('Original preparado para guardar. Esta copia ya no estará dentro del archivo cifrado.');}catch(error){if(turn===uiEpoch)toast(errorMessage(error));}});
$('deleteDocumentButton').addEventListener('click',async()=>{if(!currentFile||!window.confirm('¿Eliminar este archivo de este navegador? Conserva antes el original o una copia cifrada. No se podrá deshacer desde aquí.'))return;const id=currentFile,turn=uiEpoch;try{await vault.deleteFile(id);checkTurn(turn);$('fileDetailDialog').close();currentFile=null;await renderFiles();toast('Archivo eliminado de este archivo local.');}catch(error){if(turn===uiEpoch)toast(errorMessage(error));}});
$('exportDocumentBackup').addEventListener('click',async()=>{if(busy||!requireVault())return;setBusy(true);const turn=uiEpoch;try{const blob=await vault.exportBackup();checkTurn(turn);download(`Jaime-archivo-cifrado-${today()}.json`,blob);toast('Copia cifrada preparada. Conserva también su frase en un lugar seguro.');}catch(error){if(turn===uiEpoch)showError('vaultError',error);}finally{setBusy(false);}});
$('importDocumentBackup').addEventListener('click',()=>{if(!busy&&requireVault()){backupPickEpoch=uiEpoch;$('vaultBackupInput').click();}});
$('vaultBackupInput').addEventListener('change',event=>{const file=event.target.files?.[0],turn=backupPickEpoch;event.target.value='';backupPickEpoch=null;if(!file||turn!==uiEpoch||document.hidden||!vault.isUnlocked)return;pendingBackup=file;$('restoreDocumentInfo').textContent=`Copia seleccionada: ${file.name} · ${bytes(file.size)}. Se verificará antes de añadir archivos; los actuales se conservan.`;$('backupPhrase').value='';clearError('restoreDocumentError');showDialog('restoreDocumentDialog');});
$('restoreDocumentForm').addEventListener('submit',async event=>{event.preventDefault();if(!pendingBackup||busy)return;setBusy(true);$('confirmDocumentRestore').disabled=true;const turn=uiEpoch;try{const result=await vault.importBackup(pendingBackup,$('backupPhrase').value);checkTurn(turn);$('restoreDocumentDialog').close();pendingBackup=null;await renderFiles();toast(`${result.imported} archivos recuperados; ${result.skipped} ya estaban guardados.`);}catch(error){if(turn===uiEpoch)showError('restoreDocumentError',error);}finally{$('backupPhrase').value='';setBusy(false);$('confirmDocumentRestore').disabled=false;}});
$('restoreDocumentDialog').addEventListener('close',()=>{$('backupPhrase').value='';pendingBackup=null;});

const camera=createLowLightCamera({onState:state=>{
  const active=state.phase==='on',starting=state.phase==='starting';$('nightVideo').hidden=!active;$('cameraPlaceholder').hidden=active;
  $('startCameraButton').disabled=active||starting;$('stopCameraButton').disabled=!active&&!starting;$('captureDocumentButton').disabled=!active;
  $('torchButton').disabled=!active||!state.torchSupported;
  $('torchButton').textContent=!active?'Linterna no comprobada':!state.torchSupported?'Linterna no disponible':state.torchConfirmed===true?'Apagar linterna':state.torchConfirmed===null?'Linterna · estado no confirmado':'Encender linterna';
  $('cameraModeLabel').textContent=active?'Vista local · sin transmisión':starting?'Esperando permiso…':'Sin captura';
  if(!active&&!starting)$('cameraStatus').textContent='Cámara apagada.';
}});
$('startCameraButton').addEventListener('click',async()=>{clearError('cameraError');try{if(!navigator.mediaDevices?.getUserMedia||!window.isSecureContext)throw new Error('CAMERA_UNAVAILABLE');await camera.start($('nightVideo'));if(document.hidden||universe!=='camera'||camera.getState().phase!=='on')return;$('cameraStatus').textContent='Cámara encendida. Solo se guardará una foto cuando pulses Guardar.';}catch(error){if(error.name==='NotAllowedError')showError('cameraError',new Error('CAMERA_PERMISSION'));else showError('cameraError',error);}});
$('stopCameraButton').addEventListener('click',()=>{camera.stop();$('cameraStatus').textContent='Cámara apagada.';});
$('brightnessRange').addEventListener('input',event=>{const value=Math.max(1,Math.min(3,Number(event.target.value)));$('nightVideo').style.filter=`brightness(${value})`;$('brightnessValue').textContent=`${value.toFixed(1).replace('.0','')}×`;});
$('torchButton').addEventListener('click',async()=>{const target=camera.getState().torchConfirmed!==true;$('torchButton').disabled=true;try{const result=await camera.setTorch(target);$('cameraStatus').textContent=result.confirmed?(result.active?'Linterna activada y confirmada por la cámara.':'Linterna apagada y confirmada por la cámara.'):'Se solicitó el cambio, pero la cámara no confirmó el estado de la linterna.';}catch(error){showError('cameraError',error);}finally{$('torchButton').disabled=camera.getState().phase!=='on'||!camera.getState().torchSupported;}});
$('scanDocumentButton').addEventListener('click',()=>{showUniverse('camera');toast('Abre la cámara y fotografía el papel. Su texto todavía no se reconocerá automáticamente.');});
$('captureDocumentButton').addEventListener('click',async()=>{if(!requireVault())return;const turn=uiEpoch;$('captureDocumentButton').disabled=true;try{const blob=await camera.capture();checkTurn(turn);const name=`foto-documento-${new Date().toISOString().replace(/[:.]/g,'-')}.jpg`;await vault.importFile(new File([blob],name,{type:'image/jpeg'}),{category:'fotos',tags:['Captura de cámara','Sin OCR']});checkTurn(turn);$('cameraStatus').textContent='Foto guardada en tu archivo cifrado. No se ha enviado a ningún servidor.';toast('Foto guardada en Mi archivo.');}catch(error){if(turn===uiEpoch)showError('cameraError',error);}finally{$('captureDocumentButton').disabled=camera.getState().phase!=='on';}});

const legalQuestions={
  'Contrato o venta':['¿Qué versión del contrato y qué condiciones se aplican?','¿Qué obligaciones, pruebas, pagos o entregas faltan?','¿Qué opciones y costes existen antes de firmar, resolver o reclamar?'],
  Trabajo:['¿Qué normativa laboral y convenio pueden aplicarse?','¿Qué nóminas, comunicaciones y documentos conviene aportar?','¿Hay un plazo concreto que deba confirmar inmediatamente?'],
  Vivienda:['¿Qué contrato, fianza y comunicaciones deben revisarse?','¿Qué obligaciones tiene cada parte en esta situación?','¿Cuál es el procedimiento y qué plazo debe confirmar un profesional?'],
  Administración:['¿Qué órgano emitió el documento y cómo consta la notificación?','¿Qué recurso o actuación procede, si alguno?','¿Cuál es el plazo aplicable y desde qué fecha se cuenta?'],
};
$('legalForm').addEventListener('submit',event=>{
  event.preventDefault();const country=$('legalCountry').value,topic=$('legalTopic').value,deadline=$('legalDeadline').value;
  const questions=legalQuestions[topic]||['¿Qué normativa, autoridad y jurisdicción corresponden a estos hechos?','¿Qué documentación y pruebas faltan?','¿Qué opciones, riesgos, costes y fechas límite hay que confirmar?'];
  legalDraft=`DOSSIER PARA CONSULTA · BORRADOR A REVISAR\n\nPreparado el ${new Date().toLocaleDateString('es-ES')}\nLugar / ámbito indicado por mí: ${country}\nAsunto: ${topic}\n\nHECHOS APORTADOS POR MÍ\n${$('legalFacts').value.trim()}\n\nQUÉ QUIERO ACLARAR\n${$('legalGoal').value.trim()}\n\nFECHA QUE HE TRANSCRITO\n${deadline||'No indicada'}\nEsta fecha no está validada como plazo legal. Aportaré el documento y su notificación.\n\nDOCUMENTOS QUE VOY A REUNIR\n- Originales y todas sus páginas.\n- Comunicaciones y justificantes relacionados.\n- Cronología de hechos y fechas.\n- Datos que aún están por confirmar.\n\nPREGUNTAS PARA EL PROFESIONAL\n${questions.map((question,i)=>`${i+1}. ${question}`).join('\n')}\n\nESTADO\nOrganización de mis datos, sin dictamen jurídico ni cálculo automático de plazos. Nada se ha presentado ni enviado.\n\nFUENTES OFICIALES PARA CONSULTAR\n${sources.legal.map(source=>source.title+' — '+source.url).join('\n')}`;
  $('legalDraftText').textContent=legalDraft;$('legalDraftPanel').hidden=false;toast('Dossier preparado para que lo revises. Todavía no está guardado.');
});
async function saveNote(name,text,category,tags=[]){if(!requireVault())return false;const turn=uiEpoch;try{await vault.importFile(new File([text],name,{type:'text/plain'}),{category,tags});checkTurn(turn);toast('Guardado en tu archivo cifrado.');return true;}catch(error){if(turn===uiEpoch)toast(errorMessage(error));return false;}}
$('saveLegalDraft').addEventListener('click',async()=>{if(legalDraft)await saveNote(`juridico-consulta-${today()}.txt`,legalDraft,'juridico',['Consulta','Por revisar']);});
$('copyLegalDraft').addEventListener('click',async()=>{if(!legalDraft)return;try{await navigator.clipboard.writeText(legalDraft);toast('Texto copiado. Al pegarlo fuera, dejará la protección del archivo privado.');}catch{toast('No se pudo copiar automáticamente. Puedes seleccionar el texto de la consulta.');}});
$('huntingForm').addEventListener('submit',async event=>{event.preventDefault();const text=`CUADERNO DE CAZA · SALIDA PREVISTA\n\nLugar: ${$('huntingPlace').value.trim()}\nFecha indicada: ${$('huntingDate').value}\n\nMis notas:\n${$('huntingNote').value.trim()}\n\nPor comprobar con la autoridad y el responsable de la actividad:\n- Licencia, seguro y autorización del terreno.\n- Temporada, especie y modalidad permitidas.\n- Previsión, acceso y contacto de emergencia.\n\nEsta nota no acredita ninguna autorización ni reserva.`;if(await saveNote(`caza-salida-${$('huntingDate').value}.txt`,text,'caza',['Salida prevista']))$('huntingForm').reset();});
$('bullfightingForm').addEventListener('submit',async event=>{event.preventDefault();const text=`CUADERNO DE TAUROMAQUIA\n\nTítulo: ${$('bullfightingTitleInput').value.trim()}\nFecha indicada: ${$('bullfightingDate').value||'Por confirmar'}\n\nMis notas:\n${$('bullfightingNote').value.trim()}\n\nSi se trata de un plan, confirmar con el organizador la fecha, condiciones y disponibilidad. No hay reserva realizada.`;if(await saveNote(`tauromaquia-cuaderno-${$('bullfightingDate').value||today()}.txt`,text,'tauromaquia',['Cuaderno']))$('bullfightingForm').reset();});
document.addEventListener('visibilitychange',()=>{
  clearTimeout(backgroundTimer);
  if(document.hidden){camera.stop();document.body.classList.add('universe-hidden');backgroundAt=Date.now();if(busy){lockVault();return;}backgroundTimer=setTimeout(lockVault,60000);}
  else{if(backgroundAt&&Date.now()-backgroundAt>=60000)lockVault();backgroundAt=0;document.body.classList.remove('universe-hidden');}
});
window.addEventListener('pagehide',lockVault);
window.addEventListener('pageshow',()=>{document.body.classList.remove('universe-hidden');renderVaultState();});
renderVaultState();
