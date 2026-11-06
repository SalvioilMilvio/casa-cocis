/* Registra il sottodominio workers.dev dell'account usando l'accesso già fatto con wrangler.
   Il token non viene mai stampato. Uso: node sottodominio.mjs <account> <nome> */
import { execSync } from 'node:child_process';

const [conto, nome] = process.argv.slice(2);
const uscita = execSync('npx wrangler auth token --json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const token = JSON.parse(uscita.slice(uscita.indexOf('{'))).token;
const url = `https://api.cloudflare.com/client/v4/accounts/${conto}/workers/subdomain`;
const intestazioni = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const c = await (await fetch(url, { headers: intestazioni })).json();
if (c.result?.subdomain) {
  console.log('Sottodominio già presente:', c.result.subdomain);
} else {
  const r = await (await fetch(url, { method: 'PUT', headers: intestazioni, body: JSON.stringify({ subdomain: nome }) })).json();
  console.log(r.success ? 'Registrato: ' + r.result.subdomain : 'Errore: ' + JSON.stringify(r.errors));
}
