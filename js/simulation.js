/* SimulaFab v1.4.3 — Motor de simulação, calendário e manutenção preventiva */

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

    function normalizeMachine(m) {
      return {
        ...m,
        maintIntervalHours: Number(m.maintIntervalHours) || 0,
        maintDurationHours: Number(m.maintDurationHours) || 0,
        defaultOperatorId: m.defaultOperatorId || ''
      };
    }

    function normalizeAllMachines() {
      machines = machines.map(normalizeMachine);
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
      let qty = parseInt(document.getElementById('boxes-qty').value, 10);
      if (isNaN(qty) || qty < 1) qty = 1;
      if (qty > 999) qty = 999;
      document.getElementById('boxes-qty').value = qty;
      return qty;
    }

    function getStartDateFromInput() {
      let v = document.getElementById('start-date').value;
      if (!v) v = todayISODate();
      document.getElementById('start-date').value = v;
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

      const start = machineFreeUntil[machineId] || 0;
      const end = start + durationMin;
      localMaintEvents.push({
        machineId,
        start,
        end,
        duration: durationMin
      });
      machineFreeUntil[machineId] = end;
      machineOperated[machineId] = 0;
    }

    function calculateSimulationHistory() {
      simulationHistory = [];
      rawEvents = [];
      maintenanceEvents = [];
      boxesQty = getBoxesQtyFromInput();
      startDateStr = getStartDateFromInput();
      normalizeAllMachines();

      let knownReady = {};
      let lastPassMaint = [];

      for (let pass = 0; pass < 10; pass++) {
        const machineFreeUntil = {};
        const machineOperated = {};
        machines.forEach(m => {
          machineFreeUntil[m.id] = 0;
          machineOperated[m.id] = 0;
        });
        const readyTimeOfParts = {};
        const passEvents = [];
        const passMaint = [];

        parts.forEach(part => {
          let partAvailableTime = 0;
          const effectiveQty = part.qty * boxesQty;

          part.route.forEach((step, stepIndex) => {
            let setupTime = step.setup;
            let prodTime = step.prodUnit * effectiveQty;

            const groupRule = groupingRules.find(g => g.machineId === step.machineId && g.partNames.includes(part.name));
            if (groupRule) setupTime = Math.ceil(step.setup / groupRule.partNames.length);

            const assemblyRule = assemblyRules.find(a => a.machineId === step.machineId && a.requiredPartNames.includes(part.name));
            let waitAssemblyUntil = 0;
            let waitingForAssembly = false;

            if (assemblyRule) {
              waitingForAssembly = true;
              assemblyRule.requiredPartNames.forEach(reqName => {
                const t = (reqName === part.name)
                  ? partAvailableTime
                  : getPartReadyForMachine(reqName, step.machineId, knownReady);
                if (t > waitAssemblyUntil) waitAssemblyUntil = t;
              });
            }

            maybeInsertMaintenance(step.machineId, machineFreeUntil, machineOperated, passMaint);

            const arrivalTime = partAvailableTime;
            const assemblyGate = waitingForAssembly ? waitAssemblyUntil : arrivalTime;
            const readyForMachine = Math.max(arrivalTime, assemblyGate);
            const setupStart = Math.max(readyForMachine, machineFreeUntil[step.machineId]);
            const prodStart = setupStart + setupTime;
            const end = prodStart + prodTime;

            machineFreeUntil[step.machineId] = end;
            machineOperated[step.machineId] = (machineOperated[step.machineId] || 0) + setupTime + prodTime;
            partAvailableTime = end;
            readyTimeOfParts[`${part.name}_${step.machineId}`] = end;

            if (assemblyRule) {
              readyTimeOfParts[`${assemblyRule.resultName}_${assemblyRule.machineId}`] = end;
            }

            // Após acumular uso, agenda manutenção se atingiu o intervalo
            maybeInsertMaintenance(step.machineId, machineFreeUntil, machineOperated, passMaint);

            passEvents.push({
              partName: part.name,
              machineId: step.machineId,
              stepIndex,
              setupUnit: setupTime,
              prodUnit: step.prodUnit,
              qty: effectiveQty,
              arrivalTime,
              assemblyGate,
              setupStart,
              prodStart,
              end,
              setupTime,
              prodTime,
              waitingForAssembly,
              isLastStep: stepIndex === part.route.length - 1
            });
          });
        });

        knownReady = readyTimeOfParts;
        rawEvents = passEvents;
        lastPassMaint = passMaint;
      }

      maintenanceEvents = lastPassMaint;

      let maxEnd = 0;
      rawEvents.forEach(e => { if (e.end > maxEnd) maxEnd = e.end; });
      maintenanceEvents.forEach(e => { if (e.end > maxEnd) maxEnd = e.end; });

      const neededDays = Math.max(1, Math.ceil((maxEnd + 1) / MINUTES_PER_DAY));
      workDays = buildWorkDaysCalendar(startDateStr, neededDays);
      totalAbsMinutes = neededDays * MINUTES_PER_DAY; // valid absMinute indices: 0 .. totalAbsMinutes-1

      for (let absMin = 0; absMin < totalAbsMinutes; absMin++) {
        const minuteInDay = absMin % MINUTES_PER_DAY;
        const isLunchTime = (minuteInDay >= LUNCH_START_OFFSET && minuteInDay < LUNCH_END_OFFSET);
        let snapshot = {
          absMinute: absMin,
          minuteInDay,
          dayIndex: Math.floor(absMin / MINUTES_PER_DAY),
          partsActive: [],
          floorRows: [],
          machinesStatus: {}
        };

        machines.forEach(m => {
          snapshot.machinesStatus[m.id] = { state: isLunchTime ? 'lunch' : 'idle', partName: null };
        });

        maintenanceEvents.forEach(me => {
          if (absMin >= me.start && absMin < me.end) {
            snapshot.machinesStatus[me.machineId] = {
              state: isLunchTime ? 'lunch' : 'maintenance',
              partName: null,
              remaining: Math.max(0, me.end - absMin) + ' min'
            };
          }
        });

        rawEvents.forEach(evt => {
          const mMaint = maintenanceEvents.find(me =>
            me.machineId === evt.machineId && absMin >= me.start && absMin < me.end
          );
          if (absMin >= evt.arrivalTime && absMin < evt.setupStart) {
            const waitReason = (evt.waitingForAssembly && absMin < evt.assemblyGate) ? 'waiting' : 'fila';
            if (!mMaint) {
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
          } else if (absMin >= evt.setupStart && absMin < evt.prodStart) {
            if (!mMaint) {
              snapshot.machinesStatus[evt.machineId] = { state: isLunchTime ? 'lunch' : 'setup', partName: evt.partName };
            }
            snapshot.partsActive.push({
              name: evt.partName,
              machineId: evt.machineId,
              status: isLunchTime ? 'lunch' : 'setup',
              remaining: Math.max(0, evt.prodStart - absMin) + ' min'
            });
          } else if (absMin >= evt.prodStart && absMin < evt.end) {
            if (!mMaint) {
              snapshot.machinesStatus[evt.machineId] = { state: isLunchTime ? 'lunch' : 'working', partName: evt.partName };
            }
            snapshot.partsActive.push({
              name: evt.partName,
              machineId: evt.machineId,
              status: isLunchTime ? 'lunch' : 'working',
              remaining: Math.max(0, evt.end - absMin) + ' min'
            });
          }
        });

        parts.forEach(part => {
          const partEvents = rawEvents.filter(e => e.partName === part.name);
          let row = null;

          for (const evt of partEvents) {
            if (absMin >= evt.arrivalTime && absMin < evt.end) {
              const mMaint = maintenanceEvents.find(me =>
                me.machineId === evt.machineId && absMin >= me.start && absMin < me.end
              );
              let status = 'fila';
              let remaining = '-';
              if (mMaint && absMin < evt.setupStart) {
                status = isLunchTime ? 'lunch' : 'fila';
              } else if (absMin >= evt.prodStart) {
                status = isLunchTime ? 'lunch' : 'working';
                remaining = Math.max(0, evt.end - absMin) + ' min';
              } else if (absMin >= evt.setupStart) {
                status = isLunchTime ? 'lunch' : 'setup';
                remaining = Math.max(0, evt.prodStart - absMin) + ' min';
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
              remaining: Math.max(0, me.end - absMin) + ' min'
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
                remaining = Math.max(0, active.end - absMin) + ' min';
              } else {
                status = isLunchTime ? 'lunch' : 'setup';
                remaining = Math.max(0, active.prodStart - absMin) + ' min';
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
      overlay.style.left = pStart + '%';
      overlay.style.width = pWidth + '%';

      populateDaySelect();
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
