(function (root) {
  'use strict';

  // Domain-only functions. No network, storage, external data or SUPRA access.
  const MAX_CENTS = 100000000000;
  const MAX_RECORDS = 3000;
  const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  const CURRENCIES = ['EUR', 'GBP', 'CHF', 'USD'];
  const MODES = ['real', 'demo'];
  const STATUSES = {
    prospect: ['ACTIVE', 'PAUSED', 'WON', 'ARCHIVED'],
    opportunity: ['PROSPECT_IDENTIFIED','LOGISTICS_HYPOTHESIS','QUALIFICATION_PENDING','CONTACT_READY','CONTACTED','OFFER_PREPARATION','NEGOTIATION','IDENTIFICADA','POR_ANALIZAR','CONTACTO_PENDIENTE','CONTACTADA','EN_CONVERSACION','OFERTA_EN_PREPARACION','NEGOCIACION','GANADA','PERDIDA','OPEN', 'WON', 'LOST', 'ARCHIVED'],
    quote: ['PREPARED', 'SENT', 'ACCEPTED', 'COMPLETED', 'LOST'],
    evidence: ['CONFIRMED', 'TO_QUALIFY', 'PROSPECT', 'HYPOTHESIS']
  };
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function fail(message) { throw new Error(message); }
  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ': se necesita un objeto.');
    return value;
  }
  function choice(value, options, label) {
    if (typeof value !== 'string' || !options.includes(value)) fail(label + ': valor no válido.');
    return value;
  }
  function text(record, field, required, maxLength) {
    const value = record[field];
    if (value == null && !required) return '';
    if (typeof value !== 'string') fail(field + ': debe ser texto.');
    const result = value.trim();
    if (required && !result) fail(field + ': es obligatorio.');
    if (result.length > (maxLength || 2000)) fail(field + ': el texto es demasiado largo.');
    if (/[\u0000\u0008\u000b\u000c]/.test(result)) fail(field + ': contiene caracteres no admitidos.');
    return result;
  }
  function date(record, field) {
    const value = text(record, field, true, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2199-12-31') fail(field + ': fecha no válida.');
    const timestamp = Date.parse(value + 'T12:00:00Z');
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) fail(field + ': fecha no válida.');
    return value;
  }
  function cents(value, label) {
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS) fail((label || 'Importe') + ': se necesitan céntimos enteros entre 0 y 1.000.000.000,00.');
    return value;
  }
  function money(input) {
    if (typeof input !== 'string' && typeof input !== 'number') fail('Importe: introduce una cantidad.');
    if (typeof input === 'number' && !Number.isFinite(input)) fail('Importe: cantidad no válida.');
    const value = String(input).trim();
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) fail('Importe: utiliza una cantidad positiva o cero, con hasta dos decimales y sin separador de miles.');
    const parts = value.replace(',', '.').split('.');
    const result = Number(parts[0]) * 100 + Number((parts[1] || '').padEnd(2, '0'));
    return cents(result, 'Importe');
  }
  function margin(value) {
    object(value, 'Presupuesto');
    const purchase = cents(value.purchase, 'Compra');
    const sale = cents(value.sale, 'Venta');
    const extras = cents(value.extras, 'Gastos');
    const cost = purchase + extras;
    const gross = sale - cost;
    return {cost, gross, rate: sale === 0 ? null : gross / sale * 100, markup: cost === 0 ? null : gross / cost * 100};
  }
  function empty(mode) {
    return {product: 'ojo-freight', version: 1, mode: choice(mode || 'real', MODES, 'Espacio'), revision: 0, companies: [], suppliers: [], tenders: [], prospects: [], opportunities: [], quotes: [], actions: []};
  }
  function id() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
    return 'freight-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14);
  }
  // Optional conversation lives in the same validated workspace/export and
  // revision as business records. It is never an identity or authority source.
  function conversation(value) {
    object(value, 'Conversación');
    if (![7,30,90].includes(value.retentionDays)) fail('Conservación de conversación no válida.');
    if (!Array.isArray(value.messages) || value.messages.length > 80 || value.messages.length % 2) fail('Conversación: máximo 40 intercambios completos.');
    const ids = new Set();
    const json = (v, depth=0) => {
      if (depth > 8) fail('Resultado de conversación demasiado complejo.');
      if (v === null || typeof v === 'boolean') return v;
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string' && v.length <= 24000) return text({v},'v',false,24000);
      if (Array.isArray(v) && v.length <= 100) return v.map(x=>json(x,depth+1));
      if (v && typeof v === 'object' && Object.keys(v).length <= 40) {
        const result = {};
        for (const [key,item] of Object.entries(v)) {
          if (!/^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(key) || ['constructor','prototype','__proto__'].includes(key)) fail('Campo de conversación no válido.');
          result[key] = json(item,depth+1);
        }
        return result;
      }
      fail('Dato de conversación no válido.');
    };
    const messages = value.messages.map((m,index) => {
      object(m,'Mensaje');
      const messageId=text(m,'id',true,128);
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(messageId)||ids.has(messageId)) fail('Mensaje repetido o identificador no válido.');
      ids.add(messageId);
      if(m.role!==(index%2?'assistant':'user')) fail('La conversación necesita pares usuario/asistente.');
      const createdAt=text(m,'createdAt',true,24), stamp=Date.parse(createdAt);
      if(!Number.isFinite(stamp)||new Date(stamp).toISOString()!==createdAt||stamp>Date.now()+300000) fail('Fecha de mensaje no válida.');
      const result={id:messageId,role:m.role,text:text(m,'text',true,m.role==='user'?12000:24000),createdAt};
      if(m.result!=null){
        if(m.role!=='assistant')fail('Un mensaje de usuario no contiene resultados ejecutables.');
        const snapshot=json(object(m.result,'Resultado'));
        if(!Array.isArray(snapshot.actions)||snapshot.actions.length>30||!Array.isArray(snapshot.items)||snapshot.items.length>30)fail('Resultado de conversación no válido.');
        for(const a of snapshot.actions)if(!a||!['company','quote','tender','navigate','opportunity','followup'].includes(a.type))fail('Acción de conversación no permitida.');
        result.result=snapshot;
      }
      return result;
    });
    const result={retentionDays:value.retentionDays,messages};
    if(JSON.stringify(result).length>512000)fail('La conversación supera 512 kB. Exporta y empieza otra conversación.');
    return result;
  }
  function pruneConversation(value, now=Date.now()) {
    const checked=conversation(value), cutoff=now-checked.retentionDays*86400000, messages=[];
    for(let i=0;i<checked.messages.length;i+=2)if(Date.parse(checked.messages[i].createdAt)>=cutoff)messages.push(...checked.messages.slice(i,i+2));
    return {...checked,messages};
  }
  function validate(value) {
    const input = object(value, 'Archivo');
    if (input.product !== 'ojo-freight' || input.version !== 1) fail('Archivo de otro producto o versión incompatible.');
    const result = empty(choice(input.mode, MODES, 'Espacio'));
    if (!Number.isSafeInteger(input.revision) || input.revision < 0) fail('Revisión no válida.');
    result.revision = input.revision;
    const allIds = new Set();
    const recordId = record => {
      const value = text(record, 'id', true, 128);
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value) || allIds.has(value)) fail('Identificador no válido o repetido: ' + value);
      allIds.add(value);
      return value;
    };
    const list = (name, normalize) => {
      if (!Array.isArray(input[name]) || input[name].length > MAX_RECORDS) fail(name + ': lista no válida o demasiado grande (máximo 3.000).');
      return input[name].map(source => normalize(object(source, name)));
    };
    const safeURL = (value,label) => {let url;try{url=new URL(value);}catch(_){fail(label+': URL no válida.');}if(!['https:','http:'].includes(url.protocol)||url.username||url.password)fail(label+': URL no permitida.');return value;};
    if(input.companies!=null){
      result.companies=list('companies',r=>{
        for(const [field,expected] of Object.entries({relationshipStatus:'UNCONTRACTED',commercialMandate:'NONE',partnership:'UNPROVEN',representationRights:'NONE',opportunityEvidence:'HYPOTHESIS'}))if(r[field]!=null&&r[field]!==expected)fail('No se admite una representación o acuerdo no acreditado.');
        const texts=(field)=>{if(!Array.isArray(r[field])||r[field].length>50)fail('Lista empresarial no válida: '+field);return r[field].map(v=>text({value:v},'value',true,2000));};
        if(!Array.isArray(r.sources)||!r.sources.length||r.sources.length>20)fail('La empresa necesita al menos una fuente pública.');
        return {id:recordId(r),name:text(r,'name',true,160),country:choice(r.country,['ES','FR','OTHER'],'País'),city:text(r,'city',false,300),activity:text(r,'activity',true,1000),products:texts('products'),markets:texts('markets'),website:safeURL(text(r,'website',true,2000),'Sitio oficial'),contactChannel:text(r,'contactChannel',false,1000),sources:r.sources.map(s=>{object(s,'Fuente');return {url:safeURL(text(s,'url',true,2000),'Fuente'),title:text(s,'title',true,300),verifiedAt:date(s,'verifiedAt')};}),verifiedFacts:texts('verifiedFacts'),logisticsHypotheses:texts('logisticsHypotheses'),verification:'USER_DECLARED',dataScope:'USER_PROVIDED_PUBLIC_SOURCES',logisticsNeeds:'HYPOTHESIS_ONLY',relationshipStatus:'UNCONTRACTED',commercialMandate:'NONE',partnership:'UNPROVEN',representationRights:'NONE',opportunityEvidence:'HYPOTHESIS'};
      });
    }
    if(input.suppliers!=null || input.tenders!=null){
      const T=root.FreightTransport || (typeof require==='function'?require('./transport.js'):null);
      if(!T)fail('El módulo de transporte no está disponible.');
      if(input.suppliers!=null)result.suppliers=list('suppliers',r=>({...T.validateSupplier(r),id:recordId(r)}));
      if(input.tenders!=null)result.tenders=list('tenders',r=>({...T.validateTender(r),id:recordId(r)}));
    }
    result.prospects = list('prospects', r => ({
      id: recordId(r), name: text(r, 'name', true, 160), sector: text(r, 'sector', false, 200),
      routes: text(r, 'routes', false, 1000), contact: text(r, 'contact', false, 300),
      status: choice(r.status, STATUSES.prospect, 'Estado del contacto'), notes: text(r, 'notes', false, 4000), companyId:text(r,'companyId',false,128)
    }));
    result.opportunities = list('opportunities', r => {
      const record = {
        id: recordId(r), origin: text(r, 'origin', true, 200), destination: text(r, 'destination', true, 200),
        cargo: text(r, 'cargo', false, 300), vehicle: text(r, 'vehicle', false, 200), date: date(r, 'date'),
        prospectId: text(r, 'prospectId', false, 128), source: text(r, 'source', false, 2000),
        evidence: choice(r.evidence, STATUSES.evidence, 'Nivel de evidencia'),
        tenderId:text(r,'tenderId',false,128), status: choice(r.status, STATUSES.opportunity, 'Estado de la oportunidad'), nextAction: text(r, 'nextAction', false, 2000), companyId:text(r,'companyId',false,128)
      };
      if (record.evidence === 'CONFIRMED' && !record.source) fail('Una oportunidad confirmada necesita una fuente.');
      return record;
    });
    result.quotes = list('quotes', r => {
      if (own(r, 'finalConfirmed') && typeof r.finalConfirmed !== 'boolean') fail('La confirmación de importes finales debe ser verdadera o falsa.');
      const optionalNumber=(field,max,integer=false)=>{const n=r[field];if(n==null||n==='')return null;if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>max||(integer&&!Number.isSafeInteger(n))||Math.abs(Math.round(n*100)-n*100)>0.00001)fail(field+': cantidad no válida (máximo dos decimales).');return n;};
      const record = {
        id: recordId(r), origin: text(r, 'origin', true, 200), destination: text(r, 'destination', true, 200),
        prospectId: text(r, 'prospectId', false, 128), opportunityId: text(r, 'opportunityId', false, 128),
        carrier: text(r, 'carrier', false, 200), transportType:text(r,'transportType',false,100), supplierId:text(r,'supplierId',false,128),tenderId:text(r,'tenderId',false,128), purchase: cents(r.purchase, 'Compra'), sale: cents(r.sale, 'Venta'),
        extras: cents(r.extras, 'Gastos'), currency: choice(r.currency, CURRENCIES, 'Divisa'), date: date(r, 'date'),
        status: choice(r.status, STATUSES.quote, 'Estado del presupuesto'), finalConfirmed: r.finalConfirmed === true,
        notes: text(r, 'notes', false, 4000),cargo:text(r,'cargo',false,300),weight:optionalNumber('weight',1000000000),pallets:optionalNumber('pallets',1000000,true),distance:optionalNumber('distance',1000000),priceEvidence:r.priceEvidence==null?'ESTIMATE':choice(r.priceEvidence,['ESTIMATE','CONFIRMED'],'Verificación del precio'),priceSource:text(r,'priceSource',false,2000)
      };
      if(record.priceEvidence==='CONFIRMED'&&!record.priceSource)fail('Un precio confirmado necesita una fuente.');
      if (record.status === 'COMPLETED' && !record.finalConfirmed) fail('Confirma los importes finales antes de registrar una operación realizada.');
      return record;
    });
    result.actions = list('actions', r => {
      if (typeof r.done !== 'boolean') fail('El estado de una acción debe ser verdadero o falso.');
      return {
        id: recordId(r), prospectId: text(r, 'prospectId', false, 128), opportunityId: text(r, 'opportunityId', false, 128),
        text: text(r, 'text', true, 2000), date: date(r, 'date'), done: r.done, notes: text(r, 'notes', false, 4000)
      };
    });
    const prospects = new Set(result.prospects.map(r => r.id));
    const suppliers = new Set(result.suppliers.map(r=>r.id)), tenders=new Set(result.tenders.map(r=>r.id));
    for(const r of [...result.quotes,...result.opportunities])if(r.tenderId&&!tenders.has(r.tenderId))fail('La referencia al tender no existe.');
    for(const r of result.quotes)if(r.supplierId&&!suppliers.has(r.supplierId))fail('La referencia al proveedor no existe.');
    const companies = new Set(result.companies.map(r=>r.id));
    const opportunities = new Map(result.opportunities.map(r => [r.id, r]));
    for (const record of [...result.opportunities, ...result.quotes, ...result.actions]) {
      if (record.prospectId && !prospects.has(record.prospectId)) fail('La referencia a un contacto no existe.');
      if (record.opportunityId) {
        const opportunity = opportunities.get(record.opportunityId);
        if (!opportunity) fail('La referencia a una oportunidad no existe.');
        if (record.prospectId && opportunity.prospectId && record.prospectId !== opportunity.prospectId) fail('El contacto no coincide con el de la oportunidad.');
        if (record.tenderId && opportunity.tenderId && record.tenderId !== opportunity.tenderId) fail('La solicitud del presupuesto no coincide con la de la oportunidad. Revisa su origen antes de guardar.');
      }
    }
    for(const record of [...result.prospects,...result.opportunities])if(record.companyId&&!companies.has(record.companyId))fail('La referencia a una empresa no existe.');
    for(const o of result.opportunities){const p=result.prospects.find(p=>p.id===o.prospectId);if(p&&p.companyId&&o.companyId&&p.companyId!==o.companyId)fail('La empresa de la oportunidad no coincide con la del prospecto.');}
    if(input.conversation!=null)result.conversation=conversation(input.conversation);
    return result;
  }
  function parseImport(textValue, mode) {
    if (typeof textValue !== 'string') fail('El archivo importado debe ser texto JSON.');
    const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(textValue).length : unescape(encodeURIComponent(textValue)).length;
    if (bytes > MAX_IMPORT_BYTES) fail('El archivo supera el límite de 2 MB.');
    let parsed;
    try { parsed = JSON.parse(textValue); } catch (_) { fail('El archivo no contiene JSON válido.'); }
    const result = validate(parsed);
    if (result.mode !== choice(mode, MODES, 'Espacio')) fail('El archivo pertenece a otro espacio. Cambia entre demostración y datos reales antes de importarlo.');
    return result;
  }
  function csv(data) {
    const checked = validate(data);
    const headers = ['tipo', 'id', 'espacio', 'nombre_o_accion', 'origen', 'destino', 'fecha', 'estado', 'evidencia', 'fuente', 'contacto_id', 'oportunidad_id', 'compra', 'venta', 'gastos', 'coste_total', 'margen', 'tasa_sobre_venta_pct', 'tasa_majoracion_pct', 'divisa', 'sector', 'rutas', 'contacto', 'mercancia', 'peso_kg','palets','distancia_km','precio_verificacion','precio_fuente','sitio_oficial','datos_empresa_json','datos_transporte_json','tipo_transporte','proveedor_id','tender_id','vehiculo', 'transportista', 'proxima_accion', 'notas', 'importes_finales_confirmados'];
    const rows = [];
    const append = (type, record, extra) => {
      const base = {tipo: type, id: record.id, espacio: checked.mode === 'demo' ? 'DEMO_FICTICIA' : 'REAL', estado: record.status || (record.done ? 'REALIZADA' : 'PENDIENTE'), origen: record.origin || '', destino: record.destination || '', fecha: record.date || '', contacto_id: record.prospectId || '', oportunidad_id: record.opportunityId || '', notas: record.notes || ''};
      rows.push(Object.assign(base, extra));
    };
    for (const record of checked.prospects) append('CONTACTO', record, {nombre_o_accion: record.name, sector: record.sector, rutas: record.routes, contacto: record.contact});
    for (const record of checked.opportunities) append('OPORTUNIDAD', record, {evidencia: record.evidence, fuente: record.source,tender_id:record.tenderId, mercancia: record.cargo, vehiculo: record.vehicle, proxima_accion: record.nextAction});
    const decimal = amount => (amount / 100).toFixed(2);
    for (const record of checked.quotes) {
      const calculated = margin(record);
      append('PRESUPUESTO', record, {compra: decimal(record.purchase), venta: decimal(record.sale), gastos: decimal(record.extras), coste_total: decimal(calculated.cost), margen: decimal(calculated.gross), tasa_sobre_venta_pct: calculated.rate == null ? '' : calculated.rate.toFixed(2),tasa_majoracion_pct:calculated.markup==null?'':calculated.markup.toFixed(2), divisa: record.currency, mercancia:record.cargo,peso_kg:record.weight,palets:record.pallets,distancia_km:record.distance,precio_verificacion:record.priceEvidence,precio_fuente:record.priceSource,transportista: record.carrier,tipo_transporte:record.transportType,proveedor_id:record.supplierId,tender_id:record.tenderId, importes_finales_confirmados: record.finalConfirmed ? 'SI' : 'NO'});
    }
    for (const record of checked.actions) append('ACCION', record, {nombre_o_accion: record.text});
    for(const record of checked.companies)append('EMPRESA',record,{nombre_o_accion:record.name,sector:record.activity,sitio_oficial:record.website,datos_empresa_json:JSON.stringify(record)});
    for(const r of checked.suppliers)append('PROVEEDOR',r,{nombre_o_accion:r.name,datos_transporte_json:JSON.stringify(r)});
    for(const r of checked.tenders)append('TENDER',r,{nombre_o_accion:r.title,datos_transporte_json:JSON.stringify(r)});
    const cell = value => {
      let result = value == null ? '' : String(value);
      // Prefix dangerous spreadsheet formulas even when preceded by whitespace.
      if (/^[\s\uFEFF]*[=+\-@]/.test(result) || /^[\t\r\n]/.test(result)) result = "'" + result;
      return '"' + result.replace(/"/g, '""') + '"';
    };
    return '\uFEFF' + [headers.map(cell).join(','), ...rows.map(row => headers.map(key => cell(row[key])).join(','))].join('\r\n') + '\r\n';
  }
  function summary(data) {
    const checked = validate(data);
    const result = {
      quotesPrepared: checked.quotes.length,
      openOpportunities: checked.opportunities.filter(r => !['WON','GANADA','LOST','PERDIDA','ARCHIVED'].includes(r.status)).length,
      activeProspects: checked.prospects.filter(r => r.status === 'ACTIVE').length,
      pendingActions: checked.actions.filter(r => !r.done).length,
      estimated: {}, actual: {}
    };
    for (const record of checked.quotes) {
      if (record.status === 'LOST') continue;
      const target = record.status === 'COMPLETED' ? result.actual : result.estimated;
      const total = target[record.currency] || (target[record.currency] = {count: 0, cost: 0, gross: 0, sale: 0, rate: null});
      const calculated = margin(record);
      total.count++;
      total.cost += calculated.cost;
      total.gross += calculated.gross;
      total.sale += record.sale;
      total.rate = total.sale === 0 ? null : total.gross / total.sale * 100;
    }
    return result;
  }
  function demo() {
    const result = empty('demo');
    result.prospects = [
      ['demo-p1', 'DEMO · Exportaciones Centro', 'Alimentación', 'Madrid → Lyon'],
      ['demo-p2', 'DEMO · Embalajes del Norte', 'Embalaje', 'Bilbao → Burdeos'],
      ['demo-p3', 'DEMO · Industria Mediterránea', 'Industria', 'Valencia → Toulouse'],
      ['demo-p4', 'DEMO · Distribución Atlántica', 'Distribución', 'Nantes → Valladolid'],
      ['demo-p5', 'DEMO · Componentes Europa', 'Automoción', 'Zaragoza → Lille']
    ].map((r, index) => ({id: r[0], name: r[1], sector: r[2], routes: r[3], contact: 'Contacto ficticio — no contactar', status: index === 4 ? 'PAUSED' : 'ACTIVE', notes: 'Demostración ficticia. No representa una empresa ni una oferta real.'}));
    result.opportunities = [
      {id: 'demo-o1', origin: 'Madrid', destination: 'Lyon', cargo: 'DEMO · Palés de alimentación seca', vehicle: 'Lona 13,6 m', date: '2026-10-28', prospectId: 'demo-p1', source: 'Ejercicio de demostración ficticio', evidence: 'HYPOTHESIS', status: 'OPEN', nextAction: 'Verificar fecha, peso, palés y precio objetivo con el prospecto.'},
      {id: 'demo-o2', origin: 'Bilbao', destination: 'Burdeos', cargo: 'DEMO · Embalajes', vehicle: 'Lona 13,6 m', date: '2026-10-22', prospectId: 'demo-p2', source: 'Ejercicio ficticio para probar el seguimiento', evidence: 'PROSPECT', status: 'WON', nextAction: 'Registrar el resultado de la operación ficticia.'}
    ];
    result.quotes = [
      {id: 'demo-q1', origin: 'Madrid', destination: 'Lyon', prospectId: 'demo-p1', opportunityId: 'demo-o1', carrier: 'DEMO · Transportista ficticio', purchase: 80000, sale: 100000, extras: 5000, currency: 'EUR', date: '2026-10-23', status: 'PREPARED', finalConfirmed: false, notes: 'Ejemplo ficticio: coste 850,00 €, margen 150,00 €, 15 % sobre venta.'},
      {id: 'demo-q2', origin: 'Bilbao', destination: 'Burdeos', prospectId: 'demo-p2', opportunityId: 'demo-o2', carrier: 'DEMO · Operador ficticio', purchase: 45000, sale: 60000, extras: 2000, currency: 'EUR', date: '2026-10-22', status: 'COMPLETED', finalConfirmed: true, notes: 'Resultado de demostración ficticio. No es una operación real.'}
    ];
    result.actions = [
      {id: 'demo-a1', prospectId: 'demo-p1', opportunityId: 'demo-o1', text: 'DEMO · Confirmar las condiciones de carga', date: '2026-10-26', done: false, notes: 'Preparar una llamada manual; ningún mensaje se envía desde la aplicación.'},
      {id: 'demo-a2', prospectId: 'demo-p2', opportunityId: 'demo-o2', text: 'DEMO · Intercambio comercial registrado', date: '2026-10-22', done: true, notes: 'Historial ficticio de conversación para verificar el seguimiento.'}
    ];
    const T=root.FreightTransport || (typeof require==='function'?require('./transport.js'):null);
    if(T?.samples){const samples=T.samples();result.suppliers=samples.suppliers;result.tenders=samples.tenders;}
    return validate(result);
  }
  const api = {empty, money, margin, validate, parseImport, csv, summary, demo, id, conversation, pruneConversation, MAX_IMPORT_BYTES, MAX_CENTS};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FreightCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
