/* Crea i link personali: scrive i token in .tokens.json e i link in link-personali.txt.
   Entrambi i file restano fuori da git. Rilanciarlo invalida i link vecchi. */
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const PAGINA = 'https://salvioilmilvio.github.io/casa-cocis/carica/';
const LINK = [['*', 'Silvio (tutti i contatori)'], ['generale', 'Contatore generale'],
  ['u1', 'B.'], ['u2', 'M.'], ['u3', 'Mt.'], ['u4', 'D.']];

const tokens = {};
const righe = LINK.map(([contatore, nome]) => {
  const t = randomBytes(18).toString('base64url');
  tokens[t] = contatore;
  return `${nome}\n${PAGINA}#t=${t}\n`;
});
writeFileSync('.tokens.json', JSON.stringify(tokens));
writeFileSync('link-personali.txt', righe.join('\n'));
console.log(`Creati ${righe.length} link.`);
