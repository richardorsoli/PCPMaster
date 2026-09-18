/* PCPMaster v1.8.0 — Sprint 11: Plano de Produção Multiprojeto */

    let simulationMode = 'single';
    let currentPlanName = '';
    let currentPlanQueueMeta = [];
    let planSimulationActive = false;
    let productionPlanQueue = [];
    let productionPlanSavedId = '';
    let engineeringSnapshot = null;
    let planRuntimeBundle = null;
    let pendingOverwritePlanName = '';

    function captureEngineeringSession() {
      return {
        currentProjectName: currentProjectName || '',
        machines: cloneJson(machines, []),
        parts: cloneJson(parts, []),
        employees: cloneJson(employees, []),
        groupingRules: cloneJson(groupingRules, []),
        assemblyRules: cloneJson(assemblyRules, []),
        boxesQty: boxesQty,
        startDateStr: startDateStr,
        startTimeStr: startTimeStr,
        startTimeOffsetMin: startTimeOffsetMin
      };
    }

    function restoreEngineeringSession(snap) {
      if (!snap) return;
      currentProjectName = snap.currentProjectName || '';
      machines = cloneJson(snap.machines, []);
      parts = cloneJson(snap.parts, []);
      employees = cloneJson(snap.employees, []);
      groupingRules = cloneJson(snap.groupingRules, []);
      assemblyRules = cloneJson(snap.assemblyRules, []);
      boxesQty = snap.boxesQty || 1;
      startDateStr = snap.startDateStr || todayISODate();
      const dateEl = document.getElementById('start-date');
      if (dateEl) dateEl.value = startDateStr;
      const boxesEl = document.getElementById('boxes-qty');
      if (boxesEl) boxesEl.value = boxesQty;
      const simBoxes = document.getElementById('sim-boxes-qty');
      if (simBoxes) simBoxes.value = boxesQty;
      applyStartTimeToState(snap.startTimeStr || DEFAULT_START_TIME);
      planSimulationActive = false;
      clearPlanSimChrome();
      if (typeof syncProjectNameUI === 'function') syncProjectNameUI({ syncInput: true });
    }

    function restoreEngineeringSessionIfNeeded() {
      if (planSimulationActive && engineeringSnapshot) {
        restoreEngineeringSession(engineeringSnapshot);
      }
    }

    function readPlanHeaderFromInputs() {
      const dateEl = document.getElementById('plan-start-date');
      const timeEl = document.getElementById('plan-start-time');
      const nameEl = document.getElementById('plan-name-input');
      let dateIso = (dateEl && dateEl.value) || todayISODate();
      dateIso = nextWorkDay(dateIso);
      if (dateEl) dateEl.value = dateIso;
      const timeStr = normalizeStartTimeClock((timeEl && timeEl.value) || DEFAULT_START_TIME).clockStr;
      if (timeEl) timeEl.value = timeStr;
      currentPlanName = (nameEl && nameEl.value ? nameEl.value : currentPlanName || '').trim();
      return { dateIso, timeStr, name: currentPlanName };
    }

    function syncPlanHeaderInputs(dateIso, timeStr, name) {
      const dateEl = document.getElementById('plan-start-date');
      const timeEl = document.getElementById('plan-start-time');
      const nameEl = document.getElementById('plan-name-input');
      if (dateEl && dateIso) dateEl.value = dateIso;
      if (timeEl && timeStr) timeEl.value = timeStr;
      if (nameEl && name != null && document.activeElement !== nameEl) nameEl.value = name;
    }

    function parseOptionalDateTimeLocal(value) {
      const raw = String(value || '').trim();
      if (!raw) return { startDate: '', startTime: '' };
      const m = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
      if (!m) return { startDate: '', startTime: '' };
      return { startDate: m[1], startTime: m[2] };
    }

    function toDateTimeLocalValue(dateIso, timeStr) {
      if (!dateIso || !timeStr) return '';
      return dateIso + 'T' + timeStr;
    }

    function formatPlanTrigger(item) {
      if (item && item.startDate && item.startTime) {
        return {
          mode: 'scheduled',
          label: 'Agendado para ' + formatDisplayDate(item.startDate) + ' ' + item.startTime
        };
      }
      return { mode: 'auto', label: 'Automático por Liberação' };
    }

    function mapPlanPartName(prefix, name) {
      return String(prefix) + ' · ' + String(name || '').trim();
    }

    function namespaceNameList(prefix, list) {
      return (Array.isArray(list) ? list : []).map(n => mapPlanPartName(prefix, n));
    }

    function populatePlanProjectSelect() {
      const select = document.getElementById('plan-project-select');
      if (!select) return;
      const previous = select.value;
      const saved = getProjectsDatabase();
      const names = Object.keys(saved).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      select.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = names.length ? '— Selecione um projeto salvo —' : '— Nenhum projeto em tb_projetos_pecas —';
      select.appendChild(placeholder);
      names.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
      });
      if (previous && saved[previous]) select.value = previous;
    }

    function populateSavedPlansSelect() {
      const select = document.getElementById('saved-plans-select');
      if (!select) return;
      const previous = select.value;
      const plans = getProductionPlans();
      select.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = plans.length ? '— Selecione um plano salvo —' : '— Nenhum plano salvo —';
      select.appendChild(placeholder);
      plans.forEach(plan => {
        const opt = document.createElement('option');
        opt.value = plan.id;
        opt.textContent = plan.name + (plan.queue && plan.queue.length ? (' (' + plan.queue.length + ' SKU)' ) : '');
        select.appendChild(opt);
      });
      if (previous && plans.some(p => p.id === previous)) select.value = previous;
      else if (productionPlanSavedId && plans.some(p => p.id === productionPlanSavedId)) {
        select.value = productionPlanSavedId;
      }
    }

    function renderPlanQueueTable() {
      const body = document.getElementById('plan-queue-body');
      if (!body) return;
      if (!productionPlanQueue.length) {
        body.innerHTML = '<tr><td colspan="5" style="color:#64748b;">Nenhum projeto na fila. Adicione SKUs acima.</td></tr>';
        return;
      }
      body.innerHTML = productionPlanQueue.map((item, idx) => {
        const trigger = formatPlanTrigger(item);
        const cls = trigger.mode === 'scheduled' ? 'plan-trigger-scheduled' : 'plan-trigger-auto';
        return '<tr>' +
          '<td>' + (idx + 1) + '</td>' +
          '<td>' + String(item.projectName) + '</td>' +
          '<td>' + String(item.boxesQty) + '</td>' +
          '<td class="' + cls + '">' + trigger.label + '</td>' +
          '<td><div class="plan-queue-actions">' +
            '<button type="button" class="btn btn-secondary" onclick="movePlanQueueItem(' + idx + ',-1)">Subir</button>' +
            '<button type="button" class="btn btn-secondary" onclick="movePlanQueueItem(' + idx + ',1)">Descer</button>' +
            '<button type="button" class="btn btn-danger" onclick="removePlanQueueItem(' + idx + ')">Remover</button>' +
          '</div></td>' +
        '</tr>';
      }).join('');
    }

    function initPlanStartDefaults() {
      const dateEl = document.getElementById('plan-start-date');
      const timeEl = document.getElementById('plan-start-time');
      if (dateEl && dateEl.value && timeEl && timeEl.value) return;
      const sug = suggestSmartStartDateTime();
      if (dateEl && !dateEl.value) dateEl.value = sug.dateIso;
      if (timeEl && !timeEl.value) timeEl.value = sug.timeStr;
    }

    function renderProductionPlanUI() {
      initPlanStartDefaults();
      populatePlanProjectSelect();
      populateSavedPlansSelect();
      renderPlanQueueTable();
      const nameEl = document.getElementById('plan-name-input');
      if (nameEl && currentPlanName && document.activeElement !== nameEl) nameEl.value = currentPlanName;
    }

    function openPlanScreen() {
      restoreEngineeringSessionIfNeeded();
      renderProductionPlanUI();
      navigateTo('screen-plan');
    }

    function addProjectToProductionPlan() {
      const select = document.getElementById('plan-project-select');
      const boxesEl = document.getElementById('plan-item-boxes');
      const dtEl = document.getElementById('plan-item-datetime');
      const projectName = select && select.value ? String(select.value).trim() : '';
      if (!projectName) {
        alert('Selecione um projeto salvo em tb_projetos_pecas.');
        return;
      }
      const saved = getProjectsDatabase();
      if (!saved[projectName]) {
        alert('O projeto "' + projectName + '" não foi encontrado na base.');
        populatePlanProjectSelect();
        return;
      }
      let boxes = parseInt(boxesEl && boxesEl.value, 10);
      if (isNaN(boxes) || boxes < 1) boxes = 1;
      if (boxes > 999) boxes = 999;
      const dt = parseOptionalDateTimeLocal(dtEl && dtEl.value);
      productionPlanQueue.push({
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        projectName,
        boxesQty: boxes,
        startDate: dt.startDate,
        startTime: dt.startTime
      });
      if (boxesEl) boxesEl.value = '1';
      if (dtEl) dtEl.value = '';
      renderPlanQueueTable();
    }

    function movePlanQueueItem(index, delta) {
      const from = Number(index);
      const to = from + Number(delta);
      if (!Number.isInteger(from) || to < 0 || to >= productionPlanQueue.length) return;
      const item = productionPlanQueue.splice(from, 1)[0];
      productionPlanQueue.splice(to, 0, item);
      renderPlanQueueTable();
    }

    function removePlanQueueItem(index) {
      const idx = Number(index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= productionPlanQueue.length) return;
      productionPlanQueue.splice(idx, 1);
      renderPlanQueueTable();
    }

    function applyLoadedProductionPlan(plan) {
      const row = normalizePlanoProducao(plan, 0);
      if (!row) return;
      currentPlanName = row.name;
      productionPlanSavedId = row.id;
      productionPlanQueue = cloneJson(row.queue, []);
      const sug = suggestSmartStartDateTime();
      syncPlanHeaderInputs(row.startDate || sug.dateIso, row.startTime || sug.timeStr, row.name);
      renderProductionPlanUI();
    }

    function loadSelectedProductionPlan() {
      const select = document.getElementById('saved-plans-select');
      const id = select && select.value;
      if (!id) {
        alert('Selecione um plano salvo para carregar.');
        return;
      }
      const plan = getProductionPlans().find(p => p.id === id);
      if (!plan) {
        alert('Plano não encontrado.');
        populateSavedPlansSelect();
        return;
      }
      applyLoadedProductionPlan(plan);
    }

    function deleteSelectedProductionPlan() {
      const select = document.getElementById('saved-plans-select');
      const id = select && select.value;
      if (!id) {
        alert('Selecione um plano salvo para excluir.');
        return;
      }
      const plan = getProductionPlans().find(p => p.id === id);
      if (!plan) return;
      if (!confirm('Tem certeza que deseja apagar o plano "' + plan.name + '"?')) return;
      deleteProductionPlanById(id);
      if (productionPlanSavedId === id) productionPlanSavedId = '';
      populateSavedPlansSelect();
    }

    function buildCurrentPlanRecord(name) {
      const header = readPlanHeaderFromInputs();
      return {
        id: productionPlanSavedId || ('plan_' + Date.now()),
        name: name || header.name,
        startDate: header.dateIso,
        startTime: header.timeStr,
        updatedAt: new Date().toISOString(),
        queue: cloneJson(productionPlanQueue, [])
      };
    }

    function openOverwriteProductionPlanModal(name) {
      pendingOverwritePlanName = name;
      const modal = document.getElementById('overwrite-plan-modal');
      const msg = document.getElementById('overwrite-plan-message');
      if (msg) msg.textContent = 'O plano \'' + name + '\' já existe na base de dados. Deseja sobrescrever?';
      if (modal) {
        modal.hidden = false;
        modal.classList.add('is-open');
      }
    }

    function closeOverwriteProductionPlanModal() {
      pendingOverwritePlanName = '';
      const modal = document.getElementById('overwrite-plan-modal');
      if (modal) {
        modal.hidden = true;
        modal.classList.remove('is-open');
      }
    }

    function confirmOverwriteProductionPlan() {
      const name = pendingOverwritePlanName;
      closeOverwriteProductionPlanModal();
      if (!name) return;
      commitSaveProductionPlan(name);
    }

    function commitSaveProductionPlan(name) {
      const row = upsertProductionPlan(buildCurrentPlanRecord(name));
      if (!row) {
        alert('Não foi possível salvar o plano. Informe um nome/SKU.');
        return;
      }
      productionPlanSavedId = row.id;
      currentPlanName = row.name;
      populateSavedPlansSelect();
      alert('Plano "' + row.name + '" salvo em tb_planos_producao.');
    }

    function saveProductionPlanPrompt() {
      const header = readPlanHeaderFromInputs();
      const name = header.name;
      if (!name) {
        alert('Informe o Nome / SKU do Plano para salvar.');
        const el = document.getElementById('plan-name-input');
        if (el) el.focus();
        return;
      }
      if (!productionPlanQueue.length) {
        alert('Adicione ao menos um projeto à fila antes de salvar.');
        return;
      }
      const exists = getProductionPlans().some(p => String(p.name || '').trim().toUpperCase() === name.toUpperCase());
      if (exists) {
        openOverwriteProductionPlanModal(name);
        return;
      }
      commitSaveProductionPlan(name);
    }

    function hydratePlanProject(projectName) {
      const saved = getProjectsDatabase();
      const proj = saved[projectName];
      if (!proj) return null;
      const catalog = getBaseCatalogFromDatabase();
      return {
        name: projectName,
        machines: hydrateProjectMachines(proj, catalog.machines),
        employees: hydrateProjectEmployees(proj, getCatalogEmployees()),
        parts: cloneJson(proj.parts || [], []),
        groupingRules: cloneJson(proj.groupingRules || [], []),
        assemblyRules: (proj.assemblyRules || []).map(normalizeAssemblyRule)
      };
    }

    function buildMergedPlanBundle() {
      const header = readPlanHeaderFromInputs();
      if (!productionPlanQueue.length) {
        alert('Adicione ao menos um projeto à fila para simular o plano.');
        return null;
      }
      const missing = productionPlanQueue.filter(item => !getProjectsDatabase()[item.projectName]);
      if (missing.length) {
        alert('Projeto(s) não encontrado(s) na base: ' + missing.map(i => i.projectName).join(', '));
        return null;
      }

      const originDate = header.dateIso;
      const originTime = header.timeStr;
      const mergedParts = [];
      const mergedGroups = [];
      const mergedAsms = [];
      let mergedMachines = [];
      let mergedEmployees = [];

      productionPlanQueue.forEach((item, order) => {
        const proj = hydratePlanProject(item.projectName);
        if (!proj) return;
        const prefix = (order + 1) + '. ' + String(item.projectName || '').toUpperCase();
        const scheduled = !!(item.startDate && item.startTime);
        const chainMode = scheduled ? 'scheduled' : 'auto';
        const notBefore = scheduled
          ? dateTimeToAbsMin(item.startDate, item.startTime, originDate, originTime)
          : dateTimeToAbsMin(originDate, originTime, originDate, originTime);
        const planMeta = {
          planOrder: order,
          notBeforeAbsMin: notBefore,
          planChainMode: chainMode,
          planProjectName: item.projectName,
          planItemId: item.id
        };

        (proj.parts || []).forEach(part => {
          const cloned = cloneJson(part, part);
          cloned.name = mapPlanPartName(prefix, String(part.name || '').toUpperCase());
          cloned.qty = (Number(part.qty) > 0 ? Number(part.qty) : 1) * (item.boxesQty || 1);
          Object.assign(cloned, planMeta);
          mergedParts.push(cloned);
        });

        (proj.groupingRules || []).forEach(rule => {
          const cloned = cloneJson(rule, rule);
          cloned.partNames = namespaceNameList(prefix, (rule.partNames || []).map(n => String(n || '').toUpperCase()));
          mergedGroups.push(cloned);
        });

        (proj.assemblyRules || []).forEach(rule => {
          const cloned = normalizeAssemblyRule(cloneJson(rule, rule));
          cloned.resultName = mapPlanPartName(prefix, String(cloned.resultName || '').toUpperCase());
          cloned.requiredPartNames = namespaceNameList(prefix, cloned.requiredPartNames);
          cloned.juncao = {
            requer: cloned.requiredPartNames.slice(),
            maquina: cloned.machineId
          };
          cloned.qty = (Number(cloned.qty) > 0 ? Number(cloned.qty) : 1) * (item.boxesQty || 1);
          Object.assign(cloned, planMeta);
          mergedAsms.push(cloned);
        });

        mergedMachines = unionMachineLists(mergedMachines, proj.machines);
        mergedEmployees = mergeEntitiesById(mergedEmployees, proj.employees, normalizeEmployee);
      });

      if (!mergedParts.length) {
        alert('Os projetos da fila não possuem peças/roteiros para simular.');
        return null;
      }

      return {
        name: header.name || ('Plano ' + productionPlanQueue.map(i => i.projectName).join(' + ')),
        originDate,
        originTime,
        queue: cloneJson(productionPlanQueue, []),
        parts: mergedParts,
        groupingRules: mergedGroups,
        assemblyRules: mergedAsms,
        machines: mergedMachines,
        employees: mergedEmployees
      };
    }

    function applyPlanBundle(bundle) {
      if (!bundle) return;
      currentPlanName = bundle.name || '';
      currentPlanQueueMeta = cloneJson(bundle.queue, []);
      currentProjectName = currentPlanName;
      machines = cloneJson(bundle.machines, []);
      employees = cloneJson(bundle.employees, []);
      parts = cloneJson(bundle.parts, []);
      groupingRules = cloneJson(bundle.groupingRules, []);
      assemblyRules = cloneJson(bundle.assemblyRules, []);
      boxesQty = 1;
      startDateStr = bundle.originDate;
      const dateEl = document.getElementById('start-date');
      if (dateEl) dateEl.value = startDateStr;
      const boxesEl = document.getElementById('boxes-qty');
      if (boxesEl) boxesEl.value = 1;
      applyStartTimeToState(bundle.originTime || DEFAULT_START_TIME);
      const simDate = document.getElementById('sim-start-date');
      if (simDate) simDate.value = startDateStr;
      const totalBoxes = (bundle.queue || []).reduce((n, item) => n + (Number(item.boxesQty) || 0), 0) || 1;
      const simBoxes = document.getElementById('sim-boxes-qty');
      if (simBoxes) {
        simBoxes.value = totalBoxes;
        simBoxes.disabled = true;
      }
      const simTime = document.getElementById('sim-start-time');
      if (simTime) simTime.disabled = true;
      const banner = document.getElementById('sim-plan-banner');
      if (banner) banner.hidden = false;
      planSimulationActive = true;
      simulationMode = 'plan';
      if (typeof applyAnalyticsKpiTitles === 'function') applyAnalyticsKpiTitles(true);
    }

    function clearPlanSimChrome() {
      const simBoxes = document.getElementById('sim-boxes-qty');
      if (simBoxes) simBoxes.disabled = false;
      const simTime = document.getElementById('sim-start-time');
      if (simTime) simTime.disabled = false;
      const banner = document.getElementById('sim-plan-banner');
      if (banner) banner.hidden = true;
      if (typeof applyAnalyticsKpiTitles === 'function') applyAnalyticsKpiTitles(false);
    }

    function activatePlanRuntimeIfNeeded() {
      if (simulationMode === 'plan' && planRuntimeBundle) {
        applyPlanBundle(planRuntimeBundle);
        return true;
      }
      return false;
    }

    function preparePlanRuntime() {
      restoreEngineeringSessionIfNeeded();
      const snap = captureEngineeringSession();
      const bundle = buildMergedPlanBundle();
      if (!bundle) return null;
      engineeringSnapshot = snap;
      planRuntimeBundle = bundle;
      applyPlanBundle(bundle);
      return bundle;
    }

    function clearPlanSimulationMode() {
      simulationMode = 'single';
      planSimulationActive = false;
      planRuntimeBundle = null;
      currentPlanQueueMeta = [];
      if (typeof ganttViewMode !== 'undefined') ganttViewMode = 'day';
      clearPlanSimChrome();
    }

    function startPlanSimulation() {
      const bundle = preparePlanRuntime();
      if (!bundle) return;
      if (typeof ganttViewMode !== 'undefined') ganttViewMode = 'lot';
      if (typeof launchSimulationPlayback === 'function') {
        launchSimulationPlayback();
      } else {
        calculateSimulationHistory();
        if (typeof syncProjectNameUI === 'function') syncProjectNameUI();
        if (typeof renderCharts === 'function') renderCharts();
        navigateTo('screen-sim');
      }
    }

    function exportPlanPDFReport() {
      const bundle = preparePlanRuntime();
      if (!bundle) return;
      calculateSimulationHistory();
      if (typeof syncProjectNameUI === 'function') syncProjectNameUI();
      if (typeof renderCharts === 'function') renderCharts();
      if (typeof generatePDFReport === 'function') generatePDFReport();
    }

    function computePlanItemSummaries() {
      const queue = (typeof currentPlanQueueMeta !== 'undefined' && currentPlanQueueMeta) || productionPlanQueue || [];
      return queue.map((item, idx) => {
        let events = (rawEvents || []).filter(e => item.id && e.planItemId === item.id);
        if (!events.length) {
          events = (rawEvents || []).filter(e =>
            e.planProjectName === item.projectName && (Number(e.planOrder) || 0) === idx
          );
        }
        let minStart = Infinity;
        let maxEnd = 0;
        events.forEach(e => {
          const start = e.setupStart != null ? e.setupStart : e.arrivalTime;
          if (start < minStart) minStart = start;
          if (e.end > maxEnd) maxEnd = e.end;
        });
        return {
          order: idx + 1,
          projectName: item.projectName,
          boxesQty: item.boxesQty,
          trigger: formatPlanTrigger(item).label,
          startAbs: minStart === Infinity ? null : minStart,
          endAbs: maxEnd || null
        };
      });
    }
