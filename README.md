# Mi Ruta

App colaborativa de transporte público para Calabozo, Guárico (Venezuela). Gratis, financiada con publicidad.

## Problema
Transporte caótico: nadie sabe por dónde pasa el carrito/autobús, si lleva cupo o si va lleno, ni cuánto falta para que llegue.

## Idea
- Los pasajeros ven en un mapa las unidades en vivo, su recorrido y si llevan cupo.
- Los conductores reportan su estado de forma muy simple (sin usar el celular manejando).
- Los pasajeros también colaboran: "lo vi pasar por X", "va lleno".

## Dispositivo físico para conductores (idea del autor)
- GPS + electrónica lo más barata posible (tipo ESP32 + módulo GPS + conectividad móvil).
- Tres botones: **Recorrido** (ruta que hace), **Cupo** (hay puestos), **Lleno**.
- Alternativa sin hardware: modo conductor en la propia app.

## MVP (fase 1, sin hardware)
1. Mapa de Calabozo (OpenStreetMap) con rutas dibujadas.
2. Modo conductor en el celular: elegir ruta + botones Cupo / Lleno + compartir GPS.
3. Modo pasajero: ver unidades en vivo, estado y hora estimada.
4. Reportes colaborativos de pasajeros.
5. PWA + APK (mismo pipeline que Calabozo en Línea: GitHub Pages + Actions).

## Fase 2
- Dispositivo físico de 3 botones.
- Avisos de gasolina / apagones relacionados con el transporte.
- Publicidad (web/AdMob) y anuncios locales.

## Stack propuesto
Web/PWA (JS + MapLibre/Leaflet), Supabase (auth, realtime, tabla `units` con posición y estado), GitHub Pages + Actions para el APK.

## Pendiente por definir
- Rutas reales y paradas de Calabozo (recorrerlas con conductores).
- Nombre/colores/logo.
- Diseño de pantallas (ver `docs/pantallas.md`).

## Estructura actual (esqueleto MVP)
- `pasajero/` → PWA del pasajero: rutas cercanas por ubicación, unidades en vivo, tiempo aproximado, reportes.
- `conductor/` → PWA del conductor: registro con ruta, GPS, Hay cupo / Lleno, pantalla siempre encendida.
- `shared/` → rutas (`routes.js`), datos (`store.js`), geometría, estilos y configuración.
- Ambas apps son independientes pero comparten el mismo servidor en tiempo real.

## Conectar el tiempo real (Supabase)
1. Crea un proyecto en supabase.com y ejecuta `docs/supabase.sql` en el SQL Editor.
2. Pega la URL y la clave `anon` en `shared/config.js`.
3. Sin eso, las apps funcionan en MODO DEMO (solo el mismo navegador).
