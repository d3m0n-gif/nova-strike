// NovaStrike 3D Client
// Multiplayer arena client
// Controls:
// W = forward
// S = backward
// A = left
// D = right
// R = sprint
// Shift = slide
// C = sneak
// Space = jump
// T = chat
// Esc = close chat / pointer lock

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

const player = {
  x: 0,
  y: 2,
  z: 20,

  velocityY: 0,

  speed: 7,
  sprintSpeed: 12,
  sneakSpeed: 3,

  yaw: 0,
  pitch: 0,

  grounded: true,
  sliding: false,
  sneaking: false
};

/* =========================================
   LOAD THREE.JS
========================================= */

window.loadThree = async function loadThree() {
  if (gameStarted) return;

  try {
    THREE = await import(THREE_URL);
    startGame();
  } catch (error) {
    console.error("Could not load Three.js:", error);
  }
};

/* =========================================
   START GAME
========================================= */

function startGame() {
  if (gameStarted) return;

  gameStarted = true;

  scene = new THREE.Scene();

  scene.background =
    new THREE.Color(0x101522);

  scene.fog =
    new THREE.Fog(
      0x101522,
      80,
      500
    );

  camera =
    new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1500
    );

  camera.position.set(
    player.x,
    player.y,
    player.z
  );

  renderer =
    new THREE.WebGLRenderer({
      antialias: true
    });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 1.5)
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.shadowMap.enabled = true;

  document.body.appendChild(
    renderer.domElement
  );

  clock = new THREE.Clock();

  createWorld();
  createHUD();
  setupInput();
  connectPlayer();

  window.addEventListener(
    "resize",
    resize
  );

  animate();
}

/* =========================================
   WORLD
========================================= */

function createWorld() {
  const sky =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        700,
        32,
        32
      ),
      new THREE.MeshBasicMaterial({
        color: 0x172033,
        side: THREE.BackSide
      })
    );

  scene.add(sky);

  const ambient =
    new THREE.HemisphereLight(
      0xbfd7ff,
      0x18202b,
      2
    );

  scene.add(ambient);

  const sun =
    new THREE.DirectionalLight(
      0xffffff,
      2
    );

  sun.position.set(
    100,
    150,
    80
  );

  sun.castShadow = true;

  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;

  scene.add(sun);

  /* Large ground */

  const ground =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        400,
        2,
        400
      ),
      new THREE.MeshStandardMaterial({
        color: 0x303846,
        roughness: 0.9
      })
    );

  ground.position.y = -1;

  ground.receiveShadow = true;

  scene.add(ground);

  /* Grid */

  const grid =
    new THREE.GridHelper(
      400,
      80,
      0x566070,
      0x343c4b
    );

  grid.position.y = 0.01;

  scene.add(grid);

  /* Buildings */

  createBuilding(
    -65,
    8,
    -55,
    55,
    16,
    35
  );

  createBuilding(
    65,
    10,
    -50,
    45,
    20,
    50
  );

  createBuilding(
    -70,
    7,
    60,
    45,
    14,
    40
  );

  createBuilding(
    65,
    6,
    65,
    50,
    12,
    35
  );

  /* Central tower */

  createBuilding(
    0,
    15,
    0,
    28,
    30,
    28
  );

  /* Platforms */

  createPlatform(
    -30,
    5,
    5,
    35,
    2,
    18
  );

  createPlatform(
    35,
    4,
    20,
    35,
    2,
    15
  );

  createPlatform(
    0,
    7,
    -70,
    40,
    2,
    18
  );

  /* Cover */

  for (let i = 0; i < 45; i++) {
    const x =
      Math.random() * 300 - 150;

    const z =
      Math.random() * 300 - 150;

    if (
      Math.abs(x) < 20 &&
      Math.abs(z) < 20
    ) {
      continue;
    }

    createCover(x, z);
  }
}

/* =========================================
   BUILDINGS
========================================= */

function createBuilding(
  x,
  y,
  z,
  width,
  height,
  depth
) {
  const building =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        height,
        depth
      ),
      new THREE.MeshStandardMaterial({
        color: 0x596273,
        roughness: 0.75
      })
    );

  building.position.set(
    x,
    y,
    z
  );

  building.castShadow = true;
  building.receiveShadow = true;

  scene.add(building);

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
}

/* =========================================
   PLATFORM
========================================= */

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
        color: 0x3d526b
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
}

/* =========================================
   COVER
========================================= */

function createCover(x, z) {
  const width =
    3 + Math.random() * 5;

  const height =
    2 + Math.random() * 4;

  const depth =
    3 + Math.random() * 5;

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
}

/* =========================================
   INPUT
========================================= */

function setupInput() {
  window.addEventListener(
    "keydown",
    event => {
      /*
       * T opens chat.
       */

      if (
        event.code === "KeyT" &&
        !chatOpen
      ) {
        openChat();
        event.preventDefault();
        return;
      }

      /*
       * If chat is open, don't let
       * game controls activate.
       */

      if (chatOpen) {
        return;
      }

      keys[event.code] = true;

      if (
        event.code === controls.jump
      ) {
        jump();
        event.preventDefault();
      }

      /*
       * Escape exits pointer lock.
       */

      if (
        event.code === "Escape"
      ) {
        if (
          document.pointerLockElement
        ) {
          document.exitPointerLock();
        }
      }
    }
  );

  window.addEventListener(
    "keyup",
    event => {
      keys[event.code] = false;
    }
  );

  window.addEventListener(
    "mousemove",
    event => {
      if (
        document.pointerLockElement !==
        renderer.domElement
      ) {
        return;
      }

      if (chatOpen) {
        return;
      }

      player.yaw -=
        event.movementX * 0.002;

      player.pitch -=
        event.movementY * 0.002;

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

  renderer.domElement.addEventListener(
    "click",
    () => {
      if (chatOpen) return;

      renderer.domElement.requestPointerLock();
    }
  );
}

/* =========================================
   CHAT OPEN
========================================= */

function openChat() {
  const input =
    document.getElementById(
      "chat-input"
    );

  if (!input) return;

  chatOpen = true;

  input.style.display = "block";

  input.value = "";

  input.focus();

  if (
    document.pointerLockElement
  ) {
    document.exitPointerLock();
  }
}

/* =========================================
   CHAT CLOSE
========================================= */

function closeChat() {
  const input =
    document.getElementById(
      "chat-input"
    );

  if (!input) return;

  chatOpen = false;

  input.value = "";

  input.style.display = "none";

  input.blur();
}

/* =========================================
   MOVEMENT
========================================= */

function updateMovement(delta) {
  /*
   * W/S = forward/backward
   * A/D = left/right
   */

  let forward = 0;
  let strafe = 0;

  if (keys[controls.forward]) {
    forward += 1;
  }

  if (keys[controls.backward]) {
    forward -= 1;
  }

  if (keys[controls.left]) {
    strafe -= 1;
  }

  if (keys[controls.right]) {
    strafe += 1;
  }

  const moving =
    forward !== 0 ||
    strafe !== 0;

  const sprinting =
    keys[controls.sprint] &&
    moving &&
    !keys[controls.sneak];

  player.sneaking =
    keys[controls.sneak] &&
    moving;

  /*
   * Slide
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
    speed =
      player.sprintSpeed;
  }

  if (player.sneaking) {
    speed =
      player.sneakSpeed;
  }

  if (player.sliding) {
    speed =
      player.sprintSpeed * 1.35;
  }

  if (moving) {
    const length =
      Math.sqrt(
        forward * forward +
        strafe * strafe
      );

    forward /= length;
    strafe /= length;

    /*
     * Camera forward vector.
     *
     * W moves exactly where
     * the player is looking.
     */

    const forwardX =
      -Math.sin(player.yaw);

    const forwardZ =
      -Math.cos(player.yaw);

    const rightX =
      Math.cos(player.yaw);

    const rightZ =
      -Math.sin(player.yaw);

    const worldX =
      forwardX * forward +
      rightX * strafe;

    const worldZ =
      forwardZ * forward +
      rightZ * strafe;

    player.x +=
      worldX * speed * delta;

    player.z +=
      worldZ * speed * delta;
  }

  /* Gravity */

  player.velocityY -=
    24 * delta;

  player.y +=
    player.velocityY * delta;

  if (player.y <= 2) {
    player.y = 2;
    player.velocityY = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  /*
   * Keep player inside
   * the large arena.
   */

  player.x =
    Math.max(
      -190,
      Math.min(
        190,
        player.x
      )
    );

  player.z =
    Math.max(
      -190,
      Math.min(
        190,
        player.z
      )
    );

  /*
   * Camera position.
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
   * Send player movement.
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

/* =========================================
   JUMP
========================================= */

function jump() {
  if (!player.grounded) {
    return;
  }

  player.velocityY = 9;
  player.grounded = false;
}

/* =========================================
   MULTIPLAYER
========================================= */

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
      if (
        !data ||
        !Array.isArray(data.players)
      ) {
        return;
      }

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
      if (!data) return;

      addChatMessage(
        data.username,
        data.message
      );
    }
  );
}

/* =========================================
   REMOTE PLAYER
========================================= */

function createRemotePlayer(p) {
  if (
    remotePlayers.has(p.id)
  ) {
    return;
  }

  const group =
    new THREE.Group();

  /*
   * Body
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
   * Head
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
   * Name
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

/* =========================================
   NAME LABEL
========================================= */

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

/* =========================================
   UPDATE REMOTE PLAYER
========================================= */

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

/* =========================================
   REMOVE REMOTE PLAYER
========================================= */

function removeRemotePlayer(id) {
  const remote =
    remotePlayers.get(id);

  if (!remote) {
    return;
  }

  scene.remove(
    remote.object
  );

  remotePlayers.delete(id);
}

/* =========================================
   REMOTE PLAYER SMOOTHING
========================================= */

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

    /*
     * Smooth rotation.
     */

    let difference =
      remote.targetRotation -
      remote.object.rotation.y;

    while (difference > Math.PI) {
      difference -= Math.PI * 2;
    }

    while (difference < -Math.PI) {
      difference += Math.PI * 2;
    }

    remote.object.rotation.y +=
      difference * 0.25;
  }
}

/* =========================================
   HUD
========================================= */

function createHUD() {
  const hud =
    document.createElement(
      "div"
    );

  hud.id =
    "nova-hud";

  hud.innerHTML = `
    <div id="crosshair">+</div>

    <div id="player-count">
      PLAYERS 0
    </div>

    <div id="chat-box">

      <div id="chat-messages"></div>

      <input
        id="chat-input"
        maxlength="200"
        autocomplete="off"
        placeholder="Press T to chat..."
        style="display:none;"
      >

    </div>

    <div id="controls-help">

      W A S D — MOVE<br>
      R — SPRINT<br>
      SHIFT — SLIDE<br>
      C — SNEAK<br>
      SPACE — JUMP<br>
      T — CHAT<br>
      ESC — RELEASE MOUSE

    </div>
  `;

  document.body.appendChild(hud);

  const chatInput =
    document.getElementById(
      "chat-input"
    );

  /*
   * Chat input behavior.
   */

  chatInput.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Enter"
      ) {
        const message =
          chatInput.value.trim();

        if (!message) {
          closeChat();
          return;
        }

        /*
         * No commands.
         */

        if (
          message.startsWith("/")
        ) {
          addChatMessage(
            "SYSTEM",
            "Commands are disabled."
          );

          chatInput.value = "";

          return;
        }

        socket.emit(
          "chat:send",
          message
        );

        chatInput.value = "";

        closeChat();

        /*
         * Give mouse control
         * back to the game.
         */

        setTimeout(() => {
          if (
            renderer &&
            renderer.domElement
          ) {
            renderer.domElement.requestPointerLock();
          }
        }, 50);

        return;
      }

      /*
       * Escape closes chat.
       */

      if (
        event.key === "Escape"
      ) {
        closeChat();
        return;
      }

      /*
       * Prevent game movement
       * while typing.
       */

      event.stopPropagation();
    }
  );
}

/* =========================================
   CHAT
========================================= */

function addChatMessage(
  username,
  message
) {
  const container =
    document.getElementById(
      "chat-messages"
    );

  if (!container) {
    return;
  }

  const line =
    document.createElement(
      "div"
    );

  line.className =
    "chat-line";

  /*
   * Never use raw HTML from
   * player messages.
   */

  const name =
    document.createElement(
      "strong"
    );

  name.textContent =
    `${username}:`;

  const text =
    document.createTextNode(
      ` ${message}`
    );

  line.appendChild(name);
  line.appendChild(text);

  container.appendChild(line);

  /*
   * Keep recent messages.
   */

  while (
    container.children.length > 12
  ) {
    container.removeChild(
      container.firstChild
    );
  }

  container.scrollTop =
    container.scrollHeight;
}

/* =========================================
   RESIZE
========================================= */

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

/* =========================================
   GAME LOOP
========================================= */

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
