(function (root) {
  'use strict';
  const MODES = {dual2:'DUAL · 2 hilos', dual3:'DUAL · 3 hilos', mono2:'Monocolor · conexión a confirmar'};
  const REMOTES = {
    LWS1B:{zones:1, label:'LWS1B · grupo único, monocolor / DUAL', controllers:['LW36S','LW35S','LWC2']},
    LWS2B:{zones:1, label:'LWS2B · grupo único, monocolor / DUAL', controllers:['LW36S','LW35S','LWC2']},
    LWB1B:{zones:4, label:'LWB1B · 4 zonas, monocolor', controllers:['LW36S','LWC2'], modes:['mono2']},
    LWB2B:{zones:4, label:'LWB2B · 4 zonas, DUAL', controllers:['LW35S','LWC2'], modes:['dual2','dual3','mono2']},
    'L139.10D':{zones:1,label:'L139.10D · sistema L139 DUAL',controllers:['L139.6D'],modes:['dual2']},
    'L139.10':{zones:1,label:'L139.10 · sistema L139 monocolor',controllers:['L139.6'],modes:['mono2']}
  };
  const CONTROLLERS = {
    LWC2:{modes:['mono2','dual2'], wires:2, amps:10, volts:[12,24], page:182},
    LW35S:{modes:['dual3'], wires:3, amps:12, volts:[12,24], page:182},
    LW36S:{modes:['mono2'], wires:null, amps:12, volts:[12,24], page:182},
    'L139.6D':{modes:['dual2'],wires:2,amps:null,volts:[12,24],page:165,integratedBox:true},
    'L139.6':{modes:['mono2'],wires:null,amps:null,volts:[12,24],page:165,integratedBox:true}
  };
  const DEFAULT_CONTROLLER = {dual2:'LWC2',dual3:'LW35S',mono2:'LW36S'};
  const KEY='ojo_deivid_led_v1';
  const SOURCE='Catálogo LED SC Herrajes 2026';
  const finite = value => { const n=Number(String(value??'').replace(',','.')); return String(value??'').trim() && Number.isFinite(n) ? n : null; };
  const clone = x => JSON.parse(JSON.stringify(x));
  function fresh(){return {schema:'OJO_DEIVID_LED_V1',mode:'',zones:1,remote:'',controller:'',voltage:'',temperature:'3000',lightRef:'',supplyRef:'',boxRef:'',zoneWatts:['','','',''],project:''};}
  function clean(candidate){
    if(!candidate||candidate.schema!=='OJO_DEIVID_LED_V1')throw Error('Copia LED no compatible.');
    const out=fresh();
    for(const key of ['mode','remote','controller','voltage','temperature','lightRef','supplyRef','boxRef','project']){
      if(typeof candidate[key]!=='string'||candidate[key].length>(key==='project'?160:100))throw Error('Dato LED no válido.');
      out[key]=candidate[key];
    }
    if(candidate.mode&&!MODES[candidate.mode])throw Error('Tipo de luz no reconocido.');
    if(candidate.remote&&!REMOTES[candidate.remote])throw Error('Mando fuera de esta selección.');
    if(candidate.controller&&!CONTROLLERS[candidate.controller])throw Error('Controlador fuera de esta selección.');
    if(![1,2,3,4].includes(candidate.zones))throw Error('Indica de una a cuatro zonas.');
    if(!['','12','24'].includes(candidate.voltage))throw Error('Tensión no reconocida.');
    out.zones=candidate.zones;
    if(!Array.isArray(candidate.zoneWatts)||candidate.zoneWatts.length!==4)throw Error('Potencias no válidas.');
    out.zoneWatts=candidate.zoneWatts.map(v=>{if(typeof v!=='string'||v.length>20)throw Error('Potencia no válida.');return v;});
    return out;
  }
  function supplySpec(product){
    if(!product||!/^L139B?\./.test(product.reference)||!/TRANSFORMADOR/.test(product.description))return null;
    const exact=root.DeividLEDEvidence?.power_supplies?.find(p=>p.ref===product.reference);
    if(!exact)return null;
    return {volts:exact.voltage_v,watts:exact.rated_power_w,ampsPerOutput:exact.standard_output_current_a,special5A:!!exact.special_5a_output_with_L139_5A,page:exact.page,basis:'Catálogo, p. '+exact.page+'; conexión exacta por confirmar'};
  }
  function evaluate(input, products=[]){
    const cfg=clean(input),map=new Map(products.map(p=>[p.reference.toUpperCase(),p]));
    const errors=[],missing=[],notes=[],lines=[];
    const remote=REMOTES[cfg.remote],controllerRef=cfg.controller||(cfg.remote==='L139.10D'?'L139.6D':cfg.remote==='L139.10'?'L139.6':cfg.remote==='LWB2B'&&cfg.mode==='mono2'?'LWC2':DEFAULT_CONTROLLER[cfg.mode])||'',controller=CONTROLLERS[controllerRef];
    const volts=finite(cfg.voltage),loads=cfg.zoneWatts.slice(0,cfg.zones).map(finite);
    if(!cfg.mode)missing.push('Identificar si la luminaria es monocolor, DUAL de 2 hilos o DUAL de 3 hilos. 3000 K no resuelve esta elección.');
    if(!remote)missing.push('Elegir la referencia del mando.');
    if(remote&&cfg.zones>remote.zones)errors.push('Este mando controla '+remote.zones+' zona; el proyecto pide '+cfg.zones+' zonas independientes. Elige un mando de 4 zonas.');
    if(remote&&cfg.mode&&remote.modes&&!remote.modes.includes(cfg.mode))errors.push('El tipo de luz elegido no corresponde a la función de este mando.');
    if(controller&&cfg.mode&&!controller.modes.includes(cfg.mode))errors.push(controllerRef+' no corresponde a '+MODES[cfg.mode]+'.');
    if(remote&&controller&&!remote.controllers.includes(controllerRef))errors.push('La tabla del fabricante no documenta la pareja '+cfg.remote+' + '+controllerRef+'.');
    if(!volts)missing.push('Confirmar la tensión de la luminaria: 12 V o 24 V.');
    if(controller&&volts&&!controller.volts.includes(volts))errors.push('Tensión fuera del rango del controlador.');
    if(loads.some(v=>v===null))missing.push('Completar la potencia total de las luminarias de cada zona.');
    loads.forEach((w,i)=>{
      if(w!==null&&w<=0)errors.push('La potencia de la zona '+(i+1)+' debe ser mayor que cero.');
      if(w!==null&&w>0&&volts&&controller?.amps&&w/volts>controller.amps)errors.push('Zona '+(i+1)+': '+w+' W / '+volts+' V supera los '+controller.amps+' A indicados para '+controllerRef+'.');
    });
    const lightRef=cfg.lightRef.trim().toUpperCase(),light=map.get(lightRef),qualified=root.DeividLEDEvidence?.qualified_lights?.lights?.[lightRef];
    if(!cfg.lightRef.trim())missing.push('Identificar la referencia exacta de la luminaria y comprobar su ficha.');
    else if(!light)errors.push('La referencia de luminaria no aparece en este catálogo admitido.');
    else {
      if((/\b(?:TIRADOR|POMO)\b/i.test(light.description)||light.provenance?.some(p=>/TIRADORES/i.test(p.source||''))||/^\s*(?:MANDO|CONTROLADOR|TRANSFORMADOR|SENSOR|RECEPTOR|CAJA|CABLE|CONECTOR|ALARGADOR)\b/i.test(light.description))&&!qualified)errors.push(light.reference+' no está identificado como luminaria; selecciona la referencia de la fuente de luz.');
      if(qualified&&cfg.mode&&qualified.mode!==cfg.mode)errors.push(light.reference+' está documentada como '+MODES[qualified.mode]+' (p. '+qualified.pages.join(', ')+'), distinto del tipo elegido.');
      if(qualified&&volts&&!qualified.voltage_v.includes(volts))errors.push(light.reference+' está documentada para '+qualified.voltage_v.join(' / ')+' V, distinto de la tensión elegida.');
      if(qualified?.fixed_kelvin&&finite(cfg.temperature)&&qualified.fixed_kelvin!==finite(cfg.temperature))errors.push(light.reference+' tiene temperatura fija de '+qualified.fixed_kelvin+' K; no corresponde a '+cfg.temperature+' K.');
      if(!qualified)missing.push('La referencia '+light.reference+' existe en el catálogo, pero su tipo y cableado aún no están cualificados en este selector.');
      if(qualified?.note_es)notes.push(qualified.note_es);
      const explicitVoltage=light.description.match(/\b(12|24)\s*V\b/i);
      if(explicitVoltage&&volts&&Number(explicitVoltage[1])!==volts&&!qualified?.voltage_variant_must_be_confirmed)errors.push('La descripción de '+light.reference+' indica '+explicitVoltage[1]+' V, distinta de la tensión elegida.');
      if(qualified?.voltage_variant_must_be_confirmed)missing.push('Confirmar la variante de tensión de '+light.reference+' al pedido; la descripción de precio identifica '+qualified.imported_description_voltage_v+' V.');
      if(/\bDUAL\b/i.test(light.description)&&cfg.mode==='mono2')errors.push('La descripción de '+light.reference+' indica DUAL; revisa el tipo elegido.');
      notes.push('Luminaria '+light.reference+': '+light.description+'. El conector y el número de hilos se comprueban en la ficha exacta.');
    }
    const supply=map.get(cfg.supplyRef),spec=supplySpec(supply),loadComplete=loads.every(v=>v!==null&&v>0),totalWatts=loadComplete?loads.reduce((a,b)=>a+b,0):null;
    if(!cfg.supplyRef)missing.push('Elegir la alimentación según tensión, potencia total y conexión.');
    else if(!spec)errors.push('Alimentación fuera de la selección documental de esta versión.');
    else {
      if(volts&&spec.volts!==volts)errors.push('La alimentación '+cfg.supplyRef+' entrega '+spec.volts+' V; la luminaria indicada requiere '+volts+' V.');
      if(totalWatts!==null&&totalWatts>spec.watts)errors.push('Las luminarias suman '+totalWatts+' W y superan los '+spec.watts+' W nominales de '+cfg.supplyRef+'.');
      loads.forEach((w,i)=>{if(w!==null&&w>0&&volts&&w/volts>spec.ampsPerOutput)errors.push('Zona '+(i+1)+': '+w+' W / '+volts+' V supera los 3 A de una salida estándar de '+cfg.supplyRef+'.'+(spec.special5A?' Existe una salida específica de 5 A con cable L139.5A; requiere revisar el montaje y no se valida automáticamente.':''));});
      notes.push('Alimentación '+cfg.supplyRef+': '+spec.volts+' V / '+spec.watts+' W nominales. Confirmar carga admisible, conectores y condiciones del fabricante; no se aplica un margen inventado.');
      notes.push('Comprobación de potencia: un controlador por salida estándar de 3 A ('+(spec.volts*3)+' W a '+spec.volts+' V), según p. '+spec.page+'. No basta con la potencia total de la alimentación.');
    }
    if(cfg.boxRef==='L151.3D'&&cfg.mode&&cfg.mode!=='dual3')errors.push('L151.3D es una caja DUAL de 3 hilos; no corresponde al tipo de luz elegido.');
    if(cfg.boxRef==='L151.06T'&&cfg.mode==='dual3')errors.push('La caja L151.06T no está documentada aquí como distribuidor DUAL de 3 hilos.');
    if(!cfg.boxRef&&!controller?.integratedBox)missing.push('Determinar si hace falta una caja de distribución a partir del número y tipo de conexiones.');
    if(controller?.integratedBox){notes.push(controllerRef+' ya es caja de conexiones y controlador RF. No añadas un LWC2: el esquema L139 usa esta caja con su propio mando (pp. 165 y 198).');missing.push('Confirmar la carga admisible de la caja RF '+controllerRef+'.');}
    if(cfg.boxRef==='direct')notes.push('Sin caja añadida: el esquema conecta controlador y luminaria. Esta opción exige comprobar las conexiones del montaje real.');
    if(cfg.boxRef==='L151.3D')notes.push('L151.3D: caja de 3 conexiones DUAL de 3 hilos (p. 193). El número de cajas y su conexión al controlador quedan por confirmar.');
    if(cfg.boxRef==='L151.06T')notes.push('L151.06T: caja de 7 conexiones, 72 W en la tarifa (p. 193). No es un controlador RF; confirmar conexión, carga y si el montaje la necesita.');
    if(cfg.mode==='dual3'&&!cfg.boxRef)notes.push('Si necesitas repartir una salida DUAL de 3 hilos, el catálogo muestra L151.3D (3 conexiones, p. 193). No se añade por defecto y no crea zonas nuevas.');
    missing.push('Confirmar conectores, polaridad, límites por salida y esquema de cableado del montaje.');
    const pairing=!!(remote&&controller&&cfg.mode)&&!errors.length;
    if(pairing){
      lines.push({reference:cfg.remote,quantity:'1',role:'Mando',basis:'Compatibilidad documentada · p. '+(controller.integratedBox?'165':'183')});
      lines.push({reference:controllerRef,quantity:String(cfg.zones),role:controller.integratedBox?'Caja RF con controlador':'Controlador',basis:controller.integratedBox?'Control y distribución integrados · pp. 165, 198':'Uno por zona independiente · pp. 198–199'});
      if(spec)lines.push({reference:cfg.supplyRef,quantity:'1',role:'Alimentación seleccionada',basis:'Candidata; conexión y dimensionamiento pendientes de confirmación'});
    }
    if(remote&&cfg.zones<remote.zones)notes.push('Puedes usar '+cfg.zones+' de las '+remote.zones+' zonas del mando. No hace falta rellenar las zonas que no utilizas.');
    if(['LWS1B','LWS2B'].includes(cfg.remote))notes.push('LWS1B y LWS2B se usan aquí para un único grupo. El catálogo los denomina mono/dual; para seleccionar varias zonas por separado se utilizan los mandos zonificados.');
    if(cfg.mode==='mono2')notes.push('Con una luminaria monocolor de 3000 K puedes regular intensidad si la ficha lo permite; el mando no la convierte en DUAL.');
    if(cfg.mode==='mono2'&&cfg.remote==='LWB2B'&&controllerRef==='LWC2')notes.push(root.DeividLEDEvidence?.qualified_lights?.lwb2b_lwc2_mono_note_es||'La pareja LWB2B + LWC2 está documentada. Con luz monocolor no hay cambio de temperatura de color; confirmar regulación y conexión.');
    return {schema:'OJO_DEIVID_LED_RESULT_V1',status:errors.length?'INCOMPATIBLE':pairing?'DOCUMENTED_PAIRING_INSTALLATION_PENDING':'NEEDS_INFORMATION',pairingDocumented:pairing,installationValidated:false,controllerRef,errors,missing,notes,lines,totalWatts,sourcePages:controller?.integratedBox?[165,170,172,198]:[170,172,182,183,198,199],config:cfg};
  }
  function mount(container, options={}){
    if(!container)throw Error('Falta la vista LED.');
    const products=options.products||[],byRef=new Map(products.map(p=>[p.reference.toUpperCase(),p]));
    let state=fresh(),storageIssue='',corrupt=false,lastResult=null;
    try{const raw=root.localStorage.getItem(KEY);if(raw){try{state=clean(JSON.parse(raw));}catch(_){corrupt=true;storageIssue='Hay una copia LED anterior no legible. Se conserva intacta; puedes exportar el trabajo de esta pestaña.';}}}catch(_){storageIssue='No se puede guardar en este navegador. Exporta la selección antes de cerrar.';}
    const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
    const button=(text,fn,cls='btn secondary')=>{const n=el('button',cls,text);n.type='button';n.addEventListener('click',fn);return n;};
    const wrap=el('div','led-layout'),form=el('form','card led-form'),result=el('div','led-result');result.id='led-result';
    result.setAttribute('aria-live','polite');
    const fields={};
    function save(){if(corrupt)return;try{root.localStorage.setItem(KEY,JSON.stringify(clean(state)));storageIssue='';}catch(_){storageIssue='No se ha podido guardar. Exporta la selección antes de cerrar.';}status.textContent=storageIssue||'Selección guardada en este dispositivo.';}
    function field(label,key,choices,help){
      const row=el('div','led-field'),id='led-'+key,l=el('label',null,label);l.htmlFor=id;
      const input=el(choices?'select':'input');input.id=id;
      if(choices)choices.forEach(([value,text])=>{const o=el('option',null,text);o.value=value;input.append(o);});
      else {input.type='text';input.maxLength=key==='project'?160:100;}
      input.value=String(state[key]);fields[key]=input;
      input.addEventListener(choices?'change':'input',()=>{state[key]=key==='zones'?Number(input.value):input.value;save();if(key==='zones')renderWatts();if(key==='mode'||key==='voltage')renderSupplies();renderResult();});
      row.append(l,input);if(help)row.append(el('small','subtle',help));form.append(row);return input;
    }
    container.textContent='';
    const presets=el('div','led-presets');
    presets.append(button('Una zona · mando dual',()=>preset(1,'LWS1B')),button('Dos zonas · mando de cuatro',()=>preset(2,'LWB2B')));
    container.append(presets,wrap);wrap.append(form,result);
    form.append(el('div','eyebrow','1 · Describe el proyecto'),el('h3',null,'¿Qué necesitas controlar?'));
    field('Proyecto (opcional)','project',null,'Se queda en este dispositivo.');
    field('Zonas que quieres controlar por separado','zones',[[1,'1 zona'],[2,'2 zonas'],[3,'3 zonas'],[4,'4 zonas']]);
    field('Tipo de luminaria','mode',[['','Todavía por confirmar'],...Object.entries(MODES)],'DUAL de 2 hilos y DUAL de 3 hilos son sistemas distintos.');
    field('Tensión de la luminaria','voltage',[['','Por confirmar'],['12','12 V'],['24','24 V']]);
    field('Temperatura deseada (K)','temperature',null,'3000 K describe el color de la luz; no identifica el cableado ni el controlador.').inputMode='numeric';
    const light=field('Referencia de luminaria (mismo modelo en las zonas)','lightRef',null,'Busca la referencia exacta en Catálogo. Si cada zona tiene un modelo distinto, comprueba cada selección por separado.');light.autocapitalize='characters';
    form.append(el('div','rule'),el('div','eyebrow','2 · Elige el mando'));
    field('Mando','remote',[['','Seleccionar referencia'],...Object.entries(REMOTES).map(([k,v])=>[k,v.label])]);
    field('Controlador','controller',[['','Proponer según el tipo de luz'],...Object.entries(CONTROLLERS).map(([k,v])=>[k,k+' · '+v.modes.map(m=>MODES[m]).join(' / ')])]);
    form.append(el('div','rule'),el('div','eyebrow','3 · Alimentación y conexiones'));
    const wattsWrap=el('div','led-watts');form.append(wattsWrap);
    function renderWatts(){wattsWrap.textContent='';for(let i=0;i<state.zones;i++){const label=el('label',null,'Potencia total · zona '+(i+1)+' (W)'),input=el('input');input.type='text';input.inputMode='decimal';input.placeholder='Por confirmar';input.id='led-watts-'+i;label.htmlFor=input.id;input.value=state.zoneWatts[i];input.maxLength=20;input.addEventListener('input',()=>{state.zoneWatts[i]=input.value;save();renderResult();});const item=el('div','led-field');item.append(label,input);wattsWrap.append(item);}}
    field('Alimentación que quieres comprobar','supplyRef',[['','Todavía por elegir']],'Selección L139 / L139B. Se comprueba un controlador por salida estándar de 3 A; otros montajes necesitan revisión.');
    function renderSupplies(){const select=fields.supplyRef;select.textContent='';const blank=el('option',null,'Todavía por elegir');blank.value='';select.append(blank);products.filter(p=>supplySpec(p)).forEach(p=>{const spec=supplySpec(p),opt=el('option',null,p.reference+' · '+spec.volts+' V · '+spec.watts+' W');opt.value=p.reference;select.append(opt);});select.value=state.supplyRef;}
    field('Caja de conexiones / distribución','boxRef',[['','Por determinar'],['direct','Sin caja extra · revisar conexión directa'],['L151.3D','L151.3D · 3 conexiones DUAL, 3 hilos'],['L151.06T','L151.06T · 7 conexiones, conexión por confirmar']],'Una caja distribuye conexiones; no sustituye a un controlador. No se añade una caja automáticamente.');
    const submit=el('button','btn','Comprobar mi selección');submit.type='submit';form.append(submit);
    form.addEventListener('submit',e=>{e.preventDefault();renderResult();result.scrollIntoView({behavior:'smooth',block:'start'});});
    const status=el('p','subtle led-save-status',storageIssue||'Selección local.');container.append(status);
    function preset(zones,remote){state.zones=zones;state.remote=remote;state.mode='';state.controller='';state.voltage='';state.supplyRef='';state.boxRef='';state.zoneWatts=['','','',''];for(const key of Object.keys(fields))fields[key].value=String(state[key]);renderWatts();renderSupplies();save();renderResult();fields.mode.focus();}
    function sourceLink(page){const a=el('a','led-source-link','Ver catálogo · p. '+page);a.href='./r3_visual/assets/catalogo-led-2026-baja/page-'+String(page).padStart(4,'0')+'.jpg';a.target='_blank';a.rel='noopener';return a;}
    function listBlock(title,items,cls){if(!items.length)return;const section=el('section','led-facts '+(cls||''));section.append(el('h4',null,title));const ul=el('ul');items.forEach(t=>ul.append(el('li',null,t)));section.append(ul);result.append(section);}
    function renderResult(){
      const r=lastResult=evaluate(state,products);result.textContent='';
      const head=el('div','card led-verdict '+(r.errors.length?'led-invalid':r.pairingDocumented?'led-documented':''));
      head.append(el('div','eyebrow','Tu selección'),el('h3',null,r.errors.length?'Hay una incompatibilidad':r.pairingDocumented?'Mando y controlador documentados':'Empecemos por la luminaria'));
      head.append(el('p',null,r.pairingDocumented?'La pareja aparece en el catálogo. Completa la alimentación y las conexiones antes de cerrar la instalación.':'Elige el tipo de luz y el mando. Te mostraré las referencias y qué falta comprobar.'));
      if(r.controllerRef&&state.remote){const pair=el('div','led-pair');pair.append(el('strong',null,state.remote),el('span',null,'+'),el('strong',null,r.controllerRef));head.append(pair);}
      if(r.pairingDocumented)head.append(el('p','led-count','1 mando · '+state.zones+' controlador'+(state.zones>1?'es':'')+' · '+state.zones+' zona'+(state.zones>1?'s':'')+' independiente'+(state.zones>1?'s':'')),sourceLink(CONTROLLERS[r.controllerRef]?.integratedBox?165:183));
      result.append(head);
      listBlock('Corrige estos puntos',r.errors,'led-error-list');
      if(r.pairingDocumented){
        const material=el('section','card led-material');material.append(el('h3',null,'Lista para preparar el presupuesto'));
        for(const line of r.lines){const item=el('div','led-material-row');const info=el('div');info.append(el('strong',null,line.quantity+' × '+line.reference),el('p','small',byRef.get(line.reference)?.description||line.role),el('small','subtle',line.basis));item.append(info);if(options.onProduct)item.append(button('Ficha',()=>options.onProduct(line.reference),'text-button'));material.append(item);}
        material.append(el('p','subtle','La caja y las luminarias se añaden cuando estén identificadas y sus cantidades confirmadas. Los precios se revisan en el presupuesto.'));
        material.append(button('Pasar esta lista al presupuesto',()=>{if(options.onQuote)options.onQuote(r.lines.map(({reference,quantity})=>({reference,quantity})));},'btn'));
        result.append(material);
      }
      listBlock('Por confirmar en esta instalación',r.missing);
      listBlock('Lo que ya sabemos',r.notes);
      const evidence=el('details','card led-evidence'),summary=el('summary',null,'Consultar los esquemas del fabricante');evidence.append(summary,el('p','subtle',SOURCE+' · páginas 182–183 y 198–199. Las asociaciones documentadas se separan de la comprobación de una instalación completa.'));
      const links=el('div','led-source-links');r.sourcePages.forEach(p=>links.append(sourceLink(p)));links.append(sourceLink(193));evidence.append(links);result.append(evidence);
      const actions=el('div','actions');actions.append(button('Copiar consulta técnica',copySummary),button('Exportar selección',exportSelection));result.append(actions);
    }
    function summary(){const r=lastResult||evaluate(state,products);return ['Proyecto: '+(state.project||'por definir'),'Zonas: '+state.zones,'Luminaria: '+(state.lightRef||'por definir'),'Tipo: '+(MODES[state.mode]||'por confirmar'),'Tensión: '+(state.voltage?state.voltage+' V':'por confirmar'),'Color deseado: '+(state.temperature||'por confirmar')+' K','Mando: '+(state.remote||'por definir'),'Controlador: '+(r.controllerRef||'por definir'),'Alimentación: '+(state.supplyRef||'por definir'),'Caja: '+(state.boxRef||'por determinar'),'Potencias por zona: '+state.zoneWatts.slice(0,state.zones).map(w=>w?w+' W':'por confirmar').join(' / '),'Estado: '+(r.errors.length?'incompatibilidad':r.pairingDocumented?'pareja documentada, instalación pendiente':'faltan datos'),'Por revisar:',...r.errors.map(x=>'- '+x),...r.missing.map(x=>'- '+x),SOURCE+' pp. 182–183, 193, 198–199.'].join('\n');}
    async function copySummary(){try{await navigator.clipboard.writeText(summary());options.notify?.('Consulta técnica copiada.');}catch(_){const text=el('textarea','led-copy-fallback');text.value=summary();text.readOnly=true;result.append(text);text.select();options.notify?.('Selecciona y copia el texto de la consulta.');}}
    function exportSelection(){const blob=new Blob([JSON.stringify({selection:clean(state),result:lastResult},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Deivid-seleccion-LED-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
    renderWatts();renderSupplies();renderResult();
    return {getState:()=>clone(state),getResult:()=>clone(lastResult),setState:next=>{state=clean(next);for(const key of Object.keys(fields))fields[key].value=String(state[key]);renderWatts();renderSupplies();save();renderResult();},exportSelection};
  }
  const api={version:1,MODES,REMOTES,CONTROLLERS,fresh,clean,evaluate,supplySpec,mount};
  root.DeividLED=Object.freeze(api);
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
