/* PCPMaster — Análise prescritiva Gemini no Otimizador TESTER */

const GEMINI_API_KEY_STORAGE = 'pcpmaster_gemini_api_key';
const GEMINI_MODELS_FALLBACK = [
  'models/gemini-3.6-flash',
  'models/gemini-flash-latest',
  'models/gemini-3.6-pro',
  'models/gemini-pro-latest'
];
let geminiActiveModel = '';

const GEMINI_SYSTEM_PROMPT = [
  'Você é um Engenheiro de PCP e Lean Manufacturing Sênior especialista no PCPMaster.',
  'Analise os dados de simulação fornecidos e forneça um plano de ação prescritivo focado em:',
  '1. Reduzir o custo de fila/espera e otimizar o Preço Sugerido por Caixa.',
  '2. Identificar gargalos críticos de máquina/operação.',
  '3. Sugerir até 3 modificações práticas:',
  '   - Adicionar capacidade produtiva (+1 máquina em setor crítico).',
  '   - Rebalanceamento de operadores (ex: alocar 2 operadores para reduzir tempo de ciclo).',
  '   - Simplificação de roteiro/engenharia (eliminar ou fundir etapas com tempos ruins/sem valor).',
  'Retorne a resposta formatada em JSON com os campos: resumo_diagnostico, maiores_gargalos (array), sugestao_capacidade, sugestao_operadores, sugestao_roteiro e estimativa_reducao_preco_caixa.'
].join('\n');

function getGeminiApiKey() {
  try {
    return String(localStorage.getItem(GEMINI_API_KEY_STORAGE) || '').trim();
  } catch (e) {
    return '';
  }
}

function setGeminiApiKey(value) {
  const key = String(value || '').trim();
  localStorage.setItem(GEMINI_API_KEY_STORAGE, key);
  return key;
}

function roundMin(n) {
  const v = Number(n);
  if (!isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

function roundMoney(n) {
  const v = Number(n);
  if (!isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

function buildGeminiSimulationPayload() {
  const sku = typeof getFinalSkuName === 'function' ? (getFinalSkuName() || '') : '';
  const project = (typeof currentProjectName !== 'undefined' && currentProjectName)
    ? currentProjectName
    : sku;
  const boxes = typeof boxesQty !== 'undefined' ? Math.max(1, Number(boxesQty) || 1) : 1;
  const custoDiario = typeof getCustoDiarioFabrica === 'function' ? getCustoDiarioFabrica() : 0;
  const analytics = typeof computeEfficiencyAnalytics === 'function' ? computeEfficiencyAnalytics() : null;
  const makespan = analytics ? Number(analytics.makespanElapsed) || 0 : 0;
  const costs = (typeof computeLaborCostSummary === 'function' && makespan > 0)
    ? computeLaborCostSummary(makespan, boxes)
    : null;
  const journey = typeof buildPartJourneyRows === 'function' ? buildPartJourneyRows() : [];

  const pecas = journey.map(function (row) {
    const k = row.kpis || {};
    return {
      nome: row.name,
      tipo: row.kindLabel || '',
      fila_min: roundMin(k.filaTime),
      producao_min: roundMin(k.prodTime),
      setup_min: roundMin(k.setupTime),
      espera_join_min: roundMin(k.unionTime)
    };
  });

  const postos = ((analytics && analytics.perMachine) || [])
    .map(function (pm) {
      const occupied = Number(pm.occupied) || 0;
      const wait = Number(pm.wait) || 0;
      const span = Math.max(1, makespan);
      return {
        posto: pm.name,
        ocupacao_min: roundMin(occupied),
        ocupacao_pct: roundMin((occupied / span) * 100),
        fila_acumulada_min: roundMin(wait)
      };
    })
    .sort(function (a, b) {
      return (b.ocupacao_pct - a.ocupacao_pct) || (b.fila_acumulada_min - a.fila_acumulada_min);
    })
    .slice(0, 8);

  return {
    sku: sku || project || 'SKU',
    quantidade_caixas: boxes,
    custo_diario_fabrica: roundMoney(custoDiario),
    makespan_total_min: roundMin(makespan),
    custo_total_mod: costs ? roundMoney(costs.custoModTotal) : 0,
    custo_oportunidade_fila: costs ? roundMoney(costs.custoFilaJoin) : 0,
    custo_fixo_absorvido: costs ? roundMoney(costs.custoFixoAbsorvido) : 0,
    preco_sugerido_caixa: costs ? roundMoney(costs.precoSugeridoCaixa) : 0,
    pecas: pecas,
    postos_maior_ocupacao: postos,
    hasSimulation: makespan > 0
  };
}

function geminiModelOrder() {
  const order = GEMINI_MODELS_FALLBACK.slice();
  if (geminiActiveModel && order.indexOf(geminiActiveModel) > 0) {
    order.splice(order.indexOf(geminiActiveModel), 1);
    order.unshift(geminiActiveModel);
  }
  return order;
}

function setGeminiActiveModelLabel(model) {
  geminiActiveModel = model || '';
  const el = document.getElementById('gemini-active-model');
  if (!el) return;
  if (!geminiActiveModel) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = 'Modelo ativo: ' + geminiActiveModel;
}

function geminiModelName(rawModelName) {
  return String(rawModelName || '').trim().replace(/^\/+/, '').replace(/^models\//, '');
}

async function requestGeminiModel(model, apiKey, body) {
  const modelName = geminiModelName(model);
  const key = String(apiKey || '').trim();
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    modelName + ':generateContent?key=' + encodeURIComponent(key);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(function () { return {}; });
  return { res: res, json: json };
}

async function callGeminiPrescriptiveAnalysis(simulationData, projectData) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const err = new Error('Chave da API Gemini não configurada.');
    err.code = 'NO_KEY';
    throw err;
  }
  const payload = {
    simulacao: simulationData || {},
    projeto: projectData || {}
  };
  const body = {
    systemInstruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
    contents: [{
      role: 'user',
      parts: [{ text: JSON.stringify(payload) }]
    }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json'
    }
  };
  const models = geminiModelOrder();
  let lastError = null;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    setGeminiDiagnosisStatus('Consultando ' + model + '…', false);
    try {
      const result = await requestGeminiModel(model, apiKey, body);
      if (!result.res.ok) {
        const msg = (result.json && result.json.error && result.json.error.message)
          ? result.json.error.message
          : ('HTTP ' + result.res.status);
        lastError = new Error(model + ': ' + msg);
        continue;
      }
      const text = result.json && result.json.candidates && result.json.candidates[0] &&
        result.json.candidates[0].content && result.json.candidates[0].content.parts &&
        result.json.candidates[0].content.parts[0] && result.json.candidates[0].content.parts[0].text;
      if (!text) {
        lastError = new Error(model + ': resposta vazia.');
        continue;
      }
      const diagnosis = parseGeminiDiagnosis(text);
      diagnosis.modelo = model;
      setGeminiActiveModelLabel(model);
      return diagnosis;
    } catch (err) {
      lastError = err;
    }
  }
  setGeminiActiveModelLabel('');
  throw lastError || new Error('Nenhum modelo Gemini respondeu.');
}

function parseGeminiDiagnosis(text) {
  const raw = String(text || '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const slice = (start >= 0 && end > start) ? raw.slice(start, end + 1) : raw;
  const data = JSON.parse(slice);
  const gargalos = Array.isArray(data.maiores_gargalos) ? data.maiores_gargalos : [];
  return {
    resumo_diagnostico: String(data.resumo_diagnostico || ''),
    maiores_gargalos: gargalos.map(function (g) { return String(g); }),
    sugestao_capacidade: String(data.sugestao_capacidade || ''),
    sugestao_operadores: String(data.sugestao_operadores || ''),
    sugestao_roteiro: String(data.sugestao_roteiro || ''),
    estimativa_reducao_preco_caixa: String(data.estimativa_reducao_preco_caixa || '')
  };
}

function escapeGeminiHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderGeminiDiagnosisCard(diagnosis) {
  const host = document.getElementById('gemini-diagnosis-body');
  if (!host || !diagnosis) return;
  const gargalos = (diagnosis.maiores_gargalos || []).map(function (g) {
    return '<li><span class="gemini-badge gemini-badge-warn">Gargalo</span> ' + escapeGeminiHtml(g) + '</li>';
  }).join('');
  host.innerHTML =
    '<p class="gemini-resumo">' + escapeGeminiHtml(diagnosis.resumo_diagnostico) + '</p>' +
    (gargalos ? '<ul class="gemini-list">' + gargalos + '</ul>' : '') +
    '<ul class="gemini-list">' +
      '<li><span class="gemini-badge gemini-badge-ok">Capacidade</span> ' + escapeGeminiHtml(diagnosis.sugestao_capacidade) + '</li>' +
      '<li><span class="gemini-badge gemini-badge-ok">Operadores</span> ' + escapeGeminiHtml(diagnosis.sugestao_operadores) + '</li>' +
      '<li><span class="gemini-badge gemini-badge-ok">Roteiro</span> ' + escapeGeminiHtml(diagnosis.sugestao_roteiro) + '</li>' +
    '</ul>' +
    '<p class="gemini-price"><span class="gemini-badge gemini-badge-ok">Economia</span> Redução estimada no preço por caixa: <strong>' +
      escapeGeminiHtml(diagnosis.estimativa_reducao_preco_caixa) + '</strong></p>' +
    (diagnosis.modelo
      ? '<p class="gemini-model-inline">Modelo utilizado: <strong>' + escapeGeminiHtml(diagnosis.modelo) + '</strong></p>'
      : '');
}

function setGeminiDiagnosisStatus(message, isError) {
  const host = document.getElementById('gemini-diagnosis-body');
  if (!host) return;
  host.innerHTML = '<p class="' + (isError ? 'gemini-error' : 'tester-empty') + '">' + escapeGeminiHtml(message) + '</p>';
}

async function runGeminiPrescriptiveAnalysis() {
  const btn = document.getElementById('btn-gemini-analyze');
  const data = buildGeminiSimulationPayload();
  if (!data.hasSimulation) {
    setGeminiDiagnosisStatus('Gere a simulação do SKU antes de pedir o diagnóstico.', true);
    return;
  }
  if (!getGeminiApiKey()) {
    openGeminiKeyModal();
    return;
  }
  if (btn) btn.disabled = true;
  setGeminiDiagnosisStatus('Consultando o Gemini…', false);
  try {
    const projectData = {
      sku: data.sku,
      quantidade_caixas: data.quantidade_caixas,
      custo_diario_fabrica: data.custo_diario_fabrica
    };
    const diagnosis = await callGeminiPrescriptiveAnalysis(data, projectData);
    renderGeminiDiagnosisCard(diagnosis);
  } catch (err) {
    if (err && err.code === 'NO_KEY') openGeminiKeyModal();
    else setGeminiDiagnosisStatus(err && err.message ? err.message : 'Falha na análise.', true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function openGeminiKeyModal() {
  const modal = document.getElementById('gemini-key-modal');
  const input = document.getElementById('gemini-api-key-input');
  if (input) input.value = getGeminiApiKey();
  if (modal) modal.hidden = false;
}

function closeGeminiKeyModal() {
  const modal = document.getElementById('gemini-key-modal');
  if (modal) modal.hidden = true;
}

function saveGeminiKeyFromModal() {
  const input = document.getElementById('gemini-api-key-input');
  setGeminiApiKey(input ? input.value : '');
  closeGeminiKeyModal();
}
