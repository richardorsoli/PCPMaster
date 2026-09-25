/* PCPMaster v2.2 — Mapa de estufagem: captura ortográfica Three.js e página A4 do PDF */

function collectEstufaMapEntities() {
  const entities = [];
  const seen = {};
  const push = (part) => {
    const name = String((part && (part.name || part.resultName)) || '').trim();
    if (!name) return;
    const key = name.toUpperCase();
    if (seen[key]) return;
    seen[key] = true;
    entities.push(part);
  };
  (typeof parts !== 'undefined' ? parts : []).forEach(p => {
    if (p && typeof routeVisitsEstufa === 'function' && routeVisitsEstufa(p.route)) push(p);
  });
  (typeof assemblyRules !== 'undefined' ? assemblyRules : []).forEach(r => {
    if (!r) return;
    const joinRoute = [{ machineId: r.machineId }].concat(r.route || []);
    if (typeof routeVisitsEstufa === 'function' && routeVisitsEstufa(joinRoute)) {
      push(Object.assign({}, r, { name: r.resultName, route: joinRoute, qty: r.qty || 1 }));
    }
  });
  return entities;
}

const ESTUFA_SKU_COLORS = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0xd35400, 0x16a085, 0xe84393];

function estufaSkuColor(index) {
  const i = Math.max(1, Number(index) || 1) - 1;
  return ESTUFA_SKU_COLORS[i % ESTUFA_SKU_COLORS.length];
}

function estufaFifoStamp(name, fardoIndex, entityIdx) {
  const key = String(name || '').toUpperCase();
  let best = null;
  (typeof rawEvents !== 'undefined' ? rawEvents : []).forEach(e => {
    if (!e || !e.isEstufaBatch) return;
    const n = String(e.partName || '').toUpperCase();
    if (!key || n.indexOf(key) < 0) return;
    const t = Number(e.arrivalTime != null ? e.arrivalTime : e.prodStart);
    if (!isFinite(t)) return;
    if (best == null || t < best) best = t;
  });
  if (best == null) return (Number(entityIdx) || 0) * 1000 + (Number(fardoIndex) || 0);
  return best + (Number(fardoIndex) || 0) * 0.001;
}

const ESTUFA_STACK_LIMIT_M = 1.9276;

function estufaPiecePose(spec) {
  const src = spec || {};
  const raw = [
    Number(src.peca_altura_m) || 0,
    Number(src.peca_largura_m) || 0,
    Number(src.peca_comprimento_m) || 0
  ].filter(v => v > 0).sort((a, b) => b - a);
  const gapMm = Number(src.peca_espacamento_mm);
  const gap = ((isFinite(gapMm) && gapMm > 0) ? gapMm : 130) / 1000;
  const tallest = raw[0] || 0.1;
  const mid = raw[1] || tallest;
  const thin = raw[2] || mid;
  const maxSolidY = Math.max(0.05, ESTUFA_STACK_LIMIT_M - 2 * gap);
  let solidY = tallest;
  let solidX = mid;
  let solidZ = thin;
  if (solidY > maxSolidY && mid <= maxSolidY) {
    solidY = mid;
    solidX = tallest;
    solidZ = thin;
  }
  if (solidY > maxSolidY) solidY = maxSolidY;
  return {
    solidX: Math.max(0.01, solidX),
    solidY: Math.max(0.01, solidY),
    solidZ: Math.max(0.01, solidZ),
    gap: gap
  };
}

function calculateEstufa3DLayout(packed, cabin) {
  const L = Number(cabin && cabin.w) > 0 ? Number(cabin.w) : 1.75;
  const A = Number(cabin && cabin.h) > 0 ? Number(cabin.h) : 2.0;
  const P = Number(cabin && cabin.d) > 0 ? Number(cabin.d) : 3.85;
  const stackTop = Math.min(A, ESTUFA_STACK_LIMIT_M);
  const stackFloor = stackTop - ESTUFA_STACK_LIMIT_M;
  const pieces = [];
  (packed || []).filter(u => u && u.box && !u.box.forced).forEach(u => {
    const pose = estufaPiecePose(u.spec);
    pieces.push({
      unit: u,
      seq: Number(u.arrivalTime) || 0,
      solidX: pose.solidX,
      solidY: pose.solidY,
      solidZ: pose.solidZ,
      gap: pose.gap
    });
  });
  pieces.sort((a, b) => a.seq - b.seq);
  if (!pieces.length) return packed || [];

  const placed = [];
  let cursor = 0;
  let z = 0;
  while (cursor < pieces.length && z < P - 1e-6) {
    let x = 0;
    let rowD = 0;
    let placedInRow = false;
    while (cursor < pieces.length && x < L - 1e-6) {
      const probe = pieces[cursor];
      if (x + probe.solidX > L + 1e-6 || z + probe.solidZ > P + 1e-6) break;
      let yTop = stackTop;
      let slotW = 0;
      let slotD = 0;
      let placedInStack = false;
      while (cursor < pieces.length) {
        const it = pieces[cursor];
        if (x + it.solidX > L + 1e-6 || z + it.solidZ > P + 1e-6) break;
        const envH = it.solidY + 2 * it.gap;
        if (yTop - envH < stackFloor - 1e-6) break;
        const box = {
          x: x,
          y: yTop - envH,
          z: z,
          w: it.solidX,
          h: envH,
          d: it.solidZ,
          gapY: it.gap,
          forced: false
        };
        placed.push(Object.assign({}, it.unit, { box: box }));
        yTop -= it.solidY + it.gap;
        slotW = Math.max(slotW, it.solidX);
        slotD = Math.max(slotD, it.solidZ);
        placedInStack = true;
        cursor += 1;
      }
      if (!placedInStack) break;
      x += slotW;
      rowD = Math.max(rowD, slotD);
      placedInRow = true;
    }
    if (!placedInRow) break;
    z += rowD;
  }
  return placed.length ? placed : (packed || []);
}

function estufaLoadBounds(packed) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  (packed || []).forEach(u => {
    const b = u && u.box;
    if (!b || b.forced) return;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    minZ = Math.min(minZ, b.z);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
    maxZ = Math.max(maxZ, b.z + b.d);
  });
  if (!isFinite(minX)) return null;
  return {
    x0: minX, y0: minY, z0: minZ,
    x1: maxX, y1: maxY, z1: maxZ
  };
}

function readEstufaSheetParams(machine) {
  const cfg = machine || {};
  const tempRaw = cfg.temperatura != null ? cfg.temperatura : cfg.temperaturaAlvo;
  const temperatura = (tempRaw != null && String(tempRaw).trim() !== '' && isFinite(Number(tempRaw)))
    ? (Number(tempRaw) + '°C')
    : 'Conforme Processo';
  const batch = (typeof rawEvents !== 'undefined' ? rawEvents : []).find(e => e && e.isEstufaBatch);
  const qEl = document.getElementById('sim_tempo_queima');
  const rEl = document.getElementById('sim_tempo_resfriamento');
  let queima = batch && batch.estufaQueimaMin != null ? Number(batch.estufaQueimaMin) : parseFloat(qEl && qEl.value);
  let resfrio = batch && batch.estufaResfrioMin != null ? Number(batch.estufaResfrioMin) : parseFloat(rEl && rEl.value);
  if (!(queima > 0)) queima = Number(cfg.tempo_queima_default);
  if (!isFinite(resfrio) || resfrio < 0) resfrio = Number(cfg.tempo_resfriamento_default);
  const permanencia = (queima > 0)
    ? (queima + ' min queima + ' + (isFinite(resfrio) ? resfrio : 0) + ' min resfriamento')
    : 'Conforme Processo';
  return { temperatura: temperatura, permanencia: permanencia };
}

function buildEstufaMapLayout() {
  if (typeof getEstufaCabin !== 'function' || typeof fillEstufaCabin !== 'function' || typeof partFardoSpec !== 'function') {
    return null;
  }
  const machine = (typeof machines !== 'undefined' ? machines : []).find(m => {
    if (!m) return false;
    if (m.isEstufa === true || m.isEstufa === 'true') return true;
    return /ESTUFA/i.test(String(m.name || ''));
  });
  const entities = collectEstufaMapEntities();
  if (!machine && !entities.length) return null;
  const cabin = machine
    ? getEstufaCabin(machine.id)
    : { h: ESTUFA_CABIN_H, w: ESTUFA_CABIN_W, d: ESTUFA_CABIN_D, volume: ESTUFA_CABIN_VOLUME };
  const units = [];
  entities.forEach((part, entityIdx) => {
    const spec = partFardoSpec(part, cabin);
    const total = partTotalFardos(part, cabin);
    const per = spec.peca_max_fardo || spec.pecas_por_fardo || 1;
    const qty = partEffectiveQty(part);
    for (let i = 0; i < total; i++) {
      const pieces = (i === total - 1) ? Math.max(1, qty - per * (total - 1)) : per;
      const nome = part.name || part.resultName || 'Peça';
      units.push({
        part: part,
        spec: spec,
        pieces: pieces,
        name: nome,
        fardoIndex: i,
        arrivalTime: estufaFifoStamp(nome, i, entityIdx)
      });
    }
  });
  const fill = fillEstufaCabin(units, cabin);
  const packed = calculateEstufa3DLayout(fill.packed || [], cabin);
  const countByName = {};
  const seenFardo = {};
  packed.forEach(u => {
    const n = u.name || (u.part && (u.part.name || u.part.resultName)) || '';
    const key = n + '#' + (u.fardoIndex != null ? u.fardoIndex : '');
    if (seenFardo[key]) return;
    seenFardo[key] = true;
    countByName[n] = (countByName[n] || 0) + 1;
  });
  const skuByName = {};
  const rows = entities.map((part, idx) => {
    const spec = partFardoSpec(part, cabin);
    const name = part.name || part.resultName || 'Peça';
    const skuIndex = idx + 1;
    skuByName[name] = skuIndex;
    const gap = Number(spec.peca_espacamento_mm);
    return {
      name: '[' + skuIndex + '] ' + name,
      skuIndex: skuIndex,
      dim: Math.round(spec.peca_altura_mm || 0) + ' × ' + Math.round(spec.peca_largura_mm || 0) + ' × ' + Math.round(spec.peca_comprimento_mm || 0),
      perFardo: String(spec.peca_max_fardo || spec.pecas_por_fardo || 1),
      gap: (isFinite(gap) && gap > 0) ? (String(gap).replace('.', ',') + ' mm') : '25–30 mm',
      inCabin: String(countByName[name] || 0)
    };
  });
  packed.forEach(u => {
    const n = u.name || (u.part && (u.part.name || u.part.resultName)) || '';
    u.skuIndex = skuByName[n] || 1;
    u.skuColor = estufaSkuColor(u.skuIndex);
  });
  return {
    machine: machine,
    cabin: cabin,
    packed: packed,
    rows: rows
  };
}

function captureEstufaOrthographicViews(layout) {
  if (!layout || !window.THREE) return null;
  const THREE = window.THREE;
  const cabin = layout.cabin || {};
  const H = 540;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  } catch (err) {
    return null;
  }
  renderer.setSize(Math.round(H * (1.75 / 3.85)), H);
  renderer.setClearColor(0x0b1d36, 1);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;';
  document.body.appendChild(canvas);

  const inputA = document.getElementById('new-machine-estufa-h');
  const inputL = document.getElementById('new-machine-estufa-w');
  const inputP = document.getElementById('new-machine-estufa-d');
  const altura = (Number(cabin.h) > 0 ? Number(cabin.h) : parseFloat(inputA && inputA.value)) || 2.0;
  const largura = (Number(cabin.w) > 0 ? Number(cabin.w) : parseFloat(inputL && inputL.value)) || 1.75;
  const profundidade = (Number(cabin.d) > 0 ? Number(cabin.d) : parseFloat(inputP && inputP.value)) || 3.85;
  const scene = new THREE.Scene();
  const estufaGeo = new THREE.BoxGeometry(largura, altura, profundidade);
  const cabinEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(estufaGeo),
    new THREE.LineBasicMaterial({ color: 0xd6e4ff })
  );
  cabinEdges.position.set(largura / 2, altura / 2, profundidade / 2);
  scene.add(cabinEdges);

  function makeSkuSprite(label, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#' + ('000000' + colorHex.toString(16)).slice(-6);
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), 64, 70);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sprite.renderOrder = 3;
    return sprite;
  }

  (layout.packed || []).forEach(unit => {
    const box = unit.box;
    if (!box || box.forced) return;
    const gapY = Number(box.gapY) > 0 ? Number(box.gapY) : 0;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const cz = box.z + box.d / 2;

    const halo = new THREE.Mesh(
      new THREE.BoxGeometry(box.w, box.h, box.d),
      new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.25, depthWrite: false })
    );
    halo.position.set(cx, cy, cz);
    scene.add(halo);

    const gw = Math.max(0.01, box.w);
    const gh = Math.max(0.01, box.h - 2 * gapY);
    const gd = Math.max(0.01, box.d);
    const skuColor = unit.skuColor || estufaSkuColor(unit.skuIndex);
    const solidGeo = new THREE.BoxGeometry(gw, gh, gd);
    const solid = new THREE.Mesh(solidGeo, new THREE.MeshBasicMaterial({ color: skuColor }));
    solid.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(solidGeo),
      new THREE.LineBasicMaterial({ color: 0xffffff })
    ));
    solid.position.set(cx, cy, cz);
    scene.add(solid);
    const sprite = makeSkuSprite(unit.skuIndex || 1, skuColor);
    const badge = Math.max(0.08, Math.min(gw, gh, gd) * 0.72);
    sprite.scale.set(badge, badge, 1);
    sprite.position.set(cx, cy, cz);
    scene.add(sprite);
  });

  const dist = 5;
  const margin = 1.02;
  const pad = 0.05;
  const zMid = profundidade / 2;
  const yMid = altura / 2;
  const xMid = largura / 2;
  const halfW = (largura / 2) * margin;
  const halfH = (altura / 2) * margin;
  const load = estufaLoadBounds(layout.packed) || {
    x0: 0, y0: 0, z0: 0, x1: largura, y1: altura, z1: profundidade
  };
  function shoot(left, right, top, bottom, position, up, target) {
    const spanW = Math.max(0.05, right - left);
    const spanH = Math.max(0.05, top - bottom);
    const pxH = H;
    const pxW = Math.max(64, Math.round(pxH * (spanW / spanH)));
    renderer.setSize(pxW, pxH, false);
    const cam = new THREE.OrthographicCamera(left, right, top, bottom, 0.01, 50);
    cam.zoom = 1;
    cam.position.set(position.x, position.y, position.z);
    cam.up.set(up.x, up.y, up.z);
    cam.lookAt(target.x, target.y, target.z);
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
    return renderer.domElement.toDataURL('image/png');
  }

  let images = null;
  try {
    images = {
      front: shoot(
        -halfW, halfW, halfH, -halfH,
        { x: xMid, y: yMid, z: profundidade + dist },
        { x: 0, y: 1, z: 0 },
        { x: xMid, y: yMid, z: 0 }
      ),
      top: shoot(
        (load.x0 - xMid) - pad, (load.x1 - xMid) + pad,
        (zMid - load.z0) + pad, (zMid - load.z1) - pad,
        { x: xMid, y: altura + dist, z: zMid },
        { x: 0, y: 0, z: -1 },
        { x: xMid, y: 0, z: zMid }
      ),
      side: shoot(
        (load.z0 - zMid) - pad, (load.z1 - zMid) + pad,
        (load.y1 - yMid) + pad, (load.y0 - yMid) - pad,
        { x: -dist, y: yMid, z: zMid },
        { x: 0, y: 1, z: 0 },
        { x: largura, y: yMid, z: zMid }
      ),
      back: shoot(
        -halfW, halfW, halfH, -halfH,
        { x: xMid, y: yMid, z: -dist },
        { x: 0, y: 1, z: 0 },
        { x: xMid, y: yMid, z: profundidade }
      )
    };
  } catch (err) {
    images = null;
  }

  renderer.dispose();
  if (renderer.forceContextLoss) renderer.forceContextLoss();
  if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  return images;
}

function drawEstufaMapFooter(doc) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const total = doc.internal.getNumberOfPages();
  const current = doc.internal.getCurrentPageInfo().pageNumber;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70);
  doc.text(
    'Página ' + current + ' de ' + total + ' - Gerado por ' + APP_NAME + ' v' + APP_VERSION,
    pageW / 2,
    pageH - 6,
    { align: 'center' }
  );
}

function appendEstufaLoadingPlanPage(doc) {
  const layout = buildEstufaMapLayout();
  if (!layout) return;
  const meta = typeof getPdfReportMeta === 'function' ? getPdfReportMeta() : { label: 'Projeto', boxes: '' };
  const issued = new Date();
  const dateStr = issued.toLocaleDateString('pt-BR');
  const views = captureEstufaOrthographicViews(layout);

  doc.addPage('a4', 'portrait');
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;

  doc.setFillColor(241, 245, 249);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(0.5);
  doc.line(0, 28, pageW, 28);

  doc.setDrawColor(15, 23, 42);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 4, 28, 14, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text('[ LOGO PCP ]', margin + 14, 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text(APP_NAME + ' v' + APP_VERSION + ' - Relatório de Estufagem', margin, 24);

  const title = 'PLANO DE CARREGAMENTO DA ESTUFA (MAPA DE ESTUFAGEM)';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(2, 132, 199);
  const titleLines = doc.splitTextToSize(title, 88);
  doc.text(titleLines, pageW / 2, titleLines.length > 1 ? 10 : 13, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const lote = 'Lote: ' + (meta.boxes != null ? meta.boxes : '') + ' Caixas ' + (meta.label || '');
  const loteLines = doc.splitTextToSize(lote, 58);
  doc.text(loteLines, pageW - margin, 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text('Data: ' + dateStr, pageW - margin, 10 + (loteLines.length * 3.4) + 2, { align: 'right' });

  let y = 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('1. VISUALIZAÇÃO 3D DO ARRANJO DA ESTUFA (LAYOUT DE CARGA)', margin, y);
  y += 4;

  const gap = 3;
  const frameW = (pageW - margin * 2 - gap * 2) / 3;
  const frameH = 52;
  const captions = [
    { key: 'top', label: 'Visão Superior (Topo)' },
    { key: 'front', label: 'Visão Frontal (Elevação)' },
    { key: 'side', label: 'Visão Lateral (Profundidade)' }
  ];
  captions.forEach((cap, i) => {
    const x = margin + i * (frameW + gap);
    doc.setFillColor(11, 29, 54);
    doc.rect(x, y, frameW, frameH, 'F');
    doc.setDrawColor(2, 132, 199);
    doc.setLineWidth(0.4);
    doc.rect(x, y, frameW, frameH, 'S');
    const img = views && views[cap.key];
    if (img) {
      try {
        const props = doc.getImageProperties(img);
        const maxW = frameW - 2.4;
        const maxH = frameH - 8;
        const ratio = props.width / props.height;
        let dw = maxW;
        let dh = dw / ratio;
        if (dh > maxH) {
          dh = maxH;
          dw = dh * ratio;
        }
        doc.addImage(img, 'PNG', x + (frameW - dw) / 2, y + 1.2 + (maxH - dh) / 2, dw, dh);
      } catch (err) {
        doc.setFontSize(7);
        doc.setTextColor(255);
        doc.text('Captura indisponível', x + frameW / 2, y + frameH / 2, { align: 'center' });
      }
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(226, 232, 240);
      doc.text('Three.js indisponível', x + frameW / 2, y + frameH / 2, { align: 'center' });
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(cap.label, x + frameW / 2, y + frameH - 2.2, { align: 'center' });
  });
  y += frameH + 5;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(148, 163, 184);
  doc.rect(margin, y, pageW - margin * 2, 16, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Convenção de Cores', margin + 3, y + 4.5);
  doc.setFillColor(128, 128, 128);
  doc.rect(margin + 3, y + 7, 8, 5, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.rect(margin + 3, y + 7, 8, 5, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Bloco de Peças / Fardo', margin + 13, y + 10.5);
  doc.setFillColor(0, 136, 255);
  doc.rect(margin + 62, y + 7, 8, 5, 'F');
  doc.text('Área de Espaçamento Mínimo Exigido (Fluxo de Ar)', margin + 72, y + 10.5);
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('2. LEGENDA E MAPA DE MONTAGEM PARA O CHÃO DE FÁBRICA', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const ciclo = readEstufaSheetParams(layout.machine);
  doc.text('Temperatura Alvo: ' + ciclo.temperatura + '     |     Tempo de Permanência: ' + ciclo.permanencia, margin, y);
  y += 3;

  const body = (layout.rows || []).map(r => [r.name, r.dim, r.perFardo, r.gap, r.inCabin]);
  doc.autoTable({
    startY: y,
    head: [['SKU / Peça', 'Dimensão Fardo (mm)', 'Peças/Fardo', 'Espaçamento', 'Fardos na Estufa']],
    body: body.length ? body : [['—', '—', '—', '—', '—']],
    theme: 'striped',
    margin: { top: 32, left: margin, right: margin, bottom: 18 },
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    headStyles: { fillColor: [2, 132, 199], fontSize: 8, textColor: 255 },
    styles: { fontSize: 8, cellPadding: 1.6, overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 62 } }
  });

  let noteY = (doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : y) + 6;
  const pageH = doc.internal.pageSize.getHeight();
  if (noteY > pageH - 18) {
    doc.addPage('a4', 'portrait');
    noteY = 16;
  }
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  const note = '* Respeitar rigorosamente os envelopes azuis de espaçamento (conforme especificado por peça na tabela acima) para garantir a circulação do ar quente e a cura uniforme da tinta.';
  const noteLines = doc.splitTextToSize(note, pageW - margin * 2);
  doc.text(noteLines, margin, noteY);
  drawEstufaMapFooter(doc);
}
