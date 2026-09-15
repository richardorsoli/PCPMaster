/* SimulaFab v1.5.0 — Motor de simulação, calendário e manutenção preventiva */

// --- PARÂMETROS DO TURNO ---
const SHIFT_START_MINUTES = 7 * 60 + 30;
const SHIFT_END_MINUTES = 17 * 60 + 18;
const TOTAL_SHIFT_DURATION = SHIFT_END_MINUTES - SHIFT_START_MINUTES; // 588
const LUNCH_START_OFFSET = (12 * 60) - SHIFT_START_MINUTES; // 270
const LUNCH_END_OFFSET = (13 * 60) - SHIFT_START_MINUTES;   // 330
const MINUTES_PER_DAY = TOTAL_SHIFT_DURATION; // 588

// --- ESTADO GLOBAL ---
    let machines = [];
    let parts = [];
    let employees = [];
    let currentBuildingRoute = [];
    let editingPartIndex = -1;
    let editingMachineIndex = -1;
    let editingEmployeeIndex = -1;
    let editingGroupingIndex = -1;
    let editingAssemblyIndex = -1;
    let groupingRules = [];
    let assemblyRules = [];
    let holidays = [];
    let currentProjectName = '';

    let simulationHistory = [];
    let rawEvents = [];
    let maintenanceEvents = [];
    let workDays = [];
    let boxesQty = 1;
    let startDateStr = '';
    let totalAbsMinutes = MINUTES_PER_DAY;
    let selectedDayIndex = 0;

    let currentAbsSecond = 0;
    let isPlaying = false;
    let timerInterval = null;
    let lastRenderedMinute = -1;
    let simulationSpeed = 1; // 1x | 5x | 10x
    const BASE_TICK_MS = 80;

    function clearSimulationRuntime() {
      clearInterval(timerInterval);
      timerInterval = null;
      isPlaying = false;
      currentAbsSecond = 0;
      selectedDayIndex = 0;
      lastRenderedMinute = -1;
      simulationHistory = [];
      rawEvents = [];
      maintenanceEvents = [];
      workDays = [];
      totalAbsMinutes = MINUTES_PER_DAY;
    }

    function resetProductionPlanState() {
      currentProjectName = '';
      parts = [];
      groupingRules = [];
      assemblyRules = [];
      currentBuildingRoute = [];
      editingPartIndex = -1;
      editingMachineIndex = -1;
      editingEmployeeIndex = -1;
      editingGroupingIndex = -1;
      editingAssemblyIndex = -1;
      boxesQty = 1;
      startDateStr = todayISODate();
    }

    /** Intervalo do setInterval; reduzido proporcionalmente à velocidade (mín. 16ms). */
    function getTickIntervalMs() {
      return Math.max(16, Math.round(BASE_TICK_MS / Math.max(1, simulationSpeed)));
    }

    /**
     * Segundos de simulação avançados por tick.
     * Compensa o piso de 16ms do browser para manter fator real ~1x/5x/10x
     * em relação ao tick base de BASE_TICK_MS.
     */
    function getSecondsPerTick() {
      const actualInterval = getTickIntervalMs();
      return Math.max(1, Math.round(simulationSpeed * (actualInterval / BASE_TICK_MS)));
    }

    // --- HELPERS DE DATA / TEMPO ---
    function pad2(n) { return String(n).padStart(2, '0'); }

    function todayISODate() {
      const d = new Date();
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }

    function parseISODate(iso) {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d);
    }

    function toISODate(dateObj) {
      return `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`;
    }

    function formatDisplayDate(iso) {
      if (!iso) return '--/--/--';
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${String(y).slice(-2)}`;
    }

    function addDays(iso, n) {
      const d = parseISODate(iso);
      d.setDate(d.getDate() + n);
      return toISODate(d);
    }

    function isWeekend(iso) {
      const day = parseISODate(iso).getDay();
      return day === 0 || day === 6;
    }

    function isHoliday(iso) {
      return holidays.includes(iso);
    }

    function isWorkDay(iso) {
      return !isWeekend(iso) && !isHoliday(iso);
    }

    function nextWorkDay(iso) {
      let cur = iso;
      for (let i = 0; i < 370; i++) {
        if (isWorkDay(cur)) return cur;
        cur = addDays(cur, 1);
      }
      return iso;
    }

    function buildWorkDaysCalendar(startIso, neededDays) {
      const days = [];
      let cur = nextWorkDay(startIso);
      let guard = 0;
      while (days.length < neededDays && guard < 800) {
        if (isWorkDay(cur)) days.push(cur);
        cur = addDays(cur, 1);
        guard++;
      }
      return days;
    }

    function ensureWorkDaysCapacity(minDays) {
      const start = startDateStr || todayISODate();
      if (workDays.length >= minDays) return;
      workDays = buildWorkDaysCalendar(start, Math.max(minDays, 1));
    }

    function absMinuteToParts(absMinute) {
      const dayIndex = Math.floor(absMinute / MINUTES_PER_DAY);
      const minuteInDay = absMinute % MINUTES_PER_DAY;
      ensureWorkDaysCapacity(dayIndex + 1);
      const dateIso = workDays[dayIndex] || startDateStr || todayISODate();
      const realMins = SHIFT_START_MINUTES + minuteInDay;
      const h = Math.floor(realMins / 60);
      const m = realMins % 60;
      return { dayIndex, minuteInDay, dateIso, hours: h, minutes: m };
    }

    function absSecondToClockString(absSecond) {
      const absMinute = Math.floor(absSecond / 60);
      const sec = absSecond % 60;
      const p = absMinuteToParts(absMinute);
      return `${formatDisplayDate(p.dateIso)} - ${pad2(p.hours)}:${pad2(p.minutes)}:${pad2(sec)}`;
    }

    function minuteInDayToTimeStr(minuteInDay) {
      const realMins = SHIFT_START_MINUTES + minuteInDay;
      return `${pad2(Math.floor(realMins / 60))}:${pad2(realMins % 60)}`;
    }

    function minuteOfDay(absMin) {
      return ((absMin % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    }

    function isLunchAbsMinute(absMin) {
      const m = minuteOfDay(absMin);
      return m >= LUNCH_START_OFFSET && m < LUNCH_END_OFFSET;
    }

    /** Se cair no almoço, avança para 13:00 do mesmo dia. */
    function snapToProductive(absMin) {
      let t = Math.max(0, absMin);
      if (isLunchAbsMinute(t)) {
        t = Math.floor(t / MINUTES_PER_DAY) * MINUTES_PER_DAY + LUNCH_END_OFFSET;
      }
      return t;
    }

    function lunchMinutesInRange(start, end) {
      if (end <= start) return 0;
      let total = 0;
      const startDay = Math.floor(start / MINUTES_PER_DAY);
      const endDay = Math.floor((end - 1) / MINUTES_PER_DAY);
      for (let d = startDay; d <= endDay; d++) {
        const lunchStart = d * MINUTES_PER_DAY + LUNCH_START_OFFSET;
        const lunchEnd = d * MINUTES_PER_DAY + LUNCH_END_OFFSET;
        const a = Math.max(start, lunchStart);
        const b = Math.min(end, lunchEnd);
        if (b > a) total += (b - a);
      }
      return total;
    }

    function productiveMinutesBetween(start, end) {
      return Math.max(0, end - start - lunchMinutesInRange(start, end));
    }

    /** Soma minutos de produção/setup pulando [12:00, 13:00). Retorno exclusivo. */
    function addProductiveMinutes(startAbsMin, duration) {
      let t = snapToProductive(startAbsMin);
      let left = Math.max(0, Number(duration) || 0);
      if (left === 0) return t;
      let guard = 0;
      while (left > 0 && guard++ < 2000) {
        const dayStart = Math.floor(t / MINUTES_PER_DAY) * MINUTES_PER_DAY;
        const m = t - dayStart;
        if (m < LUNCH_START_OFFSET) {
          const beforeLunch = LUNCH_START_OFFSET - m;
          if (left <= beforeLunch) return t + left;
          left -= beforeLunch;
          t = dayStart + LUNCH_END_OFFSET;
        } else {
          const untilEod = MINUTES_PER_DAY - m;
          if (left <= untilEod) return t + left;
          left -= untilEod;
          t = dayStart + MINUTES_PER_DAY;
        }
      }
      return t;
    }

    /** Durante o almoço, o restante congela no valor de 11:59. */
    function lunchPauseReferenceAbsMin(absMin) {
      if (!isLunchAbsMinute(absMin)) return absMin;
      return Math.floor(absMin / MINUTES_PER_DAY) * MINUTES_PER_DAY + LUNCH_START_OFFSET - 1;
    }

    function remainingMinutesLabel(absMin, untilAbsMin) {
      const ref = lunchPauseReferenceAbsMin(absMin);
      return Math.max(0, productiveMinutesBetween(ref, untilAbsMin)) + ' min';
    }

    function normalizeMachine(m) {
      return {
        ...m,
        maintIntervalHours: Number(m.maintIntervalHours) || 0,
        maintDurationHours: Number(m.maintDurationHours) || 0,
        defaultOperatorId: m.defaultOperatorId || '',
        lastMaintenanceDate: m.lastMaintenanceDate || '',
        nextMaintenanceDate: m.nextMaintenanceDate || ''
      };
    }

    function normalizeAllMachines() {
      machines = machines.map(normalizeMachine);
    }

    /** IDs de máquinas citadas em roteiros, agrupamentos ou uniões. */
    function collectUsedMachineIds(srcParts, srcGroups, srcAsms) {
      const ids = {};
      (srcParts || []).forEach(p => {
        (p.route || []).forEach(step => {
          if (step && step.machineId) ids[step.machineId] = true;
        });
      });
      (srcGroups || []).forEach(g => {
        if (g && g.machineId) ids[g.machineId] = true;
      });
      (srcAsms || []).forEach(a => {
        if (a && a.machineId) ids[a.machineId] = true;
      });
      return ids;
    }

    function getActiveMachines(srcParts, srcGroups, srcAsms, srcMachines) {
      const ids = collectUsedMachineIds(
        srcParts || parts,
        srcGroups || groupingRules,
        srcAsms || assemblyRules
      );
      return (srcMachines || machines).filter(m => m && ids[m.id]);
    }

    function getSimulationMachines() {
      const active = getActiveMachines();
      return active.length > 0 ? active : [];
    }

    function countActiveMachinesInProject(proj) {
      if (!proj) return 0;
      return Object.keys(collectUsedMachineIds(proj.parts, proj.groupingRules, proj.assemblyRules)).length;
    }

    /** Diferença entre duas datas ISO (YYYY-MM-DD). Retorna { totalHours, days, hours, overdue, label }. */
    function getTimeBetweenDates(fromIso, toIso) {
      if (!fromIso || !toIso) {
        return { totalHours: 0, days: 0, hours: 0, overdue: false, label: '—' };
      }
      const from = parseISODate(fromIso);
      const to = parseISODate(toIso);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return { totalHours: 0, days: 0, hours: 0, overdue: false, label: '—' };
      }
      const diffMs = to.getTime() - from.getTime();
      const overdue = diffMs < 0;
      const absMs = Math.abs(diffMs);
      const totalHours = Math.floor(absMs / (1000 * 60 * 60));
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      let label;
      if (days === 0 && hours === 0) {
        label = overdue ? 'vencido hoje' : 'hoje';
      } else if (days > 0) {
        label = `${days}d ${hours}h`;
      } else {
        label = `${hours}h`;
      }
      if (overdue) label = `atrasado ${label}`;
      return { totalHours, days, hours, overdue, label };
    }

    /** Tempo restante da data atual até a próxima manutenção (ou intervalo última→próxima). */
    function getMaintenanceRemainingLabel(machine) {
      if (!machine) return 'Sem datas de manutenção';
      const last = machine.lastMaintenanceDate || '';
      const next = machine.nextMaintenanceDate || '';
      if (!last && !next) return 'Sem datas de manutenção';

      const parts = [];
      if (last && next) {
        const span = getTimeBetweenDates(last, next);
        parts.push(`Ciclo planejado: ${span.label}`);
      }
      if (next) {
        const remaining = getTimeBetweenDates(todayISODate(), next);
        if (remaining.overdue) {
          parts.push(`Próxima: ${remaining.label}`);
        } else {
          parts.push(`Faltam ${remaining.label} para a próxima`);
        }
      } else if (last) {
        parts.push(`Última: ${formatDisplayDate(last)}`);
      }
      return parts.join(' · ');
    }

    function getEmployeeById(id) {
      if (!id) return null;
      return employees.find(e => e.id === id) || null;
    }

    function formatEmployeeLabel(emp) {
      if (!emp) return '-';
      return `${emp.name} (${emp.matricula})`;
    }

    function getMachineOperatorLabel(machineOrId) {
      const m = typeof machineOrId === 'string'
        ? machines.find(x => x.id === machineOrId)
        : machineOrId;
      if (!m || !m.defaultOperatorId) return '-';
      return formatEmployeeLabel(getEmployeeById(m.defaultOperatorId));
    }

// --- MOTOR DE SIMULAÇÃO ---
    function getBoxesQtyFromInput() {
      const el = document.getElementById('boxes-qty');
      let qty = parseInt(el && el.value, 10);
      if (isNaN(qty) || qty < 1) qty = 1;
      if (qty > 999) qty = 999;
      if (el) el.value = qty;
      return qty;
    }

    function getStartDateFromInput() {
      const el = document.getElementById('start-date');
      let v = el && el.value;
      if (!v) v = todayISODate();
      if (el) el.value = v;
      return v;
    }

    function getPartReadyForMachine(partName, machineId, readyMap) {
      const part = parts.find(p => p.name === partName);
      if (!part) {
        const prevAsm = assemblyRules.find(a => a.resultName === partName);
        if (prevAsm) return readyMap[`${partName}_${prevAsm.machineId}`] || 0;
        return 0;
      }
      const asmIdx = part.route.findIndex(s => s.machineId === machineId);
      if (asmIdx < 0) return 0;
      if (asmIdx === 0) return 0;
      const prevStep = part.route[asmIdx - 1];
      return readyMap[`${partName}_${prevStep.machineId}`] || 0;
    }

    function maybeInsertMaintenance(machineId, machineFreeUntil, machineOperated, localMaintEvents) {
      const m = machines.find(x => x.id === machineId);
      if (!m) return;
      const intervalMin = (m.maintIntervalHours || 0) * 60;
      const durationMin = (m.maintDurationHours || 0) * 60;
      if (intervalMin <= 0 || durationMin <= 0) return;
      if ((machineOperated[machineId] || 0) < intervalMin) return;

      const start = snapToProductive(machineFreeUntil[machineId] || 0);
      const end = addProductiveMinutes(start, durationMin);
      localMaintEvents.push({
        machineId,
        start,
        end,
        duration: durationMin
      });
      machineFreeUntil[machineId] = end;
      machineOperated[machineId] = 0;
    }

    function groupedSetupTime(setup, memberCount) {
      const n = Math.max(1, memberCount);
      return Math.ceil(setup / n);
    }

    function eventSetupEnd(evt) {
      if (!evt) return 0;
      if (evt.setupEnd != null) return evt.setupEnd;
      return evt.prodStart;
    }

    function isActiveMachineState(state) {
      return state === 'setup' || state === 'working' || state === 'maintenance';
    }

    function buildProcessEvent(part, step, stepIndex, fields) {
      const prodStart = fields.prodStart;
      const setupEnd = fields.setupEnd != null ? fields.setupEnd : prodStart;
      return {
        partName: part.name,
        machineId: step.machineId,
        stepIndex,
        setupUnit: fields.setupTime,
        prodUnit: step.prodUnit,
        qty: fields.qty,
        arrivalTime: fields.arrivalTime,
        assemblyGate: fields.assemblyGate,
        setupStart: fields.setupStart,
        setupEnd,
        prodStart,
        end: fields.end,
        setupTime: fields.setupTime,
        prodTime: fields.prodTime,
        waitingForAssembly: !!fields.waitingForAssembly,
        isLastStep: stepIndex === part.route.length - 1,
        grouped: !!fields.grouped
      };
    }

    function resolveAssemblyWait(part, step, arrivalTime, readyMap) {
      const assemblyRule = assemblyRules.find(a =>
        a.machineId === step.machineId && a.requiredPartNames.includes(part.name)
      );
      if (!assemblyRule) {
        return { waitingForAssembly: false, assemblyGate: arrivalTime, assemblyRule: null };
      }
      let waitAssemblyUntil = 0;
      assemblyRule.requiredPartNames.forEach(reqName => {
        const t = (reqName === part.name)
          ? arrivalTime
          : getPartReadyForMachine(reqName, step.machineId, readyMap);
        if (t > waitAssemblyUntil) waitAssemblyUntil = t;
      });
      return { waitingForAssembly: true, assemblyGate: waitAssemblyUntil, assemblyRule };
    }

    function collectGroupingMembers(groupRule, readyMap, partReady) {
      const members = [];
      groupRule.partNames.forEach(name => {
        const part = parts.find(p => p.name === name);
        if (!part) return;
        const stepIndex = part.route.findIndex(s => s.machineId === groupRule.machineId);
        if (stepIndex < 0) return;
        const step = part.route[stepIndex];
        const arrivalTime = (partReady && Object.prototype.hasOwnProperty.call(partReady, part.name))
          ? partReady[part.name]
          : getPartReadyForMachine(part.name, step.machineId, readyMap);
        const asm = resolveAssemblyWait(part, step, arrivalTime, readyMap);
        members.push({
          part,
          step,
          stepIndex,
          arrivalTime,
          waitingForAssembly: asm.waitingForAssembly,
          assemblyGate: asm.assemblyGate,
          assemblyRule: asm.assemblyRule,
          readyForMachine: Math.max(arrivalTime, asm.assemblyGate),
          setupTime: groupedSetupTime(step.setup, groupRule.partNames.length),
          prodTime: step.prodUnit * (part.qty * boxesQty),
          qty: part.qty * boxesQty
        });
      });
      return members;
    }

    /**
     * Agrupamento de corte: setup compartilhado no mesmo horário inicial
     * e produção simultânea a partir do fim desse setup.
     * O término de cada peça segue o volume individual (prodUnit * qty * caixas).
     */
    function scheduleGroupedMachineBatch(groupRule, readyTimeOfParts, machineFreeUntil, machineOperated, passEvents, passMaint, groupedScheduled, partReady) {
      const members = collectGroupingMembers(groupRule, readyTimeOfParts, partReady);
      if (members.length === 0) return;
      const machineId = groupRule.machineId;

      maybeInsertMaintenance(machineId, machineFreeUntil, machineOperated, passMaint);

      const sharedSetupStart = snapToProductive(Math.max(
        machineFreeUntil[machineId] || 0,
        ...members.map(m => m.readyForMachine)
      ));
      const sharedSetupDur = members.reduce((max, m) => Math.max(max, m.setupTime), 0);
      const sharedProdStart = addProductiveMinutes(sharedSetupStart, sharedSetupDur);
      const maxProdTime = members.reduce((max, m) => Math.max(max, m.prodTime), 0);
      const batchEnd = addProductiveMinutes(sharedProdStart, maxProdTime);

      members.forEach(m => {
        const evt = buildProcessEvent(m.part, m.step, m.stepIndex, {
          qty: m.qty,
          arrivalTime: m.arrivalTime,
          assemblyGate: m.assemblyGate,
          setupStart: sharedSetupStart,
          setupEnd: sharedProdStart,
          prodStart: sharedProdStart,
          end: addProductiveMinutes(sharedProdStart, m.prodTime),
          setupTime: m.setupTime,
          prodTime: m.prodTime,
          waitingForAssembly: m.waitingForAssembly,
          grouped: true
        });
        passEvents.push(evt);
        groupedScheduled[`${m.part.name}_${machineId}`] = evt;
        readyTimeOfParts[`${m.part.name}_${machineId}`] = evt.end;
        if (m.assemblyRule) {
          readyTimeOfParts[`${m.assemblyRule.resultName}_${m.assemblyRule.machineId}`] = evt.end;
        }
      });

      machineFreeUntil[machineId] = batchEnd;
      machineOperated[machineId] = (machineOperated[machineId] || 0) + sharedSetupDur + maxProdTime;
      maybeInsertMaintenance(machineId, machineFreeUntil, machineOperated, passMaint);
    }

    function readyMapHas(readyMap, key) {
      return Object.prototype.hasOwnProperty.call(readyMap, key);
    }

    function assemblyDependenciesMet(part, step, readyMap) {
      const assemblyRule = assemblyRules.find(a =>
        a.machineId === step.machineId && a.requiredPartNames.includes(part.name)
      );
      if (!assemblyRule) return true;
      return assemblyRule.requiredPartNames.every(reqName => {
        if (reqName === part.name) return true;
        const reqPart = parts.find(p => p.name === reqName);
        if (reqPart) {
          const asmIdx = reqPart.route.findIndex(s => s.machineId === step.machineId);
          if (asmIdx < 0) return true;
          if (asmIdx === 0) return true;
          const prevStep = reqPart.route[asmIdx - 1];
          return readyMapHas(readyMap, `${reqName}_${prevStep.machineId}`);
        }
        const prevAsm = assemblyRules.find(a => a.resultName === reqName);
        if (prevAsm) {
          return readyMapHas(readyMap, `${reqName}_${prevAsm.machineId}`);
        }
        return true;
      });
    }

    function groupRepresentativeName(groupRule) {
      for (let i = 0; i < groupRule.partNames.length; i++) {
        if (parts.some(p => p.name === groupRule.partNames[i])) return groupRule.partNames[i];
      }
      return groupRule.partNames[0];
    }

    function allGroupMembersAtGroupedStep(groupRule, nextStepIndex) {
      return groupRule.partNames.every(name => {
        const part = parts.find(p => p.name === name);
        if (!part) return true;
        const si = part.route.findIndex(s => s.machineId === groupRule.machineId);
        if (si < 0) return true;
        return (nextStepIndex[name] || 0) === si;
      });
    }

    function findGroupRuleForStep(part, step) {
      return groupingRules.find(g => g.machineId === step.machineId && g.partNames.includes(part.name)) || null;
    }

    function commitSingleStep(part, step, stepIndex, arrivalTime, asm, machineFreeUntil, machineOperated, readyTimeOfParts, events, maintEvents, partReady, nextStepIndex) {
      const setupTime = step.setup;
      const prodTime = step.prodUnit * (part.qty * boxesQty);
      const assemblyRule = asm.assemblyRule;
      const waitingForAssembly = asm.waitingForAssembly;
      const assemblyGate = asm.assemblyGate;

      maybeInsertMaintenance(step.machineId, machineFreeUntil, machineOperated, maintEvents);

      const readyForMachine = Math.max(arrivalTime, assemblyGate);
      const setupStart = snapToProductive(Math.max(readyForMachine, machineFreeUntil[step.machineId] || 0));
      const prodStart = addProductiveMinutes(setupStart, setupTime);
      const end = addProductiveMinutes(prodStart, prodTime);

      machineFreeUntil[step.machineId] = end;
      machineOperated[step.machineId] = (machineOperated[step.machineId] || 0) + setupTime + prodTime;
      partReady[part.name] = end;
      nextStepIndex[part.name] = stepIndex + 1;
      readyTimeOfParts[`${part.name}_${step.machineId}`] = end;

      if (assemblyRule) {
        readyTimeOfParts[`${assemblyRule.resultName}_${assemblyRule.machineId}`] = end;
      }

      maybeInsertMaintenance(step.machineId, machineFreeUntil, machineOperated, maintEvents);

      events.push(buildProcessEvent(part, step, stepIndex, {
        qty: part.qty * boxesQty,
        arrivalTime,
        assemblyGate,
        setupStart,
        setupEnd: prodStart,
        prodStart,
        end,
        setupTime,
        prodTime,
        waitingForAssembly
      }));
    }

    /**
     * Despacho job-shop: agenda a próxima operação que pode começar mais cedo.
     * Assim, ao zerar o restante de uma etapa, a peça reivindica a próxima
     * máquina se ela estiver fisicamente livre — mesmo que outra peça listada
     * antes ainda esteja ocupada no setor anterior.
     */
    function collectScheduleCandidates(nextStepIndex, partReady, readyTimeOfParts, machineFreeUntil, groupedScheduled, ignoreAssembly) {
      const candidates = [];
      parts.forEach((part, partIdx) => {
        const stepIndex = nextStepIndex[part.name] || 0;
        if (stepIndex >= part.route.length) return;
        const step = part.route[stepIndex];
        const groupRule = findGroupRuleForStep(part, step);

        if (groupRule) {
          if (groupedScheduled[`${part.name}_${step.machineId}`]) return;
          if (!allGroupMembersAtGroupedStep(groupRule, nextStepIndex)) return;
          if (part.name !== groupRepresentativeName(groupRule)) return;

          const members = collectGroupingMembers(groupRule, readyTimeOfParts, partReady);
          if (members.length === 0) return;
          if (!ignoreAssembly && members.some(m => !assemblyDependenciesMet(m.part, m.step, readyTimeOfParts))) return;

          const readyForMachine = members.reduce((max, m) => Math.max(max, m.readyForMachine), 0);
          const setupStart = snapToProductive(Math.max(machineFreeUntil[step.machineId] || 0, readyForMachine));
          candidates.push({
            type: 'group',
            groupRule,
            part,
            step,
            stepIndex,
            partIdx,
            setupStart,
            readyForMachine
          });
          return;
        }

        if (!ignoreAssembly && !assemblyDependenciesMet(part, step, readyTimeOfParts)) return;

        const arrivalTime = partReady[part.name] || 0;
        const asm = resolveAssemblyWait(part, step, arrivalTime, readyTimeOfParts);
        const readyForMachine = Math.max(arrivalTime, asm.assemblyGate);
        const setupStart = snapToProductive(Math.max(readyForMachine, machineFreeUntil[step.machineId] || 0));
        candidates.push({
          type: 'single',
          part,
          step,
          stepIndex,
          partIdx,
          arrivalTime,
          asm,
          setupStart,
          readyForMachine
        });
      });
      return candidates;
    }

    function scheduleProductionEvents() {
      const machineFreeUntil = {};
      const machineOperated = {};
      const simMachines = getSimulationMachines();
      simMachines.forEach(m => {
        machineFreeUntil[m.id] = 0;
        machineOperated[m.id] = 0;
      });

      const readyTimeOfParts = {};
      const events = [];
      const maintEvents = [];
      const groupedScheduled = {};
      const partReady = {};
      const nextStepIndex = {};
      parts.forEach(p => {
        partReady[p.name] = 0;
        nextStepIndex[p.name] = 0;
      });

      const totalSteps = parts.reduce((n, p) => n + p.route.length, 0);
      let scheduledCount = 0;
      let ignoreAssembly = false;

      while (scheduledCount < totalSteps) {
        const candidates = collectScheduleCandidates(
          nextStepIndex, partReady, readyTimeOfParts, machineFreeUntil, groupedScheduled, ignoreAssembly
        );
        if (candidates.length === 0) {
          if (!ignoreAssembly) {
            ignoreAssembly = true;
            continue;
          }
          break;
        }
        ignoreAssembly = false;
        candidates.sort((a, b) =>
          (a.setupStart - b.setupStart) ||
          (a.readyForMachine - b.readyForMachine) ||
          (a.partIdx - b.partIdx)
        );
        const chosen = candidates[0];

        if (chosen.type === 'group') {
          const before = events.length;
          scheduleGroupedMachineBatch(
            chosen.groupRule,
            readyTimeOfParts,
            machineFreeUntil,
            machineOperated,
            events,
            maintEvents,
            groupedScheduled,
            partReady
          );
          chosen.groupRule.partNames.forEach(name => {
            const evt = groupedScheduled[`${name}_${chosen.groupRule.machineId}`];
            if (!evt) return;
            nextStepIndex[name] = evt.stepIndex + 1;
            partReady[name] = evt.end;
          });
          const added = events.length - before;
          if (added <= 0) break;
          scheduledCount += added;
        } else {
          commitSingleStep(
            chosen.part,
            chosen.step,
            chosen.stepIndex,
            chosen.arrivalTime,
            chosen.asm,
            machineFreeUntil,
            machineOperated,
            readyTimeOfParts,
            events,
            maintEvents,
            partReady,
            nextStepIndex
          );
          scheduledCount += 1;
        }
      }

      return { events, maintEvents };
    }

    function calculateSimulationHistory() {
      simulationHistory = [];
      rawEvents = [];
      maintenanceEvents = [];
      boxesQty = getBoxesQtyFromInput();
      startDateStr = getStartDateFromInput();
      normalizeAllMachines();

      const scheduled = scheduleProductionEvents();
      rawEvents = scheduled.events;
      maintenanceEvents = scheduled.maintEvents;

      let maxEnd = 0;
      rawEvents.forEach(e => { if (e.end > maxEnd) maxEnd = e.end; });
      maintenanceEvents.forEach(e => { if (e.end > maxEnd) maxEnd = e.end; });

      const neededDays = Math.max(1, Math.ceil((maxEnd + 1) / MINUTES_PER_DAY));
      workDays = buildWorkDaysCalendar(startDateStr, neededDays);
      totalAbsMinutes = neededDays * MINUTES_PER_DAY; // valid absMinute indices: 0 .. totalAbsMinutes-1

      for (let absMin = 0; absMin < totalAbsMinutes; absMin++) {
        const minuteInDay = absMin % MINUTES_PER_DAY;
        const isLunchTime = isLunchAbsMinute(absMin);
        let snapshot = {
          absMinute: absMin,
          minuteInDay,
          dayIndex: Math.floor(absMin / MINUTES_PER_DAY),
          partsActive: [],
          floorRows: [],
          machinesStatus: {}
        };

        getSimulationMachines().forEach(m => {
          snapshot.machinesStatus[m.id] = { state: isLunchTime ? 'lunch' : 'idle', partName: null };
        });

        maintenanceEvents.forEach(me => {
          if (absMin >= me.start && absMin < me.end) {
            snapshot.machinesStatus[me.machineId] = {
              state: isLunchTime ? 'lunch' : 'maintenance',
              partName: null,
              remaining: remainingMinutesLabel(absMin, me.end)
            };
          }
        });

        rawEvents.forEach(evt => {
          const setupEnd = eventSetupEnd(evt);
          const mMaint = maintenanceEvents.find(me =>
            me.machineId === evt.machineId && absMin >= me.start && absMin < me.end
          );
          const machineState = snapshot.machinesStatus[evt.machineId];
          if (absMin >= evt.arrivalTime && absMin < evt.setupStart) {
            const waitReason = (evt.waitingForAssembly && absMin < evt.assemblyGate) ? 'waiting' : 'fila';
            if (!mMaint && !isActiveMachineState(machineState && machineState.state)) {
              snapshot.machinesStatus[evt.machineId] = {
                state: isLunchTime ? 'lunch' : 'waiting',
                partName: evt.partName
              };
            }
            snapshot.partsActive.push({
              name: evt.partName,
              machineId: evt.machineId,
              status: isLunchTime ? 'lunch' : (mMaint ? 'fila' : waitReason),
              remaining: '-'
            });
          } else if (absMin >= evt.setupStart && absMin < setupEnd) {
            if (!mMaint) {
              snapshot.machinesStatus[evt.machineId] = { state: isLunchTime ? 'lunch' : 'setup', partName: evt.partName };
            }
            snapshot.partsActive.push({
              name: evt.partName,
              machineId: evt.machineId,
              status: isLunchTime ? 'lunch' : 'setup',
              remaining: remainingMinutesLabel(absMin, setupEnd)
            });
          } else if (absMin >= setupEnd && absMin < evt.prodStart) {
            if (!mMaint && !isActiveMachineState(machineState && machineState.state)) {
              snapshot.machinesStatus[evt.machineId] = {
                state: isLunchTime ? 'lunch' : 'waiting',
                partName: evt.partName
              };
            }
            snapshot.partsActive.push({
              name: evt.partName,
              machineId: evt.machineId,
              status: isLunchTime ? 'lunch' : 'fila',
              remaining: '-'
            });
          } else if (absMin >= evt.prodStart && absMin < evt.end) {
            if (!mMaint) {
              snapshot.machinesStatus[evt.machineId] = { state: isLunchTime ? 'lunch' : 'working', partName: evt.partName };
            }
            snapshot.partsActive.push({
              name: evt.partName,
              machineId: evt.machineId,
              status: isLunchTime ? 'lunch' : 'working',
              remaining: remainingMinutesLabel(absMin, evt.end)
            });
          }
        });

        parts.forEach(part => {
          const partEvents = rawEvents.filter(e => e.partName === part.name);
          let row = null;

          for (const evt of partEvents) {
            if (absMin >= evt.arrivalTime && absMin < evt.end) {
              const setupEnd = eventSetupEnd(evt);
              const mMaint = maintenanceEvents.find(me =>
                me.machineId === evt.machineId && absMin >= me.start && absMin < me.end
              );
              let status = 'fila';
              let remaining = '-';
              if (mMaint && absMin < evt.setupStart) {
                status = isLunchTime ? 'lunch' : 'fila';
              } else if (absMin >= evt.prodStart) {
                status = isLunchTime ? 'lunch' : 'working';
                remaining = remainingMinutesLabel(absMin, evt.end);
              } else if (absMin >= evt.setupStart && absMin < setupEnd) {
                status = isLunchTime ? 'lunch' : 'setup';
                remaining = remainingMinutesLabel(absMin, setupEnd);
              } else if (evt.waitingForAssembly && absMin < evt.assemblyGate) {
                status = isLunchTime ? 'lunch' : 'waiting';
              } else {
                status = isLunchTime ? 'lunch' : 'fila';
              }
              const mObj = machines.find(m => m.id === evt.machineId);
              let sector = mObj ? mObj.name : '-';
              if (mMaint && (status === 'fila' || status === 'waiting')) {
                sector = (mObj ? mObj.name : '-') + ' (MANUT.)';
              }
              row = {
                name: part.name,
                sector,
                operator: getMachineOperatorLabel(mObj),
                status,
                remaining
              };
              break;
            }
          }

          if (!row) {
            const nextEvt = partEvents.find(e => absMin < e.arrivalTime);
            const lastEvt = partEvents[partEvents.length - 1];
            if (nextEvt) {
              const mObj = machines.find(m => m.id === nextEvt.machineId);
              row = {
                name: part.name,
                sector: mObj ? mObj.name : '-',
                operator: getMachineOperatorLabel(mObj),
                status: isLunchTime ? 'lunch' : 'fila',
                remaining: '-'
              };
            } else if (lastEvt && absMin >= lastEvt.end) {
              const mObj = machines.find(m => m.id === lastEvt.machineId);
              row = {
                name: part.name,
                sector: mObj ? mObj.name : '-',
                operator: getMachineOperatorLabel(mObj),
                status: 'done',
                remaining: '-'
              };
            } else {
              row = { name: part.name, sector: '-', operator: '-', status: 'fila', remaining: '-' };
            }
          }

          snapshot.floorRows.push(row);
        });

        // Linhas de manutenção por setor (visíveis)
        maintenanceEvents.forEach(me => {
          if (absMin >= me.start && absMin < me.end) {
            const mObj = machines.find(m => m.id === me.machineId);
            snapshot.floorRows.push({
              name: '— Manutenção —',
              sector: mObj ? mObj.name : '-',
              operator: getMachineOperatorLabel(mObj),
              status: isLunchTime ? 'lunch' : 'maintenance',
              remaining: remainingMinutesLabel(absMin, me.end)
            });
          }
        });

        assemblyRules.forEach(rule => {
          const asmEvents = rawEvents.filter(e =>
            rule.requiredPartNames.includes(e.partName) && e.machineId === rule.machineId
          );
          if (asmEvents.length === 0) return;
          const asmEnd = Math.max(...asmEvents.map(e => e.end));
          const asmStart = Math.min(...asmEvents.map(e => e.setupStart));
          const mObj = machines.find(m => m.id === rule.machineId);

          if (absMin >= asmStart && absMin < asmEnd) {
            const active = asmEvents.find(e => absMin >= e.setupStart && absMin < e.end);
            let status = 'working';
            let remaining = '-';
            if (active) {
              if (absMin >= active.prodStart) {
                status = isLunchTime ? 'lunch' : 'working';
                remaining = remainingMinutesLabel(absMin, active.end);
              } else {
                status = isLunchTime ? 'lunch' : 'setup';
                remaining = remainingMinutesLabel(absMin, active.prodStart);
              }
            }
            snapshot.floorRows.push({
              name: rule.resultName,
              sector: mObj ? mObj.name : '-',
              operator: getMachineOperatorLabel(mObj),
              status,
              remaining
            });
          }
        });

        simulationHistory.push(snapshot);
      }

      const pStart = (LUNCH_START_OFFSET / MINUTES_PER_DAY) * 100;
      const pWidth = ((LUNCH_END_OFFSET - LUNCH_START_OFFSET) / MINUTES_PER_DAY) * 100;
      const overlay = document.getElementById('lunch-overlay');
      if (overlay) {
        overlay.style.left = pStart + '%';
        overlay.style.width = pWidth + '%';
      }

      if (typeof populateDaySelect === 'function') populateDaySelect();
    }

function getCurrentAbsMinute() {
  return Math.floor(currentAbsSecond / 60);
}

function getMaxAbsMinute() {
  return Math.max(0, totalAbsMinutes - 1);
}

function getMaxAbsSecond() {
  return getMaxAbsMinute() * 60 + 59;
}

function absMinuteToTimeLabel(absMin) {
  const p = absMinuteToParts(absMin);
  return `${formatDisplayDate(p.dateIso)} ${pad2(p.hours)}:${pad2(p.minutes)}`;
}
