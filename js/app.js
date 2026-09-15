/* SimulaFab v1.5.0 — Inicialização, playback e integração dos módulos */

    function startSimulation() {
      if (machines.length === 0 || parts.length === 0) {
        alert('Cadastre máquinas e peças nas etapas de engenharia.');
        return;
      }
      selectedDayIndex = 0;
      calculateSimulationHistory();
      document.getElementById('sim-boxes-qty').value = boxesQty;
      document.getElementById('sim-start-date').value = startDateStr;
      renderCharts();
      navigateTo('screen-sim');
      currentAbsSecond = 0;
      lastRenderedMinute = -1;
      isPlaying = true;
      updatePlayButtonUI();
      updateSpeedButtonsUI();
      renderAbsMinute(0, true);
      runLoop();
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
      if (currentAbsSecond >= maxSecond) currentAbsSecond = 0;
      isPlaying = true;
      updatePlayButtonUI();
      renderAbsMinute(getCurrentAbsMinute(), true);
      runLoop();
    }

    function stopSimulation() {
      isPlaying = false;
      updatePlayButtonUI();
      currentAbsSecond = 0;
      selectedDayIndex = 0;
      lastRenderedMinute = -1;
      const daySel = document.getElementById('day-select');
      if (daySel) daySel.value = '0';
      document.getElementById('timeline').value = 0;
      renderAbsMinute(0, true);
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
      const minuteInDay = Math.max(0, Math.min(MINUTES_PER_DAY - 1, parseInt(document.getElementById('timeline').value, 10) || 0));
      const absMin = Math.min(getMaxAbsMinute(), selectedDayIndex * MINUTES_PER_DAY + minuteInDay);
      currentAbsSecond = absMin * 60;
      lastRenderedMinute = -1;
      renderAbsMinute(getCurrentAbsMinute(), true);
    }

window.onload = () => {
  loadPersistedHolidays();
  if (!document.getElementById('start-date').value) {
    document.getElementById('start-date').value = todayISODate();
  }
  startDateStr = document.getElementById('start-date').value;
  renderConfigUI();
  updatePlayButtonUI();
  updateSpeedButtonsUI();
};
