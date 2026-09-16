/* SimulaFab v1.6.3 — Inicialização, playback e integração dos módulos */

    function syncSimHeaderFields() {
      const simBoxes = document.getElementById('sim-boxes-qty');
      const simDate = document.getElementById('sim-start-date');
      if (simBoxes) simBoxes.value = boxesQty;
      if (simDate) simDate.value = startDateStr;
      syncStartTimeInputs(startTimeStr || DEFAULT_START_TIME);
    }

    function seekPlaybackToDayStart(dayIndex) {
      const absMin = getDayPlaybackStartAbsMin(dayIndex);
      selectedDayIndex = Math.floor(absMin / MINUTES_PER_DAY);
      currentAbsSecond = absMin * 60;
      lastRenderedMinute = -1;
      const daySel = document.getElementById('day-select');
      if (daySel) daySel.value = String(selectedDayIndex);
      const timeline = document.getElementById('timeline');
      if (timeline) timeline.value = String(absMin % MINUTES_PER_DAY);
      return absMin;
    }

    function startSimulation() {
      if (machines.length === 0 || parts.length === 0) {
        alert('Cadastre máquinas e peças nas etapas de engenharia.');
        return;
      }
      selectedDayIndex = 0;
      getStartTimeFromInput();
      calculateSimulationHistory();
      syncSimHeaderFields();
      renderCharts();
      navigateTo('screen-sim');
      const absMin = seekPlaybackToDayStart(0);
      isPlaying = true;
      updatePlayButtonUI();
      updateSpeedButtonsUI();
      renderAbsMinute(absMin, true);
      runLoop();
    }

    let liveRecalcTimer = null;

    function isSimScreenActive() {
      const sim = document.getElementById('screen-sim');
      return !!(sim && sim.classList.contains('active'));
    }

    function recalculateSimulationLive(options) {
      if (!isSimScreenActive()) return;
      if (machines.length === 0 || parts.length === 0) return;
      isPlaying = false;
      updatePlayButtonUI();
      const prevAbs = getCurrentAbsMinute();
      calculateSimulationHistory();
      syncSimHeaderFields();
      let absMin;
      if (options && options.seekToStart) {
        absMin = seekPlaybackToDayStart(selectedDayIndex === 0 ? 0 : selectedDayIndex);
      } else {
        absMin = Math.max(0, Math.min(getMaxAbsMinute(), prevAbs));
        currentAbsSecond = absMin * 60;
        lastRenderedMinute = -1;
      }
      renderCharts();
      renderAbsMinute(absMin, true);
    }

    function onSimBoxesQtyInput() {
      const el = document.getElementById('sim-boxes-qty');
      const raw = el && String(el.value).trim();
      if (raw === '' || raw === '-') return;
      clearTimeout(liveRecalcTimer);
      liveRecalcTimer = setTimeout(recalculateSimulationLive, 280);
    }

    function onSimBoxesQtyChange() {
      clearTimeout(liveRecalcTimer);
      recalculateSimulationLive();
    }

    function onSimStartTimeChange() {
      clearTimeout(liveRecalcTimer);
      getStartTimeFromInput();
      recalculateSimulationLive({ seekToStart: true });
    }

    function runLoop() {
      clearInterval(timerInterval);
      const tickMs = getTickIntervalMs();
      const stepSeconds = getSecondsPerTick();
      timerInterval = setInterval(() => {
        if (!isPlaying) return;
        const maxSecond = getMaxAbsSecond();
        currentAbsSecond += stepSeconds;
        if (currentAbsSecond > maxSecond) {
          currentAbsSecond = maxSecond;
          isPlaying = false;
          updatePlayButtonUI();
        }
        renderAbsMinute(getCurrentAbsMinute(), false);
        renderClockOnly();
      }, tickMs);
    }

    function setSimulationSpeed(speed) {
      const allowed = [1, 5, 10];
      simulationSpeed = allowed.includes(Number(speed)) ? Number(speed) : 1;
      updateSpeedButtonsUI();
      if (isPlaying) runLoop();
    }

    function togglePlayPause() {
      if (isPlaying) {
        isPlaying = false;
        updatePlayButtonUI();
        return;
      }
      const maxSecond = getMaxAbsSecond();
      if (currentAbsSecond >= maxSecond) seekPlaybackToDayStart(0);
      isPlaying = true;
      updatePlayButtonUI();
      renderAbsMinute(getCurrentAbsMinute(), true);
      runLoop();
    }

    function stopSimulation() {
      isPlaying = false;
      updatePlayButtonUI();
      const absMin = seekPlaybackToDayStart(0);
      renderAbsMinute(absMin, true);
      renderClockOnly();
    }

    function stepMinute(delta) {
      isPlaying = false;
      updatePlayButtonUI();
      let absMin = getCurrentAbsMinute() + delta;
      absMin = Math.max(0, Math.min(getMaxAbsMinute(), absMin));
      currentAbsSecond = absMin * 60;
      selectedDayIndex = Math.floor(absMin / MINUTES_PER_DAY);
      renderAbsMinute(absMin, true);
    }

    function onTimelineChange(val) {
      isPlaying = false;
      updatePlayButtonUI();
      const minuteInDay = Math.max(0, Math.min(MINUTES_PER_DAY - 1, parseInt(val, 10) || 0));
      const absMin = Math.min(getMaxAbsMinute(), selectedDayIndex * MINUTES_PER_DAY + minuteInDay);
      currentAbsSecond = absMin * 60;
      lastRenderedMinute = -1;
      renderAbsMinute(absMin, true);
      renderClockOnly();
    }

    function onDaySelectChange() {
      isPlaying = false;
      updatePlayButtonUI();
      selectedDayIndex = parseInt(document.getElementById('day-select').value, 10) || 0;
      const absMin = seekPlaybackToDayStart(selectedDayIndex);
      renderAbsMinute(absMin, true);
    }

window.onload = () => {
  loadPersistedHolidays();
  if (!document.getElementById('start-date').value) {
    document.getElementById('start-date').value = todayISODate();
  }
  startDateStr = document.getElementById('start-date').value;
  applyStartTimeToState(document.getElementById('start-time') && document.getElementById('start-time').value);
  document.title = 'SimulaFab v' + APP_VERSION;
  console.info('SimulaFab v' + APP_VERSION + ' — Sprint 7 Batch 3 (Analytics & Indicadores)');
  renderConfigUI();
  updatePlayButtonUI();
  updateSpeedButtonsUI();
};
