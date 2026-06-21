// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title RITToken
/// @notice Native governance and yield token for the Rite protocol on Ritual Chain.
///         Staking RIT earns significantly higher returns than stablecoins, paid in USDC.
///         On testnet, the faucet lets anyone top up without waiting for a bridge.
contract RITToken is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 100 * 1e18;
    uint256 public constant FAUCET_COOLDOWN = 1 days;

    mapping(address => uint256) public lastFaucetTime;

    event Minted(address indexed to, uint256 amount);

    constructor(address initialOwner) ERC20("Rite Token", "RIT") Ownable(initialOwner) {
        _mint(initialOwner, 10_000_000 * 1e18);
    }

    /// @notice Claim 100 RIT once per day (testnet only).
    function faucet() external {
        require(
            block.timestamp >= lastFaucetTime[msg.sender] + FAUCET_COOLDOWN,
            "RIT: faucet cooldown active"
        );
        lastFaucetTime[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit Minted(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Owner can mint to any address (for funding protocol reserves).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit Minted(to, amount);
    }
}
