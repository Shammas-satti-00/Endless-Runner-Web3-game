export const RUSH_REWARD_DOMAIN = Object.freeze({
  name: 'Subway Rush Run Rewards',
  version: '1',
});

export const RUN_RECEIPT_TYPES = Object.freeze({
  RunReceipt: Object.freeze([
    Object.freeze({ name: 'player', type: 'address' }),
    Object.freeze({ name: 'runId', type: 'bytes32' }),
    Object.freeze({ name: 'seasonId', type: 'uint32' }),
    Object.freeze({ name: 'score', type: 'uint64' }),
    Object.freeze({ name: 'distance', type: 'uint64' }),
    Object.freeze({ name: 'coins', type: 'uint32' }),
    Object.freeze({ name: 'momentumBps', type: 'uint32' }),
    Object.freeze({ name: 'reward', type: 'uint128' }),
    Object.freeze({ name: 'deadline', type: 'uint64' }),
  ]),
});

export const RUSH_TOKEN_ABI = Object.freeze([
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function delegate(address delegatee)',
  'function getVotes(address account) view returns (uint256)',
  'function permit(address owner,address spender,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s)',
]);

export const RUN_REWARD_VAULT_ABI = Object.freeze([
  'function claim((address player,bytes32 runId,uint32 seasonId,uint64 score,uint64 distance,uint32 coins,uint32 momentumBps,uint128 reward,uint64 deadline) receipt,bytes signature)',
  'function claimedRuns(bytes32 runId) view returns (bool)',
  'function hashReceipt((address player,bytes32 runId,uint32 seasonId,uint64 score,uint64 distance,uint32 coins,uint32 momentumBps,uint128 reward,uint64 deadline) receipt) view returns (bytes32)',
  'function seasons(uint32 seasonId) view returns (uint64 startsAt,uint64 endsAt,uint96 maxRewardPerRun,uint128 budget,uint128 claimed,bool active)',
  'event RunClaimed(bytes32 indexed runId,uint32 indexed seasonId,address indexed player,uint128 reward,uint64 score,uint64 distance,uint32 coins,uint32 momentumBps)',
]);

export function buildRunReceiptTypedData(chainId, vaultAddress, receipt) {
  return {
    domain: {
      ...RUSH_REWARD_DOMAIN,
      chainId,
      verifyingContract: vaultAddress,
    },
    types: RUN_RECEIPT_TYPES,
    primaryType: 'RunReceipt',
    message: receipt,
  };
}
