// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RiteStaking.sol";
import "../src/tokens/RITToken.sol";
import "../src/tokens/MockUSDC.sol";
import "../src/tokens/MockDAI.sol";

contract RiteStakingTest is Test {
    RiteStaking staking;
    RITToken    rit;
    MockUSDC    usdc;
    MockDAI     dai;

    address owner = address(this);
    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");

    function setUp() public {
        rit     = new RITToken(owner);
        usdc    = new MockUSDC(owner);
        dai     = new MockDAI(owner);
        staking = new RiteStaking(address(rit), address(usdc), address(dai));

        // Fund reward pools
        usdc.approve(address(staking), type(uint256).max);
        dai.approve(address(staking), type(uint256).max);
        rit.approve(address(staking), type(uint256).max);
        staking.fundRewardPool(address(usdc), 1_000_000 * 1e6);
        staking.fundRewardPool(address(dai),  1_000_000 * 1e18);

        // Give users tokens
        rit.transfer(alice, 1000 * 1e18);
        usdc.transfer(alice, 10_000 * 1e6);
        dai.transfer(alice, 10_000 * 1e18);
        rit.transfer(bob, 100 * 1e18);
    }

    // --- previewReward ---

    function test_preview_USDC_24h() public view {
        (uint256 reward, address rewardToken) =
            staking.previewReward(address(usdc), 100 * 1e6, 24);
        // 100 USDC * 10% (1000 bps) = 10 USDC
        assertEq(reward, 10 * 1e6);
        assertEq(rewardToken, address(usdc));
    }

    function test_preview_USDC_12h() public view {
        (uint256 reward,) = staking.previewReward(address(usdc), 100 * 1e6, 12);
        // 100 USDC * 5% (500 bps) = 5 USDC
        assertEq(reward, 5 * 1e6);
    }

    function test_preview_USDC_168h() public view {
        (uint256 reward,) = staking.previewReward(address(usdc), 100 * 1e6, 168);
        // 100 USDC * 25% (2500 bps) = 25 USDC
        assertEq(reward, 25 * 1e6);
    }

    function test_preview_RIT_24h() public view {
        (uint256 reward, address rewardToken) =
            staking.previewReward(address(rit), 1e18, 24);
        // 1 RIT * 10 USDC/RIT * 100% (10000 bps) = 10 USDC
        assertEq(reward, 10 * 1e6);
        assertEq(rewardToken, address(usdc));
    }

    function test_preview_RIT_12h() public view {
        (uint256 reward,) = staking.previewReward(address(rit), 1e18, 12);
        // 1 RIT * 10 USDC/RIT * 50% = 5 USDC
        assertEq(reward, 5 * 1e6);
    }

    function test_preview_DAI_48h() public view {
        (uint256 reward,) = staking.previewReward(address(dai), 100 * 1e18, 48);
        // 100 DAI * 15% (1500 bps) = 15 DAI
        assertEq(reward, 15 * 1e18);
    }

    function test_preview_invalidDuration_reverts() public {
        vm.expectRevert("RiteStaking: invalid duration");
        staking.previewReward(address(usdc), 1e6, 36);
    }

    // --- stake + unstake (USDC) ---

    function test_stake_USDC_24h() public {
        vm.startPrank(alice);
        usdc.approve(address(staking), 100 * 1e6);

        uint256 stakeId = staking.stake(address(usdc), 100 * 1e6, 24);
        assertEq(stakeId, 0);

        (,address token, uint256 amount,,,uint256 reward, bool isRIT, bool withdrawn) =
            staking.stakes(0);
        assertEq(token, address(usdc));
        assertEq(amount, 100 * 1e6);
        assertEq(reward, 10 * 1e6);
        assertFalse(isRIT);
        assertFalse(withdrawn);

        vm.stopPrank();
    }

    function test_unstake_USDC_after_duration() public {
        vm.startPrank(alice);
        usdc.approve(address(staking), 100 * 1e6);
        uint256 stakeId = staking.stake(address(usdc), 100 * 1e6, 24);
        vm.stopPrank();

        uint256 balanceBefore = usdc.balanceOf(alice);

        // Warp past 24 hours
        vm.warp(block.timestamp + 25 hours);

        vm.prank(alice);
        staking.unstake(stakeId);

        uint256 received = usdc.balanceOf(alice) - balanceBefore;
        // Principal (100) + reward (10) = 110 USDC
        assertEq(received, 110 * 1e6);
    }

    function test_unstake_reverts_before_duration() public {
        vm.startPrank(alice);
        usdc.approve(address(staking), 100 * 1e6);
        uint256 stakeId = staking.stake(address(usdc), 100 * 1e6, 24);

        vm.warp(block.timestamp + 12 hours); // only half done
        vm.expectRevert();
        staking.unstake(stakeId);
        vm.stopPrank();
    }

    function test_unstake_reverts_double_withdraw() public {
        vm.startPrank(alice);
        usdc.approve(address(staking), 100 * 1e6);
        uint256 stakeId = staking.stake(address(usdc), 100 * 1e6, 24);
        vm.warp(block.timestamp + 25 hours);
        staking.unstake(stakeId);

        vm.expectRevert();
        staking.unstake(stakeId); // second attempt should fail
        vm.stopPrank();
    }

    function test_unstake_reverts_not_staker() public {
        vm.prank(alice);
        usdc.approve(address(staking), 100 * 1e6);
        vm.prank(alice);
        uint256 stakeId = staking.stake(address(usdc), 100 * 1e6, 24);
        vm.warp(block.timestamp + 25 hours);

        vm.prank(bob);
        vm.expectRevert();
        staking.unstake(stakeId);
    }

    // --- RIT staking (reward in USDC) ---

    function test_stake_RIT_24h_reward_in_USDC() public {
        vm.startPrank(alice);
        rit.approve(address(staking), 1e18);
        uint256 stakeId = staking.stake(address(rit), 1e18, 24);
        vm.stopPrank();

        vm.warp(block.timestamp + 25 hours);

        uint256 usdcBefore = usdc.balanceOf(alice);
        uint256 ritBefore  = rit.balanceOf(alice);

        vm.prank(alice);
        staking.unstake(stakeId);

        // Principal: 1 RIT back
        assertEq(rit.balanceOf(alice), ritBefore + 1e18);
        // Reward: 10 USDC (1 RIT * 10 USDC/RIT * 100%)
        assertEq(usdc.balanceOf(alice) - usdcBefore, 10 * 1e6);
    }

    function test_stake_RIT_168h() public {
        vm.startPrank(alice);
        rit.approve(address(staking), 1e18);
        uint256 stakeId = staking.stake(address(rit), 1e18, 168);
        vm.stopPrank();

        (,,,,,uint256 reward,, ) = staking.stakes(stakeId);
        // 1 RIT * 10 USDC * 250% = 25 USDC
        assertEq(reward, 25 * 1e6);
    }

    // --- DAI staking ---

    function test_stake_DAI_72h() public {
        vm.startPrank(alice);
        dai.approve(address(staking), 50 * 1e18);
        staking.stake(address(dai), 50 * 1e18, 72);
        vm.stopPrank();

        vm.warp(block.timestamp + 73 hours);

        uint256 daiBefore = dai.balanceOf(alice);
        vm.prank(alice);
        staking.unstake(0);

        uint256 received = dai.balanceOf(alice) - daiBefore;
        // 50 DAI + 20% = 60 DAI
        assertEq(received, 60 * 1e18);
    }

    // --- getUserStakes ---

    function test_getUserStakes_returns_all_ids() public {
        vm.startPrank(alice);
        usdc.approve(address(staking), type(uint256).max);
        staking.stake(address(usdc), 10 * 1e6, 12);
        staking.stake(address(usdc), 20 * 1e6, 24);
        staking.stake(address(usdc), 30 * 1e6, 48);
        vm.stopPrank();

        uint256[] memory ids = staking.getUserStakes(alice);
        assertEq(ids.length, 3);
        assertEq(ids[0], 0);
        assertEq(ids[1], 1);
        assertEq(ids[2], 2);
    }

    // --- canUnstake ---

    function test_canUnstake() public {
        vm.prank(alice);
        usdc.approve(address(staking), 10 * 1e6);
        vm.prank(alice);
        staking.stake(address(usdc), 10 * 1e6, 12);

        assertFalse(staking.canUnstake(0));
        vm.warp(block.timestamp + 13 hours);
        assertTrue(staking.canUnstake(0));
    }

    // --- error cases ---

    function test_stake_invalidToken_reverts() public {
        vm.expectRevert();
        vm.prank(alice);
        staking.stake(address(0x1234), 1e18, 24);
    }

    function test_stake_zeroAmount_reverts() public {
        vm.expectRevert();
        vm.prank(alice);
        staking.stake(address(usdc), 0, 24);
    }

    function test_stake_invalidDuration_reverts() public {
        vm.startPrank(alice);
        usdc.approve(address(staking), 1e6);
        vm.expectRevert();
        staking.stake(address(usdc), 1e6, 36);
        vm.stopPrank();
    }
}
