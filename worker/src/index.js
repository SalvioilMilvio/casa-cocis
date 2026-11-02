/* Servizio delle letture: legge la foto del contatore e salva su dati.json.
   Sta qui e non nella pagina perché le chiavi non possono stare su un sito pubblico.
   Segreti: ANTHROPIC_API_KEY, GITHUB_TOKEN, TOKENS (JSON { "<token>": "u1" | "generale" | "*" }). */

import Anthropic from '@anthropic-ai/sdk';
import { allarme, contatorePermesso, controlla, inserisci, nomeDi, serieDi } from './logica.js';

const REPO = 'SalvioilMilvio/casa-cocis';
const ORIGINE = 'https://salvioilmilvio.github.io';
const FOTO_MAX = 7_000_000; // caratteri base64: la pagina rimpicciolisce prima di spedire

/* Solo il contatore generale: i rotondi delle case si scrivono a mano. */
const PROMPT = `Foto del contatore generale dell'acqua: display digitale blu WaterTech Sonata.
Leggi la riga grande del display: 002.394,215 significa 2394 metri cubi.
Rispondi con la sola parte intera, senza zeri iniziali e senza i decimali nel riquadro.
Ignora la riga piccola della portata (m3/h), la matricola e il codice a barre.`;

const SCHEMA = {
  type: 'object',
  properties: {
    leggibile: { type: 'boolean' },
    lettura: { type: 'integer' },
    certezza: { type: 'string', enum: ['alta', 'media', 'bassa'] },
    nota: { type: 'string' },
  },
  required: ['leggibile', 'lettura', 'certezza', 'nota'],
  additionalProperties: false,
};

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

async function leggiFoto(env, foto, tipo) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const msg = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: tipo, data: foto } },
        { type: 'text', text: `${PROMPT}
Se non riesci a leggere tutte le cifre metti leggibile a false e lettura a 0: non tirare a indovinare.
In nota spiega in una frase breve, in italiano, cosa ti ha reso incerto.` },
      ],
    }],
  });
  if (msg.stop_reason !== 'end_turn') throw new Error(`Risposta incompleta: ${msg.stop_reason}`);
  return JSON.parse(msg.content.find(b => b.type === 'text').text);
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
      if (azione === '/leggi') {
        if (contatore !== 'generale') return risposta({ errore: 'La foto vale solo per il contatore generale.' }, 422);
        if (typeof c.foto !== 'string' || c.foto.length > FOTO_MAX) return risposta({ errore: 'Foto mancante o troppo grande.' }, 413);
        return risposta(await leggiFoto(env, c.foto, 'image/jpeg'));
      }
      if (azione === '/salva') return await salva(env, contatore, c.data, c.lettura, c.conferma === true, oggi);
      return risposta({ errore: 'Indirizzo sconosciuto.' }, 404);
    } catch (e) {
      console.error(e);
      return risposta({ errore: 'Il servizio ha avuto un problema: riprova o scrivi il numero a mano.' }, 502);
    }
  },
};
