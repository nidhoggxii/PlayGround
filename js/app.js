import {
  BANNER_BY_ID,
  FACTION_BY_ID,
  FACTIONS,
  RARITY,
  getCard,
} from './data.js'
import {
  DECK_LIMIT,
  cardRewardOptions,
  clamp,
  clearSavedRun,
  completeNode,
  createRun,
  endRun,
  eventById,
  findNode,
  hasBanner,
  healRun,
  loadMeta,
  loadSavedRun,
  makeCardInstance,
  playSound,
  pickBannerOptions,
  saveMeta,
  saveRun,
  shuffle,
  state,
  unlockedCards,
} from './core.js'
import { endTurn, playPlayerCard, setBattleHooks, startBattle } from './battle.js'
import { render, renderModal, showToast } from './ui.js'

/* ═══════════════════════════════════════════════════════════
   NAVIGAZIONE E STATO
   ═══════════════════════════════════════════════════════════ */
function beginRun(factionId) {
  const faction = FACTION_BY_ID[factionId]
  if (!faction) return
  clearSavedRun()
  state.run = createRun(factionId)
  state.battle = null
  state.selectedCard = null
  state.reward = null
  state.shopNode = null
  state.eventNode = null
  state.eventResult = null
  state.campNode = null
  state.modal = null
  state.screen = 'map'
  saveRun()
  render()
  playSound('map')
  showToast(`La spedizione di ${faction.name} ha inizio.`, 'good')
}

function exitBattleToTitle() {
  if (state.run) saveRun()
  state.battle = null
  state.selectedCard = null
  state.reward = null
  state.shopNode = null
  state.eventNode = null
  state.eventResult = null
  state.campNode = null
  state.modal = null
  state.run = null
  state.screen = 'title'
  render()
  playSound('click')
}

function goTitle() {
  if (state.run) saveRun()
  state.run = null
  state.battle = null
  state.selectedCard = null
  state.reward = null
  state.shopNode = null
  state.eventNode = null
  state.eventResult = null
  state.campNode = null
  state.modal = null
  state.screen = 'title'
  render()
  playSound('click')
}

function startNode(nodeId) {
  const run = state.run
  if (!run) return
  const node = findNode(nodeId)
  if (!node || node.floor !== run.floor) {
    showToast('Questa tappa non è disponibile.', 'bad')
    return
  }
  state.modal = null
  if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
    state.screen = 'battle'
    state.selectedCard = null
    startBattle(node)
    render()
    playSound('play')
    return
  }
  if (node.type === 'event') {
    state.eventNode = node
    state.eventResult = null
    state.screen = 'event'
    render()
    playSound('click')
    return
  }
  if (node.type === 'shop') {
    ensureShop(node)
    state.shopNode = node
    state.screen = 'shop'
    render()
    playSound('map')
    return
  }
  if (node.type === 'camp') {
    state.campNode = node
    state.screen = 'camp'
    render()
    playSound('map')
  }
}

function completeNodeFlow(node, message, sound = 'map') {
  if (!node) {
    state.screen = 'map'
    render()
    return
  }
  const result = completeNode(node)
  if (result === 'finished') {
    finishRunNow(true, 'vittoria')
    return
  }
  state.screen = 'map'
  state.modal = null
  render()
  playSound(sound)
  if (message) showToast(message, 'good')
}

/* ═══════════════════════════════════════════════════════════
   MERCANTE / ACCAMPAMENTO / EVENTI
   ═══════════════════════════════════════════════════════════ */
function ensureShop(node) {
  const run = state.run
  if (!run) return
  if (!node.stock) {
    const pool = shuffle(unlockedCards(run.factionId))
    node.stock = pool.slice(0, 3).map((def) => ({
      cardId: def.id,
      price: RARITY[def.rarity].cost,
      sold: false,
    }))
  }
  if (!node.services) node.services = { heal: false, remove: false, upgrade: false }
  saveRun()
}

function buyShopCard(index) {
  const run = state.run
  const node = state.shopNode
  if (!run || !node) return
  const item = node.stock?.[index]
  if (!item || item.sold) return
  const def = getCard(item.cardId)
  if (!def) return
  if (run.deck.length >= DECK_LIMIT) return showToast('Il mazzo è pieno.', 'bad')
  if (run.gold < item.price) return showToast('Oro insufficiente.', 'bad')
  run.gold -= item.price
  run.deck.push(makeCardInstance(def.id))
  item.sold = true
  saveRun()
  playSound('gold')
  showToast(`${def.name} entra nel mazzo. −${item.price} oro`, 'good')
  render()
}

function shopHeal() {
  const run = state.run
  const node = state.shopNode
  if (!run || !node) return
  if (node.services.heal) return
  if (run.gold < 25) return showToast('Oro insufficiente.', 'bad')
  if (run.morale >= run.maxMorale) return showToast('Il Morale è già al massimo.', 'bad')
  run.gold -= 25
  const healed = healRun(run, 12)
  node.services.heal = true
  saveRun()
  playSound('heal')
  showToast(`Recuperi ${healed} Morale. −25 oro`, 'good')
  render()
}

function shopRemove() {
  const run = state.run
  const node = state.shopNode
  if (!run || !node) return
  if (node.services.remove) return
  if (run.gold < 50) return showToast('Oro insufficiente.', 'bad')
  if (run.deck.length <= 8) return showToast('Il mazzo è già troppo piccolo.', 'bad')
  openDeckPicker({
    mode: 'remove',
    source: 'shop',
    nodeId: node.id,
    cost: 50,
    service: 'remove',
    title: 'Rimuovi una carta · 50 oro',
    subtitle: 'Scegli la carta da togliere dal mazzo. L’oro verrà speso solo alla conferma.',
  })
}

function shopUpgrade() {
  const run = state.run
  const node = state.shopNode
  if (!run || !node) return
  if (node.services.upgrade) return
  if (run.gold < 60) return showToast('Oro insufficiente.', 'bad')
  if (!run.deck.some((c) => !c.upgraded)) return showToast('Tutte le carte sono già potenziate.', 'bad')
  openDeckPicker({
    mode: 'upgrade',
    source: 'shop',
    nodeId: node.id,
    cost: 60,
    service: 'upgrade',
    title: 'Potenzia una carta · 60 oro',
    subtitle: 'La carta scelta ottiene +1 ATK e +1 HP. L’oro verrà speso solo alla conferma.',
  })
}

function campRest() {
  const run = state.run
  const node = state.campNode
  if (!run || !node) return
  if (run.morale >= run.maxMorale) return showToast('Sei già in pieno vigore.', 'bad')
  const amount = Math.max(8, Math.round(run.maxMorale * 0.3))
  const healed = healRun(run, amount)
  playSound('heal')
  completeNodeFlow(node, `Il riposo ti restituisce ${healed} Morale.`, 'heal')
}

function campUpgrade() {
  const run = state.run
  const node = state.campNode
  if (!run || !node) return
  if (!run.deck.some((c) => !c.upgraded)) return showToast('Tutte le carte sono già potenziate.', 'bad')
  openDeckPicker({
    mode: 'upgrade',
    source: 'camp',
    nodeId: node.id,
    title: 'Affina una carta',
    subtitle: 'La carta scelta ottiene +1 ATK e +1 HP. Potrai ripartire subito dopo.',
  })
}

function campRemove() {
  const run = state.run
  const node = state.campNode
  if (!run || !node) return
  if (run.deck.length <= 8) return showToast('Il mazzo è già troppo piccolo.', 'bad')
  openDeckPicker({
    mode: 'remove',
    source: 'camp',
    nodeId: node.id,
    title: 'Medita e lascia andare',
    subtitle: 'Scegli la carta da rimuovere dal mazzo. Potrai ripartire subito dopo.',
  })
}

function chooseEventOption(index) {
  const run = state.run
  const node = state.eventNode
  if (!run || !node) return
  const event = eventById(node.eventId)
  const option = event.options[index]
  if (!option) return
  if (option.can && !option.can(run)) {
    showToast('Non hai i requisiti per questa scelta.', 'bad')
    return
  }
  const result = option.apply(run)
  // L'evento si considera concluso appena scegli: salviamo subito l'esito,
  // così uscire durante il testo di risultato non permette di ripeterlo.
  completeNode(node)
  state.eventNode = node
  state.eventResult = result || 'La strada riprende.'
  state.screen = 'event'
  playSound('map')
  render()
}

function eventContinue() {
  if (!state.eventNode) {
    state.screen = 'map'
    render()
    return
  }
  state.eventNode = null
  state.eventResult = null
  state.screen = 'map'
  state.modal = null
  saveRun()
  render()
  playSound('map')
  showToast('La strada continua.', 'good')
}

/* ═══════════════════════════════════════════════════════════
   RICOMPENSE / FINE BATTAGLIA
   ═══════════════════════════════════════════════════════════ */
function handleBattleWin(node) {
  const b = state.battle
  const run = state.run
  if (!b || !run) return
  run.stats.battlesWon += 1
  if (node.type === 'elite') run.stats.elitesWon += 1
  run.morale = clamp(b.player.morale, 0, run.maxMorale)

  const gold = Math.round(node.gold * (hasBanner(run, 'banner_gold') ? 1.3 : 1))
  run.gold += gold
  if (hasBanner(run, 'banner_supplies')) healRun(run, 6)

  state.battle = null
  state.selectedCard = null
  state.modal = null

  if (node.type === 'boss') {
    completeNode(node)
    finishRunNow(true, 'vittoria')
    return
  }

  const cardOptions = run.deck.length < DECK_LIMIT ? cardRewardOptions(run, 3) : []
  const bannerOptions = node.type === 'elite' ? pickBannerOptions(run, 2) : []
  // Segna subito la tappa come completata: se il giocatore chiude la scheda
  // o torna al titolo durante la scelta della ricompensa, non può rigiocare
  // la stessa battaglia (e non perde oro/Morale già ottenuti).
  completeNode(node)
  state.reward = {
    node,
    gold,
    cards: cardOptions,
    bannerOptions,
    stage: cardOptions.length ? 'card' : bannerOptions.length ? 'banner' : 'done',
  }
  if (state.reward.stage === 'done') {
    completeReward()
    return
  }
  state.screen = 'reward'
  render()
  playSound('gold')
  showToast(`+${gold} oro${hasBanner(run, 'banner_supplies') ? ' · Provviste: +6 Morale' : ''}`, 'gold')
}

function handleBattleLose() {
  if (state.run) state.run.morale = 0
  finishRunNow(false, 'sconfitta')
}

function pickReward(cardId) {
  const reward = state.reward
  const run = state.run
  if (!reward || !run || reward.stage !== 'card') return
  const def = getCard(cardId)
  if (!def) return
  if (run.deck.length < DECK_LIMIT) {
    run.deck.push(makeCardInstance(def.id))
    saveRun()
    showToast(`${def.name} entra nel mazzo.`, 'good')
    playSound('unlock')
  } else {
    showToast('Il mazzo è pieno: la carta non può essere aggiunta.', 'bad')
  }
  if (reward.bannerOptions.length) {
    reward.stage = 'banner'
    render()
  } else {
    completeReward()
  }
}

function skipReward() {
  const reward = state.reward
  if (!reward) return
  if (reward.bannerOptions.length) {
    reward.stage = 'banner'
    render()
  } else {
    completeReward()
  }
}

function pickBanner(bannerId) {
  const reward = state.reward
  const run = state.run
  const banner = BANNER_BY_ID[bannerId]
  if (!reward || !run || !banner) return
  if (!run.banners.includes(banner.id)) {
    run.banners.push(banner.id)
    if (banner.id === 'banner_courage') {
      run.maxMorale += 6
      healRun(run, 6)
    }
    saveRun()
    playSound('unlock')
    showToast(`Stendardo ottenuto: ${banner.name}`, 'good')
  }
  completeReward()
}

function completeReward() {
  const reward = state.reward
  if (!reward) return
  state.reward = null
  state.modal = null
  state.screen = 'map'
  saveRun()
  render()
  playSound('map')
  showToast('Tappa completata. La strada prosegue.', 'good')
}

function finishRunNow(victory, reason) {
  const summary = endRun(victory, reason)
  if (!summary) {
    state.screen = 'title'
    render()
    return
  }
  state.lastRun = summary
  state.battle = null
  state.selectedCard = null
  state.reward = null
  state.shopNode = null
  state.eventNode = null
  state.eventResult = null
  state.campNode = null
  state.modal = null
  state.screen = 'runEnd'
  render()
  playSound(victory ? 'win' : 'lose')
}

/* ═══════════════════════════════════════════════════════════
   MODALI
   ═══════════════════════════════════════════════════════════ */
function openHelp() {
  state.modal = { type: 'help' }
  renderModal()
  playSound('click')
}

function openDeckView() {
  state.modal = { type: 'deck' }
  renderModal()
  playSound('click')
}

function openMenu() {
  state.modal = { type: 'menu', battle: state.screen === 'battle' }
  renderModal()
  playSound('click')
}

function openLog() {
  state.modal = { type: 'log' }
  renderModal()
  playSound('click')
}

function openDeckPicker(options) {
  state.modal = { type: 'deck-picker', ...options }
  renderModal()
  playSound('click')
}

function openConfirm(options) {
  state.modal = { type: 'confirm', ...options }
  renderModal()
  playSound('click')
}

function closeModal() {
  state.modal = null
  renderModal()
}

function handleModalAction(action, data) {
  if (action === 'close') {
    closeModal()
    return
  }
  if (action === 'help') {
    openHelp()
    return
  }
  if (action === 'deck') {
    openDeckView()
    return
  }
  if (action === 'log') {
    openLog()
    return
  }
  if (action === 'title') {
    if (state.battle) {
      openConfirm({
        title: 'Tornare al titolo?',
        text: 'La battaglia in corso andrà persa. La spedizione resta salvata all’ultima tappa completata.',
        confirmLabel: 'Torna al titolo',
        action: 'exit-battle-title',
      })
    } else {
      closeModal()
      goTitle()
    }
    return
  }
  if (action === 'abandon') {
    if (!state.run) {
      closeModal()
      return
    }
    openConfirm({
      title: 'Abbandonare la spedizione?',
      text: 'La run termina subito e ottieni gli Echi accumulati fino a qui. Le carte sbloccate restano per sempre.',
      confirmLabel: 'Abbandona',
      action: 'abandon',
    })
    return
  }
  if (action === 'confirm') {
    const modal = state.modal
    if (!modal || modal.type !== 'confirm') return
    const { action: confirmAction, payload } = modal
    closeModal()
    if (confirmAction === 'abandon') finishRunNow(false, 'abbandonata')
    else if (confirmAction === 'overwrite-run' && payload?.factionId) beginRun(payload.factionId)
    else if (confirmAction === 'exit-battle-title') exitBattleToTitle()
    return
  }
  if (action === 'pick-deck') {
    handleDeckPick(data.uid)
  }
}

function handleDeckPick(uid) {
  const modal = state.modal
  const run = state.run
  if (!modal || modal.type !== 'deck-picker' || !run) return
  const index = run.deck.findIndex((c) => c.uid === uid)
  if (index < 0) return
  const inst = run.deck[index]

  if (modal.mode === 'remove' && run.deck.length <= 8) {
    closeModal()
    showToast('Il mazzo deve mantenere almeno 8 carte.', 'bad')
    render()
    return
  }
  if (modal.mode === 'upgrade' && inst.upgraded) {
    closeModal()
    showToast('Questa carta è già potenziata.', 'bad')
    render()
    return
  }

  if (modal.source === 'shop') {
    const node = findNode(modal.nodeId)
    if (!node || !node.services || node.services[modal.service]) {
      closeModal()
      showToast('Servizio non più disponibile.', 'bad')
      render()
      return
    }
    if (run.gold < modal.cost) {
      closeModal()
      showToast('Oro insufficiente.', 'bad')
      render()
      return
    }
    if (modal.mode === 'remove') run.deck.splice(index, 1)
    else inst.upgraded = true
    run.gold -= modal.cost
    node.services[modal.service] = true
    saveRun()
    closeModal()
    playSound(modal.mode === 'remove' ? 'click' : 'unlock')
    showToast(modal.mode === 'remove' ? 'Carta rimossa dal mazzo. −50 oro' : 'Carta potenziata. −60 oro', 'good')
    render()
    return
  }

  if (modal.source === 'camp') {
    const node = findNode(modal.nodeId)
    if (modal.mode === 'remove') run.deck.splice(index, 1)
    else inst.upgraded = true
    closeModal()
    playSound(modal.mode === 'remove' ? 'click' : 'unlock')
    completeNodeFlow(node, modal.mode === 'remove' ? 'Hai lasciato andare una carta.' : 'La carta è stata affinata.', modal.mode === 'remove' ? 'map' : 'unlock')
    return
  }

  closeModal()
  render()
}

/* ═══════════════════════════════════════════════════════════
   AZIONI
   ═══════════════════════════════════════════════════════════ */
function handleAction(action, data) {
  switch (action) {
    case 'show-title': goTitle(); return
    case 'show-factions':
      state.modal = null
      state.screen = 'factions'
      render()
      playSound('click')
      return
    case 'continue-run': {
      const saved = loadSavedRun()
      if (!saved) {
        showToast('Nessuna spedizione salvata.', 'bad')
        return
      }
      state.run = saved
      state.battle = null
      state.modal = null
      state.screen = 'map'
      render()
      playSound('map')
      showToast(`Spedizione ripresa: ${FACTION_BY_ID[saved.factionId].name}.`, 'good')
      return
    }
    case 'start-run': {
      const factionId = data.faction
      if (!FACTION_BY_ID[factionId]) return
      if (loadSavedRun()) {
        openConfirm({
          title: 'Spedizione in corso',
          text: 'Hai una spedizione salvata. Iniziarne una nuova la sostituirà e la vecchia non potrà essere recuperata.',
          confirmLabel: 'Inizia comunque',
          action: 'overwrite-run',
          payload: { factionId },
        })
      } else {
        beginRun(factionId)
      }
      return
    }
    case 'show-archive':
      state.modal = null
      state.archiveFaction = state.run?.factionId || state.lastRun?.factionId || 'greece'
      state.screen = 'archive'
      render()
      playSound('click')
      return
    case 'archive-tab':
      if (FACTION_BY_ID[data.faction]) {
        state.archiveFaction = data.faction
        render()
        playSound('click')
      }
      return
    case 'unlock-card': {
      const def = getCard(data.card)
      if (!def) return
      if (state.meta.unlocked[def.faction]?.includes(def.id)) return
      const cost = RARITY[def.rarity].cost
      if (state.meta.echoes < cost) {
        showToast('Non hai abbastanza Echi.', 'bad')
        return
      }
      state.meta.echoes -= cost
      state.meta.unlocked[def.faction].push(def.id)
      saveMeta()
      playSound('unlock')
      showToast(`${def.name} sbloccata! −${cost} Echi`, 'good')
      render()
      return
    }
    case 'view-card': {
      const def = getCard(data.card)
      if (!def) return
      state.modal = { type: 'card', cardId: def.id, upgraded: false }
      renderModal()
      playSound('click')
      return
    }
    case 'toggle-sound':
      state.meta.sound = !state.meta.sound
      saveMeta()
      playSound('click')
      render()
      return
    case 'open-help': openHelp(); return
    case 'open-deck': openDeckView(); return
    case 'open-run-menu':
    case 'battle-menu': openMenu(); return
    case 'battle-log': openLog(); return
    case 'enter-node': startNode(data.node); return
    case 'leave-shop': {
      const node = state.shopNode
      completeNodeFlow(node, 'Riprendi il cammino.', 'map')
      return
    }
    case 'buy-card': buyShopCard(Number(data.index)); return
    case 'shop-heal': shopHeal(); return
    case 'shop-remove': shopRemove(); return
    case 'shop-upgrade': shopUpgrade(); return
    case 'camp-rest': campRest(); return
    case 'camp-upgrade': campUpgrade(); return
    case 'camp-remove': campRemove(); return
    case 'leave-camp': {
      const node = state.campNode
      completeNodeFlow(node, 'Prosegui senza riposare.', 'map')
      return
    }
    case 'event-option': chooseEventOption(Number(data.index)); return
    case 'event-continue': eventContinue(); return
    case 'select-card': {
      const b = state.battle
      if (!b) return
      if (b.busy || b.phase !== 'player') {
        showToast('Attendi la fine della risoluzione.', 'bad')
        return
      }
      const index = Number(data.index)
      if (!b.player.hand[index]) return
      state.selectedCard = state.selectedCard === index ? null : index
      render()
      playSound('click')
      return
    }
    case 'slot': {
      const b = state.battle
      if (!b) return
      const side = data.side
      const row = data.row
      const col = Number(data.col)
      if (state.selectedCard != null) {
        if (side !== 'player') {
          showToast('Puoi schierare solo dalla tua parte del campo.', 'bad')
          return
        }
        const result = playPlayerCard(state.selectedCard, row, col)
        if (!result.ok) {
          showToast(result.message || 'Mossa non valida.', 'bad')
          return
        }
        return
      }
      const unit = b[side]?.units?.[row]?.[col]
      if (unit) {
        state.modal = {
          type: 'unit',
          cardId: unit.cardId,
          upgraded: unit.upgraded,
          unit: { ...unit },
        }
        renderModal()
        playSound('click')
      }
      return
    }
    case 'end-turn':
      endTurn().catch((error) => {
        console.error(error)
        showToast('Errore durante la risoluzione del turno.', 'bad')
      })
      return
    case 'pick-reward': pickReward(data.card); return
    case 'skip-reward': skipReward(); return
    case 'pick-banner': pickBanner(data.banner); return
    case 'run-end-factions':
      state.modal = null
      state.screen = 'factions'
      render()
      playSound('click')
      return
    case 'run-end-archive':
      state.archiveFaction = state.lastRun?.factionId || 'greece'
      state.modal = null
      state.screen = 'archive'
      render()
      playSound('click')
      return
    case 'run-end-title':
      state.modal = null
      state.screen = 'title'
      render()
      playSound('click')
      return
    default:
      return
  }
}

/* ═══════════════════════════════════════════════════════════
   EVENTI DOM
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('click', (event) => {
  const modalAction = event.target.closest('[data-maction]')
  if (modalAction) {
    event.preventDefault()
    handleModalAction(modalAction.dataset.maction, modalAction.dataset)
    return
  }
  const actionEl = event.target.closest('[data-action]')
  if (actionEl) {
    event.preventDefault()
    handleAction(actionEl.dataset.action, actionEl.dataset)
    return
  }
  if (event.target.matches?.('[data-modal-overlay]')) closeModal()
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (state.modal) {
      closeModal()
      return
    }
    if (state.screen === 'battle') {
      openMenu()
      return
    }
  }
  if (state.modal || state.screen !== 'battle') return
  if (event.key === ' ' || event.key === 'Enter') {
    // Lascia che Invio/Spazio attivino il controllo che ha il focus.
    if (event.target?.closest?.('button, a, input, select, textarea, [contenteditable]')) return
    event.preventDefault()
    if (state.battle && !state.battle.busy) {
      endTurn().catch((error) => console.error(error))
    }
    return
  }
  const n = Number(event.key)
  if (Number.isInteger(n) && n >= 1 && n <= 9) {
    const b = state.battle
    if (b && b.player.hand[n - 1]) {
      if (b.busy || b.phase !== 'player') return
      event.preventDefault()
      state.selectedCard = state.selectedCard === n - 1 ? null : n - 1
      render()
    }
  }
})

/* ═══════════════════════════════════════════════════════════
   AVVIO
   ═══════════════════════════════════════════════════════════ */
function init() {
  state.meta = loadMeta()
  setBattleHooks({
    render,
    toast: showToast,
    onWin: handleBattleWin,
    onLose: handleBattleLose,
  })
  state.screen = 'title'
  render()

  window.__echi = {
    state,
    getCard,
    FACTIONS,
    beginRun,
    startNode,
    playPlayerCard,
    endTurn,
    render,
    finishRunNow,
    addEchoes(amount) {
      state.meta.echoes = Math.max(0, state.meta.echoes + Number(amount || 0))
      saveMeta()
      render()
    },
    unlockAll() {
      for (const f of FACTIONS) state.meta.unlocked[f.id] = f.core.concat(f.locked)
      saveMeta()
      render()
    },
  }
}

init()
