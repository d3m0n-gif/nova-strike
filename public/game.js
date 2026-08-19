// NovaStrike 3D Client
// Complete replacement game.js

const socket = io({
  withCredentials: true
});

const THREE_URL =
  "https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js";

let THREE;
let scene;
let camera;
let renderer;
let clock;

let gameStarted = false;
let chatOpen = false;

const remotePlayers = new Map();
const keys = {};

const controls = {
  forward: "KeyW",
  backward: "KeyS",
  left: "KeyA",
  right: "KeyD",
  sprint: "KeyR",
  slide: "ShiftLeft",
  sneak: "KeyC",
  jump: "Space"
};

const DEFAULT_CONTROLS = { ...controls };

const player = {
  x: 0,
  y: 2,
  z: 80,

  velocityY: 0,

  speed: 8,
  sprintSpeed: 14,
  sneakSpeed: 4,

  height: 2,
  radius: 0.45,

  yaw: 0,
  pitch: 0,

  grounded: true,
  sliding: false,
  sneaking: false,

  health: 100,
  maxHealth: 100
};

/*
==================================================
WORLD COLLISION OBJECTS
==================================================
*/

const collisionObjects = [];

/*
==================================================
WEAPONS
==================================================
*/

let weaponGroup = null;
let currentWeapon = 1;

const weapons = {
  1: {
    name: "Nova Blaster",
    color: 0x4b8cff
  },

  2: {
    name: "Pulse Cannon",
    color: 0x9b59ff
  },

  3: {
    name: "Ion Launcher",
    color: 0xff8a3d
  }
};

/*
==================================================
LOAD THREE
==================================================
*/

async function loadThree() {
  try {
    THREE = await import(THREE_URL);
    startGame();
  } catch (error) {
    console.error("Could not load Three.js:", error);
    showError("Could not load the 3D engine.");
  }
}

/*
==================================================
START
==================================================
*/

function startGame() {
  if (gameStarted) return;

  gameStarted = true;

  scene = new THREE.Scene();

  scene.background = new THREE.Color(0x101522);

  scene.fog = new THREE.Fog(
    0x101522,
    80,
    450
  );

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1200
  );

  camera.position.set(
    player.x,
    player.y,
    player.z
  );

  renderer = new THREE.WebGLRenderer({
    antialias: true
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.shadowMap.enabled = true;

  renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;

  renderer.domElement.style.display = "block";

  document.body.appendChild(
    renderer.domElement
  );

  clock = new THREE.Clock();

  createWorld();
  createHUD();
  createWeapon();
  setupInput();
  connectPlayer();

  window.addEventListener(
    "resize",
    resize
  );

  animate();
}

/*
==================================================
WORLD
==================================================
*/

function createWorld() {
  collisionObjects.length = 0;

  /*
  SKY
  */

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(
      600,
      32,
      32
    ),
    new THREE.MeshBasicMaterial({
      color: 0x172033,
      side: THREE.BackSide
    })
  );

  scene.add(sky);

  /*
  LIGHTING
  */

  const ambient =
    new THREE.HemisphereLight(
      0xbfd7ff,
      0x18202b,
      2.2
    );

  scene.add(ambient);

  const sun =
    new THREE.DirectionalLight(
      0xffffff,
      2.4
    );

  sun.position.set(
    100,
    160,
    80
  );

  sun.castShadow = true;

  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;

  sun.shadow.camera.left = -300;
  sun.shadow.camera.right = 300;
  sun.shadow.camera.top = 300;
  sun.shadow.camera.bottom = -300;

  scene.add(sun);

  /*
  GROUND
  */

  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(
      320,
      2,
      320
    ),
    new THREE.MeshStandardMaterial({
      color: 0x303846,
      roughness: 0.9
    })
  );

  ground.position.y = -1;

  ground.receiveShadow = true;

  scene.add(ground);

  /*
  GROUND COLLISION
  */

  addCollision(
    0,
    -1,
    0,
    320,
    2,
    320
  );

  /*
  GRID
  */

  const grid =
    new THREE.GridHelper(
      320,
      64,
      0x566070,
      0x343c4b
    );

  grid.position.y = 0.01;

  scene.add(grid);

  /*
  LARGE BUILDINGS
  */

  createBuilding(
    -70,
    10,
    -55,
    55,
    20,
    40
  );

  createBuilding(
    70,
    12,
    -55,
    45,
    24,
    50
  );

  createBuilding(
    -75,
    9,
    55,
    50,
    18,
    45
  );

  createBuilding(
    70,
    8,
    55,
    55,
    16,
    40
  );

  /*
  CENTRAL BUILDING
  */

  createBuilding(
    0,
    14,
    0,
    30,
    28,
    30
  );

  /*
  PLATFORMS
  */

  createPlatform(
    -30,
    5,
    5,
    28,
    2,
    18
  );

  createPlatform(
    35,
    5,
    20,
    30,
    2,
    18
  );

  createPlatform(
    0,
    7,
    -60,
    35,
    2,
    18
  );

  /*
  COVER
  */

  for (let i = 0; i < 45; i++) {
    const x =
      Math.random() * 260 - 130;

    const z =
      Math.random() * 260 - 130;

    if (
      Math.abs(x) < 25 &&
      Math.abs(z) < 25
    ) {
      continue;
    }

    createCover(x, z);
  }
}

/*
==================================================
COLLISION
==================================================
*/

function addCollision(
  x,
  y,
  z,
  width,
  height,
  depth
) {
  collisionObjects.push({
    minX: x - width / 2,
    maxX: x + width / 2,

    minY: y - height / 2,
    maxY: y + height / 2,

    minZ: z - depth / 2,
    maxZ: z + depth / 2,

    width,
    height,
    depth
  });
}

function playerTouchesBox(
  x,
  y,
  z,
  box
) {
  const radius = player.radius;

  return (
    x + radius > box.minX &&
    x - radius < box.maxX &&
    z + radius > box.minZ &&
    z - radius < box.maxZ &&
    y + player.height > box.minY &&
    y < box.maxY
  );
}

/*
  This lets the player walk around
  solid buildings and also climb onto
  low/high platforms when jumping.
*/

function resolveHorizontalCollision(
  oldX,
  oldZ
) {
  let blockedX = false;
  let blockedZ = false;

  for (const box of collisionObjects) {
    /*
      Ignore the ground.
    */

    if (box.maxY <= 0) {
      continue;
    }

    if (
      playerTouchesBox(
        player.x,
        player.y - player.height / 2,
        player.z,
        box
      )
    ) {
      /*
        Try restoring X only.
      */

      const oldPlayerX = player.x;

      player.x = oldX;

      if (
        !playerTouchesBox(
          player.x,
          player.y - player.height / 2,
          player.z,
          box
        )
      ) {
        blockedZ = true;
      } else {
        player.x = oldPlayerX;
        player.z = oldZ;
        blockedX = true;
        blockedZ = true;
      }
    }
  }

  return {
    blockedX,
    blockedZ
  };
}

/*
==================================================
BUILDINGS
==================================================
*/

function createBuilding(
  x,
  y,
  z,
  width,
  height,
  depth
) {
  const material =
    new THREE.MeshStandardMaterial({
      color: 0x596273,
      roughness: 0.75
    });

  const building =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        height,
        depth
      ),
      material
    );

  building.position.set(
    x,
    y,
    z
  );

  building.castShadow = true;
  building.receiveShadow = true;

  scene.add(building);

  /*
  Roof
  */

  const roof =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width + 2,
        1,
        depth + 2
      ),
      new THREE.MeshStandardMaterial({
        color: 0x252c38
      })
    );

  roof.position.set(
    x,
    y + height / 2 + 0.5,
    z
  );

  roof.castShadow = true;

  scene.add(roof);

  /*
  IMPORTANT:
  The entire building is solid.
  */

  addCollision(
    x,
    y,
    z,
    width,
    height,
    depth
  );
}

/*
==================================================
PLATFORM
==================================================
*/

function createPlatform(
  x,
  y,
  z,
  width,
  height,
  depth
) {
  const platform =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        height,
        depth
      ),
      new THREE.MeshStandardMaterial({
        color: 0x3d526b,
        roughness: 0.7
      })
    );

  platform.position.set(
    x,
    y,
    z
  );

  platform.castShadow = true;
  platform.receiveShadow = true;

  scene.add(platform);

  addCollision(
    x,
    y,
    z,
    width,
    height,
    depth
  );
}

/*
==================================================
COVER
==================================================
*/

function createCover(
  x,
  z
) {
  const width =
    3 + Math.random() * 4;

  const height =
    2 + Math.random() * 3;

  const depth =
    3 + Math.random() * 4;

  const cover =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        height,
        depth
      ),
      new THREE.MeshStandardMaterial({
        color: 0x697487
      })
    );

  cover.position.set(
    x,
    height / 2,
    z
  );

  cover.castShadow = true;
  cover.receiveShadow = true;

  scene.add(cover);

  addCollision(
    x,
    height / 2,
    z,
    width,
    height,
    depth
  );
}

/*
==================================================
INPUT
==================================================
*/

function setupInput() {
  window.addEventListener(
    "keydown",
    event => {
      /*
        T opens Minecraft-style chat.
      */

      if (
        event.code === "KeyT" &&
        !chatOpen
      ) {
        event.preventDefault();

        openChat();

        return;
      }

      /*
        If chat is open, don't control
        the player with WASD.
      */

      if (chatOpen) {
        return;
      }

      keys[event.code] = true;

      /*
        Weapon switching.
      */

      if (
        event.code === "Digit1"
      ) {
        switchWeapon(1);
      }

      if (
        event.code === "Digit2"
      ) {
        switchWeapon(2);
      }

      if (
        event.code === "Digit3"
      ) {
        switchWeapon(3);
      }

      /*
        Jump.
      */

      if (
        event.code === "Space"
      ) {
        event.preventDefault();
        jump();
      }
    }
  );

  window.addEventListener(
    "keyup",
    event => {
      keys[event.code] = false;
    }
  );

  /*
    Mouse look.
  */

  window.addEventListener(
    "mousemove",
    event => {
      if (
        chatOpen ||
        document.pointerLockElement !==
          renderer.domElement
      ) {
        return;
      }

      player.yaw -=
        event.movementX * 0.0022;

      player.pitch -=
        event.movementY * 0.0022;

      player.pitch =
        Math.max(
          -1.45,
          Math.min(
            1.45,
            player.pitch
          )
        );
    }
  );

  /*
    Clicking the game locks the mouse.
  */

  renderer.domElement.addEventListener(
    "click",
    () => {
      if (chatOpen) return;

      renderer.domElement.requestPointerLock();
    }
  );

  /*
    ESC automatically releases pointer lock.
  */

  document.addEventListener(
    "pointerlockchange",
    () => {
      updatePointerLockUI();
    }
  );
}

/*
==================================================
CHAT
==================================================
*/

function openChat() {
  chatOpen = true;

  if (
    document.pointerLockElement
  ) {
    document.exitPointerLock();
  }

  const input =
    document.getElementById(
      "chat-input"
    );

  if (!input) return;

  input.style.display = "block";

  input.focus();

  input.value = "";
}

function closeChat(lockMouse = true) {
  chatOpen = false;

  const input =
    document.getElementById(
      "chat-input"
    );

  if (input) {
    input.style.display = "none";
    input.blur();
  }

  if (
    lockMouse &&
    renderer &&
    renderer.domElement
  ) {
    renderer.domElement.requestPointerLock();
  }
}

function setupChatInput() {
  const input =
    document.getElementById(
      "chat-input"
    );

  if (!input) return;

  input.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Enter"
      ) {
        event.preventDefault();

        const message =
          input.value.trim();

        if (message) {
          socket.emit(
            "chat:send",
            message
          );
        }

        input.value = "";

        closeChat(true);
      }

      if (
        event.key === "Escape"
      ) {
        event.preventDefault();

        input.value = "";

        closeChat(true);
      }
    }
  );
}

function updatePointerLockUI() {
  const status =
    document.getElementById(
      "mouse-status"
    );

  if (!status) return;

  if (chatOpen) {
    status.textContent =
      "CHAT OPEN";
  } else if (
    document.pointerLockElement ===
    renderer.domElement
  ) {
    status.textContent =
      "MOUSE LOCKED";
  } else {
    status.textContent =
      "CLICK TO PLAY";
  }
}

/*
==================================================
MOVEMENT
==================================================
*/

function updateMovement(delta) {
  if (chatOpen) {
    return;
  }

  let moveX = 0;
  let moveZ = 0;

  /*
    Correct Minecraft-style movement:

    W = forward
    S = backward
    A = left
    D = right
  */

  if (keys[controls.forward]) {
    moveZ -= 1;
  }

  if (keys[controls.backward]) {
    moveZ += 1;
  }

  if (keys[controls.left]) {
    moveX -= 1;
  }

  if (keys[controls.right]) {
    moveX += 1;
  }

  const moving =
    moveX !== 0 ||
    moveZ !== 0;

  const sprinting =
    keys[controls.sprint] &&
    moving &&
    !keys[controls.sneak];

  player.sneaking =
    keys[controls.sneak] &&
    moving;

  /*
    Slide.
  */

  if (
    keys[controls.slide] &&
    moving &&
    !player.sliding &&
    player.grounded
  ) {
    player.sliding = true;

    setTimeout(() => {
      player.sliding = false;
    }, 500);
  }

  let speed =
    player.speed;

  if (sprinting) {
    speed = player.sprintSpeed;
  }

  if (player.sneaking) {
    speed = player.sneakSpeed;
  }

  if (player.sliding) {
    speed =
      player.sprintSpeed * 1.35;
  }

  /*
    Movement direction.
  */

  if (moving) {
    const length =
      Math.sqrt(
        moveX * moveX +
        moveZ * moveZ
      );

    moveX /= length;
    moveZ /= length;

    const sin =
      Math.sin(player.yaw);

    const cos =
      Math.cos(player.yaw);

    const worldX =
      moveX * cos -
      moveZ * sin;

    const worldZ =
      moveX * sin +
      moveZ * cos;

    const oldX =
      player.x;

    const oldZ =
      player.z;

    player.x +=
      worldX *
      speed *
      delta;

    player.z +=
      worldZ *
      speed *
      delta;

    /*
      Collision with buildings.
    */

    resolveHorizontalCollision(
      oldX,
      oldZ
    );
  }

  /*
    Gravity.
  */

  player.velocityY -=
    24 * delta;

  player.y +=
    player.velocityY *
    delta;

  /*
    Ground.
  */

  if (player.y <= 2) {
    player.y = 2;
    player.velocityY = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  /*
    Allow the player to stand on
    buildings/platforms.
  */

  resolveVerticalCollision();

  /*
    Map boundaries.
  */

  player.x =
    Math.max(
      -155,
      Math.min(
        155,
        player.x
      )
    );

  player.z =
    Math.max(
      -155,
      Math.min(
        155,
        player.z
      )
    );

  /*
    Camera.
  */

  camera.position.set(
    player.x,
    player.y -
      (player.sneaking ? 0.55 : 0),
    player.z
  );

  camera.rotation.order =
    "YXZ";

  camera.rotation.y =
    player.yaw;

  camera.rotation.x =
    player.pitch;

  /*
    Send movement.
  */

  if (socket.connected) {
    socket.emit(
      "player:update",
      {
        x: player.x,
        y: player.y,
        z: player.z,
        rotationY: player.yaw,

        state:
          player.sliding
            ? "sliding"
            : player.sneaking
              ? "sneaking"
              : sprinting
                ? "sprinting"
                : "normal"
      }
    );
  }
}

/*
==================================================
VERTICAL COLLISION
==================================================
*/

function resolveVerticalCollision() {
  const bottom =
    player.y - player.height / 2;

  for (const box of collisionObjects) {
    /*
      Ground handled separately.
    */

    if (box.maxY <= 0) {
      continue;
    }

    const horizontal =
      player.x + player.radius >
        box.minX &&
      player.x - player.radius <
        box.maxX &&
      player.z + player.radius >
        box.minZ &&
      player.z - player.radius <
        box.maxZ;

    if (!horizontal) {
      continue;
    }

    /*
      Landing on top.
    */

    if (
      player.velocityY <= 0 &&
      bottom <= box.maxY + 0.3 &&
      bottom >= box.maxY - 1.5
    ) {
      player.y =
        box.maxY +
        player.height / 2;

      player.velocityY = 0;

      player.grounded = true;
    }
  }
}

/*
==================================================
JUMP
==================================================
*/

function jump() {
  if (
    !player.grounded ||
    chatOpen
  ) {
    return;
  }

  player.velocityY = 9;

  player.grounded = false;
}

/*
==================================================
WEAPON VISUAL
==================================================
*/

function createWeapon() {
  weaponGroup =
    new THREE.Group();

  weaponGroup.position.set(
    0.48,
    -0.42,
    -0.8
  );

  camera.add(
    weaponGroup
  );

  scene.add(camera);

  buildWeaponModel(
    weapons[currentWeapon]
  );
}

function clearWeaponModel() {
  if (!weaponGroup) return;

  while (
    weaponGroup.children.length
  ) {
    const child =
      weaponGroup.children[0];

    weaponGroup.remove(child);

    child.traverse(obj => {
      if (obj.geometry) {
        obj.geometry.dispose();
      }

      if (obj.material) {
        if (
          Array.isArray(
            obj.material
          )
        ) {
          obj.material.forEach(
            material =>
              material.dispose()
          );
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}

function buildWeaponModel(
  weapon
) {
  clearWeaponModel();

  /*
    Original stylized sci-fi
    first-person game model.
  */

  const mainMaterial =
    new THREE.MeshStandardMaterial({
      color: weapon.color,
      metalness: 0.65,
      roughness: 0.3
    });

  const darkMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x151923,
      metalness: 0.7,
      roughness: 0.25
    });

  /*
    Main body.
  */

  const body =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.34,
        0.22,
        0.85
      ),
      mainMaterial
    );

  body.position.set(
    0,
    0,
    0
  );

  weaponGroup.add(body);

  /*
    Front barrel.
  */

  const barrel =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.055,
        0.055,
        0.55,
        12
      ),
      darkMaterial
    );

  barrel.rotation.x =
    Math.PI / 2;

  barrel.position.set(
    0,
    0.01,
    -0.63
  );

  weaponGroup.add(barrel);

  /*
    Grip.
  */

  const grip =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.16,
        0.38,
        0.18
      ),
      darkMaterial
    );

  grip.rotation.x =
    -0.2;

  grip.position.set(
    0,
    -0.27,
    0.2
  );

  weaponGroup.add(grip);

  /*
    Energy core.
  */

  const core =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.07,
        12,
        12
      ),
      new THREE.MeshBasicMaterial({
        color: weapon.color
      })
    );

  core.position.set(
    0,
    0.12,
    -0.1
  );

  weaponGroup.add(core);
}

/*
==================================================
SWITCH WEAPON
==================================================
*/

function switchWeapon(slot) {
  if (!weapons[slot]) return;

  currentWeapon = slot;

  buildWeaponModel(
    weapons[currentWeapon]
  );

  const weaponText =
    document.getElementById(
      "weapon-name"
    );

  if (weaponText) {
    weaponText.textContent =
      weapons[currentWeapon].name;
  }
}

/*
==================================================
MULTIPLAYER
==================================================
*/

function connectPlayer() {
  socket.on(
    "connect",
    () => {
      socket.emit(
        "player:join"
      );
    }
  );

  socket.on(
    "players:list",
    data => {
      for (
        const p of data.players
      ) {
        createRemotePlayer(p);
      }
    }
  );

  socket.on(
    "player:joined",
    p => {
      createRemotePlayer(p);

      addChatMessage(
        "SYSTEM",
        `${p.username} joined the arena.`
      );
    }
  );

  socket.on(
    "player:update",
    p => {
      updateRemotePlayer(p);
    }
  );

  socket.on(
    "player:left",
    id => {
      removeRemotePlayer(id);
    }
  );

  socket.on(
    "players:count",
    count => {
      const element =
        document.getElementById(
          "player-count"
        );

      if (element) {
        element.textContent =
          `PLAYERS ${count}`;
      }
    }
  );

  socket.on(
    "chat:message",
    data => {
      addChatMessage(
        data.username,
        data.message
      );
    }
  );
}

/*
==================================================
REMOTE PLAYER
==================================================
*/

function createRemotePlayer(p) {
  if (
    remotePlayers.has(p.id)
  ) {
    return;
  }

  const group =
    new THREE.Group();

  /*
    Body.
  */

  const body =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.9,
        1.5,
        0.55
      ),
      new THREE.MeshStandardMaterial({
        color: 0x4f8cff
      })
    );

  body.position.y = 0.75;

  body.castShadow = true;

  group.add(body);

  /*
    Head.
  */

  const head =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.65,
        0.65,
        0.65
      ),
      new THREE.MeshStandardMaterial({
        color: 0xd6a47a
      })
    );

  head.position.y = 1.8;

  head.castShadow = true;

  group.add(head);

  /*
    Simple visible equipment
    on remote players.
  */

  const equipment =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.18,
        0.18,
        0.75
      ),
      new THREE.MeshStandardMaterial({
        color: 0x202532,
        metalness: 0.5
      })
    );

  equipment.position.set(
    0.55,
    0.9,
    -0.15
  );

  equipment.rotation.y =
    -0.25;

  equipment.castShadow = true;

  group.add(equipment);

  /*
    Name.
  */

  const name =
    createNameLabel(
      p.username
    );

  name.position.y = 2.5;

  group.add(name);

  group.position.set(
    p.x,
    p.y - 2,
    p.z
  );

  scene.add(group);

  remotePlayers.set(
    p.id,
    {
      object: group,

      targetX: p.x,
      targetY: p.y - 2,
      targetZ: p.z,

      targetRotation:
        p.rotationY || 0
    }
  );
}

/*
==================================================
NAME LABEL
==================================================
*/

function createNameLabel(text) {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = 512;
  canvas.height = 128;

  const context =
    canvas.getContext("2d");

  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  context.font =
    "bold 42px Arial";

  context.textAlign =
    "center";

  context.fillStyle =
    "#ffffff";

  context.strokeStyle =
    "#000000";

  context.lineWidth = 8;

  context.strokeText(
    text,
    256,
    70
  );

  context.fillText(
    text,
    256,
    70
  );

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  const material =
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });

  const sprite =
    new THREE.Sprite(
      material
    );

  sprite.scale.set(
    4,
    1,
    1
  );

  return sprite;
}

/*
==================================================
UPDATE REMOTE
==================================================
*/

function updateRemotePlayer(p) {
  const remote =
    remotePlayers.get(p.id);

  if (!remote) {
    createRemotePlayer(p);
    return;
  }

  remote.targetX = p.x;
  remote.targetY = p.y - 2;
  remote.targetZ = p.z;
  remote.targetRotation =
    p.rotationY || 0;
}

/*
==================================================
REMOVE REMOTE
==================================================
*/

function removeRemotePlayer(id) {
  const remote =
    remotePlayers.get(id);

  if (!remote) return;

  scene.remove(
    remote.object
  );

  remotePlayers.delete(id);
}

/*
==================================================
REMOTE INTERPOLATION
==================================================
*/

function updateRemotePlayers() {
  for (
    const remote of
    remotePlayers.values()
  ) {
    remote.object.position.x +=
      (
        remote.targetX -
        remote.object.position.x
      ) * 0.25;

    remote.object.position.y +=
      (
        remote.targetY -
        remote.object.position.y
      ) * 0.25;

    remote.object.position.z +=
      (
        remote.targetZ -
        remote.object.position.z
      ) * 0.25;

    let rotationDifference =
      remote.targetRotation -
      remote.object.rotation.y;

    rotationDifference =
      Math.atan2(
        Math.sin(rotationDifference),
        Math.cos(rotationDifference)
      );

    remote.object.rotation.y +=
      rotationDifference * 0.25;
  }
}

/*
==================================================
HUD
==================================================
*/

function createHUD() {
  const oldHUD =
    document.getElementById(
      "nova-hud"
    );

  if (oldHUD) {
    oldHUD.remove();
  }

  const hud =
    document.createElement(
      "div"
    );

  hud.id =
    "nova-hud";

  hud.style.position = "fixed";
  hud.style.inset = "0";
  hud.style.pointerEvents = "none";
  hud.style.fontFamily =
    "Arial, sans-serif";
  hud.style.color = "#fff";
  hud.style.zIndex = "100";

  hud.innerHTML = `

    <div
      id="crosshair"
      style="
        position:absolute;
        left:50%;
        top:50%;
        transform:translate(-50%,-50%);
        font-size:26px;
        font-weight:bold;
        text-shadow:0 0 4px #000;
      "
    >+</div>

    <div
      id="player-count"
      style="
        position:absolute;
        top:18px;
        left:20px;
        background:rgba(0,0,0,.45);
        padding:8px 12px;
        border-radius:6px;
        font-weight:bold;
      "
    >PLAYERS 0</div>

    <div
      id="mouse-status"
      style="
        position:absolute;
        top:18px;
        right:20px;
        background:rgba(0,0,0,.45);
        padding:8px 12px;
        border-radius:6px;
        font-weight:bold;
      "
    >CLICK TO PLAY</div>

    <!-- HEALTH -->

    <div
      style="
        position:absolute;
        left:20px;
        bottom:22px;
        width:250px;
      "
    >

      <div
        style="
          font-size:13px;
          font-weight:bold;
          margin-bottom:5px;
          text-shadow:0 1px 3px #000;
        "
      >
        HEALTH
      </div>

      <div
        style="
          width:100%;
          height:20px;
          background:rgba(0,0,0,.7);
          border:2px solid rgba(255,255,255,.7);
          border-radius:5px;
          overflow:hidden;
        "
      >

        <div
          id="health-fill"
          style="
            width:100%;
            height:100%;
            background:#22c55e;
            transition:width .15s ease;
          "
        ></div>

      </div>

      <div
        id="health-text"
        style="
          margin-top:4px;
          font-size:13px;
          font-weight:bold;
          text-shadow:0 1px 3px #000;
        "
      >
        100 / 100
      </div>

    </div>

    <!-- WEAPON -->

    <div
      style="
        position:absolute;
        right:20px;
        bottom:20px;
        text-align:right;
        background:rgba(0,0,0,.45);
        padding:10px 14px;
        border-radius:7px;
      "
    >

      <div
        id="weapon-name"
        style="
          font-size:18px;
          font-weight:bold;
        "
      >
        Nova Blaster
      </div>

      <div
        style="
          margin-top:4px;
          font-size:12px;
          opacity:.85;
        "
      >
        1 / 2 / 3 — SWITCH
      </div>

    </div>

    <!-- CHAT -->

    <div
      id="chat-box"
      style="
        position:absolute;
        left:20px;
        bottom:120px;
        width:380px;
        pointer-events:auto;
      "
    >

      <div
        id="chat-messages"
        style="
          max-height:180px;
          overflow-y:auto;
          padding:8px;
          background:rgba(0,0,0,.45);
          border-radius:6px;
          margin-bottom:6px;
        "
      ></div>

      <input
        id="chat-input"
        maxlength="200"
        autocomplete="off"
        placeholder="Press T to chat..."
        style="
          display:none;
          box-sizing:border-box;
          width:100%;
          padding:10px;
          border:2px solid #777;
          border-radius:5px;
          outline:none;
          background:rgba(15,18,25,.95);
          color:white;
          font-size:14px;
        "
      />

    </div>

    <!-- HELP -->

    <div
      style="
        position:absolute;
        right:20px;
        top:65px;
        background:rgba(0,0,0,.4);
        padding:9px 12px;
        border-radius:6px;
        font-size:12px;
        line-height:1.6;
        text-align:right;
      "
    >
      W A S D — MOVE<br>
      R — SPRINT<br>
      SHIFT — SLIDE<br>
      C — SNEAK<br>
      SPACE — JUMP<br>
      T — CHAT<br>
      1 / 2 / 3 — WEAPONS<br>
      ESC — RELEASE MOUSE
    </div>
  `;

  document.body.appendChild(hud);

  setupChatInput();

  updateHealthHUD();
}

/*
==================================================
HEALTH
==================================================
*/

function updateHealthHUD() {
  const fill =
    document.getElementById(
      "health-fill"
    );

  const text =
    document.getElementById(
      "health-text"
    );

  if (!fill || !text) return;

  const percent =
    Math.max(
      0,
      Math.min(
        100,
        player.health
      )
    );

  fill.style.width =
    `${percent}%`;

  /*
    Keep it green at 100%.
    It changes only if health is
    later changed by game mechanics.
  */

  if (percent > 50) {
    fill.style.background =
      "#22c55e";
  } else if (percent > 25) {
    fill.style.background =
      "#eab308";
  } else {
    fill.style.background =
      "#ef4444";
  }

  text.textContent =
    `${Math.round(player.health)} / ${player.maxHealth}`;
}

/*
==================================================
CHAT MESSAGE
==================================================
*/

function addChatMessage(
  username,
  message
) {
  const container =
    document.getElementById(
      "chat-messages"
    );

  if (!container) return;

  const line =
    document.createElement(
      "div"
    );

  line.style.marginBottom =
    "4px";

  line.style.wordBreak =
    "break-word";

  line.innerHTML =
    `<strong>${escapeHTML(
      username
    )}</strong>: ${escapeHTML(
      message
    )}`;

  container.appendChild(
    line
  );

  while (
    container.children.length >
    12
  ) {
    container.removeChild(
      container.firstChild
    );
  }

  container.scrollTop =
    container.scrollHeight;
}

/*
==================================================
HTML ESCAPE
==================================================
*/

function escapeHTML(text) {
  return String(text)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

/*
==================================================
ERROR
==================================================
*/

function showError(message) {
  const error =
    document.createElement(
      "div"
    );

  error.style.position =
    "fixed";

  error.style.left = "50%";
  error.style.top = "50%";

  error.style.transform =
    "translate(-50%, -50%)";

  error.style.background =
    "#151923";

  error.style.color =
    "white";

  error.style.padding =
    "20px";

  error.style.borderRadius =
    "8px";

  error.style.zIndex =
    "9999";

  error.textContent =
    message;

  document.body.appendChild(
    error
  );
}

/*
==================================================
RESIZE
==================================================
*/

function resize() {
  if (!camera || !renderer) {
    return;
  }

  camera.aspect =
    window.innerWidth /
    window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
}

/*
==================================================
GAME LOOP
==================================================
*/

function animate() {
  requestAnimationFrame(
    animate
  );

  const delta =
    Math.min(
      clock.getDelta(),
      0.05
    );

  updateMovement(delta);

  updateRemotePlayers();

  renderer.render(
    scene,
    camera
  );
}

/*
==================================================
START
==================================================
*/

loadThree();
