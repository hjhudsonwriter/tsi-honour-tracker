/* Scarlett Isles — Honour & Respect Tracker
   - Clans: -5..+5
   - Temples: -3..+3
   - Auto-saves to localStorage
   - Displays cumulative active effects based on your reference document
*/

const STORAGE_KEY = "scarlettHonourTracker.v1";

const ASSET_VER = "v2";

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
  { id: "blackstone", name: "Clan Blackstone", alignedTemple: "telluria", hasModifiers: true,  iconImg: `assets/icons/BlackstoneSigil.png?v=${ASSET_VER}` },
  { id: "bacca",      name: "Clan Bacca",      alignedTemple: "telluria", hasModifiers: false, iconImg: `assets/icons/BaccaSigil.png?v=${ASSET_VER}` },
  { id: "farmer",     name: "Clan Farmer",     alignedTemple: "aurush",   hasModifiers: true,  iconImg: `assets/icons/FarmerSigil.png?v=${ASSET_VER}` },
  { id: "slade",      name: "Clan Slade",      alignedTemple: "telluria", hasModifiers: false, iconImg: `assets/icons/SladeSigil.png?v=${ASSET_VER}` },
  { id: "molten",     name: "Clan Molten",     alignedTemple: "aurush",   hasModifiers: false, iconImg: `assets/icons/MoltenSigil.png?v=${ASSET_VER}` },
  { id: "karr",       name: "Clan Karr",       alignedTemple: "pelagos",  hasModifiers: false, iconImg: `assets/icons/KarrSigil.png?v=${ASSET_VER}` },
  { id: "rowthorn",   name: "Clan Rowthorn",   alignedTemple: "pelagos",  hasModifiers: true,  iconImg: `assets/icons/RowthornSigil.png?v=${ASSET_VER}` },
];

/* ---------------------------
   2) RULES (SIMPLIFIED CANON)
   Source-of-truth: Scarlett_Isles_Simplified_Honour_System_FINAL.docx :contentReference[oaicite:1]{index=1}
---------------------------- */

/*
  IMPORTANT BEHAVIOUR (Banded):
  Clan scale -5..+5 uses these bands:
    -5..-4 => HUNTED
    -3..-2 => HOSTILE
    -1     => DISTRUSTED
     0     => NEUTRAL
    +1..+2 => TRUSTED
    +3..+4 => ALLIED
    +5     => SANCTUARY

  Temple scale -3..+3 uses these bands:
    -3        => ANATHEMA
    -2..-1    => EXCOMMUNICATE
     0        => NEUTRAL
    +1..+2    => BLESSED
    +3        => CHOSEN
*/

function clanBand(score){
  if (score <= -4) return -5;
  if (score <= -2) return -3;
  if (score === -1) return -1;
  if (score === 0) return 0;
  if (score <= 2) return 1;
  if (score <= 4) return 3;
  return 5;
}

function templeBand(score){
  if (score <= -3) return -3;
  if (score <= -1) return -2;
  if (score === 0) return 0;
  if (score <= 2) return 1;
  return 3;
}

// Universal clan effects by band
const clanUniversal = {
  "-5": {
    status: "HUNTED",
    effects: [
      "ECONOMY: No trade.",
      "FACTION SOCIAL: Hostile.",
      "LOCAL NPC SOCIAL: Refuse aid.",
      "ACCESS & MOVEMENT: On-sight hostility.",
    ],
  },
  "-3": {
    status: "HOSTILE",
    effects: [
      "ECONOMY: +50% prices.",
      "FACTION SOCIAL: Disadvantage.",
      "LOCAL NPC SOCIAL: Fearful.",
      "ACCESS & MOVEMENT: Escorted / denied.",
    ],
  },
  "-1": {
    status: "DISTRUSTED",
    effects: [
      "ECONOMY: +20% prices.",
      "FACTION SOCIAL: Cold, higher DCs.",
      "LOCAL NPC SOCIAL: Wary.",
      "ACCESS & MOVEMENT: Public areas only.",
    ],
  },
  "0": {
    status: "NEUTRAL",
    effects: [
      "ECONOMY: Standard.",
      "FACTION SOCIAL: Normal.",
      "LOCAL NPC SOCIAL: Neutral.",
      "ACCESS & MOVEMENT: Public access.",
    ],
  },
  "1": {
    status: "TRUSTED",
    effects: [
      "ECONOMY: −10% prices.",
      "FACTION SOCIAL: Advantage once/day.",
      "LOCAL NPC SOCIAL: Helpful.",
      "ACCESS & MOVEMENT: Limited restricted access.",
    ],
  },
  "3": {
    status: "ALLIED",
    effects: [
      "ECONOMY: −25% prices.",
      "FACTION SOCIAL: Advantage.",
      "LOCAL NPC SOCIAL: Supportive.",
      "ACCESS & MOVEMENT: Free movement.",
    ],
  },
  "5": {
    status: "SANCTUARY",
    effects: [
      "ECONOMY: Favours over coin.",
      "FACTION SOCIAL: Automatic cooperation.",
      "LOCAL NPC SOCIAL: Shelter & secrecy.",
      "ACCESS & MOVEMENT: Safe haven.",
    ],
  },
};

// Clan-specific boon tracks (ONLY applies in that clan’s territory)
const clanBoonTracks = {
  blackstone: {
    label: "FACTION BOON (Blackstone)",
    steps: [
      { when: (s) => s <= -3, text: "Forest and Wardens resist you; disadvantage on navigation and stealth checks." },
      { when: (s) => s >= 1,  text: "Advantage on one Survival or Perception check per session." },
      { when: (s) => s >= 3,  text: "Ignore one instance of difficult terrain caused by roots or forest growth per session." },
      { when: (s) => s >= 5,  text: "Automatically avoid one patrol or environmental complication per session." },
    ],
  },
  bacca: {
    label: "FACTION BOON (Bacca)",
    steps: [
      { when: (s) => s <= -3, text: "Supplies run short; disadvantage on exhaustion saves in mountainous terrain." },
      { when: (s) => s >= 1,  text: "Advantage on one Athletics or Constitution check per session." },
      { when: (s) => s >= 3,  text: "Ignore the first level of exhaustion gained in mountainous terrain." },
      { when: (s) => s >= 5,  text: "Once per session, treat a failed physical check as a success through grit and endurance." },
    ],
  },
  slade: {
    label: "FACTION BOON (Slade)",
    steps: [
      { when: (s) => s <= -3, text: "Information dries up; disadvantage on Investigation and Insight checks." },
      { when: (s) => s >= 1,  text: "Advantage on one Investigation or Insight check per session." },
      { when: (s) => s >= 3,  text: "Once per session, ask the DM for one truthful rumour or warning about local threats." },
      { when: (s) => s >= 5,  text: "Automatically detect one ambush, deception, or hidden risk before it triggers." },
    ],
  },
  farmer: {
    label: "FACTION BOON (Farmer)",
    steps: [
      { when: (s) => s <= -3, text: "Marked as impure; disadvantage on Deception and Persuasion checks." },
      { when: (s) => s >= 1,  text: "Advantage on one Intimidation or Persuasion check per session." },
      { when: (s) => s >= 3,  text: "Once per session, command lesser NPCs to stand down or comply." },
      { when: (s) => s >= 5,  text: "Treated as an instrument of authority; minor opposition yields without a roll." },
    ],
  },
  molten: {
    label: "FACTION BOON (Molten)",
    steps: [
      { when: (s) => s <= -3, text: "Trade embargo; disadvantage on checks to acquire goods or services." },
      { when: (s) => s >= 1,  text: "Advantage on one negotiation or appraisal check per session." },
      { when: (s) => s >= 3,  text: "Reduce the cost of one major purchase by 50% per session." },
      { when: (s) => s >= 5,  text: "Once per session, acquire a rare or restricted item without delay." },
    ],
  },
  rowthorn: {
    label: "FACTION BOON (Rowthorn)",
    steps: [
      { when: (s) => s <= -3, text: "Denied passage; disadvantage on travel and navigation checks." },
      { when: (s) => s >= 1,  text: "Advantage on one Survival or Vehicle (water) check per session." },
      { when: (s) => s >= 3,  text: "Ignore one sea or coastal travel complication per session." },
      { when: (s) => s >= 5,  text: "Automatically secure safe passage by sea or river when possible." },
    ],
  },
  karr: {
    label: "FACTION BOON (Karr)",
    steps: [
      { when: (s) => s <= -3, text: "Harsh welcome; disadvantage on cold weather and survival checks." },
      { when: (s) => s >= 1,  text: "Advantage on one Survival or Intimidation check per session." },
      { when: (s) => s >= 3,  text: "Ignore one cold, storm, or fatigue-related penalty per session." },
      { when: (s) => s >= 5,  text: "Once per session, shrug off environmental hardship that would hinder others." },
    ],
  },
};

// Universal temple effects by band
const templeUniversal = {
  "-3": {
    status: "ANATHEMA",
    effects: [
      "ECONOMY (Rituals): No services.",
      "TEMPLE SOCIAL: Hostile clergy.",
      "ACCESS & MOVEMENT: Barred / hunted.",
    ],
  },
  "-2": {
    status: "EXCOMMUNICATE",
    effects: [
      "ECONOMY (Rituals): +50% cost.",
      "TEMPLE SOCIAL: Disadvantage.",
      "ACCESS & MOVEMENT: Watched access.",
    ],
  },
  "0": {
    status: "NEUTRAL",
    effects: [
      "ECONOMY (Rituals): Standard.",
      "TEMPLE SOCIAL: Normal.",
      "ACCESS & MOVEMENT: Public shrines.",
    ],
  },
  "1": {
    status: "BLESSED",
    effects: [
      "ECONOMY (Rituals): −20% cost.",
      "TEMPLE SOCIAL: Advantage once/day.",
      "ACCESS & MOVEMENT: Escorted inner access.",
    ],
  },
  "3": {
    status: "CHOSEN",
    effects: [
      "ECONOMY (Rituals): Symbolic offerings.",
      "TEMPLE SOCIAL: Automatic respect.",
      "ACCESS & MOVEMENT: Sanctuary.",
    ],
  },
};

// Temple boons
const templeBoons = {
  telluria: [
    { when: (s) => s >= 1, text: "FACTION BOON (Telluria): Advantage on one STR/CON save per session." },
    { when: (s) => s >= 3, text: "FACTION BOON (Telluria): Ignore one environmental hazard." },
  ],
  aurush: [
    { when: (s) => s >= 1, text: "FACTION BOON (Aurush): Add +1 radiant damage once per session." },
    { when: (s) => s >= 3, text: "FACTION BOON (Aurush): Advantage vs fear/charm in one encounter." },
  ],
  pelagos: [
    { when: (s) => s >= 1, text: "FACTION BOON (Pelagos): Advantage on one water movement check." },
    { when: (s) => s >= 3, text: "FACTION BOON (Pelagos): Negate one sea travel complication." },
  ],
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
  const band = String(clanBand(score));
  return clanUniversal[band]?.status || "UNKNOWN";
}

function getTempleStatus(score){
  const band = String(templeBand(score));
  return templeUniversal[band]?.status || "UNKNOWN";
}

function getClanActiveEffects(clanId, score){
  const band = String(clanBand(score));
  const effects = [];

  // Universal band effects (not cumulative)
  const base = clanUniversal[band]?.effects || [];
  effects.push(...base);

  // Clan boon track (only one track per clan)
  const track = clanBoonTracks[clanId];
  if(track){
    // choose all matching steps, but only show the MOST POWERFUL one for that side
    // negative side: show the <= -3 penalty if relevant
    // positive side: show the highest unlocked boon (+1/+3/+5)
    let negative = null;
    let positive = null;

    for(const step of track.steps){
      if(step.when(score)){
        if(score <= -3) negative = step.text;
        if(score >= 1)  positive = step.text;
      }
    }

    if(negative) effects.push(`${track.label}: ${negative}`);
    if(positive) effects.push(`${track.label}: ${positive}`);
  }

  return dedupe(effects);
}

function getTempleActiveEffects(templeId, score){
  const band = String(templeBand(score));
  const effects = [];

  // Universal band effects (not cumulative)
  const base = templeUniversal[band]?.effects || [];
  effects.push(...base);

  // Temple boons (show highest unlocked)
  const boons = templeBoons[templeId] || [];
  let best = null;
  for(const b of boons){
    if(b.when(score)) best = b.text;
  }
  if(best) effects.push(best);

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
function buildEffectsUI(effects){
  const wrap = document.createElement("div");
  wrap.className = "effectsList";

  effects.forEach(line => {
    const row = document.createElement("div");
    row.className = "effectRow";

    // Split "CATEGORY: text" into badge + text
    const idx = line.indexOf(":");
    let cat = "EFFECT";
    let text = line;

    if(idx > -1){
      cat = line.slice(0, idx).trim();
      text = line.slice(idx + 1).trim();
    }

    const tag = document.createElement("div");
    tag.className = "effectTag";
    tag.dataset.cat = cat;
    tag.textContent = cat;

    const body = document.createElement("div");
    body.className = "effectText";
    body.textContent = text;

    row.appendChild(tag);
    row.appendChild(body);
    wrap.appendChild(row);
  });

  return wrap;
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
    icon.innerHTML = clan.iconImg
  ? `<img src="${clan.iconImg}" alt="${escapeHtml(clan.name)} sigil" class="crest">`
  : "🛡️";

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

    const effects = getClanActiveEffects(clan.id, score);
effectsWrap.appendChild(buildEffectsUI(effects));


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

    const effects = getTempleActiveEffects(t.id, score);
effectsWrap.appendChild(buildEffectsUI(effects));

    const notes = document.createElement("textarea");
    notes.className = "smallNotes";
    notes.placeholder = "Notes: vows, offerings, sins, blessings...";
    notes.value = state.templeNotes[t.id] || "";
    notes.addEventListener("input", () => {
      state.templeNotes[t.id] = notes.value;
      saveState();
    });

    effectsWrap.appendChild(h);

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
