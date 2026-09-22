/* PCPMaster v1.8.0 — Persistência localStorage (schema v2.0) e backup/restauração */

const LEGACY_DB_STORAGE_KEY = 'simulafab_projects_v4';
const DB_STORAGE_KEY = 'pcpmaster_db_v2';

    function emptyDatabaseWrapper() {
      return {
        holidays: [],
        employees: [],
        machines: [],
        projects: {},
        turnos: defaultShiftRows(),
        historicoOtimizacao: [],
        planosProducao: [],
        metadados: buildDbMetadata()
      };
    }

    function normalizeOptimizationScenario(sc, rank) {
      if (!sc || typeof sc !== 'object') return null;
      const sequence = Array.isArray(sc.sequence)
        ? sc.sequence.map(n => String(n || '').trim()).filter(Boolean)
        : [];
      if (!sequence.length) return null;
      const scoreNum = Number(sc.score);
      return {
        rank: Number(sc.rank) > 0 ? Number(sc.rank) : (rank || 1),
        score: isNaN(scoreNum) ? 0 : scoreNum,
        makespan: Number(sc.makespan) || 0,
        idle: Number(sc.idle) || 0,
        sequence: sequence,
        strategy: String(sc.strategy || '')
      };
    }

    function normalizeHistoricoOtimizacao(list) {
      if (!Array.isArray(list)) return [];
      return list.map((row, i) => {
        if (!row || typeof row !== 'object') return null;
        const top3 = (Array.isArray(row.top3) ? row.top3 : [])
          .map((sc, idx) => normalizeOptimizationScenario(sc, idx + 1))
          .filter(Boolean)
          .slice(0, 3);
        if (!top3.length) return null;
        return {
          id: row.id || ('opt_' + i + '_' + Date.now()),
          sku: String(row.sku || '').trim(),
          projectName: String(row.projectName || '').trim(),
          boxesQty: Number(row.boxesQty) > 0 ? Number(row.boxesQty) : 1,
          startTime: String(row.startTime || ''),
          iterations: Number(row.iterations) || 0,
          updatedAt: String(row.updatedAt || ''),
          top3: top3
        };
      }).filter(row => row && (row.sku || row.projectName));
    }

    function normalizePlanQueueItem(item, idx) {
      if (!item || typeof item !== 'object') return null;
      const projectName = String(item.projectName || item.sku || '').trim();
      if (!projectName) return null;
      const boxes = Number(item.boxesQty);
      const startDate = String(item.startDate || '').trim();
      const startTime = String(item.startTime || '').trim();
      return {
        id: item.id || ('q_' + idx + '_' + Date.now()),
        projectName,
        boxesQty: isNaN(boxes) || boxes < 1 ? 1 : Math.min(999, Math.round(boxes)),
        startDate: startDate,
        startTime: startTime
      };
    }

    function normalizePlanoProducao(row, idx) {
      if (!row || typeof row !== 'object') return null;
      const name = String(row.name || row.sku || '').trim();
      if (!name) return null;
      const queue = (Array.isArray(row.queue) ? row.queue : [])
        .map((item, i) => normalizePlanQueueItem(item, i))
        .filter(Boolean);
      return {
        id: row.id || ('plan_' + idx + '_' + Date.now()),
        name,
        startDate: String(row.startDate || '').trim(),
        startTime: String(row.startTime || '').trim() || DEFAULT_START_TIME,
        updatedAt: String(row.updatedAt || ''),
        queue
      };
    }

    function normalizePlanosProducao(list) {
      if (!Array.isArray(list)) return [];
      return list.map((row, i) => normalizePlanoProducao(row, i)).filter(Boolean);
    }

    function buildDbMetadata(exportedAt) {
      return {
        data_exportacao: exportedAt || new Date().toISOString(),
        versao_app: 'v' + APP_VERSION,
        versao_schema: SCHEMA_VERSION
      };
    }

    function readRawStorage(key) {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || 'null');
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
        return raw;
      } catch (e) {
        return null;
      }
    }

    function isSchemaV2(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
      const schema = (raw.metadados && raw.metadados.versao_schema) || raw.versao_schema;
      return schema === 'v2.0' || !!(raw.tb_maquinas || raw.tb_projetos_pecas || raw.tb_funcionarios);
    }

    function looksLikeLegacyProjectsMap(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
      const keys = Object.keys(raw);
      if (keys.length === 0) return true;
      return keys.every(k => {
        const p = raw[k];
        return p && typeof p === 'object' && !Array.isArray(p) && (Array.isArray(p.machines) || Array.isArray(p.parts) || p.name);
      });
    }

    function normalizeHolidayList(list) {
      const out = [];
      const seen = {};
      (Array.isArray(list) ? list : []).forEach(item => {
        const iso = String(item || '').trim();
        if (!iso || seen[iso]) return;
        seen[iso] = true;
        out.push(iso);
      });
      out.sort();
      return out;
    }

    function readProjetosPecasTable(raw) {
      const table = {};
      const primary = raw && raw.tb_projetos_pecas;
      const legacy = raw && raw.projects;
      if (primary && typeof primary === 'object' && !Array.isArray(primary)) {
        Object.keys(primary).forEach(key => { table[key] = primary[key]; });
      }
      if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
        Object.keys(legacy).forEach(key => {
          if (!Object.prototype.hasOwnProperty.call(table, key)) table[key] = legacy[key];
        });
      }
      return table;
    }

    function unwrapV2(raw) {
      const meta = (raw && raw.metadados && typeof raw.metadados === 'object')
        ? {
            data_exportacao: raw.metadados.data_exportacao || raw.data_exportacao || '',
            versao_app: raw.metadados.versao_app || raw.versao_app || ('v' + APP_VERSION),
            versao_schema: raw.metadados.versao_schema || raw.versao_schema || SCHEMA_VERSION
          }
        : buildDbMetadata(raw && (raw.data_exportacao || raw.exportedAt));
      const turnosSrc = (raw && Array.isArray(raw.tb_turnos) && raw.tb_turnos.length)
        ? raw.tb_turnos
        : defaultShiftRows();
      return {
        holidays: normalizeHolidayList(raw && raw.tb_feriados),
        employees: (raw && Array.isArray(raw.tb_funcionarios) ? raw.tb_funcionarios : []).map(normalizeEmployee),
        machines: (raw && Array.isArray(raw.tb_maquinas) ? raw.tb_maquinas : []).map(normalizeMachine),
        projects: readProjetosPecasTable(raw),
        turnos: turnosSrc.map(normalizeShiftRow),
        historicoOtimizacao: normalizeHistoricoOtimizacao(raw && raw.tb_historico_otimizacao),
        planosProducao: normalizePlanosProducao(raw && raw.tb_planos_producao),
        metadados: meta
      };
    }

    function convertAnyToV2(source) {
      source = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
      let holidays = [];
      let employeesList = [];
      let machinesList = [];
      let projects = {};
      let turnos = defaultShiftRows();
      let historicoOtimizacao = [];
      let planosProducao = [];
      let exportedAt = source.exportedAt || source.data_exportacao ||
        (source.metadados && source.metadados.data_exportacao) || '';

      if (isSchemaV2(source)) {
        const wrap = unwrapV2(source);
        holidays = wrap.holidays;
        employeesList = wrap.employees;
        machinesList = wrap.machines;
        projects = wrap.projects;
        turnos = wrap.turnos;
        historicoOtimizacao = wrap.historicoOtimizacao || [];
        planosProducao = wrap.planosProducao || [];
        exportedAt = (wrap.metadados && wrap.metadados.data_exportacao) || exportedAt;
      } else if (source.projects && typeof source.projects === 'object' && !Array.isArray(source.projects)) {
        projects = source.projects;
        holidays = Array.isArray(source.holidays) ? source.holidays : [];
        employeesList = Array.isArray(source.employees) ? source.employees : [];
        machinesList = Array.isArray(source.machines) ? source.machines : [];
      } else if (looksLikeLegacyProjectsMap(source)) {
        projects = source;
      }

      const derivedEmp = collectEmployeesFromProjects(projects);
      const derivedMach = collectMachinesFromProjects(projects);
      employeesList = mergeEntitiesById(
        (employeesList || []).map(normalizeEmployee),
        derivedEmp,
        normalizeEmployee
      );
      machinesList = unionMachineLists(
        (machinesList || []).map(normalizeMachine),
        derivedMach
      );
      employeesList = enrichEmployeesWithPosto(employeesList, machinesList);

      const metadados = buildDbMetadata(exportedAt || new Date().toISOString());
      return {
        app: APP_NAME,
        versao_app: metadados.versao_app,
        versao_schema: metadados.versao_schema,
        data_exportacao: metadados.data_exportacao,
        metadados,
        tb_maquinas: machinesList,
        tb_funcionarios: employeesList,
        tb_projetos_pecas: projects || {},
        tb_feriados: normalizeHolidayList(holidays),
        tb_turnos: (turnos && turnos.length ? turnos : defaultShiftRows()).map(normalizeShiftRow),
        tb_historico_otimizacao: normalizeHistoricoOtimizacao(historicoOtimizacao),
        tb_planos_producao: normalizePlanosProducao(planosProducao)
      };
    }

    /**
     * Converte o localStorage legado (simulafab_projects_v4 / envelope v1)
     * para o schema relacional v2.0 (7 tabelas) sem perda de dados.
     */
    function migrateToSchemaV2() {
      const current = readRawStorage(DB_STORAGE_KEY);
      if (isSchemaV2(current)) return unwrapV2(current);

      const legacy = readRawStorage(LEGACY_DB_STORAGE_KEY);
      const source = current || legacy || {};
      const v2 = convertAnyToV2(source);
      try {
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(v2));
      } catch (err) { /* cota / modo privado */ }
      return unwrapV2(v2);
    }

    function getDatabaseWrapper() {
      try {
        return migrateToSchemaV2();
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

    function enrichEmployeesWithPosto(employeesList, machinesList) {
      const byOp = {};
      (machinesList || []).forEach(m => {
        if (m && m.defaultOperatorId && !byOp[m.defaultOperatorId]) byOp[m.defaultOperatorId] = m;
      });
      return (employeesList || []).map(e => {
        const n = normalizeEmployee(e);
        if (!n.postoId && byOp[n.id]) {
          n.postoId = byOp[n.id].id;
          if (!n.setor) n.setor = byOp[n.id].name;
        }
        return n;
      });
    }

    function collectEmployeesFromProjects(projects) {
      let union = [];
      Object.keys(projects || {}).forEach(key => {
        const p = projects[key] || {};
        if (!Array.isArray(p.employees) || p.employees.length === 0) return;
        union = mergeEntitiesById(union, p.employees, normalizeEmployee);
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
        employees: mergeEntitiesById(
          incomingEmployees,
          mergeEntitiesById(wrap.employees || [], collectEmployeesFromProjects(projects), normalizeEmployee),
          normalizeEmployee
        ),
        machines: unionMachineLists(
          incomingMachines,
          existingMachines,
          collectMachinesFromProjects(projects)
        )
      };
    }

    function buildV2Payload(projects, catalog, options) {
      const wrap = (() => {
        try {
          const current = readRawStorage(DB_STORAGE_KEY);
          if (isSchemaV2(current)) return unwrapV2(current);
        } catch (e) { /* ignore */ }
        return emptyDatabaseWrapper();
      })();
      const projectMap = projects || wrap.projects || {};
      const resolved = resolveCatalogArrays(wrap, catalog, options, projectMap);
      const holidaySrc = options && Array.isArray(options.holidays) ? options.holidays : holidays;
      const turnosSrc = options && Array.isArray(options.turnos) && options.turnos.length
        ? options.turnos
        : (wrap.turnos && wrap.turnos.length ? wrap.turnos : defaultShiftRows());
      const exportedAt = (options && options.exportedAt) || new Date().toISOString();
      const metadados = buildDbMetadata(exportedAt);
      return {
        app: APP_NAME,
        versao_app: metadados.versao_app,
        versao_schema: metadados.versao_schema,
        data_exportacao: metadados.data_exportacao,
        metadados,
        tb_maquinas: (resolved.machines || []).map(normalizeMachine),
        tb_funcionarios: (resolved.employees || []).map(normalizeEmployee),
        tb_projetos_pecas: projectMap,
        tb_feriados: normalizeHolidayList(holidaySrc),
        tb_turnos: turnosSrc.map(normalizeShiftRow),
        tb_historico_otimizacao: normalizeHistoricoOtimizacao(
          options && Array.isArray(options.historicoOtimizacao)
            ? options.historicoOtimizacao
            : wrap.historicoOtimizacao
        ),
        tb_planos_producao: normalizePlanosProducao(
          options && Array.isArray(options.planosProducao)
            ? options.planosProducao
            : wrap.planosProducao
        )
      };
    }

    function buildDatabasePayload(projects, catalog, options) {
      return buildV2Payload(projects, catalog, options);
    }

    function persistDatabaseWrapper() {
      const db = loadRawV2Database();
      assignProjetosPecas(db.tb_projetos_pecas, {
        employees: typeof getCatalogEmployees === 'function' ? getCatalogEmployees() : employees,
        machines: getCatalogMachines()
      });
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

    function getCatalogEmployees() {
      const wrap = getDatabaseWrapper();
      return mergeEntitiesById(
        employees || [],
        mergeEntitiesById(wrap.employees || [], collectEmployeesFromProjects(wrap.projects), normalizeEmployee),
        normalizeEmployee
      );
    }

    function catalogSnapshotForPersist() {
      return {
        employees: getCatalogEmployees(),
        machines: getCatalogMachines()
      };
    }

    function getCatalogEmployeesAvailableForProject() {
      const inProject = {};
      (employees || []).forEach(e => {
        if (e && e.id) inProject[e.id] = true;
      });
      return getCatalogEmployees().filter(e => e && e.id && !inProject[e.id]);
    }

    function hydrateProjectEmployees(proj, catalogEmployees) {
      const catalogList = (catalogEmployees || []).map(normalizeEmployee);
      const catalogMap = {};
      catalogList.forEach(e => {
        if (e && e.id) catalogMap[e.id] = e;
      });
      const ordered = [];
      const seen = {};
      function pushEmployee(raw) {
        if (!raw || !raw.id || seen[raw.id]) return;
        seen[raw.id] = true;
        const cat = catalogMap[raw.id];
        ordered.push(normalizeEmployee(cat ? { ...raw, ...cat } : raw));
      }
      (proj && Array.isArray(proj.employees) ? proj.employees : []).forEach(pushEmployee);
      (proj && Array.isArray(proj.machines) ? proj.machines : []).forEach(m => {
        if (m && m.defaultOperatorId && catalogMap[m.defaultOperatorId]) {
          pushEmployee(catalogMap[m.defaultOperatorId]);
        }
      });
      return ordered;
    }

    function loadRawV2Database() {
      try {
        migrateToSchemaV2();
      } catch (e) { /* segue com a leitura direta */ }
      let raw = readRawStorage(DB_STORAGE_KEY);
      if (!raw || !isSchemaV2(raw)) {
        raw = convertAnyToV2(raw || {});
        try {
          localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(raw));
        } catch (err) { /* cota / modo privado */ }
      }
      raw.tb_projetos_pecas = readProjetosPecasTable(raw);
      delete raw.projects;
      return raw;
    }

    function getProjectsDatabase() {
      return loadRawV2Database().tb_projetos_pecas;
    }

    /** Grava o mapa completo em db.tb_projetos_pecas e persiste pcpmaster_db_v2. */
    function assignProjetosPecas(table, catalog, options) {
      const projects = (table && typeof table === 'object' && !Array.isArray(table)) ? table : {};
      const payload = buildDatabasePayload(projects, catalog, options);
      payload.tb_projetos_pecas = projects;
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(payload));
      if (typeof updateDbStatusIndicator === 'function') updateDbStatusIndicator();
      return payload;
    }

    function mergeProjetosPecas(currentTable, importedTable) {
      const merged = {};
      const current = (currentTable && typeof currentTable === 'object' && !Array.isArray(currentTable))
        ? currentTable
        : {};
      const incoming = (importedTable && typeof importedTable === 'object' && !Array.isArray(importedTable))
        ? importedTable
        : {};
      Object.keys(current).forEach(key => {
        merged[key] = current[key];
      });
      Object.keys(incoming).forEach(key => {
        merged[key] = incoming[key];
      });
      return merged;
    }

    function getOptimizationHistory() {
      const wrap = getDatabaseWrapper();
      return normalizeHistoricoOtimizacao(wrap.historicoOtimizacao);
    }

    function persistOptimizationHistory(list) {
      const wrap = getDatabaseWrapper();
      setProjectsDatabase(wrap.projects || {}, catalogSnapshotForPersist(), {
        holidays: wrap.holidays,
        turnos: wrap.turnos,
        historicoOtimizacao: normalizeHistoricoOtimizacao(list),
        planosProducao: wrap.planosProducao
      });
    }

    function optimizationHistoryKey(row) {
      return String((row && row.projectName) || '').trim().toUpperCase() + '\u001f' +
        String((row && row.sku) || '').trim().toUpperCase();
    }

    function upsertOptimizationHistory(entry) {
      const row = normalizeHistoricoOtimizacao([{
        id: (entry && entry.id) || ('opt_' + Date.now()),
        sku: entry && entry.sku,
        projectName: entry && entry.projectName,
        boxesQty: entry && entry.boxesQty,
        startTime: entry && entry.startTime,
        iterations: entry && entry.iterations,
        updatedAt: (entry && entry.updatedAt) || new Date().toISOString(),
        top3: entry && entry.top3
      }])[0];
      if (!row) return null;
      const list = getOptimizationHistory();
      const key = optimizationHistoryKey(row);
      const idx = list.findIndex(r => optimizationHistoryKey(r) === key);
      if (idx >= 0) {
        row.id = list[idx].id || row.id;
        list[idx] = row;
      } else {
        list.push(row);
      }
      persistOptimizationHistory(list);
      return row;
    }

    function getOptimizationSeedsForProject(projectName, sku) {
      const keys = [projectName, sku]
        .map(s => String(s || '').trim().toUpperCase())
        .filter(Boolean);
      if (!keys.length) return [];
      const matches = getOptimizationHistory().filter(row => {
        const skuU = String(row.sku || '').toUpperCase();
        const projU = String(row.projectName || '').toUpperCase();
        return keys.some(k => k === skuU || k === projU);
      });
      matches.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      const seeds = [];
      const seen = {};
      matches.forEach(row => {
        (row.top3 || []).forEach(sc => {
          if (!sc || !Array.isArray(sc.sequence) || !sc.sequence.length) return;
          const key = sc.sequence.join('\u001f');
          if (seen[key]) return;
          seen[key] = true;
          seeds.push({
            sequence: sc.sequence.slice(),
            score: sc.score,
            strategy: sc.strategy || 'historico'
          });
        });
      });
      return seeds.slice(0, 9);
    }

    function getProductionPlans() {
      const wrap = getDatabaseWrapper();
      return normalizePlanosProducao(wrap.planosProducao);
    }

    function persistProductionPlans(list) {
      const wrap = getDatabaseWrapper();
      setProjectsDatabase(wrap.projects || {}, catalogSnapshotForPersist(), {
        holidays: wrap.holidays,
        turnos: wrap.turnos,
        historicoOtimizacao: wrap.historicoOtimizacao,
        planosProducao: normalizePlanosProducao(list)
      });
    }

    function upsertProductionPlan(entry) {
      const row = normalizePlanoProducao(Object.assign({}, entry, {
        updatedAt: (entry && entry.updatedAt) || new Date().toISOString()
      }), 0);
      if (!row) return null;
      const list = getProductionPlans();
      const key = String(row.name || '').trim().toUpperCase();
      const idx = list.findIndex(p => String(p.name || '').trim().toUpperCase() === key);
      if (idx >= 0) {
        row.id = list[idx].id || row.id;
        list[idx] = row;
      } else {
        list.push(row);
      }
      persistProductionPlans(list);
      return row;
    }

    function deleteProductionPlanById(id) {
      const target = String(id || '');
      if (!target) return false;
      const list = getProductionPlans().filter(p => p.id !== target);
      persistProductionPlans(list);
      return true;
    }

    function setProjectsDatabase(projects, catalog, options) {
      const db = loadRawV2Database();
      const incoming = (projects && typeof projects === 'object' && !Array.isArray(projects)) ? projects : {};
      db.tb_projetos_pecas = incoming;
      assignProjetosPecas(db.tb_projetos_pecas, catalog, options);
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
      const catalogEmployees = mergeEntitiesById(
        mergeEntitiesById(employees || [], wrap.employees || [], normalizeEmployee),
        fromProjects.employees,
        normalizeEmployee
      );
      return {
        employees: cloneJson(catalogEmployees, []),
        machines: getCatalogMachines()
      };
    }

    function loadBaseCatalogIntoState() {
      machines = (machines || []).map(normalizeMachine);
    }

    function loadEmployeesFromCatalog() {
      // Catálogo mestre permanece em tb_funcionarios; o projeto inicia vazio.
    }

    let pendingOverwriteName = '';

    function cloneJson(value, fallback) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (e) {
        return fallback;
      }
    }

    function buildCurrentProjectData(name, existing) {
      return {
        id: (existing && existing.id) ? existing.id : ('p' + Date.now()),
        name,
        machines: (machines || []).map(normalizeMachine),
        parts: (cloneJson(parts, [])).map(p => typeof normalizePart === 'function' ? normalizePart(p) : p),
        employees: (employees || []).map(normalizeEmployee),
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
      const db = loadRawV2Database();
      db.tb_projetos_pecas[trimmed] = buildCurrentProjectData(trimmed, db.tb_projetos_pecas[trimmed]);
      currentProjectName = trimmed;
      assignProjetosPecas(db.tb_projetos_pecas, catalogSnapshotForPersist());
      if (typeof syncProjectNameUI === 'function') syncProjectNameUI({ syncInput: true });
      if (typeof refreshSavedProjectsUI === 'function') refreshSavedProjectsUI();
      if (typeof renderProductionPlanUI === 'function') renderProductionPlanUI();
      return true;
    }

    function getProjectNameInputEl() {
      return document.getElementById('projeto_nome_topo') || document.getElementById('project-name-input');
    }

    function getProjectNameFromInput() {
      const el = getProjectNameInputEl();
      return (el ? el.value : currentProjectName || '').trim();
    }

    function openOverwriteProjectModal(name) {
      pendingOverwriteName = name;
      const modal = document.getElementById('overwrite-project-modal');
      const msg = document.getElementById('overwrite-project-message');
      if (msg) msg.textContent = 'O projeto \'' + name + '\' já existe na base de dados. Deseja sobrescrever?';
      if (modal) {
        modal.hidden = false;
        modal.classList.add('is-open');
      }
    }

    function closeOverwriteProjectModal() {
      pendingOverwriteName = '';
      const modal = document.getElementById('overwrite-project-modal');
      if (modal) {
        modal.hidden = true;
        modal.classList.remove('is-open');
      }
    }

    function confirmOverwriteProject() {
      const name = pendingOverwriteName;
      closeOverwriteProjectModal();
      if (!name) return;
      commitSaveProject(name);
    }

    function commitSaveProject(name) {
      persistSavedProject(name);
    }

    function saveProjectPrompt() {
      const name = getProjectNameFromInput();
      if (!name) {
        alert('Informe o Nome do Projeto / SKU para salvar.');
        const el = getProjectNameInputEl();
        if (el) el.focus();
        return;
      }
      const saved = getProjectsDatabase();
      if (saved[name]) {
        openOverwriteProjectModal(name);
        return;
      }
      commitSaveProject(name);
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
      employees = hydrateProjectEmployees(proj, getCatalogEmployees());
      parts = (cloneJson(proj.parts || [], [])).map(p => typeof normalizePart === 'function' ? normalizePart(p) : p);
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
      if (typeof resetSimEstufaCycleOverride === 'function') resetSimEstufaCycleOverride();
      if (typeof syncProjectNameUI === 'function') syncProjectNameUI({ syncInput: true });
    }

    function loadSavedProjectByName(name) {
      if (!name) return;
      const saved = getProjectsDatabase();
      const proj = saved[name];
      if (!proj) {
        alert('Projeto não encontrado.');
        return;
      }
      if (typeof restoreEngineeringSessionIfNeeded === 'function') restoreEngineeringSessionIfNeeded();
      if (typeof clearPlanSimulationMode === 'function') clearPlanSimulationMode();
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
      const db = loadRawV2Database();
      if (!Object.prototype.hasOwnProperty.call(db.tb_projetos_pecas, name)) {
        alert('Projeto não encontrado.');
        return;
      }
      delete db.tb_projetos_pecas[name];
      assignProjetosPecas(db.tb_projetos_pecas, catalogSnapshotForPersist());
      if (currentProjectName === name) currentProjectName = '';
      if (typeof syncProjectNameUI === 'function') syncProjectNameUI({ syncInput: true });
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

    function pad2(n) {
      return String(n).padStart(2, '0');
    }

    function buildBackupFilename(date) {
      const d = date || new Date();
      return APP_NAME + '_DB_Backup_' +
        d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + '_' +
        pad2(d.getHours()) + pad2(d.getMinutes()) + '.json';
    }

    function formatDbUpdatedLabel(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-BR') + ' ' +
        d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    function updateDbStatusIndicator() {
      let schema = SCHEMA_VERSION;
      let when = '—';
      try {
        const wrap = getDatabaseWrapper();
        const meta = wrap.metadados || {};
        schema = meta.versao_schema || SCHEMA_VERSION;
        when = formatDbUpdatedLabel(meta.data_exportacao);
      } catch (e) { /* ignore */ }
      const text = 'Banco ativo: ' + schema + ' — Atualizado em ' + when;
      const nodes = document.querySelectorAll('.db-status-text');
      nodes.forEach(el => { el.textContent = text; });
    }

    function downloadStoredBackup() {
      const db = loadRawV2Database();
      const table = db.tb_projetos_pecas;
      const meta = buildDbMetadata();
      db.app = APP_NAME;
      db.versao_app = meta.versao_app;
      db.versao_schema = meta.versao_schema;
      db.data_exportacao = meta.data_exportacao;
      db.metadados = meta;
      db.tb_projetos_pecas = table;
      try {
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
      } catch (err) { /* cota / modo privado */ }
      if (typeof updateDbStatusIndicator === 'function') updateDbStatusIndicator();

      const filename = buildBackupFilename();
      const projectCount = Object.keys(table).length;
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { payload: db, filename, projectCount };
    }

    function exportDatabaseJSON() {
      const assigned = (currentProjectName || '').trim();
      if (assigned) persistSavedProject(assigned);
      else persistDatabaseWrapper();
      return downloadStoredBackup();
    }

    function exportBackup() {
      const result = exportDatabaseJSON();
      const count = result ? result.projectCount : 0;
      if (typeof showBackupExportedToast === 'function') showBackupExportedToast(count);
      else if (typeof showAppToast === 'function') {
        showAppToast('✅ Backup exportado com sucesso! ' + count + ' projetos incluídos.');
      } else {
        alert('✅ Backup exportado com sucesso! ' + count + ' projetos incluídos.');
      }
      return result && result.payload;
    }

    function exportDatabaseBackup() {
      return exportBackup();
    }

    function updateDatabaseJSONFromStorage() {
      return exportDatabaseBackup();
    }

    function normalizeImportedDatabase(parsed) {
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('JSON inválido: esperado um objeto de banco de dados.');
      }
      const v2 = convertAnyToV2(parsed);
      const wrap = unwrapV2(v2);
      const projects = wrap.projects || {};
      const looksEmpty = Object.keys(projects).length === 0 &&
        !isSchemaV2(parsed) &&
        !(parsed.projects && typeof parsed.projects === 'object') &&
        !looksLikeLegacyProjectsMap(parsed) &&
        !parsed.holidays && !parsed.employees && !parsed.machines;
      if (looksEmpty && !parsed.app) {
        throw new Error('JSON inválido: não contém a estrutura de projetos do ' + APP_NAME + '.');
      }

      Object.keys(projects).forEach(k => {
        const p = projects[k];
        if (p && Array.isArray(p.machines)) {
          p.machines = p.machines.map(normalizeMachine);
        }
        if (p && !Array.isArray(p.employees)) {
          p.employees = [];
        }
        if (p && Array.isArray(p.employees)) {
          p.employees = p.employees.map(normalizeEmployee);
        }
        if (p && Array.isArray(p.assemblyRules)) {
          p.assemblyRules = p.assemblyRules.map(normalizeAssemblyRule);
        }
      });

      return {
        projects,
        holidays: wrap.holidays,
        employees: wrap.employees,
        machines: wrap.machines,
        turnos: wrap.turnos,
        historicoOtimizacao: wrap.historicoOtimizacao || [],
        planosProducao: wrap.planosProducao || []
      };
    }

    function importBackup(event) {
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
            machines: importedMachines,
            turnos: importedTurnos,
            historicoOtimizacao: importedHistorico,
            planosProducao: importedPlanos
          } = normalizeImportedDatabase(parsed);
          const count = Object.keys(projects).length;
          const current = loadRawV2Database().tb_projetos_pecas;
          const currentCount = Object.keys(current).length;
          const merged = mergeProjetosPecas(current, projects);
          const added = Object.keys(merged).length - currentCount;

          const msg = currentCount > 0
            ? `Importar backup "${file.name}"?\n\nFusão segura de tb_projetos_pecas: ${currentCount} projeto(s) já salvos serão mantidos e ${count} projeto(s) do arquivo serão incorporados.\nChaves com o mesmo nome são atualizadas pelo arquivo. Projetos que existem só neste navegador não são apagados.`
            : `Importar backup "${file.name}" com ${count} projeto(s)?`;

          if (!confirm(msg)) {
            input.value = '';
            return;
          }

          holidays = importedHolidays || [];
          employees = [];
          machines = [];
          currentBuildingRoute = [];
          editingPartIndex = -1;
          editingMachineIndex = -1;
          editingEmployeeIndex = -1;
          editingGroupingIndex = -1;
          editingAssemblyIndex = -1;
          const db = loadRawV2Database();
          db.tb_projetos_pecas = merged;
          assignProjetosPecas(db.tb_projetos_pecas, {
            employees: importedEmployees || [],
            machines: importedMachines
          }, {
            replaceCatalog: true,
            holidays,
            turnos: importedTurnos,
            historicoOtimizacao: importedHistorico || [],
            planosProducao: importedPlanos || []
          });
          if (currentProjectName && merged[currentProjectName]) {
            applyProjectToState(currentProjectName, merged[currentProjectName]);
          } else {
            currentProjectName = '';
          }
          if (typeof syncProjectNameUI === 'function') syncProjectNameUI({ syncInput: true });
          if (typeof refreshSavedProjectsUI === 'function') refreshSavedProjectsUI();
          if (typeof renderProductionPlanUI === 'function') renderProductionPlanUI();
          if (typeof renderConfigUI === 'function') renderConfigUI();
          renderHolidaysList();
          updateDbStatusIndicator();
          alert('Backup importado com sucesso!\n' + Object.keys(merged).length + ' projeto(s) em tb_projetos_pecas (' + added + ' novo(s) do arquivo).\nSchema ' + SCHEMA_VERSION + '.');
        } catch (err) {
          alert('Falha ao restaurar o backup.\n' + (err.message || err));
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

    function importDatabaseJSON(event) {
      return importBackup(event);
    }

function loadPersistedHolidays() {
  const wrap = migrateToSchemaV2();
  holidays = Array.isArray(wrap.holidays) ? wrap.holidays.slice() : [];
  loadBaseCatalogIntoState();
  persistDatabaseWrapper();
}
