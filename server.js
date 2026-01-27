
import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

// ---------- INIT APP ----------
const app = express();
app.use(express.json());
app.use(cors({
  origin: "*",        // allow your frontend to access the API
  methods: "GET,POST,PUT,PATCH,DELETE"
}));

// ---------- INIT DATABASE ----------
let db;

async function initDB() {
  db = await open({
    filename: './freezer.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location TEXT NOT NULL,
      batchId TEXT,
      quantity INTEGER,
      expiry TEXT,
      owner TEXT,
      notes TEXT,
      createdAt TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location TEXT UNIQUE,
      titleText TEXT
    );
  `);

  console.log("Database initialized");
}

// ---------- API ROUTES ----------

// GET all items
app.get("/items", async (req, res) => {
  const rows = await db.all("SELECT * FROM items");
  res.json(rows);
});

// CREATE new item
app.post("/items", async (req, res) => {
  const { location, batchId, quantity, expiry, owner, notes } = req.body;
  const createdAt = new Date().toISOString();

  const result = await db.run(
    `INSERT INTO items (location, batchId, quantity, expiry, owner, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [location, batchId, quantity, expiry, owner, notes, createdAt]
  );

  res.json({ id: result.lastID });
});

// UPDATE item
app.patch("/items/:id", async (req, res) => {
  const { id } = req.params;
  const fields = req.body;

  const keys = Object.keys(fields);
  const values = Object.values(fields);

  const setString = keys.map(k => `${k} = ?`).join(", ");

  await db.run(
    `UPDATE items SET ${setString} WHERE id = ?`,
    [...values, id]
  );

  res.json({ success: true });
});

// DELETE item
app.delete("/items/:id", async (req, res) => {
  const { id } = req.params;
  await db.run(`DELETE FROM items WHERE id = ?`, [id]);
  res.json({ success: true });
});

// ---------- TITLES API ----------

// GET all titles
app.get("/titles", async (req, res) => {
  const rows = await db.all("SELECT * FROM titles");
  res.json(rows);
});

// UPSERT title
app.post("/titles", async (req, res) => {
  const { location, titleText } = req.body;

  // Try update
  const exists = await db.get(
    `SELECT id FROM titles WHERE location = ?`,
    [location]
  );

  if (exists) {
    await db.run(
      `UPDATE titles SET titleText = ? WHERE location = ?`,
      [titleText, location]
    );
    res.json({ updated: true });
  } else {
    const result = await db.run(
      `INSERT INTO titles (location, titleText) VALUES (?, ?)`,
      [location, titleText]
    );
    res.json({ created: result.lastID });
  }
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 10000;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log("Backend running on port " + PORT);
  });
});
