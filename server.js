const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const PORT = process.env.PORT || 3000;


// ============================================================
// EXPRESS
// ============================================================

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ============================================================
// BASIC WEBSITE ROUTE
// ============================================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


// ============================================================
// PLAYERS
// ============================================================

const players = {};


// ============================================================
// PLAYER DATA
// ============================================================

function createPlayer(socket, data = {}) {

    return {

        id: socket.id,

        username:
            data.username ||
            "Player",

        x:
            Number(data.x) || 0,

        y:
            Number(data.y) || 1.7,

        z:
            Number(data.z) || 5,

        rotationY:
            Number(data.rotationY) || 0,

        health: 100,

        kills: 0,

        deaths: 0,

        streak: 0

    };

}


// ============================================================
// CONNECTION
// ============================================================

io.on("connection", (socket) => {

    console.log(
        "Player connected:",
        socket.id
    );


    // ========================================================
    // PLAYER READY
    // ========================================================

    socket.on(
        "playerReady",
        (data = {}) => {

            const player =
                createPlayer(
                    socket,
                    data
                );


            players[
                socket.id
            ] = player;


            // Send all existing players
            // to the new player

            socket.emit(
                "players",
                players
            );


            // Tell everyone else
            // that this player joined

            socket.broadcast.emit(
                "playerJoined",
                player
            );


            console.log(
                `${player.username} joined NovaStrike`
            );

        }
    );


    // ========================================================
    // MOVEMENT
    // ========================================================

    socket.on(
        "playerMove",
        (data = {}) => {

            const player =
                players[
                    socket.id
                ];


            if (!player) {
                return;
            }


            if (
                typeof data.x ===
                "number"
            ) {

                player.x =
                    data.x;

            }


            if (
                typeof data.y ===
                "number"
            ) {

                player.y =
                    data.y;

            }


            if (
                typeof data.z ===
                "number"
            ) {

                player.z =
                    data.z;

            }


            if (
                typeof data.rotationY ===
                "number"
            ) {

                player.rotationY =
                    data.rotationY;

            }


            if (
                typeof data.username ===
                "string" &&
                data.username.trim()
            ) {

                player.username =
                    data.username
                        .trim()
                        .slice(
                            0,
                            20
                        );

            }


            socket.broadcast.emit(
                "playerMoved",
                {
                    id:
                        player.id,

                    username:
                        player.username,

                    x:
                        player.x,

                    y:
                        player.y,

                    z:
                        player.z,

                    rotationY:
                        player.rotationY
                }
            );

        }
    );


    // ========================================================
    // SHOOTING
    // ========================================================

    socket.on(
        "playerShoot",
        (data = {}) => {

            const player =
                players[
                    socket.id
                ];


            if (!player) {
                return;
            }


            // Tell other clients that
            // this player fired.

            socket.broadcast.emit(
                "playerShot",
                {
                    id:
                        player.id,

                    username:
                        player.username,

                    weapon:
                        data.weapon ||
                        "ak",

                    yaw:
                        Number(data.yaw) || 0,

                    pitch:
                        Number(data.pitch) || 0
                }
            );

        }
    );


    // ========================================================
    // DAMAGE
    // ========================================================

    socket.on(
        "playerDamage",
        (data = {}) => {

            const attacker =
                players[
                    socket.id
                ];


            if (!attacker) {
                return;
            }


            const targetId =
                data.targetId;


            const target =
                players[
                    targetId
                ];


            if (!target) {
                return;
            }


            // Prevent invalid damage

            let damage =
                Number(data.damage);


            if (
                !Number.isFinite(
                    damage
                )
            ) {

                return;

            }


            damage =
                Math.max(
                    0,
                    Math.min(
                        damage,
                        100
                    )
                );


            // Apply damage

            target.health -=
                damage;


            target.health =
                Math.max(
                    0,
                    target.health
                );


            // Tell target they
            // took damage

            io.to(
                target.id
            ).emit(
                "damageTaken",
                {
                    damage,
                    attackerId:
                        attacker.id,

                    weapon:
                        data.weapon ||
                        "ak",

                    headshot:
                        Boolean(
                            data.headshot
                        )
                }
            );


            console.log(
                `${attacker.username} hit ${target.username} for ${damage}`
            );


            // ==================================================
            // DEATH
            // ==================================================

            if (
                target.health <=
                0
            ) {

                target.deaths++;

                target.streak = 0;


                attacker.kills++;

                attacker.streak++;


                // Tell attacker
                // about their kill

                io.to(
                    attacker.id
                ).emit(
                    "killConfirmed",
                    {
                        targetId:
                            target.id,

                        username:
                            target.username,

                        headshot:
                            Boolean(
                                data.headshot
                            )
                    }
                );


                // Tell everyone that
                // player died

                io.emit(
                    "playerDied",
                    {
                        playerId:
                            target.id,

                        username:
                            target.username,

                        killerId:
                            attacker.id,

                        killerName:
                            attacker.username
                    }
                );


                // Respawn server data

                setTimeout(
                    () => {

                        if (
                            !players[
                                target.id
                            ]
                        ) {

                            return;

                        }


                        target.health =
                            100;


                        target.x =
                            0;

                        target.y =
                            1.7;

                        target.z =
                            5;


                        // Tell the player
                        // to respawn

                        io.to(
                            target.id
                        ).emit(
                            "respawn",
                            {
                                x: 0,
                                y: 1.7,
                                z: 5,
                                health: 100
                            }
                        );


                        // Tell everyone the
                        // new position

                        io.emit(
                            "playerMoved",
                            {
                                id:
                                    target.id,

                                username:
                                    target.username,

                                x:
                                    target.x,

                                y:
                                    target.y,

                                z:
                                    target.z,

                                rotationY:
                                    target.rotationY
                            }
                        );

                    },
                    2500
                );

            }

        }
    );


    // ========================================================
    // DISCONNECT
    // ========================================================

    socket.on(
        "disconnect",
        () => {

            const player =
                players[
                    socket.id
                ];


            if (player) {

                console.log(
                    `${player.username} left NovaStrike`
                );

            } else {

                console.log(
                    "Player disconnected:",
                    socket.id
                );

            }


            delete players[
                socket.id
            ];


            io.emit(
                "playerLeft",
                socket.id
            );

        }
    );

});


// ============================================================
// SERVER
// ============================================================

server.listen(
    PORT,
    () => {

        console.log(
            `NovaStrike server running on port ${PORT}`
        );

    }
);
