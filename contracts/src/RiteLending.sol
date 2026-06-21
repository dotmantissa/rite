// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RiteLending
/// @notice Borrow USDC or DAI when you've staked your tokens and need extra liquidity
///         for a swap. Interest is a flat 5% on the borrowed amount.
///
///         The idea: your staking rewards cover the repayment cost. You stake, earn yield,
///         borrow a little to swap with, and repay from the rewards when your stake matures.
contract RiteLending is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Loan {
        address borrower;
        address token;
        uint256 principal;
        uint256 interest;
        uint256 totalDue;
        uint256 borrowedAt;
        bool repaid;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address public immutable usdc;
    address public immutable dai;

    /// @dev Flat interest rate: 500 bps = 5%.
    uint256 public constant INTEREST_BPS = 500;

    uint256 public nextLoanId;
    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) public userLoans;

    // Per-user outstanding borrow tracking to enforce a cap.
    mapping(address => uint256) public outstandingUSDC;
    mapping(address => uint256) public outstandingDAI;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event Borrowed(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed token,
        uint256 principal,
        uint256 interest
    );

    event Repaid(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 totalPaid
    );

    event PoolFunded(address indexed token, uint256 amount);
    event PoolWithdrawn(address indexed token, uint256 amount);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error UnsupportedToken(address token);
    error InsufficientPool(address token, uint256 needed, uint256 available);
    error NotBorrower(uint256 loanId);
    error AlreadyRepaid(uint256 loanId);
    error ZeroAmount();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _usdc, address _dai) Ownable(msg.sender) {
        usdc = _usdc;
        dai  = _dai;
    }

    // -------------------------------------------------------------------------
    // Owner: manage lending pool
    // -------------------------------------------------------------------------

    function fundPool(address token, uint256 amount) external onlyOwner {
        require(amount > 0, "RiteLending: zero amount");
        _requireSupportedToken(token);
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit PoolFunded(token, amount);
    }

    function withdrawPool(address token, uint256 amount) external onlyOwner {
        _requireSupportedToken(token);
        IERC20(token).safeTransfer(msg.sender, amount);
        emit PoolWithdrawn(token, amount);
    }

    // -------------------------------------------------------------------------
    // Borrowing
    // -------------------------------------------------------------------------

    /// @notice Borrow USDC or DAI from the lending pool. Repay at any time with a
    ///         flat 5% interest fee. No collateral required -- this is testnet.
    /// @param token   Token to borrow (usdc or dai).
    /// @param amount  Principal amount to borrow.
    function borrow(address token, uint256 amount)
        external
        nonReentrant
        returns (uint256 loanId)
    {
        if (amount == 0) revert ZeroAmount();
        _requireSupportedToken(token);

        uint256 interest = amount * INTEREST_BPS / 10000;
        uint256 totalDue = amount + interest;

        uint256 poolBalance = IERC20(token).balanceOf(address(this));
        if (amount > poolBalance)
            revert InsufficientPool(token, amount, poolBalance);

        // Transfer the principal to the borrower
        IERC20(token).safeTransfer(msg.sender, amount);

        // Track outstanding balance
        if (token == usdc) outstandingUSDC[msg.sender] += amount;
        else outstandingDAI[msg.sender] += amount;

        loanId = nextLoanId++;
        loans[loanId] = Loan({
            borrower: msg.sender,
            token: token,
            principal: amount,
            interest: interest,
            totalDue: totalDue,
            borrowedAt: block.timestamp,
            repaid: false
        });
        userLoans[msg.sender].push(loanId);

        emit Borrowed(loanId, msg.sender, token, amount, interest);
    }

    /// @notice Repay a loan. You must approve this contract for totalDue() first.
    function repay(uint256 loanId) external nonReentrant {
        Loan storage l = loans[loanId];
        if (l.borrower != msg.sender) revert NotBorrower(loanId);
        if (l.repaid) revert AlreadyRepaid(loanId);

        l.repaid = true;

        // Update outstanding balance
        if (l.token == usdc) outstandingUSDC[msg.sender] -= l.principal;
        else outstandingDAI[msg.sender] -= l.principal;

        IERC20(l.token).safeTransferFrom(msg.sender, address(this), l.totalDue);

        emit Repaid(loanId, msg.sender, l.totalDue);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getUserLoans(address user) external view returns (uint256[] memory) {
        return userLoans[user];
    }

    /// @notice Preview interest and total due for a hypothetical loan.
    function previewLoan(address token, uint256 amount)
        external
        pure
        returns (uint256 interest, uint256 totalDue)
    {
        interest = amount * INTEREST_BPS / 10000;
        totalDue = amount + interest;
    }

    function poolBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _requireSupportedToken(address token) internal view {
        if (token != usdc && token != dai) revert UnsupportedToken(token);
    }
}
