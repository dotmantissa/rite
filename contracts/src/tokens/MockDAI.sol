// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockDAI
/// @notice Testnet DAI with 18 decimals. Available as a staking and lending asset.
contract MockDAI is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 1000 * 1e18;
    uint256 public constant FAUCET_COOLDOWN = 1 days;

    mapping(address => uint256) public lastFaucetTime;

    event Minted(address indexed to, uint256 amount);

    constructor(address initialOwner) ERC20("Dai Stablecoin", "DAI") Ownable(initialOwner) {
        _mint(initialOwner, 100_000_000 * 1e18);
    }

    /// @notice Claim 1000 DAI once per day (testnet only).
    function faucet() external {
        require(
            block.timestamp >= lastFaucetTime[msg.sender] + FAUCET_COOLDOWN,
            "DAI: faucet cooldown active"
        );
        lastFaucetTime[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit Minted(msg.sender, FAUCET_AMOUNT);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit Minted(to, amount);
    }
}
