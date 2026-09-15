/* SimulaFab v1.4.3 — Persistência localStorage e import/export banco_dados.json */

const DB_STORAGE_KEY = 'simulafab_projects_v4';

    function getDatabaseWrapper() {
      try {
        const raw = JSON.parse(localStorage.getItem(DB_STORAGE_KEY) || '{}');
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          return { holidays: [], projects: {} };
        }
        if (raw.projects && typeof raw.projects === 'object' && !Array.isArray(raw.projects)) {
          return {
            holidays: Array.isArray(raw.holidays) ? raw.holidays.slice() : [],
            projects: raw.projects
          };
        }
        const keys = Object.keys(raw);
        const looksLikeProjects = keys.length === 0 || keys.every(k => {
          const p = raw[k];
          return p && typeof p === 'object' && (Array.isArray(p.machines) || Array.isArray(p.parts) || p.name);
        });
        if (looksLikeProjects) {
          return { holidays: holidays.slice(), projects: raw };
        }
        return { holidays: [], projects: {} };
      } catch (e) {
        return { holidays: [], projects: {} };
      }
    }

    function persistDatabaseWrapper() {
      const wrap = getDatabaseWrapper();
      const payload = {
        app: 'SimulaFab',
        version: '1.4.3',
        exportedAt: new Date().toISOString(),
        holidays: holidays.slice(),
        projects: wrap.projects || {}
      };
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(payload));
    }

    function getProjectsDatabase() {
      return getDatabaseWrapper().projects || {};
    }

    function setProjectsDatabase(projects) {
      const payload = {
        app: 'SimulaFab',
        version: '1.4.3',
        exportedAt: new Date().toISOString(),
        holidays: holidays.slice(),
        projects: projects || {}
      };
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(payload));
    }

    function saveProjectPrompt() {
      const name = prompt('Nome para salvar o projeto:');
      if (!name) return;
      const projectData = {
        name,
        machines: machines.map(normalizeMachine),
        parts,
        employees: employees.slice(),
        groupingRules,
        assemblyRules,
        startDate: document.getElementById('start-date').value || startDateStr || todayISODate(),
        boxesQty: getBoxesQtyFromInput()
      };
      const saved = getProjectsDatabase();
      saved[name] = projectData;
      setProjectsDatabase(saved);
      alert(`Projeto "${name}" salvo!`);
      updateSavedProjectsSelect();
    }

    function updateSavedProjectsSelect() {
      const select = document.getElementById('saved-projects-select');
      select.innerHTML = '<option value="">-- Selecione um Projeto --</option>';
      const saved = getProjectsDatabase();
      Object.keys(saved).forEach(k => select.innerHTML += `<option value="${k}">${k}</option>`);
    }

    function loadSelectedProject() {
      const val = document.getElementById('saved-projects-select').value;
      if (!val) return;
      const saved = getProjectsDatabase();
      const proj = saved[val];
      if (proj) {
        machines = (proj.machines || []).map(normalizeMachine);
        parts = proj.parts || [];
        employees = Array.isArray(proj.employees) ? proj.employees.slice() : [];
        groupingRules = proj.groupingRules || [];
        assemblyRules = proj.assemblyRules || [];
        if (proj.startDate) {
          startDateStr = proj.startDate;
          document.getElementById('start-date').value = proj.startDate;
        }
        if (proj.boxesQty) document.getElementById('boxes-qty').value = proj.boxesQty;
        renderConfigUI();
        navigateTo('screen-config');
      }
    }

    function exportDatabaseJSON() {
      const saved = getProjectsDatabase();
      const payload = {
        app: 'SimulaFab',
        version: '1.4.3',
        exportedAt: new Date().toISOString(),
        holidays: holidays.slice(),
        projects: saved
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'banco_dados.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function normalizeImportedDatabase(parsed) {
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('JSON inválido: esperado um objeto de banco de dados.');
      }
      let projects = {};
      let importedHolidays = [];

      if (parsed.projects && typeof parsed.projects === 'object' && !Array.isArray(parsed.projects)) {
        projects = parsed.projects;
        if (Array.isArray(parsed.holidays)) importedHolidays = parsed.holidays.slice();
      } else {
        const keys = Object.keys(parsed);
        if (keys.length === 0) {
          projects = {};
        } else {
          const looksLikeProjects = keys.every(k => {
            const p = parsed[k];
            return p && typeof p === 'object' && (Array.isArray(p.machines) || Array.isArray(p.parts) || p.name);
          });
          if (!looksLikeProjects) throw new Error('JSON inválido: não contém a estrutura de projetos do SimulaFab.');
          projects = parsed;
        }
      }

      Object.keys(projects).forEach(k => {
        const p = projects[k];
        if (p && Array.isArray(p.machines)) {
          p.machines = p.machines.map(normalizeMachine);
        }
        if (p && !Array.isArray(p.employees)) {
          p.employees = [];
        }
      });

      return { projects, holidays: importedHolidays };
    }

    function importDatabaseJSON(event) {
      const input = event.target;
      const file = input.files && input.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          const { projects, holidays: importedHolidays } = normalizeImportedDatabase(parsed);
          const count = Object.keys(projects).length;
          const current = getProjectsDatabase();
          const currentCount = Object.keys(current).length;

          const msg = currentCount > 0
            ? `Importar "${file.name}"?\n\nIsso SUBSTITUIRÁ o banco atual (${currentCount} projeto(s)) por ${count} projeto(s) do arquivo.`
            : `Importar "${file.name}" com ${count} projeto(s)?`;

          if (!confirm(msg)) {
            input.value = '';
            return;
          }

          holidays = importedHolidays || [];
          setProjectsDatabase(projects);
          updateSavedProjectsSelect();
          renderHolidaysList();
          alert(`Banco de dados carregado com sucesso!\n${count} projeto(s) | ${holidays.length} feriado(s).`);
        } catch (err) {
          alert('Falha ao importar o JSON.\n' + (err.message || err));
        } finally {
          input.value = '';
        }
      };
      reader.onerror = () => {
        alert('Não foi possível ler o arquivo.');
        input.value = '';
      };
      reader.readAsText(file, 'UTF-8');
    }

function loadPersistedHolidays() {
  const wrap = getDatabaseWrapper();
  holidays = Array.isArray(wrap.holidays) ? wrap.holidays.slice() : [];
  if (wrap.projects && Object.keys(wrap.projects).length >= 0) {
    persistDatabaseWrapper();
  }
}
