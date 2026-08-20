import * as THREE from
    "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

/* =========================================================
   NOVASTRIKE
   VISUAL UPGRADE
========================================================= */

let scene;
let camera;
let renderer;
let player;
let socket;

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

const MAP_SIZE = 15;
const TILE_SIZE = 4;
const MAP_WORLD_SIZE = MAP_SIZE * TILE_SIZE;
const MAP_HALF = MAP_WORLD_SIZE / 2;


/* =========================================================
   WEAPONS
========================================================= */

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
        name: "COMBAT KNIFE",
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


/* =========================================================
   START
========================================================= */

window.loadThree = function () {

    if (gameStarted) return;

    gameStarted = true;

    initGame();

};


/* =========================================================
   INIT
========================================================= */

function initGame() {

    scene = new THREE.Scene();

    scene.background =
        new THREE.Color(0x8794a5);


    scene.fog =
        new THREE.Fog(
            0x8794a5,
            45,
            120
        );


    /* =====================================================
       CAMERA
    ===================================================== */

    camera =
        new THREE.PerspectiveCamera(
            75,
            window.innerWidth /
                window.innerHeight,
            0.05,
            1000
        );


    /* =====================================================
       PLAYER
    ===================================================== */

    player =
        new THREE.Object3D();

    player.position.set(
        0,
        1.65,
        5
    );

    player.rotation.order = "YXZ";

    scene.add(player);

    player.add(camera);


    /* =====================================================
       RENDERER
    ===================================================== */

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


    renderer.shadowMap.enabled = true;

    renderer.shadowMap.type =
        THREE.PCFSoftShadowMap;

    renderer.outputColorSpace =
        THREE.SRGBColorSpace;


    renderer.toneMapping =
        THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure =
        1.15;


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


    /* =====================================================
       LIGHTING
    ===================================================== */

    createLighting();


    /* =====================================================
       MAP
    ===================================================== */

    createMap();


    /* =====================================================
       WEAPON
    ===================================================== */

    createWeapon();


    /* =====================================================
       HUD
    ===================================================== */

    createHUD();


    /* =====================================================
       CONTROLS
    ===================================================== */

    setupControls();


    /* =====================================================
       SOCKET
    ===================================================== */

    setupSocket();


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


/* =========================================================
   LIGHTING
========================================================= */

function createLighting() {

    const ambient =
        new THREE.HemisphereLight(
            0xdce9ff,
            0x26303a,
            2.0
        );

    scene.add(ambient);


    const sun =
        new THREE.DirectionalLight(
            0xffffff,
            3
        );


    sun.position.set(
        20,
        35,
        10
    );


    sun.castShadow = true;


    sun.shadow.mapSize.width =
        2048;

    sun.shadow.mapSize.height =
        2048;


    sun.shadow.camera.left =
        -70;

    sun.shadow.camera.right =
        70;

    sun.shadow.camera.top =
        70;

    sun.shadow.camera.bottom =
        -70;


    scene.add(sun);

}


/* =========================================================
   MAP
========================================================= */

function createMap() {

    const size =
        MAP_WORLD_SIZE;


    /* =====================================================
       GROUND
    ===================================================== */

    const groundMaterial =
        new THREE.MeshStandardMaterial({

            color: 0x3d4650,

            roughness: 0.88,

            metalness: 0.05

        });


    const ground =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                size,
                1,
                size
            ),

            groundMaterial

        );


    ground.position.y =
        -0.5;


    ground.receiveShadow = true;


    scene.add(ground);


    /* =====================================================
       FLOOR TILES
    ===================================================== */

    createFloorTiles();


    /* =====================================================
       OUTER WALLS
    ===================================================== */

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


    /* =====================================================
       COVER
    ===================================================== */

    createDetailedWall(
        -18,
        1.5,
        -12,
        8,
        3,
        2
    );


    createDetailedWall(
        18,
        1.5,
        -12,
        8,
        3,
        2
    );


    createDetailedWall(
        -18,
        1.5,
        12,
        8,
        3,
        2
    );


    createDetailedWall(
        18,
        1.5,
        12,
        8,
        3,
        2
    );


    /* =====================================================
       CENTER STRUCTURES
    ===================================================== */

    createDetailedWall(
        -8,
        1.5,
        0,
        3,
        3,
        8
    );


    createDetailedWall(
        8,
        1.5,
        0,
        3,
        3,
        8
    );


    /* =====================================================
       SMALL COVER
    ===================================================== */

    createDetailedWall(
        -15,
        1,
        -5,
        3,
        2,
        3
    );


    createDetailedWall(
        15,
        1,
        5,
        3,
        2,
        3
    );


    createDetailedWall(
        -15,
        1,
        5,
        3,
        2,
        3
    );


    createDetailedWall(
        15,
        1,
        -5,
        3,
        2,
        3
    );

}


/* =========================================================
   FLOOR TILES
========================================================= */

function createFloorTiles() {

    const material =
        new THREE.MeshStandardMaterial({
            color: 0x505a66,
            roughness: 0.95
        });


    for (
        let x = -7;
        x <= 7;
        x++
    ) {

        for (
            let z = -7;
            z <= 7;
            z++
        ) {

            const tile =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        TILE_SIZE - 0.08,
                        0.035,
                        TILE_SIZE - 0.08
                    ),
                    material
                );


            tile.position.set(
                x * TILE_SIZE,
                0.02,
                z * TILE_SIZE
            );


            tile.receiveShadow =
                true;


            scene.add(tile);

        }

    }

}


/* =========================================================
   WALL
========================================================= */

function createWall(
    x,
    y,
    z,
    width,
    height,
    depth
) {

    createDetailedWall(
        x,
        y,
        z,
        width,
        height,
        depth
    );

}


/* =========================================================
   DETAILED WALL
========================================================= */

function createDetailedWall(
    x,
    y,
    z,
    width,
    height,
    depth
) {

    const material =
        new THREE.MeshStandardMaterial({

            color:
                0x596572,

            roughness:
                0.72,

            metalness:
                0.08

        });


    const wall =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                width,
                height,
                depth
            ),

            material

        );


    wall.position.set(
        x,
        y,
        z
    );


    wall.castShadow = true;

    wall.receiveShadow = true;


    scene.add(wall);


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


    /* =====================================================
       TOP EDGE
    ===================================================== */

    const top =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                width + 0.08,
                0.12,
                depth + 0.08
            ),

            new THREE.MeshStandardMaterial({
                color: 0x788594,
                roughness: 0.6
            })

        );


    top.position.set(
        x,
        y + height / 2,
        z
    );


    top.castShadow = true;


    scene.add(top);


    /* =====================================================
       VERTICAL DETAILS
    ===================================================== */

    if (
        width >= 3 &&
        depth >= 2
    ) {

        const stripe =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.08,
                    height - 0.3,
                    depth + 0.02
                ),

                new THREE.MeshStandardMaterial({
                    color: 0x343c46
                })

            );


        stripe.position.set(
            x - width / 3,
            y,
            z
        );


        scene.add(stripe);

    }

}


/* =========================================================
   WEAPON
========================================================= */

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

    }

    else if (
        currentWeapon ===
        "pistol"
    ) {

        createPistol();

    }

    else {

        createKnife();

    }

}


/* =========================================================
   AK-47
========================================================= */

function createAK() {

    const receiverMaterial =
        new THREE.MeshStandardMaterial({

            color:
                0x24282c,

            metalness:
                0.7,

            roughness:
                0.32

        });


    const darkMetal =
        new THREE.MeshStandardMaterial({

            color:
                0x0e1114,

            metalness:
                0.8,

            roughness:
                0.25

        });


    const wood =
        new THREE.MeshStandardMaterial({

            color:
                0x754526,

            roughness:
                0.6

        });


    /* Receiver */

    const receiver =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.68,
                0.28,
                1.05
            ),

            receiverMaterial

        );


    weaponModel.add(receiver);


    /* Barrel */

    const barrel =
        new THREE.Mesh(

            new THREE.CylinderGeometry(
                0.055,
                0.065,
                1.35,
                16
            ),

            darkMetal

        );


    barrel.rotation.z =
        Math.PI / 2;


    barrel.position.z =
        -1.15;


    weaponModel.add(barrel);


    /* Muzzle */

    const muzzle =
        new THREE.Mesh(

            new THREE.CylinderGeometry(
                0.09,
                0.07,
                0.18,
                16
            ),

            darkMetal

        );


    muzzle.rotation.z =
        Math.PI / 2;


    muzzle.position.z =
        -1.83;


    weaponModel.add(muzzle);


    /* Wooden stock */

    const stock =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.28,
                0.3,
                0.85
            ),

            wood

        );


    stock.position.z =
        0.92;


    stock.rotation.y =
        0.02;


    weaponModel.add(stock);


    /* Magazine */

    const magazine =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.26,
                0.65,
                0.35
            ),

            darkMetal

        );


    magazine.position.set(
        0,
        -0.42,
        -0.05
    );


    magazine.rotation.x =
        -0.18;


    weaponModel.add(magazine);


    /* Grip */

    const grip =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.22,
                0.52,
                0.25
            ),

            darkMetal

        );


    grip.position.set(
        0,
        -0.35,
        0.38
    );


    grip.rotation.x =
        -0.25;


    weaponModel.add(grip);


    /* Handguard */

    const handguard =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.32,
                0.23,
                0.7
            ),

            wood

        );


    handguard.position.z =
        -0.7;


    weaponModel.add(handguard);


    /* Front sight */

    const sight =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.07,
                0.17,
                0.09
            ),

            darkMetal

        );


    sight.position.set(
        0,
        0.19,
        -0.75
    );


    weaponModel.add(sight);

}


/* =========================================================
   PISTOL
========================================================= */

function createPistol() {

    const slideMaterial =
        new THREE.MeshStandardMaterial({

            color:
                0x24282d,

            metalness:
                0.75,

            roughness:
                0.28

        });


    const gripMaterial =
        new THREE.MeshStandardMaterial({

            color:
                0x121416,

            roughness:
                0.85

        });


    /* Slide */

    const slide =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.34,
                0.21,
                0.9
            ),

            slideMaterial

        );


    slide.position.y =
        0.08;


    weaponModel.add(slide);


    /* Barrel */

    const barrel =
        new THREE.Mesh(

            new THREE.CylinderGeometry(
                0.045,
                0.045,
                0.55,
                16
            ),

            slideMaterial

        );


    barrel.rotation.z =
        Math.PI / 2;


    barrel.position.z =
        -0.68;


    barrel.position.y =
        0.08;


    weaponModel.add(barrel);


    /* Grip */

    const grip =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.27,
                0.62,
                0.3
            ),

            gripMaterial

        );


    grip.position.set(
        0,
        -0.3,
        0.27
    );


    grip.rotation.x =
        -0.18;


    weaponModel.add(grip);


    /* Magazine */

    const mag =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.17,
                0.42,
                0.19
            ),

            slideMaterial

        );


    mag.position.set(
        0,
        -0.55,
        0.22
    );


    weaponModel.add(mag);


    /* Sights */

    for (
        const x of [-0.08, 0.08]
    ) {

        const sight =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.035,
                    0.08,
                    0.12
                ),

                gripMaterial

            );


        sight.position.set(
            x,
            0.21,
            -0.15
        );


        weaponModel.add(sight);

    }

}


/* =========================================================
   COMBAT KNIFE
========================================================= */

function createKnife() {

    const bladeMaterial =
        new THREE.MeshStandardMaterial({

            color:
                0xbcc7d3,

            metalness:
                0.95,

            roughness:
                0.14

        });


    const dark =
        new THREE.MeshStandardMaterial({

            color:
                0x101317,

            roughness:
                0.75

        });


    const accent =
        new THREE.MeshStandardMaterial({

            color:
                0x56616e,

            metalness:
                0.6,

            roughness:
                0.25

        });


    /* Blade */

    const blade =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.13,
                0.055,
                1.45
            ),

            bladeMaterial

        );


    blade.position.z =
        -0.65;


    blade.rotation.y =
        -0.04;


    weaponModel.add(blade);


    /* Blade tip */

    const tip =
        new THREE.Mesh(

            new THREE.ConeGeometry(
                0.1,
                0.42,
                4
            ),

            bladeMaterial

        );


    tip.rotation.x =
        -Math.PI / 2;


    tip.position.z =
        -1.55;


    weaponModel.add(tip);


    /* Guard */

    const guard =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.48,
                0.1,
                0.13
            ),

            accent

        );


    guard.position.z =
        0.08;


    weaponModel.add(guard);


    /* Handle */

    const handle =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.18,
                0.19,
                0.65
            ),

            dark

        );


    handle.position.z =
        0.45;


    weaponModel.add(handle);


    /* Handle rings */

    for (
        let i = 0;
        i < 3;
        i++
    ) {

        const ring =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.2,
                    0.22,
                    0.06
                ),

                accent

            );


        ring.position.z =
            0.18 +
            i * 0.18;


        weaponModel.add(ring);

    }

}


/* =========================================================
   HUD
========================================================= */

function createHUD() {

    const old =
        document.getElementById(
            "novaHud"
        );

    if (old) old.remove();


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


    document.body.appendChild(hud);


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
                "25px",

            fontWeight:
                "bold",

            textShadow:
                "0 0 5px black"

        }
    );


    hud.appendChild(crosshair);


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


    hud.appendChild(healthUI);


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


    hud.appendChild(weaponUI);


    const ammoPopup =
        document.createElement(
            "div"
        );


    ammoPopup.id =
        "novaAmmoPopup";


    Object.assign(
        ammoPopup.style,
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
                "opacity .2s"

        }
    );


    hud.appendChild(ammoPopup);


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


    hud.appendChild(score);


    const reload =
        document.createElement(
            "div"
        );


    reload.id =
        "novaReload";


    Object.assign(
        reload.style,
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


    hud.appendChild(reload);


    updateHUD();

}


/* =========================================================
   HUD UPDATE
========================================================= */

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
                "COMBAT KNIFE";

        }

        else {

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


/* =========================================================
   AMMO POPUP
========================================================= */

function showAmmo() {

    if (
        currentWeapon ===
        "knife"
    ) return;


    const popup =
        document.getElementById(
            "novaAmmoPopup"
        );


    if (!popup) return;


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


/* =========================================================
   CONTROLS
========================================================= */

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

                switchWeapon("ak");

            }


            if (
                event.code ===
                "Digit2"
            ) {

                switchWeapon("pistol");

            }


            if (
                event.code ===
                "Digit3"
            ) {

                switchWeapon("knife");

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
                    1.66
            ) {

                velocityY =
                    8.5;

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
            ) return;


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
            ) return;


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


/* =========================================================
   MOVEMENT
========================================================= */

function updateMovement(
    delta
) {

    if (!player) return;


    const direction =
        new THREE.Vector3();


    if (keys["KeyW"])
        direction.z -= 1;

    if (keys["KeyS"])
        direction.z += 1;

    if (keys["KeyA"])
        direction.x -= 1;

    if (keys["KeyD"])
        direction.x += 1;


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

        direction.z *
            speed *
            delta
    );


    /* =====================================================
       GRAVITY
    ===================================================== */

    velocityY -=
        25 *
        delta;


    player.position.y +=
        velocityY *
        delta;


    /*
       IMPORTANT:
       Player eye height is 1.65.
       This prevents the player
       from floating above the floor.
    */

    if (
        player.position.y <
        1.65
    ) {

        player.position.y =
            1.65;

        velocityY =
            0;

    }


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


/* =========================================================
   COLLISION
========================================================= */

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
        const wall of
        mapObstacles
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


/* =========================================================
   WEAPON SWITCH
========================================================= */

function switchWeapon(
    weapon
) {

    if (
        !weapons[weapon] ||
        reloading
    ) return;


    currentWeapon =
        weapon;


    createWeapon();

    updateHUD();

}


/* =========================================================
   SHOOT
========================================================= */

function shoot() {

    if (
        !gameStarted ||
        reloading
    ) return;


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
    ) return;


    lastShot =
        now;


    if (
        currentWeapon ===
        "knife"
    ) {

        knifeAttack();

        return;

    }


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


    weaponRecoil = 1;


    muzzleFlash();


    raycastShoot();


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


/* =========================================================
   AUTO FIRE
========================================================= */

function automaticFire() {

    if (
        mouseDown &&
        currentWeapon ===
            "ak"
    ) {

        shoot();

    }

}


/* =========================================================
   RAYCAST
========================================================= */

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


    if (!targets.length)
        return;


    const hits =
        ray.intersectObjects(
            targets,
            true
        );


    if (!hits.length)
        return;


    let target =
        hits[0].object;


    const headshot =
        target.userData &&
        target.userData.hitbox ===
            "head";


    while (
        target &&
        !target.userData.playerId
    ) {

        target =
            target.parent;

    }


    if (!target)
        return;


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


/* =========================================================
   KNIFE
========================================================= */

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


    if (!hits.length)
        return;


    if (
        hits[0].distance >
        3
    ) return;


    let target =
        hits[0].object;


    while (
        target &&
        !target.userData.playerId
    ) {

        target =
            target.parent;

    }


    if (!target)
        return;


    showHitMarker(false);


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


/* =========================================================
   RELOAD
========================================================= */

function reload() {

    if (
        currentWeapon ===
        "knife"
    ) return;


    if (reloading)
        return;


    const weapon =
        weapons[
            currentWeapon
        ];


    if (
        ammo[
            currentWeapon
        ] >=
        weapon.magazine
    ) return;


    reloading = true;


    const ui =
        document.getElementById(
            "novaReload"
        );


    if (ui)
        ui.textContent =
            "RELOADING...";


    setTimeout(
        () => {

            ammo[
                currentWeapon
            ] =
                weapon.magazine;


            reloading =
                false;


            if (ui)
                ui.textContent =
                    "";


            updateHUD();

            showAmmo();

        },
        weapon.reloadTime
    );

}


/* =========================================================
   MUZZLE FLASH
========================================================= */

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
                "12px",

            height:
                "12px",

            borderRadius:
                "50%",

            transform:
                "translate(-50%,-50%)",

            background:
                "white",

            boxShadow:
                "0 0 30px white",

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
        () => flash.remove(),
        45
    );

}


/* =========================================================
   HIT MARKER
========================================================= */

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
                    : "white",

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
        () => marker.remove(),
        150
    );

}


/* =========================================================
   REMOTE PLAYER
========================================================= */

function addRemotePlayer(
    data
) {

    if (
        !data ||
        !data.id
    ) return;


    if (
        socket &&
        data.id ===
            socket.id
    ) return;


    if (
        remotePlayers[
            data.id
        ]
    ) return;


    const group =
        new THREE.Group();


    group.userData.playerId =
        data.id;


    /* =====================================================
       BODY
    ===================================================== */

    const bodyMaterial =
        new THREE.MeshStandardMaterial({
            color:
                0x2878c7,

            roughness:
                0.65
        });


    const body =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.7,
                1.15,
                0.42
            ),

            bodyMaterial

        );


    /*
       Feet start at Y = 0.
       Body center therefore sits
       at Y = 0.575.
    */

    body.position.y =
        0.575;


    body.castShadow = true;

    body.receiveShadow = true;


    body.userData.playerId =
        data.id;


    group.add(body);


    /* =====================================================
       HEAD
    ===================================================== */

    const head =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                0.31,
                20,
                16
            ),

            new THREE.MeshStandardMaterial({
                color:
                    0xf0c59a,

                roughness:
                    0.8
            })

        );


    head.position.y =
        1.43;


    head.castShadow = true;


    head.userData.playerId =
        data.id;


    head.userData.hitbox =
        "head";


    group.add(head);


    /* =====================================================
       EYES
    ===================================================== */

    const eyeMaterial =
        new THREE.MeshBasicMaterial({
            color:
                0x111111
        });


    for (
        const x of [-0.1, 0.1]
    ) {

        const eye =
            new THREE.Mesh(

                new THREE.SphereGeometry(
                    0.035,
                    8,
                    8
                ),

                eyeMaterial

            );


        eye.position.set(
            x,
            1.48,
            -0.29
        );


        group.add(eye);

    }


    /* =====================================================
       LEGS
    ===================================================== */

    const legMaterial =
        new THREE.MeshStandardMaterial({
            color:
                0x202733,

            roughness:
                0.8
        });


    for (
        const x of [-0.19, 0.19]
    ) {

        const leg =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.22,
                    0.75,
                    0.28
                ),

                legMaterial

            );


        leg.position.set(
            x,
            -0.375,
            0
        );


        leg.castShadow = true;


        group.add(leg);

    }


    /* =====================================================
       ARMS
    ===================================================== */

    const armMaterial =
        new THREE.MeshStandardMaterial({
            color:
                0x246eae
        });


    for (
        const x of [-0.48, 0.48]
    ) {

        const arm =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.2,
                    0.85,
                    0.22
                ),

                armMaterial

            );


        arm.position.set(
            x,
            0.62,
            0
        );


        arm.rotation.z =
            x < 0
                ? -0.12
                : 0.12;


        arm.castShadow = true;


        group.add(arm);

    }


    /* =====================================================
       NAME TAG
    ===================================================== */

    const tag =
        createNametag(
            data.username ||
            "Player"
        );


    tag.position.y =
        2.05;


    group.add(tag);


    /* =====================================================
       POSITION
    ===================================================== */

    group.position.set(

        Number(data.x) || 0,

        0,

        Number(data.z) || 0

    );


    group.rotation.y =
        Number(
            data.rotationY
        ) || 0;


    scene.add(group);


    remotePlayers[
        data.id
    ] = {

        object:
            group,

        username:
            data.username ||
            "Player"

    };

}


/* =========================================================
   NAMETAG
========================================================= */

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
        12;


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


    texture.colorSpace =
        THREE.SRGBColorSpace;


    const material =
        new THREE.SpriteMaterial({

            map:
                texture,

            transparent:
                true,

            depthTest:
                false

        });


    const sprite =
        new THREE.Sprite(
            material
        );


    sprite.scale.set(
        2.5,
        0.63,
        1
    );


    return sprite;

}


/* =========================================================
   UPDATE REMOTE PLAYER
========================================================= */

function updateRemotePlayer(
    data
) {

    if (
        !data ||
        !data.id
    ) return;


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


    /*
       Keep players on the floor.
       The server's Y value is not
       used for the character body.
    */

    remote.object.position.x =
        Number(data.x) || 0;


    remote.object.position.z =
        Number(data.z) || 0;


    if (
        typeof data.rotationY ===
        "number"
    ) {

        remote.object.rotation.y =
            data.rotationY;

    }

}


/* =========================================================
   REMOVE PLAYER
========================================================= */

function removeRemotePlayer(
    id
) {

    const remote =
        remotePlayers[id];


    if (!remote)
        return;


    scene.remove(
        remote.object
    );


    delete remotePlayers[id];

}


/* =========================================================
   SOCKET
========================================================= */

function setupSocket() {

    if (
        typeof io ===
        "undefined"
    ) {

        console.error(
            "Socket.IO failed to load."
        );

        return;

    }


    socket =
        io();


    socket.on(
        "connect",
        () => {

            console.log(
                "Connected:",
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


    socket.on(
        "players",
        players => {

            if (!players)
                return;


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


    socket.on(
        "playerMoved",
        data => {

            updateRemotePlayer(
                data
            );

        }
    );


    socket.on(
        "playerLeft",
        id => {

            removeRemotePlayer(
                id
            );

        }
    );


    socket.on(
        "damageTaken",
        data => {

            if (!data)
                return;


            takeDamage(
                Number(
                    data.damage
                ) || 0
            );

        }
    );


    socket.on(
        "killConfirmed",
        () => {

            kills++;

            streak++;

            updateHUD();

        }
    );


    socket.on(
        "respawn",
        data => {

            if (!player)
                return;


            player.position.set(

                Number(data.x) || 0,

                1.65,

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

}


/* =========================================================
   USERNAME
========================================================= */

function getUsername() {

    return (
        localStorage.getItem(
            "novaUsername"
        ) ||
        "Player"
    );

}


/* =========================================================
   SEND POSITION
========================================================= */

function sendPosition() {

    if (
        !socket ||
        !player
    ) return;


    socket.emit(
        "playerMove",
        {

            x:
                player.position.x,

            y:
                0,

            z:
                player.position.z,

            rotationY:
                player.rotation.y,

            username:
                getUsername()

        }
    );

}


/* =========================================================
   DAMAGE
========================================================= */

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


/* =========================================================
   DEATH
========================================================= */

function die() {

    deaths++;

    streak = 0;

    updateHUD();


    const screen =
        document.createElement(
            "div"
        );


    screen.textContent =
        "YOU DIED";


    Object.assign(
        screen.style,
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
        screen
    );


    setTimeout(
        () => screen.remove(),
        2500
    );

}


/* =========================================================
   WEAPON ANIMATION
========================================================= */

function updateWeapon(
    delta
) {

    if (!weaponModel)
        return;


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


/* =========================================================
   NETWORK
========================================================= */

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


/* =========================================================
   GAME LOOP
========================================================= */

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


    /* =====================================================
       NAMETAGS FACE CAMERA
    ===================================================== */

    Object.values(
        remotePlayers
    ).forEach(
        remote => {

            remote.object.children
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


/* =========================================================
   RESIZE
========================================================= */

function resizeGame() {

    if (
        !camera ||
        !renderer
    ) return;


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
    "NovaStrike visual game.js loaded."
);
