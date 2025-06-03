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
import moment from 'moment';
import 'moment/locale/id.js';
moment.locale('id');

const todayDate = moment().format('dddd, D MMMM YYYY');
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
app.use(async (req, res, next) => {
    req.RC = await tools.constructSmartContract();
    if (req.session.address) {
        req.RC = await tools.constructSmartContract(req.session.address);
    }
    next();
});

// punya berdua
app.get("/", (req, res) => {
  if (req.session.address) {
    const redirectPath = req.session.role === "admin" ? "/admin/dashboard" : "/operator/dashboard";
    return res.redirect(redirectPath);
  }
  res.render("login", { error: null });
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

app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    res.redirect("/");
  });
});

app.post("/change-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const address = req.session.address;

  try {
    const [rows] = await db.execute("SELECT * FROM users WHERE address = ?", [address]);
    if (rows.length === 0)
      return res.render("change-password", {
        error: "User tidak ditemukan",
        success: null,
        role: req.session.role,
        address: req.session.address
      });

    const user = rows[0];
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match)
      return res.render("change-password", {
        error: "Password lama salah",
        success: null,
        role: req.session.role,
        address: req.session.address
      });

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.execute("UPDATE users SET password_hash = ? WHERE address = ?", [newHash, address]);

    res.render("change-password", {
      error: null,
      success: "Password berhasil diperbarui!",
      role: req.session.role,
      address: req.session.address
    });

  } catch (err) {
    res.render("change-password", {
      error: "Server error: " + err.message,
      success: null,
      role: req.session.role,
      address: req.session.address
    });
  }
});

app.get("/change-password", (req, res) => {
  if (!req.session.address) return res.redirect("/");
  res.render("change-password", {
    error: null,
    success: null,
    role: req.session.role,
    address: req.session.address
  });
});

app.get("/logs", async (req, res) => {
  if (!req.session.address) return res.redirect("/");

  try {
    const selectedDate = req.query.date || null;
    let logs = [];
    let summary = { checkIn: 0, checkOut: 0, total: 0 };
    const totalLogs = await req.RC.getTotalLogs();

    for (let i = 0; i < totalLogs; i++) {
      try {
        const logData = await req.RC.getLog(i);
        const timestamp = parseInt(logData.timestamp.toString());
        const logDate = new Date(timestamp * 1000);
        
        if (selectedDate) {
          const selectedDateObj = new Date(selectedDate + 'T00:00:00');
          const logDateOnly = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
          const selectedDateOnly = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate());
          
          if (logDateOnly.getTime() !== selectedDateOnly.getTime()) {
            continue;
          }
        }

        const items = [];
        for (let j = 0; j < logData.itemIds.length; j++) {
          const item = await req.RC.getItemById(logData.itemIds[j]);
          items.push({
            id: item.id.toString(),
            name: item.name,
            amount: logData.amounts[j].toString()
          });
        }
        const actionValue = parseInt(logData.action.toString());
        const actionText = actionValue === 0 ? 'CheckIn' : 'CheckOut';
        logs.push({
          timestamp: timestamp,
          action: actionText,
          operator: logData.operator,
          note: logData.note,
          items: items,
          timeFormatted: moment.unix(timestamp).format('HH:mm:ss'),
          dateFormatted: moment.unix(timestamp).format('DD MMM YYYY')
        });

        if (actionText === 'CheckIn') {
          summary.checkIn++;
        } else {
          summary.checkOut++;
        }
        summary.total++;

      } catch (error) {
        console.log(`Error getting log ${i}:`, error.message);
      }
      
    }
    logs.sort((a, b) => b.timestamp - a.timestamp);
    
    const selectedDateFormatted = selectedDate ? 
      moment(selectedDate).format('dddd, D MMMM YYYY') : 
      'Semua Data';
    
    res.render("logs", {
      logs,
      summary,
      selectedDate: selectedDate || '',
      selectedDateFormatted,
      role: req.session.role,
      address: req.session.address
    });
    
  } catch (err) {
    console.error("Error loading logs:", err);
    res.status(500).send("Gagal memuat logs: " + err.message);
  }
});

//admin punya
app.get("/admin/dashboard", requireLogin("admin"), async (req, res) => {
  try {
    const items = await req.RC.getAllItems();
    const operators = await req.RC.getActiveOperators();
    const [stockInToday, stockOutToday] = await req.RC.getTodayStockInOut();

    res.render("admin-dashboard", {
      itemCount: items.length,
      operatorCount: operators.length,
      stockInToday: stockInToday.toString(),
      stockOutToday: stockOutToday.toString(),
      logsToday: (stockOutToday + stockInToday).toString(),
      address: req.session.address,
      todayDate
    });
  } catch (err) {
    console.error("Error loading dashboard:", err);
    res.status(500).send("Gagal muat dashboard admin: " + err.message);
  }
});

app.get("/admin/operators", requireLogin("admin"), async (req, res) => {
  try {
    const activeOperators = await req.RC.getActiveOperators();
    res.render("admin-operators", {
      activeOperators,
      error: null,
      address: req.session.address
    });
  } catch (err) {
    res.status(500).render("admin-operators", {
      activeOperators: [],
      error: err.message,
      address: req.session.address
    });
  }
});


app.post("/admin/operator/add", requireLogin("admin"), async (req, res) => {
  const { address } = req.body;
  const password = "operator123";

  if (!isAddress(address)) {
    return res.render("admin-operators", {
      activeOperators: await req.RC.getActiveOperators(),
      error: "⚠️ Alamat Ethereum tidak valid."
    });
  }

  try {
    const tx = await req.RC.addOperator(address);
    const hash = await bcrypt.hash(password, 10);

    await db.execute(
      "INSERT INTO users (address, password_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE password_hash = ?",
      [address.toLowerCase(), hash, hash]
    );

    res.redirect("/admin/operators");
  } catch (err) {
    const msg = "Gagal menambahkan operator: " + (err.reason || err.message);
    res.render("admin-operators", {
      activeOperators: await req.RC.getActiveOperators(),
      error: msg
    });
  }
});


app.post("/admin/operator/remove", requireLogin("admin"), async (req, res) => {
  const { address } = req.body;

  try {
    const tx = await req.RC.removeOperator(address);
    res.redirect("/admin/operators");
  } catch (err) {
    res.status(500).send("Gagal menghapus operator: " + err.message);
  }
});

app.get("/admin/items", requireLogin("admin"), async (req, res) => {
  try {
    const items = await req.RC.getAllItems();
    res.render("items", {
      items,
      error: null,
      address: req.session.address
    });
  } catch (err) {
    res.status(500).render("items", {
      items: [],
      error: err.message,
      address: req.session.address
    });
  }
});


app.post("/admin/items/add", requireLogin("admin"), async (req, res) => {
  const { name, category } = req.body;

  if (!name || !category) {
    const items = await req.RC.getAllItems();
    return res.render("items", { items, error: "⚠️ Nama dan kategori wajib diisi." });
  }

  try {
    const tx = await req.RC.addItem(name, category);
    res.redirect("/admin/items");
  } catch (err) {
    const items = await req.RC.getAllItems();
    res.render("items", { items, error: "Gagal menambahkan barang: " + err.message });
  }
});


//operator punya
app.get("/operator/dashboard", requireLogin("operator"), async (req, res) => {
  try {
    const [stockInToday, stockOutToday] = await req.RC.getTodayStockInOut();

    res.render("operator-dashboard", {
      stockInToday: stockInToday.toString(),
      stockOutToday: stockOutToday.toString(),
      logsToday: (stockOutToday + stockInToday).toString(),
      address: req.session.address,
      todayDate
    });
  } catch (err) {
    console.error("Error loading dashboard:", err);
    res.status(500).send("Gagal muat dashboard operator: " + err.message);
  }
});

app.get("/operator/items", requireLogin("operator"), async (req, res) => {
  try {
    const items = await req.RC.getAllItems();
    res.render("operator-items", {
      items,
      error: null,
      address: req.session.address
    });
  } catch (err) {
    res.status(500).render("operator-items", {
      items: [],
      error: err.message,
      address: req.session.address
    });
  }
});

app.get('/operator/checkin', requireLogin("operator"), async (req, res) => {
  try {
    const items = await req.RC.getAllItems(); 
    res.render('operator-checkin', {
      items,
      error: null,
      success: null,
      address: req.session.address,
    });
  } catch (err) {
    res.render('operator-checkin', {
      items: [],
      error: err.message,
      success: null,
      address: req.session.address,
    });
  }
});

app.post('/operator/checkin', requireLogin("operator"), async (req, res) => {
  const { itemIds, amounts, note } = req.body;

  try {
    const ids = itemIds.map(Number);
    const qtys = amounts.map(Number);

    const tx = await req.RC.stockIn(ids, qtys, note);
    res.redirect("/operator/dashboard");
  } catch (err) {
    const items = await req.RC.getAllItems(); 
    res.render('operator-checkin', {
      items,
      error: err.message,
      success: null,
      address: req.session.address,
    });
  }
});

app.get('/operator/checkout', requireLogin("operator"), async (req, res) => {
  try {
    const items = await req.RC.getAllItems(); 
    res.render('operator-checkout', {
      items,
      error: null,
      success: null,
      address: req.session.address,
    });
  } catch (err) {
    res.render('operator-checkout', {
      items: [],
      error: err.message,
      success: null,
      address: req.session.address,
    });
  }
});

app.post('/operator/checkout', requireLogin("operator"), async (req, res) => {
  const { itemIds, amounts, note } = req.body;

  try {
    if (!itemIds || !amounts) {
      throw new Error("Pilih minimal 1 barang");
    }

    const ids = itemIds.map(Number);
    const qtys = amounts.map(Number);
    const items = await req.RC.getAllItems();
    items.forEach(item => {
      const idx = ids.indexOf(item.id);
      if (idx !== -1 && item.stock < qtys[idx]) {
        throw new Error(`Stok ${item.name} tidak mencukupi`);
      }
    });

    const tx = await req.RC.stockOut(ids, qtys, note);
    res.redirect("/operator/dashboard");
  } catch (err) {
    const items = await req.RC.getAllItems(); 
    res.render('operator-checkout', {
      items,
      error: err.message,
      success: null,
      address: req.session.address,
    });
  }
});

app.listen(3000, () => {
  console.log("Warehouse server listening on port 3000");
});