// Capa de datos compartida por las dos apps.
// - Con Supabase configurado: tiempo real entre teléfonos distintos.
// - Sin configurar: MODO DEMO con localStorage (solo pestañas del mismo navegador).
(function () {
  const cfg = window.MIRUTA_CONFIG || {};
  const KEEP_MS = 10 * 60 * 1000; // más viejo que esto desaparece
  const subs = new Set();
  let cache = {};
  const emit = () => { const now = Date.now(); const l = Object.values(cache).filter((u) => now - u.updated < KEEP_MS); subs.forEach((f) => f(l)); };
  const useSb = !!(cfg.supabaseUrl && cfg.supabaseKey && window.supabase);
  const Store = { mode: useSb ? 'supabase' : 'demo' };

  if (useSb) {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    const toUnit = (r) => ({ id: r.id, nombre: r.nombre, ruta: r.ruta, tipo: r.tipo, estado: r.estado, lat: r.lat, lng: r.lng, updated: Date.parse(r.updated_at) });
    const load = async () => {
      const { data, error } = await sb.from('units').select('*').gte('updated_at', new Date(Date.now() - KEEP_MS).toISOString());
      if (error) return;
      cache = {}; data.forEach((r) => { cache[r.id] = toUnit(r); }); emit();
    };
    load(); setInterval(load, 30000);
    sb.channel('units-live').on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, (p) => {
      if (p.eventType === 'DELETE') delete cache[p.old.id]; else cache[p.new.id] = toUnit(p.new);
      emit();
    }).subscribe();
    Store.upsert = async (u) => {
      const { error } = await sb.from('units').upsert({ id: u.id, nombre: u.nombre, ruta: u.ruta, tipo: u.tipo, estado: u.estado, lat: u.lat, lng: u.lng, updated_at: new Date().toISOString() });
      return !error;
    };
    Store.remove = async (id) => { const { error } = await sb.from('units').delete().eq('id', id); return !error; };
    Store.report = async (r) => { const { error } = await sb.from('reports').insert(r); return !error; };
  } else {
    const KEY = 'miruta.demo.units', bc = 'BroadcastChannel' in window ? new BroadcastChannel('miruta') : null;
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
    const sync = () => { cache = read(); emit(); };
    const save = (all) => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {} bc && bc.postMessage('u'); sync(); return true; };
    sync();
    if (bc) bc.onmessage = sync;
    window.addEventListener('storage', (e) => e.key === KEY && sync());
    Store.upsert = async (u) => { const all = read(); all[u.id] = { ...u, updated: Date.now() }; return save(all); };
    Store.remove = async (id) => { const all = read(); delete all[id]; return save(all); };
    Store.report = async () => true;
  }

  setInterval(emit, 15000);
  Store.subscribe = (fn) => { subs.add(fn); emit(); return () => subs.delete(fn); };
  window.Store = Store;
})();
