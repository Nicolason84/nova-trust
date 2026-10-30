// docs/helene/services.mjs
var SERVICES = Object.freeze([
  { id: "agenda", name: "Agenda et moments \xE0 deux", icon: "calendar", available: "Agenda local et pr\xE9paration de partage", pending: "Agenda commun et alertes sur les deux t\xE9l\xE9phones", steps: ["Pr\xE9ciser le jour, l\u2019heure et le rappel souhait\xE9.", "Choisir ce qui est personnel et ce qui concerne Nicolas.", "Raccorder l\u2019agenda et v\xE9rifier les alertes avant de les consid\xE9rer actives."], route: "agenda" },
  { id: "achats", name: "Achats \xB7 tous les articles", icon: "search", available: "Liste de besoins et recherche de produits choisie", pending: "Comparaison assist\xE9e des offres actuelles et suivi des commandes", steps: ["D\xE9crire l\u2019article, son usage, le budget et les crit\xE8res.", "Comparer prix total, livraison, retours et source dat\xE9e.", "Valider l\u2019article, le vendeur et le montant avant tout achat."], route: "services" },
  { id: "mails", name: "Mes mails", icon: "mail", available: "Pr\xE9parer un brouillon et ouvrir sa messagerie", pending: "Lecture, classement et suivi du propre compte d\u2019H\xE9l\xE8ne", steps: ["Choisir le compte et les messages concern\xE9s.", "Pr\xE9parer une r\xE9ponse que tu peux relire et modifier.", "Confirmer le destinataire et le texte avant l\u2019envoi."], route: "services" },
  { id: "contrats", name: "Contrats et abonnements", icon: "doc", available: "Conserver les originaux dans le coffre et noter une \xE9ch\xE9ance", pending: "Lecture assist\xE9e, comparaison et suivi des demandes", steps: ["Conserver le contrat original dans ton coffre.", "Rep\xE9rer avec une source les \xE9ch\xE9ances, montants et conditions.", "Relire toute demande de modification ou de r\xE9siliation avant son envoi."], route: "coffre" },
  { id: "assurances", name: "Mes assurances", icon: "lock", available: "Classer mes documents et pr\xE9parer mes questions", pending: "Analyse des garanties et suivi avec l\u2019assureur choisi", steps: ["Choisir le contrat, l\u2019attestation et la question.", "Distinguer ce que le document dit et ce qui doit \xEAtre confirm\xE9.", "Valider tout changement, d\xE9claration ou envoi de pi\xE8ce."], route: "coffre" },
  { id: "impots", name: "Imp\xF4ts et d\xE9marches", icon: "folder", available: "Documents dans le coffre et acc\xE8s au portail officiel", pending: "Assistance sur les pi\xE8ces choisies et les \xE9ch\xE9ances v\xE9rifi\xE9es", steps: ["Garder les avis et documents utiles dans ton coffre.", "V\xE9rifier les dates et les informations sur le service officiel.", "Relire toute d\xE9claration ou demande avant transmission."], route: "coffre" },
  { id: "banque", name: "Comptes et budget", icon: "wallet", available: "Budget saisi par toi et documents dans le coffre", pending: "Connexion bancaire personnelle avec le fournisseur autoris\xE9", steps: ["Choisir ce que tu souhaites suivre et les comptes concern\xE9s.", "Conserver les relev\xE9s dans ton coffre et dater les montants.", "V\xE9rifier s\xE9par\xE9ment toute connexion ou op\xE9ration financi\xE8re."], route: "coffre" },
  { id: "sante", name: "M\xE9decins et pharmacie de garde", icon: "health", available: "Fiches de m\xE9decins, documents priv\xE9s et annuaire de garde", pending: "Recherche assist\xE9e selon le lieu et l\u2019heure que tu choisis", steps: ["Garder les coordonn\xE9es et originaux m\xE9dicaux dans ton coffre.", "Pour une pharmacie de garde, choisir le lieu et l\u2019heure de recherche.", "V\xE9rifier l\u2019information aupr\xE8s du service de garde avant le d\xE9placement."], route: "coffre" },
  { id: "quotidien", name: "Le quotidien et mes id\xE9es", icon: "note", available: "Notes, originaux, phrase du jour et questions", pending: "Suggestions personnelles de CAnnoNico apr\xE8s son raccord", steps: ["Poser tes mots ou un original sans devoir le ranger d\u2019abord.", "Choisir une proposition utile et un prochain petit pas.", "Garder la main sur ce qui est conserv\xE9 et partag\xE9."], route: "elements" }
]);
function serviceById(id) {
  return SERVICES.find((s) => s.id === id) || SERVICES.at(-1);
}
function chooseService(text, chosen = "auto") {
  if (chosen !== "auto") return serviceById(chosen);
  const t = String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const patterns = [["sante", /pharmaci|medecin|ordonnance|sante/], ["impots", /impot|fiscal|declarat/], ["assurances", /assuran|mutuelle/], ["banque", /banqu|compte bancaire|virement|budget|releve/], ["mails", /mail|courriel|messagerie/], ["contrats", /contrat|abonnement|resili/], ["achats", /achat|acheter|article|commande|comparer|prix/], ["agenda", /agenda|rendez-vous|calendrier|rappel|notific/]];
  return serviceById(patterns.find(([, p]) => p.test(t))?.[0] || "quotidien");
}
async function universalRequest(text, originals = [], module = "auto") {
  if (typeof text !== "string" || text.length > 2e4 || !text.trim() && !originals.length) throw Error("Ajoute quelques mots ou un original.");
  if (!Array.isArray(originals) || originals.length > 6 || originals.reduce((n, f) => n + f.size, 0) > 12 * 1024 * 1024) throw Error("Six originaux et 12 Mo maximum par demande.");
  for (const f of originals) if (!f || typeof f.name !== "string" || !Number.isSafeInteger(f.size) || f.size <= 0 || f.size > 8 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(f.sha256)) throw Error("Un original est incomplet.");
  const service = chooseService(text, module);
  return { schema: "ojo-helene-universal-request-v1", id: crypto.randomUUID(), createdAt: (/* @__PURE__ */ new Date()).toISOString(), producer: "browser_visitor_unverified", module: service.id, text, originals: originals.map((f) => ({ name: f.name, type: f.type, size: f.size, sha256: f.sha256 })), links: [...new Set(text.match(/https?:\/\/[^\s<>]+/g) || [])].slice(0, 20), authority: { nativeAdmission: false, transmitted: false, approvedActions: [] }, status: "PREPARED_ON_DEVICE", proposal: { name: service.name, steps: [...service.steps] } };
}
function shoppingURL(query2) {
  if (typeof query2 !== "string" || !query2.trim() || query2.length > 500) throw Error("D\xE9cris un article de 500 caract\xE8res maximum.");
  return "https://www.google.com/search?" + new URLSearchParams({ tbm: "shop", q: query2.trim() });
}
function mailDraftURL({ to = "", subject = "", body = "" }) {
  if (!/^[^\s@?&\r\n]+@[^\s@?&\r\n]+\.[^\s@?&\r\n]+$/.test(to) || to.length > 254) throw Error("V\xE9rifie l\u2019adresse du destinataire.");
  if (typeof subject !== "string" || subject.length > 180 || /[\r\n]/.test(subject) || typeof body !== "string" || body.length > 1e4) throw Error("V\xE9rifie l\u2019objet et le texte du brouillon.");
  return "mailto:" + encodeURIComponent(to).replace("%40", "@") + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
}
function monthlyBudget(income, charges) {
  const cents = (value) => {
    const text = String(value).replace(",", ".");
    if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(text)) throw Error("Saisis des montants positifs avec deux d\xE9cimales maximum.");
    const [whole, fraction = ""] = text.split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  };
  const a = cents(income), b = cents(charges);
  return { income: a / 100, charges: b / 100, remaining: (a - b) / 100, source: "user_entered", isBankConnection: false };
}

// docs/helene/everyday.mjs
var PHRASES = Object.freeze([
  "Tu peux avancer doucement et avancer quand m\xEAme.",
  "Une chose \xE0 la fois, c\u2019est d\xE9j\xE0 une direction.",
  "Tu as le droit de garder du temps pour toi.",
  "Une petite joie a toute sa place dans une journ\xE9e.",
  "Tu peux commencer sans avoir tout pr\xE9vu.",
  "Ce que tu fais aujourd\u2019hui peut simplement te faciliter demain.",
  "Tu peux changer d\u2019avis et choisir autrement.",
  "Les jours tranquilles comptent aussi.",
  "Tu n\u2019as pas \xE0 tout porter en m\xEAme temps.",
  "Un petit pas choisi vaut la peine d\u2019\xEAtre reconnu.",
  "Ton rythme m\xE9rite d\u2019\xEAtre respect\xE9.",
  "Tu peux laisser une place \xE0 ce qui te fait du bien.",
  "Faire une pause fait aussi partie du chemin.",
  "Un moment partag\xE9 peut rendre la journ\xE9e plus l\xE9g\xE8re.",
  "Tu as le droit de dire ce dont tu as besoin.",
  "Aujourd\u2019hui peut commencer par quelque chose de simple.",
  "Tes questions ont leur place.",
  "Tu peux \xEAtre fi\xE8re des petites choses accomplies.",
  "Il reste de la place pour une bonne surprise.",
  "Prendre soin de toi m\xE9rite une place dans ton agenda.",
  "Tu peux choisir ce que tu gardes et ce que tu laisses.",
  "Tu n\u2019as pas besoin de tout r\xE9ussir pour appr\xE9cier ta journ\xE9e.",
  "Un peu de douceur peut suffire pour commencer.",
  "Les moments ordinaires peuvent devenir de bons souvenirs.",
  "Tu peux demander de l\u2019aide avec tes propres mots.",
  "Ce qui compte pour toi m\xE9rite ton attention.",
  "Tu peux faire de la place \xE0 une envie, m\xEAme petite.",
  "Tes efforts existent, m\xEAme quand ils sont discrets.",
  "Tu peux te laisser le temps de comprendre.",
  "Cette journ\xE9e t\u2019appartient aussi."
]);
var check = (v, m) => {
  if (!v) throw Error(m);
};
function dayKey(date2 = /* @__PURE__ */ new Date()) {
  return [date2.getFullYear(), String(date2.getMonth() + 1).padStart(2, "0"), String(date2.getDate()).padStart(2, "0")].join("-");
}
function phraseForDay(day = dayKey()) {
  check(/^\d{4}-\d{2}-\d{2}$/.test(day), "Date non valide.");
  return PHRASES[Math.floor(Date.parse(day + "T12:00:00Z") / 864e5) % PHRASES.length];
}
function wallTime(value) {
  check(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value), "Choisis une date et une heure.");
  const date2 = new Date(value);
  check(Number.isFinite(date2.getTime()) && dayKey(date2) + "T" + String(date2.getHours()).padStart(2, "0") + ":" + String(date2.getMinutes()).padStart(2, "0") === value, "Cette date ou cette heure n\u2019existe pas dans le fuseau de ton appareil.");
  return date2;
}
var localDateTime = (iso) => {
  const d = new Date(iso);
  return dayKey(d) + "T" + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
};
function appointmentFormTimes(item) {
  validateAppointments([item]);
  return { start: localDateTime(item.startUTC), end: localDateTime(item.endUTC) };
}
function makeAppointment({ title, start, end, place = "", note = "", kind = "personal", attendee = "", reminder = 30, id = crypto.randomUUID(), createdAt = (/* @__PURE__ */ new Date()).toISOString(), previous = null }) {
  check(typeof title === "string" && title.trim() && title.length <= 180, "Donne un titre de 180 caract\xE8res maximum.");
  check(["personal", "together"].includes(kind), "Choisis personnel ou \xE0 deux.");
  check(typeof place === "string" && place.length <= 300 && typeof note === "string" && note.length <= 4e3, "Le lieu ou les pr\xE9cisions sont trop longs.");
  check(typeof attendee === "string" && attendee.length <= 254 && (!attendee || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee)), "V\xE9rifie l\u2019adresse de la personne \xE0 inviter.");
  reminder = reminder === null ? null : Number(reminder);
  check([null, 0, 10, 30, 60, 1440].includes(reminder), "Choisis un d\xE9lai de rappel propos\xE9.");
  const prior = previous ? appointmentFormTimes(previous) : null;
  const a = prior?.start === start ? new Date(previous.startUTC) : wallTime(start), b = prior?.end === end ? new Date(previous.endUTC) : wallTime(end);
  check(b > a && b - a <= 7 * 864e5, "La fin doit suivre le d\xE9but, avec une dur\xE9e de sept jours maximum.");
  return { id, title: title.trim(), start, end, startUTC: a.toISOString(), endUTC: b.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris", place, note, kind, attendee: kind === "together" ? attendee.trim() : "", reminder, createdAt, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), delivery: "local_only" };
}
function validateAppointments(items) {
  check(Array.isArray(items) && items.length <= 200, "L\u2019agenda peut garder 200 rendez-vous dans cette version.");
  const ids = /* @__PURE__ */ new Set();
  for (const i of items) {
    check(i && typeof i.id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(i.id) && !ids.has(i.id), "Identifiant de rendez-vous non valide ou dupliqu\xE9.");
    ids.add(i.id);
    check(typeof i.title === "string" && i.title.trim() && i.title.length <= 180 && typeof i.place === "string" && i.place.length <= 300 && typeof i.note === "string" && i.note.length <= 4e3, "Rendez-vous incomplet.");
    check(["personal", "together"].includes(i.kind) && typeof i.attendee === "string" && i.attendee.length <= 254 && (!i.attendee || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.attendee)) && [null, 0, 10, 30, 60, 1440].includes(i.reminder) && i.delivery === "local_only", "Choix de partage ou de rappel non valide.");
    check(typeof i.start === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(i.start) && typeof i.end === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(i.end), "Dates de rendez-vous non valides.");
    const a = Date.parse(i.startUTC), b = Date.parse(i.endUTC);
    check(Number.isFinite(a) && Number.isFinite(b) && b > a && b - a <= 7 * 864e5 && typeof i.timeZone === "string" && i.timeZone.length <= 100, "Heures du rendez-vous non valides.");
    try {
      const wall = (iso) => {
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: i.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
        const get = (k) => parts.find((p) => p.type === k).value;
        return get("year") + "-" + get("month") + "-" + get("day") + "T" + get("hour") + ":" + get("minute");
      };
      check(wall(i.startUTC) === i.start && wall(i.endUTC) === i.end, "Dates et fuseau du rendez-vous incoh\xE9rents.");
    } catch (e) {
      throw Error(e.message === "Dates et fuseau du rendez-vous incoh\xE9rents." ? e.message : "Fuseau horaire non valide.");
    }
    check(typeof i.createdAt === "string" && typeof i.updatedAt === "string" && Number.isFinite(Date.parse(i.createdAt)) && Number.isFinite(Date.parse(i.updatedAt)), "Date d\u2019enregistrement non valide.");
  }
  return items;
}
var upcoming = (items, now = /* @__PURE__ */ new Date()) => items.filter((i) => Date.parse(i.endUTC) >= now.getTime()).sort((a, b) => Date.parse(a.startUTC) - Date.parse(b.startUTC));
var stamp = (x) => new Date(x).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
var escapeText = (x) => String(x).replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
function fold(line) {
  let out = "", bytes2 = 0;
  for (const c of line) {
    const size = new TextEncoder().encode(c).length;
    if (bytes2 + size > 75) {
      out += "\r\n ";
      bytes2 = 1;
    }
    out += c;
    bytes2 += size;
  }
  return out;
}
function calendarFile(items) {
  validateAppointments(items);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ojO//Helene local agenda//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const i of items) {
    lines.push("BEGIN:VEVENT", "UID:" + i.id + "@ojo-helene.local", "DTSTAMP:" + stamp(i.updatedAt), "DTSTART:" + stamp(i.startUTC), "DTEND:" + stamp(i.endUTC), "SUMMARY:" + escapeText(i.title), "LOCATION:" + escapeText(i.place), "DESCRIPTION:" + escapeText(i.note), "CLASS:PRIVATE");
    if (i.reminder !== null) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Rappel de rendez-vous", "TRIGGER:" + (i.reminder === 0 ? "PT0S" : "-PT" + i.reminder + "M"), "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
function appointmentShareText(i) {
  validateAppointments([i]);
  const date2 = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: i.timeZone }).format(new Date(i.startUTC));
  return i.title + "\n" + date2 + "\n" + (i.place ? "Lieu : " + i.place + "\n" : "") + (i.note ? i.note + "\n" : "") + "\nProposition de rendez-vous \xB7 \xE0 confirmer ensemble. Aucun rappel ni invitation automatique n\u2019a \xE9t\xE9 envoy\xE9.";
}

// docs/helene/core.mjs
var FORMAT = "ojo-helene-space-v1";
var MAX_FILE = 8 * 1024 * 1024;
var MAX_TOTAL = 12 * 1024 * 1024;
var MAX_JSON = 20 * 1024 * 1024;
async function sha256(bytes2) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes2)), (b) => b.toString(16).padStart(2, "0")).join("");
}
var normalize = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
var assert = (x, m) => {
  if (!x) throw Error(m);
};
var safeId = (x) => typeof x === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(x);
var uid = () => crypto.randomUUID();
function b64(bytes2) {
  let s = "";
  const b = new Uint8Array(bytes2);
  for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode(...b.subarray(i, i + 32768));
  return btoa(s);
}
function un64(s) {
  assert(typeof s === "string" && s.length <= Math.ceil(MAX_FILE * 4 / 3) + 4 && s.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(s), "Original encod\xE9 non valide.");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
async function original(name, type, bytes2) {
  const b = new Uint8Array(bytes2);
  assert(b.byteLength > 0 && b.byteLength <= MAX_FILE, "Chaque fichier doit contenir de 1 octet \xE0 8 Mo.");
  return Object.freeze({ name: String(name).slice(0, 240), type: String(type || "application/octet-stream").slice(0, 120), size: b.length, sha256: await sha256(b), base64: b64(b) });
}
function emptyState() {
  return { format: FORMAT, items: [], board: [], pinned: [], door: null, agenda: [], comfort: true };
}
async function makeItem({ title = "", text = "", next = "", files = [], links = [], demo = false }) {
  assert(typeof text === "string" && text.length <= 2e4, "La note est limit\xE9e \xE0 20 000 caract\xE8res.");
  assert(text.trim() || files.length, "Ajoute quelques mots ou un fichier.");
  assert(files.length <= 6, "Six fichiers au maximum par \xE9l\xE9ment.");
  assert(files.reduce((n, f) => n + f.size, 0) <= MAX_TOTAL, "Les originaux de cet \xE9l\xE9ment d\xE9passent 12 Mo.");
  return { id: uid(), title: String(title.trim() || text.trim().split("\n")[0] || files[0]?.name || "Sans titre").slice(0, 180), createdAt: (/* @__PURE__ */ new Date()).toISOString(), originalText: text, originalTextSha256: await sha256(new TextEncoder().encode(text)), description: "", nextStep: String(next).slice(0, 300), originals: files, links: [...new Set(links)], demo: Boolean(demo) };
}
function searchItems(items, q, filter2 = "all") {
  const n = normalize(q.trim());
  return items.filter((i) => (filter2 === "all" || filter2 === "file" && i.originals.length || filter2 === "note" && !i.originals.length) && normalize([i.title, i.originalText, i.description, ...i.originals.map((f) => f.name)].join(" ")).includes(n));
}
function essential(state2) {
  return state2.pinned.map((id) => state2.items.find((i) => i.id === id)).filter(Boolean).slice(0, 3);
}
function pin(state2, id) {
  assert(state2.items.some((i) => i.id === id), "\xC9l\xE9ment introuvable.");
  if (state2.pinned.includes(id)) state2.pinned = state2.pinned.filter((x) => x !== id);
  else {
    assert(state2.pinned.length < 3, "Ton essentiel contient d\xE9j\xE0 trois \xE9l\xE9ments. Retire-en un pour faire de la place.");
    state2.pinned.push(id);
  }
}
function addBoard(state2, kind, text) {
  assert(["question", "objection", "suggestion"].includes(kind), "Type de contribution non valide.");
  assert(typeof text === "string" && text.trim() && text.length <= 4e3, "\xC9cris entre 1 et 4 000 caract\xE8res.");
  assert(state2.board.length < 100, "Ton espace peut garder 100 questions, objections ou suggestions dans cette version.");
  const b = { id: uid(), kind, text, createdAt: (/* @__PURE__ */ new Date()).toISOString(), producer: "account_visitor", delivery: "draft_only" };
  state2.board.push(b);
  return b;
}
function textField(x, max) {
  return typeof x === "string" && x.length <= max;
}
async function validateState(v) {
  assert(v && typeof v === "object", "Espace non valide.");
  if (v.agenda === void 0) v.agenda = [];
  if (v.comfort === void 0) v.comfort = true;
  assert(typeof v.comfort === "boolean", "Pr\xE9f\xE9rence du jour non valide.");
  validateAppointments(v.agenda);
  assert(v && v.format === FORMAT && Array.isArray(v.items) && v.items.length <= 80 && Array.isArray(v.board) && v.board.length <= 100 && Array.isArray(v.pinned) && v.pinned.length <= 3, "Format ou taille de l\u2019export non valide.");
  assert(v.door === null || ["daily", "documents", "understand"].includes(v.door), "Choix d\u2019accueil non valide.");
  const ids = /* @__PURE__ */ new Set(), boardIds = /* @__PURE__ */ new Set();
  let total = 0;
  for (const i of v.items) {
    assert(i && safeId(i.id) && !ids.has(i.id), "Identifiant d\u2019\xE9l\xE9ment non valide ou dupliqu\xE9.");
    ids.add(i.id);
    assert(textField(i.title, 180) && textField(i.originalText, 2e4) && textField(i.description, 2e4) && textField(i.nextStep, 300) && typeof i.createdAt === "string" && Number.isFinite(Date.parse(i.createdAt)) && typeof i.demo === "boolean", "M\xE9tadonn\xE9es d\u2019\xE9l\xE9ment non valides.");
    assert(await sha256(new TextEncoder().encode(i.originalText)) === i.originalTextSha256, "Le texte original a \xE9t\xE9 alt\xE9r\xE9.");
    assert(Array.isArray(i.originals) && i.originals.length <= 6 && Array.isArray(i.links) && i.links.length <= 80, "Index d\u2019originaux ou liens non valide.");
    for (const f of i.originals) {
      assert(f && textField(f.name, 240) && textField(f.type, 120) && Number.isSafeInteger(f.size) && f.size > 0 && f.size <= MAX_FILE, "M\xE9tadonn\xE9es de fichier non valides.");
      const b = un64(f.base64);
      assert(b.length === f.size && await sha256(b) === f.sha256, "Un fichier original a \xE9t\xE9 alt\xE9r\xE9.");
      total += b.length;
      assert(total <= MAX_TOTAL, "Les originaux d\xE9passent 12 Mo.");
    }
  }
  assert(new Set(v.pinned).size === v.pinned.length && v.pinned.every((id) => ids.has(id)), "Rep\xE8res \xE9pingl\xE9s non valides.");
  for (const i of v.items) assert(i.links.every((id) => ids.has(id) && id !== i.id) && new Set(i.links).size === i.links.length, "Un lien ne correspond pas \xE0 un \xE9l\xE9ment.");
  for (const b of v.board) {
    assert(b && safeId(b.id) && !boardIds.has(b.id) && ["question", "objection", "suggestion"].includes(b.kind) && textField(b.text, 4e3) && b.text.trim() && typeof b.createdAt === "string" && Number.isFinite(Date.parse(b.createdAt)) && ["account_visitor", "visitor_demo"].includes(b.producer) && b.delivery === "draft_only", "Contribution non valide.");
    boardIds.add(b.id);
  }
  return v;
}
async function exportState(v) {
  await validateState(v);
  const payload = JSON.stringify(v);
  return JSON.stringify({ format: FORMAT, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), checksum: await sha256(new TextEncoder().encode(payload)), data: v }, null, 2);
}
async function importState(text) {
  assert(typeof text === "string" && new TextEncoder().encode(text).length <= MAX_JSON, "L\u2019export d\xE9passe 20 Mo.");
  const o = JSON.parse(text);
  assert([FORMAT, "ojo-helene-review-v1"].includes(o.format) && o.data && typeof o.checksum === "string", "Ce fichier n\u2019est pas un export de ton espace ojO.");
  assert(await sha256(new TextEncoder().encode(JSON.stringify(o.data))) === o.checksum, "L\u2019export est incomplet ou a \xE9t\xE9 modifi\xE9.");
  if (o.format === "ojo-helene-review-v1") {
    assert(o.data.format === o.format, "Format de l\u2019ancien export invalide.");
    o.data.format = FORMAT;
  }
  return validateState(o.data);
}
async function demoState() {
  const s = emptyState();
  const a = await makeItem({ title: "Un coin lecture \xE0 imaginer", text: "Exemple fictif\n\nJ\u2019aimerais un endroit calme pr\xE8s de la fen\xEAtre. Garder quelques id\xE9es, sans d\xE9cider tout de suite.", next: "Garder une premi\xE8re id\xE9e de disposition." });
  const file = await original("Ma-liste-exemple.txt", "text/plain", new TextEncoder().encode("EXEMPLE FICTIF\nMa petite liste de la semaine\n- Mettre mes id\xE9es au clair\n- Retrouver un document\n- Garder du temps libre\n"));
  const b = await makeItem({ title: "Ma petite liste de la semaine", text: "Exemple fictif : une liste, son fichier original et une premi\xE8re \xE9tape choisie.", next: "Choisir une seule chose pour commencer.", files: [file], links: [a.id] });
  const c = await makeItem({ title: "Une question \xE0 garder", text: "Exemple fictif\n\nQu\u2019est-ce qui a r\xE9ellement chang\xE9 depuis la derni\xE8re pr\xE9sentation ?", next: "Comparer les documents et leurs dates.", links: [b.id] });
  s.items = [a, b, c].map((i) => ({ ...i, demo: true }));
  s.pinned = [a.id, b.id, c.id];
  return s;
}

// docs/helene/vendor/voice-capture.mjs
var VoiceCapture = class {
  constructor({ onFile, onStatus, onState }) {
    this.onFile = onFile;
    this.onStatus = onStatus;
    this.onState = onState;
    this.stream = null;
    this.recorder = null;
    this.token = 0;
    this.timer = null;
  }
  async start() {
    if (this.recorder || this.stream) return;
    const token = ++this.token;
    this.onState(true);
    this.onStatus("Esperando permiso del micr\xF3fono\u2026");
    try {
      if (!globalThis.MediaRecorder || !navigator.mediaDevices?.getUserMedia) throw Error("La grabaci\xF3n no est\xE1 disponible. Puedes elegir un audio desde Archivos.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (token !== this.token) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      const preferred = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported?.(t));
      const chunks = [], r = new MediaRecorder(stream, preferred ? { mimeType: preferred } : {}), start = Date.now();
      this.recorder = r;
      r.ondataavailable = (e) => {
        if (e.data?.size) chunks.push(e.data);
      };
      r.onerror = () => {
        this.cancel();
        this.onStatus("No se pudo completar la grabaci\xF3n. Importa un audio desde Archivos.");
      };
      r.onstop = () => {
        this.cleanup();
        if (token !== this.token) return;
        const mime = r.mimeType || chunks[0]?.type || "audio/webm", blob = new Blob(chunks, { type: mime });
        if (blob.size) {
          const file = new File([blob], "Mi-voz-" + (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-") + (mime.includes("mp4") ? ".m4a" : mime.includes("ogg") ? ".ogg" : ".webm"), { type: mime });
          this.onFile(file);
          this.onStatus("Voz preparada. A\xF1ade unas palabras y guarda el recuerdo.");
        } else this.onStatus("No se han recibido datos de audio.");
        this.onState(false);
      };
      r.start(1e3);
      this.onStatus("Grabando \xB7 0:00");
      this.timer = setInterval(() => {
        const sec = Math.floor((Date.now() - start) / 1e3);
        this.onStatus("Grabando \xB7 " + Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"));
        if (sec >= 180) this.stop();
      }, 500);
    } catch (e) {
      this.cleanup();
      this.onState(false);
      this.onStatus(e.message);
    }
  }
  stop() {
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
  }
  cleanup() {
    clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
  }
  cancel() {
    this.token++;
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.cleanup();
    this.onState(false);
  }
};

// docs/helene/services-ui.mjs
var PERSONAL_CHAT_URL = "https://tony.nova-era.fr/ojo/helene/";
function servicesUI({ render: render2, esc: esc2, icon: icon2, toast: toast2, vault: vault2 }) {
  const $2 = (s) => document.querySelector(s);
  let draft = "", chosen = "auto", pending2 = [], messages = [], preparing = false, recording2 = false;
  const money = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
  const voice2 = new VoiceCapture({ onFile: (f) => {
    pending2.push(f);
    updateFiles();
  }, onState: (active) => {
    recording2 = active;
    const button = $2("#chat-voice");
    if (button) {
      button.textContent = active ? "Arr\xEAter ma voix" : "Ma voix";
      button.setAttribute("aria-pressed", String(active));
    }
  }, onStatus: (text) => {
    const el = $2("#chat-input-status");
    if (el) el.textContent = text.startsWith("Grabando") ? "Enregistrement en cours\u2026" : text.startsWith("Esperando") ? "Autorisation du microphone en attente\u2026" : text.startsWith("Voz preparada") ? "Voix ajout\xE9e comme original, sans transcription." : text.startsWith("La grabaci\xF3n") ? "Enregistrement indisponible. Tu peux choisir un fichier audio." : text.startsWith("No se pudo") ? "Enregistrement interrompu. Tu peux choisir un fichier audio." : text.startsWith("No se han") ? "Aucun son re\xE7u." : text;
  } });
  function updateFiles() {
    const el = $2("#chat-pending");
    if (el) el.innerHTML = pending2.map((f, i) => `<p>${esc2(f.name)} \xB7 ${(f.size / 1024).toFixed(1)} Ko <button type="button" class="text-button" data-chat-remove="${i}">Retirer</button></p>`).join("");
  }
  function chat() {
    return `<section class="intro-row page-head"><div><span class="eyebrow">TES MOTS, TES CHOIX</span><h1>On commence<br>par ce que tu veux.</h1><p>Une question, une envie, un achat \xE0 pr\xE9parer ou un papier \xE0 comprendre.</p></div></section><section class="connection-note chat-status"><strong>Ta conversation personnelle.</strong><p>Ouvre ton acc\xE8s personnel pour \xE9changer par \xE9crit avec ojO. Tu choisis les messages que tu lui confies.</p><a class="button primary" href="${PERSONAL_CHAT_URL}" target="_blank" rel="noopener noreferrer">Ouvrir ma conversation personnelle</a><p class="small muted">Nouvel onglet \xB7 tes notes, tes documents et ton coffre restent sur cet appareil.</p></section><section class="connection-note"><strong>Pr\xE9parer une demande ici.</strong><p>Les outils ci-dessous proposent des parcours locaux pr\xE9d\xE9finis avec tes mots et tes originaux. Aucun fichier n\u2019est analys\xE9 ou transmis.</p></section><div class="chat-log" aria-live="polite">${messages.length ? messages.map((m, index) => `<article class="chat-user"><span class="eyebrow">MA DEMANDE</span><p>${esc2(m.request.text || "Mes originaux")}</p>${m.files.length ? '<p class="small muted">' + m.files.map((f) => esc2(f.name)).join(" \xB7 ") + " \xB7 originaux gard\xE9s pour cette session</p>" : ""}</article><article class="chat-proposal"><span class="eyebrow">PROPOSITION DE PARCOURS \xB7 PR\xC9PARATION LOCALE</span><h2>${esc2(m.request.proposal.name)}</h2><ol>${m.request.proposal.steps.map((step) => "<li>" + esc2(step) + "</li>").join("")}</ol><div class="button-row"><a class="button secondary" href="#${esc2(SERVICES.find((s) => s.id === m.request.module).route)}">Ouvrir l\u2019outil disponible</a><button class="button secondary" data-chat-keep="${index}">Garder dans mon coffre</button></div><p class="small muted">Aucune action lanc\xE9e. Aucun acc\xE8s aux mails, aux comptes ou au contenu du coffre.</p></article>`).join("") : '<div class="chat-welcome"><p>Tu peux commencer librement, ou choisir un sujet.</p><div class="chips">' + SERVICES.map((s) => `<button class="chip" data-chat-topic="${s.id}">${esc2(s.name)}</button>`).join("") + "</div></div>"}</div><form id="chat-form" class="chat-composer"><label for="chat-message">Ce que j\u2019aimerais</label><textarea id="chat-message" maxlength="20000" rows="4" placeholder="Avec mes propres mots\u2026">${esc2(draft)}</textarea><label for="chat-module" class="sr-only">Le sujet de ma demande</label><select id="chat-module"><option value="auto">Me proposer un parcours</option>${SERVICES.map((s) => `<option value="${s.id}" ${chosen === s.id ? "selected" : ""}>${esc2(s.name)}</option>`).join("")}</select><div class="button-row"><label class="button secondary" for="chat-files">${icon2("clip")}Photo, document ou audio</label><input class="sr-only" type="file" id="chat-files" multiple><button class="button secondary" type="button" id="chat-voice" aria-pressed="${recording2}">${recording2 ? "Arr\xEAter ma voix" : "Ma voix"}</button></div><div id="chat-pending">${pending2.map((f, i) => `<p>${esc2(f.name)} \xB7 ${(f.size / 1024).toFixed(1)} Ko <button class="text-button" type="button" data-chat-remove="${i}">Retirer</button></p>`).join("")}</div><p class="small muted" id="chat-input-status" role="status">Entr\xE9es universelles : texte, liens, voix, photos et documents. Les fichiers restent des originaux ; pas d\u2019OCR ni de transcription.</p><p class="error" id="chat-error" role="alert"></p><button class="button primary full" id="chat-prepare" ${preparing ? "disabled" : ""}>Pr\xE9parer ma demande</button><p class="small muted">Cette pr\xE9paration reste en m\xE9moire pendant cette visite. Pour la conserver, garde-la dans ton coffre ouvert. Tu peux ensuite choisir les mots \xE0 reprendre dans ta conversation personnelle.</p></form><button class="text-button" data-chat-clear>Vider cette pr\xE9paration de la session</button>`;
  }
  function modules() {
    return `<section class="intro-row page-head"><div><span class="eyebrow">MES OUTILS, SELON MES BESOINS</span><h1>Le quotidien,<br>un peu plus simple.</h1><p>Pr\xE9parer, comprendre et garder les bonnes pi\xE8ces. Tu choisis les comptes et les services que tu souhaites relier.</p></div><a class="button primary" href="#chat">Commencer par une demande</a></section><div class="module-grid">${SERVICES.map((s) => `<article class="card"><span class="card-icon">${icon2(s.icon)}</span><h3>${esc2(s.name)}</h3><p><strong>Disponible :</strong> ${esc2(s.available)}.</p><p><strong>\xC0 raccorder :</strong> ${esc2(s.pending)}.</p><a class="text-button" href="#${esc2(s.route)}">${s.route === "services" ? "Voir les outils ci-dessous" : "Ouvrir"}</a><button class="text-button" data-chat-topic="${s.id}">Pr\xE9parer une demande</button></article>`).join("")}</div><section class="tool-section"><span class="eyebrow">ACHATS \xB7 SANS CAT\xC9GORIE IMPOS\xC9E</span><h2>Ce que je cherche.</h2><form id="shopping-form"><label for="shopping-query">L\u2019article et mes crit\xE8res</label><input id="shopping-query" maxlength="500" required placeholder="Un article, un usage, une taille, un budget\u2026"><p class="small muted">Le bouton ouvre une recherche Google Shopping avec ces seuls mots. Les prix, les vendeurs et les conditions se v\xE9rifient sur leurs sources. Aucun achat ni paiement depuis ojO.</p><button class="button secondary">Rechercher ce produit dans Google Shopping</button><p class="small" id="shopping-status" role="status"></p></form></section><section class="tool-section"><span class="eyebrow">MAILS \xB7 UN BROUILLON QUE JE RELIS</span><h2>Pr\xE9parer mon message.</h2><p class="small muted">Aucun compte mail n\u2019est reli\xE9 \xE0 cette version. Tu peux pr\xE9parer le texte et le confier \xE0 ta propre messagerie pour le relire avant envoi.</p><form id="mail-draft-form"><label for="mail-to">Destinataire</label><input id="mail-to" type="email" maxlength="254" required><label for="mail-subject">Objet</label><input id="mail-subject" maxlength="180"><label for="mail-body">Mon texte</label><textarea id="mail-body" rows="5" maxlength="10000"></textarea><button class="button secondary">Ouvrir ce brouillon dans ma messagerie</button><p class="small" id="mail-status" role="status"></p></form></section><section class="tool-section"><span class="eyebrow">UN REP\xC8RE POUR MON BUDGET</span><h2>Faire le point, simplement.</h2><p class="small muted">Calcul sur les deux montants que tu saisis. Aucun compte bancaire connect\xE9, aucune transaction et aucune estimation de ton solde r\xE9el.</p><form id="budget-form"><div class="two-column"><div><label for="budget-income">Entr\xE9es mensuelles (\u20AC)</label><input id="budget-income" inputmode="decimal" type="number" step="0.01" min="0" max="1000000000" required></div><div><label for="budget-charges">Charges pr\xE9vues (\u20AC)</label><input id="budget-charges" inputmode="decimal" type="number" step="0.01" min="0" max="1000000000" required></div></div><button class="button secondary">Calculer mon rep\xE8re</button><p id="budget-result" class="budget-result" role="status"></p></form></section><section class="tool-section"><span class="eyebrow">DES ACC\xC8S QUE JE CHOISIS</span><h2>Les services utiles.</h2><div class="button-row"><a class="button secondary" href="https://www.3237.fr/" target="_blank" rel="noopener noreferrer">Rechercher une pharmacie de garde \xB7 3237</a><a class="button secondary" href="https://www.masecurite.interieur.gouv.fr/fr/fiches-pratiques/famille-et-aides-aux-victimes/numeros-utiles-nationaux" target="_blank" rel="noopener noreferrer">Source officielle \xB7 pharmacie de garde</a><a class="button secondary" href="https://www.impots.gouv.fr/particulier/jaccede-mon-espace-particulier-et-mes-services-en-ligne" target="_blank" rel="noopener noreferrer">Mon espace sur impots.gouv.fr</a></div><p class="small muted">Liens v\xE9rifi\xE9s le 28 octobre 2026. La pharmacie disponible d\xE9pend de ton lieu et de l\u2019heure ; le service externe pr\xE9cise les conditions d\u2019acc\xE8s. Aucun document du coffre n\u2019est joint \xE0 ces ouvertures.</p><a class="text-button" href="#reperes">Mes questions et nos rep\xE8res</a> \xB7 <a class="text-button" href="#nova">NOVA ERA, si je veux l\u2019explorer</a></section>`;
  }
  document.addEventListener("input", (e) => {
    if (e.target.id === "chat-message") draft = e.target.value;
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "chat-module") chosen = e.target.value;
    if (e.target.id === "chat-files") {
      const next = [...pending2, ...e.target.files];
      e.target.value = "";
      if (next.length > 6 || next.some((f) => !f.size || f.size > 8 * 1024 * 1024) || next.reduce((n, f) => n + f.size, 0) > 12 * 1024 * 1024) {
        toast2("Six originaux maximum, 8 Mo chacun et 12 Mo par demande.");
        return;
      }
      pending2 = next;
      updateFiles();
    }
  });
  document.addEventListener("submit", async (e) => {
    if (e.target.id === "chat-form") {
      e.preventDefault();
      if (preparing) return;
      if (recording2) {
        $2("#chat-error").textContent = "Arr\xEAte l\u2019enregistrement avant de pr\xE9parer ta demande.";
        return;
      }
      preparing = true;
      $2("#chat-prepare").disabled = true;
      try {
        const rawFiles = [...pending2], originals = await Promise.all(rawFiles.map(async (f) => original(f.name, f.type, await f.arrayBuffer()))), request2 = await universalRequest(draft, originals, chosen);
        messages.push({ request: request2, files: rawFiles });
        if (messages.length > 20) messages.shift();
        draft = "";
        pending2 = [];
        render2();
      } catch (error) {
        $2("#chat-error").textContent = error.message;
      } finally {
        preparing = false;
        const button = $2("#chat-prepare");
        if (button) button.disabled = false;
      }
      return;
    }
    if (e.target.id === "shopping-form") {
      e.preventDefault();
      try {
        const url = shoppingURL($2("#shopping-query").value);
        window.open(url, "_blank", "noopener,noreferrer");
        $2("#shopping-status").textContent = "Recherche confi\xE9e au navigateur. Aucune comparaison de prix ni commande enregistr\xE9e ici.";
      } catch (error) {
        $2("#shopping-status").textContent = error.message;
      }
      return;
    }
    if (e.target.id === "mail-draft-form") {
      e.preventDefault();
      try {
        const url = mailDraftURL({ to: $2("#mail-to").value, subject: $2("#mail-subject").value, body: $2("#mail-body").value });
        window.location.href = url;
        $2("#mail-status").textContent = "Brouillon confi\xE9 \xE0 ta messagerie. Aucun envoi effectu\xE9 par ojO.";
      } catch (error) {
        $2("#mail-status").textContent = error.message;
      }
      return;
    }
    if (e.target.id === "budget-form") {
      e.preventDefault();
      try {
        const result = monthlyBudget($2("#budget-income").value, $2("#budget-charges").value);
        $2("#budget-result").textContent = "Apr\xE8s les charges saisies : " + money(result.remaining) + " par mois. Ce rep\xE8re ne comprend que les montants que tu viens d\u2019indiquer.";
      } catch (error) {
        $2("#budget-result").textContent = error.message;
      }
    }
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.id === "chat-voice") {
      if (recording2) voice2.stop();
      else voice2.start();
      return;
    }
    if (b.dataset.chatTopic) {
      chosen = b.dataset.chatTopic;
      location.hash = "chat";
      render2();
      return;
    }
    if (b.dataset.chatRemove !== void 0) {
      pending2.splice(Number(b.dataset.chatRemove), 1);
      updateFiles();
      return;
    }
    if (b.hasAttribute("data-chat-clear")) {
      voice2.cancel();
      messages = [];
      draft = "";
      pending2 = [];
      if (location.hash === "#chat") render2();
      toast2("Pr\xE9paration de cette session vid\xE9e. Les copies gard\xE9es dans le coffre sont conserv\xE9es.");
      return;
    }
    if (b.dataset.chatKeep !== void 0) {
      const item = messages[Number(b.dataset.chatKeep)];
      if (!item) return;
      try {
        await vault2.keepConversation(item.request, item.files);
        toast2("Demande et originaux chiffr\xE9s dans ton coffre.");
      } catch (error) {
        toast2(error.message);
      }
      return;
    }
  });
  window.addEventListener("hashchange", () => {
    if (location.hash !== "#chat") voice2.cancel();
  });
  window.addEventListener("pagehide", () => {
    voice2.cancel();
    messages = [];
    draft = "";
    pending2 = [];
  });
  return { chat, modules };
}

// docs/helene/evolution-ui.mjs
function evolutionUI({ render: render2, esc: esc2, toast: toast2, snapshot, storage }) {
  let engine = null, problem = "", lastFacts = null, review = "", choicesOpen = false;
  try {
    if (!globalThis.NovaEvolution) throw Error("COMMON_MODULE_UNAVAILABLE");
    engine = globalThis.NovaEvolution.create({ appId: "helene", scope: "personal", storage: storage === void 0 ? globalThis.localStorage : storage, clock: () => (/* @__PURE__ */ new Date()).toISOString() });
    if (engine.status().storage === "CORRUPT_REQUIRES_FORGET") problem = "Ces r\xE9glages sont illisibles. Tu peux utiliser \xAB Oublier ces choix et ce bilan \xBB pour repartir sans effacer tes notes ni ton coffre.";
  } catch {
    problem = "Ces r\xE9glages ne peuvent pas \xEAtre conserv\xE9s dans ce navigateur. Tes \xE9l\xE9ments restent disponibles.";
  }
  const flags = () => engine?.consent() || { memory: false, observations: false, suggestions: false, technicalSharing: false };
  const preferences = () => ({ language: "fr", detail: "standard", cadence: "on_open", ...engine?.preferences() });
  function storageNotice() {
    if (["UNAVAILABLE", "SESSION_ONLY"].includes(engine.status().storage)) {
      problem = "Ce choix est actif pour cette visite. Le navigateur n\u2019a pas pu le conserver pour une prochaine ouverture.";
      return false;
    }
    return true;
  }
  function observe(signal) {
    if (!engine || !flags().observations) return;
    try {
      engine.observe(signal);
    } catch {
      problem = "Le bilan local n\u2019a pas pu \xEAtre actualis\xE9. Tes \xE9l\xE9ments sont conserv\xE9s.";
    }
  }
  function facts() {
    if (!flags().observations) return { pendingSteps: 0 };
    const value = snapshot();
    return { pendingSteps: Number.isSafeInteger(value.pendingSteps) && value.pendingSteps > 0 ? value.pendingSteps : 0 };
  }
  function refresh() {
    if (!engine || !flags().observations) {
      lastFacts = null;
      return;
    }
    const value = facts(), key = String(value.pendingSteps);
    if (key !== lastFacts) {
      lastFacts = key;
      if (value.pendingSteps) observe("PENDING_TASK");
    }
  }
  function suggestions() {
    if (!engine || !flags().suggestions || preferences().cadence === "off") return [];
    const value = engine.suggest();
    return Array.isArray(value) ? value : Array.isArray(value?.suggestions) ? value.suggestions : [];
  }
  function checked(key) {
    return flags()[key] ? " checked" : "";
  }
  function home2() {
    refresh();
    const f = flags(), p = preferences(), pending2 = f.observations ? facts().pendingSteps : 0;
    const rows = suggestions();
    const cards = rows.map((row) => {
      if (typeof row.id !== "string") return "";
      const signal = row.signal || row.code || row.kind;
      if (signal === "PENDING_TASK" && !pending2) return "";
      const title = signal === "PENDING_TASK" ? "Reprendre un prochain petit pas" : row.title || "Une piste pour simplifier ton espace";
      const text = signal === "PENDING_TASK" ? "Tu as gard\xE9 une \xE9tape \xE0 reprendre dans tes \xE9l\xE9ments. Tu peux la retrouver tranquillement, quand tu le souhaites." : row.message || row.summary || "Tu peux examiner cette proposition et choisir de la garder ou de la laisser.";
      const state2 = row.state || row.status;
      const refused = state2 === "REFUSED", approved = state2 === "APPROVED_NOT_EXECUTED";
      return `<article class="evolution-suggestion"><h3>${esc2(title)}</h3>${p.detail === "short" ? "" : `<p>${esc2(text)}</p>`}<p class="small muted">${refused ? "Piste mise de c\xF4t\xE9" : approved ? "Piste gard\xE9e pour examen" : state2 === "CANCELLED" ? "Choix annul\xE9" : "Proposition \xE0 examiner"} \xB7 aucune action ext\xE9rieure</p><div class="button-row">${refused ? "" : `<button type="button" class="button secondary" data-evolution-decision="accept" data-proposal="${esc2(row.id)}">${approved ? "Garder cette piste" : "Examiner"}</button><button type="button" class="text-button" data-evolution-decision="refuse" data-proposal="${esc2(row.id)}">Pas pour moi</button>`}<button type="button" class="text-button" data-evolution-decision="cancel" data-proposal="${esc2(row.id)}">Annuler mon choix</button>${approved && signal === "PENDING_TASK" ? '<a class="text-button" href="#elements">Retrouver mes prochains petits pas</a>' : ""}</div></article>`;
    }).join("");
    return `<section class="evolution-panel" aria-labelledby="evolution-title"><span class="eyebrow">\xC0 TON RYTHME</span><h2 id="evolution-title">Un compagnon qui s\u2019adapte \xE0 tes choix.</h2><p>Tu choisis ce que cet appareil peut retenir pour te proposer une aide au bon moment.</p>${cards || `<p class="small muted">${p.cadence === "off" ? "Tu as choisi de masquer les propositions." : f.suggestions ? "Les propositions apparaissent ici quand une piste utile est rep\xE9r\xE9e." : "Les suggestions sont d\xE9sactiv\xE9es. Tu peux les autoriser ci-dessous."}</p>`}<details data-evolution-settings${choicesOpen ? " open" : ""}><summary>Choisir ce que je souhaite retenir</summary><p class="small muted">Ces choix restent dans ce navigateur. Le contenu de tes notes, de tes conversations et de ton coffre n\u2019entre pas dans le bilan technique.</p><div class="evolution-choices">${[["memory", "Retenir mes pr\xE9f\xE9rences d\u2019affichage"], ["observations", "Retenir les \xE9tats techniques et les \xE9tapes \xE0 reprendre, sans leur texte"], ["suggestions", "Me proposer des pistes \xE0 l\u2019ouverture"], ["technicalSharing", "Autoriser la pr\xE9paration d\u2019un bilan technique sans mes contenus"]].map(([key, label]) => `<label class="evolution-choice"><input type="checkbox" data-evolution-consent="${key}"${checked(key)}${engine ? "" : " disabled"}><span>${esc2(label)}</span></label>`).join("")}</div><form id="evolution-preferences"><label for="evolution-detail">D\xE9tail des propositions</label><select id="evolution-detail"${f.memory ? "" : " disabled"}><option value="standard"${p.detail === "standard" ? " selected" : ""}>Avec une courte explication</option><option value="short"${p.detail === "short" ? " selected" : ""}>Quelques mots seulement</option></select><label for="evolution-cadence">Quand les afficher</label><select id="evolution-cadence"${f.memory ? "" : " disabled"}><option value="on_open"${p.cadence === "on_open" ? " selected" : ""}>Dans mon espace, \xE0 l\u2019ouverture</option><option value="off"${p.cadence === "off" ? " selected" : ""}>Les masquer</option></select><button type="submit" class="button secondary"${f.memory ? "" : " disabled"}>Garder mes pr\xE9f\xE9rences</button></form><p class="small muted">Aucune notification ni aucun message externe n\u2019est envoy\xE9.</p><div class="button-row"><button type="button" class="text-button" data-evolution-review${f.technicalSharing ? "" : " disabled"}>Voir le bilan que je pourrais partager</button><button type="button" class="text-button" data-evolution-forget${engine ? "" : " disabled"}>Oublier ces choix et ce bilan</button></div>${review ? `<pre class="evolution-review" aria-label="Bilan technique pr\xE9par\xE9">${esc2(review)}</pre><p class="small muted">Ce bilan est affich\xE9 ici. Il n\u2019a pas \xE9t\xE9 envoy\xE9.</p>` : ""}</details>${problem ? `<p class="error" role="status">${esc2(problem)}</p>` : ""}</section>`;
  }
  document.addEventListener("change", (event) => {
    const key = event.target.dataset?.evolutionConsent;
    if (!key || !engine) return;
    try {
      engine.setConsent({ ...flags(), [key]: event.target.checked });
      if (key === "observations") lastFacts = null;
      review = "";
      problem = "";
      storageNotice();
      render2();
    } catch {
      problem = "Ce choix n\u2019a pas pu \xEAtre conserv\xE9. R\xE9essaie quand tu le souhaites.";
      render2();
    }
  });
  document.addEventListener("submit", (event) => {
    if (event.target.id !== "evolution-preferences") return;
    event.preventDefault();
    if (!engine || !flags().memory) return;
    try {
      engine.setPreferences({ language: "fr", detail: document.getElementById("evolution-detail").value, cadence: document.getElementById("evolution-cadence").value });
      problem = "";
      const saved = storageNotice();
      render2();
      if (saved) toast2("Tes pr\xE9f\xE9rences sont gard\xE9es sur cet appareil.");
    } catch {
      problem = "Les pr\xE9f\xE9rences n\u2019ont pas pu \xEAtre gard\xE9es.";
      render2();
    }
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || !engine) return;
    try {
      if (button.hasAttribute("data-evolution-forget")) {
        engine.forget();
        lastFacts = null;
        review = "";
        problem = "";
        render2();
        toast2("Ces choix et ce bilan sont oubli\xE9s. Tes notes et ton coffre sont conserv\xE9s.");
        return;
      }
      if (button.hasAttribute("data-evolution-review")) {
        review = JSON.stringify(engine.exportTechnical(), null, 2);
        choicesOpen = true;
        render2();
        return;
      }
      const decision = button.dataset.evolutionDecision;
      if (decision) {
        engine.decide(button.dataset.proposal, decision);
        render2();
        toast2(decision === "accept" ? "Cette piste est gard\xE9e pour examen. Aucune action n\u2019a \xE9t\xE9 lanc\xE9e." : decision === "refuse" ? "Ton choix est pris en compte." : "Ton choix a \xE9t\xE9 annul\xE9.");
        return;
      }
    } catch {
      problem = "Ce choix n\u2019a pas pu \xEAtre appliqu\xE9. Aucune action ext\xE9rieure n\u2019a \xE9t\xE9 lanc\xE9e.";
      render2();
    }
  });
  document.addEventListener("toggle", (event) => {
    if (event.target.matches?.("[data-evolution-settings]") && event.target.isConnected) choicesOpen = event.target.open;
  }, true);
  globalThis.addEventListener("storage", (event) => {
    if (event.key !== "nova:ojo:evolution:v1:helene:personal") return;
    review = "";
    render2();
  });
  return { home: home2, refresh, observe };
}

// docs/helene/everyday-ui.mjs
function everydayUI({ getState, persist: persist2, render: render2, esc: esc2, icon: icon2, download: download2, toast: toast2 }) {
  const $2 = (s) => document.querySelector(s);
  let month = new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1), selected = dayKey(), editing = null;
  const longDate = (d) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(/* @__PURE__ */ new Date(d + "T12:00:00"));
  const time = (i) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: i.timeZone }).format(new Date(i.startUTC));
  const row = (i) => `<button class="appointment-row" data-appointment="${esc2(i.id)}"><span class="appointment-time">${esc2(time(i))}</span><span><strong>${esc2(i.title)}</strong><small>${i.kind === "together" ? "\xC0 deux \xB7 partage \xE0 pr\xE9parer" : "Personnel"}${i.place ? " \xB7 " + esc2(i.place) : ""}</small></span>${icon2("arrow")}</button>`;
  document.body.insertAdjacentHTML("beforeend", `<dialog id="agenda-dialog" aria-labelledby="agenda-dialog-title"><div class="dialog-top"><span class="eyebrow">MES RENDEZ-VOUS</span><button class="icon-button" data-close="agenda-dialog" aria-label="Fermer">${icon2("close")}</button></div><h2 id="agenda-dialog-title">Un moment \xE0 garder.</h2><form id="agenda-form"><label for="agenda-title">Le rendez-vous</label><input id="agenda-title" maxlength="180" required placeholder="Ce que je veux pr\xE9voir"><div class="two-column"><div><label for="agenda-start">D\xE9but</label><input id="agenda-start" type="datetime-local" required></div><div><label for="agenda-end">Fin</label><input id="agenda-end" type="datetime-local" required></div></div><p class="small muted">Heures de cet appareil : ${esc2(Intl.DateTimeFormat().resolvedOptions().timeZone)}.</p><label for="agenda-place">Le lieu \xB7 facultatif</label><input id="agenda-place" maxlength="300"><label for="agenda-note">Mes pr\xE9cisions \xB7 facultatif</label><textarea id="agenda-note" rows="3" maxlength="4000"></textarea><label for="agenda-kind">Qui est concern\xE9 ?</label><select id="agenda-kind"><option value="personal">Moi</option><option value="together">Nous deux</option></select><label for="agenda-attendee">Adresse de la personne \xE0 inviter \xB7 facultatif</label><input id="agenda-attendee" type="email" maxlength="254" placeholder="\xC0 garder ici pour pr\xE9parer l\u2019invitation"><label for="agenda-reminder">Le rappel que je souhaite</label><select id="agenda-reminder"><option value="none">Aucun rappel</option><option value="0">\xC0 l\u2019heure du rendez-vous</option><option value="10">10 minutes avant</option><option value="30" selected>30 minutes avant</option><option value="60">1 heure avant</option><option value="1440">La veille</option></select><p class="inline-note">Le rendez-vous sera gard\xE9 ici. Les alertes du t\xE9l\xE9phone et le partage automatique restent \xE0 raccorder \xE0 ton agenda. Rien n\u2019est envoy\xE9 en gardant ce formulaire.</p><p id="agenda-error" class="error" role="alert"></p><button id="agenda-save" class="button primary full">Garder ce rendez-vous</button></form><section id="agenda-actions" hidden><div class="button-row"><button id="agenda-ics" class="button secondary">Exporter pour mon agenda (.ics)</button><button id="agenda-share" class="button secondary">Pr\xE9parer le partage</button></div><p class="small muted">Le fichier doit \xEAtre import\xE9 dans ton agenda. Les rappels d\xE9pendent de cet agenda et de ses autorisations. L\u2019import ne synchronise pas les changements et n\u2019envoie pas d\u2019invitation.</p><button id="agenda-remove" class="text-button danger">Retirer ce rendez-vous</button></section></dialog><dialog id="share-dialog" aria-labelledby="share-title"><div class="dialog-top"><span class="eyebrow">UN PARTAGE QUE TU CHOISIS</span><button class="icon-button" data-close="share-dialog" aria-label="Fermer">${icon2("close")}</button></div><h2 id="share-title">Pr\xE9parer notre rendez-vous.</h2><p class="muted">V\xE9rifie le texte, puis choisis toi-m\xEAme son destinataire. Ce message ne cr\xE9e pas d\u2019alerte automatique.</p><label for="share-text">Le message \xE0 partager</label><textarea id="share-text" rows="8" readonly></textarea><p id="share-status" role="status" class="small"></p><div class="button-row"><button id="share-copy" class="button secondary">Copier le message</button><button id="share-native" class="button primary">Choisir o\xF9 le partager</button></div></dialog>`);
  function home2() {
    const s = getState(), next = upcoming(s.agenda || []).slice(0, 2);
    return `<section class="daily-grid">${s.comfort !== false ? `<article class="daily-phrase"><span class="eyebrow">UNE PENS\xC9E POUR AUJOURD\u2019HUI</span><blockquote>${esc2(phraseForDay())}</blockquote><small>${esc2(longDate(dayKey()))} \xB7 lecture \xE0 l\u2019ouverture</small><button class="text-button" data-comfort="hide">Masquer ces phrases</button></article>` : ""}<article class="daily-agenda"><div class="section-top"><h2>\xC0 venir</h2><a class="text-button" href="#agenda">Mon agenda</a></div>${next.length ? next.map(row).join("") : '<p class="muted small">Une place pour tes rendez-vous, tes envies et les moments \xE0 deux.</p>'}<button class="text-button" data-agenda-new>Ajouter un rendez-vous</button></article></section>`;
  }
  function page2() {
    const events = getState().agenda || [], start = new Date(month.getFullYear(), month.getMonth(), 1), offset = (start.getDay() + 6) % 7, days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const buttons = Array.from({ length: offset }, () => "<span></span>");
    for (let day = 1; day <= days; day++) {
      const key = dayKey(new Date(month.getFullYear(), month.getMonth(), day)), count = events.filter((i) => i.start.slice(0, 10) === key).length;
      buttons.push(`<button class="calendar-day ${key === dayKey() ? "today" : ""}" data-day="${key}" aria-label="${esc2(longDate(key))}${count ? ", " + count + " rendez-vous" : ""}" aria-pressed="${selected === key}">${day}${count ? '<span class="calendar-dot" aria-hidden="true"></span>' : ""}</button>`);
    }
    const list = events.filter((i) => i.start.slice(0, 10) === selected).sort((a, b) => a.startUTC.localeCompare(b.startUTC));
    return `<section class="intro-row page-head"><div><span class="eyebrow">DU TEMPS POUR CE QUI COMPTE</span><h1>Mon agenda.</h1><p>Mes rendez-vous, mes moments \xE0 moi et ceux que nous voulons partager.</p></div><button class="button primary" data-agenda-new>${icon2("plus")}Ajouter un rendez-vous</button></section><div class="two-column"><section class="calendar-panel"><div class="calendar-month"><button class="icon-button" data-month="-1" aria-label="Mois pr\xE9c\xE9dent">\u2039</button><h2>${esc2(new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(month))}</h2><button class="icon-button" data-month="1" aria-label="Mois suivant">\u203A</button></div><div class="calendar-week" aria-hidden="true">${["L", "M", "M", "J", "V", "S", "D"].map((x) => "<span>" + x + "</span>").join("")}</div><div class="calendar-grid">${buttons.join("")}</div><button class="text-button" data-calendar-today>Aujourd\u2019hui</button></section><section><div class="section-top"><h2>${esc2(longDate(selected))}</h2></div>${list.length ? list.map(row).join("") : '<p class="empty">Rien de pr\xE9vu pour ce jour. Tu peux aussi garder du temps libre.</p>'}</section></div><section class="connection-note"><span class="eyebrow">ALERTES ET AGENDA PARTAG\xC9</span><h3>Le raccord \xE0 ton agenda reste \xE0 activer.</h3><p>Les rendez-vous sont conserv\xE9s sur cet appareil. Pour recevoir des alertes m\xEAme quand ojO est ferm\xE9, et pr\xE9venir Nicolas automatiquement, il faut raccorder l\u2019agenda que vous choisissez et v\xE9rifier les notifications sur vos deux t\xE9l\xE9phones.</p><p>Cette version n\u2019envoie encore aucune alerte quotidienne ni invitation automatique. Une exportation ou un message pr\xE9par\xE9 ne signifie pas qu\u2019une notification est activ\xE9e.</p></section><section class="daily-phrase preference-phrase"><span class="eyebrow">MA PHRASE DU JOUR</span><blockquote>${esc2(phraseForDay())}</blockquote><button class="text-button" data-comfort="${getState().comfort === false ? "show" : "hide"}">${getState().comfort === false ? "Afficher ces phrases \xE0 l\u2019accueil" : "Masquer ces phrases \xE0 l\u2019accueil"}</button></section>`;
  }
  function open2(id = null) {
    editing = id;
    $2("#agenda-form").reset();
    $2("#agenda-error").textContent = "";
    const item = (getState().agenda || []).find((i) => i.id === id), times = item ? appointmentFormTimes(item) : null;
    $2("#agenda-title").value = item?.title || "";
    $2("#agenda-start").value = times?.start || selected + "T09:00";
    $2("#agenda-end").value = times?.end || selected + "T10:00";
    $2("#agenda-place").value = item?.place || "";
    $2("#agenda-note").value = item?.note || "";
    $2("#agenda-kind").value = item?.kind || "personal";
    $2("#agenda-attendee").value = item?.attendee || "";
    $2("#agenda-reminder").value = item?.reminder === null ? "none" : String(item?.reminder ?? 30);
    $2("#agenda-actions").hidden = !item;
    $2("#agenda-dialog").showModal();
    $2("#agenda-title").focus();
  }
  $2("#agenda-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $2("#agenda-save").disabled = true;
    try {
      const previous = (getState().agenda || []).find((i) => i.id === editing);
      const item = makeAppointment({ title: $2("#agenda-title").value, start: $2("#agenda-start").value, end: $2("#agenda-end").value, place: $2("#agenda-place").value, note: $2("#agenda-note").value, kind: $2("#agenda-kind").value, attendee: $2("#agenda-attendee").value, reminder: $2("#agenda-reminder").value === "none" ? null : Number($2("#agenda-reminder").value), ...previous ? { id: previous.id, createdAt: previous.createdAt, previous } : {} });
      const next = structuredClone(getState());
      next.agenda = [item, ...(next.agenda || []).filter((i) => i.id !== item.id)];
      await persist2(next);
      selected = item.start.slice(0, 10);
      month = /* @__PURE__ */ new Date(selected + "T12:00:00");
      month.setDate(1);
      $2("#agenda-dialog").close();
      render2();
      toast2("Rendez-vous gard\xE9 sur cet appareil. Aucun envoi automatique.");
    } catch (error) {
      $2("#agenda-error").textContent = error.message;
    } finally {
      $2("#agenda-save").disabled = false;
    }
  });
  $2("#agenda-ics").addEventListener("click", () => {
    try {
      const item = getState().agenda.find((i) => i.id === editing);
      download2(new Blob([calendarFile([item])], { type: "text/calendar;charset=utf-8" }), "mon-rendez-vous-ojo.ics");
      toast2("Fichier pr\xE9par\xE9. Importe-le dans l\u2019agenda de ton choix.");
    } catch (error) {
      $2("#agenda-error").textContent = error.message;
    }
  });
  $2("#agenda-share").addEventListener("click", () => {
    const item = getState().agenda.find((i) => i.id === editing);
    $2("#share-text").value = appointmentShareText(item);
    $2("#share-status").textContent = "Aucun message envoy\xE9.";
    $2("#share-native").hidden = !navigator.share;
    $2("#share-dialog").showModal();
  });
  $2("#share-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($2("#share-text").value);
      $2("#share-status").textContent = "Message copi\xE9. Choisis son destinataire dans ta messagerie.";
    } catch {
      $2("#share-status").textContent = "S\xE9lectionne le texte et copie-le depuis ton t\xE9l\xE9phone.";
    }
  });
  $2("#share-native").addEventListener("click", async () => {
    try {
      await navigator.share({ title: "Notre rendez-vous", text: $2("#share-text").value });
      $2("#share-status").textContent = "Partage confi\xE9 \xE0 ton t\xE9l\xE9phone. La r\xE9ception n\u2019est pas v\xE9rifi\xE9e ici.";
    } catch (e) {
      if (e.name !== "AbortError") $2("#share-status").textContent = "Le partage est indisponible. Tu peux copier le message.";
    }
  });
  $2("#agenda-remove").addEventListener("click", async () => {
    if (!confirm("Retirer ce rendez-vous ? Il reste r\xE9cup\xE9rable dans les sauvegardes r\xE9centes de cet espace.")) return;
    try {
      const next = structuredClone(getState());
      next.agenda = next.agenda.filter((i) => i.id !== editing);
      await persist2(next);
      $2("#agenda-dialog").close();
      render2();
      toast2("Rendez-vous retir\xE9 de cet appareil. Aucun agenda ext\xE9rieur modifi\xE9.");
    } catch (e) {
      $2("#agenda-error").textContent = e.message;
    }
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-agenda-new")) {
      open2();
      return;
    }
    if (b.dataset.appointment) {
      open2(b.dataset.appointment);
      return;
    }
    if (b.dataset.day) {
      selected = b.dataset.day;
      render2();
      return;
    }
    if (b.dataset.month) {
      month = new Date(month.getFullYear(), month.getMonth() + Number(b.dataset.month), 1);
      render2();
      return;
    }
    if (b.hasAttribute("data-calendar-today")) {
      selected = dayKey();
      month = new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1);
      render2();
      return;
    }
    if (b.dataset.comfort) {
      try {
        const next = structuredClone(getState());
        next.comfort = b.dataset.comfort === "show";
        await persist2(next);
        render2();
      } catch (error) {
        toast2(error.message);
      }
    }
  });
  return { home: home2, page: page2 };
}

// docs/helene/vendor/legad-vault.mjs
var FORMAT2 = "legad-encrypted-v3";
var ITERATIONS = 6e5;
var CHUNK = 1024 * 1024;
var MAX_FILE2 = 50 * 1024 * 1024;
var MAX_BACKUP = 192 * 1024 * 1024;
var te = new TextEncoder();
var td = new TextDecoder();
var assert2 = (v, m) => {
  if (!v) throw new Error(m);
};
function b642(bytes2) {
  const a = new Uint8Array(bytes2);
  let s = "";
  for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode(...a.subarray(i, i + 32768));
  return btoa(s);
}
function un642(s, max = MAX_BACKUP) {
  assert2(typeof s === "string" && s.length <= Math.ceil(max * 4 / 3) + 4 && /^[A-Za-z0-9+/]*={0,2}$/.test(s) && s.length % 4 === 0, "Codificaci\xF3n no v\xE1lida");
  const t = atob(s);
  return Uint8Array.from(t, (c) => c.charCodeAt(0));
}
async function sha2562(bytes2) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes2)), (b) => b.toString(16).padStart(2, "0")).join("");
}
var random = (n) => crypto.getRandomValues(new Uint8Array(n));
var uuid = () => crypto.randomUUID();
var clone = (x) => structuredClone(x);
async function aes(raw, usages = ["encrypt", "decrypt"]) {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, usages);
}
async function derive(pass, kdf) {
  assert2(typeof pass === "string" && pass.length >= 12 && pass.length <= 1024, "Usa una frase de 12 a 1024 caracteres");
  const salt = un642(kdf.salt, 32);
  assert2(salt.length === 16, "Sal no v\xE1lida");
  assert2(kdf.name === "PBKDF2" && kdf.hash === "SHA-256" && kdf.iterations === ITERATIONS, "Derivaci\xF3n no compatible");
  const key = await crypto.subtle.importKey("raw", te.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: kdf.hash, iterations: kdf.iterations, salt }, key, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function seal(key, bytes2, context) {
  const iv = random(12);
  return { iv: b642(iv), cipher: b642(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: te.encode(context) }, key, bytes2)) };
}
async function open(key, record, context) {
  assert2(record && typeof record === "object", "Bloque ausente");
  const iv = un642(record.iv, 12);
  assert2(iv.length === 12, "IV no v\xE1lido");
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: te.encode(context) }, key, un642(record.cipher)));
}
var sealJSON = (key, x, c) => seal(key, te.encode(JSON.stringify(x)), c);
async function openJSON(key, x, c) {
  return JSON.parse(td.decode(await open(key, x, c)));
}
function prefix(v) {
  return FORMAT2 + ":" + v.id;
}
function validateEnvelope(v) {
  assert2(v && v.format === FORMAT2 && v.version === 3 && typeof v.id === "string" && /^[0-9a-f-]{36}$/.test(v.id), "Formato de cofre no reconocido");
  assert2(v.cipher === "AES-256-GCM" && v.kdf && Number.isInteger(v.revision) && v.revision >= 0, "Cabecera no v\xE1lida");
  assert2(Array.isArray(v.records) && v.records.length <= 1e4 && v.profile && v.manifest && v.keyWrap, "Cofre incompleto");
  assert2(new Set(v.records.map((x) => x?.id)).size === v.records.length, "Identificadores duplicados");
  let size = 0;
  for (const r of v.records) {
    assert2(typeof r.id === "string" && /^[0-9a-f-]{36}$/.test(r.id) && r.meta && Array.isArray(r.media), "Recuerdo no v\xE1lido");
    assert2(r.media.length <= 20, "Demasiados archivos");
    for (const m of r.media) {
      assert2(typeof m.id === "string" && /^[0-9a-f-]{36}$/.test(m.id) && Array.isArray(m.chunks) && m.chunks.length <= 50, "Archivo no v\xE1lido");
      for (const c of m.chunks) {
        assert2(typeof c?.cipher === "string" && c.cipher.length <= Math.ceil((CHUNK + 16) * 4 / 3) + 4, "Fragmento no v\xE1lido");
        size += c.cipher.length;
        assert2(size <= MAX_BACKUP, "Cofre demasiado grande");
      }
    }
  }
  return v;
}
async function refreshManifest(v, key) {
  v.manifest = await sealJSON(key, { revision: v.revision, access: await sha2562(te.encode(JSON.stringify({ id: v.id, version: v.version, cipher: v.cipher, kdf: v.kdf, keyWrap: v.keyWrap, recoveryWrap: v.recoveryWrap, createdAt: v.createdAt }))), profile: await sha2562(te.encode(JSON.stringify(v.profile))), records: await Promise.all(v.records.map(async (r) => ({ id: r.id, sha256: await sha2562(te.encode(JSON.stringify(r))) }))) }, prefix(v) + ":manifest");
  return v;
}
async function verifyManifest(v, key) {
  const m = await openJSON(key, v.manifest, prefix(v) + ":manifest");
  assert2(m.revision === v.revision && m.access === await sha2562(te.encode(JSON.stringify({ id: v.id, version: v.version, cipher: v.cipher, kdf: v.kdf, keyWrap: v.keyWrap, recoveryWrap: v.recoveryWrap, createdAt: v.createdAt }))) && m.profile === await sha2562(te.encode(JSON.stringify(v.profile))) && Array.isArray(m.records) && m.records.length === v.records.length, "\xCDndice de integridad no v\xE1lido");
  for (let i = 0; i < v.records.length; i++) assert2(m.records[i].id === v.records[i].id && m.records[i].sha256 === await sha2562(te.encode(JSON.stringify(v.records[i]))), "El cofre se ha modificado o est\xE1 incompleto");
}
async function createVault(pass, { name = "Mon coffre personnel" } = {}) {
  const id = uuid(), raw = random(32), salt = random(16), recovery = random(32), v = { format: FORMAT2, version: 3, id, cipher: "AES-256-GCM", kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS, salt: b642(salt) }, revision: 0, records: [], createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  const key = await aes(raw), p = prefix(v);
  v.keyWrap = await seal(await derive(pass, v.kdf), raw, p + ":key");
  v.recoveryWrap = await seal(await aes(recovery), raw, p + ":recovery");
  v.profile = await sealJSON(key, { name: String(name).slice(0, 100), createdAt: v.createdAt, beneficiaries: [], contributionsPrivate: true, ownerIntentRecorded: true }, p + ":profile");
  await refreshManifest(v, key);
  raw.fill(0);
  return { vault: v, key, recoveryCode: "LEGAD3-" + b642(recovery).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") };
}
async function unlockVault(v, secret, { recovery = false, full = true } = {}) {
  validateEnvelope(v);
  let raw;
  try {
    if (recovery) {
      assert2(typeof secret === "string" && /^LEGAD3-[A-Za-z0-9_-]{43}$/.test(secret.trim()), "Clave de recuperaci\xF3n no v\xE1lida");
      const s = secret.trim().slice(7).replace(/-/g, "+").replace(/_/g, "/") + "=";
      const r = un642(s, 32);
      raw = await open(await aes(r), v.recoveryWrap, prefix(v) + ":recovery");
      r.fill(0);
    } else raw = await open(await derive(secret, v.kdf), v.keyWrap, prefix(v) + ":key");
  } catch (e) {
    throw new Error(recovery ? "No se pudo recuperar: clave o cofre incorrectos" : "No se pudo abrir: frase incorrecta o cofre alterado");
  }
  const key = await aes(raw);
  raw.fill(0);
  await verifyManifest(v, key);
  const profile = await openJSON(key, v.profile, prefix(v) + ":profile");
  const items = await readItems(v, key);
  if (full) for (const item of items) for (const m of item.attachments) await readMedia(v, key, item.id, m.id);
  return { vault: clone(v), key, profile, items };
}
async function readItems(v, key) {
  return Promise.all(v.records.map(async (r) => {
    const i = await openJSON(key, r.meta, prefix(v) + ":memory:" + r.id);
    assert2(i.id === r.id && typeof i.title === "string" && typeof i.note === "string" && Array.isArray(i.attachments), "Metadatos no v\xE1lidos");
    assert2(i.attachments.length === r.media.length && new Set(i.attachments.map((x) => x.id)).size === i.attachments.length, "\xCDndice de archivos no v\xE1lido");
    for (const a of i.attachments) {
      assert2(r.media.some((m) => m.id === a.id) && Number.isSafeInteger(a.size) && a.size > 0 && a.size <= MAX_FILE2 && /^[a-f0-9]{64}$/.test(a.sha256) && typeof a.name === "string" && typeof a.type === "string", "Metadatos de original no v\xE1lidos");
    }
    return i;
  }));
}
async function addMemory(v, key, data, files = []) {
  assert2(files.length <= 20, "M\xE1ximo 20 archivos por recuerdo");
  assert2(String(data.title || "").trim().length > 0, "Escribe un t\xEDtulo");
  assert2(String(data.note || "").length <= 1e5, "El texto es demasiado largo");
  const next = clone(v), id = uuid(), createdAt = (/* @__PURE__ */ new Date()).toISOString(), attachments = [], media = [];
  for (const file of files) {
    assert2(file instanceof Blob && file.size > 0 && file.size <= MAX_FILE2, "Cada original debe contener datos y ocupar como m\xE1ximo 50 MB");
    const mid = uuid(), bytes2 = new Uint8Array(await file.arrayBuffer()), hash = await sha2562(bytes2), chunks = [];
    for (let start = 0, index = 0; start < bytes2.length; start += CHUNK, index++) chunks.push(await seal(key, bytes2.subarray(start, start + CHUNK), prefix(v) + ":media:" + id + ":" + mid + ":" + index));
    attachments.push({ id: mid, name: String(file.name || "original").slice(0, 500), type: String(file.type || "application/octet-stream").slice(0, 200), size: file.size, lastModified: file.lastModified || null, sha256: hash, provenance: { producer: "user", channel: data.demo ? "synthetic_demo" : data.channel || "file_import", sourceTimestamp: createdAt, nativeAdmission: false, original: true } });
    media.push({ id: mid, chunks });
  }
  const item = { id, title: String(data.title).trim().slice(0, 200), note: String(data.note || ""), date: String(data.date || createdAt.slice(0, 10)), createdAt, kind: attachments[0]?.type.split("/")[0] || "text", people: String(data.people || "").slice(0, 1e3), collection: String(data.collection || "Mes documents").slice(0, 200), symbolicOpening: String(data.symbolicOpening || ""), capsule: !!data.capsule, demo: !!data.demo, consent: { owner: !!data.ownerConsent, recordedPeople: !!data.peopleConsent, scope: "private_vault_only", recordedAt: createdAt, externallyVerified: false }, derivatives: [], attachments, links: Array.isArray(data.links) ? data.links.filter((x) => v.records.some((r) => r.id === x)).slice(0, 50) : [], authoring: "user_provided", visibility: "vault_holders_only" };
  assert2(item.demo || item.consent.owner && (!item.people || item.consent.recordedPeople), "Confirma los permisos para conservar este recuerdo");
  next.records.unshift({ id, meta: await sealJSON(key, item, prefix(v) + ":memory:" + id), media });
  next.revision++;
  await refreshManifest(next, key);
  validateEnvelope(next);
  return { vault: next, item };
}
async function readMedia(v, key, itemId, mediaId) {
  const r = v.records.find((x) => x.id === itemId);
  assert2(r, "Recuerdo no encontrado");
  const item = await openJSON(key, r.meta, prefix(v) + ":memory:" + r.id), meta = item.attachments.find((x) => x.id === mediaId), m = r.media.find((x) => x.id === mediaId);
  assert2(meta && m, "Original no encontrado");
  let total = 0;
  const parts = [];
  for (let i = 0; i < m.chunks.length; i++) {
    const bytes2 = await open(key, m.chunks[i], prefix(v) + ":media:" + itemId + ":" + mediaId + ":" + i);
    total += bytes2.length;
    assert2(total <= MAX_FILE2, "Original demasiado grande");
    parts.push(bytes2);
  }
  const blob = new Blob(parts, { type: meta.type });
  assert2(blob.size === meta.size && await sha2562(await blob.arrayBuffer()) === meta.sha256, "La huella del original no coincide");
  return blob;
}
async function deleteMemory(v, key, id) {
  const next = clone(v);
  assert2(next.records.some((r) => r.id === id), "Recuerdo no encontrado");
  next.records = next.records.filter((r) => r.id !== id);
  for (const r of next.records) {
    const item = await openJSON(key, r.meta, prefix(v) + ":memory:" + r.id);
    if (item.links.includes(id)) {
      item.links = item.links.filter((x) => x !== id);
      r.meta = await sealJSON(key, item, prefix(v) + ":memory:" + r.id);
    }
  }
  next.revision++;
  return refreshManifest(next, key);
}
async function exportVault(v) {
  validateEnvelope(v);
  const data = clone(v);
  assert2(JSON.stringify(data).length < MAX_BACKUP - 1024, "Le cofre supera el l\xEDmite de exportaci\xF3n de esta versi\xF3n");
  const checksum = await sha2562(te.encode(JSON.stringify(data)));
  return JSON.stringify({ format: "legad-backup-v3", exportedAt: (/* @__PURE__ */ new Date()).toISOString(), checksumAlgorithm: "SHA-256", checksum, vault: data });
}
async function parseBackup(text) {
  assert2(typeof text === "string" && text.length <= MAX_BACKUP, "Copia demasiado grande");
  const o = JSON.parse(text);
  assert2(o.format === "legad-backup-v3" && o.checksumAlgorithm === "SHA-256", "Formato de copia no reconocido");
  assert2(o.checksum === await sha2562(te.encode(JSON.stringify(o.vault))), "Copia incompleta o alterada");
  return validateEnvelope(o.vault);
}
var VaultStore = class {
  constructor(name = "legad-family-v3") {
    this.name = name;
    this.connection = null;
  }
  async db() {
    if (this.connection) return this.connection;
    return this.connection = await new Promise((resolve, reject) => {
      const r = indexedDB.open(this.name, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("vaults");
        r.result.createObjectStore("settings");
      };
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        r.result.onversionchange = () => {
          r.result.close();
          this.connection = null;
        };
        resolve(r.result);
      };
    });
  }
  async active() {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const t = db.transaction(["settings", "vaults"]), r = t.objectStore("settings").get("active");
      let value = null;
      r.onsuccess = () => {
        if (r.result) {
          const q = t.objectStore("vaults").get(r.result);
          q.onsuccess = () => value = q.result;
        }
      };
      t.oncomplete = () => resolve(value);
      t.onabort = () => reject(t.error);
    });
  }
  async save(v, expected = null) {
    validateEnvelope(v);
    const expectedJSON = expected === null ? null : JSON.stringify(expected);
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const t = db.transaction(["vaults", "settings"], "readwrite"), s = t.objectStore("vaults"), r = s.get(v.id);
      let conflict2 = false;
      r.onsuccess = () => {
        if (expected === null ? r.result : !r.result || JSON.stringify(r.result) !== expectedJSON) {
          conflict2 = true;
          t.abort();
          return;
        }
        s.put(v, v.id);
        t.objectStore("settings").put(v.id, "active");
      };
      t.oncomplete = () => resolve();
      t.onabort = () => reject(new Error(conflict2 ? "El cofre cambi\xF3 en otra pesta\xF1a. Ci\xE9rralo y vuelve a abrirlo." : t.error?.message || "No se pudo guardar; conserva una copia externa"));
    });
  }
  async restore(v) {
    validateEnvelope(v);
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const t = db.transaction(["vaults", "settings"], "readwrite"), s = t.objectStore("vaults"), q = s.get(v.id);
      q.onsuccess = () => {
        if (q.result) {
          const archived = clone(q.result);
          s.put(archived, "preserved-" + uuid());
        }
        s.put(v, v.id);
        t.objectStore("settings").put(v.id, "active");
      };
      t.oncomplete = () => resolve();
      t.onabort = () => reject(t.error);
    });
  }
  async preserved() {
    const active = await this.active();
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const t = db.transaction("vaults"), r = t.objectStore("vaults").openCursor(), out = [];
      r.onsuccess = () => {
        const c = r.result;
        if (!c) return;
        if (c.key !== active?.id) out.push({ storageKey: c.key, vault: c.value });
        c.continue();
      };
      t.oncomplete = () => resolve(out);
      t.onabort = () => reject(t.error);
    });
  }
  async remove(id) {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const t = db.transaction(["vaults", "settings"], "readwrite"), s = t.objectStore("vaults"), r = s.openCursor();
      r.onsuccess = () => {
        const c = r.result;
        if (!c) return;
        if (c.value?.id === id) c.delete();
        c.continue();
      };
      const q = t.objectStore("settings").get("active");
      q.onsuccess = () => {
        if (q.result === id) t.objectStore("settings").delete("active");
      };
      t.oncomplete = () => resolve();
      t.onabort = () => reject(t.error);
    });
  }
  close() {
    this.connection?.close();
    this.connection = null;
  }
};

// docs/helene/vault-ui.mjs
var MAX_ORIGINAL = 8 * 1024 * 1024;
var MAX_CONTENT = 30 * 1024 * 1024;
var MAX_IMPORT = 64 * 1024 * 1024;
function privateVaultUI({ render: render2, esc: esc2, icon: icon2, download: download2, toast: toast2 }) {
  const $2 = (s) => document.querySelector(s), store = new VaultStore("ojo-helene-private-v1");
  let envelope = null, opened = null, loading = true, busy2 = false, filter2 = "all", recoveryCode = "", epoch = 0, pendingRestore = null, idle = null, hiddenAt = null, backgroundTimer = null;
  const urls = /* @__PURE__ */ new Set();
  const labels = { document: "Document", photo: "Photo", doctor: "M\xE9decin" };
  const size = (n) => n < 1024 * 1024 ? (n / 1024).toFixed(1) + " Ko" : (n / 1024 / 1024).toFixed(1) + " Mo";
  function message(e) {
    const text = String(e?.message || "");
    if (/cambió/.test(text)) return "Le coffre a chang\xE9 dans un autre onglet. Verrouille-le puis ouvre-le de nouveau.";
    if (/frase incorrecta|clave o cofre|incorrectos|alterado|OperationError/.test(text)) return "Ouverture refus\xE9e : v\xE9rifie ta phrase ou ton code. Un coffre incomplet ou alt\xE9r\xE9 est aussi refus\xE9.";
    if (/Quota|quota|space/i.test(text)) return "Le stockage de cet appareil est plein. Garde une copie chiffr\xE9e avant de lib\xE9rer de la place.";
    if (/^[\p{L}\s’.,:;!?\-0-9()]+$/u.test(text) && /[èéêàçùœ]/.test(text)) return text;
    return "L\u2019action n\u2019a pas abouti. Le contenu d\xE9j\xE0 enregistr\xE9 est conserv\xE9. V\xE9rifie ta saisie ou ta copie et r\xE9essaie.";
  }
  function body(item) {
    try {
      const value = JSON.parse(item.note);
      if (value.format === "ojo-private-record-v1" && ["document", "photo", "doctor"].includes(value.kind)) return value;
    } catch {
    }
    return { kind: "document", note: item.note, doctor: null };
  }
  function clearURLs() {
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
  }
  function lock(quiet = false) {
    epoch++;
    opened = null;
    recoveryCode = "";
    pendingRestore = null;
    clearTimeout(idle);
    clearURLs();
    for (const id of ["vault-pass", "vault-pass-confirm", "vault-restore-pass"]) {
      const input = $2("#" + id);
      if (input) input.value = "";
    }
    for (const id of ["vault-record-dialog", "vault-item-dialog", "vault-recovery-dialog", "vault-restore-dialog"]) {
      const dialog = $2("#" + id);
      if (dialog?.open) dialog.close();
    }
    $2("#vault-item-content").replaceChildren();
    $2("#vault-record-form").reset();
    if (location.hash === "#coffre") render2();
    if (!quiet) toast2("Ton coffre est verrouill\xE9.");
  }
  function arm() {
    clearTimeout(idle);
    if (opened) idle = setTimeout(() => lock(), 5 * 60 * 1e3);
  }
  for (const event of ["pointerdown", "keydown"]) document.addEventListener(event, arm, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (!opened) for (const id of ["vault-pass", "vault-pass-confirm", "vault-restore-pass"]) {
        const input = $2("#" + id);
        if (input) input.value = "";
      }
      hiddenAt = Date.now();
      if (opened) backgroundTimer = setTimeout(() => lock(true), 6e4);
    } else {
      clearTimeout(backgroundTimer);
      if (opened && hiddenAt && Date.now() - hiddenAt >= 6e4) lock(true);
      hiddenAt = null;
      arm();
    }
  });
  window.addEventListener("pagehide", () => {
    lock(true);
    store.close();
  });
  document.body.insertAdjacentHTML("beforeend", `<dialog id="vault-record-dialog" aria-labelledby="vault-record-title"><div class="dialog-top"><span class="eyebrow">DANS MON COFFRE</span><button class="icon-button" data-close="vault-record-dialog" aria-label="Fermer">${icon2("close")}</button></div><h2 id="vault-record-title">Garder quelque chose pour moi.</h2><form id="vault-record-form"><label for="vault-kind">Ce que je garde</label><select id="vault-kind"><option value="document">Un document</option><option value="photo">Une photo</option><option value="doctor">Les coordonn\xE9es d\u2019un m\xE9decin</option></select><label for="vault-title">Un nom pour le retrouver</label><input id="vault-title" maxlength="200" required><section id="doctor-fields" hidden><label for="doctor-specialty">Sp\xE9cialit\xE9 \xB7 facultatif</label><input id="doctor-specialty" maxlength="160"><label for="doctor-phone">T\xE9l\xE9phone \xB7 facultatif</label><input id="doctor-phone" type="tel" maxlength="40"><label for="doctor-address">Adresse \xB7 facultatif</label><textarea id="doctor-address" rows="2" maxlength="500"></textarea></section><label for="vault-note">Mes pr\xE9cisions \xB7 facultatif</label><textarea id="vault-note" rows="3" maxlength="10000"></textarea><label class="button secondary" for="vault-files">Choisir une photo ou un document</label><input class="sr-only" id="vault-files" type="file" multiple><p id="vault-files-list" class="small muted" role="status"></p><p class="small muted">Six originaux maximum, 8 Mo chacun. Les noms, les pr\xE9cisions et les fichiers seront chiffr\xE9s. Aucune lecture automatique du contenu.</p><p id="vault-record-error" class="error" role="alert"></p><button class="button primary full" id="vault-record-save">Garder dans mon coffre</button></form></dialog><dialog id="vault-item-dialog" aria-labelledby="vault-item-title"><div class="dialog-top"><span class="eyebrow">MON CONTENU PERSONNEL</span><button class="icon-button" data-close="vault-item-dialog" aria-label="Fermer">${icon2("close")}</button></div><div id="vault-item-content"></div><p id="vault-item-error" class="error" role="alert"></p></dialog><dialog id="vault-recovery-dialog" aria-labelledby="vault-recovery-title"><div class="dialog-top"><span class="eyebrow">\xC0 GARDER S\xC9PAR\xC9MENT</span><button class="icon-button" data-close="vault-recovery-dialog" aria-label="Fermer">${icon2("close")}</button></div><h2 id="vault-recovery-title">Ta cl\xE9 de secours.</h2><p class="muted">Elle permet d\u2019ouvrir une copie de ton coffre si tu oublies ta phrase. Garde-la dans un autre endroit s\xFBr, s\xE9par\xE9ment du fichier du coffre.</p><p class="hash recovery-code" id="vault-recovery-code"></p><button class="button secondary" id="vault-recovery-download">Garder mon code de secours</button><p class="small muted">Ce code donne acc\xE8s au coffre. Il n\u2019est pas conserv\xE9 par ojO. Ne le publie pas et ne l\u2019envoie pas avec ta copie.</p></dialog><dialog id="vault-restore-dialog" aria-labelledby="vault-restore-title"><div class="dialog-top"><span class="eyebrow">V\xC9RIFIER AVANT DE RESTAURER</span><button class="icon-button" data-close="vault-restore-dialog" aria-label="Fermer">${icon2("close")}</button></div><h2 id="vault-restore-title">Retrouver mon coffre.</h2><p class="muted">La copie reste sur cet appareil. Elle sera ouverte et ses originaux seront v\xE9rifi\xE9s avant son enregistrement.</p><form id="vault-restore-form"><label for="vault-restore-pass">La phrase de cette copie, ou son code de secours</label><input type="password" id="vault-restore-pass" maxlength="1024" autocomplete="off" required><div class="setting-row"><span>J\u2019utilise le code de secours</span><input type="checkbox" id="vault-restore-recovery" aria-label="J\u2019utilise le code de secours pour la copie"></div><p class="small muted">Le coffre pr\xE9c\xE9dent reste conserv\xE9 sur cet appareil. Tu peux le retrouver avec \xAB Coffres pr\xE9c\xE9dents \xBB.</p><p id="vault-restore-error" class="error" role="alert"></p><button class="button primary full" id="vault-restore-submit">V\xE9rifier et restaurer</button></form></dialog><input class="sr-only" type="file" id="vault-import" accept="application/json,.json">`);
  store.active().then((v) => {
    envelope = v;
    loading = false;
    if (location.hash === "#coffre") render2();
  }).catch((e) => {
    loading = false;
    if (location.hash === "#coffre") render2();
    toast2(message(e));
  });
  function page2() {
    const intro = `<section class="intro-row page-head"><div><span class="eyebrow">CE QUI RESTE \xC0 MOI</span><h1>Mon coffre.</h1><p>Mes documents personnels, mes photos et les coordonn\xE9es de mes m\xE9decins.</p></div>${opened ? `<button class="button secondary" data-vault-lock>${icon2("lock")}Verrouiller</button>` : ""}</section>`;
    const rules = `<details><summary>Comment mes \xE9l\xE9ments sont-ils prot\xE9g\xE9s ?</summary><p class="small muted">Le contenu de ce coffre est chiffr\xE9 sur cet appareil avant d\u2019\xEAtre enregistr\xE9. La phrase et la cl\xE9 d\u2019ouverture ne sont pas envoy\xE9es ni conserv\xE9es apr\xE8s verrouillage. Cette version n\u2019envoie aucun contenu du coffre \xE0 un serveur, \xE0 une IA ou \xE0 un service d\u2019analyse.</p><p class="small muted">Le coffre se verrouille \xE0 la fermeture de la page, apr\xE8s cinq minutes sans activit\xE9 ou \xE0 ton retour apr\xE8s une minute en arri\xE8re-plan. Une personne qui utilise ton appareil pendant qu\u2019il est ouvert peut voir le contenu. Les notes de \xAB Mes \xE9l\xE9ments \xBB et l\u2019agenda restent hors du coffre. Un original t\xE9l\xE9charg\xE9 depuis le coffre devient une copie lisible sur ton appareil.</p><p class="small muted">Fais une copie chiffr\xE9e et garde ton code de secours s\xE9par\xE9ment. Si le stockage du navigateur est effac\xE9, il faut cette copie et ta phrase ou ton code pour retrouver le coffre. Aucune sauvegarde distante et aucune r\xE9cup\xE9ration par Nicolas ou ojO.</p></details>`;
    if (loading) return intro + '<p class="empty">Je retrouve ton coffre sur cet appareil\u2026</p>';
    if (!opened) return intro + `<section class="vault-entry"><span class="vault-symbol">${icon2("lock")}</span><h2>${envelope ? "Ouvrir mon coffre." : "Une place prot\xE9g\xE9e pour mes affaires."}</h2><p class="muted">${envelope ? "Ta phrase reste sur cet appareil." : "Choisis une phrase secr\xE8te que toi seule gardes. Une phrase de plusieurs mots est plus facile \xE0 retenir."}</p><form id="vault-open-form"><label for="vault-pass">${envelope ? "Ma phrase secr\xE8te ou mon code de secours" : "Ma phrase secr\xE8te \xB7 12 caract\xE8res minimum"}</label><input id="vault-pass" type="password" minlength="12" maxlength="1024" required autocomplete="off">${envelope ? '<div class="setting-row"><span>J\u2019utilise mon code de secours</span><input type="checkbox" id="vault-use-recovery" aria-label="J\u2019utilise mon code de secours"></div>' : '<label for="vault-pass-confirm">Je confirme ma phrase</label><input id="vault-pass-confirm" type="password" minlength="12" maxlength="1024" required autocomplete="off"><p class="small muted">Sans ta phrase ni ton code de secours, ce coffre ne pourra pas \xEAtre ouvert. OjO ne re\xE7oit ni l\u2019une ni l\u2019autre.</p>'}<p class="error" id="vault-open-error" role="alert"></p><button class="button primary full" id="vault-open-submit">${envelope ? "Ouvrir mon coffre" : "Cr\xE9er mon coffre sur cet appareil"}</button></form></section><div class="button-row"><label class="button secondary" for="vault-import">Restaurer une copie chiffr\xE9e</label><button class="text-button" data-vault-preserved>Coffres pr\xE9c\xE9dents sur cet appareil</button></div><div id="vault-preserved-list"></div>${rules}`;
    const items = opened.items.filter((i) => filter2 === "all" || body(i).kind === filter2);
    return intro + `<div class="vault-open-banner"><span>${icon2("check")} Coffre ouvert sur cet appareil</span><button class="button primary" data-vault-new>Ajouter un \xE9l\xE9ment</button></div><div class="chips" role="group" aria-label="Filtrer mon coffre">${[["all", "Tout"], ["document", "Documents"], ["photo", "Photos"], ["doctor", "Mes m\xE9decins"]].map(([k, label]) => `<button class="chip" data-vault-filter="${k}" aria-pressed="${filter2 === k}">${label}</button>`).join("")}</div><div class="element-grid">${items.length ? items.map((i) => `<button class="card open-card" data-vault-item="${esc2(i.id)}"><span class="tag">${labels[body(i).kind] || "Document"} \xB7 chiffr\xE9 au repos</span><h3>${esc2(i.title)}</h3><p>${i.attachments.length ? i.attachments.length + " original" + (i.attachments.length > 1 ? "s" : "") + " \xB7 " : ""}${esc2(new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(i.createdAt)))}</p></button>`).join("") : '<p class="empty">Tu choisis ce que tu veux garder ici.</p>'}</div><div class="button-row"><button class="button secondary" data-vault-export>Garder une copie chiffr\xE9e</button><label class="button secondary" for="vault-import">Restaurer une copie</label></div><p class="small muted">Cette sauvegarde du coffre est distincte de l\u2019export des notes et de l\u2019agenda.</p><div id="vault-preserved-list"></div><button class="text-button" data-vault-preserved>Coffres pr\xE9c\xE9dents sur cet appareil</button>${rules}<button class="text-button danger" data-vault-erase>Effacer ce coffre de cet appareil</button>`;
  }
  async function save(next, expected = envelope) {
    await store.save(next, expected);
    envelope = next;
    if (opened) opened.vault = next;
  }
  async function showItem(id) {
    if (!opened) return;
    clearURLs();
    const item = opened.items.find((i) => i.id === id);
    if (!item) return;
    const data = body(item), doctor = data.doctor;
    $2("#vault-item-content").innerHTML = `<h2 id="vault-item-title">${esc2(item.title)}</h2><span class="tag">${labels[data.kind] || "Document"} \xB7 dans mon coffre</span>${doctor ? `<dl class="doctor-details">${doctor.specialty ? "<dt>Sp\xE9cialit\xE9</dt><dd>" + esc2(doctor.specialty) + "</dd>" : ""}${doctor.phone ? '<dt>T\xE9l\xE9phone</dt><dd><a href="tel:' + esc2(String(doctor.phone).replace(/[^+0-9]/g, "")) + '">' + esc2(doctor.phone) + "</a></dd>" : ""}${doctor.address ? "<dt>Adresse</dt><dd>" + esc2(doctor.address) + "</dd>" : ""}</dl>` : ""}${data.note ? '<p class="original-text field-box">' + esc2(data.note) + "</p>" : ""}<div id="vault-previews"></div>${item.attachments.map((a) => `<div class="attachment">${icon2("doc")}<p>${esc2(a.name)}<br><small>${size(a.size)} \xB7 original v\xE9rifi\xE9 \xE0 l\u2019ouverture</small></p><button class="button secondary" data-vault-original="${esc2(a.id)}" data-vault-parent="${esc2(id)}">T\xE9l\xE9charger</button></div>`).join("")}<p class="small muted">Un original t\xE9l\xE9charg\xE9 quitte la protection du coffre. Choisis un endroit s\xFBr pour sa copie.</p><button class="text-button danger" data-vault-remove="${esc2(id)}">Retirer cet \xE9l\xE9ment du coffre</button>`;
    $2("#vault-item-error").textContent = "";
    $2("#vault-item-dialog").showModal();
    const current = epoch, session = opened;
    for (const attachment of item.attachments.filter((a) => ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(a.type))) {
      try {
        const blob = await readMedia(session.vault, session.key, id, attachment.id);
        if (current !== epoch || !opened) return;
        const url = URL.createObjectURL(blob);
        urls.add(url);
        const image = document.createElement("img");
        image.src = url;
        image.alt = attachment.name;
        image.className = "preview-media";
        $2("#vault-previews").append(image);
      } catch (e) {
        if (current === epoch) $2("#vault-item-error").textContent = message(e);
      }
    }
  }
  $2("#vault-item-dialog").addEventListener("close", () => {
    clearURLs();
    $2("#vault-item-content").replaceChildren();
  });
  $2("#vault-recovery-dialog").addEventListener("close", () => {
    recoveryCode = "";
    $2("#vault-recovery-code").textContent = "";
  });
  $2("#vault-record-dialog").addEventListener("close", () => {
    $2("#vault-record-form").reset();
    $2("#vault-files-list").textContent = "";
  });
  $2("#vault-kind").addEventListener("change", () => {
    $2("#doctor-fields").hidden = $2("#vault-kind").value !== "doctor";
    $2("#vault-files").accept = $2("#vault-kind").value === "photo" ? "image/*" : "";
  });
  $2("#vault-files").addEventListener("change", () => {
    $2("#vault-files-list").textContent = Array.from($2("#vault-files").files).map((f) => f.name + " \xB7 " + size(f.size)).join("\n");
  });
  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "vault-open-form") return;
    e.preventDefault();
    if (busy2) return;
    busy2 = true;
    $2("#vault-open-submit").disabled = true;
    $2("#vault-open-error").textContent = "";
    try {
      const secret = $2("#vault-pass").value, confirmPass = $2("#vault-pass-confirm");
      if (confirmPass && confirmPass.value !== secret) throw Error("Les deux phrases ne correspondent pas.");
      const current = epoch;
      if (envelope) {
        const next = await unlockVault(envelope, secret, { recovery: !!$2("#vault-use-recovery")?.checked, full: true });
        if (current !== epoch) return;
        opened = next;
      } else {
        const fresh = await createVault(secret, { name: "Mon coffre H\xE9l\xE8ne" });
        if (current !== epoch) return;
        await save(fresh.vault, null);
        if (current !== epoch) return;
        opened = { vault: fresh.vault, key: fresh.key, items: [], profile: { name: "Mon coffre H\xE9l\xE8ne" } };
        recoveryCode = fresh.recoveryCode;
      }
      $2("#vault-pass").value = "";
      if (confirmPass) confirmPass.value = "";
      arm();
      render2();
      if (recoveryCode) {
        $2("#vault-recovery-code").textContent = recoveryCode;
        $2("#vault-recovery-dialog").showModal();
      }
    } catch (error) {
      const status = $2("#vault-open-error");
      if (status) status.textContent = message(error);
    } finally {
      busy2 = false;
      const submit = $2("#vault-open-submit");
      if (submit) submit.disabled = false;
    }
  });
  $2("#vault-record-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy2 || !opened) return;
    busy2 = true;
    $2("#vault-record-save").disabled = true;
    $2("#vault-record-error").textContent = "";
    const current = epoch, session = opened;
    try {
      const files = Array.from($2("#vault-files").files), kind = $2("#vault-kind").value;
      if (files.length > 6 || files.some((f) => !f.size || f.size > MAX_ORIGINAL)) throw Error("Choisis six fichiers maximum, de un octet \xE0 8 Mo chacun.");
      if (kind === "photo" && !files.length) throw Error("Choisis au moins une photo.");
      if (session.items.reduce((sum, i) => sum + i.attachments.reduce((n, a) => n + a.size, 0), 0) + files.reduce((n, f) => n + f.size, 0) > MAX_CONTENT) throw Error("Ce coffre peut garder 30 Mo d\u2019originaux dans cette version.");
      if (session.items.length >= 200) throw Error("Ce coffre peut garder 200 \xE9l\xE9ments dans cette version.");
      const data = { format: "ojo-private-record-v1", kind, note: $2("#vault-note").value, doctor: kind === "doctor" ? { specialty: $2("#doctor-specialty").value, phone: $2("#doctor-phone").value, address: $2("#doctor-address").value } : null };
      const result = await addMemory(session.vault, session.key, { title: $2("#vault-title").value, note: JSON.stringify(data), collection: kind, ownerConsent: true, channel: "personal_import" }, files);
      if (current !== epoch) return;
      await save(result.vault, session.vault);
      if (current !== epoch) return;
      opened.items = await readItems(result.vault, session.key);
      $2("#vault-record-dialog").close();
      arm();
      render2();
      toast2("\xC9l\xE9ment chiffr\xE9 et gard\xE9 dans ton coffre.");
      await showItem(result.item.id);
    } catch (error) {
      if (current === epoch) $2("#vault-record-error").textContent = message(error);
    } finally {
      busy2 = false;
      $2("#vault-record-save").disabled = false;
    }
  });
  $2("#vault-recovery-download").addEventListener("click", () => {
    if (!recoveryCode) return;
    download2(new Blob(["Code de secours de mon coffre ojO\n\n" + recoveryCode + "\n\n\xC0 conserver s\xE9par\xE9ment de la copie chiffr\xE9e. Ce code permet d\u2019ouvrir le coffre.\n"], { type: "text/plain;charset=utf-8" }), "mon-code-de-secours-ojo.txt");
    toast2("Code pr\xE9par\xE9. Garde-le s\xE9par\xE9ment de la copie du coffre.");
  });
  $2("#vault-import").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT) throw Error("Cette copie d\xE9passe la limite de 64 Mo.");
      pendingRestore = await parseBackup(await file.text());
      $2("#vault-restore-form").reset();
      $2("#vault-restore-error").textContent = "";
      $2("#vault-restore-dialog").showModal();
    } catch (error) {
      toast2(message(error));
    }
  });
  $2("#vault-restore-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pendingRestore || busy2) return;
    busy2 = true;
    $2("#vault-restore-submit").disabled = true;
    const current = epoch;
    try {
      const next = await unlockVault(pendingRestore, $2("#vault-restore-pass").value, { recovery: $2("#vault-restore-recovery").checked, full: true });
      if (next.items.length > 200 || next.items.reduce((n, i) => n + i.attachments.reduce((m, a) => m + a.size, 0), 0) > MAX_CONTENT) throw Error("Cette copie d\xE9passe les limites de 200 \xE9l\xE9ments ou 30 Mo d\u2019originaux.");
      if (current !== epoch) return;
      await store.restore(next.vault);
      if (current !== epoch) return;
      envelope = next.vault;
      opened = next;
      pendingRestore = null;
      $2("#vault-restore-pass").value = "";
      $2("#vault-restore-dialog").close();
      arm();
      render2();
      toast2("Copie ouverte, originaux v\xE9rifi\xE9s et coffre restaur\xE9.");
    } catch (error) {
      if (current === epoch) $2("#vault-restore-error").textContent = message(error);
    } finally {
      busy2 = false;
      $2("#vault-restore-submit").disabled = false;
    }
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    try {
      if (b.hasAttribute("data-vault-lock")) {
        lock();
        return;
      }
      if (b.dataset.vaultFilter) {
        filter2 = b.dataset.vaultFilter;
        render2();
        return;
      }
      if (b.hasAttribute("data-vault-new")) {
        if (!opened) return;
        $2("#vault-record-form").reset();
        $2("#doctor-fields").hidden = true;
        $2("#vault-record-error").textContent = "";
        $2("#vault-record-dialog").showModal();
        $2("#vault-title").focus();
        return;
      }
      if (b.dataset.vaultItem) {
        await showItem(b.dataset.vaultItem);
        return;
      }
      if (b.dataset.vaultOriginal && opened) {
        const session = opened, current = epoch, item = session.items.find((i) => i.id === b.dataset.vaultParent), meta = item.attachments.find((a) => a.id === b.dataset.vaultOriginal), blob = await readMedia(session.vault, session.key, item.id, meta.id);
        if (current === epoch) download2(blob, meta.name);
        return;
      }
      if (b.hasAttribute("data-vault-export") && envelope) {
        download2(new Blob([await exportVault(envelope)], { type: "application/json" }), "mon-coffre-ojo-chiffre.json");
        toast2("Copie chiffr\xE9e pr\xE9par\xE9e. V\xE9rifie qu\u2019elle est gard\xE9e sur ton appareil.");
        return;
      }
      if (b.dataset.vaultRemove && opened) {
        if (!confirm("Retirer cet \xE9l\xE9ment du coffre ? Seule une copie du coffre export\xE9e auparavant permettra de le retrouver.")) return;
        const session = opened, current = epoch, next = await deleteMemory(session.vault, session.key, b.dataset.vaultRemove);
        if (current !== epoch) return;
        await save(next, session.vault);
        if (current !== epoch) return;
        opened.items = await readItems(next, session.key);
        $2("#vault-item-dialog").close();
        render2();
        toast2("\xC9l\xE9ment retir\xE9 du coffre sur cet appareil.");
        return;
      }
      if (b.hasAttribute("data-vault-preserved")) {
        const prior = await store.preserved(), list = $2("#vault-preserved-list");
        if (!list) return;
        list.innerHTML = prior.length ? prior.map((r, i) => `<p class="small">Coffre du ${esc2(String(r.vault.createdAt || "").slice(0, 10))} \xB7 version ${Number(r.vault.revision)} <button class="text-button" data-vault-prior="${esc2(r.storageKey)}">Retrouver ce coffre</button></p>`).join("") : '<p class="small muted">Aucun autre coffre conserv\xE9 sur cet appareil.</p>';
        return;
      }
      if (b.dataset.vaultPrior !== void 0) {
        const prior = await store.preserved(), value = prior.find((record) => record.storageKey === b.dataset.vaultPrior)?.vault;
        if (!value) return;
        lock(true);
        await store.restore(value);
        envelope = value;
        render2();
        toast2("Coffre retrouv\xE9. Utilise sa phrase pour l\u2019ouvrir.");
        return;
      }
      if (b.hasAttribute("data-vault-erase") && envelope) {
        if (!confirm("Effacer ce coffre et ses versions conserv\xE9es sur cet appareil ? Les copies export\xE9es ailleurs resteront sous ton contr\xF4le.")) return;
        if (!confirm("Confirmer l\u2019effacement d\xE9finitif de ce coffre sur cet appareil ?")) return;
        const id = envelope.id;
        lock(true);
        await store.remove(id);
        envelope = null;
        render2();
        toast2("Ce coffre a \xE9t\xE9 effac\xE9 de cet appareil.");
        return;
      }
    } catch (error) {
      toast2(message(error));
    }
  });
  async function keepConversation(request2, files = []) {
    if (!opened) throw Error("Ouvre ton coffre, puis reviens dans le chat pour y garder cette demande.");
    if (busy2) throw Error("Un enregistrement est en cours. R\xE9essaie dans un instant.");
    if (files.some((f) => !f.size || f.size > MAX_ORIGINAL) || opened.items.reduce((n, i) => n + i.attachments.reduce((m, a) => m + a.size, 0), 0) + files.reduce((n, f) => n + f.size, 0) > MAX_CONTENT) throw Error("Les originaux d\xE9passent la place disponible dans ce coffre.");
    if (opened.items.length >= 200) throw Error("Ce coffre peut garder 200 \xE9l\xE9ments dans cette version.");
    busy2 = true;
    const current = epoch, session = opened;
    try {
      const result = await addMemory(session.vault, session.key, { title: "Ma demande \xB7 " + request2.proposal.name, note: JSON.stringify({ format: "ojo-private-record-v1", kind: "document", note: request2.text + "\n\nProposition de parcours :\n" + request2.proposal.steps.join("\n"), request: request2 }), collection: "document", ownerConsent: true, channel: "universal_input" }, files);
      if (current !== epoch) throw Error("Le coffre a \xE9t\xE9 verrouill\xE9. Ouvre-le pour r\xE9essayer.");
      await save(result.vault, session.vault);
      if (current !== epoch) return;
      opened.items = await readItems(result.vault, session.key);
      arm();
    } finally {
      busy2 = false;
    }
  }
  return { page: page2, lock, keepConversation };
}

// docs/helene/device-client.mjs
var DATABASE = "ojo-helene-device-v1";
var conflict = () => Error("Cet espace a chang\xE9 dans un autre onglet. Ferme ton brouillon ou garde ses mots, puis actualise ton espace.");
function request(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function completed(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || Error("Enregistrement interrompu."));
    tx.onerror = () => {
    };
  });
}
var WorkspaceClient = class {
  constructor() {
    this.revision = 0;
    this.etag = null;
    this.savedAt = null;
    this.session = { displayName: "Sur cet appareil" };
    this.opening = null;
  }
  async db() {
    if (!globalThis.indexedDB) throw Error("Ce navigateur ne permet pas de garder tes \xE9l\xE9ments. Ouvre ce lien dans Chrome sur ton t\xE9l\xE9phone.");
    if (!this.opening) this.opening = new Promise((resolve, reject) => {
      const r = indexedDB.open(DATABASE, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("current");
        r.result.createObjectStore("history", { keyPath: "revision" });
      };
      r.onerror = () => reject(Error("Le stockage de ce navigateur est indisponible. Ouvre ce lien dans Chrome, hors navigation priv\xE9e."));
      r.onblocked = () => reject(Error("Ferme les autres onglets ojO puis rouvre ce lien."));
      r.onsuccess = () => {
        r.result.onversionchange = () => {
          r.result.close();
          this.opening = null;
        };
        resolve(r.result);
      };
    });
    return this.opening;
  }
  async load() {
    const db = await this.db(), tx = db.transaction("current", "readonly"), done = completed(tx);
    const record = await request(tx.objectStore("current").get("space"));
    await done;
    const state2 = record ? await importState(record.exportText) : emptyState();
    this.revision = record?.revision || 0;
    this.etag = record?.etag || null;
    this.savedAt = record?.saved_at || null;
    return state2;
  }
  async save(state2) {
    const exportText = await exportState(state2);
    if (new TextEncoder().encode(exportText).length > MAX_JSON) throw Error("Ton espace d\xE9passe 20 Mo. Fais un export et retire un fichier avant de r\xE9essayer.");
    const db = await this.db(), tx = db.transaction(["current", "history"], "readwrite"), done = completed(tx);
    let cause = null, record = null;
    const current = tx.objectStore("current"), history = tx.objectStore("history"), read = current.get("space");
    read.onsuccess = () => {
      if ((read.result?.etag || null) !== this.etag) {
        cause = conflict();
        tx.abort();
        return;
      }
      record = { revision: (read.result?.revision || 0) + 1, etag: crypto.randomUUID(), saved_at: (/* @__PURE__ */ new Date()).toISOString(), exportText };
      current.put(record, "space");
      history.put(record);
      const keys = history.getAllKeys();
      keys.onsuccess = () => {
        for (const key of keys.result.slice(0, -5)) history.delete(key);
      };
    };
    try {
      await done;
    } catch (e) {
      throw cause || (e.name === "QuotaExceededError" ? Error("Le stockage de cet appareil est plein. Tes \xE9l\xE9ments pr\xE9c\xE9dents sont conserv\xE9s. Fais un export avant de lib\xE9rer de la place.") : e);
    }
    this.revision = record.revision;
    this.etag = record.etag;
    this.savedAt = record.saved_at;
  }
  async history() {
    const db = await this.db(), tx = db.transaction("history", "readonly"), done = completed(tx);
    const records = await request(tx.objectStore("history").getAll());
    await done;
    return records.reverse().map(({ revision, saved_at }) => ({ revision, saved_at }));
  }
  async version(revision) {
    const db = await this.db(), tx = db.transaction("history", "readonly"), done = completed(tx);
    const record = await request(tx.objectStore("history").get(revision));
    await done;
    if (!record) throw Error("Cette sauvegarde ne se trouve plus sur cet appareil.");
    return importState(record.exportText);
  }
  async erase() {
    const db = await this.db(), tx = db.transaction(["current", "history"], "readwrite"), done = completed(tx);
    let cause = null;
    const current = tx.objectStore("current"), r = current.get("space");
    r.onsuccess = () => {
      if ((r.result?.etag || null) !== this.etag) {
        cause = conflict();
        tx.abort();
        return;
      }
      current.clear();
      tx.objectStore("history").clear();
    };
    try {
      await done;
    } catch (e) {
      throw cause || e;
    }
    this.revision = 0;
    this.etag = null;
    this.savedAt = null;
  }
};

// docs/helene/app.mjs
var $ = (s, root = document) => root.querySelector(s);
var esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var paths = { chat: "M3 3h18v13H8l-5 5ZM7 7h10M7 11h6", mail: "M3 5h18v14H3Zm0 0 9 8 9-8", wallet: "M3 5h17v15H3Zm0 4h18v7h-7V9Z", health: "M8 3h8v5h5v8h-5v5H8v-5H3V8h5Z", calendar: "M4 5h16v16H4ZM8 2v6m8-6v6M4 10h16m-12 4h2m4 0h2m-8 4h2", lock: "M5 10h14v11H5ZM8 10V6a4 4 0 0 1 8 0v4m-4 4v3", home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z", folder: "M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z", repere: "M6 3v18M6 4h13l-3 5 3 5H6", leaf: "M20 4C9 2 3 8 5 15c1 4 5 6 9 3 5-3 6-8 6-14ZM5 20l9-10", plus: "M12 5v14M5 12h14", arrow: "M5 12h14m-5-5 5 5-5 5", doc: "M14 3H5v18h14V8Zm0 0v5h5M8 12h8M8 16h6", note: "M4 4h16v12l-4 4H4Zm12 16v-4h4M8 8h8M8 12h5", search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0", settings: "M4 7h16M4 17h16M8 4v6M16 14v6", moon: "M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11", sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0", close: "m6 6 12 12M6 18 18 6", mic: "M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0Zm-4 6v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8", stop: "M6 6h12v12H6Z", clip: "m9 12 6-6a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7l9-9", link: "m9 15 6-6M8 17l-2 2a4 4 0 0 1-5-5l5-5a4 4 0 0 1 5 0M13 7l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-5 0", check: "m5 12 4 4L19 6" };
var icon = (n, c = "") => `<svg class="${c}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[n] || paths.note}"/></svg>`;
var workspace = new WorkspaceClient();
var state;
try {
  state = await workspace.load();
} catch (error) {
  $("#main").innerHTML = '<section class="page-head"><span class="eyebrow">TON ESPACE PERSONNEL</span><h1>Un petit r\xE9glage<br>avant de commencer.</h1><p class="muted">' + esc(error.message) + '</p><p class="small muted">Tes \xE9l\xE9ments d\xE9j\xE0 enregistr\xE9s ne sont pas effac\xE9s. Tu peux r\xE9essayer en rouvrant ce lien.</p></section>';
  document.querySelectorAll("button").forEach((b) => b.disabled = true);
  throw error;
}
var saving = false;
var copyState = () => structuredClone(state);
function savedStatus(message) {
  const el = $("#save-status");
  if (el) el.textContent = message || (workspace.savedAt ? "Sur cet appareil \xB7 " + new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(workspace.savedAt)) : "Sur cet appareil \xB7 sans compte");
  const user = $("#account-name");
  if (user) user.textContent = "Sur cet appareil";
}
async function persist(next) {
  if (saving) throw Error("Un enregistrement est d\xE9j\xE0 en cours. Ton brouillon reste \xE0 l\u2019\xE9cran.");
  saving = true;
  savedStatus("Enregistrement\u2026");
  try {
    await workspace.save(next);
    state = next;
    evolution.refresh();
    savedStatus();
  } catch (e) {
    savedStatus("Enregistrement \xE0 r\xE9essayer");
    evolution.observe("STORAGE_FAILURE");
    throw e;
  } finally {
    saving = false;
  }
}
var page = "essentiel";
var filter = "all";
var query = "";
var pending = [];
var detailId = null;
var graph = false;
var recording = false;
var busy = false;
var blobURLs = /* @__PURE__ */ new Set();
var nav = [["chat", "chat", "Mon chat", "Chat"], ["agenda", "calendar", "Mon agenda", "Agenda"], ["elements", "folder", "Mes \xE9l\xE9ments", "\xC9l\xE9ments"], ["coffre", "lock", "Mon coffre", "Coffre"], ["services", "settings", "Mes outils", "Outils"]];
var main = $("#main");
var evolution = evolutionUI({ render, esc, toast, snapshot: () => ({ pendingSteps: state.items.filter((item) => item.demo !== true && typeof item.nextStep === "string" && item.nextStep.trim()).length }) });
var theme = "light";
try {
  theme = localStorage.getItem("ojo-helene-theme") || "light";
} catch {
}
function setTheme(t) {
  theme = t;
  document.documentElement.dataset.theme = t;
  $("#theme").innerHTML = icon(t === "light" ? "moon" : "sun");
  $("#theme").setAttribute("aria-label", t === "light" ? "Activer le mode sombre" : "Activer le mode clair");
  try {
    localStorage.setItem("ojo-helene-theme", t);
  } catch {
  }
}
setTheme(theme);
$("#settings").innerHTML = icon("settings");
document.querySelectorAll("[data-close]").forEach((b) => b.innerHTML = icon("close"));
$("#file-button").innerHTML = icon("clip") + "Photo ou document";
$("#record").innerHTML = icon("mic") + "Ma voix";
var toastTimer;
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4300);
}
function date(t) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(new Date(t));
}
function bytes(n) {
  return n < 1024 ? n + " o" : n < 1024 * 1024 ? (n / 1024).toFixed(1) + " Ko" : (n / 1024 / 1024).toFixed(1) + " Mo";
}
function card(i) {
  return `<button class="card open-card" data-open="${esc(i.id)}"><div class="card-top"><span class="card-icon">${icon(i.originals.length ? "doc" : "note")}</span><span class="tag">${i.demo ? "Exemple fictif" : "Dans mon espace"}</span></div><h3>${esc(i.title)}</h3><p>${esc(i.nextStep || "\xC0 retrouver tranquillement, quand tu veux.")}</p><div class="card-bottom"><span>${i.originals.length ? i.originals.length + " original" + (i.originals.length > 1 ? "s" : "") : "Note originale"} \xB7 ${date(i.createdAt)}</span>${icon("arrow")}</div></button>`;
}
var art = `<svg class="hero-art" viewBox="0 0 270 205" fill="none" aria-hidden="true"><circle cx="144" cy="103" r="84" stroke="currentColor" opacity=".07"/><circle cx="144" cy="103" r="57" stroke="currentColor" opacity=".07"/><path d="M26 165C46 126 62 153 84 114s47-63 74-28 39 4 66-39" stroke="var(--gold)" stroke-width="1.2"/><circle cx="27" cy="164" r="6" fill="var(--green-soft)" stroke="var(--green)"/><circle cx="85" cy="113" r="12" fill="var(--bg)" stroke="var(--green)"/><circle cx="85" cy="113" r="3" fill="var(--green)"/><circle cx="155" cy="82" r="6" fill="var(--gold-soft)" stroke="var(--gold)"/><circle cx="224" cy="47" r="17" fill="var(--green-soft)"/><path d="m217 47 5 5 9-11" stroke="var(--green)" stroke-width="1.5"/><path d="M131 152c10-16 29-20 38-17-2 12-14 21-28 19m-10 8 21-19" stroke="var(--green)" opacity=".65"/></svg>`;
function home() {
  const a = essential(state);
  return `<section class="hero refreshed-home"><div><span class="eyebrow">OJ\u041E H\xC9L\xC8NE \xB7 VERSION 30.10.2</span><h1>Ton quotidien.<br>Ton espace.</h1><p>Un agenda, un coffre pour tes affaires personnelles,<br>et des outils que tu choisis selon tes besoins.</p></div>${art}</section><section class="home-tools" aria-label="Les outils de cette version"><a href="#agenda"><span class="card-icon">${icon("calendar")}</span><strong>Mon agenda</strong><small>Mes rendez-vous et mes moments \xE0 deux.</small></a><a href="#coffre"><span class="card-icon">${icon("lock")}</span><strong>Mon coffre</strong><small>Documents, photos et fiches de m\xE9decins.</small></a><a href="#services"><span class="card-icon">${icon("settings")}</span><strong>Mes outils</strong><small>Achats, mails, budget et d\xE9marches.</small></a></section><a class="capture-strip chat-door" href="${PERSONAL_CHAT_URL}" target="_blank" rel="noopener noreferrer"><span class="capture-symbol">${icon("chat")}</span><span><strong>Ouvrir ma conversation personnelle</strong><span class="hint">\xC9changer par \xE9crit avec ojO \xB7 acc\xE8s personnel dans un nouvel onglet.</span></span>${icon("arrow")}</a><p class="small muted home-limits">Tu choisis les messages confi\xE9s \xE0 ojO. Tes notes, tes documents et ton coffre ne sont pas transmis \xE0 l\u2019ouverture.</p><a class="text-button" href="#chat">Pr\xE9parer une demande sur cet appareil</a><button class="capture-strip" data-action="capture"><span class="capture-symbol">${icon("plus")}</span><span><strong>Je pose \xE7a ici.</strong><span class="hint">Garder une note ou un original dans mes \xE9l\xE9ments.</span></span>${icon("arrow")}</button><div class="section-top"><h2>Mon essentiel</h2><a class="text-button" href="#elements">Tout retrouver</a></div><p class="small muted section-description">Trois \xE9l\xE9ments au maximum, choisis par toi.</p><div class="grid-three">${a.length ? a.map(card).join("") : '<p class="empty">Aucun \xE9l\xE9ment \xE9pingl\xE9. Ouvre un \xE9l\xE9ment pour l\u2019ajouter \xE0 ton essentiel.</p>'}</div><div class="section-top"><h2>Mon fil de lumi\xE8re</h2></div><button class="button secondary" data-action="show-links">Parcourir les liens entre mes \xE9l\xE9ments</button>`;
}
function elementResults() {
  const a = searchItems(state.items, query, filter);
  return a.length ? a.map(card).join("") : '<p class="empty">Aucun \xE9l\xE9ment avec ces mots. Essaie un titre ou un nom de fichier.</p>';
}
function graphView() {
  const a = state.items.slice(0, 8), coords = a.map((_, i) => ({ x: 55 + i % 4 * 115, y: i < 4 ? 45 : 145 }));
  const links = a.flatMap((i, x) => i.links.map((id) => {
    const y = a.findIndex((j) => j.id === id);
    return y < 0 ? "" : `<path d="M${coords[x].x} ${coords[x].y}L${coords[y].x} ${coords[y].y}" stroke="var(--gold)"/>`;
  }).join(""));
  return `<div class="light-graph"><svg viewBox="0 0 460 190" aria-hidden="true">${links.join("")}${a.map((i, x) => `<circle cx="${coords[x].x}" cy="${coords[x].y}" r="17" fill="var(--green-soft)" stroke="var(--green)"/><text x="${coords[x].x}" y="${coords[x].y + 4}" text-anchor="middle" fill="currentColor" font-family="sans-serif" font-size="11">${x + 1}</text>`).join("")}</svg><p class="small muted">Les liens sont choisis \xE0 l\u2019ajout. La liste reste disponible.</p><ol>${a.map((i) => `<li><button class="text-button" data-open="${esc(i.id)}">${esc(i.title)}</button></li>`).join("")}</ol></div>`;
}
function elements() {
  return `<section class="intro-row page-head"><div><span class="eyebrow">CHAQUE CHOSE GARDE SON ORIGINE</span><h1>Tout retrouver,<br>simplement.</h1><p>Les mots que tu as pos\xE9s, les pi\xE8ces que tu as gard\xE9es.<br>Et le fil pour revenir \xE0 l\u2019essentiel.</p></div><button class="button secondary" data-action="capture">${icon("plus")}D\xE9poser un \xE9l\xE9ment</button></section><div class="search-wrap">${icon("search")}<label for="search" class="sr-only">Rechercher dans mes \xE9l\xE9ments</label><input id="search" type="search" placeholder="Un titre, tes mots, un nom de fichier\u2026" value="${esc(query)}"></div><div class="chips" role="group" aria-label="Filtrer les \xE9l\xE9ments">${[["all", "Tout"], ["note", "Notes"], ["file", "Avec un original"]].map(([k, v]) => `<button class="chip" data-filter="${k}" aria-pressed="${filter === k}">${v}</button>`).join("")}<button class="chip" data-action="toggle-links" aria-pressed="${graph}">${graph ? "Vue simple" : "Voir les liens"}</button></div>${graph ? graphView() : ""}<p id="result-count" class="small muted">${searchItems(state.items, query, filter).length} \xE9l\xE9ment(s)</p><div id="element-results" class="element-grid">${elementResults()}</div><p class="source-note">Recherche locale dans les textes saisis et les noms de fichiers. Le contenu des fichiers n\u2019est pas extrait. La conversation personnelle n\u2019acc\xE8de pas automatiquement \xE0 ces \xE9l\xE9ments.</p>`;
}
function entries() {
  return state.board.length ? state.board.slice().reverse().map((b) => `<article class="board-entry"><span class="eyebrow">${b.kind === "objection" ? "MON OBJECTION" : b.kind === "question" ? "MA QUESTION" : "MA SUGGESTION"}</span><p>${esc(b.text)}</p><small>Brouillon priv\xE9 \xB7 ${date(b.createdAt)} \xB7 non partag\xE9</small></article>`).join("") : '<p class="empty">Tes questions et tes objections ont leur place ici.</p>';
}
function reperes() {
  return `<section class="intro-row page-head"><div><span class="eyebrow">COMPRENDRE, QUESTIONNER, CHOISIR</span><h1>Une place pour<br>ton point de vue.</h1><p>Les d\xE9cisions se comprennent mieux quand on peut poser toutes ses questions. Y compris celles qui d\xE9rangent.</p></div></section><div class="inline-note">Tes questions et tes objections sont gard\xE9es dans ce navigateur. Elles restent priv\xE9es ; aucun partage ni envoi automatique.</div><div class="two-column"><section class="board-form"><h2>Je voudrais dire\u2026</h2><form id="board-form"><label for="board-kind">Ce que je souhaite d\xE9poser</label><select id="board-kind"><option value="question">Une question</option><option value="objection">Une objection</option><option value="suggestion">Une suggestion</option></select><label for="board-text">Avec mes propres mots</label><textarea id="board-text" rows="5" maxlength="4000" required placeholder="Ce que j\u2019aimerais comprendre ou voir autrement\u2026"></textarea><p class="small muted">Tes mots sont conserv\xE9s tels quels.</p><p class="error" id="board-error" role="alert"></p><button class="button primary full" type="submit">Garder mon brouillon</button></form></section><section><h3>Ce que j\u2019ai d\xE9pos\xE9</h3><div class="board-entries" id="board-entries">${entries()}</div></section></div>`;
}
function nova() {
  return `<section class="intro-row page-head"><div><span class="eyebrow">UNE PORTE QUE TU CHOISIS D\u2019OUVRIR</span><h1>NOVA ERA,<br>en clair.</h1><p>Comprendre \xE0 ton rythme, poser tes questions et te faire ton propre avis.</p></div></section><div class="two-column"><article class="card"><span class="eyebrow">LES DOCUMENTS</span><h3>Partir de ce que tu as sous les yeux.</h3><p>Aucun document du projet n\u2019est pr\xE9charg\xE9 dans cet espace. Tu peux garder ceux que tu re\xE7ois avec \xAB Je pose \xE7a ici \xBB : leur fichier original, leur date et les questions qu\u2019ils suscitent.</p><button class="text-button" data-action="capture">Garder un document ou une id\xE9e</button></article><article class="card"><span class="eyebrow">TON POINT DE VUE</span><h3>\xAB Qu\u2019est-ce qui le prouve ? \xBB</h3><p>Une pr\xE9sentation exprime une intention. Pour te faire un avis, demande les sources, leurs dates, les r\xE9sultats v\xE9rifi\xE9s et ce qui reste incertain. Tu peux garder tes objections sans les envoyer.</p><a class="text-button" href="#reperes">Garder ma question</a></article></div><div class="inline-note">Tu choisis la place de ce projet dans ton espace. Tes notes personnelles sont utiles ind\xE9pendamment de NOVA ERA.</div>`;
}
function render() {
  page = location.hash.slice(1) || "essentiel";
  if (!nav.some((n) => n[0] === page) && !["essentiel", "reperes", "nova"].includes(page)) page = "essentiel";
  document.title = (nav.find((n) => n[0] === page)?.[2] || { essentiel: "Mon essentiel", reperes: "Nos rep\xE8res", nova: "NOVA ERA, en clair" }[page]) + " \xB7 ojO H\xE9l\xE8ne";
  $("#desktop-nav").innerHTML = nav.map(([id, ic, label]) => `<a class="nav-link" href="#${id}" ${page === id ? 'aria-current="page"' : ""}>${icon(ic)}${label}</a>`).join("");
  $("#mobile-nav").innerHTML = nav.map(([id, ic, , label]) => `<a href="#${id}" ${page === id ? 'aria-current="page"' : ""}>${icon(ic)}${label}</a>`).join("");
  main.innerHTML = page === "essentiel" ? home() + evolution.home() + daily.home() : page === "chat" ? services.chat() : page === "services" ? services.modules() : page === "agenda" ? daily.page() : page === "coffre" ? vault.page() : page === "elements" ? elements() : page === "reperes" ? reperes() + '<p class="source-note"><a href="#nova">Explorer NOVA ERA, en clair, \xE0 mon rythme</a></p>' : nova();
}
function close(id) {
  $("#" + id).close();
}
function cleanBlobs() {
  for (const u of blobURLs) URL.revokeObjectURL(u);
  blobURLs.clear();
}
async function downloadOriginal(item, index) {
  const f = item.originals[index], b = un64(f.base64);
  if (await sha256(b) !== f.sha256) throw Error("L\u2019original ne correspond plus \xE0 sa source.");
  download(new Blob([b], { type: f.type }), f.name);
  toast("Original t\xE9l\xE9charg\xE9, sans transformation.");
}
function download(blob, name) {
  const u = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 3e4);
}
function detail(id) {
  const i = state.items.find((x) => x.id === id);
  if (!i) return;
  detailId = id;
  $("#detail-kind").textContent = i.originals.length ? "MON \xC9L\xC9MENT ET SES ORIGINAUX" : "MES MOTS, \xC0 L\u2019ORIGINE";
  $("#detail-content").innerHTML = `<h2 id="detail-title">${esc(i.title)}</h2><span class="tag">${i.demo ? "Exemple fictif \xB7 " : ""}${date(i.createdAt)}</span><div class="field-box"><span class="eyebrow">LE TEXTE ORIGINAL</span><p class="original-text">${esc(i.originalText || "Aucun texte ajout\xE9. Le fichier ci-dessous est l\u2019original.")}</p></div>${i.originals.map((f, n) => `<div class="attachment">${icon("doc")}<p>${esc(f.name)}<br><small>${bytes(f.size)} \xB7 original conserv\xE9</small></p><button class="button secondary" data-original="${n}">T\xE9l\xE9charger</button></div>`).join("")}<details><summary>Voir les empreintes des originaux</summary><p class="small muted">Les empreintes permettent de rep\xE9rer une modification. Elles n\u2019\xE9tablissent ni l\u2019auteur ni la v\xE9racit\xE9 du contenu.</p><p class="hash">Texte \xB7 ${esc(i.originalTextSha256)}</p>${i.originals.map((f) => `<p class="hash">${esc(f.name)} \xB7 ${esc(f.sha256)}</p>`).join("")}</details><label for="description">Ma description, \xE0 part de l\u2019original</label><textarea id="description" rows="3" maxlength="20000" placeholder="Mes propres mots pour le retrouver\u2026">${esc(i.description)}</textarea><label for="next-step">Le prochain pas que je choisis</label><input id="next-step" maxlength="300" value="${esc(i.nextStep)}"><p class="small muted">Saisie manuelle \xB7 aucun mod\xE8le connect\xE9 \xB7 aucun rappel cr\xE9\xE9</p><div class="button-row"><button class="button primary" data-action="save-description">Garder mes pr\xE9cisions</button><button class="button secondary" data-action="pin">${state.pinned.includes(id) ? "Retirer de mon essentiel" : "Ajouter \xE0 mon essentiel"}</button></div><button class="text-button danger" data-action="remove-item">Retirer cet \xE9l\xE9ment</button>${i.links.length ? `<h3>Le fil continue</h3>${i.links.map((id2) => {
    const j = state.items.find((x) => x.id === id2);
    return j ? `<button class="text-button" data-open="${esc(id2)}">${esc(j.title)}</button>` : "";
  }).join("<br>")}` : ""}`;
  if (!$("#detail-dialog").open) $("#detail-dialog").showModal();
}
function pendingView() {
  $("#chosen-files").innerHTML = pending.map((f, i) => `<div class="attachment">${icon("clip")}<p>${esc(f.name)}<br><small>${bytes(f.size)} \xB7 original</small></p><button type="button" class="icon-button" data-remove-file="${i}" aria-label="Retirer ${esc(f.name)}">${icon("close")}</button></div>`).join("");
}
function addFiles(files) {
  const next = [...pending, ...files], total = state.items.reduce((n, i) => n + i.originals.reduce((m, f) => m + f.size, 0), 0) + next.reduce((n, f) => n + f.size, 0);
  if (next.length > 6 || next.some((f) => f.size === 0 || f.size > MAX_FILE) || total > MAX_TOTAL) {
    $("#capture-error").textContent = "Six fichiers maximum par \xE9l\xE9ment, 8 Mo par fichier et 12 Mo d\u2019originaux dans ton espace.";
    return;
  }
  pending = next;
  pendingView();
  $("#capture-error").textContent = "";
}
var translate = (t) => String(t).replace("Esperando permiso del micr\xF3fono\u2026", "Autorisation du microphone en attente\u2026").replace("La grabaci\xF3n no est\xE1 disponible. Puedes elegir un audio desde Archivos.", "L\u2019enregistrement est indisponible. Tu peux choisir un fichier audio.").replace("No se pudo completar la grabaci\xF3n. Importa un audio desde Archivos.", "L\u2019enregistrement a \xE9chou\xE9. Tu peux importer un fichier audio.").replace("Voz preparada. A\xF1ade unas palabras y guarda el recuerdo.", "Voix pr\xEAte. Tu peux ajouter quelques mots puis garder cet \xE9l\xE9ment.").replace("No se han recibido datos de audio.", "Aucun son n\u2019a \xE9t\xE9 re\xE7u.").replace("Grabando \xB7 ", "Enregistrement \xB7 ");
var voice = new VoiceCapture({ onFile: (f) => addFiles([f]), onStatus: (t) => $("#record-status").textContent = translate(t), onState: (active) => {
  recording = active;
  $("#record").innerHTML = icon(active ? "stop" : "mic") + (active ? "Arr\xEAter" : "Ma voix");
  $("#record").setAttribute("aria-pressed", String(active));
} });
function openCapture() {
  pending = [];
  pendingView();
  $("#capture-form").reset();
  $("#capture-error").textContent = "";
  $("#record-status").textContent = "Voix facultative \xB7 aucune transcription automatique";
  $("#note-link").innerHTML = '<option value="">Aucun lien</option>' + state.items.map((i) => `<option value="${esc(i.id)}">${esc(i.title)}</option>`).join("");
  $("#capture-dialog").showModal();
  $("#note-title").focus();
}
$("#capture-dialog").addEventListener("close", () => {
  voice.cancel();
  pending = [];
  $("#file-input").value = "";
});
$("#detail-dialog").addEventListener("close", cleanBlobs);
$("#file-button").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    $("#file-input").click();
  }
});
$("#file-input").addEventListener("change", (e) => {
  addFiles([...e.target.files]);
  e.target.value = "";
});
$("#record").addEventListener("click", () => recording ? voice.stop() : voice.start());
$("#capture-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  if (recording) {
    $("#capture-error").textContent = "Arr\xEAte l\u2019enregistrement avant de garder cet \xE9l\xE9ment.";
    return;
  }
  busy = true;
  $("#save-note").disabled = true;
  try {
    if (state.items.length >= 80) throw Error("Ton espace peut garder 80 \xE9l\xE9ments dans cette version.");
    const files = await Promise.all(pending.map(async (f) => original(f.name, f.type, await f.arrayBuffer())));
    const i = await makeItem({ title: $("#note-title").value, text: $("#note-body").value, next: $("#note-next").value, files, links: $("#note-link").value ? [$("#note-link").value] : [] });
    const next = copyState();
    next.items.unshift(i);
    await persist(next);
    close("capture-dialog");
    render();
    detail(i.id);
    toast("\xC9l\xE9ment enregistr\xE9 dans ton espace.");
  } catch (e2) {
    $("#capture-error").textContent = e2.message;
  } finally {
    busy = false;
    $("#save-note").disabled = false;
  }
});
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button,a");
  if (!b) return;
  if (b.dataset.close) {
    close(b.dataset.close);
    return;
  }
  if (b.dataset.open) {
    detail(b.dataset.open);
    return;
  }
  if (b.dataset.original !== void 0) {
    try {
      await downloadOriginal(state.items.find((i) => i.id === detailId), Number(b.dataset.original));
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  if (b.dataset.removeFile !== void 0) {
    pending.splice(Number(b.dataset.removeFile), 1);
    pendingView();
    return;
  }
  if (b.dataset.door) {
    try {
      const next = copyState();
      next.door = b.dataset.door;
      await persist(next);
      render();
      toast("Tu peux changer ce point de d\xE9part \xE0 tout moment.");
      if (state.door === "documents") location.hash = "elements";
      if (state.door === "understand") location.hash = "nova";
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  if (b.dataset.filter) {
    filter = b.dataset.filter;
    render();
    return;
  }
  switch (b.dataset.action) {
    case "capture":
      openCapture();
      break;
    case "about":
      $("#options-dialog").showModal();
      break;
    case "change-door":
      try {
        const next = copyState();
        next.door = null;
        await persist(next);
        location.hash = "essentiel";
        render();
      } catch (err) {
        toast(err.message);
      }
      break;
    case "show-links":
      graph = true;
      location.hash = "elements";
      if (page === "elements") render();
      break;
    case "toggle-links":
      graph = !graph;
      render();
      break;
    case "pin":
      try {
        const next = copyState();
        pin(next, detailId);
        await persist(next);
        render();
        b.textContent = state.pinned.includes(detailId) ? "Retirer de mon essentiel" : "Ajouter \xE0 mon essentiel";
        toast("Ton essentiel a \xE9t\xE9 mis \xE0 jour.");
      } catch (err) {
        toast(err.message);
      }
      break;
    case "save-description": {
      try {
        const next = copyState(), i = next.items.find((x) => x.id === detailId);
        i.description = $("#description").value;
        i.nextStep = $("#next-step").value;
        await persist(next);
        render();
        toast("Tes pr\xE9cisions sont enregistr\xE9es. L\u2019original est conserv\xE9.");
      } catch (err) {
        toast(err.message);
      }
      break;
    }
    case "remove-item": {
      if (!confirm("Retirer cet \xE9l\xE9ment de ton espace ? Les sauvegardes r\xE9centes permettent de le r\xE9cup\xE9rer.")) break;
      try {
        const next = copyState();
        next.items = next.items.filter((i) => i.id !== detailId).map((i) => ({ ...i, links: i.links.filter((id) => id !== detailId) }));
        next.pinned = next.pinned.filter((id) => id !== detailId);
        await persist(next);
        close("detail-dialog");
        render();
        toast("\xC9l\xE9ment retir\xE9.");
      } catch (err) {
        toast(err.message);
      }
      break;
    }
  }
});
main.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    query = e.target.value;
    $("#element-results").innerHTML = elementResults();
    $("#result-count").textContent = searchItems(state.items, query, filter).length + " \xE9l\xE9ment(s)";
  }
});
main.addEventListener("submit", async (e) => {
  if (e.target.id !== "board-form") return;
  e.preventDefault();
  try {
    const next = copyState();
    addBoard(next, $("#board-kind").value, $("#board-text").value);
    await persist(next);
    $("#board-text").value = "";
    $("#board-error").textContent = "";
    $("#board-entries").innerHTML = entries();
    toast("Tes mots sont enregistr\xE9s tels quels, sans partage.");
  } catch (err) {
    $("#board-error").textContent = err.message;
  }
});
$("#theme").addEventListener("click", () => setTheme(theme === "light" ? "dark" : "light"));
$("#settings").addEventListener("click", () => $("#options-dialog").showModal());
$("#reduce-motion").checked = matchMedia("(prefers-reduced-motion: reduce)").matches;
$("#reduce-motion").addEventListener("change", (e) => document.documentElement.dataset.motion = e.target.checked ? "reduce" : "system");
$("#change-door").addEventListener("click", async () => {
  try {
    const next = copyState();
    next.door = null;
    await persist(next);
    close("options-dialog");
    location.hash = "essentiel";
    render();
  } catch (err) {
    toast(err.message);
  }
});
$("#export").addEventListener("click", async () => {
  try {
    download(new Blob([await exportState(state)], { type: "application/json" }), "mon-espace-ojo.json");
    $("#restore-status").textContent = "Export pr\xE9par\xE9. V\xE9rifie qu\u2019il est bien enregistr\xE9 sur ton appareil.";
  } catch (e) {
    $("#restore-status").textContent = e.message;
  }
});
$("#restore").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    if (file.size > MAX_JSON) throw Error("L\u2019export d\xE9passe 20 Mo.");
    const next = await importState(await file.text());
    if (!confirm("Restaurer cet export dans ton espace ? La version actuelle restera dans les sauvegardes r\xE9centes.")) return;
    await persist(next);
    query = "";
    filter = "all";
    render();
    $("#restore-status").textContent = `Restauration v\xE9rifi\xE9e : ${state.items.length} \xE9l\xE9ments, ${state.board.length} contributions. Les originaux correspondent \xE0 leurs empreintes.`;
    toast("Tes \xE9l\xE9ments sont restaur\xE9s et enregistr\xE9s.");
  } catch (err) {
    $("#restore-status").textContent = "Restauration refus\xE9e : " + err.message;
  }
});
$("#reset").addEventListener("click", async () => {
  if (!confirm("Effacer tes notes, ton agenda et leurs sauvegardes locales ? Le coffre chiffr\xE9 et les exports t\xE9l\xE9charg\xE9s sont conserv\xE9s.")) return;
  if (!confirm("Confirmer l\u2019effacement d\xE9finitif des notes et de l\u2019agenda sur cet appareil ? Le coffre chiffr\xE9 est conserv\xE9.")) return;
  try {
    await workspace.erase();
    state = emptyState();
    query = "";
    filter = "all";
    graph = false;
    $("#restore-status").textContent = "";
    close("options-dialog");
    render();
    savedStatus();
    toast("Tes \xE9l\xE9ments et leurs sauvegardes ont \xE9t\xE9 effac\xE9s.");
  } catch (err) {
    $("#restore-status").textContent = err.message;
  }
});
$("#load-examples").addEventListener("click", async () => {
  try {
    if (state.items.length) throw Error("Les exemples sont propos\xE9s quand ton espace est vide.");
    const next = await demoState();
    next.door = state.door;
    next.board = state.board;
    next.agenda = state.agenda;
    next.comfort = state.comfort;
    await persist(next);
    close("options-dialog");
    render();
    toast("Trois exemples fictifs ont \xE9t\xE9 ajout\xE9s.");
  } catch (err) {
    toast(err.message);
  }
});
$("#refresh-workspace").addEventListener("click", async () => {
  try {
    const next = await workspace.load();
    state = next;
    render();
    savedStatus();
    toast("Ton espace est \xE0 jour.");
  } catch (err) {
    toast(err.message);
  }
});
$("#history").addEventListener("click", async () => {
  try {
    const history = await workspace.history();
    $("#history-list").innerHTML = history.length ? history.map((v) => "<li><span>Version " + Number(v.revision) + " \xB7 " + esc(new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(v.saved_at))) + '</span> <button class="text-button" data-recover="' + Number(v.revision) + '">Restaurer</button></li>').join("") : "<li>Aucune sauvegarde pour le moment. Garde un premier \xE9l\xE9ment pour commencer.</li>";
  } catch (err) {
    $("#restore-status").textContent = err.message;
  }
});
$("#history-list").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-recover]");
  if (!b) return;
  try {
    const next = await workspace.version(Number(b.dataset.recover));
    if (!confirm("Revenir \xE0 cette sauvegarde ? La version actuelle restera parmi les sauvegardes r\xE9centes.")) return;
    await persist(next);
    query = "";
    filter = "all";
    render();
    $("#restore-status").textContent = "Sauvegarde restaur\xE9e. Les originaux ont \xE9t\xE9 v\xE9rifi\xE9s.";
    $("#history-list").innerHTML = "";
    toast("Sauvegarde restaur\xE9e.");
  } catch (err) {
    $("#restore-status").textContent = err.message;
  }
});
var daily = everydayUI({ getState: () => state, persist, render, esc, icon, download, toast });
var vault = privateVaultUI({ render, esc, icon, download, toast });
var services = servicesUI({ render, esc, icon, toast, vault });
window.addEventListener("hashchange", () => {
  render();
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
});
window.addEventListener("pagehide", () => {
  voice.cancel();
  cleanBlobs();
});
render();
savedStatus();
var appRegistration = null;
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" }).then((registration) => {
    appRegistration = registration;
    registration.update().catch(() => {
    });
    window.addEventListener("online", () => registration.update().catch(() => {
    }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") registration.update().catch(() => {
      });
    });
  }).catch(() => {
  });
}
$("#update-app").addEventListener("click", async () => {
  const button = $("#update-app");
  button.disabled = true;
  try {
    await appRegistration?.update();
  } catch {
  }
  window.location.href = new URL("ouvrir.html", window.location.href).href;
});
var installEvent = null;
var installButton = $("#install-app");
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installEvent = event;
  installButton.hidden = false;
});
installButton.addEventListener("click", async () => {
  if (!installEvent) return;
  await installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  installButton.hidden = true;
});
window.addEventListener("appinstalled", () => {
  installButton.hidden = true;
  toast("ojO a \xE9t\xE9 ajout\xE9 \xE0 ton \xE9cran d\u2019accueil.");
});
window.addEventListener("offline", () => {
  evolution.observe("OFFLINE");
  if (page === "essentiel") render();
});
