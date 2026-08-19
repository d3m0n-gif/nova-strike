// ============================================================
// NOVA-STRIKE
// public/game.js
// ============================================================

const socket = typeof io !== "undefined" ? io() : null;

// ------------------------------------------------------------
// GAME SETTINGS
// ------------------------------------------------------------

const GAME = {
    playerSpeed: 7,
    sprintSpeed: 10,
    mouseSensitivity: 0.002,

    maxHealth: 100,

    gravity: 25,
    jumpPower: 9,

    respawnTime: 3000,

    weapons: {
        ak: {
            name: "AK-47",
            magazineSize: 25,
            reserveAmmo: 100,
            damage: 17,
            headshotDamage: 34,
            fireRate: 105,
            reloadTime: 1500,
            automatic: true
        },

        pistol: {
            name: "Handgun",
            magazineSize: 12,
            reserveAmmo: 60,
            damage: 20,
            headshotDamage: 40,
            fireRate: 250,
            reloadTime: 1100,
            automatic: false
        },

        knife: {
            name: "Knife",
            magazineSize: 0,
            reserveAmmo: 0,
            damage: 100,
            headshotDamage: 100,
            fireRate: 500,
            reloadTime: 0,
            automatic: false
        }
    }
};

// ------------------------------------------------------------
// THREE.JS SETUP
// ------------------------------------------------------------

let scene;
let camera;
let renderer;

let player;
let playerVelocity = new THREE.Vector3();

let yaw = 0;
let pitch = 0;

let keys = {};
let mouseDown = false;

let lastShot = 0;
let reloading = false;
let reloadTimer = null;

let currentWeapon = "ak";

let health = GAME.maxHealth;
let kills = 0;
let deaths = 0;
let streak = 0;

let ammo = {};
let reserveAmmo = {};

for (const weaponName in GAME.weapons) {
    const weapon = GAME.weapons[weaponName];

    ammo[weaponName] = weapon.magazineSize;
    reserveAmmo[weaponName] = weapon.reserveAmmo;
}

// ------------------------------------------------------------
// PLAYER / REMOTE PLAYERS
// ------------------------------------------------------------

const remotePlayers = {};

let playerId = null;

// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------

function init() {
    scene = new THREE.Scene();

    scene.background = new THREE.Color(0x111827);

    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    camera.position.set(0, 1.7, 5);

    // Renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    document.body.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
        0xffffff,
        1
    );

    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    // Ground
    createMap();

    // Player
    player = new THREE.Object3D();
    player.position.set(0, 1.7, 5);

    scene.add(player);

    player.add(camera);

    // UI
    createHUD();

    // Controls
    setupControls();

    // Resize
    window.addEventListener("resize", onResize);

    // Socket
    setupSocket();

    // Start
    animate();
}

// ------------------------------------------------------------
// MAP
// ------------------------------------------------------------

function createMap() {
    const groundGeometry = new THREE.BoxGeometry(
        100,
        1,
        100
    );

    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x252a34
    });

    const ground = new THREE.Mesh(
        groundGeometry,
        groundMaterial
    );

    ground.position.y = -0.5;

    scene.add(ground);

    // Walls
    createWall(0, 5, -25, 50, 10, 1);
    createWall(0, 5, 25, 50, 10, 1);

    createWall(-25, 5, 0, 1, 10, 50);
    createWall(25, 5, 0, 1, 10, 50);

    // Cover
    createWall(-8, 2, -5, 8, 4, 2);
    createWall(8, 2, -5, 8, 4, 2);

    createWall(-8, 2, 8, 8, 4, 2);
    createWall(8, 2, 8, 8, 4, 2);

    createWall(0, 2, 0, 3, 4, 10);
}

function createWall(
    x,
    y,
    z,
    width,
    height,
    depth
) {
    const geometry = new THREE.BoxGeometry(
        width,
        height,
        depth
    );

    const material = new THREE.MeshStandardMaterial({
        color: 0x3a404c
    });

    const wall = new THREE.Mesh(
        geometry,
        material
    );

    wall.position.set(x, y, z);

    scene.add(wall);
}

// ------------------------------------------------------------
// HUD
// ------------------------------------------------------------

function createHUD() {
    const hud = document.createElement("div");

    hud.id = "novaHud";

    hud.style.position = "fixed";
    hud.style.left = "0";
    hud.style.top = "0";
    hud.style.width = "100%";
    hud.style.height = "100%";
    hud.style.pointerEvents = "none";
    hud.style.fontFamily = "Arial, sans-serif";
    hud.style.color = "white";

    document.body.appendChild(hud);

    // Crosshair
    const crosshair = document.createElement("div");

    crosshair.id = "crosshair";

    crosshair.innerHTML = "+";

    crosshair.style.position = "absolute";
    crosshair.style.left = "50%";
    crosshair.style.top = "50%";
    crosshair.style.transform = "translate(-50%, -50%)";
    crosshair.style.fontSize = "28px";
    crosshair.style.fontWeight = "bold";

    hud.appendChild(crosshair);

    // Health
    const healthBox = document.createElement("div");

    healthBox.id = "healthBox";

    healthBox.style.position = "absolute";
    healthBox.style.bottom = "30px";
    healthBox.style.left = "30px";
    healthBox.style.fontSize = "22px";

    hud.appendChild(healthBox);

    // Weapon
    const weaponBox = document.createElement("div");

    weaponBox.id = "weaponBox";

    weaponBox.style.position = "absolute";
    weaponBox.style.bottom = "30px";
    weaponBox.style.right = "30px";
    weaponBox.style.fontSize = "24px";
    weaponBox.style.textAlign = "right";

    hud.appendChild(weaponBox);

    // Score
    const scoreBox = document.createElement("div");

    scoreBox.id = "scoreBox";

    scoreBox.style.position = "absolute";
    scoreBox.style.top = "20px";
    scoreBox.style.right = "20px";
    scoreBox.style.fontSize = "18px";
    scoreBox.style.textAlign = "right";

    hud.appendChild(scoreBox);

    // Reload text
    const reloadBox = document.createElement("div");

    reloadBox.id = "reloadBox";

    reloadBox.style.position = "absolute";
    reloadBox.style.left = "50%";
    reloadBox.style.bottom = "25%";
    reloadBox.style.transform = "translateX(-50%)";
    reloadBox.style.fontSize = "24px";
    reloadBox.style.fontWeight = "bold";

    hud.appendChild(reloadBox);

    updateHUD();
}

function updateHUD() {
    const weapon = GAME.weapons[currentWeapon];

    const healthElement =
        document.getElementById("healthBox");

    const weaponElement =
        document.getElementById("weaponBox");

    const scoreElement =
        document.getElementById("scoreBox");

    if (healthElement) {
        healthElement.innerHTML =
            `❤️ ${Math.max(0, health)} HP`;
    }

    if (weaponElement) {
        if (currentWeapon === "knife") {
            weaponElement.innerHTML =
                `🔪 ${weapon.name}`;
        } else {
            weaponElement.innerHTML =
                `${weapon.name}<br>` +
                `${ammo[currentWeapon]} / ${reserveAmmo[currentWeapon]}`;
        }
    }

    if (scoreElement) {
        scoreElement.innerHTML =
            `Kills: ${kills}<br>` +
            `Deaths: ${deaths}<br>` +
            `Streak: ${streak}`;
    }
}

// ------------------------------------------------------------
// CONTROLS
// ------------------------------------------------------------

function setupControls() {
    document.addEventListener("keydown", event => {
        keys[event.code] = true;

        if (event.code === "Digit1") {
            switchWeapon("ak");
        }

        if (event.code === "Digit2") {
            switchWeapon("pistol");
        }

        if (event.code === "Digit3") {
            switchWeapon("knife");
        }

        if (event.code === "KeyR") {
            reload();
        }

        if (
            event.code === "Space" &&
            player &&
            player.position.y <= 1.71
        ) {
            playerVelocity.y = GAME.jumpPower;
        }
    });

    document.addEventListener("keyup", event => {
        keys[event.code] = false;
    });

    document.addEventListener("mousedown", event => {
        if (event.button === 0) {
            mouseDown = true;

            if (document.pointerLockElement !== renderer.domElement) {
                renderer.domElement.requestPointerLock();
            }

            shoot();
        }
    });

    document.addEventListener("mouseup", event => {
        if (event.button === 0) {
            mouseDown = false;
        }
    });

    document.addEventListener("mousemove", event => {
        if (document.pointerLockElement !== renderer.domElement) {
            return;
        }

        yaw -=
            event.movementX *
            GAME.mouseSensitivity;

        pitch -=
            event.movementY *
            GAME.mouseSensitivity;

        const limit = Math.PI / 2 - 0.05;

        pitch = Math.max(
            -limit,
            Math.min(limit, pitch)
        );

        camera.rotation.x = pitch;

        player.rotation.y = yaw;
    });
}

// ------------------------------------------------------------
// MOVEMENT
// ------------------------------------------------------------

function updateMovement(delta) {
    if (!player) return;

    const direction = new THREE.Vector3();

    // IMPORTANT:
    // Movement is based on the player's rotation.
    // This fixes the "W moves backwards when looking around"
    // problem.

    if (keys["KeyW"]) {
        direction.z -= 1;
    }

    if (keys["KeyS"]) {
        direction.z += 1;
    }

    if (keys["KeyA"]) {
        direction.x -= 1;
    }

    if (keys["KeyD"]) {
        direction.x += 1;
    }

    if (direction.lengthSq() > 0) {
        direction.normalize();

        // Rotate movement according to where player is looking
        direction.applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            yaw
        );
    }

    let speed = GAME.playerSpeed;

    if (keys["ShiftLeft"] || keys["ShiftRight"]) {
        speed = GAME.sprintSpeed;
    }

    player.position.x +=
        direction.x *
        speed *
        delta;

    player.position.z +=
        direction.z *
        speed *
        delta;

    // Gravity
    playerVelocity.y -=
        GAME.gravity *
        delta;

    player.position.y +=
        playerVelocity.y *
        delta;

    // Ground collision
    if (player.position.y < 1.7) {
        player.position.y = 1.7;
        playerVelocity.y = 0;
    }

    // Keep player inside map
    player.position.x =
        Math.max(-24, Math.min(24, player.position.x));

    player.position.z =
        Math.max(-24, Math.min(24, player.position.z));
}

// ------------------------------------------------------------
// WEAPON SWITCHING
// ------------------------------------------------------------

function switchWeapon(weaponName) {
    if (!GAME.weapons[weaponName]) {
        return;
    }

    if (reloading) {
        return;
    }

    currentWeapon = weaponName;

    updateHUD();
}

// ------------------------------------------------------------
// SHOOTING
// ------------------------------------------------------------

function shoot() {
    if (reloading) {
        return;
    }

    const weapon = GAME.weapons[currentWeapon];

    const now = performance.now();

    if (
        now - lastShot <
        weapon.fireRate
    ) {
        return;
    }

    lastShot = now;

    // Knife
    if (currentWeapon === "knife") {
        knifeAttack();
        return;
    }

    // No ammo
    if (ammo[currentWeapon] <= 0) {
        reload();
        return;
    }

    ammo[currentWeapon]--;

    updateHUD();

    createMuzzleFlash();

    performRaycastShot();

    if (socket) {
        socket.emit("playerShoot", {
            weapon: currentWeapon,
            rotation: {
                x: pitch,
                y: yaw
            }
        });
    }
}

// ------------------------------------------------------------
// AUTOMATIC FIRE
// ------------------------------------------------------------

function automaticFire() {
    if (
        currentWeapon === "ak" &&
        mouseDown
    ) {
        shoot();
    }
}

// ------------------------------------------------------------
// RAYCAST SHOOTING
// ------------------------------------------------------------

function performRaycastShot() {
    const raycaster =
        new THREE.Raycaster();

    raycaster.setFromCamera(
        new THREE.Vector2(0, 0),
        camera
    );

    const targets = [];

    for (const id in remotePlayers) {
        const remote = remotePlayers[id];

        if (remote && remote.object) {
            targets.push(remote.object);
        }
    }

    if (targets.length === 0) {
        return;
    }

    const intersections =
        raycaster.intersectObjects(
            targets,
            true
        );

    if (intersections.length === 0) {
        return;
    }

    const hit =
        intersections[0].object;

    let targetPlayer = hit;

    while (
        targetPlayer &&
        !targetPlayer.userData.playerId
    ) {
        targetPlayer =
            targetPlayer.parent;
    }

    if (
        !targetPlayer ||
        !targetPlayer.userData.playerId
    ) {
        return;
    }

    const targetId =
        targetPlayer.userData.playerId;

    // Determine headshot
    const isHeadshot =
        hit.userData &&
        hit.userData.hitbox === "head";

    const weapon =
        GAME.weapons[currentWeapon];

    const damage = isHeadshot
        ? weapon.headshotDamage
        : weapon.damage;

    createHitMarker(isHeadshot);

    if (socket) {
        socket.emit("playerDamage", {
            targetId: targetId,
            damage: damage,
            headshot: isHeadshot,
            weapon: currentWeapon
        });
    }
}

// ------------------------------------------------------------
// KNIFE
// ------------------------------------------------------------

function knifeAttack() {
    const raycaster =
        new THREE.Raycaster();

    raycaster.setFromCamera(
        new THREE.Vector2(0, 0),
        camera
    );

    const targets = [];

    for (const id in remotePlayers) {
        const remote = remotePlayers[id];

        if (remote && remote.object) {
            targets.push(remote.object);
        }
    }

    const intersections =
        raycaster.intersectObjects(
            targets,
            true
        );

    if (
        intersections.length === 0
    ) {
        return;
    }

    const hit =
        intersections[0];

    if (hit.distance > 3) {
        return;
    }

    let target =
        hit.object;

    while (
        target &&
        !target.userData.playerId
    ) {
        target =
            target.parent;
    }

    if (!target) {
        return;
    }

    const targetId =
        target.userData.playerId;

    if (socket) {
        socket.emit("playerDamage", {
            targetId: targetId,
            damage: 100,
            headshot: false,
            weapon: "knife"
        });
    }

    createHitMarker(false);
}

// ------------------------------------------------------------
// RELOAD
// ------------------------------------------------------------

function reload() {
    if (currentWeapon === "knife") {
        return;
    }

    if (reloading) {
        return;
    }

    const weapon =
        GAME.weapons[currentWeapon];

    if (
        ammo[currentWeapon] >=
        weapon.magazineSize
    ) {
        return;
    }

    if (
        reserveAmmo[currentWeapon] <= 0
    ) {
        return;
    }

    reloading = true;

    const reloadElement =
        document.getElementById("reloadBox");

    if (reloadElement) {
        reloadElement.innerHTML =
            "RELOADING...";
    }

    reloadTimer = setTimeout(() => {
        const needed =
            weapon.magazineSize -
            ammo[currentWeapon];

        const amount =
            Math.min(
                needed,
                reserveAmmo[currentWeapon]
            );

        ammo[currentWeapon] += amount;
        reserveAmmo[currentWeapon] -= amount;

        reloading = false;

        if (reloadElement) {
            reloadElement.innerHTML = "";
        }

        updateHUD();
    }, weapon.reloadTime);
}

// ------------------------------------------------------------
// MUZZLE FLASH
// ------------------------------------------------------------

function createMuzzleFlash() {
    const flash =
        document.createElement("div");

    flash.style.position = "fixed";
    flash.style.left = "50%";
    flash.style.top = "50%";
    flash.style.width = "8px";
    flash.style.height = "8px";
    flash.style.borderRadius = "50%";
    flash.style.transform =
        "translate(-50%, -50%)";
    flash.style.background =
        "rgba(255,220,80,0.9)";
    flash.style.pointerEvents =
        "none";

    document.body.appendChild(flash);

    setTimeout(() => {
        flash.remove();
    }, 40);
}

// ------------------------------------------------------------
// HIT MARKER
// ------------------------------------------------------------

function createHitMarker(headshot) {
    const marker =
        document.createElement("div");

    marker.style.position = "fixed";
    marker.style.left = "50%";
    marker.style.top = "50%";
    marker.style.transform =
        "translate(-50%, -50%)";
    marker.style.fontSize = "24px";
    marker.style.fontWeight = "bold";
    marker.style.pointerEvents =
        "none";

    marker.innerHTML =
        headshot ? "✦" : "×";

    document.body.appendChild(marker);

    setTimeout(() => {
        marker.remove();
    }, 150);
}

// ------------------------------------------------------------
// DAMAGE
// ------------------------------------------------------------

function takeDamage(amount, attackerId) {
    if (health <= 0) {
        return;
    }

    health -= amount;

    health =
        Math.max(0, health);

    updateHUD();

    createDamageFlash();

    if (health <= 0) {
        die(attackerId);
    }
}

// ------------------------------------------------------------
// DAMAGE FLASH
// ------------------------------------------------------------

function createDamageFlash() {
    const flash =
        document.createElement("div");

    flash.style.position = "fixed";
    flash.style.left = "0";
    flash.style.top = "0";
    flash.style.width = "100%";
    flash.style.height = "100%";
    flash.style.background =
        "rgba(255,0,0,0.2)";
    flash.style.pointerEvents =
        "none";

    document.body.appendChild(flash);

    setTimeout(() => {
        flash.remove();
    }, 120);
}

// ------------------------------------------------------------
// DEATH
// ------------------------------------------------------------

function die(killerId) {
    if (health > 0) {
        return;
    }

    deaths++;

    streak = 0;

    updateHUD();

    if (socket) {
        socket.emit("playerDeath", {
            killerId: killerId
        });
    }

    const deathText =
        document.createElement("div");

    deathText.style.position =
        "fixed";

    deathText.style.left =
        "50%";

    deathText.style.top =
        "40%";

    deathText.style.transform =
        "translate(-50%, -50%)";

    deathText.style.fontSize =
        "50px";

    deathText.style.fontWeight =
        "bold";

    deathText.style.color =
        "white";

    deathText.style.textShadow =
        "0 0 15px black";

    deathText.innerHTML =
        "YOU DIED";

    document.body.appendChild(
        deathText
    );

    setTimeout(() => {
        deathText.remove();
        respawn();
    }, GAME.respawnTime);
}

// ------------------------------------------------------------
// RESPAWN
// ------------------------------------------------------------

function respawn() {
    health =
        GAME.maxHealth;

    player.position.set(
        0,
        1.7,
        5
    );

    playerVelocity.set(
        0,
        0,
        0
    );

    ammo.ak =
        GAME.weapons.ak.magazineSize;

    ammo.pistol =
        GAME.weapons.pistol.magazineSize;

    updateHUD();
}

// ------------------------------------------------------------
// KILL
// ------------------------------------------------------------

function registerKill() {
    kills++;

    streak++;

    updateHUD();

    if (streak >= 3) {
        showStreak(streak);
    }
}

function showStreak(number) {
    const element =
        document.createElement("div");

    element.style.position =
        "fixed";

    element.style.left =
        "50%";

    element.style.top =
        "25%";

    element.style.transform =
        "translateX(-50%)";

    element.style.fontSize =
        "32px";

    element.style.fontWeight =
        "bold";

    element.style.pointerEvents =
        "none";

    element.innerHTML =
        `🔥 ${number} KILL STREAK`;

    document.body.appendChild(
        element
    );

    setTimeout(() => {
        element.remove();
    }, 1200);
}

// ------------------------------------------------------------
// SOCKET.IO
// ------------------------------------------------------------

function setupSocket() {
    if (!socket) {
        console.warn(
            "Socket.IO not loaded."
        );

        return;
    }

    socket.on("connect", () => {
        playerId = socket.id;

        console.log(
            "Connected to Nova-Strike server:",
            playerId
        );

        socket.emit(
            "playerReady",
            {
                x: player.position.x,
                y: player.position.y,
                z: player.position.z
            }
        );
    });

    socket.on("playerJoined", data => {
        addRemotePlayer(data);
    });

    socket.on("playerMoved", data => {
        updateRemotePlayer(data);
    });

    socket.on("playerLeft", id => {
        removeRemotePlayer(id);
    });

    socket.on("damageTaken", data => {
        takeDamage(
            data.damage,
            data.attackerId
        );
    });

    socket.on("killConfirmed", () => {
        registerKill();
    });

    socket.on("playerDied", data => {
        if (
            data.playerId === playerId
        ) {
            die(data.killerId);
        }
    });

    socket.on("players", players => {
        for (const id in players) {
            if (id === playerId) {
                continue;
            }

            addRemotePlayer(
                players[id]
            );
        }
    });
}

// ------------------------------------------------------------
// REMOTE PLAYER
// ------------------------------------------------------------

function addRemotePlayer(data) {
    if (!data || !data.id) {
        return;
    }

    if (
        data.id === playerId
    ) {
        return;
    }

    if (
        remotePlayers[data.id]
    ) {
        return;
    }

    const group =
        new THREE.Object3D();

    group.userData.playerId =
        data.id;

    // Body
    const bodyGeometry =
        new THREE.BoxGeometry(
            0.8,
            1.4,
            0.45
        );

    const bodyMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x3498db
        });

    const body =
        new THREE.Mesh(
            bodyGeometry,
            bodyMaterial
        );

    body.position.y =
        0.7;

    group.add(body);

    // Head
    const headGeometry =
        new THREE.BoxGeometry(
            0.65,
            0.65,
            0.65
        );

    const headMaterial =
        new THREE.MeshStandardMaterial({
            color: 0xf1c40f
        });

    const head =
        new THREE.Mesh(
            headGeometry,
            headMaterial
        );

    head.position.y =
        1.75;

    head.userData.hitbox =
        "head";

    group.add(head);

    group.position.set(
        data.x || 0,
        data.y || 0,
        data.z || 0
    );

    scene.add(group);

    remotePlayers[data.id] = {
        object: group
    };
}

function updateRemotePlayer(data) {
    if (!data || !data.id) {
        return;
    }

    const remote =
        remotePlayers[data.id];

    if (!remote) {
        addRemotePlayer(data);
        return;
    }

    remote.object.position.set(
        data.x,
        data.y,
        data.z
    );

    if (
        typeof data.rotationY ===
        "number"
    ) {
        remote.object.rotation.y =
            data.rotationY;
    }
}

function removeRemotePlayer(id) {
    const remote =
        remotePlayers[id];

    if (!remote) {
        return;
    }

    scene.remove(
        remote.object
    );

    delete remotePlayers[id];
}

// ------------------------------------------------------------
// SEND MOVEMENT
// ------------------------------------------------------------

let networkTimer = 0;

function sendMovement(delta) {
    if (!socket) {
        return;
    }

    networkTimer += delta;

    if (networkTimer < 0.05) {
        return;
    }

    networkTimer = 0;

    socket.emit("playerMove", {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        rotationY: player.rotation.y
    });
}

// ------------------------------------------------------------
// GAME LOOP
// ------------------------------------------------------------

let lastTime =
    performance.now();

function animate() {
    requestAnimationFrame(
        animate
    );

    const now =
        performance.now();

    let delta =
        (now - lastTime) / 1000;

    lastTime = now;

    // Prevent giant movement jumps
    delta =
        Math.min(delta, 0.05);

    updateMovement(delta);

    automaticFire();

    sendMovement(delta);

    renderer.render(
        scene,
        camera
    );
}

// ------------------------------------------------------------
// RESIZE
// ------------------------------------------------------------

function onResize() {
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

// ------------------------------------------------------------
// START
// ------------------------------------------------------------

if (
    typeof THREE !== "undefined"
) {
    init();
} else {
    console.error(
        "Nova-Strike requires Three.js to be loaded before game.js."
    );
}
