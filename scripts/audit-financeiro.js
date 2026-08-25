#!/usr/bin/env node
/**
 * Auditoria financeira independente do Caixa Klabin, Resumo e Fretes.
 *
 * Este script NÃO importa nenhum código do app (src/**) de propósito: ele
 * reimplementa as regras de negócio a partir da leitura de
 * src/App.tsx, src/utils/storage.ts, src/utils/freightUtils.ts para servir
 * como checagem cruzada verdadeiramente independente, não uma repetição do
 * mesmo caminho de código que já roda em produção.
 *
 * Entrada: um arquivo JSON no formato `KlabinDatabase` (o mesmo formato
 * usado por localStorage['klabin_base_app_database_v1'] e pelos backups
 * exportados pelo app em Configurações > Backup > Exportar JSON).
 *
 * Uso:
 *   node scripts/audit-financeiro.js <arquivo.json> [--assert-saldo=12345.67] [--json-out=relatorio.json]
 *
 * Como obter o arquivo de entrada:
 *   1) No app: Configurações > Backup > Exportar JSON (ou usar um dos
 *      últimos 5 backups automáticos listados lá).
 *   2) Ou, com o DevTools do Electron aberto (Ctrl+Shift+I), no Console:
 *        copy(localStorage.getItem('klabin_base_app_database_v1'))
 *      e colar o conteúdo copiado em um arquivo .json.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const TOLERANCE = 0.01; // R$ 0,01 — diferenças de arredondamento não são reportadas

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { file: null, assertSaldo: null, jsonOut: null };
  for (const raw of argv) {
    if (raw.startsWith('--assert-saldo=')) {
      args.assertSaldo = Number(raw.split('=')[1]);
    } else if (raw.startsWith('--json-out=')) {
      args.jsonOut = raw.split('=')[1];
    } else if (!raw.startsWith('--')) {
      args.file = raw;
    }
  }
  return args;
}

function fail(msg) {
  console.error(`\nERRO: ${msg}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers numéricos
// ---------------------------------------------------------------------------

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round2(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function fmtBRL(v) {
  const sign = v < 0 ? '-' : '';
  return `${sign}R$ ${Math.abs(v).toFixed(2).replace('.', ',')}`;
}

function diverges(a, b, tol = TOLERANCE) {
  return Math.abs(round2(a) - round2(b)) > tol;
}

// ---------------------------------------------------------------------------
// Passo 1 — Carregar o banco bruto
// ---------------------------------------------------------------------------

function loadRawDatabase(filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    fail(`Arquivo não encontrado: ${abs}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    fail(`Não foi possível ler/parsear o JSON: ${err.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('O JSON informado não é um objeto KlabinDatabase válido.');
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Passo 2 — Regras de elegibilidade, espelhando (de forma independente)
// as regras de sanitizeDatabase em src/utils/storage.ts, para sabermos quais
// lançamentos o APP realmente contabiliza no saldo exibido na tela.
// ---------------------------------------------------------------------------

const INVALID_INVOICES = new Set(['XXX', '00', '000', '0000', '00000', 'TEST', 'TESTE']);
const INVALID_SUPPLIERS = new Set(['00', '0', '000', 'TEST', 'TESTE']);

function isAllZeros(s) {
  return /^0+$/.test(s);
}

/** Classifica uma Carga bruta: {accepted: bool, reason?: string} */
function classifyCarga(c) {
  if (!c || typeof c !== 'object') return { accepted: false, reason: 'registro não é um objeto' };

  const product = typeof c.product === 'string' ? c.product.trim() : '';
  const quantityTons = num(c.quantityTons, NaN);
  const valuePerTon = num(c.valuePerTon, NaN);

  if (!product) return { accepted: false, reason: 'produto vazio/ausente' };
  if (!Number.isFinite(quantityTons) || quantityTons <= 0) {
    return { accepted: false, reason: `quantityTons inválido (${c.quantityTons})` };
  }
  if (!Number.isFinite(valuePerTon) || valuePerTon <= 0) {
    return { accepted: false, reason: `valuePerTon inválido (${c.valuePerTon})` };
  }

  const supplierUpper = typeof c.supplier === 'string' ? c.supplier.trim().toUpperCase() : '';
  const invoiceUpper = typeof c.invoiceNumber === 'string' ? c.invoiceNumber.trim().toUpperCase() : '';

  if (invoiceUpper && (INVALID_INVOICES.has(invoiceUpper) || isAllZeros(invoiceUpper))) {
    return { accepted: false, reason: `nota fiscal marcada como teste/mock ("${c.invoiceNumber}")` };
  }
  if (supplierUpper && (INVALID_SUPPLIERS.has(supplierUpper) || isAllZeros(supplierUpper))) {
    return { accepted: false, reason: `fornecedor marcado como teste/mock ("${c.supplier}")` };
  }

  return { accepted: true };
}

/** Classifica um Depósito bruto */
function classifyDeposito(d) {
  if (!d || typeof d !== 'object') return { accepted: false, reason: 'registro não é um objeto' };
  const value = num(d.value, NaN);
  if (!Number.isFinite(value) || value <= 0) {
    return { accepted: false, reason: `value inválido (${d.value})` };
  }
  if (!d.date) return { accepted: false, reason: 'data ausente' };
  return { accepted: true };
}

/** Classifica uma Venda bruta */
function classifyVenda(v) {
  if (!v || typeof v !== 'object') return { accepted: false, reason: 'registro não é um objeto' };
  const qty = num(v.quantity, NaN);
  const clientName = typeof v.clientName === 'string' ? v.clientName.trim() : '';
  const clientId = typeof v.clientId === 'string' ? v.clientId.trim() : '';
  if (!Number.isFinite(qty) || qty <= 0) {
    return { accepted: false, reason: `quantity inválida (${v.quantity})` };
  }
  if (!clientName && !clientId) {
    return { accepted: false, reason: 'cliente ausente (sem clientName nem clientId)' };
  }
  return { accepted: true };
}

// deductFromBalance / freightPayable normalizados como em sanitizeDatabase
// (mesma regra: true/'YES'/'SIM'/undefined => true)
function normalizeYesFlag(v) {
  return v === true || v === 'YES' || v === 'SIM' || v === undefined;
}

// freightPayable em Vendas é tratado de forma DIFERENTE em getFreightRecords:
// só conta frete se for explicitamente 'YES' ou true (undefined NÃO conta).
function isVendaFreightPayable(v) {
  return v.freightPayable === 'YES' || v.freightPayable === true;
}

// freightPayable em Cargas: qualquer coisa que não seja 'NO'/false conta.
function isCargaFreightPayable(c) {
  return c.freightPayable !== 'NO' && c.freightPayable !== false;
}

// ---------------------------------------------------------------------------
// Passo 3 — Recalcular Caixa / Resumo / Fretes de forma independente
// ---------------------------------------------------------------------------

function auditDatabase(raw) {
  const freightRate = (() => {
    const r = num(raw?.appSettings?.freightRatePerTon, NaN);
    return Number.isFinite(r) && r > 0 ? r : 15;
  })();

  const rawCargas = Array.isArray(raw.Cargas) ? raw.Cargas : [];
  const rawDepositos = Array.isArray(raw.Depositos_Klabin) ? raw.Depositos_Klabin : [];
  const rawVendas = Array.isArray(raw.Vendas) ? raw.Vendas : [];
  const rawMotoristas = Array.isArray(raw.Motoristas) ? raw.Motoristas : [];

  const findings = {
    droppedRecords: [],       // registros que o app descartaria silenciosamente
    valueMismatches: [],      // totalValue gravado != recalculado
    freightMismatches: [],    // freightCost gravado != recalculado
    duplicateIds: [],
    negativeOrZeroAnomalies: [],
  };

  // --- IDs duplicados entre e dentro das coleções ---
  const seenIds = new Map(); // id -> [{collection, index}]
  function trackId(collection, id, index) {
    if (!id) return;
    if (!seenIds.has(id)) seenIds.set(id, []);
    seenIds.get(id).push({ collection, index });
  }
  rawCargas.forEach((c, i) => trackId('Cargas', c && c.id, i));
  rawDepositos.forEach((d, i) => trackId('Depositos_Klabin', d && d.id, i));
  rawVendas.forEach((v, i) => trackId('Vendas', v && v.id, i));
  for (const [id, locs] of seenIds.entries()) {
    if (locs.length > 1) {
      findings.duplicateIds.push({ id, occurrences: locs });
    }
  }

  // --- Cargas: elegibilidade + validação de totalValue/freightCost ---
  let totalVolumeTons = 0;
  let totalComprasVal = 0;
  let totalAbatido = 0;
  const eligibleCargas = [];

  rawCargas.forEach((c, index) => {
    const classification = classifyCarga(c);
    if (!classification.accepted) {
      findings.droppedRecords.push({
        collection: 'Cargas',
        index,
        id: c && c.id,
        date: c && c.date,
        reason: classification.reason,
        record: c,
      });
      return;
    }

    const quantityTons = num(c.quantityTons);
    const valuePerTon = num(c.valuePerTon);
    const expectedTotalValue = round2(quantityTons * valuePerTon);
    const storedTotalValue = c.totalValue !== undefined && c.totalValue !== null ? num(c.totalValue, NaN) : NaN;

    // Regra do app: só recalcula totalValue se o valor gravado for inválido/<=0;
    // caso contrário CONFIA no valor gravado. Reproduzimos essa mesma regra
    // para saber o que o app efetivamente soma...
    const effectiveTotalValue =
      Number.isFinite(storedTotalValue) && storedTotalValue > 0 ? storedTotalValue : expectedTotalValue;

    // ...mas SEPARADAMENTE avisamos se o valor gravado diverge do que
    // quantityTons × valuePerTon realmente dá (é aqui que erros de digitação
    // se escondem sem gerar erro nenhum no app).
    if (Number.isFinite(storedTotalValue) && storedTotalValue > 0 && diverges(storedTotalValue, expectedTotalValue)) {
      findings.valueMismatches.push({
        collection: 'Cargas',
        id: c.id,
        date: c.date,
        field: 'totalValue',
        stored: storedTotalValue,
        recalculated: expectedTotalValue,
        delta: round2(storedTotalValue - expectedTotalValue),
        detail: `quantityTons(${quantityTons}) × valuePerTon(${valuePerTon}) = ${expectedTotalValue}, mas totalValue gravado é ${storedTotalValue}`,
      });
    }

    if (effectiveTotalValue < 0) {
      findings.negativeOrZeroAnomalies.push({
        collection: 'Cargas',
        id: c.id,
        field: 'totalValue',
        value: effectiveTotalValue,
      });
    }

    // Freight: mesma lógica de "confia se veio preenchido" de sanitizeDatabase.
    const freightPayable = isCargaFreightPayable(c);
    const storedFreightCost = c.freightCost !== undefined && c.freightCost !== null ? num(c.freightCost, NaN) : NaN;
    const expectedFreightCost = freightPayable ? round2(quantityTons * freightRate) : 0;
    if (Number.isFinite(storedFreightCost) && diverges(storedFreightCost, expectedFreightCost)) {
      findings.freightMismatches.push({
        collection: 'Cargas',
        id: c.id,
        date: c.date,
        field: 'freightCost',
        stored: storedFreightCost,
        recalculated: expectedFreightCost,
        delta: round2(storedFreightCost - expectedFreightCost),
        detail: `${quantityTons} ton × R$${freightRate}/ton = ${expectedFreightCost} (frete padrão), mas freightCost gravado é ${storedFreightCost}. Pode ser uma negociação legítima — confirme.`,
      });
    }

    totalVolumeTons += quantityTons;
    totalComprasVal += effectiveTotalValue;
    const deductFromBalance = normalizeYesFlag(c.deductFromBalance);
    if (deductFromBalance) {
      totalAbatido += effectiveTotalValue;
    }

    eligibleCargas.push({ ...c, __effectiveTotalValue: effectiveTotalValue, __freightPayable: freightPayable, __freightCost: Number.isFinite(storedFreightCost) ? storedFreightCost : expectedFreightCost });
  });

  // --- Depositos: elegibilidade + soma ---
  let totalDepositos = 0;
  const eligibleDepositos = [];
  rawDepositos.forEach((d, index) => {
    const classification = classifyDeposito(d);
    if (!classification.accepted) {
      findings.droppedRecords.push({
        collection: 'Depositos_Klabin',
        index,
        id: d && d.id,
        date: d && d.date,
        reason: classification.reason,
        record: d,
      });
      return;
    }
    const value = num(d.value);
    totalDepositos += value;
    eligibleDepositos.push(d);
  });

  // --- Saldo Klabin (Caixa) ---
  const saldoLiquidoKlabin = round2(totalDepositos - totalAbatido);

  // --- Vendas: elegibilidade + validação de totalValue ---
  let totalVendasVal = 0;
  const eligibleVendas = [];
  rawVendas.forEach((v, index) => {
    const classification = classifyVenda(v);
    if (!classification.accepted) {
      findings.droppedRecords.push({
        collection: 'Vendas',
        index,
        id: v && v.id,
        date: v && v.date,
        reason: classification.reason,
        record: v,
      });
      return;
    }

    const quantity = num(v.quantity);
    const unitPrice = num(v.unitPrice);
    const expectedTotalValue = round2(quantity * unitPrice);
    const storedTotalValue = v.totalValue !== undefined && v.totalValue !== null ? num(v.totalValue, NaN) : NaN;
    const effectiveTotalValue = Number.isFinite(storedTotalValue) && storedTotalValue > 0 ? storedTotalValue : expectedTotalValue;

    if (Number.isFinite(storedTotalValue) && storedTotalValue > 0 && diverges(storedTotalValue, expectedTotalValue)) {
      findings.valueMismatches.push({
        collection: 'Vendas',
        id: v.id,
        date: v.date,
        field: 'totalValue',
        stored: storedTotalValue,
        recalculated: expectedTotalValue,
        delta: round2(storedTotalValue - expectedTotalValue),
        detail: `quantity(${quantity}) × unitPrice(${unitPrice}) = ${expectedTotalValue}, mas totalValue gravado é ${storedTotalValue}`,
      });
    }

    const freightPayable = isVendaFreightPayable(v);
    const storedFreightCost = v.freightCost !== undefined && v.freightCost !== null ? num(v.freightCost, NaN) : NaN;
    const expectedFreightCost = freightPayable ? round2(quantity * freightRate) : 0;
    if (freightPayable && Number.isFinite(storedFreightCost) && diverges(storedFreightCost, expectedFreightCost)) {
      findings.freightMismatches.push({
        collection: 'Vendas',
        id: v.id,
        date: v.date,
        field: 'freightCost',
        stored: storedFreightCost,
        recalculated: expectedFreightCost,
        delta: round2(storedFreightCost - expectedFreightCost),
        detail: `${quantity} ton × R$${freightRate}/ton = ${expectedFreightCost} (frete padrão), mas freightCost gravado é ${storedFreightCost}. Pode ser uma negociação legítima — confirme.`,
      });
    }

    totalVendasVal += effectiveTotalValue;
    eligibleVendas.push({ ...v, __effectiveTotalValue: effectiveTotalValue, __freightPayable: freightPayable, __freightCost: Number.isFinite(storedFreightCost) ? storedFreightCost : expectedFreightCost });
  });

  // --- Fretes unificados (Cargas + Vendas), espelhando getFreightRecords/getTotalFreight ---
  let totalFreteVal = 0;
  let totalFreteTons = 0;
  let pendingFreteVal = 0;
  let paidFreteVal = 0;

  eligibleCargas.forEach((c) => {
    if (!c.__freightPayable) return;
    totalFreteVal += c.__freightCost;
    totalFreteTons += num(c.quantityTons);
    if (c.freightStatus === 'PAID') paidFreteVal += c.__freightCost;
    else pendingFreteVal += c.__freightCost;
  });
  eligibleVendas.forEach((v) => {
    if (!v.__freightPayable) return;
    totalFreteVal += v.__freightCost;
    totalFreteTons += num(v.quantity);
    if (v.freightStatus === 'PAID') paidFreteVal += v.__freightCost;
    else pendingFreteVal += v.__freightCost;
  });

  const avgFretePerTon = totalFreteTons > 0 ? round2(totalFreteVal / totalFreteTons) : freightRate;

  const resumo = {
    'Total Volume Cargas (Toneladas)': round2(totalVolumeTons),
    'Valor Total Compras de Cargas (R$)': round2(totalComprasVal),
    'Total Abatido do Saldo Klabin (R$)': round2(totalAbatido),
    'Total Depósitos Recebidos Klabin (R$)': round2(totalDepositos),
    'Saldo Líquido Disponível Klabin (R$)': saldoLiquidoKlabin,
    'Custo Total de Fretes (R$)': round2(totalFreteVal),
    'Custo Médio de Frete / Tonelada (R$)': avgFretePerTon,
  };

  const caixa = {
    'Adiantamento Depósitos Klabin (Entrada de Caixa)': round2(totalDepositos),
    'Abatimento Saldo Cargas Fornecidas Klabin': round2(-totalAbatido),
    'Saldo Atualizado de Caixa Operacional Klabin': saldoLiquidoKlabin,
  };

  return {
    freightRate,
    counts: {
      Cargas: rawCargas.length,
      Cargas_elegiveis: eligibleCargas.length,
      Depositos_Klabin: rawDepositos.length,
      Depositos_elegiveis: eligibleDepositos.length,
      Vendas: rawVendas.length,
      Vendas_elegiveis: eligibleVendas.length,
      Motoristas: rawMotoristas.length,
    },
    resumo,
    caixa,
    fretes: {
      totalFreteVal: round2(totalFreteVal),
      totalFreteTons: round2(totalFreteTons),
      avgFretePerTon,
      pendingFreteVal: round2(pendingFreteVal),
      paidFreteVal: round2(paidFreteVal),
    },
    findings,
  };
}

// ---------------------------------------------------------------------------
// Passo 4 — Relatório em texto
// ---------------------------------------------------------------------------

function printReport(result, assertSaldo) {
  const line = '─'.repeat(72);

  console.log(line);
  console.log('AUDITORIA FINANCEIRA — Caixa Klabin / Resumo / Fretes');
  console.log(line);

  console.log(`\nTaxa de frete usada (appSettings.freightRatePerTon ou padrão): R$ ${result.freightRate}/ton`);

  console.log('\nContagem de registros brutos vs elegíveis (o que o app realmente soma):');
  const c = result.counts;
  console.log(`  Cargas:            ${c.Cargas} brutos → ${c.Cargas_elegiveis} elegíveis`);
  console.log(`  Depositos_Klabin:  ${c.Depositos_Klabin} brutos → ${c.Depositos_elegiveis} elegíveis`);
  console.log(`  Vendas:            ${c.Vendas} brutos → ${c.Vendas_elegiveis} elegíveis`);
  console.log(`  Motoristas:        ${c.Motoristas}`);

  console.log('\n--- Resumo Financeiro e Operacional (recalculado independentemente) ---');
  for (const [k, v] of Object.entries(result.resumo)) {
    const isCurrency = k.includes('(R$)');
    const isTon = k.includes('(Toneladas)');
    console.log(`  ${k.padEnd(45)} ${isCurrency ? fmtBRL(v) : isTon ? `${v} Ton` : v}`);
  }

  console.log('\n--- Fluxo de Caixa Operacional (recalculado independentemente) ---');
  for (const [k, v] of Object.entries(result.caixa)) {
    console.log(`  ${k.padEnd(50)} ${fmtBRL(v)}`);
  }

  console.log('\n--- Detalhe de Fretes (Cargas + Vendas) ---');
  console.log(`  Custo Total de Fretes:      ${fmtBRL(result.fretes.totalFreteVal)}`);
  console.log(`  Toneladas com frete:        ${result.fretes.totalFreteTons} Ton`);
  console.log(`  Custo Médio / Tonelada:     ${fmtBRL(result.fretes.avgFretePerTon)}`);
  console.log(`  Frete Pago:                 ${fmtBRL(result.fretes.paidFreteVal)}`);
  console.log(`  Frete Pendente:             ${fmtBRL(result.fretes.pendingFreteVal)}`);

  const f = result.findings;
  const totalIssues =
    f.droppedRecords.length + f.valueMismatches.length + f.freightMismatches.length +
    f.duplicateIds.length + f.negativeOrZeroAnomalies.length;

  console.log(`\n${line}`);
  console.log(`DIVERGÊNCIAS ENCONTRADAS: ${totalIssues}`);
  console.log(line);

  if (f.valueMismatches.length > 0) {
    console.log(`\n[VALOR DIVERGENTE] ${f.valueMismatches.length} registro(s) com totalValue gravado ≠ recalculado:`);
    f.valueMismatches.forEach((m) => {
      console.log(`  - ${m.collection} id=${m.id} data=${m.date}`);
      console.log(`    ${m.detail}`);
      console.log(`    Diferença: ${fmtBRL(m.delta)}`);
    });
  }

  if (f.freightMismatches.length > 0) {
    console.log(`\n[FRETE DIVERGENTE] ${f.freightMismatches.length} registro(s) com freightCost gravado ≠ padrão calculado:`);
    f.freightMismatches.forEach((m) => {
      console.log(`  - ${m.collection} id=${m.id} data=${m.date}`);
      console.log(`    ${m.detail}`);
      console.log(`    Diferença: ${fmtBRL(m.delta)}`);
    });
  }

  if (f.droppedRecords.length > 0) {
    console.log(`\n[DESCARTADOS PELO APP] ${f.droppedRecords.length} registro(s) que a sanitização do app remove silenciosamente:`);
    f.droppedRecords.forEach((d) => {
      console.log(`  - ${d.collection}[${d.index}] id=${d.id || '(sem id)'} data=${d.date || '(sem data)'} — motivo: ${d.reason}`);
    });
  }

  if (f.duplicateIds.length > 0) {
    console.log(`\n[IDs DUPLICADOS] ${f.duplicateIds.length} id(s) repetido(s):`);
    f.duplicateIds.forEach((d) => {
      const where = d.occurrences.map((o) => `${o.collection}[${o.index}]`).join(', ');
      console.log(`  - id=${d.id} aparece em: ${where}`);
    });
  }

  if (f.negativeOrZeroAnomalies.length > 0) {
    console.log(`\n[VALORES NEGATIVOS INESPERADOS] ${f.negativeOrZeroAnomalies.length} registro(s):`);
    f.negativeOrZeroAnomalies.forEach((a) => {
      console.log(`  - ${a.collection} id=${a.id} campo=${a.field} valor=${fmtBRL(a.value)}`);
    });
  }

  if (totalIssues === 0) {
    console.log('\nNenhuma divergência ou anomalia encontrada nos lançamentos brutos.');
  }

  if (assertSaldo !== null && !Number.isNaN(assertSaldo)) {
    console.log(`\n${line}`);
    const displayed = round2(assertSaldo);
    const recalculated = result.caixa['Saldo Atualizado de Caixa Operacional Klabin'];
    if (diverges(displayed, recalculated)) {
      console.log(`[SALDO] DIVERGE do valor informado com --assert-saldo:`);
      console.log(`  Informado (tela do app):  ${fmtBRL(displayed)}`);
      console.log(`  Recalculado (script):     ${fmtBRL(recalculated)}`);
      console.log(`  Diferença:                ${fmtBRL(round2(displayed - recalculated))}`);
    } else {
      console.log(`[SALDO] OK — valor informado (${fmtBRL(displayed)}) bate com o recalculado (${fmtBRL(recalculated)}).`);
    }
  } else {
    console.log(`\nDica: passe --assert-saldo=<valor que a tela Caixa mostra> para comparar diretamente contra o saldo exibido no app.`);
  }

  console.log(`\n${line}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.log(`
Uso: node scripts/audit-financeiro.js <arquivo.json> [--assert-saldo=12345.67] [--json-out=relatorio.json]

<arquivo.json> deve ser um export do formato KlabinDatabase:
  - Configurações > Backup > Exportar JSON dentro do app, ou
  - um dos backups automáticos (Madeireira_Backup_*.json), ou
  - copy(localStorage.getItem('klabin_base_app_database_v1')) no DevTools do Electron.
`);
    process.exit(1);
  }

  const raw = loadRawDatabase(args.file);
  const result = auditDatabase(raw);
  printReport(result, args.assertSaldo);

  if (args.jsonOut) {
    fs.writeFileSync(path.resolve(process.cwd(), args.jsonOut), JSON.stringify(result, null, 2), 'utf8');
    console.log(`Relatório completo salvo em: ${args.jsonOut}`);
  }

  const hasIssues =
    result.findings.droppedRecords.length +
    result.findings.valueMismatches.length +
    result.findings.freightMismatches.length +
    result.findings.duplicateIds.length +
    result.findings.negativeOrZeroAnomalies.length >
    0;

  process.exitCode = hasIssues ? 1 : 0;
}

main();
