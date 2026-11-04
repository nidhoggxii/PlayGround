import {
  CARD_DEFS,
  FACTIONS,
  FACTION_BY_ID,
  BANNERS,
  BANNER_BY_ID,
  NODE_INFO,
  RARITY,
  ROWS,
  ROMAN_FLOORS,
  getCard,
  factionCards,
} from './data.js'

/* ═══════════════════════════════════════════════════════════
   COSTANTI, STATO E UTILITÀ
   ═══════════════════════════════════════════════════════════ */
export const META_KEY = 'echi-meta-v1'
export const RUN_KEY = 'echi-run-v1'
export const START_MORALE = 35
export const START_GOLD = 25
export const DECK_LIMIT = 40
export const MAX_HAND = 8

export const ROW_ORDER = ['front', 'support', 'supply']
export const ROW_SHORT = { front: '1ª linea', support: 'Supporto', supply: 'Rifornimento' }
export const ROW_CARD_LABEL = { front: 'PRIMA LINEA', support: 'SUPPORTO', supply: 'RIFORNIMENTO' }

export const state = {
  meta: null,
  run: null,
  battle: null,
  screen: 'title',
  selectedCard: null,
  reward: null,
  shopNode: null,
  eventNode: null,
  eventResult: null,
  campNode: null,
  archiveFaction: 'greece',
  modal: null,
  lastRun: null,
}

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const rand = (n) => Math.floor(Math.random() * n)
export const pick = (arr) => arr[rand(arr.length)]
export const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

export function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function weightedPick(items, weightOf) {
  const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0)
  if (total <= 0) return items[0]
  let roll = Math.random() * total
  for (const item of items) {
    roll -= Math.max(0, weightOf(item))
    if (roll <= 0) return item
  }
  return items[items.length - 1]
}

export function makeCardInstance(id, upgraded = false) {
  return { uid: uid(), id, upgraded }
}

export function groupDeck(deck) {
  const map = new Map()
  for (const inst of deck) {
    const key = `${inst.id}|${inst.upgraded ? 1 : 0}`
    if (!map.has(key)) map.set(key, { id: inst.id, upgraded: !!inst.upgraded, count: 0 })
    map.get(key).count++
  }
  return [...map.values()].sort((a, b) => {
    const ca = getCard(a.id)
    const cb = getCard(b.id)
    return ROW_ORDER.indexOf(ca.row) - ROW_ORDER.indexOf(cb.row) || ca.cost - cb.cost || ca.name.localeCompare(cb.name)
  })
}

/* ═══════════════════════════════════════════════════════════
   PROGRESSIONE PERSISTENTE
   ═══════════════════════════════════════════════════════════ */
function defaultMeta() {
  const unlocked = {}
  for (const faction of FACTIONS) unlocked[faction.id] = [...faction.core]
  return {
    version: 1,
    unlocked,
    echoes: 0,
    runs: 0,
    wins: 0,
    bestFloor: 0,
    sound: true,
  }
}

export function loadMeta() {
  let saved = null
  try {
    saved = JSON.parse(localStorage.getItem(META_KEY) || 'null')
  } catch {
    saved = null
  }
  const meta = { ...defaultMeta(), ...(saved && typeof saved === 'object' ? saved : {}) }
  meta.unlocked = meta.unlocked && typeof meta.unlocked === 'object' ? meta.unlocked : {}
  for (const faction of FACTIONS) {
    const valid = new Set(factionCards(faction.id).map((c) => c.id))
    const list = Array.isArray(meta.unlocked[faction.id]) ? meta.unlocked[faction.id].filter((id) => valid.has(id)) : []
    meta.unlocked[faction.id] = [...new Set([...faction.core, ...list])]
  }
  meta.echoes = Number.isFinite(meta.echoes) ? Math.max(0, meta.echoes) : 0
  meta.runs = Number.isFinite(meta.runs) ? Math.max(0, meta.runs) : 0
  meta.wins = Number.isFinite(meta.wins) ? Math.max(0, meta.wins) : 0
  meta.bestFloor = Number.isFinite(meta.bestFloor) ? meta.bestFloor : 0
  meta.sound = meta.sound !== false
  return meta
}

export function saveMeta() {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(state.meta))
  } catch {
    /* storage piena o disabilitata: il gioco continua in memoria */
  }
}

export function isUnlocked(cardId) {
  const card = getCard(cardId)
  if (!card) return false
  return state.meta.unlocked[card.faction]?.includes(cardId) || false
}

export function unlockedCards(factionId) {
  return factionCards(factionId).filter((c) => isUnlocked(c.id))
}

export function totalUnlocked() {
  return FACTIONS.reduce((sum, f) => sum + (state.meta.unlocked[f.id]?.length || 0), 0)
}

export function totalCards() {
  return Object.keys(CARD_DEFS).length
}

export function loadSavedRun() {
  try {
    const run = JSON.parse(localStorage.getItem(RUN_KEY) || 'null')
    if (!run || !run.inProgress || !run.id || !FACTION_BY_ID[run.factionId]) return null
    if (!Array.isArray(run.map) || !Array.isArray(run.deck) || run.map.length < 3) return null
    if (!Number.isFinite(run.morale) || !Number.isFinite(run.floor)) return null
    run.deck = run.deck.filter((inst) => inst && getCard(inst.id))
    if (!run.deck.length) return null
    return run
  } catch {
    return null
  }
}

export function saveRun() {
  if (!state.run || !state.run.inProgress) return
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(state.run))
  } catch {
    /* ignora */
  }
}

export function clearSavedRun() {
  try {
    localStorage.removeItem(RUN_KEY)
  } catch {
    /* ignora */
  }
}

/* ═══════════════════════════════════════════════════════════
   MAZZO E SPEDIZIONE
   ═══════════════════════════════════════════════════════════ */
export function buildStarterDeck(faction) {
  const deck = faction.starter.map((id) => makeCardInstance(id))
  const extra = state.meta.unlocked[faction.id].filter((id) => !faction.core.includes(id))
  for (const id of extra) deck.push(makeCardInstance(id))
  return deck
}

export function createRun(factionId) {
  const faction = FACTION_BY_ID[factionId]
  const run = {
    version: 1,
    id: uid(),
    factionId,
    deck: buildStarterDeck(faction),
    morale: START_MORALE,
    maxMorale: START_MORALE,
    gold: START_GOLD,
    floor: 0,
    map: generateMap(factionId),
    path: [],
    banners: [],
    inProgress: true,
    startedAt: Date.now(),
    stats: { battlesWon: 0, elitesWon: 0, cardsPlayed: 0, damageDealt: 0, healed: 0 },
  }
  return run
}

const FLOOR_TEMPLATES = [
  ['battle', 'battle'],
  ['battle', 'event'],
  ['elite', 'shop'],
  ['battle', 'camp'],
  ['elite', 'event'],
  ['shop', 'battle'],
  ['boss'],
]

const BATTLE_LINES = [
  'Un’avanguardia nemica blocca il passaggio. Nessuno passerà senza combattere.',
  'Le insegne nemiche avanzano tra la polvere. È ora di schierare le tue carte.',
  'Un avamposto ben difeso controlla la strada. Spezzane le linee.',
]

export function generateMap(playerFactionId) {
  const enemyPool = shuffle(FACTIONS.filter((f) => f.id !== playerFactionId).map((f) => f.id))
  let enemyCursor = 0
  const nextEnemy = () => {
    const id = enemyPool[enemyCursor % enemyPool.length]
    enemyCursor++
    return id
  }
  const eventIds = shuffle(EVENTS.map((e) => e.id))

  return FLOOR_TEMPLATES.map((types, floor) => types.map((type, index) => {
    const node = {
      id: `n${floor}_${index}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      floor,
      title: '',
      desc: '',
      factionId: null,
      difficulty: 'normal',
      gold: 0,
      eventId: null,
      stock: null,
      services: null,
      cleared: false,
    }
    if (type === 'battle' || type === 'elite' || type === 'boss') {
      const enemyId = nextEnemy()
      const enemy = FACTION_BY_ID[enemyId]
      node.factionId = enemyId
      if (type === 'battle') {
        node.title = `Avamposto ${enemy.ofName}`
        node.desc = pick(BATTLE_LINES)
        node.difficulty = 'normal'
        node.morale = 20 + floor * 2
        node.energy = 2 + Math.floor(floor / 2)
        node.scale = 1 + floor * 0.03
        node.gold = 24 + floor * 4
      } else if (type === 'elite') {
        node.title = `Guardia Scelta ${enemy.ofName}`
        node.desc = 'Truppe scelte e un comandante esperto. Ricompensa maggiore, ma la guardia non cede facilmente.'
        node.difficulty = 'elite'
        node.morale = 30 + floor * 2
        node.energy = 3
        node.scale = 1.16 + floor * 0.02
        node.gold = 52 + floor * 3
      } else {
        node.title = 'Il Signore della Guerra'
        node.desc = `L’ultima armata ${enemy.ofName} si è radunata oltre il passo. Sconfiggila per completare la spedizione.`
        node.difficulty = 'boss'
        node.morale = 44
        node.energy = 4
        node.scale = 1.3
        node.gold = 110
      }
    } else if (type === 'shop') {
      node.title = 'Mercante Errante'
      node.desc = 'Un carro carico di carte, reliquie e provviste. L’oro cambia mani, la strada continua.'
      node.gold = 0
    } else if (type === 'camp') {
      node.title = 'Accampamento'
      node.desc = 'Un fuoco acceso e un po’ di tempo. Puoi curare le ferite, affinare una carta o alleggerire il mazzo.'
      node.gold = 0
    } else {
      node.title = 'Lungo la Strada'
      node.desc = 'Qualcosa attende lungo il cammino. Una scelta, e nessun ritorno.'
      node.eventId = eventIds[floor % eventIds.length] || 'temple'
      node.gold = 0
    }
    return node
  }))
}

export function findNode(nodeId) {
  if (!state.run) return null
  for (const floor of state.run.map) {
    const node = floor.find((n) => n.id === nodeId)
    if (node) return node
  }
  return null
}

export function healRun(run, amount) {
  const before = run.morale
  run.morale = clamp(run.morale + amount, 0, run.maxMorale)
  const healed = run.morale - before
  if (healed > 0) run.stats.healed += healed
  return healed
}

export function hasBanner(run, id) {
  return !!run?.banners?.includes(id)
}

export function bannerModifiers(run) {
  return {
    frontAtk: hasBanner(run, 'banner_war') ? 1 : 0,
    firstEnergy: hasBanner(run, 'banner_drum') ? 1 : 0,
    firstDraw: hasBanner(run, 'banner_map') ? 1 : 0,
    healAfter: hasBanner(run, 'banner_supplies') ? 6 : 0,
    goldMult: hasBanner(run, 'banner_gold') ? 1.3 : 1,
  }
}

export function grantRandomBanner(run) {
  const owned = new Set(run.banners)
  const available = BANNERS.filter((b) => !owned.has(b.id))
  if (!available.length) return null
  const banner = pick(available)
  run.banners.push(banner.id)
  if (banner.id === 'banner_courage') {
    run.maxMorale += 6
    healRun(run, 6)
  }
  return banner
}

export function pickBannerOptions(run, count = 2) {
  const owned = new Set(run.banners)
  return shuffle(BANNERS.filter((b) => !owned.has(b.id))).slice(0, count)
}

export function randomUnlockedCard(factionId, options = {}) {
  let pool = unlockedCards(factionId)
  if (!pool.length) return null
  if (options.excludeIds?.length) {
    const excluded = new Set(options.excludeIds)
    const filtered = pool.filter((c) => !excluded.has(c.id))
    if (filtered.length) pool = filtered
  }
  if (options.rarity) {
    const filtered = pool.filter((c) => c.rarity === options.rarity)
    if (filtered.length) pool = filtered
  }
  return weightedPick(pool, (c) => RARITY[c.rarity].weight)
}

export function addRandomCardToRun(run, options = {}) {
  if (run.deck.length >= DECK_LIMIT) return null
  const def = randomUnlockedCard(run.factionId, options)
  if (!def) return null
  run.deck.push(makeCardInstance(def.id))
  return def
}

export function upgradeRandomCard(run) {
  const eligible = run.deck.filter((inst) => !inst.upgraded)
  if (!eligible.length) return null
  const inst = pick(eligible)
  inst.upgraded = true
  return getCard(inst.id)
}

export function cardRewardOptions(run, count = 3) {
  const chosen = []
  const exclude = []
  while (chosen.length < count) {
    const def = randomUnlockedCard(run.factionId, { excludeIds: exclude })
    if (!def) break
    chosen.push(def)
    exclude.push(def.id)
  }
  if (chosen.length < count) {
    const pool = unlockedCards(run.factionId)
    while (chosen.length < count && pool.length) {
      const def = pick(pool)
      if (!chosen.some((c) => c.id === def.id)) chosen.push(def)
      else break
    }
  }
  return chosen
}

export function grantRandomUnlocks(factionId, count) {
  const faction = FACTION_BY_ID[factionId]
  const owned = new Set(state.meta.unlocked[factionId])
  const available = shuffle(faction.locked.filter((id) => !owned.has(id)))
  const picked = available.slice(0, count)
  state.meta.unlocked[factionId].push(...picked)
  return picked.map((id) => getCard(id))
}

export function completeNode(node) {
  const run = state.run
  if (!run) return 'none'
  const floor = node.floor
  node.cleared = true
  run.path[floor] = {
    id: node.id,
    type: node.type,
    title: node.title,
    factionId: node.factionId,
    floor,
  }
  run.floor = Math.max(run.floor, floor + 1)
  state.selectedCard = null
  state.reward = null
  state.shopNode = null
  state.eventNode = null
  state.eventResult = null
  state.campNode = null
  if (run.floor >= run.map.length) {
    saveRun()
    return 'finished'
  }
  saveRun()
  return 'map'
}

export function endRun(victory, reason = '') {
  const run = state.run
  if (!run) return null
  run.inProgress = false
  const cleared = run.path.filter(Boolean).length
  let echoes = 10 + cleared * 9 + (victory ? 45 : 0) + Math.min(40, Math.floor(run.gold / 5))

  let unlocks = []
  if (cleared >= 2 || victory) {
    const count = victory ? 2 : 1
    unlocks = grantRandomUnlocks(run.factionId, count)
    echoes += Math.max(0, count - unlocks.length) * 30
  }

  state.meta.echoes += echoes
  state.meta.runs += 1
  if (victory) state.meta.wins += 1
  state.meta.bestFloor = Math.max(state.meta.bestFloor || 0, cleared)

  const summary = {
    victory,
    reason,
    factionId: run.factionId,
    factionName: FACTION_BY_ID[run.factionId].name,
    emblem: FACTION_BY_ID[run.factionId].emblem,
    accent: FACTION_BY_ID[run.factionId].accent,
    cleared,
    totalFloors: run.map.length,
    echoes,
    unlocks,
    gold: run.gold,
    morale: run.morale,
    maxMorale: run.maxMorale,
    deckSize: run.deck.length,
    stats: { ...run.stats },
    banners: [...run.banners],
    floor: run.floor,
  }

  saveMeta()
  clearSavedRun()
  state.run = null
  state.battle = null
  state.reward = null
  state.selectedCard = null
  return summary
}

/* ═══════════════════════════════════════════════════════════
   EVENTI LUNGO LA STRADA
   ═══════════════════════════════════════════════════════════ */
export const EVENTS = [
  {
    id: 'temple',
    title: 'Il Tempio in Rovina',
    icon: '🏛️',
    text: 'Colonne spezzate emergono dall’erba alta. Sul fondo, un altare ancora intatto. Le offerte dei fedeli brillano nella polvere.',
    options: [
      {
        label: 'Prega gli dèi antichi',
        desc: 'Recupera 14 Morale.',
        icon: '🙏',
        apply(run) {
          const healed = healRun(run, 14)
          return healed > 0 ? `Una pace improvvisa ti attraversa. Recuperi ${healed} Morale.` : 'Il tuo Morale era già al massimo. Gli dèi sorridono comunque.'
        },
      },
      {
        label: 'Saccheggia le offerte',
        desc: '+45 oro, ma −5 Morale.',
        icon: '💰',
        apply(run) {
          run.gold += 45
          run.morale = Math.max(1, run.morale - 5)
          return 'Riempì le tasche d’oro sacro. Qualcosa, dentro di te, si è incrinato. +45 oro, −5 Morale.'
        },
      },
    ],
  },
  {
    id: 'merchant',
    title: 'Il Mercante di Reliquie',
    icon: '🧳',
    text: 'Un uomo magro spinge un carretto coperto di amuleti e carte ingiallite. «Per te, un prezzo speciale. Solo per oggi.»',
    options: [
      {
        label: 'Compra una carta',
        desc: '−40 oro. Aggiungi una carta sbloccata casuale.',
        icon: '🃏',
        can(run) { return run.gold >= 40 && run.deck.length < DECK_LIMIT },
        apply(run) {
          run.gold -= 40
          const def = addRandomCardToRun(run)
          return def ? `Il mercante sorride. «Ottima scelta.» Ottieni ${def.name}. −40 oro.` : 'Il mercante fruga invano. Non ha nulla che tu non possieda già.'
        },
      },
      {
        label: 'Vendi una cianfrusaglia',
        desc: '+20 oro.',
        icon: '🪙',
        apply(run) {
          run.gold += 20
          return 'Vendi un vecchio ciondolo ammaccato. +20 oro.'
        },
      },
    ],
  },
  {
    id: 'forge',
    title: 'La Fucina Abbandonata',
    icon: '🔨',
    text: 'Il fuoco è ancora vivo. Strumenti antichi pendono dalle pareti, come se il fabbro fosse appena uscito. Una carta può diventare più affilata.',
    options: [
      {
        label: 'Tempra una carta',
        desc: 'Potenzia una carta casuale del mazzo.',
        icon: '⚒️',
        can(run) { return run.deck.some((c) => !c.upgraded) },
        apply(run) {
          const def = upgradeRandomCard(run)
          return def ? `Il metallo canta sotto il martello. ${def.name} è stata potenziata: +1/+1.` : 'Non c’è nulla da temprare.'
        },
      },
      {
        label: 'Raccogli il ferro',
        desc: '+30 oro.',
        icon: '🪙',
        apply(run) {
          run.gold += 30
          return 'Raccogli lingotti e chiodi arrugginiti. +30 oro.'
        },
      },
    ],
  },
  {
    id: 'spring',
    title: 'La Fonte Sacra',
    icon: '💧',
    text: 'L’acqua è limpida e fredda. Incisa nella pietra, una promessa: «Chi beve, ricorda. Chi canta, non dimentica.»',
    options: [
      {
        label: 'Bevi dalla fonte',
        desc: 'Recupera 16 Morale.',
        icon: '🥤',
        apply(run) {
          const healed = healRun(run, 16)
          return healed > 0 ? `L’acqua brucia e poi ristora. Recuperi ${healed} Morale.` : 'Sei già in pace. L’acqua ti rinfresca soltanto.'
        },
      },
      {
        label: 'Canta un inno di guerra',
        desc: 'Ottieni uno Stendardo casuale.',
        icon: '🎶',
        can(run) { return pickBannerOptions(run, 1).length > 0 },
        apply(run) {
          const banner = grantRandomBanner(run)
          return banner ? `La tua voce rimbalza tra le rocce. Ottieni lo Stendardo «${banner.name}».` : 'Il canto si perde nel vento. Non c’è più gloria da raccogliere.'
        },
      },
    ],
  },
  {
    id: 'deserters',
    title: 'I Disertori',
    icon: '🏳️',
    text: 'Tre soldati nemici hanno gettato le armi. Conoscono le strade, le sentinelle e i punti deboli dell’armata che ti attende.',
    options: [
      {
        label: 'Ingaggiali',
        desc: '−30 oro. Aggiungi una carta sbloccata casuale.',
        icon: '🤝',
        can(run) { return run.gold >= 30 && run.deck.length < DECK_LIMIT },
        apply(run) {
          run.gold -= 30
          const def = addRandomCardToRun(run)
          return def ? `I disertori si uniscono a te. Ottieni ${def.name}. −30 oro.` : 'Ti guardano, poi scuotono la testa. Non c’è posto per loro.'
        },
      },
      {
        label: 'Cacciali',
        desc: '+20 oro, −6 Morale.',
        icon: '🫸',
        apply(run) {
          run.gold += 20
          run.morale = Math.max(1, run.morale - 6)
          return 'Li derubi e li lasci al loro destino. +20 oro, −6 Morale.'
        },
      },
    ],
  },
  {
    id: 'oracle',
    title: 'L’Oracolo Errante',
    icon: '🔮',
    text: 'Una figura incappucciata osserva le tue carte senza toccarle. «Vedo una strada, e vedo un prezzo. Vuoi sapere quale delle due è reale?»',
    options: [
      {
        label: 'Consulta l’Oracolo',
        desc: '−30 oro. Aggiungi una carta rara o superiore se disponibile.',
        icon: '👁️',
        can(run) { return run.gold >= 30 && run.deck.length < DECK_LIMIT },
        apply(run) {
          run.gold -= 30
          const rare = addRandomCardToRun(run, { rarity: 'rare' })
          const def = rare || addRandomCardToRun(run, { rarity: 'epic' }) || addRandomCardToRun(run)
          return def ? `L’Oracolo traccia un segno nell’aria. Ottieni ${def.name}. −30 oro.` : 'L’Oracolo ride. «Il tuo mazzo è già pieno di risposte.»'
        },
      },
      {
        label: 'Rifiuta la profezia',
        desc: '+25 oro.',
        icon: '🚶',
        apply(run) {
          run.gold += 25
          return 'Te ne vai senza voltarti. L’Oracolo non ti segue. +25 oro.'
        },
      },
    ],
  },
]

export function eventById(id) {
  return EVENTS.find((e) => e.id === id) || EVENTS[0]
}

/* ═══════════════════════════════════════════════════════════
   AUDIO MINIMALE (WebAudio, nessun file esterno)
   ═══════════════════════════════════════════════════════════ */
let audioCtx = null

function getAudio() {
  if (!state.meta?.sound) return null
  try {
    if (!audioCtx) {
      const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext
      if (!Ctx) return null
      audioCtx = new Ctx()
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
    return audioCtx
  } catch {
    return null
  }
}

function tone(freq, duration = 0.08, type = 'sine', volume = 0.035, delay = 0) {
  const ctx = getAudio()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const start = ctx.currentTime + delay
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + duration + 0.02)
  } catch {
    /* audio non disponibile */
  }
}

export function playSound(name) {
  if (!state.meta?.sound) return
  switch (name) {
    case 'click': tone(210, 0.035, 'square', 0.018); break
    case 'play': tone(330, 0.07, 'triangle', 0.03); tone(440, 0.08, 'triangle', 0.026, 0.045); break
    case 'hit': tone(110, 0.09, 'sawtooth', 0.03); break
    case 'heal': tone(520, 0.09, 'sine', 0.025); tone(660, 0.1, 'sine', 0.02, 0.055); break
    case 'shield': tone(290, 0.07, 'triangle', 0.022); break
    case 'gold': tone(720, 0.05, 'square', 0.018); tone(980, 0.06, 'square', 0.015, 0.04); break
    case 'win': [392, 523, 659, 784].forEach((f, i) => tone(f, 0.14, 'triangle', 0.03, i * 0.09)); break
    case 'lose': [330, 277, 220, 165].forEach((f, i) => tone(f, 0.18, 'sine', 0.03, i * 0.12)); break
    case 'map': tone(392, 0.06, 'triangle', 0.02); tone(523, 0.08, 'triangle', 0.02, 0.05); break
    case 'unlock': [523, 659, 880].forEach((f, i) => tone(f, 0.12, 'sine', 0.028, i * 0.08)); break
    default: tone(300, 0.04, 'sine', 0.02)
  }
}
