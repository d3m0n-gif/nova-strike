// ============================================================
// NOVASTRIKE
// game.js
// ============================================================

import * as THREE from
    "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";


// ============================================================
// GLOBALS
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

let health = 100;
let kills = 0;
let deaths = 0;
let streak = 0;

let reloading = false;

let weaponModel = null;
let weaponRecoil = 0;

let velocityY = 0;

const remotePlayers = {};

const mapObstacles = [];


// ============================================================
// MAP
// ============================================================

const MAP_SIZE = 15;
const TILE_SIZE = 4;

const MAP_WORLD_SIZE =
    MAP_SIZE * TILE_SIZE;

const MAP_HALF =
    MAP_WORLD_SIZE / 2;


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
        reloadTime: 1500,
        automatic: true
    },

    pistol: {
        name: "HANDGUN",
        magazine: 12,
        damage: 20,
        headshot: 40,
        fireRate: 250,
        reloadTime: 1100,
        automatic: false
    },

    knife: {
        name: "KNIFE",
        magazine: 0,
        damage: 100,
        headshot: 100,
        fireRate: 500,
        reloadTime: 0,
        automatic: false
    }

};


const ammo = {

    ak: 25,

    pistol: 12

};


// ============================================================
// START GAME
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

    console.log(
        "Starting NovaStrike..."
    );


    // ========================================================
    // SCENE
    // ========================================================

    scene =
        new THREE.Scene();

    scene.background =
        new THREE.Color(
            0x5b6675
        );


    // ========================================================
    // CAMERA
    // ========================================================

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


    // ========================================================
    // PLAYER
    // ========================================================

    player =
        new THREE.Object3D();


    player.position.set(
        0,
        1.7,
        5
    );


    player.rotation.order =
        "YXZ";


    scene.add(
        player
    );


    player.add(
        camera
    );


    // ========================================================
    // RENDERER
    // ========================================================

    renderer =
        new THREE.WebGLRenderer({
            antialias: true
        });


    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio || 1,
            2
        )
    );


    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );


    renderer.domElement.style.display =
        "block";


    renderer.domElement.style.width =
        "100%";


    renderer.domElement.style.height =
        "100%";


    renderer.domElement.tabIndex =
        0;


    // IMPORTANT:
    // Put canvas inside game-screen

    const gameScreen =
        document.getElementById(
            "game-screen"
        );


    if (gameScreen) {

        gameScreen.style.display =
            "block";

        gameScreen.appendChild(
            renderer.domElement
        );

    } else {

        document.body.appendChild(
            renderer.domElement
        );

    }


    // ========================================================
    // LIGHTING
    // ========================================================

    const ambient =
        new THREE.AmbientLight(
            0xffffff,
            1.2
        );


    scene.add(
        ambient
    );


    const sunlight =
        new THREE.DirectionalLight(
            0xffffff,
            1.5
        );


    sunlight.position.set(
        20,
        30,
        10
    );


    scene.add(
        sunlight
    );


    // ========================================================
    // MAP
    // ========================================================

    createMap();


    // ========================================================
    // WEAPON
    // ========================================================

    createWeapon();


    // ========================================================
    // HUD
    // ========================================================

    createHUD();


    // ========================================================
    // CONTROLS
    // ========================================================

    setupControls();


    // ========================================================
    // MULTIPLAYER
    // ========================================================

    setupSocket();


    // ========================================================
    // RESIZE
    // ========================================================

    window.addEventListener(
        "resize",
        resizeGame
    );


    lastTime =
        performance.now();


    console.log(
        "NovaStrike initialized."
    );


    requestAnimationFrame(
        gameLoop
    );

}


// ============================================================
// MAP
// ============================================================

function createMap() {

    const mapSize =
        MAP_WORLD_SIZE;


    // ========================================================
    // GROUND
    // ========================================================

    const ground =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                mapSize,
                1,
                mapSize
            ),

            new THREE.MeshStandardMaterial({
                color:
                    0x303844,

                roughness:
                    0.85
            })
        );


    ground.position.y =
        -0.5;


    scene.add(
        ground
    );


    // ========================================================
    // OUTER WALLS
    // ========================================================

    createWall(
        0,
        2.5,
        -MAP_HALF,
        mapSize,
        5,
        1
    );


    createWall(
        0,
        2.5,
        MAP_HALF,
        mapSize,
        5,
        1
    );


    createWall(
        -MAP_HALF,
        2.5,
        0,
        1,
        5,
        mapSize
    );


    createWall(
        MAP_HALF,
        2.5,
        0,
        1,
        5,
        mapSize
    );


    // ========================================================
    // COVER
    // ========================================================

    createWall(
        -18,
        1.5,
        -12,
        8,
        3,
        2
    );


    createWall(
        18,
        1.5,
        -12,
        8,
        3,
        2
    );


    createWall(
        -18,
        1.5,
        12,
        8,
        3,
        2
    );


    createWall(
        18,
        1.5,
        12,
        8,
        3,
        2
    );


    // ========================================================
    // CENTER COVER
    // ========================================================

    createWall(
        -8,
        1.5,
        0,
        3,
        3,
        8
    );


    createWall(
        8,
        1.5,
        0,
        3,
        3,
        8
    );


    // ========================================================
    // SMALL BLOCKS
    // ========================================================

    createWall(
        -15,
        1,
        -5,
        3,
        2,
        3
    );


    createWall(
        15,
        1,
        5,
        3,
        2,
        3
    );


    createWall(
        -15,
        1,
        5,
        3,
        2,
        3
    );


    createWall(
        15,
        1,
        -5,
        3,
        2,
        3
    );

}


// ============================================================
// WALL
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
                color:
                    0x46515f,

                roughness:
                    0.75
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
// WEAPON
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


    weaponModel.rotation.set(
        -0.08,
        -0.08,
        0
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
// AK MODEL
// ============================================================

function createAK() {

    const metal =
        new THREE.MeshStandardMaterial({
            color:
                0x242424,

            roughness:
                0.55
        });


    const black =
        new THREE.MeshStandardMaterial({
            color:
                0x101010,

            roughness:
                0.8
        });


    const wood =
        new THREE.MeshStandardMaterial({
            color:
                0x754b29,

            roughness:
                0.7
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
                0.24,
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


    // Front sight

    const sight =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.08,
                0.15,
                0.12
            ),
            black
        );


    sight.position.set(
        0,
        0.18,
        -0.7
    );


    weaponModel.add(
        sight
    );

}


// ============================================================
// PISTOL
// ============================================================

function createPistol() {

    const metal =
        new THREE.MeshStandardMaterial({
            color:
                0x353a42,

            roughness:
                0.5
        });


    const black =
        new THREE.MeshStandardMaterial({
            color:
                0x101010,

            roughness:
                0.8
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


    // Magazine

    const magazine =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.16,
                0.4,
                0.18
            ),
            black
        );


    magazine.position.set(
        0,
        -0.45,
        0.15
    );


    weaponModel.add(
        magazine
    );

}


// ============================================================
// KNIFE
// ============================================================

function createKnife() {

    const bladeMaterial =
        new THREE.MeshStandardMaterial({
            color:
                0xc8d0db,

            metalness:
                0.85,

            roughness:
                0.2
        });


    const handleMaterial =
        new THREE.MeshStandardMaterial({
            color:
                0x111111,

            roughness:
                0.8
        });


    const blade =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.12,
                0.08,
                1.25
            ),
            bladeMaterial
        );


    blade.position.z =
        -0.55;


    weaponModel.add(
        blade
    );


    const handle =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.16,
                0.16,
                0.55
            ),
            handleMaterial
        );


    handle.position.z =
        0.45;


    weaponModel.add(
        handle
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
            position:
                "fixed",

            inset:
                "0",

            pointerEvents:
                "none",

            zIndex:
                "50",

            color:
                "white",

            fontFamily:
                "Arial, sans-serif"
        }
    );


    document.body.appendChild(
        hud
    );


    // ========================================================
    // CROSSHAIR
    // ========================================================

    const crosshair =
        document.createElement(
            "div"
        );


    crosshair.textContent =
        "+";


    Object.assign(
        crosshair.style,
        {
            position:
                "absolute",

            left:
                "50%",

            top:
                "50%",

            transform:
                "translate(-50%,-50%)",

            fontSize:
                "26px",

            fontWeight:
                "bold",

            textShadow:
                "0 0 4px black"
        }
    );


    hud.appendChild(
        crosshair
    );


    // ========================================================
    // HEALTH
    // ========================================================

    const healthUI =
        document.createElement(
            "div"
        );


    healthUI.id =
        "novaHealth";


    Object.assign(
        healthUI.style,
        {
            position:
                "absolute",

            left:
                "25px",

            bottom:
                "25px",

            fontSize:
                "22px",

            fontWeight:
                "bold",

            textShadow:
                "0 2px 5px black"
        }
    );


    hud.appendChild(
        healthUI
    );


    // ========================================================
    // WEAPON
    // ========================================================

    const weaponUI =
        document.createElement(
            "div"
        );


    weaponUI.id =
        "novaWeapon";


    Object.assign(
        weaponUI.style,
        {
            position:
                "absolute",

            right:
                "25px",

            bottom:
                "25px",

            textAlign:
                "right",

            fontSize:
                "20px",

            fontWeight:
                "bold",

            textShadow:
                "0 2px 5px black"
        }
    );


    hud.appendChild(
        weaponUI
    );


    // ========================================================
    // BIG AMMO
    // ========================================================

    const ammoUI =
        document.createElement(
            "div"
        );


    ammoUI.id =
        "novaAmmoPopup";


    Object.assign(
        ammoUI.style,
        {
            position:
                "absolute",

            right:
                "40px",

            bottom:
                "95px",

            fontSize:
                "34px",

            fontWeight:
                "bold",

            textShadow:
                "0 2px 8px black",

            opacity:
                "0",

            transition:
                "opacity 0.2s"
        }
    );


    hud.appendChild(
        ammoUI
    );


    // ========================================================
    // SCORE
    // ========================================================

    const score =
        document.createElement(
            "div"
        );


    score.id =
        "novaScore";


    Object.assign(
        score.style,
        {
            position:
                "absolute",

            right:
                "25px",

            top:
                "20px",

            textAlign:
                "right",

            fontSize:
                "18px",

            lineHeight:
                "1.5",

            fontWeight:
                "bold",

            textShadow:
                "0 2px 5px black"
        }
    );


    hud.appendChild(
        score
    );


    // ========================================================
    // RELOAD
    // ========================================================

    const reloadUI =
        document.createElement(
            "div"
        );


    reloadUI.id =
        "novaReload";


    Object.assign(
        reloadUI.style,
        {
            position:
                "absolute",

            left:
                "50%",

            bottom:
                "25%",

            transform:
                "translateX(-50%)",

            fontSize:
                "24px",

            fontWeight:
                "bold",

            textShadow:
                "0 2px 5px black"
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
                "KNIFE";

        } else {

            weaponUI.innerHTML =
                weapons[
                    currentWeapon
                ].name +
                "<br>" +
                ammo[
                    currentWeapon
                ] +
                " / ∞";

        }

    }


    if (score) {

        score.innerHTML =
            "KILLS: " +
            kills +
            "<br>" +
            "DEATHS: " +
            deaths +
            "<br>" +
            "STREAK: " +
            streak;

    }

}


// ============================================================
// AMMO DISPLAY
// ============================================================

function showAmmo() {

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


            // AK

            if (
                event.code ===
                "Digit1"
            ) {

                switchWeapon(
                    "ak"
                );

            }


            // Pistol

            if (
                event.code ===
                "Digit2"
            ) {

                switchWeapon(
                    "pistol"
                );

            }


            // Knife

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

                velocityY =
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

    if (!player) {
        return;
    }


    const direction =
        new THREE.Vector3();


    if (
        keys["KeyW"]
    ) {

        direction.z -=
            1;

    }


    if (
        keys["KeyS"]
    ) {

        direction.z +=
            1;

    }


    if (
        keys["KeyA"]
    ) {

        direction.x -=
            1;

    }


    if (
        keys["KeyD"]
    ) {

        direction.x +=
            1;

    }


    if (
        direction.lengthSq() >
        0
    ) {

        direction.normalize();


        // Movement follows camera yaw

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


    tryMove(
        direction.x *
            speed *
            delta,
        direction.z *
            speed *
            delta
    );


    // ========================================================
    // GRAVITY
    // ========================================================

    velocityY -=
        25 *
        delta;


    player.position.y +=
        velocityY *
        delta;


    if (
        player.position.y <
        1.7
    ) {

        player.position.y =
            1.7;

        velocityY =
            0;

    }


    // ========================================================
    // BOUNDARY
    // ========================================================

    const boundary =
        MAP_HALF -
        0.6;


    player.position.x =
        Math.max(
            -boundary,
            Math.min(
                boundary,
                player.position.x
            )
        );


    player.position.z =
        Math.max(
            -boundary,
            Math.min(
                boundary,
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


    const nextX =
        player.position.x +
        dx;


    const nextZ =
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
                    nextX,
                    wall.maxX
                )
            );


        const closestZ =
            Math.max(
                wall.minZ,
                Math.min(
                    nextZ,
                    wall.maxZ
                )
            );


        const distanceX =
            nextX -
            closestX;


        const distanceZ =
            nextZ -
            closestZ;


        if (
            distanceX *
                distanceX +
            distanceZ *
                distanceZ <
            radius *
                radius
        ) {

            return;

        }

    }


    player.position.x =
        nextX;


    player.position.z =
        nextZ;

}


// ============================================================
// SWITCH WEAPON
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

    if (
        !gameStarted ||
        reloading
    ) {

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

    showAmmo();


    // Recoil

    weaponRecoil =
        1;


    // Flash

    muzzleFlash();


    // Hit detection

    raycastShoot();


    // Tell server

    if (socket) {

        socket.emit(
            "playerShoot",
            {
                weapon:
                    currentWeapon,

                yaw:
                    yaw,

                pitch:
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
// RAYCAST
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
        ).map(
            p => p.object
        );


    if (
        targets.length ===
        0
    ) {

        return;

    }


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
        target.userData &&
        target.userData.hitbox ===
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


    showHitMarker(
        headshot
    );


    if (socket) {

        socket.emit(
            "playerDamage",
            {
                targetId:
                    target.userData.playerId,

                damage:
                    damage,

                headshot:
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
        ).map(
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


    showHitMarker(
        false
    );


    if (socket) {

        socket.emit(
            "playerDamage",
            {
                targetId:
                    target.userData.playerId,

                damage:
                    100,

                headshot:
                    false,

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

            showAmmo();

        },
        weapon.reloadTime
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
            position:
                "fixed",

            left:
                "50%",

            top:
                "50%",

            width:
                "10px",

            height:
                "10px",

            borderRadius:
                "50%",

            transform:
                "translate(-50%,-50%)",

            background:
                "#fff",

            boxShadow:
                "0 0 25px #fff",

            zIndex:
                "100",

            pointerEvents:
                "none"
        }
    );


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

function showHitMarker(
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
            position:
                "fixed",

            left:
                "50%",

            top:
                "50%",

            transform:
                "translate(-50%,-50%)",

            color:
                headshot
                    ? "#ffd000"
                    : "#ffffff",

            fontSize:
                "28px",

            fontWeight:
                "bold",

            zIndex:
                "100",

            pointerEvents:
                "none"
        }
    );


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


    // ========================================================
    // BODY
    // ========================================================

    const body =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.8,
                1.4,
                0.45
            ),

            new THREE.MeshStandardMaterial({
                color:
                    0x2e86de
            })
        );


    body.position.y =
        0.7;


    body.userData.playerId =
        data.id;


    group.add(
        body
    );


    // ========================================================
    // HEAD
    // ========================================================

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


    head.userData.playerId =
        data.id;


    head.userData.hitbox =
        "head";


    group.add(
        head
    );


    // ========================================================
    // NAME
    // ========================================================

    const username =
        data.username ||
        "Player";


    const tag =
        createNametag(
            username
        );


    tag.position.y =
        2.35;


    group.add(
        tag
    );


    // ========================================================
    // POSITION
    // ========================================================

    group.position.set(
        Number(data.x) || 0,
        Number(data.y) || 0,
        Number(data.z) || 0
    );


    group.rotation.y =
        Number(
            data.rotationY
        ) || 0;


    scene.add(
        group
    );


    remotePlayers[
        data.id
    ] = {

        object:
            group,

        username:
            username

    };


    console.log(
        "Player added:",
        username
    );

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
        512,
        128
    );


    ctx.font =
        "bold 48px Arial";


    ctx.textAlign =
        "center";


    ctx.textBaseline =
        "middle";


    ctx.lineWidth =
        10;


    ctx.strokeStyle =
        "black";


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
            map:
                texture,

            transparent:
                true
        });


    const sprite =
        new THREE.Sprite(
            material
        );


    sprite.scale.set(
        2.6,
        0.65,
        1
    );


    return sprite;

}


// ============================================================
// UPDATE REMOTE PLAYER
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


    delete remotePlayers[
        id
    ];

}


// ============================================================
// SOCKET.IO
// ============================================================

function setupSocket() {

    if (
        typeof io ===
        "undefined"
    ) {

        console.error(
            "Socket.IO was not loaded."
        );

        return;

    }


    socket =
        io();


    // ========================================================
    // CONNECT
    // ========================================================

    socket.on(
        "connect",
        () => {

            console.log(
                "Connected to NovaStrike:",
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


    // ========================================================
    // EXISTING PLAYERS
    // ========================================================

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


    // ========================================================
    // PLAYER JOINED
    // ========================================================

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


    // ========================================================
    // PLAYER MOVED
    // ========================================================

    socket.on(
        "playerMoved",
        data => {

            updateRemotePlayer(
                data
            );

        }
    );


    // ========================================================
    // PLAYER LEFT
    // ========================================================

    socket.on(
        "playerLeft",
        id => {

            removeRemotePlayer(
                id
            );

        }
    );


    // ========================================================
    // DAMAGE
    // ========================================================

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


    // ========================================================
    // KILL
    // ========================================================

    socket.on(
        "killConfirmed",
        data => {

            kills++;

            streak++;

            updateHUD();

        }
    );


    // ========================================================
    // RESPAWN
    // ========================================================

    socket.on(
        "respawn",
        data => {

            if (!player) {
                return;
            }


            player.position.set(
                Number(data.x) || 0,
                Number(data.y) || 1.7,
                Number(data.z) || 5
            );


            velocityY =
                0;


            health =
                Number(
                    data.health
                ) || 100;


            updateHUD();

        }
    );


    // ========================================================
    // PLAYER DIED
    // ========================================================

    socket.on(
        "playerDied",
        data => {

            console.log(
                data?.username ||
                "Player",
                "died."
            );

        }
    );

}


// ============================================================
// USERNAME
// ============================================================

function getUsername() {

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

    streak =
        0;


    updateHUD();


    const deathScreen =
        document.createElement(
            "div"
        );


    deathScreen.textContent =
        "YOU DIED";


    Object.assign(
        deathScreen.style,
        {
            position:
                "fixed",

            left:
                "50%",

            top:
                "40%",

            transform:
                "translate(-50%,-50%)",

            color:
                "white",

            fontSize:
                "48px",

            fontWeight:
                "900",

            textShadow:
                "0 3px 10px black",

            zIndex:
                "200",

            pointerEvents:
                "none"
        }
    );


    document.body.appendChild(
        deathScreen
    );


    setTimeout(
        () => {

            deathScreen.remove();

        },
        2500
    );

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
            Math.min(
                1,
                delta * 15
            )
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
// NETWORK
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


    // ========================================================
    // NAMETAGS ALWAYS FACE CAMERA
    // ========================================================

    Object.values(
        remotePlayers
    ).forEach(
        remote => {

            if (
                !remote.object
            ) {
                return;
            }


            remote.object
                .children
                .forEach(
                    child => {

                        if (
                            child.isSprite
                        ) {

                            child.quaternion.copy(
                                camera.quaternion
                            );

                        }

                    }
                );

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


// ============================================================
// DEBUG
// ============================================================

console.log(
    "NovaStrike game.js loaded successfully."
);
