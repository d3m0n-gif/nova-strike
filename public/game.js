// NovaStrike 3D Client
// Optimized multiplayer arena client

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

/* =========================
   LOAD THREE.JS
========================= */

async function loadThree() {
  try {
    THREE = await import(THREE_URL);
    startGame();
  } catch (error) {
    console.error("Failed to load Three.js:", error);

    document.body.innerHTML = `
      <div style="
        color:white;
        background:#101522;
        height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        font-family:Arial;
        text-align:center;
      ">
        <div>
          <h1>NovaStrike</h1>
          <p>Could not load the game engine.</p>
          <p>Check your internet connection and refresh.</p>
        </div>
      </div>
    `;
  }
}

/* =========================
   START GAME
========================= */

function startGame() {
  if (gameStarted) return;

  gameStarted = true;

  scene = new THREE.Scene();

  scene.background = new THREE.Color(0x101522);

  scene.fog = new THREE.Fog(
    0x101522,
    80,
    500
  );

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  camera.position.set(
    player.x,
    player.y,
    player.z
  );

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 1.5)
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;

  renderer.domElement.style.position = "fixed";
  renderer.domElement.style.left = "0";
  renderer.domElement.style.top = "0";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.zIndex = "0";

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

/* =========================
   WORLD
========================= */

function createWorld() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(
      500,
      24,
      16
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
      1.8
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

  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;

  sun.shadow.camera.left = -250;
  sun.shadow.camera.right = 250;
  sun.shadow.camera.top = 250;
  sun.shadow.camera.bottom = -250;

  scene.add(sun);

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

  const grid =
    new THREE.GridHelper(
      400,
      80,
      0x566070,
      0x343c4b
    );

  grid.position.y = 0.01;

  scene.add(grid);

  createBuilding(
    -70,
    10,
    -65,
    55,
    20,
    35
  );

  createBuilding(
    75,
    12,
    -60,
    45,
    24,
    45
  );

  createBuilding(
    -75,
    8,
    70,
    45,
    16,
    45
  );

  createBuilding(
    70,
    7,
    70,
    55,
    14,
    35
  );

  createBuilding(
    0,
    18,
    0,
    30,
    36,
    30
  );

  createPlatform(
    -35,
    6,
    -10,
    35,
    2,
    18
  );

  createPlatform(
    40,
    5,
    20,
    35,
    2,
    18
  );

  createPlatform(
    -10,
    8,
    -70,
    40,
    2,
    18
  );

  createPlatform(
    10,
    6,
    75,
    35,
    2,
    18
  );

  for (let i = 0; i < 45; i++) {
    const x =
      Math.random() * 340 - 170;

    const z =
      Math.random() * 340 - 170;

    if (
      Math.abs(x) < 25 &&
      Math.abs(z) < 25
    ) {
      continue;
    }

    createCover(x, z);
  }

  createWall(0, 3, -195, 400, 6, 5);
  createWall(0, 3, 195, 400, 6, 5);
  createWall(-195, 3, 0, 5, 6, 400);
  createWall(195, 3, 0, 5, 6, 400);
}

/* =========================
   WALL
========================= */

function createWall(
  x,
  y,
  z,
  width,
  height,
  depth
) {
  const wall =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        height,
        depth
      ),
      new THREE.MeshStandardMaterial({
        color: 0x202633
      })
    );

  wall.position.set(x, y, z);

  wall.castShadow = true;
  wall.receiveShadow = true;

  scene.add(wall);
}

/* =========================
   BUILDING
========================= */

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

/* =========================
   PLATFORM
========================= */

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

/* =========================
   COVER
========================= */

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

/* =========================
   INPUT
========================= */

function setupInput() {
  window.addEventListener(
    "keydown",
    event => {
      keys[event.code] = true;

      if (
        event.code === "Space"
      ) {
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

  window.addEventListener(
    "mousemove",
    event => {
      if (
        document.pointerLockElement !==
        renderer.domElement
      ) {
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
      if (
        document.pointerLockElement !==
        renderer.domElement
      ) {
        renderer.domElement.requestPointerLock();
      }
    }
  );
}

/* =========================
   MOVEMENT
========================= */

function updateMovement(delta) {
  let moveX = 0;
  let moveZ = 0;

  if (keys[controls.forward])
    moveZ -= 1;

  if (keys[controls.backward])
    moveZ += 1;

  if (keys[controls.left])
    moveX -= 1;

  if (keys[controls.right])
    moveX += 1;

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

  let speed = player.speed;

  if (sprinting)
    speed = player.sprintSpeed;

  if (player.sneaking)
    speed = player.sneakSpeed;

  if (player.sliding)
    speed = player.sprintSpeed * 1.35;

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

    player.x +=
      worldX * speed * delta;

    player.z +=
      worldZ * speed * delta;
  }

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

/* =========================
   JUMP
========================= */

function jump() {
  if (!player.grounded)
    return;

  player.velocityY = 9;
  player.grounded = false;
}

/* =========================
   MULTIPLAYER
========================= */

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
      addChatMessage(
        data.username,
        data.message
      );
    }
  );
}

/* =========================
   REMOTE PLAYER
========================= */

function createRemotePlayer(p) {
  if (
    remotePlayers.has(p.id)
  ) {
    return;
  }

  const group =
    new THREE.Group();

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

/* =========================
   NAME LABEL
========================= */

function createNameLabel(text) {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = 512;
  canvas.height = 128;

  const context =
    canvas.getContext("2d");

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

/* =========================
   UPDATE REMOTE PLAYER
========================= */

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

/* =========================
   REMOVE REMOTE PLAYER
========================= */

function removeRemotePlayer(id) {
  const remote =
    remotePlayers.get(id);

  if (!remote)
    return;

  scene.remove(
    remote.object
  );

  remotePlayers.delete(id);
}

/* =========================
   INTERPOLATION
========================= */

function updateRemotePlayers() {
  for (
    const remote of
    remotePlayers.values()
  ) {
    const object =
      remote.object;

    object.position.x +=
      (
        remote.targetX -
        object.position.x
      ) * 0.25;

    object.position.y +=
      (
        remote.targetY -
        object.position.y
      ) * 0.25;

    object.position.z +=
      (
        remote.targetZ -
        object.position.z
      ) * 0.25;

    let rotationDifference =
      remote.targetRotation -
      object.rotation.y;

    rotationDifference =
      Math.atan2(
        Math.sin(rotationDifference),
        Math.cos(rotationDifference)
      );

    object.rotation.y +=
      rotationDifference * 0.25;
  }
}

/* =========================
   HUD
========================= */

function createHUD() {
  if (
    document.getElementById(
      "nova-hud"
    )
  ) {
    return;
  }

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
        placeholder="Press Enter to chat..."
      />
    </div>

    <div id="controls-help">
      W A S D — MOVE<br>
      R — SPRINT<br>
      SHIFT — SLIDE<br>
      C — SNEAK<br>
      SPACE — JUMP<br>
      ESC — SETTINGS
    </div>
  `;

  document.body.appendChild(
    hud
  );

  const chatInput =
    document.getElementById(
      "chat-input"
    );

  chatInput.addEventListener(
    "keydown",
    event => {
      if (
        event.key !== "Enter"
      ) {
        return;
      }

      const message =
        chatInput.value.trim();

      if (!message)
        return;

      socket.emit(
        "chat:send",
        message
      );

      chatInput.value = "";
    }
  );
}

/* =========================
   CHAT
========================= */

function addChatMessage(
  username,
  message
) {
  const container =
    document.getElementById(
      "chat-messages"
    );

  if (!container)
    return;

  const line =
    document.createElement(
      "div"
    );

  line.className =
    "chat-line";

  const name =
    document.createElement(
      "strong"
    );

  name.textContent =
    `${username}: `;

  const text =
    document.createTextNode(
      message
    );

  line.appendChild(name);
  line.appendChild(text);

  container.appendChild(line);

  while (
    container.children.length >
    8
  ) {
    container.removeChild(
      container.firstChild
    );
  }

  container.scrollTop =
    container.scrollHeight;
}

/* =========================
   RESIZE
========================= */

function resize() {
  if (!camera || !renderer)
    return;

  camera.aspect =
    window.innerWidth /
    window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
}

/* =========================
   GAME LOOP
========================= */

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

/* =========================
   START
========================= */

loadThree();
