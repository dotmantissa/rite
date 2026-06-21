// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RiteStaking
/// @notice Duration-based staking for USDC, DAI, and RIT.
///
///         Regular tokens (USDC, DAI) earn a flat percentage of the staked amount,
///         paid in the same token. RIT earns at a much higher rate, paid in USDC,
///         to reflect RIT's premium position in the protocol.
///
///         Reward rates (basis points, 100 bps = 1%):
///
///         Duration | USDC/DAI | RIT -> USDC
///         12 h     |  500     | 5000   (50%)
///         24 h     | 1000     | 10000 (100%)
///         48 h     | 1500     | 15000 (150%)
///         72 h     | 2000     | 20000 (200%)
///         168 h    | 2500     | 25000 (250%)
///
///         Price assumption: 1 RIT = 10 USDC. Adjustable by owner.
contract RiteStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Stake {
        address staker;
        address token;
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        uint256 rewardAmount;
        bool isRIT;       // true means reward is paid in USDC
        bool withdrawn;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address public immutable rit;
    address public immutable usdc;
    address public immutable dai;

    /// @dev 1 RIT in raw USDC units (6 decimals). Used to price RIT rewards in USDC.
    uint256 public ritPriceUSDC = 10 * 1e6;

    uint256 public nextStakeId;
    mapping(uint256 => Stake) public stakes;
    mapping(address => uint256[]) public userStakeIds;

    // Valid durations in hours
    uint256[] public validDurations = [12, 24, 48, 72, 168];

    // Reward rates in basis points per duration (index matches validDurations)
    uint256[] public regularRates = [500, 1000, 1500, 2000, 2500];
    uint256[] public ritRates     = [5000, 10000, 15000, 20000, 25000];

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event Staked(
        uint256 indexed stakeId,
        address indexed staker,
        address indexed token,
        uint256 amount,
        uint256 durationHours,
        uint256 rewardAmount
    );

    event Unstaked(
        uint256 indexed stakeId,
        address indexed staker,
        uint256 principal,
        uint256 reward
    );

    event RewardPoolFunded(address indexed token, uint256 amount);
    event RitPriceUpdated(uint256 newPrice);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error InvalidToken(address token);
    error InvalidDuration(uint256 durationHours);
    error InsufficientRewardPool(address rewardToken, uint256 needed, uint256 available);
    error NotStaker(uint256 stakeId);
    error AlreadyWithdrawn(uint256 stakeId);
    error DurationNotElapsed(uint256 stakeId, uint256 endsAt);
    error ZeroAmount();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _rit,
        address _usdc,
        address _dai
    ) Ownable(msg.sender) {
        rit  = _rit;
        usdc = _usdc;
        dai  = _dai;
    }

    // -------------------------------------------------------------------------
    // Owner: fund reward pools
    // -------------------------------------------------------------------------

    /// @notice Deposit tokens into the contract's reward reserve. Owner must call
    ///         this before staking can succeed (the contract checks reserve balance).
    function fundRewardPool(address token, uint256 amount) external onlyOwner {
        require(amount > 0, "RiteStaking: zero amount");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit RewardPoolFunded(token, amount);
    }

    /// @notice Update the RIT price used to compute USDC rewards for RIT stakers.
    function setRitPrice(uint256 newPriceUSDC) external onlyOwner {
        require(newPriceUSDC > 0, "RiteStaking: zero price");
        ritPriceUSDC = newPriceUSDC;
        emit RitPriceUpdated(newPriceUSDC);
    }

    // -------------------------------------------------------------------------
    // Staking
    // -------------------------------------------------------------------------

    /// @notice Stake tokens for a fixed duration and lock in your reward.
    ///         USDC and DAI earn in the same token. RIT earns in USDC.
    /// @param token         Token to stake (rit, usdc, or dai).
    /// @param amount        Amount to stake (in token's native units).
    /// @param durationHours Staking duration. Must be 12, 24, 48, 72, or 168.
    function stake(
        address token,
        uint256 amount,
        uint256 durationHours
    ) external nonReentrant returns (uint256 stakeId) {
        if (amount == 0) revert ZeroAmount();

        uint256 idx = _validDurationIndex(durationHours);
        if (idx == type(uint256).max) revert InvalidDuration(durationHours);

        bool isRIT = token == rit;
        if (!isRIT && token != usdc && token != dai) revert InvalidToken(token);

        uint256 rewardAmount = _calcReward(token, amount, idx, isRIT);
        address rewardToken = isRIT ? usdc : token;

        // Make sure the contract can actually pay the promised reward.
        // We check against (current balance - already-promised rewards), but
        // for testnet simplicity we check total balance.
        uint256 poolBalance = IERC20(rewardToken).balanceOf(address(this));
        // For RIT staking, the principal is RIT but pool must have USDC for reward.
        // For regular staking, principal and reward are the same token, so
        // available pool = current balance - principal being deposited = balance (before deposit).
        if (rewardAmount > poolBalance)
            revert InsufficientRewardPool(rewardToken, rewardAmount, poolBalance);

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        stakeId = nextStakeId++;
        stakes[stakeId] = Stake({
            staker: msg.sender,
            token: token,
            amount: amount,
            startTime: block.timestamp,
            endTime: block.timestamp + durationHours * 1 hours,
            rewardAmount: rewardAmount,
            isRIT: isRIT,
            withdrawn: false
        });
        userStakeIds[msg.sender].push(stakeId);

        emit Staked(stakeId, msg.sender, token, amount, durationHours, rewardAmount);
    }

    /// @notice Claim principal plus reward once the staking duration has elapsed.
    function unstake(uint256 stakeId) external nonReentrant {
        Stake storage s = stakes[stakeId];
        if (s.staker != msg.sender) revert NotStaker(stakeId);
        if (s.withdrawn) revert AlreadyWithdrawn(stakeId);
        if (block.timestamp < s.endTime) revert DurationNotElapsed(stakeId, s.endTime);

        s.withdrawn = true;

        // Return principal
        IERC20(s.token).safeTransfer(msg.sender, s.amount);

        // Pay reward
        address rewardToken = s.isRIT ? usdc : s.token;
        IERC20(rewardToken).safeTransfer(msg.sender, s.rewardAmount);

        emit Unstaked(stakeId, msg.sender, s.amount, s.rewardAmount);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Returns all stake IDs belonging to a user.
    function getUserStakes(address user) external view returns (uint256[] memory) {
        return userStakeIds[user];
    }

    /// @notice Returns the reward for a hypothetical stake (before creating it).
    function previewReward(
        address token,
        uint256 amount,
        uint256 durationHours
    ) external view returns (uint256 rewardAmount, address rewardToken) {
        uint256 idx = _validDurationIndex(durationHours);
        require(idx != type(uint256).max, "RiteStaking: invalid duration");
        bool isRIT = token == rit;
        rewardAmount = _calcReward(token, amount, idx, isRIT);
        rewardToken  = isRIT ? usdc : token;
    }

    /// @notice Returns whether a stake can be unstaked right now.
    function canUnstake(uint256 stakeId) external view returns (bool) {
        Stake storage s = stakes[stakeId];
        return !s.withdrawn && block.timestamp >= s.endTime;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _validDurationIndex(uint256 hours_) internal view returns (uint256) {
        for (uint256 i = 0; i < validDurations.length; i++) {
            if (validDurations[i] == hours_) return i;
        }
        return type(uint256).max;
    }

    function _calcReward(
        address token,
        uint256 amount,
        uint256 durationIdx,
        bool isRIT
    ) internal view returns (uint256) {
        if (isRIT) {
            // Reward in USDC = amount_RIT * ritPriceUSDC * bps / (1e18 * 10000)
            // RIT is 18 decimals, USDC is 6 decimals, ritPriceUSDC is in 1e6
            uint256 bps = ritRates[durationIdx];
            return amount * ritPriceUSDC * bps / (1e18 * 10000);
        } else {
            // Reward in same token = amount * bps / 10000
            uint256 bps = regularRates[durationIdx];
            return amount * bps / 10000;
        }
    }
}
