// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RiteSwap
/// @notice Fixed-rate token swap between RIT, USDC, and DAI.
///         Price: 1 RIT = 10 USDC = 10 DAI.
///         Owner pre-funds the swap pool; users swap against that reserve.
contract RiteSwap is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable rit;
    address public immutable usdc;
    address public immutable dai;

    /// @dev Price of 1 full RIT in raw USDC units (6 decimals). 1 RIT = 10 USDC.
    uint256 public constant RIT_PRICE_USDC = 10 * 1e6;

    /// @dev Price of 1 full RIT in raw DAI units (18 decimals). 1 RIT = 10 DAI.
    uint256 public constant RIT_PRICE_DAI = 10 * 1e18;

    /// @dev Swap fee in basis points (0.3%).
    uint256 public constant SWAP_FEE_BPS = 30;

    event Swapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    event LiquidityAdded(address indexed token, uint256 amount);
    event LiquidityRemoved(address indexed token, uint256 amount);

    error UnsupportedPair(address tokenIn, address tokenOut);
    error InsufficientLiquidity(address token, uint256 needed, uint256 available);
    error ZeroAmount();

    constructor(
        address _rit,
        address _usdc,
        address _dai,
        address initialOwner
    ) Ownable(initialOwner) {
        rit = _rit;
        usdc = _usdc;
        dai = _dai;
    }

    // -------------------------------------------------------------------------
    // Liquidity management (owner only)
    // -------------------------------------------------------------------------

    function addLiquidity(address token, uint256 amount) external onlyOwner {
        require(amount > 0, "RiteSwap: zero amount");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit LiquidityAdded(token, amount);
    }

    function removeLiquidity(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(msg.sender, amount);
        emit LiquidityRemoved(token, amount);
    }

    // -------------------------------------------------------------------------
    // Swap logic
    // -------------------------------------------------------------------------

    /// @notice Returns how many units of tokenOut you get for amountIn of tokenIn,
    ///         before the swap fee is applied.
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public view returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        if (tokenIn == tokenOut) revert UnsupportedPair(tokenIn, tokenOut);

        if (tokenIn == address(0) || tokenOut == address(0))
            revert UnsupportedPair(tokenIn, tokenOut);

        // RIT (18 dec) -> USDC (6 dec): multiply by price, divide by 1e18
        // e.g., 1e18 * 10e6 / 1e18 = 10e6
        if (_isRIT(tokenIn) && _isUSDC(tokenOut))
            return amountIn * RIT_PRICE_USDC / 1e18;

        // USDC (6 dec) -> RIT (18 dec): multiply by 1e18, divide by price
        // e.g., 10e6 * 1e18 / 10e6 = 1e18
        if (_isUSDC(tokenIn) && _isRIT(tokenOut))
            return amountIn * 1e18 / RIT_PRICE_USDC;

        // RIT (18 dec) -> DAI (18 dec): both same decimals, 1:10 ratio
        if (_isRIT(tokenIn) && _isDAI(tokenOut))
            return amountIn * 10;

        // DAI (18 dec) -> RIT (18 dec): 10:1 ratio
        if (_isDAI(tokenIn) && _isRIT(tokenOut))
            return amountIn / 10;

        // USDC (6 dec) -> DAI (18 dec): 1:1 price, adjust decimals
        if (_isUSDC(tokenIn) && _isDAI(tokenOut))
            return amountIn * 1e12; // 1e6 * 1e12 = 1e18

        // DAI (18 dec) -> USDC (6 dec): 1:1 price, adjust decimals
        if (_isDAI(tokenIn) && _isUSDC(tokenOut))
            return amountIn / 1e12; // 1e18 / 1e12 = 1e6

        revert UnsupportedPair(tokenIn, tokenOut);
    }

    /// @notice Swap tokenIn for tokenOut. Caller must approve this contract first.
    /// @param tokenIn   Token being sold.
    /// @param tokenOut  Token being bought.
    /// @param amountIn  Exact amount of tokenIn to sell.
    /// @param minOut    Minimum acceptable amountOut (slippage protection).
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minOut
    ) external nonReentrant returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();

        uint256 rawOut = getAmountOut(tokenIn, tokenOut, amountIn);

        // Apply swap fee
        amountOut = rawOut * (10000 - SWAP_FEE_BPS) / 10000;

        require(amountOut >= minOut, "RiteSwap: slippage exceeded");

        uint256 poolBalance = IERC20(tokenOut).balanceOf(address(this));
        if (amountOut > poolBalance)
            revert InsufficientLiquidity(tokenOut, amountOut, poolBalance);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        emit Swapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    // -------------------------------------------------------------------------
    // Pool reserves
    // -------------------------------------------------------------------------

    function reserves() external view returns (uint256 ritBal, uint256 usdcBal, uint256 daiBal) {
        ritBal  = IERC20(rit).balanceOf(address(this));
        usdcBal = IERC20(usdc).balanceOf(address(this));
        daiBal  = IERC20(dai).balanceOf(address(this));
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _isRIT(address t) internal view returns (bool) { return t == rit; }
    function _isUSDC(address t) internal view returns (bool) { return t == usdc; }
    function _isDAI(address t) internal view returns (bool) { return t == dai; }
}
