/* KRIMI commerce SDK: the product accesses the domain through this boundary. */
(function(root){
  'use strict';
  const Core=root.KrimiCommerceCore;
  const id=()=>root.crypto?.randomUUID?.()||'local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  root.KrimiCommerceSDK={
    version:'A.0.1-candidate',
    id,
    empty:()=>Core.createState(),
    validate:state=>Core.validateState(state),
    execute:(state,type,payload,commandId)=>Core.apply(state,{id:commandId||id(),type,payload,at:new Date().toISOString()}),
    summary:state=>Core.metrics(state),
    estimate:op=>Core.estimate(op),
    blockers:(state,op,target)=>Core.blockers(state,op,target,new Date().toISOString()),
    money:value=>Core.money(value),
    format:value=>value===null||value===undefined?'Non renseigné':Core.format(value)
  };
})(globalThis);
