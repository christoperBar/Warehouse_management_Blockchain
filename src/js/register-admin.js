import bcrypt from 'bcrypt';
import { db } from './db.js';
import * as tools from './tools.mjs';

const RC = await tools.constructSmartContract();

async function registerAdmin() {
  try {
    const ownerAddress = await RC.owner();
    const plainPassword = 'admin123'; // ganti kalau perlu

    const hash = await bcrypt.hash(plainPassword, 10);

    await db.execute(
      "INSERT INTO users (address, password_hash) VALUES (?, ?)",
      [ownerAddress.toLowerCase(), hash]
    );

    console.log(`✅ Admin (${ownerAddress}) registered successfully.`);
  } catch (err) {
    console.error("❌ Error registering admin:", err.message);
  } finally {
    db.end();
  }
}

registerAdmin();