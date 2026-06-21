// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RiteLending.sol";
import "../src/tokens/MockUSDC.sol";
import "../src/tokens/MockDAI.sol";

contract RiteLendingTest is Test {
    RiteLending lending;
    MockUSDC    usdc;
    MockDAI     dai;

    address owner = address(this);
    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");

    function setUp() public {
        usdc    = new MockUSDC(owner);
        dai     = new MockDAI(owner);
        lending = new RiteLending(address(usdc), address(dai));

        // Fund lending pools
        usdc.approve(address(lending), type(uint256).max);
        dai.approve(address(lending), type(uint256).max);
        lending.fundPool(address(usdc), 500_000 * 1e6);
        lending.fundPool(address(dai),  500_000 * 1e18);

        // Give users stablecoins (for repayment)
        usdc.transfer(alice, 10_000 * 1e6);
        dai.transfer(alice, 10_000 * 1e18);
    }

    // --- previewLoan ---

    function test_previewLoan_USDC() public view {
        (uint256 interest, uint256 totalDue) = lending.previewLoan(address(usdc), 100 * 1e6);
        assertEq(interest, 5 * 1e6);      // 5% of 100 USDC
        assertEq(totalDue, 105 * 1e6);
    }

    function test_previewLoan_DAI() public view {
        (uint256 interest, uint256 totalDue) = lending.previewLoan(address(dai), 200 * 1e18);
        assertEq(interest, 10 * 1e18);    // 5% of 200 DAI
        assertEq(totalDue, 210 * 1e18);
    }

    // --- borrow ---

    function test_borrow_USDC() public {
        uint256 poolBefore = usdc.balanceOf(address(lending));
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        uint256 loanId = lending.borrow(address(usdc), 100 * 1e6);

        assertEq(loanId, 0);
        assertEq(usdc.balanceOf(alice), aliceBefore + 100 * 1e6);
        assertEq(usdc.balanceOf(address(lending)), poolBefore - 100 * 1e6);

        (address borrower, address token, uint256 principal, uint256 interest,
         uint256 totalDue,, bool repaid) = lending.loans(0);
        assertEq(borrower, alice);
        assertEq(token, address(usdc));
        assertEq(principal, 100 * 1e6);
        assertEq(interest, 5 * 1e6);
        assertEq(totalDue, 105 * 1e6);
        assertFalse(repaid);
    }

    function test_borrow_DAI() public {
        vm.prank(alice);
        lending.borrow(address(dai), 500 * 1e18);

        (,, uint256 principal, uint256 interest, uint256 totalDue,,) = lending.loans(0);
        assertEq(principal, 500 * 1e18);
        assertEq(interest, 25 * 1e18);
        assertEq(totalDue, 525 * 1e18);
    }

    function test_borrow_zero_reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        lending.borrow(address(usdc), 0);
    }

    function test_borrow_unsupported_token_reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        lending.borrow(address(0x1234), 100);
    }

    function test_borrow_exceeds_pool_reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        lending.borrow(address(usdc), 600_000 * 1e6); // more than pool
    }

    // --- repay ---

    function test_repay_USDC() public {
        vm.prank(alice);
        lending.borrow(address(usdc), 100 * 1e6);

        uint256 poolBefore = usdc.balanceOf(address(lending));
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.startPrank(alice);
        usdc.approve(address(lending), 105 * 1e6);
        lending.repay(0);
        vm.stopPrank();

        // Alice paid 105 USDC total
        assertEq(aliceBefore - usdc.balanceOf(alice), 105 * 1e6);
        // Pool got back principal + interest
        assertEq(usdc.balanceOf(address(lending)), poolBefore + 105 * 1e6);

        (,,,,, , bool repaid) = lending.loans(0);
        assertTrue(repaid);
    }

    function test_repay_double_reverts() public {
        vm.prank(alice);
        lending.borrow(address(usdc), 100 * 1e6);

        vm.startPrank(alice);
        usdc.approve(address(lending), 210 * 1e6);
        lending.repay(0);

        vm.expectRevert();
        lending.repay(0);
        vm.stopPrank();
    }

    function test_repay_wrong_borrower_reverts() public {
        vm.prank(alice);
        lending.borrow(address(usdc), 100 * 1e6);

        vm.startPrank(bob);
        vm.expectRevert();
        lending.repay(0);
        vm.stopPrank();
    }

    // --- multiple loans ---

    function test_multiple_loans_same_user() public {
        vm.startPrank(alice);
        lending.borrow(address(usdc), 50 * 1e6);
        lending.borrow(address(dai), 100 * 1e18);
        vm.stopPrank();

        uint256[] memory ids = lending.getUserLoans(alice);
        assertEq(ids.length, 2);
        assertEq(lending.outstandingUSDC(alice), 50 * 1e6);
        assertEq(lending.outstandingDAI(alice), 100 * 1e18);
    }

    // --- fuzz ---

    function test_fuzz_borrow_repay(uint256 amount) public {
        amount = bound(amount, 1 * 1e6, 1000 * 1e6);

        vm.prank(alice);
        lending.borrow(address(usdc), amount);

        (,,, uint256 interest, uint256 totalDue,,) = lending.loans(0);
        assertEq(interest, amount * 500 / 10000);
        assertEq(totalDue, amount + interest);

        vm.startPrank(alice);
        usdc.approve(address(lending), totalDue);
        lending.repay(0);
        vm.stopPrank();

        (,,,,,, bool repaid) = lending.loans(0);
        assertTrue(repaid);
    }

    // --- pool balance ---

    function test_poolBalance() public view {
        assertEq(lending.poolBalance(address(usdc)), 500_000 * 1e6);
        assertEq(lending.poolBalance(address(dai)), 500_000 * 1e18);
    }
}
