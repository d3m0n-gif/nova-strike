const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { Pool } = require("pg");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;

const JWT_SECRET =
  process.env.JWT_SECRET || "CHANGE_THIS_IN_RENDER";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

app.use(express.json());
app.use(cookieParser());
app.use(express.static("public"));

/* =========================
   DATABASE
========================= */

async function setupDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      controls JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log("Database ready.");
}

/* =========================
   DEFAULT CONTROLS
========================= */

const DEFAULT_CONTROLS = {
  forward: "KeyW",
  backward: "KeyS",
  left: "KeyA",
  right: "KeyD",
  sprint: "KeyR",
  slide: "ShiftLeft",
  sneak: "KeyC",
  ability: "KeyQ",
  slot1: "Digit1",
  slot2: "Digit2",
  slot3: "Digit3"
};

/* =========================
   AUTH
========================= */

function createToken(player) {
  return jwt.sign(
    {
      id: player.id,
      username: player.username
    },
    JWT_SECRET,
    {
      expiresIn: "30d"
    }
  );
}

function authenticate(req, res, next) {
  const token = req.cookies.nova_session;

  if (!token) {
    return res.status(401).json({
      error: "Not logged in."
    });
  }

  try {
    req.player = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      error: "Session expired."
    });
  }
}

/* =========================
   REGISTER
========================= */

app.post("/api/register", async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({
        error: "Email, password and username are required."
      });
    }

    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({
        error: "Username must be 2-20 characters."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters."
      });
    }

    const existing = await pool.query(
      `
      SELECT id
      FROM players
      WHERE LOWER(email) = LOWER($1)
         OR LOWER(username) = LOWER($2)
      `,
      [email.trim(), username.trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: "That email or username is already registered."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
      INSERT INTO players
        (email, password_hash, username, controls)
      VALUES
        ($1, $2, $3, $4)
      RETURNING id, email, username, controls
      `,
      [
        email.trim().toLowerCase(),
        passwordHash,
        username.trim(),
        JSON.stringify(DEFAULT_CONTROLS)
      ]
    );

    const player = result.rows[0];

    const token = createToken(player);

    res.cookie("nova_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      player: {
        id: player.id,
        username: player.username,
        controls: player.controls
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Could not create account."
    });
  }
});

/* =========================
   LOGIN
========================= */

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      `
      SELECT *
      FROM players
      WHERE LOWER(email) = LOWER($1)
      `,
      [email?.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Incorrect email or password."
      });
    }

    const player = result.rows[0];

    const valid = await bcrypt.compare(
      password,
      player.password_hash
    );

    if (!valid) {
      return res.status(401).json({
        error: "Incorrect email or password."
      });
    }

    const token = createToken(player);

    res.cookie("nova_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      player: {
        id: player.id,
        username: player.username,
        controls: player.controls
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Login failed."
    });
  }
});

/* =========================
   CURRENT ACCOUNT
========================= */

app.get("/api/me", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, email, username, controls
      FROM players
      WHERE id = $1
      `,
      [req.player.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Account not found."
      });
    }

    res.json({
      player: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Could not load account."
    });
  }
});

/* =========================
   LOGOUT
========================= */

app.post("/api/logout", (req, res) => {
  res.clearCookie("nova_session");

  res.json({
    success: true
  });
});

/* =========================
   SAVE CONTROLS
========================= */

app.put("/api/controls", authenticate, async (req, res) => {
  try {
    const controls = req.body.controls;

    if (!controls || typeof controls !== "object") {
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
        req.player.id
      ]
    );

    res.json({
      success: true,
      controls
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Could not save controls."
    });
  }
});

/* =========================
   ONLINE PLAYERS
========================= */

const players = new Map();

/* =========================
   SOCKET.IO
========================= */

io.on("connection", socket => {

  console.log("Player connected:", socket.id);

  socket.on("player:join", data => {

    if (!data || !data.username) {
      return;
    }

    players.set(socket.id, {
      id: socket.id,
      username: String(data.username).slice(0, 20),

      x: 0,
      y: 1,
      z: 0,

      rotationY: 0,

      state: "normal",

      character: "default",
      cosmetic: "default"
    });

    socket.emit("players:list", {
      players: Array.from(players.values())
    });

    socket.broadcast.emit(
      "player:joined",
      players.get(socket.id)
    );
  });

  socket.on("player:update", data => {

    const player = players.get(socket.id);

    if (!player) {
      return;
    }

    if (typeof data.x === "number") {
      player.x = data.x;
    }

    if (typeof data.y === "number") {
      player.y = data.y;
    }

    if (typeof data.z === "number") {
      player.z = data.z;
    }

    if (typeof data.rotationY === "number") {
      player.rotationY = data.rotationY;
    }

    if (typeof data.state === "string") {
      player.state = data.state;
    }

    socket.broadcast.emit(
      "player:update",
      player
    );
  });

  /* =========================
     REAL-TIME CHAT
  ========================= */

  socket.on("chat:send", message => {

    const player = players.get(socket.id);

    if (!player) {
      return;
    }

    if (typeof message !== "string") {
      return;
    }

    const cleanMessage = message
      .trim()
      .slice(0, 200);

    if (!cleanMessage) {
      return;
    }

    io.emit("chat:message", {
      username: player.username,
      message: cleanMessage,
      time: Date.now()
    });
  });

  /* =========================
     DISCONNECT
  ========================= */

  socket.on("disconnect", () => {

    console.log("Player disconnected:", socket.id);

    if (players.has(socket.id)) {

      players.delete(socket.id);

      io.emit(
        "player:left",
        socket.id
      );
    }
  });
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    online: true,
    players: players.size
  });
});

/* =========================
   START SERVER
========================= */

setupDatabase()
  .then(() => {

    server.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `NovaStrike server running on port ${PORT}`
        );
      }
    );

  })
  .catch(error => {

    console.error(
      "Database startup failed:",
      error
    );

    process.exit(1);
  });
