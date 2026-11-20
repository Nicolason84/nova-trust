'use strict';
/* Bind each quick-unlock credential to one verified account and this origin. */
window.JaimeGoogleDevice = function(store,id) {
  const base=window.JaimeBrowserCredentials;
  if (!base) return null;
  const field='google.device.'+id, local=(op,k,v)=>store(op,field+'.'+k,v);
  return base(local,{
    validate(value){try{const m=JSON.parse(value);return m.v===1&&m.id===id&&/^[A-Za-z0-9_-]{43}$/.test(m.seed)&&value.length<230;}catch{return false;}},
    context:field
  });
};
