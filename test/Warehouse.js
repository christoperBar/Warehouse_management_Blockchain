import hardhat from "hardhat";
const { ethers } = hardhat;

import chai from "chai";
const { expect } = chai;

describe("Warehouse Contract", function () {
    let Warehouse, warehouse, owner, operator1, operator2, outsider, addr1;

    before(async function () {
        [owner, operator1, operator2, outsider] = await ethers.getSigners();
        const Warehouse = await ethers.getContractFactory("Warehouse");
        warehouse = await Warehouse.deploy();
        await warehouse.waitForDeployment();
    });

    it("1. Hanya owner dapat menambahkan operator", async function () {
        await expect(warehouse.connect(owner).addOperator(operator1.address))
            .to.emit(warehouse, "OperatorChanged")
            .withArgs(operator1.address, true);

        const activeOperators = await warehouse.getActiveOperators();
        expect(activeOperators).to.include(operator1.address);

        await expect(
            warehouse.connect(operator1).addOperator(operator2.address)
        ).to.be.revertedWith("Not owner");
    });

    it("2. Owner dapat menambahkan item", async function () {
        await expect(
            warehouse.connect(owner).addItem("Item A", "Category X")
        ).to.emit(warehouse, "ItemAdded").withArgs(1, "Item A");

        const item = await warehouse.getItemById(1);
        expect(item.name).to.equal("Item A");
        expect(item.category).to.equal("Category X");
        expect(item.quantity).to.equal(0);
        expect(item.isActive).to.be.true;

        await expect(
            warehouse.connect(outsider).addItem("Item B", "Category Y")
        ).to.be.revertedWith("Not owner");
    });

    it("3. Operator dapat melakukan stockIn", async function () {
        await expect(
            warehouse.connect(operator1).stockIn(
                [1],
                [20],
                "Restock Item A"
            )
        ).to.emit(warehouse, "StockCheckedIn");

        const item = await warehouse.getItemById(1);
        expect(item.quantity).to.equal(20);

        const log = await warehouse.getLog(0);
        expect(log.note).to.equal("Restock Item A");
        expect(log.action).to.equal(0);
        expect(log.operator).to.equal(operator1.address);
    });

    it("4. Operator dapat melakukan stockOut dengan validasi jumlah", async function () {
        await expect(
            warehouse.connect(operator1).stockOut(
                [1],
                [5],
                "Pengambilan stok untuk pengiriman"
            )
        ).to.emit(warehouse, "StockCheckedOut");

        const item = await warehouse.getItemById(1);
        expect(item.quantity).to.equal(15);

        const log = await warehouse.getLog(1);
        expect(log.note).to.equal("Pengambilan stok untuk pengiriman");
        expect(log.action).to.equal(1);
        expect(log.operator).to.equal(operator1.address);
    });

    it("5. Validasi gagal: stockOut melebihi stok, item tidak aktif, atau bukan operator", async function () {
        await warehouse.connect(owner).addItem("Item B", "Category Z");
        await expect(
            warehouse.connect(operator1).stockOut([2], [10], "Ambil stok kosong")
        ).to.be.revertedWith("Insufficient stock");

        await expect(
            warehouse.connect(outsider).stockIn([1], [10], "Gagal stock in")
        ).to.be.revertedWith("Not operator");

        await expect(
            warehouse.connect(outsider).stockOut([1], [1], "Gagal stock out")
        ).to.be.revertedWith("Not operator");
    });

    it("6. getAllItems dan getLog mengembalikan data yang benar", async function () {
        const items = await warehouse.getAllItems();
        expect(items.length).to.equal(2);
        expect(items[0].name).to.equal("Item A");
        expect(items[1].name).to.equal("Item B");

        const log = await warehouse.getLog(0);
        expect(log.note).to.equal("Restock Item A");
    });

    it("7. Owner dapat menghapus operator", async function () {
        await expect(warehouse.connect(owner).removeOperator(operator1.address))
            .to.emit(warehouse, "OperatorChanged")
            .withArgs(operator1.address, false);

        const active = await warehouse.getActiveOperators();
        expect(active).to.not.include(operator1.address);

        await expect(
            warehouse.connect(operator1).addItem("Should fail", "No access")
        ).to.be.revertedWith("Not owner");
    });

    it("8. Fungsi getTodayStockInOut mengembalikan jumlah transaksi hari ini", async function () {
        const [inToday, outToday] = await warehouse.getTodayStockInOut();
        expect(inToday).to.equal(1); 
        expect(outToday).to.equal(1); 
    });

    it("9. Fungsi getTotalLogs mengembalikan jumlah log yang benar", async function () {
        const totalLogs = await warehouse.getTotalLogs();
        expect(totalLogs).to.equal(2);
    });
});
