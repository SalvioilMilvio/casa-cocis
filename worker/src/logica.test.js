import test from 'node:test';
import assert from 'node:assert/strict';
import { allarme, contatorePermesso, controlla, inserisci } from './logica.js';

const dati = () => ({
  meta: { aggiornato: '2026-10-03' },
  utenti: [{ id: 'u1', nome: 'B.' }],
  generale: [{ data: '2026-10-01', lettura: 2339, contatore: 'nuovo' }],
  individuali: { u1: [{ data: '2026-09-02', lettura: 9737 }, { data: '2026-10-03', lettura: 9764 }] },
});
const OGGI = '2026-11-02';

test('il token vale solo per il suo contatore', () => {
  const t = { a: 'u1', z: '*' };
  assert.equal(contatorePermesso(t, 'a'), 'u1');
  assert.equal(contatorePermesso(t, 'a', 'u1'), 'u1');
  assert.equal(contatorePermesso(t, 'a', 'u2'), null);
  assert.equal(contatorePermesso(t, 'b'), null);
  assert.equal(contatorePermesso(t, 'constructor'), null);
  assert.equal(contatorePermesso(t, 'z', 'u2'), 'u2');
});

test('una lettura normale passa', () => {
  assert.deepEqual(controlla(dati(), 'generale', OGGI, 2394, OGGI), {});
  assert.deepEqual(controlla(dati(), 'u1', OGGI, 9790, OGGI), {});
});

test('blocca letture impossibili', () => {
  assert.ok(controlla(dati(), 'u1', OGGI, 9700, OGGI).errore);
  assert.ok(controlla(dati(), 'u1', '2027-01-01', 9790, OGGI).errore);
  assert.ok(controlla(dati(), 'u1', OGGI, 97.5, OGGI).errore);
  assert.ok(controlla(dati(), 'u2', OGGI, 1, OGGI).errore);
  assert.ok(controlla(dati(), 'u1', '2026-09-20', 9800, OGGI).errore);
});

test('un salto enorme chiede conferma', () => {
  assert.ok(controlla(dati(), 'u1', OGGI, 19764, OGGI).avviso);
});

test('gli allarmi seguono le soglie del modello Excel', () => {
  const d = dati();
  d.meta.soglie = { generale_giallo: 1.7, generale_rosso: 3, individuale_rosso: { u1: .7, u2: .5 } };
  assert.equal(allarme(d, 'generale', '2026-10-11', 2356, OGGI).livello, 'ok');
  assert.equal(allarme(d, 'generale', '2026-11-02', 2394, OGGI).livello, 'warn');
  assert.equal(allarme(d, 'generale', '2026-10-11', 2369, OGGI).livello, 'bad');
  assert.equal(allarme(d, 'u1', '2026-10-13', 9770, OGGI).livello, 'ok');
  assert.equal(allarme(d, 'u1', '2026-10-13', 9772, OGGI).livello, 'bad');
});

test('inserisce in ordine e corregge lo stesso giorno', () => {
  let d = inserisci(dati(), 'u1', '2026-09-20', 9750, OGGI);
  assert.deepEqual(d.individuali.u1.map(r => r.lettura), [9737, 9750, 9764]);
  d = inserisci(d, 'u1', '2026-09-20', 9751, OGGI);
  assert.equal(d.individuali.u1[1].lettura, 9751);
  assert.equal(d.individuali.u1.length, 3);
  assert.equal(d.meta.aggiornato, OGGI);
  d = inserisci(d, 'generale', OGGI, 2394, OGGI);
  assert.deepEqual(d.generale.at(-1), { data: OGGI, lettura: 2394, contatore: 'nuovo' });
});
