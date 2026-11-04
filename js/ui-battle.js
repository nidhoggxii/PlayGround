import { FACTION_BY_ID, NODE_INFO, ROWS, getCard } from './data.js'
import { esc, state, ROW_SHORT } from './core.js'
import { cardFaceHTML } from './render-helpers.js'

function unitHTML(unit, side) {
  const b = state.battle
  const faction = FACTION_BY_ID[side === 'player' ? b.playerFactionId : b.enemyFactionId]
  const def = getCard(unit.cardId)
  const fx = b.fx[unit.uid]
  const tags = []
  if (unit.keywords.includes('perfora')) tags.push('<span class="u-tag perfora">Perfora</span>')
  if (unit.upgraded) tags.push('<span class="u-tag">★</span>')
  return `
    <div class="unit ${side === 'enemy' ? 'enemy-unit' : ''} ${unit.upgraded ? 'buffed' : ''}"
      style="--faction:${faction.accent};--faction-deep:${faction.deep};"
      title="${esc(def?.text || '')}">
      <div class="unit-art" aria-hidden="true">${unit.art}</div>
      <div class="unit-main">
        <div class="unit-name">${esc(unit.name)}</div>
        ${tags.length ? `<div class="unit-tags">${tags.join('')}</div>` : ''}
      </div>
      <div class="unit-stats">
        <span class="u-stat atk${unit.atk === 0 ? ' zero' : ''}" title="Attacco">⚔${unit.atk}</span>
        <span class="u-stat hp" title="Punti vita">♥${unit.hp}</span>
        ${unit.shield > 0 ? `<span class="u-stat shield" title="Scudo">◈${unit.shield}</span>` : ''}
      </div>
      ${fx ? `<span class="fx ${fx.cls}">${esc(fx.text)}</span>` : ''}
    </div>`
}

function slotHTML(side, row, col) {
  const b = state.battle
  const unit = b[side].units[row][col]
  const selDef = state.selectedCard != null ? getCard(b.player.hand[state.selectedCard]?.id) : null
  const isPlayer = side === 'player'
  let cls = 'slot'
  let valid = false
  if (isPlayer && selDef && !unit && b.phase === 'player' && !b.busy && b.player.energy >= selDef.cost) {
    valid = selDef.row === row
  }
  if (valid) cls += ' valid'
  else if (isPlayer && selDef && !unit) cls += ' invalid'

  return `<button type="button" class="${cls}" data-action="slot" data-side="${side}" data-row="${row}" data-col="${col}"
    aria-label="${ROWS[row].label}, colonna ${col + 1}${unit ? `: ${esc(unit.name)}` : ': vuoto'}">
    ${unit ? unitHTML(unit, side) : `<span class="empty-mark">${valid ? '＋' : '·'}</span>`}
  </button>`
}

function rowHTML(side, row) {
  return `<div class="battle-row row-${row}">
    <div class="row-label">
      <span class="rl-icon" aria-hidden="true">${ROWS[row].icon}</span>
      <span>${ROWS[row].short}</span>
    </div>
    ${[0, 1, 2].map((col) => slotHTML(side, row, col)).join('')}
  </div>`
}

function enemyBannerHTML() {
  const b = state.battle
  const faction = FACTION_BY_ID[b.enemyFactionId]
  const pct = Math.max(0, Math.min(100, (b.enemy.morale / b.enemy.maxMorale) * 100))
  const type = NODE_INFO[b.node.type]
  const difficulty = b.node.type === 'boss' ? 'Boss finale' : b.node.type === 'elite' ? 'Elite' : 'Avanguardia'
  return `
    <div class="enemy-banner">
      <div class="eb-emblem" aria-hidden="true">${faction.emblem}</div>
      <div class="eb-main">
        <div class="eb-title-row">
          <strong>${esc(b.enemy.name)}</strong>
          <span>${difficulty} · ${esc(faction.name)}</span>
        </div>
        <div class="morale-bar" role="progressbar" aria-label="Morale nemico" aria-valuemin="0" aria-valuemax="${b.enemy.maxMorale}" aria-valuenow="${b.enemy.morale}">
          <i style="width:${pct}%"></i>
        </div>
      </div>
      <div class="eb-badges">
        <span class="mini-badge">Morale <strong>${b.enemy.morale}/${b.enemy.maxMorale}</strong></span>
        <span class="mini-badge">Energia <strong>${b.enemy.energy}</strong></span>
        <span class="mini-badge">Mano <strong>${b.enemy.hand.length}</strong></span>
      </div>
    </div>`
}

function handCardHTML(inst, index) {
  const b = state.battle
  const def = getCard(inst.id)
  if (!def) return ''
  const selected = state.selectedCard === index
  const affordable = def.cost <= b.player.energy
  const playable = b.phase === 'player' && !b.busy && !b.ended
  const cls = `${selected ? 'selected' : ''} ${!affordable ? 'unaffordable' : ''} ${!playable ? 'unplayable' : ''}`
  return cardFaceHTML(def, {
    upgraded: inst.upgraded,
    className: cls,
    tag: 'button',
    attrs: `data-action="select-card" data-index="${index}" aria-pressed="${selected}" aria-label="${esc(def.name)}, costo ${def.cost}, ${ROW_SHORT[def.row]}"`,
  })
}

export function renderBattleScreen() {
  const b = state.battle
  if (!b) return ''
  const faction = FACTION_BY_ID[b.playerFactionId]
  const enemyFaction = FACTION_BY_ID[b.enemyFactionId]
  const typeInfo = NODE_INFO[b.node.type]
  const pMoralePct = Math.max(0, Math.min(100, (b.player.morale / b.player.maxMorale) * 100))
  const selDef = state.selectedCard != null ? getCard(b.player.hand[state.selectedCard]?.id) : null
  const logLine = selDef
    ? `<strong>${esc(selDef.name)}</strong> · ${esc(selDef.text)} <span class="faint">— tocca uno slot dorato in ${ROW_SHORT[selDef.row]}.</span>`
    : esc(b.lastMessage || 'Scegli una carta dalla mano o termina il turno.')

  return `
    <div class="battle-screen" style="--enemy-accent:${enemyFaction.accent};--enemy-deep:${enemyFaction.deep};--accent:${faction.accent};">
      <header class="battle-top">
        <button type="button" class="icon-btn" data-action="battle-menu" aria-label="Menu della battaglia">☰</button>
        <div class="battle-title">
          <div class="bt-eyebrow">${typeInfo.icon} ${typeInfo.label} · Tappa ${b.node.floor + 1} · ${esc(faction.name)}</div>
          <div class="bt-name">${esc(b.enemy.name)}</div>
        </div>
        <div class="battle-top-right">
          <div class="morale-mini player-morale">
            <div class="label"><span>Morale</span><strong>${b.player.morale}/${b.player.maxMorale}</strong></div>
            <div class="bar"><i style="width:${pMoralePct}%"></i></div>
          </div>
          <button type="button" class="icon-btn" data-action="battle-log" aria-label="Registro della battaglia">📜</button>
        </div>
      </header>

      ${enemyBannerHTML()}

      <div class="battle-main">
        <div class="battlefield">
          <div class="battle-side enemy">
            ${rowHTML('enemy', 'supply')}
            ${rowHTML('enemy', 'support')}
            ${rowHTML('enemy', 'front')}
          </div>
          <div class="battle-divider">
            <span class="divider-gem">✦</span>
            ${b.busy ? 'risoluzione' : b.phase === 'player' ? 'il tuo turno' : 'turno nemico'}
            <span class="divider-gem">✦</span>
          </div>
          <div class="battle-side player">
            ${rowHTML('player', 'front')}
            ${rowHTML('player', 'support')}
            ${rowHTML('player', 'supply')}
          </div>
        </div>
        <div class="battle-logline">${logLine}</div>
      </div>

      <footer class="battle-footer">
        <div class="hand-bar">
          <div class="energy-orb" title="Comando disponibile">
            <span class="e-val">${b.player.energy}/${b.player.maxEnergy}</span>
            <span class="e-label">Comando</span>
          </div>
          <div class="hand-scroll">
            ${b.player.hand.length ? b.player.hand.map((inst, i) => handCardHTML(inst, i)).join('') : '<div class="hand-empty">Mano vuota — termina il turno.</div>'}
          </div>
          <div class="end-turn-wrap">
            <button type="button" class="end-turn-btn" data-action="end-turn" ${b.busy || b.phase !== 'player' ? 'disabled' : ''}>
              TERMINA<br>TURNO
              <small>${b.busy ? 'risoluzione…' : 'assalto'}</small>
            </button>
            <div class="turn-indicator">Turno <strong>${b.turn}</strong> · Pesca ${b.player.deck.length} · Scarti ${b.player.discard.length}</div>
          </div>
        </div>
      </footer>
    </div>`
}
