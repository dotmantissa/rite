// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RiteSwap.sol";
import "../src/tokens/RITToken.sol";
import "../src/tokens/MockUSDC.sol";
import "../src/tokens/MockDAI.sol";

contract RiteSwapTest is Test {
    RiteSwap swap;
    RITToken rit;
    MockUSDC usdc;
    MockDAI  dai;

    address owner = address(this);
    address alice = makeAddr("alice");

    function setUp() public {
        rit  = new RITToken(owner);
        usdc = new MockUSDC(owner);
        dai  = new MockDAI(owner);
        swap = new RiteSwap(address(rit), address(usdc), address(dai), owner);

        // Fund the swap pool
        rit.approve(address(swap), type(uint256).max);
        usdc.approve(address(swap), type(uint256).max);
        dai.approve(address(swap), type(uint256).max);
        swap.addLiquidity(address(rit),  500_000 * 1e18);
        swap.addLiquidity(address(usdc), 5_000_000 * 1e6);
        swap.addLiquidity(address(dai),  5_000_000 * 1e18);

        // Give alice some tokens
        rit.transfer(alice, 1000 * 1e18);
        usdc.transfer(alice, 10_000 * 1e6);
        dai.transfer(alice, 10_000 * 1e18);
    }

    // --- getAmountOut ---

    function test_amountOut_RITtoUSDC() public view {
        // 1 RIT -> 10 USDC (before fee)
        uint256 out = swap.getAmountOut(address(rit), address(usdc), 1e18);
        assertEq(out, 10 * 1e6);
    }

    function test_amountOut_USDCtoRIT() public view {
        // 10 USDC -> 1 RIT (before fee)
        uint256 out = swap.getAmountOut(address(usdc), address(rit), 10 * 1e6);
        assertEq(out, 1e18);
    }

    function test_amountOut_RITtoDAI() public view {
        // 1 RIT -> 10 DAI (before fee)
        uint256 out = swap.getAmountOut(address(rit), address(dai), 1e18);
        assertEq(out, 10 * 1e18);
    }

    function test_amountOut_DAItoRIT() public view {
        // 10 DAI -> 1 RIT (before fee)
        uint256 out = swap.getAmountOut(address(dai), address(rit), 10 * 1e18);
        assertEq(out, 1e18);
    }

    function test_amountOut_USDCtoDAI() public view {
        // 100 USDC -> 100 DAI (before fee, decimal conversion only)
        uint256 out = swap.getAmountOut(address(usdc), address(dai), 100 * 1e6);
        assertEq(out, 100 * 1e18);
    }

    function test_amountOut_DAItoUSDC() public view {
        // 100 DAI -> 100 USDC (before fee)
        uint256 out = swap.getAmountOut(address(dai), address(usdc), 100 * 1e18);
        assertEq(out, 100 * 1e6);
    }

    function test_amountOut_revertsSameToken() public {
        vm.expectRevert();
        swap.getAmountOut(address(rit), address(rit), 1e18);
    }

    function test_amountOut_revertsZero() public {
        vm.expectRevert();
        swap.getAmountOut(address(rit), address(usdc), 0);
    }

    // --- swap ---

    function test_swap_RITtoUSDC() public {
        vm.startPrank(alice);
        rit.approve(address(swap), 10 * 1e18);

        uint256 usdcBefore = usdc.balanceOf(alice);
        uint256 ritBefore  = rit.balanceOf(alice);

        uint256 rawOut = swap.getAmountOut(address(rit), address(usdc), 10 * 1e18);
        uint256 expectedOut = rawOut * (10000 - 30) / 10000; // 0.3% fee

        uint256 actualOut = swap.swap(address(rit), address(usdc), 10 * 1e18, expectedOut);

        assertEq(actualOut, expectedOut);
        assertEq(rit.balanceOf(alice), ritBefore - 10 * 1e18);
        assertEq(usdc.balanceOf(alice), usdcBefore + expectedOut);
        vm.stopPrank();
    }

    function test_swap_USDCtoRIT() public {
        vm.startPrank(alice);
        usdc.approve(address(swap), 100 * 1e6);

        uint256 rawOut = swap.getAmountOut(address(usdc), address(rit), 100 * 1e6);
        uint256 expectedOut = rawOut * 9970 / 10000;

        swap.swap(address(usdc), address(rit), 100 * 1e6, expectedOut);

        assertGe(rit.balanceOf(alice), 1000 * 1e18 + expectedOut);
        vm.stopPrank();
    }

    function test_swap_RITtoDAI() public {
        vm.startPrank(alice);
        rit.approve(address(swap), 5 * 1e18);

        uint256 rawOut = swap.getAmountOut(address(rit), address(dai), 5 * 1e18);
        uint256 expectedOut = rawOut * 9970 / 10000;

        uint256 actualOut = swap.swap(address(rit), address(dai), 5 * 1e18, expectedOut);
        assertGe(actualOut, expectedOut);
        vm.stopPrank();
    }

    function test_swap_revertsOnSlippage() public {
        vm.startPrank(alice);
        rit.approve(address(swap), 1e18);

        uint256 rawOut = swap.getAmountOut(address(rit), address(usdc), 1e18);
        // Demand more than possible
        vm.expectRevert("RiteSwap: slippage exceeded");
        swap.swap(address(rit), address(usdc), 1e18, rawOut + 1);
        vm.stopPrank();
    }

    function test_swap_revertsInsufficientLiquidity() public {
        // Drain USDC pool first
        swap.removeLiquidity(address(usdc), 5_000_000 * 1e6);

        vm.startPrank(alice);
        rit.approve(address(swap), 1e18);
        vm.expectRevert();
        swap.swap(address(rit), address(usdc), 1e18, 0);
        vm.stopPrank();
    }

    function test_fuzz_swap_RITtoUSDC(uint256 amount) public {
        amount = bound(amount, 1e15, 100 * 1e18); // 0.001 RIT to 100 RIT
        deal(address(rit), alice, amount);

        vm.startPrank(alice);
        rit.approve(address(swap), amount);

        uint256 rawOut = swap.getAmountOut(address(rit), address(usdc), amount);
        uint256 expectedOut = rawOut * 9970 / 10000;

        uint256 before = usdc.balanceOf(alice);
        swap.swap(address(rit), address(usdc), amount, expectedOut);

        assertGe(usdc.balanceOf(alice) - before, expectedOut);
        vm.stopPrank();
    }

    // --- reserves ---

    function test_reserves() public view {
        (uint256 r, uint256 u, uint256 d) = swap.reserves();
        assertEq(r, 500_000 * 1e18);
        assertEq(u, 5_000_000 * 1e6);
        assertEq(d, 5_000_000 * 1e18);
    }

    // --- access control ---

    function test_addLiquidity_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        swap.addLiquidity(address(rit), 1e18);
    }
}
