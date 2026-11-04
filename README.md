# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/nidhoggxii/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/nidhoggxii/PlayGround)

- 🎮 [Open the project](https://go.ondev.store/nidhoggxii/PlayGround).
- ✨ [Remix this project](https://go.ondev.store/nidhoggxii/PlayGround?remix=1).
- 💻 [Explore the source](https://github.com/nidhoggxii/PlayGround).
- 🛠️ [Check build runs](https://github.com/nidhoggxii/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/nidhoggxii/PlayGround/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/nidhoggxii).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
<!-- omgithub:readme:end -->

## Echi di Guerra

Un roguelike di carte a tema storico, interamente nel browser e senza dipendenze esterne.

- 4 fazioni giocabili: Antica Grecia, Roma Imperiale, Clan del Nord e Giappone Feudale.
- 56 carte, 6 Stendardi e 6 eventi lungo la strada.
- 7 tappe per spedizione: battaglie, elite, mercante, accampamento e boss finale.
- Progressi permanenti salvati in `localStorage`: Echi, carte sbloccate e spedizione in corso.
- Interfaccia e comandi touch ottimizzati per desktop, tablet e smartphone.

### Avvio locale

Il gioco usa moduli ES, quindi va servito via HTTP:

```bash
python3 -m http.server 3002 --bind 127.0.0.1
```

Poi apri `http://127.0.0.1:3002`.

### Comandi

- Tocca/clicca una carta, poi uno slot dorato della riga corretta per schierarla.
- Termina il turno per attivare gli effetti di fine turno e far attaccare la prima linea.
- Tasti `1`–`9`: seleziona una carta della mano. `Spazio`/`Invio`: termina il turno. `Esc`: pausa.
- Le carte sbloccate entrano automaticamente nel mazzo iniziale delle spedizioni successive.

### Struttura

- `index.html` / `styles.css`: interfaccia e layout responsive.
- `js/data.js`: carte, fazioni, stendardi e costanti.
- `js/core.js`: stato, salvataggi, mappa, ricompense, eventi e progressione.
- `js/battle.js`: motore di combattimento e IA nemica.
- `js/ui*.js`: rendering delle schermate, modali e battaglia.
- `js/app.js`: azioni, navigazione e avvio.
