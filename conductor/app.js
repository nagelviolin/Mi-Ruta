(function () {
  const $ = (id) => document.getElementById(id);
  const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const HEARTBEAT_MS = 20000;
  const id = ls.get('miruta.driverId') || ('u' + Math.random().toString(36).slice(2, 10));
  ls.set('miruta.driverId', id);

  let perfil = null; try { perfil = JSON.parse(ls.get('miruta.perfil')); } catch {}
  let estado = 'cupo', activo = false, oculto = false, watch = null, ultima = null, hb = null, wake = null;

  document.querySelectorAll('[data-ico]').forEach((el) => { el.innerHTML = VEH.svg(el.dataset.ico, 20); });
  if (Store.mode === 'demo') $('demo').hidden = false;
  window.RUTAS.forEach((r) => { const o = document.createElement('option'); o.value = r.id; o.textContent = r.nombre; $('ruta').appendChild(o); });
  const rutaNombre = (rid) => (window.RUTAS.find((r) => r.id === rid) || {}).nombre || rid;

  function vista() {
    $('vista-registro').hidden = !!perfil;
    $('vista-ruta').hidden = !perfil;
    if (perfil) { $('perfil-nombre').textContent = perfil.nombre; $('perfil-ruta').textContent = VEH.nombre(perfil.tipo) + ' · Ruta ' + rutaNombre(perfil.ruta); }
  }
  $('form-registro').onsubmit = (e) => {
    e.preventDefault();
    perfil = { nombre: $('nombre').value.trim(), ruta: $('ruta').value, tipo: document.querySelector('input[name=tipo]:checked').value };
    ls.set('miruta.perfil', JSON.stringify(perfil)); vista();
  };
  $('btn-cambiar').onclick = () => {
    if (activo && !confirm('Esto termina tu recorrido actual. ¿Continuar?')) return;
    terminar(); $('nombre').value = perfil.nombre; $('ruta').value = perfil.ruta; const tr = document.querySelector(`input[name=tipo][value=${perfil.tipo || 'carrito'}]`); if (tr) tr.checked = true; perfil = null; vista();
  };

  const TEXT = {
    idle: ['•', 'SIN INICIAR', 'Toca “Iniciar recorrido” para compartir tu ubicación'],
    cupo: ['✓', 'HAY CUPO', 'Los pasajeros te ven con cupo'],
    lleno: ['✕', 'LLENO', 'Los pasajeros te ven lleno'],
    fuera: ['⏸', 'EN DESCANSO', 'Estás oculto en el mapa. Toca Hay cupo o Lleno para volver']
  };
  function pintar(clave, sub) {
    const t = TEXT[clave];
    $('estado').dataset.estado = clave;
    $('estado-icono').textContent = t[0]; $('estado-texto').textContent = t[1]; $('estado-sub').textContent = sub || t[2];
  }

  async function publicar() {
    if (!activo || oculto || !ultima) return;
    const ok = await Store.upsert({ id, nombre: perfil.nombre, ruta: perfil.ruta, tipo: perfil.tipo || 'carrito', estado, lat: ultima.lat, lng: ultima.lng });
    $('estado-sub').textContent = ok ? 'Ubicación enviada · ' + new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : 'Sin conexión, reintentando…';
  }
  const vibrar = () => navigator.vibrate && navigator.vibrate(60);
  function setEstado(e) { vibrar(); estado = e; oculto = false; pintar(e); publicar(); }
  $('btn-cupo').onclick = () => setEstado('cupo');
  $('btn-lleno').onclick = () => setEstado('lleno');
  $('btn-descanso').onclick = () => { vibrar(); oculto = true; Store.remove(id); pintar('fuera'); };

  async function pantallaEncendida() {
    try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch {}
  }
  document.addEventListener('visibilitychange', () => { if (activo && document.visibilityState === 'visible') pantallaEncendida(); });

  $('btn-iniciar').onclick = () => {
    if (!navigator.geolocation) { pintar('idle', 'Este dispositivo no tiene GPS'); return; }
    activo = true; oculto = false; estado = 'cupo';
    $('btn-iniciar').hidden = true; $('botones').hidden = false; $('botones2').hidden = false;
    pintar('cupo', 'Buscando señal GPS…');
    watch = navigator.geolocation.watchPosition(
      (p) => { ultima = { lat: p.coords.latitude, lng: p.coords.longitude }; publicar(); },
      (err) => { $('estado-sub').textContent = err.code === 1 ? 'Permite la ubicación para que te vean' : 'Sin señal GPS'; },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    hb = setInterval(publicar, HEARTBEAT_MS); // reenvía aunque no te muevas
    pantallaEncendida();
  };

  function terminar() {
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    clearInterval(hb); watch = null; hb = null; ultima = null;
    if (wake) { wake.release().catch(() => {}); wake = null; }
    if (activo) Store.remove(id);
    activo = false;
    $('btn-iniciar').hidden = false; $('botones').hidden = true; $('botones2').hidden = true;
    pintar('idle');
  }
  $('btn-terminar').onclick = () => { if (confirm('¿Terminar el recorrido? Dejarás de aparecer en el mapa.')) { vibrar(); terminar(); } };

  vista(); pintar('idle');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
