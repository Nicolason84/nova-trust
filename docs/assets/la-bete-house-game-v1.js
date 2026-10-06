/* LA_BETE_HOUSE_GAME_V1
   One continuous navigable House inside the existing Three.js scene/renderer/frame loop.
   Canonical USDA converted reversibly to GLB; first playable slice only. Visual identity remains WEB_PREVIEW.
   No second engine, registry, truth, memory or execution authority. */
(()=>{
'use strict';

const body=document.body;
const house=document.getElementById('advisory-house-v5');
const deskPane=house?.querySelector('.housePane[data-house-room="desk"]');
if(!body||!house||!deskPane||body.dataset.houseGameV1==='bound')return;
body.dataset.houseGameV1='bound';

const motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
// V3/V4 are reversible, localhost-only projections. The ordinary/V2 URL keeps V2.
const previewParams=new URLSearchParams(location.search);
const localPreview=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
const avatarV3=localPreview&&previewParams.get('housegame')==='nicolas-avatar-v3';
const avatarV4=localPreview&&previewParams.get('housegame')==='nicolas-avatar-v4';
const avatarModern=avatarV3||avatarV4;
const avatarVersion=avatarV4?'v4':avatarV3?'v3':'v2';
const reviewAllowed=localPreview&&(avatarModern||previewParams.get('review')==='1');
let inspection=null,inspectionLights=[];
let reduced=motionQuery.matches;motionQuery.addEventListener('change',e=>{reduced=e.matches;});
const enterButton=document.createElement('button');
enterButton.id='houseGameEnter';
enterButton.type='button';
enterButton.disabled=false;
enterButton.textContent='Entrer dans la Maison 3D →';
deskPane.querySelector('.housePaneBody').appendChild(enterButton);

const hud=document.createElement('section');
hud.id='houseGameHUD';
hud.setAttribute('aria-label','Interface de navigation de la Maison 3D');
hud.innerHTML=
  '<div class="houseGameTop">'+
    '<div class="houseGameStatus">'+
      '<small>THE LIVING ADVISORY HOUSE · NAVIGATION 3D</small>'+
      '<strong id="houseGameRoom">Private Advisory Desk</strong>'+
      '<span id="houseGameMode">WASD / flèches · souris · E pour interagir</span>'+
    '</div>'+
    '<div class="houseGameTopActions"><button type="button" id="houseGameSound" aria-pressed="false">Son · OFF</button><button type="button" id="houseGameExit">Quitter la Maison 3D</button></div>'+
  '</div>'+
  '<div class="houseGameCrosshair" aria-hidden="true"></div>'+
  '<div id="houseGamePrompt" role="status"></div>'+
  '<div class="houseGameHelp">WASD / FLÈCHES · SOURIS POUR REGARDER · SHIFT POUR MARCHER VITE · E INTERAGIR · M SON · CLIC = REPRENDRE LA CAMÉRA</div>'+
  '<aside id="houseGamePanel" hidden>'+
    '<small id="houseGamePanelKicker">SUPRA</small>'+
    '<h2 id="houseGamePanelTitle">—</h2>'+
    '<p id="houseGamePanelIntro"></p>'+
    '<div class="houseGamePanelBody" id="houseGamePanelBody"></div>'+
    '<button type="button" id="houseGamePanelClose">Revenir dans la pièce</button>'+
  '</aside>'+
  '<div class="houseGameTouch" aria-label="Contrôles tactiles">'+
    '<div class="houseGameDpad">'+
      '<button type="button" data-move="forward" aria-label="Avancer">↑</button>'+
      '<button type="button" data-move="left" aria-label="Gauche">←</button>'+
      '<button type="button" data-move="back" aria-label="Reculer">↓</button>'+
      '<button type="button" data-move="right" aria-label="Droite">→</button>'+
    '</div>'+
    '<button type="button" class="houseGameInteractMobile" id="houseGameInteractMobile">Interagir</button>'+
  '</div>';
document.body.appendChild(hud);

const roomStatus=hud.querySelector('#houseGameRoom');
const modeStatus=hud.querySelector('#houseGameMode');
const prompt=hud.querySelector('#houseGamePrompt');
const exitButton=hud.querySelector('#houseGameExit');
const soundButton=hud.querySelector('#houseGameSound');
const panel=hud.querySelector('#houseGamePanel');
const panelKicker=hud.querySelector('#houseGamePanelKicker');
const panelTitle=hud.querySelector('#houseGamePanelTitle');
const panelIntro=hud.querySelector('#houseGamePanelIntro');
const panelBody=hud.querySelector('#houseGamePanelBody');
const panelClose=hud.querySelector('#houseGamePanelClose');
const interactMobile=hud.querySelector('#houseGameInteractMobile');

let runtime=null,THREE=null,gameGroup=null,faceTexture=null;
let canonicalNicolasSource=null,canonicalRigSpec=null,exactAvatarPromise=null,avatarModelMode='procedural_fallback',exactAvatarLoadError='',exactAvatarMeshCount=0,exactAvatarVertices=0;
let active=false,worldReady=false,lastFrame=0,pointerLockPreferred=false;
let yaw=0,pitch=0,roomNow='desk',nearby=null;
let originalStageParent=null,originalStageNext=null,originalRootVisible=true,originalAvatarVisible=false,originalFog=null,originalBackground=null,originalFov=40,originalToneExposure=1;
let touchLookId=null,touchLastX=0,touchLastY=0;
let audioCtx=null,audioMaster=null,audioToneA=null,audioToneB=null,soundEnabled=false,nextFootstepAt=0;
const keys=new Set();
const interactables=[];
const avatars=[];
const doors=[];
const obstacles=[];
const frameSamples=[];let enteredAt=0,loadMS=0,previousFocus=null,originalCamera=null;
let sceneVisibility=[],originalShadow=false;
let velocityX=0,velocityZ=0,gamepadHeld=false,lastStep=0;
const FIRST_SLICE=['desk','decision'];
const player={x:0,y:1.68,z:4.8,radius:.36};

const rooms=Object.freeze({
  desk:{label:'Private Advisory Desk',x:0,z:4,w:12,d:8,color:0xc58e5e},
  decision:{label:'Decision Room',x:12,z:-5,w:10,d:10,color:0xc58e5e},
  proof:{label:'Evidence Room',x:-12,z:-5,w:10,d:10,color:0x6f95a6},
  explore:{label:'Observatory',x:-12,z:-17,w:10,d:10,color:0x638ba0},
  mission:{label:'Mission Office',x:12,z:-17,w:10,d:10,color:0x995751}
});
const futureZones=[
  {x:0,z:4,w:12,d:8,room:'desk'},
  {x:0,z:-11,w:4,d:22,room:'corridor'},
  {x:0,z:-5,w:28,d:4,room:'corridor'},
  {x:0,z:-17,w:28,d:4,room:'corridor'},
  {x:12,z:-5,w:10,d:10,room:'decision'},
  {x:-12,z:-5,w:10,d:10,room:'proof'},
  {x:-12,z:-17,w:10,d:10,room:'explore'},
  {x:12,z:-17,w:10,d:10,room:'mission'}
];
const zones=[{x:0,z:4,w:12,d:8,room:'desk'},{x:0,z:-3.3,w:3.2,d:6.6,room:'corridor'},{x:3.5,z:-5,w:7,d:3.2,room:'corridor'},{x:12,z:-5,w:10,d:10,room:'decision'}];
const roleSpec=Object.freeze({
  desk:{label:'Mission Director',room:'desk',accent:0xc58e5e,coat:0x121619,shirt:0x451621,tie:0xb87333},
  decision:{label:'Decision',room:'decision',accent:0xc58e5e,coat:0x161719,shirt:0x3a2a27,tie:0xc58e5e},
  proof:{label:'Evidence',room:'proof',accent:0x6f95a6,coat:0x0f171c,shirt:0x182f3a,tie:0x6f95a6},
  explore:{label:'Observatory',room:'explore',accent:0x638ba0,coat:0x10161c,shirt:0x172536,tie:0x638ba0},
  mission:{label:'Solutions',room:'mission',accent:0x995751,coat:0x191315,shirt:0x451621,tie:0xb87333}
});

function runtimeIsUsable(rt){
  return !!(rt?.THREE&&rt?.scene&&rt?.camera&&rt?.renderer&&rt?.root&&rt?.renderer?.domElement);
}

async function ensureGameAudio(){
  const owner=window.LaBeteSensoryRuntime;if(!owner)return false;
  audioCtx=await owner.start();audioMaster=owner.master;
  audioToneA=owner.voices[0]?{osc:owner.voices[0]}:null;
  audioToneB=owner.voices[1]?{osc:owner.voices[1]}:null;
  if(!active||document.hidden){owner.stop();return false;}
  return !!audioCtx;
}
function setGameRoomTone(room){
  if(!audioCtx||!audioToneA||!audioToneB)return;
  const base={desk:43,decision:52,proof:67,explore:38,mission:58,corridor:46}[room]||46;
  const now=audioCtx.currentTime;
  audioToneA.osc.frequency.setTargetAtTime(base,now,.35);
  audioToneB.osc.frequency.setTargetAtTime(base*2.01,now,.45);
}
function gameFootstep(t,run){
  if(!soundEnabled||!audioCtx||audioCtx.state!=='running'||t<nextFootstepAt)return;
  nextFootstepAt=t+(run?290:430);
  const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();
  osc.type='sine';osc.frequency.setValueAtTime(run?92:78,audioCtx.currentTime);osc.frequency.exponentialRampToValueAtTime(42,audioCtx.currentTime+.075);
  filter.type='lowpass';filter.frequency.value=220;
  gain.gain.setValueAtTime(.045,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.09);
  osc.connect(filter);filter.connect(gain);gain.connect(audioMaster);osc.start();osc.stop(audioCtx.currentTime+.1);
}
async function toggleGameSound(force){
  soundEnabled=typeof force==='boolean'?force:!soundEnabled;
  if(soundEnabled)soundEnabled=await ensureGameAudio();else window.LaBeteSensoryRuntime?.stop();
  soundButton.textContent='Son · '+(soundEnabled?'ON':'OFF');soundButton.setAttribute('aria-pressed',String(soundEnabled));
  return soundEnabled;
}

function makeMat(color,{rough=.58,metal=.05,emissive=0,emissiveIntensity=0,opacity=1,transparent=false}={}){
  return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,emissive,emissiveIntensity,opacity,transparent});
}
function meshBox(w,h,d,mat,x,y,z){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);gameGroup.add(m);return m;
}
function addFloor(x,z,w,d,color=0x121719){
  const mat=makeMat(color,{rough:.88,metal:.04});
  const floor=meshBox(w,.08,d,mat,x,-.04,z);
  floor.receiveShadow=true;
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(floor.geometry),new THREE.LineBasicMaterial({color:0x8a725d,transparent:true,opacity:.16}));
  floor.add(edge);
}
function addWall(x,z,w,d,color=0x29333c){
  obstacles.push({x,z,w,d});
  const wall=meshBox(w,4.25,d,makeMat(color,{rough:.84,metal:.03}),x,2.1,z);
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(wall.geometry),new THREE.LineBasicMaterial({color:0x90745b,transparent:true,opacity:.08}));
  wall.add(edge);return wall;
}
function canvasTexture(title,sub,accent='#c58e5e'){
  const c=document.createElement('canvas');c.width=768;c.height=384;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#071012';ctx.fillRect(0,0,c.width,c.height);
  ctx.strokeStyle='rgba(210,180,145,.24)';ctx.strokeRect(2,2,c.width-4,c.height-4);
  ctx.fillStyle=accent;ctx.font='600 20px system-ui';ctx.fillText('THE LIVING ADVISORY HOUSE',42,52);
  ctx.fillStyle='#efe9df';ctx.font='500 54px Georgia,serif';
  const words=String(title).split(' ');let line='',y=142;
  for(const word of words){
    const test=(line+' '+word).trim();
    if(ctx.measureText(test).width>680&&line){ctx.fillText(line,42,y);line=word;y+=62;}else line=test;
  }
  if(line)ctx.fillText(line,42,y);
  ctx.fillStyle='#889597';ctx.font='400 24px system-ui';
  const text=String(sub||'');const chunks=[];let l='';
  for(const word of text.split(' ')){const test=(l+' '+word).trim();if(ctx.measureText(test).width>670&&l){chunks.push(l);l=word;}else l=test;}if(l)chunks.push(l);
  chunks.slice(0,3).forEach((t,i)=>ctx.fillText(t,42,270+i*32));
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.needsUpdate=true;return tex;
}
function addPanel(roomKey,title,sub,x,y,z,rotY=0,scale=1){
  const tex=canvasTexture(title,sub,'#'+rooms[roomKey].color.toString(16).padStart(6,'0'));
  const mat=new THREE.MeshBasicMaterial({map:tex,transparent:false,toneMapped:false});
  const panelMesh=new THREE.Mesh(new THREE.PlaneGeometry(4.2*scale,2.1*scale),mat);
  panelMesh.position.set(x,y,z);panelMesh.rotation.y=rotY;gameGroup.add(panelMesh);
  panelMesh.userData={interactive:true,type:'panel',room:roomKey,title};
  interactables.push(panelMesh);return panelMesh;
}
function makeDoorFrame(x,z,rotY,label,color){
  const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=rotY;gameGroup.add(group);
  const mat=makeMat(0x171c1d,{rough:.6,metal:.14});
  const accent=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.35});
  const left=new THREE.Mesh(new THREE.BoxGeometry(.18,3.4,.3),mat);left.position.set(-1.25,1.7,0);group.add(left);
  const right=left.clone();right.position.x=1.25;group.add(right);
  const top=new THREE.Mesh(new THREE.BoxGeometry(2.68,.18,.3),mat);top.position.set(0,3.32,0);group.add(top);
  const light=new THREE.Mesh(new THREE.BoxGeometry(2.35,.025,.04),accent);light.position.set(0,3.05,-.17);group.add(light);
  const doorMat=new THREE.MeshPhysicalMaterial({color:0x13191b,roughness:.35,metalness:.16,transparent:true,opacity:.78,transmission:.06});
  const pivotL=new THREE.Group();pivotL.position.set(-1.18,0,0);group.add(pivotL);
  const leafL=new THREE.Mesh(new THREE.BoxGeometry(1.15,2.86,.07),doorMat);leafL.position.set(.575,1.48,0);pivotL.add(leafL);
  const pivotR=new THREE.Group();pivotR.position.set(1.18,0,0);group.add(pivotR);
  const leafR=new THREE.Mesh(new THREE.BoxGeometry(1.15,2.86,.07),doorMat.clone());leafR.position.set(-.575,1.48,0);pivotR.add(leafR);
  const handleMat=makeMat(color,{rough:.25,metal:.55,emissive:color,emissiveIntensity:.12});
  const handleL=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),handleMat);handleL.position.set(1.04,1.5,.08);pivotL.add(handleL);
  const handleR=handleL.clone();handleR.position.x=-1.04;pivotR.add(handleR);
  const signTex=canvasTexture(label,'Approchez : la porte s’ouvre','#'+color.toString(16).padStart(6,'0'));
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(.92,.46),new THREE.MeshBasicMaterial({map:signTex,toneMapped:false}));
  sign.position.set(0,2.68,-.18);group.add(sign);
  doors.push({group,pivotL,pivotR,x,z,label,open:0});
  return group;
}
function addRoomShell(key){
  const r=rooms[key];addFloor(r.x,r.z,r.w,r.d,key==='desk'?0x111719:0x0d1417);
  meshBox(r.w,.05,r.d,makeMat(0x080b0c,{rough:1}),r.x,4.2,r.z);
  const side=key==='proof'||key==='explore'?'left':key==='decision'||key==='mission'?'right':'desk';
  if(key==='desk'){
    addWall(r.x,r.z+r.d/2,r.w,.16);
    addWall(r.x-r.w/2,r.z,.16,r.d);
    addWall(r.x+r.w/2,r.z,.16,r.d);
  }else if(side==='right'){
    addWall(r.x+r.w/2,r.z,.16,r.d);
    addWall(r.x,r.z+r.d/2,r.w,.16);
    addWall(r.x,r.z-r.d/2,r.w,.16);
  }else{
    addWall(r.x-r.w/2,r.z,.16,r.d);
    addWall(r.x,r.z+r.d/2,r.w,.16);
    addWall(r.x,r.z-r.d/2,r.w,.16);
  }
  const light=new THREE.PointLight(r.color,key==='desk'?34:24,19,1.65);light.position.set(r.x,3.15,r.z+.4);gameGroup.add(light);
  const glassMat=new THREE.MeshPhysicalMaterial({color:r.color,transparent:true,opacity:.09,roughness:.12,metalness:.02,transmission:.5,depthWrite:false});
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(5,r.w*.7),2.5),glassMat);
  if(side==='right'){glass.position.set(r.x+r.w/2-.12,2.2,r.z);glass.rotation.y=-Math.PI/2;}
  else if(side==='left'){glass.position.set(r.x-r.w/2+.12,2.2,r.z);glass.rotation.y=Math.PI/2;}
  else{glass.position.set(r.x,2.2,r.z+r.d/2-.12);glass.rotation.y=Math.PI;}
  gameGroup.add(glass);
}

async function loadCanonicalNicolasExact(){
  try{
    const [{GLTFLoader},{clone}]=await Promise.all([
      import('./vendor/three-0.180.0/addons/loaders/GLTFLoader.js'),
      import('./vendor/three-0.180.0/addons/utils/SkeletonUtils.js')
    ]);
    const gltf=await new GLTFLoader().loadAsync('assets/nicolas-avatar/nicolas-canonical-'+avatarVersion+'.glb');
    canonicalNicolasSource=gltf.scene;
    const placements={desk:[2.7,2.3],decision:[13.6,-7.3]};
    for(const role of FIRST_SLICE){
      const g=clone(gltf.scene);g.name='Nicolas_'+role;
      const bones={};let skeleton=null,count=0,vertices=0;
      g.traverse(o=>{
        if(o.isBone)bones[o.name]=o;
        if(!o.isMesh)return;
        if(!o.isSkinnedMesh)throw Error('UNSKINNED_CANONICAL_MESH');
        count++;vertices+=o.geometry.attributes.position.count;skeleton=o.skeleton;
        o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;
        o.material=o.material.clone();
        const name=o.material.name,spec=roleSpec[role];
        if(!avatarV4){
        if(name==='coat'||name==='lapel'){o.material.color.setHex(avatarModern?0x25272a:spec.coat);o.material.roughness=.82;o.material.metalness=.02;}
        if(name==='shirt'){o.material.color.setHex(spec.shirt);o.material.roughness=.72;}
        if(name==='tie'){o.material.color.setHex(spec.tie);o.material.roughness=.42;o.material.metalness=.12;o.scale.x=.64;}
        if(name==='skin'){o.material.color.setHex(avatarModern?0xb27a59:0xa3664d);o.material.roughness=avatarModern?.88:.72;}
        if(avatarModern&&name==='hair')o.visible=false; // Scalp is part of the continuous head surface.
        if(avatarModern&&name==='tie'){o.material.color.setHex(0x874423);o.material.metalness=0;o.material.roughness=.92;}
        if(avatarModern&&name==='nicolas_continuous_head_neck_v3'){o.material.side=THREE.FrontSide;o.material.roughness=.88;o.material.metalness=0;}
        if(name==='eye'||name==='lip')o.visible=avatarModern&&name==='lip';
        if(avatarModern&&name==='lip'){o.material.color.setHex(0x9c624b);o.material.roughness=.9;}
        if(name==='reference_face_cutout_CURVED_SKINNED_V2'){
          o.material.color.setHex(0xffffff);o.material.alphaTest=.08;o.material.depthWrite=true;o.material.roughness=.72;o.material.metalness=0;o.material.side=THREE.FrontSide;o.renderOrder=5;
        }
        }else{
          if(['hair','lip','scanline'].includes(name))o.visible=false;
          if(name==='eye')o.visible=o.morphTargetDictionary?.LookLeft!==undefined;
        }
        if(name==='scanline')o.visible=false;
        if(name==='lens'){
          o.visible=role==='desk';o.material.color.setHex(0x2a1710);o.material.transparent=true;o.material.opacity=.34;o.material.depthWrite=false;o.material.roughness=.16;o.material.metalness=.05;o.renderOrder=6;
        }
        if(name==='aviator_frame'){
          o.visible=role==='desk';o.material.color.setHex(0xb87333);o.material.metalness=.88;o.material.roughness=.22;o.renderOrder=7;
        }
        // Native metal now carries only tailoring details and buttons; frame geometry is split above.
        if(name==='metal'){o.material.color.setHex(0x8f6a46);o.material.metalness=.72;o.material.roughness=.3;}
      });
      if(Object.keys(bones).length!==40||!skeleton)throw Error('INCOMPLETE_NATIVE_SKELETON');
      g.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(g,true);
      if(Math.abs(bounds.max.y-bounds.min.y-1.75)>.002)throw Error('AVATAR_HEIGHT_MISMATCH');
      g.position.set(...[placements[role][0],0,placements[role][1]]);
      g.userData={type:'avatar',role,room:role,label:roleSpec[role].label,bones,skeleton,
        nativeWebSkeleton:true,exactCanonicalMesh:true,phase:avatars.length*.7,
        gesture:'idle',gestureStarted:0,gestureUntil:0,height:1.75,visualStatus:'WEB_PREVIEW_NOT_FINAL',restHipsY:bones.Hips.position.y};
      avatars.push(g);interactables.push(g);gameGroup.add(g);
      exactAvatarMeshCount=count;exactAvatarVertices=vertices;
    }
    avatarModelMode=avatarV4?'canonical_glb_anatomical_eyes_v4_local_candidate':avatarModern?'canonical_glb_continuous_head_v3_local_candidate':'canonical_glb_skinned_curved_face_v2_web_preview';return true;
  }catch(e){exactAvatarLoadError=e.message;avatarModelMode='unavailable';throw e;}
}
function setGesture(avatar,name,t=performance.now()){
  const u=avatar.userData;u.gesture=name;u.gestureStarted=t;u.gestureUntil=name==='idle'?0:t+4300;
}
function nativeAngles(name,gesture,t){
  let x=0,y=0,z=0;
  if(gesture==='orient'){if(name==='Head')y=-.42;if(name==='Chest')y=-.16;}
  if(gesture==='wave'){
    if(name==='RightShoulder'){x=-.38;z=-1.04;}
    if(name==='RightElbow')x=-2.10;if(name==='RightWrist')z=.19*Math.sin(t*5);
  }
  if(gesture==='present'){
    if(name.endsWith('Shoulder')){x=-.66;z=name.startsWith('Left')?.22:-.22;}
    if(name.endsWith('Elbow'))x=-.73;
    if(name.endsWith('Wrist'))y=name.startsWith('Left')?-.55:.55;
  }
  if(gesture==='reflect'){
    if(name==='RightShoulder'){x=-.45;y=-.35;z=.12;}
    if(name==='RightElbow')x=-2.25;if(name.startsWith('RightFinger'))x=.55;
    if(name==='Head'){x=.09;y=-.13;z=.04;}
  }
  if(gesture==='stop'){
    if(name==='RightShoulder'){x=-1.15;z=-.3;}
    if(name==='RightElbow')x=-.5;if(name==='RightWrist')x=-.8;
  }
  if(gesture==='acknowledge'){if(name==='Head')x=.12*Math.sin(Math.min(t,1.2)/1.2*Math.PI);if(name==='Chest')x=.035;}
  if(gesture==='walk'){
    if(name.endsWith('Hip'))x=Math.sin(t*5)*(name.startsWith('Left')?1:-1)*.28;
    if(name.endsWith('Knee'))x=Math.max(0,Math.sin(t*5+(name.startsWith('Left')?0:Math.PI)))*.4;
  }
  return [x,y,z];
}
function animateNicolas(avatar,t,dt){
  const u=avatar.userData,d=Math.hypot(player.x-avatar.position.x,player.z-avatar.position.z);
  const target=Math.atan2(player.x-avatar.position.x,player.z-avatar.position.z);
  const delta=Math.atan2(Math.sin(target-avatar.rotation.y),Math.cos(target-avatar.rotation.y));
  const reviewing=inspection?.avatar===avatar;
  if(avatarV4)animateV4Face(avatar,t,dt,reviewing);
  if(avatarV3){
    const blink=(!reduced&&!(reviewing&&inspection.freeze))?Math.max(0,1-Math.abs(((t/1000+u.phase)%5.7)-5.15)/.13):0;
    avatar.traverse(o=>{if(o.morphTargetInfluences?.length)o.morphTargetInfluences[0]=blink;});
  }
  if(d<4.5&&!reviewing&&!u.walk){
    if(!avatarModern)avatar.rotation.y+=delta*(1-Math.exp(-dt*1.5));
    if(!u.greeted){setGesture(avatar,'wave',t);u.greeted=true;}
  }
  if(t>u.gestureUntil&&u.gesture!=='idle')setGesture(avatar,'idle',t);
  const phase=(t-u.gestureStarted)/1000;
  const walk=u.walk?walkPose(avatar,t):null;
  for(const [name,bone] of Object.entries(u.bones)){
    let [x,y,z]=nativeAngles(name,u.gesture,phase);
    if(avatarModern&&!reduced){
      if(name==='Head'){x+=.006*Math.sin(t*.0007);y+=.009*Math.sin(t*.00043);}
      if(name.endsWith('Elbow')&&u.gesture==='idle')x=-.09;
      if(name.includes('Finger')&&u.gesture==='idle')x=.10;
      if(name==='Chest'){bone.scale.set(1+.002*Math.sin(t*.0013),1,1+.004*Math.sin(t*.0013));}
    }
    if(name==='Head'&&d<4.5&&!reviewing&&!walk){y+=Math.max(-.35,Math.min(.35,delta));x-=Math.atan2(player.y-1.6,Math.max(.5,d))*.3;}
    if(name==='Chest'&&!reduced)x+=Math.sin(t*.0013+u.phase)*.008;
    if(walk&&walk[name]){[x,y,z]=walk[name];}
    if(reviewing&&inspection.freeze){x=y=z=0;bone.scale.set(1,1,1);}
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z,'ZYX'));
    // Foot IK must match the translated root during stance; gestures keep smoothing.
    if((avatarV4&&reviewing&&inspection.freeze)||(walk&&/Hip|Knee|Ankle/.test(name)))bone.quaternion.copy(q);
    else bone.quaternion.slerp(q,1-Math.exp(-dt*(name==='Head'?8:6)));
  }
  if(walk?.ankles)for(const side of ['Left','Right'])u.bones[side+'Ankle'].quaternion.copy(walk.ankles[side]);
}

// Face channels share this same frame hook; no independent timer or mixer.
function animateV4Face(avatar,t,dt,reviewing){
  const i=reviewing?inspection:null,u=avatar.userData;
  const moving=!reduced&&!(i?.freeze);
  const autoBlink=moving?Math.max(0,1-Math.abs(((t/1000+u.phase)%5.7)-5.15)/.13):0;
  const blink=i?.blink==='closed'?1:i?.blink==='open'?0:autoBlink;
  let gx=0,gy=0;
  if(i?.gaze==='left')gx=1;else if(i?.gaze==='right')gx=-1;
  else if(i?.gaze==='up')gy=1;else if(i?.gaze==='down')gy=-1;
  else if(moving&&i?.gaze!=='center'){gx=.22*Math.sin(t*.00067+u.phase);gy=.10*Math.sin(t*.00039);}
  const values={BlinkLeft:blink,BlinkRight:blink,LookLeft:Math.max(0,gx),LookRight:Math.max(0,-gx),LookUp:Math.max(0,gy),LookDown:Math.max(0,-gy)};
  avatar.traverse(o=>{if(!o.morphTargetDictionary)return;for(const [name,value] of Object.entries(values)){const k=o.morphTargetDictionary[name];if(k!==undefined)o.morphTargetInfluences[k]=value;}});
  u.faceChannels=values;
}
function walkPose(avatar,t){
  const u=avatar.userData,w=u.walk,elapsed=(t-w.started)/1000;
  // Clear local aisle beside the arrival desk; two straight segments and a half turn.
  // Phase is shared with root travel, so a planted ankle stays stationary in world space.
  const segment=4.8,turn=2.4,speed=.28,cycle=1.6;
  let clock=elapsed,distance=0,rotation=0,walking=true;
  if(elapsed<segment)distance=elapsed*speed;
  else if(elapsed<segment+turn){distance=segment*speed;rotation=Math.PI*((elapsed-segment)/turn);clock=elapsed-segment;walking=false;}
  else if(elapsed<2*segment+turn){clock=elapsed-segment-turn;distance=(segment-clock)*speed;rotation=Math.PI;}
  else{avatar.position.copy(w.origin);avatar.rotation.y=w.yaw+Math.PI;u.bones.Hips.position.y=u.restHipsY;u.walk=null;setGesture(avatar,'idle',t);return null;}
  avatar.position.copy(w.origin);avatar.position.x+=Math.sin(w.yaw)*distance;avatar.position.z+=Math.cos(w.yaw)*distance;avatar.rotation.y=w.yaw+rotation;
  const pose={ankles:{}};const settle=Math.min(1,elapsed/.25,(2*segment+turn-elapsed)/.25);
  const lowering=.014*Math.max(0,settle)+(walking?0:.020*Math.sin(Math.PI*clock/turn));
  u.bones.Hips.position.y=u.restHipsY-lowering;
  for(const [side,offset] of [['Left',0],['Right',.5]]){
    const phase=((clock/cycle+offset)%1+1)%1;
    let footZ,raise;
    if(phase<.5){footZ=speed*cycle*(.25-phase);raise=0;}
    else{const s=(phase-.5)*2;footZ=speed*cycle*(-.25+.5*(s*s*(3-2*s)));raise=.05*Math.sin(Math.PI*s);}
    footZ*=Math.max(0,settle);raise*=Math.max(0,settle);
    const hip=u.bones[side+'Hip'],knee=u.bones[side+'Knee'],ankle=u.bones[side+'Ankle'];
    const restX=hip.position.x+knee.position.x+ankle.position.x;
    let targetX=restX,footYaw=0;
    if(!walking){
      // Four alternating pivot steps. A supporting foot keeps BOTH its world
      // position and orientation while the body turns above it.
      const step=Math.min(3,Math.floor(clock/(turn/4))),fraction=(clock/(turn/4))-step;
      const swing=side===(step%2===0?'Left':'Right');
      const previous=side==='Left'?(step>=3?Math.PI:step>=1?Math.PI/2:0):(step>=2?Math.PI/2:0);
      const before=step>=2?Math.PI/2:0,after=before+Math.PI/2;
      const s=fraction*fraction*(3-2*fraction);
      const footAngle=swing?before+(after-before)*s:previous;
      footYaw=footAngle-rotation;
      const startZ=(side==='Left'?1:-1)*speed*cycle*.25;
      targetX=restX*Math.cos(footYaw)+startZ*Math.sin(footYaw);
      footZ=-restX*Math.sin(footYaw)+startZ*Math.cos(footYaw);
      raise=swing?.048*Math.sin(Math.PI*fraction):0;
    }
    const a=Math.hypot(knee.position.y,knee.position.z),b=Math.hypot(ankle.position.y,ankle.position.z);
    const restThigh=Math.atan2(-knee.position.z,-knee.position.y),restCalf=Math.atan2(-ankle.position.z,-ankle.position.y);
    const vertical=-knee.position.y-ankle.position.y-lowering-raise;
    const lateral=targetX-hip.position.x,restLateral=knee.position.x+ankle.position.x;
    const down=Math.sqrt(Math.max(.001,vertical*vertical+lateral*lateral-restLateral*restLateral));
    const roll=Math.atan2(lateral,vertical)-Math.atan2(restLateral,down);
    const z=footZ+hip.position.z+knee.position.z+ankle.position.z;
    const length=Math.min(a+b-.0001,Math.hypot(down,z));
    const bend=Math.acos(Math.max(-1,Math.min(1,(length*length-a*a-b*b)/(2*a*b))));
    const thigh=Math.atan2(-z,down)-Math.atan2(b*Math.sin(bend),a+b*Math.cos(bend));
    const hipAngle=thigh-restThigh,kneeAngle=bend-restCalf+restThigh;
    pose[side+'Hip']=[hipAngle,0,roll];pose[side+'Knee']=[kneeAngle,0,0];pose[side+'Ankle']=[-hipAngle-kneeAngle,0,0];
    const hipQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(hipAngle,0,roll,'ZYX'));
    const kneeQ=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),kneeAngle);
    pose.ankles[side]=hipQ.multiply(kneeQ).invert().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),footYaw));
    pose[side+'Shoulder']=[walking?-.10*Math.sin(clock/cycle*2*Math.PI+offset*2*Math.PI):0,0,side==='Left'?.045:-.045];
    pose[side+'Elbow']=[-.15,0,0];
  }
  u.walkEvidence={elapsed,stage:walking?'articulated_walk':'half_turn',distance,rotation};
  return pose;
}

function endInspection(){
  if(!inspection)return;
  const i=inspection;inspection=null;
  for(const [light,visible] of i.lights)light.visible=visible;
  for(const light of inspectionLights){gameGroup.remove(light);light.dispose?.();}inspectionLights=[];
  runtime.scene.fog=i.fog;runtime.renderer.toneMappingExposure=i.exposure;
  runtime.camera.fov=i.fov;runtime.camera.position.copy(i.cameraPosition);runtime.camera.quaternion.copy(i.cameraQuaternion);runtime.camera.updateProjectionMatrix();
  i.avatar.position.copy(i.origin);i.avatar.rotation.y=i.yaw;i.avatar.userData.walk=null;i.avatar.userData.bones.Hips.position.y=i.avatar.userData.restHipsY;setGesture(i.avatar,'idle');
  i.avatar.traverse(o=>{if(o.isMesh&&['lens','aviator_frame'].includes(o.material.name))o.visible=i.avatar.userData.role==='desk';});
  if(i.avatarState){
    Object.assign(i.avatar.userData,i.avatarState.behavior);
    for(const [bone,position,quaternion,scale] of i.avatarState.bones){bone.position.copy(position);bone.quaternion.copy(quaternion);bone.scale.copy(scale);}
    for(const [mesh,visible,morphs] of i.avatarState.meshes){mesh.visible=visible;if(morphs)mesh.morphTargetInfluences.splice(0,morphs.length,...morphs);}
  }
  hud.querySelector('#nicolasReviewLabel')?.remove();keys.clear();lastFrame=0;
  const label=hud.querySelector('#nicolasReview span');if(label)label.textContent='Nicolas · candidat '+avatarVersion.toUpperCase()+' · non approuvé';
}
function inspect(options={}){
  if(!reviewAllowed||!active)return false;
  if(options.enabled===false){endInspection();return true;}
  const role=options.role||inspection?.avatar.userData.role||'desk';
  if(inspection&&inspection.avatar.userData.role!==role)endInspection();
  if(!inspection){
    const avatar=avatars.find(a=>a.userData.role===role);if(!avatar)return false;
    document.exitPointerLock?.();keys.clear();velocityX=velocityZ=0;
    const lights=[];gameGroup.traverse(o=>{if(o.isLight)lights.push([o,o.visible]);});
    inspection={avatar,origin:avatar.position.clone(),yaw:avatar.rotation.y,cameraPosition:runtime.camera.position.clone(),cameraQuaternion:runtime.camera.quaternion.clone(),fov:runtime.camera.fov,exposure:runtime.renderer.toneMappingExposure,fog:runtime.scene.fog,lights,angle:0,framing:'head',neutral:true,freeze:true,glasses:false,gaze:'center',blink:'auto',lightDirection:'neutral'};
    if(avatarV4){
      const u=avatar.userData,meshes=[];
      avatar.traverse(o=>{if(o.isMesh)meshes.push([o,o.visible,o.morphTargetInfluences?.slice()]);});
      inspection.avatarState={behavior:{gesture:u.gesture,gestureStarted:u.gestureStarted,gestureUntil:u.gestureUntil,greeted:u.greeted,walk:u.walk,faceChannels:u.faceChannels},bones:Object.values(u.bones).map(b=>[b,b.position.clone(),b.quaternion.clone(),b.scale.clone()]),meshes};
    }
    avatar.rotation.y=0;avatar.userData.greeted=true;setGesture(avatar,'idle');
  }
  Object.assign(inspection,Object.fromEntries(Object.entries(options).filter(([k])=>['angle','framing','neutral','freeze','glasses',...(avatarV4?['gaze','blink','lightDirection']:[])].includes(k))));
  if(options.framing)inspection.walkView=false;
  if(avatarV4&&inspection.avatar.userData.walk&&(options.walk===false||options.freeze===true||options.framing)){
    inspection.avatar.userData.walk=null;inspection.avatar.position.copy(inspection.origin);inspection.avatar.rotation.y=0;inspection.avatar.userData.bones.Hips.position.y=inspection.avatar.userData.restHipsY;inspection.walkView=false;
  }
  for(const [light,visible] of inspection.lights)light.visible=inspection.neutral?false:visible;
  for(const light of inspectionLights){gameGroup.remove(light);light.dispose?.();}inspectionLights=[];
  if(inspection.neutral){
    const ambient=new THREE.HemisphereLight(0xffffff,0x919191,2.1),key=new THREE.DirectionalLight(0xffffff,2.3);
    key.position.copy(inspection.avatar.position).add(new THREE.Vector3(avatarV4&&inspection.lightDirection==='right'?3:avatarV4&&inspection.lightDirection==='left'?-3:-2,4,4));key.target=inspection.avatar;gameGroup.add(ambient,key);inspectionLights=[ambient,key];runtime.scene.fog=null;runtime.renderer.toneMappingExposure=1;
  }else{runtime.scene.fog=inspection.fog;runtime.renderer.toneMappingExposure=inspection.exposure;}
  inspection.avatar.traverse(o=>{if(o.isMesh&&['lens','aviator_frame'].includes(o.material.name))o.visible=inspection.glasses;});
  if(options.gesture&&['idle','orient','wave','present','reflect','stop','acknowledge'].includes(options.gesture)){inspection.freeze=false;setGesture(inspection.avatar,options.gesture);}
  if(options.walk&&avatarModern&&role==='desk'){
    inspection.freeze=false;inspection.framing='full';inspection.walkView=true;inspection.angle=.65;setGesture(inspection.avatar,'idle');inspection.avatar.userData.walk={started:performance.now(),origin:inspection.origin.clone(),yaw:0};
  }
  return {role,angle:inspection.angle,neutral:inspection.neutral,framing:inspection.framing};
}
function inspectionFrame(t,dt){
  for(const a of avatars)animateNicolas(a,t,dt);
  const i=inspection;if(!i)return;
  const full=i.framing==='full',neck=i.framing==='neck',target=(i.walkView?i.origin:i.avatar.position).clone().add(new THREE.Vector3(0,full?.93:neck?1.48:1.58,i.walkView?.65:0));
  const radius=full?3.5:neck?.55:.72;
  runtime.camera.fov=full?42:38;runtime.camera.position.copy(target).add(new THREE.Vector3(Math.sin(i.angle)*radius,full?.08:.035,Math.cos(i.angle)*radius));runtime.camera.lookAt(target);runtime.camera.updateProjectionMatrix();
}
function createWorld(){
  if(worldReady||!runtimeIsUsable(runtime))return;
  THREE=runtime.THREE;gameGroup=new THREE.Group();gameGroup.name='LivingAdvisoryHouseGameWorld';gameGroup.visible=false;runtime.scene.add(gameGroup);
  gameGroup.add(new THREE.HemisphereLight(0xb7ced1,0x393330,2.6));
  const key=new THREE.DirectionalLight(0xffd5b4,2);key.position.set(3,6,6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-18;key.shadow.camera.right=18;key.shadow.camera.top=12;key.shadow.camera.bottom=-12;key.shadow.bias=-.0005;gameGroup.add(key);
  addRoomShell('desk');addRoomShell('decision');
  addFloor(0,-3.3,3.2,6.6);addFloor(3.5,-5,7,3.2);
  meshBox(3.2,.08,6.6,makeMat(0x080b0c),0,4.2,-3.3);
  meshBox(7,.08,3.2,makeMat(0x080b0c),3.5,4.2,-5);
  addWall(-3.8,0,4.4,.18);addWall(3.8,0,4.4,.18);
  addWall(-1.6,-3.3,.16,6.6);addWall(1.6,-1.7,.16,3.4);
  addWall(2.7,-6.6,8.6,.16);addWall(4.3,-3.4,5.4,.16);
  addWall(7,-8.3,.16,3.4);addWall(7,-1.7,.16,3.4);
  makeDoorFrame(0,0,0,'Decision →',rooms.desk.color);
  makeDoorFrame(7,-5,Math.PI/2,'Decision',rooms.decision.color);
  for(const z of [-1,-2.5,-4])meshBox(.045,.025,.6,new THREE.MeshBasicMaterial({color:0xb88457}),0,.01,z);
  for(const x of [2.5,4,5.5])meshBox(.6,.025,.045,new THREE.MeshBasicMaterial({color:0xb88457}),x,.01,-5);
  const pathLight=new THREE.PointLight(0x6f95a6,18,12,1.8);pathLight.position.set(2.8,3,-5);gameGroup.add(pathLight);
  const blueFill=new THREE.PointLight(0x568fbc,12,12,1.5);blueFill.position.set(4,2.5,4);gameGroup.add(blueFill);
  for(const z of [1.4,3.2,5]){meshBox(.035,2.8,.035,new THREE.MeshBasicMaterial({color:0x487c9a}),5.87,2,z);}
  // Real furniture footprints are shared with the single collision function.
  for(const r of [{x:-1,z:5.5,w:4.4,d:1.8},{x:11.4,z:-4.5,w:3.8,d:1.8}]){
    meshBox(r.w,.13,r.d,makeMat(0x33271f,{rough:.6}),r.x,.74,r.z);obstacles.push(r);
    for(const dx of [-r.w/2+.25,r.w/2-.25])meshBox(.12,.7,r.d*.8,makeMat(0x141719),r.x+dx,.35,r.z);
    meshBox(.42,.035,.32,makeMat(0x743426),r.x,.83,r.z);
  }
  // Architecture, copper strips and night window are ordinary children of the same scene.
  for(const x of [-5.7,5.7])meshBox(.025,3.7,.035,new THREE.MeshBasicMaterial({color:0xb87333}),x,2,7.86);
  const windowMat=makeMat(0x092131,{rough:.3,metal:.25,emissive:0x173b58,emissiveIntensity:.35});
  meshBox(8,2.55,.04,windowMat,0,2.55,7.88);
  for(let i=0;i<20;i++){
    const x=-3.8+i*.4,h=.3+(i%5)*.18;
    meshBox(.28,h,.04,makeMat(0x10151c,{emissive:i%3?0x163249:0x692225,emissiveIntensity:.55}),x,1.3+h/2,7.83);
  }
  addPanel('desk','Bienvenue, Nicolas.','Présence numérique SUPRA · approchez votre hôte.',-5.86,2.2,3,Math.PI/2,.6);
  addPanel('decision','Le dossier, en perspective.','Decision Twin · même dossier, mêmes preuves.',16.86,2.2,-5,-Math.PI/2,.7);
  worldReady=true;exactAvatarPromise=loadCanonicalNicolasExact();
}

function pointInside(x,z,r){return x>=r.x-r.w/2&&x<=r.x+r.w/2&&z>=r.z-r.d/2&&z<=r.z+r.d/2;}
function canOccupy(x,z){
  const rr=player.radius;
  if(![[x-rr,z-rr],[x+rr,z-rr],[x-rr,z+rr],[x+rr,z+rr]].every(([px,pz])=>zones.some(zone=>pointInside(px,pz,zone))))return false;
  if(obstacles.some(o=>Math.abs(x-o.x)<o.w/2+rr&&Math.abs(z-o.z)<o.d/2+rr))return false;
  if(avatars.some(a=>Math.hypot(x-a.position.x,z-a.position.z)<rr+.3))return false;
  return !doors.some(d=>d.open<.72&&Math.hypot(x-d.x,z-d.z)<.63);
}

function detectRoom(x,z){for(const key of FIRST_SLICE)if(pointInside(x,z,rooms[key]))return key;return 'corridor';}
function currentRoomLabel(){return roomNow==='corridor'?'Passage central':rooms[roomNow]?.label||'Maison';}

function updateNearest(){
  if(!active||!THREE){nearby=null;return;}
  let best=null,bestD=Infinity;
  for(const obj of interactables){
    const wp=new THREE.Vector3();obj.getWorldPosition(wp);
    const d=Math.hypot(wp.x-player.x,wp.z-player.z);
    if(d<bestD&&(!obj.userData.room||obj.userData.room===roomNow)){bestD=d;best=obj;}
  }
  nearby=bestD<=2.35?{object:best,distance:bestD}:null;
  if(nearby){
    const u=nearby.object.userData||{};
    const label=u.type==='avatar'?(u.label||u.role):u.title||rooms[u.room]?.label||'surface';
    prompt.innerHTML='<b>E</b> · interagir avec '+String(label);
    prompt.classList.add('is-visible');
  }else{
    prompt.textContent='';
    prompt.classList.remove('is-visible');
  }
}

function contentFor(room){
  const title={
    desk:'Mission Director',
    decision:document.getElementById('decisionTwinTitle')?.textContent||'Decision Twin',
    proof:'Evidence · preuve vérifiable',
    explore:'Observatory · Cosmos volontaire',
    mission:'SUPRA Mission'
  }[room]||'SUPRA';
  const intro={
    desk:'Même Nicolas, rôle Mission Director. Le dossier entre ici une seule fois.',
    decision:'Même Nicolas, costumé Decision. Il présente le résultat souverain du Decision Twin.',
    proof:'Même Nicolas, costumé Evidence. Il vous ramène aux sources, transformations et incertitudes.',
    explore:'Même Nicolas, costumé Observatory. La profondeur reste volontaire et exploratoire.',
    mission:'Même Nicolas, costumé Solutions. Le besoin peut devenir une Mission sans promouvoir une exécution automatique.'
  }[room]||'';
  const articles=[];
  if(room==='decision'){
    articles.push(['Décision',document.querySelector('#decision-twin .decisionRoom article.card p strong')?.textContent||'Lecture décisionnelle disponible.']);
    articles.push(['Confiance',document.getElementById('realityConfidence')?.textContent||'Voir Evidence.']);
    document.querySelectorAll('#decision-twin .decisionItem').forEach(row=>articles.push([row.querySelector('b')?.textContent||'',row.querySelector('span')?.textContent||'']));
  }else if(room==='proof'){
    articles.push(['Sources en alerte',document.getElementById('sourceAlertCount')?.textContent||'État de preuve disponible dans la salle Evidence.']);
    articles.push(['Colonne vertébrale','ProofGraph + Evidence Universe · aucune seconde vérité.']);
  }else if(room==='explore'){
    articles.push(['Mode','Cosmos / Explorer · projection volontaire dans le même runtime.']);
    articles.push(['Règle','Explorer n’est jamais une étape obligatoire avant décision.']);
  }else if(room==='mission'){
    articles.push(['Besoin',document.getElementById('houseMissionNeed')?.textContent||'Dossier à préciser.']);
    articles.push(['Offre',document.getElementById('houseMissionOffer')?.textContent||'SUPRA Mission · offre existante.']);
  }else{
    articles.push(['Parcours','QUESTION → DECISION → PROOF → EXPLORE → MISSION']);
    articles.push(['Frontière privée','supra://private-office reste la frontière explicite.']);
  }
  return {title,intro,articles};
}

function openPanel(room){
  const data=contentFor(room);
  panelKicker.textContent='NICOLAS · '+(roleSpec[room]?.label||'SUPRA');
  panelTitle.textContent=data.title;
  panelIntro.textContent=data.intro;
  panelBody.replaceChildren(...data.articles.map(([k,v])=>{
    const article=document.createElement('article'),b=document.createElement('b'),span=document.createElement('span');
    b.textContent=k;span.textContent=v;article.append(b,span);return article;
  }));
  panel.hidden=false;keys.clear();velocityX=velocityZ=0;
  panelClose.focus();document.exitPointerLock?.();
}
function closePanel(){
  panel.hidden=true;
  if(active&&pointerLockPreferred&&runtime?.renderer?.domElement?.requestPointerLock){
    try{
      const request=runtime.renderer.domElement.requestPointerLock();
      request?.catch?.(()=>{});
    }catch(e){}
  }
}

function interact(target=nearby?.object){
  if(!active||!target)return false;
  const u=target.userData||{};
  const room=u.room||u.role||roomNow;
  if(u.type==='avatar'){
    setGesture(target,room==='desk'?'orient':'present');
    // Read the existing dossier without changing the underlying 2D room or history.
  }
  openPanel(rooms[room]?room:roomNow==='corridor'?'desk':roomNow);
  if(room==='desk'){panelIntro.textContent='Je suis la présence numérique SUPRA de Nicolas. Suivez les lignes de cuivre, franchissez la porte puis prenez à droite vers Decision.';}
  return true;
}

function gameFrame(t){
  if(!active||!worldReady||!runtime||document.hidden)return;
  const raw=lastFrame?t-lastFrame:0;const dt=Math.min(.05,(raw||16)/1000);lastFrame=t;
  if(raw>0&&raw<1000){frameSamples.push(raw);if(frameSamples.length>1800)frameSamples.shift();}
  if(inspection){inspectionFrame(t,dt);return;}
  let mx=0,mz=0;
  const pad=Array.from(navigator.getGamepads?.()||[]).find(Boolean);
  if(pad){
    const axis=i=>Math.abs(pad.axes[i]||0)>.16?pad.axes[i]:0;
    if(panel.hidden){mx=axis(0);mz=axis(1);yaw-=axis(2)*dt*1.8;pitch=Math.max(-1.1,Math.min(1.1,pitch-axis(3)*dt*1.3));}
    if(pad.buttons[0]?.pressed&&!gamepadHeld)interact();gamepadHeld=!!pad.buttons[0]?.pressed;
    if(pad.buttons[8]?.pressed){exitGame();return;}
  }
  if(panel.hidden){if(keys.has('forward'))mz-=1;if(keys.has('back'))mz+=1;if(keys.has('left'))mx-=1;if(keys.has('right'))mx+=1;}
  const len=Math.max(1,Math.hypot(mx,mz));mx/=len;mz/=len;
  const speed=keys.has('run')?3.9:2.4;
  const tx=(Math.sin(yaw)*mz+Math.cos(yaw)*mx)*speed;
  const tz=(Math.cos(yaw)*mz-Math.sin(yaw)*mx)*speed;
  const smooth=1-Math.exp(-dt*10);velocityX+=(tx-velocityX)*smooth;velocityZ+=(tz-velocityZ)*smooth;
  const prevX=player.x,prevZ=player.z;
  if(canOccupy(player.x+velocityX*dt,player.z))player.x+=velocityX*dt;else velocityX=0;
  if(canOccupy(player.x,player.z+velocityZ*dt))player.z+=velocityZ*dt;else velocityZ=0;
  const moving=Math.hypot(player.x-prevX,player.z-prevZ)>.0001;
  if(moving)gameFootstep(t,keys.has('run'));
  const bob=moving&&!reduced?Math.sin(t*.012)*.012:0;
  runtime.camera.position.set(player.x,player.y+bob,player.z);runtime.camera.rotation.set(pitch,yaw,0,'YXZ');
  const detected=detectRoom(player.x,player.z);
  if(detected!==roomNow){roomNow=detected;roomStatus.textContent=currentRoomLabel();setGameRoomTone(roomNow);}
  for(const door of doors){
    const d=Math.hypot(player.x-door.x,player.z-door.z),target=d<2.7?1:0;
    door.open+=(target-door.open)*(1-Math.exp(-dt*5.8));
    door.pivotL.rotation.y=-door.open*1.22;door.pivotR.rotation.y=door.open*1.22;
  }
  for(const avatar of avatars)animateNicolas(avatar,t,dt);
  updateNearest();
}

const previousFrameHook=window.LaBeteThreeFrameHook;
window.LaBeteThreeFrameHook=(t,rt)=>{
  try{previousFrameHook?.(t,rt);}catch(e){}
  if(!runtime&&runtimeIsUsable(rt))bindRuntime(rt);
  gameFrame(t);
};

function bindRuntime(rt){
  if(runtime===rt&&worldReady)return;
  if(!runtimeIsUsable(rt))return;
  runtime=rt;THREE=rt.THREE;
  enterButton.disabled=false;enterButton.textContent='Entrer dans la Maison 3D →';
  modeStatus.textContent=avatarModern?'Nicolas · personne représentée · candidat local à valider':'Présence numérique SUPRA · aperçu de l’avatar à valider';
}

async function awaitRuntime(timeout=12000){
  if(runtimeIsUsable(window.LaBeteThreeRuntime)){bindRuntime(window.LaBeteThreeRuntime);return runtime;}
  enterButton.disabled=true;
  enterButton.textContent='Ouverture de la Maison 3D…';
  try{await window.laBeteEnsurePresence?.();}catch(e){}
  if(runtimeIsUsable(window.LaBeteThreeRuntime)){bindRuntime(window.LaBeteThreeRuntime);return runtime;}
  return await new Promise((resolve,reject)=>{
    const start=performance.now();
    const tick=()=>{
      if(runtimeIsUsable(window.LaBeteThreeRuntime)){bindRuntime(window.LaBeteThreeRuntime);resolve(runtime);return;}
      if(performance.now()-start>timeout){reject(new Error('THREE_RUNTIME_TIMEOUT'));return;}
      setTimeout(tick,80);
    };tick();
  });
}

async function enterGame({pointerLock=true}={}){
  if(active)return state();
  pointerLockPreferred=pointerLock===true;
  const loadStart=performance.now();previousFocus=document.activeElement;
  const rt=await awaitRuntime();
  createWorld();
  if(exactAvatarPromise)await exactAvatarPromise;
  loadMS=performance.now()-loadStart;enteredAt=performance.now();frameSamples.length=0;
  originalCamera={position:rt.camera.position.clone(),quaternion:rt.camera.quaternion.clone(),near:rt.camera.near,far:rt.camera.far,ratio:rt.renderer.getPixelRatio()};
  const stage=document.getElementById('beastStage');
  if(!stage)throw new Error('BEAST_STAGE_MISSING');
  originalStageParent=stage.parentNode;originalStageNext=stage.nextSibling;
  originalRootVisible=rt.root.visible;originalAvatarVisible=rt.avatarGroup?.visible===true;originalFog=rt.scene.fog;originalBackground=rt.scene.background;originalFov=rt.camera.fov;originalToneExposure=rt.renderer.toneMappingExposure||1;
  document.body.appendChild(stage);
  body.classList.add('house-game-active');
  gameGroup.visible=true;rt.root.visible=false;if(rt.avatarGroup)rt.avatarGroup.visible=false;
  rt.camera.fov=66;rt.camera.near=.08;rt.camera.far=120;rt.camera.updateProjectionMatrix();
  rt.scene.fog=new THREE.FogExp2(0x071012,.020);rt.scene.background=new THREE.Color(0x05090b);rt.renderer.toneMappingExposure=Math.max(1.42,originalToneExposure*1.28);
  player.x=0;player.y=1.64;player.z=3.4;yaw=-.7;pitch=-.04;roomNow='desk';lastFrame=0;
  velocityX=velocityZ=0;rt.renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<700?1.25:1.5));
  originalShadow=rt.renderer.shadowMap.enabled;rt.renderer.shadowMap.enabled=true;rt.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  sceneVisibility=rt.scene.children.filter(o=>o!==gameGroup).map(o=>[o,o.visible]);for(const [o] of sceneVisibility)o.visible=false;
  active=true;exitButton.focus();roomStatus.textContent=currentRoomLabel();setGameRoomTone(roomNow);
  prompt.textContent='';panel.hidden=true;
  if(pointerLock&&rt.renderer.domElement.requestPointerLock){
    try{await rt.renderer.domElement.requestPointerLock();}catch(e){}
  }
  return state();
}

function exitGame(){
  if(!active)return state();
  endInspection();
  active=false;pointerLockPreferred=false;keys.clear();velocityX=velocityZ=0;gameGroup.visible=false;window.LaBeteSensoryRuntime?.stop();soundEnabled=false;soundButton.textContent='Son · OFF';soundButton.setAttribute('aria-pressed','false');
  for(const [o,v] of sceneVisibility)o.visible=v;sceneVisibility=[];
  if(runtime){
    runtime.renderer.shadowMap.enabled=originalShadow;runtime.root.visible=originalRootVisible;
    if(runtime.avatarGroup)runtime.avatarGroup.visible=originalAvatarVisible;
    runtime.scene.fog=originalFog;
    runtime.scene.background=originalBackground;
    runtime.renderer.toneMappingExposure=originalToneExposure;
    runtime.camera.fov=originalFov;
    if(originalCamera){runtime.camera.position.copy(originalCamera.position);runtime.camera.quaternion.copy(originalCamera.quaternion);runtime.camera.near=originalCamera.near;runtime.camera.far=originalCamera.far;runtime.renderer.setPixelRatio(originalCamera.ratio);}
    runtime.camera.updateProjectionMatrix();
  }
  document.exitPointerLock?.();
  const stage=document.getElementById('beastStage');
  if(stage&&originalStageParent){
    if(originalStageNext&&originalStageNext.parentNode===originalStageParent)originalStageParent.insertBefore(stage,originalStageNext);
    else originalStageParent.appendChild(stage);
  }
  body.classList.remove('house-game-active');
  panel.hidden=true;prompt.classList.remove('is-visible');previousFocus?.focus?.();
  return state();
}

function control(action,on=true){
  if(['forward','back','left','right','run'].includes(action)){on?keys.add(action):keys.delete(action);return true;}
  if(action==='interact'&&on)return interact();
  return false;
}
enterButton.addEventListener('click',()=>{
  enterGame().catch(err=>{if(active)exitGame();enterButton.disabled=false;enterButton.textContent='3D indisponible · réessayer';console.warn(err);});
});
soundButton.addEventListener('click',()=>toggleGameSound());
exitButton.addEventListener('click',exitGame);
panelClose.addEventListener('click',closePanel);
interactMobile.addEventListener('click',()=>interact());

window.addEventListener('la-bete-three-runtime-ready',()=>{if(runtimeIsUsable(window.LaBeteThreeRuntime))bindRuntime(window.LaBeteThreeRuntime);});
if(runtimeIsUsable(window.LaBeteThreeRuntime))bindRuntime(window.LaBeteThreeRuntime);
else modeStatus.textContent='3D à la demande · aucun chargement avant votre entrée';

document.addEventListener('keydown',event=>{
  if(!active)return;
  if(inspection&&event.code==='Escape'){endInspection();event.preventDefault();return;}
  if(event.code==='Tab'){const controls=Array.from(hud.querySelectorAll('button,select')).filter(x=>x.getClientRects().length&&!x.disabled);const i=controls.indexOf(document.activeElement);controls[(i+(event.shiftKey?-1:1)+controls.length)%controls.length]?.focus();event.preventDefault();return;}
  if(!panel.hidden&&event.key==='Escape'){event.preventDefault();closePanel();return;}
  const tag=event.target?.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
  const map={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',ShiftLeft:'run',ShiftRight:'run'};
  if(!panel.hidden)return;
  if(map[event.code]){keys.add(map[event.code]);event.preventDefault();}
  if(event.code==='KeyE'){interact();event.preventDefault();}
  if(event.code==='KeyM'){toggleGameSound();event.preventDefault();}
  if(event.code==='Escape'&&document.pointerLockElement!==runtime?.renderer?.domElement){exitGame();}
});
document.addEventListener('keyup',event=>{
  if(!active)return;
  const map={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',ShiftLeft:'run',ShiftRight:'run'};
  if(map[event.code]){keys.delete(map[event.code]);event.preventDefault();}
});
document.addEventListener('mousemove',event=>{
  if(!active||document.pointerLockElement!==runtime?.renderer?.domElement||!panel.hidden)return;
  yaw-=event.movementX*.0022;pitch-=event.movementY*.0019;pitch=Math.max(-1.18,Math.min(1.18,pitch));
});

function blockLegacyPointer(event){
  if(!active)return;
  if(event.pointerType==='touch'){
    if(event.type==='pointerdown'&&!event.target.closest?.('.houseGameTouch')){touchLookId=event.pointerId;touchLastX=event.clientX;touchLastY=event.clientY;}
    else if(event.type==='pointermove'&&event.pointerId===touchLookId){
      const dx=event.clientX-touchLastX,dy=event.clientY-touchLastY;touchLastX=event.clientX;touchLastY=event.clientY;
      yaw-=dx*.006;pitch-=dy*.005;pitch=Math.max(-1.1,Math.min(1.1,pitch));
    }else if((event.type==='pointerup'||event.type==='pointercancel')&&event.pointerId===touchLookId)touchLookId=null;
  }else if(event.type==='pointerdown'&&panel.hidden){
    try{runtime?.renderer?.domElement?.requestPointerLock?.();}catch(e){}
  }
  event.stopImmediatePropagation();
}
function bindCanvasGuards(){
  const canvas=runtime?.renderer?.domElement;if(!canvas||canvas.dataset.houseGameGuard==='1')return;
  canvas.dataset.houseGameGuard='1';
  canvas.addEventListener('webglcontextlost',()=>{if(active)exitGame();enterButton.textContent='3D interrompue · recharger pour reprendre';});
  ['pointerdown','pointermove','pointerup','pointercancel'].forEach(type=>canvas.addEventListener(type,blockLegacyPointer,{capture:true}));
}
const canvasBindTimer=setInterval(()=>{if(runtime){bindCanvasGuards();clearInterval(canvasBindTimer);}},120);

for(const button of hud.querySelectorAll('[data-move]')){
  const action=button.dataset.move;
  const on=e=>{e.preventDefault();if(active&&panel.hidden){button.setPointerCapture?.(e.pointerId);keys.add(action);}};
  const off=e=>{e.preventDefault();keys.delete(action);};
  button.addEventListener('pointerdown',on);button.addEventListener('pointerup',off);button.addEventListener('pointercancel',off);button.addEventListener('pointerleave',off);
}

window.addEventListener('blur',()=>{keys.clear();velocityX=velocityZ=0;});
document.addEventListener('visibilitychange',()=>{keys.clear();velocityX=velocityZ=0;lastFrame=0;if(document.hidden){window.LaBeteSensoryRuntime?.stop();soundEnabled=false;soundButton.textContent='Son · OFF';soundButton.setAttribute('aria-pressed','false');}});
window.addEventListener('popstate',()=>{if(active)exitGame();});

function pose(role){
  const avatar=avatars.find(a=>a.userData.role===role);
  if(!avatar)return null;
  const bones=avatar.userData.bones||{};
  return {
    role,
    rightShoulderZ:Number((bones.RightShoulder?.rotation.z||0).toFixed(4)),
    rightElbowZ:Number((bones.RightElbow?.rotation.z||0).toFixed(4)),
    headY:Number((bones.Head?.rotation.y||0).toFixed(4)),
    nativeWebSkeleton:!!avatar.userData.nativeWebSkeleton
  };
}
function state(){
  return {
    schema:'LA_BETE_HOUSE_GAME_V1',
    active,
    world_ready:worldReady,
    same_renderer:!!(runtime&&document.querySelector('#beastMount canvas')===runtime.renderer.domElement),
    same_scene:!!(gameGroup&&runtime&&gameGroup.parent===runtime.scene),
    second_engine:false,
    second_registry:false,
    second_truth:false,
    avatar_identity:avatarV4?'NICOLAS_CANONICAL_USDA_V4':avatarModern?'NICOLAS_CANONICAL_USDA_V3':'NICOLAS_CANONICAL_USDA_CURVED_FACE_V2',
    canonical_native_rig:'Nicolas.usda',
    avatar_model_mode:avatarModelMode,
    avatar_version:avatarVersion,
    independent_eyes:avatarV4&&avatars.length===2&&avatars.every(a=>{let found=false;a.traverse(o=>{if(o.isSkinnedMesh&&o.material.name==='eye'&&o.morphTargetDictionary?.LookLeft!==undefined)found=true;});return found;}),
    native_skeleton_loaded:avatarModelMode==='canonical_glb_anatomical_eyes_v4_local_candidate'||avatarModelMode==='canonical_glb_skinned_curved_face_v2_web_preview'||avatarModelMode==='canonical_glb_continuous_head_v3_local_candidate',
    avatar_final:false,
    visual_status:'WEB_PREVIEW_REQUIRES_HUMAN_REVIEW',
    first_slice_only:true,
    height_m:1.75,
    web_animation_mode:'NATIVE_40_JOINT_GLB_SWIFT_GESTURE_FORMULAS',
    exact_avatar_meshes:exactAvatarMeshCount,
    exact_avatar_vertices:exactAvatarVertices,
    exact_avatar_error:exactAvatarLoadError,
    avatars:avatars.map(a=>({role:a.userData.role,room:a.userData.room,same_identity:true,exact_canonical_mesh:!!a.userData.exactCanonicalMesh})),
    room:roomNow,
    player:{x:Number(player.x.toFixed(2)),y:Number(player.y.toFixed(2)),z:Number(player.z.toFixed(2))},
    controls:'WASD_ARROW_POINTERLOCK_TOUCH_GAMEPAD_E',
    reduced_motion:reduced,
    collisions:true,
    continuous_world:true,
    physical_doors:doors.length,
    sound_enabled:soundEnabled,
    sound_runtime:'EXISTING_LA_BETE_SENSORY_OWNER'
  };
}
function performanceReceipt(options={}){const a=[...frameSamples].sort((a,b)=>a-b),sum=a.reduce((x,y)=>x+y,0);const receipt={load_ms:loadMS,frames:a.length,fps_mean:a.length?1000*a.length/sum:null,p95_frame_ms:a.length?a[Math.floor((a.length-1)*.95)]:null,draw_calls:runtime?.renderer.info.render.calls,triangles:runtime?.renderer.info.render.triangles,js_heap_bytes:performance.memory?.usedJSHeapSize??null,pixel_ratio:runtime?.renderer.getPixelRatio()};if(reviewAllowed&&options.samples)receipt.frame_intervals_ms=frameSamples.slice();if(reviewAllowed&&options.reset)frameSamples.length=0;return receipt;}
window.LaBeteHouseGameV1=Object.freeze({enter:enterGame,exit:exitGame,state,pose,control,interact,performance:performanceReceipt,...(reviewAllowed?{inspect}: {})});

if(reviewAllowed){
  const style=document.createElement('style');style.textContent='#houseGameHUD:has(#houseGamePanel:not([hidden])) #nicolasReview{display:none!important}@media(max-width:700px){#nicolasReview{display:none!important}}';document.head.appendChild(style);
  const review=document.createElement('div');review.id='nicolasReview';
  review.style.cssText='position:absolute;bottom:52px;left:20px;width:300px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:9px;background:#101619ed;border:1px solid #725a44;border-radius:8px;pointer-events:auto;font:12px system-ui;color:#eee;z-index:25';
  review.innerHTML='<span style="margin-right:8px">Nicolas · candidat '+avatarVersion.toUpperCase()+' · non approuvé</span>'+
    '<button data-review="head">Inspecter le visage</button><button data-review="full">Corps entier</button><button data-review="left">↶ 45°</button><button data-review="right">45° ↷</button><button data-review="light">Lumière</button><button data-review="glasses">Lunettes</button><select aria-label="Gestuelle de Nicolas"><option value="idle">Repos vivant</option><option value="orient">Orienter</option><option value="wave">Saluer</option><option value="present">Présenter</option><option value="reflect">Réfléchir</option><option value="stop">Stop</option><option value="acknowledge">Hochement décoratif</option></select>'+
    (avatarV4?'<button data-review="gaze-left">Regard ←</button><button data-review="gaze-center">Regard face</button><button data-review="gaze-right">Regard →</button><button data-review="blink">Paupières</button><button data-review="light-left">Lumière ←</button><button data-review="light-right">Lumière →</button>':'')+
    (avatarModern?'<button data-review="walk">Marche et demi-tour</button>':'')+'<button data-review="role">Director / Decision</button><button data-review="return">Reprendre le parcours</button>';
  review.querySelectorAll('button,select').forEach(b=>{b.style.cssText='color:#eee;background:#252727;border:1px solid #715942;border-radius:5px;padding:7px;cursor:pointer';});
  review.addEventListener('click',e=>{const a=e.target.dataset.review;if(!a)return;
    if(a==='return'){inspect({enabled:false});return;}
    if(a==='head'||a==='full')inspect({framing:a,freeze:true});
    if(a==='left'||a==='right')inspect({angle:(inspection?.angle||0)+(a==='left'?-1:1)*Math.PI/4});
    if(a==='light')inspect({neutral:!(inspection?.neutral??true)});
    if(avatarV4&&a.startsWith('gaze-'))inspect({gaze:a.slice(5),freeze:true});
    if(avatarV4&&a==='blink')inspect({blink:inspection?.blink==='closed'?'open':'closed',freeze:true});
    if(avatarV4&&a.startsWith('light-'))inspect({neutral:true,lightDirection:a.slice(6)});
    if(a==='glasses')inspect({glasses:!(inspection?.glasses??false)});
    if(a==='walk')inspect({role:'desk',walk:true});
    if(a==='role')inspect({role:inspection?.avatar.userData.role==='decision'?'desk':'decision',glasses:inspection?.avatar.userData.role==='decision'});
  });
  review.querySelector('select').addEventListener('change',e=>inspect({gesture:e.target.value}));hud.appendChild(review);
}

})();
