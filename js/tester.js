/* PCPMaster v1.8.0 — Sprint 10 Batch 2: ponte TESTER + dashboard + widget flutuante */

    const TESTER_QUICK_ITERS = 20;
    const TESTER_DEEP_ITERS = 200;

    let testerWorker = null;
    let testerWorkerBlobUrl = '';
    let testerUiStatus = 'idle';
    let testerSearchMode = 'quick';
    let testerLastTop3 = [];
    let testerBaseline = null;
    let testerLastProgress = null;
    let testerPendingApplyIndex = 0;
    let testerApplyBannerTimer = null;
    let testerFabMinimized = false;

    function cloneTesterData(value, fallback) {
      if (typeof cloneJson === 'function') return cloneJson(value, fallback);
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (err) {
        return fallback;
      }
    }

    function getActiveScreenId() {
      const el = document.querySelector('.screen.active');
      return el ? el.id : '';
    }

    function isTesterScreenActive() {
      return getActiveScreenId() === 'screen-tester';
    }

    function spawnTesterWorkerFromBlob() {
      if (typeof pcpmasterTesterWorkerBootstrap !== 'function') {
        throw new Error('Engine TESTER indisponível (bootstrap não carregado).');
      }
      const src = pcpmasterTesterWorkerBootstrap.toString() + '\npcpmasterTesterWorkerBootstrap();';
      testerWorkerBlobUrl = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
      return new Worker(testerWorkerBlobUrl);
    }

    function spawnTesterWorker() {
      if (testerWorker) return testerWorker;
      const useBlob = !window.location || window.location.protocol === 'file:' ||
        typeof pcpmasterTesterWorkerBootstrap === 'function';
      try {
        testerWorker = useBlob ? spawnTesterWorkerFromBlob() : new Worker('js/tester-worker.js');
      } catch (err) {
        testerWorker = spawnTesterWorkerFromBlob();
      }
      testerWorker.onmessage = onTesterWorkerMessage;
      testerWorker.onerror = function (err) {
        setTesterStatus('error');
        updateTesterProgressView({
          type: 'ERROR',
          message: (err && err.message) ? err.message : 'Falha no Worker do TESTER.'
        });
      };
      return testerWorker;
    }

    function currentTesterSkuLabel() {
      const projectName = (currentProjectName || '').trim();
      const sku = (typeof getFinalSkuName === 'function' ? getFinalSkuName() : '') || '';
      if (projectName && sku && projectName.toUpperCase() !== sku) return projectName + ' / ' + sku;
      return projectName || sku || 'Projeto sem nome';
    }

    function refreshTesterSkuBanner() {
      const el = document.getElementById('tester-sku-banner');
      if (!el) return;
      const qty = Number(boxesQty) || 1;
      el.innerHTML = 'SKU ativo: <strong>' + currentTesterSkuLabel() + '</strong> · ' + qty + ' caixa(s)';
    }

    function setTesterSearchMode(mode) {
      testerSearchMode = mode === 'deep' ? 'deep' : 'quick';
      const iters = testerSearchMode === 'deep' ? TESTER_DEEP_ITERS : TESTER_QUICK_ITERS;
      const hidden = document.getElementById('tester-max-iters');
      const modeEl = document.getElementById('tester-search-mode');
      if (hidden) hidden.value = String(iters);
      if (modeEl) modeEl.value = testerSearchMode;
      const quick = document.getElementById('tester-mode-quick');
      const deep = document.getElementById('tester-mode-deep');
      if (quick) quick.classList.toggle('is-active', testerSearchMode === 'quick');
      if (deep) deep.classList.toggle('is-active', testerSearchMode === 'deep');
    }

    function testerMaxIterations() {
      const hidden = document.getElementById('tester-max-iters');
      const raw = hidden ? parseInt(hidden.value, 10) : 0;
      if (raw > 0) return raw;
      return testerSearchMode === 'deep' ? TESTER_DEEP_ITERS : TESTER_QUICK_ITERS;
    }

    function buildTesterProjectPayload() {
      const sku = (typeof getFinalSkuName === 'function' ? getFinalSkuName() : '') || '';
      const projectName = (currentProjectName || '').trim();
      const qty = (typeof getBoxesQtyFromInput === 'function')
        ? getBoxesQtyFromInput()
        : (Number(boxesQty) || 1);
      const startTime = startTimeStr || DEFAULT_START_TIME;
      return {
        machines: cloneTesterData(machines, []),
        parts: cloneTesterData(parts, []),
        employees: cloneTesterData(employees, []),
        groupingRules: cloneTesterData(groupingRules, []),
        assemblyRules: cloneTesterData(assemblyRules, []),
        holidays: cloneTesterData(holidays, []),
        boxesQty: qty,
        startTime: startTime,
        startDate: startDateStr || '',
        sku: sku,
        projectName: projectName,
        estufaQueimaOverride: (typeof readSimEstufaCycleOverride === 'function' ? readSimEstufaCycleOverride().queima : null),
        estufaResfrioOverride: (typeof readSimEstufaCycleOverride === 'function' ? readSimEstufaCycleOverride().resfrio : null),
        maxIterations: testerMaxIterations(),
        searchMode: testerSearchMode,
        seedTop3: typeof getOptimizationSeedsForProject === 'function'
          ? getOptimizationSeedsForProject(projectName, sku)
          : []
      };
    }

    function setTesterButtonsDisabled(selector, disabled) {
      document.querySelectorAll(selector).forEach(btn => {
        btn.disabled = !!disabled;
      });
    }

    function setTesterStatus(status) {
      testerUiStatus = status;
      const running = status === 'running';
      const paused = status === 'paused';
      const busy = running || paused;
      setTesterButtonsDisabled('#btn-tester-start', busy);
      setTesterButtonsDisabled('.js-tester-pause', !running);
      setTesterButtonsDisabled('.js-tester-resume', !paused);
      setTesterButtonsDisabled('.js-tester-cancel', !(running || paused));
      syncTesterFloatingWidget();
    }

    function formatTesterScore(score) {
      if (score == null || isNaN(Number(score))) return '—';
      const n = Number(score);
      return (Math.round(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    }

    function formatTesterEta(seconds) {
      const s = Math.max(0, Number(seconds) || 0);
      if (s <= 0) return '0s';
      if (s < 60) return s + 's';
      const m = Math.floor(s / 60);
      const r = s % 60;
      return m + 'min ' + r + 's';
    }

    function formatTesterMinutes(mins) {
      if (mins == null || isNaN(Number(mins))) return '—';
      return Number(mins) + ' min';
    }

    function renderTesterTags(sequence) {
      const list = Array.isArray(sequence) ? sequence : [];
      if (!list.length) return '<p class="tester-empty">Sem sequência.</p>';
      return '<div class="tester-tags">' + list.map((name, i) =>
        '<span class="tester-tag">' + (i + 1) + '. ' + String(name) + '</span>'
      ).join('') + '</div>';
    }

    function makespanGainHtml(current, optimized) {
      const a = Number(current && current.makespan);
      const b = Number(optimized && optimized.makespan);
      if (!(a > 0) || b == null || isNaN(b)) return '';
      const pct = ((b - a) / a) * 100;
      const rounded = Math.round(pct * 10) / 10;
      let cls = 'tester-gain';
      let label;
      if (Math.abs(rounded) < 0.05) {
        cls += ' is-flat';
        label = 'Makespan inalterado';
      } else {
        if (rounded > 0) cls += ' is-worse';
        const sign = rounded > 0 ? '+' : '';
        label = 'Ganho de Tempo: ' + sign + rounded.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '% no Makespan';
      }
      return '<div class="' + cls + '">' + label + '</div>';
    }

    function scenarioMetricsHtml(sc) {
      if (!sc) return '<p class="tester-empty">Sem dados.</p>';
      return '<p class="tester-metric">Makespan: <strong>' + formatTesterMinutes(sc.makespan) + '</strong></p>' +
        '<p class="tester-metric">Ociosidade: <strong>' + formatTesterMinutes(sc.idle) + '</strong></p>' +
        '<p class="tester-metric">Score: <strong>' + formatTesterScore(sc.score) + '</strong></p>' +
        (sc.strategy ? '<p class="tester-metric">Estratégia: <strong>' + sc.strategy + '</strong></p>' : '');
    }

    function renderTesterCompare() {
      const currentEl = document.getElementById('tester-card-current');
      const topEl = document.getElementById('tester-card-top1');
      if (!currentEl || !topEl) return;
      const current = testerBaseline || {
        sequence: (parts || []).map(p => p.name),
        strategy: 'atual'
      };
      const top1 = testerLastTop3[0] || null;
      currentEl.innerHTML = '<h3>Cenário Atual</h3>' +
        (current.score != null
          ? scenarioMetricsHtml(current)
          : '<p class="tester-empty">Aguardando avaliação da ordem cadastrada.</p>') +
        renderTesterTags(current.sequence);

      if (!top1) {
        topEl.innerHTML = '<h3>Top 1 Cenário Otimizado</h3><p class="tester-empty">Inicie a otimização para ver o melhor cenário.</p>';
        return;
      }
      topEl.innerHTML = '<h3>Top 1 Cenário Otimizado</h3>' +
        makespanGainHtml(current, top1) +
        scenarioMetricsHtml(top1) +
        renderTesterTags(top1.sequence) +
        '<button type="button" class="btn btn-success" onclick="requestApplyTesterSequence(0)">Aplicar Sequência Otimizada no Projeto</button>';
    }

    function renderTesterTop3(top3) {
      const wrap = document.getElementById('tester-top3');
      if (!wrap) return;
      const list = Array.isArray(top3) ? top3 : [];
      if (!list.length) {
        wrap.innerHTML = '<p class="tester-empty">Nenhum cenário ranqueado ainda.</p>';
        return;
      }
      wrap.innerHTML = list.map((sc, idx) => {
        const strategy = sc.strategy ? String(sc.strategy) : '—';
        return '<article class="tester-scenario">' +
          '<header><strong>#' + (sc.rank || (idx + 1)) + '</strong>' +
          '<span>Score ' + formatTesterScore(sc.score) + '</span></header>' +
          '<p>Makespan: ' + formatTesterMinutes(sc.makespan) +
          ' · Ocioso: ' + formatTesterMinutes(sc.idle) +
          ' · Estratégia: ' + strategy + '</p>' +
          renderTesterTags(sc.sequence) +
          '<button type="button" class="btn btn-success" onclick="requestApplyTesterSequence(' + idx + ')">Aplicar esta sequência</button>' +
          '</article>';
      }).join('');
    }

    function testerProgressParts(msg) {
      const iteration = Number(msg && msg.iteration) || 0;
      const total = Number(msg && msg.total) || 0;
      const percent = Number(msg && msg.percent);
      const pct = !isNaN(percent) ? percent : (total > 0 ? Math.round((iteration / total) * 100) : 0);
      return {
        iteration: iteration,
        total: total,
        pct: Math.max(0, Math.min(100, pct))
      };
    }

    function updateTesterProgressView(msg) {
      testerLastProgress = msg || testerLastProgress;
      const label = document.getElementById('tester-progress-label');
      const eta = document.getElementById('tester-eta-label');
      const fill = document.getElementById('tester-progress-fill');
      const best = document.getElementById('tester-best-score');
      const seedHint = document.getElementById('tester-seed-hint');
      if (msg && msg.type === 'ERROR') {
        if (label) label.textContent = 'Erro: ' + (msg.message || 'falha no TESTER');
        if (eta) eta.textContent = '';
        syncTesterFloatingWidget();
        return;
      }
      const prog = testerProgressParts(msg);
      if (fill) fill.style.width = prog.pct + '%';
      if (label) {
        if (!prog.total && testerUiStatus === 'idle') label.textContent = 'Aguardando início';
        else label.textContent = prog.pct + '% concluído · Iteração ' + prog.iteration + '/' + prog.total;
      }
      if (eta) {
        if (testerUiStatus === 'paused') eta.textContent = 'Pausado';
        else if (testerUiStatus === 'running') eta.textContent = 'ETA ' + formatTesterEta(msg && msg.etaSeconds);
        else eta.textContent = '';
      }
      if (best) {
        best.textContent = 'Melhor score encontrado: ' + formatTesterScore(msg && msg.bestScore);
      }
      if (msg && msg.baseline) testerBaseline = msg.baseline;
      if (Array.isArray(msg && msg.top3)) {
        testerLastTop3 = msg.top3;
        renderTesterTop3(testerLastTop3);
        renderTesterCompare();
      }
      if (seedHint && msg && msg.type === 'STARTED') {
        const n = (typeof getOptimizationSeedsForProject === 'function')
          ? getOptimizationSeedsForProject(
            (currentProjectName || '').trim(),
            (typeof getFinalSkuName === 'function' ? getFinalSkuName() : '')
          ).length
          : 0;
        seedHint.textContent = n > 0
          ? 'Smart Seed: ' + n + ' sequência(s) histórica(s) carregada(s) como ponto de partida.'
          : 'Smart Seed: sem histórico prévio para este SKU (busca a partir das heurísticas).';
      }
      syncTesterFloatingWidget();
    }

    function testerFabStatusLabel() {
      if (testerUiStatus === 'paused') return 'Pausado';
      if (testerUiStatus === 'done') return 'Concluído';
      if (testerUiStatus === 'error') return 'Erro';
      if (testerUiStatus === 'running') return 'Rodando';
      return '—';
    }

    function applyTesterFabChrome() {
      const fab = document.getElementById('tester-fab');
      if (!fab) return;
      fab.classList.toggle('is-minimized', !!testerFabMinimized);
      fab.setAttribute('aria-expanded', testerFabMinimized ? 'false' : 'true');
      const pctEl = document.getElementById('tester-fab-percent');
      const statusText = testerFabStatusLabel();
      const pctText = pctEl ? pctEl.textContent : '';
      fab.title = testerFabMinimized
        ? ('TESTER ' + pctText + ' · ' + statusText + ' — clique para expandir')
        : '';
      fab.setAttribute('aria-label', testerFabMinimized
        ? ('TESTER minimizado, ' + pctText + ', ' + statusText + '. Clique para expandir.')
        : 'Widget TESTER');
    }

    function minimizeTesterFab(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      testerFabMinimized = true;
      applyTesterFabChrome();
    }

    function onTesterFabClick(event) {
      if (!testerFabMinimized) return;
      if (event && event.target && event.target.closest && event.target.closest('button')) return;
      testerFabMinimized = false;
      applyTesterFabChrome();
    }

    function syncTesterFloatingWidget() {
      const fab = document.getElementById('tester-fab');
      if (!fab) return;
      const show = !isTesterScreenActive() &&
        (testerUiStatus === 'running' || testerUiStatus === 'paused' || testerUiStatus === 'done');
      fab.hidden = !show;
      if (!show) return;
      const msg = testerLastProgress || {};
      const prog = testerProgressParts(msg);
      const fill = document.getElementById('tester-fab-fill');
      const pctEl = document.getElementById('tester-fab-percent');
      const statusEl = document.getElementById('tester-fab-status');
      const iterEl = document.getElementById('tester-fab-iter');
      const etaEl = document.getElementById('tester-fab-eta');
      const scoreEl = document.getElementById('tester-fab-score');
      if (fill) fill.style.width = prog.pct + '%';
      if (pctEl) pctEl.textContent = prog.pct + '%';
      if (statusEl) statusEl.textContent = testerFabStatusLabel();
      if (iterEl) iterEl.textContent = prog.iteration + '/' + prog.total;
      if (etaEl) {
        if (testerUiStatus === 'paused') etaEl.textContent = 'Pausado';
        else if (testerUiStatus === 'done') etaEl.textContent = 'Concluído';
        else etaEl.textContent = 'ETA ' + formatTesterEta(msg.etaSeconds);
      }
      if (scoreEl) scoreEl.textContent = 'Melhor score: ' + formatTesterScore(msg.bestScore);
      applyTesterFabChrome();
    }

    function persistTesterResult(msg) {
      if (!msg || !Array.isArray(msg.top3) || msg.top3.length === 0) return;
      if (typeof upsertOptimizationHistory !== 'function') return;
      upsertOptimizationHistory({
        sku: msg.sku || (typeof getFinalSkuName === 'function' ? getFinalSkuName() : ''),
        projectName: msg.projectName || currentProjectName || '',
        boxesQty: msg.boxesQty || boxesQty,
        startTime: msg.startTime || startTimeStr || '',
        iterations: msg.iteration || 0,
        top3: msg.top3
      });
    }

    function onTesterWorkerMessage(event) {
      const msg = event && event.data ? event.data : {};
      const type = String(msg.type || '').toUpperCase();
      if (type === 'STARTED' || type === 'PROGRESS') {
        setTesterStatus(msg.paused ? 'paused' : 'running');
        updateTesterProgressView(msg);
        return;
      }
      if (type === 'PAUSED') {
        setTesterStatus('paused');
        updateTesterProgressView(msg);
        return;
      }
      if (type === 'DONE') {
        setTesterStatus('done');
        updateTesterProgressView(msg);
        persistTesterResult(msg);
        const label = document.getElementById('tester-progress-label');
        if (label) {
          const why = msg.reason === 'cancel' ? 'Cancelado' : 'Concluído';
          label.textContent = why + ' · ' + (msg.iteration || 0) + '/' + (msg.total || 0) +
            ' · Top 3 gravado no histórico';
        }
        return;
      }
      if (type === 'ERROR') {
        setTesterStatus('error');
        updateTesterProgressView(msg);
      }
    }

    function openTesterScreen() {
      refreshTesterSkuBanner();
      setTesterSearchMode(testerSearchMode);
      renderTesterCompare();
      renderTesterTop3(testerLastTop3);
      navigateTo('screen-tester');
    }

    function sendProjectToTester() {
      if (!parts || parts.length === 0) {
        alert('Cadastre peças nas etapas de engenharia antes de enviar ao TESTER.');
        return;
      }
      openTesterScreen();
    }

    function startTesterOptimization() {
      if (!parts || parts.length === 0) {
        alert('Cadastre peças nas etapas de engenharia antes de rodar o TESTER.');
        return;
      }
      if (!isTesterScreenActive()) openTesterScreen();
      refreshTesterSkuBanner();
      const payload = buildTesterProjectPayload();
      testerBaseline = {
        sequence: (parts || []).map(p => p.name),
        strategy: 'atual'
      };
      testerLastTop3 = [];
      spawnTesterWorker();
      setTesterStatus('running');
      updateTesterProgressView({
        type: 'STARTED',
        iteration: 0,
        total: payload.maxIterations,
        percent: 0,
        etaSeconds: 0,
        bestScore: null,
        top3: []
      });
      renderTesterCompare();
      testerWorker.postMessage({ type: 'START', payload: payload });
    }

    function pauseTesterOptimization() {
      if (!testerWorker || testerUiStatus !== 'running') return;
      testerWorker.postMessage({ type: 'PAUSE' });
    }

    function resumeTesterOptimization() {
      if (!testerWorker || testerUiStatus !== 'paused') return;
      testerWorker.postMessage({ type: 'RESUME' });
      setTesterStatus('running');
      syncTesterFloatingWidget();
    }

    function cancelTesterOptimization() {
      if (!testerWorker) return;
      testerWorker.postMessage({ type: 'CANCEL' });
    }

    function closeTesterApplyModal() {
      testerPendingApplyIndex = 0;
      const modal = document.getElementById('tester-apply-modal');
      if (modal) {
        modal.hidden = true;
        modal.classList.remove('is-open');
      }
    }

    function requestApplyTesterSequence(index) {
      const sc = testerLastTop3[index];
      if (!sc || !Array.isArray(sc.sequence) || !sc.sequence.length) return;
      testerPendingApplyIndex = index;
      const modal = document.getElementById('tester-apply-modal');
      const msg = document.getElementById('tester-apply-message');
      if (msg) {
        msg.textContent = 'A ordem das peças primárias no cadastro será reordenada para: ' +
          sc.sequence.join(' → ') + '. Confirma aplicar a sequência otimizada no projeto?';
      }
      if (modal) {
        modal.hidden = false;
        modal.classList.add('is-open');
      }
    }

    function confirmApplyTesterSequence() {
      const idx = testerPendingApplyIndex;
      closeTesterApplyModal();
      applyTesterSequence(idx);
    }

    function showTesterApplyBanner(sequence) {
      const text = 'Sequência otimizada aplicada no cadastro: ' + (sequence || []).join(' → ');
      ['tester-apply-banner'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.hidden = false;
        el.textContent = text;
      });
      clearTimeout(testerApplyBannerTimer);
      testerApplyBannerTimer = setTimeout(() => {
        const el = document.getElementById('tester-apply-banner');
        if (el) el.hidden = true;
      }, 8000);
    }

    function applyTesterSequence(index) {
      const sc = testerLastTop3[index];
      if (!sc || !Array.isArray(sc.sequence) || !sc.sequence.length) return;
      const byUpper = {};
      (parts || []).forEach(p => { byUpper[String(p.name).toUpperCase()] = p; });
      const ordered = [];
      const seen = {};
      sc.sequence.forEach(name => {
        const p = byUpper[String(name).toUpperCase()];
        if (p && !seen[p.name]) {
          ordered.push(p);
          seen[p.name] = true;
        }
      });
      (parts || []).forEach(p => {
        if (!seen[p.name]) ordered.push(p);
      });
      parts = ordered;
      testerBaseline = {
        sequence: parts.map(p => p.name),
        strategy: 'atual',
        score: sc.score,
        makespan: sc.makespan,
        idle: sc.idle
      };
      if (typeof persistActiveProjectState === 'function') persistActiveProjectState();
      if (typeof renderConfigUI === 'function') renderConfigUI();
      if (typeof calculateSimulationHistory === 'function' && machines.length && parts.length) {
        calculateSimulationHistory();
        if (typeof renderCharts === 'function') renderCharts();
      }
      showTesterApplyBanner(parts.map(p => p.name));
      renderTesterCompare();
    }

    function syncAppNav(screenId) {
      const nav = document.getElementById('app-nav');
      if (!nav) return;
      const show = screenId === 'screen-config' || screenId === 'screen-sim' || screenId === 'screen-tester' || screenId === 'screen-plan';
      nav.hidden = !show;
      nav.querySelectorAll('[data-nav]').forEach(btn => {
        btn.classList.toggle('is-active', btn.getAttribute('data-nav') === screenId);
      });
    }
