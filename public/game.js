import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

/*
============================================================
 NOVASTRIKE
 HIGH VISUAL VERSION
 Only replaces game.js
============================================================
*/

let scene;
let camera;
let renderer;
let player;
let weaponRoot;
let weaponModel;
let socket;

let gameStarted = false;
let lastTime = performance.now();
let networkTimer = 0;
let lastShot = 0;

let yaw = 0;
let pitch = 0;
let velocityY = 0;

let mouseDown = false;
let reloading = false;

let health = 100;
let kills = 0;
let deaths = 0;
let streak = 0;

let currentWeapon = "ak";
let weaponRecoil = 0;
let weaponBob = 0;
let weaponSwayX = 0;
let weaponSwayY = 0;

const keys = {};
const remotePlayers = {};
const obstacles = [];

const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();

const spawnPoints = [
    { x: 0, z: 25 },
    { x: 25, z: 0 },
    { x: 0, z: -25 },
    { x: -25, z: 0 },
    { x: 18, z: 18 },
    { x: -18, z: -18 }
];

const weapons = {
    ak: {
        name: "AK-47",
        damage: 17,
        headshot: 34,
        magazine: 25,
        fireRate: 105,
        reload: 1500,
        automatic: true
    },

    pistol: {
        name: "HANDGUN",
        damage: 20,
        headshot: 40,
        magazine: 12,
        fireRate: 250,
        reload: 1100,
        automatic: false
    },

    knife: {
        name: "COMBAT KNIFE",
        damage: 100,
        headshot: 100,
        magazine: 0,
        fireRate: 450,
        reload: 0,
        automatic: false
    }
};

const ammo = {
    ak: 25,
    pistol: 12
};

/*
============================================================
 PUBLIC START FUNCTION
============================================================
*/

window.loadThree = function () {

    if (gameStarted) return;

    gameStarted = true;

    startGame();
};

/*
============================================================
 START GAME
============================================================
*/

function startGame() {

    createScene();
    createCamera();
    createRenderer();
    createLighting();
    createArena();
    createHUD();
    createLocalPlayer();
    createWeapon();
    setupControls();
    setupSocket();

    window.addEventListener("resize", resize);

    requestAnimationFrame(loop);
}

/*
============================================================
 SCENE
============================================================
*/

function createScene() {

    scene = new THREE.Scene();

    scene.background = new THREE.Color(0x101722);

    scene.fog = new THREE.FogExp2(
        0x101722,
        0.012
    );
}

/*
============================================================
 CAMERA
============================================================
*/

function createCamera() {

    camera = new THREE.PerspectiveCamera(
        78,
        window.innerWidth / window.innerHeight,
        0.03,
        500
    );

    camera.rotation.order = "YXZ";
}

/*
============================================================
 RENDERER
============================================================
*/

function createRenderer() {

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance"
    });

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 2)
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

    renderer.toneMappingExposure = 1.2;

    const screen =
        document.getElementById("game-screen");

    if (screen) {

        screen.style.display = "block";

        screen.appendChild(
            renderer.domElement
        );

    } else {

        document.body.appendChild(
            renderer.domElement
        );
    }
}

/*
============================================================
 LIGHTING
============================================================
*/

function createLighting() {

    const hemi =
        new THREE.HemisphereLight(
            0xaecbff,
            0x10151d,
            1.8
        );

    scene.add(hemi);

    const sun =
        new THREE.DirectionalLight(
            0xffffff,
            3.2
        );

    sun.position.set(
        -30,
        50,
        20
    );

    sun.castShadow = true;

    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;

    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;

    scene.add(sun);

    const blueLight =
        new THREE.PointLight(
            0x2b6cff,
            20,
            35
        );

    blueLight.position.set(
        -20,
        5,
        -20
    );

    scene.add(blueLight);

    const orangeLight =
        new THREE.PointLight(
            0xff6a2b,
            18,
            30
        );

    orangeLight.position.set(
        20,
        5,
        20
    );

    scene.add(orangeLight);
}

/*
============================================================
 MATERIAL HELPERS
============================================================
*/

function material(
    color,
    roughness = 0.75,
    metalness = 0
) {

    return new THREE.MeshStandardMaterial({

        color,
        roughness,
        metalness
    });
}

/*
============================================================
 ARENA
============================================================
*/

function createArena() {

    createGround();

    createGridDetails();

    createOuterWalls();

    createBuildings();

    createCover();

    createLights();

    createSpawnPads();
}

/*
============================================================
 GROUND
============================================================
*/

function createGround() {

    const ground =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                60,
                1,
                60
            ),

            material(
                0x252c35,
                0.95
            )
        );

    ground.position.y = -0.5;

    ground.receiveShadow = true;

    scene.add(ground);
}

/*
============================================================
 FLOOR DETAILS
============================================================
*/

function createGridDetails() {

    const tileMat =
        material(
            0x303944,
            0.9
        );

    const lineMat =
        material(
            0x3f4854,
            0.8
        );

    for (
        let x = -28;
        x <= 28;
        x += 4
    ) {

        for (
            let z = -28;
            z <= 28;
            z += 4
        ) {

            const tile =
                new THREE.Mesh(

                    new THREE.BoxGeometry(
                        3.82,
                        0.04,
                        3.82
                    ),

                    tileMat
                );

            tile.position.set(
                x,
                0.03,
                z
            );

            tile.receiveShadow = true;

            scene.add(tile);
        }
    }

    for (
        let i = -28;
        i <= 28;
        i += 4
    ) {

        const line1 =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.035,
                    0.025,
                    56
                ),

                lineMat
            );

        line1.position.set(
            i,
            0.055,
            0
        );

        scene.add(line1);

        const line2 =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    56,
                    0.025,
                    0.035
                ),

                lineMat
            );

        line2.position.set(
            0,
            0.056,
            i
        );

        scene.add(line2);
    }
}

/*
============================================================
 OUTER WALLS
============================================================
*/

function createOuterWalls() {

    addObstacle(
        0,
        3,
        -30,
        60,
        6,
        1
    );

    addObstacle(
        0,
        3,
        30,
        60,
        6,
        1
    );

    addObstacle(
        -30,
        3,
        0,
        1,
        6,
        60
    );

    addObstacle(
        30,
        3,
        0,
        1,
        6,
        60
    );
}

/*
============================================================
 BUILDINGS
============================================================
*/

function createBuildings() {

    building(
        -20,
        0,
        -18,
        10,
        5,
        7
    );

    building(
        20,
        0,
        -18,
        10,
        5,
        7
    );

    building(
        -20,
        0,
        18,
        10,
        5,
        7
    );

    building(
        20,
        0,
        18,
        10,
        5,
        7
    );

    building(
        0,
        0,
        -19,
        8,
        4,
        6
    );

    building(
        0,
        0,
        19,
        8,
        4,
        6
    );
}

/*
============================================================
 BUILDING
============================================================
*/

function building(
    x,
    y,
    z,
    width,
    height,
    depth
) {

    addObstacle(
        x,
        height / 2,
        z,
        width,
        height,
        depth
    );

    const roof =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                width + 0.3,
                0.18,
                depth + 0.3
            ),

            material(
                0x596573,
                0.55
            )
        );

    roof.position.set(
        x,
        height + 0.1,
        z
    );

    roof.castShadow = true;

    scene.add(roof);

    /*
    Windows
    */

    const windowMat =
        new THREE.MeshStandardMaterial({
            color: 0x101b29,
            roughness: 0.25,
            metalness: 0.3,
            emissive: 0x071421,
            emissiveIntensity: 0.5
        });

    const sides = [
        [-width / 2 - 0.01, 1.7, 0],
        [width / 2 + 0.01, 1.7, 0]
    ];

    for (const s of sides) {

        const win =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.04,
                    1,
                    1.4
                ),

                windowMat
            );

        win.position.set(
            x + s[0],
            s[1],
            z + s[2]
        );

        scene.add(win);
    }
}

/*
============================================================
 COVER
============================================================
*/

function createCover() {

    crate(
        -11,
        1,
        -5
    );

    crate(
        -7,
        1,
        -5
    );

    crate(
        11,
        1,
        5
    );

    crate(
        7,
        1,
        5
    );

    crate(
        -10,
        1.5,
        8,
        3
    );

    crate(
        10,
        1.5,
        -8,
        3
    );

    barrier(
        -8,
        0,
        0
    );

    barrier(
        8,
        0,
        0
    );
}

/*
============================================================
 CRATE
============================================================
*/

function crate(
    x,
    y,
    z,
    size = 2
) {

    const box =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                size,
                size,
                size
            ),

            material(
                0x6c432a,
                0.82
            )
        );

    box.position.set(
        x,
        y,
        z
    );

    box.castShadow = true;
    box.receiveShadow = true;

    scene.add(box);

    const edgeMat =
        material(
            0x2b1b11,
            0.8
        );

    for (
        const axis of [0, 1]
    ) {

        const edge =
            new THREE.Mesh(

                axis === 0
                    ? new THREE.BoxGeometry(
                        size + 0.05,
                        0.1,
                        0.1
                    )
                    : new THREE.BoxGeometry(
                        0.1,
                        size + 0.05,
                        0.1
                    ),

                edgeMat
            );

        edge.position.copy(
            box.position
        );

        edge.position.y +=
            axis === 0
                ? -size / 2 + 0.3
                : 0;

        scene.add(edge);
    }

    obstacles.push({
        minX: x - size / 2,
        maxX: x + size / 2,
        minZ: z - size / 2,
        maxZ: z + size / 2
    });
}

/*
============================================================
 BARRIER
============================================================
*/

function barrier(
    x,
    y,
    z
) {

    addObstacle(
        x,
        1.2,
        z,
        5,
        2.4,
        0.7
    );

    const top =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                5.2,
                0.12,
                0.9
            ),

            material(
                0x707c89,
                0.55,
                0.15
            )
        );

    top.position.set(
        x,
        2.42,
        z
    );

    scene.add(top);
}

/*
============================================================
 GENERIC OBSTACLE
============================================================
*/

function addObstacle(
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

            material(
                0x414b57,
                0.78,
                0.08
            )
        );

    wall.position.set(
        x,
        y,
        z
    );

    wall.castShadow = true;
    wall.receiveShadow = true;

    scene.add(wall);

    obstacles.push({

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

/*
============================================================
 ARENA LIGHTS
============================================================
*/

function createLights() {

    const positions = [
        [-15, 6, -15],
        [15, 6, -15],
        [-15, 6, 15],
        [15, 6, 15]
    ];

    for (const p of positions) {

        const light =
            new THREE.PointLight(
                0x8ab4ff,
                14,
                18
            );

        light.position.set(
            p[0],
            p[1],
            p[2]
        );

        scene.add(light);

        const bulb =
            new THREE.Mesh(

                new THREE.SphereGeometry(
                    0.12,
                    12,
                    12
                ),

                new THREE.MeshBasicMaterial({
                    color: 0x9fc8ff
                })
            );

        bulb.position.copy(
            light.position
        );

        scene.add(bulb);
    }
}

/*
============================================================
 SPAWN PADS
============================================================
*/

function createSpawnPads() {

    for (const spawn of spawnPoints) {

        const pad =
            new THREE.Mesh(

                new THREE.CylinderGeometry(
                    2.2,
                    2.2,
                    0.06,
                    32
                ),

                new THREE.MeshStandardMaterial({

                    color: 0x1e5f9f,

                    emissive: 0x082c58,

                    emissiveIntensity: 1,

                    roughness: 0.4
                })
            );

        pad.position.set(
            spawn.x,
            0.06,
            spawn.z
        );

        scene.add(pad);
    }
}

/*
============================================================
 LOCAL PLAYER
============================================================
*/

function createLocalPlayer() {

    player =
        new THREE.Object3D();

    player.position.set(
        0,
        1.7,
        25
    );

    player.rotation.order =
        "YXZ";

    scene.add(player);

    player.add(camera);

    camera.position.set(
        0,
        0,
        0
    );
}

/*
============================================================
 WEAPON ROOT
============================================================
*/

function createWeapon() {

    if (weaponRoot) {

        camera.remove(
            weaponRoot
        );
    }

    weaponRoot =
        new THREE.Group();

    weaponRoot.position.set(
        0.48,
        -0.48,
        -0.8
    );

    camera.add(
        weaponRoot
    );

    if (currentWeapon === "ak") {

        createAK();

    } else if (
        currentWeapon === "pistol"
    ) {

        createPistol();

    } else {

        createKnife();
    }
}

/*
============================================================
 AK
============================================================
*/

function createAK() {

    weaponModel =
        new THREE.Group();

    const black =
        material(
            0x15191e,
            0.28,
            0.75
        );

    const dark =
        material(
            0x090b0d,
            0.2,
            0.9
        );

    const wood =
        material(
            0x6e3e21,
            0.65
        );

    /*
    Receiver
    */

    addPart(
        new THREE.BoxGeometry(
            0.55,
            0.25,
            0.95
        ),
        black,
        0,
        0,
        0
    );

    /*
    Barrel
    */

    addPart(
        new THREE.CylinderGeometry(
            0.045,
            0.055,
            1.25,
            16
        ),
        dark,
        0,
        0,
        -1.05,
        0,
        0,
        Math.PI / 2
    );

    /*
    Muzzle
    */

    addPart(
        new THREE.CylinderGeometry(
            0.09,
            0.06,
            0.2,
            16
        ),
        dark,
        0,
        0,
        -1.68,
        0,
        0,
        Math.PI / 2
    );

    /*
    Handguard
    */

    addPart(
        new THREE.BoxGeometry(
            0.35,
            0.22,
            0.65
        ),
        wood,
        0,
        0,
        -0.62
    );

    /*
    Stock
    */

    addPart(
        new THREE.BoxGeometry(
            0.3,
            0.25,
            0.7
        ),
        wood,
        0,
        0,
        0.8
    );

    /*
    Magazine
    */

    const mag =
        addPart(
            new THREE.BoxGeometry(
                0.25,
                0.65,
                0.32
            ),
            dark,
            0,
            -0.4,
            -0.05
        );

    mag.rotation.x =
        -0.18;

    /*
    Grip
    */

    const grip =
        addPart(
            new THREE.BoxGeometry(
                0.22,
                0.5,
                0.25
            ),
            dark,
            0,
            -0.32,
            0.35
        );

    grip.rotation.x =
        -0.2;

    /*
    Sight
    */

    addPart(
        new THREE.BoxGeometry(
            0.07,
            0.16,
            0.1
        ),
        dark,
        0,
        0.17,
        -0.45
    );

    weaponRoot.add(
        weaponModel
    );
}

/*
============================================================
 PISTOL
============================================================
*/

function createPistol() {

    weaponModel =
        new THREE.Group();

    const metal =
        material(
            0x20252b,
            0.24,
            0.8
        );

    const gripMat =
        material(
            0x101216,
            0.85
        );

    addPart(
        new THREE.BoxGeometry(
            0.32,
            0.2,
            0.8
        ),
        metal,
        0,
        0.08,
        -0.05
    );

    addPart(
        new THREE.CylinderGeometry(
            0.045,
            0.045,
            0.5,
            12
        ),
        metal,
        0,
        0.08,
        -0.65,
        0,
        0,
        Math.PI / 2
    );

    const grip =
        addPart(
            new THREE.BoxGeometry(
                0.26,
                0.6,
                0.28
            ),
            gripMat,
            0,
            -0.27,
            0.25
        );

    grip.rotation.x =
        -0.16;

    addPart(
        new THREE.BoxGeometry(
            0.17,
            0.4,
            0.18
        ),
        metal,
        0,
        -0.54,
        0.23
    );

    weaponRoot.add(
        weaponModel
    );
}

/*
============================================================
 KNIFE
============================================================
*/

function createKnife() {

    weaponModel =
        new THREE.Group();

    const blade =
        material(
            0xc5d0dc,
            0.12,
            0.95
        );

    const dark =
        material(
            0x11151a,
            0.7
        );

    const edge =
        material(
            0x5c6978,
            0.22,
            0.75
        );

    addPart(
        new THREE.BoxGeometry(
            0.12,
            0.05,
            1.35
        ),
        blade,
        0,
        0,
        -0.7
    );

    const tip =
        addPart(
            new THREE.ConeGeometry(
                0.09,
                0.38,
                4
            ),
            blade,
            0,
            0,
            -1.57
        );

    tip.rotation.x =
        -Math.PI / 2;

    addPart(
        new THREE.BoxGeometry(
            0.45,
            0.08,
            0.12
        ),
        edge,
        0,
        0,
        0.05
    );

    addPart(
        new THREE.BoxGeometry(
            0.18,
            0.18,
            0.62
        ),
        dark,
        0,
        0,
        0.42
    );

    for (
        let i = 0;
        i < 3;
        i++
    ) {

        addPart(
            new THREE.BoxGeometry(
                0.2,
                0.2,
                0.05
            ),
            edge,
            0,
            0,
            0.18 + i * 0.18
        );
    }

    weaponRoot.add(
        weaponModel
    );
}

/*
============================================================
 WEAPON PART
============================================================
*/

function addPart(
    geometry,
    mat,
    x,
    y,
    z,
    rx = 0,
    ry = 0,
    rz = 0
) {

    const part =
        new THREE.Mesh(
            geometry,
            mat
        );

    part.position.set(
        x,
        y,
        z
    );

    part.rotation.set(
        rx,
        ry,
        rz
    );

    part.castShadow = true;

    weaponModel.add(
        part
    );

    return part;
}

/*
============================================================
 HUD
============================================================
*/

function createHUD() {

    const old =
        document.getElementById(
            "novaEnhancedHUD"
        );

    if (old) old.remove();

    const hud =
        document.createElement("div");

    hud.id =
        "novaEnhancedHUD";

    Object.assign(
        hud.style,
        {
            position: "fixed",
            inset: "0",
            pointerEvents: "none",
            zIndex: "100",
            fontFamily:
                "Arial, sans-serif",
            color: "white"
        }
    );

    document.body.appendChild(
        hud
    );

    /*
    Crosshair
    */

    const cross =
        document.createElement("div");

    cross.id =
        "novaCrosshair";

    cross.innerHTML =
        `<span></span><span></span><span></span><span></span>`;

    Object.assign(
        cross.style,
        {
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "24px",
            height: "24px",
            transform:
                "translate(-50%,-50%)"
        }
    );

    hud.appendChild(cross);

    for (
        const child of
        cross.children
    ) {

        Object.assign(
            child.style,
            {
                position: "absolute",
                width: "7px",
                height: "2px",
                background: "white",
                boxShadow:
                    "0 0 4px black"
            }
        );
    }

    cross.children[0].style.left =
        "0";

    cross.children[0].style.top =
        "11px";

    cross.children[1].style.right =
        "0";

    cross.children[1].style.top =
        "11px";

    cross.children[2].style.left =
        "11px";

    cross.children[2].style.top =
        "0";

    cross.children[2].style.transform =
        "rotate(90deg)";

    cross.children[3].style.left =
        "11px";

    cross.children[3].style.bottom =
        "0";

    cross.children[3].style.transform =
        "rotate(90deg)";

    /*
    Health
    */

    const healthBox =
        document.createElement("div");

    healthBox.id =
        "novaHealthBox";

    Object.assign(
        healthBox.style,
        {
            position: "absolute",
            left: "25px",
            bottom: "25px",
            fontSize: "24px",
            fontWeight: "900",
            textShadow:
                "0 2px 8px black"
        }
    );

    hud.appendChild(
        healthBox
    );

    /*
    Weapon
    */

    const weaponBox =
        document.createElement("div");

    weaponBox.id =
        "novaWeaponBox";

    Object.assign(
        weaponBox.style,
        {
            position: "absolute",
            right: "28px",
            bottom: "25px",
            textAlign: "right",
            fontWeight: "900",
            textShadow:
                "0 2px 8px black"
        }
    );

    hud.appendChild(
        weaponBox
    );

    /*
    Score
    */

    const score =
        document.createElement("div");

    score.id =
        "novaScoreBox";

    Object.assign(
        score.style,
        {
            position: "absolute",
            right: "28px",
            top: "20px",
            textAlign: "right",
            fontSize: "17px",
            lineHeight: "1.5",
            fontWeight: "800",
            textShadow:
                "0 2px 8px black"
        }
    );

    hud.appendChild(
        score
    );

    /*
    Reload
    */

    const reload =
        document.createElement("div");

    reload.id =
        "novaReloadBox";

    Object.assign(
        reload.style,
        {
            position: "absolute",
            left: "50%",
            bottom: "23%",
            transform:
                "translateX(-50%)",
            fontSize: "22px",
            fontWeight: "900",
            textShadow:
                "0 2px 8px black"
        }
    );

    hud.appendChild(
        reload
    );

    /*
    Kill feed
    */

    const feed =
        document.createElement("div");

    feed.id =
        "novaKillFeed";

    Object.assign(
        feed.style,
        {
            position: "absolute",
            right: "25px",
            top: "105px",
            width: "300px",
            textAlign: "right"
        }
    );

    hud.appendChild(
        feed
    );

    updateHUD();
}

/*
============================================================
 HUD UPDATE
============================================================
*/

function updateHUD() {

    const h =
        document.getElementById(
            "novaHealthBox"
        );

    const w =
        document.getElementById(
            "novaWeaponBox"
        );

    const s =
        document.getElementById(
            "novaScoreBox"
        );

    if (h) {

        h.innerHTML =
            `♥ ${Math.max(
                0,
                health
            )} HP`;
    }

    if (w) {

        if (
            currentWeapon ===
            "knife"
        ) {

            w.innerHTML =
                `<div style="
                    font-size:18px;
                    opacity:.8;
                ">COMBAT KNIFE</div>`;

        } else {

            w.innerHTML =
                `<div style="
                    font-size:18px;
                    opacity:.8;
                ">${weapons[
                    currentWeapon
                ].name}</div>
                <div style="
                    font-size:34px;
                ">${ammo[
                    currentWeapon
                ]} <span style="
                    opacity:.65;
                ">/ ∞</span></div>`;
        }
    }

    if (s) {

        s.innerHTML =
            `KILLS ${kills}<br>
             DEATHS ${deaths}<br>
             STREAK ${streak}`;
    }
}

/*
============================================================
 CONTROLS
============================================================
*/

function setupControls() {

    document.addEventListener(
        "keydown",
        e => {

            keys[e.code] = true;

            if (
                e.code === "Digit1"
            ) switchWeapon("ak");

            if (
                e.code === "Digit2"
            ) switchWeapon("pistol");

            if (
                e.code === "Digit3"
            ) switchWeapon("knife");

            if (
                e.code === "KeyR"
            ) reload();

            if (
                e.code === "Space" &&
                player &&
                player.position.y <=
                    1.72
            ) {

                velocityY = 8.5;
            }
        }
    );

    document.addEventListener(
        "keyup",
        e => {

            keys[e.code] = false;
        }
    );

    document.addEventListener(
        "mousedown",
        e => {

            if (e.button !== 0)
                return;

            mouseDown = true;

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
        e => {

            if (e.button === 0)
                mouseDown = false;
        }
    );

    document.addEventListener(
        "mousemove",
        e => {

            if (
                document.pointerLockElement !==
                    renderer.domElement
            ) return;

            yaw -=
                e.movementX * 0.002;

            pitch -=
                e.movementY * 0.002;

            pitch =
                Math.max(
                    -1.5,
                    Math.min(
                        1.5,
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

/*
============================================================
 MOVEMENT
============================================================
*/

function updateMovement(
    delta
) {

    if (!player)
        return;

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

    const moving =
        direction.lengthSq() > 0;

    if (moving)
        direction.normalize();

    direction.applyAxisAngle(
        new THREE.Vector3(
            0,
            1,
            0
        ),
        yaw
    );

    let speed = 7;

    if (
        keys["ShiftLeft"] ||
        keys["ShiftRight"]
    ) {

        speed = 10;
    }

    moveWithCollision(
        direction.x *
            speed *
            delta,

        direction.z *
            speed *
            delta
    );

    /*
    Jump / gravity
    */

    velocityY -=
        25 * delta;

    player.position.y +=
        velocityY * delta;

    if (
        player.position.y <
        1.7
    ) {

        player.position.y =
            1.7;

        velocityY = 0;
    }

    /*
    Weapon movement
    */

    if (moving) {

        weaponBob +=
            delta *
            speed *
            1.5;

    } else {

        weaponBob *=
            0.9;
    }

    /*
    Camera breathing
    */

    const bob =
        moving
            ? Math.sin(
                weaponBob
            ) * 0.012
            : 0;

    camera.position.y =
        bob;

}

/*
============================================================
 COLLISION
============================================================
*/

function moveWithCollision(
    dx,
    dz
) {

    const radius = 0.5;

    let nextX =
        player.position.x + dx;

    let nextZ =
        player.position.z + dz;

    for (
        const wall of obstacles
    ) {

        const cx =
            Math.max(
                wall.minX,
                Math.min(
                    nextX,
                    wall.maxX
                )
            );

        const cz =
            Math.max(
                wall.minZ,
                Math.min(
                    nextZ,
                    wall.maxZ
                )
            );

        const ax =
            nextX - cx;

        const az =
            nextZ - cz;

        if (
            ax * ax +
            az * az <
            radius * radius
        ) {

            return;
        }
    }

    player.position.x =
        THREE.MathUtils.clamp(
            nextX,
            -29,
            29
        );

    player.position.z =
        THREE.MathUtils.clamp(
            nextZ,
            -29,
            29
        );
}

/*
============================================================
 SWITCH WEAPON
============================================================
*/

function switchWeapon(
    weapon
) {

    if (
        reloading ||
        !weapons[weapon]
    ) return;

    currentWeapon =
        weapon;

    createWeapon();

    updateHUD();
}

/*
============================================================
 SHOOT
============================================================
*/

function shoot() {

    if (
        reloading ||
        !gameStarted
    ) return;

    const weapon =
        weapons[
            currentWeapon
        ];

    const now =
        performance.now();

    if (
        now - lastShot <
        weapon.fireRate
    ) return;

    lastShot = now;

    if (
        currentWeapon !==
        "knife"
    ) {

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

        showAmmo();

        createMuzzleFlash();

        createShell();

        weaponRecoil = 1;

        weaponSwayY -=
            0.035;

        raycastDamage();

    } else {

        knifeAttack();
    }
}

/*
============================================================
 AUTO FIRE
============================================================
*/

function automaticFire() {

    if (
        mouseDown &&
        currentWeapon ===
            "ak"
    ) {

        shoot();
    }
}

/*
============================================================
 RAYCAST
============================================================
*/

function raycastDamage() {

    raycaster.setFromCamera(
        new THREE.Vector2(0, 0),
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
        raycaster.intersectObjects(
            targets,
            true
        );

    if (!hits.length)
        return;

    let object =
        hits[0].object;

    const distance =
        hits[0].distance;

    if (distance > 150)
        return;

    let headshot =
        object.userData.hitbox ===
        "head";

    while (
        object &&
        !object.userData.playerId
    ) {

        object = object.parent;
    }

    if (!object)
        return;

    const weapon =
        weapons[
            currentWeapon
        ];

    const damage =
        headshot
            ? weapon.headshot
            : weapon.damage;

    createHitMarker(
        headshot
    );

    if (socket) {

        socket.emit(
            "playerDamage",
            {
                targetId:
                    object.userData.playerId,

                damage,

                headshot,

                weapon:
                    currentWeapon
            }
        );
    }
}

/*
============================================================
 KNIFE
============================================================
*/

function knifeAttack() {

    raycaster.setFromCamera(
        new THREE.Vector2(0, 0),
        camera
    );

    const targets =
        Object.values(
            remotePlayers
        ).map(
            p => p.object
        );

    const hits =
        raycaster.intersectObjects(
            targets,
            true
        );

    if (!hits.length)
        return;

    if (
        hits[0].distance >
        3
    ) return;

    let object =
        hits[0].object;

    while (
        object &&
        !object.userData.playerId
    ) {

        object =
            object.parent;
    }

    if (!object)
        return;

    weaponRecoil = 0.6;

    createHitMarker(false);

    if (socket) {

        socket.emit(
            "playerDamage",
            {
                targetId:
                    object.userData.playerId,

                damage: 100,

                headshot: false,

                weapon: "knife"
            }
        );
    }
}

/*
============================================================
 RELOAD
============================================================
*/

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

    const box =
        document.getElementById(
            "novaReloadBox"
        );

    if (box)
        box.textContent =
            "RELOADING...";

    weaponRoot.rotation.x =
        -0.5;

    setTimeout(
        () => {

            ammo[
                currentWeapon
            ] =
                weapon.magazine;

            reloading = false;

            weaponRoot.rotation.x =
                0;

            if (box)
                box.textContent = "";

            updateHUD();

        },
        weapon.reload
    );
}

/*
============================================================
 AMMO POPUP
============================================================
*/

function showAmmo() {

    updateHUD();

    const popup =
        document.createElement(
            "div"
        );

    popup.textContent =
        `${ammo[
            currentWeapon
        ]} / ∞`;

    Object.assign(
        popup.style,
        {
            position: "fixed",
            right: "30px",
            bottom: "110px",
            fontSize: "28px",
            fontWeight: "900",
            color: "white",
            textShadow:
                "0 2px 8px black",
            pointerEvents:
                "none",
            zIndex: "150"
        }
    );

    document.body.appendChild(
        popup
    );

    setTimeout(
        () => popup.remove(),
        500
    );
}

/*
============================================================
 MUZZLE FLASH
============================================================
*/

function createMuzzleFlash() {

    const flash =
        new THREE.PointLight(
            0xffcc66,
            8,
            4
        );

    flash.position.set(
        0,
        0,
        -1.7
    );

    weaponRoot.add(
        flash
    );

    setTimeout(
        () => {

            weaponRoot.remove(
                flash
            );

        },
        45
    );

    /*
    3D flash
    */

    const mesh =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                0.12,
                8,
                8
            ),

            new THREE.MeshBasicMaterial({
                color:
                    0xffdd88
            })
        );

    mesh.position.set(
        0,
        0,
        -1.7
    );

    weaponRoot.add(
        mesh
    );

    setTimeout(
        () => {

            weaponRoot.remove(
                mesh
            );

        },
        45
    );
}

/*
============================================================
 SHELL CASING
============================================================
*/

function createShell() {

    if (
        currentWeapon ===
        "knife"
    ) return;

    const shell =
        new THREE.Mesh(

            new THREE.CylinderGeometry(
                0.025,
                0.025,
                0.12,
                8
            ),

            material(
                0xd49b32,
                0.3,
                0.8
            )
        );

    shell.position.copy(
        player.position
    );

    shell.position.y -=
        0.15;

    shell.position.x +=
        0.25;

    scene.add(shell);

    const velocity =
        new THREE.Vector3(
            0.8,
            1.5,
            0.2
        );

    const start =
        performance.now();

    function animateShell() {

        const elapsed =
            (performance.now() -
                start) /
            1000;

        shell.position.x +=
            velocity.x *
            0.03;

        shell.position.y +=
            velocity.y *
            0.03 -
            0.04 *
            elapsed;

        shell.position.z +=
            velocity.z *
            0.03;

        shell.rotation.x +=
            0.2;

        if (
            elapsed < 0.8
        ) {

            requestAnimationFrame(
                animateShell
            );

        } else {

            scene.remove(
                shell
            );
        }
    }

    animateShell();
}

/*
============================================================
 HIT MARKER
============================================================
*/

function createHitMarker(
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
            fontSize:
                headshot
                    ? "34px"
                    : "26px",
            fontWeight: "900",
            color:
                headshot
                    ? "#ffd329"
                    : "white",
            textShadow:
                "0 2px 8px black",
            pointerEvents:
                "none",
            zIndex: "200"
        }
    );

    document.body.appendChild(
        marker
    );

    setTimeout(
        () => marker.remove(),
        180
    );
}

/*
============================================================
 REMOTE PLAYER
============================================================
*/

function createRemotePlayer(
    data
) {

    if (
        !data ||
        !data.id ||
        (
            socket &&
            data.id ===
                socket.id
        )
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

    /*
    BODY
    */

    const body =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.7,
                1.05,
                0.42
            ),

            material(
                0x2274c4,
                0.65
            )
        );

    body.position.y =
        1.0;

    body.castShadow = true;

    body.userData.playerId =
        data.id;

    group.add(body);

    /*
    HEAD
    */

    const head =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                0.3,
                20,
                16
            ),

            material(
                0xe6b789,
                0.75
            )
        );

    head.position.y =
        1.72;

    head.castShadow = true;

    head.userData.playerId =
        data.id;

    head.userData.hitbox =
        "head";

    group.add(head);

    /*
    LEGS
    */

    const legMat =
        material(
            0x171c25,
            0.8
        );

    for (
        const x of [-0.19, 0.19]
    ) {

        const leg =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.23,
                    0.75,
                    0.28
                ),

                legMat
            );

        leg.position.set(
            x,
            0.38,
            0
        );

        leg.castShadow = true;

        group.add(leg);
    }

    /*
    ARMS
    */

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

                material(
                    0x1d66aa,
                    0.7
                )
            );

        arm.position.set(
            x,
            1.0,
            0
        );

        arm.rotation.z =
            x < 0
                ? -0.12
                : 0.12;

        arm.castShadow = true;

        group.add(arm);
    }

    /*
    PLAYER GUN
    */

    const gun =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                0.12,
                0.12,
                0.7
            ),

            material(
                0x111419,
                0.3,
                0.8
            )
        );

    gun.position.set(
        0,
        1.0,
        -0.48
    );

    group.add(gun);

    /*
    NAMETAG
    */

    const tag =
        createNameTag(
            data.username ||
            "Player"
        );

    tag.position.y =
        2.35;

    group.add(tag);

    /*
    POSITION
    */

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
        object: group,
        username:
            data.username ||
            "Player",
        lastX:
            group.position.x,
        lastZ:
            group.position.z
    };
}

/*
============================================================
 NAMETAG
============================================================
*/

function createNameTag(
    text
) {

    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width = 512;
    canvas.height = 128;

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
        14;

    ctx.strokeStyle =
        "rgba(0,0,0,.9)";

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

    const sprite =
        new THREE.Sprite(

            new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: false
            })
        );

    sprite.scale.set(
        2.7,
        0.68,
        1
    );

    return sprite;
}

/*
============================================================
 UPDATE REMOTE PLAYER
============================================================
*/

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

        createRemotePlayer(
            data
        );

        return;
    }

    const remote =
        remotePlayers[
            data.id
        ];

    remote.lastX =
        remote.object.position.x;

    remote.lastZ =
        remote.object.position.z;

    remote.object.position.x =
        Number(data.x) || 0;

    remote.object.position.z =
        Number(data.z) || 0;

    remote.object.rotation.y =
        Number(
            data.rotationY
        ) || 0;
}

/*
============================================================
 REMOVE PLAYER
============================================================
*/

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

/*
============================================================
 SOCKET
============================================================
*/

function setupSocket() {

    if (
        typeof io ===
        "undefined"
    ) {

        console.error(
            "Socket.IO unavailable."
        );

        return;
    }

    socket = io();

    socket.on(
        "connect",
        () => {

            console.log(
                "NovaStrike connected:",
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

                        createRemotePlayer({

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

            createRemotePlayer(
                data
            );
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

            showKillFeed(
                "ELIMINATION"
            );
        }
    );

    socket.on(
        "respawn",
        data => {

            respawn(
                data
            );
        }
    );
}

/*
============================================================
 USERNAME
============================================================
*/

function getUsername() {

    return (
        localStorage.getItem(
            "novaUsername"
        ) ||
        "Player"
    );
}

/*
============================================================
 SEND POSITION
============================================================
*/

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

/*
============================================================
 DAMAGE
============================================================
*/

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

    createDamageFlash();

    updateHUD();

    if (
        health <=
        0
    ) {

        die();
    }
}

/*
============================================================
 DAMAGE FLASH
============================================================
*/

function createDamageFlash() {

    const flash =
        document.createElement(
            "div"
        );

    Object.assign(
        flash.style,
        {
            position: "fixed",
            inset: "0",
            background:
                "rgba(255,0,0,.22)",
            pointerEvents:
                "none",
            zIndex: "180"
        }
    );

    document.body.appendChild(
        flash
    );

    setTimeout(
        () => flash.remove(),
        120
    );
}

/*
============================================================
 DEATH
============================================================
*/

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
            inset: "0",
            display: "flex",
            alignItems: "center",
            justifyContent:
                "center",
            background:
                "rgba(0,0,0,.4)",
            color: "white",
            fontSize: "55px",
            fontWeight: "900",
            textShadow:
                "0 3px 15px black",
            pointerEvents:
                "none",
            zIndex: "300"
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
        1800
    );
}

/*
============================================================
 RESPAWN
============================================================
*/

function respawn(
    data
) {

    if (!player)
        return;

    const spawn =
        spawnPoints[
            Math.floor(
                Math.random() *
                spawnPoints.length
            )
        ];

    player.position.set(
        data &&
        Number.isFinite(
            Number(data.x)
        )
            ? Number(data.x)
            : spawn.x,

        1.7,

        data &&
        Number.isFinite(
            Number(data.z)
        )
            ? Number(data.z)
            : spawn.z
    );

    velocityY = 0;

    health = 100;

    updateHUD();
}

/*
============================================================
 KILL FEED
============================================================
*/

function showKillFeed(
    text
) {

    const feed =
        document.getElementById(
            "novaKillFeed"
        );

    if (!feed)
        return;

    const item =
        document.createElement(
            "div"
        );

    item.textContent =
        "⚡ " + text;

    Object.assign(
        item.style,
        {
            marginBottom: "8px",
            padding: "8px 12px",
            background:
                "rgba(0,0,0,.45)",
            borderRadius: "5px",
            fontWeight: "900"
        }
    );

    feed.appendChild(
        item
    );

    setTimeout(
        () => item.remove(),
        2500
    );
}

/*
============================================================
 WEAPON ANIMATION
============================================================
*/

function updateWeapon(
    delta
) {

    if (!weaponRoot)
        return;

    weaponRecoil =
        THREE.MathUtils.lerp(
            weaponRecoil,
            0,
            delta * 13
        );

    weaponSwayY =
        THREE.MathUtils.lerp(
            weaponSwayY,
            0,
            delta * 8
        );

    const bobX =
        Math.cos(
            weaponBob
        ) * 0.012;

    const bobY =
        Math.abs(
            Math.sin(
                weaponBob
            )
        ) * 0.012;

    weaponRoot.position.x =
        0.48 +
        bobX +
        weaponSwayX;

    weaponRoot.position.y =
        -0.48 +
        bobY;

    weaponRoot.position.z =
        -0.8 +
        weaponRecoil *
        0.12;

    weaponRoot.rotation.x =
        -weaponRecoil *
        0.12;

    weaponRoot.rotation.y =
        weaponSwayY;
}

/*
============================================================
 REMOTE PLAYER ANIMATION
============================================================
*/

function animateRemotePlayers(
    delta
) {

    for (
        const remote of
        Object.values(
            remotePlayers
        )
    ) {

        const object =
            remote.object;

        const dx =
            object.position.x -
            remote.lastX;

        const dz =
            object.position.z -
            remote.lastZ;

        const moving =
            Math.abs(dx) +
            Math.abs(dz) >
            0.01;

        if (moving) {

            object.position.y =
                Math.sin(
                    performance.now() *
                    0.01
                ) *
                0.025;
        } else {

            object.position.y =
                THREE.MathUtils.lerp(
                    object.position.y,
                    0,
                    delta * 8
                );
        }

        /*
        Make nametag face camera
        */

        for (
            const child of
            object.children
        ) {

            if (
                child.isSprite
            ) {

                child.quaternion.copy(
                    camera.quaternion
                );
            }
        }

        remote.lastX =
            object.position.x;

        remote.lastZ =
            object.position.z;
    }
}

/*
============================================================
 NETWORK
============================================================
*/

function networkUpdate(
    delta
) {

    networkTimer +=
        delta;

    if (
        networkTimer >=
        0.05
    ) {

        networkTimer = 0;

        sendPosition();
    }
}

/*
============================================================
 LOOP
============================================================
*/

function loop(
    time
) {

    requestAnimationFrame(
        loop
    );

    const delta =
        Math.min(
            (time - lastTime) /
                1000,
            0.05
        );

    lastTime = time;

    updateMovement(
        delta
    );

    automaticFire();

    updateWeapon(
        delta
    );

    animateRemotePlayers(
        delta
    );

    networkUpdate(
        delta
    );

    renderer.render(
        scene,
        camera
    );
}

/*
============================================================
 RESIZE
============================================================
*/

function resize() {

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
    "%cNovaStrike loaded",
    "font-size:20px;font-weight:bold"
);
