// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS, SCATTER_CORNERS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Ciclo scatter/chase en frames (~60fps): scatter 7s -> chase 20s -> repetir.
const SCATTER_FRAMES = 420;
const CHASE_FRAMES = 1200;

// Waypoints de salida de la pen, consumidos en modo 'exit'.
// La puerta esta en fila 12, cols 13-14; se sale a la fila 11.
const EXIT_WAYPOINTS = {
  blinky: [ { x: 13, y: 11 } ],
  pinky:  [ { x: 14, y: 11 } ],
  inky:   [ { x: 13, y: 14 }, { x: 13, y: 11 } ],
  clyde:  [ { x: 14, y: 14 }, { x: 14, y: 11 } ],
};

// Fantasma nuevo a partir de su entrada en GHOST_STARTS.
function makeGhost( start ) {
  return {
    x: start.x,
    y: start.y,
    dir: 'up',
    speed: GHOST_SPEED,
    kind: start.kind,
    mode: 'pen', // congelado en la pen hasta agotar releaseDelay
    waypoints: EXIT_WAYPOINTS[ start.kind ].map( ( w ) => ( { ...w } ) ),
    releaseDelay: start.releaseDelay,
  };
}

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( makeGhost ),
    mode: 'scatter',
    modeTimer: SCATTER_FRAMES,
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
// La puerta (tile 3) es de UN SOLO SENTIDO: bloquea a Pac-Man y a los
// fantasmas en modo 'normal'. Solo la cruzan los fantasmas saliendo,
// cuyo modo 'exit' avanza por waypoints fijos sin consultar canMove.
// El parametro actor se conserva para reglas futuras por actor.
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) return true; // puerta: nadie la cruza via canMove
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Tile objetivo de un fantasma segun su personalidad y el modo del juego.
// En scatter todos apuntan a su esquina. El objetivo puede caer fuera del
// laberinto: solo se usa como referencia de distancia, nunca se pisa.
function ghostTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  if ( game.mode === 'scatter' ) return SCATTER_CORNERS[ g.kind ];

  switch ( g.kind ) {
    case 'blinky':
      // Agresivo: el tile de Pac-Man.
      return { x: px, y: py };
    case 'pinky': {
      // Embosca: 4 celdas delante de la direccion de Pac-Man (vector limpio,
      // sin el bug historico del overflow con 'up').
      const d = DIRS[ p.dir ];
      return { x: px + d.x * 4, y: py + d.y * 4 };
    }
    case 'inky': {
      // Flanquea: 2·(2 celdas delante de Pac-Man) − posicion de blinky.
      const d = DIRS[ p.dir ];
      const ax = px + d.x * 2;
      const ay = py + d.y * 2;
      const b = game.ghosts.find( ( gg ) => gg.kind === 'blinky' );
      return { x: ax * 2 - Math.round( b.x ), y: ay * 2 - Math.round( b.y ) };
    }
    case 'clyde': {
      // Timido: persigue solo si esta a mas de 8 celdas; si no, a su esquina.
      const dist = Math.abs( Math.round( g.x ) - px ) + Math.abs( Math.round( g.y ) - py );
      return dist > 8 ? { x: px, y: py } : SCATTER_CORNERS.clyde;
    }
  }
}

function decideGhost( game, g ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Greedy: la direccion valida que minimiza la distancia Manhattan al target.
  const t = ghostTarget( game, g );
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - t.x ) + Math.abs( ny - t.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Pen: congelado; solo descuenta el retraso y al agotarse pasa a 'exit'.
  if ( g.mode === 'pen' ) {
    if ( g.releaseDelay > 0 ) g.releaseDelay--;
    if ( g.releaseDelay <= 0 ) g.mode = 'exit';
    return;
  }

  // Exit: avanzar celda a celda hacia el waypoint actual. No consulta
  // canMove, por eso puede cruzar la puerta (tile 3), que isWall bloquea
  // para todos. Al consumirlos todos pasa a 'normal'.
  if ( g.mode === 'exit' ) {
    if ( aligned( g.x ) && aligned( g.y ) ) {
      g.x = Math.round( g.x );
      g.y = Math.round( g.y );

      const target = g.waypoints[ 0 ];
      if ( g.x === target.x && g.y === target.y ) {
        g.waypoints.shift();
        if ( g.waypoints.length === 0 ) {
          g.mode = 'normal';
          // Elegir direccion de IA ya; el opuesto de 'up' evita volver
          // a entrar por la puerta.
          decideGhost( game, g );
          return;
        }
      }
      const next = g.waypoints[ 0 ];
      g.dir = g.x === next.x
        ? ( next.y < g.y ? 'up' : 'down' )
        : ( next.x < g.x ? 'left' : 'right' );
    }
    const d = DIRS[ g.dir ];
    g.x += d.x * g.speed;
    g.y += d.y * g.speed;
    return;
  }

  // Normal: IA greedy.
  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    // Restaurar el fantasma por completo: posicion, pen, waypoints y retraso.
    Object.assign( g, makeGhost( GHOST_STARTS[ i ] ) );
  } );
  // Reiniciar el ciclo scatter/chase.
  game.mode = 'scatter';
  game.modeTimer = SCATTER_FRAMES;
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

// Decrementa el timer y alterna scatter (7s) -> chase (20s) -> repetir.
function updateMode( game ) {
  game.modeTimer--;
  if ( game.modeTimer > 0 ) return;
  if ( game.mode === 'scatter' ) {
    game.mode = 'chase';
    game.modeTimer = CHASE_FRAMES;
  } else {
    game.mode = 'scatter';
    game.modeTimer = SCATTER_FRAMES;
  }
}

function update( game ) {
  updateMode( game );
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
