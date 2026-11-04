import { BANNERS, BANNER_BY_ID, FACTION_BY_ID, RARITY, getCard } from './data.js'
import { DECK_LIMIT, ROW_SHORT, esc, groupDeck, state } from './core.js'
import { cardFaceHTML } from './render-helpers.js'

function shell({ title, subtitle = '', body, actions = '', wide = false, close = true }) {
  return `<div class="modal-overlay" data-modal-overlay="1">
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <div>
          ${subtitle ? `<div class="mh-sub">${esc(subtitle)}</div>` : ''}
          <h2>${esc(title)}</h2>
        </div>
        ${close ? '<button type="button" class="icon-btn modal-close" data-maction="close" aria-label="Chiudi">✕</button>' : ''}
      </div>
      ${body}
      ${actions ? `<div class="modal-actions">${actions}</div>` : ''}
    </div>
  </div>`
}

export function renderModal() {
  const root = document.getElementById('modal-root')
  if (!root) return
  const modal = state.modal
  if (!modal) {
    root.innerHTML = ''
    return
  }
  switch (modal.type) {
    case 'help': root.innerHTML = helpModal(); break
    case 'menu': root.innerHTML = menuModal(modal); break
    case 'confirm': root.innerHTML = confirmModal(modal); break
    case 'deck': root.innerHTML = deckModal(); break
    case 'deck-picker': root.innerHTML = deckPickerModal(modal); break
    case 'card':
    case 'unit': root.innerHTML = cardModal(modal); break
    case 'log': root.innerHTML = logModal(); break
    default: root.innerHTML = ''
  }
}

function helpModal() {
  const body = `
    <p>Echi di Guerra è un roguelike di carte a tema storico. Scegli una fazione, attraversa sette tappe e sconfiggi l’ultima armata. Ogni run sblocca carte che restano per sempre.</p>
    <div class="help-section">
      <h3>Il tabellone</h3>
      <ul>
        <li><strong>Prima Linea</strong> — attacca l’unità nemica nella stessa colonna. Se la colonna è vuota, colpisce il <strong>Morale</strong> nemico.</li>
        <li><strong>Supporto</strong> — potenzia, cura o colpisce dalla seconda fila. Gli effetti si attivano a fine turno.</li>
        <li><strong>Rifornimento</strong> — tiene in vita l’esercito: cure, Scudi e Morale. Anche i suoi effetti si attivano a fine turno.</li>
      </ul>
    </div>
    <div class="help-section">
      <h3>Un turno</h3>
      <ul>
        <li>Hai <strong>3 Comando</strong> e peschi <strong>5 carte</strong>. Gioca le carte negli slot liberi della riga corretta.</li>
        <li>Termina il turno: prima si attivano tutti gli effetti di fine turno (Supporto, Rifornimento e Prima Linea), poi la Prima Linea attacca. Infine il nemico gioca e contrattacca.</li>
        <li>Riduci il Morale nemico a <strong>0</strong> per vincere. Se il tuo Morale arriva a 0, la spedizione finisce.</li>
        <li>La mano viene scartata a fine turno: non accumulare carte inutilmente.</li>
      </ul>
    </div>
    <div class="help-section">
      <h3>Parole chiave</h3>
      <div class="keyword-grid">
        <div class="keyword"><strong>Perfora</strong><span>Se l’attacco uccide l’unità bloccante, il danno in eccesso colpisce il Morale nemico.</span></div>
        <div class="keyword"><strong>Scudo</strong><span>Assorbe i danni prima dei Punti Vita. Non svanisce a fine turno.</span></div>
        <div class="keyword"><strong>Potenzia</strong><span>+1 ATK e +1 HP. Si applica all’istanza della carta, non a tutte le copie.</span></div>
        <div class="keyword"><strong>Stendardo</strong><span>Bonus permanente per la spedizione, ottenuto dalle Guardie Scelte.</span></div>
      </div>
    </div>
    <div class="help-section">
      <h3>Progressione</h3>
      <ul>
        <li>Tra una tappa e l’altra scegli ricompense, visita mercanti e accampamenti, affronta eventi.</li>
        <li>A fine run ottieni <strong>Echi</strong> e sblocchi carte a caso. Le carte sbloccate entrano nel mazzo iniziale delle prossime spedizioni con quella fazione.</li>
        <li>Nell’<strong>Archivio</strong> puoi spendere Echi per sbloccare una carta specifica.</li>
      </ul>
    </div>`
  return shell({
    title: 'Come si gioca',
    subtitle: 'Guida rapida',
    body,
    actions: '<button type="button" class="btn" data-maction="close">Ho capito</button>',
  })
}

function menuModal(modal) {
  const inBattle = !!modal.battle && !!state.battle
  const body = `<div class="choice-list">
    <button type="button" class="choice" data-maction="close"><span class="choice-icon">↩️</span><span class="choice-main"><span class="choice-label">Riprendi</span><span class="choice-desc">Torna alla partita.</span></span></button>
    ${inBattle ? '<button type="button" class="choice" data-maction="log"><span class="choice-icon">📜</span><span class="choice-main"><span class="choice-label">Registro della battaglia</span><span class="choice-desc">Rileggi gli ultimi eventi.</span></span></button>' : ''}
    <button type="button" class="choice" data-maction="deck"><span class="choice-icon">🃏</span><span class="choice-main"><span class="choice-label">Il tuo mazzo</span><span class="choice-desc">${state.run ? `${state.run.deck.length} carte · ${state.run.banners.length} stendardi` : 'Nessuna spedizione attiva.'}</span></span></button>
    <button type="button" class="choice" data-maction="help"><span class="choice-icon">❔</span><span class="choice-main"><span class="choice-label">Come si gioca</span><span class="choice-desc">Regole, parole chiave e consigli.</span></span></button>
    <button type="button" class="choice" data-maction="title"><span class="choice-icon">🏠</span><span class="choice-main"><span class="choice-label">Torna al titolo</span><span class="choice-desc">La spedizione viene salvata all’ultima tappa.</span></span></button>
    ${state.run ? '<button type="button" class="choice danger" data-maction="abandon"><span class="choice-icon">🏳️</span><span class="choice-main"><span class="choice-label">Abbandona la spedizione</span><span class="choice-desc">Termina la run e raccogli gli Echi accumulati.</span></span></button>' : ''}
  </div>`
  return shell({ title: 'Pausa', subtitle: inBattle ? 'Battaglia in corso' : 'Spedizione', body })
}

function confirmModal(modal) {
  const body = `<p>${esc(modal.text || '')}</p>`
  return shell({
    title: modal.title || 'Confermi?',
    subtitle: modal.subtitle || '',
    body,
    actions: `<button type="button" class="btn ghost" data-maction="close">Annulla</button><button type="button" class="btn danger" data-maction="confirm">${esc(modal.confirmLabel || 'Conferma')}</button>`,
  })
}

function deckModal() {
  const run = state.run
  if (!run) {
    return shell({ title: 'Il tuo mazzo', body: '<p>Nessuna spedizione attiva.</p>', actions: '<button type="button" class="btn" data-maction="close">Chiudi</button>' })
  }
  const groups = groupDeck(run.deck)
  const banners = run.banners.map((id) => BANNER_BY_ID[id]).filter(Boolean)
  const body = `
    <p>${run.deck.length}/${DECK_LIMIT} carte. Le carte potenziate mostrano ★ e hanno +1 ATK e +1 HP.</p>
    ${banners.length ? `<div class="help-section"><h3>Stendardi</h3><div class="unlock-row" style="justify-content:flex-start">${banners.map((b) => `<div class="unlock-chip" title="${esc(b.desc)}"><span class="em">${b.icon}</span><span>${esc(b.name)}</span></div>`).join('')}</div></div>` : ''}
    <div class="deck-list" style="margin-top:14px">
      ${groups.map((entry) => {
        const def = getCard(entry.id)
        return `<div class="deck-row">
          <span class="dr-cost">${def.cost}</span>
          <span class="dr-name">${esc(def.name)}${entry.upgraded ? ' <span class="dr-up">★</span>' : ''} ${entry.count > 1 ? `<span class="faint">×${entry.count}</span>` : ''}</span>
          <span class="dr-row">${ROW_SHORT[def.row]}</span>
          <span class="dr-stats">⚔${def.atk + (entry.upgraded ? 1 : 0)} ♥${def.hp + (entry.upgraded ? 1 : 0)}</span>
        </div>`
      }).join('')}
    </div>`
  return shell({ title: 'Il tuo mazzo', subtitle: `${run.deck.length} carte · ${FACTION_BY_ID[run.factionId].name}`, body, wide: true, actions: '<button type="button" class="btn" data-maction="close">Chiudi</button>' })
}

function deckPickerModal(modal) {
  const run = state.run
  if (!run) {
    return shell({ title: modal.title || 'Scegli una carta', body: '<p>Nessuna spedizione attiva.</p>', actions: '<button type="button" class="btn ghost" data-maction="close">Annulla</button>' })
  }
  const eligible = modal.mode === 'upgrade' ? run.deck.filter((c) => !c.upgraded) : [...run.deck]
  const body = `
    <p>${esc(modal.subtitle || (modal.mode === 'upgrade' ? 'Scegli una carta da potenziare.' : 'Scegli una carta da rimuovere dal mazzo.'))}</p>
    ${modal.source === 'shop' && modal.cost ? `<p class="dark-text" style="color:var(--gold-soft);font-size:12px">Costo: ${modal.cost} oro</p>` : ''}
    ${eligible.length ? `<div class="deck-browser">
      ${eligible.map((inst) => {
        const def = getCard(inst.id)
        return cardFaceHTML(def, {
          upgraded: inst.upgraded,
          tag: 'button',
          attrs: `data-maction="pick-deck" data-uid="${inst.uid}" aria-label="${esc(def.name)}"`,
        })
      }).join('')}
    </div>` : '<div class="empty-state">Nessuna carta disponibile per questa azione.</div>'}
    <div class="modal-actions"><button type="button" class="btn ghost" data-maction="close">Annulla</button></div>`
  return shell({ title: modal.title || (modal.mode === 'upgrade' ? 'Affina una carta' : 'Rimuovi una carta'), subtitle: 'Il tuo mazzo', body, wide: true })
}

function cardModal(modal) {
  const def = getCard(modal.cardId)
  if (!def) {
    return shell({ title: 'Carta', body: '<p>Carta non trovata.</p>', actions: '<button type="button" class="btn" data-maction="close">Chiudi</button>' })
  }
  const unit = modal.unit
  const faction = FACTION_BY_ID[def.faction]
  const keywords = (def.keywords || []).map((k) => k === 'perfora' ? 'Perfora: il danno in eccesso colpisce il Morale.' : k).join(' ')
  const body = `
    <div style="width:min(190px,58vw);margin:0 auto 16px">${cardFaceHTML(def, { upgraded: modal.upgraded })}</div>
    <p>${esc(def.text)}</p>
    ${keywords ? `<p class="gold" style="margin-top:8px;font-size:12px">${esc(keywords)}</p>` : ''}
    <div class="keyword-grid" style="margin-top:12px">
      <div class="keyword"><strong>Fazione</strong><span>${faction.emblem} ${esc(faction.name)}</span></div>
      <div class="keyword"><strong>Riga</strong><span>${ROW_SHORT[def.row]}</span></div>
      <div class="keyword"><strong>Costo</strong><span>${def.cost} Comando</span></div>
      <div class="keyword"><strong>Statistiche base</strong><span>⚔ ${def.atk} · ♥ ${def.hp}${modal.upgraded ? ' · ★ +1/+1' : ''}</span></div>
    </div>
    ${unit ? `<div class="keyword" style="margin-top:10px"><strong>In campo</strong><span>⚔ ${unit.atk} · ♥ ${unit.hp}/${unit.maxHp}${unit.shield ? ` · ◈ Scudo ${unit.shield}` : ''}${unit.upgraded ? ' · ★ Potenziata' : ''}</span></div>` : ''}
    <div class="modal-actions"><button type="button" class="btn" data-maction="close">Chiudi</button></div>`
  return shell({ title: def.name, subtitle: `${RARITY[def.rarity].label} · ${ROW_SHORT[def.row]}`, body })
}

function logModal() {
  const entries = state.battle?.log || []
  const body = entries.length
    ? `<div class="deck-list">${[...entries].reverse().slice(0, 40).map((entry) => `<div class="deck-row" style="display:block;font-size:11.5px;color:var(--muted)">${esc(entry)}</div>`).join('')}</div>`
    : '<div class="empty-state">Nessun evento registrato.</div>'
  return shell({ title: 'Registro', subtitle: 'Ultimi eventi', body, wide: true, actions: '<button type="button" class="btn" data-maction="close">Chiudi</button>' })
}
