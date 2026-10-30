import * as matrix from 'matrix-js-sdk';
import {AllDevicesIsolationMode,EventShieldColour} from 'matrix-js-sdk/lib/crypto-api/index.js';
import {CryptoEvent} from 'matrix-js-sdk/lib/crypto-api/CryptoEvent.js';
import {decodeRecoveryKey} from 'matrix-js-sdk/lib/crypto-api/recovery-key.js';
import {VerificationPhase,VerificationRequestEvent,VerifierEvent} from 'matrix-js-sdk/lib/crypto-api/verification.js';
import {logger} from 'matrix-js-sdk/lib/logger.js';
import {createSecureMessenger,SecureMessagingError} from './matrix-client.mjs';
import {readVault,persistSession,openSession,removeVault,safeHomeserver,validatePhrase} from './session-vault.mjs';

// Keep SDK diagnostics out of browser logs. Nothing here is sent to analytics.
logger.setLevel('silent',false);
const noop = () => {};
const quietLogger = {trace:noop,debug:noop,info:noop,warn:noop,error:noop,log:noop,getChild(){return this;}};
const sdk = {...matrix,AllDevicesIsolationMode,EventShieldColour,CryptoEvent,decodeRecoveryKey};
const $ = id => document.getElementById(id);
const element = (tag,cls,text) => {const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
let vaultEnvelope = null, remembered = false, busy = false, epoch = 0, roomCheck = 0;
let activeAuthClient = null;
let sendBusy = false, sendFeedback = '';
let rooms = [], selectedRoom = null, selectedRequest = null, selectedVerifier = null, sasCallbacks = null, identitySetup = null;
let requestChangeHandler = null, hiddenAt = 0, lockTimer = null, toastTimer = null, lastState = {};
const messages = new Map();
const startedVerifiers = new WeakSet();
const verifierHandlers = new Map();
const unreadVerifications = [];
const knownRequests = new WeakSet();
const translations = {Dog:'Perro',Cat:'Gato',Lion:'León',Horse:'Caballo',Unicorn:'Unicornio',Pig:'Cerdo',Elephant:'Elefante',Rabbit:'Conejo',Panda:'Panda',Rooster:'Gallo',Penguin:'Pingüino',Turtle:'Tortuga',Fish:'Pez',Octopus:'Pulpo',Butterfly:'Mariposa',Flower:'Flor',Tree:'Árbol',Cactus:'Cactus',Mushroom:'Seta',Globe:'Globo',Moon:'Luna',Cloud:'Nube',Fire:'Fuego',Banana:'Plátano',Apple:'Manzana',Strawberry:'Fresa',Corn:'Maíz',Pizza:'Pizza',Cake:'Tarta',Heart:'Corazón',Smiley:'Sonrisa',Robot:'Robot',Hat:'Sombrero',Glasses:'Gafas',Spanner:'Llave',Santa:'Papá Noel',Airplane:'Avión',Rocket:'Cohete',Trophy:'Trofeo',Ball:'Balón',Guitar:'Guitarra',Trumpet:'Trompeta',Bell:'Campana',Anchor:'Ancla',Headphones:'Auriculares',Folder:'Carpeta',Pin:'Chincheta',Scissors:'Tijeras',Lock:'Candado',Key:'Llave',Hammer:'Martillo',Telephone:'Teléfono',Flag:'Bandera',Train:'Tren',Bicycle:'Bicicleta',Aeroplane:'Avión',Car:'Coche',Bus:'Autobús',Clock:'Reloj',Book:'Libro',Pencil:'Lápiz',Paperclip:'Clip',Gift:'Regalo',Lightbulb:'Bombilla'};

function toast(text) {clearTimeout(toastTimer);$('secureToast').textContent=text;$('secureToast').hidden=false;toastTimer=setTimeout(()=>{$('secureToast').hidden=true;},5000);}
function showError(id,error) {
  const code=error?.code || error?.message;
  const local={VAULT_PHRASE:'Elige una frase de al menos 14 caracteres. Es mejor usar varias palabras únicas.',VAULT_LOCKED:'La frase no abre este acceso, o el archivo está dañado. No se ha cambiado nada.',VAULT_FORMAT:'El acceso guardado no se reconoce. Se conserva sin sobrescribirlo.',VAULT_STORAGE:'No se pudo guardar o leer el acceso cifrado. Comprueba el espacio del navegador.',VAULT_BUSY:'Otra pestaña está usando el acceso. Ciérrala y vuelve a intentarlo.',VAULT_UNSUPPORTED:'Este navegador no permite guardar el acceso de forma protegida.',HOMESERVER_URL:'Introduce una dirección HTTPS sin contraseña, parámetros ni fragmentos.',PHRASE_MISMATCH:'Las dos frases no coinciden.',PHRASE_REUSE:'Usa una frase local distinta de la contraseña de tu cuenta.',LOGIN_UNSUPPORTED:'Este servicio necesita otro método de acceso. Pide a su administrador un acceso compatible.',LOGIN_FAILED:'No se pudo conectar. Comprueba la dirección, el identificador y la contraseña.',BROWSER_UNSUPPORTED:'Para conectar necesitas un navegador actual, HTTPS, WebCrypto, IndexedDB y bloqueo entre pestañas.',IDENTITY_AUTH_UNSUPPORTED:'El servicio pide una autenticación adicional que debe completarse con su administrador.',VAULT_EXISTS:'Ya hay un acceso guardado. Ábrelo y cierra esa cuenta antes de sustituirlo.'};
  if(code==='UI_CANCELLED')return;
  const text=error instanceof SecureMessagingError ? error.message : local[code] || 'No se pudo completar. Comprueba la conexión y vuelve a intentarlo.';
  $(id).textContent=text;$(id).hidden=false;
}
function clearError(id) {$(id).textContent='';$(id).hidden=true;}
function dialog(id) {if(!$(id).open)$(id).showModal();}
function setBusy(value) {busy=value;$('connectButton').disabled=value;$('unlockButton').disabled=value;}
function assertBrowser() {if(!window.isSecureContext || !crypto?.subtle || !window.indexedDB || !navigator.locks)throw new Error('BROWSER_UNSUPPORTED');}
function assertCurrent(turn) {if(turn!==epoch||document.hidden)throw new Error('UI_CANCELLED');}
function clearPrivateUI() {
  activeAuthClient?.http?.abort?.();
  sendBusy=false;sendFeedback='';
  epoch++;roomCheck++;messages.clear();rooms=[];selectedRoom=null;identitySetup=null;sasCallbacks=null;selectedVerifier=null;
  if(selectedRequest&&requestChangeHandler)selectedRequest.off(VerificationRequestEvent.Change,requestChangeHandler);
  selectedRequest=null;requestChangeHandler=null;unreadVerifications.length=0;
  $('secureThread').replaceChildren();$('secureRoomsList').replaceChildren();$('devicesList').replaceChildren();$('verificationEmojis').replaceChildren();
  for(const [verifier,handler] of verifierHandlers)verifier.off(VerifierEvent.ShowSas,handler);verifierHandlers.clear();
  for(const id of ['secureMessageInput','recoveryKeyConfirm','identityPasswordInput','identityRecoveryInput','matrixPasswordInput','devicePhraseInput','devicePhraseConfirm','unlockPhrase','peerIdInput'])$(id).value='';
  for(const id of ['sessionUser','sessionDevice','recoveryKeyDisplay','verificationPeer','verificationNumbers','roomWarning','threadTitle','verificationStatus'])$(id).textContent='';
  for(const id of ['confirmSasButton','rejectSasButton','acceptVerificationButton','startSasButton'])$(id).hidden=true;
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  $('secureSendButton').disabled=true;$('secureMessageInput').disabled=true;
}
function onState(state) {
  lastState=state;
  const connected=state.phase==='connected'&&state.synced&&state.cryptoReady;
  $('logoutButton').disabled=!connected;
  $('sessionArea').hidden=!connected;
  $('connectionCard').hidden=connected;
  $('secureWelcome').hidden=connected;
  const status=$('securityStatus');
  if(connected){
    $('connectionProgress').textContent='';
    $('sessionUser').textContent=state.userId;
    $('sessionDevice').textContent=`Dispositivo ${state.deviceId}`;
    $('identityNotice').hidden=state.ownIdentityVerified&&state.ownDeviceVerified;
    status.textContent=state.ownIdentityVerified&&state.ownDeviceVerified?'Dispositivo verificado':'Dispositivo por verificar';
    status.dataset.status=state.ownIdentityVerified&&state.ownDeviceVerified?'verified':'locked';
    if(selectedRoom)void checkRoom(selectedRoom);
  } else {
    $('secureSendButton').disabled=true;$('secureMessageInput').disabled=true;
    const phases={connecting:'Abriendo acceso…',authenticating:'Comprobando la cuenta…',initializing_crypto:'Abriendo las claves de este dispositivo…',syncing:'Conectando tus conversaciones…',reconnecting:'Esperando conexión…'};
    status.textContent=phases[state.phase]|| (vaultEnvelope?'Acceso bloqueado':'Sin conectar');
    status.dataset.status=phases[state.phase]?'connecting':vaultEnvelope?'locked':'offline';
    $('connectionProgress').textContent=phases[state.phase]||'';
    if(state.phase==='disconnected') {selectedRoom=null;$('threadPanel').hidden=true;$('roomsPanel').hidden=false;delete $('secureView').dataset.mode;}
  }
}
function onMessage(message) {
  if(!lastState.cryptoReady||!lastState.synced)return;
  const entries=messages.get(message.roomId)||new Map();entries.set(message.eventId,message);
  while(entries.size>150)entries.delete(entries.keys().next().value);
  messages.set(message.roomId,entries);
  if(selectedRoom===message.roomId)renderThread();
}
const messenger=createSecureMessenger({sdk,onState,onRooms:list=>{rooms=list;renderRooms();},onMessage,onError:error=>{if(lastState.phase==='connected')showError('sessionError',new SecureMessagingError(error.code,error.message));},onVerification:request=>{
  if(knownRequests.has(request))return;knownRequests.add(request);
  if(selectedRequest?.pending){unreadVerifications.push(request);toast('Hay otra solicitud de verificación pendiente.');return;}
  openVerification(request);
}});

async function refreshVault() {
  vaultEnvelope=await readVault();remembered=!!vaultEnvelope;
  $('unlockForm').hidden=!vaultEnvelope;
  $('showConnectionButton').hidden=!!vaultEnvelope;
  $('resetAccessButton').hidden=!vaultEnvelope;
  $('connectForm').hidden=true;
  if(vaultEnvelope){$('connectionTitle').textContent='Tu espacio te espera.';$('connectionDescription').textContent='Abre tu acceso cifrado con la frase de este dispositivo.';}
  else{$('connectionTitle').textContent='Preparamos tu espacio.';$('connectionDescription').textContent='Tu acceso todavía no está configurado en este dispositivo. Cuando tengas tu cuenta privada, podrás conectarla aquí. No necesitas ChatGPT.';}
  onState(messenger.getState());
}
function safeFetch(baseUrl){const origin=new URL(baseUrl).origin;return(resource,options={})=>{
  const url=new URL(typeof resource==='string'?resource:resource.url||resource.href);
  if(url.origin!==origin||url.username||url.password)throw new Error('LOGIN_FAILED');
  return fetch(resource,{...options,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
};}
$('showConnectionButton').addEventListener('click',()=>{$('connectForm').hidden=false;$('showConnectionButton').hidden=true;$('homeserverInput').focus();});
$('resetAccessButton').addEventListener('click',async()=>{
  if(busy||messenger.getState().cryptoReady)return;
  if(!window.confirm('¿Retirar el acceso cifrado guardado en este navegador? La cuenta del servidor no se borra ni se revoca. Las claves locales cifradas se conservan. Necesitarás tu contraseña y tu clave de recuperación o un dispositivo verificado para volver a entrar.'))return;
  setBusy(true);
  try{clearPrivateUI();await messenger.lock();await removeVault();await refreshVault();toast('Puedes configurar un nuevo acceso. Las claves locales anteriores se conservan.');}
  catch(error){showError('connectionError',error);}finally{setBusy(false);}
});
$('connectForm').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;clearError('connectionError');setBusy(true);const turn=epoch;let authClient=null,session=null,phrase='',stored=false,createdToken=false;
  try{
    assertBrowser();if(vaultEnvelope)throw new Error('VAULT_EXISTS');
    const homeserverUrl=safeHomeserver($('homeserverInput').value.trim()),userId=$('matrixUserInput').value.trim();
    if(!/^@[^\s:]+:[^\s]+$/.test(userId))throw new SecureMessagingError('INVALID_USER_ID','Escribe el identificador completo: @nombre:servidor.');
    phrase=validatePhrase($('devicePhraseInput').value);
    if(phrase!==$('devicePhraseConfirm').value)throw new Error('PHRASE_MISMATCH');
    if(phrase===$('matrixPasswordInput').value)throw new Error('PHRASE_REUSE');
    authClient=matrix.createClient({baseUrl:homeserverUrl,fetchFn:safeFetch(homeserverUrl),logger:quietLogger,localTimeoutMs:20000});activeAuthClient=authClient;
    $('connectionProgress').textContent='Comprobando el servicio…';
    const flows=await authClient.loginFlows();
    assertCurrent(turn);
    if(!flows.flows?.some(flow=>flow.type==='m.login.password'))throw new Error('LOGIN_UNSUPPORTED');
    let login;
    try{login=await authClient.loginRequest({type:'m.login.password',identifier:{type:'m.id.user',user:userId},password:$('matrixPasswordInput').value,initial_device_display_name:'ojO Jaime · navegador privado',refresh_token:false});}
    catch{throw new Error('LOGIN_FAILED');}
    if(typeof login.access_token==='string'){authClient.setAccessToken(login.access_token);createdToken=true;}
    assertCurrent(turn);
    $('matrixPasswordInput').value='';
    if(login.user_id!==userId||!login.device_id||!login.access_token)throw new Error('LOGIN_FAILED');
    session={homeserverUrl,userId:login.user_id,deviceId:login.device_id,accessToken:login.access_token};
    authClient.setAccessToken(login.access_token);
    remembered=true;
    assertCurrent(turn);await persistSession(session,phrase);stored=true;assertCurrent(turn);vaultEnvelope=await readVault();assertCurrent(turn);
    await messenger.connect({...session,storagePassword:phrase});
    assertCurrent(turn);
    $('connectForm').reset();clearError('sessionError');
    toast('Cuenta conectada. Comprueba tus claves antes de enviar.');
  }catch(error){
    // Do not leave an orphaned new token when saving or initialization failed.
    if(createdToken&&!stored){try{await authClient.logout(true);}catch{}}
    if(turn===epoch)showError('connectionError',error);
    if(stored)await refreshVault();
  }finally{
    authClient?.setAccessToken('');authClient?.stopClient();if(activeAuthClient===authClient)activeAuthClient=null;session=null;phrase='';
    $('matrixPasswordInput').value='';$('devicePhraseInput').value='';$('devicePhraseConfirm').value='';setBusy(false);
  }
});
$('unlockForm').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;setBusy(true);clearError('connectionError');const turn=epoch;let phrase='',session=null;
  try{assertBrowser();phrase=$('unlockPhrase').value;session=await openSession(vaultEnvelope,phrase);assertCurrent(turn);await messenger.connect({...session,storagePassword:phrase});assertCurrent(turn);remembered=true;clearError('sessionError');}
  catch(error){if(turn===epoch)showError('connectionError',error);}
  finally{phrase='';session=null;$('unlockPhrase').value='';setBusy(false);}
});

function renderRooms(){
  const root=$('secureRoomsList');root.replaceChildren();
  const shown=rooms.filter(r=>['join','invite'].includes(r.membership));
  $('roomListNotice').textContent=shown.length?'Solo aparecen conversaciones con cifrado reconocido.':'Todavía no hay conversaciones cifradas. Puedes invitar a una persona con su identificador.';
  for(const room of shown){
    const button=element('button','secure-room-row');button.type='button';
    button.append(element('strong','',room.name||'Conversación privada'),element('small','',room.membership==='invite'?'Invitación · revisar y aceptar':room.privateInviteOnly?'Privada · comprobar dispositivos al abrir':'Revisar privacidad antes de enviar'));
    button.addEventListener('click',async()=>{
      try{
        if(room.membership==='invite'){
          if(!window.confirm('¿Aceptar la invitación a esta conversación cifrada? Los participantes verán que te has unido.'))return;
          await messenger.acceptInvite(room.roomId);
        }
        await openRoom(room.roomId);
      }catch(error){showError('sessionError',error);}
    });root.append(button);
  }
}
async function openRoom(id){
  sendFeedback='';
  selectedRoom=id;$('threadPanel').hidden=false;$('roomsPanel').hidden=true;$('vpnCard').hidden=true;$('secureView').querySelector(':scope > details').hidden=true;
  $('threadTitle').textContent=rooms.find(room=>room.roomId===id)?.name||'Conversación privada';
  $('secureMessageInput').value='';$('sendStatus').textContent='Comprobando participantes y dispositivos…';
  clearError('sessionError');renderThread();const turn=epoch;
  try{const history=await messenger.getRoomMessages(id);if(turn!==epoch||selectedRoom!==id)return;for(const message of history.messages)onMessage(message);await checkRoom(id);}
  catch(error){if(turn===epoch)showError('sessionError',error);}
}
async function checkRoom(id){
  const revision=++roomCheck,turn=epoch;
  $('secureSendButton').disabled=true;$('secureMessageInput').disabled=true;
  try{
    const safety=await messenger.inspectRoomSafety(id);
    if(turn!==epoch||revision!==roomCheck||selectedRoom!==id)return;
    const state=messenger.getState(),allowed=safety.allowed&&state.synced&&state.cryptoReady;
    $('roomSecurityState').dataset.status=allowed?'verified':'locked';
    $('roomSecurityState').textContent=allowed?'Cifrada · dispositivos verificados':'Envío bloqueado';
    $('roomWarning').hidden=allowed;$('roomWarning').textContent=allowed?'':safety.message;
    $('secureMessageInput').disabled=!allowed;$('secureSendButton').disabled=!allowed||sendBusy;
    $('sendStatus').textContent=allowed?(sendBusy?'Comprobando y cifrando…':sendFeedback||'Texto cifrado de extremo a extremo. Los dispositivos se vuelven a comprobar al enviar.'):'Verifica los dispositivos de los participantes para poder enviar.';
  }catch(error){if(turn===epoch&&revision===roomCheck)showError('sessionError',error);}
}
function renderThread(){
  const root=$('secureThread'),nearBottom=root.scrollHeight-root.scrollTop-root.clientHeight<100;
  root.replaceChildren();const entries=[...(messages.get(selectedRoom)?.values()||[])].sort((a,b)=>a.timestamp-b.timestamp);
  if(!entries.length)root.append(element('p','small-note','Aquí aparecerán los mensajes que este dispositivo pueda descifrar. El historial anterior puede requerir tu clave de recuperación.'));
  for(const message of entries){
    const article=element('article','secure-message');article.dataset.own=String(message.sender===lastState.userId);
    article.append(element('strong','secure-message-sender',message.sender===lastState.userId?'Tú':message.sender));
    if(!message.senderVerified)article.append(element('p','secure-message-trust','Identidad del emisor pendiente de verificación'));
    article.append(element('p','secure-message-body',message.kind==='text'?message.body:'Este mensaje contiene un archivo u otro formato todavía no compatible.'));
    if(message.isEdit)article.append(element('small','','Propuesta de edición · se conserva el texto recibido como evento separado'));
    if(message.truncated)article.append(element('small','','Vista limitada a 65 536 caracteres'));
    article.append(element('time','secure-message-time',new Date(message.timestamp).toLocaleString('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})));
    root.append(article);
  }
  if(nearBottom||entries.length<3)root.scrollTop=root.scrollHeight;
}
$('backToRooms').addEventListener('click',()=>{selectedRoom=null;roomCheck++;$('threadPanel').hidden=true;$('roomsPanel').hidden=false;$('vpnCard').hidden=false;$('secureView').querySelector(':scope > details').hidden=false;$('secureMessageInput').value='';delete $('secureView').dataset.mode;});
$('newRoomButton').addEventListener('click',()=>{clearError('newRoomError');$('newRoomForm').reset();dialog('newRoomDialog');});
$('newRoomForm').addEventListener('submit',async event=>{
  event.preventDefault();$('createRoomButton').disabled=true;clearError('newRoomError');
  try{const result=await messenger.createEncryptedRoom({invite:[$('peerIdInput').value.trim()]});$('newRoomDialog').close();toast('Invitación creada. La otra persona tiene que aceptarla.');rooms=messenger.listEncryptedRooms();renderRooms();if(rooms.some(r=>r.roomId===result.roomId))await openRoom(result.roomId);}
  catch(error){showError('newRoomError',error);}finally{$('createRoomButton').disabled=false;}
});
$('secureComposeForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!selectedRoom||$('secureSendButton').disabled||sendBusy)return;
  const text=$('secureMessageInput').value;if(!text.trim())return;const id=selectedRoom,turn=epoch;
  sendBusy=true;sendFeedback='';$('secureSendButton').disabled=true;$('sendStatus').textContent='Comprobando y cifrando…';
  try{const result=await messenger.sendText(id,text);if(turn!==epoch)return;if(selectedRoom===id&&$('secureMessageInput').value===text)$('secureMessageInput').value='';sendFeedback=result.acceptedByHomeserver?'El servicio aceptó el mensaje cifrado. No se ha confirmado su lectura.':'Envío sin confirmar.';$('sendStatus').textContent=sendFeedback;}
  catch(error){if(turn===epoch)showError('sessionError',error);}
  finally{if(turn===epoch){sendBusy=false;if(selectedRoom===id)await checkRoom(id);}}
});

async function showDevices(){
  if(!selectedRoom)return;const id=selectedRoom,turn=epoch;$('devicesList').replaceChildren(element('p','small-note','Comprobando dispositivos…'));dialog('devicesDialog');
  try{
    const devices=await messenger.getRoomDevices(id);if(turn!==epoch)return;$('devicesList').replaceChildren();
    for(const device of devices){const row=element('section','secure-device-row'),body=element('div');body.append(element('strong','',device.userId),element('p','small-note',device.deviceId||'No se conoce ningún dispositivo'),element('span','security-status',device.verified&&device.identityVerified?'Verificado':'Por verificar'));row.append(body);
      if(device.deviceId&&!(device.userId===lastState.userId&&device.deviceId===lastState.deviceId)){const button=element('button','secondary','Comparar con este dispositivo');button.type='button';button.addEventListener('click',async()=>{try{$('devicesDialog').close();await messenger.requestDeviceVerification(device.userId,device.deviceId);}catch(error){showError('sessionError',error);}});row.append(button);}
      $('devicesList').append(row);
    }
  }catch(error){showError('sessionError',error);$('devicesList').replaceChildren(element('p','secure-error','No se pudo comprobar la lista. No se ha marcado ningún dispositivo como fiable.'));}
}
$('inspectDevicesButton').addEventListener('click',()=>void showDevices());
$('verifyContactButton').addEventListener('click',()=>void showDevices());
$('verifyOwnButton').addEventListener('click',async()=>{try{await messenger.requestOwnVerification();}catch(error){showError('sessionError',error);}});

function resetSas(){sasCallbacks=null;$('verificationEmojis').replaceChildren();$('verificationNumbers').textContent='';$('verificationNumbers').hidden=true;$('confirmSasButton').hidden=true;$('rejectSasButton').hidden=true;}
function renderSas(callbacks){
  if(!selectedRequest?.pending||!callbacks?.sas)return;sasCallbacks=callbacks;$('verificationEmojis').replaceChildren();
  const emojis=callbacks.sas.emoji;
  if(Array.isArray(emojis)&&emojis.length===7){for(const [symbol,label] of emojis){const card=element('div','secure-verification-item');card.append(element('span','secure-verification-emoji',symbol),element('span','secure-verification-label',translations[label]||label));$('verificationEmojis').append(card);}}
  else if(Array.isArray(callbacks.sas.decimal)&&callbacks.sas.decimal.length===3){$('verificationNumbers').textContent=callbacks.sas.decimal.join(' · ');$('verificationNumbers').hidden=false;}
  else{$('verificationStatus').textContent='No se ha recibido un código de comparación válido.';sasCallbacks=null;return;}
  $('verificationInstructions').textContent='Compara estos símbolos o números con la otra persona, en persona o por un canal que ya conozcas. Confirma solo si coinciden todos.';
  $('confirmSasButton').hidden=false;$('rejectSasButton').hidden=false;$('confirmSasButton').disabled=false;
}
function attachVerifier(verifier){
  if(!verifier)return;selectedVerifier=verifier;
  if(startedVerifiers.has(verifier))return;startedVerifiers.add(verifier);
  const turn=epoch,request=selectedRequest;
  const handler=callbacks=>{if(turn===epoch&&selectedRequest===request&&selectedVerifier===verifier)renderSas(callbacks);};
  verifierHandlers.set(verifier,handler);verifier.on(VerifierEvent.ShowSas,handler);
  const existing=verifier.getShowSasCallbacks();if(existing)renderSas(existing);
  void verifier.verify().then(()=>{if(selectedVerifier===verifier){$('verificationStatus').textContent='Verificación completada. Se comprueba la confianza actual…';void messenger.refreshOwnTrust().catch(noop);if(selectedRoom)void checkRoom(selectedRoom);}}).catch(()=>{if(selectedVerifier===verifier){resetSas();$('verificationStatus').textContent='La verificación no se completó. No se ha confirmado la identidad.';}});
}
function updateVerification(){
  const request=selectedRequest;if(!request)return;
  $('acceptVerificationButton').hidden=request.initiatedByMe||request.phase!==VerificationPhase.Requested;
  $('startSasButton').hidden=request.phase!==VerificationPhase.Ready||!!request.verifier;
  if(request.phase===VerificationPhase.Ready){$('verificationInstructions').textContent='La solicitud está aceptada. Puedes iniciar la comparación.';$('verificationStatus').textContent='';}
  if(request.verifier)attachVerifier(request.verifier);
  if(request.phase===VerificationPhase.Done){resetSas();$('verificationStatus').textContent='Verificación completada por los dos dispositivos.';void messenger.refreshOwnTrust().catch(noop);if(selectedRoom)void checkRoom(selectedRoom);}
  if(request.phase===VerificationPhase.Cancelled){resetSas();$('verificationStatus').textContent='Verificación cancelada. No se ha confirmado esta identidad.';}
}
function openVerification(request){
  if(selectedRequest&&requestChangeHandler)selectedRequest.off(VerificationRequestEvent.Change,requestChangeHandler);
  selectedRequest=request;selectedVerifier=null;resetSas();$('verificationPeer').textContent=`${request.otherUserId}${request.otherDeviceId?' · '+request.otherDeviceId:''}`;
  $('verificationInstructions').textContent=request.initiatedByMe?'Espera a que la otra persona acepte en su dispositivo.':'Este dispositivo solicita verificar vuestra identidad. Acepta solo si esperabas esta solicitud.';
  $('verificationStatus').textContent='';requestChangeHandler=updateVerification;request.on(VerificationRequestEvent.Change,requestChangeHandler);updateVerification();dialog('verificationDialog');
}
$('acceptVerificationButton').addEventListener('click',async()=>{const request=selectedRequest,turn=epoch;try{await request?.accept();if(turn===epoch&&selectedRequest===request)updateVerification();}catch{if(turn===epoch&&selectedRequest===request)$('verificationStatus').textContent='No se pudo aceptar la solicitud.';}});
$('startSasButton').addEventListener('click',async()=>{const request=selectedRequest,turn=epoch;try{if(request?.phase!==VerificationPhase.Ready)return;$('startSasButton').disabled=true;const verifier=await request.startVerification('m.sas.v1');if(turn!==epoch||selectedRequest!==request||!request.pending)return;attachVerifier(verifier);}catch{if(turn===epoch&&selectedRequest===request)$('verificationStatus').textContent='No se pudo iniciar la comparación.';}finally{if(turn===epoch&&selectedRequest===request)$('startSasButton').disabled=false;}});
$('confirmSasButton').addEventListener('click',async()=>{const callbacks=sasCallbacks,request=selectedRequest,turn=epoch;if(!callbacks||!request?.pending)return;$('confirmSasButton').disabled=true;try{await callbacks.confirm();if(turn===epoch&&selectedRequest===request)$('verificationStatus').textContent='Tu comparación está confirmada. Esperando al otro dispositivo…';}catch{if(turn===epoch&&selectedRequest===request)$('verificationStatus').textContent='No se pudo confirmar. La identidad sigue pendiente.';}});
$('rejectSasButton').addEventListener('click',()=>{sasCallbacks?.mismatch();resetSas();$('verificationStatus').textContent='Has indicado que los códigos no coinciden. No continúes esta conversación hasta comprobar la identidad.';});
async function cancelVerification(){const request=selectedRequest,turn=epoch;if(request?.pending){try{await request.cancel();}catch{}}if(turn!==epoch||selectedRequest!==request)return;resetSas();$('verificationDialog').close();if(request&&requestChangeHandler)request.off(VerificationRequestEvent.Change,requestChangeHandler);selectedRequest=null;selectedVerifier=null;if(unreadVerifications.length)openVerification(unreadVerifications.shift());}
$('cancelVerificationButton').addEventListener('click',()=>void cancelVerification());
$('verificationDialog').addEventListener('cancel',event=>{event.preventDefault();void cancelVerification();});

$('setupIdentityButton').addEventListener('click',async()=>{
  clearError('identitySetupError');$('setupIdentityButton').disabled=true;
  try{identitySetup=await messenger.prepareIdentity();$('recoveryKeyDisplay').textContent=identitySetup.recoveryKey;$('recoveryKeyConfirm').value='';$('identityPasswordInput').value='';dialog('identitySetupDialog');}
  catch(error){showError('sessionError',error);}finally{$('setupIdentityButton').disabled=false;}
});
function cancelIdentity(){try{messenger.cancelIdentityPreparation();identitySetup=null;$('recoveryKeyDisplay').textContent='';$('recoveryKeyConfirm').value='';$('identityPasswordInput').value='';$('identitySetupDialog').close();}catch(error){showError('identitySetupError',error);}}
$('cancelIdentitySetup').addEventListener('click',cancelIdentity);
$('identitySetupDialog').addEventListener('cancel',event=>{event.preventDefault();cancelIdentity();});
$('identitySetupForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!identitySetup)return;$('confirmIdentityButton').disabled=true;$('cancelIdentitySetup').disabled=true;clearError('identitySetupError');let password=$('identityPasswordInput').value;
  const authUploadDeviceSigningKeys=async makeRequest=>{
    const auth={type:'m.login.password',identifier:{type:'m.id.user',user:messenger.getState().userId},password};
    try{return await makeRequest(auth);}catch(error){const data=error?.data;const compatible=data?.flows?.some(flow=>flow.stages?.length===1&&flow.stages[0]==='m.login.password');if(!data?.session||!compatible)throw new Error('IDENTITY_AUTH_UNSUPPORTED');return makeRequest({...auth,session:data.session});}
  };
  try{await messenger.initializeIdentity({setupId:identitySetup.setupId,recoveryKeyConfirmation:$('recoveryKeyConfirm').value,authUploadDeviceSigningKeys});identitySetup=null;$('identitySetupDialog').close();$('recoveryKeyDisplay').textContent='';$('recoveryKeyConfirm').value='';toast('Identidad y recuperación configuradas. Conserva tu clave fuera del teléfono.');}
  catch(error){showError('identitySetupError',error);}
  finally{password='';$('identityPasswordInput').value='';$('confirmIdentityButton').disabled=false;$('cancelIdentitySetup').disabled=false;}
});
$('restoreIdentityButton').addEventListener('click',()=>{clearError('identityRestoreError');$('identityRecoveryInput').value='';dialog('identityRestoreDialog');});
$('identityRestoreForm').addEventListener('submit',async event=>{
  event.preventDefault();$('restoreIdentitySubmit').disabled=true;clearError('identityRestoreError');
  try{const result=await messenger.restoreIdentity($('identityRecoveryInput').value);$('identityRestoreDialog').close();toast(result.backupRestored?'Identidad recuperada. Se ha consultado la copia cifrada del historial.':'Identidad recuperada. La recuperación del historial no está confirmada.');if(selectedRoom)await openRoom(selectedRoom);}
  catch(error){showError('identityRestoreError',error);}finally{$('identityRecoveryInput').value='';$('restoreIdentitySubmit').disabled=false;}
});

async function lockNow(){
  clearTimeout(lockTimer);hiddenAt=0;clearPrivateUI();
  try{await messenger.lock();}
  finally{try{await refreshVault();}catch(error){showError('connectionError',error);}}
}
$('lockButton').addEventListener('click',()=>void lockNow());
$('logoutButton').addEventListener('click',async()=>{
  if(!window.confirm('¿Cerrar este acceso en el servidor? Conserva antes tu clave de recuperación. Las claves locales antiguas se conservarán cifradas.'))return;
  $('logoutButton').disabled=true;clearPrivateUI();
  try{const result=await messenger.logout();if(result.serverRevoked){await removeVault();vaultEnvelope=null;remembered=false;toast('El servicio confirmó el cierre de este acceso.');}else{toast('Cierre local completado. No se confirmó la revocación: abre tu acceso para volver a intentarlo.');}await refreshVault();}
  catch(error){showError('connectionError',error);}
});
$('securityHelpButton').addEventListener('click',()=>dialog('securityHelpDialog'));
$('vpnGuideButton').addEventListener('click',()=>dialog('vpnDialog'));
document.querySelectorAll('[data-secure-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.secureClose).close()));
$('identityRestoreDialog').addEventListener('close',()=>{$('identityRecoveryInput').value='';});
document.addEventListener('visibilitychange',()=>{
  clearTimeout(lockTimer);
  if(document.hidden){
    hiddenAt=Date.now();document.body.classList.add('screen-private');$('privacyCurtain').hidden=false;
    if(busy){void lockNow();return;}
    if(messenger.getState().cryptoReady){const delay=Number($('lockDelayInput').value)*1000;lockTimer=setTimeout(()=>void lockNow(),delay);}
  }else{
    const elapsed=hiddenAt?Date.now()-hiddenAt:0,delay=Number($('lockDelayInput').value)*1000;
    if(hiddenAt&&elapsed>=delay&&messenger.getState().cryptoReady){void lockNow().finally(()=>{document.body.classList.remove('screen-private');$('privacyCurtain').hidden=true;});}
    else{document.body.classList.remove('screen-private');$('privacyCurtain').hidden=true;}
    hiddenAt=0;
  }
});
window.addEventListener('pagehide',()=>{clearPrivateUI();void messenger.lock();});
window.addEventListener('pageshow',()=>{document.body.classList.remove('screen-private');$('privacyCurtain').hidden=true;onState(messenger.getState());});
function fitViewport(){if(window.visualViewport?.scale===1)document.documentElement.style.setProperty('--workspace-height',`${Math.round(window.visualViewport.height)}px`);}
window.visualViewport?.addEventListener('resize',fitViewport);fitViewport();
void refreshVault().catch(error=>showError('connectionError',error));
