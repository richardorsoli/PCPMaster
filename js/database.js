/* SimulaFab v1.6.2 — Persistência localStorage e import/export banco_dados.json */

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

    function mergeEntitiesById(baseList, extraList, normalizeItem) {
      const map = {};
      const order = [];
      function add(item, overwrite) {
        if (!item || !item.id) return;
        const norm = normalizeItem ? normalizeItem(item) : item;
        if (!map[norm.id]) {
          order.push(norm.id);
          map[norm.id] = norm;
        } else if (overwrite) {
          map[norm.id] = norm;
        }
      }
      (baseList || []).forEach(item => add(item, true));
      (extraList || []).forEach(item => add(item, false));
      return order.map(id => map[id]);
    }

    function collectMachinesFromProjects(projects) {
      let union = [];
      Object.keys(projects || {}).forEach(key => {
        const p = projects[key] || {};
        if (!Array.isArray(p.machines) || p.machines.length === 0) return;
        union = mergeEntitiesById(union, p.machines.map(normalizeMachine), normalizeMachine);
      });
      return union;
    }

    function collectEmployeesFromProjects(projects) {
      const normEmp = item => ({ id: item.id, name: item.name, matricula: item.matricula });
      let union = [];
      Object.keys(projects || {}).forEach(key => {
        const p = projects[key] || {};
        if (!Array.isArray(p.employees) || p.employees.length === 0) return;
        union = mergeEntitiesById(union, p.employees, normEmp);
      });
      return union;
    }

    function unionMachineLists() {
      let union = [];
      for (let i = 0; i < arguments.length; i++) {
        const list = arguments[i];
        if (!list || !list.length) continue;
        union = mergeEntitiesById(union, (list || []).map(normalizeMachine), normalizeMachine);
      }
      return union;
    }

    /** Catálogo mestre = união de wrap + todos os projetos salvos + sessão atual. */
    function getCatalogMachines() {
      const wrap = getDatabaseWrapper();
      return unionMachineLists(
        wrap.machines,
        collectMachinesFromProjects(wrap.projects),
        machines
      );
    }

    function resolveCatalogArrays(wrap, catalog, options, projectsForUnion) {
      const replaceCatalog = options && options.replaceCatalog;
      const projects = projectsForUnion || (wrap && wrap.projects) || {};
      if (replaceCatalog && catalog && typeof catalog === 'object') {
        const catalogEmployees = Array.isArray(catalog.employees)
          ? catalog.employees
          : ((wrap && wrap.employees) || []);
        const catalogMachines = Array.isArray(catalog.machines)
          ? catalog.machines.map(normalizeMachine)
          : ((wrap && wrap.machines) || []).map(normalizeMachine);
        return {
          employees: cloneJson(catalogEmployees, []),
          machines: unionMachineLists(catalogMachines, collectMachinesFromProjects(projects))
        };
      }
      return mergeGlobalCatalog(catalog, projects);
    }

    function mergeGlobalCatalog(catalog, projectsForUnion) {
      const wrap = getDatabaseWrapper();
      const projects = projectsForUnion || wrap.projects || {};
      const existingMachines = Array.isArray(wrap.machines) ? wrap.machines.map(normalizeMachine) : [];
      const incomingEmployees = catalog && Array.isArray(catalog.employees)
        ? catalog.employees
        : (employees || []);
      const incomingMachines = catalog && Array.isArray(catalog.machines)
        ? catalog.machines.map(normalizeMachine)
        : (machines || []).map(normalizeMachine);
      return {
        employees: cloneJson(incomingEmployees, []),
        machines: unionMachineLists(
          incomingMachines,
          existingMachines,
          collectMachinesFromProjects(projects)
        )
      };
    }

    function buildDatabasePayload(projects, catalog, options) {
      const wrap = getDatabaseWrapper();
      const projectMap = projects || wrap.projects || {};
      const resolved = resolveCatalogArrays(wrap, catalog, options, projectMap);
      return {
        app: 'SimulaFab',
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        holidays: holidays.slice(),
        employees: resolved.employees,
        machines: resolved.machines,
        projects: projectMap
      };
    }

    function persistDatabaseWrapper() {
      const wrap = getDatabaseWrapper();
      localStorage.setItem(
        DB_STORAGE_KEY,
        JSON.stringify(buildDatabasePayload(wrap.projects || {}, {
          employees,
          machines
        }))
      );
    }

    function persistHolidays() {
      const wrap = getDatabaseWrapper();
      setProjectsDatabase(wrap.projects || {}, mergeGlobalCatalog());
    }

    function persistBaseCatalog() {
      persistDatabaseWrapper();
    }

    function getGlobalMachineCatalog() {
      return getCatalogMachines();
    }

    function getCatalogMachinesAvailableForProject() {
      const inProject = {};
      (machines || []).forEach(m => {
        if (m && m.id) inProject[m.id] = true;
      });
      return getCatalogMachines().filter(m => m && m.id && !inProject[m.id]);
    }

    function hydrateProjectMachines(proj, catalogMachines) {
      const catalogList = (catalogMachines || []).map(normalizeMachine);
      const catalogMap = {};
      catalogList.forEach(m => {
        if (m && m.id) catalogMap[m.id] = m;
      });
      const ordered = [];
      const seen = {};

      function pushMachine(raw) {
        if (!raw || !raw.id || seen[raw.id]) return;
        seen[raw.id] = true;
        const cat = catalogMap[raw.id];
        ordered.push(normalizeMachine(cat ? { ...raw, ...cat } : raw));
      }

      (proj && Array.isArray(proj.machines) ? proj.machines : []).forEach(pushMachine);

      const usedIds = collectUsedMachineIds(
        proj && proj.parts,
        proj && proj.groupingRules,
        proj && proj.assemblyRules
      );
      Object.keys(usedIds).forEach(id => {
        if (!seen[id] && catalogMap[id]) pushMachine(catalogMap[id]);
      });

      return ordered;
    }

    function lookupMachine(id) {
      const inProject = (machines || []).find(m => m && m.id === id);
      if (inProject) return inProject;
      return getCatalogMachines().find(m => m && m.id === id) || null;
    }

    function getProjectsDatabase() {
      return getDatabaseWrapper().projects || {};
    }

    function setProjectsDatabase(projects, catalog, options) {
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(buildDatabasePayload(projects || {}, catalog, options)));
    }

    function deriveCatalogFromProjects(projects) {
      return {
        employees: collectEmployeesFromProjects(projects),
        machines: collectMachinesFromProjects(projects)
      };
    }

    function getBaseCatalogFromDatabase() {
      const wrap = getDatabaseWrapper();
      const fromProjects = deriveCatalogFromProjects(wrap.projects);
      const normEmp = item => ({ id: item.id, name: item.name, matricula: item.matricula });
      const catalogEmployees = mergeEntitiesById(
        mergeEntitiesById(employees || [], wrap.employees || [], normEmp),
        fromProjects.employees,
        normEmp
      );
      return {
        employees: cloneJson(catalogEmployees, []),
        machines: getCatalogMachines()
      };
    }

    function loadBaseCatalogIntoState() {
      const catalog = getBaseCatalogFromDatabase();
      employees = catalog.employees.length > 0 ? catalog.employees : cloneJson(employees, []);
      machines = (machines || []).map(normalizeMachine);
    }

    function loadEmployeesFromCatalog() {
      const catalog = getBaseCatalogFromDatabase();
      employees = catalog.employees.length > 0 ? catalog.employees : cloneJson(employees, []);
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
        machines: (machines || []).map(normalizeMachine),
        parts: cloneJson(parts, []),
        employees: cloneJson(employees, []),
        groupingRules: cloneJson(groupingRules, []),
        assemblyRules: (assemblyRules || []).map(normalizeAssemblyRule),
        startDate: document.getElementById('start-date').value || startDateStr || todayISODate(),
        startTime: startTimeStr || DEFAULT_START_TIME,
        boxesQty: getBoxesQtyFromInput()
      };
    }

    function persistSavedProject(name) {
      const trimmed = String(name || '').trim();
      if (!trimmed) return false;
      const saved = getProjectsDatabase();
      saved[trimmed] = buildCurrentProjectData(trimmed);
      currentProjectName = trimmed;
      setProjectsDatabase(saved, { employees, machines });
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
      const catalog = getBaseCatalogFromDatabase();
      machines = hydrateProjectMachines(proj, catalog.machines);
      employees = mergeEntitiesById(
        catalog.employees,
        Array.isArray(proj.employees) ? proj.employees : [],
        item => ({ id: item.id, name: item.name, matricula: item.matricula })
      );
      parts = cloneJson(proj.parts || [], []);
      groupingRules = cloneJson(proj.groupingRules || [], []);
      assemblyRules = (proj.assemblyRules || []).map(normalizeAssemblyRule);
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
      applyStartTimeToState(proj.startTime || DEFAULT_START_TIME);
      if (proj.boxesQty) {
        const boxesEl = document.getElementById('boxes-qty');
        if (boxesEl) boxesEl.value = proj.boxesQty;
      }
      persistBaseCatalog();
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
      setProjectsDatabase(saved, { employees, machines });
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
        if (p && Array.isArray(p.assemblyRules)) {
          p.assemblyRules = p.assemblyRules.map(normalizeAssemblyRule);
        }
      });

      let catalogEmployees = Array.isArray(parsed.employees) ? parsed.employees.slice() : [];
      let catalogMachines = Array.isArray(parsed.machines) ? parsed.machines.map(normalizeMachine) : [];
      const derived = deriveCatalogFromProjects(projects);
      catalogEmployees = mergeEntitiesById(
        catalogEmployees,
        derived.employees,
        item => ({ id: item.id, name: item.name, matricula: item.matricula })
      );
      catalogMachines = unionMachineLists(catalogMachines, derived.machines);

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
          employees = cloneJson(importedEmployees || [], []);
          machines = [];
          currentBuildingRoute = [];
          editingPartIndex = -1;
          editingMachineIndex = -1;
          editingEmployeeIndex = -1;
          editingGroupingIndex = -1;
          editingAssemblyIndex = -1;
          setProjectsDatabase(projects, {
            employees,
            machines: importedMachines
          }, { replaceCatalog: true });
          if (currentProjectName && !projects[currentProjectName]) currentProjectName = '';
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
