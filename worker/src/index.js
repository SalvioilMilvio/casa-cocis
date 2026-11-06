/* Servizio delle letture del condominio Cocis.

   Nel repository, che e' pubblico, i dati stanno solo cifrati (dati.cifrati.json).
   La chiave vive qui fra i segreti: senza passare da questo servizio quel file
   non dice niente, nemmeno i cognomi dei condomini.

   Due modi di entrare, per due cose diverse:
     - i link personali (token) servono a inserire una lettura;
     - la password serve a leggere la pagina.

   Segreti: GITHUB_TOKEN, TOKENS (JSON { "<token>": "u1" | "generale" | "*" }),
            CHIAVE (32 byte in base64), PASSWORD. */

import { allarme, contatorePermesso, controlla, inserisci, nomeDi, serieDi } from './logica.js';

const REPO = 'SalvioilMilvio/casa-cocis';
const FILE = 'dati.cifrati.json';
const ORIGINE = 'https://salvioilmilvio.github.io';

const cors = {
  'Access-Control-Allow-Origin': ORIGINE,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const risposta = (corpo, stato = 200) => new Response(JSON.stringify(corpo), {
  status: stato, headers: { 'Content-Type': 'application/json', ...cors },
});

const daBase64 = s => Uint8Array.from(atob(String(s).replace(/\n/g, '')), c => c.charCodeAt(0));

function aBase64(byte) {
  let s = '';
  for (let i = 0; i < byte.length; i += 8192) s += String.fromCharCode(...byte.subarray(i, i + 8192));
  return btoa(s);
}

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

const chiaveDi = env => crypto.subtle.importKey(
  'raw', daBase64(env.CHIAVE), 'AES-GCM', false, ['encrypt', 'decrypt']);

async function leggiDati(env) {
  const r = await github(env, `contents/${FILE}`);
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  const f = await r.json();
  const busta = JSON.parse(new TextDecoder().decode(daBase64(f.content)));
  const chiaro = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: daBase64(busta.iv) }, await chiaveDi(env), daBase64(busta.dati));
  return { dati: JSON.parse(new TextDecoder().decode(chiaro)), sha: f.sha };
}

async function cifra(env, dati) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const corpo = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, await chiaveDi(env), new TextEncoder().encode(JSON.stringify(dati)));
  const busta = {
    nota: 'AES-256-GCM. La chiave sta solo fra i segreti del servizio delle letture.',
    iv: aBase64(iv),
    dati: aBase64(new Uint8Array(corpo)),
  };
  return aBase64(new TextEncoder().encode(JSON.stringify(busta, null, 1) + '\n'));
}

/* Confronto a tempo costante: non deve far capire quante lettere sono giuste. */
async function passwordGiusta(env, data) {
  const digest = async t => new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(t))));
  const [a, b] = await Promise.all([digest(data), digest(env.PASSWORD ?? '')]);
  let diverso = 0;
  for (let i = 0; i < a.length; i++) diverso |= a[i] ^ b[i];
  return diverso === 0;
}

async function salva(env, contatore, data, lettura, conferma, oggi) {
  for (let prova = 0; prova < 3; prova++) {
    const { dati, sha } = await leggiDati(env);
    const esito = controlla(dati, contatore, data, lettura, oggi);
    if (esito.errore) return risposta({ errore: esito.errore }, 422);
    if (esito.avviso && !conferma) return risposta({ avviso: esito.avviso });

    const stato = allarme(dati, contatore, data, lettura);
    inserisci(dati, contatore, data, lettura, oggi);
    const r = await github(env, `contents/${FILE}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Lettura ${contatore} del ${data}: ${lettura} mc`,
        content: await cifra(env, dati),
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

    const azione = new URL(req.url).pathname;
    const oggi = new Date().toISOString().slice(0, 10);

    try {
      // La pagina: una password, tutti i dati.
      if (azione === '/dati') {
        if (!await passwordGiusta(env, c.password)) {
          await new Promise(r => setTimeout(r, 400));   // scoraggia i tentativi a raffica
          return risposta({ errore: 'Password sbagliata.' }, 403);
        }
        const { dati } = await leggiDati(env);
        return risposta({ dati });
      }

      // I link personali: un contatore a testa, per inserire le letture.
      const contatore = contatorePermesso(JSON.parse(env.TOKENS), String(c.token ?? ''), c.contatore);
      if (!contatore) return risposta({ errore: 'Link non valido.' }, 403);

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
