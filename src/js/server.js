import express from "express";
import * as tools  from './tools.mjs'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RC = await tools.constructSmartContract();
const app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use('/static', express.static('src'));
app.use(cookieParser());

app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));


app.post("/operator/add", async (req, res) => {
  try {
    const tx = await RC.addOperator(req.body.address);
    res.json({ status: "success", tx });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/operators/active", async (req, res) => {
  try {
    const ops = await RC.getActiveOperators();
    res.json(ops);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Warehouse server listening on port 3000");
});