/* PCPMaster v1.10.0 — Manipulação de DOM, timeline, relógio, tabelas, Gantt, jornada das peças, custos MOD e PDF */

    function readFlexibleNumber(id, fallback) {
      const el = document.getElementById(id);
      const raw = el ? el.value : '';
      if (typeof parseFlexibleNumber === 'function') return parseFlexibleNumber(raw, fallback);
      const n = parseFloat(String(raw).replace(',', '.'));
      return isFinite(n) ? n : fallback;
    }

    function readTimeMinutes(id, fallback) {
      const el = document.getElementById(id);
      const raw = el ? el.value : '';
      if (typeof parseTimeMinutes === 'function') return parseTimeMinutes(raw, fallback);
      const n = parseFloat(String(raw).replace(',', '.'));
      return (isFinite(n) && n >= 0) ? n : fallback;
    }

    function fmtStepTime(mins) {
      return typeof formatDurationMinutes === 'function' ? formatDurationMinutes(mins) : (mins + 'm');
    }

    /** Exibição de relatório: minutos inteiros, sem alterar o evento simulado. */
    function formatCurrency(valor) {
      const n = Number(valor);
      const v = isFinite(n) ? n : 0;
      return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatReportMinutes(mins) {
      const n = Number(mins);
      if (!isFinite(n) || n <= 0) return '0';
      return String(Math.round(n));
    }

    /** Horário de relatório em HH:mm (minuto arredondado; sem segundos). */
    function formatReportClock(absMin) {
      if (typeof absMin === 'string') {
        const raw = absMin.trim();
        if (!raw || raw === '—') return raw || '—';
        return raw.replace(/(\d{1,2}):(\d+(?:\.\d+)?)/g, function (_, hh, mm) {
          let total = (Number(hh) * 60) + Number(mm);
          if (!isFinite(total)) return hh + ':' + mm;
          total = Math.round(total);
          const h = Math.floor(total / 60) % 24;
          const m = ((total % 60) + 60) % 60;
          return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        });
      }
      const n = Number(absMin);
      if (!isFinite(n)) return '—';
      const label = typeof absMinuteToTimeLabel === 'function'
        ? absMinuteToTimeLabel(Math.round(n))
        : String(Math.round(n));
      return formatReportClock(label);
    }

    let appToastTimer = null;

    function showBackupExportedToast(projectCount) {
      const total = Math.max(0, Number(projectCount) || 0);
      showAppToast('✅ Backup exportado com sucesso! ' + total + ' projetos incluídos.');
    }

    function showAppToast(message) {
      const text = String(message || '').trim();
      if (!text) return;
      let host = document.getElementById('app-toast-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'app-toast-host';
        host.className = 'app-toast-host';
        host.setAttribute('aria-live', 'polite');
        host.setAttribute('role', 'status');
        document.body.appendChild(host);
      }
      host.innerHTML = '';
      const toast = document.createElement('div');
      toast.className = 'app-toast';
      toast.textContent = text;
      host.appendChild(toast);
      if (appToastTimer) clearTimeout(appToastTimer);
      appToastTimer = setTimeout(() => {
        toast.classList.add('is-leaving');
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 200);
      }, 4200);
    }

    function showEstufaValidationModal(message) {
      const overlay = document.getElementById('estufa-validation-modal');
      const body = document.getElementById('estufa-validation-message');
      if (body) body.textContent = message || '';
      if (overlay) {
        overlay.hidden = false;
        overlay.classList.add('is-open');
        const closeBtn = document.getElementById('estufa-validation-close');
        if (closeBtn) closeBtn.focus();
        return;
      }
      alert(message);
    }

    function closeEstufaValidationModal() {
      const overlay = document.getElementById('estufa-validation-modal');
      if (!overlay) return;
      overlay.hidden = true;
      overlay.classList.remove('is-open');
    }

    // --- EXEMPLO ---
    function loadExampleAndNavigate() {
      employees = [
        { id: 'e1', name: 'Carlos Operador', matricula: '1001', valor_hora: 28.5 },
        { id: 'e2', name: 'Ana Soldadora', matricula: '1002', valor_hora: 32 },
        { id: 'e3', name: 'Pedro Montagem', matricula: '1003', valor_hora: 25 }
      ];

      machines = [
        { id: "m1", name: "01. Corte Laser", pop: "Programa #102. Chapa 1.2mm e 1.5mm.", maintIntervalHours: 8, maintDurationHours: 1, defaultOperatorId: 'e1', lastMaintenanceDate: '2026-08-15', nextMaintenanceDate: '2026-09-30' },
        { id: "m2", name: "02. Dobra IMAG", pop: "Dobra do Núcleo e Dobradiça.", maintIntervalHours: 8, maintDurationHours: 1, defaultOperatorId: 'e1', lastMaintenanceDate: '2026-08-20', nextMaintenanceDate: '2026-10-05' },
        { id: "m3", name: "03. Solda MIG", pop: "Unir NUCLEO + TAMPA + ORGANIZADOR.", maintIntervalHours: 0, maintDurationHours: 0, defaultOperatorId: 'e2', lastMaintenanceDate: '', nextMaintenanceDate: '' },
        { id: "m4", name: "04. Banho / Pintura", pop: "Pintura Eletrostática do Subconjunto.", maintIntervalHours: 0, maintDurationHours: 0, defaultOperatorId: '', lastMaintenanceDate: '', nextMaintenanceDate: '' },
        { id: "m5", name: "05. Montagem Final", pop: "Montar Conjunto Tampa no CORPO.", maintIntervalHours: 8, maintDurationHours: 1, defaultOperatorId: 'e3', lastMaintenanceDate: '2026-09-01', nextMaintenanceDate: '2026-09-20' },
        { id: "m6", name: "06. Embalagem / Expedição", pop: "Caixa finalizada e embalada.", maintIntervalHours: 0, maintDurationHours: 0, defaultOperatorId: 'e3', lastMaintenanceDate: '', nextMaintenanceDate: '' }
      ];

      parts = [
        {
          name: "NUCLEO", thickness: 1.2, qty: 1,
          route: [
            { machineId: "m1", setup: 30, prodUnit: 40 },
            { machineId: "m2", setup: 20, prodUnit: 30 }
          ]
        },
        {
          name: "DOBRADICA", thickness: 1.2, qty: 1,
          route: [
            { machineId: "m1", setup: 30, prodUnit: 20 },
            { machineId: "m2", setup: 15, prodUnit: 25 }
          ]
        },
        {
          name: "TAMPA", thickness: 1.2, qty: 1,
          route: [
            { machineId: "m1", setup: 20, prodUnit: 30 }
          ]
        },
        {
          name: "ORGANIZADOR", thickness: 1.0, qty: 1,
          route: [
            { machineId: "m1", setup: 15, prodUnit: 25 }
          ]
        },
        {
          name: "CORPO", thickness: 1.5, qty: 1,
          route: [
            { machineId: "m1", setup: 40, prodUnit: 50 },
            { machineId: "m2", setup: 30, prodUnit: 40 }
          ]
        }
      ];

      groupingRules = [{ machineId: "m1", partNames: ["NUCLEO", "DOBRADICA"] }];
      assemblyRules = [
        {
          machineId: "m3",
          resultName: "CONJUNTO TAMPA COMPLETO",
          requiredPartNames: ["NUCLEO", "TAMPA", "ORGANIZADOR"],
          juncao: { requer: ["NUCLEO", "TAMPA", "ORGANIZADOR"], maquina: "m3" },
          setup: 30,
          prodUnit: 40,
          qty: 1,
          route: [{ machineId: "m4", setup: 20, prodUnit: 25 }]
        },
        {
          machineId: "m5",
          resultName: "CAIXA COMPLETA EMBALADA",
          requiredPartNames: ["CONJUNTO TAMPA COMPLETO", "CORPO"],
          juncao: { requer: ["CONJUNTO TAMPA COMPLETO", "CORPO"], maquina: "m5" },
          setup: 20,
          prodUnit: 30,
          qty: 1,
          route: [{ machineId: "m6", setup: 10, prodUnit: 15 }]
        }
      ];

      startDateStr = '2026-09-14';
      document.getElementById('start-date').value = startDateStr;
      applyStartTimeToState(DEFAULT_START_TIME);
      document.getElementById('boxes-qty').value = 1;
      if (typeof applyCustoDiarioFabrica === 'function') applyCustoDiarioFabrica(11363.64);
      currentProjectName = '';
      if (!holidays.includes('2026-11-02')) holidays.push('2026-11-02');
      const catalogBefore = getBaseCatalogFromDatabase();
      setProjectsDatabase(getProjectsDatabase(), {
        employees: mergeEntitiesById(employees, catalogBefore.employees, normalizeEmployee),
        machines: machines
      });
      if (typeof syncProjectNameUI === 'function') syncProjectNameUI({ syncInput: true });
      renderConfigUI();
      navigateTo('screen-config');
    }

    function startNewProject(fromSim) {
      const hasUnsavedProduction = fromSim
        || parts.length > 0
        || groupingRules.length > 0
        || assemblyRules.length > 0
        || !!currentProjectName
        || simulationHistory.length > 0;
      if (hasUnsavedProduction && !confirm('Deseja iniciar um novo projeto? As alterações não salvas do projeto atual serão perdidas.')) {
        return;
      }
      resetToNewProjectSession();
    }

    function resetSimulationView() {
      const tbody = document.getElementById('floor-status-body');
      if (tbody) tbody.innerHTML = '';
      const charts = document.getElementById('machine-charts-container');
      if (charts) charts.innerHTML = '';
      resetAnalyticsView();
      resetGanttView();
      resetPartJourneyView();
      const dayWrap = document.getElementById('day-select-wrap');
      if (dayWrap) dayWrap.style.display = 'none';
      const startAbs = getSimulationStartAbsMin();
      const timeline = document.getElementById('timeline');
      if (timeline) {
        timeline.value = startAbs;
        timeline.max = MINUTES_PER_DAY - 1;
      }
      const timelineLabel = document.getElementById('timeline-label');
      if (timelineLabel) timelineLabel.textContent = minuteInDayToTimeStr(startAbs);
      const simBoxes = document.getElementById('sim-boxes-qty');
      if (simBoxes) simBoxes.value = boxesQty || 1;
      const simDate = document.getElementById('sim-start-date');
      if (simDate) simDate.value = startDateStr || todayISODate();
      syncStartTimeInputs(startTimeStr || DEFAULT_START_TIME);
      const kpi = document.getElementById('kpi-status');
      if (kpi) {
        kpi.textContent = 'AGUARDANDO';
        kpi.style.color = '#94a3b8';
      }
      ensureWorkDaysCapacity(1);
      currentAbsSecond = startAbs * 60;
      selectedDayIndex = 0;
      renderClockOnly();
      updatePlayButtonUI();
      updateSpeedButtonsUI();
    }

    function resetToNewProjectSession() {
      if (typeof clearPlanSimulationMode === 'function') clearPlanSimulationMode();
      clearSimulationRuntime();
      resetProductionPlanState();
      employees = [];
      machines = [];
      persistBaseCatalog();
      const boxesEl = document.getElementById('boxes-qty');
      if (boxesEl) boxesEl.value = 1;
      applySmartStartDateTime();
      collapseEngineeringAccordions();
      resetPartForm();
      const asmName = document.getElementById('assembly-result-name');
      if (asmName) asmName.value = '';
      currentJoinBuildingRoute = [];
      const btnGroup = document.getElementById('btn-save-grouping');
      if (btnGroup) btnGroup.innerText = 'Agrupar Peças';
      const btnAsm = document.getElementById('btn-save-assembly');
      if (btnAsm) btnAsm.innerText = 'Criar Subconjunto';
      const btnEmp = document.getElementById('btn-save-employee');
      if (btnEmp) btnEmp.innerText = 'Adicionar Funcionário';
      const btnMach = document.getElementById('btn-save-machine');
      if (btnMach) btnMach.innerText = 'Adicionar Máquina';
      document.getElementById('new-employee-name').value = '';
      document.getElementById('new-employee-matricula').value = '';
      const horaReset = document.getElementById('new-employee-valor-hora');
      if (horaReset) horaReset.value = '';
      const postoSel = document.getElementById('new-employee-posto');
      if (postoSel) postoSel.value = '';
      if (typeof applyCustoDiarioFabrica === 'function') applyCustoDiarioFabrica(0);
      document.getElementById('new-machine-name').value = '';
      document.getElementById('new-machine-pop').value = '';
      document.getElementById('new-machine-maint-interval').value = '0';
      document.getElementById('new-machine-maint-duration').value = '0';
      document.getElementById('new-machine-last-maint').value = '';
      document.getElementById('new-machine-next-maint').value = '';
      if (typeof resetEstufaMachineForm === 'function') resetEstufaMachineForm();
      if (typeof resetSimEstufaCycleOverride === 'function') resetSimEstufaCycleOverride();
      resetSimulationView();
      if (typeof syncProjectNameUI === 'function') syncProjectNameUI({ syncInput: true });
      renderConfigUI();
      navigateTo('screen-config');
    }

    function syncProjectNameUI(options) {
      const name = (currentProjectName || '').trim();
      const input = document.getElementById('projeto_nome_topo') || document.getElementById('project-name-input');
      if (input && (options && options.syncInput || document.activeElement !== input)) {
        if (options && options.syncInput) input.value = name;
      }
      const el = document.getElementById('current-project-label');
      if (el) el.textContent = name || 'Não salvo (sem nome)';
      const simTitle = document.getElementById('sim-project-title');
      if (simTitle) {
        if (typeof isPlanSimulationMode === 'function' && isPlanSimulationMode() && (typeof currentPlanName === 'string') && currentPlanName.trim()) {
          simTitle.textContent = APP_NAME + ' v' + APP_VERSION + ' — Plano: ' + currentPlanName.trim();
        } else {
          simTitle.textContent = name
            ? (APP_NAME + ' v' + APP_VERSION + ' — ' + name)
            : (APP_NAME + ' v' + APP_VERSION + ' - Controle de Chão de Fábrica');
        }
      }
      const analyticsName = document.getElementById('analytics-project-name');
      if (analyticsName) {
        analyticsName.textContent = (typeof isPlanSimulationMode === 'function' && isPlanSimulationMode() && currentPlanName)
          ? ('Plano: ' + currentPlanName)
          : (name || 'Projeto sem nome');
      }
      if (typeof refreshTesterSkuBanner === 'function') refreshTesterSkuBanner();
    }

    function updateCurrentProjectLabel() {
      syncProjectNameUI();
    }

    function goToEngineeringRoutes() {
      navigateTo('screen-config');
      if (typeof setEngineeringAccordion === 'function') {
        setEngineeringAccordion('employees', false);
        setEngineeringAccordion('machines', false);
      }
      const section = document.getElementById('engineering-routes');
      if (section && typeof section.scrollIntoView === 'function') {
        window.setTimeout(function () {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 40);
      }
    }

    const ACCORDION_LABELS = {
      employees: { open: '[-] Recolher Funcionários', closed: '[+] Expandir Funcionários' },
      machines: { open: '[-] Recolher Máquinas', closed: '[+] Expandir Máquinas' }
    };

    function setEngineeringAccordion(kind, expanded) {
      const card = document.getElementById(kind + '-accordion');
      const btn = document.getElementById('btn-toggle-' + kind);
      if (!card) return;
      card.classList.toggle('is-collapsed', !expanded);
      if (btn) {
        const labels = ACCORDION_LABELS[kind];
        btn.textContent = expanded ? labels.open : labels.closed;
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      }
    }

    function toggleEngineeringAccordion(kind) {
      const card = document.getElementById(kind + '-accordion');
      const willExpand = !!(card && card.classList.contains('is-collapsed'));
      setEngineeringAccordion(kind, willExpand);
    }

    function collapseEngineeringAccordions() {
      setEngineeringAccordion('employees', false);
      setEngineeringAccordion('machines', false);
    }

    function renderSavedProjectsList() {
      const list = document.getElementById('saved-projects-list');
      if (!list) return;
      list.innerHTML = '';
      const saved = getProjectsDatabase();
      const names = Object.keys(saved).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      if (names.length === 0) {
        const empty = document.createElement('li');
        empty.style.color = '#64748b';
        empty.textContent = 'Nenhum projeto salvo.';
        list.appendChild(empty);
        return;
      }
      names.forEach(name => {
        const li = document.createElement('li');
        const info = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = name;
        info.appendChild(title);
        if (name === currentProjectName) {
          const tag = document.createElement('span');
          tag.className = 'saved-projects-current-tag';
          tag.textContent = 'Em edição';
          info.appendChild(tag);
        }
        const meta = document.createElement('div');
        meta.style.cssText = 'font-size:0.78rem; color:#94a3b8; margin-top:4px;';
        const proj = saved[name] || {};
      const nMachines = Array.isArray(proj.machines) && proj.machines.length
        ? proj.machines.length
        : countActiveMachinesInProject(proj);
        const nParts = Array.isArray(proj.parts) ? proj.parts.length : 0;
        meta.textContent = `${nMachines} máquina(s) ativas · ${nParts} peça(s) · ${proj.boxesQty || 1} caixa(s)`;
        info.appendChild(meta);

        const actions = document.createElement('div');
        const btnLoad = document.createElement('button');
        btnLoad.className = 'btn btn-success';
        btnLoad.style.cssText = 'padding:4px 10px; font-size:0.8rem; margin-right:5px;';
        btnLoad.textContent = 'Carregar';
        btnLoad.onclick = () => loadSavedProjectByName(name);
        const btnDel = document.createElement('button');
        btnDel.className = 'btn btn-danger';
        btnDel.textContent = 'Excluir';
        btnDel.onclick = () => deleteSavedProject(name);
        actions.appendChild(btnLoad);
        actions.appendChild(btnDel);

        li.appendChild(info);
        li.appendChild(actions);
        list.appendChild(li);
      });
    }

    function refreshSavedProjectsUI() {
      updateSavedProjectsSelect();
      renderSavedProjectsList();
      updateCurrentProjectLabel();
    }

    function fillEmployeePostoSelect(selectedId) {
      const sel = document.getElementById('new-employee-posto');
      if (!sel) return;
      const prev = selectedId != null ? selectedId : sel.value;
      const catalog = typeof getCatalogMachines === 'function' ? getCatalogMachines() : (machines || []);
      const seen = {};
      sel.innerHTML = '<option value="">— Sem setor —</option>';
      catalog.forEach(m => {
        if (!m || !m.id || seen[m.id]) return;
        seen[m.id] = true;
        sel.innerHTML += `<option value="${m.id}">${m.name}</option>`;
      });
      if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
    }

    function employeePostoFromForm() {
      const sel = document.getElementById('new-employee-posto');
      const postoId = sel ? sel.value : '';
      let setor = '';
      if (postoId) {
        const catalog = typeof getCatalogMachines === 'function' ? getCatalogMachines() : (machines || []);
        const m = lookupMachine(postoId) || catalog.find(x => x && x.id === postoId);
        setor = m ? m.name : '';
      }
      return { postoId, setor };
    }

    // --- FUNCIONÁRIOS ---
    function addEmployee() {
      const name = document.getElementById('new-employee-name').value.trim();
      const matricula = document.getElementById('new-employee-matricula').value.trim();
      if (!name) { alert('Informe o nome do funcionário.'); return; }
      if (!matricula) { alert('Informe a matrícula.'); return; }

      const catalogEmps = typeof getCatalogEmployees === 'function' ? getCatalogEmployees() : (employees || []);
      const editingId = editingEmployeeIndex >= 0 ? employees[editingEmployeeIndex].id : '';
      const duplicate = catalogEmps.some(e =>
        e.matricula && e.matricula.toLowerCase() === matricula.toLowerCase() && e.id !== editingId
      );
      if (duplicate) { alert('Já existe um funcionário com esta matrícula no Catálogo Global.'); return; }

      const posto = employeePostoFromForm();
      const horaEl = document.getElementById('new-employee-valor-hora');
      const data = normalizeEmployee({
        id: editingEmployeeIndex >= 0 ? employees[editingEmployeeIndex].id : ('e' + Date.now()),
        name,
        matricula,
        setor: posto.setor,
        postoId: posto.postoId,
        valor_hora: horaEl ? horaEl.value : 0
      });

      if (editingEmployeeIndex >= 0) {
        employees[editingEmployeeIndex] = data;
        editingEmployeeIndex = -1;
        document.getElementById('btn-save-employee').innerText = 'Adicionar Funcionário';
      } else {
        employees.push(data);
      }

      document.getElementById('new-employee-name').value = '';
      document.getElementById('new-employee-matricula').value = '';
      const horaClear = document.getElementById('new-employee-valor-hora');
      if (horaClear) horaClear.value = '';
      const postoSel = document.getElementById('new-employee-posto');
      if (postoSel) postoSel.value = '';
      persistBaseCatalog();
      renderConfigUI();
    }

    function editEmployee(idx) {
      const e = employees[idx];
      editingEmployeeIndex = idx;
      document.getElementById('new-employee-name').value = e.name;
      document.getElementById('new-employee-matricula').value = e.matricula;
      const horaEdit = document.getElementById('new-employee-valor-hora');
      if (horaEdit) horaEdit.value = (Number(e.valor_hora) > 0) ? String(e.valor_hora) : '';
      fillEmployeePostoSelect(e.postoId || '');
      document.getElementById('btn-save-employee').innerText = 'Salvar Alterações';
    }

    function removeEmployee(idx) {
      const target = employees[idx];
      if (!target) return;
      if (!confirm(`Remover "${target.name}" deste projeto?\n\nO cadastro permanece no Catálogo Global e poderá ser incluído novamente.`)) {
        return;
      }
      const removedId = target.id;
      employees.splice(idx, 1);
      machines.forEach(m => {
        if (m.defaultOperatorId === removedId) m.defaultOperatorId = '';
      });
      if (editingEmployeeIndex === idx) {
        editingEmployeeIndex = -1;
        document.getElementById('btn-save-employee').innerText = 'Adicionar Funcionário';
        document.getElementById('new-employee-name').value = '';
        document.getElementById('new-employee-matricula').value = '';
        const horaClear = document.getElementById('new-employee-valor-hora');
        if (horaClear) horaClear.value = '';
        const postoSel = document.getElementById('new-employee-posto');
        if (postoSel) postoSel.value = '';
      } else if (editingEmployeeIndex > idx) {
        editingEmployeeIndex--;
      }
      renderConfigUI();
    }

    function fillMachineOperatorSelect(selectedId) {
      const sel = document.getElementById('new-machine-operator');
      if (!sel) return;
      const catalog = typeof getCatalogEmployees === 'function' ? getCatalogEmployees() : (employees || []);
      sel.innerHTML = '<option value="">— Sem operador —</option>';
      catalog.forEach(e => {
        if (!e || !e.id) return;
        sel.innerHTML += `<option value="${e.id}">${e.name} (${e.matricula})</option>`;
      });
      if (selectedId && [...sel.options].some(o => o.value === selectedId)) {
        sel.value = selectedId;
      }
    }

    function fillCatalogEmployeeSelect() {
      const sel = document.getElementById('catalog-employee-select');
      const hint = document.getElementById('catalog-employee-hint');
      if (!sel) return;
      const available = typeof getCatalogEmployeesAvailableForProject === 'function'
        ? getCatalogEmployeesAvailableForProject()
        : [];
      const catalogCount = typeof getCatalogEmployees === 'function' ? getCatalogEmployees().length : 0;
      sel.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      if (available.length === 0) {
        placeholder.textContent = catalogCount === 0
          ? '— Catálogo vazio: cadastre um operador —'
          : '— Todos os operadores do catálogo já estão neste projeto —';
      } else {
        placeholder.textContent = '— Selecione um operador do catálogo —';
      }
      sel.appendChild(placeholder);
      available.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        const setor = e.setor ? ` · ${e.setor}` : '';
        opt.textContent = `${e.name} (${e.matricula})${setor}`;
        sel.appendChild(opt);
      });
      if (hint) {
        hint.textContent = `Catálogo Global: ${catalogCount} operador(es) · ${available.length} disponível(is) para este projeto.`;
      }
    }

    function addCatalogEmployeeToProject() {
      const sel = document.getElementById('catalog-employee-select');
      const id = sel ? sel.value : '';
      if (!id) {
        alert('Selecione um operador do Catálogo Global para incluir neste projeto.');
        return;
      }
      if (employees.some(e => e.id === id)) {
        alert('Este operador já está ativo neste projeto.');
        renderConfigUI();
        return;
      }
      const found = getCatalogEmployees().find(e => e.id === id);
      if (!found) {
        alert('Operador não encontrado no Catálogo Global.');
        renderConfigUI();
        return;
      }
      employees.push(normalizeEmployee(cloneJson(found, found)));
      renderConfigUI();
    }

    // --- MÁQUINAS ---
    function updateEstufaMachineVolumeHint() {
      const h = parseFloat(document.getElementById('new-machine-estufa-h') && document.getElementById('new-machine-estufa-h').value) || 0;
      const w = parseFloat(document.getElementById('new-machine-estufa-w') && document.getElementById('new-machine-estufa-w').value) || 0;
      const d = parseFloat(document.getElementById('new-machine-estufa-d') && document.getElementById('new-machine-estufa-d').value) || 0;
      const hint = document.getElementById('estufa-machine-volume-hint');
      if (!hint) return;
      const vol = h * w * d;
      const q = readEstufaFormCycleMinutes().queima;
      const r = readEstufaFormCycleMinutes().resfrio;
      const cycleTxt = q + ' queima + ' + r + ' resfriamento';
      hint.textContent = vol > 0
        ? ('Volume: ' + vol.toFixed(3) + ' m³ · Ciclo ' + cycleTxt)
        : ('Volume: — · Ciclo ' + cycleTxt);
    }

    function readEstufaFormCycleMinutes() {
      const parseFn = typeof parseEstufaCycleMinutes === 'function' ? parseEstufaCycleMinutes : function (raw, fb, minV) {
        const n = parseFloat(String(raw).replace(',', '.'));
        return (isFinite(n) && n >= minV) ? n : fb;
      };
      const qEl = document.getElementById('maquina_tempo_queima');
      const rEl = document.getElementById('maquina_tempo_resfriamento');
      return {
        queima: parseFn(qEl && qEl.value, ESTUFA_QUEIMA_MIN, 1),
        resfrio: parseFn(rEl && rEl.value, ESTUFA_RESFRIO_MIN, 0)
      };
    }

    function syncEstufaMachineForm() {
      const nameEl = document.getElementById('new-machine-name');
      const cb = document.getElementById('new-machine-is-estufa');
      if (!cb) return;
      const looks = typeof machineNameLooksEstufa === 'function' && machineNameLooksEstufa(nameEl && nameEl.value);
      if (document.activeElement === cb) cb.dataset.userToggled = '1';
      if (looks && !cb.dataset.userToggled) cb.checked = true;
      const cycleRow = document.getElementById('estufa-cycle-fields');
      if (cycleRow) cycleRow.hidden = !(cb.checked || looks);
      updateEstufaMachineVolumeHint();
    }

    function readEstufaMachineForm(name) {
      const cb = document.getElementById('new-machine-is-estufa');
      const isEstufa = !!(cb && cb.checked) || (typeof machineNameLooksEstufa === 'function' && machineNameLooksEstufa(name));
      const h = parseFloat(document.getElementById('new-machine-estufa-h') && document.getElementById('new-machine-estufa-h').value);
      const w = parseFloat(document.getElementById('new-machine-estufa-w') && document.getElementById('new-machine-estufa-w').value);
      const d = parseFloat(document.getElementById('new-machine-estufa-d') && document.getElementById('new-machine-estufa-d').value);
      const cycle = readEstufaFormCycleMinutes();
      return {
        isEstufa,
        estufaAlturaM: isEstufa ? ((h > 0) ? h : ESTUFA_CABIN_H) : (h > 0 ? h : 0),
        estufaLarguraM: isEstufa ? ((w > 0) ? w : ESTUFA_CABIN_W) : (w > 0 ? w : 0),
        estufaProfundidadeM: isEstufa ? ((d > 0) ? d : ESTUFA_CABIN_D) : (d > 0 ? d : 0),
        tempo_queima_default: cycle.queima,
        tempo_resfriamento_default: cycle.resfrio
      };
    }

    function resetEstufaMachineForm() {
      const cb = document.getElementById('new-machine-is-estufa');
      if (cb) {
        cb.checked = false;
        delete cb.dataset.userToggled;
      }
      const hEl = document.getElementById('new-machine-estufa-h');
      const wEl = document.getElementById('new-machine-estufa-w');
      const dEl = document.getElementById('new-machine-estufa-d');
      const qEl = document.getElementById('maquina_tempo_queima');
      const rEl = document.getElementById('maquina_tempo_resfriamento');
      if (hEl) hEl.value = '2.00';
      if (wEl) wEl.value = '1.75';
      if (dEl) dEl.value = '3.85';
      if (qEl) qEl.value = String(ESTUFA_QUEIMA_MIN);
      if (rEl) rEl.value = String(ESTUFA_RESFRIO_MIN);
      const cycleRow = document.getElementById('estufa-cycle-fields');
      if (cycleRow) cycleRow.hidden = true;
      updateEstufaMachineVolumeHint();
    }

    let simEstufaCycleUserEdited = false;

    function resetSimEstufaCycleOverride() {
      simEstufaCycleUserEdited = false;
      const qEl = document.getElementById('sim_tempo_queima');
      const rEl = document.getElementById('sim_tempo_resfriamento');
      if (qEl) qEl.value = String(ESTUFA_QUEIMA_MIN);
      if (rEl) rEl.value = String(ESTUFA_RESFRIO_MIN);
      if (typeof syncSimEstufaCycleFields === 'function') syncSimEstufaCycleFields({ fillIfEmpty: true, forceFromMachine: true });
    }

    function estufaCycleHintText() {
      const ev = (typeof rawEvents !== 'undefined' ? rawEvents : []).find(e => e && e.isEstufaBatch);
      if (ev && ev.estufaQueimaMin != null) {
        return ev.estufaQueimaMin + ' min queima + ' + (ev.estufaResfrioMin || 0) + ' min resfriamento + descarregar';
      }
      if (typeof resolveEstufaCycleMinutes === 'function') {
        const c = resolveEstufaCycleMinutes();
        return c.queima + ' min queima + ' + c.resfrio + ' min resfriamento + descarregar (prod/peça)';
      }
      return '30 min queima + 30 min resfriamento + descarregar (prod/peça)';
    }

    function updateSimEstufaCycleIndicator() {
      const el = document.getElementById('sim-estufa-cycle-indicator');
      const panel = document.getElementById('sim-estufa-cycle-panel');
      const m = typeof getPrimaryEstufaMachine === 'function' ? getPrimaryEstufaMachine() : null;
      if (panel) panel.hidden = !m;
      if (!el) return;
      if (!m) {
        el.textContent = '';
        el.classList.remove('is-modified');
        return;
      }
      const defs = typeof getEstufaMachineCycleDefaults === 'function'
        ? getEstufaMachineCycleDefaults(m)
        : { queima: ESTUFA_QUEIMA_MIN, resfrio: ESTUFA_RESFRIO_MIN };
      const qEl = document.getElementById('sim_tempo_queima');
      const rEl = document.getElementById('sim_tempo_resfriamento');
      const qStr = qEl ? String(qEl.value).trim() : '';
      const rStr = rEl ? String(rEl.value).trim() : '';
      const parseFn = typeof parseEstufaCycleMinutes === 'function'
        ? parseEstufaCycleMinutes
        : function (raw, fb, minV) {
            const n = parseFloat(String(raw).replace(',', '.'));
            return (isFinite(n) && n >= minV) ? n : fb;
          };
      const q = qStr === '' ? defs.queima : parseFn(qStr, defs.queima, 1);
      const r = rStr === '' ? defs.resfrio : parseFn(rStr, defs.resfrio, 0);
      const modified = q !== defs.queima || r !== defs.resfrio;
      el.textContent = modified ? 'Modificado para esta Simulação' : 'Valores Padrão da Máquina';
      el.classList.toggle('is-modified', modified);
    }

    function syncSimEstufaCycleFields(options) {
      const force = !!(options && options.forceFromMachine);
      const fillIfEmpty = !!(options && options.fillIfEmpty);
      const m = typeof getPrimaryEstufaMachine === 'function' ? getPrimaryEstufaMachine() : null;
      const panel = document.getElementById('sim-estufa-cycle-panel');
      if (panel) panel.hidden = !m;
      if (!m) {
        updateSimEstufaCycleIndicator();
        return;
      }
      const defs = typeof getEstufaMachineCycleDefaults === 'function'
        ? getEstufaMachineCycleDefaults(m)
        : { queima: ESTUFA_QUEIMA_MIN, resfrio: ESTUFA_RESFRIO_MIN };
      const qEl = document.getElementById('sim_tempo_queima');
      const rEl = document.getElementById('sim_tempo_resfriamento');
      const qEmpty = qEl && String(qEl.value).trim() === '';
      const rEmpty = rEl && String(rEl.value).trim() === '';
      if (force || (!simEstufaCycleUserEdited && (fillIfEmpty || qEmpty))) {
        if (qEl) qEl.value = String(defs.queima);
      }
      if (force || (!simEstufaCycleUserEdited && (fillIfEmpty || rEmpty))) {
        if (rEl) rEl.value = String(defs.resfrio);
      }
      updateSimEstufaCycleIndicator();
    }

    function updatePartVolumeHint() {
      const hint = document.getElementById('part-volume-hint');
      if (!hint) return;
      const dims = readPartDimFields();
      const volPeca = Number(dims.volume_peca_m3 || dims.volume_unitario_com_folga) || 0;
      const volFardo = Number(dims.volume_fardo_m3 || dims.volume_fardo) || 0;
      const n = dims.peca_max_fardo || 1;
      if (volPeca <= 0) {
        hint.textContent = 'Volume útil: — (sem dimensões, 1 fardo ocupa a cabine inteira)';
        return;
      }
      const fmt = typeof formatVolumeM3 === 'function'
        ? formatVolumeM3
        : (v) => (Number(v) < 0.01 ? Number(v).toFixed(4) : Number(v).toFixed(4)).replace('.', ',');
      hint.textContent = 'Volume Peça: ' + fmt(volPeca) + ' m³ | Volume Fardo (' + n + ' pcs): ' + fmt(volFardo) + ' m³';
    }

    function readPartDimFields() {
      const raw = {
        peca_altura_mm: parseFloat(document.getElementById('peca_altura_mm') && document.getElementById('peca_altura_mm').value) || 0,
        peca_largura_mm: parseFloat(document.getElementById('peca_largura_mm') && document.getElementById('peca_largura_mm').value) || 0,
        peca_comprimento_mm: parseFloat(document.getElementById('peca_comprimento_mm') && document.getElementById('peca_comprimento_mm').value) || 0,
        peca_max_fardo: parseInt(document.getElementById('peca_max_fardo') && document.getElementById('peca_max_fardo').value, 10) || 1,
        peca_espacamento_mm: parseFloat(document.getElementById('peca_espacamento_mm') && document.getElementById('peca_espacamento_mm').value) || 0
      };
      return typeof normalizePartDims === 'function' ? normalizePartDims(raw) : raw;
    }

    function fillPartDimFields(p) {
      const dims = typeof normalizePartDims === 'function' ? normalizePartDims(p || {}) : (p || {});
      const hEl = document.getElementById('peca_altura_mm');
      const wEl = document.getElementById('peca_largura_mm');
      const dEl = document.getElementById('peca_comprimento_mm');
      const ppfEl = document.getElementById('peca_max_fardo');
      const gapEl = document.getElementById('peca_espacamento_mm');
      if (hEl) hEl.value = dims.peca_altura_mm || 0;
      if (wEl) wEl.value = dims.peca_largura_mm || 0;
      if (dEl) dEl.value = dims.peca_comprimento_mm || 0;
      if (ppfEl) ppfEl.value = dims.peca_max_fardo || 1;
      if (gapEl) gapEl.value = dims.peca_espacamento_mm || 0;
      updatePartVolumeHint();
    }

    function addMachine() {
      const name = document.getElementById('new-machine-name').value.trim();
      const pop = document.getElementById('new-machine-pop').value.trim();
      const maintIntervalHours = readFlexibleNumber('new-machine-maint-interval', 0);
      const maintDurationHours = readFlexibleNumber('new-machine-maint-duration', 0);
      const defaultOperatorId = document.getElementById('new-machine-operator').value || '';
      const lastMaintenanceDate = document.getElementById('new-machine-last-maint').value || '';
      const nextMaintenanceDate = document.getElementById('new-machine-next-maint').value || '';
      if (!name) { alert('Informe o nome da máquina.'); return; }
      if (lastMaintenanceDate && nextMaintenanceDate && nextMaintenanceDate < lastMaintenanceDate) {
        alert('A data da próxima manutenção deve ser igual ou posterior à última.');
        return;
      }

      const estufa = readEstufaMachineForm(name);
      const data = {
        id: editingMachineIndex >= 0 ? machines[editingMachineIndex].id : ("m" + Date.now()),
        name,
        pop: pop || "Procedimento Padrão.",
        maintIntervalHours,
        maintDurationHours,
        defaultOperatorId,
        lastMaintenanceDate,
        nextMaintenanceDate,
        isEstufa: estufa.isEstufa,
        estufaAlturaM: estufa.estufaAlturaM,
        estufaLarguraM: estufa.estufaLarguraM,
        estufaProfundidadeM: estufa.estufaProfundidadeM,
        tempo_queima_default: estufa.tempo_queima_default,
        tempo_resfriamento_default: estufa.tempo_resfriamento_default
      };

      if (editingMachineIndex >= 0) {
        machines[editingMachineIndex] = data;
        editingMachineIndex = -1;
        document.getElementById('btn-save-machine').innerText = 'Adicionar Máquina';
      } else {
        machines.push(data);
      }

      document.getElementById('new-machine-name').value = '';
      document.getElementById('new-machine-pop').value = '';
      document.getElementById('new-machine-maint-interval').value = '0';
      document.getElementById('new-machine-maint-duration').value = '0';
      document.getElementById('new-machine-last-maint').value = '';
      document.getElementById('new-machine-next-maint').value = '';
      resetEstufaMachineForm();
      fillMachineOperatorSelect('');
      persistBaseCatalog();
      renderConfigUI();
    }

    function editMachine(idx) {
      const m = machines[idx];
      editingMachineIndex = idx;
      document.getElementById('new-machine-name').value = m.name;
      document.getElementById('new-machine-pop').value = m.pop || '';
      document.getElementById('new-machine-maint-interval').value = m.maintIntervalHours || 0;
      document.getElementById('new-machine-maint-duration').value = m.maintDurationHours || 0;
      document.getElementById('new-machine-last-maint').value = m.lastMaintenanceDate || '';
      document.getElementById('new-machine-next-maint').value = m.nextMaintenanceDate || '';
      const cb = document.getElementById('new-machine-is-estufa');
      if (cb) {
        cb.checked = !!m.isEstufa || (typeof machineNameLooksEstufa === 'function' && machineNameLooksEstufa(m.name));
        cb.dataset.userToggled = '1';
      }
      const hEl = document.getElementById('new-machine-estufa-h');
      const wEl = document.getElementById('new-machine-estufa-w');
      const dEl = document.getElementById('new-machine-estufa-d');
      if (hEl) hEl.value = (m.estufaAlturaM || ESTUFA_CABIN_H).toFixed ? Number(m.estufaAlturaM || ESTUFA_CABIN_H) : ESTUFA_CABIN_H;
      if (wEl) wEl.value = Number(m.estufaLarguraM || ESTUFA_CABIN_W);
      if (dEl) dEl.value = Number(m.estufaProfundidadeM || ESTUFA_CABIN_D);
      const qEl = document.getElementById('maquina_tempo_queima');
      const rEl = document.getElementById('maquina_tempo_resfriamento');
      const defs = typeof getEstufaMachineCycleDefaults === 'function'
        ? getEstufaMachineCycleDefaults(m)
        : { queima: ESTUFA_QUEIMA_MIN, resfrio: ESTUFA_RESFRIO_MIN };
      if (qEl) qEl.value = String(defs.queima);
      if (rEl) rEl.value = String(defs.resfrio);
      syncEstufaMachineForm();
      fillMachineOperatorSelect(m.defaultOperatorId || '');
      document.getElementById('btn-save-machine').innerText = 'Salvar Alterações';
    }

    function removeMachine(idx) {
      const target = machines[idx];
      if (!target) return;
      if (!confirm(`Remover "${target.name}" deste projeto?\n\nO cadastro permanece no Catálogo Global e poderá ser incluído novamente.`)) {
        return;
      }
      const removedId = target.id;
      machines.splice(idx, 1);
      parts.forEach(p => p.route = p.route.filter(s => s.machineId !== removedId));
      groupingRules = groupingRules.filter(g => g.machineId !== removedId);
      assemblyRules = assemblyRules.filter(a => a.machineId !== removedId);
      if (editingMachineIndex === idx) {
        editingMachineIndex = -1;
        document.getElementById('btn-save-machine').innerText = 'Adicionar Máquina';
        document.getElementById('new-machine-name').value = '';
        document.getElementById('new-machine-pop').value = '';
        document.getElementById('new-machine-maint-interval').value = '0';
        document.getElementById('new-machine-maint-duration').value = '0';
        document.getElementById('new-machine-last-maint').value = '';
        document.getElementById('new-machine-next-maint').value = '';
        if (typeof resetEstufaMachineForm === 'function') resetEstufaMachineForm();
        fillMachineOperatorSelect('');
      } else if (editingMachineIndex > idx) {
        editingMachineIndex--;
      }
      renderConfigUI();
    }

    function fillCatalogMachineSelect() {
      const sel = document.getElementById('catalog-machine-select');
      const hint = document.getElementById('catalog-machine-hint');
      if (!sel) return;
      const available = getCatalogMachinesAvailableForProject();
      const catalogCount = getCatalogMachines().length;
      sel.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      if (available.length === 0) {
        placeholder.textContent = catalogCount === 0
          ? '— Catálogo vazio: cadastre uma máquina —'
          : '— Todas as máquinas do catálogo já estão neste projeto —';
      } else {
        placeholder.textContent = '— Selecione uma máquina do catálogo —';
      }
      sel.appendChild(placeholder);
      available.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        const op = getMachineOperatorLabel(m);
        opt.textContent = op && op !== '-' ? `${m.name} · ${op}` : m.name;
        sel.appendChild(opt);
      });
      if (hint) {
        hint.textContent = `Catálogo Global: ${catalogCount} máquina(s) · ${available.length} disponível(is) para este projeto.`;
      }
    }

    function addCatalogMachineToProject() {
      const sel = document.getElementById('catalog-machine-select');
      const id = sel ? sel.value : '';
      if (!id) {
        alert('Selecione uma máquina do Catálogo Global para incluir neste projeto.');
        return;
      }
      if (machines.some(m => m.id === id)) {
        alert('Esta máquina já está ativa neste projeto.');
        renderConfigUI();
        return;
      }
      const found = getCatalogMachines().find(m => m.id === id);
      if (!found) {
        alert('Máquina não encontrada no Catálogo Global.');
        renderConfigUI();
        return;
      }
      machines.push(normalizeMachine(cloneJson(found, found)));
      renderConfigUI();
    }

    // --- PEÇAS ---
    const dndState = { kind: '', from: -1, partIdx: -1 };

    function persistActiveProjectState() {
      if (currentProjectName && typeof persistSavedProject === 'function') {
        persistSavedProject(currentProjectName);
      }
    }

    function moveArrayItem(arr, fromIdx, toIdx) {
      if (!arr || fromIdx === toIdx) return false;
      if (!Number.isInteger(fromIdx) || !Number.isInteger(toIdx)) return false;
      if (fromIdx < 0 || toIdx < 0 || fromIdx >= arr.length || toIdx >= arr.length) return false;
      const item = arr.splice(fromIdx, 1)[0];
      arr.splice(toIdx, 0, item);
      return true;
    }

    function dropDestinationIndex(fromIdx, targetIdx, placeAfter) {
      let dest = placeAfter ? targetIdx + 1 : targetIdx;
      if (fromIdx < dest) dest -= 1;
      return dest;
    }

    function clearDragMarks(root) {
      if (!root) return;
      root.querySelectorAll('.is-dragging, .drag-over-before, .drag-over-after').forEach(el => {
        el.classList.remove('is-dragging', 'drag-over-before', 'drag-over-after');
      });
    }

    function isNestedDraggable(e, item) {
      const src = e.target.closest('[draggable="true"]');
      return !!(src && item && src !== item && item.contains(src));
    }

    function bindSortable(container, options) {
      if (!container) return;
      const boundKey = 'dnd' + options.kind.replace(/[^a-zA-Z0-9]/g, '');
      if (container.dataset[boundKey]) return;
      container.dataset[boundKey] = '1';
      const itemSelector = options.itemSelector;
      const axis = options.axis || 'y';

      container.addEventListener('dragstart', (e) => {
        const item = e.target.closest(itemSelector);
        if (!item || !container.contains(item)) return;
        if (options.ignoreSelector && e.target.closest(options.ignoreSelector)) {
          if (!isNestedDraggable(e, item)) e.preventDefault();
          return;
        }
        if (typeof options.allowDrag === 'function' && !options.allowDrag(e, item)) {
          if (!isNestedDraggable(e, item)) e.preventDefault();
          return;
        }
        dndState.kind = options.kind;
        dndState.from = Number(item.getAttribute(options.indexAttr));
        dndState.partIdx = options.partIndexAttr
          ? Number(item.getAttribute(options.partIndexAttr))
          : -1;
        item.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(dndState.from));
        if (e.stopPropagation) e.stopPropagation();
      });

      container.addEventListener('dragover', (e) => {
        if (dndState.kind !== options.kind) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (e.stopPropagation) e.stopPropagation();
        const item = e.target.closest(itemSelector);
        container.querySelectorAll(itemSelector).forEach(el => {
          el.classList.remove('drag-over-before', 'drag-over-after');
        });
        if (!item || item.classList.contains('is-dragging')) return;
        const box = item.getBoundingClientRect();
        const mid = axis === 'x' ? box.left + box.width / 2 : box.top + box.height / 2;
        const pos = axis === 'x' ? e.clientX : e.clientY;
        item.classList.add(pos < mid ? 'drag-over-before' : 'drag-over-after');
      });

      container.addEventListener('drop', (e) => {
        if (dndState.kind !== options.kind) return;
        e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        const item = e.target.closest(itemSelector);
        const fromIdx = dndState.from;
        let toIdx = fromIdx;
        if (item && !item.classList.contains('is-dragging')) {
          const targetIdx = Number(item.getAttribute(options.indexAttr));
          const placeAfter = item.classList.contains('drag-over-after');
          toIdx = dropDestinationIndex(fromIdx, targetIdx, placeAfter);
        }
        const partIdx = dndState.partIdx;
        clearDragMarks(container);
        dndState.kind = '';
        dndState.from = -1;
        dndState.partIdx = -1;
        if (fromIdx !== toIdx) options.onReorder(fromIdx, toIdx, partIdx);
      });

      container.addEventListener('dragend', () => {
        clearDragMarks(container);
        dndState.kind = '';
        dndState.from = -1;
        dndState.partIdx = -1;
      });
    }

    function reorderPrimaryParts(fromIdx, toIdx) {
      if (!moveArrayItem(parts, fromIdx, toIdx)) return;
      if (editingPartIndex === fromIdx) editingPartIndex = toIdx;
      else if (fromIdx < editingPartIndex && toIdx >= editingPartIndex) editingPartIndex -= 1;
      else if (fromIdx > editingPartIndex && toIdx <= editingPartIndex) editingPartIndex += 1;
      persistActiveProjectState();
      renderConfigUI();
    }

    function reorderSavedPartRoute(partIdx, fromIdx, toIdx) {
      const part = parts[partIdx];
      if (!part || !Array.isArray(part.route)) return;
      if (!moveArrayItem(part.route, fromIdx, toIdx)) return;
      if (editingPartIndex === partIdx) {
        currentBuildingRoute = part.route.map(s => ({ ...s }));
      }
      persistActiveProjectState();
      renderConfigUI();
    }

    function reorderBuildingRouteSteps(fromIdx, toIdx) {
      if (!moveArrayItem(currentBuildingRoute, fromIdx, toIdx)) return;
      if (editingPartIndex >= 0 && parts[editingPartIndex]) {
        parts[editingPartIndex].route = currentBuildingRoute.map(s => ({ ...s }));
        persistActiveProjectState();
      }
      renderCurrentBuildingRoute();
    }

    function reorderAssemblyRules(fromIdx, toIdx) {
      if (!moveArrayItem(assemblyRules, fromIdx, toIdx)) return;
      if (editingAssemblyIndex === fromIdx) editingAssemblyIndex = toIdx;
      else if (fromIdx < editingAssemblyIndex && toIdx >= editingAssemblyIndex) editingAssemblyIndex -= 1;
      else if (fromIdx > editingAssemblyIndex && toIdx <= editingAssemblyIndex) editingAssemblyIndex += 1;
      persistActiveProjectState();
      renderConfigUI();
    }

    function syncJoinRouteToActiveRule() {
      if (editingAssemblyIndex < 0 || !assemblyRules[editingAssemblyIndex]) return;
      assemblyRules[editingAssemblyIndex].route = currentJoinBuildingRoute.map(s => ({
        machineId: s.machineId,
        setup: s.setup,
        prodUnit: s.prodUnit
      }));
      persistActiveProjectState();
    }

    function reorderJoinBuildingRouteSteps(fromIdx, toIdx) {
      if (!moveArrayItem(currentJoinBuildingRoute, fromIdx, toIdx)) return;
      if (editingAssemblyIndex >= 0) {
        const keepIdx = editingAssemblyIndex;
        syncJoinRouteToActiveRule();
        renderConfigUI();
        editAssemblyRule(keepIdx);
        return;
      }
      renderCurrentJoinRoute();
    }

    function reorderSavedJoinRoute(joinIdx, fromIdx, toIdx) {
      const rule = assemblyRules[joinIdx];
      if (!rule || !Array.isArray(rule.route)) return;
      if (!moveArrayItem(rule.route, fromIdx, toIdx)) return;
      if (editingAssemblyIndex === joinIdx) {
        currentJoinBuildingRoute = rule.route.map(s => ({
          machineId: s.machineId,
          setup: s.setup,
          prodUnit: s.prodUnit
        }));
      }
      persistActiveProjectState();
      renderConfigUI();
    }

    function addStepToCurrentPart() {
      const mId = document.getElementById('step-machine-select').value;
      const setup = readTimeMinutes('step-setup-time', 0);
      const prodUnit = readTimeMinutes('step-prod-time', 1);
      if (!mId) return;
      const last = currentBuildingRoute[currentBuildingRoute.length - 1];
      if (last && last.machineId === mId) {
        showAppToast('⚠️ Esta máquina já é a última etapa do roteiro. Por favor, edite o card existente e some os tempos de setup/produção.');
        return;
      }
      currentBuildingRoute.push({ machineId: mId, setup, prodUnit });
      renderCurrentBuildingRoute();
    }

    function removeStepFromCurrentPart(idx) {
      currentBuildingRoute.splice(idx, 1);
      renderCurrentBuildingRoute();
    }

    function renderCurrentBuildingRoute() {
      const container = document.getElementById('current-part-steps-container');
      container.innerHTML = '';
      if (currentBuildingRoute.length === 0) {
        container.innerHTML = '<span style="font-size:0.85rem; color:#64748b;">Nenhuma etapa adicionada.</span>';
        return;
      }
      currentBuildingRoute.forEach((step, idx) => {
        const m = lookupMachine(step.machineId);
        container.innerHTML += `
          <span class="step-tag route-step" draggable="true" data-route-index="${idx}">
            ${idx + 1}º: <strong>${m ? m.name : '?'}</strong> (Setup: ${fmtStepTime(step.setup)} | Prod/u: ${fmtStepTime(step.prodUnit)})
            <span class="step-remove" style="color:#ef4444; cursor:pointer; font-weight:bold; margin-left:5px;" onclick="removeStepFromCurrentPart(${idx})">×</span>
          </span>`;
      });
      bindSortable(container, {
        kind: 'building-route',
        itemSelector: '.route-step',
        indexAttr: 'data-route-index',
        axis: 'x',
        ignoreSelector: '.step-remove, button',
        onReorder: reorderBuildingRouteSteps
      });
    }

    function savePart() {
      const name = document.getElementById('new-part-name').value.trim().toUpperCase();
      const thick = parseFloat(document.getElementById('new-part-thickness').value) || 1.0;
      const qty = parseInt(document.getElementById('new-part-qty').value) || 1;
      if (!name) { alert('Informe o nome da peça.'); return; }
      if (currentBuildingRoute.length === 0) { alert('Adicione etapas ao roteiro.'); return; }
      const dims = readPartDimFields();
      const partData = Object.assign({ name, thickness: thick, qty, route: [...currentBuildingRoute] }, dims);
      if (editingPartIndex >= 0) {
        parts[editingPartIndex] = typeof normalizePart === 'function' ? normalizePart(partData) : partData;
        editingPartIndex = -1;
      } else {
        parts.push(typeof normalizePart === 'function' ? normalizePart(partData) : partData);
      }
      resetPartForm();
      renderConfigUI();
    }

    function editPart(idx) {
      const p = parts[idx];
      editingPartIndex = idx;
      document.getElementById('new-part-name').value = p.name;
      document.getElementById('new-part-thickness').value = p.thickness;
      document.getElementById('new-part-qty').value = p.qty;
      fillPartDimFields(p);
      currentBuildingRoute = p.route.map(s => ({ ...s }));
      document.getElementById('btn-save-part').innerText = 'Atualizar Peça';
      document.getElementById('btn-cancel-edit').style.display = 'inline-block';
      renderCurrentBuildingRoute();
    }

    function cancelPartEdit() {
      editingPartIndex = -1;
      resetPartForm();
    }

    function resetPartForm() {
      document.getElementById('new-part-name').value = '';
      document.getElementById('btn-save-part').innerText = 'Salvar e Cadastrar Peça';
      document.getElementById('btn-cancel-edit').style.display = 'none';
      currentBuildingRoute = [];
      fillPartDimFields({ peca_altura_mm: 0, peca_largura_mm: 0, peca_comprimento_mm: 0, peca_max_fardo: 1, peca_espacamento_mm: 0 });
      renderCurrentBuildingRoute();
    }

    function removePart(idx) {
      parts.splice(idx, 1);
      renderConfigUI();
    }

    // --- AGRUPAMENTO ---
    function addGroupingRule() {
      const mId = document.getElementById('group-machine-select').value;
      const selected = [];
      document.querySelectorAll('.group-part-cb:checked').forEach(cb => selected.push(cb.value));
      if (selected.length < 2) { alert('Selecione pelo menos 2 peças.'); return; }
      const rule = { machineId: mId, partNames: selected };
      if (editingGroupingIndex >= 0) {
        groupingRules[editingGroupingIndex] = rule;
        editingGroupingIndex = -1;
        document.getElementById('btn-save-grouping').innerText = 'Agrupar Peças';
      } else {
        groupingRules.push(rule);
      }
      document.querySelectorAll('.group-part-cb').forEach(cb => cb.checked = false);
      renderConfigUI();
    }

    function editGroupingRule(idx) {
      const g = groupingRules[idx];
      editingGroupingIndex = idx;
      document.getElementById('group-machine-select').value = g.machineId;
      document.querySelectorAll('.group-part-cb').forEach(cb => {
        cb.checked = g.partNames.includes(cb.value);
      });
      document.getElementById('btn-save-grouping').innerText = 'Salvar Alterações';
    }

    function removeGroupingRule(idx) {
      groupingRules.splice(idx, 1);
      if (editingGroupingIndex === idx) {
        editingGroupingIndex = -1;
        document.getElementById('btn-save-grouping').innerText = 'Agrupar Peças';
      }
      renderConfigUI();
    }

    // --- MONTAGEM ---
    function addStepToCurrentJoin() {
      const mId = document.getElementById('join-step-machine-select').value;
      const setup = readTimeMinutes('join-step-setup-time', 0);
      const prodUnit = readTimeMinutes('join-step-prod-time', 1);
      if (!mId) return;
      currentJoinBuildingRoute.push({ machineId: mId, setup, prodUnit });
      syncJoinRouteToActiveRule();
      renderCurrentJoinRoute();
    }

    function removeStepFromCurrentJoin(idx) {
      currentJoinBuildingRoute.splice(idx, 1);
      syncJoinRouteToActiveRule();
      renderCurrentJoinRoute();
    }

    function renderCurrentJoinRoute() {
      const container = document.getElementById('current-join-steps-container');
      if (!container) return;
      container.innerHTML = '';
      if (currentJoinBuildingRoute.length === 0) {
        container.innerHTML = '<span style="font-size:0.85rem; color:#64748b;">Sem sub-roteiro. O SKU formado encerra na junção, salvo novas etapas.</span>';
        return;
      }
      currentJoinBuildingRoute.forEach((step, idx) => {
        const m = lookupMachine(step.machineId);
        container.innerHTML += `
          <span class="step-tag route-step join-route-step" draggable="true" data-join-route-index="${idx}">
            ${idx + 1}º: <strong>${m ? m.name : '?'}</strong> (Setup: ${fmtStepTime(step.setup)} | Prod/u: ${fmtStepTime(step.prodUnit)})
            <span class="step-remove" style="color:#ef4444; cursor:pointer; font-weight:bold; margin-left:5px;" onclick="removeStepFromCurrentJoin(${idx})">×</span>
          </span>`;
      });
      bindSortable(container, {
        kind: 'join-building-route',
        itemSelector: '.join-route-step',
        indexAttr: 'data-join-route-index',
        axis: 'x',
        ignoreSelector: '.step-remove, button',
        onReorder: reorderJoinBuildingRouteSteps
      });
    }

    function addAssemblyRule() {
      const mId = document.getElementById('assembly-machine-select').value;
      const resultName = document.getElementById('assembly-result-name').value.trim().toUpperCase();
      const selected = [];
      document.querySelectorAll('.assembly-part-cb:checked').forEach(cb => selected.push(cb.value));
      if (!resultName) { alert('Informe o nome do subconjunto.'); return; }
      if (selected.length < 2) { alert('Selecione ao menos 2 peças/insumos (requer).'); return; }
      const setup = readTimeMinutes('join-setup-time', 0);
      const prodUnit = readTimeMinutes('join-prod-time', 1);
      const rule = normalizeAssemblyRule({
        machineId: mId,
        resultName,
        requiredPartNames: selected,
        juncao: { requer: selected, maquina: mId },
        setup,
        prodUnit,
        qty: 1,
        route: currentJoinBuildingRoute.slice(),
        peca_altura_mm: parseFloat(document.getElementById('join-altura') && document.getElementById('join-altura').value) || 0,
        peca_largura_mm: parseFloat(document.getElementById('join-largura') && document.getElementById('join-largura').value) || 0,
        peca_comprimento_mm: parseFloat(document.getElementById('join-comprimento') && document.getElementById('join-comprimento').value) || 0,
        peca_max_fardo: parseInt(document.getElementById('join-ppf') && document.getElementById('join-ppf').value, 10) || 1,
        peca_espacamento_mm: parseFloat(document.getElementById('join-espacamento') && document.getElementById('join-espacamento').value) || 0
      });
      if (editingAssemblyIndex >= 0) {
        assemblyRules[editingAssemblyIndex] = rule;
        editingAssemblyIndex = -1;
        document.getElementById('btn-save-assembly').innerText = 'Criar Subconjunto';
      } else {
        assemblyRules.push(rule);
      }
      document.getElementById('assembly-result-name').value = '';
      document.querySelectorAll('.assembly-part-cb').forEach(cb => cb.checked = false);
      currentJoinBuildingRoute = [];
      document.getElementById('join-setup-time').value = '1';
      document.getElementById('join-prod-time').value = '1';
      const ja = document.getElementById('join-altura');
      const jl = document.getElementById('join-largura');
      const jc = document.getElementById('join-comprimento');
      const jp = document.getElementById('join-ppf');
      const jg = document.getElementById('join-espacamento');
      if (ja) ja.value = '0';
      if (jl) jl.value = '0';
      if (jc) jc.value = '0';
      if (jp) jp.value = '1';
      if (jg) jg.value = '0';
      renderConfigUI();
    }

    function editAssemblyRule(idx) {
      const a = normalizeAssemblyRule(assemblyRules[idx]);
      editingAssemblyIndex = idx;
      document.getElementById('assembly-machine-select').value = a.machineId;
      document.getElementById('assembly-result-name').value = a.resultName;
      document.querySelectorAll('.assembly-part-cb').forEach(cb => {
        cb.checked = a.requiredPartNames.includes(cb.value);
      });
      document.getElementById('join-setup-time').value = a.setup || 1;
      document.getElementById('join-prod-time').value = a.prodUnit || 1;
      const ja = document.getElementById('join-altura');
      const jl = document.getElementById('join-largura');
      const jc = document.getElementById('join-comprimento');
      const jp = document.getElementById('join-ppf');
      const jg = document.getElementById('join-espacamento');
      if (ja) ja.value = a.peca_altura_mm || 0;
      if (jl) jl.value = a.peca_largura_mm || 0;
      if (jc) jc.value = a.peca_comprimento_mm || 0;
      if (jp) jp.value = a.peca_max_fardo || 1;
      if (jg) jg.value = a.peca_espacamento_mm || 0;
      currentJoinBuildingRoute = (a.route || []).map(s => ({ machineId: s.machineId, setup: s.setup, prodUnit: s.prodUnit }));
      document.getElementById('btn-save-assembly').innerText = 'Salvar Alterações';
      renderCurrentJoinRoute();
    }

    function removeAssemblyRule(idx) {
      assemblyRules.splice(idx, 1);
      if (editingAssemblyIndex === idx) {
        editingAssemblyIndex = -1;
        document.getElementById('btn-save-assembly').innerText = 'Criar Subconjunto';
      }
      renderConfigUI();
    }

    // --- FERIADOS ---
    function addHoliday() {
      const val = document.getElementById('new-holiday-date').value;
      if (!val) { alert('Selecione uma data.'); return; }
      if (!holidays.includes(val)) {
        holidays.push(val);
        holidays.sort();
        persistHolidays();
      }
      document.getElementById('new-holiday-date').value = '';
      renderHolidaysList();
    }

    function removeHoliday(iso) {
      holidays = holidays.filter(h => h !== iso);
      persistHolidays();
      renderHolidaysList();
    }

    function renderHolidaysList() {
      const list = document.getElementById('holidays-list');
      if (!list) return;
      list.innerHTML = '';
      if (holidays.length === 0) {
        list.innerHTML = '<li style="color:#64748b;">Nenhum feriado cadastrado.</li>';
        return;
      }
      holidays.forEach(h => {
        list.innerHTML += `<li><span>${formatDisplayDate(h)} <span style="color:#64748b;">(${h})</span></span>
          <button class="btn btn-danger" onclick="removeHoliday('${h}')">Excluir</button></li>`;
      });
    }

    // --- UI CONFIG ---
    function renderConfigUI() {
      normalizeAllMachines();
      refreshSavedProjectsUI();

      fillEmployeePostoSelect(editingEmployeeIndex >= 0 ? (employees[editingEmployeeIndex].postoId || '') : '');
      fillCatalogEmployeeSelect();
      const eList = document.getElementById('employees-list');
      if (eList) {
        eList.innerHTML = '';
        if (employees.length === 0) {
          eList.innerHTML = '<li style="color:#64748b;">Nenhum funcionário neste projeto. Cadastre um novo ou use o dropdown do Catálogo Global.</li>';
        } else {
          employees.forEach((e, idx) => {
            const setorTxt = e.setor ? ` · Setor: ${e.setor}` : '';
            const horaTxt = formatCurrency(e.valor_hora || 0) + '/h';
            eList.innerHTML += `
              <li>
                <div>
                  <strong>${e.name}</strong>
                  <div style="font-size:0.8rem; color:#94a3b8;">Matrícula: ${e.matricula}${setorTxt} · Valor hora: ${horaTxt}</div>
                </div>
                <div>
                  <button class="btn btn-warning" onclick="editEmployee(${idx})">Editar</button>
                  <button class="btn btn-danger" onclick="removeEmployee(${idx})">Remover</button>
                </div>
              </li>`;
          });
        }
      }

      fillMachineOperatorSelect(
        editingMachineIndex >= 0 ? (machines[editingMachineIndex]?.defaultOperatorId || '') : (document.getElementById('new-machine-operator')?.value || '')
      );

      const usedMachineIds = collectUsedMachineIds(parts, groupingRules, assemblyRules);
      const mList = document.getElementById('machines-list');
      mList.innerHTML = '';
      fillCatalogMachineSelect();
      if (machines.length === 0) {
        mList.innerHTML = '<li style="color:#64748b;">Nenhuma máquina neste projeto. Cadastre uma nova ou use o dropdown do Catálogo Global.</li>';
      }
      machines.forEach((m, idx) => {
        const maintTxt = (m.maintIntervalHours > 0)
          ? `Manutenção a cada ${m.maintIntervalHours}h de uso (${m.maintDurationHours}h)`
          : 'Manutenção preventiva por horas de uso: desativada';
        const opTxt = getMachineOperatorLabel(m);
        const lastTxt = m.lastMaintenanceDate ? formatDisplayDate(m.lastMaintenanceDate) : '—';
        const nextTxt = m.nextMaintenanceDate ? formatDisplayDate(m.nextMaintenanceDate) : '—';
        const remainingInfo = getTimeBetweenDates(todayISODate(), m.nextMaintenanceDate || '');
        const remainingColor = !m.nextMaintenanceDate
          ? '#64748b'
          : (remainingInfo.overdue ? '#f87171' : '#4ade80');
        const remainingLabel = getMaintenanceRemainingLabel(m);
        const inUse = !!usedMachineIds[m.id];
        const useTag = inUse
          ? '<span style="font-size:0.72rem; color:#4ade80; font-weight:600;">Em uso neste projeto</span>'
          : '<span style="font-size:0.72rem; color:#64748b;">Vinculada ao projeto (sem roteiro ainda)</span>';
        const estufaTxt = m.isEstufa
          ? `Estufa ${Number(m.estufaAlturaM).toFixed(2)}×${Number(m.estufaLarguraM).toFixed(2)}×${Number(m.estufaProfundidadeM).toFixed(2)} m (${(estufaCabinVolume(m) || 0).toFixed(3)} m³) · ${Number(m.tempo_queima_default) || ESTUFA_QUEIMA_MIN} min queima + ${Number(m.tempo_resfriamento_default) || 0} min resfriamento`
          : '';
        mList.innerHTML += `
          <li>
            <div>
              <span class="machine-badge">M${idx + 1}</span><strong>${m.name}</strong>
              <div style="font-size:0.8rem; color:#94a3b8;">POP: ${m.pop}</div>
              <div style="font-size:0.78rem; color:#38bdf8;">Operador padrão: ${opTxt}</div>
              ${estufaTxt ? `<div style="font-size:0.78rem; color:#f87171;">${estufaTxt}</div>` : ''}
              <div style="font-size:0.78rem; color:#a855f7;">${maintTxt}</div>
              <div style="font-size:0.78rem; color:#94a3b8;">Última manutenção: ${lastTxt} · Próxima: ${nextTxt}</div>
              <div style="font-size:0.78rem; color:${remainingColor}; font-weight:600;">⏱ ${remainingLabel}</div>
              <div>${useTag}</div>
            </div>
            <div>
              <button class="btn btn-warning" onclick="editMachine(${idx})">Editar</button>
              <button class="btn btn-danger" onclick="removeMachine(${idx})">Remover do Projeto</button>
            </div>
          </li>`;
      });

      ['step-machine-select', 'group-machine-select', 'assembly-machine-select', 'join-step-machine-select'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = '';
        machines.forEach((m, idx) => sel.innerHTML += `<option value="${m.id}">M${idx + 1}: ${m.name}</option>`);
        if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
      });

      const pList = document.getElementById('parts-list');
      pList.innerHTML = '';
      if (parts.length === 0) {
        pList.innerHTML = '<li style="color:#64748b;">Nenhuma peça cadastrada neste projeto.</li>';
      }
      parts.forEach((p, idx) => {
        const stepsHtml = p.route.map((s, sIdx) => {
          const m = lookupMachine(s.machineId);
          return `<span class="step-tag route-step" draggable="true" data-route-index="${sIdx}" data-part-index="${idx}">${sIdx + 1}º ${m ? m.name : '?'} (${fmtStepTime(s.setup)}/${fmtStepTime(s.prodUnit)})</span>`;
        }).join('');
        const dims = typeof normalizePartDims === 'function' ? normalizePartDims(p) : p;
        const volPeca = Number(dims.volume_peca_m3 || dims.volume_unitario_com_folga) || 0;
        const volFardo = Number(dims.volume_fardo_m3 || dims.volume_fardo) || 0;
        const fmt = typeof formatVolumeM3 === 'function' ? formatVolumeM3 : (v) => Number(v).toFixed(4).replace('.', ',');
        const gapTxt = (dims.peca_espacamento_mm > 0) ? ` · folga ${dims.peca_espacamento_mm} mm` : '';
        const dimTxt = volPeca > 0
          ? ` · peça ${dims.peca_altura_mm}×${dims.peca_largura_mm}×${dims.peca_comprimento_mm} mm (${fmt(volPeca)} m³) · fardo ${dims.peca_max_fardo} pcs (${fmt(volFardo)} m³)${gapTxt}`
          : '';
        pList.innerHTML += `
          <li class="part-card" draggable="true" data-part-index="${idx}">
            <span class="drag-handle" title="Arrastar peça" aria-hidden="true">⋮⋮</span>
            <div style="flex:1;">
              <strong>${p.name}</strong> (${p.qty} un | ${p.thickness}mm${dimTxt})
              <div class="part-route-steps">${stepsHtml}</div>
            </div>
            <div class="part-card-actions">
              <button class="btn btn-warning" onclick="editPart(${idx})">Editar</button>
              <button class="btn btn-danger" onclick="removePart(${idx})">Excluir</button>
            </div>
          </li>`;
      });
      if (parts.length > 0) {
        bindSortable(pList, {
          kind: 'parts',
          itemSelector: 'li.part-card',
          indexAttr: 'data-part-index',
          axis: 'y',
          ignoreSelector: 'button, .part-card-actions, .route-step',
          allowDrag: (e) => !e.target.closest('.route-step, button, .part-card-actions'),
          onReorder: reorderPrimaryParts
        });
        pList.querySelectorAll('.part-route-steps').forEach(stepsEl => {
          bindSortable(stepsEl, {
            kind: 'part-route',
            itemSelector: '.route-step',
            indexAttr: 'data-route-index',
            partIndexAttr: 'data-part-index',
            axis: 'x',
            ignoreSelector: 'button',
            onReorder: (fromIdx, toIdx, partIdx) => reorderSavedPartRoute(partIdx, fromIdx, toIdx)
          });
        });
      }

      const groupCBContainer = document.getElementById('group-parts-checkboxes');
      groupCBContainer.innerHTML = '';
      if (parts.length === 0) {
        groupCBContainer.innerHTML = '<span style="font-size:0.8rem; color:#64748b;">Cadastre peças neste projeto para agrupar.</span>';
      }
      parts.forEach(p => {
        groupCBContainer.innerHTML += `<label class="checkbox-item"><input type="checkbox" class="group-part-cb" value="${p.name}"> ${p.name} (${p.thickness}mm)</label>`;
      });

      const gList = document.getElementById('groupings-list');
      gList.innerHTML = '';
      if (groupingRules.length === 0) {
        gList.innerHTML = '<li style="color:#64748b;">Nenhum agrupamento neste projeto.</li>';
      }
      groupingRules.forEach((g, idx) => {
        const m = lookupMachine(g.machineId);
        gList.innerHTML += `<li>
          <div><strong>Setor: ${m ? m.name : '?'}</strong>
          <div style="font-size:0.85rem; color:#38bdf8;">Cortadas Juntas: ${g.partNames.join(' + ')}</div></div>
          <div>
            <button class="btn btn-warning" onclick="editGroupingRule(${idx})">Editar</button>
            <button class="btn btn-danger" onclick="removeGroupingRule(${idx})">Excluir</button>
          </div>
        </li>`;
      });

      const assCBContainer = document.getElementById('assembly-parts-checkboxes');
      assCBContainer.innerHTML = '';
      let availableForAssembly = parts.map(p => p.name);
      assemblyRules.forEach(a => { if (!availableForAssembly.includes(a.resultName)) availableForAssembly.push(a.resultName); });
      availableForAssembly.forEach(pName => {
        assCBContainer.innerHTML += `<label class="checkbox-item"><input type="checkbox" class="assembly-part-cb" value="${pName}"> ${pName}</label>`;
      });

      const aList = document.getElementById('assemblies-list');
      aList.innerHTML = '';
      if (assemblyRules.length === 0) {
        aList.innerHTML = '<li style="color:#64748b;">Nenhuma união neste projeto.</li>';
      }
      assemblyRules.forEach((a, idx) => {
        const rule = normalizeAssemblyRule(a);
        const m = lookupMachine(rule.machineId);
        const subHtml = (rule.route || []).map((s, sIdx) => {
          const sm = lookupMachine(s.machineId);
          return `<span class="step-tag route-step join-saved-step" draggable="true" data-join-route-index="${sIdx}" data-join-index="${idx}">${sIdx + 1}º ${sm ? sm.name : '?'} (${fmtStepTime(s.setup)}/${fmtStepTime(s.prodUnit)})</span>`;
        }).join('');
        const requer = (rule.juncao && rule.juncao.requer) ? rule.juncao.requer : rule.requiredPartNames;
        aList.innerHTML += `<li class="part-card join-card" draggable="true" data-join-index="${idx}">
          <span class="drag-handle" title="Arrastar junção" aria-hidden="true">⋮⋮</span>
          <div style="flex:1;">
            <strong>JOIN ${m ? m.name : '?'}</strong> ➔ <span style="color:#22c55e;">${rule.resultName}</span>
            <div style="font-size:0.85rem; color:#f59e0b;">requer: ${requer.join(' + ')}</div>
            <div style="font-size:0.8rem; color:#94a3b8;">Junção: setup ${fmtStepTime(rule.setup)} / prod ${fmtStepTime(rule.prodUnit)}${subHtml ? '' : ' · sem sub-roteiro'}</div>
            ${subHtml ? `<div class="part-route-steps join-sub-route">${subHtml}</div>` : ''}
          </div>
          <div class="part-card-actions">
            <button class="btn btn-warning" onclick="editAssemblyRule(${idx})">Editar</button>
            <button class="btn btn-danger" onclick="removeAssemblyRule(${idx})">Excluir</button>
          </div>
        </li>`;
      });
      if (assemblyRules.length > 0) {
        bindSortable(aList, {
          kind: 'joins',
          itemSelector: 'li.join-card',
          indexAttr: 'data-join-index',
          axis: 'y',
          ignoreSelector: 'button, .part-card-actions, .join-saved-step, .join-sub-route',
          allowDrag: (e) => !e.target.closest('button, .part-card-actions, .join-saved-step, .join-sub-route'),
          onReorder: reorderAssemblyRules
        });
        aList.querySelectorAll('.join-sub-route').forEach(stepsEl => {
          bindSortable(stepsEl, {
            kind: 'join-route',
            itemSelector: '.join-saved-step',
            indexAttr: 'data-join-route-index',
            partIndexAttr: 'data-join-index',
            axis: 'x',
            ignoreSelector: 'button',
            onReorder: (fromIdx, toIdx, joinIdx) => reorderSavedJoinRoute(joinIdx, fromIdx, toIdx)
          });
        });
      }

      renderCurrentJoinRoute();
      renderHolidaysList();
      if (!document.getElementById('start-date').value) {
        document.getElementById('start-date').value = startDateStr || todayISODate();
      }
      const startTimeEl = document.getElementById('start-time');
      if (startTimeEl && !startTimeEl.value) startTimeEl.value = startTimeStr || DEFAULT_START_TIME;
      if (typeof updateDbStatusIndicator === 'function') updateDbStatusIndicator();
      if (typeof syncEstufaMachineForm === 'function') syncEstufaMachineForm();
      if (typeof syncSimEstufaCycleFields === 'function') syncSimEstufaCycleFields({ fillIfEmpty: true });
    }

    function populateDaySelect() {
      const wrap = document.getElementById('day-select-wrap');
      const sel = document.getElementById('day-select');
      if (!wrap || !sel) return;
      sel.innerHTML = '';
      workDays.forEach((iso, idx) => {
        sel.innerHTML += `<option value="${idx}">${formatDisplayDate(iso)} (Dia ${idx + 1})</option>`;
      });
      wrap.style.display = workDays.length > 1 ? 'flex' : 'none';
      sel.value = String(selectedDayIndex);
    }

    function statusLabel(status) {
      if (status === 'waiting') return { text: 'Aguardando Outras Peças para União', cls: 'badge-waiting' };
      if (status === 'ready') return { text: 'PRONTA PARA PROGRAMAR', cls: 'badge-fila' };
      if (status === 'fila') return { text: 'FILA', cls: 'badge-fila' };
      if (status === 'setup') return { text: 'SETUP', cls: 'badge-setup' };
      if (status === 'working') return { text: 'EM PRODUÇÃO', cls: 'badge-working' };
      if (status === 'queima') return { text: 'QUEIMA', cls: 'badge-queima' };
      if (status === 'cooling') return { text: 'RESFRIAMENTO (TRAVA)', cls: 'badge-cooling' };
      if (status === 'descarregar') return { text: 'DESCARREGAR', cls: 'badge-descarregar' };
      if (status === 'lunch') return { text: 'ALMOÇO', cls: 'badge-lunch' };
      if (status === 'done') return { text: 'CONCLUÍDO', cls: 'badge-done' };
      if (status === 'maintenance') return { text: 'MANUTENÇÃO PREVENTIVA', cls: 'badge-maintenance' };
      return { text: status, cls: 'badge-fila' };
    }

    function renderFloorTable(state) {
      const tbody = document.getElementById('floor-status-body');
      if (!tbody || !state) return;
      tbody.innerHTML = '';
      state.floorRows.forEach(row => {
        const badge = statusLabel(row.status);
        tbody.innerHTML += `
          <tr>
            <td><strong>${row.name}</strong></td>
            <td>${row.sector}</td>
            <td>${row.operator || '-'}</td>
            <td><span class="status-badge ${badge.cls}">${badge.text}</span></td>
            <td>${row.remaining}</td>
          </tr>`;
      });
    }

    function renderClockOnly() {
      document.getElementById('kpi-clock').innerText = absSecondToClockString(currentAbsSecond);
    }

    function renderAbsMinute(absMin, forceFloor) {
      if (!simulationHistory[absMin]) return;
      const state = simulationHistory[absMin];
      const parts = absMinuteToParts(absMin);
      selectedDayIndex = parts.dayIndex;

      const daySel = document.getElementById('day-select');
      if (daySel && String(daySel.value) !== String(selectedDayIndex)) {
        daySel.value = String(selectedDayIndex);
      }

      if (forceFloor || absMin !== lastRenderedMinute) {
        renderFloorTable(state);
        lastRenderedMinute = absMin;
      }

      document.getElementById('timeline').value = parts.minuteInDay;
      document.getElementById('timeline-label').innerText = minuteInDayToTimeStr(parts.minuteInDay);
      renderClockOnly();

      const kpiStatus = document.getElementById('kpi-status');
      if (parts.minuteInDay >= LUNCH_START_OFFSET && parts.minuteInDay < LUNCH_END_OFFSET) {
        kpiStatus.innerText = 'HORÁRIO DE ALMOÇO';
        kpiStatus.style.color = '#94a3b8';
      } else {
        const anyMaint = Object.values(state.machinesStatus).some(s => s.state === 'maintenance');
        if (anyMaint) {
          kpiStatus.innerText = 'MANUTENÇÃO PREVENTIVA';
          kpiStatus.style.color = '#c084fc';
        } else {
          kpiStatus.innerText = 'PRODUZINDO';
          kpiStatus.style.color = '#4ade80';
        }
      }

      if (typeof updateGanttPlaybackCursor === 'function') updateGanttPlaybackCursor();
      if (typeof updatePartJourneyPlaybackCursor === 'function') updatePartJourneyPlaybackCursor();
    }

    function updatePlayButtonUI() {
      const btn = document.getElementById('btn-play');
      if (!btn) return;
      btn.classList.remove('is-playing', 'is-paused', 'bg-green-500', 'bg-green-800/60');
      if (isPlaying) {
        btn.classList.add('is-playing', 'bg-green-500');
        btn.innerText = '⏸ Pause';
      } else {
        btn.classList.add('is-paused', 'bg-green-800/60');
        btn.innerText = '▶ Play';
      }
    }

    function updateSpeedButtonsUI() {
      [1, 5, 10].forEach(s => {
        const btn = document.getElementById('speed-' + s + 'x');
        if (!btn) return;
        btn.classList.toggle('is-active', simulationSpeed === s);
      });
    }

    function setLegendLabel(id, title, minutes) {
      const el = document.getElementById(id);
      if (!el) return;
      if (minutes == null) {
        el.textContent = title;
        return;
      }
      el.textContent = `${title}: ${formatMinutesWithHours(minutes)}`;
    }

    function applyAnalyticsKpiTitles(isPlan) {
      const plan = !!isPlan;
      const ms = document.getElementById('kpi-makespan-title');
      const ef = document.getElementById('kpi-efficiency-title');
      const bn = document.getElementById('kpi-bottleneck-title');
      const ganttTitle = document.getElementById('gantt-chart-title');
      const pdfBtn = document.getElementById('btn-export-pdf');
      if (ms) ms.textContent = plan ? 'Makespan Total do Plano' : 'Makespan Total';
      if (ef) ef.textContent = plan ? 'Índice de Eficiência Global do Plano (OEE Mix)' : 'Índice de Eficiência Global';
      if (bn) bn.textContent = plan ? 'Gargalo Crítico do Plano' : 'Gargalo Identificado';
      if (ganttTitle) ganttTitle.textContent = plan ? 'Gráfico de Gantt Unificado do Plano' : 'Gráfico de Gantt do Projeto';
      const journeyTitle = document.getElementById('part-journey-title');
      if (journeyTitle) journeyTitle.textContent = plan ? 'Gráfico de Jornada das Peças / Subconjuntos do Plano' : 'Gráfico de Jornada das Peças / Subconjuntos';
      if (pdfBtn) pdfBtn.textContent = plan ? '📄 Exportar Relatório do Plano (PDF)' : '📄 Gerar Relatório PDF';
    }

    function resetAnalyticsView() {
      applyAnalyticsKpiTitles(typeof isPlanSimulationMode === 'function' && isPlanSimulationMode());
      setLegendLabel('legend-working', 'Produção');
      setLegendLabel('legend-setup', 'Setup');
      setLegendLabel('legend-waiting', 'Espera/Fila');
      setLegendLabel('legend-maintenance', 'Manutenção Preventiva');
      setLegendLabel('legend-lunch', 'Almoço');
      setLegendLabel('legend-idle', 'Ocioso');

      const makespan = document.getElementById('kpi-makespan');
      if (makespan) makespan.textContent = '—';
      const makespanHint = document.getElementById('kpi-makespan-hint');
      if (makespanHint) makespanHint.textContent = 'Tempo até a conclusão do lote/caixas';
      const efficiency = document.getElementById('kpi-efficiency');
      if (efficiency) efficiency.textContent = '—';
      const efficiencyHint = document.getElementById('kpi-efficiency-hint');
      if (efficiencyHint) efficiencyHint.textContent = 'Produtivo / Ocupado (Produção + Setup) × 100';
      const bottleneck = document.getElementById('kpi-bottleneck');
      if (bottleneck) bottleneck.textContent = '—';
      const bottleneckHint = document.getElementById('kpi-bottleneck-hint');
      if (bottleneckHint) bottleneckHint.textContent = 'Posto com maior ocupação (e fila)';
      const estufaKpi = document.getElementById('kpi-estufa');
      if (estufaKpi) estufaKpi.textContent = '—';
      const estufaOcc = document.getElementById('kpi-estufa-occ');
      if (estufaOcc) estufaOcc.textContent = '';
      const estufaHint = document.getElementById('kpi-estufa-hint');
      if (estufaHint) estufaHint.textContent = estufaCycleHintText();
      paintCostKpis(null);

      const tbody = document.getElementById('operator-hours-body');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:#64748b;">Gere a simulação para ver o relatório por operador.</td></tr>';
      }
      renderPlanCompletionTable([]);
      renderGanttSkuLegend([]);
    }

    function renderAnalyticsKpis(analytics) {
      const planMode = typeof isPlanSimulationMode === 'function' && isPlanSimulationMode();
      applyAnalyticsKpiTitles(planMode);
      const makespanEl = document.getElementById('kpi-makespan');
      const makespanHint = document.getElementById('kpi-makespan-hint');
      const efficiencyEl = document.getElementById('kpi-efficiency');
      const bottleneckEl = document.getElementById('kpi-bottleneck');
      const bottleneckHint = document.getElementById('kpi-bottleneck-hint');

      if (!analytics || analytics.makespanElapsed <= 0) {
        if (makespanEl) makespanEl.textContent = '—';
        if (makespanHint) makespanHint.textContent = planMode
          ? 'Sem eventos no mix do plano'
          : 'Sem eventos no lote';
        if (efficiencyEl) efficiencyEl.textContent = '—';
        const efficiencyHintEmpty = document.getElementById('kpi-efficiency-hint');
        if (efficiencyHintEmpty) efficiencyHintEmpty.textContent = planMode
          ? 'OEE Mix: Produtivo / Ocupado (Produção + Setup) × 100'
          : 'Produtivo / Ocupado (Produção + Setup) × 100';
        if (bottleneckEl) bottleneckEl.textContent = '—';
        if (bottleneckHint) bottleneckHint.textContent = planMode
          ? 'Posto com maior fila acumulada na concorrência dos projetos'
          : 'Posto com maior ocupação (e fila)';
        const estufaEmpty = document.getElementById('kpi-estufa');
        if (estufaEmpty) estufaEmpty.textContent = '0';
        const estufaOccEmpty = document.getElementById('kpi-estufa-occ');
        if (estufaOccEmpty) estufaOccEmpty.textContent = '';
        const estufaHintEmpty = document.getElementById('kpi-estufa-hint');
        if (estufaHintEmpty) estufaHintEmpty.textContent = 'Sem ciclos de estufa neste lote';
        paintCostKpis(null);
        return;
      }

      if (makespanEl) makespanEl.textContent = formatMinutesWithHours(analytics.makespanElapsed);
      if (makespanHint) {
        const doneAbs = Math.max(0, analytics.completionAbs);
        const lastMin = Math.max(analytics.histStart, doneAbs > 0 ? doneAbs - 1 : 0);
        const firstDay = Math.floor(analytics.histStart / MINUTES_PER_DAY);
        const lastDay = Math.floor(lastMin / MINUTES_PER_DAY);
        const days = Math.max(1, lastDay - firstDay + 1);
        const dayTxt = days > 1 ? `${days} dias úteis` : '1 dia útil';
        const doneLabel = formatReportClock(doneAbs);
        makespanHint.textContent = planMode
          ? `Do disparo do 1º SKU até a última caixa: ${doneLabel} · ${dayTxt} · líquido (sem almoço): ${formatMinutesWithHours(analytics.makespanNet)}`
          : `Conclusão: ${doneLabel} · ${dayTxt} · líquido (sem almoço): ${formatMinutesWithHours(analytics.makespanNet)}`;
      }

      if (efficiencyEl) {
        efficiencyEl.textContent = analytics.occupied > 0
          ? analytics.efficiencyPct.toFixed(1) + '%'
          : '—';
      }
      const efficiencyHint = document.getElementById('kpi-efficiency-hint');
      if (efficiencyHint) {
        efficiencyHint.textContent = analytics.occupied > 0
          ? `${formatMinutesWithHours(analytics.productive)} produtivo / ${formatMinutesWithHours(analytics.occupied)} ocupado`
          : (planMode
            ? 'OEE Mix: Produtivo / Ocupado (Produção + Setup) × 100'
            : 'Produtivo / Ocupado (Produção + Setup) × 100');
      }

      if (analytics.bottleneck) {
        const bn = analytics.bottleneck;
        if (bottleneckEl) bottleneckEl.textContent = bn.name;
        if (bottleneckHint) {
          bottleneckHint.textContent = planMode
            ? `Fila acumulada: ${formatMinutesWithHours(bn.wait)} · Ocupação: ${formatMinutesWithHours(bn.occupied)}`
            : `Ocupação: ${formatMinutesWithHours(bn.occupied)} · Fila: ${formatMinutesWithHours(bn.wait)}`;
        }
      } else {
        if (bottleneckEl) bottleneckEl.textContent = 'Nenhum gargalo';
        if (bottleneckHint) bottleneckHint.textContent = planMode
          ? 'Sem fila relevante na concorrência do mix'
          : 'Sem ocupação relevante no lote';
      }

      const estufaEl = document.getElementById('kpi-estufa');
      const estufaOcc = document.getElementById('kpi-estufa-occ');
      const estufaHint = document.getElementById('kpi-estufa-hint');
      const estufaN = analytics && analytics.estufaCount != null ? analytics.estufaCount : 0;
      const occ = analytics && analytics.estufaOccupancy;
      const occLabel = (estufaN > 0 && typeof formatEstufaOccupancyLabel === 'function')
        ? formatEstufaOccupancyLabel(occ)
        : '';
      if (estufaEl) {
        if (estufaN > 0 && occ && occ.count) {
          const pct = (Math.round(occ.pct * 10) / 10).toFixed(1);
          estufaEl.innerHTML = String(estufaN) + ' <span class="estufa-occ-badge">' + pct + '%</span>';
        } else {
          estufaEl.textContent = String(estufaN);
        }
      }
      if (estufaOcc) estufaOcc.textContent = occLabel;
      if (estufaHint) {
        estufaHint.textContent = estufaN > 0
          ? (estufaN + ' ciclo(s) · ' + estufaCycleHintText())
          : 'Sem ciclos de estufa neste lote';
      }
      paintCostKpis(analytics);
    }

    function paintCostKpis(analytics) {
      const modEl = document.getElementById('kpi-custo-mod');
      const filaEl = document.getElementById('kpi-custo-fila');
      const precoEl = document.getElementById('kpi-preco-caixa');
      const modHint = document.getElementById('kpi-custo-mod-hint');
      const filaHint = document.getElementById('kpi-custo-fila-hint');
      const precoHint = document.getElementById('kpi-preco-caixa-hint');
      const hasLot = analytics && analytics.makespanElapsed > 0;
      const boxes = typeof getPdfReportMeta === 'function' ? getPdfReportMeta().boxes : (boxesQty || 1);
      const costs = (hasLot && typeof computeLaborCostSummary === 'function')
        ? computeLaborCostSummary(analytics.makespanElapsed, boxes)
        : null;
      if (modEl) modEl.textContent = costs ? formatCurrency(costs.custoModTotal) : '—';
      if (filaEl) filaEl.textContent = costs ? formatCurrency(costs.custoFilaJoin) : '—';
      if (precoEl) precoEl.textContent = costs ? formatCurrency(costs.precoSugeridoCaixa) : '—';
      if (modHint) {
        modHint.textContent = costs
          ? ('Setup + produção × valor hora do operador · ' + boxes + ' caixa(s)')
          : 'Soma da mão de obra direta no lote';
      }
      if (filaHint) {
        filaHint.textContent = costs
          ? ('Fila + JOIN × (custo diário / 9,8 h) · ' + formatCurrency(typeof getCustoDiarioFabrica === 'function' ? getCustoDiarioFabrica() : 0) + '/dia')
          : 'Custo de oportunidade do tempo parado';
      }
      if (precoHint) {
        precoHint.textContent = costs
          ? ('(Makespan × R$/min + MOD) / caixas · operacional ' + formatCurrency(costs.custoOperacionalMakespan))
          : 'Cobre o custo operacional do makespan e a MOD';
      }
    }

    function renderPlanCompletionTable(rows) {
      const wrap = document.getElementById('plan-completion-wrap');
      const body = document.getElementById('plan-completion-body');
      if (!wrap || !body) return;
      const planMode = typeof isPlanSimulationMode === 'function' && isPlanSimulationMode();
      if (!planMode) {
        wrap.hidden = true;
        body.innerHTML = '';
        return;
      }
      wrap.hidden = false;
      const list = Array.isArray(rows) ? rows : (typeof computePlanItemSummaries === 'function' ? computePlanItemSummaries() : []);
      if (!list.length) {
        body.innerHTML = '<tr><td colspan="6" style="color:#64748b;">Gere a simulação do plano para ver as datas de conclusão.</td></tr>';
        return;
      }
      body.innerHTML = list.map(r => `
        <tr>
          <td>${r.order}</td>
          <td><strong>${escapeHtml(r.projectName)}</strong></td>
          <td>${r.boxesQty}</td>
          <td>${escapeHtml(r.trigger)}</td>
          <td>${r.startAbs != null ? absMinuteToTimeLabel(r.startAbs) : '—'}</td>
          <td>${r.endAbs != null ? absMinuteToTimeLabel(r.endAbs) : '—'}</td>
        </tr>`).join('');
    }

    function renderOperatorHoursTable(rows) {
      const tbody = document.getElementById('operator-hours-body');
      if (!tbody) return;
      if (!rows || rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:#64748b;">Nenhum operador associado às máquinas ativas deste lote.</td></tr>';
        return;
      }
      tbody.innerHTML = rows.map(row => `
        <tr>
          <td><strong>${row.operator}</strong></td>
          <td>${row.principalMachine}</td>
          <td>${formatMinutesWithHours(row.production)}</td>
          <td>${formatMinutesWithHours(row.setup)}</td>
          <td>${formatMinutesWithHours(row.inactive)}</td>
          <td><strong>${formatMinutesWithHours(row.worked)}</strong></td>
        </tr>`).join('');
    }

    let ganttViewMode = 'day';
    let lastGanttRange = null;
    let lastGanttDayIndex = -1;

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[ch]));
    }

    function renderGanttSkuLegend(items) {
      const host = document.getElementById('gantt-sku-legend');
      if (!host) return;
      const planMode = typeof isPlanSimulationMode === 'function' && isPlanSimulationMode();
      const list = Array.isArray(items)
        ? items
        : (planMode && typeof getPlanSkuLegendItems === 'function' ? getPlanSkuLegendItems() : []);
      if (!planMode || !list.length) {
        host.hidden = true;
        host.innerHTML = '';
        return;
      }
      host.hidden = false;
      host.innerHTML = list.map(it =>
        `<div class="legend-item"><div class="color-box" style="background:${escapeHtml(it.prod)};"></div> ${escapeHtml(it.label)} → ${escapeHtml(it.name)}</div>`
      ).join('');
    }

    function ganttKindClass(kind) {
      if (kind === 'setup') return 'gantt-block-setup';
      if (kind === 'prod') return 'gantt-block-prod';
      if (kind === 'unload') return 'gantt-block-unload';
      if (kind === 'estufa') return 'gantt-block-estufa';
      if (kind === 'cooling') return 'gantt-block-cooling';
      if (kind === 'wait') return 'gantt-block-wait';
      if (kind === 'maint') return 'gantt-block-maint';
      return '';
    }

    function ganttKindLabel(kind) {
      if (kind === 'setup') return 'Setup';
      if (kind === 'prod') return 'Produção';
      if (kind === 'unload') return 'Descarregar';
      if (kind === 'estufa') return 'QUEIMA';
      if (kind === 'cooling') return 'RESFRIAMENTO';
      if (kind === 'wait') return 'Espera/Fila';
      if (kind === 'maint') return 'Manutenção';
      return kind;
    }

    function pctInRange(absMin, range) {
      const span = Math.max(1, range.end - range.start);
      return ((absMin - range.start) / span) * 100;
    }

    function ganttAxisTicks(range) {
      const ticks = [];
      if (range.mode === 'day') {
        const marks = [0, 90, 210, 270, 330, 450, 570];
        marks.forEach(m => {
          ticks.push({ abs: range.start + m, label: minuteInDayToTimeStr(m), kind: 'hour' });
        });
        return ticks;
      }
      const span = Math.max(1, range.end - range.start);
      const dayMarks = dayBoundaryAbsMins(range.start, range.end);
      let step = 90;
      if (span > MINUTES_PER_DAY) step = 120;
      if (span > MINUTES_PER_DAY * 2) step = 180;
      if (span > MINUTES_PER_DAY * 4) step = 240;
      const minGap = Math.max(step * 0.55, span * 0.09);
      const startDay = Math.floor(range.start / MINUTES_PER_DAY);
      const endDay = Math.floor(Math.max(range.start, range.end - 1) / MINUTES_PER_DAY);
      for (let d = startDay; d <= endDay; d++) {
        const dayStart = d * MINUTES_PER_DAY;
        for (let off = 0; off < MINUTES_PER_DAY; off += step) {
          const t = dayStart + off;
          if (t < range.start || t > range.end) continue;
          if (off === 0 && (d > startDay || dayMarks.indexOf(t) >= 0)) continue;
          const nearDay = dayMarks.some(bd => Math.abs(bd - t) < minGap);
          if (nearDay) continue;
          ticks.push({ abs: t, label: minuteInDayToTimeStr(t % MINUTES_PER_DAY), kind: 'hour' });
        }
      }
      dayMarks.forEach(t => {
        const iso = absMinuteToParts(t).dateIso;
        ticks.push({
          abs: t,
          label: formatDisplayDate(iso),
          sub: '07:30',
          kind: 'day'
        });
      });
      ticks.sort((a, b) => a.abs - b.abs);
      const thinned = [];
      ticks.forEach(tk => {
        const last = thinned[thinned.length - 1];
        if (last && Math.abs(tk.abs - last.abs) < minGap) {
          if (tk.kind === 'day' && last.kind !== 'day') thinned[thinned.length - 1] = tk;
          return;
        }
        thinned.push(tk);
      });
      return thinned;
    }

    function updateGanttModeButtons() {
      const dayBtn = document.getElementById('gantt-mode-day');
      const lotBtn = document.getElementById('gantt-mode-lot');
      if (dayBtn) dayBtn.classList.toggle('is-active', ganttViewMode !== 'lot');
      if (lotBtn) lotBtn.classList.toggle('is-active', ganttViewMode === 'lot');
    }

    function setGanttViewMode(mode) {
      ganttViewMode = mode === 'lot' ? 'lot' : 'day';
      lastGanttDayIndex = -1;
      updateGanttModeButtons();
      renderGanttChart();
    }

    function resetGanttView() {
      lastGanttRange = null;
      lastGanttDayIndex = -1;
      const host = document.getElementById('gantt-chart');
      if (host) host.innerHTML = '<div class="gantt-empty">Gere a simulação para montar o Gantt.</div>';
      const label = document.getElementById('gantt-range-label');
      if (label) label.textContent = 'Gere a simulação para ver o cronograma por posto.';
      applyAnalyticsKpiTitles(typeof isPlanSimulationMode === 'function' && isPlanSimulationMode());
      renderGanttSkuLegend([]);
      updateGanttModeButtons();
      resetPartJourneyView();
    }

    function updateGanttPlaybackCursor() {
      if (!lastGanttRange) return;
      if (ganttViewMode !== 'lot' && selectedDayIndex !== lastGanttDayIndex) {
        renderGanttChart();
        return;
      }
      const lines = document.querySelectorAll('#gantt-chart .gantt-now, #part-journey-chart .gantt-now');
      if (!lines.length) return;
      const pct = pctInRange(getCurrentAbsMinute(), lastGanttRange);
      lines.forEach(line => {
        if (pct < 0 || pct > 100) {
          line.style.display = 'none';
          return;
        }
        line.style.display = 'block';
        line.style.left = pct + '%';
      });
    }

    function renderGanttChart() {
      const host = document.getElementById('gantt-chart');
      const label = document.getElementById('gantt-range-label');
      updateGanttModeButtons();
      if (!host) return;
      if (!simulationHistory.length) {
        resetGanttView();
        return;
      }

      const range = ganttViewMode === 'lot'
        ? getGanttRangeForLot()
        : getGanttRangeForDay(selectedDayIndex);
      lastGanttRange = range;
      lastGanttDayIndex = range.mode === 'day' ? range.dayIndex : -1;

      const rows = buildGanttRows(range.start, range.end);
      const lunches = lunchOverlaysInRange(range.start, range.end);
      const dayMarks = range.mode === 'lot' ? dayBoundaryAbsMins(range.start, range.end) : [];
      const ticks = ganttAxisTicks(range);
      const span = Math.max(1, range.end - range.start);

      if (label) {
        if (range.mode === 'day') {
          const iso = workDays[range.dayIndex] || startDateStr;
          label.textContent = 'Dia ' + (range.dayIndex + 1) + ' (' + formatDisplayDate(iso) + ') · turno 07:30–17:18 · almoço 12:00–13:00';
        } else {
          const mix = typeof isPlanSimulationMode === 'function' && isPlanSimulationMode();
          label.textContent = (mix ? 'Gantt unificado do plano: ' : 'Lote contínuo: ') +
            absMinuteToTimeLabel(range.start) + ' → ' + absMinuteToTimeLabel(Math.max(range.start, range.end - 1));
        }
      }

      renderGanttSkuLegend();

      const axisHtml = ticks.map(tk => {
        const left = pctInRange(tk.abs, range);
        if (left < -1 || left > 101) return '';
        if (tk.kind !== 'day' && left > 96) return '';
        if (tk.kind === 'day') {
          return `<span class="gantt-tick gantt-tick-day" style="left:${left.toFixed(2)}%">` +
            `<span class="gantt-tick-date">${escapeHtml(tk.label)}</span>` +
            `<span class="gantt-tick-time">${escapeHtml(tk.sub || '07:30')}</span>` +
            `</span>`;
        }
        return `<span class="gantt-tick gantt-tick-hour" style="left:${left.toFixed(2)}%">${escapeHtml(tk.label)}</span>`;
      }).join('');

      const lunchHtml = lunches.map(b => {
        const left = pctInRange(b.start, range);
        const width = Math.max(0.4, ((b.end - b.start) / span) * 100);
        return `<div class="gantt-lunch" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></div>`;
      }).join('');

      const marksHtml = dayMarks.map(t => {
        const left = pctInRange(t, range);
        return `<div class="gantt-day-mark" style="left:${left.toFixed(2)}%"></div>`;
      }).join('');
      const axisMarksHtml = dayMarks.map(t => {
        const left = pctInRange(t, range);
        return `<div class="gantt-day-mark gantt-day-mark-axis" style="left:${left.toFixed(2)}%"></div>`;
      }).join('');

      const nowPct = pctInRange(getCurrentAbsMinute(), range);
      const nowVisible = nowPct >= 0 && nowPct <= 100;
      const nowStyle = nowVisible
        ? `left:${nowPct.toFixed(2)}%`
        : 'display:none;left:0';

      const rowsHtml = rows.map(row => {
        const blocks = row.blocks.map(b => {
          const left = pctInRange(b.start, range);
          const width = Math.max(0.35, ((b.end - b.start) / span) * 100);
          const sku = b.planProjectName && b.kind !== 'estufa' && b.kind !== 'cooling' ? (b.planProjectName + ' · ') : '';
          const occ = (b.kind === 'estufa' || b.kind === 'cooling') && b.estufaOccupancyPct
            ? ` · ${b.estufaOccupancyPct}% · ${b.estufaTrigger || ''}`
            : '';
          const dur = typeof formatDurationMinutes === 'function'
            ? formatDurationMinutes(Math.max(0, b.end - b.start))
            : '';
          const title = `${row.name} · ${sku}${b.partName} · ${ganttKindLabel(b.kind)}${occ}${dur ? ' · ' + dur : ''} ${minuteInDayToTimeStr(b.start % MINUTES_PER_DAY)}–${minuteInDayToTimeStr((b.end - 1) % MINUTES_PER_DAY)}`;
          const fill = typeof ganttBlockFill === 'function' ? ganttBlockFill(b) : null;
          const bg = fill && fill.css ? `background:${fill.css};` : '';
          const tags = ((b.kind === 'estufa' || b.kind === 'cooling' || b.kind === 'unload') && b.partName)
            ? `<span class="gantt-block-tags">${escapeHtml(b.partName)}</span>`
            : '';
          return `<div class="gantt-block ${ganttKindClass(b.kind)}" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;${bg}" title="${escapeHtml(title)}">${tags}</div>`;
        }).join('');
        return `<div class="gantt-row">
          <div class="gantt-label">${escapeHtml(row.name)}</div>
          <div class="gantt-track">${lunchHtml}${marksHtml}${blocks}<div class="gantt-now" style="${nowStyle}"></div></div>
        </div>`;
      }).join('');

      if (!rows.length) {
        host.innerHTML = '<div class="gantt-empty">Nenhuma máquina ativa neste lote.</div>';
        renderPartJourneyChart(range);
        return;
      }

      host.innerHTML = `<div class="gantt-axis${range.mode === 'lot' ? ' is-lot' : ''}">${axisMarksHtml}${axisHtml}</div>${rowsHtml}`;
      renderPartJourneyChart(range);
    }

    function partJourneyKindClass(kind) {
      if (kind === 'fila') return 'part-journey-block-fila';
      if (kind === 'setup') return 'part-journey-block-setup';
      if (kind === 'prod') return 'part-journey-block-prod';
      if (kind === 'union') return 'part-journey-block-union';
      if (kind === 'transport') return 'part-journey-block-transport';
      return '';
    }

    function partJourneyEfficiencyClass(pct) {
      if (pct >= 40) return 'is-high';
      if (pct >= 20) return 'is-mid';
      return 'is-low';
    }

    function hidePartJourneyTooltip() {
      const tip = document.getElementById('part-journey-tooltip');
      if (tip) {
        tip.hidden = true;
        tip.innerHTML = '';
      }
    }

    function showPartJourneyTooltip(blockEl, clientX, clientY) {
      const tip = document.getElementById('part-journey-tooltip');
      if (!tip || !blockEl) return;
      const partName = blockEl.getAttribute('data-part') || '';
      const status = blockEl.getAttribute('data-status') || '';
      const start = blockEl.getAttribute('data-start-label') || '';
      const end = blockEl.getAttribute('data-end-label') || '';
      const dur = blockEl.getAttribute('data-duration') || '';
      tip.hidden = false;
      tip.innerHTML =
        '<strong>' + escapeHtml(partName) + '</strong>' +
        '<div class="pj-state">' + escapeHtml(status) + '</div>' +
        '<div class="pj-meta">Início: ' + escapeHtml(start) + '</div>' +
        '<div class="pj-meta">Fim: ' + escapeHtml(end) + '</div>' +
        '<div class="pj-meta">Duração: ' + escapeHtml(dur) + '</div>';
      const pad = 14;
      const rect = tip.getBoundingClientRect();
      let left = clientX + pad;
      let top = clientY + pad;
      if (left + rect.width > window.innerWidth - 8) left = Math.max(8, clientX - rect.width - pad);
      if (top + rect.height > window.innerHeight - 8) top = Math.max(8, clientY - rect.height - pad);
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    }

    function highlightPartJourney(partId) {
      const chartRows = document.querySelectorAll('#part-journey-chart .gantt-row');
      chartRows.forEach(function (row) {
        row.classList.toggle('is-highlight', !!partId && row.getAttribute('data-part-id') === partId);
      });
      const kpiRows = document.querySelectorAll('#part-journey-kpi-body tr[data-part-id]');
      kpiRows.forEach(function (row) {
        row.classList.toggle('is-highlight', !!partId && row.getAttribute('data-part-id') === partId);
      });
    }

    let partJourneyUiBound = false;
    function bindPartJourneyUi() {
      if (partJourneyUiBound) return;
      partJourneyUiBound = true;
      const chart = document.getElementById('part-journey-chart');
      const kpiBody = document.getElementById('part-journey-kpi-body');
      if (chart) {
        chart.addEventListener('mousemove', function (ev) {
          const block = ev.target && ev.target.closest ? ev.target.closest('.gantt-block') : null;
          if (!block || !chart.contains(block)) {
            hidePartJourneyTooltip();
            return;
          }
          showPartJourneyTooltip(block, ev.clientX, ev.clientY);
        });
        chart.addEventListener('mouseleave', function () {
          hidePartJourneyTooltip();
        });
        chart.addEventListener('mouseover', function (ev) {
          const row = ev.target && ev.target.closest ? ev.target.closest('.gantt-row') : null;
          highlightPartJourney(row ? row.getAttribute('data-part-id') : '');
        });
        chart.addEventListener('mouseout', function (ev) {
          const toRow = ev.relatedTarget && ev.relatedTarget.closest ? ev.relatedTarget.closest('.gantt-row') : null;
          if (!toRow || !chart.contains(toRow)) highlightPartJourney('');
        });
      }
      if (kpiBody) {
        kpiBody.addEventListener('mouseover', function (ev) {
          const row = ev.target && ev.target.closest ? ev.target.closest('tr[data-part-id]') : null;
          highlightPartJourney(row ? row.getAttribute('data-part-id') : '');
        });
        kpiBody.addEventListener('mouseleave', function () {
          highlightPartJourney('');
        });
      }
      const legend = document.getElementById('part-journey-legend');
      if (legend) {
        legend.addEventListener('mouseover', function (ev) {
          const item = ev.target && ev.target.closest ? ev.target.closest('.part-journey-legend-item') : null;
          filterPartJourneyKind(item ? item.getAttribute('data-kind') : '');
        });
        legend.addEventListener('mouseleave', function () {
          filterPartJourneyKind('');
        });
      }
    }

    function filterPartJourneyKind(kind) {
      const chart = document.getElementById('part-journey-chart');
      const legend = document.getElementById('part-journey-legend');
      if (legend) {
        legend.querySelectorAll('.part-journey-legend-item').forEach(function (el) {
          el.classList.toggle('is-active', !!kind && el.getAttribute('data-kind') === kind);
        });
      }
      if (!chart) return;
      chart.classList.toggle('is-filtering', !!kind);
      chart.querySelectorAll('.gantt-block').forEach(function (el) {
        el.classList.toggle('is-kind-active', !!kind && el.getAttribute('data-kind') === kind);
      });
    }

    function resetPartJourneyView() {
      hidePartJourneyTooltip();
      highlightPartJourney('');
      filterPartJourneyKind('');
      const host = document.getElementById('part-journey-chart');
      if (host) host.innerHTML = '<div class="gantt-empty">Gere a simulação para ver a jornada das peças.</div>';
      const label = document.getElementById('part-journey-range-label');
      if (label) label.textContent = 'Gere a simulação para ver a jornada de cada peça no turno.';
      const tbody = document.getElementById('part-journey-kpi-body');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:#64748b;">Gere a simulação para ver o lead time por peça.</td></tr>';
      }
    }

    function updatePartJourneyPlaybackCursor() {
      if (!lastGanttRange) return;
      const lines = document.querySelectorAll('#part-journey-chart .gantt-now');
      if (!lines.length) return;
      const pct = pctInRange(getCurrentAbsMinute(), lastGanttRange);
      lines.forEach(function (line) {
        if (pct < 0 || pct > 100) {
          line.style.display = 'none';
          return;
        }
        line.style.display = 'block';
        line.style.left = pct + '%';
      });
    }

    function renderPartJourneyKpis(rows) {
      const tbody = document.getElementById('part-journey-kpi-body');
      if (!tbody) return;
      if (!rows || !rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:#64748b;">Nenhuma peça com jornada neste lote.</td></tr>';
        return;
      }
      tbody.innerHTML = rows.map(function (row) {
        const k = row.kpis || { leadTime: 0, prodTime: 0, efficiency: 0 };
        const eff = Number(k.efficiency) || 0;
        const effTxt = (Math.round(eff * 10) / 10).toFixed(1).replace('.', ',') + '%';
        const kind = row.kindLabel ? ' <span class="part-journey-kind">' + escapeHtml(row.kindLabel) + '</span>' : '';
        return '<tr data-part-id="' + escapeHtml(row.id) + '">' +
          '<td><strong>' + escapeHtml(row.name) + '</strong>' + kind + '</td>' +
          '<td>' + formatMinutesWithHours(k.leadTime) + '</td>' +
          '<td>' + formatMinutesWithHours(k.prodTime) + '</td>' +
          '<td><span class="part-journey-eff ' + partJourneyEfficiencyClass(eff) + '">' + effTxt + '</span></td>' +
          '<td>' + formatCurrency(k.custoMod) + '</td>' +
          '<td>' + formatCurrency(k.custoFilaJoin) + '</td>' +
          '</tr>';
      }).join('');
    }

    function renderPartJourneyChart(sharedRange) {
      bindPartJourneyUi();
      hidePartJourneyTooltip();
      highlightPartJourney('');
      const host = document.getElementById('part-journey-chart');
      const label = document.getElementById('part-journey-range-label');
      if (!host) return;
      if (!simulationHistory.length) {
        resetPartJourneyView();
        return;
      }

      const range = sharedRange || lastGanttRange || (ganttViewMode === 'lot'
        ? getGanttRangeForLot()
        : getGanttRangeForDay(selectedDayIndex));
      const rows = typeof buildPartJourneyRows === 'function'
        ? buildPartJourneyRows(range.start, range.end)
        : [];
      const lunches = lunchOverlaysInRange(range.start, range.end);
      const dayMarks = range.mode === 'lot' ? dayBoundaryAbsMins(range.start, range.end) : [];
      const ticks = ganttAxisTicks(range);
      const span = Math.max(1, range.end - range.start);

      if (label) {
        if (range.mode === 'day') {
          const iso = workDays[range.dayIndex] || startDateStr;
          label.textContent = 'Dia ' + (range.dayIndex + 1) + ' (' + formatDisplayDate(iso) + ') · turno 07:30–17:18 · almoço 12:00–13:00';
        } else {
          label.textContent = 'Lote contínuo: ' +
            absMinuteToTimeLabel(range.start) + ' → ' + absMinuteToTimeLabel(Math.max(range.start, range.end - 1));
        }
      }

      renderPartJourneyKpis(rows);

      if (!rows.length) {
        host.innerHTML = '<div class="gantt-empty">Nenhuma peça com jornada neste lote.</div>';
        return;
      }

      const axisHtml = ticks.map(function (tk) {
        const left = pctInRange(tk.abs, range);
        if (left < -1 || left > 101) return '';
        if (tk.kind !== 'day' && left > 96) return '';
        if (tk.kind === 'day') {
          return '<span class="gantt-tick gantt-tick-day" style="left:' + left.toFixed(2) + '%">' +
            '<span class="gantt-tick-date">' + escapeHtml(tk.label) + '</span>' +
            '<span class="gantt-tick-time">' + escapeHtml(tk.sub || '07:30') + '</span>' +
            '</span>';
        }
        return '<span class="gantt-tick gantt-tick-hour" style="left:' + left.toFixed(2) + '%">' + escapeHtml(tk.label) + '</span>';
      }).join('');

      const lunchHtml = lunches.map(function (b) {
        const left = pctInRange(b.start, range);
        const width = Math.max(0.4, ((b.end - b.start) / span) * 100);
        return '<div class="gantt-lunch" style="left:' + left.toFixed(2) + '%;width:' + width.toFixed(2) + '%"></div>';
      }).join('');

      const marksHtml = dayMarks.map(function (t) {
        const left = pctInRange(t, range);
        return '<div class="gantt-day-mark" style="left:' + left.toFixed(2) + '%"></div>';
      }).join('');
      const axisMarksHtml = dayMarks.map(function (t) {
        const left = pctInRange(t, range);
        return '<div class="gantt-day-mark gantt-day-mark-axis" style="left:' + left.toFixed(2) + '%"></div>';
      }).join('');

      const nowPct = pctInRange(getCurrentAbsMinute(), range);
      const nowVisible = nowPct >= 0 && nowPct <= 100;
      const nowStyle = nowVisible
        ? 'left:' + nowPct.toFixed(2) + '%'
        : 'display:none;left:0';

      const rowsHtml = rows.map(function (row) {
        const blocks = (row.blocks || []).map(function (b) {
          const left = pctInRange(b.start, range);
          const width = Math.max(0.35, ((b.end - b.start) / span) * 100);
          const fill = (typeof PART_JOURNEY_COLORS !== 'undefined' && PART_JOURNEY_COLORS[b.kind])
            ? PART_JOURNEY_COLORS[b.kind]
            : '';
          const bg = fill ? 'background:' + fill + ';' : '';
          const dur = typeof formatExactMinutes === 'function'
            ? formatExactMinutes(Math.max(0, b.end - b.start))
            : (Math.round(Math.max(0, b.end - b.start)) + ' min');
          const startLabel = formatReportClock(b.start);
          const endLabel = formatReportClock(b.end);
          const status = b.statusText || partJourneyKindLabel(b.kind);
          return '<div class="gantt-block ' + partJourneyKindClass(b.kind) + '"' +
            ' style="left:' + left.toFixed(2) + '%;width:' + width.toFixed(2) + '%;' + bg + '"' +
            ' data-part="' + escapeHtml(row.name) + '"' +
            ' data-kind="' + escapeHtml(b.kind) + '"' +
            ' data-status="' + escapeHtml(status) + '"' +
            ' data-start-label="' + escapeHtml(startLabel) + '"' +
            ' data-end-label="' + escapeHtml(endLabel) + '"' +
            ' data-duration="' + escapeHtml(dur) + '"></div>';
        }).join('');
        const kind = row.kindLabel ? '<span class="part-journey-kind">' + escapeHtml(row.kindLabel) + '</span>' : '';
        return '<div class="gantt-row" data-part-id="' + escapeHtml(row.id) + '">' +
          '<div class="gantt-label">' + escapeHtml(row.name) + kind + '</div>' +
          '<div class="gantt-track">' + lunchHtml + marksHtml + blocks + '<div class="gantt-now" style="' + nowStyle + '"></div></div>' +
          '</div>';
      }).join('');

      host.innerHTML = '<div class="gantt-axis' + (range.mode === 'lot' ? ' is-lot' : '') + '">' + axisMarksHtml + axisHtml + '</div>' + rowsHtml;
    }

    function renderCharts() {
      const container = document.getElementById('machine-charts-container');
      if (!container) return;
      container.innerHTML = '';

      if (!simulationHistory.length) {
        resetAnalyticsView();
        resetGanttView();
        resetPartJourneyView();
        return;
      }

      const analytics = computeEfficiencyAnalytics();
      const t = analytics.totals;
      setLegendLabel('legend-working', 'Produção', t.working);
      setLegendLabel('legend-setup', 'Setup', t.setup);
      setLegendLabel('legend-waiting', 'Espera/Fila', t.waiting);
      setLegendLabel('legend-maintenance', 'Manutenção Preventiva', t.maintenance);
      setLegendLabel('legend-lunch', 'Almoço', t.lunch);
      setLegendLabel('legend-idle', 'Ocioso', t.idle);
      renderAnalyticsKpis(analytics);
      renderOperatorHoursTable(analytics.operatorRows);
      renderPlanCompletionTable();
      renderGanttChart();

      const windowLen = Math.max(1, analytics.histEnd - analytics.histStart);
      const pct = (n) => ((n / windowLen) * 100).toFixed(1);

      analytics.perMachine.forEach((pm, idx) => {
        const tt = pm.totals;
        container.innerHTML += `
          <div class="bar-container">
            <div class="bar-label">
              <span><strong>M${idx + 1}: ${pm.name}</strong></span>
              <span>Setup: ${tt.setup}m | Prod: ${tt.working}m | Espera: ${tt.waiting}m | Manut: ${tt.maintenance}m | Almoço: ${tt.lunch}m | Ocioso: ${tt.idle}m</span>
            </div>
            <div class="bar-track">
              <div class="bar-segment" style="width: ${pct(tt.setup)}%; background: #f97316;"></div>
              <div class="bar-segment" style="width: ${pct(tt.working)}%; background: #22c55e;"></div>
              <div class="bar-segment" style="width: ${pct(tt.waiting)}%; background: #eab308;"></div>
              <div class="bar-segment" style="width: ${pct(tt.maintenance)}%; background: #a855f7;"></div>
              <div class="bar-segment" style="width: ${pct(tt.lunch)}%; background: #64748b;"></div>
              <div class="bar-segment" style="width: ${pct(tt.idle)}%; background: #334155;"></div>
            </div>
          </div>`;
      });
    }

    function drawPdfReportHeader(doc) {
      const meta = getPdfReportMeta();
      const pageW = doc.internal.pageSize.getWidth();
      doc.setFillColor(241, 245, 249);
      doc.rect(0, 0, pageW, 30, 'F');
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.6);
      doc.line(0, 30, pageW, 30);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(2, 132, 199);
      doc.text((meta.isPlan ? 'Relatório do Plano de Produção — ' : 'Relatório de Produção — ') + APP_NAME + ' v' + APP_VERSION, 14, 9);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30);
      doc.text('Projeto / SKU Final: ' + meta.label, 14, 15);
      if (meta.isPlan) {
        doc.text('Quantidade de Caixas (mix): ' + meta.boxes + '    |    SKUs na fila: ' + (meta.planSkuCount || '—'), 14, 20);
      } else {
        doc.text('Quantidade de Caixas: ' + meta.boxes, 14, 20);
      }
      doc.text('Data de emissão: ' + meta.issuedStr + '    |    Hora inicial da simulação: ' + meta.startTime, 14, 25);
      doc.setFont('helvetica', 'bold');
      doc.text('Versão da aplicação: v' + APP_VERSION, pageW - 14, 9, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.text('Data inicial: ' + meta.startDate + '    |    Turno 07:30–17:18    |    Almoço 12:00–13:00', pageW - 14, 25, { align: 'right' });
      return 36;
    }

    function pdfEnsureSpace(doc, y, needed) {
      const pageH = doc.internal.pageSize.getHeight();
      if (y + needed > pageH - 10) {
        doc.addPage();
        return drawPdfReportHeader(doc);
      }
      return y;
    }

    function drawPdfSectionTitle(doc, y, title) {
      y = pdfEnsureSpace(doc, y, 10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(2, 132, 199);
      doc.text(title, 14, y);
      return y + 5;
    }

    function drawPdfKpiBoxes(doc, y, analytics) {
      y = pdfEnsureSpace(doc, y, 28);
      const pageW = doc.internal.pageSize.getWidth();
      const gap = 5;
      const boxW = (pageW - 28 - gap * 3) / 4;
      const boxH = 22;
      const planMode = typeof isPlanSimulationMode === 'function' && isPlanSimulationMode();
      const estufaN = analytics && analytics.estufaCount != null ? analytics.estufaCount : 0;
      const items = [
        {
          title: planMode ? 'Makespan Total do Plano' : 'Makespan Total',
          value: analytics && analytics.makespanElapsed > 0 ? formatMinutesWithHours(analytics.makespanElapsed) : '—',
          hint: analytics && analytics.makespanElapsed > 0
            ? ('Conclusão ' + formatReportClock(analytics.completionAbs) + ' · líquido ' + formatMinutesWithHours(analytics.makespanNet))
            : 'Sem eventos'
        },
        {
          title: planMode ? 'OEE Mix (Eficiência Global do Plano)' : 'Eficiência Global',
          value: analytics && analytics.occupied > 0 ? analytics.efficiencyPct.toFixed(1) + '%' : '—',
          hint: analytics && analytics.occupied > 0
            ? (formatMinutesWithHours(analytics.productive) + ' prod / ' + formatMinutesWithHours(analytics.occupied) + ' ocup.')
            : 'Produtivo / Ocupado'
        },
        {
          title: planMode ? 'Gargalo Crítico do Plano' : 'Gargalo Identificado',
          value: analytics && analytics.bottleneck ? analytics.bottleneck.name : 'Nenhum gargalo',
          hint: analytics && analytics.bottleneck
            ? ('Fila ' + formatMinutesWithHours(analytics.bottleneck.wait) + ' · Ocupação ' + formatMinutesWithHours(analytics.bottleneck.occupied))
            : (planMode ? 'Maior fila na concorrência do mix' : 'Maior ocupação + fila')
        },
        {
          title: 'Quantidade de Estufadas',
          value: estufaN > 0 && analytics.estufaOccupancy && analytics.estufaOccupancy.count
            ? (estufaN + ' (' + (Math.round(analytics.estufaOccupancy.pct * 10) / 10).toFixed(1) + '%)')
            : String(estufaN),
          hint: estufaN > 0
            ? ((typeof formatEstufaOccupancyLabel === 'function' && analytics.estufaOccupancy)
              ? formatEstufaOccupancyLabel(analytics.estufaOccupancy)
              : (estufaN + ' ciclo(s) · ' + estufaCycleHintText()))
            : 'Sem ciclos de estufa'
        }
      ];
      items.forEach((item, i) => {
        const x = 14 + i * (boxW + gap);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(x, y, boxW, boxH, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text(item.title.toUpperCase(), x + 3, y + 5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(2, 132, 199);
        doc.text(doc.splitTextToSize(item.value, boxW - 6), x + 3, y + 11);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(90);
        doc.text(doc.splitTextToSize(item.hint, boxW - 6), x + 3, y + 17);
      });
      y = y + boxH + 4;
      y = pdfEnsureSpace(doc, y, 22);
      const cost = (analytics && typeof computeLaborCostSummary === 'function')
        ? computeLaborCostSummary(analytics.makespanElapsed, (typeof getPdfReportMeta === 'function' ? getPdfReportMeta().boxes : 1))
        : null;
      const costItems = [
        { title: 'Custo Total de MOD', value: cost ? formatCurrency(cost.custoModTotal) : '—', hint: 'Mão de obra direta (setup + produção)' },
        { title: 'Custo de Fila/Gargalo', value: cost ? formatCurrency(cost.custoFilaJoin) : '—', hint: 'Oportunidade do tempo parado (fila + JOIN)' },
        { title: 'Preço Sugerido por Caixa', value: cost ? formatCurrency(cost.precoSugeridoCaixa) : '—', hint: 'Custo operacional do makespan + MOD / caixas' }
      ];
      const costW = (pageW - 28 - gap * 2) / 3;
      costItems.forEach(function (item, i) {
        const x = 14 + i * (costW + gap);
        doc.setFillColor(15, 23, 42);
        doc.setDrawColor(2, 132, 199);
        doc.roundedRect(x, y, costW, boxH, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(item.title.toUpperCase(), x + 3, y + 5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(56, 189, 248);
        doc.text(doc.splitTextToSize(item.value, costW - 6), x + 3, y + 12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(doc.splitTextToSize(item.hint, costW - 6), x + 3, y + 18);
      });
      return y + boxH + 6;
    }

    function formatPdfJourneyMinutes(mins) {
      return formatReportMinutes(mins);
    }

    function formatPdfJourneyEfficiency(pct) {
      const n = Number(pct);
      if (!isFinite(n)) return '0,0%';
      return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',') + '%';
    }

    function drawPdfJourneyColorLegend(doc, y) {
      const items = [
        { label: 'Fila', hex: '#7f8c8d', rgb: [127, 140, 141] },
        { label: 'Setup', hex: '#e67e22', rgb: [230, 126, 34] },
        { label: 'Produção', hex: '#2ecc71', rgb: [46, 204, 113] },
        { label: 'Aguardando União', hex: '#f1c40f', rgb: [241, 196, 15] }
      ];
      let x = 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      items.forEach(function (it) {
        doc.setFillColor(it.rgb[0], it.rgb[1], it.rgb[2]);
        doc.setDrawColor(148, 163, 184);
        doc.rect(x, y - 2.4, 4.2, 4.2, 'FD');
        doc.setTextColor(50);
        doc.text(it.label, x + 5.4, y + 0.8);
        x += doc.getTextWidth(it.label) + 14;
      });
      return y + 6;
    }

    function drawPdfPartJourneySection(doc, y, tableMargin) {
      const rows = typeof buildPartJourneyRows === 'function' ? buildPartJourneyRows() : [];
      y = drawPdfSectionTitle(doc, y, 'Jornada e Eficiência das Peças / Subconjuntos');
      y = drawPdfJourneyColorLegend(doc, y);
      y = pdfEnsureSpace(doc, y, 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(90);
      doc.text('Eficiência do Ciclo = (Tempo de Produção / Lead Time Total) × 100.  Verde ≥ 50%   |   Laranja < 50%.', 14, y);
      y += 5;

      const kpiBody = rows.length
        ? rows.map(function (r) {
          const k = r.kpis || {};
          return [
            r.name + (r.kindLabel ? ' (' + r.kindLabel + ')' : ''),
            formatPdfJourneyMinutes(k.leadTime),
            formatPdfJourneyMinutes(k.prodTime),
            formatPdfJourneyMinutes(k.filaTime != null ? k.filaTime : k.waitTime),
            formatPdfJourneyMinutes(k.unionTime),
            formatPdfJourneyEfficiency(k.efficiency),
            formatCurrency(k.custoMod),
            formatCurrency(k.custoFilaJoin)
          ];
        })
        : [['—', '—', '—', '—', '—', '—', '—', '—']];

      doc.autoTable({
        startY: y,
        head: [[
          'Peça / SKU',
          'Lead Time Total (min)',
          'Tempo de Produção (min)',
          'Tempo em Fila/Espera (min)',
          'Tempo no JOIN (min)',
          'Eficiência do Ciclo (%)',
          'Custo MOD (R$)',
          'Custo de Fila/JOIN (R$)'
        ]],
        body: kpiBody,
        theme: 'striped',
        margin: tableMargin,
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
        headStyles: { fillColor: [2, 132, 199], fontSize: 7, textColor: 255 },
        styles: { fontSize: 7, cellPadding: 1.5, minCellHeight: 7, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 62, fontStyle: 'bold' },
          5: { halign: 'center', fontStyle: 'bold' }
        },
        didParseCell: function (data) {
          if (data.section !== 'body' || !rows.length) return;
          const row = rows[data.row.index];
          if (!row || !row.kpis) return;
          if (data.column.index === 3) {
            data.cell.styles.textColor = [127, 140, 141];
          }
          if (data.column.index === 4) {
            data.cell.styles.textColor = [180, 140, 10];
          }
          if (data.column.index === 5) {
            const eff = Number(row.kpis.efficiency) || 0;
            if (eff >= 50) {
              data.cell.styles.textColor = [21, 128, 61];
              data.cell.styles.fillColor = [220, 252, 231];
            } else {
              data.cell.styles.textColor = [194, 65, 12];
              data.cell.styles.fillColor = [255, 237, 213];
            }
          }
        },
        didDrawPage: function (data) {
          if (data.pageNumber > 1) drawPdfReportHeader(doc);
        }
      });
      y = (doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : y) + 8;

      y = drawPdfSectionTitle(doc, y, 'Detalhamento da Jornada e Indicadores de Gargalo');
      y = pdfEnsureSpace(doc, y, 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(90);
      doc.text('Lead time: da primeira fila até a conclusão do último posto/união. Gargalo: mais tempo em Fila (cinza) ou Aguardando União (amarelo) do que em produção.', 14, y);
      y += 5;

      const detailBody = rows.length
        ? rows.map(function (r) {
          const k = r.kpis || {};
          const startLbl = k.startAbs != null ? formatReportClock(k.startAbs) : '—';
          const endLbl = k.endAbs != null ? formatReportClock(k.endAbs) : '—';
          return [
            r.name + (r.kindLabel ? ' (' + r.kindLabel + ')' : ''),
            startLbl,
            endLbl,
            formatPdfJourneyMinutes(k.leadTime),
            formatPdfJourneyMinutes(k.filaTime),
            formatPdfJourneyMinutes(k.unionTime),
            formatPdfJourneyMinutes(k.prodTime),
            k.bottleneckNote || '—'
          ];
        })
        : [['—', '—', '—', '—', '—', '—', '—', '—']];

      doc.autoTable({
        startY: y,
        head: [[
          'Peça / SKU',
          'Início (1ª fila)',
          'Conclusão',
          'Lead Time (min)',
          'Fila (min)',
          'União (min)',
          'Produção (min)',
          'Indicador de gargalo'
        ]],
        body: detailBody,
        theme: 'striped',
        margin: tableMargin,
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
        headStyles: { fillColor: [2, 132, 199], fontSize: 6.5, textColor: 255 },
        styles: { fontSize: 6.5, cellPadding: 1.4, minCellHeight: 7, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 48, fontStyle: 'bold' },
          7: { cellWidth: 78 }
        },
        didParseCell: function (data) {
          if (data.section !== 'body' || !rows.length) return;
          const row = rows[data.row.index];
          if (!row || !row.kpis) return;
          if (data.column.index === 4) data.cell.styles.textColor = [127, 140, 141];
          if (data.column.index === 5) data.cell.styles.textColor = [180, 140, 10];
          if (data.column.index === 6) data.cell.styles.textColor = [21, 128, 61];
          if (row.kpis.isBottleneck) {
            if (data.column.index === 7) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [146, 64, 14];
              data.cell.styles.fillColor = [254, 243, 199];
            }
          }
        },
        didDrawPage: function (data) {
          if (data.pageNumber > 1) drawPdfReportHeader(doc);
        }
      });
      return (doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : y) + 8;
    }

    function drawPdfGantt(doc, y, range, title) {
      const rows = buildGanttRows(range.start, range.end);
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      const labelW = 46;
      const chartX = margin + labelW;
      const chartW = pageW - margin - chartX;
      const rowH = 7;
      const axisH = 8;
      const needed = 10 + axisH + Math.max(1, rows.length) * rowH + 10;
      y = pdfEnsureSpace(doc, y, Math.min(needed, pageH - 50));
      y = drawPdfSectionTitle(doc, y, title);

      const span = Math.max(1, range.end - range.start);
      const xOf = (abs) => chartX + ((abs - range.start) / span) * chartW;
      const chartTop = y + 2;
      const chartBottom = chartTop + axisH + rows.length * rowH;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(90);
      if (range.mode === 'day') {
        [0, 90, 210, 270, 330, 450, 570].forEach(m => {
          const abs = range.start + m;
          const x = xOf(abs);
          doc.text(minuteInDayToTimeStr(m), x, chartTop, { align: 'center' });
        });
      } else {
        const dayMarksPdf = dayBoundaryAbsMins(range.start, range.end);
        const step = span > MINUTES_PER_DAY * 2 ? 180 : 120;
        const minGap = Math.max(step * 0.4, span * 0.08);
        for (let t = range.start; t <= range.end; t += step) {
          if (dayMarksPdf.some(d => Math.abs(d - t) < minGap)) continue;
          doc.text(minuteInDayToTimeStr(t % MINUTES_PER_DAY), xOf(t), chartTop, { align: 'center' });
        }
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(2, 132, 199);
        dayMarksPdf.forEach(t => {
          const iso = absMinuteToParts(t).dateIso;
          doc.text(formatDisplayDate(iso), xOf(t), chartTop, { align: 'center' });
        });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(90);
      }

      const trackTop = chartTop + axisH;
      lunchOverlaysInRange(range.start, range.end).forEach(b => {
        const x = xOf(b.start);
        const w = Math.max(0.8, xOf(b.end) - x);
        if (doc.GState) {
          doc.setGState(new doc.GState({ opacity: 0.22 }));
          doc.setFillColor(148, 163, 184);
          doc.rect(x, trackTop, w, rows.length * rowH, 'F');
          doc.setGState(new doc.GState({ opacity: 1 }));
        } else {
          doc.setFillColor(226, 232, 240);
          doc.rect(x, trackTop, w, rows.length * rowH, 'F');
        }
        doc.setDrawColor(148, 163, 184);
        try {
          if (typeof doc.setLineDashPattern === 'function') doc.setLineDashPattern([1.2, 1.2], 0);
        } catch (err) { /* ignore */ }
        doc.line(x, trackTop, x, trackTop + rows.length * rowH);
        doc.line(x + w, trackTop, x + w, trackTop + rows.length * rowH);
        try {
          if (typeof doc.setLineDashPattern === 'function') doc.setLineDashPattern([], 0);
        } catch (err) { /* ignore */ }
      });

      const colors = {
        wait: [100, 116, 139],
        setup: [249, 115, 22],
        prod: [34, 197, 94],
        maint: [168, 85, 247]
      };

      rows.forEach((row, idx) => {
        const ry = trackTop + idx * rowH;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(40);
        doc.text(doc.splitTextToSize(row.name, labelW - 2)[0] || row.name, margin, ry + 5);
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.rect(chartX, ry + 0.6, chartW, rowH - 1.2, 'FD');
        sortGanttBlocksForPaint(row.blocks).forEach(b => {
          const x = xOf(b.start);
          const w = Math.max(0.6, xOf(b.end) - x);
          const fill = typeof ganttBlockFill === 'function' ? ganttBlockFill(b) : null;
          const rgb = (fill && fill.rgb) || colors[b.kind] || [100, 116, 139];
          doc.setFillColor(rgb[0], rgb[1], rgb[2]);
          doc.rect(x, ry + 1.4, w, rowH - 2.8, 'F');
          if ((b.kind === 'estufa' || b.kind === 'cooling' || b.kind === 'unload') && b.partName && w >= 16) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(4.5);
            doc.setTextColor(255);
            const tag = doc.splitTextToSize(String(b.partName), Math.max(12, w - 1.2))[0];
            doc.text(tag, x + 0.6, ry + 4.4);
            doc.setTextColor(40);
          }
        });
      });

      if (range.mode === 'lot') {
        dayBoundaryAbsMins(range.start, range.end).forEach(t => {
          const x = xOf(t);
          doc.setDrawColor(2, 132, 199);
          doc.setLineWidth(0.7);
          doc.line(x, chartTop, x, trackTop + rows.length * rowH);
        });
        doc.setLineWidth(0.2);
      }

      doc.setFontSize(6.5);
      doc.setTextColor(80);
      let legendY = chartBottom + 4;
      const legend = [
        { c: [249, 115, 22], t: 'Setup' },
        { c: [34, 197, 94], t: 'Produção' },
        { c: [239, 68, 68], t: 'Estufa (SKU no lote)' },
        { c: [100, 116, 139], t: 'Espera/Fila' },
        { c: [148, 163, 184], t: 'Almoço 12:00–13:00' }
      ];
      const skuItems = (typeof isPlanSimulationMode === 'function' && isPlanSimulationMode() && typeof getPlanSkuLegendItems === 'function')
        ? getPlanSkuLegendItems()
        : [];
      if (skuItems.length) {
        let lxSku = margin;
        skuItems.forEach((item, i) => {
          if (lxSku > pageW - 70) {
            legendY += 5;
            lxSku = margin;
          }
          doc.setFillColor(item.rgbProd[0], item.rgbProd[1], item.rgbProd[2]);
          doc.rect(lxSku, legendY - 2.2, 3.5, 3.5, 'F');
          doc.text(item.label + ' → ' + item.name, lxSku + 5, legendY + 0.6);
          lxSku += Math.min(72, 18 + String(item.name || '').length * 1.6);
          if (i === skuItems.length - 1) legendY += 6;
        });
      }
      let lx = margin;
      legend.forEach(item => {
        doc.setFillColor(item.c[0], item.c[1], item.c[2]);
        doc.rect(lx, legendY - 2.2, 3.5, 3.5, 'F');
        doc.text(item.t, lx + 5, legendY + 0.6);
        lx += 38;
      });
      return legendY + 8;
    }

    function generatePDFReport() {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('Biblioteca de PDF não carregada.');
        return;
      }
      if (!simulationHistory.length) {
        alert('Gere a simulação antes de exportar o relatório.');
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape' });
      const meta = getPdfReportMeta();
      const analytics = computeEfficiencyAnalytics();
      const tableMargin = { top: 34, left: 14, right: 14, bottom: 12 };

      let y = drawPdfReportHeader(doc);
      y = drawPdfSectionTitle(doc, y, meta.isPlan ? 'Resumo Executivo de KPIs do Mix' : 'Resumo Executivo de KPIs');
      y = drawPdfKpiBoxes(doc, y, analytics);

      if (meta.isPlan && typeof computePlanItemSummaries === 'function') {
        y = drawPdfSectionTitle(doc, y, 'Projetos do Plano e Datas de Conclusão');
        const planRows = computePlanItemSummaries().map(r => [
          String(r.order),
          r.projectName,
          String(r.boxesQty),
          r.trigger,
          r.startAbs != null ? absMinuteToTimeLabel(r.startAbs) : '—',
          r.endAbs != null ? absMinuteToTimeLabel(r.endAbs) : '—'
        ]);
        doc.autoTable({
          startY: y,
          head: [['Ordem', 'SKU / Projeto', 'Caixas', 'Gatilho de Início', 'Início previsto', 'Término previsto']],
          body: planRows.length ? planRows : [['—', '—', '—', '—', '—', '—']],
          theme: 'striped',
          margin: tableMargin,
          rowPageBreak: 'avoid',
          showHead: 'everyPage',
          headStyles: { fillColor: [2, 132, 199], fontSize: 7, textColor: 255 },
          styles: { fontSize: 7, cellPadding: 1.6, minCellHeight: 7, overflow: 'linebreak' },
          didDrawPage: (data) => {
            if (data.pageNumber > 1) drawPdfReportHeader(doc);
          }
        });
        y = (doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : y) + 8;
      }

      y = drawPdfSectionTitle(doc, y, 'Horas Trabalhadas por Operador');
      const opRows = (analytics.operatorRows || []).map(r => [
        r.operator,
        r.principalMachine,
        formatMinutesWithHours(r.production),
        formatMinutesWithHours(r.setup),
        formatMinutesWithHours(r.inactive),
        formatMinutesWithHours(r.worked)
      ]);
      doc.autoTable({
        startY: y,
        head: [['Operador', 'Posto/Máquina Principal', 'Produção', 'Setup', 'Ociosidade / Espera', 'Total no Turno']],
        body: opRows.length ? opRows : [['—', '—', '—', '—', '—', '—']],
        theme: 'striped',
        margin: tableMargin,
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
        headStyles: { fillColor: [2, 132, 199], fontSize: 7, textColor: 255 },
        styles: { fontSize: 7, cellPadding: 1.6, minCellHeight: 7, overflow: 'linebreak' },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) drawPdfReportHeader(doc);
        }
      });
      y = (doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : y) + 8;

      y = drawPdfSectionTitle(doc, y, 'Tempos por Peça / Subconjunto e Estrutura BOM / JOIN');
      const bomRows = buildBomDetailRows().map(r => [
        r.name,
        r.kind,
        String(r.qty),
        r.route,
        formatReportMinutes(r.setup),
        formatReportMinutes(r.prod),
        formatReportClock(r.startLabel),
        formatReportClock(r.endLabel),
        r.requer
      ]);
      doc.autoTable({
        startY: y,
        head: [['Peça / SKU', 'Tipo', 'Qtd', 'Roteiro', 'Setup (min)', 'Prod (min)', 'Início', 'Fim', 'BOM / requer']],
        body: bomRows.length ? bomRows : [['—', '—', '—', '—', '—', '—', '—', '—', '—']],
        theme: 'striped',
        margin: tableMargin,
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
        headStyles: { fillColor: [2, 132, 199], fontSize: 6.5, textColor: 255 },
        styles: { fontSize: 6.5, cellPadding: 1.4, minCellHeight: 7, overflow: 'linebreak' },
        columnStyles: { 3: { cellWidth: 52 }, 8: { cellWidth: 42 } },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) drawPdfReportHeader(doc);
        }
      });
      y = (doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : y) + 8;

      y = drawPdfPartJourneySection(doc, y, tableMargin);

      const usedDays = Math.max(1, Math.ceil(Math.max(1, getProjectMakespanEndAbsMin()) / MINUTES_PER_DAY));
      for (let d = 0; d < usedDays; d++) {
        const range = getGanttRangeForDay(d);
        const iso = workDays[d] || startDateStr;
        const dayTitle = 'Gráfico de Gantt — Dia ' + (d + 1) + ' (' + formatDisplayDate(iso) + ')';
        if (d === 0) {
          const pageH = doc.internal.pageSize.getHeight();
          if (y > pageH - 70) {
            doc.addPage();
            y = drawPdfReportHeader(doc);
          }
        } else {
          doc.addPage();
          y = drawPdfReportHeader(doc);
        }
        y = drawPdfGantt(doc, y, range, dayTitle);
      }

      if (usedDays > 1 || meta.isPlan) {
        doc.addPage();
        y = drawPdfReportHeader(doc);
        y = drawPdfGantt(
          doc,
          y,
          getGanttRangeForLot(),
          meta.isPlan ? 'Gantt Unificado do Plano' : 'Gráfico de Gantt — Lote contínuo'
        );
      }

      doc.addPage();
      y = drawPdfReportHeader(doc);
      y = drawPdfSectionTitle(doc, y, 'Cronoanálise do Chão de Fábrica');

      const tableRows = [];
      rawEvents.forEach((evt, evtIdx) => {
        const mObj = machines.find(mach => mach.id === evt.machineId);
        const sector = mObj ? mObj.name : '-';
        const operador = getMachineOperatorLabel(mObj);
        const qty = evt.qty;
        if (evt.setupTime > 0) {
          tableRows.push({
            abs: evt.setupStart,
            kind: 0,
            seq: evtIdx,
            cells: [
              formatReportClock(evt.setupStart),
              evt.partName,
              String(qty),
              formatReportMinutes(evt.setupUnit),
              formatReportMinutes(evt.setupTime),
              sector,
              operador,
              'Em Ajuste / Setup',
              '',
              '',
              ''
            ]
          });
        }
        if (evt.isEstufaBatch) {
          const queimaEnd = evt.estufaQueimaEnd != null ? evt.estufaQueimaEnd : evt.end;
          const resfrioEnd = typeof estufaResfrioEndOf === 'function' ? estufaResfrioEndOf(evt) : (evt.estufaResfrioEnd != null ? evt.estufaResfrioEnd : evt.end);
          const unloadStart = evt.estufaUnloadStart != null ? evt.estufaUnloadStart : resfrioEnd;
          const queimaMin = evt.estufaQueimaMin != null ? Number(evt.estufaQueimaMin) : (typeof ESTUFA_QUEIMA_MIN !== 'undefined' ? ESTUFA_QUEIMA_MIN : 30);
          const resfrioMin = evt.estufaResfrioMin != null ? Number(evt.estufaResfrioMin) : (typeof ESTUFA_RESFRIO_MIN !== 'undefined' ? ESTUFA_RESFRIO_MIN : 30);
          const unloadMin = Math.max(0, (Number(evt.prodTime) || 0) - queimaMin - resfrioMin);
          tableRows.push({
            abs: evt.prodStart,
            kind: 1,
            seq: evtIdx,
            cells: [
              formatReportClock(evt.prodStart),
              evt.partName,
              String(qty),
              formatReportMinutes(queimaMin),
              formatReportMinutes(queimaMin),
              sector,
              operador,
              'QUEIMA',
              '',
              '',
              ''
            ]
          });
          tableRows.push({
            abs: queimaEnd,
            kind: 1,
            seq: evtIdx,
            cells: [
              formatReportClock(queimaEnd),
              evt.partName,
              String(qty),
              formatReportMinutes(resfrioMin),
              formatReportMinutes(resfrioMin),
              sector,
              operador,
              'RESFRIAMENTO',
              '',
              '',
              ''
            ]
          });
          if (evt.end > unloadStart) {
            tableRows.push({
              abs: unloadStart,
              kind: 1,
              seq: evtIdx,
              cells: [
                formatReportClock(unloadStart),
                evt.partName,
                String(qty),
                formatReportMinutes(evt.prodUnit),
                formatReportMinutes(unloadMin),
                sector,
                operador,
                'DESCARREGAR',
                '',
                '',
                ''
              ]
            });
          }
        } else {
          tableRows.push({
            abs: evt.prodStart,
            kind: 1,
            seq: evtIdx,
            cells: [
              formatReportClock(evt.prodStart),
              evt.partName,
              String(qty),
              formatReportMinutes(evt.prodUnit),
              formatReportMinutes(evt.prodTime),
              sector,
              operador,
              'Em Processamento / Produção',
              '',
              '',
              ''
            ]
          });
        }
      });
      maintenanceEvents.forEach(me => {
        const mObj = machines.find(mach => mach.id === me.machineId);
        tableRows.push({
          abs: me.start,
          kind: 2,
          seq: 100000,
          cells: [
            formatReportClock(me.start),
            '—',
            '—',
            '—',
            formatReportMinutes(me.duration),
            mObj ? mObj.name : '-',
            getMachineOperatorLabel(mObj),
            'Manutenção Preventiva',
            '',
            '',
            ''
          ]
        });
      });
      tableRows.sort((a, b) => (a.abs - b.abs) || ((a.kind || 0) - (b.kind || 0)) || ((a.seq || 0) - (b.seq || 0)));

      doc.autoTable({
        startY: y,
        head: [[
          'Horário',
          'Peça / Componente',
          'Quantidade (un)',
          'Tempo Indiv. (min)',
          'Tempo Total Simulado (min)',
          'Setor / Máquina',
          'Operador Responsável',
          'Status / Situação',
          'Tempo Registrado (min)',
          'Descrição / Como foi feito',
          'Desempenho (Reg. vs Sim.)'
        ]],
        body: tableRows.map(r => r.cells),
        theme: 'striped',
        margin: tableMargin,
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
        headStyles: { fillColor: [2, 132, 199], fontSize: 6, textColor: 255 },
        styles: { fontSize: 6, cellPadding: 1.5, minCellHeight: 8, overflow: 'linebreak' },
        columnStyles: {
          8: { cellWidth: 22 },
          9: { cellWidth: 38 },
          10: { cellWidth: 24 }
        },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) drawPdfReportHeader(doc);
        }
      });

      y = (doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : y) + 8;
      y = pdfEnsureSpace(doc, y, 10);
      doc.setFontSize(8);
      doc.setTextColor(90);
      doc.text('Cronoanálise: preencha Tempo Registrado e Descrição/Como foi feito à mão. Use Desempenho (Reg. vs Sim.) para premiação.', 14, y);

      doc.save(meta.filename);
    }

function navigateTo(screenId) {
  if (screenId === 'screen-sim') {
    if (typeof activatePlanRuntimeIfNeeded === 'function') activatePlanRuntimeIfNeeded();
    if (typeof syncSimEstufaCycleFields === 'function') syncSimEstufaCycleFields({ fillIfEmpty: true });
  } else if (typeof restoreEngineeringSessionIfNeeded === 'function') {
    restoreEngineeringSessionIfNeeded();
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
  if (screenId !== 'screen-sim') {
    clearInterval(timerInterval);
    isPlaying = false;
    updatePlayButtonUI();
  }
  if (typeof syncAppNav === 'function') syncAppNav(screenId);
  if (screenId === 'screen-tester') {
    if (typeof refreshTesterSkuBanner === 'function') refreshTesterSkuBanner();
    if (typeof setTesterSearchMode === 'function') setTesterSearchMode(typeof testerSearchMode === 'string' ? testerSearchMode : 'quick');
  }
  if (screenId === 'screen-plan' && typeof renderProductionPlanUI === 'function') {
    renderProductionPlanUI();
  }
  if (screenId === 'screen-sim' && simulationHistory.length && typeof renderAbsMinute === 'function') {
    lastRenderedMinute = -1;
    renderAbsMinute(getCurrentAbsMinute(), true);
    if (typeof renderCharts === 'function') renderCharts();
  }
  if (typeof syncTesterFloatingWidget === 'function') syncTesterFloatingWidget();
}
