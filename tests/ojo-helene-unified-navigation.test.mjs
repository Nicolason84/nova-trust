import test from 'node:test';
import assert from 'node:assert/strict';
import {servicesUI,PERSONAL_CHAT_URL} from '../docs/helene/services-ui.mjs';

async function fixture(run){
 const saved=new Map(['document','window','location'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const listeners=new Map(),elements=new Map(),toasts=[];
 const document={addEventListener(type,listener){const list=listeners.get(type)||[];list.push(listener);listeners.set(type,list)},querySelector(selector){if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',disabled:false,setAttribute(){}});return elements.get(selector)}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:document});
 Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){}}});
 Object.defineProperty(globalThis,'location',{configurable:true,value:{hash:'#chat'}});
 const ui=servicesUI({render(){},esc:String,icon:()=>'',toast:t=>toasts.push(t),vault:{}});
 const dispatch=async(type,event)=>{for(const listener of listeners.get(type)||[])await listener(event)};
 const anchor=()=>{const attrs=new Map();return {attrs,setAttribute(k,v){attrs.set(k,v)},removeAttribute(k){attrs.delete(k)}}};
 const click=(link,extra={})=>({button:0,defaultPrevented:false,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,target:{closest:s=>s==='a[data-personal-chat]'?link:null},...extra});
 try{return await run({ui,dispatch,anchor,click,toasts})}finally{for(const [k,d]of saved){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
}

test('unified navigation: empty preparation follows the internal door in the same window',async()=>fixture(async({ui,dispatch,anchor,click,toasts})=>{
 assert.equal(PERSONAL_CHAT_URL,'./conversation-locale/index.html?v=cpu-r4-timeouts');
 const link=anchor();link.setAttribute('target','_blank');link.setAttribute('rel','noopener');
 await dispatch('click',click(link));assert.equal(link.attrs.has('target'),false);assert.equal(toasts.length,0);
 const door=ui.chat().match(/<a[^>]*data-personal-chat[^>]*>/)[0];assert.ok(door.includes(PERSONAL_CHAT_URL));assert.equal(door.includes('target='),false);
}));

test('unified navigation: an unsaved preparation stays in its original page',async()=>fixture(async({ui,dispatch,anchor,click,toasts})=>{
 await dispatch('input',{target:{id:'chat-message',value:'MY_UNSAVED_PREPARATION'}});
 const link=anchor();await dispatch('click',click(link));
 assert.equal(link.attrs.get('target'),'_blank');assert.equal(link.attrs.get('rel'),'noopener');
 assert.ok(ui.chat().includes('MY_UNSAVED_PREPARATION'));assert.match(toasts[0],/préparation reste ouverte/);
}));

test('unified navigation: pending originals are preserved without reading or transmitting their contents',async()=>fixture(async({ui,dispatch,anchor,click})=>{
 let reads=0;const file={name:'SYNTHETIC_ORIGINAL.txt',size:24,arrayBuffer(){reads++;throw Error('MUST_NOT_READ')}};
 await dispatch('change',{target:{id:'chat-files',files:[file],value:'fixture'}});
 const link=anchor();await dispatch('click',click(link));
 assert.equal(link.attrs.get('target'),'_blank');assert.equal(reads,0);assert.ok(ui.chat().includes(file.name));
}));

test('unified navigation: modified clicks and other links retain their existing behavior',async()=>fixture(async({dispatch,anchor,click,toasts})=>{
 await dispatch('input',{target:{id:'chat-message',value:'DO_NOT_DISCARD'}});
 const link=anchor();await dispatch('click',click(link,{ctrlKey:true}));assert.equal(link.attrs.size,0);
 await dispatch('click',click(link,{button:1}));assert.equal(link.attrs.size,0);
 await dispatch('click',click(link,{defaultPrevented:true}));assert.equal(link.attrs.size,0);
 await dispatch('click',{button:0,target:{closest:()=>null}});assert.equal(toasts.length,0);
}));
