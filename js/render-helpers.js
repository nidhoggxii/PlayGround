import { FACTION_BY_ID, ROWS } from './data.js'
import { ROW_CARD_LABEL } from './core.js'

export function factionVars(factionId) {
  const f = FACTION_BY_ID[factionId]
  return `--accent:${f.accent};--deep:${f.deep};`
}

export function rowIcon(row) {
  return ROWS[row]?.icon || '✦'
}

export function cardFaceHTML(def, options = {}) {
  const {
    upgraded = false,
    className = '',
    attrs = '',
    tag = 'div',
    showUpgrade = true,
  } = options
  const faction = FACTION_BY_ID[def.faction]
  const content = `
    <span class="card-cost" aria-hidden="true">${def.cost}</span>
    <span class="card-row-badge" title="${ROW_CARD_LABEL[def.row]}">${rowIcon(def.row)}</span>
    <span class="card-art" aria-hidden="true">${def.art}</span>
    <span class="card-name">${def.name}</span>
    <span class="card-type">${ROW_CARD_LABEL[def.row]}</span>
    <span class="card-text">${def.text}</span>
    <span class="card-stats">
      <span class="stat atk${def.atk === 0 ? ' zero' : ''}" title="Attacco">⚔ ${def.atk}</span>
      <span class="stat hp" title="Punti vita">♥ ${def.hp}</span>
    </span>
    ${upgraded && showUpgrade ? '<span class="upgrade-pip" title="Potenziata">★</span>' : ''}
  `
  const classes = `game-card rarity-${def.rarity} ${className}`.trim()
  const style = `--accent:${faction.accent};--deep:${faction.deep};`
  if (tag === 'button') {
    return `<button type="button" class="${classes}" style="${style}" ${attrs}>${content}</button>`
  }
  return `<div class="${classes}" style="${style}" ${attrs}>${content}</div>`
}
