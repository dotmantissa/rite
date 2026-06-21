// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/tokens/RITToken.sol";
import "../src/tokens/MockUSDC.sol";
import "../src/tokens/MockDAI.sol";
import "../src/RiteSwap.sol";
import "../src/RiteStaking.sol";
import "../src/RiteLending.sol";

/// @notice Deploys and funds all Rite protocol contracts on Ritual testnet.
contract Deploy is Script {
    function run() external {
        uint256 pk       = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        console.log("Deployer:", deployer);
        console.log("Chain:   ", block.chainid);

        vm.startBroadcast(pk);

        // 1. Deploy tokens
        RITToken  rit  = new RITToken(deployer);
        MockUSDC  usdc = new MockUSDC(deployer);
        MockDAI   dai  = new MockDAI(deployer);

        console.log("RIT  :", address(rit));
        console.log("USDC :", address(usdc));
        console.log("DAI  :", address(dai));

        // 2. Deploy protocol contracts
        RiteSwap    swap    = new RiteSwap(address(rit), address(usdc), address(dai), deployer);
        RiteStaking staking = new RiteStaking(address(rit), address(usdc), address(dai));
        RiteLending lending = new RiteLending(address(usdc), address(dai));

        console.log("RiteSwap    :", address(swap));
        console.log("RiteStaking :", address(staking));
        console.log("RiteLending :", address(lending));

        // 3. Fund the swap pool
        rit.approve(address(swap),  type(uint256).max);
        usdc.approve(address(swap), type(uint256).max);
        dai.approve(address(swap),  type(uint256).max);

        swap.addLiquidity(address(rit),   200_000 * 1e18);   // 200k RIT
        swap.addLiquidity(address(usdc),  2_000_000 * 1e6);  // 2M USDC
        swap.addLiquidity(address(dai),   2_000_000 * 1e18); // 2M DAI

        // 4. Fund the staking reward pools
        usdc.approve(address(staking), type(uint256).max);
        dai.approve(address(staking),  type(uint256).max);

        staking.fundRewardPool(address(usdc), 500_000 * 1e6);  // 500k USDC (for RIT + USDC stakers)
        staking.fundRewardPool(address(dai),  500_000 * 1e18); // 500k DAI (for DAI stakers)

        // 5. Fund the lending pools
        usdc.approve(address(lending), type(uint256).max);
        dai.approve(address(lending),  type(uint256).max);

        lending.fundPool(address(usdc), 500_000 * 1e6);   // 500k USDC
        lending.fundPool(address(dai),  500_000 * 1e18);  // 500k DAI

        vm.stopBroadcast();

        // Print the addresses.json for the frontend
        console.log("\n--- addresses.json ---");
        console.log("{");
        console.log('  "chainId": 1979,');
        console.log('  "rit":     "%s",', address(rit));
        console.log('  "usdc":    "%s",', address(usdc));
        console.log('  "dai":     "%s",', address(dai));
        console.log('  "swap":    "%s",', address(swap));
        console.log('  "staking": "%s",', address(staking));
        console.log('  "lending": "%s"',  address(lending));
        console.log("}");
    }
}
