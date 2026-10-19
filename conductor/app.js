(function () {
  const $ = (id) => document.getElementById(id);
  const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };
  const HEARTBEAT_MS = 20000;
  const AUTH = Store.mode === 'supabase' && !!Store.sb;   // sin servidor = modo demo, sin cuentas
  const sb = Store.sb;

  let user = null, aprobado = false, modoAuth = 'entrar';
  let id = ls.get('miruta.driverId') || ('u' + Math.random().toString(36).slice(2, 10));
  ls.set('miruta.driverId', id);
  let perfil = null; try { perfil = JSON.parse(ls.get('miruta.perfil')); } catch {}
  let estado = 'cupo', activo = false, oculto = false, watch = null, ultima = null, hb = null, wake = null, pendTimer = null;

  if (Store.mode === 'demo') $('demo').hidden = false;
  window.RUTAS.forEach((r) => { const o = document.createElement('option'); o.value = r.id; o.textContent = r.nombre; $('ruta').appendChild(o); });
  document.querySelectorAll('[data-ico]').forEach((el) => { el.innerHTML = VEH.svg(el.dataset.ico, 20); });
  const rutaNombre = (rid) => (window.RUTAS.find((r) => r.id === rid) || {}).nombre || rid;

  // ── Vistas
  const VISTAS = ['auth', 'pendiente', 'registro', 'ruta'];
  function mostrar(v) {
    VISTAS.forEach((x) => { $('vista-' + x).hidden = x !== v; });
    clearInterval(pendTimer);
    if (v === 'pendiente') pendTimer = setInterval(revisar, 15000);
    if (v === 'ruta' && perfil) {
      $('perfil-nombre').textContent = perfil.nombre;
      $('perfil-ruta').textContent = VEH.nombre(perfil.tipo) + ' · Ruta ' + rutaNombre(perfil.ruta);
      $('btn-salir').hidden = !AUTH;
    }
  }
  function ir() {
    if (AUTH && !user) return mostrar('auth');
    if (AUTH && !aprobado) return mostrar('pendiente');
    mostrar(perfil ? 'ruta' : 'registro');
  }

  // ── Cuentas (Supabase Auth). El "usuario" se guarda como correo interno.
  const limpio = (u) => u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  const emailDe = (u) => limpio(u) + '@conductor.miruta.app';
  const msgError = (e) => {
    const m = (e && e.message || '').toLowerCase();
    if (m.includes('invalid login')) return 'Usuario o contraseña incorrectos.';
    if (m.includes('already registered') || m.includes('already been registered')) return 'Ese usuario ya existe. Elige otro o toca Entrar.';
    if (m.includes('password')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espera unos minutos.';
    if (m.includes('fetch') || m.includes('network')) return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
    return 'No se pudo completar. Intenta de nuevo.';
  };
  const setError = (t) => { $('auth-error').hidden = !t; $('auth-error').textContent = t || ''; };

  function setModo(m) {
    modoAuth = m;
    $('seg-entrar').setAttribute('aria-selected', String(m === 'entrar'));
    $('seg-crear').setAttribute('aria-selected', String(m === 'crear'));
    $('f-nombre').hidden = m !== 'crear';
    $('auth-nombre').required = m === 'crear';
    $('auth-submit').textContent = m === 'crear' ? 'Crear cuenta' : 'Entrar';
    $('auth-pass').autocomplete = m === 'crear' ? 'new-password' : 'current-password';
    setError('');
  }
  $('seg-entrar').onclick = () => setModo('entrar');
  $('seg-crear').onclick = () => setModo('crear');

  async function cargarConductor() {
    const { data, error } = await sb.from('drivers').select('aprobado,nombre').eq('id', user.id).maybeSingle();
    if (error) { aprobado = false; return false; }
    if (!data) {
      const nombre = (user.user_metadata && user.user_metadata.nombre) || '';
      await sb.from('drivers').insert({ id: user.id, usuario: (user.email || '').split('@')[0], nombre });
      aprobado = false; return true;
    }
    aprobado = !!data.aprobado;
    return true;
  }

  $('form-auth').onsubmit = async (e) => {
    e.preventDefault(); setError('');
    const u = limpio($('auth-user').value), pass = $('auth-pass').value;
    if (u.length < 3) return setError('El usuario debe tener al menos 3 letras o números (sin espacios).');
    $('auth-submit').disabled = true;
    try {
      let res;
      if (modoAuth === 'crear') {
        res = await sb.auth.signUp({ email: emailDe(u), password: pass, options: { data: { nombre: $('auth-nombre').value.trim() } } });
        if (!res.error && !res.data.session) return setError('Cuenta creada, pero falta activar el acceso. Avisa al administrador.');
      } else {
        res = await sb.auth.signInWithPassword({ email: emailDe(u), password: pass });
      }
      if (res.error) return setError(msgError(res.error));
      user = res.data.user || (res.data.session && res.data.session.user);
      id = user.id;
      await cargarConductor();
      $('auth-pass').value = '';
      ir();
    } catch (err) { setError(msgError(err)); }
    finally { $('auth-submit').disabled = false; }
  };

  async function revisar() {
    $('pend-estado').textContent = 'Revisando…';
    await cargarConductor();
    if (aprobado) { ir(); return; }
    $('pend-estado').textContent = 'Aún sin aprobar · ' + new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }
  $('btn-revisar').onclick = revisar;

  async function salir() {
    if (activo && !confirm('Esto termina tu recorrido y cierra tu sesión. ¿Continuar?')) return;
    terminar();
    await sb.auth.signOut();
    user = null; aprobado = false; setModo('entrar'); ir();
  }
  $('btn-salir').onclick = salir;
  $('btn-salir2').onclick = salir;

  // ── Registro de unidad
  $('form-registro').onsubmit = (e) => {
    e.preventDefault();
    perfil = { nombre: $('nombre').value.trim(), ruta: $('ruta').value, tipo: document.querySelector('input[name=tipo]:checked').value };
    ls.set('miruta.perfil', JSON.stringify(perfil)); ir();
  };
  $('btn-cambiar').onclick = () => {
    if (activo && !confirm('Esto termina tu recorrido actual. ¿Continuar?')) return;
    terminar(); $('nombre').value = perfil.nombre; $('ruta').value = perfil.ruta;
    const tr = document.querySelector(`input[name=tipo][value=${perfil.tipo || 'carrito'}]`); if (tr) tr.checked = true;
    perfil = null; ir();
  };

  // ── Estado y GPS
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
    $('estado-sub').textContent = ok ? 'Ubicación enviada · ' + new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : 'No se pudo enviar. Reintentando…';
  }
  const vibrar = () => navigator.vibrate && navigator.vibrate(60);
  function setEstado(e) { vibrar(); estado = e; oculto = false; pintar(e); publicar(); }
  $('btn-cupo').onclick = () => setEstado('cupo');
  $('btn-lleno').onclick = () => setEstado('lleno');
  $('btn-descanso').onclick = () => { vibrar(); oculto = true; Store.remove(id); pintar('fuera'); };

  async function pantallaEncendida() { try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch {} }
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
    hb = setInterval(publicar, HEARTBEAT_MS);
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

  // ── Arranque
  pintar('idle'); setModo('entrar');
  (async function init() {
    if (AUTH) {
      try {
        const { data } = await sb.auth.getSession();
        if (data.session) { user = data.session.user; id = user.id; await cargarConductor(); }
      } catch {}
    }
    ir();
  })();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
