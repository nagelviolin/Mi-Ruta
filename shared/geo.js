window.Geo = {
  // Distancia en metros entre dos puntos {lat,lng} (haversine)
  dist(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  },
  // Distancia mínima en metros de un punto a una polilínea [[lat,lng],...]
  distToPolyline(p, pts) {
    if (!pts || !pts.length) return Infinity;
    const k = 111320, cos = Math.cos(p.lat * Math.PI / 180);
    const xy = (q) => [(q[1] - p.lng) * k * cos, (q[0] - p.lat) * k];
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = xy(pts[i]);
      if (i === 0) { best = Math.min(best, Math.hypot(x1, y1)); continue; }
      const [x0, y0] = xy(pts[i - 1]);
      const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, -(x0 * dx + y0 * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(x0 + t * dx, y0 + t * dy));
    }
    return best;
  },
  // Minutos aproximados a ~18 km/h (tráfico urbano con paradas). Es una estimación.
  etaMin(m) { return Math.max(1, Math.round(m / 300)); },
  fmtDist(m) { return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1) + ' km'; },
  fmtAgo(ms) { const s = Math.round((Date.now() - ms) / 1000); return s < 60 ? 'hace ' + s + ' s' : 'hace ' + Math.round(s / 60) + ' min'; }
};
