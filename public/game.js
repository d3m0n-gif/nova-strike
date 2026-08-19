// ============================================================
// NOVASTRIKE
// Multiplayer Browser FPS
// ============================================================

import * as THREE from
    "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";


// ============================================================
// CORE
// ============================================================

let scene;
let camera;
let renderer;
let player;

let socket = null;

let gameStarted = false;

let yaw = 0;
let pitch = 0;

let keys = {};
let mouseDown = false;

let lastTime = 0;
let lastShot = 0;
let networkTimer = 0;

let currentWeapon = "ak";
let reloading = false;

let health = 100;
let kills = 0;
let deaths = 0;
let streak = 0;

let weaponModel = null;
let weaponRecoil = 0;

const remotePlayers = {};
const mapObstacles = [];

const playerVelocity =
    new THREE.Vector3();


// ============================================================
// MAP
// ============================================================

const MAP_SIZE = 15;
const TILE_SIZE = 4;

const MAP_HALF =
    MAP_SIZE * TILE_SIZE / 2;


// ============================================================
// WEAPONS
// ============================================================

const weapons = {

    ak: {
        name: "AK-47",
        magazine: 25,
        damage: 17,
        headshot: 34,
        fireRate: 105,
        reload: 1500,
        automatic: true
    },

    pistol: {
        name: "HANDGUN",
        magazine: 12,
        damage: 20,
        headshot: 40,
        fireRate: 250,
        reload: 1100,
        automatic: false
    },

    knife: {
        name: "KNIFE",
        magazine: 0,
        damage: 100,
        headshot: 100,
        fireRate: 500,
        reload: 0,
        automatic: false
    }

};


const ammo = {

    ak: 25,
    pistol: 12

};


// ============================================================
// START
// ============================================================

window.loadThree = function () {

    if (gameStarted) {
        return;
    }

    gameStarted = true;

    initGame();

};


// ============================================================
// INITIALIZE
// ============================================================

function initGame() {

    scene =
        new THREE.Scene();

    scene.background =
        new THREE.Color(
            0x11151d
        );


    // Camera

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
        0,
        0
    );


    // Renderer

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


    // Player

    player =
        new THREE.Object3D();

    player.position.set(
        0,
        1.7,
        5
    );

    scene.add(
        player
    );

    player.add(
        camera
    );


    // Lighting

    const ambient =
        new THREE.AmbientLight(
            0xffffff,
            0.75
        );

    scene.add(
        ambient
    );


    const sun =
        new THREE.DirectionalLight(
            0xffffff,
            1.2
        );

    sun.position.set(
        20,
        30,
        15
    );

    scene.add(
        sun
    );


    // Map

    createMap();


    // Weapon

    createWeapon();


    // HUD

    createHUD();


    // Controls

    setupControls();


    // Multiplayer

    setupSocket();


    // Resize

    window.addEventListener(
        "resize",
        resizeGame
    );


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

    const size =
        MAP_SIZE * TILE_SIZE;


    // Ground

    const ground =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                size,
                1,
                size
            ),
            new THREE.MeshStandardMaterial({
                color: 0x292f3a
            })
        );

    ground.position.y =
        -0.5;

    scene.add(
        ground
    );


    // Outer walls

    createWall(
        0,
        2.5,
        -MAP_HALF,
        size,
        5,
        1
    );

    createWall(
        0,
        2.5,
        MAP_HALF,
        size,
        5,
        1
    );

    createWall(
        -MAP_HALF,
        2.5,
        0,
        1,
        5,
        size
    );

    createWall(
        MAP_HALF,
        2.5,
        0,
        1,
        5,
        size
    );


    // Arena cover

    createWall(
        -18,
        1.5,
        -10,
        8,
        3,
        2
    );

    createWall(
        18,
        1.5,
        -10,
        8,
        3,
        2
    );

    createWall(
        -18,
        1.5,
        10,
        8,
        3,
        2
    );

    createWall(
        18,
        1.5,
        10,
        8,
        3,
        2
    );


    // Center walls

    createWall(
        -7,
        1.5,
        0,
        3,
        3,
        7
    );

    createWall(
        7,
        1.5,
        0,
        3,
        3,
        7
    );


    // Front/back cover

    createWall(
        0,
        1.5,
        -14,
        10,
        3,
        2
    );

    createWall(
        0,
        1.5,
        14,
        10,
        3,
        2
    );

}


// ============================================================
// SOLID WALL
// ============================================================

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
                color: 0x3d4654
            })
        );

    wall.position.set(
        x,
        y,
        z
    );

    scene.add(
        wall
    );


    mapObstacles.push({

        minX:
            x - width / 2,

        maxX:
            x + width / 2,

        minZ:
            z - depth / 2,

        maxZ:
            z + depth / 2

    });

}


// ============================================================
// WEAPON MODEL
// ============================================================

function createWeapon() {

    if (weaponModel) {

        camera.remove(
            weaponModel
        );

    }


    weaponModel =
        new THREE.Group();


    weaponModel.position.set(
        0.55,
        -0.55,
        -0.95
    );


    camera.add(
        weaponModel
    );


    if (
        currentWeapon ===
        "ak"
    ) {

        createAK();

    } else if (
        currentWeapon ===
        "pistol"
    ) {

        createPistol();

    } else {

        createKnife();

    }

}


// ============================================================
// AK
// ============================================================

function createAK() {

    const metal =
        new THREE.MeshStandardMaterial({
            color: 0x242424,
            roughness: 0.55
        });


    const black =
        new THREE.MeshStandardMaterial({
            color: 0x101010,
            roughness: 0.8
        });


    const wood =
        new THREE.MeshStandardMaterial({
            color: 0x704522
        });


    // Receiver

    const receiver =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.65,
                0.28,
                1.1
            ),
            metal
        );

    weaponModel.add(
        receiver
    );


    // Barrel

    const barrel =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.055,
                0.055,
                1.15,
                12
            ),
            black
        );

    barrel.rotation.z =
        Math.PI / 2;

    barrel.position.z =
        -0.95;

    weaponModel.add(
        barrel
    );


    // Stock

    const stock =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.23,
                0.25,
                0.75
            ),
            wood
        );

    stock.position.z =
        0.9;

    weaponModel.add(
        stock
    );


    // Magazine

    const magazine =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.25,
                0.65,
                0.35
            ),
            black
        );

    magazine.position.set(
        0,
        -0.42,
        -0.05
    );

    magazine.rotation.x =
        -0.15;

    weaponModel.add(
        magazine
    );


    // Grip

    const grip =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.2,
                0.5,
                0.25
            ),
            black
        );

    grip.position.set(
        0,
        -0.35,
        0.4
    );

    grip.rotation.x =
        -0.25;

    weaponModel.add(
        grip
    );

}


// ============================================================
// PISTOL
// ============================================================

function createPistol() {

    const metal =
        new THREE.MeshStandardMaterial({
            color: 0x30343b,
            roughness: 0.5
        });


    const black =
        new THREE.MeshStandardMaterial({
            color: 0x111111
        });


    // Slide

    const slide =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.32,
                0.2,
                0.85
            ),
            metal
        );

    slide.position.y =
        0.08;

    weaponModel.add(
        slide
    );


    // Barrel

    const barrel =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.045,
                0.045,
                0.55,
                12
            ),
            black
        );

    barrel.rotation.z =
        Math.PI / 2;

    barrel.position.set(
        0,
        0.08,
        -0.65
    );

    weaponModel.add(
        barrel
    );


    // Grip

    const grip =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.25,
                0.55,
                0.3
            ),
            black
        );

    grip.position.set(
        0,
        -0.28,
        0.25
    );

    grip.rotation.x =
        -0.18;

    weaponModel.add(
        grip
    );

}


// ============================================================
// KNIFE
// ============================================================

function createKnife() {

    const blade =
        new THREE.MeshStandardMaterial({
            color: 0xc5ccd8,
            metalness: 0.8,
            roughness: 0.25
        });


    const handle =
        new THREE.MeshStandardMaterial({
            color: 0x151515
        });


    const bladeMesh =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.12,
                0.08,
                1.25
            ),
            blade
        );

    bladeMesh.position.z =
        -0.55;

    weaponModel.add(
        bladeMesh
    );


    const handleMesh =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.16,
                0.16,
                0.55
            ),
            handle
        );

    handleMesh.position.z =
        0.45;

    weaponModel.add(
        handleMesh
    );

}


// ============================================================
// HUD
// ============================================================

function createHUD() {

    const old =
        document.getElementById(
            "novaHud"
        );

    if (old) {
        old.remove();
    }


    const hud =
        document.createElement(
            "div"
        );

    hud.id =
        "novaHud";


    Object.assign(
        hud.style,
        {
            position: "fixed",
            inset: "0",
            zIndex: "10",
            pointerEvents: "none",
            color: "white",
            fontFamily:
                "Arial, sans-serif"
        }
    );


    document.body.appendChild(
        hud
    );


    // Crosshair

    const crosshair =
        document.createElement(
            "div"
        );

    crosshair.textContent =
        "+";


    Object.assign(
        crosshair.style,
        {
            position: "absolute",
            left: "50%",
            top: "50%",
            transform:
                "translate(-50%,-50%)",
            fontSize: "28px",
            fontWeight: "bold"
        }
    );


    hud.appendChild(
        crosshair
    );


    // Health

    const healthUI =
        document.createElement(
            "div"
        );

    healthUI.id =
        "novaHealth";


    Object.assign(
        healthUI.style,
        {
            position: "absolute",
            left: "25px",
            bottom: "25px",
            fontSize: "22px",
            fontWeight: "bold"
        }
    );


    hud.appendChild(
        healthUI
    );


    // Weapon/ammo

    const weaponUI =
        document.createElement(
            "div"
        );

    weaponUI.id =
        "novaWeapon";


    Object.assign(
        weaponUI.style,
        {
            position: "absolute",
            right: "25px",
            bottom: "25px",
            textAlign: "right",
            fontSize: "20px"
        }
    );


    hud.appendChild(
        weaponUI
    );


    // Big ammo popup

    const ammoPopup =
        document.createElement(
            "div"
        );

    ammoPopup.id =
        "novaAmmoPopup";


    Object.assign(
        ammoPopup.style,
        {
            position: "absolute",
            right: "45px",
            bottom: "90px",
            fontSize: "34px",
            fontWeight: "bold",
            textShadow:
                "0 2px 6px black",
            opacity: "0"
        }
    );


    hud.appendChild(
        ammoPopup
    );


    // Score

    const score =
        document.createElement(
            "div"
        );

    score.id =
        "novaScore";


    Object.assign(
        score.style,
        {
            position: "absolute",
            right: "25px",
            top: "20px",
            textAlign: "right",
            fontSize: "18px"
        }
    );


    hud.appendChild(
        score
    );


    // Reload

    const reloadUI =
        document.createElement(
            "div"
        );

    reloadUI.id =
        "novaReload";


    Object.assign(
        reloadUI.style,
        {
            position: "absolute",
            left: "50%",
            bottom: "25%",
            transform:
                "translateX(-50%)",
            fontSize: "24px",
            fontWeight: "bold"
        }
    );


    hud.appendChild(
        reloadUI
    );


    updateHUD();

}


// ============================================================
// HUD UPDATE
// ============================================================

function updateHUD() {

    const healthUI =
        document.getElementById(
            "novaHealth"
        );

    const weaponUI =
        document.getElementById(
            "novaWeapon"
        );

    const score =
        document.getElementById(
            "novaScore"
        );


    if (healthUI) {

        healthUI.textContent =
            "♥ " +
            health +
            " HP";

    }


    if (weaponUI) {

        if (
            currentWeapon ===
            "knife"
        ) {

            weaponUI.innerHTML =
                "<b>KNIFE</b>";

        } else {

            weaponUI.innerHTML =
                "<b>" +
                weapons[
                    currentWeapon
                ].name +
                "</b><br>" +
                ammo[
                    currentWeapon
                ] +
                " / ∞";

        }

    }


    if (score) {

        score.innerHTML =
            "Kills: " +
            kills +
            "<br>Deaths: " +
            deaths +
            "<br>Streak: " +
            streak;

    }

}


// ============================================================
// AMMO POPUP
// ============================================================

function showAmmoPopup() {

    if (
        currentWeapon ===
        "knife"
    ) {
        return;
    }


    const popup =
        document.getElementById(
            "novaAmmoPopup"
        );


    if (!popup) {
        return;
    }


    popup.textContent =
        ammo[
            currentWeapon
        ] +
        " / ∞";


    popup.style.opacity =
        "1";


    clearTimeout(
        popup.timer
    );


    popup.timer =
        setTimeout(
            () => {

                popup.style.opacity =
                    "0";

            },
            700
        );

}


// ============================================================
// CONTROLS
// ============================================================

function setupControls() {

    document.addEventListener(
        "keydown",
        event => {

            keys[
                event.code
            ] = true;


            if (
                event.code ===
                "Digit1"
            ) {

                switchWeapon(
                    "ak"
                );

            }


            if (
                event.code ===
                "Digit2"
            ) {

                switchWeapon(
                    "pistol"
                );

            }


            if (
                event.code ===
                "Digit3"
            ) {

                switchWeapon(
                    "knife"
                );

            }


            if (
                event.code ===
                "KeyR"
            ) {

                reload();

            }


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

            keys[
                event.code
            ] = false;

        }
    );


    document.addEventListener(
        "mousedown",
        event => {

            if (
                event.button !==
                0
            ) {
                return;
            }


            mouseDown =
                true;


            if (
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
                event.button ===
                0
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


            player.rotation.y =
                yaw;


            camera.rotation.x =
                pitch;

        }
    );

}


// ============================================================
// MOVEMENT
// ============================================================

function updateMovement(
    delta
) {

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


        direction.applyAxisAngle(
            new THREE.Vector3(
                0,
                1,
                0
            ),
            yaw
        );

    }


    let speed = 7;


    if (
        keys["ShiftLeft"] ||
        keys["ShiftRight"]
    ) {

        speed = 10;

    }


    tryMove(
        direction.x *
            speed *
            delta,
        0
    );


    tryMove(
        0,
        direction.z *
            speed *
            delta
    );


    // Gravity

    playerVelocity.y -=
        25 *
        delta;


    player.position.y +=
        playerVelocity.y *
        delta;


    if (
        player.position.y <
        1.7
    ) {

        player.position.y =
            1.7;

        playerVelocity.y =
            0;

    }


    // Map boundary

    const limit =
        MAP_HALF -
        0.45;


    player.position.x =
        Math.max(
            -limit,
            Math.min(
                limit,
                player.position.x
            )
        );


    player.position.z =
        Math.max(
            -limit,
            Math.min(
                limit,
                player.position.z
            )
        );

}


// ============================================================
// COLLISION
// ============================================================

function tryMove(
    dx,
    dz
) {

    const radius =
        0.45;


    const x =
        player.position.x +
        dx;

    const z =
        player.position.z +
        dz;


    for (
        const wall
        of mapObstacles
    ) {

        const closestX =
            Math.max(
                wall.minX,
                Math.min(
                    x,
                    wall.maxX
                )
            );


        const closestZ =
            Math.max(
                wall.minZ,
                Math.min(
                    z,
                    wall.maxZ
                )
            );


        const distanceX =
            x -
            closestX;


        const distanceZ =
            z -
            closestZ;


        if (
            distanceX *
                distanceX +
            distanceZ *
                distanceZ <
            radius * radius
        ) {

            return;

        }

    }


    player.position.x =
        x;

    player.position.z =
        z;

}


// ============================================================
// WEAPON SWITCH
// ============================================================

function switchWeapon(
    weapon
) {

    if (
        !weapons[weapon] ||
        reloading
    ) {

        return;

    }


    currentWeapon =
        weapon;


    createWeapon();


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
        weapons[
            currentWeapon
        ];


    const now =
        performance.now();


    if (
        now -
            lastShot <
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


    // Empty

    if (
        ammo[
            currentWeapon
        ] <= 0
    ) {

        reload();

        return;

    }


    ammo[
        currentWeapon
    ]--;


    updateHUD();

    showAmmoPopup();

    weaponRecoil =
        1;


    muzzleFlash();

    raycastShoot();


    if (socket) {

        socket.emit(
            "playerShoot",
            {
                weapon:
                    currentWeapon,
                yaw,
                pitch
            }
        );

    }

}


// ============================================================
// AUTOMATIC FIRE
// ============================================================

function automaticFire() {

    if (
        mouseDown &&
        currentWeapon ===
            "ak"
    ) {

        shoot();

    }

}


// ============================================================
// RAYCAST SHOOTING
// ============================================================

function raycastShoot() {

    const ray =
        new THREE.Raycaster();


    ray.setFromCamera(
        new THREE.Vector2(
            0,
            0
        ),
        camera
    );


    const targets =
        Object.values(
            remotePlayers
        )
        .map(
            p => p.object
        );


    const hits =
        ray.intersectObjects(
            targets,
            true
        );


    if (
        hits.length ===
        0
    ) {

        return;

    }


    const hit =
        hits[0];


    let target =
        hit.object;


    let headshot =
        false;


    if (
        hit.object.userData &&
        hit.object.userData.hitbox ===
            "head"
    ) {

        headshot =
            true;

    }


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


    const weapon =
        weapons[
            currentWeapon
        ];


    const damage =
        headshot
            ? weapon.headshot
            : weapon.damage;


    hitMarker(
        headshot
    );


    if (socket) {

        socket.emit(
            "playerDamage",
            {
                targetId:
                    target.userData.playerId,
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

    const ray =
        new THREE.Raycaster();


    ray.setFromCamera(
        new THREE.Vector2(
            0,
            0
        ),
        camera
    );


    const targets =
        Object.values(
            remotePlayers
        )
        .map(
            p => p.object
        );


    const hits =
        ray.intersectObjects(
            targets,
            true
        );


    if (
        hits.length ===
        0 ||
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


    hitMarker(false);


    if (socket) {

        socket.emit(
            "playerDamage",
            {
                targetId:
                    target.userData.playerId,
                damage: 100,
                headshot: false,
                weapon: "knife"
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
        "knife" ||
        reloading
    ) {

        return;

    }


    const weapon =
        weapons[
            currentWeapon
        ];


    if (
        ammo[
            currentWeapon
        ] >=
        weapon.magazine
    ) {

        return;

    }


    reloading =
        true;


    const reloadUI =
        document.getElementById(
            "novaReload"
        );


    if (reloadUI) {

        reloadUI.textContent =
            "RELOADING...";

    }


    setTimeout(
        () => {

            ammo[
                currentWeapon
            ] =
                weapon.magazine;


            reloading =
                false;


            if (reloadUI) {

                reloadUI.textContent =
                    "";

            }


            updateHUD();

            showAmmoPopup();

        },
        weapon.reload
    );

}


// ============================================================
// MUZZLE FLASH
// ============================================================

function muzzleFlash() {

    const flash =
        document.createElement(
            "div"
        );


    Object.assign(
        flash.style,
        {
            position: "fixed",
            left: "50%",
            top: "50%",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            transform:
                "translate(-50%,-50%)",
            background: "white",
            boxShadow:
                "0 0 25px yellow",
            zIndex: "30",
            pointerEvents: "none"
        }
    );


    document.body.appendChild(
        flash
    );


    setTimeout(
        () => flash.remove(),
        50
    );

}


// ============================================================
// HIT MARKER
// ============================================================

function hitMarker(
    headshot
) {

    const marker =
        document.createElement(
            "div"
        );


    marker.textContent =
        headshot
            ? "✦"
            : "×";


    Object.assign(
        marker.style,
        {
            position: "fixed",
            left: "50%",
            top: "50%",
            transform:
                "translate(-50%,-50%)",
            color:
                headshot
                    ? "#ffd000"
                    : "white",
            fontSize: "25px",
            fontWeight: "bold",
            zIndex: "30",
            pointerEvents: "none"
        }
    );


    document.body.appendChild(
        marker
    );


    setTimeout(
        () => marker.remove(),
        150
    );

}


// ============================================================
// REMOTE PLAYER
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
        data.id ===
            socket.id
    ) {

        return;

    }


    if (
        remotePlayers[
            data.id
        ]
    ) {

        return;

    }


    const group =
        new THREE.Group();


    group.userData.playerId =
        data.id;


    // Body

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


    group.add(
        body
    );


    // Head

    const head =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                0.34,
                16,
                12
            ),
            new THREE.MeshStandardMaterial({
                color:
                    0xf1c40f
            })
        );


    head.position.y =
        1.7;


    head.userData.hitbox =
        "head";


    group.add(
        head
    );


    // Nametag

    const name =
        data.username ||
        data.name ||
        "Player";


    const tag =
        createNametag(
            name
        );


    tag.position.y =
        2.35;


    group.add(
        tag
    );


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

        object:
            group,

        name:
            name

    };

}


// ============================================================
// NAMETAG
// ============================================================

function createNametag(
    text
) {

    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        512;

    canvas.height =
        128;


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.font =
        "bold 48px Arial";


    ctx.textAlign =
        "center";


    ctx.textBaseline =
        "middle";


    ctx.strokeStyle =
        "black";


    ctx.lineWidth =
        10;


    ctx.strokeText(
        text,
        256,
        64
    );


    ctx.fillStyle =
        "white";


    ctx.fillText(
        text,
        256,
        64
    );


    const texture =
        new THREE.CanvasTexture(
            canvas
        );


    texture.needsUpdate =
        true;


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
        2.5,
        0.625,
        1
    );


    return sprite;

}


// ============================================================
// UPDATE OTHER PLAYER
// ============================================================

function updateRemotePlayer(
    data
) {

    if (
        !data ||
        !data.id
    ) {

        return;

    }


    if (
        !remotePlayers[
            data.id
        ]
    ) {

        addRemotePlayer(
            data
        );

        return;

    }


    const remote =
        remotePlayers[
            data.id
        ];


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


// ============================================================
// REMOVE PLAYER
// ============================================================

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
// SOCKET.IO
// ============================================================

function setupSocket() {

    if (
        typeof io ===
        "undefined"
    ) {

        console.warn(
            "Socket.IO unavailable."
        );

        return;

    }


    socket =
        io();


    socket.on(
        "connect",
        () => {

            console.log(
                "NovaStrike multiplayer connected:",
                socket.id
            );


            socket.emit(
                "playerReady",
                {
                    username:
                        getUsername()
                }
            );


            sendPosition();

        }
    );


    // Existing players

    socket.on(
        "players",
        players => {

            if (!players) {
                return;
            }


            Object.entries(
                players
            ).forEach(
                ([id, data]) => {

                    if (
                        id !==
                        socket.id
                    ) {

                        addRemotePlayer({
                            id,
                            ...data
                        });

                    }

                }
            );

        }
    );


    // New player

    socket.on(
        "playerJoined",
        data => {

            if (
                data &&
                data.id !==
                    socket.id
            ) {

                addRemotePlayer(
                    data
                );

            }

        }
    );


    // Movement

    socket.on(
        "playerMoved",
        data => {

            updateRemotePlayer(
                data
            );

        }
    );


    // Player left

    socket.on(
        "playerLeft",
        id => {

            removeRemotePlayer(
                id
            );

        }
    );


    // Damage

    socket.on(
        "damageTaken",
        data => {

            if (!data) {
                return;
            }


            takeDamage(
                Number(
                    data.damage
                ) || 0
            );

        }
    );


    // Kill

    socket.on(
        "killConfirmed",
        () => {

            kills++;
            streak++;

            updateHUD();

        }
    );

}


// ============================================================
// USERNAME
// ============================================================

function getUsername() {

    const input =
        document.getElementById(
            "register-username"
        );


    if (
        input &&
        input.value.trim()
    ) {

        return input.value.trim();

    }


    return (
        localStorage.getItem(
            "novaUsername"
        ) ||
        "Player"
    );

}


// ============================================================
// SEND POSITION
// ============================================================

function sendPosition() {

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
                player.rotation.y,

            username:
                getUsername()
        }
    );

}


// ============================================================
// DAMAGE
// ============================================================

function takeDamage(
    damage
) {

    health -=
        damage;


    health =
        Math.max(
            0,
            health
        );


    updateHUD();


    if (
        health <=
        0
    ) {

        die();

    }

}


// ============================================================
// DEATH
// ============================================================

function die() {

    deaths++;
    streak = 0;


    updateHUD();


    const death =
        document.createElement(
            "div"
        );


    death.textContent =
        "YOU DIED";


    Object.assign(
        death.style,
        {
            position: "fixed",
            left: "50%",
            top: "40%",
            transform:
                "translate(-50%,-50%)",
            fontSize: "48px",
            fontWeight: "bold",
            color: "white",
            zIndex: "40"
        }
    );


    document.body.appendChild(
        death
    );


    setTimeout(
        () => {

            death.remove();

            respawn();

        },
        2500
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
        weapons.ak.magazine;


    ammo.pistol =
        weapons.pistol.magazine;


    updateHUD();

}


// ============================================================
// WEAPON ANIMATION
// ============================================================

function updateWeapon(
    delta
) {

    if (!weaponModel) {
        return;
    }


    weaponRecoil =
        THREE.MathUtils.lerp(
            weaponRecoil,
            0,
            delta * 15
        );


    weaponModel.position.z =
        -0.95 +
        weaponRecoil *
        0.12;


    weaponModel.rotation.x =
        -0.08 -
        weaponRecoil *
        0.15;

}


// ============================================================
// NETWORK UPDATE
// ============================================================

function updateNetwork(
    delta
) {

    networkTimer +=
        delta;


    if (
        networkTimer >=
        0.05
    ) {

        networkTimer =
            0;

        sendPosition();

    }

}


// ============================================================
// GAME LOOP
// ============================================================

function gameLoop(
    time
) {

    requestAnimationFrame(
        gameLoop
    );


    const delta =
        Math.min(
            (time - lastTime) /
                1000,
            0.05
        );


    lastTime =
        time;


    updateMovement(
        delta
    );


    automaticFire();


    updateWeapon(
        delta
    );


    updateNetwork(
        delta
    );


    // Make nametags face camera

    Object.values(
        remotePlayers
    ).forEach(
        remote => {

            if (
                remote.object
            ) {

                remote.object
                    .children
                    .forEach(
                        child => {

                            if (
                                child.isSprite
                            ) {

                                child.quaternion.copy(
                                    camera
                                        .quaternion
                                );

                            }

                        }
                    );

            }

        }
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


console.log(
    "NovaStrike game.js loaded."
);
