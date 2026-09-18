/* PCPMaster v1.6.4 — Manipulação de DOM, timeline, relógio, tabelas, Gantt, analytics e PDF */

    // --- EXEMPLO ---
    function loadExampleAndNavigate() {
      employees = [
        { id: 'e1', name: 'Carlos Operador', matricula: '1001' },
        { id: 'e2', name: 'Ana Soldadora', matricula: '1002' },
        { id: 'e3', name: 'Pedro Montagem', matricula: '1003' }
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
      const postoSel = document.getElementById('new-employee-posto');
      if (postoSel) postoSel.value = '';
      document.getElementById('new-machine-name').value = '';
      document.getElementById('new-machine-pop').value = '';
      document.getElementById('new-machine-maint-interval').value = '0';
      document.getElementById('new-machine-maint-duration').value = '0';
      document.getElementById('new-machine-last-maint').value = '';
      document.getElementById('new-machine-next-maint').value = '';
      resetSimulationView();
      if (typeof syncProjectNameUI === 'function') syncProjectNameUI({ syncInput: true });
      renderConfigUI();
      navigateTo('screen-config');
    }

    function syncProjectNameUI(options) {
      const name = (currentProjectName || '').trim();
      const input = document.getElementById('project-name-input');
      if (input && (options && options.syncInput || document.activeElement !== input)) {
        if (options && options.syncInput) input.value = name;
      }
      const el = document.getElementById('current-project-label');
      if (el) el.textContent = name || 'Não salvo (sem nome)';
      const simTitle = document.getElementById('sim-project-title');
      if (simTitle) {
        simTitle.textContent = name
          ? (APP_NAME + ' v' + APP_VERSION + ' — ' + name)
          : (APP_NAME + ' v' + APP_VERSION + ' - Controle de Chão de Fábrica');
      }
      const analyticsName = document.getElementById('analytics-project-name');
      if (analyticsName) analyticsName.textContent = name || 'Projeto sem nome';
      if (typeof refreshTesterSkuBanner === 'function') refreshTesterSkuBanner();
    }

    function updateCurrentProjectLabel() {
      syncProjectNameUI();
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
      const data = normalizeEmployee({
        id: editingEmployeeIndex >= 0 ? employees[editingEmployeeIndex].id : ('e' + Date.now()),
        name,
        matricula,
        setor: posto.setor,
        postoId: posto.postoId
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
    function addMachine() {
      const name = document.getElementById('new-machine-name').value.trim();
      const pop = document.getElementById('new-machine-pop').value.trim();
      const maintIntervalHours = parseFloat(document.getElementById('new-machine-maint-interval').value) || 0;
      const maintDurationHours = parseFloat(document.getElementById('new-machine-maint-duration').value) || 0;
      const defaultOperatorId = document.getElementById('new-machine-operator').value || '';
      const lastMaintenanceDate = document.getElementById('new-machine-last-maint').value || '';
      const nextMaintenanceDate = document.getElementById('new-machine-next-maint').value || '';
      if (!name) { alert('Informe o nome da máquina.'); return; }
      if (lastMaintenanceDate && nextMaintenanceDate && nextMaintenanceDate < lastMaintenanceDate) {
        alert('A data da próxima manutenção deve ser igual ou posterior à última.');
        return;
      }

      const data = {
        id: editingMachineIndex >= 0 ? machines[editingMachineIndex].id : ("m" + Date.now()),
        name,
        pop: pop || "Procedimento Padrão.",
        maintIntervalHours,
        maintDurationHours,
        defaultOperatorId,
        lastMaintenanceDate,
        nextMaintenanceDate
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
      const setup = parseInt(document.getElementById('step-setup-time').value) || 0;
      const prodUnit = parseInt(document.getElementById('step-prod-time').value) || 1;
      if (!mId) return;
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
            ${idx + 1}º: <strong>${m ? m.name : '?'}</strong> (Setup: ${step.setup}m | Prod/u: ${step.prodUnit}m)
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
      const partData = { name, thickness: thick, qty, route: [...currentBuildingRoute] };
      if (editingPartIndex >= 0) {
        parts[editingPartIndex] = partData;
        editingPartIndex = -1;
      } else {
        parts.push(partData);
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
      const setup = parseInt(document.getElementById('join-step-setup-time').value, 10) || 0;
      const prodUnit = parseInt(document.getElementById('join-step-prod-time').value, 10) || 1;
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
            ${idx + 1}º: <strong>${m ? m.name : '?'}</strong> (Setup: ${step.setup}m | Prod/u: ${step.prodUnit}m)
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
      const setup = parseInt(document.getElementById('join-setup-time').value, 10) || 1;
      const prodUnit = parseInt(document.getElementById('join-prod-time').value, 10) || 1;
      const rule = normalizeAssemblyRule({
        machineId: mId,
        resultName,
        requiredPartNames: selected,
        juncao: { requer: selected, maquina: mId },
        setup,
        prodUnit,
        qty: 1,
        route: currentJoinBuildingRoute.slice()
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
            eList.innerHTML += `
              <li>
                <div>
                  <strong>${e.name}</strong>
                  <div style="font-size:0.8rem; color:#94a3b8;">Matrícula: ${e.matricula}${setorTxt}</div>
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
        mList.innerHTML += `
          <li>
            <div>
              <span class="machine-badge">M${idx + 1}</span><strong>${m.name}</strong>
              <div style="font-size:0.8rem; color:#94a3b8;">POP: ${m.pop}</div>
              <div style="font-size:0.78rem; color:#38bdf8;">Operador padrão: ${opTxt}</div>
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
          return `<span class="step-tag route-step" draggable="true" data-route-index="${sIdx}" data-part-index="${idx}">${sIdx + 1}º ${m ? m.name : '?'}</span>`;
        }).join('');
        pList.innerHTML += `
          <li class="part-card" draggable="true" data-part-index="${idx}">
            <span class="drag-handle" title="Arrastar peça" aria-hidden="true">⋮⋮</span>
            <div style="flex:1;">
              <strong>${p.name}</strong> (${p.qty} un | ${p.thickness}mm)
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
          return `<span class="step-tag route-step join-saved-step" draggable="true" data-join-route-index="${sIdx}" data-join-index="${idx}">${sIdx + 1}º ${sm ? sm.name : '?'}</span>`;
        }).join('');
        const requer = (rule.juncao && rule.juncao.requer) ? rule.juncao.requer : rule.requiredPartNames;
        aList.innerHTML += `<li class="part-card join-card" draggable="true" data-join-index="${idx}">
          <span class="drag-handle" title="Arrastar junção" aria-hidden="true">⋮⋮</span>
          <div style="flex:1;">
            <strong>JOIN ${m ? m.name : '?'}</strong> ➔ <span style="color:#22c55e;">${rule.resultName}</span>
            <div style="font-size:0.85rem; color:#f59e0b;">requer: ${requer.join(' + ')}</div>
            <div style="font-size:0.8rem; color:#94a3b8;">Junção: setup ${rule.setup}m / prod ${rule.prodUnit}m${subHtml ? '' : ' · sem sub-roteiro'}</div>
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

    function resetAnalyticsView() {
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

      const tbody = document.getElementById('operator-hours-body');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:#64748b;">Gere a simulação para ver o relatório por operador.</td></tr>';
      }
    }

    function renderAnalyticsKpis(analytics) {
      const makespanEl = document.getElementById('kpi-makespan');
      const makespanHint = document.getElementById('kpi-makespan-hint');
      const efficiencyEl = document.getElementById('kpi-efficiency');
      const bottleneckEl = document.getElementById('kpi-bottleneck');
      const bottleneckHint = document.getElementById('kpi-bottleneck-hint');

      if (!analytics || analytics.makespanElapsed <= 0) {
        if (makespanEl) makespanEl.textContent = '—';
        if (makespanHint) makespanHint.textContent = 'Sem eventos no lote';
        if (efficiencyEl) efficiencyEl.textContent = '—';
        const efficiencyHintEmpty = document.getElementById('kpi-efficiency-hint');
        if (efficiencyHintEmpty) efficiencyHintEmpty.textContent = 'Produtivo / Ocupado (Produção + Setup) × 100';
        if (bottleneckEl) bottleneckEl.textContent = '—';
        if (bottleneckHint) bottleneckHint.textContent = 'Posto com maior ocupação (e fila)';
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
        const doneLabel = absMinuteToTimeLabel(doneAbs);
        makespanHint.textContent = `Conclusão: ${doneLabel} · ${dayTxt} · líquido (sem almoço): ${formatMinutesWithHours(analytics.makespanNet)}`;
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
          : 'Produtivo / Ocupado (Produção + Setup) × 100';
      }

      if (analytics.bottleneck) {
        const bn = analytics.bottleneck;
        if (bottleneckEl) bottleneckEl.textContent = bn.name;
        if (bottleneckHint) {
          bottleneckHint.textContent = `Ocupação: ${formatMinutesWithHours(bn.occupied)} · Fila: ${formatMinutesWithHours(bn.wait)}`;
        }
      } else {
        if (bottleneckEl) bottleneckEl.textContent = 'Nenhum gargalo';
        if (bottleneckHint) bottleneckHint.textContent = 'Sem ocupação relevante no lote';
      }
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

    function ganttKindClass(kind) {
      if (kind === 'setup') return 'gantt-block-setup';
      if (kind === 'prod') return 'gantt-block-prod';
      if (kind === 'wait') return 'gantt-block-wait';
      if (kind === 'maint') return 'gantt-block-maint';
      return '';
    }

    function ganttKindLabel(kind) {
      if (kind === 'setup') return 'Setup';
      if (kind === 'prod') return 'Produção';
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
        const marks = [0, 30, 90, 150, 210, 270, 330, 390, 450, 510, 570];
        marks.forEach(m => {
          ticks.push({ abs: range.start + m, label: minuteInDayToTimeStr(m) });
        });
        return ticks;
      }
      const span = range.end - range.start;
      const step = span > MINUTES_PER_DAY * 2 ? 120 : 60;
      for (let t = range.start; t <= range.end; t += step) {
        ticks.push({ abs: t, label: absMinuteToTimeLabel(t).split(' ').pop() });
      }
      dayBoundaryAbsMins(range.start, range.end).forEach(t => {
        ticks.push({ abs: t, label: formatDisplayDate((absMinuteToParts(t).dateIso)) });
      });
      return ticks;
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
      updateGanttModeButtons();
    }

    function updateGanttPlaybackCursor() {
      if (!lastGanttRange) return;
      if (ganttViewMode !== 'lot' && selectedDayIndex !== lastGanttDayIndex) {
        renderGanttChart();
        return;
      }
      const lines = document.querySelectorAll('#gantt-chart .gantt-now');
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
          label.textContent = 'Lote contínuo: ' + absMinuteToTimeLabel(range.start) + ' → ' + absMinuteToTimeLabel(Math.max(range.start, range.end - 1));
        }
      }

      const axisHtml = ticks.map(tk => {
        const left = pctInRange(tk.abs, range);
        if (left < -1 || left > 101) return '';
        return `<span class="gantt-tick" style="left:${left.toFixed(2)}%">${escapeHtml(tk.label)}</span>`;
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

      const nowPct = pctInRange(getCurrentAbsMinute(), range);
      const nowVisible = nowPct >= 0 && nowPct <= 100;
      const nowStyle = nowVisible
        ? `left:${nowPct.toFixed(2)}%`
        : 'display:none;left:0';

      const rowsHtml = rows.map(row => {
        const blocks = row.blocks.map(b => {
          const left = pctInRange(b.start, range);
          const width = Math.max(0.35, ((b.end - b.start) / span) * 100);
          const title = `${row.name} · ${b.partName} · ${ganttKindLabel(b.kind)} ${minuteInDayToTimeStr(b.start % MINUTES_PER_DAY)}–${minuteInDayToTimeStr((b.end - 1) % MINUTES_PER_DAY)}`;
          return `<div class="gantt-block ${ganttKindClass(b.kind)}" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%" title="${escapeHtml(title)}"></div>`;
        }).join('');
        return `<div class="gantt-row">
          <div class="gantt-label">${escapeHtml(row.name)}</div>
          <div class="gantt-track">${lunchHtml}${marksHtml}${blocks}<div class="gantt-now" style="${nowStyle}"></div></div>
        </div>`;
      }).join('');

      if (!rows.length) {
        host.innerHTML = '<div class="gantt-empty">Nenhuma máquina ativa neste lote.</div>';
        return;
      }

      host.innerHTML = `<div class="gantt-axis">${axisHtml}</div>${rowsHtml}`;
    }

    function renderCharts() {
      const container = document.getElementById('machine-charts-container');
      if (!container) return;
      container.innerHTML = '';

      if (!simulationHistory.length) {
        resetAnalyticsView();
        resetGanttView();
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
      doc.text('Relatório de Produção — ' + APP_NAME + ' v' + APP_VERSION, 14, 9);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30);
      doc.text('Projeto / SKU Final: ' + meta.label, 14, 15);
      doc.text('Quantidade de Caixas: ' + meta.boxes, 14, 20);
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
      const gap = 6;
      const boxW = (pageW - 28 - gap * 2) / 3;
      const boxH = 22;
      const items = [
        {
          title: 'Makespan Total',
          value: analytics && analytics.makespanElapsed > 0 ? formatMinutesWithHours(analytics.makespanElapsed) : '—',
          hint: analytics && analytics.makespanElapsed > 0
            ? ('Conclusão ' + absMinuteToTimeLabel(analytics.completionAbs) + ' · líquido ' + formatMinutesWithHours(analytics.makespanNet))
            : 'Sem eventos'
        },
        {
          title: 'Eficiência Global',
          value: analytics && analytics.occupied > 0 ? analytics.efficiencyPct.toFixed(1) + '%' : '—',
          hint: analytics && analytics.occupied > 0
            ? (formatMinutesWithHours(analytics.productive) + ' prod / ' + formatMinutesWithHours(analytics.occupied) + ' ocup.')
            : 'Produtivo / Ocupado'
        },
        {
          title: 'Gargalo Identificado',
          value: analytics && analytics.bottleneck ? analytics.bottleneck.name : 'Nenhum gargalo',
          hint: analytics && analytics.bottleneck
            ? ('Ocupação ' + formatMinutesWithHours(analytics.bottleneck.occupied) + ' · Fila ' + formatMinutesWithHours(analytics.bottleneck.wait))
            : 'Maior ocupação + fila'
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
      return y + boxH + 6;
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
        const step = span > MINUTES_PER_DAY * 2 ? 180 : 90;
        for (let t = range.start; t <= range.end; t += step) {
          doc.text(minuteInDayToTimeStr(t % MINUTES_PER_DAY), xOf(t), chartTop, { align: 'center' });
        }
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
          const rgb = colors[b.kind] || [100, 116, 139];
          doc.setFillColor(rgb[0], rgb[1], rgb[2]);
          doc.rect(x, ry + 1.4, w, rowH - 2.8, 'F');
        });
      });

      doc.setFontSize(6.5);
      doc.setTextColor(80);
      const legendY = chartBottom + 4;
      const legend = [
        { c: [249, 115, 22], t: 'Setup' },
        { c: [34, 197, 94], t: 'Produção' },
        { c: [100, 116, 139], t: 'Espera/Fila' },
        { c: [148, 163, 184], t: 'Almoço 12:00–13:00' }
      ];
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
      y = drawPdfSectionTitle(doc, y, 'Resumo Executivo de KPIs');
      y = drawPdfKpiBoxes(doc, y, analytics);

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
        String(r.setup),
        String(r.prod),
        r.startLabel,
        r.endLabel,
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

      if (usedDays > 1) {
        doc.addPage();
        y = drawPdfReportHeader(doc);
        y = drawPdfGantt(doc, y, getGanttRangeForLot(), 'Gráfico de Gantt — Lote contínuo');
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
              absMinuteToTimeLabel(evt.setupStart),
              evt.partName,
              String(qty),
              String(evt.setupUnit),
              String(evt.setupTime),
              sector,
              operador,
              'Em Ajuste / Setup',
              '',
              '',
              ''
            ]
          });
        }
        tableRows.push({
          abs: evt.prodStart,
          kind: 1,
          seq: evtIdx,
          cells: [
            absMinuteToTimeLabel(evt.prodStart),
            evt.partName,
            String(qty),
            String(evt.prodUnit),
            String(evt.prodTime),
            sector,
            operador,
            'Em Processamento / Produção',
            '',
            '',
            ''
          ]
        });
      });
      maintenanceEvents.forEach(me => {
        const mObj = machines.find(mach => mach.id === me.machineId);
        tableRows.push({
          abs: me.start,
          kind: 2,
          seq: 100000,
          cells: [
            absMinuteToTimeLabel(me.start),
            '—',
            '—',
            '—',
            String(me.duration),
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
  if (typeof syncTesterFloatingWidget === 'function') syncTesterFloatingWidget();
}
