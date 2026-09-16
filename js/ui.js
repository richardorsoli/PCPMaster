/* SimulaFab v1.6.2 — Manipulação de DOM, timeline, relógio, tabelas e PDF */

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
        employees: mergeEntitiesById(employees, catalogBefore.employees, item => ({
          id: item.id, name: item.name, matricula: item.matricula
        })),
        machines: machines
      });

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
      loadEmployeesFromCatalog();
      machines = [];
      persistBaseCatalog();
      const boxesEl = document.getElementById('boxes-qty');
      const dateEl = document.getElementById('start-date');
      if (boxesEl) boxesEl.value = 1;
      if (dateEl) dateEl.value = startDateStr;
      applyStartTimeToState(DEFAULT_START_TIME);
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
      document.getElementById('new-machine-name').value = '';
      document.getElementById('new-machine-pop').value = '';
      document.getElementById('new-machine-maint-interval').value = '0';
      document.getElementById('new-machine-maint-duration').value = '0';
      document.getElementById('new-machine-last-maint').value = '';
      document.getElementById('new-machine-next-maint').value = '';
      resetSimulationView();
      renderConfigUI();
      navigateTo('screen-config');
    }

    function updateCurrentProjectLabel() {
      const el = document.getElementById('current-project-label');
      if (!el) return;
      el.textContent = currentProjectName ? currentProjectName : 'Não salvo (sem nome)';
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

    // --- FUNCIONÁRIOS ---
    function addEmployee() {
      const name = document.getElementById('new-employee-name').value.trim();
      const matricula = document.getElementById('new-employee-matricula').value.trim();
      if (!name) { alert('Informe o nome do funcionário.'); return; }
      if (!matricula) { alert('Informe a matrícula.'); return; }

      const duplicate = employees.some((e, i) =>
        e.matricula.toLowerCase() === matricula.toLowerCase() && i !== editingEmployeeIndex
      );
      if (duplicate) { alert('Já existe um funcionário com esta matrícula.'); return; }

      const data = {
        id: editingEmployeeIndex >= 0 ? employees[editingEmployeeIndex].id : ('e' + Date.now()),
        name,
        matricula
      };

      if (editingEmployeeIndex >= 0) {
        employees[editingEmployeeIndex] = data;
        editingEmployeeIndex = -1;
        document.getElementById('btn-save-employee').innerText = 'Adicionar Funcionário';
      } else {
        employees.push(data);
      }

      document.getElementById('new-employee-name').value = '';
      document.getElementById('new-employee-matricula').value = '';
      persistBaseCatalog();
      renderConfigUI();
    }

    function editEmployee(idx) {
      const e = employees[idx];
      editingEmployeeIndex = idx;
      document.getElementById('new-employee-name').value = e.name;
      document.getElementById('new-employee-matricula').value = e.matricula;
      document.getElementById('btn-save-employee').innerText = 'Salvar Alterações';
    }

    function removeEmployee(idx) {
      const removedId = employees[idx].id;
      employees.splice(idx, 1);
      machines.forEach(m => {
        if (m.defaultOperatorId === removedId) m.defaultOperatorId = '';
      });
      if (editingEmployeeIndex === idx) {
        editingEmployeeIndex = -1;
        document.getElementById('btn-save-employee').innerText = 'Adicionar Funcionário';
        document.getElementById('new-employee-name').value = '';
        document.getElementById('new-employee-matricula').value = '';
      } else if (editingEmployeeIndex > idx) {
        editingEmployeeIndex--;
      }
      persistBaseCatalog();
      renderConfigUI();
    }

    function fillMachineOperatorSelect(selectedId) {
      const sel = document.getElementById('new-machine-operator');
      if (!sel) return;
      sel.innerHTML = '<option value="">— Sem operador —</option>';
      employees.forEach(e => {
        sel.innerHTML += `<option value="${e.id}">${e.name} (${e.matricula})</option>`;
      });
      if (selectedId && [...sel.options].some(o => o.value === selectedId)) {
        sel.value = selectedId;
      }
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
          e.preventDefault();
          return;
        }
        if (typeof options.allowDrag === 'function' && !options.allowDrag(e, item)) {
          e.preventDefault();
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
      renderCurrentJoinRoute();
    }

    function removeStepFromCurrentJoin(idx) {
      currentJoinBuildingRoute.splice(idx, 1);
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
          <span class="step-tag">
            ${idx + 1}º: <strong>${m ? m.name : '?'}</strong> (Setup: ${step.setup}m | Prod/u: ${step.prodUnit}m)
            <span style="color:#ef4444; cursor:pointer; font-weight:bold; margin-left:5px;" onclick="removeStepFromCurrentJoin(${idx})">×</span>
          </span>`;
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

      const eList = document.getElementById('employees-list');
      if (eList) {
        eList.innerHTML = '';
        if (employees.length === 0) {
          eList.innerHTML = '<li style="color:#64748b;">Nenhum funcionário cadastrado.</li>';
        } else {
          employees.forEach((e, idx) => {
            eList.innerHTML += `
              <li>
                <div>
                  <strong>${e.name}</strong>
                  <div style="font-size:0.8rem; color:#94a3b8;">Matrícula: ${e.matricula}</div>
                </div>
                <div>
                  <button class="btn btn-warning" onclick="editEmployee(${idx})">Editar</button>
                  <button class="btn btn-danger" onclick="removeEmployee(${idx})">Excluir</button>
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
        const sub = (rule.route || []).map(s => {
          const sm = lookupMachine(s.machineId);
          return sm ? sm.name : '?';
        }).join(' ➔ ');
        const requer = (rule.juncao && rule.juncao.requer) ? rule.juncao.requer : rule.requiredPartNames;
        aList.innerHTML += `<li class="part-card join-card" draggable="true" data-join-index="${idx}">
          <span class="drag-handle" title="Arrastar junção" aria-hidden="true">⋮⋮</span>
          <div style="flex:1;">
            <strong>JOIN ${m ? m.name : '?'}</strong> ➔ <span style="color:#22c55e;">${rule.resultName}</span>
            <div style="font-size:0.85rem; color:#f59e0b;">requer: ${requer.join(' + ')}</div>
            <div style="font-size:0.8rem; color:#94a3b8;">Junção: setup ${rule.setup}m / prod ${rule.prodUnit}m${sub ? ` · Sub-roteiro: ${sub}` : ' · sem sub-roteiro'}</div>
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
          ignoreSelector: 'button, .part-card-actions',
          allowDrag: (e) => !e.target.closest('button, .part-card-actions'),
          onReorder: reorderAssemblyRules
        });
      }

      renderCurrentJoinRoute();
      renderHolidaysList();
      if (!document.getElementById('start-date').value) {
        document.getElementById('start-date').value = startDateStr || todayISODate();
      }
      const startTimeEl = document.getElementById('start-time');
      if (startTimeEl && !startTimeEl.value) startTimeEl.value = startTimeStr || DEFAULT_START_TIME;
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

    function renderCharts() {
      const container = document.getElementById('machine-charts-container');
      container.innerHTML = '';

      const chartMachines = getActiveMachines();
      chartMachines.forEach((m, idx) => {
        let setupTime = 0, workTime = 0, waitTime = 0, lunchTime = 0, idleTime = 0, maintTime = 0;

        simulationHistory.forEach(snap => {
          const st = snap.machinesStatus[m.id] ? snap.machinesStatus[m.id].state : 'idle';
          if (st === 'setup') setupTime++;
          else if (st === 'working') workTime++;
          else if (st === 'waiting') waitTime++;
          else if (st === 'lunch') lunchTime++;
          else if (st === 'maintenance') maintTime++;
          else idleTime++;
        });

        const total = Math.max(1, simulationHistory.length);
        const pct = (n) => ((n / total) * 100).toFixed(1);

        container.innerHTML += `
          <div class="bar-container">
            <div class="bar-label">
              <span><strong>M${idx + 1}: ${m.name}</strong></span>
              <span>Setup: ${setupTime}m | Prod: ${workTime}m | Espera: ${waitTime}m | Manut: ${maintTime}m | Almoço: ${lunchTime}m | Ocioso: ${idleTime}m</span>
            </div>
            <div class="bar-track">
              <div class="bar-segment" style="width: ${pct(setupTime)}%; background: #f97316;"></div>
              <div class="bar-segment" style="width: ${pct(workTime)}%; background: #22c55e;"></div>
              <div class="bar-segment" style="width: ${pct(waitTime)}%; background: #eab308;"></div>
              <div class="bar-segment" style="width: ${pct(maintTime)}%; background: #a855f7;"></div>
              <div class="bar-segment" style="width: ${pct(lunchTime)}%; background: #64748b;"></div>
              <div class="bar-segment" style="width: ${pct(idleTime)}%; background: #334155;"></div>
            </div>
          </div>`;
      });
    }

    function generatePDFReport() {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(2, 132, 199);
      doc.text('Relatório de Cronograma da Produção - SimulaFab v' + APP_VERSION, 14, 16);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80);
      const firstDay = workDays[0] || startDateStr;
      const lastDay = workDays[workDays.length - 1] || startDateStr;
      const multiNote = workDays.length > 1
        ? `Produção multi-dia: ${workDays.length} dias úteis (${formatDisplayDate(firstDay)} → ${formatDisplayDate(lastDay)})`
        : `Produção em 1 dia útil (${formatDisplayDate(firstDay)})`;

      doc.text(`Data Inicial: ${formatDisplayDate(firstDay)} | ${multiNote}`, 14, 23);
      doc.text(`Turno: 07:30–17:18 | Início: ${startTimeStr || DEFAULT_START_TIME} | Almoço: 12:00–13:00 | Qtd. Caixas: ${boxesQty} | Emitido: ${new Date().toLocaleDateString('pt-BR')}`, 14, 29);

      const tableRows = [];

      rawEvents.forEach((evt, evtIdx) => {
        const mObj = machines.find(mach => mach.id === evt.machineId);
        const sector = mObj ? mObj.name : '-';
        const operador = getMachineOperatorLabel(mObj);
        const qty = evt.qty;
        const tempoSimuladoSetup = String(evt.setupTime);
        const tempoSimuladoProd = String(evt.prodTime);

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
              tempoSimuladoSetup,
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
            tempoSimuladoProd,
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
      const tableData = tableRows.map(r => r.cells);

      doc.autoTable({
        startY: 34,
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
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [2, 132, 199], fontSize: 6 },
        styles: { fontSize: 6, cellPadding: 1.5, minCellHeight: 10 },
        columnStyles: {
          8: { cellWidth: 22 },
          9: { cellWidth: 38 },
          10: { cellWidth: 24 }
        }
      });

      const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 8 : 180;
      doc.setFontSize(8);
      doc.setTextColor(90);
      doc.text('Cronoanálise: preencha Tempo Registrado e Descrição/Como foi feito à mão. Use Desempenho (Reg. vs Sim.) para premiação.', 14, finalY);

      doc.save('Relatorio_Producao_SimulaFab.pdf');
    }

function navigateTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  if (screenId !== 'screen-sim') {
    clearInterval(timerInterval);
    isPlaying = false;
    updatePlayButtonUI();
  }
}
