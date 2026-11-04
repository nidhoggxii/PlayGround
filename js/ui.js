import {
  BANNERS,
  BANNER_BY_ID,
  CARD_DEFS,
  FACTIONS,
  FACTION_BY_ID,
  NODE_INFO,
  RARITY,
  ROWS,
  factionCards,
  getCard,
} from './data.js'
import {
  DECK_LIMIT,
  EVENTS,
  ROW_SHORT,
  esc,
  eventById,
  loadSavedRun,
  groupDeck,
  totalCards,
  totalUnlocked,
  state,
} from './core.js'
import { cardFaceHTML } from './render-helpers.js'
import { renderBattleScreen } from './ui-battle.js'
import { renderModal } from './ui-modal.js'

export { renderModal }

export function showToast(message, type = '') {
  const root = document.getElementById('toast-root')
  if (!root) return
  const el = document.createElement('div')
  el.className = `toast ${type}`.trim()
  el.textContent = message
  root.appendChild(el)
  while (root.children.length > 3) root.removeChild(root.firstElementChild)
  setTimeout(() => {
    el.classList.add('fade')
    setTimeout(() => el.remove(), 260)
  }, 2500)
}

export function render() {
  const app = document.getElementById('app')
  if (!app) return
  const previousScreen = document.body.dataset.screen
  const prevHand = document.querySelector('.hand-scroll')
  const prevMain = document.querySelector('.battle-main')
  const handScroll = prevHand ? prevHand.scrollLeft : 0
  const mainScroll = prevMain ? prevMain.scrollTop : 0

  app.innerHTML = state.screen === 'battle' ? renderBattleScreen() : renderScreen()
  document.body.dataset.screen = state.screen

  if (state.screen === 'battle') {
    const hand = document.querySelector('.hand-scroll')
    if (hand) hand.scrollLeft = handScroll
    const main = document.querySelector('.battle-main')
    if (main) main.scrollTop = mainScroll
  }

  // Su mobile la mappa è più alta dello schermo: quando si torna sulla mappa
  // porta in vista la tappa corrente, senza disturbare chi sta già guardando.
  if (state.screen === 'map' && previousScreen !== 'map') {
    const current = document.querySelector('.floor-row.current')
    if (current) {
      const rect = current.getBoundingClientRect()
      if (rect.top < 8 || rect.bottom > window.innerHeight - 8) {
        current.scrollIntoView({ block: 'nearest' })
      }
    }
  }
  renderModal()
}

function renderScreen() {
  switch (state.screen) {
    case 'title': return titleScreen()
    case 'factions': return factionsScreen()
    case 'archive': return archiveScreen()
    case 'map': return mapScreen()
    case 'event': return eventScreen()
    case 'shop': return shopScreen()
    case 'camp': return campScreen()
    case 'reward': return rewardScreen()
    case 'runEnd': return runEndScreen()
    default: return titleScreen()
  }
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTI CONDIVISI
   ═══════════════════════════════════════════════════════════ */
function soundButton() {
  return `<button type="button" class="icon-btn" data-action="toggle-sound" aria-label="${state.meta.sound ? 'Disattiva audio' : 'Attiva audio'}">${state.meta.sound ? '🔊' : '🔇'}</button>`
}

function brandHTML(sub = '') {
  return `<div class="brand">
    <div class="brand-mark" aria-hidden="true">⚔️</div>
    <div>
      <div class="brand-name">Echi di Guerra</div>
      ${sub ? `<div class="brand-sub">${esc(sub)}</div>` : ''}
    </div>
  </div>`
}

function runTopbar() {
  const run = state.run
  if (!run) return ''
  const f = FACTION_BY_ID[run.factionId]
  return `<div class="topbar">
    ${brandHTML(`${f.name} · Tappa ${Math.min(run.floor + 1, run.map.length)}/${run.map.length}`)}
    <span class="chip morale" title="Morale della spedizione"><span class="chip-icon">❤️</span><strong>${run.morale}</strong>/${run.maxMorale}</span>
    <span class="chip gold" title="Oro"><span class="chip-icon">🪙</span><strong>${run.gold}</strong></span>
    <button type="button" class="icon-btn" data-action="open-deck" aria-label="Guarda il mazzo">🃏</button>
    ${soundButton()}
    <button type="button" class="icon-btn" data-action="open-help" aria-label="Come si gioca">?</button>
    <button type="button" class="icon-btn" data-action="open-run-menu" aria-label="Menu della spedizione">☰</button>
  </div>`
}

function mapNodeTags(node) {
  const info = NODE_INFO[node.type]
  const tags = [`<span class="node-tag">${info.label}</span>`]
  if (node.factionId) {
    tags.push(`<span class="node-tag">${esc(FACTION_BY_ID[node.factionId].name)}</span>`)
  }
  if (node.type === 'battle' || node.type === 'elite') {
    tags.push(`<span class="node-tag">Morale ${node.morale}</span>`)
    tags.push(`<span class="node-tag">+${node.gold} oro</span>`)
  } else if (node.type === 'boss') {
    tags.push('<span class="node-tag">Boss finale</span>')
    tags.push(`<span class="node-tag">+${node.gold} oro</span>`)
  } else if (node.type === 'shop') {
    tags.push('<span class="node-tag">3 carte</span>')
  } else if (node.type === 'camp') {
    tags.push('<span class="node-tag">Cura / affina</span>')
  } else if (node.type === 'event') {
    tags.push('<span class="node-tag">Scelta</span>')
  }
  return tags.join('')
}

function mapNodeBody(node) {
  const info = NODE_INFO[node.type]
  return `
    <div class="node-icon" aria-hidden="true">${info.icon}</div>
    <div class="node-body">
      <div class="node-title">${esc(node.title)}</div>
      <div class="node-desc">${esc(node.desc)}</div>
      <div class="node-meta">${mapNodeTags(node)}</div>
    </div>`
}

/* ═══════════════════════════════════════════════════════════
   TITLE
   ═══════════════════════════════════════════════════════════ */
function titleScreen() {
  const saved = loadSavedRun()
  const savedFaction = saved ? FACTION_BY_ID[saved.factionId] : null
  return `<div class="screen title-screen">
    <button type="button" class="icon-btn" style="position:absolute;top:max(16px,env(safe-area-inset-top));right:16px;z-index:2" data-action="toggle-sound" aria-label="${state.meta.sound ? 'Disattiva audio' : 'Attiva audio'}">${state.meta.sound ? '🔊' : '🔇'}</button>
    <div class="title-wrap">
      <div class="title-emblem" aria-hidden="true">⚔️</div>
      <div class="title-kicker">Roguelike di carte</div>
      <h1 class="game-title"><span>ECHI</span><span class="title-second">DI GUERRA</span></h1>
      <p class="title-tagline">Scegli il tuo esercito. Schiera prima linea, supporto e rifornimento. Attraversa il percorso, sconfiggi l’ultima armata e riscrivi la storia, una run alla volta.</p>
      <div class="title-menu">
        <button type="button" class="btn" data-action="show-factions">⚔️ Nuova spedizione</button>
        ${saved ? `<button type="button" class="btn ghost" data-action="continue-run">↻ Continua · ${esc(savedFaction.name)} <span class="faint">(Tappa ${Math.min(saved.floor + 1, saved.map.length)})</span></button>` : ''}
        <button type="button" class="btn ghost" data-action="show-archive">📖 Archivio delle carte</button>
        <button type="button" class="btn ghost" data-action="open-help">❔ Come si gioca</button>
      </div>
      <div class="title-stats">
        <span>Spedizioni <strong>${state.meta.runs}</strong></span>
        <span>Vittorie <strong>${state.meta.wins}</strong></span>
        <span>Carte sbloccate <strong>${totalUnlocked()}/${totalCards()}</strong></span>
        <span>Echi <strong>${state.meta.echoes}</strong></span>
      </div>
    </div>
    <div class="title-footer">Un gioco completo nel tuo browser · progressi salvati in locale</div>
  </div>`
}

/* ═══════════════════════════════════════════════════════════
   SCELTA FAZIONE
   ═══════════════════════════════════════════════════════════ */
function factionsScreen() {
  const saved = loadSavedRun()
  return `<div class="screen">
    <div class="screen-inner">
      <div class="topbar">
        <button type="button" class="icon-btn" data-action="show-title" aria-label="Torna al titolo">←</button>
        ${brandHTML('Scegli il tuo esercito')}
        ${soundButton()}
      </div>
      <div class="eyebrow">La spedizione comincia qui</div>
      <h1 class="section-title">Scegli il mazzo tematico</h1>
      <p class="section-lead" style="margin-top:8px">Ogni fazione ha carte esclusive, uno stile di battaglia diverso e la propria progressione. Le carte sbloccate entrano automaticamente nel mazzo iniziale delle prossime spedizioni con quella fazione.${saved ? ' <span class="gold">Hai una spedizione salvata: iniziarne una nuova la sostituirà.</span>' : ''}</p>
      <div class="faction-grid">
        ${FACTIONS.map((f) => {
          const unlocked = state.meta.unlocked[f.id].length
          const total = factionCards(f.id).length
          const pct = Math.round((unlocked / total) * 100)
          return `<article class="faction-card" style="--accent:${f.accent};--deep:${f.deep}">
            <div class="faction-head">
              <div class="faction-emblem" aria-hidden="true">${f.emblem}</div>
              <div>
                <div class="faction-name">${esc(f.name)}</div>
                <div class="faction-epithet">${esc(f.epithet)}</div>
              </div>
            </div>
            <div class="faction-desc">${esc(f.desc)}</div>
            <div class="faction-style">${esc(f.style)}</div>
            <div class="faction-progress">
              <div class="progress-bar"><i style="width:${pct}%"></i></div>
              <span>${unlocked}/${total} carte</span>
            </div>
            <div class="faction-actions">
              <button type="button" class="btn" data-action="start-run" data-faction="${f.id}">Scegli ${esc(f.name)}</button>
            </div>
          </article>`
        }).join('')}
      </div>
      <p class="muted" style="font-size:11px;margin-top:16px">Mazzo iniziale: 12 carte tematiche + una copia di ogni carta sbloccata. Le ricompense e i mercanti aggiungono nuove carte durante la spedizione.</p>
    </div>
  </div>`
}

/* ═══════════════════════════════════════════════════════════
   ARCHIVIO
   ═══════════════════════════════════════════════════════════ */
function archiveScreen() {
  const active = FACTION_BY_ID[state.archiveFaction] ? state.archiveFaction : 'greece'
  const faction = FACTION_BY_ID[active]
  const defs = factionCards(active)
  const unlocked = state.meta.unlocked[active]
  return `<div class="screen">
    <div class="screen-inner">
      <div class="topbar">
        <button type="button" class="icon-btn" data-action="show-title" aria-label="Torna al titolo">←</button>
        ${brandHTML('Archivio delle carte')}
        <span class="chip echo" title="Echi disponibili"><span class="chip-icon">✦</span><strong>${state.meta.echoes}</strong> Echi</span>
        ${soundButton()}
      </div>
      <div class="eyebrow">Collezione permanente</div>
      <h1 class="section-title">Archivio</h1>
      <p class="section-lead" style="margin-top:8px">Le carte sbloccate restano per sempre. Con gli Echi puoi aprire una carta specifica; alla fine di ogni spedizione ne sblocchi anche una o due a caso.</p>
      <div class="archive-tabs">
        ${FACTIONS.map((f) => `<button type="button" class="tab ${f.id === active ? 'active' : ''}" data-action="archive-tab" data-faction="${f.id}">${f.emblem} ${esc(f.name)} <span class="faint">${state.meta.unlocked[f.id].length}/${factionCards(f.id).length}</span></button>`).join('')}
      </div>
      <div class="archive-meta">
        <div class="archive-progress">${esc(faction.name)} · <strong class="gold">${unlocked.length}/${defs.length}</strong> carte sbloccate</div>
        <div class="muted" style="font-size:11px">Costo di sblocco: ${RARITY.common.cost}–${RARITY.epic.cost} Echi</div>
      </div>
      <div class="archive-grid">
        ${defs.map((def) => {
          const owned = unlocked.includes(def.id)
          const cost = RARITY[def.rarity].cost
          if (owned) {
            return `<div class="archive-card">
              <span class="owned-tag">Sbloccata</span>
              ${cardFaceHTML(def, { tag: 'button', attrs: `data-action="view-card" data-card="${def.id}" aria-label="Dettagli di ${esc(def.name)}"` })}
            </div>`
          }
          return `<div class="archive-card">
            <div class="locked-card">
              <span class="lock-em" aria-hidden="true">🔒</span>
              <span class="lock-name">${esc(def.name)}</span>
              <span class="lock-rarity" style="color:${RARITY[def.rarity].color}">${RARITY[def.rarity].label}</span>
            </div>
            <button type="button" class="btn ghost small unlock-btn" data-action="unlock-card" data-card="${def.id}" ${state.meta.echoes < cost ? 'disabled' : ''}>Sblocca · ${cost} ✦</button>
          </div>`
        }).join('')}
      </div>
      <p class="muted" style="font-size:11px;margin-top:16px">Suggerimento: le carte epiche costano ${RARITY.epic.cost} Echi, ma sono anche le più rare da trovare alla fine di una run.</p>
    </div>
  </div>`
}

/* ═══════════════════════════════════════════════════════════
   MAPPA
   ═══════════════════════════════════════════════════════════ */
function mapScreen() {
  const run = state.run
  if (!run) return titleScreen()
  const f = FACTION_BY_ID[run.factionId]
  const rows = run.map.map((nodes, floor) => {
    const status = floor < run.floor ? 'cleared' : floor === run.floor ? 'current' : 'locked'
    const path = run.path[floor]
    let content = ''
    if (status === 'current') {
      content = nodes.map((node) => `<button type="button" class="map-node ${node.type === 'boss' ? 'boss' : ''}" style="--node:${NODE_INFO[node.type].color}" data-action="enter-node" data-node="${node.id}">${mapNodeBody(node)}</button>`).join('')
    } else if (status === 'cleared' && path) {
      content = `<div class="map-node cleared ${path.type === 'boss' ? 'boss' : ''}" style="--node:${NODE_INFO[path.type].color}">
        <div class="node-icon" aria-hidden="true">${NODE_INFO[path.type].icon}</div>
        <div class="node-body"><div class="node-title">${esc(path.title)}</div><div class="node-desc">Tappa completata.</div><div class="node-meta"><span class="node-tag">✓ Completata</span></div></div>
      </div>`
    } else {
      content = nodes.map(() => `<div class="map-node unknown"><span class="node-icon" aria-hidden="true">?</span><span>Percorso non ancora esplorato</span></div>`).join('')
    }
    return `<div class="floor-row ${status}">
      <div class="floor-num" title="Tappa ${floor + 1}">${['I','II','III','IV','V','VI','VII','VIII'][floor] || floor + 1}</div>
      <div class="floor-nodes ${nodes.length === 1 ? 'single' : ''}">${content}</div>
    </div>`
  }).reverse().join('')

  return `<div class="screen">
    <div class="screen-inner">
      ${runTopbar()}
      <div class="map-head">
        <div>
          <div class="eyebrow">Tappa ${Math.min(run.floor + 1, run.map.length)} di ${run.map.length}</div>
          <h1>La Spedizione</h1>
          <p>${run.floor >= run.map.length - 1 ? 'L’ultima armata ti attende. Non c’è via di ritorno.' : 'Scegli il prossimo incontro. Ogni tappa consuma risorse e avvicina al comando nemico.'}</p>
        </div>
        <div class="map-faction"><span class="em" aria-hidden="true">${f.emblem}</span><div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">Esercito</div><strong>${esc(f.name)}</strong></div></div>
      </div>
      <div class="map-wrap">${rows}</div>
      <div class="map-footer">
        <div class="map-hint">Il tuo mazzo: ${run.deck.length} carte${run.banners.length ? ` · ${run.banners.length} stendardi` : ''}. Le carte sbloccate entrano nel prossimo mazzo iniziale.</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          <button type="button" class="btn ghost small" data-action="open-deck">🃏 Mazzo</button>
          <button type="button" class="btn ghost small" data-action="open-help">❔ Guida</button>
        </div>
      </div>
    </div>
  </div>`
}

/* ═══════════════════════════════════════════════════════════
   EVENTO
   ═══════════════════════════════════════════════════════════ */
function eventScreen() {
  const run = state.run
  const node = state.eventNode
  if (!run || !node) return mapScreen()
  const event = eventById(node.eventId)
  return `<div class="screen node-screen">
    <div class="screen-inner">
      ${runTopbar()}
      <div class="node-panel">
        <div class="node-banner">
          <div class="big-icon" aria-hidden="true">${event.icon}</div>
          <div><div class="node-sub">Evento · Tappa ${node.floor + 1}</div><h2>${esc(event.title)}</h2></div>
        </div>
        <p class="node-text">${esc(event.text)}</p>
        ${state.eventResult ? `
          <div class="empty-state" style="border-style:solid;border-color:rgba(217,176,95,.3);color:var(--text);text-align:left">${esc(state.eventResult)}</div>
          <div class="modal-actions"><button type="button" class="btn" data-action="event-continue">Prosegui →</button></div>
        ` : `
          <div class="choice-list">
            ${event.options.map((option, index) => {
              const can = option.can ? option.can(run) : true
              return `<button type="button" class="choice" data-action="event-option" data-index="${index}" ${can ? '' : 'disabled'}>
                <span class="choice-icon" aria-hidden="true">${option.icon}</span>
                <span class="choice-main"><span class="choice-label">${esc(option.label)}</span><span class="choice-desc">${esc(option.desc)}</span></span>
                <span class="choice-cost">›</span>
              </button>`
            }).join('')}
          </div>
        `}
      </div>
    </div>
  </div>`
}

/* ═══════════════════════════════════════════════════════════
   MERCANTE
   ═══════════════════════════════════════════════════════════ */
function shopScreen() {
  const run = state.run
  const node = state.shopNode
  if (!run || !node) return mapScreen()
  const stock = node.stock || []
  const services = node.services || { heal: false, remove: false, upgrade: false }
  return `<div class="screen node-screen">
    <div class="screen-inner">
      ${runTopbar()}
      <div class="node-panel">
        <div class="node-banner">
          <div class="big-icon" aria-hidden="true">🪙</div>
          <div><div class="node-sub">Mercante · Tappa ${node.floor + 1}</div><h2>${esc(node.title)}</h2></div>
        </div>
        <p class="node-text">${esc(node.desc)} Hai <strong class="gold">${run.gold} oro</strong>. Le carte entrano subito nel mazzo; i servizi si possono usare una volta sola.</p>
        <div class="shop-grid">
          ${stock.map((item, index) => {
            const def = getCard(item.cardId)
            if (!def) return ''
            if (item.sold) return `<div class="shop-item sold"><div class="game-card" style="display:grid;place-items:center;color:var(--faint);font-size:11px">Venduta</div><div class="buy-row"><button class="btn ghost small" disabled>Venduta</button></div></div>`
            return `<div class="shop-item">
              ${cardFaceHTML(def, { attrs: 'aria-hidden="true"' })}
              <div class="buy-row"><button type="button" class="btn small" data-action="buy-card" data-index="${index}" ${run.gold < item.price || run.deck.length >= DECK_LIMIT ? 'disabled' : ''}>🪙 ${item.price}</button></div>
            </div>`
          }).join('')}
        </div>
        <div class="shop-services">
          <button type="button" class="shop-service" data-action="shop-heal" ${services.heal || run.gold < 25 || run.morale >= run.maxMorale ? 'disabled' : ''}>
            <strong>${services.heal ? '✓ Cura acquistata' : 'Cura 12 Morale · 25 oro'}</strong>
            <span>${run.morale >= run.maxMorale ? 'Il Morale è già al massimo.' : 'Bende, erbe e un pasto caldo.'}</span>
          </button>
          <button type="button" class="shop-service" data-action="shop-remove" ${services.remove || run.gold < 50 || run.deck.length <= 8 ? 'disabled' : ''}>
            <strong>${services.remove ? '✓ Rimozione acquistata' : 'Rimuovi una carta · 50 oro'}</strong>
            <span>${run.deck.length <= 8 ? 'Il mazzo è già essenziale.' : 'Alleggerisci il mazzo per pescare meglio.'}</span>
          </button>
          <button type="button" class="shop-service" data-action="shop-upgrade" ${services.upgrade || run.gold < 60 || !run.deck.some((c) => !c.upgraded) ? 'disabled' : ''}>
            <strong>${services.upgrade ? '✓ Potenziamento acquistato' : 'Potenzia una carta · 60 oro'}</strong>
            <span>+1 ATK e +1 HP alla carta scelta.</span>
          </button>
        </div>
        <div class="modal-actions" style="justify-content:space-between">
          <span class="faint" style="font-size:11px">Mazzo: ${run.deck.length}/${DECK_LIMIT} carte</span>
          <button type="button" class="btn ghost" data-action="leave-shop">Riprendi il cammino →</button>
        </div>
      </div>
    </div>
  </div>`
}

/* ═══════════════════════════════════════════════════════════
   ACCAMPAMENTO
   ═══════════════════════════════════════════════════════════ */
function campScreen() {
  const run = state.run
  const node = state.campNode
  if (!run || !node) return mapScreen()
  const healAmount = Math.min(run.maxMorale - run.morale, Math.max(8, Math.round(run.maxMorale * 0.3)))
  const canUpgrade = run.deck.some((c) => !c.upgraded)
  const canRemove = run.deck.length > 8
  return `<div class="screen node-screen">
    <div class="screen-inner">
      ${runTopbar()}
      <div class="node-panel">
        <div class="node-banner">
          <div class="big-icon" aria-hidden="true">🏕️</div>
          <div><div class="node-sub">Accampamento · Tappa ${node.floor + 1}</div><h2>${esc(node.title)}</h2></div>
        </div>
        <p class="node-text">Il fuoco crepita. Hai tempo per una sola cosa prima di ripartire. Scegli con cura: la strada non perdona.</p>
        <div class="choice-list">
          <button type="button" class="choice" data-action="camp-rest" ${run.morale >= run.maxMorale ? 'disabled' : ''}>
            <span class="choice-icon" aria-hidden="true">🔥</span>
            <span class="choice-main"><span class="choice-label">Riposa accanto al fuoco</span><span class="choice-desc">${run.morale >= run.maxMorale ? 'Il Morale è già al massimo.' : `Recupera ${healAmount} Morale (30% del massimo, minimo 8).`}</span></span>
            <span class="choice-cost">${run.morale}/${run.maxMorale}</span>
          </button>
          <button type="button" class="choice" data-action="camp-upgrade" ${canUpgrade ? '' : 'disabled'}>
            <span class="choice-icon" aria-hidden="true">⚒️</span>
            <span class="choice-main"><span class="choice-label">Affina una carta</span><span class="choice-desc">Potenzia una carta del mazzo: +1 ATK e +1 HP.</span></span>
            <span class="choice-cost">${canUpgrade ? '›' : 'Nessuna carta'}</span>
          </button>
          <button type="button" class="choice" data-action="camp-remove" ${canRemove ? '' : 'disabled'}>
            <span class="choice-icon" aria-hidden="true">🕯️</span>
            <span class="choice-main"><span class="choice-label">Medita e lascia andare</span><span class="choice-desc">Rimuovi una carta dal mazzo. Un mazzo più snello pesca meglio.</span></span>
            <span class="choice-cost">${canRemove ? '›' : 'Mazzo troppo piccolo'}</span>
          </button>
        </div>
        <div class="modal-actions" style="justify-content:flex-end">
          <button type="button" class="btn ghost" data-action="leave-camp">Prosegui senza riposare →</button>
        </div>
      </div>
    </div>
  </div>`
}

/* ═══════════════════════════════════════════════════════════
   RICOMPENSE
   ═══════════════════════════════════════════════════════════ */
function rewardScreen() {
  const run = state.run
  const reward = state.reward
  if (!run || !reward) return mapScreen()
  const node = reward.node
  return `<div class="screen">
    <div class="screen-inner">
      ${runTopbar()}
      <div class="reward-wrap">
        <div class="eyebrow">${node.type === 'elite' ? 'Guardia sconfitta' : 'Battaglia vinta'}</div>
        <h1 class="section-title">${reward.stage === 'banner' ? 'Scegli uno Stendardo' : 'Bottino di Guerra'}</h1>
        <p class="reward-line">${esc(node.title)} · ${reward.stage === 'banner' ? 'La tua impresa ha attirato l’attenzione degli dèi della guerra.' : 'La strada è libera. Scegli una carta da aggiungere al mazzo, oppure prosegui.'}</p>
        ${reward.stage === 'card' ? `
          <div class="reward-gold">🪙 +${reward.gold} oro ottenuti</div>
          <div class="reward-cards">
            ${reward.cards.map((def) => cardFaceHTML(def, {
              tag: 'button',
              attrs: `data-action="pick-reward" data-card="${def.id}" aria-label="Aggiungi ${esc(def.name)} al mazzo"`,
            })).join('')}
          </div>
          <div class="reward-actions">
            <button type="button" class="btn ghost" data-action="skip-reward">Salta la ricompensa →</button>
          </div>
          <p class="faint" style="font-size:11px;margin-top:12px">Mazzo: ${run.deck.length}/${DECK_LIMIT}${run.deck.length >= DECK_LIMIT ? ' · pieno' : ''}</p>
        ` : `
          <div class="choice-list" style="text-align:left">
            ${reward.bannerOptions.map((banner) => `<button type="button" class="choice" data-action="pick-banner" data-banner="${banner.id}">
              <span class="choice-icon" aria-hidden="true">${banner.icon}</span>
              <span class="choice-main"><span class="choice-label">${esc(banner.name)}</span><span class="choice-desc">${esc(banner.desc)}</span></span>
              <span class="choice-cost">Scegli ›</span>
            </button>`).join('')}
          </div>
          <p class="faint" style="font-size:11px;margin-top:12px">Gli Stendardi valgono per tutta la spedizione.</p>
        `}
      </div>
    </div>
  </div>`
}

/* ═══════════════════════════════════════════════════════════
   FINE RUN
   ═══════════════════════════════════════════════════════════ */
function runEndScreen() {
  const s = state.lastRun
  if (!s) return titleScreen()
  const title = s.victory ? 'Vittoria' : s.reason === 'abbandonata' ? 'Ritirata' : 'La spedizione è caduta'
  const sub = s.victory
    ? 'Il Signore della Guerra è stato sconfitto. Il tuo esercito tornerà a casa con nuove carte e nuove storie.'
    : s.reason === 'abbandonata'
      ? 'Hai scelto di lasciare il campo. Le carte sbloccate restano tue; la strada può attendere.'
      : 'Le insegne sono cadute, ma gli Echi della battaglia restano. Ogni run rende il prossimo mazzo più forte.'
  return `<div class="screen end-screen">
    <div class="end-panel" style="--accent:${s.accent || '#d9b05f'}">
      <div class="end-emblem" aria-hidden="true">${s.victory ? '🏆' : '🕯️'}</div>
      <div class="eyebrow">${esc(s.factionName)} · ${s.victory ? 'Percorso completato' : 'Echi raccolti'}</div>
      <h1>${title}</h1>
      <p class="end-sub">${sub}</p>
      <div class="end-stats">
        <div class="stat-box"><div class="sv">${s.cleared}/${s.totalFloors}</div><div class="sl">Tappe</div></div>
        <div class="stat-box"><div class="sv">${s.stats.battlesWon}</div><div class="sl">Battaglie</div></div>
        <div class="stat-box"><div class="sv">${s.stats.cardsPlayed}</div><div class="sl">Carte giocate</div></div>
        <div class="stat-box"><div class="sv">${s.gold}</div><div class="sl">Oro</div></div>
        <div class="stat-box"><div class="sv">${s.deckSize}</div><div class="sl">Carte nel mazzo</div></div>
      </div>
      <div class="echo-award">✦ +${s.echoes} Echi</div>
      ${s.unlocks.length ? `
        <div>
          <div class="eyebrow" style="margin-bottom:8px">Nuove carte sbloccate</div>
          <div class="unlock-row">${s.unlocks.map((def) => `<div class="unlock-chip"><span class="em">${def.art}</span><span>${esc(def.name)}</span></div>`).join('')}</div>
        </div>
      ` : `<p class="muted" style="font-size:12px;margin:14px 0">Nessuna nuova carta da sbloccare per questa fazione: hai già l’archivio completo. Gli Echi extra ti aspettano.</p>`}
      <div class="modal-actions center">
        <button type="button" class="btn" data-action="run-end-factions">⚔️ Nuova spedizione</button>
        <button type="button" class="btn ghost" data-action="run-end-archive">📖 Archivio</button>
        <button type="button" class="btn ghost" data-action="run-end-title">Titolo</button>
      </div>
    </div>
  </div>`
}
