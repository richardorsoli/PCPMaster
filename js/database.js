/* SimulaFab v1.4.3 — Persistência localStorage e import/export banco_dados.json */

const DB_STORAGE_KEY = 'simulafab_projects_v4';

    function emptyDatabaseWrapper() {
      return { holidays: [], employees: [], machines: [], projects: {} };
    }

    function getDatabaseWrapper() {
      try {
        const raw = JSON.parse(localStorage.getItem(DB_STORAGE_KEY) || '{}');
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          return emptyDatabaseWrapper();
        }
        if (raw.projects && typeof raw.projects === 'object' && !Array.isArray(raw.projects)) {
          return {
            holidays: Array.isArray(raw.holidays) ? raw.holidays.slice() : [],
            employees: Array.isArray(raw.employees) ? raw.employees.slice() : [],
            machines: Array.isArray(raw.machines) ? raw.machines.map(normalizeMachine) : [],
            projects: raw.projects
          };
        }
        const keys = Object.keys(raw);
        const looksLikeProjects = keys.length === 0 || keys.every(k => {
          const p = raw[k];
          return p && typeof p === 'object' && (Array.isArray(p.machines) || Array.isArray(p.parts) || p.name);
        });
        if (looksLikeProjects) {
          return {
            holidays: holidays.slice(),
            employees: [],
            machines: [],
            projects: raw
          };
        }
        return emptyDatabaseWrapper();
      } catch (e) {
        return emptyDatabaseWrapper();
      }
    }

    function resolveCatalogArrays(wrap, catalog) {
      const source = catalog || {};
      const catalogEmployees = Array.isArray(source.employees)
        ? source.employees
        : (employees.length ? employees : ((wrap && wrap.employees) || []));
      const catalogMachines = Array.isArray(source.machines)
        ? source.machines
        : (machines.length ? machines : ((wrap && wrap.machines) || []));
      return {
        employees: cloneJson(catalogEmployees, []),
        machines: (catalogMachines || []).map(normalizeMachine)
      };
    }

    function buildDatabasePayload(projects, catalog) {
      const wrap = getDatabaseWrapper();
      const resolved = resolveCatalogArrays(wrap, catalog);
      return {
        app: 'SimulaFab',
        version: '1.4.3',
        exportedAt: new Date().toISOString(),
        holidays: holidays.slice(),
        employees: resolved.employees,
        machines: resolved.machines,
        projects: projects || wrap.projects || {}
      };
    }

    function persistDatabaseWrapper() {
      const wrap = getDatabaseWrapper();
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(buildDatabasePayload(wrap.projects || {})));
    }

    function persistBaseCatalog() {
      persistDatabaseWrapper();
    }

    function getProjectsDatabase() {
      return getDatabaseWrapper().projects || {};
    }

    function setProjectsDatabase(projects, catalog) {
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(buildDatabasePayload(projects || {}, catalog)));
    }

    function deriveCatalogFromProjects(projects) {
      const list = projects || {};
      let best = null;
      let bestScore = -1;
      Object.keys(list).forEach(k => {
        const p = list[k] || {};
        const score = (Array.isArray(p.machines) ? p.machines.length : 0)
          + (Array.isArray(p.employees) ? p.employees.length : 0);
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      });
      if (!best) return { employees: [], machines: [] };
      return {
        employees: cloneJson(best.employees || [], []),
        machines: (best.machines || []).map(normalizeMachine)
      };
    }

    function getBaseCatalogFromDatabase() {
      const wrap = getDatabaseWrapper();
      let catalogEmployees = Array.isArray(wrap.employees) ? wrap.employees : [];
      let catalogMachines = Array.isArray(wrap.machines) ? wrap.machines : [];
      if (catalogEmployees.length === 0 && catalogMachines.length === 0) {
        const derived = deriveCatalogFromProjects(wrap.projects);
        catalogEmployees = derived.employees;
        catalogMachines = derived.machines;
      }
      if (catalogEmployees.length === 0 && employees.length > 0) {
        catalogEmployees = employees;
      }
      if (catalogMachines.length === 0 && machines.length > 0) {
        catalogMachines = machines;
      }
      return {
        employees: cloneJson(catalogEmployees, []),
        machines: (catalogMachines || []).map(normalizeMachine)
      };
    }

    function loadBaseCatalogIntoState() {
      if (machines.length === 0 && employees.length === 0) {
        const catalog = getBaseCatalogFromDatabase();
        employees = catalog.employees;
        machines = catalog.machines;
        return;
      }
      machines = machines.map(normalizeMachine);
      employees = cloneJson(employees, []);
    }

    const SAVE_OVERWRITE_MSG = 'Já existe uma versão salva deste projeto. Deseja sobrescrever os dados existentes?';

    function cloneJson(value, fallback) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (e) {
        return fallback;
      }
    }

    function buildCurrentProjectData(name) {
      return {
        name,
        machines: machines.map(normalizeMachine),
        parts: cloneJson(parts, []),
        employees: cloneJson(employees, []),
        groupingRules: cloneJson(groupingRules, []),
        assemblyRules: cloneJson(assemblyRules, []),
        startDate: document.getElementById('start-date').value || startDateStr || todayISODate(),
        boxesQty: getBoxesQtyFromInput()
      };
    }

    function persistSavedProject(name) {
      const trimmed = String(name || '').trim();
      if (!trimmed) return false;
      const saved = getProjectsDatabase();
      saved[trimmed] = buildCurrentProjectData(trimmed);
      currentProjectName = trimmed;
      setProjectsDatabase(saved);
      if (typeof refreshSavedProjectsUI === 'function') refreshSavedProjectsUI();
      return true;
    }

    function promptSaveAsNew(saved, suggested) {
      const name = prompt('Nome para salvar o projeto:', suggested || '');
      if (name === null) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      if (saved[trimmed]) {
        const overwrite = confirm(SAVE_OVERWRITE_MSG);
        if (!overwrite) {
          promptSaveAsNew(saved, trimmed);
          return;
        }
      }
      persistSavedProject(trimmed);
      alert(`Projeto "${trimmed}" salvo!`);
    }

    function saveProjectPrompt() {
      const saved = getProjectsDatabase();
      const assigned = (currentProjectName || '').trim();

      if (assigned && saved[assigned]) {
        const overwrite = confirm(SAVE_OVERWRITE_MSG);
        if (overwrite) {
          persistSavedProject(assigned);
          alert(`Projeto "${assigned}" sobrescrito!`);
          return;
        }
        promptSaveAsNew(saved, assigned);
        return;
      }

      promptSaveAsNew(saved, assigned);
    }

    function updateSavedProjectsSelect() {
      const select = document.getElementById('saved-projects-select');
      if (!select) return;
      const previous = select.value;
      select.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '-- Selecione um Projeto --';
      select.appendChild(placeholder);
      const saved = getProjectsDatabase();
      Object.keys(saved).sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        select.appendChild(opt);
      });
      if (previous && saved[previous]) select.value = previous;
    }

    function applyProjectToState(name, proj) {
      currentProjectName = name;
      machines = (proj.machines || []).map(normalizeMachine);
      parts = cloneJson(proj.parts || [], []);
      employees = Array.isArray(proj.employees) ? cloneJson(proj.employees, []) : [];
      groupingRules = cloneJson(proj.groupingRules || [], []);
      assemblyRules = cloneJson(proj.assemblyRules || [], []);
      currentBuildingRoute = [];
      editingPartIndex = -1;
      editingMachineIndex = -1;
      editingEmployeeIndex = -1;
      editingGroupingIndex = -1;
      editingAssemblyIndex = -1;
      if (proj.startDate) {
        startDateStr = proj.startDate;
        const startEl = document.getElementById('start-date');
        if (startEl) startEl.value = proj.startDate;
      }
      if (proj.boxesQty) {
        const boxesEl = document.getElementById('boxes-qty');
        if (boxesEl) boxesEl.value = proj.boxesQty;
      }
    }

    function loadSavedProjectByName(name) {
      if (!name) return;
      const saved = getProjectsDatabase();
      const proj = saved[name];
      if (!proj) {
        alert('Projeto não encontrado.');
        return;
      }
      applyProjectToState(name, proj);
      renderConfigUI();
      navigateTo('screen-config');
    }

    function loadSelectedProject() {
      const select = document.getElementById('saved-projects-select');
      const val = select ? select.value : '';
      if (!val) {
        alert('Selecione um projeto salvo para carregar.');
        return;
      }
      loadSavedProjectByName(val);
    }

    function deleteSavedProject(name) {
      if (!name) return;
      if (!confirm(`Tem certeza que deseja apagar o projeto "${name}"?`)) return;
      const saved = getProjectsDatabase();
      if (!saved[name]) {
        alert('Projeto não encontrado.');
        return;
      }
      delete saved[name];
      setProjectsDatabase(saved);
      if (currentProjectName === name) currentProjectName = '';
      if (typeof refreshSavedProjectsUI === 'function') refreshSavedProjectsUI();
    }

    function deleteSelectedSavedProject() {
      const select = document.getElementById('saved-projects-select');
      const val = select ? select.value : '';
      if (!val) {
        alert('Selecione um projeto salvo para excluir.');
        return;
      }
      deleteSavedProject(val);
    }

    function exportDatabaseJSON() {
      persistDatabaseWrapper();
      const payload = buildDatabasePayload(getProjectsDatabase());
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'banco_dados.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return payload;
    }

    function updateDatabaseJSONFromStorage() {
      persistDatabaseWrapper();
      const assigned = (currentProjectName || '').trim();
      if (assigned) persistSavedProject(assigned);
      exportDatabaseJSON();
      alert('banco_dados.json gerado a partir do estado atual do navegador (localStorage).\nSalve o arquivo na pasta do SimulaFab para atualizar a cópia local.');
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

      let catalogEmployees = Array.isArray(parsed.employees) ? parsed.employees.slice() : [];
      let catalogMachines = Array.isArray(parsed.machines) ? parsed.machines.map(normalizeMachine) : [];
      if (catalogEmployees.length === 0 && catalogMachines.length === 0) {
        const derived = deriveCatalogFromProjects(projects);
        catalogEmployees = derived.employees;
        catalogMachines = derived.machines;
      }

      return {
        projects,
        holidays: importedHolidays,
        employees: cloneJson(catalogEmployees, []),
        machines: (catalogMachines || []).map(normalizeMachine)
      };
    }

    function importDatabaseJSON(event) {
      const input = event.target;
      const file = input.files && input.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          const {
            projects,
            holidays: importedHolidays,
            employees: importedEmployees,
            machines: importedMachines
          } = normalizeImportedDatabase(parsed);
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
          setProjectsDatabase(projects, {
            employees: importedEmployees || [],
            machines: importedMachines || []
          });
          if (currentProjectName && !projects[currentProjectName]) currentProjectName = '';
          if (machines.length === 0 && employees.length === 0) {
            employees = cloneJson(importedEmployees || [], []);
            machines = (importedMachines || []).map(normalizeMachine);
          }
          if (typeof refreshSavedProjectsUI === 'function') refreshSavedProjectsUI();
          if (typeof renderConfigUI === 'function') renderConfigUI();
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
  loadBaseCatalogIntoState();
  persistDatabaseWrapper();
}
