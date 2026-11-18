import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const entrada = process.argv[2];
const saida = resolve(process.argv[3] ?? 'src/app/core/data/taco.json');
if (!entrada) {
  console.error('Uso: node scripts/converter-taco.mjs <pdf-da-TACO> [saida.json]');
  process.exit(1);
}

const bytes = readFileSync(entrada);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, verbosity: 0 }).promise;

const COLUNAS = ['kcal', 'proteina', 'gordura', 'carboidrato'];
const TOLERANCIA_LINHA = 4;
const LIMITE_NOME = 300;
const TOTAL_ESPERADO = 597;

const centro = (i) => i.transform[5] + i.width / 2;
const lerNumero = (texto) => {
  const t = texto.trim();
  if (t === 'Tr' || t === 'NA') return { valor: 0, regra: t };
  if (t === '*') return { valor: null, regra: '*' };
  if (/^\d+(,\d+)?$/.test(t)) return { valor: Number(t.replace(',', '.')), regra: null };
  throw new Error(`Valor inesperado na tabela: "${texto}"`);
};

const juntar = (pedacos) =>
  pedacos
    .sort((a, b) => a.transform[5] - b.transform[5])
    .reduce((acc, i, idx, todos) => {
      const anterior = todos[idx - 1];
      const folga = anterior ? i.transform[5] - (anterior.transform[5] + anterior.width) : 0;
      return acc + (folga > 0.5 && !acc.endsWith(' ') && !i.str.startsWith(' ') ? ' ' : '') + i.str;
    }, '')
    .replace(/\s+/g, ' ')
    .trim();

const itens = [];
const numerosLidos = [];
const contagemRegras = { Tr: 0, NA: 0 };
const semValor = [];
let grupoAtual = null;
let paginasUsadas = 0;

for (let p = 1; p <= pdf.numPages; p++) {
  const tc = await (await pdf.getPage(p)).getTextContent();
  const textos = tc.items.filter((i) => i.str.trim());
  const cab = textos.filter((i) => i.transform[4] > 60 && i.transform[4] < 150);
  const achar = (rotulo) => cab.find((i) => i.str.trim() === rotulo);
  const kcal = achar('(kcal)');
  const kj = achar('(kJ)');
  const prot = achar('Proteína');
  const lip = achar('Lipídeos');
  const carbo = achar('idrato');
  const nomeCol = achar('Descrição dos alimentos');
  const numCol = achar('Número do');
  if (!(kcal && kj && prot && lip && carbo && nomeCol && numCol)) continue;
  paginasUsadas++;

  const colunas = {
    kcal: centro(kcal),
    proteina: centro(prot),
    gordura: centro(lip),
    carboidrato: centro(carbo),
  };
  const centroKj = centro(kj);

  const corpo = textos.filter((i) => i.transform[4] > 150).sort((a, b) => a.transform[4] - b.transform[4]);
  const linhas = [];
  for (const i of corpo) {
    const x = i.transform[4];
    const ultima = linhas[linhas.length - 1];
    if (ultima && Math.abs(x - ultima.x) <= TOLERANCIA_LINHA) ultima.itens.push(i);
    else linhas.push({ x, itens: [i] });
  }

  for (const linha of linhas) {
    const numero = linha.itens.find((i) => i.transform[5] < nomeCol.transform[5] - 5 && /^\d+$/.test(i.str.trim()));
    const nome = juntar(linha.itens
      .filter((i) => i.transform[5] >= nomeCol.transform[5] - 5 && i.transform[5] < LIMITE_NOME && i.height >= 6));
    if (!numero) {
      const titulo = juntar(linha.itens);
      if (/[A-Za-zÀ-ú]/.test(titulo)) grupoAtual = titulo;
      continue;
    }
    numerosLidos.push(Number(numero.str));
    const celulas = linha.itens.filter((i) => i.transform[5] >= LIMITE_NOME);
    const valores = {};
    for (const c of celulas) {
      const alvo = Object.entries(colunas).sort((a, b) => Math.abs(a[1] - centro(c)) - Math.abs(b[1] - centro(c)))[0];
      const proximidade = Math.abs(alvo[1] - centro(c));
      const ehKj = Math.abs(centroKj - centro(c)) < proximidade;
      if (ehKj || proximidade > 12) continue;
      if (valores[alvo[0]] !== undefined) throw new Error(`Coluna ${alvo[0]} duplicada no alimento ${numero.str}`);
      const { valor, regra } = lerNumero(c.str);
      if (regra === 'Tr' || regra === 'NA') contagemRegras[regra]++;
      valores[alvo[0]] = valor;
    }
    for (const col of COLUNAS) {
      if (valores[col] === undefined) valores[col] = null;
    }
    if (COLUNAS.some((col) => valores[col] === null)) {
      semValor.push(`${numero.str.trim()} ${nome} [${COLUNAS.filter((col) => valores[col] === null).join(',')}]`);
      continue;
    }
    itens.push({
      id: `taco-${numero.str.trim().padStart(3, '0')}`,
      nome,
      grupo: grupoAtual,
      kcal: valores.kcal,
      carboidrato: valores.carboidrato,
      proteina: valores.proteina,
      gordura: valores.gordura,
      origem: 'TACO',
    });
  }
}

numerosLidos.forEach((n, idx) => {
  if (n !== idx + 1) throw new Error(`Numeração fora de ordem na posição ${idx + 1}: veio ${n}`);
});
if (numerosLidos.length !== TOTAL_ESPERADO) {
  throw new Error(`Esperava ${TOTAL_ESPERADO} alimentos, li ${numerosLidos.length}`);
}
const semGrupo = itens.filter((a) => !a.grupo || !a.nome);
if (semGrupo.length) throw new Error(`Itens sem nome ou grupo: ${semGrupo.map((a) => a.id).join(', ')}`);

writeFileSync(saida, JSON.stringify(itens, null, 2) + '\n');

const grupos = [...new Set(itens.map((a) => a.grupo))];
console.log(`PDF: ${entrada}`);
console.log(`SHA-256: ${sha256}`);
console.log(`Páginas de macros lidas: ${paginasUsadas}`);
console.log(`Alimentos lidos na Tabela 1: ${numerosLidos.length}`);
console.log(`Excluídos por "*" ou célula em branco (${semValor.length}): ${semValor.join('; ')}`);
console.log(`Total de itens gravados: ${itens.length}`);
console.log(`Grupos (${grupos.length}): ${grupos.join(' | ')}`);
console.log(`Valores convertidos para 0: Tr=${contagemRegras.Tr}, NA=${contagemRegras.NA}`);
console.log(`Gravado em: ${saida}`);
