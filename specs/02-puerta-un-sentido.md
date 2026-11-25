# SPEC 02 — Puerta de la pen de un solo sentido

**Estado:** Implementado
**Depende de:** SPEC 01
**Fecha:** 2026-11-25
**Objetivo:** Evitar que un fantasma en modo `normal` reentre a la pen por la puerta y quede atrapado orbitando dentro, haciendo la puerta transitable solo hacia afuera, como en el arcade original.

## Contexto del defecto

La salida escalonada de SPEC 01 funciona: los 4 fantasmas salen a su tiempo (0s/3s/8s/12s). El defecto aparece después: `isWall()` solo bloquea el tile 3 (puerta) para Pac-Man, así que un fantasma en modo `normal` puede entrar por ella. Como `decideGhost()` es greedy por distancia Manhattan, si Pac-Man está debajo de la pen, un fantasma que pase por (13,11) o (14,11) elige `down`, entra… y la combinación greedy + regla de no-reversa lo deja orbitando dentro indefinidamente (reproducido por simulación: blinky dio vueltas dentro de la pen más de 10s sin escapar). Es intermitente en partida real porque depende de la posición de Pac-Man.

## Alcance

**Incluye:**

- En `isWall()` (`src/js/game.js`), el tile 3 (puerta) pasa a bloquear a **todos** los actores en `canMove()`: Pac-Man y fantasmas en modo `normal`.
- Actualizar los comentarios afectados (`isWall`, modo `'exit'` en `moveGhost`).
- Verificación por simulación desechable con node (no se agrega nada al repo) + verificación manual en navegador.

**NO incluye (explícito):**

- Cambios en la salida escalonada (`releaseDelay` + waypoints): funciona y se mantiene.
- Cambios en el reset tras perder vida: se mantiene lo decidido en SPEC 01.
- Frightened / power-pellets: sigue pendiente de su propio spec.
- Animación visual de la puerta (abrirse/cerrarse): la puerta se sigue dibujando igual.

## Modelo de datos

Este feature no introduce datos nuevos. Reutiliza el modelo de SPEC 01 (tile 3 = puerta en `game.grid`). Solo cambia la semántica de bloqueo en `isWall()`:

```js
// La puerta (tile 3) es de UN SOLO SENTIDO: bloquea a Pac-Man y a los
// fantasmas en modo 'normal'. Solo la cruzan los fantasmas saliendo,
// cuyo modo 'exit' avanza por waypoints fijos sin consultar canMove.
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) return true; // puerta: nadie la cruza via canMove
  return false;
}
```

El parámetro `actor` se conserva en la firma aunque hoy la puerta bloquea a ambos: mantiene el diff mínimo y deja sitio a reglas futuras por actor.

## Plan de implementación

1. `game.js` (`isWall`): cambiar la condición del tile 3 de `actor === 'pacman'` a incondicional y actualizar su comentario.
2. `game.js` (`moveGhost`, rama `'exit'`): ajustar el comentario que dice que la puerta "ya es transitable para fantasmas" — ahora solo lo es vía waypoints.
3. Verificación por simulación (node, script desechable): correr `update()` una partida larga con Pac-Man quieto debajo de la pen en chase y afirmar que ningún fantasma en modo `normal` ocupa el recinto de la pen (filas 13–15, cols 11–16, más las puertas (13,12)/(14,12)).
4. Verificación manual en navegador: salida escalonada intacta al inicio y tras perder una vida; ningún fantasma se zambulle por la puerta con Pac-Man debajo; sin errores en consola.

## Criterios de aceptación

- [x] Con Pac-Man quieto debajo de la pen y chase forzado, ningún fantasma entra al recinto de la pen (filas 13–15, cols 11–16) en una simulación de 600+ frames.
- [x] blinky, pinky, inky y clyde salen a ~0s / ~3s / ~8s / ~12s igual que antes (regresión de salida).
- [x] La puerta sigue bloqueando a Pac-Man (no puede entrar a la pen).
- [x] Tras perder una vida, los 4 fantasmas vuelven a la pen y vuelven a salir a sus tiempos.
- [x] Ningún fantasma atraviesa muros (regresión general de movimiento).
- [x] El juego corre sin errores en la consola del navegador.

## Decisiones tomadas y descartadas

- **Puerta de un solo sentido** (elegida por el usuario) frente a lógica de escape o teletransporte: igual que el arcade original; fix mínimo y determinista que elimina la causa en vez de tratar el síntoma.
- **Salida animada por waypoints intacta**: el modo `'exit'` avanza por waypoints sin consultar `canMove`, así que bloquear la puerta en `isWall()` no afecta la salida. Confirmado por simulación antes de escribir este spec.
- **Reset tras muerte sin cambios**: SPEC 01 lo definió así; este spec no reabre esa decisión.
- **Parámetro `actor` conservado** en `isWall`/`canMove` aunque la puerta ya bloquea a ambos: diff mínimo.
- **Defecto intermitente**: el usuario no logra reproducirlo visualmente en su sesión actual; el agujero está confirmado por simulación y depende de la posición de Pac-Man. Se corrige igualmente.
- **Descartada** lógica de escape al quedar dentro: más estados intermedios para un caso que ya no puede ocurrir.
- **Descartado** teletransporte de fantasmas atascados: salto visible en pantalla e innecesario con la puerta de un sentido.

## Riesgos identificados

- **Ninguno relevante.** El cambio es una sola condición en `isWall()`. Los únicos usos de `canMove` con fantasmas son `decideGhost` y el modo `normal` (nunca dentro de la pen tras el fix), y el modo `'exit'` no la consulta. Verificado en simulación antes de escribir este spec.
