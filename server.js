const express = require("express");
const http = require("http");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;

/* =========================
   DATABASE
========================= */

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/* =========================
   SESSION
========================= */

const sessionMiddleware = session({
  store: new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true
  }),

  secret:
    process.env.SESSION_SECRET ||
    "CHANGE_THIS_SECRET_IN_RENDER",

  resave: false,

  saveUninitialized: false,

  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30
  }
});

/* =========================
   EXPRESS
========================= */

app.use(express.json());

app.use(sessionMiddleware);

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

/* =========================
   SOCKET.IO
========================= */

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

io.engine.use(sessionMiddleware);

/* =========================
   DATABASE SETUP
========================= */

async function setupDatabase() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      username VARCHAR(20) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      controls JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("Database ready.");
}

/* =========================
   AUTH HELPERS
========================= */

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validUsername(username) {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
}

function cleanPlayer(player) {
  return {
    id: player.id,
    username: player.username,
    email: player.email,
    controls: player.controls || {}
  };
}

/* =========================
   REGISTER
========================= */

app.post("/api/register", async (req, res) => {

  try {

    let {
      username,
      email,
      password
    } = req.body;

    username =
      String(username || "").trim();

    email =
      String(email || "")
        .trim()
        .toLowerCase();

    password =
      String(password || "");

    if (!validUsername(username)) {
      return res.status(400).json({
        error:
          "Username must be 3-20 characters and only use letters, numbers, _ or -."
      });
    }

    if (!validEmail(email)) {
      return res.status(400).json({
        error: "Enter a valid email."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters."
      });
    }

    const existing =
      await pool.query(
        `
        SELECT id
        FROM players
        WHERE LOWER(username) = LOWER($1)
           OR LOWER(email) = LOWER($2)
        LIMIT 1
        `,
        [username, email]
      );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error:
          "That username or email is already registered."
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 12);

    const result =
      await pool.query(
        `
        INSERT INTO players
          (username, email, password_hash, controls)
        VALUES
          ($1, $2, $3, $4)
        RETURNING
          id,
          username,
          email,
          controls
        `,
        [
          username,
          email,
          passwordHash,
          JSON.stringify({})
        ]
      );

    const player = result.rows[0];

    req.session.playerId = player.id;

    req.session.save(err => {

      if (err) {
        console.error(
          "Session save error:",
          err
        );

        return res.status(500).json({
          error:
            "Account created, but session could not be saved."
        });
      }

      res.status(201).json({
        player: cleanPlayer(player)
      });
    });

  } catch (error) {

    console.error(
      "Register error:",
      error
    );

    res.status(500).json({
      error:
        "Server error while creating account."
    });
  }
});

/* =========================
   LOGIN
========================= */

app.post("/api/login", async (req, res) => {

  try {

    const email =
      String(req.body.email || "")
        .trim()
        .toLowerCase();

    const password =
      String(req.body.password || "");

    const result =
      await pool.query(
        `
        SELECT *
        FROM players
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
        `,
        [email]
      );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error:
          "Incorrect email or password."
      });
    }

    const player = result.rows[0];

    const correct =
      await bcrypt.compare(
        password,
        player.password_hash
      );

    if (!correct) {
      return res.status(401).json({
        error:
          "Incorrect email or password."
      });
    }

    req.session.playerId = player.id;

    req.session.save(err => {

      if (err) {
        console.error(
          "Session save error:",
          err
        );

        return res.status(500).json({
          error:
            "Login succeeded, but session could not be saved."
        });
      }

      res.json({
        player: cleanPlayer(player)
      });
    });

  } catch (error) {

    console.error(
      "Login error:",
      error
    );

    res.status(500).json({
      error:
        "Server error while logging in."
    });
  }
});

/* =========================
   CURRENT ACCOUNT
========================= */

app.get("/api/me", async (req, res) => {

  try {

    if (!req.session.playerId) {
      return res.status(401).json({
        error: "Not logged in."
      });
    }

    const result =
      await pool.query(
        `
        SELECT
          id,
          username,
          email,
          controls
        FROM players
        WHERE id = $1
        `,
        [req.session.playerId]
      );

    if (result.rows.length === 0) {

      req.session.destroy(() => {});

      return res.status(401).json({
        error: "Account not found."
      });
    }

    res.json({
      player:
        cleanPlayer(result.rows[0])
    });

  } catch (error) {

    console.error(
      "Session error:",
      error
    );

    res.status(500).json({
      error: "Server error."
    });
  }
});

/* =========================
   LOGOUT
========================= */

app.post("/api/logout", (req, res) => {

  req.session.destroy(err => {

    if (err) {
      return res.status(500).json({
        error: "Could not log out."
      });
    }

    res.clearCookie("connect.sid");

    res.json({
      success: true
    });
  });
});

/* =========================
   SAVE CONTROLS
========================= */

app.put("/api/controls", async (req, res) => {

  try {

    if (!req.session.playerId) {
      return res.status(401).json({
        error: "Not logged in."
      });
    }

    const controls =
      req.body.controls;

    if (
      !controls ||
      typeof controls !== "object" ||
      Array.isArray(controls)
    ) {
      return res.status(400).json({
        error: "Invalid controls."
      });
    }

    await pool.query(
      `
      UPDATE players
      SET controls = $1
      WHERE id = $2
      `,
      [
        JSON.stringify(controls),
        req.session.playerId
      ]
    );

    res.json({
      success: true
    });

  } catch (error) {

    console.error(
      "Control save error:",
      error
    );

    res.status(500).json({
      error:
        "Could not save controls."
    });
  }
});

/* =========================
   ACTIVE PLAYERS
========================= */

const players = new Map();

/*
  socket.id -> {
    id,
    accountId,
    username,
    x,
    y,
    z,
    rotationY,
    state
  }
*/

/* =========================
   SOCKET.IO
========================= */

io.on("connection", socket => {

  console.log(
    "Socket connected:",
    socket.id
  );

  /* =========================
     PLAYER JOIN
  ========================== */

  socket.on(
    "player:join",
    async () => {

      try {

        const session =
          socket.request.session;

        if (!session) {
          return;
        }

        if (!session.playerId) {
          socket.emit(
            "auth:error",
            {
              error:
                "You must be logged in."
            }
          );

          return;
        }

        const result =
          await pool.query(
            `
            SELECT
              id,
              username
            FROM players
            WHERE id = $1
            `,
            [session.playerId]
          );

        if (result.rows.length === 0) {

          socket.emit(
            "auth:error",
            {
              error:
                "Account not found."
            }
          );

          return;
        }

        const databasePlayer =
          result.rows[0];

        const player = {

          id:
            socket.id,

          accountId:
            databasePlayer.id,

          username:
            databasePlayer.username,

          x: 0,

          y: 1,

          z: 10,

          rotationY: 0,

          state: "normal"
        };

        players.set(
          socket.id,
          player
        );

        const existingPlayers =
          Array.from(
            players.values()
          ).filter(
            p =>
              p.id !== socket.id
          );

        socket.emit(
          "players:list",
          {
            players:
              existingPlayers
          }
        );

        socket.broadcast.emit(
          "player:joined",
          player
        );

        updatePlayerCount();

        console.log(
          `${player.username} joined the game.`
        );

      } catch (error) {

        console.error(
          "Player join error:",
          error
        );
      }
    }
  );

  /* =========================
     MOVEMENT
  ========================== */

  socket.on(
    "player:update",
    data => {

      const player =
        players.get(socket.id);

      if (!player) {
        return;
      }

      if (
        !data ||
        typeof data.x !== "number" ||
        typeof data.y !== "number" ||
        typeof data.z !== "number"
      ) {
        return;
      }

      const maxCoordinate = 1000;

      player.x =
        Math.max(
          -maxCoordinate,
          Math.min(
            maxCoordinate,
            data.x
          )
        );

      player.y =
        Math.max(
          0,
          Math.min(
            100,
            data.y
          )
        );

      player.z =
        Math.max(
          -maxCoordinate,
          Math.min(
            maxCoordinate,
            data.z
          )
        );

      if (
        typeof data.rotationY ===
        "number"
      ) {
        player.rotationY =
          data.rotationY;
      }

      if (
        typeof data.state ===
        "string"
      ) {

        const allowedStates = [
          "normal",
          "sprinting",
          "sliding",
          "sneaking"
        ];

        if (
          allowedStates.includes(
            data.state
          )
        ) {
          player.state =
            data.state;
        }
      }

      socket.broadcast.emit(
        "player:update",
        player
      );
    }
  );

  /* =========================
     CHAT
  ========================== */

  socket.on(
    "chat:send",
    message => {

      const player =
        players.get(socket.id);

      if (!player) {
        return;
      }

      if (
        typeof message !== "string"
      ) {
        return;
      }

      message =
        message
          .replace(/\s+/g, " ")
          .trim();

      if (!message) {
        return;
      }

      message =
        message.substring(
          0,
          200
        );

      io.emit(
        "chat:message",
        {
          username:
            player.username,

          message
        }
      );
    }
  );

  /* =========================
     DISCONNECT
  ========================== */

  socket.on(
    "disconnect",
    () => {

      const player =
        players.get(socket.id);

      if (player) {

        console.log(
          `${player.username} left the game.`
        );

        players.delete(
          socket.id
        );

        socket.broadcast.emit(
          "player:left",
          socket.id
        );

        updatePlayerCount();
      }

      console.log(
        "Socket disconnected:",
        socket.id
      );
    }
  );
});

/* =========================
   PLAYER COUNT
========================= */

function updatePlayerCount() {

  io.emit(
    "players:count",
    players.size
  );
}

/* =========================
   FALLBACK ROUTE
========================= */

/*
  Express 5 does not accept:
      app.get("*", ...)
  
  So use a normal middleware
  for the frontend fallback.
*/

app.use((req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

/* =========================
   START SERVER
========================= */

async function start() {

  try {

    await setupDatabase();

    server.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log(
          `NovaStrike running on port ${PORT}`
        );

      }
    );

  } catch (error) {

    console.error(
      "Failed to start:",
      error
    );

    process.exit(1);
  }
}

start();
