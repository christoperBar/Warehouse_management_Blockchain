// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Warehouse {
    enum Action {CheckIn, CheckOut }
    struct Item {
        uint256 id;
        string name;
        string category;
        uint256 quantity;
        bool isActive;
    }
    
    struct LogItem {
        uint256 itemId;
        uint256 amount;
    }

    struct Log {
        uint256 timestamp;
        LogItem[] items;
        Action action;
        address operator;
        string note;
    }

    address public owner;
    uint private nextItemId = 1;

    mapping(uint256 => Item) public items;
    mapping(address => bool) public operators;
    address[] private operatorList;
    Log[] public logs;

    event ItemAdded(uint itemId, string name);
    
    event StockCheckedIn(
        uint256 indexed timestamp,
        address indexed operator,
        string note,
        uint256[] itemIds,
        uint256[] amounts
    );
    event StockCheckedOut(
        uint256 indexed timestamp,
        address indexed operator,
        string note,
        uint256[] itemIds,
        uint256[] amounts
    );
    event OperatorChanged(address operator, bool status);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyOperator() {
        require(operators[msg.sender], "Not operator");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function addOperator(address _operator) public onlyOwner {
        require(!operators[_operator], "Already operator");
        operators[_operator] = true;

        bool exists = false;
        for (uint i = 0; i < operatorList.length; i++) {
            if (operatorList[i] == _operator) {
                exists = true;
                break;
            }
        }

        if (!exists) {
            operatorList.push(_operator);
        }

        emit OperatorChanged(_operator, true);
    }

    function removeOperator(address _operator) public onlyOwner {
        require(operators[_operator], "Not an operator");
        operators[_operator] = false;
        emit OperatorChanged(_operator, false);
    }

    function getActiveOperators() public view returns (address[] memory) {
        uint count = 0;
        for (uint i = 0; i < operatorList.length; i++) {
            if (operators[operatorList[i]]) {
                count++;
            }
        }
        address[] memory active = new address[](count);
        uint index = 0;
        for (uint i = 0; i < operatorList.length; i++) {
            if (operators[operatorList[i]]) {
                active[index++] = operatorList[i];
            }
        }
        return active;
    }

    function addItem(string memory name, string memory category) public onlyOwner {
        items[nextItemId] = Item(nextItemId, name, category, 0, true);
        emit ItemAdded(nextItemId, name);
        nextItemId++;
    }

    function getAllItems() public view returns (Item[] memory) {
        Item[] memory result = new Item[](nextItemId - 1);
        for (uint i = 1; i < nextItemId; i++) {
            result[i - 1] = items[i];
        }
        return result;
    }

    function getItemById(uint itemId) public view returns (Item memory) {
        return items[itemId];
    }

    function getAllOperators() public view returns (address[] memory) {
        return operatorList;
    }

    function stockIn(
        uint256[] memory itemIds,
        uint256[] memory amounts,
        string memory note
    ) public onlyOperator {
        require(itemIds.length == amounts.length, "Input array length mismatch");
        logs.push();

        Log storage newLog = logs[logs.length - 1];
        newLog.timestamp = block.timestamp;
        newLog.action = Action.CheckIn;
        newLog.operator = msg.sender;
        newLog.note = note;

        for (uint256 i = 0; i < itemIds.length; i++) {
            uint256 itemId = itemIds[i];
            uint256 amount = amounts[i];

            require(items[itemId].isActive, "Item not active");

            items[itemId].quantity += amount;

            newLog.items.push(LogItem({
                itemId: itemId,
                amount: amount
            }));
        }
        emit StockCheckedIn(block.timestamp, msg.sender, note, itemIds, amounts);
    }

    function stockOut(
        uint256[] memory itemIds,
        uint256[] memory amounts,
        string memory note
    ) public onlyOperator {
        require(itemIds.length == amounts.length, "Input array length mismatch");

        logs.push();
        Log storage newLog = logs[logs.length - 1];
        newLog.timestamp = block.timestamp;
        newLog.action = Action.CheckOut;
        newLog.operator = msg.sender;
        newLog.note = note;

        for (uint256 i = 0; i < itemIds.length; i++) {
            uint256 itemId = itemIds[i];
            uint256 amount = amounts[i];

            require(items[itemId].isActive, "Item not active");
            require(items[itemId].quantity >= amount, "Insufficient stock");

            items[itemId].quantity -= amount;

            newLog.items.push(LogItem({
                itemId: itemId,
                amount: amount
            }));
        }

        emit StockCheckedOut(block.timestamp, msg.sender, note, itemIds, amounts);
    }

    function getLog(uint256 index) public view returns (
        uint256 timestamp,
        Action action,
        address operator,
        string memory note,
        uint256[] memory itemIds,
        uint256[] memory amounts
    ) {
        require(index < logs.length || index >= 0, "Log index out of bounds");

        Log storage log = logs[index];
        uint256 len = log.items.length;

        itemIds = new uint256[](len);
        amounts = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            itemIds[i] = log.items[i].itemId;
            amounts[i] = log.items[i].amount;
        }

        return (
            log.timestamp,
            log.action,
            log.operator,
            log.note,
            itemIds,
            amounts
        );
    }
}
