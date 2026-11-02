/* Acqua — Condominio Cocis.
   Tutto si calcola qui dalle letture: in dati.json non c'è nessun totale. */

const IT = 'it-IT';
// useGrouping esplicito: in italiano i numeri di quattro cifre altrimenti
// restano senza punto delle migliaia ("1181,00" invece di "1.181,00").
const n0 = v => Number(v).toLocaleString(IT, { maximumFractionDigits: 0, useGrouping: true });
const n2 = v => Number(v).toLocaleString(IT, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
const eur = v => '€ ' + n2(v);
const pct = v => (v * 100).toLocaleString(IT, { maximumFractionDigits: 1 }) + '%';
const D = s => new Date(s + 'T00:00:00');
const giorniTra = (a, b) => Math.round((D(b) - D(a)) / 86400000);
const dataIT = s => D(s).toLocaleDateString(IT, { day: '2-digit', month: '2-digit', year: 'numeric' });
const meseIT = s => D(s).toLocaleDateString(IT, { month: 'short', year: '2-digit' }).replace('.', '');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let S = null; // soglie

/* Da una serie di letture ricava i periodi fra una lettura e la successiva. */
function periodi(serie) {
  const out = [];
  for (let i = 1; i < serie.length; i++) {
    const a = serie[i - 1], b = serie[i];
    const gg = giorniTra(a.data, b.data);
    if (gg <= 0) continue;
    const mc = b.lettura - a.lettura;
    out.push({ dal: a.data, al: b.data, giorni: gg, mc, mcg: mc / gg });
  }
  return out;
}

const classeGen = v => v > S.generale_rosso ? 'bad' : v > S.generale_giallo ? 'warn' : 'ok';
const classeInd = v => v > S.individuale_rosso ? 'bad' : 'ok';

/* ------------------------------------------------------------------ grafici */

function istogramma(per, opt) {
  if (!per.length) return '';
  const W = 760, H = 240, L = 34, R = 8, T = 12, B = 34;
  const iw = W - L - R, ih = H - T - B;
  const max = Math.max(...per.map(p => p.mcg), S.generale_rosso * 1.15);
  const y = v => T + ih - (v / max) * ih;
  const bw = iw / per.length;
  const col = { ok: 'var(--acqua)', warn: 'var(--warn)', bad: 'var(--bad)' };

  let g = '';
  for (let v = 0; v <= max; v += 1) {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"
           stroke="var(--line)" stroke-width="1"/>
          <text x="${L - 7}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end"
           font-size="11" fill="var(--mut)">${v}</text>`;
  }
  for (const s of [S.generale_giallo, S.generale_rosso]) {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(s).toFixed(1)}" y2="${y(s).toFixed(1)}"
           stroke="${s === S.generale_rosso ? 'var(--bad)' : 'var(--warn)'}"
           stroke-width="1.5" stroke-dasharray="5 4" opacity=".75"/>`;
  }

  let b = '', x = '', ultimaEtich = '';
  const passo = Math.max(1, Math.ceil(per.length / 7));
  per.forEach((p, i) => {
    const px = L + i * bw, h = Math.max(1, T + ih - y(p.mcg));
    b += `<rect x="${(px + bw * .14).toFixed(1)}" y="${y(p.mcg).toFixed(1)}"
            width="${(bw * .72).toFixed(1)}" height="${h.toFixed(1)}" rx="2"
            fill="${col[classeGen(p.mcg)]}"><title>${dataIT(p.dal)} → ${dataIT(p.al)}
${n0(p.mc)} mc in ${p.giorni} giorni — ${n2(p.mcg)} mc/giorno</title></rect>`;
    const et = meseIT(p.al);
    if ((i % passo === 0 || i === per.length - 1) && et !== ultimaEtich) {
      ultimaEtich = et;
      x += `<text x="${(px + bw / 2).toFixed(1)}" y="${H - 12}" text-anchor="middle"
              font-size="11" fill="var(--mut)">${et}</text>`;
    }
  });

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"
    aria-label="${opt.alt}">${g}${b}${x}</svg>
    <div class="legend">
      <span><i style="background:var(--acqua)"></i>fino a ${n0(S.generale_giallo)} mc/giorno</span>
      <span><i style="background:var(--warn)"></i>oltre ${n0(S.generale_giallo)}</span>
      <span><i style="background:var(--bad)"></i>oltre ${n0(S.generale_rosso)}</span>
    </div>`;
}

function spark(per) {
  const ult = per.slice(-9);
  if (ult.length < 2) return '';
  const W = 240, H = 38, P = 3;
  const max = Math.max(...ult.map(p => p.mcg), S.individuale_rosso * 1.3);
  const px = i => P + (i / (ult.length - 1)) * (W - 2 * P);
  const py = v => H - P - (v / max) * (H - 2 * P);
  const pts = ult.map((p, i) => `${px(i).toFixed(1)},${py(p.mcg).toFixed(1)}`).join(' ');
  const last = ult[ult.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <line x1="${P}" x2="${W - P}" y1="${py(S.individuale_rosso).toFixed(1)}"
      y2="${py(S.individuale_rosso).toFixed(1)}" stroke="var(--bad)" stroke-width="1"
      stroke-dasharray="4 3" opacity=".55"/>
    <polyline points="${pts}" fill="none" stroke="var(--blu2)" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${px(ult.length - 1).toFixed(1)}" cy="${py(last.mcg).toFixed(1)}" r="3.2"
      fill="${last.mcg > S.individuale_rosso ? 'var(--bad)' : 'var(--blu2)'}"/>
  </svg>`;
}

/* ------------------------------------------------------------- ripartizione */

function ripartizione(b, utenti) {
  const righe = utenti
    .filter(u => b.letture[u.id])
    .map(u => ({ nome: u.nome, mc: b.letture[u.id].mc }));
  const tot = righe.reduce((s, r) => s + r.mc, 0);
  righe.forEach(r => {
    r.quota = tot ? r.mc / tot : 0;
    r.importo = b.importo * r.quota;
  });
  return { righe, tot, comune: b.mc - tot };
}

/* ----------------------------------------------------------------- sezioni */

function sezStato(d, genNuovo, perGen, ultimoGiro) {
  const ul = genNuovo[genNuovo.length - 1];
  const up = perGen[perGen.length - 1];
  const cl = classeGen(up.mcg);
  const etich = { ok: 'nella norma', warn: 'sopra la soglia', bad: 'alto' }[cl];
  const bol = d.bollette[0];

  let avvisi = '';
  const g = ultimoGiro;
  if (g) {
    const q = g.comune / g.genMc;
    const dove = `dal ${dataIT(g.dal)} al ${dataIT(g.al)}, ultimo periodo in cui
      tutti e quattro i contatori sono stati letti lo stesso giorno`;
    if (g.comune < 0) {
      avvisi += `<div class="msg bad"><b>I conti non tornano.</b> ${dove.replace(/^dal/, 'Dal')}:
        i quattro contatori segnano ${n0(g.tot)} mc contro i ${n0(g.genMc)} del generale,
        cioè più dell'intero. Qualche lettura è sbagliata.</div>`;
    } else if (q > .35) {
      avvisi += `<div class="msg bad"><b>Parte comune al ${pct(q)}.</b> Oltre un terzo
        dell'acqua non passa dai contatori individuali — ${dove}.</div>`;
    } else {
      avvisi += `<div class="msg ok"><b>Parte comune al ${pct(q)}</b>
        (${n0(g.comune)} mc su ${n0(g.genMc)}), ${dove}.</div>`;
    }
    if (g.spaiate.length) {
      const chi = g.spaiate.map(s => `${esc(s.nome)} il ${dataIT(s.data)}`).join(', ');
      avvisi += `<div class="msg warn"><b>Letture più recenti non allineate.</b> Dopo il
        ${dataIT(g.al)} i contatori sono stati letti in giorni diversi (${chi}), così la parte
        comune del periodo in corso non è calcolabile. Per il prossimo conguaglio vanno letti
        tutti e quattro lo stesso giorno.</div>`;
    }
  }

  return `<section id="stato">
    <h2>Stato attuale</h2>
    <div class="kpis">
      <div class="kpi">
        <div class="lab">Ultima lettura</div>
        <div class="val">${n0(ul.lettura)} <small>mc</small></div>
        <div class="hint">${dataIT(ul.data)}</div>
      </div>
      <div class="kpi ${cl}">
        <div class="lab">Consumo attuale</div>
        <div class="val">${n2(up.mcg)} <small>mc/giorno</small></div>
        <div class="hint">${n0(up.mc)} mc in ${up.giorni} giorni · ${etich}</div>
      </div>
      <div class="kpi">
        <div class="lab">Ultima bolletta</div>
        <div class="val">${eur(bol.importo)}</div>
        <div class="hint">${bol.etichetta} · ${n0(bol.mc)} mc a ${n2(bol.eur_mc)} €/mc</div>
      </div>
      <div class="kpi">
        <div class="lab">Spesa al giorno</div>
        <div class="val">${n2(up.mcg * bol.eur_mc)} <small>€</small></div>
        <div class="hint">al ritmo attuale, tariffa dell'ultima bolletta</div>
      </div>
    </div>
    ${avvisi ? `<div style="margin-top:12px">${avvisi}</div>` : ''}
  </section>`;
}

function sezAndamento(perGen, note) {
  const righe = note.map(nt => `<li>${dataIT(nt.data)} — ${esc(nt.testo)}</li>`).join('');
  return `<section id="andamento">
    <h2>Andamento del contatore generale</h2>
    <div class="card pad">
      ${istogramma(perGen, { alt: 'Consumo giornaliero del contatore generale' })}
      <p class="hint" style="font-size:13px;color:var(--mut);margin:12px 0 0">
        Ogni barra è un periodo fra due letture. Le linee tratteggiate sono le soglie di
        attenzione: ${n0(S.generale_giallo)} e ${n0(S.generale_rosso)} mc al giorno.</p>
    </div>
    ${righe ? `<details style="margin-top:12px"><summary>Interventi e note</summary>
      <div class="inner"><ul style="margin:8px 0;padding-left:20px;color:var(--mut);font-size:14px">
      ${righe}</ul></div></details>` : ''}
  </section>`;
}

function sezUtenti(d) {
  const cards = d.utenti.map(u => {
    const serie = d.individuali[u.id] || [];
    const per = periodi(serie);
    if (!per.length) return '';
    const p = per[per.length - 1];
    const ul = serie[serie.length - 1];
    const cl = classeInd(p.mcg);
    return `<div class="user">
      <h3>${esc(u.nome)} <span class="tag ${cl}">${n2(p.mcg)} mc/g</span></h3>
      <div class="big">${n0(p.mc)} <small>mc nell'ultimo periodo</small></div>
      <div class="meta">${dataIT(p.dal)} → ${dataIT(p.al)} · ${p.giorni} giorni</div>
      <div class="meta">lettura ${n0(ul.lettura)} del ${dataIT(ul.data)}</div>
      ${spark(per)}
    </div>`;
  }).join('');

  return `<section id="utenti">
    <h2>Utenze</h2>
    <div class="users">${cards}</div>
    <p style="font-size:13px;color:var(--mut);margin:10px 2px 0">
      Il grafico mostra gli ultimi periodi in mc al giorno; la linea tratteggiata è la soglia
      di attenzione a ${n2(S.individuale_rosso)} mc al giorno.</p>
  </section>`;
}

function sezBollette(d) {
  const carte = d.bollette.map(b => {
    const r = ripartizione(b, d.utenti);
    const righe = r.righe.map(x => `<tr>
        <td>${esc(x.nome)}</td>
        <td>${n0(x.mc)}</td>
        <td>${pct(x.quota)}</td>
        <td><b>${eur(x.importo)}</b></td>
      </tr>`).join('');
    const somma = r.righe.reduce((s, x) => s + x.importo, 0);
    const quadra = Math.abs(somma - b.importo) < 0.01;
    return `<div class="card bill">
      <div class="head">
        <h3>${esc(b.etichetta)}</h3>
        <span class="eur">${eur(b.importo)}</span>
        <span class="per">${dataIT(b.periodo.dal)} → ${dataIT(b.periodo.al)} ·
          ${n0(b.mc)} mc fatturati · ${n2(b.eur_mc)} €/mc</span>
      </div>
      <div class="scroll"><table>
        <thead><tr><th>Utenza</th><th>mc</th><th>quota</th><th>da pagare</th></tr></thead>
        <tbody>${righe}
          <tr class="tot"><td>Totale</td><td>${n0(r.tot)}</td><td>100%</td>
            <td>${eur(somma)}</td></tr>
        </tbody>
      </table></div>
      <div class="foot">
        ${quadra ? '✓ La somma coincide con l\'importo della bolletta.'
                 : '⚠ La somma non coincide con l\'importo della bolletta.'}
        ${r.comune >= 0
          ? `Parte comune e perdite: ${n0(r.comune)} mc, ripartiti in proporzione ai consumi.`
          : `Attenzione: i contatori individuali segnano ${n0(-r.comune)} mc in più
             di quelli fatturati, segno che le letture non erano dello stesso giorno.`}
      </div>
    </div>`;
  }).join('');

  const dub = (d.bollette_da_verificare || []).map(b => `<tr>
      <td>${esc(b.etichetta)}</td><td>${eur(b.importo)}</td><td>${n0(b.mc)}</td>
      <td class="rosso">${n2(b.eur_mc)}</td></tr>`).join('');

  return `<section id="bollette">
    <h2>Bollette</h2>
    ${carte}
    ${dub ? `<details><summary>Bollette più vecchie, da verificare (${d.bollette_da_verificare.length})</summary>
      <div class="inner">
        <p style="font-size:14px;color:var(--mut)">Nei vecchi fogli di calcolo importo e metri cubi
        non sono coerenti fra loro: ne esce un prezzo al metro cubo fuori scala rispetto ai
        ~3 €/mc delle bollette controllate. Finché non si recuperano le bollette cartacee questi
        numeri non sono affidabili e restano fuori dai conti.</p>
        <div class="scroll"><table>
          <thead><tr><th>Periodo</th><th>importo</th><th>mc</th><th>€/mc</th></tr></thead>
          <tbody>${dub}</tbody>
        </table></div>
      </div></details>` : ''}
  </section>`;
}

function sezStorico(d, perGen, genVecchio) {
  const righe = [...perGen].reverse().map(p => {
    const cl = classeGen(p.mcg);
    return `<tr><td>${dataIT(p.al)}</td><td>${n0(p.mc)}</td><td>${p.giorni}</td>
      <td class="${cl === 'ok' ? '' : cl === 'warn' ? 'giallo' : 'rosso'}">${n2(p.mcg)}</td></tr>`;
  }).join('');

  const letture = d.utenti.map(u => {
    const s = d.individuali[u.id] || [];
    return `<th>${esc(u.nome)}</th>`;
  }).join('');
  const date = [...new Set(d.utenti.flatMap(u => (d.individuali[u.id] || []).map(x => x.data)))]
    .sort().reverse().slice(0, 24);
  const corpo = date.map(dt => {
    const celle = d.utenti.map(u => {
      const v = (d.individuali[u.id] || []).find(x => x.data === dt);
      return `<td>${v ? n0(v.lettura) : '—'}</td>`;
    }).join('');
    return `<tr><td>${dataIT(dt)}</td>${celle}</tr>`;
  }).join('');

  return `<section id="storico">
    <h2>Storico</h2>
    <details>
      <summary>Contatore generale — ${perGen.length} periodi</summary>
      <div class="inner"><div class="scroll"><table>
        <thead><tr><th>Lettura del</th><th>mc</th><th>giorni</th><th>mc/giorno</th></tr></thead>
        <tbody>${righe}</tbody></table></div>
        <p style="font-size:13px;color:var(--mut)">Il contatore è stato sostituito nel 2024:
        qui c'è solo la serie nuova. Del precedente restano ${genVecchio.length} letture,
        dal 2017 al 2024.</p>
      </div>
    </details>
    <details style="margin-top:12px">
      <summary>Letture dei contatori individuali — ultime ${date.length} date</summary>
      <div class="inner"><div class="scroll"><table>
        <thead><tr><th>Data</th>${letture}</tr></thead>
        <tbody>${corpo}</tbody></table></div>
        <p style="font-size:13px;color:var(--mut)">Un trattino vuol dire che quel contatore
        non è stato letto in quella data.</p>
      </div>
    </details>
  </section>`;
}

/* -------------------------------------------------------------------- avvio */

/* Un "giro completo" è una data in cui tutti e quattro i contatori sono stati letti.
   La parte comune ha senso solo fra due giri completi: confrontare periodi di
   lunghezza diversa darebbe un numero senza significato. */
function giriCompleti(d) {
  const ids = d.utenti.map(u => u.id);
  const perData = {};
  ids.forEach(id => (d.individuali[id] || []).forEach(x => {
    (perData[x.data] = perData[x.data] || {})[id] = x.lettura;
  }));
  return Object.keys(perData)
    .filter(dt => ids.every(id => perData[dt][id] !== undefined))
    .sort()
    .map(dt => ({ data: dt, letture: perData[dt] }));
}

function ultimoConfronto(d, genNuovo) {
  const giri = giriCompleti(d);
  if (giri.length < 2) return null;
  const a = giri[giri.length - 2], b = giri[giri.length - 1];
  const tot = d.utenti.reduce((s, u) => s + (b.letture[u.id] - a.letture[u.id]), 0);
  const ga = genNuovo.find(g => g.data === a.data);
  const gb = genNuovo.find(g => g.data === b.data);
  if (!ga || !gb) return null;
  const genMc = gb.lettura - ga.lettura;

  // Letture individuali più recenti del giro completo: se ci sono, sono spaiate.
  const spaiate = d.utenti.map(u => {
    const dopo = (d.individuali[u.id] || []).filter(x => x.data > b.data);
    return dopo.length ? { nome: u.nome, data: dopo[dopo.length - 1].data } : null;
  }).filter(Boolean);

  return { dal: a.data, al: b.data, tot, genMc, comune: genMc - tot, spaiate };
}

fetch('dati.json', { cache: 'no-store' })
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => {
    S = d.meta.soglie;
    const genNuovo = d.generale.filter(x => x.contatore === 'nuovo');
    const genVecchio = d.generale.filter(x => x.contatore === 'vecchio');
    const perGen = periodi(genNuovo);
    const giro = ultimoConfronto(d, genNuovo);

    document.getElementById('app').innerHTML =
      sezStato(d, genNuovo, perGen, giro) +
      sezAndamento(perGen, d.note) +
      sezUtenti(d) +
      sezBollette(d) +
      sezStorico(d, perGen, genVecchio);

    document.getElementById('aggiornato').textContent = dataIT(d.meta.aggiornato);
    document.title = `Acqua — ${n2(perGen[perGen.length - 1].mcg)} mc/giorno · Cocis`;
  })
  .catch(e => {
    document.getElementById('app').innerHTML =
      `<div class="msg bad" style="margin-top:24px"><b>Non riesco a leggere i dati.</b>
       ${esc(e.message)}</div>`;
  });
