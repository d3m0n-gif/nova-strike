import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

/*
============================================================
 NOVASTRIKE - FULL GAME.JS
============================================================
 - Solid upper floors
 - Working stairs
 - Working ladders
 - Solid walls, roofs, crates and cover
 - Bullets blocked by map objects
 - Remote players + nametags
 - Instant respawn
 - 2 second spawn protection
 - Fortnite-style ammo display
 - AK-47: 17 body / 34 head
 - Pistol: 20 body / 40 head
 - Knife: 100 damage
 - AK "FAHHHHH!" voice
============================================================
*/

let scene, camera, renderer, player, weaponRoot, weaponModel, socket;

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

let isDead = false;
let respawnProtection = false;

let speechCooldown = 0;

const keys = {};
const remotePlayers = {};

const obstacles = [];
const floorSurfaces = [];
const ladders = [];

const raycaster = new THREE.Raycaster();

const PLAYER_RADIUS = 0.42;
const PLAYER_HEIGHT = 1.7;
const GRAVITY = 25;
const JUMP = 8.5;

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
        reload: 1500
    },

    pistol: {
        name: "HANDGUN",
        damage: 20,
        headshot: 40,
        magazine: 12,
        fireRate: 250,
        reload: 1100
    },

    knife: {
        name: "COMBAT KNIFE",
        damage: 100,
        headshot: 100,
        magazine: 0,
        fireRate: 450,
        reload: 0
    }
};

const ammo = {
    ak: 25,
    pistol: 12
};

/*
============================================================
 START
============================================================
*/

window.loadThree = function () {

    if (gameStarted) return;

    gameStarted = true;

    startGame();
};

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

    window.addEventListener(
        "resize",
        resize
    );

    requestAnimationFrame(loop);
}

/*
============================================================
 SCENE
============================================================
*/

function createScene() {

    scene = new THREE.Scene();

    scene.background =
        new THREE.Color(
            0x0d1420
        );

    scene.fog =
        new THREE.FogExp2(
            0x0d1420,
            0.009
        );
}

/*
============================================================
 CAMERA
============================================================
*/

function createCamera() {

    camera =
        new THREE.PerspectiveCamera(
            78,
            window.innerWidth /
                window.innerHeight,
            0.03,
            500
        );

    camera.rotation.order =
        "YXZ";
}

/*
============================================================
 RENDERER
============================================================
*/

function createRenderer() {

    renderer =
        new THREE.WebGLRenderer({
            antialias: true,
            powerPreference:
                "high-performance"
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

    renderer.shadowMap.enabled =
        true;

    renderer.shadowMap.type =
        THREE.PCFSoftShadowMap;

    renderer.outputColorSpace =
        THREE.SRGBColorSpace;

    renderer.toneMapping =
        THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure =
        1.15;

    const screen =
        document.getElementById(
            "game-screen"
        );

    if (screen) {

        screen.style.display =
            "block";

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
            0xb7d4ff,
            0x111722,
            1.8
        );

    scene.add(hemi);

    const sun =
        new THREE.DirectionalLight(
            0xffffff,
            3.1
        );

    sun.position.set(
        -35,
        55,
        25
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

    const blue =
        new THREE.PointLight(
            0x276eff,
            18,
            35
        );

    blue.position.set(
        -20,
        5,
        -20
    );

    scene.add(blue);

    const orange =
        new THREE.PointLight(
            0xff632d,
            18,
            35
        );

    orange.position.set(
        20,
        5,
        20
    );

    scene.add(orange);
}

/*
============================================================
 MATERIAL
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

    createFloorTiles();

    createOuterWalls();

    createBuildings();

    createCover();

    createArenaLights();

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
                0x222a34,
                0.96
            )
        );

    ground.position.y =
        -0.5;

    ground.receiveShadow =
        true;

    scene.add(ground);

    addFloorSurface(
        0,
        0,
        0,
        60,
        60,
        1
    );
}

function addFloorSurface(
    x,
    y,
    z,
    width,
    depth,
    height = 0.25
) {

    floorSurfaces.push({

        minX:
            x - width / 2,

        maxX:
            x + width / 2,

        minZ:
            z - depth / 2,

        maxZ:
            z + depth / 2,

        top:
            y + height / 2
    });
}

/*
============================================================
 FLOOR TILES
============================================================
*/

function createFloorTiles() {

    const tileMaterial =
        material(
            0x303944,
            0.9
        );

    const lineMaterial =
        material(
            0x454e5a,
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

                    tileMaterial
                );

            tile.position.set(
                x,
                0.03,
                z
            );

            tile.receiveShadow =
                true;

            scene.add(tile);
        }
    }

    for (
        let i = -28;
        i <= 28;
        i += 4
    ) {

        const xLine =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.035,
                    0.025,
                    56
                ),

                lineMaterial
            );

        xLine.position.set(
            i,
            0.055,
            0
        );

        scene.add(xLine);

        const zLine =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    56,
                    0.025,
                    0.035
                ),

                lineMaterial
            );

        zLine.position.set(
            0,
            0.056,
            i
        );

        scene.add(zLine);
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

    createLargeBuilding(
        -20,
        -18,
        12,
        10,
        3,
        true,
        true
    );

    createLargeBuilding(
        20,
        -18,
        12,
        10,
        4,
        true,
        false
    );

    createLargeBuilding(
        -20,
        18,
        12,
        10,
        4,
        false,
        false
    );

    createLargeBuilding(
        20,
        18,
        12,
        10,
        3,
        true,
        false
    );

    createLargeBuilding(
        0,
        0,
        10,
        8,
        3,
        true,
        true
    );
}

/*
============================================================
 LARGE BUILDING
============================================================
*/

function createLargeBuilding(
    x,
    z,
    width,
    depth,
    floors,
    enterable,
    hasStairs
) {

    const floorHeight = 4;

    const totalHeight =
        floors *
        floorHeight;

    const roofMaterial =
        material(
            0x202832,
            0.55,
            0.25
        );

    if (!enterable) {

        addObstacle(
            x,
            totalHeight / 2,
            z,
            width,
            totalHeight,
            depth
        );

    } else {

        addObstacle(
            x,
            totalHeight / 2,
            z + depth / 2,
            width,
            totalHeight,
            0.6
        );

        addObstacle(
            x - width / 2,
            totalHeight / 2,
            z,
            0.6,
            totalHeight,
            depth
        );

        addObstacle(
            x + width / 2,
            totalHeight / 2,
            z,
            0.6,
            totalHeight,
            depth
        );

        const sideWidth =
            (width - 3) / 2;

        addObstacle(
            x -
                (width -
                    sideWidth) /
                    2,
            totalHeight / 2,
            z - depth / 2,
            sideWidth,
            totalHeight,
            0.6
        );

        addObstacle(
            x +
                (width -
                    sideWidth) /
                    2,
            totalHeight / 2,
            z - depth / 2,
            sideWidth,
            totalHeight,
            0.6
        );
    }

    /*
    SOLID UPPER FLOORS
    */

    for (
        let floor = 1;
        floor < floors;
        floor++
    ) {

        const y =
            floor *
            floorHeight;

        const slab =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    width - 0.8,
                    0.28,
                    depth - 0.8
                ),

                roofMaterial
            );

        slab.position.set(
            x,
            y,
            z
        );

        slab.receiveShadow =
            true;

        slab.castShadow =
            true;

        scene.add(slab);

        addFloorSurface(
            x,
            y,
            z,
            width - 0.8,
            depth - 0.8,
            0.28
        );

        /*
        Make the floor block bullets too.
        */

        obstacles.push({

            minX:
                x -
                (width - 0.8) / 2,

            maxX:
                x +
                (width - 0.8) / 2,

            minZ:
                z -
                (depth - 0.8) / 2,

            maxZ:
                z +
                (depth - 0.8) / 2,

            minY:
                y - 0.14,

            maxY:
                y + 0.14,

            shootable: true
        });
    }

    /*
    ROOF
    */

    const roof =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                width + 0.5,
                0.3,
                depth + 0.5
            ),

            roofMaterial
        );

    roof.position.set(
        x,
        totalHeight + 0.15,
        z
    );

    roof.castShadow =
        true;

    roof.receiveShadow =
        true;

    scene.add(roof);

    obstacles.push({

        minX:
            x -
            (width + 0.5) / 2,

        maxX:
            x +
            (width + 0.5) / 2,

        minZ:
            z -
            (depth + 0.5) / 2,

        maxZ:
            z +
            (depth + 0.5) / 2,

        minY:
            totalHeight,

        maxY:
            totalHeight + 0.3,

        shootable: true
    });

    createBuildingWindows(
        x,
        z,
        width,
        depth,
        floors
    );

    if (
        enterable &&
        hasStairs
    ) {

        createBuildingStairs(
            x,
            z,
            width,
            depth,
            floors
        );
    }

    if (
        enterable &&
        !hasStairs
    ) {

        createBuildingLadder(
            x +
                width / 2 +
                0.45,
            z,
            totalHeight
        );
    }
}

/*
============================================================
 WINDOWS
============================================================
*/

function createBuildingWindows(
    x,
    z,
    width,
    depth,
    floors
) {

    const glass =
        new THREE.MeshStandardMaterial({

            color: 0x17324d,

            roughness: 0.18,

            metalness: 0.45,

            emissive: 0x061321,

            emissiveIntensity: 0.8
        });

    for (
        let floor = 0;
        floor < floors;
        floor++
    ) {

        const y =
            1.7 +
            floor * 4;

        for (
            let i = -1;
            i <= 1;
            i++
        ) {

            for (
                const side of
                [-1, 1]
            ) {

                const windowMesh =
                    new THREE.Mesh(

                        new THREE.BoxGeometry(
                            1.5,
                            1.4,
                            0.08
                        ),

                        glass
                    );

                windowMesh.position.set(
                    x + i * 3,
                    y,
                    z +
                        side *
                        (depth / 2 + 0.04)
                );

                scene.add(
                    windowMesh
                );
            }
        }
    }
}

/*
============================================================
 STAIRS
============================================================
*/

function createBuildingStairs(
    x,
    z,
    width,
    depth,
    floors
) {

    const stairMaterial =
        material(
            0x59636f,
            0.75,
            0.15
        );

    const stairWidth = 2.5;

    const steps = 11;

    for (
        let floor = 0;
        floor < floors - 1;
        floor++
    ) {

        const baseY =
            floor * 4;

        for (
            let i = 0;
            i < steps;
            i++
        ) {

            const stepHeight =
                0.30;

            const step =
                new THREE.Mesh(

                    new THREE.BoxGeometry(
                        stairWidth,
                        stepHeight,
                        0.62
                    ),

                    stairMaterial
                );

            step.position.set(

                x -
                    width / 2 +
                    2,

                baseY +
                    i * 0.36 +
                    stepHeight / 2,

                z -
                    depth / 2 +
                    1.5 +
                    i * 0.38
            );

            step.castShadow =
                true;

            step.receiveShadow =
                true;

            scene.add(step);

            addFloorSurface(
                step.position.x,
                step.position.y,
                step.position.z,
                stairWidth,
                0.62,
                stepHeight
            );
        }
    }
}

/*
============================================================
 LADDER
============================================================
*/

function createBuildingLadder(
    x,
    z,
    height
) {

    const ladderMaterial =
        material(
            0xa4afb9,
            0.32,
            0.75
        );

    for (
        const side of
        [-0.35, 0.35]
    ) {

        const rail =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.12,
                    height,
                    0.12
                ),

                ladderMaterial
            );

        rail.position.set(
            x + side,
            height / 2,
            z
        );

        rail.castShadow =
            true;

        scene.add(rail);
    }

    for (
        let y = 0.4;
        y < height;
        y += 0.45
    ) {

        const rung =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.8,
                    0.1,
                    0.1
                ),

                ladderMaterial
            );

        rung.position.set(
            x,
            y,
            z
        );

        rung.castShadow =
            true;

        scene.add(rung);
    }

    ladders.push({

        x,
        z,
        height
    });
}

/*
============================================================
 COVER
============================================================
*/

function createCover() {

    createCrate(
        -11,
        1,
        -5
    );

    createCrate(
        -7,
        1,
        -5
    );

    createCrate(
        11,
        1,
        5
    );

    createCrate(
        7,
        1,
        5
    );

    createCrate(
        -10,
        1.5,
        8,
        3
    );

    createCrate(
        10,
        1.5,
        -8,
        3
    );

    createBarrier(
        -8,
        0,
        0
    );

    createBarrier(
        8,
        0,
        0
    );
}

function createCrate(
    x,
    y,
    z,
    size = 2
) {

    const crate =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                size,
                size,
                size
            ),

            material(
                0x6b4229,
                0.82
            )
        );

    crate.position.set(
        x,
        y,
        z
    );

    crate.castShadow =
        true;

    crate.receiveShadow =
        true;

    scene.add(crate);

    obstacles.push({

        minX:
            x - size / 2,

        maxX:
            x + size / 2,

        minZ:
            z - size / 2,

        maxZ:
            z + size / 2,

        minY:
            y - size / 2,

        maxY:
            y + size / 2,

        shootable: true
    });
}

function createBarrier(
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
}

/*
============================================================
 OBSTACLE
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

    wall.castShadow =
        true;

    wall.receiveShadow =
        true;

    scene.add(wall);

    obstacles.push({

        minX:
            x - width / 2,

        maxX:
            x + width / 2,

        minZ:
            z - depth / 2,

        maxZ:
            z + depth / 2,

        minY:
            y - height / 2,

        maxY:
            y + height / 2,

        shootable: true
    });
}

/*
============================================================
 ARENA LIGHTS
============================================================
*/

function createArenaLights() {

    const positions = [

        [-15, 6, -15],
        [15, 6, -15],
        [-15, 6, 15],
        [15, 6, 15]
    ];

    for (
        const p of positions
    ) {

        const light =
            new THREE.PointLight(
                0x75a8ff,
                14,
                18
            );

        light.position.set(
            p[0],
            p[1],
            p[2]
        );

        scene.add(light);
    }
}

/*
============================================================
 SPAWN PADS
============================================================
*/

function createSpawnPads() {

    for (
        const spawn of
        spawnPoints
    ) {

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
        PLAYER_HEIGHT,
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
 WEAPON
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

/*
============================================================
 AK
============================================================
*/

function createAK() {

    weaponModel =
        new THREE.Group();

    const metal =
        material(
            0x15191e,
            0.25,
            0.8
        );

    const dark =
        material(
            0x090b0d,
            0.2,
            0.9
        );

    const wood =
        material(
            0x70411f,
            0.62
        );

    addWeaponPart(
        new THREE.BoxGeometry(
            0.55,
            0.25,
            0.95
        ),
        metal,
        0,
        0,
        0
    );

    addWeaponPart(
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

    addWeaponPart(
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

    addWeaponPart(
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

    addWeaponPart(
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

    const mag =
        addWeaponPart(
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

    const grip =
        addWeaponPart(
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

    addWeaponPart(
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

    const gripMaterial =
        material(
            0x101216,
            0.85
        );

    addWeaponPart(
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

    addWeaponPart(
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
        addWeaponPart(
            new THREE.BoxGeometry(
                0.26,
                0.6,
                0.28
            ),
            gripMaterial,
            0,
            -0.27,
            0.25
        );

    grip.rotation.x =
        -0.16;

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

    addWeaponPart(
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
        addWeaponPart(
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

    addWeaponPart(
        new THREE.BoxGeometry(
            0.45,
            0.08,
            0.12
        ),
        blade,
        0,
        0,
        0.05
    );

    addWeaponPart(
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

    weaponRoot.add(
        weaponModel
    );
}

function addWeaponPart(
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

    part.castShadow =
        true;

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

    if (old)
        old.remove();

    const hud =
        document.createElement(
            "div"
        );

    hud.id =
        "novaEnhancedHUD";

    Object.assign(
        hud.style,
        {
            position: "fixed",
            inset: "0",
            pointerEvents:
                "none",
            zIndex: "100",
            fontFamily:
                "Arial, sans-serif",
            color: "white"
        }
    );

    document.body.appendChild(
        hud
    );

    const cross =
        document.createElement(
            "div"
        );

    cross.innerHTML =
        "<span></span><span></span><span></span><span></span>";

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

    hud.appendChild(
        cross
    );

    for (
        const child of
        cross.children
    ) {

        Object.assign(
            child.style,
            {
                position:
                    "absolute",
                width: "7px",
                height: "2px",
                background:
                    "white",
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

    const healthBox =
        document.createElement(
            "div"
        );

    healthBox.id =
        "novaHealthBox";

    Object.assign(
        healthBox.style,
        {
            position:
                "absolute",
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

    const weaponBox =
        document.createElement(
            "div"
        );

    weaponBox.id =
        "novaWeaponBox";

    Object.assign(
        weaponBox.style,
        {
            position:
                "absolute",
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

    const score =
        document.createElement(
            "div"
        );

    score.id =
        "novaScoreBox";

    Object.assign(
        score.style,
        {
            position:
                "absolute",
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

    const reload =
        document.createElement(
            "div"
        );

    reload.id =
        "novaReloadBox";

    Object.assign(
        reload.style,
        {
            position:
                "absolute",
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

    const feed =
        document.createElement(
            "div"
        );

    feed.id =
        "novaKillFeed";

    Object.assign(
        feed.style,
        {
            position:
                "absolute",
            right: "25px",
            top: "105px",
            width: "350px",
            textAlign: "right"
        }
    );

    hud.appendChild(
        feed
    );

    updateHUD();
}

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
                `<div style="font-size:18px;opacity:.8">
                    COMBAT KNIFE
                </div>`;

        } else {

            w.innerHTML =
                `<div style="font-size:18px;opacity:.8">
                    ${weapons[
                        currentWeapon
                    ].name}
                </div>

                <div style="font-size:34px">
                    ${ammo[
                        currentWeapon
                    ]}
                    <span style="opacity:.65">
                        / ∞
                    </span>
                </div>`;
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

            keys[e.code] =
                true;

            if (
                e.code ===
                "Digit1"
            )
                switchWeapon("ak");

            if (
                e.code ===
                "Digit2"
            )
                switchWeapon("pistol");

            if (
                e.code ===
                "Digit3"
            )
                switchWeapon("knife");

            if (
                e.code ===
                "KeyR"
            )
                reload();

            if (
                e.code ===
                    "Space" &&
                !isDead &&
                player &&
                canJump()
            ) {

                velocityY =
                    JUMP;
            }
        }
    );

    document.addEventListener(
        "keyup",
        e => {

            keys[e.code] =
                false;
        }
    );

    document.addEventListener(
        "mousedown",
        e => {

            if (
                e.button !== 0 ||
                isDead
            )
                return;

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
        e => {

            if (
                e.button === 0
            )
                mouseDown = false;
        }
    );

    document.addEventListener(
        "mousemove",
        e => {

            if (
                isDead ||
                document.pointerLockElement !==
                    renderer.domElement
            )
                return;

            yaw -=
                e.movementX *
                0.002;

            pitch -=
                e.movementY *
                0.002;

            pitch =
                THREE.MathUtils.clamp(
                    pitch,
                    -1.5,
                    1.5
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
 JUMP / FLOOR DETECTION
============================================================
*/

function getFloorHeight(
    x,
    z,
    currentY
) {

    let best =
        0;

    for (
        const floor of
        floorSurfaces
    ) {

        if (
            x >= floor.minX &&
            x <= floor.maxX &&
            z >= floor.minZ &&
            z <= floor.maxZ
        ) {

            if (
                floor.top <=
                    currentY + 0.8 &&
                floor.top >=
                    best
            ) {

                best =
                    floor.top;
            }
        }
    }

    return best;
}

function canJump() {

    const floor =
        getFloorHeight(
            player.position.x,
            player.position.z,
            player.position.y
        );

    return (
        Math.abs(
            player.position.y -
            (floor + PLAYER_HEIGHT)
        ) < 0.12
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

    if (
        !player ||
        isDead
    )
        return;

    const direction =
        new THREE.Vector3();

    if (
        keys["KeyW"]
    )
        direction.z -= 1;

    if (
        keys["KeyS"]
    )
        direction.z += 1;

    if (
        keys["KeyA"]
    )
        direction.x -= 1;

    if (
        keys["KeyD"]
    )
        direction.x += 1;

    const moving =
        direction.lengthSq() >
        0;

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
    )
        speed = 10;

    const ladder =
        getNearbyLadder();

    if (
        ladder &&
        (
            keys["KeyW"] ||
            keys["ArrowUp"]
        )
    ) {

        player.position.y +=
            4.5 * delta;

        player.position.y =
            Math.min(
                ladder.height +
                    PLAYER_HEIGHT,
                player.position.y
            );

        velocityY = 0;

    } else {

        moveWithCollision(
            direction.x *
                speed *
                delta,

            direction.z *
                speed *
                delta
        );

        const floorBefore =
            getFloorHeight(
                player.position.x,
                player.position.z,
                player.position.y
            );

        velocityY -=
            GRAVITY * delta;

        player.position.y +=
            velocityY * delta;

        const floorAfter =
            getFloorHeight(
                player.position.x,
                player.position.z,
                player.position.y
            );

        const floorY =
            Math.max(
                floorBefore,
                floorAfter
            );

        const standingY =
            floorY +
            PLAYER_HEIGHT;

        if (
            player.position.y <=
            standingY
        ) {

            player.position.y =
                standingY;

            velocityY = 0;
        }
    }

    if (moving) {

        weaponBob +=
            delta *
            speed *
            1.5;

    } else {

        weaponBob *=
            0.9;
    }

    camera.position.y =
        moving
            ? Math.sin(
                weaponBob
            ) * 0.012
            : 0;
}

/*
============================================================
 LADDER DETECTION
============================================================
*/

function getNearbyLadder() {

    if (!player)
        return null;

    for (
        const ladder of
        ladders
    ) {

        const dx =
            player.position.x -
            ladder.x;

        const dz =
            player.position.z -
            ladder.z;

        const distance =
            Math.sqrt(
                dx * dx +
                dz * dz
            );

        if (
            distance <
            1.4
        )
            return ladder;
    }

    return null;
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

    const radius =
        PLAYER_RADIUS;

    let nextX =
        player.position.x +
        dx;

    let nextZ =
        player.position.z +
        dz;

    for (
        const wall of
        obstacles
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
                    player.position.z,
                    wall.maxZ
                )
            );

        const distX =
            nextX -
            closestX;

        const distZ =
            player.position.z -
            closestZ;

        if (
            distX * distX +
            distZ * distZ <
            radius * radius
        ) {

            nextX =
                player.position.x;

            break;
        }
    }

    for (
        const wall of
        obstacles
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

        const distX =
            nextX -
            closestX;

        const distZ =
            nextZ -
            closestZ;

        if (
            distX * distX +
            distZ * distZ <
            radius * radius
        ) {

            nextZ =
                player.position.z;

            break;
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
 WEAPON SWITCH
============================================================
*/

function switchWeapon(
    weapon
) {

    if (
        reloading ||
        isDead
    )
        return;

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
        isDead ||
        !gameStarted
    )
        return;

    const weapon =
        weapons[
            currentWeapon
        ];

    const now =
        performance.now();

    if (
        now - lastShot <
        weapon.fireRate
    )
        return;

    lastShot =
        now;

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

        weaponRecoil =
            1;

        weaponSwayY -=
            0.035;

        if (
            currentWeapon ===
            "ak"
        ) {

            playFAHHHHH();
        }

        raycastDamage();

    } else {

        knifeAttack();
    }
}

/*
============================================================
 AK SOUND
============================================================
*/

function playFAHHHHH() {

    if (
        !("speechSynthesis" in window)
    )
        return;

    const now =
        performance.now();

    if (
        now - speechCooldown <
        350
    )
        return;

    speechCooldown =
        now;

    window.speechSynthesis.cancel();

    const voice =
        new SpeechSynthesisUtterance(
            "FAHHHHH!"
        );

    voice.volume = 0.8;
    voice.rate = 1.15;
    voice.pitch = 1.15;

    window.speechSynthesis.speak(
        voice
    );
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
            "ak" &&
        !isDead
    ) {

        shoot();
    }
}

/*
============================================================
 BULLET BLOCKER
============================================================
*/

function bulletBlocked(
    origin,
    target
) {

    const direction =
        new THREE.Vector3()
            .subVectors(
                target,
                origin
            )
            .normalize();

    const distance =
        origin.distanceTo(
            target
        );

    const ray =
        new THREE.Raycaster(
            origin,
            direction,
            0,
            distance
        );

    for (
        const wall of
        obstacles
    ) {

        const center =
            new THREE.Vector3(
                (
                    wall.minX +
                    wall.maxX
                ) / 2,

                (
                    wall.minY +
                    wall.maxY
                ) / 2,

                (
                    wall.minZ +
                    wall.maxZ
                ) / 2
            );

        const size =
            new THREE.Vector3(
                wall.maxX -
                    wall.minX,

                wall.maxY -
                    wall.minY,

                wall.maxZ -
                    wall.minZ
            );

        const box =
            new THREE.Box3()
                .setFromCenterAndSize(
                    center,
                    size
                );

        const hit =
            ray.intersectBox(
                box,
                new THREE.Vector3()
            );

        if (hit)
            return true;
    }

    return false;
}

/*
============================================================
 RAYCAST DAMAGE
============================================================
*/

function raycastDamage() {

    raycaster.setFromCamera(
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
        .filter(
            p =>
                !p.dead
        )
        .map(
            p =>
                p.object
        );

    if (
        !targets.length
    )
        return;

    const hits =
        raycaster.intersectObjects(
            targets,
            true
        );

    if (
        !hits.length
    )
        return;

    let hit =
        hits[0];

    if (
        bulletBlocked(
            camera.getWorldPosition(
                new THREE.Vector3()
            ),
            hit.point
        )
    ) {

        createHitMarker(
            false
        );

        return;
    }

    let object =
        hit.object;

    const distance =
        hit.distance;

    if (
        distance >
        150
    )
        return;

    const headshot =
        object.userData.hitbox ===
        "head";

    while (
        object &&
        !object.userData.playerId
    ) {

        object =
            object.parent;
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
        .filter(
            p =>
                !p.dead
        )
        .map(
            p =>
                p.object
        );

    const hits =
        raycaster.intersectObjects(
            targets,
            true
        );

    if (
        !hits.length ||
        hits[0].distance >
            3
    )
        return;

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

    weaponRecoil =
        0.6;

    createHitMarker(
        false
    );

    if (socket) {

        socket.emit(
            "playerDamage",
            {
                targetId:
                    object.userData.playerId,

                damage: 100,

                headshot: false,

                weapon:
                    "knife"
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
        "knife" ||
        reloading ||
        isDead
    )
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
    )
        return;

    reloading =
        true;

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

            if (isDead) {

                reloading =
                    false;

                return;
            }

            ammo[
                currentWeapon
            ] =
                weapon.magazine;

            reloading =
                false;

            weaponRoot.rotation.x =
                0;

            if (box)
                box.textContent =
                    "";

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
            position:
                "fixed",
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
 SHELL
============================================================
*/

function createShell() {

    if (
        currentWeapon ===
        "knife"
    )
        return;

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

    let life = 0;

    const animate =
        () => {

            life +=
                0.016;

            shell.position.x +=
                0.025;

            shell.position.y +=
                0.02 -
                life * 0.002;

            shell.position.z +=
                0.005;

            shell.rotation.x +=
                0.2;

            if (
                life < 0.8
            ) {

                requestAnimationFrame(
                    animate
                );

            } else {

                scene.remove(
                    shell
                );
            }
        };

    animate();
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
            position:
                "fixed",
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
        () =>
            marker.remove(),
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
        ) ||
        remotePlayers[
            data.id
        ]
    )
        return;

    const group =
        new THREE.Group();

    group.userData.playerId =
        data.id;

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
        1;

    body.castShadow =
        true;

    body.userData.playerId =
        data.id;

    group.add(body);

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

    head.castShadow =
        true;

    head.userData.playerId =
        data.id;

    head.userData.hitbox =
        "head";

    group.add(head);

    const legMaterial =
        material(
            0x171c25,
            0.8
        );

    for (
        const x of
        [-0.19, 0.19]
    ) {

        const leg =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.23,
                    0.75,
                    0.28
                ),

                legMaterial
            );

        leg.position.set(
            x,
            0.38,
            0
        );

        leg.castShadow =
            true;

        leg.userData.playerId =
            data.id;

        group.add(leg);
    }

    for (
        const x of
        [-0.48, 0.48]
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
            1,
            0
        );

        arm.rotation.z =
            x < 0
                ? -0.12
                : 0.12;

        arm.userData.playerId =
            data.id;

        group.add(arm);
    }

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
        1,
        -0.48
    );

    gun.userData.playerId =
        data.id;

    group.add(gun);

    const tag =
        createNameTag(
            data.username ||
            "Player"
        );

    tag.position.y =
        2.35;

    group.add(tag);

    group.position.set(
        Number(data.x) || 0,
        Number(data.y) || 0,
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

        dead: false,

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

    canvas.width =
        512;

    canvas.height =
        128;

    const ctx =
        canvas.getContext(
            "2d"
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
 REMOTE PLAYER EVENTS
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

function hideRemotePlayer(
    id
) {

    const remote =
        remotePlayers[id];

    if (!remote)
        return;

    remote.dead =
        true;

    remote.object.visible =
        false;
}

function showRemotePlayer(
    id,
    data
) {

    const remote =
        remotePlayers[id];

    if (!remote)
        return;

    remote.dead =
        false;

    remote.object.visible =
        true;

    if (data) {

        remote.object.position.x =
            Number(data.x) || 0;

        remote.object.position.y =
            Number(data.y) || 0;

        remote.object.position.z =
            Number(data.z) || 0;
    }
}

function updateRemotePlayer(
    data
) {

    if (
        !data ||
        !data.id
    )
        return;

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

    if (
        remote.dead
    )
        return;

    remote.lastX =
        remote.object.position.x;

    remote.lastZ =
        remote.object.position.z;

    remote.object.position.x =
        Number(data.x) || 0;

    remote.object.position.y =
        Number(data.y) || 0;

    remote.object.position.z =
        Number(data.z) || 0;

    remote.object.rotation.y =
        Number(
            data.rotationY
        ) || 0;
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

    socket =
        io();

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
        "playerDied",
        data => {

            if (
                data &&
                data.id
            ) {

                hideRemotePlayer(
                    data.id
                );
            }
        }
    );

    socket.on(
        "playerRespawned",
        data => {

            if (
                data &&
                data.id
            ) {

                showRemotePlayer(
                    data.id,
                    data
                );
            }
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
        data => {

            kills++;

            streak++;

            updateHUD();

            const victim =
                data &&
                data.victimName
                    ? data.victimName
                    : "someone";

            const killer =
                data &&
                data.killerName
                    ? data.killerName
                    : getUsername();

            showKillFeed(
                `${victim} suck so bad that they died to ${killer}`
            );
        }
    );

    socket.on(
        "youDied",
        data => {

            if (!isDead)
                die(data);
        }
    );

    socket.on(
        "respawn",
        data => {

            if (isDead)
                finishRespawn(
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
        !player ||
        isDead
    )
        return;

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

/*
============================================================
 DAMAGE
============================================================
*/

function takeDamage(
    damage
) {

    if (
        isDead ||
        respawnProtection
    )
        return;

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

function createDamageFlash() {

    const flash =
        document.createElement(
            "div"
        );

    Object.assign(
        flash.style,
        {
            position:
                "fixed",
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
        () =>
            flash.remove(),
        120
    );
}

/*
============================================================
 DIE
============================================================
*/

function die(
    killData
) {

    if (isDead)
        return;

    isDead =
        true;

    reloading =
        false;

    mouseDown =
        false;

    deaths++;

    streak = 0;

    updateHUD();

    if (weaponRoot) {

        weaponRoot.visible =
            false;
    }

    if (
        document.pointerLockElement
    ) {

        document.exitPointerLock();
    }

    if (socket) {

        socket.emit(
            "playerDied"
        );
    }

    const screen =
        document.createElement(
            "div"
        );

    screen.id =
        "novaDeathScreen";

    screen.innerHTML =
        `<div style="
            font-size:58px;
            font-weight:900;
            letter-spacing:5px;
        ">
            YOU DIED
        </div>`;

    Object.assign(
        screen.style,
        {
            position:
                "fixed",
            inset: "0",
            display:
                "flex",
            alignItems:
                "center",
            justifyContent:
                "center",
            background:
                "rgba(0,0,0,.45)",
            color: "white",
            pointerEvents:
                "none",
            zIndex: "500",
            textShadow:
                "0 3px 15px black"
        }
    );

    document.body.appendChild(
        screen
    );

    setTimeout(
        () =>
            screen.remove(),
        350
    );
}

/*
============================================================
 RESPAWN
============================================================
*/

function finishRespawn(
    data
) {

    if (
        !player ||
        !isDead
    )
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

        PLAYER_HEIGHT,

        data &&
        Number.isFinite(
            Number(data.z)
        )
            ? Number(data.z)
            : spawn.z
    );

    velocityY =
        0;

    health =
        100;

    isDead =
        false;

    respawnProtection =
        true;

    if (weaponRoot) {

        weaponRoot.visible =
            true;

        weaponRoot.rotation.set(
            0,
            0,
            0
        );
    }

    ammo.ak =
        weapons.ak.magazine;

    ammo.pistol =
        weapons.pistol.magazine;

    pitch = 0;

    camera.rotation.x =
        0;

    updateHUD();

    setTimeout(
        () => {

            respawnProtection =
                false;

        },
        2000
    );

    if (socket) {

        socket.emit(
            "playerRespawned",
            {
                username:
                    getUsername(),

                x:
                    player.position.x,

                y:
                    player.position.y,

                z:
                    player.position.z
            }
        );
    }

    sendPosition();
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
        "⚡ " +
        text;

    Object.assign(
        item.style,
        {
            marginBottom:
                "8px",
            padding:
                "8px 12px",
            background:
                "rgba(0,0,0,.45)",
            borderRadius:
                "5px",
            fontWeight:
                "900"
        }
    );

    feed.appendChild(
        item
    );

    setTimeout(
        () =>
            item.remove(),
        3000
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

    if (
        !weaponRoot
    )
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
        ) *
        0.012;

    const bobY =
        Math.abs(
            Math.sin(
                weaponBob
            )
        ) *
        0.012;

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
 REMOTE ANIMATION
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

        if (
            remote.dead
        )
            continue;

        const object =
            remote.object;

        const moving =
            Math.abs(
                object.position.x -
                remote.lastX
            ) +
            Math.abs(
                object.position.z -
                remote.lastZ
            ) >
            0.01;

        object.position.y =
            THREE.MathUtils.lerp(
                object.position.y,
                moving
                    ? Math.sin(
                        performance.now() *
                        0.01
                    ) *
                    0.025
                    : 0,
                delta * 8
            );

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

        networkTimer =
            0;

        sendPosition();
    }
}

/*
============================================================
 GAME LOOP
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
            (
                time -
                lastTime
            ) / 1000,
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
    )
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

console.log(
    "%cNovaStrike loaded successfully",
    "font-size:20px;font-weight:bold"
);
