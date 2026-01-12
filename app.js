/* Scarlett Isles — Honour & Respect Tracker
   - Clans: -5..+5
   - Temples: -3..+3
   - Auto-saves to localStorage
   - Displays cumulative active effects based on your reference document
*/

const STORAGE_KEY = "scarlettHonourTracker.v1";

const el = (id) => document.getElementById(id);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/* ---------------------------
   1) DATA (edit these names/icons freely)
---------------------------- */

// Temples
const temples = [
  { id: "telluria", name: "Telluria", icon: "🜃" }, // earth
  { id: "aurush",   name: "Aurush",   icon: "☀" }, // sun
  { id: "pelagos",  name: "Pelagos",  icon: "🌊" }, // sea
];

// Clans
// IMPORTANT: only 3 clans have extra rules in your doc (Blackstone/Farmer/Rowthorn).
// The others will still use the universal clan effects until you add their custom modifiers.
const clans = [
  { id: "blackstone", name: "Clan Blackstone", icon: "🛡️🐻", alignedTemple: "telluria", hasModifiers: true },
  { id: "bacca",      name: "Clan Bacca",      icon: "🛡️🦁", alignedTemple: "telluria", hasModifiers: false },
  { id: "farmer",     name: "Clan Farmer",     icon: "🛡️🐂", alignedTemple: "aurush",   hasModifiers: true },
  { id: "slade",      name: "Clan Slade",      icon: "🛡️🦄", alignedTemple: "telluria", hasModifiers: false },
  { id: "molten",     name: "Clan Molten",     icon: "🛡️🦅", alignedTemple: "aurush",   hasModifiers: false },
  { id: "karr",       name: "Clan Karr",       icon: "🛡️🐐", alignedTemple: "pelagos",  hasModifiers: false },
  { id: "rowthorn",   name: "Clan Rowthorn",   icon: "🛡️🐉", alignedTemple: "pelagos",  hasModifiers: true },
];


/* ---------------------------
   2) RULES (from your reference doc)
   Source-of-truth: Scarlett_Isles_Honour_and_Temple_Standing_Effects.docx :contentReference[oaicite:2]{index=2}
---------------------------- */

// Universal Clan Honour (−5..+5)
const clanUniversal = {
  "-5": { status: "WANTED", effects: [
    "ENFORCEMENT: Kill/capture order; bounty posted.",
    "ACCESS: Barred from clan lands/facilities.",
    "SOCIAL: Automatic hostile reactions."
  ]},
  "-4": { status: "HUNTED", effects: [
    "ENFORCEMENT: Patrols stop/search; detain if possible.",
    "PRICES: +100% with clan merchants.",
    "TRAVEL: Safe routes withheld; false leads likely."
  ]},
  "-3": { status: "HOSTILE", effects: [
    "SOCIAL: Disadvantage on checks with clan members.",
    "ACCESS: No audience with leaders.",
    "AID: Refused except under duress."
  ]},
  "-2": { status: "DISTRUSTED", effects: [
    "PRICES: +50% in clan-controlled markets.",
    "INTEL: Partial truths; key facts gated behind proof.",
    "LEGAL: Treated as suspects in disputes."
  ]},
  "-1": { status: "SUSPICIOUS", effects: [
    "SOCIAL: Normal DCs but attitude is wary.",
    "ACCESS: Public areas only.",
    "INTEL: Rumours only, no documents."
  ]},
  "0": { status: "NEUTRAL", effects: [
    "SOCIAL: Normal DCs.",
    "PRICES: Standard.",
    "ACCESS: Public services only."
  ]},
  "1": { status: "TRUSTED", effects: [
    "ACCESS: Limited restricted access (guarded halls, clan quarter entry).",
    "SOCIAL: Advantage on 1 social check/day with clan members.",
    "AID: Basic supplies or shelter when reasonable."
  ]},
  "2": { status: "ALLIED", effects: [
    "BACKUP: 1d4 militia/guards available once per arc (DM discretion).",
    "INTEL: Maps, records, names, and actionable leads.",
    "LEGAL: Clan vouches for the party (reduced scrutiny)."
  ]},
  "3": { status: "FAVOURED", effects: [
    "AID: Free basic lodging in clan territory.",
    "PRICES: −20% with clan merchants/crafters.",
    "ACCESS: Audience with senior officer or emissary on request."
  ]},
  "4": { status: "CHAMPIONS", effects: [
    "BACKUP: 2d4 militia/elite escort once per arc.",
    "LEGAL: Clan writ grants temporary authority (advantage on lawful demands).",
    "BOON: One bespoke clan gift (minor magic item or rare service)."
  ]},
  "5": { status: "SWORN FRIENDS", effects: [
    "SANCTUARY: Safe haven even when pursued.",
    "ACCESS: Direct access to leadership; guarded secrets shared.",
    "BACKUP: Clan will take political heat to protect the party; reinforcements can arrive in major set-pieces."
  ]},
};

// Clan-specific modifiers (only where your doc defines them)
const clanModifiers = {
  blackstone: {
    // additions at thresholds (both positive and negative)
    add: {
      "1": ["Entry to Blackstone Quarters; basic audience access (escorted)."],
      "2": ["Clan Writ: Advantage on one social check with Wardens/Clan per day; access to maps/records."],
      "3": ["Warden Escort: one squad guides you through dangerous streets/forest edge once per arc."],
    },
    // “at −2 or lower” type notes
    addIfAtOrBelow: {
      "-2": ["In Nightwood, random Warden scrutiny escalates (stops, searches, delays)."],
      "-4": ["Aldric/Chief declares you a destabilising element; detainment attempts begin."],
    }
  },

  farmer: {
    add: {
      "1": ["Access to Sunward contacts and formal hearings; minor discounts on sanctioned supplies."],
      "2": ["Sanctioned Escort: 1d4 Sun-Bearers for one mission (expects strict conduct)."],
      "3": ["Inquisitorial Seal: advantage on intimidation vs criminals/heretics in clan territory."],
      "4": ["May provide fire-oil stores, sunblade maintenance, or a minor relic loan (DM discretion)."],
    },
    addIfAtOrBelow: {
      "-3": ["Declared 'complicit': gear searches, interrogations, and refusal of aid."],
      "-5": ["Cleansing Order: detain/execute if resisting; bounty posted widely."],
    }
  },

  rowthorn: {
    add: {
      "1": ["Safe Harbour: basic shelter and discreet resupply in Rowthorn ports."],
      "2": ["Passage Token: priority ferry/ship passage once per arc; advantage on 1 sea travel check."],
      "3": ["Tide Intel: accurate forecasts, smuggler routes, and enemy ship movements (where relevant)."],
    },
    addIfAtOrBelow: {
      "-2": ["Stranded: denied passage; prices +50% in coastal markets controlled by Rowthorn."],
      "-4": ["Marked as 'reckless': captains refuse you, and tide-guard may tail you."],
    }
  }
};

// Universal Temple Standing (−3..+3)
const templeUniversal = {
  "-3": { status: "ANATHEMA", effects: [
    "RITUALS: No temple services; clerics may refuse healing/resurrection.",
    "ENFORCEMENT: Temple agents may pursue, expose, or sabotage.",
    "BANE: Once per session, DM may impose a minor omen complication tied to that deity."
  ]},
  "-2": { status: "EXCOMMUNICATE", effects: [
    "SOCIAL: Disadvantage on checks with temple faithful.",
    "ACCESS: Barred from inner sanctums.",
    "RITUALS: Services only at extreme cost or via black-market intermediaries."
  ]},
  "-1": { status: "DISFAVOURED", effects: [
    "SOCIAL: Wary reception; higher DCs (+2).",
    "RITUALS: Services available but require penance/donation; prices +50%.",
    "INTEL: Doctrine-only answers, no secrets."
  ]},
  "0": { status: "NEUTRAL", effects: [
    "SOCIAL: Normal DCs.",
    "RITUALS: Services at standard donation costs.",
    "ACCESS: Public shrine areas only."
  ]},
  "1": { status: "BLESSED", effects: [
    "RITUALS: Discounts (−20%) on temple services.",
    "AID: Safe rest within temple grounds where appropriate.",
    "BOON: 1 minor blessing/token per arc (flavour + small mechanical perk)."
  ]},
  "2": { status: "FAVOURED", effects: [
    "ACCESS: Inner chambers/archives with supervision.",
    "RITUALS: Priority access to rituals/divinations.",
    "BOON: 1 'Prayer of Aid' per arc (deity-themed advantage)."
  ]},
  "3": { status: "CHOSEN", effects: [
    "SANCTUARY: Temple protection even under political pressure.",
    "RITUALS: High rites available (including rare healing) with minimal donation.",
    "BOON: Once per arc, a major sign or intervention (deity-themed narrative advantage)."
  ]},
};

// Temple-specific modifiers
const templeModifiers = {
  telluria: {
    add: {
      "-3": ["Roots Reject You: difficult terrain from roots may 'choose' you first; 1 extra complication per session in Tellurian sites."],
      "-2": ["No Earth-Salve: you cannot purchase Tellurian salves/charms; priests will not stabilise via sap methods."],
      "-1": ["Penance Required: services cost +50% and demand a vow or offering."],
      "1":  ["Grounding Token: 1/arc, advantage on a STR save vs being knocked prone or restrained."],
      "2":  ["Stone-Safe Passage: 1/arc, ignore one environmental hazard in tunnels/caves (collapse, tremor, difficult terrain)."],
      "3":  ["Sanctuary of Soil: 1/arc, the party can take a short rest in a dangerous wilderness zone without being interrupted (DM discretion)."],
    }
  },
  aurush: {
    add: {
      "-3": ["Condemned: Aurushi agents attempt confiscation of relics; 1/arc a public denunciation increases legal heat in Aurushi lands."],
      "-2": ["Blinded by Doctrine: disadvantage on Deception vs Aurushi faithful; services refused."],
      "-1": ["Suspect: services cost +50%; persuasion DCs +2 with Aurushi clergy."],
      "1":  ["Sunmark Charm: 1/arc, add +1d4 radiant damage to one hit OR gain advantage on one Insight check."],
      "2":  ["Revelation Rite: 1/arc, temple provides a short divination (one clear clue, DM-approved)."],
      "3":  ["Shield of Noon: 1/arc, grant one ally resistance to necrotic OR advantage on saves vs fear for one encounter."],
    }
  },
  pelagos: {
    add: {
      "-3": ["Cast Out: denied passage by temple-linked captains; storms/bad timing complications appear 1 extra time per session at sea/coast."],
      "-2": ["Salt-Warned: disadvantage on Persuasion with Pelagos clergy; services refused."],
      "-1": ["Untrusted: services cost +50%; temple answers are guarded and clipped."],
      "1":  ["Tide-Blessing: 1/arc, advantage on one Athletics/Acrobatics check involving water, slick stone, or resisting being moved."],
      "2":  ["Omen of the Current: 1/arc, reroll one failed Survival/Navigation check (sea, coast, river)."],
      "3":  ["Safe Passage: 1/arc, avoid one sea travel complication entirely (storm, pursuit, ship damage) if plausible."],
    }
  }
};

/* ---------------------------
   3) STATE
---------------------------- */

function defaultState(){
  const clanScores = {};
  clans.forEach(c => clanScores[c.id] = 0);

  const templeScores = {};
  temples.forEach(t => templeScores[t.id] = 0);

  return {
    clanScores,
    templeScores,
    clanNotes: Object.fromEntries(clans.map(c => [c.id, ""])),
    lastChange: Object.fromEntries(clans.map(c => [c.id, { when:"", reason:"" }])),
    templeNotes: Object.fromEntries(temples.map(t => [t.id, ""])),
    globalNotes: "",
    updatedAt: new Date().toISOString()
  };
}

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return defaultState();
  try{
    const parsed = JSON.parse(raw);
    const s = defaultState();

    // merge safely
    Object.assign(s, parsed);

    // ensure all keys exist
    clans.forEach(c => { if(!(c.id in s.clanScores)) s.clanScores[c.id] = 0; });
    temples.forEach(t => { if(!(t.id in s.templeScores)) s.templeScores[t.id] = 0; });

    return s;
  }catch{
    localStorage.removeItem(STORAGE_KEY);
    return defaultState();
  }
}

const state = loadState();

function saveState(){
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  pulseSaved();
}

let savePulseTimer = null;
function pulseSaved(){
  const pill = el("savePill");
  if(!pill) return;
  pill.textContent = "Saved";
  pill.style.borderColor = "rgba(201,162,39,.45)";
  pill.style.background = "rgba(201,162,39,.16)";
  clearTimeout(savePulseTimer);
  savePulseTimer = setTimeout(() => {
    pill.style.borderColor = "rgba(201,162,39,.26)";
    pill.style.background = "rgba(201,162,39,.12)";
  }, 400);
}

/* ---------------------------
   4) EFFECT RESOLUTION (cumulative)
---------------------------- */

function cumulativeKeysForScore(score, min, max){
  // “cumulative toward 0”:
  // - If positive: include 0..score
  // - If negative: include score..0
  const keys = [];
  if(score >= 0){
    for(let s=0; s<=score; s++) keys.push(String(s));
  }else{
    for(let s=score; s<=0; s++) keys.push(String(s));
  }
  return keys;
}

function getClanStatus(score){
  const key = String(score);
  return (clanUniversal[key]?.status) || "UNKNOWN";
}

function getTempleStatus(score){
  const key = String(score);
  return (templeUniversal[key]?.status) || "UNKNOWN";
}

function getClanActiveEffects(clanId, score){
  const scoreKeys = cumulativeKeysForScore(score, -5, 5);
  const effects = [];

  // universal (cumulative)
  scoreKeys.forEach(k => {
    const block = clanUniversal[k];
    if(block?.effects) effects.push(...block.effects);
  });

  // modifiers (threshold adds)
  const mod = clanModifiers[clanId];
  if(mod){
    // add for exact thresholds (cumulative using the same scoreKeys list)
    scoreKeys.forEach(k => {
      const add = mod.add?.[k];
      if(add) effects.push(...add);
    });

    // “at or below” negative thresholds
    // if score is <= threshold, include those notes
    Object.keys(mod.addIfAtOrBelow || {}).forEach(th => {
      const thNum = Number(th);
      if(Number.isFinite(thNum) && score <= thNum){
        effects.push(...mod.addIfAtOrBelow[th]);
      }
    });
  }

  return dedupe(effects);
}

function getTempleActiveEffects(templeId, score){
  const scoreKeys = cumulativeKeysForScore(score, -3, 3);
  const effects = [];

  scoreKeys.forEach(k => {
    const block = templeUniversal[k];
    if(block?.effects) effects.push(...block.effects);
  });

  const mod = templeModifiers[templeId];
  if(mod){
    scoreKeys.forEach(k => {
      const add = mod.add?.[k];
      if(add) effects.push(...add);
    });
  }

  return dedupe(effects);
}

function dedupe(arr){
  const seen = new Set();
  const out = [];
  arr.forEach(x => {
    const key = String(x).trim();
    if(!key) return;
    if(seen.has(key)) return;
    seen.add(key);
    out.push(key);
  });
  return out;
}

/* ---------------------------
   5) UI RENDER
---------------------------- */

function render(){
  renderClans();
  renderTemples();

  const g = el("globalNotes");
  if(g){
    g.value = state.globalNotes || "";
    g.oninput = () => { state.globalNotes = g.value; saveState(); };
  }
}

function renderClans(){
  const wrap = el("clansWrap");
  wrap.innerHTML = "";

  clans.forEach(clan => {
    const score = clamp(Number(state.clanScores[clan.id] ?? 0), -5, 5);
    const status = getClanStatus(score);
    const templeName = temples.find(t => t.id === clan.alignedTemple)?.name || "Unaligned";

    const card = document.createElement("div");
    card.className = "card";

    // Header
    const head = document.createElement("div");
    head.className = "cardHead";

    const left = document.createElement("div");
    left.className = "faction";

    const icon = document.createElement("div");
    icon.className = "icon";
    icon.textContent = clan.icon;

    const text = document.createElement("div");
    text.className = "factionText";
    text.innerHTML = `
      <div class="factionName">${escapeHtml(clan.name)}</div>
      <div class="factionMeta">Aligned: ${escapeHtml(templeName)} • Status: ${escapeHtml(status)}</div>
    `;

    left.appendChild(icon);
    left.appendChild(text);

    const pill = document.createElement("div");
    pill.className = "pill" + (score < 0 ? " bad" : "");
    pill.textContent = `Score: ${score}`;

    head.appendChild(left);
    head.appendChild(pill);

    // Slider row
    const grid = document.createElement("div");
    grid.className = "grid";

    const sRow = document.createElement("div");
    sRow.className = "sliderRow";

    const lab = document.createElement("label");
    lab.textContent = "Honour";

    const range = document.createElement("input");
    range.type = "range";
    range.min = "-5";
    range.max = "5";
    range.step = "1";
    range.value = String(score);

    const scoreBox = document.createElement("div");
    scoreBox.className = "scoreBox";
    scoreBox.textContent = String(score);

    range.addEventListener("input", () => {
      const next = clamp(Number(range.value), -5, 5);
      scoreBox.textContent = String(next);
      state.clanScores[clan.id] = next;
      saveState();
      // re-render this card to refresh effects/status
      renderClans();
    });

    sRow.appendChild(lab);
    sRow.appendChild(range);
    sRow.appendChild(scoreBox);

    // Effects
    const effectsWrap = document.createElement("div");
    effectsWrap.className = "effects";

    const h = document.createElement("h4");
    h.textContent = "Active Effects";

    const ul = document.createElement("ul");
    const effects = getClanActiveEffects(clan.id, score);
    effects.forEach(eff => {
      const li = document.createElement("li");
      li.textContent = eff;
      ul.appendChild(li);
    });

    // Notes
    const notes = document.createElement("textarea");
    notes.className = "smallNotes";
    notes.placeholder = "Notes: why did this change?";
    notes.value = state.clanNotes[clan.id] || "";
    notes.addEventListener("input", () => {
      state.clanNotes[clan.id] = notes.value;
      saveState();
    });

    effectsWrap.appendChild(h);
    effectsWrap.appendChild(ul);

    grid.appendChild(sRow);
    grid.appendChild(effectsWrap);
    grid.appendChild(notes);

    card.appendChild(head);
    card.appendChild(grid);

    wrap.appendChild(card);
  });
}

function renderTemples(){
  const wrap = el("templesWrap");
  wrap.innerHTML = "";

  temples.forEach(t => {
    const score = clamp(Number(state.templeScores[t.id] ?? 0), -3, 3);
    const status = getTempleStatus(score);

    const card = document.createElement("div");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "cardHead";

    const left = document.createElement("div");
    left.className = "faction";

    const icon = document.createElement("div");
    icon.className = "icon";
    icon.textContent = t.icon;

    const text = document.createElement("div");
    text.className = "factionText";
    text.innerHTML = `
      <div class="factionName">${escapeHtml(t.name)}</div>
      <div class="factionMeta">Status: ${escapeHtml(status)}</div>
    `;

    left.appendChild(icon);
    left.appendChild(text);

    const pill = document.createElement("div");
    pill.className = "pill" + (score < 0 ? " bad" : "");
    pill.textContent = `Score: ${score}`;

    head.appendChild(left);
    head.appendChild(pill);

    const grid = document.createElement("div");
    grid.className = "grid";

    const sRow = document.createElement("div");
    sRow.className = "sliderRow";

    const lab = document.createElement("label");
    lab.textContent = "Standing";

    const range = document.createElement("input");
    range.type = "range";
    range.min = "-3";
    range.max = "3";
    range.step = "1";
    range.value = String(score);

    const scoreBox = document.createElement("div");
    scoreBox.className = "scoreBox";
    scoreBox.textContent = String(score);

    range.addEventListener("input", () => {
      const next = clamp(Number(range.value), -3, 3);
      scoreBox.textContent = String(next);
      state.templeScores[t.id] = next;
      saveState();
      renderTemples();
    });

    sRow.appendChild(lab);
    sRow.appendChild(range);
    sRow.appendChild(scoreBox);

    const effectsWrap = document.createElement("div");
    effectsWrap.className = "effects";

    const h = document.createElement("h4");
    h.textContent = "Active Effects";

    const ul = document.createElement("ul");
    const effects = getTempleActiveEffects(t.id, score);
    effects.forEach(eff => {
      const li = document.createElement("li");
      li.textContent = eff;
      ul.appendChild(li);
    });

    const notes = document.createElement("textarea");
    notes.className = "smallNotes";
    notes.placeholder = "Notes: vows, offerings, sins, blessings...";
    notes.value = state.templeNotes[t.id] || "";
    notes.addEventListener("input", () => {
      state.templeNotes[t.id] = notes.value;
      saveState();
    });

    effectsWrap.appendChild(h);
    effectsWrap.appendChild(ul);

    grid.appendChild(sRow);
    grid.appendChild(effectsWrap);
    grid.appendChild(notes);

    card.appendChild(head);
    card.appendChild(grid);

    wrap.appendChild(card);
  });
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* ---------------------------
   6) EXPORT / IMPORT / RESET
---------------------------- */

el("btnReset").addEventListener("click", () => {
  if(!confirm("Reset all scores + notes on this device?")) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

el("btnExport").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `scarlett-honour-tracker-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

el("importFile").addEventListener("change", async () => {
  const file = el("importFile").files?.[0];
  if(!file) return;

  try{
    const text = await file.text();
    const parsed = JSON.parse(text);

    // shallow validate
    if(!parsed || typeof parsed !== "object") throw new Error("Invalid JSON");

    // merge into default to ensure missing keys don’t break anything
    const next = defaultState();
    Object.assign(next, parsed);

    // clamp safety
    clans.forEach(c => next.clanScores[c.id] = clamp(Number(next.clanScores[c.id] ?? 0), -5, 5));
    temples.forEach(t => next.templeScores[t.id] = clamp(Number(next.templeScores[t.id] ?? 0), -3, 3));

    Object.assign(state, next);
    saveState();
    render();
    alert("Imported successfully.");
  }catch(e){
    console.error(e);
    alert("Import failed. Make sure you’re importing a JSON file exported from this app.");
  }finally{
    el("importFile").value = "";
  }
});

/* ---------------------------
   7) BOOT
---------------------------- */

render();
