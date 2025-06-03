import { ethers } from "ethers";
import WarehouseArtifact from "../contracts/Warehouse.json" with { type: "json" };
import contractAddress from "../contracts/contract-address.json" with { type: "json" };

const provider = new ethers.JsonRpcProvider("http://localhost:8545");

export async function constructSmartContract(userAddress = null) {
    if (!userAddress) {
        return new ethers.Contract(
            ethers.getAddress(contractAddress.Warehouse),
            WarehouseArtifact.abi,
            provider
        );
    }
    const signer = await provider.getSigner(userAddress);
    return new ethers.Contract(
        ethers.getAddress(contractAddress.Warehouse),
        WarehouseArtifact.abi,
        signer
    );
}
