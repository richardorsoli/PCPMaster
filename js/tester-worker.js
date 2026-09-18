/* PCPMaster v1.6.4 — Sprint 10 Batch 1: TESTER worker (simulador headless + busca) */
/* Isolado: zero DOM/UI. Carregado como Worker e também como script clássico (fallback file://). */

function pcpmasterTesterWorkerBootstrap() {
  const SHIFT_START_MINUTES = 7 * 60 + 30;
  const SHIFT_END_MINUTES = 17 * 60 + 18;
  const MINUTES_PER_DAY = SHIFT_END_MINUTES - SHIFT_START_MINUTES;
  const LUNCH_START_OFFSET = (12 * 60) - SHIFT_START_MINUTES;
  const LUNCH_END_OFFSET = (13 * 60) - SHIFT_START_MINUTES;
  const DEFAULT_START_TIME = '07:30';
  const IDLE_WEIGHT = 0.5;
  const DEFAULT_MAX_ITERS = 120;
  const PROGRESS_BATCH = 4;

  function clone(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      return fallback;
    }
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function sequenceKey(seq) {
    return (seq || []).join('\u001f');
  }

  function factorial(n) {
    let f = 1;
    for (let i = 2; i <= n; i++) f *= i;
    return f;
  }

  function minuteOfDay(absMin) {
    return ((absMin % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  }

  function isLunchAbsMinute(absMin) {
    const m = minuteOfDay(absMin);
    return m >= LUNCH_START_OFFSET && m < LUNCH_END_OFFSET;
  }

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

  function addProductiveMinutes(startAbsMin, duration) {
    let t = snapToProductive(startAbsMin);
    let left = Math.max(0, Number(duration) || 0);
    if (left === 0) return t;
    let guard = 0;
    while (left > 0 && guard++ < 4000) {
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

  function parseClockToMinutes(hhmm) {
    if (!hhmm || typeof hhmm !== 'string') return SHIFT_START_MINUTES;
    const m = String(hhmm).trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return SHIFT_START_MINUTES;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (isNaN(h) || isNaN(min) || h > 23 || min > 59) return SHIFT_START_MINUTES;
    return h * 60 + min;
  }

  function minutesToClockStr(totalMin) {
    const wrapped = ((totalMin % (24 * 60)) + (24 * 60)) % (24 * 60);
    return pad2(Math.floor(wrapped / 60)) + ':' + pad2(wrapped % 60);
  }

  function normalizeStartOffset(hhmm) {
    let clock = parseClockToMinutes(hhmm || DEFAULT_START_TIME);
    if (clock < SHIFT_START_MINUTES) clock = SHIFT_START_MINUTES;
    if (clock > SHIFT_END_MINUTES) clock = SHIFT_END_MINUTES;
    let offset = clock - SHIFT_START_MINUTES;
    if (offset < 0) offset = 0;
    if (offset >= MINUTES_PER_DAY) offset = MINUTES_PER_DAY - 1;
    offset = snapToProductive(offset);
    if (offset >= MINUTES_PER_DAY) offset = MINUTES_PER_DAY - 1;
    return { offset: offset, clockStr: minutesToClockStr(SHIFT_START_MINUTES + offset) };
  }

  function normalizeMachine(m) {
    if (!m || typeof m !== 'object') return m;
    return {
      id: m.id,
      name: m.name || '',
      pop: m.pop || '',
      maintIntervalHours: Number(m.maintIntervalHours) || 0,
      maintDurationHours: Number(m.maintDurationHours) || 0,
      defaultOperatorId: m.defaultOperatorId || '',
      lastMaintenanceDate: m.lastMaintenanceDate || '',
      nextMaintenanceDate: m.nextMaintenanceDate || ''
    };
  }

  function normalizeRouteStep(step) {
    if (!step || typeof step !== 'object') return step;
    const out = {
      machineId: step.machineId,
      setup: Number(step.setup) || 0,
      prodUnit: Number(step.prodUnit) > 0 ? Number(step.prodUnit) : 1
    };
    if (step.juncao && typeof step.juncao === 'object') {
      const requer = Array.isArray(step.juncao.requer)
        ? step.juncao.requer.map(n => String(n).toUpperCase())
        : [];
      out.juncao = {
        requer: requer,
        maquina: step.juncao.maquina || step.machineId || ''
      };
    }
    return out;
  }

  function normalizeAssemblyRule(rule) {
    if (!rule || typeof rule !== 'object') {
      return { machineId: '', resultName: '', requiredPartNames: [], juncao: { requer: [], maquina: '' }, setup: 1, prodUnit: 1, qty: 1, route: [] };
    }
    const requerRaw = Array.isArray(rule.requiredPartNames)
      ? rule.requiredPartNames
      : (rule.juncao && Array.isArray(rule.juncao.requer) ? rule.juncao.requer : []);
    const requer = requerRaw.map(n => String(n || '').toUpperCase()).filter(Boolean);
    const machineId = rule.machineId || (rule.juncao && rule.juncao.maquina) || '';
    const resultName = String(rule.resultName || '').toUpperCase();
    return {
      machineId: machineId,
      resultName: resultName,
      requiredPartNames: requer,
      juncao: { requer: requer, maquina: machineId },
      setup: Number(rule.setup) || 0,
      prodUnit: Number(rule.prodUnit) > 0 ? Number(rule.prodUnit) : 0,
      qty: Number(rule.qty) > 0 ? Number(rule.qty) : 1,
      route: Array.isArray(rule.route) ? rule.route.map(normalizeRouteStep) : []
    };
  }

  function joinRequerOf(stepOrRule) {
    if (!stepOrRule) return [];
    if (stepOrRule.juncao && Array.isArray(stepOrRule.juncao.requer)) return stepOrRule.juncao.requer;
    if (Array.isArray(stepOrRule.requiredPartNames)) return stepOrRule.requiredPartNames;
    return [];
  }

  function isJoinStep(step) {
    return !!(step && step.juncao && joinRequerOf(step).length > 0);
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

  function ganttKindRank(kind) {
    if (kind === 'prod') return 4;
    if (kind === 'setup') return 3;
    if (kind === 'maint') return 2;
    if (kind === 'wait') return 1;
    return 0;
  }

  function clipInterval(start, end, rangeStart, rangeEnd) {
    const s = Math.max(Number(start) || 0, rangeStart);
    const e = Math.min(Number(end) || 0, rangeEnd);
    return e > s ? { start: s, end: e } : null;
  }

  function createHeadlessSim(snapshot) {
    const startNorm = normalizeStartOffset(snapshot && snapshot.startTime);
    const sim = {
      machines: ((snapshot && snapshot.machines) || []).map(normalizeMachine).filter(m => m && m.id),
      baseParts: clone((snapshot && snapshot.parts) || [], []),
      groupingRules: clone((snapshot && snapshot.groupingRules) || [], []),
      assemblyRulesBase: ((snapshot && snapshot.assemblyRules) || []).map(normalizeAssemblyRule),
      boxesQty: Math.max(1, Math.min(999, Number(snapshot && snapshot.boxesQty) || 1)),
      startTimeOffsetMin: startNorm.offset,
      parts: [],
      assemblyRules: [],
      bomRuntimeParts: []
    };

    function t0() {
      return Math.max(0, Number(sim.startTimeOffsetMin) || 0);
    }

    function machineNameOf(id) {
      const m = sim.machines.find(x => x.id === id);
      return m && m.name ? String(m.name).toUpperCase() : '';
    }

    function machineStepsByNameIncludes(needles) {
      const steps = [];
      const seen = {};
      sim.machines.forEach(m => {
        if (!m || !m.name || !m.id || seen[m.id]) return;
        const upper = String(m.name).toUpperCase();
        if (needles.some(n => upper.indexOf(n) >= 0)) {
          seen[m.id] = true;
          steps.push({ machineId: m.id, setup: 1, prodUnit: 1 });
        }
      });
      return steps;
    }

    function routeHasMachineName(route, needle) {
      return (route || []).some(s => machineNameOf(s.machineId).indexOf(needle) >= 0);
    }

    function knownBomFinishingRoute(rule) {
      const name = rule && rule.resultName ? String(rule.resultName).toUpperCase() : '';
      if (name === 'CORPO COMPLETO') return machineStepsByNameIncludes(['BANHO', 'CABINE', 'ESTUFA']);
      if (name === 'DAE JUNDIAI' || name === 'DAE JUNDIAÍ') {
        return machineStepsByNameIncludes(['EMBALAGEM', 'EXPEDI']);
      }
      return [];
    }

    function otherJoinMachineIds(exceptRule) {
      const ids = {};
      sim.assemblyRules.forEach(r => {
        if (!r || !r.machineId) return;
        if (exceptRule && r.resultName === exceptRule.resultName && r.machineId === exceptRule.machineId) return;
        ids[r.machineId] = true;
      });
      return ids;
    }

    function inferJoinTimesAndRoute(rule, srcParts) {
      const times = { setup: Number(rule.setup) || 0, prodUnit: Number(rule.prodUnit) || 0 };
      const inferredRoute = Array.isArray(rule.route) ? rule.route.slice() : [];
      const stopMachines = otherJoinMachineIds(rule);
      (srcParts || sim.parts).forEach(p => {
        if (!rule.requiredPartNames.includes(p.name)) return;
        const idx = (p.route || []).findIndex(s => s.machineId === rule.machineId);
        if (idx < 0) return;
        const step = p.route[idx];
        if (!times.setup) times.setup = Number(step.setup) || 0;
        if (!times.prodUnit) times.prodUnit = Number(step.prodUnit) || 0;
        if (inferredRoute.length === 0) {
          for (let i = idx + 1; i < p.route.length; i++) {
            const next = p.route[i];
            if (stopMachines[next.machineId]) break;
            inferredRoute.push(normalizeRouteStep(next));
          }
        }
      });
      if (inferredRoute.length === 0) {
        const known = knownBomFinishingRoute(rule);
        if (known.length) inferredRoute.push.apply(inferredRoute, known);
      }
      return {
        setup: times.setup || 1,
        prodUnit: times.prodUnit || 1,
        route: inferredRoute
      };
    }

    function countInputsWithJoinMachine(rule, srcParts) {
      const requer = (rule && rule.requiredPartNames) || [];
      let n = 0;
      requer.forEach(name => {
        const p = (srcParts || []).find(x => x.name === name);
        if (p && (p.route || []).some(s => s && s.machineId === rule.machineId && !isJoinStep(s))) n++;
      });
      return n;
    }

    function isSharedJoinMeetingPoint(rule, srcParts) {
      return countInputsWithJoinMachine(rule, srcParts) >= 2;
    }

    function ensureIndividualRouteAfterLastOp(part, route, joinMachines) {
      const name = part && part.name ? String(part.name).toUpperCase() : '';
      if (name !== 'TAMPA') return route || [];
      if (routeHasMachineName(route, 'BANHO')) return route;
      const last = (route || [])[(route || []).length - 1];
      if (!last || machineNameOf(last.machineId).indexOf('IMAG') < 0) return route || [];
      const extra = machineStepsByNameIncludes(['BANHO', 'CABINE', 'ESTUFA'])
        .filter(s => s && s.machineId && !(joinMachines && joinMachines[s.machineId]));
      return (route || []).concat(extra);
    }

    function getSimParts() {
      return (sim.bomRuntimeParts && sim.bomRuntimeParts.length) ? sim.bomRuntimeParts : sim.parts;
    }

    function findSimPart(name, list) {
      return (list || getSimParts()).find(p => p.name === name) || null;
    }

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
        (a.route || []).forEach(step => {
          if (step && step.machineId) ids[step.machineId] = true;
        });
        if (a.juncao && a.juncao.maquina) ids[a.juncao.maquina] = true;
      });
      return ids;
    }

    function getSimulationMachines() {
      const ids = collectUsedMachineIds(sim.parts, sim.groupingRules, sim.assemblyRules);
      const active = sim.machines.filter(m => m && ids[m.id]);
      return active.length > 0 ? active : sim.machines.slice();
    }

    function machineFreeAt(map, machineId) {
      if (map && map[machineId] != null) return map[machineId];
      return t0();
    }

    function entityRouteDone(name, nextStepIndex, list) {
      const ent = findSimPart(name, list);
      const len = ent && Array.isArray(ent.route) ? ent.route.length : 0;
      return (nextStepIndex[name] || 0) >= len;
    }

    function joinInputsCompleted(requer, nextStepIndex, list) {
      if (!requer || requer.length === 0) return true;
      return requer.every(name => entityRouteDone(name, nextStepIndex, list));
    }

    function joinAvailableAt(requer, partReady) {
      let t = t0();
      (requer || []).forEach(name => {
        const end = partReady[name] != null ? partReady[name] : t0();
        if (end > t) t = end;
      });
      return t;
    }

    function getPartReadyForMachine(partName, machineId, readyMap) {
      const start = t0();
      const simP = findSimPart(partName);
      if (simP) {
        const asmIdx = simP.route.findIndex(s => s.machineId === machineId);
        if (asmIdx > 0) {
          const prevStep = simP.route[asmIdx - 1];
          return readyMap[partName + '_' + prevStep.machineId] != null
            ? readyMap[partName + '_' + prevStep.machineId]
            : start;
        }
        if (asmIdx === 0 && isJoinStep(simP.route[0])) return start;
      }
      const part = sim.parts.find(p => p.name === partName);
      if (!part) {
        const prevAsm = sim.assemblyRules.find(a => a.resultName === partName);
        if (prevAsm) {
          return readyMap[partName + '_' + prevAsm.machineId] != null
            ? readyMap[partName + '_' + prevAsm.machineId]
            : start;
        }
        return start;
      }
      const asmIdx = part.route.findIndex(s => s.machineId === machineId);
      if (asmIdx < 0) return start;
      if (asmIdx === 0) return start;
      const prevStep = part.route[asmIdx - 1];
      return readyMap[partName + '_' + prevStep.machineId] != null
        ? readyMap[partName + '_' + prevStep.machineId]
        : start;
    }

    function maybeInsertMaintenance(machineId, machineFreeUntil, machineOperated, localMaintEvents) {
      const m = sim.machines.find(x => x.id === machineId);
      if (!m) return;
      const intervalMin = (m.maintIntervalHours || 0) * 60;
      const durationMin = (m.maintDurationHours || 0) * 60;
      if (intervalMin <= 0 || durationMin <= 0) return;
      if ((machineOperated[machineId] || 0) < intervalMin) return;
      const start = snapToProductive(machineFreeUntil[machineId] != null ? machineFreeUntil[machineId] : t0());
      const end = addProductiveMinutes(start, durationMin);
      localMaintEvents.push({ machineId: machineId, start: start, end: end, duration: durationMin });
      machineFreeUntil[machineId] = end;
      machineOperated[machineId] = 0;
    }

    function buildProcessEvent(part, step, stepIndex, fields) {
      const prodStart = fields.prodStart;
      const setupEnd = fields.setupEnd != null ? fields.setupEnd : prodStart;
      return {
        partName: part.name,
        machineId: step.machineId,
        stepIndex: stepIndex,
        setupUnit: fields.setupTime,
        prodUnit: step.prodUnit,
        qty: fields.qty,
        arrivalTime: fields.arrivalTime,
        assemblyGate: fields.assemblyGate,
        setupStart: fields.setupStart,
        setupEnd: setupEnd,
        prodStart: prodStart,
        end: fields.end,
        setupTime: fields.setupTime,
        prodTime: fields.prodTime,
        waitingForAssembly: !!fields.waitingForAssembly,
        isLastStep: stepIndex === part.route.length - 1,
        grouped: !!fields.grouped,
        isJoin: !!fields.isJoin,
        skuName: fields.skuName || part.name,
        requer: fields.requer || []
      };
    }

    function resolveAssemblyWait(part, step, arrivalTime, readyMap, partReady, nextStepIndex) {
      if (!isJoinStep(step)) {
        return { waitingForAssembly: false, assemblyGate: arrivalTime, assemblyRule: null, requer: [] };
      }
      const requer = joinRequerOf(step);
      const gate = joinAvailableAt(requer, partReady || {});
      return {
        waitingForAssembly: true,
        assemblyGate: gate,
        assemblyRule: sim.assemblyRules.find(a => a.resultName === part.name && a.machineId === step.machineId) || {
          resultName: part.name,
          machineId: step.machineId,
          requiredPartNames: requer
        },
        requer: requer
      };
    }

    function collectGroupingMembers(groupRule, readyMap, partReady, nextStepIndex) {
      const members = [];
      const simList = getSimParts();
      groupRule.partNames.forEach(name => {
        const part = findSimPart(name, simList);
        if (!part) return;
        const stepIndex = part.route.findIndex(s => s.machineId === groupRule.machineId);
        if (stepIndex < 0) return;
        const step = part.route[stepIndex];
        const arrivalTime = (partReady && Object.prototype.hasOwnProperty.call(partReady, part.name))
          ? partReady[part.name]
          : getPartReadyForMachine(part.name, step.machineId, readyMap);
        const asm = resolveAssemblyWait(part, step, arrivalTime, readyMap, partReady, nextStepIndex);
        members.push({
          part: part,
          step: step,
          stepIndex: stepIndex,
          arrivalTime: arrivalTime,
          waitingForAssembly: asm.waitingForAssembly,
          assemblyGate: asm.assemblyGate,
          assemblyRule: asm.assemblyRule,
          readyForMachine: Math.max(arrivalTime, asm.assemblyGate),
          setupTime: groupedSetupTime(step.setup, groupRule.partNames.length),
          prodTime: step.prodUnit * (part.qty * sim.boxesQty),
          qty: part.qty * sim.boxesQty
        });
      });
      return members;
    }

    function scheduleGroupedMachineBatch(groupRule, readyTimeOfParts, machineFreeUntil, machineOperated, passEvents, passMaint, groupedScheduled, partReady, nextStepIndex) {
      const members = collectGroupingMembers(groupRule, readyTimeOfParts, partReady, nextStepIndex);
      if (members.length === 0) return;
      const machineId = groupRule.machineId;
      maybeInsertMaintenance(machineId, machineFreeUntil, machineOperated, passMaint);
      const sharedSetupStart = snapToProductive(Math.max(
        machineFreeAt(machineFreeUntil, machineId),
        members.reduce((max, m) => Math.max(max, m.readyForMachine), t0())
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
        groupedScheduled[m.part.name + '_' + machineId] = evt;
        readyTimeOfParts[m.part.name + '_' + machineId] = evt.end;
        if (m.assemblyRule) {
          readyTimeOfParts[m.assemblyRule.resultName + '_' + m.assemblyRule.machineId] = evt.end;
        }
      });
      machineFreeUntil[machineId] = batchEnd;
      machineOperated[machineId] = (machineOperated[machineId] || 0) + sharedSetupDur + maxProdTime;
      maybeInsertMaintenance(machineId, machineFreeUntil, machineOperated, passMaint);
    }

    function assemblyDependenciesMet(part, step, readyMap, partReady, nextStepIndex) {
      if (!isJoinStep(step)) return true;
      return joinInputsCompleted(joinRequerOf(step), nextStepIndex || {}, getSimParts());
    }

    function groupRepresentativeName(groupRule) {
      const simList = getSimParts();
      for (let i = 0; i < groupRule.partNames.length; i++) {
        if (simList.some(p => p.name === groupRule.partNames[i])) return groupRule.partNames[i];
      }
      return groupRule.partNames[0];
    }

    function allGroupMembersAtGroupedStep(groupRule, nextStepIndex) {
      const simList = getSimParts();
      return groupRule.partNames.every(name => {
        const part = findSimPart(name, simList);
        if (!part) return true;
        const si = part.route.findIndex(s => s.machineId === groupRule.machineId);
        if (si < 0) return true;
        return (nextStepIndex[name] || 0) === si;
      });
    }

    function findGroupRuleForStep(part, step) {
      return sim.groupingRules.find(g => g.machineId === step.machineId && g.partNames.includes(part.name)) || null;
    }

    function commitSingleStep(part, step, stepIndex, arrivalTime, asm, machineFreeUntil, machineOperated, readyTimeOfParts, events, maintEvents, partReady, nextStepIndex) {
      const setupTime = step.setup;
      const prodTime = step.prodUnit * (part.qty * sim.boxesQty);
      const assemblyRule = asm.assemblyRule;
      const waitingForAssembly = asm.waitingForAssembly;
      const assemblyGate = asm.assemblyGate;
      maybeInsertMaintenance(step.machineId, machineFreeUntil, machineOperated, maintEvents);
      const readyForMachine = Math.max(arrivalTime, assemblyGate);
      const setupStart = snapToProductive(Math.max(readyForMachine, machineFreeAt(machineFreeUntil, step.machineId)));
      const prodStart = addProductiveMinutes(setupStart, setupTime);
      const end = addProductiveMinutes(prodStart, prodTime);
      machineFreeUntil[step.machineId] = end;
      machineOperated[step.machineId] = (machineOperated[step.machineId] || 0) + setupTime + prodTime;
      partReady[part.name] = end;
      nextStepIndex[part.name] = stepIndex + 1;
      readyTimeOfParts[part.name + '_' + step.machineId] = end;
      if (assemblyRule) {
        readyTimeOfParts[assemblyRule.resultName + '_' + assemblyRule.machineId] = end;
      }
      maybeInsertMaintenance(step.machineId, machineFreeUntil, machineOperated, maintEvents);
      events.push(buildProcessEvent(part, step, stepIndex, {
        qty: part.qty * sim.boxesQty,
        arrivalTime: arrivalTime,
        assemblyGate: assemblyGate,
        setupStart: setupStart,
        setupEnd: prodStart,
        prodStart: prodStart,
        end: end,
        setupTime: setupTime,
        prodTime: prodTime,
        waitingForAssembly: waitingForAssembly,
        isJoin: isJoinStep(step),
        skuName: part.name,
        requer: joinRequerOf(step)
      }));
    }

    function collectScheduleCandidates(nextStepIndex, partReady, readyTimeOfParts, machineFreeUntil, groupedScheduled, ignoreAssembly) {
      const candidates = [];
      const simList = getSimParts();
      simList.forEach((part, partIdx) => {
        const stepIndex = nextStepIndex[part.name] || 0;
        if (stepIndex >= part.route.length) return;
        const step = part.route[stepIndex];
        const groupRule = findGroupRuleForStep(part, step);
        const joinBlocked = isJoinStep(step) && !joinInputsCompleted(joinRequerOf(step), nextStepIndex, simList);
        if (joinBlocked) return;

        if (groupRule) {
          if (groupedScheduled[part.name + '_' + step.machineId]) return;
          if (!allGroupMembersAtGroupedStep(groupRule, nextStepIndex)) return;
          if (part.name !== groupRepresentativeName(groupRule)) return;
          const members = collectGroupingMembers(groupRule, readyTimeOfParts, partReady, nextStepIndex);
          if (members.length === 0) return;
          if (!ignoreAssembly && members.some(m => !assemblyDependenciesMet(m.part, m.step, readyTimeOfParts, partReady, nextStepIndex))) return;
          const readyForMachine = members.reduce((max, m) => Math.max(max, m.readyForMachine), t0());
          const setupStart = snapToProductive(Math.max(machineFreeAt(machineFreeUntil, step.machineId), readyForMachine));
          candidates.push({
            type: 'group',
            groupRule: groupRule,
            part: part,
            step: step,
            stepIndex: stepIndex,
            partIdx: partIdx,
            setupStart: setupStart,
            readyForMachine: readyForMachine
          });
          return;
        }

        if (isJoinStep(step)) {
          const requer = joinRequerOf(step);
          const arrivalTime = joinAvailableAt(requer, partReady);
          const asm = resolveAssemblyWait(part, step, arrivalTime, readyTimeOfParts, partReady, nextStepIndex);
          const readyForMachine = Math.max(arrivalTime, asm.assemblyGate);
          const firstArrival = (requer || []).reduce((min, n) => Math.min(min, partReady[n] != null ? partReady[n] : min), readyForMachine);
          const setupStart = snapToProductive(Math.max(readyForMachine, machineFreeAt(machineFreeUntil, step.machineId)));
          candidates.push({
            type: 'single',
            part: part,
            step: step,
            stepIndex: stepIndex,
            partIdx: partIdx,
            arrivalTime: firstArrival,
            asm: asm,
            setupStart: setupStart,
            readyForMachine: readyForMachine
          });
          return;
        }

        if (!ignoreAssembly && !assemblyDependenciesMet(part, step, readyTimeOfParts, partReady, nextStepIndex)) return;
        const arrivalTime = partReady[part.name] != null ? partReady[part.name] : t0();
        const asm = resolveAssemblyWait(part, step, arrivalTime, readyTimeOfParts, partReady, nextStepIndex);
        const readyForMachine = Math.max(arrivalTime, asm.assemblyGate);
        const setupStart = snapToProductive(Math.max(readyForMachine, machineFreeAt(machineFreeUntil, step.machineId)));
        candidates.push({
          type: 'single',
          part: part,
          step: step,
          stepIndex: stepIndex,
          partIdx: partIdx,
          arrivalTime: arrivalTime,
          asm: asm,
          setupStart: setupStart,
          readyForMachine: readyForMachine
        });
      });
      return candidates;
    }

    function buildBomRuntimeParts() {
      const expandedRules = (sim.assemblyRules || []).map(rule => {
        const inferred = inferJoinTimesAndRoute(rule, sim.parts);
        return {
          machineId: rule.machineId,
          resultName: rule.resultName,
          requiredPartNames: rule.requiredPartNames,
          juncao: rule.juncao,
          setup: rule.setup || inferred.setup,
          prodUnit: rule.prodUnit || inferred.prodUnit,
          qty: rule.qty,
          route: (rule.route && rule.route.length) ? rule.route : inferred.route
        };
      });
      sim.assemblyRules = expandedRules;
      const claimedJoinMachines = {};
      expandedRules.forEach(rule => {
        if (rule && rule.machineId) claimedJoinMachines[rule.machineId] = true;
      });
      const physical = (sim.parts || []).map(p => {
        const consumeAt = expandedRules.find(r =>
          (r.requiredPartNames || []).some(n => String(n).toUpperCase() === String(p.name).toUpperCase())
        );
        let route = (p.route || []).map(normalizeRouteStep)
          .filter(s => s && s.machineId && !isJoinStep(s));
        if (consumeAt) {
          const cut = route.findIndex(s => s.machineId === consumeAt.machineId);
          if (cut >= 0) {
            if (isSharedJoinMeetingPoint(consumeAt, sim.parts)) {
              route = route.slice(0, cut);
            } else {
              route = route.slice(0, cut + 1);
            }
          }
        }
        route = ensureIndividualRouteAfterLastOp(p, route, claimedJoinMachines);
        return {
          name: p.name,
          thickness: p.thickness,
          qty: p.qty,
          route: route,
          isVirtual: false
        };
      });
      const virtual = expandedRules.map(rule => {
        const joinStep = {
          machineId: rule.machineId,
          setup: rule.setup || 1,
          prodUnit: rule.prodUnit || 1,
          juncao: {
            requer: (rule.requiredPartNames || []).slice(),
            maquina: rule.machineId
          }
        };
        return {
          name: rule.resultName,
          thickness: 0,
          qty: rule.qty || 1,
          route: [joinStep].concat(rule.route || []),
          isVirtual: true
        };
      });
      sim.bomRuntimeParts = physical.concat(virtual);
      return sim.bomRuntimeParts;
    }

    function scheduleProductionEvents() {
      const machineFreeUntil = {};
      const machineOperated = {};
      const simParts = buildBomRuntimeParts();
      const simMachines = getSimulationMachines();
      const start = t0();
      simMachines.forEach(m => {
        machineFreeUntil[m.id] = start;
        machineOperated[m.id] = 0;
      });
      const readyTimeOfParts = {};
      const events = [];
      const maintEvents = [];
      const groupedScheduled = {};
      const partReady = {};
      const nextStepIndex = {};
      simParts.forEach(p => {
        partReady[p.name] = start;
        nextStepIndex[p.name] = 0;
      });
      const totalSteps = simParts.reduce((n, p) => n + p.route.length, 0);
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
            partReady,
            nextStepIndex
          );
          chosen.groupRule.partNames.forEach(name => {
            const evt = groupedScheduled[name + '_' + chosen.groupRule.machineId];
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
      return { events: events, maintEvents: maintEvents };
    }

    function resolveBusyBlocks(src) {
      const points = [];
      src.forEach(b => {
        points.push(b.start, b.end);
      });
      points.sort((a, b) => a - b);
      const uniq = [];
      points.forEach(p => {
        if (!uniq.length || uniq[uniq.length - 1] !== p) uniq.push(p);
      });
      const resolved = [];
      for (let i = 0; i < uniq.length - 1; i++) {
        const a = uniq[i];
        const b = uniq[i + 1];
        let bestRank = 0;
        src.forEach(block => {
          if (block.start >= b || block.end <= a) return;
          const rank = ganttKindRank(block.kind);
          if (rank > bestRank) bestRank = rank;
        });
        if (!bestRank) continue;
        const last = resolved[resolved.length - 1];
        if (last && last.rank === bestRank && last.end === a) last.end = b;
        else resolved.push({ start: a, end: b, rank: bestRank });
      }
      return resolved;
    }

    function computeIdleTotal(events, maintEvents, machinesList, histStart, histEnd) {
      let idle = 0;
      const window = Math.max(0, histEnd - histStart);
      const lunch = lunchMinutesInRange(histStart, histEnd);
      machinesList.forEach(m => {
        const blocks = [];
        events.filter(e => e.machineId === m.id).forEach(evt => {
          const wait = clipInterval(evt.arrivalTime, evt.setupStart, histStart, histEnd);
          if (wait) blocks.push({ kind: 'wait', start: wait.start, end: wait.end });
          const setup = clipInterval(evt.setupStart, eventSetupEnd(evt), histStart, histEnd);
          if (setup) blocks.push({ kind: 'setup', start: setup.start, end: setup.end });
          const prod = clipInterval(evt.prodStart, evt.end, histStart, histEnd);
          if (prod) blocks.push({ kind: 'prod', start: prod.start, end: prod.end });
        });
        maintEvents.filter(e => e.machineId === m.id).forEach(me => {
          const maint = clipInterval(me.start, me.end, histStart, histEnd);
          if (maint) blocks.push({ kind: 'maint', start: maint.start, end: maint.end });
        });
        let coveredNet = 0;
        resolveBusyBlocks(blocks).forEach(b => {
          coveredNet += Math.max(0, (b.end - b.start) - lunchMinutesInRange(b.start, b.end));
        });
        const windowNet = window - lunch;
        idle += Math.max(0, windowNet - coveredNet);
      });
      return idle;
    }

    function reorderParts(sequence) {
      const byUpper = {};
      sim.baseParts.forEach(p => {
        byUpper[String(p.name).toUpperCase()] = p;
      });
      const ordered = [];
      const seen = {};
      (sequence || []).forEach(name => {
        const p = byUpper[String(name).toUpperCase()];
        if (p && !seen[p.name]) {
          ordered.push(p);
          seen[p.name] = true;
        }
      });
      sim.baseParts.forEach(p => {
        if (!seen[p.name]) ordered.push(p);
      });
      return ordered;
    }

    function evaluateSequence(sequence, strategy) {
      sim.parts = reorderParts(sequence).map(p => ({
        name: p.name,
        thickness: p.thickness,
        qty: Number(p.qty) > 0 ? Number(p.qty) : 1,
        route: (p.route || []).map(normalizeRouteStep)
      }));
      sim.assemblyRules = sim.assemblyRulesBase.map(normalizeAssemblyRule);
      const scheduled = scheduleProductionEvents();
      const events = scheduled.events || [];
      const maintEvents = scheduled.maintEvents || [];
      const histStart = t0();
      let histEnd = histStart;
      events.forEach(e => { if (e.end > histEnd) histEnd = e.end; });
      maintEvents.forEach(e => { if (e.end > histEnd) histEnd = e.end; });
      const makespan = Math.max(0, histEnd - histStart);
      const machinesList = getSimulationMachines();
      const idle = computeIdleTotal(events, maintEvents, machinesList, histStart, histEnd);
      const score = makespan + (idle * IDLE_WEIGHT);
      const usedSeq = sim.baseParts.map(p => p.name);
      const orderedNames = reorderParts(sequence).map(p => p.name);
      return {
        sequence: orderedNames.length ? orderedNames : usedSeq,
        strategy: strategy || '',
        score: score,
        makespan: makespan,
        idle: idle
      };
    }

    function primaryNames() {
      return sim.baseParts.map(p => p.name);
    }

    function partProcessTime(name) {
      const p = sim.baseParts.find(x => x.name === name);
      if (!p) return 0;
      return (p.route || []).reduce((sum, st) => {
        return sum + (Number(st.setup) || 0) + (Number(st.prodUnit) || 0) * (Number(p.qty) || 1) * sim.boxesQty;
      }, 0);
    }

    function heuristicSeeds() {
      const names = primaryNames();
      const lpt = names.slice().sort((a, b) => partProcessTime(b) - partProcessTime(a) || a.localeCompare(b, 'pt-BR'));
      const spt = names.slice().sort((a, b) => partProcessTime(a) - partProcessTime(b) || a.localeCompare(b, 'pt-BR'));
      const load = {};
      sim.baseParts.forEach(p => {
        (p.route || []).forEach(st => {
          if (!st || !st.machineId) return;
          const t = (Number(st.setup) || 0) + (Number(st.prodUnit) || 0) * (Number(p.qty) || 1) * sim.boxesQty;
          load[st.machineId] = (load[st.machineId] || 0) + t;
        });
      });
      let bottleneckId = null;
      let best = -1;
      Object.keys(load).forEach(id => {
        if (load[id] > best) {
          best = load[id];
          bottleneckId = id;
        }
      });
      function timeOnBottleneck(name) {
        const p = sim.baseParts.find(x => x.name === name);
        if (!p || !bottleneckId) return 0;
        return (p.route || []).reduce((sum, st) => {
          if (st.machineId !== bottleneckId) return sum;
          return sum + (Number(st.setup) || 0) + (Number(st.prodUnit) || 0) * (Number(p.qty) || 1) * sim.boxesQty;
        }, 0);
      }
      const gargalo = names.slice().sort((a, b) =>
        timeOnBottleneck(b) - timeOnBottleneck(a) || partProcessTime(b) - partProcessTime(a) || a.localeCompare(b, 'pt-BR')
      );
      return [
        { sequence: names.slice(), strategy: 'atual' },
        { sequence: lpt, strategy: 'LPT' },
        { sequence: spt, strategy: 'SPT' },
        { sequence: gargalo, strategy: 'gargalo' }
      ];
    }

    sim.evaluateSequence = evaluateSequence;
    sim.primaryNames = primaryNames;
    sim.heuristicSeeds = heuristicSeeds;
    sim.reorderParts = reorderParts;
    return sim;
  }

  function insertTop3(top3, scenario) {
    if (!scenario || !scenario.sequence || !scenario.sequence.length) return top3;
    const key = sequenceKey(scenario.sequence);
    const existing = top3.find(s => sequenceKey(s.sequence) === key);
    if (existing) {
      if (scenario.score < existing.score) {
        existing.score = scenario.score;
        existing.makespan = scenario.makespan;
        existing.idle = scenario.idle;
        existing.strategy = scenario.strategy || existing.strategy;
      }
    } else {
      top3.push({
        sequence: scenario.sequence.slice(),
        strategy: scenario.strategy || '',
        score: scenario.score,
        makespan: scenario.makespan,
        idle: scenario.idle
      });
    }
    top3.sort((a, b) => a.score - b.score || a.makespan - b.makespan || a.idle - b.idle);
    if (top3.length > 3) top3.length = 3;
    top3.forEach((s, i) => { s.rank = i + 1; });
    return top3;
  }

  function nextPermutation(arr) {
    let i = arr.length - 2;
    while (i >= 0 && arr[i] >= arr[i + 1]) i--;
    if (i < 0) return false;
    let j = arr.length - 1;
    while (arr[j] <= arr[i]) j--;
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
    let l = i + 1;
    let r = arr.length - 1;
    while (l < r) {
      const t2 = arr[l];
      arr[l] = arr[r];
      arr[r] = t2;
      l++;
      r--;
    }
    return true;
  }

  function swapCopy(seq, i, j) {
    const out = seq.slice();
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
    return out;
  }

  function pickSwapPair(n) {
    if (n < 2) return [0, 0];
    let i = Math.floor(Math.random() * n);
    let j = Math.floor(Math.random() * n);
    let guard = 0;
    while (j === i && guard++ < 8) j = Math.floor(Math.random() * n);
    return [i, j];
  }

  function yieldTick() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  function waitWhilePaused(getRun) {
    return new Promise(resolve => {
      const iv = setInterval(() => {
        const run = getRun();
        if (!run || run.cancelled || !run.paused) {
          clearInterval(iv);
          resolve();
        }
      }, 40);
    });
  }

  let runState = null;
  let loopToken = 0;

  function publicTop3(top3) {
    return (top3 || []).map((s, i) => ({
      rank: i + 1,
      score: s.score,
      makespan: s.makespan,
      idle: s.idle,
      sequence: (s.sequence || []).slice(),
      strategy: s.strategy || ''
    }));
  }

  function progressPayload(run, extra) {
    const elapsed = run.elapsedMs + (run.runningSince ? (Date.now() - run.runningSince) : 0);
    const done = run.iteration;
    const total = Math.max(1, run.total);
    const remaining = Math.max(0, total - done);
    const rate = done > 0 ? elapsed / done : 0;
    const etaSeconds = rate > 0 ? Math.round((rate * remaining) / 1000) : 0;
    const best = run.top3[0];
    return Object.assign({
      type: 'PROGRESS',
      percent: Math.min(100, Math.round((done / total) * 100)),
      iteration: done,
      total: total,
      etaSeconds: etaSeconds,
      bestScore: best ? best.score : null,
      top3: publicTop3(run.top3),
      baseline: run.baseline ? {
        score: run.baseline.score,
        makespan: run.baseline.makespan,
        idle: run.baseline.idle,
        sequence: (run.baseline.sequence || []).slice(),
        strategy: run.baseline.strategy || 'atual'
      } : null,
      paused: !!run.paused,
      running: !run.paused && !run.cancelled && done < total,
      lastSequence: run.lastSequence ? run.lastSequence.slice() : []
    }, extra || {});
  }

  function postProgress(run, extra) {
    self.postMessage(progressPayload(run, extra));
  }

  function finishRun(run, reason) {
    run.cancelled = reason === 'cancel';
    run.paused = false;
    if (run.runningSince) {
      run.elapsedMs += Date.now() - run.runningSince;
      run.runningSince = 0;
    }
    self.postMessage({
      type: 'DONE',
      reason: reason,
      percent: reason === 'complete' ? 100 : Math.min(100, Math.round((run.iteration / Math.max(1, run.total)) * 100)),
      iteration: run.iteration,
      total: run.total,
      etaSeconds: 0,
      bestScore: run.top3[0] ? run.top3[0].score : null,
      top3: publicTop3(run.top3),
      baseline: run.baseline ? {
        score: run.baseline.score,
        makespan: run.baseline.makespan,
        idle: run.baseline.idle,
        sequence: (run.baseline.sequence || []).slice(),
        strategy: run.baseline.strategy || 'atual'
      } : null,
      sku: run.sku,
      projectName: run.projectName,
      boxesQty: run.boxesQty,
      startTime: run.startTime
    });
  }

  function plannedTotal(n, requested) {
    const req = Number(requested);
    if (req > 0) return Math.max(1, Math.floor(req));
    if (n <= 1) return 1;
    if (n <= 5) return factorial(n);
    if (n === 6) return Math.min(720, DEFAULT_MAX_ITERS * 2);
    return DEFAULT_MAX_ITERS;
  }

  function collectSeedJobs(sim, payload) {
    const jobs = [];
    const seen = {};
    function pushJob(seq, strategy) {
      const ordered = sim.reorderParts(seq).map(p => p.name);
      const key = sequenceKey(ordered);
      if (!ordered.length || seen[key]) return;
      seen[key] = true;
      jobs.push({ sequence: ordered, strategy: strategy || 'seed' });
    }
    sim.heuristicSeeds().forEach(h => pushJob(h.sequence, h.strategy));
    const seeds = Array.isArray(payload && payload.seedTop3) ? payload.seedTop3 : [];
    seeds.forEach((sc, idx) => {
      const seq = sc && Array.isArray(sc.sequence) ? sc.sequence : sc;
      if (Array.isArray(seq)) pushJob(seq, (sc && sc.strategy) || ('historico-' + (idx + 1)));
    });
    return { jobs: jobs, seen: seen };
  }

  async function runSearchLoop(token) {
    const run = runState;
    if (!run || token !== loopToken) return;
    const sim = run.sim;
    const names = sim.primaryNames();
    const n = names.length;

    while (run.iteration < run.total && !run.cancelled && token === loopToken) {
      if (run.paused) {
        if (run.runningSince) {
          run.elapsedMs += Date.now() - run.runningSince;
          run.runningSince = 0;
        }
        postProgress(run, { type: 'PAUSED', running: false, paused: true });
        await waitWhilePaused(() => runState === run ? run : null);
        if (run.cancelled || token !== loopToken) break;
        run.runningSince = Date.now();
        postProgress(run, { type: 'PROGRESS', running: true, paused: false });
        continue;
      }

      let job = null;
      if (run.seedIndex < run.seedJobs.length) {
        job = run.seedJobs[run.seedIndex++];
      } else if (run.enumActive) {
        if (!run.enumStarted) {
          run.enumCursor = names.slice().sort();
          run.enumStarted = true;
          const key = sequenceKey(run.enumCursor);
          if (!run.seen[key]) job = { sequence: run.enumCursor.slice(), strategy: 'perm' };
        } else if (nextPermutation(run.enumCursor)) {
          const key = sequenceKey(run.enumCursor);
          if (!run.seen[key]) job = { sequence: run.enumCursor.slice(), strategy: 'perm' };
        } else {
          run.enumActive = false;
        }
      }

      if (!job && run.enumActive) {
        await yieldTick();
        continue;
      }

      if (!job && !run.enumActive && n >= 2) {
        const pool = run.top3.length ? run.top3 : [{ sequence: names.slice() }];
        const base = pool[Math.floor(Math.random() * pool.length)].sequence.slice();
        let candidate = null;
        for (let attempt = 0; attempt < 10; attempt++) {
          const pair = pickSwapPair(base.length);
          const swapped = swapCopy(base, pair[0], pair[1]);
          const key = sequenceKey(swapped);
          if (!run.seen[key]) {
            candidate = swapped;
            break;
          }
        }
        if (candidate) job = { sequence: candidate, strategy: 'swap' };
      }

      if (!job) {
        if (run.iteration === 0 && names.length) {
          job = { sequence: names.slice(), strategy: 'atual' };
        } else {
          break;
        }
      }

      const key = sequenceKey(job.sequence);
      if (run.seen[key] && run.iteration > 0) {
        await yieldTick();
        continue;
      }
      run.seen[key] = true;
      const result = sim.evaluateSequence(job.sequence, job.strategy);
      run.lastSequence = result.sequence.slice();
      if (!run.baseline && (job.strategy === 'atual' || sequenceKey(result.sequence) === sequenceKey(names))) {
        run.baseline = {
          sequence: result.sequence.slice(),
          strategy: 'atual',
          score: result.score,
          makespan: result.makespan,
          idle: result.idle
        };
      }
      insertTop3(run.top3, result);
      run.iteration += 1;

      if (run.iteration === 1 || run.iteration % PROGRESS_BATCH === 0 || run.iteration >= run.total) {
        postProgress(run);
      }
      await yieldTick();
    }

    if (token !== loopToken || runState !== run) return;
    if (run.cancelled) {
      finishRun(run, 'cancel');
      return;
    }
    finishRun(run, 'complete');
  }

  function startFromPayload(payload) {
    loopToken += 1;
    const token = loopToken;
    const snap = payload && typeof payload === 'object' ? payload : {};
    const sim = createHeadlessSim(snap);
    const names = sim.primaryNames();
    if (!names.length) {
      self.postMessage({ type: 'ERROR', message: 'Nenhuma peça primária para sequenciar.' });
      return;
    }
    const seedPack = collectSeedJobs(sim, snap);
    const total = plannedTotal(names.length, snap.maxIterations);
    runState = {
      sim: sim,
      sku: String(snap.sku || ''),
      projectName: String(snap.projectName || ''),
      boxesQty: sim.boxesQty,
      startTime: (normalizeStartOffset(snap.startTime).clockStr),
      seedJobs: seedPack.jobs,
      seedIndex: 0,
      seen: Object.assign({}, seedPack.seen),
      enumActive: names.length <= 6 && names.length >= 2,
      enumStarted: false,
      enumCursor: [],
      top3: [],
      iteration: 0,
      total: total,
      paused: false,
      cancelled: false,
      elapsedMs: 0,
      runningSince: Date.now(),
      lastSequence: names.slice(),
      baseline: null
    };
    Object.keys(runState.seen).forEach(k => { runState.seen[k] = false; });
    self.postMessage({
      type: 'STARTED',
      iteration: 0,
      total: total,
      percent: 0,
      etaSeconds: 0,
      bestScore: null,
      top3: [],
      sku: runState.sku,
      projectName: runState.projectName
    });
    runSearchLoop(token);
  }

  function pauseRun() {
    if (!runState || runState.cancelled) return;
    runState.paused = true;
  }

  function resumeRun() {
    if (!runState || runState.cancelled) return;
    if (!runState.paused) return;
    runState.paused = false;
  }

  function cancelRun() {
    if (!runState) {
      self.postMessage({ type: 'DONE', reason: 'cancel', top3: [], iteration: 0, total: 0, percent: 0, etaSeconds: 0, bestScore: null });
      return;
    }
    runState.cancelled = true;
    runState.paused = false;
  }

  self.onmessage = function (event) {
    const msg = event && event.data ? event.data : {};
    const type = String(msg.type || '').toUpperCase();
    if (type === 'START') startFromPayload(msg.payload || msg);
    else if (type === 'PAUSE') pauseRun();
    else if (type === 'RESUME') resumeRun();
    else if (type === 'CANCEL') cancelRun();
  };
}

if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope) {
  pcpmasterTesterWorkerBootstrap();
}
