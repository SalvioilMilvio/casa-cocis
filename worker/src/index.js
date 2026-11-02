/* Servizio delle letture: salva su dati.json i numeri scritti a mano nella pagina.
   Sta qui e non nella pagina perché la chiave non può stare su un sito pubblico.
   Segreti: GITHUB_TOKEN, TOKENS (JSON { "<token>": "u1" | "generale" | "*" }). */

import { allarme, contatorePermesso, controlla, inserisci, nomeDi, serieDi } from './logica.js';

const REPO = 'SalvioilMilvio/casa-cocis';
const ORIGINE = 'https://salvioilmilvio.github.io';

const cors = {
  'Access-Control-Allow-Origin': ORIGINE,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const risposta = (corpo, stato = 200) => new Response(JSON.stringify(corpo), {
  status: stato, headers: { 'Content-Type': 'application/json', ...cors },
});

async function github(env, percorso, opzioni = {}) {
  return fetch(`https://api.github.com/repos/${REPO}/${percorso}`, {
    ...opzioni,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'casa-cocis-letture',
    },
  });
}

async function leggiDati(env) {
  const r = await github(env, 'contents/dati.json');
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  const f = await r.json();
  const byte = Uint8Array.from(atob(f.content.replace(/\n/g, '')), c => c.charCodeAt(0));
  return { dati: JSON.parse(new TextDecoder().decode(byte)), sha: f.sha };
}

function base64(testo) {
  const byte = new TextEncoder().encode(testo);
  let s = '';
  for (let i = 0; i < byte.length; i += 8192) s += String.fromCharCode(...byte.subarray(i, i + 8192));
  return btoa(s);
}

async function salva(env, contatore, data, lettura, conferma, oggi) {
  for (let prova = 0; prova < 3; prova++) {
    const { dati, sha } = await leggiDati(env);
    const esito = controlla(dati, contatore, data, lettura, oggi);
    if (esito.errore) return risposta({ errore: esito.errore }, 422);
    if (esito.avviso && !conferma) return risposta({ avviso: esito.avviso });

    const stato = allarme(dati, contatore, data, lettura);
    inserisci(dati, contatore, data, lettura, oggi);
    const r = await github(env, 'contents/dati.json', {
      method: 'PUT',
      body: JSON.stringify({
        message: `Lettura ${contatore} del ${data}: ${lettura} mc`,
        content: base64(JSON.stringify(dati, null, 1) + '\n'),
        sha,
      }),
    });
    if (r.ok) return risposta({ salvato: true, allarme: stato });
    if (r.status !== 409) throw new Error(`GitHub ${r.status}`);
  }
  return risposta({ errore: 'Il salvataggio è in conflitto con un altro: riprova.' }, 409);
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return risposta({ errore: 'Metodo non ammesso.' }, 405);

    let c;
    try { c = await req.json(); } catch { return risposta({ errore: 'Richiesta non valida.' }, 400); }
    const contatore = contatorePermesso(JSON.parse(env.TOKENS), String(c.token ?? ''), c.contatore);
    if (!contatore) return risposta({ errore: 'Link non valido.' }, 403);

    const azione = new URL(req.url).pathname;
    const oggi = new Date().toISOString().slice(0, 10);
    try {
      if (azione === '/chi') {
        const { dati } = await leggiDati(env);
        return risposta({
          contatore, nome: nomeDi(dati, contatore), ultima: serieDi(dati, contatore).at(-1),
          tutti: JSON.parse(env.TOKENS)[c.token] === '*'
            ? [{ id: 'generale', nome: 'Contatore generale' }, ...dati.utenti] : null,
        });
      }
      if (azione === '/salva') return await salva(env, contatore, c.data, c.lettura, c.conferma === true, oggi);
      return risposta({ errore: 'Indirizzo sconosciuto.' }, 404);
    } catch (e) {
      console.error(e);
      return risposta({ errore: 'Il servizio ha avuto un problema: riprova.' }, 502);
    }
  },
};
