import {
  CARD_DEFS,
  FACTION_BY_ID,
  RARITY,
  ROWS,
  factionCards,
  getCard,
} from './data.js'
import {
  MAX_HAND,
  ROW_SHORT,
  clamp,
  makeCardInstance,
  playSound,
  shuffle,
  sleep,
  state,
  uid,
} from './core.js'

let hooks = {
  render: () => {},
  toast: () => {},
  onWin: () => {},
  onLose: () => {},
}

export function setBattleHooks(next) {
  hooks = { ...hooks, ...next }
}

function emptyUnits() {
  return { front: [null, null, null], support: [null, null, null], supply: [null, null, null] }
}

function addLog(message) {
  const b = state.battle
  if (!b) return
  b.log.push(message)
  if (b.log.length > 80) b.log.shift()
  b.lastMessage = message
}

function addFx(unit, text, cls) {
  const b = state.battle
  if (!b || !unit) return
  const token = { text, cls, at: Date.now() }
  b.fx[unit.uid] = token
  setTimeout(() => {
    if (state.battle === b && b.fx[unit.uid] === token) {
      delete b.fx[unit.uid]
      hooks.render()
    }
  }, 760)
}

function sideState(side) {
  return state.battle[side]
}

function foeSide(side) {
  return state.battle[side === 'player' ? 'enemy' : 'player']
}

function factionOfSide(side) {
  const b = state.battle
  return FACTION_BY_ID[side === 'player' ? b.playerFactionId : b.enemyFactionId]
}

function healUnit(unit, amount) {
  if (!unit || unit.hp <= 0) return 0
  const before = unit.hp
  unit.hp = Math.min(unit.maxHp, unit.hp + amount)
  return unit.hp - before
}

function dealDamage(unit, amount) {
  let remaining = Math.max(0, amount)
  let absorbed = 0
  if (unit.shield > 0) {
    absorbed = Math.min(unit.shield, remaining)
    unit.shield -= absorbed
    remaining -= absorbed
  }
  const hpBefore = unit.hp
  unit.hp -= remaining
  const killed = unit.hp <= 0
  const overkill = killed ? Math.max(0, remaining - hpBefore) : 0
  return { absorbed, hpLost: Math.min(hpBefore, remaining), overkill, killed }
}

function removeUnit(side, row, col) {
  const s = sideState(side)
  if (!s) return
  const unit = s.units[row][col]
  s.units[row][col] = null
  // La carta di un'unità caduta torna negli scarti: senza questo ricircolo
  // il mazzo (12 carte per 9 slot) si esaurisce e la mano resta vuota.
  if (unit) s.discard.push(makeCardInstance(unit.cardId, unit.upgraded))
}

function unitAt(side, row, col) {
  return sideState(side)?.units?.[row]?.[col] || null
}

function friendlyUnits(side) {
  const s = sideState(side)
  if (!s) return []
  return [...s.units.front, ...s.units.support, ...s.units.supply].filter(Boolean)
}

function rowUnits(side, row) {
  return (sideState(side)?.units?.[row] || []).filter(Boolean)
}

/* ═══════════════════════════════════════════════════════════
   EFFETTI DELLE CARTE
   ═══════════════════════════════════════════════════════════ */
function applyEffect(effect, side, unit) {
  const s = sideState(side)
  const foe = foeSide(side)
  if (!s || !unit) return null

  switch (effect.do) {
    case 'shieldSelf': {
      unit.shield += effect.n
      addFx(unit, `+${effect.n} scudo`, 'shield')
      return `ottiene Scudo ${effect.n}.`
    }
    case 'shieldRow': {
      const row = effect.row || 'front'
      const targets = rowUnits(side, row)
      if (!targets.length) return null
      for (const t of targets) {
        t.shield += effect.n
        addFx(t, `+${effect.n} scudo`, 'shield')
      }
      return `dona Scudo ${effect.n} a ${ROWS[row].label.toLowerCase()}.`
    }
    case 'healSelf': {
      const healed = healUnit(unit, effect.n)
      if (!healed) return null
      addFx(unit, `+${healed}`, 'heal')
      return `si cura di ${healed}.`
    }
    case 'healRow': {
      const row = effect.row || 'front'
      const targets = rowUnits(side, row)
      let total = 0
      for (const t of targets) {
        const healed = healUnit(t, effect.n)
        if (healed) {
          total += healed
          addFx(t, `+${healed}`, 'heal')
        }
      }
      if (!total) return null
      return `cura ${effect.n} a ${ROWS[row].label.toLowerCase()}.`
    }
    case 'healColumn': {
      const target = unitAt(side, effect.row || 'front', unit.col)
      if (!target) return null
      const healed = healUnit(target, effect.n)
      if (!healed) return null
      addFx(target, `+${healed}`, 'heal')
      return `cura ${target.name} di ${healed}.`
    }
    case 'healAll': {
      let healedAny = false
      for (const t of friendlyUnits(side)) {
        const healed = healUnit(t, effect.n)
        if (healed) {
          healedAny = true
          addFx(t, `+${healed}`, 'heal')
        }
      }
      return healedAny ? `cura ${effect.n} a tutte le unità alleate.` : null
    }
    case 'buffSelf': {
      unit.atk += effect.n
      addFx(unit, `+${effect.n} ATK`, 'buff')
      return `ottiene +${effect.n} ATK.`
    }
    case 'buffRow': {
      const row = effect.row || 'front'
      const targets = rowUnits(side, row)
      if (!targets.length) return null
      for (const t of targets) {
        t.atk += effect.n
        addFx(t, `+${effect.n} ATK`, 'buff')
      }
      return `dona +${effect.n} ATK a ${ROWS[row].label.toLowerCase()}.`
    }
    case 'buffColumn': {
      const target = unitAt(side, effect.row || 'front', unit.col)
      if (!target) return null
      target.atk += effect.n
      addFx(target, `+${effect.n} ATK`, 'buff')
      return `dona +${effect.n} ATK a ${target.name}.`
    }
    case 'damageColumn': {
      const row = effect.row || 'front'
      const target = unitAt(side === 'player' ? 'enemy' : 'player', row, unit.col)
      if (!target) return null
      const targetSide = side === 'player' ? 'enemy' : 'player'
      const res = dealDamage(target, effect.n)
      addFx(target, `-${effect.n}`, 'damage')
      if (res.killed) {
        removeUnit(targetSide, row, unit.col)
        return `colpisce ${target.name} per ${effect.n} danni e la abbatte.`
      }
      return `colpisce ${target.name} per ${effect.n} danni.`
    }
    case 'damageRow': {
      const row = effect.row || 'front'
      const targetSide = side === 'player' ? 'enemy' : 'player'
      const targets = rowUnits(targetSide, row)
      if (!targets.length) return null
      let killedNames = []
      for (const t of targets) {
        const tCol = t.col
        const res = dealDamage(t, effect.n)
        addFx(t, `-${effect.n}`, 'damage')
        if (res.killed) {
          removeUnit(targetSide, row, tCol)
          killedNames.push(t.name)
        }
      }
      return `infligge ${effect.n} danni a ${ROWS[row].label.toLowerCase()} nemica${killedNames.length ? ` (${killedNames.join(', ')} cadono)` : ''}.`
    }
    case 'selfDamage': {
      const res = dealDamage(unit, effect.n)
      addFx(unit, `-${effect.n}`, 'damage')
      if (res.killed) {
        removeUnit(side, unit.row, unit.col)
        return `subisce ${effect.n} danni e cade.`
      }
      return `subisce ${effect.n} danni.`
    }
    case 'morale': {
      const before = s.morale
      s.morale = clamp(s.morale + effect.n, 0, s.maxMorale)
      const gained = s.morale - before
      return gained > 0 ? `recupera ${gained} Morale.` : null
    }
    case 'draw': {
      const drawn = drawCards(side, effect.n)
      return drawn > 0 ? `pesca ${drawn} cart${drawn === 1 ? 'a' : 'e'}.` : null
    }
    case 'energy': {
      s.energy = Math.min(s.maxEnergy + 5, s.energy + effect.n)
      return `ottiene +${effect.n} energia.`
    }
    default:
      return null
  }
}

function triggerDeploy(side, unit) {
  if (!unit) return
  for (const effect of unit.effects) {
    if (effect.when !== 'deploy') continue
    if (unit.hp <= 0) break
    const msg = applyEffect(effect, side, unit)
    if (msg) addLog(`${unit.name}: ${msg}`)
  }
}

async function triggerEnd(side) {
  const b = state.battle
  if (!b) return
  // Anche la prima linea può avere effetti di fine turno (es. Falange, Berserker):
  // vanno risolti prima degli attacchi, altrimenti non si attiverebbero mai.
  for (const row of ['support', 'supply', 'front']) {
    for (let col = 0; col < 3; col++) {
      const unit = unitAt(side, row, col)
      if (!unit) continue
      const effects = unit.effects.filter((e) => e.when === 'end')
      if (!effects.length) continue
      for (const effect of effects) {
        if (unit.hp <= 0) break
        const msg = applyEffect(effect, side, unit)
        if (msg) addLog(`${unit.name}: ${msg}`)
      }
      hooks.render()
      await sleep(140)
    }
  }
}

function createUnit(side, def, inst, row, col) {
  const b = state.battle
  const isPlayer = side === 'player'
  const upgraded = !!inst?.upgraded
  let atk = def.atk + (upgraded ? 1 : 0)
  let hp = def.hp + (upgraded ? 1 : 0)
  if (isPlayer && def.row === 'front') atk += b.mods.frontAtk
  if (!isPlayer) {
    atk = Math.ceil(atk * b.enemy.scale)
    hp = Math.ceil(hp * b.enemy.scale)
  }
  const unit = {
    uid: uid(),
    cardId: def.id,
    name: def.name,
    row,
    col,
    atk,
    hp,
    maxHp: hp,
    shield: 0,
    keywords: [...(def.keywords || [])],
    effects: def.effects || [],
    art: def.art,
    upgraded,
    side,
  }
  b[side].units[row][col] = unit
  return unit
}

function buildEnemyDeck(node) {
  const defs = factionCards(node.factionId)
  const weights = (card) => {
    let w = RARITY[card.rarity].weight
    if (node.type === 'elite') {
      if (card.rarity === 'uncommon') w *= 1.5
      if (card.rarity === 'rare') w *= 2
      if (card.rarity === 'epic') w *= 1.6
    } else if (node.type === 'boss') {
      if (card.rarity === 'common') w *= 0.55
      if (card.rarity === 'uncommon') w *= 1.1
      if (card.rarity === 'rare') w *= 2.2
      if (card.rarity === 'epic') w *= 3
    }
    return w
  }
  const counts = new Map()
  const ids = []
  const pool = defs.filter(Boolean)
  const target = node.type === 'boss' ? 18 : 16
  while (ids.length < target && pool.length) {
    let cards = pool.filter((c) => (counts.get(c.id) || 0) < 2)
    if (!cards.length) cards = pool
    const card = pickWeighted(cards, weights)
    ids.push(card.id)
    counts.set(card.id, (counts.get(card.id) || 0) + 1)
  }
  return ids.map((id) => makeCardInstance(id))
}

function pickWeighted(items, weightOf) {
  const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0)
  if (total <= 0) return items[0]
  let roll = Math.random() * total
  for (const item of items) {
    roll -= Math.max(0, weightOf(item))
    if (roll <= 0) return item
  }
  return items[items.length - 1]
}

function drawCards(side, count) {
  const b = state.battle
  const s = b?.[side]
  if (!s) return 0
  let drawn = 0
  for (let i = 0; i < count; i++) {
    if (!s.deck.length) {
      if (s.discard.length) {
        s.deck = shuffle(s.discard)
        s.discard = []
      } else break
    }
    if (s.hand.length >= MAX_HAND) break
    const card = s.deck.shift()
    if (!card) break
    s.hand.push(card)
    drawn++
  }
  return drawn
}

function discardHand(side) {
  const s = state.battle?.[side]
  if (!s) return
  s.discard.push(...s.hand)
  s.hand = []
}

/* ═══════════════════════════════════════════════════════════
   AVVIO BATTAGLIA
   ═══════════════════════════════════════════════════════════ */
export function startBattle(node) {
  const run = state.run
  if (!run) return null
  const mods = {
    frontAtk: run.banners.includes('banner_war') ? 1 : 0,
    firstEnergy: run.banners.includes('banner_drum') ? 1 : 0,
    firstDraw: run.banners.includes('banner_map') ? 1 : 0,
  }
  const b = {
    node,
    playerFactionId: run.factionId,
    enemyFactionId: node.factionId,
    player: {
      morale: run.morale,
      maxMorale: run.maxMorale,
      energy: 3,
      maxEnergy: 3,
      hand: [],
      deck: shuffle(run.deck.map((inst) => ({ ...inst }))),
      discard: [],
      units: emptyUnits(),
    },
    enemy: {
      morale: node.morale,
      maxMorale: node.morale,
      energy: node.energy,
      maxEnergy: node.energy,
      hand: [],
      deck: shuffle(buildEnemyDeck(node)),
      discard: [],
      units: emptyUnits(),
      name: node.title,
      scale: node.scale,
    },
    turn: 1,
    phase: 'player',
    busy: false,
    ended: false,
    log: [],
    lastMessage: '',
    fx: {},
    mods,
  }
  state.battle = b
  state.selectedCard = null

  b.player.energy = 3 + mods.firstEnergy
  b.enemy.energy = b.enemy.maxEnergy
  drawCards('player', 5 + mods.firstDraw)
  drawCards('enemy', 4)

  addLog(`La battaglia ha inizio. Il Morale nemico è ${b.enemy.morale}; il tuo è ${b.player.morale}.`)
  hooks.render()
  return b
}

/* ═══════════════════════════════════════════════════════════
   AZIONI DEL GIOCATORE
   ═══════════════════════════════════════════════════════════ */
export function playPlayerCard(index, row, col) {
  const b = state.battle
  if (!b || b.busy || b.phase !== 'player' || b.ended) return { ok: false, message: 'Non puoi giocare in questo momento.' }
  const inst = b.player.hand[index]
  if (!inst) return { ok: false, message: 'Carta non disponibile.' }
  const def = getCard(inst.id)
  if (!def) return { ok: false, message: 'Carta sconosciuta.' }
  if (def.row !== row) return { ok: false, message: `Questa carta va schierata in ${ROW_SHORT[def.row]}.` }
  if (b.player.units[row][col]) return { ok: false, message: 'Questo slot è già occupato.' }
  if (def.cost > b.player.energy) return { ok: false, message: 'Energia insufficiente.' }

  b.player.hand.splice(index, 1)
  b.player.energy -= def.cost
  const unit = createUnit('player', def, inst, row, col)
  addLog(`Schieri ${def.name} in ${ROW_SHORT[row]} (colonna ${col + 1}).`)
  triggerDeploy('player', unit)
  state.run.stats.cardsPlayed += 1
  state.selectedCard = null
  playSound(def.row === 'front' ? 'play' : 'shield')
  hooks.render()
  return { ok: true, unit }
}

/* ═══════════════════════════════════════════════════════════
   RISOLUZIONE DEL TURNO
   ═══════════════════════════════════════════════════════════ */
async function frontAttack(side) {
  const b = state.battle
  const foe = side === 'player' ? 'enemy' : 'player'
  for (let col = 0; col < 3; col++) {
    const attacker = unitAt(side, 'front', col)
    if (!attacker || attacker.hp <= 0) continue
    const target = unitAt(foe, 'front', col)
    if (target) {
      const res = dealDamage(target, attacker.atk)
      addFx(target, `-${attacker.atk}`, 'damage')
      let message = `${attacker.name} colpisce ${target.name} per ${attacker.atk} danni`
      if (res.absorbed > 0) message += ` (${res.absorbed} assorbiti dallo Scudo)`
      if (res.killed) {
        removeUnit(foe, 'front', col)
        message += ' e la abbatte'
        if (attacker.keywords.includes('perfora') && res.overkill > 0) {
          b[foe].morale = Math.max(0, b[foe].morale - res.overkill)
          message += `; ${res.overkill} danni perforano fino al Morale`
        }
      }
      addLog(`${message}.`)
      playSound('hit')
    } else {
      b[foe].morale = Math.max(0, b[foe].morale - attacker.atk)
      addLog(`${attacker.name} colpisce il Morale nemico per ${attacker.atk}.`)
      playSound('hit')
    }
    hooks.render()
    await sleep(230)
    if (b[foe].morale <= 0) return
  }
}

async function resolveSide(side) {
  const b = state.battle
  if (!b) return null
  await triggerEnd(side)
  if (!b) return null
  await frontAttack(side)
  if (!b) return null
  if (side === 'player' && b.enemy.morale <= 0) return 'win'
  if (side === 'enemy' && b.player.morale <= 0) return 'lose'
  return null
}

function chooseEnemyPlay() {
  const b = state.battle
  const e = b.enemy
  let best = null
  for (let index = 0; index < e.hand.length; index++) {
    const inst = e.hand[index]
    const def = getCard(inst.id)
    if (!def || def.cost > e.energy) continue
    const slots = [0, 1, 2].filter((col) => !e.units[def.row][col])
    if (!slots.length) continue
    for (const col of slots) {
      let score = def.cost * 12 + (def.atk + def.hp) * 0.5
      if (def.row === 'front') {
        score += 18
        if (b.player.units.front[col]) score += 22
        else score -= 2
      } else if (def.row === 'support') {
        score += b.enemy.units.front.some(Boolean) ? 8 : 1
      } else {
        score += 5
      }
      score += RARITY[def.rarity].weight * 0.08
      if (!best || score > best.score) best = { index, def, row: def.row, col, score }
    }
  }
  return best
}

async function enemyTurn() {
  const b = state.battle
  if (!b) return null
  b.phase = 'enemy'
  b.busy = true
  addLog('Il nemico prepara il contrattacco.')
  hooks.render()
  await sleep(380)

  b.enemy.energy = b.enemy.maxEnergy
  drawCards('enemy', 3)
  hooks.render()
  await sleep(220)

  let plays = 0
  while (plays < 5) {
    const choice = chooseEnemyPlay()
    if (!choice) break
    const inst = b.enemy.hand.splice(choice.index, 1)[0]
    b.enemy.energy -= choice.def.cost
    const unit = createUnit('enemy', choice.def, inst, choice.row, choice.col)
    addLog(`Il nemico schiera ${choice.def.name} in ${ROW_SHORT[choice.row]}.`)
    triggerDeploy('enemy', unit)
    hookPlayEnemy()
    hooks.render()
    await sleep(300)
    plays++
  }

  const result = await resolveSide('enemy')
  discardHand('enemy')
  return result
}

function hookPlayEnemy() {
  playSound('play')
}

async function conclude(result) {
  const b = state.battle
  if (!b || b.ended) return
  b.ended = true
  b.busy = true
  b.phase = 'ended'
  state.selectedCard = null
  addLog(result === 'win' ? 'Il nemico è in rotta. Vittoria!' : 'Le tue forze sono state travolte. La spedizione finisce qui.')
  playSound(result === 'win' ? 'win' : 'lose')
  hooks.render()
  await sleep(1000)
  if (state.battle !== b) return
  if (result === 'win') hooks.onWin(b.node)
  else hooks.onLose(b.node)
}

export async function endTurn() {
  const b = state.battle
  if (!b || b.busy || b.ended || b.phase !== 'player') return
  b.busy = true
  b.phase = 'resolving'
  state.selectedCard = null
  discardHand('player')
  addLog('Termini il turno. Gli effetti di fine turno si attivano, poi la prima linea attacca.')
  hooks.render()
  await sleep(320)

  const playerResult = await resolveSide('player')
  if (playerResult) {
    await conclude(playerResult)
    return
  }

  const enemyResult = await enemyTurn()
  if (enemyResult) {
    await conclude(enemyResult)
    return
  }

  b.turn += 1
  b.phase = 'player'
  b.busy = false
  b.player.energy = b.player.maxEnergy
  drawCards('player', 5)
  addLog(`Turno ${b.turn}. Pesca 5 carte e schiera le tue forze.`)
  hooks.render()
}

export function currentSelectedDef() {
  const b = state.battle
  if (!b || state.selectedCard == null) return null
  const inst = b.player.hand[state.selectedCard]
  return inst ? getCard(inst.id) : null
}

export function battleLogEntries() {
  return state.battle?.log || []
}
