import {LocalChatClient as NativeChatClient} from './local-chat-client-cpu-5ce3d95c1118.mjs';

export function mountChatUI({document=globalThis.document,window=globalThis.window,
  Client=NativeChatClient,now=Date.now,setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout}={}){
  const $=id=>document.getElementById(id),listeners=[];
  let client,working=false,rendered='',lastSubmitted='',submittedID=null;
  let expiryTimer=null,suspended=false,generation=0,restoration=null,needsHistory=false,readingHistory=false;
  let view={state:null,rows:[],attempts:[],busy:false,pending:null};
  const current=c=>!suspended&&c===client&&!c.closed;
  const active=state=>state?.local_device_only===true&&state.session_active===true;
  function listen(target,type,listener){target.addEventListener(type,listener);listeners.push([target,type,listener])}
  function stopExpiry(){if(expiryTimer!==null)clearTimer(expiryTimer);expiryTimer=null}
  function scheduleExpiry(state){
    stopExpiry();
    if(state?.local_device_only||suspended||document.visibilityState==='hidden'||!active(state))return;
    expiryTimer=setTimer(()=>{expiryTimer=null;if(!suspended)render(view)},Math.max(1,Math.ceil(state.lease.expires_at*1000-now())));
  }
  function text(tag,value,className){const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el}
  function render(next){
    if(suspended)return;
    view=next;const {state,rows,pending,attempts=[]}=next,busy=next.busy||readingHistory,isActive=active(state);
    working=busy;$('connection').textContent=!state?'Sur ce téléphone':isActive?'Assistant sur ce téléphone':'Session en pause';
    if(pending&&busy)submittedID=pending.request_id;
    $('access').hidden=!!state;$('conversation').hidden=!state;$('connect').disabled=busy;
    $('send').disabled=busy||needsHistory||!isActive||!!pending||state?.owner_recovery_required===true;
    for(const id of ['refresh','resume','pause'])$(id).disabled=busy;
    $('resume').hidden=!state||isActive;$('pause').hidden=!isActive;
    $('session-state').textContent=state?(isActive?'Tes messages restent dans cette conversation.':'Ta session est en pause. Son historique est conservé.'):'';
    $('activity').textContent=readingHistory?'Récupération de ta conversation…':busy?(pending?'Ton message est en cours de traitement…':'Connexion à ta conversation…'):'';
    $('reconcile').hidden=!(pending||needsHistory)||busy;
    const signature=JSON.stringify({rows:rows.map(r=>[r.turn,r.request_id,r.reply]),attempts:attempts.map(a=>[a.request_id,a.state,a.message]),busy});
    if(signature!==rendered){
      const list=document.createDocumentFragment();
      if(!rows.length)list.append(text('p','Qu’aimerais-tu éclaircir aujourd’hui ?','welcome'));
      for(const row of rows){
        const question=document.createElement('article');question.className='bubble mine';question.append(text('h2','Moi'),text('p',row.user_message));
        const answer=document.createElement('article');answer.className='bubble assistant';answer.append(text('h2','ojO'),text('p',row.reply));
        list.append(question,answer);
      }
      for(const attempt of attempts){
        const item=document.createElement('article');item.className='bubble attempt';
        item.append(text('h2',attempt.state==='INTERRUPTED'?'Demande interrompue':'Demande non terminée'),text('p',attempt.message),text('p','Aucune réponse complète enregistrée pour cette tentative. Elle ne sera pas renvoyée automatiquement.'));
        const button=text('button','Remettre dans mon brouillon');button.type='button';button.disabled=busy;
        button.addEventListener('click',()=>run(async c=>{
          const before=$('message').value;
          if(before.trim()&&before!==attempt.message)throw Error('Un brouillon est déjà présent. Conserve-le avant de reprendre cette demande.');
          await c.saveDraft(attempt.message);
          if(current(c)&&$('message').value===before){$('message').value=attempt.message;updateCount();$('message').focus();}
        }));
        item.append(button);list.append(item);
      }
      $('messages').replaceChildren(list);rendered=signature;
    }
    scheduleExpiry(state);
  }
  function showError(error){$('error').textContent=error.message||'Le chat est momentanément indisponible.'}
  function updateCount(){$('count').textContent=new Intl.NumberFormat('fr-FR').format($('message').value.length)+' / 1 200'}
  function createClient(snapshot=null){
    const version=++generation;
    try{
      client=new Client({onChange:next=>{if(!suspended&&version===generation)render(next)}});
      if(snapshot){
        // Keep only this page's previously verified lineage. A fresh GET must
        // validate it before sending; this snapshot grants no new authority.
        client.state=snapshot.state;client.rows=[...snapshot.rows];client.attempts=[...(snapshot.attempts||[])];client.pending=snapshot.pending;
      }
      render({state:client.state,rows:[...client.rows],attempts:[...(client.attempts||[])],busy:false,pending:client.pending});
      const c=client;
      c.loadDraft().then(draft=>{if(current(c)&&!$('message').value){$('message').value=draft;updateCount();}}).catch(error=>{if(current(c))showError(error)});
      return client;
    }catch(error){client=null;showError(error);$('connect').disabled=true;return null}
  }
  async function run(action){
    const c=client;if(!c||suspended)return;
    $('error').textContent='';
    try{await action(c)}catch(error){if(current(c))showError(error)}
    finally{if(current(c))render(view)}
  }
  async function reconcileDraft(c,rows){
    if(!current(c)||!submittedID||!rows.some(r=>r.request_id===submittedID)||c.pending)return;
    const before=$('message').value;
    if(before.trim()===lastSubmitted){await c.clearDraftIfMatches(before);if(current(c)&&$('message').value===before){$('message').value='';updateCount()}}
    lastSubmitted='';submittedID=null;
  }
  async function refreshHistory(c){
    readingHistory=true;render(view);
    try{
      const rows=await c.history();
      if(current(c)){needsHistory=false;await reconcileDraft(c,rows)}
      return rows;
    }finally{if(current(c)){readingHistory=false;render(view)}}
  }
  createClient();
  listen($('connect'),'click',()=>run(async c=>{await c.connect();if(current(c))needsHistory=false}));
  listen($('refresh'),'click',()=>run(refreshHistory));
  listen($('resume'),'click',()=>run(async c=>{await c.control('resume');if(current(c)&&needsHistory)await refreshHistory(c)}));
  listen($('pause'),'click',()=>run(c=>c.control('close')));
  listen($('message'),'input',()=>{updateCount();const c=client;if(c&&current(c))c.saveDraft($('message').value).catch(error=>{if(current(c))showError(error)});});
  listen($('composer'),'submit',event=>{
    event.preventDefault();if(working||needsHistory)return;
    return run(async c=>{
      const draft=$('message').value;lastSubmitted=draft.trim();await c.send(draft);
      if(!current(c))return;
      if($('message').value===draft){await c.clearDraftIfMatches(draft);if(current(c)&&$('message').value===draft){$('message').value='';updateCount()}}
      lastSubmitted='';submittedID=null;$('message').focus();
    });
  });
  listen($('message'),'keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();$('composer').requestSubmit()}});
  listen(window,'pagehide',()=>{
    suspended=true;stopExpiry();
    restoration=client?.state?{state:client.state,rows:[...client.rows],attempts:[...client.attempts],pending:client.pending?{...client.pending}:null}:null;
    client?.dispose();
  });
  listen(window,'pageshow',event=>{
    if(!event.persisted||!suspended)return;
    suspended=false;readingHistory=false;needsHistory=!!restoration;
    const snapshot=restoration;restoration=null;
    if(createClient(snapshot)&&needsHistory)return run(refreshHistory);
  });
  listen(document,'visibilitychange',()=>{
    if(document.visibilityState==='hidden'){stopExpiry();if(!suspended)run(c=>c.background())}
    else if(!suspended){run(c=>c.foreground());render(view)}
  });
  listen(window,'online',()=>{if(client?.state&&!working&&!suspended)$('activity').textContent='La connexion est revenue. Actualise pour retrouver ta conversation.'});
  listen(window,'offline',()=>{if(!suspended)$('activity').textContent='Tu es hors connexion. Ton brouillon reste ici.'});
  return {async pauseForQualification(){if(working)throw Error('Termine la préparation ou la réponse avant le contrôle technique.');if(client)await client.control('close');},destroy(){suspended=true;generation++;stopExpiry();client?.dispose();for(const [target,type,listener] of listeners)target.removeEventListener(type,listener)}};
}

export const localUI=globalThis.document&&globalThis.window?mountChatUI():null;
