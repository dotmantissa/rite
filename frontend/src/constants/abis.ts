export const erc20Abi = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner',   type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'faucet',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const

export const swapAbi = [
  {
    name: 'swap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenIn',  type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minOut',   type: 'uint256' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  {
    name: 'getAmountOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenIn',  type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  {
    name: 'reserves',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'ritBal',  type: 'uint256' },
      { name: 'usdcBal', type: 'uint256' },
      { name: 'daiBal',  type: 'uint256' },
    ],
  },
] as const

export const stakingAbi = [
  {
    name: 'stake',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token',         type: 'address' },
      { name: 'amount',        type: 'uint256' },
      { name: 'durationHours', type: 'uint256' },
    ],
    outputs: [{ name: 'stakeId', type: 'uint256' }],
  },
  {
    name: 'unstake',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'stakeId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'previewReward',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token',         type: 'address' },
      { name: 'amount',        type: 'uint256' },
      { name: 'durationHours', type: 'uint256' },
    ],
    outputs: [
      { name: 'rewardAmount', type: 'uint256' },
      { name: 'rewardToken',  type: 'address' },
    ],
  },
  {
    name: 'getUserStakes',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'stakes',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'stakeId', type: 'uint256' }],
    outputs: [
      { name: 'staker',       type: 'address' },
      { name: 'token',        type: 'address' },
      { name: 'amount',       type: 'uint256' },
      { name: 'startTime',    type: 'uint256' },
      { name: 'endTime',      type: 'uint256' },
      { name: 'rewardAmount', type: 'uint256' },
      { name: 'isRIT',        type: 'bool'    },
      { name: 'withdrawn',    type: 'bool'    },
    ],
  },
  {
    name: 'canUnstake',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'stakeId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export const lendingAbi = [
  {
    name: 'borrow',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token',  type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'loanId', type: 'uint256' }],
  },
  {
    name: 'repay',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'previewLoan',
    type: 'function',
    stateMutability: 'pure',
    inputs: [
      { name: 'token',  type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [
      { name: 'interest', type: 'uint256' },
      { name: 'totalDue', type: 'uint256' },
    ],
  },
  {
    name: 'getUserLoans',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'loans',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [
      { name: 'borrower',   type: 'address' },
      { name: 'token',      type: 'address' },
      { name: 'principal',  type: 'uint256' },
      { name: 'interest',   type: 'uint256' },
      { name: 'totalDue',   type: 'uint256' },
      { name: 'borrowedAt', type: 'uint256' },
      { name: 'repaid',     type: 'bool'    },
    ],
  },
  {
    name: 'poolBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const
