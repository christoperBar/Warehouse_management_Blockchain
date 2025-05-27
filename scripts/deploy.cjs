const path = require("path");

async function main() {
    // This is just a convenience check
    if (network.name === "hardhat") {
      console.warn(
        "You are trying to deploy a contract to the Hardhat Network, which" +
          "gets automatically created and destroyed every time. Use the Hardhat" +
          " option '--network localhost'"
      );
    }
  
    // ethers is available in the global scope
    const [deployer] = await ethers.getSigners();
    console.log(
      "Deploying the contracts with the account:",
      await deployer.getAddress()
    );
  
    const Warehouse = await ethers.getContractFactory("Warehouse");
    const warehouse = await Warehouse.deploy();

    //console.log(JSON.stringify(warehouse));
    //console.log(warehouse.target);
  
    console.log("Warehouse smart contract address:", warehouse.target);
  
    // We also save the contract's artifacts and address in the frontend directory
    saveFrontendFiles(warehouse);
  }

  function saveFrontendFiles(warehouse) {
    const fs = require("fs");
    const contractsDir = path.join(__dirname, "..", "src", "contracts");
  
    if (!fs.existsSync(contractsDir)) {
      fs.mkdirSync(contractsDir);
    }
  
    fs.writeFileSync(
      path.join(contractsDir, "contract-address.json"),
      JSON.stringify({ Warehouse: warehouse.target }, undefined, 2)
    );
  
    const WarehouseArtifact = artifacts.readArtifactSync("Warehouse");
  
    fs.writeFileSync(
      path.join(contractsDir, "Warehouse.json"),
      JSON.stringify(WarehouseArtifact, null, 2)
    );
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });