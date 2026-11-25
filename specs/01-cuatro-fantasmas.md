# SPEC 01 — Cuatro fantasmas con personalidades clásicas

**Estado:** Approved
**Depende de:** —
**Fecha:** 2026-11-25
**Objetivo:** Tener 4 fantasmas (`blinky`, `pinky`, `inky`, `clyde`) con las personalidades clásicas del Pac-Man original — `blinky` persigue agresivamente a Pac-Man — alternando entre modos scatter y chase y saliendo de la pen de forma escalonada.

## Alcance

**Incluye:**

- Reemplazar los 2 fantasmas actuales (`hunter`/`random`) por 4 con personalidades clásicas.
- `blinky`: agresivo, persigue directo el tile de Pac-Man.
- `pinky`: embosca, apunta 4 celdas delante de la dirección de Pac-Man.
- `inky`: flanquea, su objetivo es `2·(2 celdas delante de Pac-Man) − posición de blinky`.
- `clyde`: tímido, persigue si su distancia a Pac-Man es > 8 celdas; si no, va a su esquina.
- Alternancia scatter/chase con timer fijo (7s / 20s, repetido).
- Salida escalonada de la pen: blinky 0s, pinky ~3s, inky ~8s, clyde ~12s.

**NO incluye (explícito):**

- Modo frightened, power-pellets y fantasmas comibles → spec aparte.
- Diferencias de velocidad entre fantasmas (todos usan `GHOST_SPEED`).
- El bug histórico del original con dirección `up` (overflow de pinky/inky) — se usa el vector limpio.
- Progresión de dificultad entre niveles.
- Animación de "bobbing" dentro de la pen.

## Modelo de datos

**En `maze.js`** — `GHOST_STARTS` pasa de 2 a 4 entradas con retraso de salida, y se añade la export de esquinas:

```js
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'blinky', releaseDelay: 0 },   // sale ya
  { x: 14, y: 14, kind: 'pinky',  releaseDelay: 180 },  // ~3s
  { x: 12, y: 14, kind: 'inky',   releaseDelay: 480 },  // ~8s
  { x: 15, y: 14, kind: 'clyde', releaseDelay: 720 },   // ~12s
];
const SCATTER_CORNERS = {
  blinky: { x: 26, y: 1 },   // arriba-derecha
  pinky:  { x: 1,  y: 1 },   // arriba-izquierda
  inky:   { x: 26, y: 29 },  // abajo-derecha
  clyde:  { x: 1,  y: 29 },  // abajo-izquierda
};
window.SCATTER_CORNERS = SCATTER_CORNERS;
```

**En `game.js`** — cada fantasma gana dos campos, y el juego dos:

```js
// por fantasma
mode: 'pen' | 'exit' | 'normal',   // congelado / saliendo / IA normal
waypoints: [ {x,y}, ... ],          // celdas de salida, consumidas en modo 'exit'

// en game
mode: 'scatter' | 'chase',
modeTimer: <frames restantes>
```

Waypoints de salida (la puerta está en fila 12, cols 13–14; se sale a la fila 11):

- `blinky` (13,14): `[(13,11)]`
- `pinky` (14,14): `[(14,11)]`
- `inky` (12,14): `[(13,14), (13,11)]`
- `clyde` (15,14): `[(14,14), (14,11)]`

Schedule scatter/chase (frames a ~60fps, igual que las velocidades actuales): scatter 420 (7s) → chase 1200 (20s) → repetir.

**En `render.js`** — reordenar `GHOST_COLORS` para que el índice coincida con el orden de `GHOST_STARTS`: `['#ff0000', '#ffb8ff', '#00ffff', '#ffb852']` (blinky rojo, pinky rosa, inky cian, clyde naranja).

## Plan de implementación

1. `maze.js`: `GHOST_STARTS` con las 4 entradas + `SCATTER_CORNERS` + export a `window`.
2. `game.js` (`createGame`): crear los 4 fantasmas con `mode: 'pen'`, `waypoints` y `releaseDelay`; añadir `game.mode = 'scatter'` y `game.modeTimer`.
3. `game.js` (`moveGhost`): en modo `'pen'` no mover y descontar el retraso; al agotarse pasar a `'exit'`; en `'exit'` avanzar celda a celda hacia el waypoint actual (la puerta, tile 3, ya es transitable para fantasmas); al consumir todos, pasar a `'normal'`.
4. `game.js` (`decideGhost`): calcular el tile objetivo según `kind` y `game.mode` (en scatter todos apuntan a su esquina), y elegir la dirección válida que minimice la distancia Manhattan — mismo mecanismo greedy que el `hunter` actual.
5. `game.js` (`update`): decrementar `modeTimer` y alternar scatter/chase.
6. `game.js` (`resetPositions`): al perder una vida, restaurar posición, `mode: 'pen'`, `waypoints` y `releaseDelay` de los 4 fantasmas, y reiniciar el ciclo scatter/chase.
7. `render.js`: reordenar `GHOST_COLORS`.
8. Verificación manual en el navegador.

## Criterios de aceptación

- [ ] Al iniciar hay exactamente 4 fantasmas visibles con sus colores clásicos (blinky rojo, pinky rosa, inky cian, clyde naranja).
- [ ] `blinky` sale de la pen de inmediato y en chase se dirige siempre hacia el tile de Pac-Man (comportamiento agresivo visible).
- [ ] `pinky` apunta 4 celdas delante de la dirección actual de Pac-Man.
- [ ] El objetivo de `inky` cumple `target = 2·(2 delante de Pac-Man) − pos(blinky)`.
- [ ] `clyde` persigue a Pac-Man solo cuando su distancia Manhattan > 8; en caso contrario se dirige a su esquina.
- [ ] Los primeros 7s todos van a su esquina (scatter), luego 20s de chase, y el ciclo se repite de forma observable.
- [ ] `pinky`, `inky` y `clyde` permanecen inmóviles en la pen hasta ~3s / ~8s / ~12s respectivamente.
- [ ] Ningún fantasma atraviesa muros; la puerta (tile 3) sigue bloqueando a Pac-Man.
- [ ] Perder una vida devuelve los 4 fantasmas a la pen con sus retrasos y reinicia el ciclo scatter/chase.
- [ ] Sin fantasmas cerca, todo lo demás (dots, score, vidas, túnel) funciona igual que antes.

## Decisiones tomadas y descartadas

- **Personalidades clásicas** del original (elegidas por el usuario) frente a versiones simplificadas sin dependencias entre fantasmas.
- **Schedule fijo 7s/20s** en lugar del original (7,20,7,20,5,20,5,∞): suficiente para que el patrón sea visible y más fácil de verificar.
- **Salida por waypoints fijos**, no pathfinding: los movimientos dentro de la pen son triviales y deterministas.
- **Fantasmas congelados en pen**, sin bobbing: menos estado, mismo efecto de lectura.
- **`releaseDelay` en frames** (asumiendo ~60fps): consistente con `PACMAN_SPEED`/`GHOST_SPEED` que ya son celdas/frame.
- **Descartado** el bug de overflow del original con dirección `up` para pinky/inky: se implementa el vector matemático limpio.
- **Descartado** frightened/power-pellets de este spec: requiere cambios en el laberinto; será otro spec.
- **Reset completo tras perder vida**: los fantasmas vuelven a la pen aunque ya hubieran salido (mantiene el ritmo clásico de "oleada" tras cada muerte).

## Riesgos identificados

- **Inky depende de blinky**, pero blinky siempre sale primero (`releaseDelay: 0`), así que nunca hay dependencia de un fantasma aún en pen. Riesgo bajo.
- **Greedy con Manhattan puede orbitar** un objetivo sin alcanzarlo (pasa también en el original); aceptado como fidelidad al juego, no como bug.
- **Timers en frames** varían con la tasa de refresco real del monitor; aceptado porque todo el motor ya usa frames como unidad de tiempo.
