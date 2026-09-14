/* SimulaFab v1.4.3 — Manipulação de DOM, timeline, relógio, tabelas e PDF */

    // --- EXEMPLO ---
    function loadExampleAndNavigate() {
      machines = [
        { id: "m1", name: "01. Corte Laser", pop: "Programa #102. Chapa 1.2mm e 1.5mm.", maintIntervalHours: 8, maintDurationHours: 1 },
        { id: "m2", name: "02. Dobra IMAG", pop: "Dobra do Núcleo e Dobradiça.", maintIntervalHours: 8, maintDurationHours: 1 },
        { id: "m3", name: "03. Solda MIG", pop: "Unir NUCLEO + TAMPA + ORGANIZADOR.", maintIntervalHours: 0, maintDurationHours: 0 },
        { id: "m4", name: "04. Banho / Pintura", pop: "Pintura Eletrostática do Subconjunto.", maintIntervalHours: 0, maintDurationHours: 0 },
        { id: "m5", name: "05. Montagem Final", pop: "Montar Conjunto Tampa no CORPO.", maintIntervalHours: 8, maintDurationHours: 1 },
        { id: "m6", name: "06. Embalagem / Expedição", pop: "Caixa finalizada e embalada.", maintIntervalHours: 0, maintDurationHours: 0 }
      ];

      parts = [
        {
          name: "NUCLEO", thickness: 1.2, qty: 1,
          route: [
            { machineId: "m1", setup: 30, prodUnit: 40 },
            { machineId: "m2", setup: 20, prodUnit: 30 },
            { machineId: "m3", setup: 30, prodUnit: 40 }
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
            { machineId: "m1", setup: 20, prodUnit: 30 },
            { machineId: "m3", setup: 20, prodUnit: 30 }
          ]
        },
        {
          name: "ORGANIZADOR", thickness: 1.0, qty: 1,
          route: [
            { machineId: "m1", setup: 15, prodUnit: 25 },
            { machineId: "m3", setup: 20, prodUnit: 25 }
          ]
        },
        {
          name: "CORPO", thickness: 1.5, qty: 1,
          route: [
            { machineId: "m1", setup: 40, prodUnit: 50 },
            { machineId: "m2", setup: 30, prodUnit: 40 },
            { machineId: "m5", setup: 20, prodUnit: 30 }
          ]
        }
      ];

      groupingRules = [{ machineId: "m1", partNames: ["NUCLEO", "DOBRADICA"] }];
      assemblyRules = [
        { machineId: "m3", resultName: "CONJUNTO TAMPA COMPLETO", requiredPartNames: ["NUCLEO", "TAMPA", "ORGANIZADOR"] },
        { machineId: "m5", resultName: "CAIXA COMPLETA EMBALADA", requiredPartNames: ["CONJUNTO TAMPA COMPLETO", "CORPO"] }
      ];

      startDateStr = '2026-09-14';
      document.getElementById('start-date').value = startDateStr;
      document.getElementById('boxes-qty').value = 1;
      if (!holidays.includes('2026-11-02')) holidays.push('2026-11-02');
      persistDatabaseWrapper();

      renderConfigUI();
      navigateTo('screen-config');
    }

    // --- MÁQUINAS ---
    function addMachine() {
      const name = document.getElementById('new-machine-name').value.trim();
      const pop = document.getElementById('new-machine-pop').value.trim();
      const maintIntervalHours = parseFloat(document.getElementById('new-machine-maint-interval').value) || 0;
      const maintDurationHours = parseFloat(document.getElementById('new-machine-maint-duration').value) || 0;
      if (!name) { alert('Informe o nome da máquina.'); return; }

      const data = {
        id: editingMachineIndex >= 0 ? machines[editingMachineIndex].id : ("m" + Date.now()),
        name,
        pop: pop || "Procedimento Padrão.",
        maintIntervalHours,
        maintDurationHours
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
      renderConfigUI();
    }

    function editMachine(idx) {
      const m = machines[idx];
      editingMachineIndex = idx;
      document.getElementById('new-machine-name').value = m.name;
      document.getElementById('new-machine-pop').value = m.pop || '';
      document.getElementById('new-machine-maint-interval').value = m.maintIntervalHours || 0;
      document.getElementById('new-machine-maint-duration').value = m.maintDurationHours || 0;
      document.getElementById('btn-save-machine').innerText = 'Salvar Alterações';
    }

    function removeMachine(idx) {
      const removedId = machines[idx].id;
      machines.splice(idx, 1);
      parts.forEach(p => p.route = p.route.filter(s => s.machineId !== removedId));
      if (editingMachineIndex === idx) {
        editingMachineIndex = -1;
        document.getElementById('btn-save-machine').innerText = 'Adicionar Máquina';
      }
      renderConfigUI();
    }

    // --- PEÇAS ---
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
        const m = machines.find(item => item.id === step.machineId);
        container.innerHTML += `
          <span class="step-tag">
            ${idx + 1}º: <strong>${m ? m.name : '?'}</strong> (Setup: ${step.setup}m | Prod/u: ${step.prodUnit}m)
            <span style="color:#ef4444; cursor:pointer; font-weight:bold; margin-left:5px;" onclick="removeStepFromCurrentPart(${idx})">×</span>
          </span>`;
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
    function addAssemblyRule() {
      const mId = document.getElementById('assembly-machine-select').value;
      const resultName = document.getElementById('assembly-result-name').value.trim().toUpperCase();
      const selected = [];
      document.querySelectorAll('.assembly-part-cb:checked').forEach(cb => selected.push(cb.value));
      if (!resultName) { alert('Informe o nome do subconjunto.'); return; }
      if (selected.length < 2) { alert('Selecione ao menos 2 peças componentes.'); return; }
      const rule = { machineId: mId, resultName, requiredPartNames: selected };
      if (editingAssemblyIndex >= 0) {
        assemblyRules[editingAssemblyIndex] = rule;
        editingAssemblyIndex = -1;
        document.getElementById('btn-save-assembly').innerText = 'Criar Subconjunto';
      } else {
        assemblyRules.push(rule);
      }
      document.getElementById('assembly-result-name').value = '';
      document.querySelectorAll('.assembly-part-cb').forEach(cb => cb.checked = false);
      renderConfigUI();
    }

    function editAssemblyRule(idx) {
      const a = assemblyRules[idx];
      editingAssemblyIndex = idx;
      document.getElementById('assembly-machine-select').value = a.machineId;
      document.getElementById('assembly-result-name').value = a.resultName;
      document.querySelectorAll('.assembly-part-cb').forEach(cb => {
        cb.checked = a.requiredPartNames.includes(cb.value);
      });
      document.getElementById('btn-save-assembly').innerText = 'Salvar Alterações';
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
        persistDatabaseWrapper();
      }
      document.getElementById('new-holiday-date').value = '';
      renderHolidaysList();
    }

    function removeHoliday(iso) {
      holidays = holidays.filter(h => h !== iso);
      persistDatabaseWrapper();
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
      const mList = document.getElementById('machines-list');
      mList.innerHTML = '';
      machines.forEach((m, idx) => {
        const maintTxt = (m.maintIntervalHours > 0)
          ? `Manutenção a cada ${m.maintIntervalHours}h de uso (${m.maintDurationHours}h)`
          : 'Manutenção preventiva desativada';
        mList.innerHTML += `
          <li>
            <div>
              <span class="machine-badge">M${idx + 1}</span><strong>${m.name}</strong>
              <div style="font-size:0.8rem; color:#94a3b8;">POP: ${m.pop}</div>
              <div style="font-size:0.78rem; color:#a855f7;">${maintTxt}</div>
            </div>
            <div>
              <button class="btn btn-warning" onclick="editMachine(${idx})">Editar</button>
              <button class="btn btn-danger" onclick="removeMachine(${idx})">Excluir</button>
            </div>
          </li>`;
      });

      ['step-machine-select', 'group-machine-select', 'assembly-machine-select'].forEach(id => {
        const sel = document.getElementById(id);
        const prev = sel.value;
        sel.innerHTML = '';
        machines.forEach((m, idx) => sel.innerHTML += `<option value="${m.id}">M${idx + 1}: ${m.name}</option>`);
        if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
      });

      const pList = document.getElementById('parts-list');
      pList.innerHTML = '';
      parts.forEach((p, idx) => {
        const rText = p.route.map(s => {
          const m = machines.find(item => item.id === s.machineId);
          return m ? m.name : '?';
        }).join(' ➔ ');
        pList.innerHTML += `
          <li>
            <div style="flex:1;">
              <strong>${p.name}</strong> (${p.qty} un | ${p.thickness}mm)
              <div style="font-size:0.82rem; color:#38bdf8; margin-top:3px;"><strong>Roteiro:</strong> ${rText}</div>
            </div>
            <div>
              <button class="btn btn-warning" onclick="editPart(${idx})">Editar</button>
              <button class="btn btn-danger" onclick="removePart(${idx})">Excluir</button>
            </div>
          </li>`;
      });

      const groupCBContainer = document.getElementById('group-parts-checkboxes');
      groupCBContainer.innerHTML = '';
      parts.forEach(p => {
        groupCBContainer.innerHTML += `<label class="checkbox-item"><input type="checkbox" class="group-part-cb" value="${p.name}"> ${p.name} (${p.thickness}mm)</label>`;
      });

      const gList = document.getElementById('groupings-list');
      gList.innerHTML = '';
      groupingRules.forEach((g, idx) => {
        const m = machines.find(item => item.id === g.machineId);
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
      assemblyRules.forEach((a, idx) => {
        const m = machines.find(item => item.id === a.machineId);
        aList.innerHTML += `<li>
          <div><strong>Setor: ${m ? m.name : '?'}</strong> ➔ <span style="color:#22c55e;">${a.resultName}</span>
          <div style="font-size:0.85rem; color:#f59e0b;">União de: ${a.requiredPartNames.join(' + ')}</div></div>
          <div>
            <button class="btn btn-warning" onclick="editAssemblyRule(${idx})">Editar</button>
            <button class="btn btn-danger" onclick="removeAssemblyRule(${idx})">Excluir</button>
          </div>
        </li>`;
      });

      renderHolidaysList();
      if (!document.getElementById('start-date').value) {
        document.getElementById('start-date').value = startDateStr || todayISODate();
      }
    }

    function populateDaySelect() {
      const wrap = document.getElementById('day-select-wrap');
      const sel = document.getElementById('day-select');
      sel.innerHTML = '';
      workDays.forEach((iso, idx) => {
        sel.innerHTML += `<option value="${idx}">Dia ${idx + 1} (${formatDisplayDate(iso)})</option>`;
      });
      if (workDays.length > 1) {
        wrap.style.display = 'flex';
      } else {
        wrap.style.display = 'none';
      }
      sel.value = String(selectedDayIndex);
    }

    function statusLabel(status) {
      if (status === 'waiting') return { text: 'Aguardando Outras Peças para União', cls: 'badge-waiting' };
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

    function renderCharts() {
      const container = document.getElementById('machine-charts-container');
      container.innerHTML = '';

      machines.forEach((m, idx) => {
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
      doc.text('Relatório de Cronograma da Produção - SimulaFab v1.4.3', 14, 16);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80);
      const firstDay = workDays[0] || startDateStr;
      const lastDay = workDays[workDays.length - 1] || startDateStr;
      const multiNote = workDays.length > 1
        ? `Produção multi-dia: ${workDays.length} dias úteis (${formatDisplayDate(firstDay)} → ${formatDisplayDate(lastDay)})`
        : `Produção em 1 dia útil (${formatDisplayDate(firstDay)})`;

      doc.text(`Data Inicial: ${formatDisplayDate(firstDay)} | ${multiNote}`, 14, 23);
      doc.text(`Turno: 07:30–17:18 | Almoço: 12:00–13:00 | Qtd. Caixas: ${boxesQty} | Emitido: ${new Date().toLocaleDateString('pt-BR')}`, 14, 29);

      const tableRows = [];

      rawEvents.forEach(evt => {
        const mObj = machines.find(mach => mach.id === evt.machineId);
        const sector = mObj ? mObj.name : '-';
        const qty = evt.qty;

        if (evt.setupTime > 0) {
          tableRows.push({
            abs: evt.setupStart,
            cells: [
              absMinuteToTimeLabel(evt.setupStart),
              evt.partName,
              String(qty),
              String(evt.setupUnit),
              String(evt.setupTime),
              sector,
              'Em Ajuste / Setup',
              ''
            ]
          });
        }

        tableRows.push({
          abs: evt.prodStart,
          cells: [
            absMinuteToTimeLabel(evt.prodStart),
            evt.partName,
            String(qty),
            String(evt.prodUnit),
            String(evt.prodTime),
            sector,
            'Em Processamento / Produção',
            ''
          ]
        });
      });

      maintenanceEvents.forEach(me => {
        const mObj = machines.find(mach => mach.id === me.machineId);
        tableRows.push({
          abs: me.start,
          cells: [
            absMinuteToTimeLabel(me.start),
            '—',
            '—',
            '—',
            String(me.duration),
            mObj ? mObj.name : '-',
            'Manutenção Preventiva',
            ''
          ]
        });
      });

      tableRows.sort((a, b) => a.abs - b.abs);
      const tableData = tableRows.map(r => r.cells);

      doc.autoTable({
        startY: 34,
        head: [['Horário', 'Peça / Componente', 'Quantidade (un)', 'Tempo Indiv. (min)', 'Tempo Total (min)', 'Setor / Máquina', 'Status / Situação', 'Cronoanálise (Registrado)']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [2, 132, 199] },
        styles: { fontSize: 7, cellPadding: 2 }
      });

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
