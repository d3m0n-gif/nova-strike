// ============================================================
// NOVASTRIKE
// public/game.js
// ============================================================

let scene = null;
let camera = null;
let renderer = null;
let player = null;

let gameStarted = false;

let yaw = 0;
let pitch = 0;

let keys = {};
let mouseDown = false;

let lastShot = 0;
let reloading = false;

let currentWeapon = "ak";

let health = 100;
let kills = 0;
let deaths = 0;
let streak = 0;

const remotePlayers = {};

const playerVelocity = new THREE.Vector3();

const weapons = {
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
};

const ammo = {
    ak: 25,
    pistol: 12
};

const reserveAmmo = {
    ak: 100,
    pistol: 60
};


// ============================================================
// SOCKET.IO
// ============================================================

let socket = null;

function setupSocket() {

    if (typeof io === "undefined") {
        console.warn("Socket.IO is not loaded.");
        return;
    }

    socket = io();

    socket.on("connect", () => {

        console.log(
            "Connected to NovaStrike server:",
            socket.id
        );

        sendPlayerPosition();
    });


    socket.on("playerJoined", data => {

        if (!data || data.id === socket.id) {
            return;
        }

        addRemotePlayer(data);

    });


    socket.on("players", players => {

        if (!players) {
            return;
        }

        Object.keys(players).forEach(id => {

            if (socket && id === socket.id) {
                return;
            }

            addRemotePlayer({
                id,
                ...players[id]
            });

        });

    });


    socket.on("playerMoved", data => {

        if (!data || !data.id) {
            return;
        }

        updateRemotePlayer(data);

    });


    socket.on("playerLeft", id => {

        removeRemotePlayer(id);

    });


    socket.on("damageTaken", data => {

        if (!data) {
            return;
        }

        takeDamage(
            data.damage || 0,
            data.attackerId
        );

    });


    socket.on("killConfirmed", () => {

        registerKill();

    });

}


// ============================================================
// START GAME
// ============================================================

window.loadThree = function () {

    if (gameStarted) {
        return;
    }

    if (typeof THREE === "undefined") {

        console.error(
            "Three.js failed to load."
        );

        return;
    }

    gameStarted = true;

    initGame();

};


// ============================================================
// INITIALIZE
// ============================================================

function initGame() {

    console.log("Starting NovaStrike...");


    // --------------------------------------------------------
    // SCENE
    // --------------------------------------------------------

    scene = new THREE.Scene();

    scene.background =
        new THREE.Color(0x10141c);


    // --------------------------------------------------------
    // CAMERA
    // --------------------------------------------------------

    camera =
        new THREE.PerspectiveCamera(
            75,
            window.innerWidth /
                window.innerHeight,
            0.1,
            1000
        );

    camera.position.set(
        0,
        1.7,
        5
    );


    // --------------------------------------------------------
    // RENDERER
    // --------------------------------------------------------

    renderer =
        new THREE.WebGLRenderer({
            antialias: true
        });

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio,
            2
        )
    );


    renderer.domElement.style.position =
        "fixed";

    renderer.domElement.style.left =
        "0";

    renderer.domElement.style.top =
        "0";

    renderer.domElement.style.zIndex =
        "1";


    document.body.appendChild(
        renderer.domElement
    );


    // --------------------------------------------------------
    // LIGHTING
    // --------------------------------------------------------

    const ambient =
        new THREE.AmbientLight(
            0xffffff,
            0.7
        );

    scene.add(ambient);


    const sunlight =
        new THREE.DirectionalLight(
            0xffffff,
            1
        );

    sunlight.position.set(
        20,
        30,
        10
    );

    scene.add(sunlight);


    // --------------------------------------------------------
    // PLAYER
    // --------------------------------------------------------

    player =
        new THREE.Object3D();

    player.position.set(
        0,
        1.7,
        5
    );

    scene.add(player);

    player.add(camera);


    // --------------------------------------------------------
    // MAP
    // --------------------------------------------------------

    createMap();


    // --------------------------------------------------------
    // HUD
    // --------------------------------------------------------

    createHUD();


    // --------------------------------------------------------
    // CONTROLS
    // --------------------------------------------------------

    setupControls();


    // --------------------------------------------------------
    // SOCKET
    // --------------------------------------------------------

    setupSocket();


    // --------------------------------------------------------
    // RESIZE
    // --------------------------------------------------------

    window.addEventListener(
        "resize",
        resizeGame
    );


    // --------------------------------------------------------
    // START LOOP
    // --------------------------------------------------------

    lastTime =
        performance.now();

    requestAnimationFrame(
        gameLoop
    );

}


// ============================================================
// MAP
// ============================================================

function createMap() {

    // Ground

    const groundGeometry =
        new THREE.BoxGeometry(
            100,
            1,
            100
        );

    const groundMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x292f3a
        });

    const ground =
        new THREE.Mesh(
            groundGeometry,
            groundMaterial
        );

    ground.position.y =
        -0.5;

    scene.add(ground);


    // Outer walls

    createWall(
        0,
        5,
        -25,
        50,
        10,
        1
    );

    createWall(
        0,
        5,
        25,
        50,
        10,
        1
    );

    createWall(
        -25,
        5,
        0,
        1,
        10,
        50
    );

    createWall(
        25,
        5,
        0,
        1,
        10,
        50
    );


    // Cover

    createWall(
        -8,
        2,
        -5,
        8,
        4,
        2
    );

    createWall(
        8,
        2,
        -5,
        8,
        4,
        2
    );

    createWall(
        -8,
        2,
        8,
        8,
        4,
        2
    );

    createWall(
        8,
        2,
        8,
        8,
        4,
        2
    );


    // Center cover

    createWall(
        0,
        2,
        0,
        3,
        4,
        10
    );

}


function createWall(
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
            color: 0x3d4654
        });

    const wall =
        new THREE.Mesh(
            geometry,
            material
        );

    wall.position.set(
        x,
        y,
        z
    );

    scene.add(wall);

}


// ============================================================
// HUD
// ============================================================

function createHUD() {

    let hud =
        document.getElementById(
            "novaHud"
        );

    if (hud) {
        hud.remove();
    }


    hud =
        document.createElement(
            "div"
        );

    hud.id =
        "novaHud";

    hud.style.position =
        "fixed";

    hud.style.left =
        "0";

    hud.style.top =
        "0";

    hud.style.width =
        "100%";

    hud.style.height =
        "100%";

    hud.style.pointerEvents =
        "none";

    hud.style.zIndex =
        "10";

    hud.style.color =
        "white";

    hud.style.fontFamily =
        "Arial, sans-serif";

    document.body.appendChild(
        hud
    );


    // Crosshair

    const crosshair =
        document.createElement(
            "div"
        );

    crosshair.id =
        "novaCrosshair";

    crosshair.textContent =
        "+";

    crosshair.style.position =
        "absolute";

    crosshair.style.left =
        "50%";

    crosshair.style.top =
        "50%";

    crosshair.style.transform =
        "translate(-50%, -50%)";

    crosshair.style.fontSize =
        "28px";

    crosshair.style.fontWeight =
        "bold";

    hud.appendChild(
        crosshair
    );


    // Health

    const healthBox =
        document.createElement(
            "div"
        );

    healthBox.id =
        "novaHealth";

    healthBox.style.position =
        "absolute";

    healthBox.style.left =
        "25px";

    healthBox.style.bottom =
        "25px";

    healthBox.style.fontSize =
        "22px";

    hud.appendChild(
        healthBox
    );


    // Weapon

    const weaponBox =
        document.createElement(
            "div"
        );

    weaponBox.id =
        "novaWeapon";

    weaponBox.style.position =
        "absolute";

    weaponBox.style.right =
        "25px";

    weaponBox.style.bottom =
        "25px";

    weaponBox.style.textAlign =
        "right";

    weaponBox.style.fontSize =
        "22px";

    hud.appendChild(
        weaponBox
    );


    // Score

    const scoreBox =
        document.createElement(
            "div"
        );

    scoreBox.id =
        "novaScore";

    scoreBox.style.position =
        "absolute";

    scoreBox.style.right =
        "25px";

    scoreBox.style.top =
        "20px";

    scoreBox.style.textAlign =
        "right";

    scoreBox.style.fontSize =
        "18px";

    hud.appendChild(
        scoreBox
    );


    // Reload

    const reloadBox =
        document.createElement(
            "div"
        );

    reloadBox.id =
        "novaReload";

    reloadBox.style.position =
        "absolute";

    reloadBox.style.left =
        "50%";

    reloadBox.style.bottom =
        "25%";

    reloadBox.style.transform =
        "translateX(-50%)";

    reloadBox.style.fontSize =
        "24px";

    reloadBox.style.fontWeight =
        "bold";

    hud.appendChild(
        reloadBox
    );


    updateHUD();

}


// ============================================================
// HUD UPDATE
// ============================================================

function updateHUD() {

    const weapon =
        weapons[currentWeapon];


    const healthBox =
        document.getElementById(
            "novaHealth"
        );

    const weaponBox =
        document.getElementById(
            "novaWeapon"
        );

    const scoreBox =
        document.getElementById(
            "novaScore"
        );


    if (healthBox) {

        healthBox.textContent =
            "❤ " +
            Math.max(
                0,
                health
            ) +
            " HP";

    }


    if (weaponBox) {

        if (
            currentWeapon ===
            "knife"
        ) {

            weaponBox.innerHTML =
                "🔪 KNIFE";

        } else {

            weaponBox.innerHTML =
                weapon.name +
                "<br>" +
                ammo[currentWeapon] +
                " / " +
                reserveAmmo[currentWeapon];

        }

    }


    if (scoreBox) {

        scoreBox.innerHTML =
            "Kills: " +
            kills +
            "<br>" +
            "Deaths: " +
            deaths +
            "<br>" +
            "Streak: " +
            streak;

    }

}


// ============================================================
// CONTROLS
// ============================================================

function setupControls() {

    document.addEventListener(
        "keydown",
        event => {

            keys[event.code] =
                true;


            // Weapon 1

            if (
                event.code ===
                "Digit1"
            ) {

                switchWeapon(
                    "ak"
                );

            }


            // Weapon 2

            if (
                event.code ===
                "Digit2"
            ) {

                switchWeapon(
                    "pistol"
                );

            }


            // Weapon 3

            if (
                event.code ===
                "Digit3"
            ) {

                switchWeapon(
                    "knife"
                );

            }


            // Reload

            if (
                event.code ===
                "KeyR"
            ) {

                reload();

            }


            // Jump

            if (
                event.code ===
                "Space" &&
                player &&
                player.position.y <=
                    1.71
            ) {

                playerVelocity.y =
                    9;

            }

        }
    );


    document.addEventListener(
        "keyup",
        event => {

            keys[event.code] =
                false;

        }
    );


    document.addEventListener(
        "mousedown",
        event => {

            if (
                event.button !== 0
            ) {
                return;
            }

            mouseDown =
                true;


            if (
                renderer &&
                document.pointerLockElement !==
                    renderer.domElement
            ) {

                renderer.domElement.requestPointerLock();

            }


            shoot();

        }
    );


    document.addEventListener(
        "mouseup",
        event => {

            if (
                event.button === 0
            ) {

                mouseDown =
                    false;

            }

        }
    );


    document.addEventListener(
        "mousemove",
        event => {

            if (
                !renderer ||
                document.pointerLockElement !==
                    renderer.domElement
            ) {

                return;

            }


            yaw -=
                event.movementX *
                0.002;


            pitch -=
                event.movementY *
                0.002;


            const limit =
                Math.PI / 2 -
                0.05;


            pitch =
                Math.max(
                    -limit,
                    Math.min(
                        limit,
                        pitch
                    )
                );


            camera.rotation.x =
                pitch;

            player.rotation.y =
                yaw;

        }
    );

}


// ============================================================
// MOVEMENT
// ============================================================

function updateMovement(
    delta
) {

    if (!player) {
        return;
    }


    const direction =
        new THREE.Vector3();


    if (
        keys["KeyW"]
    ) {

        direction.z -= 1;

    }


    if (
        keys["KeyS"]
    ) {

        direction.z += 1;

    }


    if (
        keys["KeyA"]
    ) {

        direction.x -= 1;

    }


    if (
        keys["KeyD"]
    ) {

        direction.x += 1;

    }


    if (
        direction.lengthSq() >
        0
    ) {

        direction.normalize();


        /*
         * IMPORTANT MOVEMENT FIX
         *
         * W always moves forward relative
         * to where the player is looking.
         */

        direction.applyAxisAngle(
            new THREE.Vector3(
                0,
                1,
                0
            ),
            yaw
        );

    }


    let speed =
        7;


    if (
        keys["ShiftLeft"] ||
        keys["ShiftRight"]
    ) {

        speed =
            10;

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
        25 *
        delta;


    player.position.y +=
        playerVelocity.y *
        delta;


    // Ground

    if (
        player.position.y <
        1.7
    ) {

        player.position.y =
            1.7;

        playerVelocity.y =
            0;

    }


    // Map boundaries

    player.position.x =
        Math.max(
            -24,
            Math.min(
                24,
                player.position.x
            )
        );


    player.position.z =
        Math.max(
            -24,
            Math.min(
                24,
                player.position.z
            )
        );

}


// ============================================================
// WEAPONS
// ============================================================

function switchWeapon(
    weaponName
) {

    if (
        !weapons[weaponName]
    ) {
        return;
    }


    if (reloading) {
        return;
    }


    currentWeapon =
        weaponName;


    updateHUD();

}


// ============================================================
// SHOOT
// ============================================================

function shoot() {

    if (reloading) {
        return;
    }


    const weapon =
        weapons[currentWeapon];


    const now =
        performance.now();


    if (
        now - lastShot <
        weapon.fireRate
    ) {

        return;

    }


    lastShot =
        now;


    // Knife

    if (
        currentWeapon ===
        "knife"
    ) {

        knifeAttack();

        return;

    }


    // Empty magazine

    if (
        ammo[currentWeapon] <=
        0
    ) {

        reload();

        return;

    }


    ammo[currentWeapon]--;


    updateHUD();


    createMuzzleFlash();


    performRaycastShot();


    if (socket) {

        socket.emit(
            "playerShoot",
            {
                weapon:
                    currentWeapon,

                rotation: {
                    x:
                        pitch,

                    y:
                        yaw
                }
            }
        );

    }

}


// ============================================================
// AUTOMATIC FIRE
// ============================================================

function automaticFire() {

    if (
        currentWeapon ===
            "ak" &&
        mouseDown
    ) {

        shoot();

    }

}


// ============================================================
// SHOOT RAYCAST
// ============================================================

function performRaycastShot() {

    if (
        !camera ||
        !scene
    ) {
        return;
    }


    const raycaster =
        new THREE.Raycaster();


    raycaster.setFromCamera(
        new THREE.Vector2(
            0,
            0
        ),
        camera
    );


    const targets = [];


    Object.values(
        remotePlayers
    ).forEach(remote => {

        if (
            remote &&
            remote.object
        ) {

            targets.push(
                remote.object
            );

        }

    });


    if (
        targets.length === 0
    ) {
        return;
    }


    const hits =
        raycaster.intersectObjects(
            targets,
            true
        );


    if (
        hits.length === 0
    ) {
        return;
    }


    const hit =
        hits[0];


    if (
        hit.distance >
        100
    ) {
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


    const headshot =
        hit.object.userData &&
        hit.object.userData.hitbox ===
            "head";


    const weapon =
        weapons[currentWeapon];


    const damage =
        headshot
            ? weapon.headshotDamage
            : weapon.damage;


    createHitMarker(
        headshot
    );


    if (socket) {

        socket.emit(
            "playerDamage",
            {
                targetId,
                damage,
                headshot,
                weapon:
                    currentWeapon
            }
        );

    }

}


// ============================================================
// KNIFE
// ============================================================

function knifeAttack() {

    const raycaster =
        new THREE.Raycaster();


    raycaster.setFromCamera(
        new THREE.Vector2(
            0,
            0
        ),
        camera
    );


    const targets = [];


    Object.values(
        remotePlayers
    ).forEach(remote => {

        if (
            remote &&
            remote.object
        ) {

            targets.push(
                remote.object
            );

        }

    });


    const hits =
        raycaster.intersectObjects(
            targets,
            true
        );


    if (
        hits.length === 0
    ) {
        return;
    }


    if (
        hits[0].distance >
        3
    ) {
        return;
    }


    let target =
        hits[0].object;


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


    createHitMarker(
        false
    );


    if (socket) {

        socket.emit(
            "playerDamage",
            {
                targetId:
                    target.userData.playerId,

                damage: 100,

                headshot: false,

                weapon:
                    "knife"
            }
        );

    }

}


// ============================================================
// RELOAD
// ============================================================

function reload() {

    if (
        currentWeapon ===
        "knife"
    ) {
        return;
    }


    if (reloading) {
        return;
    }


    const weapon =
        weapons[currentWeapon];


    if (
        ammo[currentWeapon] >=
        weapon.magazineSize
    ) {
        return;
    }


    if (
        reserveAmmo[currentWeapon] <=
        0
    ) {
        return;
    }


    reloading =
        true;


    const reloadBox =
        document.getElementById(
            "novaReload"
        );


    if (reloadBox) {

        reloadBox.textContent =
            "RELOADING...";

    }


    setTimeout(
        () => {

            const needed =
                weapon.magazineSize -
                ammo[currentWeapon];


            const amount =
                Math.min(
                    needed,
                    reserveAmmo[
                        currentWeapon
                    ]
                );


            ammo[currentWeapon] +=
                amount;


            reserveAmmo[
                currentWeapon
            ] -=
                amount;


            reloading =
                false;


            if (reloadBox) {

                reloadBox.textContent =
                    "";

            }


            updateHUD();

        },
        weapon.reloadTime
    );

}


// ============================================================
// MUZZLE FLASH
// ============================================================

function createMuzzleFlash() {

    const flash =
        document.createElement(
            "div"
        );


    flash.style.position =
        "fixed";

    flash.style.left =
        "50%";

    flash.style.top =
        "50%";

    flash.style.width =
        "7px";

    flash.style.height =
        "7px";

    flash.style.borderRadius =
        "50%";

    flash.style.transform =
        "translate(-50%, -50%)";

    flash.style.background =
        "white";

    flash.style.boxShadow =
        "0 0 20px yellow";

    flash.style.zIndex =
        "20";

    flash.style.pointerEvents =
        "none";


    document.body.appendChild(
        flash
    );


    setTimeout(
        () => {

            flash.remove();

        },
        45
    );

}


// ============================================================
// HIT MARKER
// ============================================================

function createHitMarker(
    headshot
) {

    const marker =
        document.createElement(
            "div"
        );


    marker.style.position =
        "fixed";

    marker.style.left =
        "50%";

    marker.style.top =
        "50%";

    marker.style.transform =
        "translate(-50%, -50%)";

    marker.style.fontSize =
        "22px";

    marker.style.fontWeight =
        "bold";

    marker.style.color =
        headshot
            ? "#ffcc00"
            : "white";

    marker.style.zIndex =
        "20";

    marker.style.pointerEvents =
        "none";


    marker.textContent =
        headshot
            ? "✦"
            : "×";


    document.body.appendChild(
        marker
    );


    setTimeout(
        () => {

            marker.remove();

        },
        150
    );

}


// ============================================================
// DAMAGE
// ============================================================

function takeDamage(
    amount,
    attackerId
) {

    if (health <= 0) {
        return;
    }


    health -=
        Number(amount) || 0;


    health =
        Math.max(
            0,
            health
        );


    updateHUD();


    createDamageFlash();


    if (
        health <= 0
    ) {

        die(
            attackerId
        );

    }

}


// ============================================================
// DAMAGE FLASH
// ============================================================

function createDamageFlash() {

    const flash =
        document.createElement(
            "div"
        );


    flash.style.position =
        "fixed";

    flash.style.left =
        "0";

    flash.style.top =
        "0";

    flash.style.width =
        "100%";

    flash.style.height =
        "100%";

    flash.style.background =
        "rgba(255, 0, 0, 0.25)";

    flash.style.zIndex =
        "19";

    flash.style.pointerEvents =
        "none";


    document.body.appendChild(
        flash
    );


    setTimeout(
        () => {

            flash.remove();

        },
        120
    );

}


// ============================================================
// DEATH
// ============================================================

function die(
    killerId
) {

    if (
        health > 0
    ) {
        return;
    }


    deaths++;

    streak = 0;


    updateHUD();


    if (socket) {

        socket.emit(
            "playerDeath",
            {
                killerId
            }
        );

    }


    const text =
        document.createElement(
            "div"
        );


    text.style.position =
        "fixed";

    text.style.left =
        "50%";

    text.style.top =
        "40%";

    text.style.transform =
        "translate(-50%, -50%)";

    text.style.fontSize =
        "48px";

    text.style.fontWeight =
        "bold";

    text.style.color =
        "white";

    text.style.zIndex =
        "30";

    text.style.pointerEvents =
        "none";


    text.textContent =
        "YOU DIED";


    document.body.appendChild(
        text
    );


    setTimeout(
        () => {

            text.remove();

            respawn();

        },
        3000
    );

}


// ============================================================
// RESPAWN
// ============================================================

function respawn() {

    health =
        100;


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
        weapons.ak.magazineSize;


    ammo.pistol =
        weapons.pistol.magazineSize;


    reserveAmmo.ak =
        weapons.ak.reserveAmmo;


    reserveAmmo.pistol =
        weapons.pistol.reserveAmmo;


    updateHUD();

}


// ============================================================
// KILL
// ============================================================

function registerKill() {

    kills++;

    streak++;


    updateHUD();


    if (
        streak >= 3
    ) {

        showStreak(
            streak
        );

    }

}


function showStreak(
    number
) {

    const text =
        document.createElement(
            "div"
        );


    text.style.position =
        "fixed";

    text.style.left =
        "50%";

    text.style.top =
        "25%";

    text.style.transform =
        "translateX(-50%)";

    text.style.fontSize =
        "30px";

    text.style.fontWeight =
        "bold";

    text.style.zIndex =
        "25";

    text.style.pointerEvents =
        "none";


    text.textContent =
        "🔥 " +
        number +
        " KILL STREAK";


    document.body.appendChild(
        text
    );


    setTimeout(
        () => {

            text.remove();

        },
        1200
    );

}


// ============================================================
// REMOTE PLAYERS
// ============================================================

function addRemotePlayer(
    data
) {

    if (
        !data ||
        !data.id
    ) {
        return;
    }


    if (
        socket &&
        data.id === socket.id
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


    // BODY

    const body =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.8,
                1.4,
                0.45
            ),
            new THREE.MeshStandardMaterial({
                color:
                    0x3498db
            })
        );


    body.position.y =
        0.7;


    group.add(body);


    // HEAD

    const head =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.65,
                0.65,
                0.65
            ),
            new THREE.MeshStandardMaterial({
                color:
                    0xf1c40f
            })
        );


    head.position.y =
        1.75;


    head.userData.hitbox =
        "head";


    group.add(head);


    group.position.set(
        Number(data.x) || 0,
        Number(data.y) || 0,
        Number(data.z) || 0
    );


    scene.add(
        group
    );


    remotePlayers[
        data.id
    ] = {
        object: group
    };

}


function updateRemotePlayer(
    data
) {

    const remote =
        remotePlayers[
            data.id
        ];


    if (!remote) {

        addRemotePlayer(
            data
        );

        return;

    }


    remote.object.position.set(
        Number(data.x) || 0,
        Number(data.y) || 0,
        Number(data.z) || 0
    );


    if (
        typeof data.rotationY ===
        "number"
    ) {

        remote.object.rotation.y =
            data.rotationY;

    }

}


function removeRemotePlayer(
    id
) {

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


// ============================================================
// NETWORK MOVEMENT
// ============================================================

let networkTimer = 0;

function sendPlayerPosition() {

    if (
        !socket ||
        !player
    ) {
        return;
    }


    socket.emit(
        "playerMove",
        {
            x:
                player.position.x,

            y:
                player.position.y,

            z:
                player.position.z,

            rotationY:
                player.rotation.y
        }
    );

}


function updateNetwork(
    delta
) {

    if (!socket) {
        return;
    }


    networkTimer +=
        delta;


    if (
        networkTimer <
        0.05
    ) {
        return;
    }


    networkTimer =
        0;


    sendPlayerPosition();

}


// ============================================================
// GAME LOOP
// ============================================================

let lastTime =
    0;


function gameLoop(
    currentTime
) {

    if (
        !gameStarted
    ) {
        return;
    }


    requestAnimationFrame(
        gameLoop
    );


    let delta =
        (currentTime -
            lastTime) /
        1000;


    lastTime =
        currentTime;


    delta =
        Math.min(
            delta,
            0.05
        );


    updateMovement(
        delta
    );


    automaticFire();


    updateNetwork(
        delta
    );


    renderer.render(
        scene,
        camera
    );

}


// ============================================================
// RESIZE
// ============================================================

function resizeGame() {

    if (
        !camera ||
        !renderer
    ) {
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


// ============================================================
// END
// ============================================================

console.log(
    "NovaStrike game.js loaded successfully."
);
