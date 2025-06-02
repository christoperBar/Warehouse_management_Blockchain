// import { ethers } from "ethers";
// import WarehouseArtifact from "../contracts/Warehouse.json" with { type: "json"};
// import contractAddress from "../contracts/contract-address.json" with { type: "json"};



// const provider = new ethers.JsonRpcProvider("http://localhost:8545");

// export async function constructSmartContract() {
//     return (new ethers.Contract(ethers.getAddress(contractAddress.Warehouse), WarehouseArtifact.abi, await provider.getSigner(0)));
// }

import { ethers } from "ethers";
import WarehouseArtifact from "../contracts/Warehouse.json" with { type: "json" };
import contractAddress from "../contracts/contract-address.json" with { type: "json" };

const provider = new ethers.JsonRpcProvider("http://localhost:8545");

export async function constructSmartContract(userAddress = null) {
    // If no address provided, return a read-only instance
    if (!userAddress) {
        return new ethers.Contract(
            ethers.getAddress(contractAddress.Warehouse),
            WarehouseArtifact.abi,
            provider
        );
    }

    // Create instance with the specific user's signer
    const signer = await provider.getSigner(userAddress);
    return new ethers.Contract(
        ethers.getAddress(contractAddress.Warehouse),
        WarehouseArtifact.abi,
        signer
    );
}