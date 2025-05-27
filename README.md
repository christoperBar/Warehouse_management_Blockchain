# Warehouse Management website using Blockchain

### Project ini tentang Management Gudang sederhana menggunakan Blockchain 

## Setup
- npm init
- npm install --save-dev hardhat
- npm install --save-dev @nomicfoundation/hardhat-toolbox

## Start local blockchain node
- npx hardhat node

## Tambahan
- npm install -D tailwindcss
- npm install ejs
- npm install express-session mysql2 bcrypt

## Deploy
- npx hardhat run scripts/deploy.cjs --network localhost
- node src/js/server.js

## Setelah deploy
- registerkan owner (node src/js/register-admin.js)
