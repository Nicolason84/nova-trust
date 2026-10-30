/* Camera capture with hardware-gated torch. No infrared/thermal claim, uploads,
 * microphone, background capture, recognition, or weapon aiming features. */
export function createLowLightCamera({getUserMedia=options=>navigator.mediaDevices.getUserMedia(options),onState=()=>{}}={}) {
  let stream=null,video=null,track=null,sequence=0,torchBusy=false;
  let state={phase:'off',torchSupported:false,torchConfirmed:false};
  const update=patch=>{state={...state,...patch};onState({...state});};
  const stopStream=s=>{for(const t of s?.getTracks?.()||[])try{t.stop();}catch{}};
  function stop(){sequence++;const old=stream;stream=track=null;torchBusy=false;if(video){try{video.pause();}catch{}video.srcObject=null;}video=null;stopStream(old);update({phase:'off',torchSupported:false,torchConfirmed:false});}
  async function start(target){
    stop();const turn=sequence;update({phase:'starting'});let acquired;
    try{
      acquired=await getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:960}}});
      if(turn!==sequence){stopStream(acquired);throw new Error('CAMERA_CANCELLED');}
      stream=acquired;track=stream.getVideoTracks()[0];if(!track)throw new Error('CAMERA_UNAVAILABLE');
      video=target;video.srcObject=stream;await video.play();
      if(turn!==sequence){stopStream(acquired);throw new Error('CAMERA_CANCELLED');}
      const caps=track.getCapabilities?.()||{};
      const supported=caps.torch===true||(Array.isArray(caps.torch)&&caps.torch.includes(true));
      track.addEventListener?.('ended',()=>{if(turn===sequence)stop();},{once:true});
      const actual=track.getSettings?.()?.torch;
      update({phase:'on',torchSupported:supported,torchConfirmed:typeof actual==='boolean'?actual:null});return {...state};
    }catch(error){if(turn===sequence){stop();update({phase:'error',errorCode:error?.name==='NotAllowedError'?'CAMERA_PERMISSION':error?.message==='CAMERA_CANCELLED'?'CAMERA_CANCELLED':'CAMERA_UNAVAILABLE'});}throw error;}
  }
  async function setTorch(enabled){
    if(!track||state.phase!=='on'||!state.torchSupported||torchBusy)throw new Error('TORCH_UNAVAILABLE');
    const turn=sequence,current=track;torchBusy=true;
    try{await current.applyConstraints({advanced:[{torch:enabled===true}]});if(turn!==sequence)throw new Error('CAMERA_CANCELLED');const actual=current.getSettings?.().torch;update({torchConfirmed:typeof actual==='boolean'?actual:null});return {confirmed:actual===enabled,active:typeof actual==='boolean'?actual:null};}
    finally{if(turn===sequence)torchBusy=false;}
  }
  async function capture(canvasFactory=()=>document.createElement('canvas')){
    if(state.phase!=='on'||!video||video.readyState<2||!video.videoWidth||!video.videoHeight)throw new Error('CAMERA_FRAME_UNAVAILABLE');
    const turn=sequence,canvas=canvasFactory();canvas.width=video.videoWidth;canvas.height=video.videoHeight;
    const context=canvas.getContext('2d');if(!context)throw new Error('CAMERA_FRAME_UNAVAILABLE');
    context.drawImage(video,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));
    canvas.width=canvas.height=0;if(turn!==sequence)throw new Error('CAMERA_CANCELLED');if(!blob)throw new Error('CAMERA_FRAME_UNAVAILABLE');return blob;
  }
  return Object.freeze({start,stop,setTorch,capture,getState:()=>({...state})});
}
