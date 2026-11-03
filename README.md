# Casa Cocis — Castiglione Torinese

Cruscotto di casa, pubblicato con GitHub Pages. Pagina statica: nessun server,
nessun account, nessuna raccolta di dati da chi la visita.

- **Acqua** (radice) — letture dei contatori, consumi, ripartizione delle bollette SMAT
  fra le quattro utenze del condominio.
- **Fotovoltaico** (`fotovoltaico/`) — bilancio fotovoltaico, bollette Edison.

## Come sono fatti i dati

`dati.json` contiene **solo letture dei contatori** e i dati essenziali delle bollette
(importo, metri cubi, periodo). Consumi, medie giornaliere, quote e importi per utenza
sono calcolati dalla pagina: nel file non c'è nessun totale scritto a mano, così non
possono divergere dalle letture.

Il contatore generale è stato sostituito nel 2024: le due serie sono marcate
`"contatore": "vecchio"` e `"nuovo"` e non vanno sommate.

Le bollette sono divise in due gruppi. In `bollette` stanno quelle ricontrollate contro
il foglio di calcolo. In `bollette_da_verificare` quelle i cui fogli originali hanno
importo e metri cubi incoerenti fra loro: ne esce un prezzo al metro cubo fuori scala
rispetto ai ~3 €/mc normali, quindi restano fuori dai conti finché non si recuperano
le bollette cartacee.

## Soglie di attenzione

| Dove | Soglia |
|---|---|
| Contatore generale | fino a 1,7 mc/giorno verde, oltre 1,7 giallo, da 3 rosso |
| Singola utenza | rosso oltre 0,7 mc/giorno (B., D.), 0,6 (Mt.), 0,5 (M.) |
| Parte comune sul totale | oltre il 35% rosso |

La parte comune (differenza fra contatore generale e somma degli individuali) viene
calcolata **solo fra due date in cui tutti e quattro i contatori sono stati letti**.
Confrontare periodi di lunghezza diversa darebbe un numero privo di significato.

## Pagina privata con password

`privata/` è la stessa pagina dell'acqua, ma con i cognomi dei condomini al posto
delle iniziali, protetta da una password.

I cognomi stanno cifrati in `privata/nomi.cifrati.json` (AES-256-GCM, chiave da
PBKDF2-SHA256 con 310.000 iterazioni). La password non viene confrontata con niente:
serve a decifrare quel file, quindi senza non c'è niente da leggere e niente da
aggirare lato pagina.

I consumi invece arrivano da `dati.json`, lo stesso file della pagina pubblica, che
il servizio delle letture aggiorna a ogni inserimento. Così non esiste una seconda
copia dei dati da tenere allineata: la pagina privata è aggiornata quanto l'altra.

Per generare o cambiare la password:

```
node cifra-nomi.mjs "nuova password"
```

Riscrive `privata/nomi.cifrati.json` e `PASSWORD.txt`. Lo script e il file della
password restano fuori da git. Dopo, va ripubblicato il sito.

Serve un indirizzo https: le funzioni di cifratura del browser non sono disponibili
su un file aperto dal telefono.
