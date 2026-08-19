const socket = io();

const DEFAULT_CONTROLS = {
  forward: "KeyW",
  backward: "KeyS",
  left: "KeyA",
  right: "KeyD",
  sprint: "KeyR",
  slide: "ShiftLeft",
  sneak: "KeyC",
  ability: "KeyQ",
  slot1: "Digit1",
  slot2: "Digit2",
  slot3: "Digit3"
};

let controls = { ...DEFAULT_CONTROLS };
let currentPlayer = null;

let scene;
let camera;
let renderer;
let clock;

let localPlayer;
const remotePlayers = new Map();

const keys = new Set();

let cameraYaw = 0;
let cameraPitch = 0;

let mouseLocked = false;

let velocityY = 0;

const movement = {
  speed: 5,
  sprintSpeed: 8,
  slideSpeed: 10
};

/* =========================
   ELEMENTS
========================= */

const authScreen = document.getElementById("authScreen");
const gameScreen = document.getElementById("gameScreen");

const loginPanel = document.getElementById("loginPanel");
const registerPanel = document.getElementById("registerPanel");

const authMessage = document.getElementById("authMessage");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");

const registerUsername =
  document.getElementById("registerUsername");

const registerEmail =
  document.getElementById("registerEmail");

const registerPassword =
  document.getElementById("registerPassword");

const loginButton =
  document.getElementById("loginButton");

const registerButton =
  document.getElementById("registerButton");

const playerName =
  document.getElementById("playerName");

const playerCount =
  document.getElementById("playerCount");

const chatForm =
  document.getElementById("chatForm");

const chatInput =
  document.getElementById("chatInput");

const chatMessages =
  document.getElementById("chatMessages");

const settingsOverlay =
  document.getElementById("settingsOverlay");

const settingsButton =
  document.getElementById("settingsButton");

const closeSettings =
  document.getElementById("closeSettings");

const resetControls =
  document.getElementById("resetControls");

const saveControls =
  document.getElementById("saveControls");

/* =========================
   AUTH UI
========================= */

document
  .getElementById("showRegister")
  .addEventListener("click", () => {

    loginPanel.classList.add("hidden");
    registerPanel.classList.remove("hidden");

    authMessage.textContent = "";
  });

document
  .getElementById("showLogin")
  .addEventListener("click", () => {

    registerPanel.classList.add("hidden");
    loginPanel.classList.remove("hidden");

    authMessage.textContent = "";
  });

/* =========================
   REGISTER
========================= */

registerButton.addEventListener("click", async () => {

  const username = registerUsername.value.trim();
  const email = registerEmail.value.trim();
  const password = registerPassword.value;

  authMessage.textContent = "";

  if (!username || !email || !password) {

    authMessage.textContent =
      "Fill in every field.";

    return;
  }

  registerButton.disabled = true;
  registerButton.textContent = "CREATING...";

  try {

    const response = await fetch("/api/register", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        username,
        email,
        password
      })

    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Registration failed."
      );
    }

    enterGame(data.player);

  } catch (error) {

    authMessage.textContent =
      error.message;

  } finally {

    registerButton.disabled = false;
    registerButton.textContent =
      "CREATE ACCOUNT";
  }
});

/* =========================
   LOGIN
========================= */

loginButton.addEventListener("click", async () => {

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  authMessage.textContent = "";

  if (!email || !password) {

    authMessage.textContent =
      "Enter your email and password.";

    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "LOGGING IN...";

  try {

    const response = await fetch("/api/login", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        email,
        password
      })

    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Login failed."
      );
    }

    enterGame(data.player);

  } catch (error) {

    authMessage.textContent =
      error.message;

  } finally {

    loginButton.disabled = false;
    loginButton.textContent = "LOGIN";
  }
});

/* =========================
   AUTO LOGIN
========================= */

async function checkSession() {

  try {

    const response =
      await fetch("/api/me");

    if (!response.ok) {
      return;
    }

    const data =
      await response.json();

    if (data.player) {
      enterGame(data.player);
    }

  } catch {
    // No active session.
  }
}

checkSession();

/* =========================
   ENTER GAME
========================= */

function enterGame(player) {

  currentPlayer = player;

  controls = {
    ...DEFAULT_CONTROLS,
    ...(player.controls || {})
  };

  playerName.textContent =
    player.username;

  authScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  initializeGame();

  socket.emit("player:join", {
    username: player.username
  });
}

/* =========================
   THREE.JS GAME
========================= */

function initializeGame() {

  if (renderer) {
    return;
  }

  scene = new THREE.Scene();

  scene.background =
    new THREE.Color(0x101725);

  scene.fog =
    new THREE.Fog(0x101725, 30, 150);

  camera =
    new THREE.PerspectiveCamera(
      75,
      window.innerWidth /
        window.innerHeight,
      0.1,
      500
    );

  renderer =
    new THREE.WebGLRenderer({
      canvas:
        document.getElementById("gameCanvas"),
      antialias: true
    });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  clock = new THREE.Clock();

  createWorld();
  createLocalPlayer();

  window.addEventListener(
    "resize",
    resizeGame
  );

  requestAnimationFrame(gameLoop);
}

/* =========================
   WORLD
========================= */

function createWorld() {

  const ambient =
    new THREE.AmbientLight(
      0xffffff,
      1.2
    );

  scene.add(ambient);

  const sun =
    new THREE.DirectionalLight(
      0xffffff,
      1.5
    );

  sun.position.set(
    30,
    50,
    20
  );

  scene.add(sun);

  /* Ground */

  const groundGeometry =
    new THREE.PlaneGeometry(
      250,
      250
    );

  const groundMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x202b3d
    });

  const ground =
    new THREE.Mesh(
      groundGeometry,
      groundMaterial
    );

  ground.rotation.x =
    -Math.PI / 2;

  scene.add(ground);

  /* Map platforms */

  createBlock(
    0,
    3,
    -20,
    20,
    6,
    8
  );

  createBlock(
    -25,
    2,
    5,
    10,
    4,
    20
  );

  createBlock(
    25,
    2,
    5,
    10,
    4,
    20
  );

  createBlock(
    0,
    1.5,
    25,
    30,
    3,
    8
  );

  createBlock(
    -40,
    4,
    -25,
    12,
    8,
    12
  );

  createBlock(
    40,
    4,
    -25,
    12,
    8,
    12
  );
}

function createBlock(
  x,
  y,
  z,
  width,
  height,
  depth
) {

  const geometry =
    new THREE.BoxGeometry(
      width,
      height,
      depth
    );

  const material =
    new THREE.MeshStandardMaterial({
      color: 0x34445e
    });

  const block =
    new THREE.Mesh(
      geometry,
      material
    );

  block.position.set(
    x,
    y,
    z
  );

  scene.add(block);
}

/* =========================
   PLAYER
========================= */

function createLocalPlayer() {

  localPlayer =
    createPlayerMesh(
      currentPlayer.username
    );

  localPlayer.position.set(
    0,
    1,
    10
  );

  scene.add(localPlayer);

  camera.position.set(
    0,
    2.2,
    0
  );

  localPlayer.add(camera);
}

/* =========================
   PLAYER MODEL
========================= */

function createPlayerMesh(username) {

  const group =
    new THREE.Group();

  /* Body */

  const bodyGeometry =
    new THREE.BoxGeometry(
      0.8,
      1.1,
      0.45
    );

  const bodyMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x5f7db8
    });

  const body =
    new THREE.Mesh(
      bodyGeometry,
      bodyMaterial
    );

  body.position.y = 0.7;

  group.add(body);

  /* Head */

  const headGeometry =
    new THREE.BoxGeometry(
      0.6,
      0.6,
      0.6
    );

  const headMaterial =
    new THREE.MeshStandardMaterial({
      color: 0xd2a27c
    });

  const head =
    new THREE.Mesh(
      headGeometry,
      headMaterial
    );

  head.position.y = 1.55;

  group.add(head);

  /* Name */

  const label =
    createNameLabel(username);

  label.position.y = 2.15;

  group.add(label);

  return group;
}

/* =========================
   NAME LABEL
========================= */

function createNameLabel(username) {

  const canvas =
    document.createElement("canvas");

  canvas.width = 512;
  canvas.height = 128;

  const ctx =
    canvas.getContext("2d");

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.fillStyle =
    "white";

  ctx.font =
    "bold 42px Arial";

  ctx.textAlign =
    "center";

  ctx.fillText(
    username,
    256,
    75
  );

  const texture =
    new THREE.CanvasTexture(canvas);

  const material =
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });

  const sprite =
    new THREE.Sprite(material);

  sprite.scale.set(
    4,
    1,
    1
  );

  return sprite;
}

/* =========================
   KEYBOARD
========================= */

window.addEventListener(
  "keydown",
  event => {

    if (
      settingsOverlay &&
      !settingsOverlay.classList.contains(
        "hidden"
      )
    ) {

      return;
    }

    keys.add(event.code);

    if (
      event.code === "Escape"
    ) {

      toggleSettings();

      return;
    }

    if (
      event.code === "Enter"
    ) {

      if (
        document.activeElement ===
        chatInput
      ) {
        return;
      }

      chatInput.focus();
    }
  }
);

window.addEventListener(
  "keyup",
  event => {

    keys.delete(event.code);
  }
);

/* =========================
   MOUSE LOOK
========================= */

document
  .getElementById("gameCanvas")
  .addEventListener(
    "click",
    () => {

      if (
        settingsOverlay.classList.contains(
          "hidden"
        )
      ) {

        document.body.requestPointerLock();
      }
    }
  );

document.addEventListener(
  "pointerlockchange",
  () => {

    mouseLocked =
      document.pointerLockElement ===
      document.body;
  }
);

document.addEventListener(
  "mousemove",
  event => {

    if (!mouseLocked) {
      return;
    }

    cameraYaw -=
      event.movementX * 0.002;

    cameraPitch -=
      event.movementY * 0.002;

    cameraPitch =
      Math.max(
        -1.3,
        Math.min(
          1.3,
          cameraPitch
        )
      );
  }
);

/* =========================
   MOVEMENT
========================= */

function updateMovement(delta) {

  if (!localPlayer) {
    return;
  }

  let forward = 0;
  let right = 0;

  if (keys.has(controls.forward)) {
    forward += 1;
  }

  if (keys.has(controls.backward)) {
    forward -= 1;
  }

  if (keys.has(controls.right)) {
    right += 1;
  }

  if (keys.has(controls.left)) {
    right -= 1;
  }

  const moving =
    forward !== 0 ||
    right !== 0;

  let speed =
    movement.speed;

  const sprinting =
    keys.has(controls.sprint) &&
    moving;

  const sneaking =
    keys.has(controls.sneak);

  const sliding =
    keys.has(controls.slide) &&
    moving;

  if (sprinting) {
    speed =
      movement.sprintSpeed;
  }

  if (sliding) {
    speed =
      movement.slideSpeed;
  }

  if (sneaking) {
    speed *= 0.55;
  }

  const length =
    Math.sqrt(
      forward * forward +
      right * right
    );

  if (length > 0) {

    forward /= length;
    right /= length;
  }

  const direction =
    new THREE.Vector3(
      right,
      0,
      -forward
    );

  direction.applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    cameraYaw
  );

  localPlayer.position.x +=
    direction.x *
    speed *
    delta;

  localPlayer.position.z +=
    direction.z *
    speed *
    delta;

  /* Simple gravity */

  velocityY -=
    20 * delta;

  localPlayer.position.y +=
    velocityY * delta;

  if (
    localPlayer.position.y < 1
  ) {

    localPlayer.position.y = 1;
    velocityY = 0;
  }

  localPlayer.rotation.y =
    cameraYaw;

  camera.rotation.x =
    cameraPitch;

  sendPlayerUpdate(
    sprinting,
    sliding,
    sneaking
  );
}

/* =========================
   SEND POSITION
========================= */

let lastNetworkUpdate = 0;

function sendPlayerUpdate(
  sprinting,
  sliding,
  sneaking
) {

  const now =
    performance.now();

  if (
    now - lastNetworkUpdate <
    50
  ) {
    return;
  }

  lastNetworkUpdate = now;

  let state = "normal";

  if (sliding) {
    state = "sliding";
  } else if (sprinting) {
    state = "sprinting";
  } else if (sneaking) {
    state = "sneaking";
  }

  socket.emit(
    "player:update",
    {
      x: localPlayer.position.x,
      y: localPlayer.position.y,
      z: localPlayer.position.z,
      rotationY: cameraYaw,
      state
    }
  );
}

/* =========================
   REMOTE PLAYERS
========================= */

socket.on(
  "players:list",
  data => {

    for (
      const player of data.players
    ) {

      if (
        player.id === socket.id
      ) {
        continue;
      }

      addRemotePlayer(player);
    }

    updatePlayerCount();
  }
);

socket.on(
  "player:joined",
  player => {

    if (
      player.id === socket.id
    ) {
      return;
    }

    addRemotePlayer(player);

    updatePlayerCount();
  }
);

socket.on(
  "player:update",
  player => {

    const mesh =
      remotePlayers.get(
        player.id
      );

    if (!mesh) {
      return;
    }

    mesh.position.x =
      player.x;

    mesh.position.y =
      player.y;

    mesh.position.z =
      player.z;

    mesh.rotation.y =
      player.rotationY;
  }
);

socket.on(
  "player:left",
  id => {

    const mesh =
      remotePlayers.get(id);

    if (!mesh) {
      return;
    }

    scene.remove(mesh);

    remotePlayers.delete(id);

    updatePlayerCount();
  }
);

function addRemotePlayer(player) {

  if (
    remotePlayers.has(player.id)
  ) {
    return;
  }

  const mesh =
    createPlayerMesh(
      player.username
    );

  mesh.position.set(
    player.x || 0,
    player.y || 1,
    player.z || 0
  );

  mesh.rotation.y =
    player.rotationY || 0;

  scene.add(mesh);

  remotePlayers.set(
    player.id,
    mesh
  );

  updatePlayerCount();
}

function updatePlayerCount() {

  playerCount.textContent =
    remotePlayers.size + 1;
}

/* =========================
   CHAT
========================= */

chatForm.addEventListener(
  "submit",
  event => {

    event.preventDefault();

    const message =
      chatInput.value.trim();

    if (!message) {
      return;
    }

    socket.emit(
      "chat:send",
      message
    );

    chatInput.value = "";
  }
);

socket.on(
  "chat:message",
  data => {

    const message =
      document.createElement("div");

    message.className =
      "chatMessage";

    const username =
      document.createElement("span");

    username.className =
      "chatUsername";

    username.textContent =
      data.username + ": ";

    const text =
      document.createElement("span");

    text.textContent =
      data.message;

    message.appendChild(username);
    message.appendChild(text);

    chatMessages.appendChild(
      message
    );

    chatMessages.scrollTop =
      chatMessages.scrollHeight;

    while (
      chatMessages.children.length >
      50
    ) {

      chatMessages.removeChild(
        chatMessages.firstChild
      );
    }
  }
);

/* =========================
   SETTINGS
========================= */

settingsButton.addEventListener(
  "click",
  toggleSettings
);

closeSettings.addEventListener(
  "click",
  () => {

    settingsOverlay.classList.add(
      "hidden"
    );

    document.body.requestPointerLock();
  }
);

function toggleSettings() {

  settingsOverlay.classList.toggle(
    "hidden"
  );

  if (
    settingsOverlay.classList.contains(
      "hidden"
    )
  ) {

    document.body.requestPointerLock();

  } else {

    if (
      document.pointerLockElement
    ) {
      document.exitPointerLock();
    }
  }
}

/* =========================
   CONTROL REBINDING
========================= */

let waitingForControl = null;

document
  .querySelectorAll(
    "[data-control]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        if (
          waitingForControl
        ) {

          return;
        }

        waitingForControl =
          button.dataset.control;

        button.textContent =
          "PRESS KEY...";

        const handler =
          event => {

            event.preventDefault();

            controls[
              waitingForControl
            ] = event.code;

            button.textContent =
              formatKey(event.code);

            waitingForControl =
              null;

            window.removeEventListener(
              "keydown",
              handler
            );
          };

        window.addEventListener(
          "keydown",
          handler
        );
      }
    );
  });

function formatKey(code) {

  const names = {
    KeyW: "W",
    KeyA: "A",
    KeyS: "S",
    KeyD: "D",
    KeyR: "R",
    KeyC: "C",
    KeyQ: "Q",
    ShiftLeft: "SHIFT",
    ShiftRight: "SHIFT",
    Digit1: "1",
    Digit2: "2",
    Digit3: "3"
  };

  return names[code] || code;
}

resetControls.addEventListener(
  "click",
  () => {

    controls = {
      ...DEFAULT_CONTROLS
    };

    refreshControlButtons();
  }
);

function refreshControlButtons() {

  document
    .querySelectorAll(
      "[data-control]"
    )
    .forEach(button => {

      const control =
        button.dataset.control;

      button.textContent =
        formatKey(
          controls[control]
        );
    });
}

saveControls.addEventListener(
  "click",
  async () => {

    try {

      const response =
        await fetch(
          "/api/controls",
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              controls
            })
          }
        );

      if (!response.ok) {
        throw new Error(
          "Could not save controls."
        );
      }

      saveControls.textContent =
        "SAVED!";

      setTimeout(() => {

        saveControls.textContent =
          "SAVE";

      }, 1200);

    } catch (error) {

      alert(error.message);
    }
  }
);

refreshControlButtons();

/* =========================
   RENDER LOOP
========================= */

function gameLoop() {

  requestAnimationFrame(
    gameLoop
  );

  const delta =
    Math.min(
      clock.getDelta(),
      0.05
    );

  updateMovement(delta);

  renderer.render(
    scene,
    camera
  );
}

/* =========================
   RESIZE
========================= */

function resizeGame() {

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
