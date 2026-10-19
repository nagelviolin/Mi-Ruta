// Íconos de vehículo (caja 24x24). Los "huecos" usan var(--pb) = color de fondo del pin.
window.VEH = {
  bus: {
    label: 'Bus',
    glyph: `<rect x="4.5" y="3" width="15" height="16" rx="3" fill="#fff"/><rect x="7" y="18" width="3" height="3.5" rx="1" fill="#fff"/><rect x="14" y="18" width="3" height="3.5" rx="1" fill="#fff"/><rect x="6.5" y="6" width="11" height="6" rx="1.2" fill="var(--pb)"/><circle cx="8" cy="15.4" r="1.2" fill="var(--pb)"/><circle cx="16" cy="15.4" r="1.2" fill="var(--pb)"/>`
  },
  carrito: {
    label: 'Carrito',
    glyph: `<path d="M6.4 11 L8 6.6 a1.5 1.5 0 0 1 1.4-1h5.2a1.5 1.5 0 0 1 1.4 1L17.6 11z" fill="#fff"/><rect x="3.5" y="10.5" width="17" height="8" rx="2.4" fill="#fff"/><rect x="5.5" y="17.5" width="3" height="3.5" rx="1" fill="#fff"/><rect x="15.5" y="17.5" width="3" height="3.5" rx="1" fill="#fff"/><path d="M8.5 10 L9.5 7.2h5l1 2.8z" fill="var(--pb)"/><circle cx="7" cy="14.4" r="1.2" fill="var(--pb)"/><circle cx="17" cy="14.4" r="1.2" fill="var(--pb)"/>`
  },
  svg(tipo, size) { const v = this[tipo] || this.carrito; return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${v.glyph}</svg>`; },
  nombre(tipo) { return (this[tipo] || this.carrito).label; }
};
