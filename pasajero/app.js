(function () {
  const $ = (id) => document.getElementById(id);
  const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const LIVE_MS = 90000, NEAR_M = 1500;
  const rutaDe = (id) => window.RUTAS.find((r) => r.id === id) || { id, nombre: id, color: '#64748b', puntos: [] };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  if (Store.mode === 'demo') $('demo').hidden = false;

  const map = L.map('map', { zoomControl: false }).setView(window.CENTRO, 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  const unitLayer = L.layerGroup().addTo(map);
  let meMarker = null, routeLine = null;

  let me = null, units = [], selected = null;
  let favs = []; try { favs = JSON.parse(ls.get('miruta.favs')) || []; } catch {}
  const isLive = (u) => Date.now() - u.updated < LIVE_MS;

  // ---- Panel deslizable
  const sheet = $('sheet');
  const toggle = (collapse) => { sheet.classList.toggle('collapsed', collapse); setTimeout(() => map.invalidateSize(), 250); };
  let y0 = null;
  $('handle').addEventListener('pointerdown', (e) => { y0 = e.clientY; });
  $('handle').addEventListener('pointerup', (e) => {
    const dy = e.clientY - y0;
    if (Math.abs(dy) < 8) toggle(!sheet.classList.contains('collapsed')); else toggle(dy > 0);
  });

  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }

  // ---- Ubicación
  function locate() {
    if (!navigator.geolocation) { $('aviso').textContent = 'Tu dispositivo no tiene GPS.'; return; }
    navigator.geolocation.getCurrentPosition((p) => {
      me = { lat: p.coords.latitude, lng: p.coords.longitude };
      if (meMarker) meMarker.setLatLng([me.lat, me.lng]);
      else meMarker = L.marker([me.lat, me.lng], { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false }).addTo(map);
      if (!selected) map.setView([me.lat, me.lng], 15);
      render();
    }, () => { me = null; render(); toast('No pude obtener tu ubicación'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }
  $('btn-locate').onclick = locate;

  // ---- Cálculo de rutas cercanas
  function resumenRutas() {
    return window.RUTAS.map((r) => {
      const us = units.filter((u) => u.ruta === r.id && isLive(u));
      let minUnit = Infinity, minLine = Infinity;
      if (me) {
        us.forEach((u) => { minUnit = Math.min(minUnit, Geo.dist(me, u)); });
        minLine = Geo.distToPolyline(me, r.puntos);
      }
      const cerca = me ? Math.min(minUnit, minLine) <= NEAR_M : us.length > 0;
      return { r, us, minUnit, cerca, fav: favs.includes(r.id), orden: Math.min(minUnit, minLine) };
    }).filter((x) => x.cerca || x.fav)
      .sort((a, b) => (b.fav - a.fav) || (a.orden - b.orden));
  }

  function pin(u) {
    const viejo = !isLive(u);
    const cls = viejo ? 'viejo' : u.estado;
    const sym = viejo ? '?' : (u.estado === 'lleno' ? '✕' : '✓');
    return L.divIcon({ className: '', html: `<div class="pin ${cls}">${VEH.svg(u.tipo, 18)}<span class="st">${sym}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
  }
  const badge = (u) => !isLive(u)
    ? `<span class="badge viejo">? Sin señal</span>`
    : (u.estado === 'lleno' ? '<span class="badge lleno">✕ Lleno</span>' : '<span class="badge cupo">✓ Hay cupo</span>');

  function render() {
    unitLayer.clearLayers();
    if (selected) return renderRuta();
    $('vista-lista').hidden = false; $('vista-ruta').hidden = true;
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    const res = resumenRutas();
    $('aviso').textContent = me ? 'Toca una ruta para ver por dónde viene.' : 'Activa tu ubicación para ver solo las rutas que pasan cerca.';
    const STAR = (on) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/></svg>`;
    $('rutas').innerHTML = res.length ? res.map(({ r, us, minUnit, fav }) => {
      const live = us.filter((u) => u.estado !== 'fuera');
      const eta = me && isFinite(minUnit) ? `<span class="eta"><b>${Geo.etaMin(minUnit)}</b><small>min</small></span>` : '';
      const sub = live.length ? `${live.length} ${live.length > 1 ? 'unidades' : 'unidad'} en vivo` + (me && isFinite(minUnit) ? ` · a ${Geo.fmtDist(minUnit)}` : '') : 'Sin unidades ahora';
      return `<li><div class="card" data-ruta="${r.id}"><span class="rdot" style="background:${r.color}"></span><span class="info"><b>${esc(r.nombre)}</b><span class="sub">${sub}</span></span>${eta}<button class="star ${fav ? 'on' : ''}" data-fav="${r.id}" aria-label="${fav ? 'Quitar de favoritas' : 'Marcar como favorita'}">${STAR(fav)}</button></div></li>`;
    }).join('') : `<li class="empty">${me ? 'No hay unidades cerca de ti ahora. Toca el botón de ubicación para actualizar.' : 'No hay unidades en vivo ahora.'}</li>`;
    res.forEach(({ us }) => us.forEach((u) => L.marker([u.lat, u.lng], { icon: pin(u) }).addTo(unitLayer)));
  }

  function renderRuta() {
    const r = rutaDe(selected);
    $('vista-lista').hidden = true; $('vista-ruta').hidden = false;
    $('ruta-titulo').textContent = 'Ruta ' + r.nombre;
    const us = units.filter((u) => u.ruta === selected).sort((a, b) => (me ? Geo.dist(me, a) - Geo.dist(me, b) : 0));
    us.forEach((u) => L.marker([u.lat, u.lng], { icon: pin(u) }).bindPopup(esc(u.nombre)).addTo(unitLayer));
    $('unidades').innerHTML = us.length ? us.map((u) => {
      const d = me ? Geo.dist(me, u) : null;
      const eta = d !== null && isLive(u) ? `<span class="eta"><b>${Geo.etaMin(d)}</b><small>min</small></span>` : '';
      return `<li><div class="card"><span class="vico ${isLive(u) ? u.estado : 'viejo'}">${VEH.svg(u.tipo, 18)}</span><span class="info"><b>${esc(u.nombre)} <small>${VEH.nombre(u.tipo)}</small></b><span class="sub">${badge(u)} ${d !== null ? Geo.fmtDist(d) + ' · ' : ''}${Geo.fmtAgo(u.updated)}</span></span>${eta}</div></li>`;
    }).join('') : '<li class="empty">No hay unidades de esta ruta ahora mismo. Si ves una pasar, avisa abajo.</li>';
  }

  function seleccionar(id) {
    selected = id; const r = rutaDe(id);
    if (routeLine) map.removeLayer(routeLine);
    routeLine = r.puntos.length ? L.polyline(r.puntos, { color: r.color, weight: 5, opacity: .8 }).addTo(map) : null;
    render();
    const pts = units.filter((u) => u.ruta === id).map((u) => [u.lat, u.lng]);
    if (me) pts.push([me.lat, me.lng]);
    if (routeLine) pts.push(...r.puntos);
    if (pts.length > 1) map.fitBounds(pts, { paddingTopLeft: [40, 80], paddingBottomRight: [40, sheet.offsetHeight + 30], maxZoom: 16 });
    else if (pts.length === 1) map.setView(pts[0], 16);
    toggle(false);
  }

  $('rutas').addEventListener('click', (e) => {
    const f = e.target.closest('[data-fav]');
    if (f) {
      const id = f.dataset.fav; favs = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
      ls.set('miruta.favs', JSON.stringify(favs)); render(); return;
    }
    const c = e.target.closest('[data-ruta]'); if (c) seleccionar(c.dataset.ruta);
  });
  $('btn-volver').onclick = () => { selected = null; render(); };

  document.querySelectorAll('[data-report]').forEach((b) => {
    b.onclick = async () => {
      const ok = await Store.report({ ruta: selected, tipo: b.dataset.report, lat: me ? me.lat : null, lng: me ? me.lng : null });
      toast(ok ? '¡Gracias por avisar!' : 'No se pudo enviar el reporte');
    };
  });

  Store.subscribe((l) => { units = l; render(); });
  setInterval(render, 15000);
  locate();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
