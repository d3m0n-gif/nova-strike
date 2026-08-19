const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const session = require("express-session");
const { Pool } = require("pg");
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
// DATABASE
// ============================================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : false
});


// ============================================================
// EXPRESS
// ============================================================

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ============================================================
// SESSIONS
// ============================================================

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "novastrike-development-secret",

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: false,
            maxAge:
                1000 * 60 * 60 * 24 * 7
        }
    })
);


// ============================================================
// DATABASE SETUP
// ============================================================

async function setupDatabase() {

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(20) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log("Database ready.");

}


// ============================================================
// PASSWORD HASHING
// ============================================================

function hashPassword(password) {

    return crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");

}


// ============================================================
// REGISTER
// ============================================================

app.post(
    "/api/register",
    async (req, res) => {

        try {

            const {
                username,
                email,
                password
            } = req.body;


            if (
                !username ||
                !email ||
                !password
            ) {

                return res.status(400).json({
                    error:
                        "Please fill in every field."
                });

            }


            const cleanUsername =
                String(username)
                    .trim()
                    .slice(0, 20);

            const cleanEmail =
                String(email)
                    .trim()
                    .toLowerCase();


            if (
                cleanUsername.length < 2
            ) {

                return res.status(400).json({
                    error:
                        "Username must be at least 2 characters."
                });

            }


            if (
                password.length < 6
            ) {

                return res.status(400).json({
                    error:
                        "Password must be at least 6 characters."
                });

            }


            const existing =
                await pool.query(
                    `
                    SELECT id
                    FROM users
                    WHERE username = $1
                       OR email = $2
                    `,
                    [
                        cleanUsername,
                        cleanEmail
                    ]
                );


            if (
                existing.rows.length > 0
            ) {

                return res.status(400).json({
                    error:
                        "Username or email is already registered."
                });

            }


            const passwordHash =
                hashPassword(password);


            const result =
                await pool.query(
                    `
                    INSERT INTO users
                    (
                        username,
                        email,
                        password_hash
                    )
                    VALUES ($1, $2, $3)
                    RETURNING id, username, email
                    `,
                    [
                        cleanUsername,
                        cleanEmail,
                        passwordHash
                    ]
                );


            const user =
                result.rows[0];


            req.session.user = {
                id: user.id,
                username: user.username,
                email: user.email
            };


            res.json({
                success: true,
                user: req.session.user
            });


        } catch (error) {

            console.error(
                "REGISTER ERROR:",
                error
            );


            res.status(500).json({
                error:
                    "Could not create account."
            });

        }

    }
);


// ============================================================
// LOGIN
// ============================================================

app.post(
    "/api/login",
    async (req, res) => {

        try {

            const {
                email,
                password
            } = req.body;


            if (
                !email ||
                !password
            ) {

                return res.status(400).json({
                    error:
                        "Please enter your email and password."
                });

            }


            const cleanEmail =
                String(email)
                    .trim()
                    .toLowerCase();


            const passwordHash =
                hashPassword(password);


            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        username,
                        email
                    FROM users
                    WHERE email = $1
                      AND password_hash = $2
                    `,
                    [
                        cleanEmail,
                        passwordHash
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(401).json({
                    error:
                        "Invalid email or password."
                });

            }


            const user =
                result.rows[0];


            req.session.user = {
                id: user.id,
                username: user.username,
                email: user.email
            };


            res.json({
                success: true,
                user: req.session.user
            });


        } catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );


            res.status(500).json({
                error:
                    "Could not connect to the database."
            });

        }

    }
);


// ============================================================
// CURRENT USER
// ============================================================

app.get(
    "/api/me",
    (req, res) => {

        if (
            !req.session.user
        ) {

            return res.status(401).json({
                error:
                    "Not logged in."
            });

        }


        res.json({
            user:
                req.session.user
        });

    }
);


// ============================================================
// LOGOUT
// ============================================================

app.post(
    "/api/logout",
    (req, res) => {

        req.session.destroy(
            error => {

                if (error) {

                    return res.status(500).json({
                        error:
                            "Logout failed."
                    });

                }


                res.json({
                    success: true
                });

            }
        );

    }
);


// ============================================================
// GAME PLAYERS
// ============================================================

const players = {};


// ============================================================
// SOCKET.IO
// ============================================================

io.on(
    "connection",
    socket => {

        console.log(
            "Socket connected:",
            socket.id
        );


        // ====================================================
        // PLAYER READY
        // ====================================================

        socket.on(
            "playerReady",
            data => {

                const username =
                    data &&
                    data.username
                        ? String(
                            data.username
                        )
                            .trim()
                            .slice(0, 20)
                        : "Player";


                players[
                    socket.id
                ] = {

                    id:
                        socket.id,

                    username,

                    x: 0,

                    y: 1.7,

                    z: 5,

                    rotationY: 0,

                    health: 100,

                    kills: 0,

                    deaths: 0,

                    streak: 0

                };


                // Send current players
                // to the new player

                socket.emit(
                    "players",
                    players
                );


                // Tell everyone else

                socket.broadcast.emit(
                    "playerJoined",
                    players[
                        socket.id
                    ]
                );


                console.log(
                    `${username} joined NovaStrike`
                );

            }
        );


        // ====================================================
        // MOVEMENT
        // ====================================================

        socket.on(
            "playerMove",
            data => {

                const p =
                    players[
                        socket.id
                    ];


                if (!p) {
                    return;
                }


                if (
                    typeof data.x ===
                    "number"
                ) {
                    p.x = data.x;
                }


                if (
                    typeof data.y ===
                    "number"
                ) {
                    p.y = data.y;
                }


                if (
                    typeof data.z ===
                    "number"
                ) {
                    p.z = data.z;
                }


                if (
                    typeof data.rotationY ===
                    "number"
                ) {
                    p.rotationY =
                        data.rotationY;
                }


                socket.broadcast.emit(
                    "playerMoved",
                    {
                        id:
                            p.id,

                        username:
                            p.username,

                        x:
                            p.x,

                        y:
                            p.y,

                        z:
                            p.z,

                        rotationY:
                            p.rotationY
                    }
                );

            }
        );


        // ====================================================
        // SHOOT
        // ====================================================

        socket.on(
            "playerShoot",
            data => {

                const p =
                    players[
                        socket.id
                    ];


                if (!p) {
                    return;
                }


                socket.broadcast.emit(
                    "playerShot",
                    {
                        id:
                            p.id,

                        username:
                            p.username,

                        weapon:
                            data.weapon ||
                            "ak",

                        yaw:
                            Number(
                                data.yaw
                            ) || 0,

                        pitch:
                            Number(
                                data.pitch
                            ) || 0
                    }
                );

            }
        );


        // ====================================================
        // DAMAGE
        // ====================================================

        socket.on(
            "playerDamage",
            data => {

                const attacker =
                    players[
                        socket.id
                    ];


                if (!attacker) {
                    return;
                }


                const target =
                    players[
                        data.targetId
                    ];


                if (!target) {
                    return;
                }


                let damage =
                    Number(
                        data.damage
                    );


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


                target.health -=
                    damage;


                target.health =
                    Math.max(
                        0,
                        target.health
                    );


                io.to(
                    target.id
                ).emit(
                    "damageTaken",
                    {
                        damage,
                        attackerId:
                            attacker.id,

                        weapon:
                            data.weapon,

                        headshot:
                            Boolean(
                                data.headshot
                            )
                    }
                );


                // =================================================
                // DEATH
                // =================================================

                if (
                    target.health <= 0
                ) {

                    target.deaths++;

                    target.streak = 0;


                    attacker.kills++;

                    attacker.streak++;


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


                    // Respawn after 2.5 sec

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


                            io.emit(
                                "playerMoved",
                                {
                                    id:
                                        target.id,

                                    username:
                                        target.username,

                                    x: 0,

                                    y: 1.7,

                                    z: 5,

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


        // ====================================================
        // DISCONNECT
        // ====================================================

        socket.on(
            "disconnect",
            () => {

                const p =
                    players[
                        socket.id
                    ];


                if (p) {

                    console.log(
                        `${p.username} left NovaStrike`
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

    }
);


// ============================================================
// START SERVER
// ============================================================

async function startServer() {

    try {

        await setupDatabase();


        server.listen(
            PORT,
            () => {

                console.log(
                    `NovaStrike running on port ${PORT}`
                );

            }
        );

    } catch (error) {

        console.error(
            "SERVER START ERROR:",
            error
        );

        process.exit(1);

    }

}


startServer();
