/* Regole sulle letture, senza rete: si provano con `node --test`. */

const MC_GIORNO_MAX = { generale: 30, individuale: 10 };
const giorniTra = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function serieDi(dati, contatore) {
  return contatore === 'generale' ? dati.generale : dati.individuali[contatore];
}

export function nomeDi(dati, contatore) {
  if (contatore === 'generale') return 'Contatore generale';
  return dati.utenti.find(u => u.id === contatore)?.nome ?? null;
}

/* Il token vale per un solo contatore, oppure per tutti con "*". */
export function contatorePermesso(tokens, token, chiesto) {
  const quale = Object.hasOwn(tokens, token) ? tokens[token] : null;
  if (!quale) return null;
  if (quale === '*') return chiesto || 'generale';
  return !chiesto || chiesto === quale ? quale : null;
}

/* Controlla una lettura. `errore` la blocca, `avviso` chiede una conferma in più. */
export function controlla(dati, contatore, data, lettura, oggi) {
  const serie = serieDi(dati, contatore);
  if (!serie) return { errore: 'Contatore sconosciuto.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data))) return { errore: 'Data non valida.' };
  if (data > oggi) return { errore: 'La data è nel futuro.' };
  if (!Number.isInteger(lettura) || lettura < 0) return { errore: 'La lettura deve essere un numero intero di metri cubi.' };

  const prima = serie.filter(r => r.data < data).at(-1);
  const dopo = serie.find(r => r.data > data);
  if (dopo && lettura > dopo.lettura) {
    return { errore: `È più alta della lettura successiva (${dopo.lettura} del ${dopo.data}).` };
  }
  if (!prima) return {};
  if (lettura < prima.lettura) {
    return { errore: `È più bassa della lettura precedente (${prima.lettura} del ${prima.data}).` };
  }
  const gg = Math.max(1, giorniTra(prima.data, data));
  const max = MC_GIORNO_MAX[contatore === 'generale' ? 'generale' : 'individuale'];
  if ((lettura - prima.lettura) / gg > max) {
    return { avviso: `Sarebbero ${lettura - prima.lettura} mc in ${gg} giorni: è un valore molto alto.` };
  }
  return {};
}

/* Inserisce in ordine di data; se quel giorno c'è già una lettura, la corregge. */
export function inserisci(dati, contatore, data, lettura, oggi) {
  const serie = serieDi(dati, contatore);
  const voce = { data, lettura };
  if (contatore === 'generale') voce.contatore = 'nuovo';
  const i = serie.findIndex(r => r.data >= data);
  if (i === -1) serie.push(voce);
  else if (serie[i].data === data) serie[i] = voce;
  else serie.splice(i, 0, voce);
  dati.meta.aggiornato = oggi;
  return dati;
}
