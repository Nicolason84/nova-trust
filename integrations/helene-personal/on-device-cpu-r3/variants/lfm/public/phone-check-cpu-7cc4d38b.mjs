import {LocalChatClient,KEY,digest,reserveConversation} from './local-chat-client-cpu-7cc4d38b.mjs';
import {MODEL_ID,CONSENT,CONSENT_VALUE,ENGINE_FINGERPRINT} from './model-cpu-7cc4d38b.mjs';
import {localUI} from './chat-ui-cpu-7cc4d38b.mjs';
const $=id=>document.getElementById(id),TRIAL=KEY+'.synthetic-test.'+ENGINE_FINGERPRINT,PROOF=KEY+'.technical-receipt.'+ENGINE_FINGERPRINT,STEP=KEY+'.test-step.'+ENGINE_FINGERPRINT;
function download(name,body){const u=URL.createObjectURL(new Blob([body],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function show(s){$('phone-test-status').textContent=s}
const phase=JSON.parse(localStorage.getItem(STEP)||'null');
if(phase?.state==='RELOAD_REQUIRED'){$('phone-test').textContent='Vérifier la reprise après rechargement';show('Deux échanges de test ont été conservés. Termine le contrôle de reprise.');}
if(phase?.state==='PASS'){
  const proof=JSON.parse(localStorage.getItem(PROOF)||'null');
  if(proof?.status==='PASS_REAL_INFERENCE_AND_RELOAD'&&proof.model===MODEL_ID){$('phone-test').hidden=true;show('Le test local enregistré a réussi : trois réponses réelles et reprise après rechargement. La fermeture puis réouverture réelle se confirme sur ce téléphone.');$('local-title').textContent='Ton assistant sur ce téléphone.';}
}
if(localStorage.getItem(CONSENT)===CONSENT_VALUE)$('consent-note').textContent='Le modèle a déjà été autorisé sur cet appareil. Si Chrome l’a évincé, un nouveau téléchargement restera à confirmer.';
$('export-chat').addEventListener('click',()=>{
  const raw=localStorage.getItem(KEY);if(raw===null){show('Aucune conversation personnelle enregistrée à exporter.');return;}
  download('helene-conversation-'+new Date().toISOString().slice(0,10)+'.json',raw);
});
$('export-proof').addEventListener('click',()=>{const raw=localStorage.getItem(PROOF);if(raw)download('helene-test-local.json',raw);else show('Aucun reçu de génération réelle disponible.');});
$('phone-test').addEventListener('click',async()=>{
  $('phone-test').disabled=true;
  try{await reserveConversation(async()=>{
  await localUI.pauseForQualification();
  $('phone-test').disabled=true;$('access').inert=true;$('conversation').inert=true;
  const c=new LocalChatClient({key:TRIAL,autoOpen:false});
  try{
    show('Test réel sur ce téléphone, avec des phrases fictives seulement…');
    const prior=JSON.parse(localStorage.getItem(STEP)||'null');
    if(prior?.state==='PASS')throw Error('Le contrôle existe déjà. Exporte son reçu ; aucun nouveau test automatique.');
    await c.connect();
    let marker,rows;
    if(prior?.state==='RELOAD_REQUIRED'){
      marker=prior.marker;rows=await c.history();
      if(rows.length!==2||await digest(JSON.stringify(rows))!==prior.history_sha256)throw Error('La reprise des deux échanges n\u2019est pas conforme. Le contrôle reste non validé.');
      const r=await c.send('Rappelle uniquement le code et le jour de la promenade dont nous avons parlé.');
      if(!r.reply.includes(marker)||!r.reply.toLowerCase().includes('dimanche'))throw Error('La réponse n\u2019a pas restitué correctement le contexte après rechargement.');
      const receipt={schema:'HELENE_REAL_PHONE_LOCAL_AI_CHECK_V1',at:new Date().toISOString(),status:'PASS_REAL_INFERENCE_AND_RELOAD',model:MODEL_ID,engine_fingerprint:ENGINE_FINGERPRINT,backend:'wasm',threads:1,real_generation_calls:3,history_after_reload:true,synthetic_data_only:true,physical_phone_claimed_by_software:false,device_user_agent:navigator.userAgent,rows_sha256:await digest(JSON.stringify(c.rows)),storage_persisted:await navigator.storage.persisted(),mac_required:false,cloudflare_login_used:false,personal_messages_transmitted:false};
      localStorage.setItem(PROOF,JSON.stringify(receipt,null,2));localStorage.setItem(STEP,JSON.stringify({state:'PASS'}));
      show('Trois vraies réponses et reprise après rechargement : PASS. Ferme maintenant cette page, rouvre le même lien et vérifie ton propre premier message avant de considérer l\u2019installation terminée.');
      $('phone-test').hidden=true;
    }else{
      if(c.rows.length)throw Error('Un essai antérieur existe et reste conservé. Aucun historique de test n\u2019est effacé automatiquement.');
      marker='TILLEUL-'+crypto.getRandomValues(new Uint32Array(1))[0].toString(16).toUpperCase();
      await c.send('Je prépare une promenade dimanche. Son code est '+marker+'. Propose une courte invitation chaleureuse en français et rappelle ce code.');
      const r=await c.send('Quel est le code de ma promenade, et quel jour est-elle prévue ?');
      if(!r.reply.includes(marker)||!r.reply.toLowerCase().includes('dimanche'))throw Error('Le modèle n\u2019a pas correctement repris le contexte du test. Il n\u2019est pas qualifié.');
      rows=await c.history();localStorage.setItem(STEP,JSON.stringify({state:'RELOAD_REQUIRED',marker,history_sha256:await digest(JSON.stringify(rows))}));
      show('Deux échanges réels conservés. Rechargement pour vérifier une nouvelle lecture…');
      location.reload();
    }
  }catch(error){show('NON VALIDÉ : '+error.message);$('phone-test').disabled=false;}
  finally{try{await c.control('close')}finally{$('access').inert=false;$('conversation').inert=false;}}
  });}catch(error){show('NON VALIDÉ : '+error.message);$('phone-test').disabled=false;}
});
