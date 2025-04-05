// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LegitToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1000000 * 10**18; // 1 million tokens
    uint256 public constant INITIAL_SUPPLY = 100000 * 10**18; // 100k tokens

    constructor() ERC20("LegitToken", "LGT") Ownable(msg.sender) {
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    // Standard mint function with clear limits
    function mint(address to, uint256 amount) public onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Would exceed max supply");
        _mint(to, amount);
    }

    // Standard burn function
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    // Transparent view functions
    function getTokenInfo() public view returns (
        string memory tokenName,
        string memory tokenSymbol,
        uint256 currentSupply,
        uint256 maxSupply
    ) {
        return (
            name(),
            symbol(),
            totalSupply(),
            MAX_SUPPLY
        );
    }
} 