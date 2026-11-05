(function (root) {
  "use strict";
  var MAX_FILE = 8 * 1024 * 1024, MAX_PIXELS = 20000000;
  var MAX_HEADER = 262144, MAX_CHUNKS = 1024, MAX_URL = 650000;
  var MIME = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
  function allowedMime(mime) { return typeof mime === "string" && Object.prototype.hasOwnProperty.call(MIME,mime); }
  function fail(code, message) {
    var e = new Error(message || code); e.code = code; throw e;
  }
  function need(value, code, message) { if (!value) fail(code, message); }
  function u16(b, o) { return b[o] * 256 + b[o + 1]; }
  function le16(b, o) { return b[o] + b[o + 1] * 256; }
  function u32(b, o) { return b[o] * 16777216 + b[o+1] * 65536 + b[o+2] * 256 + b[o+3]; }
  function le32(b, o) { return b[o] + b[o+1] * 256 + b[o+2] * 65536 + b[o+3] * 16777216; }
  function le24(b, o) { return b[o] + b[o+1] * 256 + b[o+2] * 65536; }
  function text(b, o, n) { var s = ""; for (var i=0; i<n; i++) s += String.fromCharCode(b[o+i]); return s; }
  function available(b, o, n) {
    need(o >= 0 && n >= 0 && o+n <= b.length, "PHOTO_HEADER_TRUNCATED_OR_LIMIT",
      "Entête photo tronquée ou trop longue (256 Kio maximum).");
  }
  function dims(w, h, type) {
    need(Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0,
      "PHOTO_DIMENSIONS_INVALID", "Dimensions de photo invalides.");
    need(w * h <= MAX_PIXELS, "PHOTO_PIXELS_LIMIT", "Photo limitée à 20 mégapixels.");
    return { width: w, height: h, type: type };
  }
  function jpeg(b) {
    available(b, 0, 2);
    need(b[0] === 255 && b[1] === 216, "PHOTO_SIGNATURE_MISMATCH", "Signature JPEG incorrecte.");
    var p=2, info, components=0, count=0;
    while (p < b.length && ++count <= MAX_CHUNKS) {
      available(b,p,2); need(b[p++] === 255, "PHOTO_JPEG_MARKER_INVALID", "Entête JPEG invalide.");
      while (p < b.length && b[p] === 255) p++;
      available(b,p,1); var marker=b[p++];
      need(marker !== 0 && marker !== 216 && marker !== 217 && !(marker >= 208 && marker <= 215),
        "PHOTO_JPEG_HEADER_INVALID", "Entête JPEG incomplète ou invalide.");
      if (marker === 1) continue;
      available(b,p,2); var length=u16(b,p);
      need(length >= 2, "PHOTO_JPEG_SEGMENT_INVALID", "Segment JPEG invalide.");
      available(b,p,length);
      var d=p+2;
      if (marker === 226 && length >= 6 && text(b,d,4) === "MPF\0")
        fail("PHOTO_ANIMATION_UNSUPPORTED", "Les images multiples MPO ne sont pas acceptées.");
      var sof = marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204;
      if (sof) {
        need(marker === 192 || marker === 193 || marker === 194,
          "PHOTO_JPEG_VARIANT_UNSUPPORTED", "Variante JPEG non prise en charge.");
        need(!info && length >= 8 && b[d] === 8, "PHOTO_JPEG_SOF_INVALID", "Dimensions JPEG invalides.");
        components=b[d+5];
        need((components === 1 || components === 3 || components === 4) && length === 8+3*components,
          "PHOTO_JPEG_SOF_INVALID", "Entête JPEG de dimensions invalide.");
        info=dims(u16(b,d+3),u16(b,d+1),"jpeg");
      }
      if (marker === 218) {
        need(info && length >= 6, "PHOTO_JPEG_SCAN_INVALID", "Scan JPEG sans dimensions valides.");
        var scans=b[d];
        need(scans > 0 && scans <= components && length === 6+2*scans,
          "PHOTO_JPEG_SCAN_INVALID", "Entête de scan JPEG invalide.");
        return info;
      }
      p += length;
    }
    fail("PHOTO_HEADER_TRUNCATED_OR_LIMIT", "Entête JPEG incomplète ou trop longue.");
  }
  function png(b) {
    available(b,0,33);
    need(text(b,0,8) === "\x89PNG\r\n\x1a\n", "PHOTO_SIGNATURE_MISMATCH", "Signature PNG incorrecte.");
    need(u32(b,8) === 13 && text(b,12,4) === "IHDR", "PHOTO_PNG_IHDR_INVALID", "Entête PNG IHDR invalide.");
    var info=dims(u32(b,16),u32(b,20),"png"), depth=b[24], color=b[25];
    var depths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
    need(depths[color] && depths[color].indexOf(depth) >= 0 && b[26] === 0 && b[27] === 0
      && (b[28] === 0 || b[28] === 1), "PHOTO_PNG_VARIANT_UNSUPPORTED", "Variante PNG non prise en charge.");
    var p=33, count=0;
    while (p < b.length && ++count <= MAX_CHUNKS) {
      available(b,p,8); var n=u32(b,p), kind=text(b,p+4,4);
      need(n <= MAX_FILE && /^[A-Za-z]{4}$/.test(kind), "PHOTO_PNG_CHUNK_INVALID", "Bloc PNG invalide.");
      if (kind === "acTL" || kind === "fcTL" || kind === "fdAT")
        fail("PHOTO_ANIMATION_UNSUPPORTED", "Les PNG animés ne sont pas acceptés.");
      if (kind === "IDAT") return info;
      need(kind !== "IHDR" && kind !== "IEND", "PHOTO_PNG_DATA_MISSING", "Données PNG manquantes.");
      need(kind === "PLTE" || kind.charCodeAt(0) & 32, "PHOTO_FORMAT_UNSUPPORTED", "Bloc PNG critique inconnu.");
      available(b,p,12+n); p += 12+n;
    }
    fail("PHOTO_HEADER_TRUNCATED_OR_LIMIT", "Entête PNG incomplète ou trop longue.");
  }
  function webpFrame(b, p, n, kind) {
    if (kind === "VP8 ") {
      need(n >= 10, "PHOTO_WEBP_FRAME_INVALID", "Entête WebP VP8 invalide."); available(b,p,10);
      need(!(b[p] & 1) && text(b,p+3,3) === "\x9d\x01\x2a",
        "PHOTO_WEBP_FRAME_INVALID", "Image WebP VP8 invalide.");
      need(!(le16(b,p+6) & 49152) && !(le16(b,p+8) & 49152),
        "PHOTO_WEBP_VARIANT_UNSUPPORTED", "Mise à l’échelle VP8 non prise en charge.");
      return dims(le16(b,p+6)&16383,le16(b,p+8)&16383,"webp");
    }
    need(n >= 5, "PHOTO_WEBP_FRAME_INVALID", "Entête WebP VP8L invalide."); available(b,p,5);
    need(b[p] === 47, "PHOTO_WEBP_FRAME_INVALID", "Signature WebP VP8L incorrecte.");
    var bits=le32(b,p+1);
    need(Math.floor(bits / 536870912) === 0, "PHOTO_WEBP_VARIANT_UNSUPPORTED", "Version WebP VP8L inconnue.");
    return dims((bits & 16383)+1,((bits >>> 14)&16383)+1,"webp");
  }
  function webp(b) {
    available(b,0,20);
    need(text(b,0,4) === "RIFF" && text(b,8,4) === "WEBP",
      "PHOTO_SIGNATURE_MISMATCH", "Signature WebP incorrecte.");
    var end=le32(b,4)+8;
    need(end >= 20 && end <= MAX_FILE, "PHOTO_WEBP_RIFF_INVALID", "Taille de conteneur WebP invalide.");
    var p=12, extended, count=0;
    while (p+8 <= end && ++count <= MAX_CHUNKS) {
      available(b,p,8); var kind=text(b,p,4), n=le32(b,p+4), d=p+8;
      need(n <= MAX_FILE && d+n+(n&1) <= end, "PHOTO_WEBP_CHUNK_INVALID", "Bloc WebP invalide.");
      if (kind === "ANIM" || kind === "ANMF")
        fail("PHOTO_ANIMATION_UNSUPPORTED", "Les WebP animés ne sont pas acceptés.");
      if (kind === "VP8X") {
        need(p === 12 && !extended && n === 10, "PHOTO_WEBP_VP8X_INVALID", "Entête WebP étendue invalide.");
        available(b,d,10);
        if (b[d]&2) fail("PHOTO_ANIMATION_UNSUPPORTED", "Les WebP animés ne sont pas acceptés.");
        need(!(b[d]&193) && b[d+1] === 0 && b[d+2] === 0 && b[d+3] === 0,
          "PHOTO_WEBP_VP8X_INVALID", "Drapeaux WebP réservés non pris en charge.");
        extended=dims(le24(b,d+4)+1,le24(b,d+7)+1,"webp");
      } else if (kind === "VP8 " || kind === "VP8L") {
        var frame=webpFrame(b,d,n,kind);
        need(!extended || (frame.width === extended.width && frame.height === extended.height),
          "PHOTO_WEBP_DIMENSIONS_MISMATCH", "Dimensions WebP contradictoires.");
        return frame;
      } else {
        need(kind === "ICCP" || kind === "ALPH" || kind === "EXIF" || kind === "XMP ",
          "PHOTO_FORMAT_UNSUPPORTED", "Bloc WebP inconnu.");
      }
      available(b,p,8+n+(n&1)); p=d+n+(n&1);
    }
    fail("PHOTO_HEADER_TRUNCATED_OR_LIMIT", "Entête WebP incomplète ou trop longue.");
  }
  function inspectHeader(bytes, mime) {
    need(Object.prototype.toString.call(bytes) === "[object Uint8Array]",
      "PHOTO_BYTES_REQUIRED", "Octets de photo requis.");
    need(allowedMime(mime), "PHOTO_MIME_UNSUPPORTED", "Seuls JPEG, PNG et WebP statiques sont acceptés.");
    need(bytes.length > 0 && bytes.length <= MAX_FILE, "PHOTO_BYTES_LIMIT", "Photo vide ou supérieure à 8 Mio.");
    var b=bytes.subarray(0,Math.min(bytes.length,MAX_HEADER));
    return MIME[mime] === "jpeg" ? jpeg(b) : MIME[mime] === "png" ? png(b) : webp(b);
  }
  async function blobBytes(blob) {
    try {
      if (blob && typeof blob.arrayBuffer === "function") return new Uint8Array(await blob.arrayBuffer());
      need(typeof root.FileReader === "function", "PHOTO_FILE_READ_UNAVAILABLE", "Lecture de fichier indisponible.");
      return await new Promise(function (resolve,reject) {
        var r=new root.FileReader();
        r.onload=function () { resolve(new Uint8Array(r.result)); };
        r.onerror=function () { reject(new Error("PHOTO_FILE_READ_FAILED")); };
        r.readAsArrayBuffer(blob);
      });
    } catch (e) { if (e && e.code) throw e; fail("PHOTO_FILE_READ_FAILED", "Lecture de photo impossible."); }
  }
  async function part(file, head, start, count) {
    need(start >= 0 && count >= 0 && start+count <= file.size, "PHOTO_FILE_TRUNCATED", "Photo tronquée.");
    if (start+count <= head.length) return head.subarray(start,start+count);
    var bytes=await blobBytes(file.slice(start,start+count));
    need(bytes.length === count, "PHOTO_FILE_TRUNCATED", "Photo tronquée."); return bytes;
  }
  async function staticContainer(file, head, type) {
    if (type === "jpeg") {
      var tail=await part(file,head,file.size-2,2);
      need(tail[0] === 255 && tail[1] === 217, "PHOTO_JPEG_TRUNCATED", "Fin de JPEG manquante."); return;
    }
    var p=type === "png" ? 8 : 12, end=file.size, count=0, images=0;
    if (type === "webp") need(le32(head,4)+8 === end, "PHOTO_WEBP_SIZE_MISMATCH", "WebP tronqué ou taille incohérente.");
    while (p < end && ++count <= MAX_CHUNKS) {
      var h=await part(file,head,p,8), n=type === "png" ? u32(h,0) : le32(h,4);
      var kind=type === "png" ? text(h,4,4) : text(h,0,4);
      var next=p+8+n+(type === "png" ? 4 : n&1);
      need(n <= MAX_FILE && next <= end, "PHOTO_CONTAINER_TRUNCATED", "Bloc de photo tronqué.");
      if (type === "png") {
        need(/^[A-Za-z]{4}$/.test(kind), "PHOTO_PNG_CHUNK_INVALID", "Bloc PNG invalide.");
        if (kind === "acTL" || kind === "fcTL" || kind === "fdAT")
          fail("PHOTO_ANIMATION_UNSUPPORTED", "Les PNG animés ne sont pas acceptés.");
        need(kind === "IHDR" || kind === "PLTE" || kind === "IDAT" || kind === "IEND" || kind.charCodeAt(0)&32,
          "PHOTO_FORMAT_UNSUPPORTED", "Bloc PNG critique inconnu.");
        if (kind === "IHDR") need(p === 8 && n === 13, "PHOTO_PNG_IHDR_INVALID", "Bloc IHDR répété ou invalide.");
        if (kind === "IDAT") images++;
        if (kind === "IEND") {
          need(n === 0 && next === end && images > 0, "PHOTO_PNG_END_INVALID", "Fin PNG invalide."); return;
        }
      } else {
        if (kind === "ANIM" || kind === "ANMF")
          fail("PHOTO_ANIMATION_UNSUPPORTED", "Les WebP animés ne sont pas acceptés.");
        need(["VP8X","VP8 ","VP8L","ALPH","ICCP","EXIF","XMP "].indexOf(kind)>=0,
          "PHOTO_FORMAT_UNSUPPORTED", "Bloc WebP inconnu.");
        if (kind === "VP8 " || kind === "VP8L") images++;
        need(images <= 1, "PHOTO_ANIMATION_UNSUPPORTED", "Images WebP multiples refusées.");
        if (kind === "VP8X") {
          need(p === 12 && n === 10, "PHOTO_WEBP_VP8X_INVALID", "Bloc VP8X invalide.");
          var flags=await part(file,head,p+8,10);
          if (flags[0]&2) fail("PHOTO_ANIMATION_UNSUPPORTED", "Les WebP animés ne sont pas acceptés.");
        }
      }
      p=next;
    }
    need(type === "webp" && p === end && images === 1,
      "PHOTO_CONTAINER_INVALID_OR_LIMIT", "Conteneur incomplet ou trop de blocs (1024 maximum).");
  }
  async function imageFallback(file) {
    need(typeof root.Image === "function" && root.URL && typeof root.URL.createObjectURL === "function"
      && typeof root.URL.revokeObjectURL === "function", "PHOTO_DECODE_UNAVAILABLE", "Décodage photo indisponible.");
    var url;
    try { url=root.URL.createObjectURL(file); }
    catch (_) { fail("PHOTO_BLOB_URL_FAILED", "Ouverture locale de photo impossible."); }
    return await new Promise(function (resolve,reject) {
      var image, timer, done=false;
      function finish(error) {
        if (done) return; done=true;
        if (timer) root.clearTimeout(timer);
        if (image) { image.onload=null; image.onerror=null; }
        try { root.URL.revokeObjectURL(url); } catch (_) {}
        if (error) reject(error); else resolve(image);
      }
      try { image=new root.Image(); } catch (_) {
        var construction=new Error("Impossible de créer le décodeur photo."); construction.code="PHOTO_DECODE_FAILED"; finish(construction); return;
      }
      image.onload=function () { finish(); };
      image.onerror=function () { var e=new Error("Impossible de décoder cette photo."); e.code="PHOTO_DECODE_FAILED"; finish(e); };
      timer=root.setTimeout(function () {
        var e=new Error("Le décodage de la photo a expiré."); e.code="PHOTO_DECODE_TIMEOUT"; finish(e);
      },15000);
      try { image.src=url; } catch (_) {
        var e=new Error("Impossible de charger la photo."); e.code="PHOTO_DECODE_FAILED"; finish(e);
      }
    });
  }
  async function load(file) {
    if (file == null) return undefined;
    need(allowedMime(file.type), "PHOTO_MIME_UNSUPPORTED", "Seuls JPEG, PNG et WebP statiques sont acceptés.");
    need(Number.isInteger(file.size) && file.size > 0 && file.size <= MAX_FILE,
      "PHOTO_FILE_LIMIT", "Photo limitée à 8 Mio et non vide.");
    need(typeof file.slice === "function", "PHOTO_FILE_REQUIRED", "Fichier photo requis.");
    var head=await blobBytes(file.slice(0,Math.min(file.size,MAX_HEADER)));
    need(head.length === Math.min(file.size,MAX_HEADER), "PHOTO_FILE_TRUNCATED", "Photo tronquée.");
    var info=inspectHeader(head,file.type);
    await staticContainer(file,head,info.type);
    var image, bitmap=false, canvas;
    try {
      if (typeof root.createImageBitmap === "function") {
        try { image=await root.createImageBitmap(file); bitmap=true; } catch (_) {}
      }
      if (!image) image=await imageFallback(file);
      var w=image.width || image.naturalWidth, h=image.height || image.naturalHeight;
      dims(w,h,info.type);
      need((w === info.width && h === info.height) || (w === info.height && h === info.width),
        "PHOTO_DECODE_DIMENSIONS_MISMATCH", "Dimensions décodées différentes de l’entête.");
      need(root.document && typeof root.document.createElement === "function",
        "PHOTO_CANVAS_UNAVAILABLE", "Conversion photo indisponible.");
      var ratio=Math.min(1,900/Math.max(w,h)), ctx;
      try {
        canvas=root.document.createElement("canvas");
        need(canvas && typeof canvas.getContext === "function", "PHOTO_CANVAS_UNAVAILABLE", "Canevas photo indisponible.");
        canvas.width=Math.max(1,Math.round(w*ratio)); canvas.height=Math.max(1,Math.round(h*ratio));
        ctx=canvas.getContext("2d");
      } catch (e) { if (e && e.code) throw e; fail("PHOTO_CANVAS_CONTEXT_FAILED", "Création du canevas photo impossible."); }
      need(ctx, "PHOTO_CANVAS_CONTEXT_FAILED", "Impossible de créer le canevas photo.");
      try { ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(image,0,0,canvas.width,canvas.height); }
      catch (_) { fail("PHOTO_CANVAS_DRAW_FAILED", "Impossible de dessiner la photo."); }
      var result;
      try { result=canvas.toDataURL("image/jpeg",0.76); }
      catch (_) { fail("PHOTO_CANVAS_EXPORT_FAILED", "Impossible d’exporter la photo JPEG."); }
      need(typeof result === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(result),
        "PHOTO_JPEG_EXPORT_INVALID", "Le navigateur n’a pas produit un JPEG valide.");
      need(result.length <= MAX_URL, "PHOTO_DATA_URL_LIMIT", "Photo convertie trop volumineuse (650000 caractères maximum).");
      return result;
    } finally {
      if (bitmap && image && typeof image.close === "function") { try { image.close(); } catch (_) {} }
      if (canvas) { try { canvas.width=0; canvas.height=0; } catch (_) {} }
    }
  }
  root.KrimiCommercePhoto=Object.freeze({ load:load, inspectHeader:inspectHeader });
})(typeof window !== "undefined" ? window : globalThis);
