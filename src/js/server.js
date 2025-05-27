import bcrypt from 'bcrypt';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { isAddress } from 'ethers';
import express from "express";
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import * as tools from './tools.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RC = await tools.constructSmartContract();
const app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use('/static', express.static('src'));
app.use(cookieParser());
app.use(session({
  secret: 'warehouse_secret',
  resave: false,
  saveUninitialized: true
}));

app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

app.get("/", (req, res) => {
  if (req.session.address) {
    // Auto-redirect if already logged in
    const redirectPath = req.session.role === "admin" ? "/admin/dashboard" : "/operator/dashboard";
    return res.redirect(redirectPath);
  }
  res.render("login", { error: null });
});

app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    res.redirect("/");
  });
});

app.post("/login", async (req, res) => {
  const { address, password } = req.body;

  try {
    const [rows] = await db.execute(
      "SELECT * FROM users WHERE address = ?",
      [address.toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).render("login", { error: "⚠️ User not registered." });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).render("login", { error: "⚠️ Incorrect password." });
    }

    // Check role from blockchain
    const isOperator = await RC.operators(address);
    const owner = await RC.owner();

    let role = null;
    if (address.toLowerCase() === owner.toLowerCase()) role = "admin";
    else if (isOperator) role = "operator";

    if (!role) {
      return res.status(403).render("login", { error: "⚠️ Unauthorized address." });
    }

    req.session.address = address;
    req.session.role = role;

    const redirectPath = role === "admin" ? "/admin/dashboard" : "/operator/dashboard";
    res.redirect(redirectPath);

  } catch (err) {
    res.status(500).render("login", { error: "Server error: " + err.message });
  }
});

function requireLogin(role) {
  return (req, res, next) => {
    if (!req.session.address || req.session.role !== role) {
      return res.redirect("/");
    }
    next();
  };
}

app.get("/admin/dashboard", requireLogin("admin"), async (req, res) => {
  try {
    const items = await RC.getAllItems();
    const operators = await RC.getActiveOperators();

    res.render("admin-dashboard", {
      itemCount: items.length,
      operatorCount: operators.length,
      address: req.session.address
    });
  } catch (err) {
    res.status(500).send("Gagal muat dashboard admin: " + err.message);
  }
});

app.get("/admin/operators", requireLogin("admin"), async (req, res) => {
  try {
    const activeOperators = await RC.getActiveOperators();
    res.render("admin-operators", { activeOperators });
  } catch (err) {
    res.status(500).send("Gagal ambil data operator: " + err.message);
  }
});

app.post("/admin/operator/add", requireLogin("admin"), async (req, res) => {
  const { address } = req.body;
  const password = "operator123";

  if (!isAddress(address)) {
    return res.render("admin-operators", {
      activeOperators: await RC.getActiveOperators(),
      error: "⚠️ Alamat Ethereum tidak valid."
    });
  }

  try {
    const tx = await RC.addOperator(address);
    const hash = await bcrypt.hash(password, 10);

    await db.execute(
      "INSERT INTO users (address, password_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE password_hash = ?",
      [address.toLowerCase(), hash, hash]
    );

    res.redirect("/admin/operators");
  } catch (err) {
    const msg = "Gagal menambahkan operator: " + (err.reason || err.message);
    res.render("admin-operators", {
      activeOperators: await RC.getActiveOperators(),
      error: msg
    });
  }
});


app.post("/admin/operator/remove", requireLogin("admin"), async (req, res) => {
  const { address } = req.body;

  try {
    const tx = await RC.removeOperator(address);
    res.redirect("/admin/operators");
  } catch (err) {
    res.status(500).send("Gagal menghapus operator: " + err.message);
  }
});

app.get("/items", requireLogin("admin"), async (req, res) => {
  try {
    const items = await RC.getAllItems();
    res.render("items", { items, error: null });
  } catch (err) {
    res.status(500).render("items", { items: [], error: err.message });
  }
});

app.post("/items/add", requireLogin("admin"), async (req, res) => {
  const { name, category } = req.body;

  if (!name || !category) {
    const items = await RC.getAllItems();
    return res.render("items", { items, error: "⚠️ Nama dan kategori wajib diisi." });
  }

  try {
    const tx = await RC.addItem(name, category);
    res.redirect("/items");
  } catch (err) {
    const items = await RC.getAllItems();
    res.render("items", { items, error: "Gagal menambahkan barang: " + err.message });
  }
});


app.listen(3000, () => {
  console.log("Warehouse server listening on port 3000");
});