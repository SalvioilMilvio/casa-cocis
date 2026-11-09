# Casa Cocis — Castiglione Torinese

Cruscotto di casa, pubblicato con GitHub Pages.

- **Acqua** (`privata/`) — letture dei contatori, consumi, ripartizione delle bollette
  SMAT fra le quattro utenze del condominio. Chiede una password.
- **Energia** (`fotovoltaico/`) — bilancio fotovoltaico, bollette Edison. Pagina aperta.
- **Inserimento letture** (`carica/`) — un link personale per condomino, che apre
  tutti e cinque i contatori: si parte dal proprio, ma chi fa il giro li scrive
  tutti. Il link dice chi sta inserendo, non limita cosa può inserire.

## Dove stanno i dati

Nel repository, che è pubblico, i dati dell'acqua ci sono **solo cifrati**:
`dati.cifrati.json`, AES-256-GCM. La chiave non è qui, sta fra i segreti del
servizio delle letture (`worker/`). Da quel file, senza il servizio, non si ricava
niente: né i consumi, né gli importi, né i cognomi dei condomini.

La pagina chiede la password, il servizio la verifica e le consegna i dati decifrati.
La password non viaggia mai dentro il file: sta anch'essa fra i segreti.

Il contenuto è **solo letture dei contatori** e i dati essenziali delle bollette
(importo, metri cubi, periodo). Consumi, medie giornaliere, quote e importi per
utenza sono calcolati dalla pagina: non c'è nessun totale scritto a mano, così non
possono divergere dalle letture.

## Come si ripartisce una bolletta

Ogni bolletta porta un campo `confine`: la data della tornata di letture che la
chiude. I metri cubi di ciascuna utenza sono la **differenza fra il proprio
contatore a quel confine e al confine della bolletta precedente**; le quote, e
quindi gli importi, escono da lì. La più vecchia della serie porta anche
`confine_precedente`, che le fa da apertura.

Le tornate non cadono nei giorni esatti del periodo SMAT — il contatore generale
lo legge l'azienda quando passa, i quattro individuali li leggiamo noi. Non
importa: conta che il periodo sia **lo stesso per tutti e quattro**, perché la
ripartizione è proporzionale e uno scarto comune si semplifica.

Nello storico le righe che chiudono o aprono una bolletta sono evidenziate: sono
le uniche letture da cui dipendono dei soldi.

Il contatore generale è stato sostituito nel 2024: le due serie sono marcate
`"contatore": "vecchio"` e `"nuovo"` e non vanno sommate.

Le bollette sono divise in due gruppi. In `bollette` stanno quelle ricontrollate
contro il foglio di calcolo. In `bollette_da_verificare` quelle i cui fogli originali
hanno importo e metri cubi incoerenti fra loro: ne esce un prezzo al metro cubo fuori
scala rispetto ai ~3 €/mc normali, quindi restano fuori dai conti finché non si
recuperano le bollette cartacee.

## Il servizio delle letture

`worker/` è il servizio su Cloudflare che tiene la chiave e la password. Fa tre cose:

| Richiesta | Chi entra | Cosa fa |
|---|---|---|
| `POST /dati` | password | restituisce tutti i dati decifrati, alla pagina |
| `POST /chi` | link personale | dice quale contatore tocca a chi apre il link |
| `POST /salva` | link personale | controlla la lettura, la inserisce e ricifra il file |

Le regole sulle letture stanno in `worker/src/logica.js`, separate dalla rete, e si
provano con `node --test` dentro `worker/`.

Segreti da impostare (una volta sola, con `wrangler secret put <nome>`):
`GITHUB_TOKEN`, `TOKENS`, `CHIAVE`, `PASSWORD`.

Per cambiare la password della pagina:

```
cd worker && npx wrangler secret put PASSWORD
```

Non serve ripubblicare il sito: la password non sta nelle pagine.

## Rigenerare i dati dagli Excel

`estrai.py` rilegge i due file Excel in `Google Drive\- Castiglione\- Acqua tubi` e
riscrive `dati.json` in chiaro; `migra-dati.mjs` lo cifra in `dati.cifrati.json`.
Servono solo per ricostruire tutto da capo: **sovrascrivono le letture inserite dai
condomini**, che dagli Excel non risultano. Nell'uso normale la fonte di verità è il
file cifrato, che il servizio aggiorna a ogni inserimento.

Entrambi gli script restano fuori da git: contengono i cognomi in chiaro.

## Soglie di attenzione

| Dove | Soglia |
|---|---|
| Contatore generale | oltre 1,7 mc/giorno giallo, oltre 3 rosso |
| Singola utenza | soglia propria, fra 0,5 e 0,7 mc/giorno |
| Parte comune sul totale | oltre il 35% rosso |

La parte comune (differenza fra contatore generale e somma degli individuali) viene
calcolata **solo fra due date in cui tutti e quattro i contatori sono stati letti**.
Confrontare periodi di lunghezza diversa darebbe un numero privo di significato.
