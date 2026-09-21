/* PCPMaster v1.9.3 — Motor de simulação, calendário, manutenção, analytics, Gantt e jornada das peças */

const APP_NAME = 'PCPMaster';
const APP_VERSION = '1.9.3';
const SCHEMA_VERSION = 'v2.0';

// --- PARÂMETROS DO TURNO ---
const SHIFT_START_MINUTES = 7 * 60 + 30;
const SHIFT_END_MINUTES = 17 * 60 + 18;
const TOTAL_SHIFT_DURATION = SHIFT_END_MINUTES - SHIFT_START_MINUTES; // 588
const LUNCH_START_OFFSET = (12 * 60) - SHIFT_START_MINUTES; // 270
const LUNCH_END_OFFSET = (13 * 60) - SHIFT_START_MINUTES;   // 330
const MINUTES_PER_DAY = TOTAL_SHIFT_DURATION; // 588
const DEFAULT_START_TIME = '07:30';

// --- ESTUFA (Sprint 12): cabine 3D e ciclo térmico GLP ---
const ESTUFA_CABIN_H = 2.00;
const ESTUFA_CABIN_W = 1.75;
const ESTUFA_CABIN_D = 3.85;
const ESTUFA_CABIN_VOLUME = ESTUFA_CABIN_H * ESTUFA_CABIN_W * ESTUFA_CABIN_D; // 13.475 m³
const ESTUFA_QUEIMA_MIN = 30;
const ESTUFA_RESFRIO_MIN = 30;
const ESTUFA_CICLO_MIN = ESTUFA_QUEIMA_MIN + ESTUFA_RESFRIO_MIN;
const ESTUFA_FULL_EPS = 0.01;

    /** Aceita 0,25 e 0.25. Não arredonda para inteiro. */
    function parseFlexibleNumber(value, fallback) {
      if (typeof value === 'number') return isFinite(value) ? value : fallback;
      if (value == null) return fallback;
      const s = String(value).trim().replace(/\s/g, '').replace(',', '.');
      if (!s) return fallback;
      const n = parseFloat(s);
      return isFinite(n) ? n : fallback;
    }

    /** Minutos de setup/produção: fração permitida (0,25 min = 15 s). */
    function parseTimeMinutes(value, fallback) {
      const n = parseFlexibleNumber(value, NaN);
      if (!isFinite(n) || n < 0) return fallback;
      return n;
    }

    function formatDurationMinutes(mins) {
      const n = Number(mins);
      if (!isFinite(n) || n <= 0) return '0m';
      if (n < 1) {
        const sec = Math.round(n * 60);
        return Math.max(1, sec) + 's';
      }
      const rounded = Math.round(n * 100) / 100;
      if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded)) + 'm';
      return String(rounded) + 'm';
    }

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
    let bomRuntimeParts = [];
    let currentJoinBuildingRoute = [];

    let simulationHistory = [];
    let rawEvents = [];
    let maintenanceEvents = [];
    let workDays = [];
    let boxesQty = 1;
    let startDateStr = '';
    let startTimeStr = DEFAULT_START_TIME;
    let startTimeOffsetMin = 0;
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
      currentJoinBuildingRoute = [];
      bomRuntimeParts = [];
      editingPartIndex = -1;
      editingMachineIndex = -1;
      editingEmployeeIndex = -1;
      editingGroupingIndex = -1;
      editingAssemblyIndex = -1;
      boxesQty = 1;
      startDateStr = todayISODate();
      startTimeStr = DEFAULT_START_TIME;
      startTimeOffsetMin = 0;
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

    const LUNCH_CLOCK_START = 12 * 60;
    const LUNCH_CLOCK_END = 13 * 60;

    function clockMinutesOf(dateObj) {
      return dateObj.getHours() * 60 + dateObj.getMinutes();
    }

    /**
     * Data/hora sugerida para projeto novo, a partir do relógio local.
     * Após 17:18 → próximo dia útil 07:30. Almoço 12:00–12:59 → 13:00.
     * Fim de semana/feriado → próximo dia útil (07:30 se o relógio não estiver no turno).
     */
    function suggestSmartStartDateTime(now) {
      const d = now instanceof Date ? now : new Date();
      let dateIso = toISODate(d);
      const clock = clockMinutesOf(d);
      let timeStr = pad2(d.getHours()) + ':' + pad2(d.getMinutes());

      if (clock >= SHIFT_END_MINUTES) {
        dateIso = nextWorkDay(addDays(dateIso, 1));
        timeStr = DEFAULT_START_TIME;
      } else if (clock >= LUNCH_CLOCK_START && clock < LUNCH_CLOCK_END) {
        timeStr = '13:00';
        dateIso = isWorkDay(dateIso) ? dateIso : nextWorkDay(dateIso);
      } else if (clock < SHIFT_START_MINUTES) {
        timeStr = DEFAULT_START_TIME;
        dateIso = isWorkDay(dateIso) ? dateIso : nextWorkDay(dateIso);
      } else if (!isWorkDay(dateIso)) {
        dateIso = nextWorkDay(dateIso);
        timeStr = DEFAULT_START_TIME;
      }

      const norm = normalizeStartTimeClock(timeStr);
      return { dateIso, timeStr: norm.clockStr };
    }

    function applySmartStartDateTime(now) {
      const sug = suggestSmartStartDateTime(now);
      startDateStr = sug.dateIso;
      const dateEl = document.getElementById('start-date');
      if (dateEl) dateEl.value = sug.dateIso;
      applyStartTimeToState(sug.timeStr);
      const simDate = document.getElementById('sim-start-date');
      if (simDate) simDate.value = sug.dateIso;
      return sug;
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
      return `${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}`;
    }

    function getSimulationStartAbsMin() {
      return Math.max(0, Number(startTimeOffsetMin) || 0);
    }

    function workDayIndexBetween(originIso, targetIso) {
      const origin = nextWorkDay(originIso || todayISODate());
      let target = String(targetIso || '').trim();
      if (!target) return 0;
      target = nextWorkDay(target);
      if (target <= origin) return 0;
      let idx = 0;
      let cur = origin;
      for (let i = 0; i < 400; i++) {
        if (cur === target) return idx;
        cur = addDays(cur, 1);
        if (isWorkDay(cur)) idx++;
      }
      return idx;
    }

    /** Converte data+hora de turno em minutos absolutos a partir da origem do plano/simulação. */
    function dateTimeToAbsMin(dateIso, timeStr, originDateIso, originTimeStr) {
      const originOff = normalizeStartTimeClock(originTimeStr || DEFAULT_START_TIME).offset;
      const idx = workDayIndexBetween(originDateIso || startDateStr || todayISODate(), dateIso);
      const off = normalizeStartTimeClock(timeStr || DEFAULT_START_TIME).offset;
      let abs = idx * MINUTES_PER_DAY + off;
      if (abs < originOff) abs = originOff;
      return abs;
    }

    function copyPlanRuntimeFields(from) {
      const src = from || {};
      return {
        planOrder: Number(src.planOrder) >= 0 ? Number(src.planOrder) : 0,
        notBeforeAbsMin: Number(src.notBeforeAbsMin) > 0 ? Number(src.notBeforeAbsMin) : 0,
        planChainMode: String(src.planChainMode || ''),
        planProjectName: String(src.planProjectName || ''),
        planItemId: String(src.planItemId || '')
      };
    }

    function isPlanSimulationMode() {
      return typeof simulationMode !== 'undefined' && simulationMode === 'plan';
    }

    /**
     * Ponto visual/playback do dia: Dia 1 no horário configurado;
     * Dia 2+ às 07:30 (início do turno).
     */
    function getDayPlaybackStartAbsMin(dayIndex) {
      const day = Math.max(0, Number(dayIndex) || 0);
      const offset = day === 0 ? getSimulationStartAbsMin() : 0;
      const abs = day * MINUTES_PER_DAY + offset;
      return Math.max(0, Math.min(getMaxAbsMinute(), abs));
    }

    function machineFreeAt(map, machineId) {
      if (map && map[machineId] != null) return map[machineId];
      return getSimulationStartAbsMin();
    }

    /**
     * Converte HH:MM do turno em offset de minutos produtivos a partir de 07:30.
     * 12:00–12:59 vai para 13:00. Fora da jornada, prende em 07:30 ou 17:18.
     */
    function normalizeStartTimeClock(hhmm) {
      let clock = parseClockToMinutes(hhmm || DEFAULT_START_TIME);
      if (clock < SHIFT_START_MINUTES) clock = SHIFT_START_MINUTES;
      if (clock > SHIFT_END_MINUTES) clock = SHIFT_END_MINUTES;
      let offset = clock - SHIFT_START_MINUTES;
      if (offset < 0) offset = 0;
      if (offset >= MINUTES_PER_DAY) offset = MINUTES_PER_DAY - 1;
      offset = snapToProductive(offset);
      if (offset >= MINUTES_PER_DAY) offset = MINUTES_PER_DAY - 1;
      return { offset, clockStr: minutesToClockStr(SHIFT_START_MINUTES + offset) };
    }

    function syncStartTimeInputs(clockStr) {
      const cfg = document.getElementById('start-time');
      const sim = document.getElementById('sim-start-time');
      if (cfg) cfg.value = clockStr;
      if (sim) sim.value = clockStr;
    }

    function getStartTimeFromInput() {
      const simEl = document.getElementById('sim-start-time');
      const cfgEl = document.getElementById('start-time');
      const simScreen = document.getElementById('screen-sim');
      const preferSim = simScreen && simScreen.classList.contains('active') && simEl;
      const src = preferSim ? simEl : (cfgEl || simEl);
      const raw = (src && src.value) || startTimeStr || DEFAULT_START_TIME;
      const norm = normalizeStartTimeClock(raw);
      startTimeOffsetMin = norm.offset;
      startTimeStr = norm.clockStr;
      syncStartTimeInputs(startTimeStr);
      return startTimeOffsetMin;
    }

    function applyStartTimeToState(hhmm) {
      const norm = normalizeStartTimeClock(hhmm || DEFAULT_START_TIME);
      startTimeOffsetMin = norm.offset;
      startTimeStr = norm.clockStr;
      syncStartTimeInputs(startTimeStr);
      return startTimeStr;
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
      const left = Math.max(0, productiveMinutesBetween(ref, untilAbsMin));
      return Math.round(left) + 'm';
    }

    function machineNameLooksEstufa(name) {
      return String(name || '').toUpperCase().indexOf('ESTUFA') >= 0;
    }

    function parseEstufaCycleMinutes(raw, fallback, minVal) {
      const n = parseTimeMinutes(raw, NaN);
      const floor = minVal == null ? 0 : minVal;
      if (!isFinite(n) || n < floor) return fallback;
      return n;
    }

    function getPrimaryEstufaMachine() {
      return (machines || []).find(m => m && (m.isEstufa || machineNameLooksEstufa(m.name))) || null;
    }

    function getEstufaMachineCycleDefaults(machine) {
      const m = machine || getPrimaryEstufaMachine();
      const queimaRaw = m && (m.tempo_queima_default != null ? m.tempo_queima_default : m.tempoQueimaDefault);
      const resfrioRaw = m && (m.tempo_resfriamento_default != null ? m.tempo_resfriamento_default : m.tempoResfriamentoDefault);
      return {
        queima: parseEstufaCycleMinutes(queimaRaw, ESTUFA_QUEIMA_MIN, 1),
        resfrio: parseEstufaCycleMinutes(resfrioRaw, ESTUFA_RESFRIO_MIN, 0)
      };
    }

    /** Prioridade: inputs da simulação → cadastro da máquina → 30/30. */
    function readSimEstufaCycleOverride() {
      const qEl = document.getElementById('sim_tempo_queima');
      const rEl = document.getElementById('sim_tempo_resfriamento');
      const qStr = qEl ? String(qEl.value).trim() : '';
      const rStr = rEl ? String(rEl.value).trim() : '';
      return {
        queima: qStr === '' ? null : parseEstufaCycleMinutes(qStr, NaN, 1),
        resfrio: rStr === '' ? null : parseEstufaCycleMinutes(rStr, NaN, 0)
      };
    }

    function resolveEstufaCycleMinutes(machine) {
      const defs = getEstufaMachineCycleDefaults(machine);
      const ov = readSimEstufaCycleOverride();
      return {
        queima: (ov.queima != null && isFinite(ov.queima)) ? ov.queima : defs.queima,
        resfrio: (ov.resfrio != null && isFinite(ov.resfrio)) ? ov.resfrio : defs.resfrio
      };
    }

    function dimValueToMm(raw) {
      const n = Number(raw);
      if (!isFinite(n) || n <= 0) return 0;
      return n < 10 ? n * 1000 : n;
    }

    function pickPartDimMm(src, mmKey, mKey, legacyKey) {
      src = src || {};
      const mm = Number(src[mmKey]);
      if (isFinite(mm) && mm > 0) return dimValueToMm(mm);
      const mNew = Number(src[mKey]);
      if (isFinite(mNew) && mNew > 0) return dimValueToMm(mNew);
      const mOld = Number(src[legacyKey]);
      if (isFinite(mOld) && mOld > 0) return dimValueToMm(mOld);
      return 0;
    }

    function formatVolumeM3(n) {
      const v = Number(n);
      if (!isFinite(v) || !(v > 0)) return '0';
      const t = (v < 0.01)
        ? v.toFixed(4)
        : v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
      return String(t).replace('.', ',');
    }

    function normalizePartDims(src) {
      src = src || {};
      const hMm = pickPartDimMm(src, 'peca_altura_mm', 'peca_altura_m', 'altura_m');
      const wMm = pickPartDimMm(src, 'peca_largura_mm', 'peca_largura_m', 'largura_m');
      const dMm = pickPartDimMm(src, 'peca_comprimento_mm', 'peca_comprimento_m', 'comprimento_m');
      const maxNew = Number(src.peca_max_fardo);
      const maxOld = Number(src.pecas_por_fardo);
      let maxFardo = 1;
      if (isFinite(maxNew) && maxNew >= 1) maxFardo = Math.round(maxNew);
      else if (isFinite(maxOld) && maxOld >= 1) maxFardo = Math.round(maxOld);
      const gapRaw = Number(src.peca_espacamento_mm);
      const gapMm = (isFinite(gapRaw) && gapRaw >= 0) ? gapRaw : 0;
      const altura_m = hMm / 1000;
      const largura_m = wMm / 1000;
      const comprimento_m = dMm / 1000;
      const espacamento_m = gapMm / 1000;
      const hEff = altura_m > 0 ? altura_m + espacamento_m : 0;
      const wEff = largura_m > 0 ? largura_m + espacamento_m : 0;
      const dEff = comprimento_m > 0 ? comprimento_m + espacamento_m : 0;
      const volume_peca_m3 = hEff * wEff * dEff;
      const volume_fardo_m3 = volume_peca_m3 * maxFardo;
      return {
        peca_altura_mm: hMm,
        peca_largura_mm: wMm,
        peca_comprimento_mm: dMm,
        peca_altura_m: altura_m,
        peca_largura_m: largura_m,
        peca_comprimento_m: comprimento_m,
        peca_max_fardo: maxFardo,
        peca_espacamento_mm: gapMm,
        altura_m,
        largura_m,
        comprimento_m,
        pecas_por_fardo: maxFardo,
        altura_efetiva: hEff,
        largura_efetiva: wEff,
        comprimento_efetivo: dEff,
        volume_peca_m3,
        volume_unitario_com_folga: volume_peca_m3,
        volume_fardo_m3,
        volume_fardo: volume_fardo_m3
      };
    }

    function hasPhysicalPartDims(dims) {
      return !!(dims && dims.peca_altura_mm > 0 && dims.peca_largura_mm > 0 && dims.peca_comprimento_mm > 0);
    }

    function fardoBoxDims(spec) {
      return {
        h: Number(spec && spec.altura_efetiva) || Number(spec && spec.peca_altura_m) || 0,
        w: Number(spec && spec.largura_efetiva) || Number(spec && spec.peca_largura_m) || 0,
        d: Number(spec && spec.comprimento_efetivo) || Number(spec && spec.peca_comprimento_m) || 0
      };
    }

    function unitFardoOccupancyVolume(unit, cabin) {
      const spec = (unit && unit.spec) || {};
      const cabinVol = (cabin && cabin.volume) || ESTUFA_CABIN_VOLUME;
      if (spec.missingDims) return cabinVol;
      const vu = Number(spec.volume_unitario_com_folga) || 0;
      if (!(vu > 0)) return cabinVol;
      const pieces = Number(unit && unit.pieces) > 0 ? Number(unit.pieces) : (spec.peca_max_fardo || spec.pecas_por_fardo || 1);
      return vu * pieces;
    }

    function normalizeMachine(m) {
      if (!m || typeof m !== 'object') {
        return {
          id: '',
          name: '',
          pop: '',
          maintIntervalHours: 0,
          maintDurationHours: 0,
          defaultOperatorId: '',
          lastMaintenanceDate: '',
          nextMaintenanceDate: '',
          isEstufa: false,
          estufaAlturaM: 0,
          estufaLarguraM: 0,
          estufaProfundidadeM: 0,
          tempo_queima_default: ESTUFA_QUEIMA_MIN,
          tempo_resfriamento_default: ESTUFA_RESFRIO_MIN
        };
      }
      const isEstufa = m.isEstufa === true || m.isEstufa === 'true' || machineNameLooksEstufa(m.name);
      const h = Number(m.estufaAlturaM);
      const w = Number(m.estufaLarguraM);
      const d = Number(m.estufaProfundidadeM);
      const queimaRaw = m.tempo_queima_default != null ? m.tempo_queima_default : m.tempoQueimaDefault;
      const resfrioRaw = m.tempo_resfriamento_default != null ? m.tempo_resfriamento_default : m.tempoResfriamentoDefault;
      return {
        ...m,
        maintIntervalHours: Number(m.maintIntervalHours) || 0,
        maintDurationHours: Number(m.maintDurationHours) || 0,
        defaultOperatorId: m.defaultOperatorId || '',
        lastMaintenanceDate: m.lastMaintenanceDate || '',
        nextMaintenanceDate: m.nextMaintenanceDate || '',
        isEstufa: !!isEstufa,
        estufaAlturaM: isEstufa ? ((isFinite(h) && h > 0) ? h : ESTUFA_CABIN_H) : ((isFinite(h) && h > 0) ? h : 0),
        estufaLarguraM: isEstufa ? ((isFinite(w) && w > 0) ? w : ESTUFA_CABIN_W) : ((isFinite(w) && w > 0) ? w : 0),
        estufaProfundidadeM: isEstufa ? ((isFinite(d) && d > 0) ? d : ESTUFA_CABIN_D) : ((isFinite(d) && d > 0) ? d : 0),
        tempo_queima_default: parseEstufaCycleMinutes(queimaRaw, ESTUFA_QUEIMA_MIN, 1),
        tempo_resfriamento_default: parseEstufaCycleMinutes(resfrioRaw, ESTUFA_RESFRIO_MIN, 0)
      };
    }

    function estufaCabinVolume(m) {
      const n = normalizeMachine(m || {});
      if (!n.isEstufa) return 0;
      return (Number(n.estufaAlturaM) || 0) * (Number(n.estufaLarguraM) || 0) * (Number(n.estufaProfundidadeM) || 0);
    }

    function normalizeEmployee(e) {
      if (!e || typeof e !== 'object') {
        return { id: '', name: '', matricula: '', setor: '', postoId: '' };
      }
      return {
        id: e.id || '',
        name: e.name || '',
        matricula: e.matricula || '',
        setor: e.setor || e.setorNome || '',
        postoId: e.postoId || e.defaultMachineId || e.machineId || ''
      };
    }

    function defaultShiftRows() {
      return [{
        id: 'turno_padrao',
        nome: 'Turno diurno',
        inicio: '07:30',
        fim: '17:18',
        almocoInicio: '12:00',
        almocoFim: '13:00',
        minutosDia: MINUTES_PER_DAY,
        ativo: true
      }];
    }

    function normalizeShiftRow(row) {
      const base = defaultShiftRows()[0];
      if (!row || typeof row !== 'object') return cloneShiftDefaults(base);
      return {
        id: row.id || base.id,
        nome: row.nome || base.nome,
        inicio: row.inicio || base.inicio,
        fim: row.fim || base.fim,
        almocoInicio: row.almocoInicio || base.almocoInicio,
        almocoFim: row.almocoFim || base.almocoFim,
        minutosDia: Number(row.minutosDia) > 0 ? Number(row.minutosDia) : base.minutosDia,
        ativo: row.ativo !== false
      };
    }

    function cloneShiftDefaults(base) {
      return {
        id: base.id,
        nome: base.nome,
        inicio: base.inicio,
        fim: base.fim,
        almocoInicio: base.almocoInicio,
        almocoFim: base.almocoFim,
        minutosDia: base.minutosDia,
        ativo: base.ativo
      };
    }

    function normalizeAllMachines() {
      machines = machines.map(normalizeMachine);
    }

    function normalizeRouteStep(step) {
      if (!step || typeof step !== 'object') return step;
      const out = {
        machineId: step.machineId,
        setup: parseTimeMinutes(step.setup, 0),
        prodUnit: parseTimeMinutes(step.prodUnit, 1)
      };
      if (step.juncao && typeof step.juncao === 'object') {
        const requer = Array.isArray(step.juncao.requer)
          ? step.juncao.requer.map(n => String(n).toUpperCase())
          : [];
        out.juncao = {
          requer,
          maquina: step.juncao.maquina || step.machineId || ''
        };
      }
      return out;
    }

    function normalizePart(p) {
      if (!p || typeof p !== 'object') {
        return Object.assign({ name: '', thickness: 0, qty: 1, route: [] }, normalizePartDims(null));
      }
      return Object.assign({}, p, {
        name: p.name || '',
        thickness: Number(p.thickness) || 0,
        qty: Number(p.qty) > 0 ? Number(p.qty) : 1,
        route: Array.isArray(p.route) ? p.route.map(normalizeRouteStep) : []
      }, normalizePartDims(p), copyPlanRuntimeFields(p));
    }

    function normalizeAssemblyRule(rule) {
      if (!rule || typeof rule !== 'object') {
        return Object.assign({
          machineId: '', resultName: '', requiredPartNames: [], juncao: { requer: [], maquina: '' },
          setup: 1, prodUnit: 1, qty: 1, route: []
        }, normalizePartDims(null));
      }
      const requerRaw = Array.isArray(rule.requiredPartNames)
        ? rule.requiredPartNames
        : (rule.juncao && Array.isArray(rule.juncao.requer) ? rule.juncao.requer : []);
      const resultName = String(rule.resultName || '').toUpperCase();
      const requer = requerRaw.map(n => String(n || '').toUpperCase()).filter(Boolean)
        .filter(n => {
          if (n === resultName) {
            console.warn('[JOIN] Cadastro circular: o SKU "' + resultName + '" não pode requerer a si mesmo. Insumo ignorado.');
            return false;
          }
          return true;
        })
        .filter((n, i, arr) => arr.indexOf(n) === i);
      const machineId = rule.machineId || (rule.juncao && rule.juncao.maquina) || '';
      return Object.assign(copyPlanRuntimeFields(rule), {
        machineId,
        resultName,
        requiredPartNames: requer,
        juncao: { requer, maquina: machineId },
        setup: parseTimeMinutes(rule.setup, 0),
        prodUnit: parseTimeMinutes(rule.prodUnit, 0),
        qty: Number(rule.qty) > 0 ? Number(rule.qty) : 1,
        route: Array.isArray(rule.route) ? rule.route.map(normalizeRouteStep) : []
      }, normalizePartDims(rule));
    }

    function normalizeAllAssemblyRules() {
      assemblyRules = (assemblyRules || []).map(normalizeAssemblyRule);
    }

    function getSimParts() {
      return (bomRuntimeParts && bomRuntimeParts.length) ? bomRuntimeParts : parts;
    }

    function findSimPart(name, list) {
      const target = String(name || '');
      const targetU = target.toUpperCase();
      return (list || getSimParts()).find(p => p.name === name || String(p.name || '').toUpperCase() === targetU) || null;
    }

    const PLAN_SKU_PALETTE = [
      { prod: '#3b82f6', setup: '#93c5fd', rgbProd: [59, 130, 246], rgbSetup: [147, 197, 253], label: 'Azul' },
      { prod: '#22c55e', setup: '#86efac', rgbProd: [34, 197, 94], rgbSetup: [134, 239, 172], label: 'Verde' },
      { prod: '#f97316', setup: '#fdba74', rgbProd: [249, 115, 22], rgbSetup: [253, 186, 116], label: 'Laranja' },
      { prod: '#a855f7', setup: '#d8b4fe', rgbProd: [168, 85, 247], rgbSetup: [216, 180, 254], label: 'Violeta' },
      { prod: '#06b6d4', setup: '#67e8f9', rgbProd: [6, 182, 212], rgbSetup: [103, 232, 249], label: 'Ciano' },
      { prod: '#ec4899', setup: '#f9a8d4', rgbProd: [236, 72, 153], rgbSetup: [249, 168, 212], label: 'Rosa' },
      { prod: '#eab308', setup: '#fde047', rgbProd: [234, 179, 8], rgbSetup: [253, 224, 71], label: 'Âmbar' },
      { prod: '#6366f1', setup: '#a5b4fc', rgbProd: [99, 102, 241], rgbSetup: [165, 180, 252], label: 'Índigo' }
    ];

    function getPlanSkuLegendItems() {
      const queue = (typeof currentPlanQueueMeta !== 'undefined' && Array.isArray(currentPlanQueueMeta))
        ? currentPlanQueueMeta
        : [];
      return queue.map((item, i) => Object.assign({
        id: item.id,
        name: item.projectName,
        order: i,
        boxesQty: item.boxesQty
      }, PLAN_SKU_PALETTE[i % PLAN_SKU_PALETTE.length]));
    }

    function getPlanSkuPaletteFor(blockOrEvent) {
      if (!blockOrEvent) return null;
      const items = getPlanSkuLegendItems();
      if (!items.length) return null;
      const id = String(blockOrEvent.planItemId || '');
      const name = String(blockOrEvent.planProjectName || '');
      const byId = id && items.find(it => it.id === id);
      if (byId) return byId;
      const byName = name && items.find(it => it.name === name);
      if (byName) return byName;
      const order = Number(blockOrEvent.planOrder);
      if (!isNaN(order) && order >= 0 && items[order]) return items[order];
      return null;
    }

    function ganttBlockFill(block) {
      if (block && block.kind === 'wait') {
        return { css: '#64748b', rgb: [100, 116, 139] };
      }
      if (block && block.kind === 'maint') {
        return { css: '#a855f7', rgb: [168, 85, 247] };
      }
      if (block && block.kind === 'estufa') {
        return { css: '#ef4444', rgb: [239, 68, 68] };
      }
      if (block && block.kind === 'cooling') {
        return { css: '#38bdf8', rgb: [56, 189, 248] };
      }
      if (block && block.kind === 'unload') {
        if (isPlanSimulationMode()) {
          const palUnload = getPlanSkuPaletteFor(block);
          if (palUnload) return { css: palUnload.prod, rgb: palUnload.rgbProd };
        }
        return { css: '#22c55e', rgb: [34, 197, 94] };
      }
      if (isPlanSimulationMode()) {
        const pal = getPlanSkuPaletteFor(block);
        if (pal) {
          if (block.kind === 'setup') return { css: pal.setup, rgb: pal.rgbSetup };
          return { css: pal.prod, rgb: pal.rgbProd };
        }
      }
      if (block && block.kind === 'setup') return { css: '#f97316', rgb: [249, 115, 22] };
      if (block && block.kind === 'prod') return { css: '#22c55e', rgb: [34, 197, 94] };
      return { css: '#64748b', rgb: [100, 116, 139] };
    }

    function namesEqual(a, b) {
      return String(a || '').toUpperCase() === String(b || '').toUpperCase();
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

    function firstMachineStepIndex(route, machineId) {
      return (route || []).findIndex(s => s && s.machineId === machineId);
    }

    function readyMapKey(partName, machineId, stepIndex) {
      if (typeof stepIndex === 'number' && stepIndex >= 0) {
        return String(partName) + '_' + machineId + '_' + stepIndex;
      }
      return String(partName) + '_' + machineId;
    }

    function logPartStepTransition(part, completedStepIndex, completedStep, nextIdx, nextStepIndexMap) {
      if (!part || part.isVirtual) return;
      const route = part.route || [];
      const total = route.length;
      if (!total) return;
      const doneN = completedStepIndex + 1;
      const doneName = machineNameOf(completedStep && completedStep.machineId) || (completedStep && completedStep.machineId) || '?';
      if (nextIdx >= total) {
        const joinRule = (assemblyRules || []).find(r => joinRequerOf(r).some(n => namesEqual(n, part.name)));
        const joinM = joinRule ? (machineNameOf(joinRule.machineId) || joinRule.machineId) : '';
        const extra = joinM
          ? ' -> Aguardando união em ' + joinM
          : ' -> roteiro individual concluído';
        console.log('[SIMULAÇÃO] ' + part.name + ': Concluiu ' + doneName + ' (' + doneN + '/' + total + ')' + extra);
        if (joinRule && nextStepIndexMap) {
          const pending = describeJoinPendingInputs(joinRule, nextStepIndexMap);
          if (!pending.length) {
            console.log('[JOIN] Máquina ' + joinM + ' liberada: ' + part.name +
              ' concluiu ' + doneName + ' (' + doneN + '/' + total + '). Insumos prontos: ' +
              (joinRequerOf(joinRule).join(' + ') || '—') + '.');
          }
        }
        return;
      }
      const next = route[nextIdx];
      const nextName = machineNameOf(next && next.machineId) || (next && next.machineId) || '?';
      console.log('[SIMULAÇÃO] ' + part.name + ': Concluiu ' + doneName + ' (' + doneN + '/' + total +
        ') -> Entrou na fila ' + nextName + ' (' + (nextIdx + 1) + '/' + total + ')');
    }

    function findSourcePartByName(name, list) {
      const target = String(name || '').toUpperCase();
      return (list || []).find(p => p && String(p.name || p.resultName || '').toUpperCase() === target) || null;
    }

    function originalIndividualRoute(partName) {
      const src = findSourcePartByName(partName, parts);
      if (!src) return [];
      return (src.route || []).map(normalizeRouteStep).filter(s => s && s.machineId && !isJoinStep(s));
    }

    function expectedIndividualRoute(partName) {
      const orig = originalIndividualRoute(partName);
      if (orig.length <= 1) return orig;
      const last = orig[orig.length - 1];
      const joinOnLast = (assemblyRules || []).find(r =>
        r && r.machineId === last.machineId &&
        joinRequerOf(r).some(n => namesEqual(n, partName)) &&
        isSharedJoinMeetingPoint(r, parts)
      );
      return joinOnLast ? orig.slice(0, -1) : orig;
    }

    function lookupReadyTime(readyMap, name) {
      if (!readyMap || name == null) return null;
      if (readyMap[name] != null) return readyMap[name];
      const key = Object.keys(readyMap).find(k => namesEqual(k, name));
      return key != null ? readyMap[key] : null;
    }

    function otherJoinMachineIds(exceptRule) {
      const ids = {};
      (assemblyRules || []).forEach(r => {
        if (!r || !r.machineId) return;
        if (exceptRule && r.resultName === exceptRule.resultName && r.machineId === exceptRule.machineId) return;
        ids[r.machineId] = true;
      });
      return ids;
    }

    function inferJoinTimesAndRoute(rule, srcParts) {
      const times = { setup: parseTimeMinutes(rule.setup, 0), prodUnit: parseTimeMinutes(rule.prodUnit, 0) };
      const inferredRoute = Array.isArray(rule.route) ? rule.route.slice() : [];
      const stopMachines = otherJoinMachineIds(rule);
      (srcParts || parts).forEach(p => {
        if (!(rule.requiredPartNames || []).some(n => namesEqual(n, p.name))) return;
        const idx = (p.route || []).findIndex(s => s.machineId === rule.machineId);
        if (idx < 0) return;
        const step = p.route[idx];
        if (!times.setup) times.setup = parseTimeMinutes(step.setup, 0);
        if (!times.prodUnit) times.prodUnit = parseTimeMinutes(step.prodUnit, 0);
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

    function knownBomFinishingRoute(rule) {
      const name = rule && rule.resultName ? String(rule.resultName).toUpperCase() : '';
      if (name === 'CORPO COMPLETO') return machineStepsByNameIncludes(['BANHO', 'CABINE', 'ESTUFA']);
      if (name === 'DAE JUNDIAI' || name === 'DAE JUNDIAÍ') {
        return machineStepsByNameIncludes(['EMBALAGEM', 'EXPEDI']);
      }
      return [];
    }

    function machineNameOf(id) {
      const m = (machines || []).find(x => x.id === id);
      return m && m.name ? String(m.name).toUpperCase() : '';
    }

    function routeHasMachineName(route, needle) {
      return (route || []).some(s => machineNameOf(s.machineId).indexOf(needle) >= 0);
    }

    /**
     * Roteiro individual não pode ser truncado só porque outro SKU usa a mesma máquina.
     * TAMPA, após a IMAG, ainda precisa de BANHO → CABINE → ESTUFA.
     */
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

    function ownNonJoinEvents(partName) {
      return (rawEvents || []).filter(e => namesEqual(e.partName, partName) && !e.isJoin);
    }

    function hasUnfinishedOriginalIndividualWork(partName, absMin) {
      const orig = expectedIndividualRoute(partName);
      if (!orig.length) return false;
      const ownEvents = ownNonJoinEvents(partName);
      if (!ownEvents.length) return true;
      const lastOwn = ownEvents[ownEvents.length - 1];
      if (absMin < lastOwn.end) return true;
      return ownEvents.length < orig.length;
    }

    function hasRemainingIndividualSteps(part, partEvents, absMin) {
      if (part && !part.isVirtual && hasUnfinishedOriginalIndividualWork(part.name, absMin)) return true;
      const routeLen = part && Array.isArray(part.route) ? part.route.length : 0;
      if (routeLen <= 1) {
        const lastEvt = partEvents && partEvents.length ? partEvents[partEvents.length - 1] : null;
        if (!lastEvt) return routeLen > 0;
        return absMin < lastEvt.end;
      }
      const lastEvt = partEvents && partEvents.length ? partEvents[partEvents.length - 1] : null;
      if (!lastEvt) return routeLen > 0;
      if (absMin < lastEvt.end) return true;
      const etapaAtual = typeof lastEvt.stepIndex === 'number' ? lastEvt.stepIndex : (partEvents.length - 1);
      return etapaAtual < routeLen - 1;
    }

    function pendingJoinWaitForPart(partName, absMin) {
      if (hasUnfinishedOriginalIndividualWork(partName, absMin)) return false;
      const part = findSimPart(partName);
      if (part && part.isVirtual) return false;
      const routeLen = part && Array.isArray(part.route) ? part.route.length : 0;
      const ownEvents = ownNonJoinEvents(partName);
      if (routeLen > 0) {
        const lastOwn = ownEvents.length ? ownEvents[ownEvents.length - 1] : null;
        if (!lastOwn || absMin < lastOwn.end) return false;
        const etapaAtual = typeof lastOwn.stepIndex === 'number' ? lastOwn.stepIndex + 1 : ownEvents.length;
        if (etapaAtual < routeLen) return false;
      } else if (expectedIndividualRoute(partName).length > 0 && ownEvents.length === 0) {
        return false;
      }
      return (assemblyRules || []).some(rule => {
        const requer = joinRequerOf(rule);
        if (!requer.some(n => namesEqual(n, partName))) return false;
        const joinEvt = (rawEvents || []).find(e => e.isJoin && namesEqual(e.partName, rule.resultName));
        if (!joinEvt) return true;
        return absMin < joinEvt.setupStart;
      });
    }

    /** JOIN clássico: dois ou mais insumos já têm a máquina da união no roteiro. */
    function countInputsWithJoinMachine(rule, srcParts) {
      const requer = (rule && rule.requiredPartNames) || [];
      let n = 0;
      requer.forEach(name => {
        const p = findSourcePartByName(name, srcParts || []);
        if (p && (p.route || []).some(s => s && s.machineId === rule.machineId && !isJoinStep(s))) n++;
      });
      return n;
    }

    function isSharedJoinMeetingPoint(rule, srcParts) {
      return countInputsWithJoinMachine(rule, srcParts) >= 2;
    }

    function machineStepsByNameIncludes(needles) {
      const steps = [];
      const seen = {};
      (machines || []).forEach(m => {
        if (!m || !m.name || !m.id || seen[m.id]) return;
        const upper = String(m.name).toUpperCase();
        if (needles.some(n => upper.indexOf(n) >= 0)) {
          seen[m.id] = true;
          steps.push({ machineId: m.id, setup: 1, prodUnit: 1 });
        }
      });
      return steps;
    }

    function buildBomRuntimeParts() {
      normalizeAllAssemblyRules();
      const expandedRules = (assemblyRules || []).map(rule => {
        const inferred = inferJoinTimesAndRoute(rule, parts);
        return {
          ...rule,
          setup: rule.setup || inferred.setup,
          prodUnit: rule.prodUnit || inferred.prodUnit,
          route: (rule.route && rule.route.length) ? rule.route : inferred.route
        };
      });
      assemblyRules = expandedRules;

      const claimedJoinMachines = {};
      expandedRules.forEach(rule => {
        if (rule && rule.machineId) claimedJoinMachines[rule.machineId] = true;
      });

      const physical = (parts || []).map(p => {
        const consumeMatches = expandedRules.filter(r =>
          (r.requiredPartNames || []).some(n => namesEqual(n, p.name))
        );
        let consumeAt = null;
        let consumeIdx = -1;
        consumeMatches.forEach(r => {
          const idx = (p.route || []).findIndex(s => s && s.machineId === r.machineId && !isJoinStep(s));
          if (idx > consumeIdx) {
            consumeIdx = idx;
            consumeAt = r;
          }
        });
        if (!consumeAt && consumeMatches.length) consumeAt = consumeMatches[consumeMatches.length - 1];
        let route = (p.route || []).map(normalizeRouteStep)
          .filter(s => s && s.machineId && !isJoinStep(s));
        if (consumeAt) {
          const cut = route.findIndex(s => s.machineId === consumeAt.machineId);
          if (cut >= 0) {
            // JOIN só substitui a ÚLTIMA operação se ela for o ponto de encontro.
            // Nunca corta CORTE / SOLDA / EMBALAGEM no meio do roteiro individual.
            const isLastOp = cut === route.length - 1;
            if (isLastOp && isSharedJoinMeetingPoint(consumeAt, parts)) {
              const kept = route.slice(0, cut);
              if (kept.length > 0) route = kept;
              // Única etapa = máquina do JOIN (ex: MADEIRITE): manter produção individual.
            }
          }
        }
        route = ensureIndividualRouteAfterLastOp(p, route, claimedJoinMachines);
        return Object.assign({
          name: p.name,
          thickness: p.thickness,
          qty: p.qty,
          route,
          isVirtual: false
        }, normalizePartDims(p), copyPlanRuntimeFields(p));
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
        const ownDims = normalizePartDims(rule);
        const dims = hasPhysicalPartDims(ownDims)
          ? ownDims
          : (inheritFardoDimsFromBom({ name: rule.resultName }) || ownDims);
        return Object.assign({
          name: rule.resultName,
          thickness: 0,
          qty: rule.qty || 1,
          route: [joinStep].concat(rule.route || []),
          isVirtual: true
        }, dims, copyPlanRuntimeFields(rule));
      });

      bomRuntimeParts = physical.concat(virtual);
      return bomRuntimeParts;
    }

    function entityRouteDone(name, nextStepIndex, list) {
      const ent = findSimPart(name, list);
      const idxMap = nextStepIndex || {};
      if (!ent) {
        const orig = expectedIndividualRoute(name);
        const progressed = idxMap[name] != null ? idxMap[name] : 0;
        if (orig.length > 0) return Number(progressed) >= orig.length;
        return false;
      }
      const len = Array.isArray(ent.route) ? ent.route.length : 0;
      const progressed = idxMap[ent.name] != null ? idxMap[ent.name] : (idxMap[name] != null ? idxMap[name] : 0);
      if (len === 0) {
        const orig = expectedIndividualRoute(name);
        if (orig.length > 0) return Number(progressed) >= orig.length;
        return true;
      }
      return progressed >= len;
    }

    function joinInputsCompleted(requer, nextStepIndex, list) {
      if (!requer || requer.length === 0) return true;
      return requer.every(name => entityRouteDone(name, nextStepIndex, list));
    }

    function joinAvailableAt(requer, partReady) {
      let t = getSimulationStartAbsMin();
      (requer || []).forEach(name => {
        const end = lookupReadyTime(partReady, name);
        const ready = end != null ? end : getSimulationStartAbsMin();
        if (ready > t) t = ready;
      });
      return t;
    }

    function describeJoinPendingInputs(rule, nextStepIndex) {
      const pending = [];
      joinRequerOf(rule).forEach(n => {
        if (entityRouteDone(n, nextStepIndex || {}, getSimParts())) return;
        const ent = findSimPart(n);
        const orig = originalIndividualRoute(n);
        const total = (ent && ent.route && ent.route.length) ? ent.route.length : orig.length;
        const idx = ent && nextStepIndex
          ? (nextStepIndex[ent.name] != null ? nextStepIndex[ent.name] : (nextStepIndex[n] || 0))
          : 0;
        const step = ent && ent.route ? ent.route[idx] : orig[idx];
        const setor = step ? machineNameOf(step.machineId) : '—';
        pending.push(n + ' (etapa ' + idx + '/' + total + (setor && setor !== '—' ? ' em ' + setor : '') + ')');
      });
      return pending;
    }

    function logJoinCadastroDiagnostics() {
      const rules = assemblyRules || [];
      if (!rules.length) return;
      const bySku = {};
      rules.forEach(r => {
        if (!r || !r.resultName) return;
        bySku[String(r.resultName).toUpperCase()] = joinRequerOf(r).map(n => String(n).toUpperCase());
      });
      const cycles = [];
      function visit(node, stack) {
        const pos = stack.indexOf(node);
        if (pos >= 0) {
          cycles.push(stack.slice(pos).concat(node).join(' → '));
          return;
        }
        const deps = bySku[node];
        if (!deps) return;
        const next = stack.concat(node);
        deps.forEach(d => { if (bySku[d]) visit(d, next); });
      }
      Object.keys(bySku).forEach(n => visit(n, []));
      const uniqueCycles = cycles.filter((c, i) => cycles.indexOf(c) === i);
      if (uniqueCycles.length) {
        console.warn('[JOIN] Vínculo circular no BOM: ' + uniqueCycles.join(' | '));
      }
      rules.forEach(rule => {
        const machineName = machineNameOf(rule.machineId) || rule.machineId || '?';
        const missing = [];
        const cross = [];
        joinRequerOf(rule).forEach(n => {
          const physical = findSourcePartByName(n, parts);
          const sku = bySku[String(n).toUpperCase()];
          if (!physical && !sku) missing.push(n);
          const other = rules.find(r =>
            r && !namesEqual(r.resultName, rule.resultName) &&
            joinRequerOf(r).some(x => namesEqual(x, n)) &&
            !namesEqual(r.resultName, n)
          );
          if (other && physical) cross.push(n + ' também entra em ' + other.resultName);
        });
        if (missing.length) {
          console.warn('[JOIN] SKU "' + rule.resultName + '" na ' + machineName + ' requer insumos inexistentes: ' + missing.join(', ') + '.');
        }
        if (cross.length) {
          console.log('[JOIN] SKU "' + rule.resultName + '" na ' + machineName + ': ' + cross.join('; ') + '.');
        }
      });
    }

    function logJoinWaitDiagnostics(nextStepIndex, events) {
      (assemblyRules || []).forEach(rule => {
        const machineName = machineNameOf(rule.machineId) || rule.machineId || '?';
        const requer = joinRequerOf(rule);
        const pending = describeJoinPendingInputs(rule, nextStepIndex);
        const joinEvt = (events || []).find(e => e.isJoin && namesEqual(e.partName, rule.resultName));
        if (pending.length) {
          console.log('[JOIN] Peça/SKU "' + rule.resultName + '" na máquina ' + machineName +
            ' aguarda insumos: ' + pending.join('; ') + '.');
        } else if (joinEvt) {
          console.log('[JOIN] SKU "' + rule.resultName + '" na ' + machineName +
            ' liberado após ' + (requer.join(' + ') || '—') + '.');
        } else {
          console.log('[JOIN] SKU "' + rule.resultName + '" na ' + machineName +
            ' pronto (insumos ' + (requer.join(' + ') || '—') + '), mas a união não foi programada.');
        }
      });
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
        (a.route || []).forEach(step => {
          if (step && step.machineId) ids[step.machineId] = true;
        });
        if (a.juncao && a.juncao.maquina) ids[a.juncao.maquina] = true;
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
      const inProject = (employees || []).find(e => e.id === id);
      if (inProject) return inProject;
      if (typeof getCatalogEmployees === 'function') {
        return getCatalogEmployees().find(e => e.id === id) || null;
      }
      return null;
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

    function emptyEfficiencyTotals() {
      return { setup: 0, working: 0, waiting: 0, lunch: 0, idle: 0, maintenance: 0 };
    }

    function countMachineState(totals, state) {
      if (state === 'cooling' || state === 'unload' || state === 'queima') state = 'working';
      if (totals[state] != null) totals[state]++;
      else totals.idle++;
    }

    /** "420 min (7h00m)" */
    function formatMinutesWithHours(mins) {
      const raw = Number(mins) || 0;
      if (raw > 0 && raw < 1) return formatDurationMinutes(raw);
      const n = Math.max(0, Math.round(raw));
      const h = Math.floor(n / 60);
      const m = n % 60;
      return `${n} min (${h}h${pad2(m)}m)`;
    }

    function getProjectMakespanEndAbsMin() {
      let maxEnd = 0;
      (rawEvents || []).forEach(e => { if (e.end > maxEnd) maxEnd = e.end; });
      (maintenanceEvents || []).forEach(e => { if (e.end > maxEnd) maxEnd = e.end; });
      return maxEnd;
    }

    function machineStateAt(absMin, machineId) {
      const snap = simulationHistory[absMin];
      if (!snap || !snap.machinesStatus || !snap.machinesStatus[machineId]) return 'idle';
      return snap.machinesStatus[machineId].state || 'idle';
    }

    function computeOperatorHourRows(perMachine, histStart, histEnd) {
      const rank = { working: 5, setup: 4, waiting: 3, maintenance: 2, cooling: 5, unload: 5, queima: 5, lunch: 1, idle: 0 };
      const rows = [];
      const assignedIds = {};

      (employees || []).forEach(emp => {
        const mlist = perMachine.filter(pm => pm.operatorId === emp.id);
        if (mlist.length === 0) return;
        mlist.forEach(pm => { assignedIds[pm.id] = true; });
        rows.push({ emp, mlist, unassigned: false });
      });

      const orphan = perMachine.filter(pm => !assignedIds[pm.id]);
      if (orphan.length > 0) {
        rows.push({
          emp: { name: 'Sem operador', matricula: '' },
          mlist: orphan,
          unassigned: true
        });
      }

      return rows.map(group => {
        let production = 0, setup = 0, inactive = 0;
        for (let absMin = histStart; absMin < histEnd; absMin++) {
          let best = 'idle';
          let bestRank = 0;
          group.mlist.forEach(pm => {
            const st = machineStateAt(absMin, pm.id);
            const r = rank[st] != null ? rank[st] : 0;
            if (r > bestRank) {
              bestRank = r;
              best = st;
            }
          });
          if (best === 'working' || best === 'cooling' || best === 'unload' || best === 'queima') production++;
          else if (best === 'setup') setup++;
          else if (best !== 'lunch') inactive++;
        }

        let principal = group.mlist[0];
        group.mlist.forEach(pm => {
          if (!principal || pm.occupied > principal.occupied ||
              (pm.occupied === principal.occupied && pm.wait > principal.wait)) {
            principal = pm;
          }
        });

        return {
          operator: group.unassigned ? 'Sem operador' : formatEmployeeLabel(group.emp),
          principalMachine: principal ? principal.name : '—',
          production,
          setup,
          inactive,
          worked: production + setup
        };
      });
    }

    /**
     * Indicadores do lote a partir do histórico do motor (caixas, hora inicial, almoço).
     * Janela: início configurado → término do último evento (sem ocioso residual do dia).
     */
    function computeEfficiencyAnalytics() {
      const machinesList = getActiveMachines();
      const startAbs = getSimulationStartAbsMin();
      const endAbs = getProjectMakespanEndAbsMin();
      const histStart = Math.max(0, Math.min(startAbs, simulationHistory.length));
      const histEnd = Math.max(histStart, Math.min(simulationHistory.length, endAbs));

      const global = emptyEfficiencyTotals();
      const perMachine = machinesList.map(m => {
        const totals = emptyEfficiencyTotals();
        for (let absMin = histStart; absMin < histEnd; absMin++) {
          countMachineState(totals, machineStateAt(absMin, m.id));
        }
        global.setup += totals.setup;
        global.working += totals.working;
        global.waiting += totals.waiting;
        global.lunch += totals.lunch;
        global.idle += totals.idle;
        global.maintenance += totals.maintenance;
        return {
          id: m.id,
          name: m.name,
          operatorId: m.defaultOperatorId || '',
          totals,
          occupied: totals.setup + totals.working,
          wait: totals.waiting
        };
      });

      const productive = global.working;
      const occupied = global.working + global.setup;
      const efficiencyPct = occupied > 0 ? (productive / occupied) * 100 : 0;

      let bottleneck = null;
      let bottleneckScore = -1;
      const planMix = isPlanSimulationMode();
      perMachine.forEach(pm => {
        const score = planMix ? pm.wait : (pm.occupied + pm.wait);
        if (score > bottleneckScore) {
          bottleneck = pm;
          bottleneckScore = score;
        } else if (score === bottleneckScore && bottleneck) {
          if (planMix ? pm.occupied > bottleneck.occupied : pm.wait > bottleneck.wait) {
            bottleneck = pm;
          }
        }
      });
      if (bottleneck && bottleneckScore <= 0) {
        if (planMix) {
          let occScore = -1;
          let occBn = null;
          perMachine.forEach(pm => {
            const score = pm.occupied + pm.wait;
            if (score > occScore) {
              occBn = pm;
              occScore = score;
            }
          });
          bottleneck = occScore > 0 ? occBn : null;
        } else {
          bottleneck = null;
        }
      }

      const makespanElapsed = Math.max(0, histEnd - histStart);
      const makespanNet = productiveMinutesBetween(histStart, histEnd);

      return {
        histStart,
        histEnd,
        totals: global,
        perMachine,
        productive,
        occupied,
        efficiencyPct,
        bottleneck,
        makespanElapsed,
        makespanNet,
        completionAbs: histEnd,
        operatorRows: computeOperatorHourRows(perMachine, histStart, histEnd),
        estufaCount: countEstufaCycles(),
        estufaOccupancy: collectEstufaOccupancyStats()
      };
    }

    function countEstufaCycles() {
      const ids = {};
      (rawEvents || []).forEach(e => {
        if (e && e.isEstufaBatch && e.estufaBatchId) ids[e.estufaBatchId] = true;
      });
      return Object.keys(ids).length;
    }

    /** Ocupação volumétrica por batelada: volume dos fardos / volume da cabine. */
    function collectEstufaOccupancyStats() {
      const byId = {};
      (rawEvents || []).forEach(e => {
        if (!e || !e.isEstufaBatch || !e.estufaBatchId) return;
        if (byId[e.estufaBatchId]) return;
        const cabin = Number(e.estufaCabinVolumeM3) > 0
          ? Number(e.estufaCabinVolumeM3)
          : ESTUFA_CABIN_VOLUME;
        const pct = Number(e.estufaOccupancyPct);
        let used = Number(e.estufaVolumeM3);
        if (!(isFinite(used) && used >= 0)) {
          used = (isFinite(pct) ? cabin * (pct / 100) : 0);
        }
        byId[e.estufaBatchId] = {
          pct: isFinite(pct) ? pct : (cabin > 0 ? (used / cabin) * 100 : 0),
          volumeUsed: used,
          cabin
        };
      });
      const list = Object.keys(byId).map(k => byId[k]);
      const cabinTotal = list.reduce((s, x) => s + x.cabin, 0);
      const volumeUsed = list.reduce((s, x) => s + x.volumeUsed, 0);
      const pct = cabinTotal > 0 ? (volumeUsed / cabinTotal) * 100 : 0;
      return {
        count: list.length,
        pct,
        volumeUsed,
        cabinVolume: cabinTotal,
        cycles: list
      };
    }

    function formatEstufaOccupancyLabel(stats) {
      if (!stats || !stats.count) return '';
      const pct = (Math.round(stats.pct * 10) / 10).toFixed(1);
      const used = (Number(stats.volumeUsed) || 0).toFixed(3);
      const cap = (Number(stats.cabinVolume) || 0).toFixed(3);
      return 'Ocupação da Cabine: ' + pct + '% (' + used + ' m³ de ' + cap + ' m³)';
    }

    function getFinalSkuName() {
      const names = (assemblyRules || []).map(r => r && r.resultName).filter(Boolean);
      if (names.length) {
        const required = {};
        (assemblyRules || []).forEach(r => {
          joinRequerOf(r).forEach(n => { required[n] = true; });
        });
        const finals = names.filter(n => !required[n]);
        return finals[finals.length - 1] || names[names.length - 1];
      }
      const sim = getSimParts();
      if (sim.length) return sim[sim.length - 1].name;
      if (parts.length) return parts[parts.length - 1].name;
      return '';
    }

    function getReportProjectLabel() {
      const proj = (currentProjectName || '').trim();
      const sku = getFinalSkuName();
      if (proj && sku && proj.toUpperCase() !== sku) return proj + ' / ' + sku;
      return proj || sku || 'Projeto sem nome';
    }

    function sanitizePdfFilenamePart(s) {
      const cleaned = String(s || 'Projeto')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 48);
      return cleaned || 'Projeto';
    }

    function getPdfReportMeta() {
      const issued = new Date();
      const issuedStr = issued.toLocaleDateString('pt-BR') + ' ' +
        issued.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const planName = (typeof currentPlanName === 'string' ? currentPlanName : '').trim();
      const isPlan = isPlanSimulationMode() && planName;
      const projectName = isPlan
        ? planName
        : ((currentProjectName || '').trim() || getFinalSkuName() || 'Projeto sem nome');
      const queue = (typeof currentPlanQueueMeta !== 'undefined' && Array.isArray(currentPlanQueueMeta))
        ? currentPlanQueueMeta
        : [];
      const totalBoxes = isPlan
        ? queue.reduce((n, item) => n + (Number(item.boxesQty) || 0), 0) || boxesQty
        : boxesQty;
      const filename = isPlan
        ? 'Relatorio_Plano_' + APP_NAME + '_' + sanitizePdfFilenamePart(projectName) + '_v' + APP_VERSION + '.pdf'
        : 'Relatorio_' + APP_NAME + '_' + sanitizePdfFilenamePart(projectName) + '_' + boxesQty + 'cx_v' + APP_VERSION + '.pdf';
      return {
        version: 'v' + APP_VERSION,
        projectName,
        sku: isPlan ? (queue.map(i => i.projectName).filter(Boolean).join(', ') || 'Mix') : (getFinalSkuName() || '—'),
        label: isPlan ? ('Plano: ' + projectName) : getReportProjectLabel(),
        boxes: totalBoxes,
        startTime: startTimeStr || DEFAULT_START_TIME,
        startDate: formatDisplayDate(workDays[0] || startDateStr),
        issuedStr,
        filename,
        isPlan: !!isPlan,
        planSkuCount: queue.length
      };
    }

    function clipAbsInterval(start, end, rangeStart, rangeEnd) {
      const s = Math.max(Number(start) || 0, rangeStart);
      const e = Math.min(Number(end) || 0, rangeEnd);
      return e > s ? { start: s, end: e } : null;
    }

    function excludeLunchFromInterval(start, end) {
      const out = [];
      let t = Math.max(0, start);
      const limit = Math.max(t, end);
      let guard = 0;
      while (t < limit && guard++ < 4000) {
        if (isLunchAbsMinute(t)) {
          t = Math.floor(t / MINUTES_PER_DAY) * MINUTES_PER_DAY + LUNCH_END_OFFSET;
          continue;
        }
        const dayStart = Math.floor(t / MINUTES_PER_DAY) * MINUTES_PER_DAY;
        const lunchStart = dayStart + LUNCH_START_OFFSET;
        const dayEnd = dayStart + MINUTES_PER_DAY;
        const next = t < lunchStart ? Math.min(limit, lunchStart) : Math.min(limit, dayEnd);
        if (next > t) out.push({ start: t, end: next });
        t = next;
      }
      return out;
    }

    function lunchOverlaysInRange(rangeStart, rangeEnd) {
      const bands = [];
      if (rangeEnd <= rangeStart) return bands;
      const startDay = Math.floor(rangeStart / MINUTES_PER_DAY);
      const endDay = Math.floor((rangeEnd - 1) / MINUTES_PER_DAY);
      for (let d = startDay; d <= endDay; d++) {
        const clipped = clipAbsInterval(
          d * MINUTES_PER_DAY + LUNCH_START_OFFSET,
          d * MINUTES_PER_DAY + LUNCH_END_OFFSET,
          rangeStart,
          rangeEnd
        );
        if (clipped) bands.push(clipped);
      }
      return bands;
    }

    function dayBoundaryAbsMins(rangeStart, rangeEnd) {
      const marks = [];
      const first = Math.ceil(rangeStart / MINUTES_PER_DAY) * MINUTES_PER_DAY;
      for (let t = first; t < rangeEnd; t += MINUTES_PER_DAY) {
        if (t > rangeStart) marks.push(t);
      }
      return marks;
    }

    function getGanttRangeForDay(dayIndex) {
      const day = Math.max(0, Number(dayIndex) || 0);
      const start = day * MINUTES_PER_DAY;
      const end = start + MINUTES_PER_DAY;
      return { start, end, mode: 'day', dayIndex: day };
    }

    function getGanttRangeForLot() {
      const startAbs = getSimulationStartAbsMin();
      const endAbs = Math.max(startAbs + 1, getProjectMakespanEndAbsMin());
      const histEnd = Math.max(startAbs + 1, Math.min(simulationHistory.length || endAbs, endAbs));
      return { start: startAbs, end: histEnd, mode: 'lot', dayIndex: -1 };
    }

    function pushGanttBlocks(blocks, kind, start, end, rangeStart, rangeEnd, partName, extra) {
      const clipped = clipAbsInterval(start, end, rangeStart, rangeEnd);
      if (!clipped) return;
      extra = extra || {};
      excludeLunchFromInterval(clipped.start, clipped.end).forEach(seg => {
        blocks.push({
          kind,
          start: seg.start,
          end: seg.end,
          partName: partName || '',
          planProjectName: extra.planProjectName || '',
          planItemId: extra.planItemId || '',
          planOrder: Number(extra.planOrder) || 0,
          isEstufaBatch: !!extra.isEstufaBatch,
          estufaBatchId: extra.estufaBatchId || '',
          estufaSkuTags: Array.isArray(extra.estufaSkuTags) ? extra.estufaSkuTags.slice() : [],
          estufaTrigger: extra.estufaTrigger || '',
          estufaOccupancyPct: Number(extra.estufaOccupancyPct) || 0
        });
      });
    }

    function ganttKindRank(kind) {
      if (kind === 'estufa' || kind === 'prod' || kind === 'unload' || kind === 'cooling') return 4;
      if (kind === 'setup') return 3;
      if (kind === 'maint') return 2;
      if (kind === 'wait') return 1;
      return 0;
    }

    function sortGanttBlocksForPaint(blocks) {
      return (blocks || []).slice().sort((a, b) => {
        const rankDiff = ganttKindRank(a.kind) - ganttKindRank(b.kind);
        if (rankDiff !== 0) return rankDiff;
        return a.start - b.start;
      });
    }

    /**
     * Ocupação da máquina: Produção > Setup > Manutenção > Espera/Fila.
     * Peças na fila não pintam de cinza um intervalo em que a máquina já corta/produz.
     */
    function resolveGanttMachineBlocks(blocks) {
      const src = (blocks || []).filter(b => b && b.end > b.start);
      if (src.length === 0) return [];
      const times = [];
      src.forEach(b => {
        times.push(b.start, b.end);
      });
      times.sort((a, b) => a - b);
      const uniq = [];
      times.forEach(t => {
        if (uniq.length === 0 || uniq[uniq.length - 1] !== t) uniq.push(t);
      });
      const resolved = [];
      for (let i = 0; i < uniq.length - 1; i++) {
        const t0 = uniq[i];
        const t1 = uniq[i + 1];
        let bestRank = 0;
        let bestKind = '';
        let bestPlanProjectName = '';
        let bestPlanItemId = '';
        let bestPlanOrder = 0;
        let bestEstufaBatchId = '';
        let bestEstufaTrigger = '';
        let bestOccupancy = 0;
        const names = [];
        const skuTags = [];
        src.forEach(b => {
          if (b.start >= t1 || b.end <= t0) return;
          const rank = ganttKindRank(b.kind);
          if (rank > bestRank) {
            bestRank = rank;
            bestKind = b.kind;
            bestPlanProjectName = b.planProjectName || '';
            bestPlanItemId = b.planItemId || '';
            bestPlanOrder = Number(b.planOrder) || 0;
            bestEstufaBatchId = b.estufaBatchId || '';
            bestEstufaTrigger = b.estufaTrigger || '';
            bestOccupancy = Number(b.estufaOccupancyPct) || 0;
            names.length = 0;
            skuTags.length = 0;
            if (b.partName) names.push(b.partName);
            (b.estufaSkuTags || []).forEach(t => { if (t && skuTags.indexOf(t) < 0) skuTags.push(t); });
          } else if (rank === bestRank) {
            if (b.partName && names.indexOf(b.partName) < 0) names.push(b.partName);
            (b.estufaSkuTags || []).forEach(t => { if (t && skuTags.indexOf(t) < 0) skuTags.push(t); });
            if (!bestEstufaBatchId && b.estufaBatchId) bestEstufaBatchId = b.estufaBatchId;
          }
        });
        if (!bestKind) continue;
        const partName = ((bestKind === 'estufa' || bestKind === 'cooling') && skuTags.length) ? skuTags.join(' + ') : names.join(' + ');
        const last = resolved[resolved.length - 1];
        const sameEstufa = !!(bestEstufaBatchId && last && last.estufaBatchId === bestEstufaBatchId);
        const sameSku = last
          && (last.planItemId || '') === bestPlanItemId
          && (last.planProjectName || '') === bestPlanProjectName;
        const canMerge = last && last.kind === bestKind && last.end === t0 && (sameEstufa || (!bestEstufaBatchId && !last.estufaBatchId && sameSku));
        if (canMerge) {
          last.end = t1;
          const existing = last.partName ? last.partName.split(' + ') : [];
          (bestKind === 'estufa' || bestKind === 'cooling' ? skuTags : names).forEach(n => {
            if (n && existing.indexOf(n) < 0) existing.push(n);
          });
          last.partName = existing.join(' + ');
        } else {
          resolved.push({
            kind: bestKind,
            start: t0,
            end: t1,
            partName,
            planProjectName: bestPlanProjectName,
            planItemId: bestPlanItemId,
            planOrder: bestPlanOrder,
            isEstufaBatch: !!bestEstufaBatchId,
            estufaBatchId: bestEstufaBatchId,
            estufaSkuTags: skuTags.slice(),
            estufaTrigger: bestEstufaTrigger,
            estufaOccupancyPct: bestOccupancy
          });
        }
      }
      return resolved;
    }

    function buildGanttRows(rangeStart, rangeEnd) {
      const machinesList = getActiveMachines();
      return machinesList.map(m => {
        const blocks = [];
        (rawEvents || []).filter(e => e.machineId === m.id).forEach(evt => {
          const meta = {
            planProjectName: evt.planProjectName || '',
            planItemId: evt.planItemId || '',
            planOrder: Number(evt.planOrder) || 0,
            isEstufaBatch: !!evt.isEstufaBatch,
            estufaBatchId: evt.estufaBatchId || '',
            estufaSkuTags: Array.isArray(evt.estufaSkuTags) ? evt.estufaSkuTags.slice() : [],
            estufaTrigger: evt.estufaTrigger || '',
            estufaOccupancyPct: Number(evt.estufaOccupancyPct) || 0
          };
          const estufaLabel = (meta.estufaSkuTags && meta.estufaSkuTags.length)
            ? meta.estufaSkuTags.join(' + ')
            : evt.partName;
          pushGanttBlocks(blocks, 'wait', evt.arrivalTime, evt.setupStart, rangeStart, rangeEnd, evt.partName, meta);
          if (evt.isEstufaBatch) {
            const queimaEnd = evt.estufaQueimaEnd != null ? evt.estufaQueimaEnd : evt.end;
            const resfrioEnd = estufaResfrioEndOf(evt);
            const unloadStart = evt.estufaUnloadStart != null ? evt.estufaUnloadStart : resfrioEnd;
            pushGanttBlocks(blocks, 'estufa', evt.prodStart, queimaEnd, rangeStart, rangeEnd, estufaLabel, meta);
            pushGanttBlocks(blocks, 'cooling', queimaEnd, resfrioEnd, rangeStart, rangeEnd, estufaLabel, meta);
            if (evt.end > unloadStart) {
              pushGanttBlocks(blocks, 'unload', unloadStart, evt.end, rangeStart, rangeEnd, evt.partName, meta);
            }
          } else {
            pushGanttBlocks(blocks, 'setup', evt.setupStart, eventSetupEnd(evt), rangeStart, rangeEnd, evt.partName, meta);
            pushGanttBlocks(blocks, 'prod', evt.prodStart, evt.end, rangeStart, rangeEnd, evt.partName, meta);
          }
        });
        (maintenanceEvents || []).filter(e => e.machineId === m.id).forEach(me => {
          pushGanttBlocks(blocks, 'maint', me.start, me.end, rangeStart, rangeEnd, 'Manutenção');
        });
        return { id: m.id, name: m.name, blocks: sortGanttBlocksForPaint(resolveGanttMachineBlocks(blocks)) };
      });
    }

    const PART_JOURNEY_COLORS = {
      fila: '#7f8c8d',
      setup: '#e67e22',
      prod: '#2ecc71',
      union: '#f1c40f',
      transport: '#3498db'
    };

    function partJourneyKindLabel(kind) {
      if (kind === 'fila') return 'Fila';
      if (kind === 'setup') return 'Setup';
      if (kind === 'prod') return 'Produção';
      if (kind === 'union') return 'Aguardando União';
      if (kind === 'transport') return 'Transporte';
      return kind || '';
    }

    function partJourneyStatusText(kind, machineName, extra) {
      extra = extra || {};
      const posto = machineName ? String(machineName) : '';
      if (kind === 'fila') return posto ? ('Em fila no ' + posto) : 'Em fila';
      if (kind === 'setup') return posto ? ('Em Setup no ' + posto) : 'Em Setup';
      if (kind === 'prod') {
        if (extra.estufaPhase === 'queima') return posto ? ('Em Queima na ' + posto) : 'Em Queima';
        if (extra.estufaPhase === 'cooling') return posto ? ('Em Resfriamento na ' + posto) : 'Em Resfriamento';
        if (extra.estufaPhase === 'unload') return posto ? ('Descarregando na ' + posto) : 'Descarregar';
        return posto ? ('Em Produção no ' + posto) : 'Em Produção';
      }
      if (kind === 'union') return posto ? ('Aguardando União no ' + posto) : 'Aguardando União';
      if (kind === 'transport') {
        const dest = extra.toMachine || posto;
        const from = extra.fromMachine || '';
        if (from && dest) return 'Transporte de ' + from + ' para ' + dest;
        return dest ? ('Transporte para ' + dest) : 'Transporte';
      }
      return partJourneyKindLabel(kind);
    }

    function formatExactMinutes(mins) {
      const n = Number(mins);
      if (!isFinite(n) || n <= 0) return '0 min';
      const rounded = Math.round(n * 100) / 100;
      if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded)) + ' min';
      return String(rounded).replace('.', ',') + ' min';
    }

    function productiveSpanMinutes(start, end) {
      return excludeLunchFromInterval(start, end).reduce(function (sum, seg) {
        return sum + Math.max(0, seg.end - seg.start);
      }, 0);
    }

    function pushPartJourneyBlocks(blocks, kind, start, end, extra) {
      extra = extra || {};
      excludeLunchFromInterval(start, end).forEach(function (seg) {
        if (!(seg.end > seg.start)) return;
        blocks.push({
          kind: kind,
          start: seg.start,
          end: seg.end,
          partName: extra.partName || '',
          machineId: extra.machineId || '',
          machineName: extra.machineName || '',
          statusText: extra.statusText || partJourneyStatusText(kind, extra.machineName, extra),
          planProjectName: extra.planProjectName || '',
          planItemId: extra.planItemId || '',
          fromMachine: extra.fromMachine || '',
          toMachine: extra.toMachine || ''
        });
      });
    }

    function mergeAdjacentJourneyBlocks(blocks) {
      const sorted = (blocks || []).slice().sort(function (a, b) {
        return a.start - b.start || String(a.kind).localeCompare(String(b.kind));
      });
      const out = [];
      sorted.forEach(function (b) {
        const last = out[out.length - 1];
        if (last
          && last.kind === b.kind
          && last.end === b.start
          && last.machineId === b.machineId
          && last.statusText === b.statusText) {
          last.end = b.end;
          return;
        }
        out.push(Object.assign({}, b));
      });
      return out;
    }

    function eventsForJourneyPart(part) {
      return (rawEvents || []).filter(function (e) {
        if (!e || !part) return false;
        if (!namesEqual(e.partName, part.name)) return false;
        if (part.planItemId && e.planItemId && String(e.planItemId) !== String(part.planItemId)) return false;
        return true;
      }).slice().sort(function (a, b) {
        return (a.arrivalTime - b.arrivalTime) || (a.setupStart - b.setupStart) || (a.end - b.end);
      });
    }

    function joinWaitIntervalForPart(part, lastOwnEnd) {
      if (!part || part.isVirtual || lastOwnEnd == null) return null;
      const rules = (assemblyRules || []).filter(function (rule) {
        return joinRequerOf(rule).some(function (n) { return namesEqual(n, part.name); });
      });
      if (!rules.length) return null;
      let end = lastOwnEnd;
      let machineId = '';
      let found = false;
      rules.forEach(function (rule) {
        const joinEvt = (rawEvents || []).find(function (e) {
          if (!e || !e.isJoin || !namesEqual(e.partName, rule.resultName)) return false;
          if (part.planItemId && e.planItemId && String(e.planItemId) !== String(part.planItemId)) return false;
          return true;
        });
        const waitEnd = joinEvt ? joinEvt.setupStart : getProjectMakespanEndAbsMin();
        if (waitEnd > lastOwnEnd) {
          found = true;
          if (waitEnd > end) {
            end = waitEnd;
            machineId = rule.machineId || (joinEvt && joinEvt.machineId) || '';
          }
        }
      });
      return found && end > lastOwnEnd ? { start: lastOwnEnd, end: end, machineId: machineId } : null;
    }

    function computePartJourneyKpis(blocks) {
      const empty = {
        leadTime: 0,
        prodTime: 0,
        setupTime: 0,
        waitTime: 0,
        filaTime: 0,
        unionTime: 0,
        transportTime: 0,
        efficiency: 0,
        startAbs: null,
        endAbs: null,
        isBottleneck: false,
        bottleneckKind: '',
        bottleneckNote: 'Sem jornada'
      };
      const src = (blocks || []).filter(function (b) { return b && b.end > b.start; });
      if (!src.length) return empty;
      const first = Math.min.apply(null, src.map(function (b) { return b.start; }));
      const last = Math.max.apply(null, src.map(function (b) { return b.end; }));
      const leadTime = productiveSpanMinutes(first, last);
      let prodTime = 0;
      let setupTime = 0;
      let filaTime = 0;
      let unionTime = 0;
      let transportTime = 0;
      src.forEach(function (b) {
        const dur = Math.max(0, b.end - b.start);
        if (b.kind === 'prod') prodTime += dur;
        else if (b.kind === 'setup') setupTime += dur;
        else if (b.kind === 'union') unionTime += dur;
        else if (b.kind === 'transport') transportTime += dur;
        else filaTime += dur;
      });
      const waitTime = filaTime + transportTime;
      const waitIdle = filaTime + unionTime;
      const efficiency = leadTime > 0 ? (prodTime / leadTime) * 100 : 0;
      const isBottleneck = waitIdle > prodTime && waitIdle > 0;
      let bottleneckKind = '';
      let bottleneckNote = 'Sem gargalo de espera';
      if (isBottleneck) {
        const filaLbl = typeof formatExactMinutes === 'function' ? formatExactMinutes(filaTime) : (filaTime + ' min');
        const unionLbl = typeof formatExactMinutes === 'function' ? formatExactMinutes(unionTime) : (unionTime + ' min');
        const prodLbl = typeof formatExactMinutes === 'function' ? formatExactMinutes(prodTime) : (prodTime + ' min');
        if (filaTime > prodTime && unionTime > prodTime) {
          bottleneckKind = 'both';
          bottleneckNote = 'Gargalo: Fila (' + filaLbl + ') e Aguardando União (' + unionLbl + ') > Produção (' + prodLbl + ')';
        } else if (unionTime >= filaTime) {
          bottleneckKind = 'union';
          bottleneckNote = 'Gargalo de Aguardando União (' + unionLbl + ') > Produção (' + prodLbl + ')';
        } else {
          bottleneckKind = 'fila';
          bottleneckNote = 'Gargalo de Fila (' + filaLbl + ') > Produção (' + prodLbl + ')';
        }
      }
      return {
        leadTime: leadTime,
        prodTime: prodTime,
        setupTime: setupTime,
        waitTime: waitTime,
        filaTime: filaTime,
        unionTime: unionTime,
        transportTime: transportTime,
        efficiency: efficiency,
        startAbs: first,
        endAbs: last,
        isBottleneck: isBottleneck,
        bottleneckKind: bottleneckKind,
        bottleneckNote: bottleneckNote
      };
    }

    function collectPartJourneyBlocks(part) {
      const events = eventsForJourneyPart(part);
      const blocks = [];
      events.forEach(function (evt, i) {
        const prev = i > 0 ? events[i - 1] : null;
        const machineName = machineNameOf(evt.machineId) || '';
        const meta = {
          partName: part.name,
          machineId: evt.machineId,
          machineName: machineName,
          planProjectName: evt.planProjectName || part.planProjectName || '',
          planItemId: evt.planItemId || part.planItemId || ''
        };

        if (prev && evt.arrivalTime > prev.end) {
          const prevName = machineNameOf(prev.machineId) || '';
          const sameMachine = prev.machineId === evt.machineId;
          const isUnionGap = !!(evt.isJoin && evt.waitingForAssembly && evt.assemblyGate > prev.end);
          if (!sameMachine && !isUnionGap) {
            pushPartJourneyBlocks(blocks, 'transport', prev.end, evt.arrivalTime, Object.assign({}, meta, {
              fromMachine: prevName,
              toMachine: machineName,
              statusText: partJourneyStatusText('transport', machineName, { fromMachine: prevName, toMachine: machineName })
            }));
          } else if (sameMachine && !isUnionGap) {
            pushPartJourneyBlocks(blocks, 'fila', prev.end, evt.arrivalTime, Object.assign({}, meta, {
              statusText: partJourneyStatusText('fila', machineName)
            }));
          }
        }

        const setupEnd = eventSetupEnd(evt);
        let cursor = evt.arrivalTime;
        if (evt.isJoin && evt.waitingForAssembly && evt.assemblyGate > evt.arrivalTime) {
          const unionEnd = Math.min(evt.assemblyGate, evt.setupStart);
          if (unionEnd > cursor) {
            pushPartJourneyBlocks(blocks, 'union', cursor, unionEnd, Object.assign({}, meta, {
              statusText: partJourneyStatusText('union', machineName)
            }));
            cursor = unionEnd;
          }
        }
        if (evt.setupStart > cursor) {
          pushPartJourneyBlocks(blocks, 'fila', cursor, evt.setupStart, Object.assign({}, meta, {
            statusText: partJourneyStatusText('fila', machineName)
          }));
        }
        if (setupEnd > evt.setupStart) {
          pushPartJourneyBlocks(blocks, 'setup', evt.setupStart, setupEnd, Object.assign({}, meta, {
            statusText: partJourneyStatusText('setup', machineName)
          }));
        }
        if (evt.prodStart > setupEnd) {
          pushPartJourneyBlocks(blocks, 'fila', setupEnd, evt.prodStart, Object.assign({}, meta, {
            statusText: partJourneyStatusText('fila', machineName)
          }));
        }

        if (evt.isEstufaBatch) {
          const queimaEnd = evt.estufaQueimaEnd != null ? evt.estufaQueimaEnd : evt.end;
          const resfrioEnd = estufaResfrioEndOf(evt);
          const unloadStart = evt.estufaUnloadStart != null ? evt.estufaUnloadStart : resfrioEnd;
          if (queimaEnd > evt.prodStart) {
            pushPartJourneyBlocks(blocks, 'prod', evt.prodStart, queimaEnd, Object.assign({}, meta, {
              statusText: partJourneyStatusText('prod', machineName, { estufaPhase: 'queima' })
            }));
          }
          if (resfrioEnd > queimaEnd) {
            pushPartJourneyBlocks(blocks, 'prod', queimaEnd, resfrioEnd, Object.assign({}, meta, {
              statusText: partJourneyStatusText('prod', machineName, { estufaPhase: 'cooling' })
            }));
          }
          if (evt.end > unloadStart) {
            pushPartJourneyBlocks(blocks, 'prod', unloadStart, evt.end, Object.assign({}, meta, {
              statusText: partJourneyStatusText('prod', machineName, { estufaPhase: 'unload' })
            }));
          }
        } else if (evt.end > evt.prodStart) {
          pushPartJourneyBlocks(blocks, 'prod', evt.prodStart, evt.end, Object.assign({}, meta, {
            statusText: partJourneyStatusText('prod', machineName)
          }));
        }
      });

      const lastOwn = events.filter(function (e) { return !e.isJoin; }).slice(-1)[0];
      const lastEvt = events.length ? events[events.length - 1] : null;
      const lastEnd = lastOwn ? lastOwn.end : (lastEvt ? lastEvt.end : 0);
      if (lastEnd) {
        const wait = joinWaitIntervalForPart(part, lastEnd);
        if (wait) {
          const mName = machineNameOf(wait.machineId) || '';
          pushPartJourneyBlocks(blocks, 'union', wait.start, wait.end, {
            partName: part.name,
            machineId: wait.machineId,
            machineName: mName,
            planProjectName: part.planProjectName || '',
            planItemId: part.planItemId || '',
            statusText: partJourneyStatusText('union', mName)
          });
        }
      }
      return mergeAdjacentJourneyBlocks(blocks);
    }

    function clipPartJourneyBlocks(blocks, rangeStart, rangeEnd) {
      const out = [];
      (blocks || []).forEach(function (b) {
        const clipped = clipAbsInterval(b.start, b.end, rangeStart, rangeEnd);
        if (!clipped) return;
        out.push(Object.assign({}, b, { start: clipped.start, end: clipped.end }));
      });
      return out;
    }

    function buildPartJourneyRows(rangeStart, rangeEnd) {
      const hasRange = rangeStart != null && rangeEnd != null;
      return (getSimParts() || []).map(function (part) {
        const fullBlocks = collectPartJourneyBlocks(part);
        if (!fullBlocks.length) return null;
        const blocks = hasRange ? clipPartJourneyBlocks(fullBlocks, rangeStart, rangeEnd) : fullBlocks;
        return {
          id: String(part.planItemId || '') + '|' + String(part.name || ''),
          name: part.name,
          kindLabel: part.isVirtual ? 'JOIN / SKU' : 'Peça',
          isVirtual: !!part.isVirtual,
          planProjectName: part.planProjectName || '',
          blocks: blocks,
          fullBlocks: fullBlocks,
          kpis: computePartJourneyKpis(fullBlocks)
        };
      }).filter(Boolean);
    }

    function buildBomDetailRows() {
      const rows = [];
      (parts || []).forEach(p => {
        const evts = (rawEvents || []).filter(e => e.partName === p.name && !e.isJoin);
        const setup = evts.reduce((s, e) => s + (Number(e.setupTime) || 0), 0);
        const prod = evts.reduce((s, e) => s + (Number(e.prodTime) || 0), 0);
        const start = evts.length ? Math.min.apply(null, evts.map(e => e.setupStart)) : null;
        const end = evts.length ? Math.max.apply(null, evts.map(e => e.end)) : null;
        const route = (p.route || []).map(s => {
          const m = machines.find(x => x.id === s.machineId);
          return m ? m.name : (s.machineId || '?');
        }).join(' → ');
        rows.push({
          name: p.name,
          kind: 'Peça',
          qty: (Number(p.qty) || 1) * (boxesQty || 1),
          route: route || '—',
          setup,
          prod,
          startLabel: start != null ? absMinuteToTimeLabel(start) : '—',
          endLabel: end != null ? absMinuteToTimeLabel(end) : '—',
          requer: '—'
        });
      });
      (assemblyRules || []).forEach(r => {
        const evts = (rawEvents || []).filter(e => e.partName === r.resultName);
        const setup = evts.reduce((s, e) => s + (Number(e.setupTime) || 0), 0);
        const prod = evts.reduce((s, e) => s + (Number(e.prodTime) || 0), 0);
        const start = evts.length ? Math.min.apply(null, evts.map(e => e.setupStart)) : null;
        const end = evts.length ? Math.max.apply(null, evts.map(e => e.end)) : null;
        const joinMachine = machines.find(x => x.id === r.machineId);
        const sub = (r.route || []).map(s => {
          const m = machines.find(x => x.id === s.machineId);
          return m ? m.name : (s.machineId || '?');
        });
        const routeParts = [];
        if (joinMachine) routeParts.push(joinMachine.name + ' (JOIN)');
        routeParts.push.apply(routeParts, sub);
        rows.push({
          name: r.resultName,
          kind: 'JOIN / SKU',
          qty: (Number(r.qty) || 1) * (boxesQty || 1),
          route: routeParts.join(' → ') || '—',
          setup,
          prod,
          startLabel: start != null ? absMinuteToTimeLabel(start) : '—',
          endLabel: end != null ? absMinuteToTimeLabel(end) : '—',
          requer: joinRequerOf(r).join(' + ') || '—'
        });
      });
      return rows;
    }

// --- MOTOR DE SIMULAÇÃO ---
    function getBoxesQtyFromInput() {
      if (isPlanSimulationMode()) {
        return 1;
      }
      const simEl = document.getElementById('sim-boxes-qty');
      const cfgEl = document.getElementById('boxes-qty');
      const simScreen = document.getElementById('screen-sim');
      const preferSim = simScreen && simScreen.classList.contains('active') && simEl;
      const src = preferSim ? simEl : (cfgEl || simEl);
      let qty = parseInt(src && src.value, 10);
      if (isNaN(qty) || qty < 1) qty = 1;
      if (qty > 999) qty = 999;
      if (cfgEl) cfgEl.value = qty;
      if (simEl) simEl.value = qty;
      return qty;
    }

    function getStartDateFromInput() {
      const el = document.getElementById('start-date');
      let v = el && el.value;
      if (!v) v = todayISODate();
      if (el) el.value = v;
      return v;
    }

    function lookupPrevStepReady(partName, route, stepIndex, readyMap, t0) {
      if (!(stepIndex > 0) || !route) return t0;
      const prevStep = route[stepIndex - 1];
      if (!prevStep) return t0;
      const keyed = lookupReadyTime(readyMap, readyMapKey(partName, prevStep.machineId, stepIndex - 1));
      if (keyed != null) return keyed;
      const fallback = lookupReadyTime(readyMap, partName + '_' + prevStep.machineId);
      return fallback != null ? fallback : t0;
    }

    function getPartReadyForMachine(partName, machineId, readyMap, stepIndex) {
      const t0 = getSimulationStartAbsMin();
      const simP = findSimPart(partName);
      if (simP) {
        const asmIdx = (typeof stepIndex === 'number' && stepIndex >= 0)
          ? stepIndex
          : firstMachineStepIndex(simP.route, machineId);
        if (asmIdx > 0) return lookupPrevStepReady(partName, simP.route, asmIdx, readyMap, t0);
        if (asmIdx === 0 && isJoinStep(simP.route[0])) return t0;
      }
      const part = findSourcePartByName(partName, parts);
      if (!part) {
        const prevAsm = (assemblyRules || []).find(a => namesEqual(a.resultName, partName));
        if (prevAsm) {
          const keyed = lookupReadyTime(readyMap, partName + '_' + prevAsm.machineId);
          return keyed != null ? keyed : t0;
        }
        return t0;
      }
      const asmIdx = (typeof stepIndex === 'number' && stepIndex >= 0)
        ? stepIndex
        : firstMachineStepIndex(part.route, machineId);
      if (asmIdx < 0) return t0;
      if (asmIdx === 0) return t0;
      return lookupPrevStepReady(partName, part.route, asmIdx, readyMap, t0);
    }

    function maybeInsertMaintenance(machineId, machineFreeUntil, machineOperated, localMaintEvents) {
      const m = machines.find(x => x.id === machineId);
      if (!m) return;
      const intervalMin = (m.maintIntervalHours || 0) * 60;
      const durationMin = (m.maintDurationHours || 0) * 60;
      if (intervalMin <= 0 || durationMin <= 0) return;
      if ((machineOperated[machineId] || 0) < intervalMin) return;

      const start = snapToProductive(machineFreeUntil[machineId] != null ? machineFreeUntil[machineId] : getSimulationStartAbsMin());
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
      return Math.max(0, parseTimeMinutes(setup, 0) / n);
    }

    function eventSetupEnd(evt) {
      if (!evt) return 0;
      if (evt.setupEnd != null) return evt.setupEnd;
      return evt.prodStart;
    }

    function isActiveMachineState(state) {
      return state === 'setup' || state === 'working' || state === 'maintenance' || state === 'cooling' || state === 'unload';
    }

    function estufaUnloadMinutes(step, pieceCount) {
      const unit = Number(step && step.prodUnit);
      const n = Number(pieceCount);
      const per = (isFinite(unit) && unit > 0) ? unit : 0;
      const qty = (isFinite(n) && n > 0) ? n : 0;
      return per * qty;
    }

    function estufaResfrioEndOf(evt) {
      if (!evt) return 0;
      if (evt.estufaResfrioEnd != null) return evt.estufaResfrioEnd;
      if (evt.estufaUnloadStart != null) return evt.estufaUnloadStart;
      return evt.end;
    }

    /** Fase da batelada: QUEIMA → RESFRIAMENTO → DESCARREGAR. */
    function estufaPhaseAt(evt, absMin) {
      if (!evt || !evt.isEstufaBatch) return null;
      const queimaEnd = evt.estufaQueimaEnd != null ? evt.estufaQueimaEnd : evt.end;
      const resfrioEnd = estufaResfrioEndOf(evt);
      if (absMin < queimaEnd) return { status: 'queima', until: queimaEnd };
      if (absMin < resfrioEnd) return { status: 'cooling', until: resfrioEnd };
      return { status: 'descarregar', until: evt.end };
    }

    function machineStateFromEstufaPhase(phase, isLunchTime) {
      if (!phase) return isLunchTime ? 'lunch' : 'working';
      if (isLunchTime) return 'lunch';
      if (phase.status === 'cooling') return 'cooling';
      if (phase.status === 'descarregar') return 'unload';
      return 'working';
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
        isLastStep: fields.isLastStep != null ? !!fields.isLastStep : (stepIndex === part.route.length - 1),
        grouped: !!fields.grouped,
        isJoin: !!fields.isJoin,
        skuName: fields.skuName || part.name,
        requer: fields.requer || [],
        planProjectName: part.planProjectName || '',
        planItemId: part.planItemId || '',
        planOrder: Number(part.planOrder) || 0,
        isEstufaBatch: !!fields.isEstufaBatch,
        estufaBatchId: fields.estufaBatchId || '',
        estufaTrigger: fields.estufaTrigger || '',
        estufaOccupancyPct: Number(fields.estufaOccupancyPct) || 0,
        estufaVolumeM3: Number(fields.estufaVolumeM3) || 0,
        estufaCabinVolumeM3: Number(fields.estufaCabinVolumeM3) || 0,
        estufaQueimaEnd: fields.estufaQueimaEnd != null ? fields.estufaQueimaEnd : null,
        estufaResfrioEnd: fields.estufaResfrioEnd != null ? fields.estufaResfrioEnd : null,
        estufaUnloadStart: fields.estufaUnloadStart != null ? fields.estufaUnloadStart : null,
        estufaUnloadEnd: fields.estufaUnloadEnd != null ? fields.estufaUnloadEnd : null,
        estufaQueimaMin: fields.estufaQueimaMin != null ? fields.estufaQueimaMin : null,
        estufaResfrioMin: fields.estufaResfrioMin != null ? fields.estufaResfrioMin : null,
        estufaSkuTags: Array.isArray(fields.estufaSkuTags) ? fields.estufaSkuTags.slice() : [],
        estufaFardos: Number(fields.estufaFardos) || 0
      };
    }

    function resolveAssemblyWait(part, step, arrivalTime, readyMap, partReady, nextStepIndex) {
      // Etapa individual (mesmo na máquina do JOIN) nunca espera união.
      // "Aguardando Outras Peças" só no passo com juncao, após o roteiro próprio.
      if (!isJoinStep(step)) {
        return { waitingForAssembly: false, assemblyGate: arrivalTime, assemblyRule: null, requer: [] };
      }
      const requer = joinRequerOf(step);
      const gate = joinAvailableAt(requer, partReady || {});
      return {
        waitingForAssembly: true,
        assemblyGate: gate,
        assemblyRule: assemblyRules.find(a => a.resultName === part.name && a.machineId === step.machineId) || {
          resultName: part.name,
          machineId: step.machineId,
          requiredPartNames: requer
        },
        requer
      };
    }

    function collectGroupingMembers(groupRule, readyMap, partReady, nextStepIndex) {
      const members = [];
      const simList = getSimParts();
      (groupRule.partNames || []).forEach(name => {
        const part = findSimPart(name, simList);
        if (!part) return;
        const stepIndex = (nextStepIndex && nextStepIndex[part.name] != null)
          ? nextStepIndex[part.name]
          : firstMachineStepIndex(part.route, groupRule.machineId);
        if (stepIndex < 0 || stepIndex >= (part.route || []).length) return;
        const step = part.route[stepIndex];
        if (!step || step.machineId !== groupRule.machineId) return;
        const arrivalTime = (partReady && Object.prototype.hasOwnProperty.call(partReady, part.name))
          ? partReady[part.name]
          : getPartReadyForMachine(part.name, step.machineId, readyMap, stepIndex);
        const asm = resolveAssemblyWait(part, step, arrivalTime, readyMap, partReady, nextStepIndex);
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
    function scheduleGroupedMachineBatch(groupRule, readyTimeOfParts, machineFreeUntil, machineOperated, passEvents, passMaint, groupedScheduled, partReady, nextStepIndex) {
      const members = collectGroupingMembers(groupRule, readyTimeOfParts, partReady, nextStepIndex);
      if (members.length === 0) return;
      const machineId = groupRule.machineId;

      maybeInsertMaintenance(machineId, machineFreeUntil, machineOperated, passMaint);

      const sharedSetupStart = snapToProductive(Math.max(
        machineFreeAt(machineFreeUntil, machineId),
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
        groupedScheduled[`${m.part.name}_${machineId}_${m.stepIndex}`] = evt;
        readyTimeOfParts[`${m.part.name}_${machineId}`] = evt.end;
        readyTimeOfParts[readyMapKey(m.part.name, machineId, m.stepIndex)] = evt.end;
        if (m.assemblyRule) {
          readyTimeOfParts[`${m.assemblyRule.resultName}_${m.assemblyRule.machineId}`] = evt.end;
        }
        logPartStepTransition(m.part, m.stepIndex, m.step, m.stepIndex + 1, nextStepIndex);
      });

      machineFreeUntil[machineId] = batchEnd;
      machineOperated[machineId] = (machineOperated[machineId] || 0) + sharedSetupDur + maxProdTime;
      maybeInsertMaintenance(machineId, machineFreeUntil, machineOperated, passMaint);
    }

    function readyMapHas(readyMap, key) {
      return Object.prototype.hasOwnProperty.call(readyMap, key);
    }

    function assemblyDependenciesMet(part, step, readyMap, partReady, nextStepIndex) {
      if (!isJoinStep(step)) return true;
      return joinInputsCompleted(joinRequerOf(step), nextStepIndex || {}, getSimParts());
    }

    function groupRepresentativeName(groupRule) {
      const simList = getSimParts();
      for (let i = 0; i < groupRule.partNames.length; i++) {
        const found = simList.find(p => namesEqual(p.name, groupRule.partNames[i]));
        if (found) return found.name;
      }
      return groupRule.partNames[0];
    }

    function allGroupMembersAtGroupedStep(groupRule, nextStepIndex) {
      const simList = getSimParts();
      return (groupRule.partNames || []).every(name => {
        const part = findSimPart(name, simList);
        if (!part) return true;
        const si = firstMachineStepIndex(part.route, groupRule.machineId);
        if (si < 0) return true;
        const cur = nextStepIndex[part.name] != null ? nextStepIndex[part.name] : (nextStepIndex[name] || 0);
        return cur === si;
      });
    }

    function findGroupRuleForStep(part, step, stepIndex) {
      if (!part || !step) return null;
      const rule = (groupingRules || []).find(g =>
        g && g.machineId === step.machineId &&
        (g.partNames || []).some(n => namesEqual(n, part.name))
      );
      if (!rule) return null;
      const firstIdx = firstMachineStepIndex(part.route, rule.machineId);
      if (firstIdx < 0) return null;
      if (typeof stepIndex === 'number' && stepIndex !== firstIdx) return null;
      return rule;
    }

    function getMachineById(id) {
      return (machines || []).find(m => m && m.id === id) || null;
    }

    function isEstufaMachineId(machineId) {
      const m = getMachineById(machineId);
      return !!(m && machineRequiresEstufaGeometry(m));
    }

    function machineRequiresEstufaGeometry(m) {
      if (!m) return false;
      if (m.isEstufa === true || m.isEstufa === 'true') return true;
      const name = String(m.name || '').toUpperCase();
      if (name.indexOf('ESTUFA') >= 0) return true;
      if (name.indexOf('PINTURA') >= 0 && (name.indexOf('FORNO') >= 0 || name.indexOf('CURA') >= 0)) return true;
      return false;
    }

    function routeVisitsEstufa(route) {
      return (route || []).some(step => {
        if (!step || !step.machineId) return false;
        return machineRequiresEstufaGeometry(getMachineById(step.machineId));
      });
    }

    function joinPtList(items) {
      const list = (items || []).filter(Boolean);
      if (list.length <= 1) return list[0] || '';
      if (list.length === 2) return list[0] + ' e ' + list[1];
      return list.slice(0, -1).join(', ') + ' e ' + list[list.length - 1];
    }

    function hasExplicitMaxFardo(src) {
      const a = Number(src && src.peca_max_fardo);
      const b = Number(src && src.pecas_por_fardo);
      return (isFinite(a) && a >= 1) || (isFinite(b) && b >= 1);
    }

    function inspectEstufaPartDimGaps(src) {
      const missing = [];
      const h = pickPartDimMm(src, 'peca_altura_mm', 'peca_altura_m', 'altura_m');
      const w = pickPartDimMm(src, 'peca_largura_mm', 'peca_largura_m', 'largura_m');
      const d = pickPartDimMm(src, 'peca_comprimento_mm', 'peca_comprimento_m', 'comprimento_m');
      if (!(h > 0)) missing.push('Altura');
      if (!(w > 0)) missing.push('Largura');
      if (!(d > 0)) missing.push('Comprimento');
      if (!hasExplicitMaxFardo(src)) missing.push('Máx. Peças por Fardo/Gancheira');
      return missing;
    }

    function collectEstufaDimValidationIssues() {
      const seen = {};
      const issues = [];
      const pushEntity = (name, src) => {
        const label = String(name || src && (src.name || src.resultName) || '').trim();
        if (!label) return;
        const key = label.toUpperCase();
        if (seen[key]) return;
        seen[key] = true;
        const missing = inspectEstufaPartDimGaps(src || {});
        if (missing.length) issues.push({ name: label, missing });
      };
      (parts || []).forEach(p => {
        if (p && routeVisitsEstufa(p.route)) pushEntity(p.name, p);
      });
      (assemblyRules || []).forEach(r => {
        if (!r) return;
        const joinRoute = [{ machineId: r.machineId }].concat(r.route || []);
        if (routeVisitsEstufa(joinRoute)) pushEntity(r.resultName, r);
      });
      return issues;
    }

    function formatEstufaDimValidationMessage(issues) {
      const lines = [
        '⚠️ Não foi possível rodar a simulação da Estufa!',
        '',
        'Existem peças no pedido sem os dados geométricos preenchidos:',
        ''
      ];
      (issues || []).forEach(item => {
        lines.push('• Peça: ' + item.name);
        lines.push('  └ Faltando: ' + joinPtList(item.missing));
        lines.push('');
      });
      lines.push('Por favor, complete os cadastros na aba Engenharia para prosseguir.');
      return lines.join('\n');
    }

    function validateEstufaGeometryBeforeSimulation() {
      const issues = collectEstufaDimValidationIssues();
      if (!issues.length) return true;
      const msg = formatEstufaDimValidationMessage(issues);
      if (typeof showEstufaValidationModal === 'function') showEstufaValidationModal(msg);
      else alert(msg);
      return false;
    }

    function getEstufaCabin(machineId) {
      const m = getMachineById(machineId) || {};
      const h = Number(m.estufaAlturaM) > 0 ? Number(m.estufaAlturaM) : ESTUFA_CABIN_H;
      const w = Number(m.estufaLarguraM) > 0 ? Number(m.estufaLarguraM) : ESTUFA_CABIN_W;
      const d = Number(m.estufaProfundidadeM) > 0 ? Number(m.estufaProfundidadeM) : ESTUFA_CABIN_D;
      return { h, w, d, volume: h * w * d };
    }

    function findEntityByName(name, extraList) {
      const key = String(name || '').toUpperCase();
      if (!key) return null;
      const match = (p) => p && String(p.name || p.resultName || '').toUpperCase() === key;
      return (extraList || []).find(match)
        || findSimPart(key)
        || (parts || []).find(match)
        || (assemblyRules || []).find(match)
        || null;
    }

    function resolveFardoDimsForName(name, visited) {
      const key = String(name || '').toUpperCase();
      if (!key) return null;
      visited = visited || {};
      if (visited[key]) return null;
      visited[key] = true;
      const src = findEntityByName(key);
      if (src) {
        const d = normalizePartDims(src);
        if (hasPhysicalPartDims(d)) return d;
      }
      const rule = (assemblyRules || []).find(r => String(r.resultName || '').toUpperCase() === key);
      if (!rule) return null;
      let best = null;
      let bestVol = 0;
      (rule.requiredPartNames || []).forEach(n => {
        const d = resolveFardoDimsForName(n, visited);
        if (!d) return;
        const vol = Number(d.volume_fardo) || (d.peca_altura_m * d.peca_largura_m * d.peca_comprimento_m);
        if (vol > bestVol) {
          bestVol = vol;
          best = d;
        }
      });
      return best;
    }

    function inheritFardoDimsFromBom(part) {
      return resolveFardoDimsForName(part && (part.name || part.resultName));
    }

    function partFardoSpec(part, cabin) {
      const dims = normalizePartDims(part);
      if (hasPhysicalPartDims(dims)) return dims;
      const inherited = inheritFardoDimsFromBom(part);
      if (inherited && hasPhysicalPartDims(inherited)) return inherited;
      const cap = cabin || { h: ESTUFA_CABIN_H, w: ESTUFA_CABIN_W, d: ESTUFA_CABIN_D, volume: ESTUFA_CABIN_VOLUME };
      const capVol = cap.volume || (cap.h * cap.w * cap.d);
      const missing = normalizePartDims({
        peca_altura_m: cap.h,
        peca_largura_m: cap.w,
        peca_comprimento_m: cap.d,
        peca_max_fardo: dims.peca_max_fardo || 1,
        peca_espacamento_mm: dims.peca_espacamento_mm || 0
      });
      missing.missingDims = true;
      missing.volume_unitario_com_folga = capVol;
      missing.volume_fardo = capVol;
      return missing;
    }

    function partEffectiveQty(part) {
      return Math.max(1, (Number(part.qty) || 1) * (boxesQty || 1));
    }

    function partTotalFardos(part, cabin) {
      const spec = partFardoSpec(part, cabin);
      const perFardo = spec.peca_max_fardo || spec.pecas_por_fardo || 1;
      return Math.max(1, Math.ceil(partEffectiveQty(part) / perFardo));
    }

    function uniqueRotations(h, w, d) {
      const raw = [
        { h: h, w: w, d: d }, { h: h, w: d, d: w },
        { h: w, w: h, d: d }, { h: w, w: d, d: h },
        { h: d, w: h, d: w }, { h: d, w: w, d: h }
      ];
      const out = [];
      raw.forEach(r => {
        if (out.some(x => x.h === r.h && x.w === r.w && x.d === r.d)) return;
        out.push(r);
      });
      return out;
    }

    function boxesOverlap(a, b) {
      return a.x < b.x + b.w - 1e-9 && a.x + a.w > b.x + 1e-9 &&
        a.y < b.y + b.h - 1e-9 && a.y + a.h > b.y + 1e-9 &&
        a.z < b.z + b.d - 1e-9 && a.z + a.d > b.z + 1e-9;
    }

    function fardoFitsEmptyCabin(spec, cabin) {
      const box = fardoBoxDims(spec);
      return uniqueRotations(box.h, box.w, box.d)
        .some(r => r.h <= cabin.h + 1e-9 && r.w <= cabin.w + 1e-9 && r.d <= cabin.d + 1e-9);
    }

    function tryPlaceFardo(placed, spec, cabin) {
      if (!fardoFitsEmptyCabin(spec, cabin)) {
        return { forced: true, x: 0, y: 0, z: 0, w: cabin.w, h: cabin.h, d: cabin.d, volume: cabin.volume };
      }
      const points = [{ x: 0, y: 0, z: 0 }];
      placed.forEach(p => {
        points.push({ x: p.x + p.w, y: p.y, z: p.z });
        points.push({ x: p.x, y: p.y + p.h, z: p.z });
        points.push({ x: p.x, y: p.y, z: p.z + p.d });
      });
      let best = null;
      const boxDims = fardoBoxDims(spec);
      uniqueRotations(boxDims.h, boxDims.w, boxDims.d).forEach(rot => {
        if (rot.h > cabin.h + 1e-9 || rot.w > cabin.w + 1e-9 || rot.d > cabin.d + 1e-9) return;
        points.forEach(pt => {
          if (pt.x + rot.w > cabin.w + 1e-9) return;
          if (pt.y + rot.h > cabin.h + 1e-9) return;
          if (pt.z + rot.d > cabin.d + 1e-9) return;
          const box = { x: pt.x, y: pt.y, z: pt.z, w: rot.w, h: rot.h, d: rot.d };
          if (placed.some(ex => boxesOverlap(box, ex))) return;
          const better = !best ||
            box.z < best.z - 1e-9 ||
            (Math.abs(box.z - best.z) < 1e-9 && box.y < best.y - 1e-9) ||
            (Math.abs(box.z - best.z) < 1e-9 && Math.abs(box.y - best.y) < 1e-9 && box.x < best.x - 1e-9);
          if (better) best = box;
        });
      });
      if (!best) return null;
      best.volume = best.w * best.h * best.d;
      best.forced = false;
      return best;
    }

    function fillEstufaCabin(units, cabin) {
      const packed = [];
      const skipped = [];
      let volume = 0;
      units.forEach(unit => {
        if (volume >= cabin.volume - 1e-9) {
          skipped.push(unit);
          return;
        }
        const vf = unitFardoOccupancyVolume(unit, cabin);
        if (packed.length > 0 && volume + vf > cabin.volume + 1e-9) {
          skipped.push(unit);
          return;
        }
        const box = tryPlaceFardo(packed.map(p => p.box), unit.spec, cabin);
        if (!box) {
          skipped.push(unit);
          return;
        }
        if (box.forced) {
          if (packed.length) {
            skipped.push(unit);
            return;
          }
          packed.push(Object.assign({}, unit, { box: box }));
          volume = cabin.volume;
          return;
        }
        packed.push(Object.assign({}, unit, { box: box }));
        volume += vf;
        if (volume >= cabin.volume - 1e-9) volume = Math.min(volume, cabin.volume);
      });
      const occupancy = cabin.volume > 0 ? Math.min(1, volume / cabin.volume) : 0;
      return { packed, skipped, volume, occupancy };
    }

    function buildEstufaUnitQueue(waitingMembers, packedFardosMap, cabin) {
      const units = [];
      waitingMembers.forEach(mem => {
        const spec = partFardoSpec(mem.part, cabin);
        const total = partTotalFardos(mem.part, cabin);
        const done = packedFardosMap[mem.part.name] || 0;
        const left = Math.max(0, total - done);
        const perFardo = spec.peca_max_fardo || spec.pecas_por_fardo || 1;
        const qtyLeft = Math.max(0, partEffectiveQty(mem.part) - done * perFardo);
        for (let i = 0; i < left; i++) {
          const pieces = (i === left - 1)
            ? Math.max(1, qtyLeft - perFardo * (left - 1))
            : perFardo;
          units.push({
            part: mem.part,
            step: mem.step,
            stepIndex: mem.stepIndex,
            partIdx: mem.partIdx,
            arrivalTime: mem.arrivalTime,
            asm: mem.asm,
            spec,
            pieces,
            fardoIndex: done + i
          });
        }
      });
      return units;
    }

    function estufaJoinDependsOnWaiting(part, waitingSet) {
      return (part.route || []).some(step => {
        if (!isJoinStep(step)) return false;
        return joinRequerOf(step).some(n => waitingSet[n]);
      });
    }

    function hasFutureEstufaDemand(machineId, nextStepIndex, waitingSet, packedFardosMap) {
      const cabin = getEstufaCabin(machineId);
      return getSimParts().some(part => {
        const idx = (part.route || []).findIndex(s => s.machineId === machineId);
        if (idx < 0) return false;
        const stepIndex = nextStepIndex[part.name] || 0;
        if (stepIndex > idx) return false;
        if (stepIndex === idx) {
          const left = partTotalFardos(part, cabin) - (packedFardosMap[part.name] || 0);
          return left > 0 && !waitingSet[part.name];
        }
        if (estufaJoinDependsOnWaiting(part, waitingSet)) return false;
        return true;
      });
    }

    function collectEstufaWaitingMembers(machineId, nextStepIndex, partReady, readyTimeOfParts, estufaHeldUntil) {
      const members = [];
      getSimParts().forEach((part, partIdx) => {
        const stepIndex = nextStepIndex[part.name] || 0;
        if (stepIndex >= part.route.length) return;
        const step = part.route[stepIndex];
        if (!step || step.machineId !== machineId) return;
        if (isJoinStep(step) && !joinInputsCompleted(joinRequerOf(step), nextStepIndex, getSimParts())) return;
        const baseArrival = partReady[part.name] != null ? partReady[part.name] : getSimulationStartAbsMin();
        const arrivalTime = (estufaHeldUntil && estufaHeldUntil[part.name] != null)
          ? Math.max(baseArrival, estufaHeldUntil[part.name])
          : baseArrival;
        const asm = resolveAssemblyWait(part, step, arrivalTime, readyTimeOfParts, partReady, nextStepIndex);
        members.push({
          part,
          step,
          stepIndex,
          partIdx,
          arrivalTime,
          asm,
          readyForMachine: Math.max(arrivalTime, asm.assemblyGate)
        });
      });
      members.sort((a, b) =>
        ((Number(a.part.planOrder) || 0) - (Number(b.part.planOrder) || 0)) ||
        (a.readyForMachine - b.readyForMachine) ||
        (a.partIdx - b.partIdx)
      );
      return members;
    }

    function collectEstufaBatchCandidates(nextStepIndex, partReady, readyTimeOfParts, machineFreeUntil, packedFardosMap, forceResidual, estufaHeldUntil) {
      const seen = {};
      const candidates = [];
      getSimParts().forEach(part => {
        const stepIndex = nextStepIndex[part.name] || 0;
        if (stepIndex >= part.route.length) return;
        const step = part.route[stepIndex];
        if (!step || !isEstufaMachineId(step.machineId)) return;
        if (seen[step.machineId]) return;
        seen[step.machineId] = true;

        const cabin = getEstufaCabin(step.machineId);
        const waiting = collectEstufaWaitingMembers(step.machineId, nextStepIndex, partReady, readyTimeOfParts, estufaHeldUntil);
        if (!waiting.length) return;
        const waitingSet = {};
        waiting.forEach(m => { waitingSet[m.part.name] = true; });
        const units = buildEstufaUnitQueue(waiting, packedFardosMap, cabin);
        if (!units.length) return;
        const fill = fillEstufaCabin(units, cabin);
        if (!fill.packed.length) return;

        const moreDemand = hasFutureEstufaDemand(step.machineId, nextStepIndex, waitingSet, packedFardosMap);
        const packedAllWaiting = fill.skipped.length === 0;
        const full = fill.occupancy >= 1 - ESTUFA_FULL_EPS;
        let trigger = '';
        if (full) trigger = 'cheia';
        else if (!packedAllWaiting) trigger = 'cheia';
        else if (!moreDemand || forceResidual) trigger = 'residual';
        if (!trigger) return;

        const skuTags = [];
        fill.packed.forEach(u => {
          const sku = u.part.planProjectName || u.part.name;
          if (sku && skuTags.indexOf(sku) < 0) skuTags.push(sku);
        });
        if (skuTags.length > 1) trigger = 'mix';

        const lastArrival = fill.packed.reduce((max, u) => Math.max(max, u.arrivalTime), getSimulationStartAbsMin());
        const setupStart = snapToProductive(Math.max(machineFreeAt(machineFreeUntil, step.machineId), lastArrival));
        candidates.push({
          type: 'estufa',
          machineId: step.machineId,
          part: fill.packed[0].part,
          step: fill.packed[0].step,
          stepIndex: fill.packed[0].stepIndex,
          partIdx: fill.packed[0].partIdx || 0,
          setupStart,
          readyForMachine: lastArrival,
          packedUnits: fill.packed,
          occupancy: fill.occupancy,
          volume: fill.volume,
          trigger,
          skuTags,
          cabin
        });
      });
      return candidates;
    }

    function scheduleEstufaBatch(chosen, readyTimeOfParts, machineFreeUntil, machineOperated, events, maintEvents, partReady, nextStepIndex, packedFardosMap, cycleSeq, estufaHeldUntil) {
      const machineId = chosen.machineId;
      maybeInsertMaintenance(machineId, machineFreeUntil, machineOperated, maintEvents);
      const cycle = resolveEstufaCycleMinutes(getMachineById(machineId));
      const queimaMin = cycle.queima;
      const resfrioMin = cycle.resfrio;
      const thermalMin = queimaMin + resfrioMin;
      const start = snapToProductive(Math.max(machineFreeAt(machineFreeUntil, machineId), chosen.readyForMachine));
      const queimaEnd = addProductiveMinutes(start, queimaMin);
      const resfrioEnd = addProductiveMinutes(queimaEnd, resfrioMin);
      const batchId = 'estufa_' + machineId + '_' + cycleSeq.n;
      cycleSeq.n += 1;

      const byPart = {};
      const partOrder = [];
      chosen.packedUnits.forEach(u => {
        if (!byPart[u.part.name]) {
          byPart[u.part.name] = { unit: u, fardos: 0, pieces: 0 };
          partOrder.push(u.part.name);
        }
        byPart[u.part.name].fardos += 1;
        byPart[u.part.name].pieces += u.pieces;
      });

      let completedSteps = 0;
      let unloadCursor = resfrioEnd;
      let totalUnload = 0;
      partOrder.forEach(name => {
        const g = byPart[name];
        const part = g.unit.part;
        const step = g.unit.step;
        const stepIndex = g.unit.stepIndex;
        packedFardosMap[name] = (packedFardosMap[name] || 0) + g.fardos;
        const total = partTotalFardos(part, chosen.cabin);
        const doneAll = packedFardosMap[name] >= total;
        const unloadMin = estufaUnloadMinutes(step, g.pieces);
        const unloadStart = unloadCursor;
        const unloadEnd = addProductiveMinutes(unloadStart, unloadMin);
        totalUnload += unloadMin;
        events.push(buildProcessEvent(part, step, stepIndex, {
          qty: g.pieces,
          arrivalTime: g.unit.arrivalTime,
          assemblyGate: g.unit.asm.assemblyGate,
          setupStart: start,
          setupEnd: start,
          prodStart: start,
          end: unloadEnd,
          setupTime: 0,
          prodTime: thermalMin + unloadMin,
          waitingForAssembly: g.unit.asm.waitingForAssembly,
          isJoin: !!isJoinStep(step),
          skuName: part.planProjectName || part.name,
          requer: g.unit.asm.requer || [],
          isLastStep: doneAll && stepIndex === part.route.length - 1,
          isEstufaBatch: true,
          estufaBatchId: batchId,
          estufaTrigger: chosen.trigger,
          estufaOccupancyPct: Math.round(chosen.occupancy * 1000) / 10,
          estufaVolumeM3: Number(chosen.volume) || ((Number(chosen.cabin && chosen.cabin.volume) || ESTUFA_CABIN_VOLUME) * (Number(chosen.occupancy) || 0)),
          estufaCabinVolumeM3: Number(chosen.cabin && chosen.cabin.volume) || ESTUFA_CABIN_VOLUME,
          estufaQueimaEnd: queimaEnd,
          estufaResfrioEnd: resfrioEnd,
          estufaUnloadStart: unloadStart,
          estufaUnloadEnd: unloadEnd,
          estufaQueimaMin: queimaMin,
          estufaResfrioMin: resfrioMin,
          estufaSkuTags: chosen.skuTags.slice(),
          estufaFardos: g.fardos
        }));
        if (doneAll) {
          nextStepIndex[name] = stepIndex + 1;
          partReady[name] = unloadEnd;
          readyTimeOfParts[name + '_' + machineId] = unloadEnd;
          completedSteps += 1;
          if (estufaHeldUntil) delete estufaHeldUntil[name];
        } else if (estufaHeldUntil) {
          estufaHeldUntil[name] = unloadEnd;
        }
        unloadCursor = unloadEnd;
      });

      machineFreeUntil[machineId] = unloadCursor;
      machineOperated[machineId] = (machineOperated[machineId] || 0) + thermalMin + totalUnload;
      maybeInsertMaintenance(machineId, machineFreeUntil, machineOperated, maintEvents);
      return completedSteps;
    }

    function commitSingleStep(part, step, stepIndex, arrivalTime, asm, machineFreeUntil, machineOperated, readyTimeOfParts, events, maintEvents, partReady, nextStepIndex) {
      const setupTime = step.setup;
      const prodTime = step.prodUnit * (part.qty * boxesQty);
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
      // Avanço de etapa: se ainda há roteiro, a próxima máquina entra em FILA/PRODUÇÃO.
      // CONCLUÍDO / Aguardando União só após a última etapa individual (chão).
      nextStepIndex[part.name] = stepIndex + 1;
      readyTimeOfParts[`${part.name}_${step.machineId}`] = end;
      readyTimeOfParts[readyMapKey(part.name, step.machineId, stepIndex)] = end;
      logPartStepTransition(part, stepIndex, step, nextStepIndex[part.name], nextStepIndex);

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
        waitingForAssembly,
        isJoin: isJoinStep(step),
        skuName: part.name,
        requer: joinRequerOf(step)
      }));
    }

    /**
     * Despacho job-shop: agenda a próxima operação que pode começar mais cedo.
     * Assim, ao zerar o restante de uma etapa, a peça reivindica a próxima
     * máquina se ela estiver fisicamente livre — mesmo que outra peça listada
     * antes ainda esteja ocupada no setor anterior.
     */
    function collectScheduleCandidates(nextStepIndex, partReady, readyTimeOfParts, machineFreeUntil, groupedScheduled, ignoreAssembly, packedFardosMap, forceResidual, estufaHeldUntil) {
      const candidates = [];
      const simList = getSimParts();
      simList.forEach((part, partIdx) => {
        const stepIndex = nextStepIndex[part.name] || 0;
        if (stepIndex >= part.route.length) return;
        const step = part.route[stepIndex];
        if (isEstufaMachineId(step.machineId)) return;
        const groupRule = findGroupRuleForStep(part, step, stepIndex);
        const joinBlocked = isJoinStep(step) && !joinInputsCompleted(joinRequerOf(step), nextStepIndex, simList);
        if (joinBlocked) return;

        if (groupRule) {
          if (groupedScheduled[`${part.name}_${step.machineId}_${stepIndex}`]
            || groupedScheduled[`${part.name}_${step.machineId}`]) return;
          if (!allGroupMembersAtGroupedStep(groupRule, nextStepIndex)) return;
          if (part.name !== groupRepresentativeName(groupRule)) return;

          const members = collectGroupingMembers(groupRule, readyTimeOfParts, partReady, nextStepIndex);
          if (members.length === 0) return;
          if (!ignoreAssembly && members.some(m => !assemblyDependenciesMet(m.part, m.step, readyTimeOfParts, partReady, nextStepIndex))) return;

          const readyForMachine = members.reduce((max, m) => Math.max(max, m.readyForMachine), getSimulationStartAbsMin());
          const setupStart = snapToProductive(Math.max(machineFreeAt(machineFreeUntil, step.machineId), readyForMachine));
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

        if (isJoinStep(step)) {
          const requer = joinRequerOf(step);
          const arrivalTime = joinAvailableAt(requer, partReady);
          const asm = resolveAssemblyWait(part, step, arrivalTime, readyTimeOfParts, partReady, nextStepIndex);
          const readyForMachine = Math.max(arrivalTime, asm.assemblyGate);
          const firstArrival = (requer || []).reduce((min, n) => Math.min(min, partReady[n] != null ? partReady[n] : min), readyForMachine);
          const setupStart = snapToProductive(Math.max(readyForMachine, machineFreeAt(machineFreeUntil, step.machineId)));
          candidates.push({
            type: 'single',
            part,
            step,
            stepIndex,
            partIdx,
            arrivalTime: firstArrival,
            asm,
            setupStart,
            readyForMachine
          });
          return;
        }

        if (!ignoreAssembly && !assemblyDependenciesMet(part, step, readyTimeOfParts, partReady, nextStepIndex)) return;

        const arrivalTime = partReady[part.name] != null ? partReady[part.name] : getSimulationStartAbsMin();
        const asm = resolveAssemblyWait(part, step, arrivalTime, readyTimeOfParts, partReady, nextStepIndex);
        const readyForMachine = Math.max(arrivalTime, asm.assemblyGate);
        const setupStart = snapToProductive(Math.max(readyForMachine, machineFreeAt(machineFreeUntil, step.machineId)));
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
      collectEstufaBatchCandidates(
        nextStepIndex, partReady, readyTimeOfParts, machineFreeUntil, packedFardosMap || {}, !!forceResidual, estufaHeldUntil || {}
      ).forEach(c => candidates.push(c));
      return candidates;
    }

    function scheduleProductionEvents() {
      const machineFreeUntil = {};
      const machineOperated = {};
      const simParts = buildBomRuntimeParts();
      logJoinCadastroDiagnostics();
      const simMachines = getSimulationMachines();
      const t0 = getSimulationStartAbsMin();
      simMachines.forEach(m => {
        machineFreeUntil[m.id] = t0;
        machineOperated[m.id] = 0;
      });

      const readyTimeOfParts = {};
      const events = [];
      const maintEvents = [];
      const groupedScheduled = {};
      const packedFardosMap = {};
      const estufaHeldUntil = {};
      const estufaCycleSeq = { n: 1 };
      const partReady = {};
      const nextStepIndex = {};
      simParts.forEach(p => {
        const notBefore = Number(p.notBeforeAbsMin) > 0 ? Number(p.notBeforeAbsMin) : t0;
        partReady[p.name] = Math.max(t0, notBefore);
        nextStepIndex[p.name] = 0;
      });

      const totalSteps = simParts.reduce((n, p) => n + p.route.length, 0);
      let scheduledCount = 0;
      let ignoreAssembly = false;
      let guard = 0;
      const maxGuard = totalSteps + 800;

      while (scheduledCount < totalSteps && guard++ < maxGuard) {
        let candidates = collectScheduleCandidates(
          nextStepIndex, partReady, readyTimeOfParts, machineFreeUntil, groupedScheduled, ignoreAssembly, packedFardosMap, false, estufaHeldUntil
        );
        if (candidates.length === 0) {
          if (!ignoreAssembly) {
            ignoreAssembly = true;
            continue;
          }
          candidates = collectScheduleCandidates(
            nextStepIndex, partReady, readyTimeOfParts, machineFreeUntil, groupedScheduled, true, packedFardosMap, true, estufaHeldUntil
          );
          if (candidates.length === 0) break;
        }
        ignoreAssembly = false;
        candidates.sort((a, b) =>
          (a.setupStart - b.setupStart) ||
          ((Number(a.part && a.part.planOrder) || 0) - (Number(b.part && b.part.planOrder) || 0)) ||
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
            const part = findSimPart(name);
            const keyName = part ? part.name : name;
            const evt = groupedScheduled[`${keyName}_${chosen.groupRule.machineId}_${chosen.stepIndex}`]
              || groupedScheduled[`${keyName}_${chosen.groupRule.machineId}`]
              || groupedScheduled[`${name}_${chosen.groupRule.machineId}`];
            if (!evt) return;
            nextStepIndex[keyName] = evt.stepIndex + 1;
            if (name !== keyName) nextStepIndex[name] = evt.stepIndex + 1;
            partReady[keyName] = evt.end;
          });
          const added = events.length - before;
          if (added <= 0) break;
          scheduledCount += added;
        } else if (chosen.type === 'estufa') {
          const beforeFardos = Object.keys(packedFardosMap).reduce((n, k) => n + (packedFardosMap[k] || 0), 0);
          const completed = scheduleEstufaBatch(
            chosen,
            readyTimeOfParts,
            machineFreeUntil,
            machineOperated,
            events,
            maintEvents,
            partReady,
            nextStepIndex,
            packedFardosMap,
            estufaCycleSeq,
            estufaHeldUntil
          );
          const afterFardos = Object.keys(packedFardosMap).reduce((n, k) => n + (packedFardosMap[k] || 0), 0);
          if (afterFardos <= beforeFardos && completed <= 0) break;
          scheduledCount += completed;
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

      logJoinWaitDiagnostics(nextStepIndex, events);
      return { events, maintEvents };
    }

    function calculateSimulationHistory() {
      simulationHistory = [];
      rawEvents = [];
      maintenanceEvents = [];
      boxesQty = getBoxesQtyFromInput();
      startDateStr = getStartDateFromInput();
      getStartTimeFromInput();
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
            const waitReason = (evt.isJoin && evt.waitingForAssembly && absMin < evt.assemblyGate) ? 'waiting' : 'fila';
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
            const phase = estufaPhaseAt(evt, absMin);
            const estufaLabel = (evt.estufaSkuTags && evt.estufaSkuTags.length)
              ? evt.estufaSkuTags.join(' + ')
              : evt.partName;
            if (!mMaint) {
              snapshot.machinesStatus[evt.machineId] = {
                state: phase ? machineStateFromEstufaPhase(phase, isLunchTime) : (isLunchTime ? 'lunch' : 'working'),
                partName: evt.isEstufaBatch ? estufaLabel : evt.partName
              };
            }
            snapshot.partsActive.push({
              name: evt.partName,
              machineId: evt.machineId,
              status: isLunchTime ? 'lunch' : (phase ? phase.status : 'working'),
              remaining: remainingMinutesLabel(absMin, phase ? phase.until : evt.end)
            });
          }
        });

        getSimParts().forEach(part => {
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
                const phase = estufaPhaseAt(evt, absMin);
                status = isLunchTime ? 'lunch' : (phase ? phase.status : 'working');
                remaining = remainingMinutesLabel(absMin, phase ? phase.until : evt.end);
              } else if (absMin >= evt.setupStart && absMin < setupEnd) {
                status = isLunchTime ? 'lunch' : 'setup';
                remaining = remainingMinutesLabel(absMin, setupEnd);
              } else if (evt.isJoin && evt.waitingForAssembly && absMin < evt.assemblyGate) {
                status = isLunchTime ? 'lunch' : 'waiting';
              } else if (evt.isJoin && absMin < evt.setupStart) {
                status = isLunchTime ? 'lunch' : 'ready';
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
            } else if (hasRemainingIndividualSteps(part, partEvents, absMin)) {
              const lastDone = lastEvt;
              const nextStep = lastDone && typeof lastDone.stepIndex === 'number'
                ? part.route[lastDone.stepIndex + 1]
                : (part.route || [])[Math.max(0, partEvents.length)];
              const mObj = nextStep ? machines.find(m => m.id === nextStep.machineId) : null;
              row = {
                name: part.name,
                sector: mObj ? mObj.name : '-',
                operator: getMachineOperatorLabel(mObj),
                status: isLunchTime ? 'lunch' : 'fila',
                remaining: '-'
              };
            } else if (pendingJoinWaitForPart(part.name, absMin)) {
              const joinRule = (assemblyRules || []).find(r => joinRequerOf(r).some(n => namesEqual(n, part.name)));
              const mObj = joinRule ? machines.find(m => m.id === joinRule.machineId) : null;
              row = {
                name: part.name,
                sector: mObj ? mObj.name : '-',
                operator: getMachineOperatorLabel(mObj),
                status: isLunchTime ? 'lunch' : 'waiting',
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

        simulationHistory.push(snapshot);
      }

      if (simulationHistory[0] && (assemblyRules || []).length) {
        simulationHistory[0].floorRows.forEach(row => {
          if (!row || row.status !== 'waiting') return;
          if (hasUnfinishedOriginalIndividualWork(row.name, 0)) {
            console.warn('[JOIN] Peça "' + row.name + '" ainda tem processos individuais em ' +
              (row.sector || '?') + ' e não deveria aguardar união.');
            return;
          }
          const asSku = (assemblyRules || []).find(r => namesEqual(r.resultName, row.name));
          const asInput = (assemblyRules || []).find(r => joinRequerOf(r).some(n => namesEqual(n, row.name)));
          const rule = asSku || asInput;
          if (!rule) return;
          const pending = joinRequerOf(rule).filter(n => !namesEqual(n, row.name));
          console.log('[JOIN] Peça "' + row.name + '" na máquina ' + (row.sector || machineNameOf(rule.machineId) || '?') +
            ' aguarda insumos: ' + (pending.join(', ') || '—') + ' para formar ' + rule.resultName + '.');
        });
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
