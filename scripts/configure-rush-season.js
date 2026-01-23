import { network } from 'hardhat';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function positiveInteger(name, fallback) {
  const value = process.env[name]?.trim() || fallback;
  if (!/^\d+$/.test(value) || BigInt(value) === 0n) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return BigInt(value);
}

const { ethers, networkName } = await network.create();
const [operator] = await ethers.getSigners();
const vaultAddress = required('RUSH_REWARD_VAULT');
if (!ethers.isAddress(vaultAddress)) {
  throw new Error('RUSH_REWARD_VAULT must be a valid address.');
}

const now = BigInt((await ethers.provider.getBlock('latest')).timestamp);
const seasonId = positiveInteger('RUSH_SEASON_ID', '1');
const startsAt = positiveInteger(
  'RUSH_SEASON_START',
  (now + 5n * 60n).toString(),
);
const endsAt = positiveInteger(
  'RUSH_SEASON_END',
  (startsAt + 90n * 24n * 60n * 60n).toString(),
);
const budget = ethers.parseEther(
  process.env.RUSH_SEASON_BUDGET?.trim() || '10000000',
);
const maxRewardPerRun = ethers.parseEther(
  process.env.RUSH_MAX_REWARD_PER_RUN?.trim() || '500',
);

if (seasonId > 0xffffffffn) throw new Error('RUSH_SEASON_ID exceeds uint32.');
if (startsAt > 0xffffffffffffffffn || endsAt > 0xffffffffffffffffn) {
  throw new Error('Season timestamps exceed uint64.');
}

const vault = await ethers.getContractAt(
  'RunRewardVault',
  ethers.getAddress(vaultAddress),
  operator,
);
console.log(`Configuring RUSH season ${seasonId} on ${networkName}...`);
console.log(`Operator: ${operator.address}`);

const transaction = await vault.configureSeason(
  seasonId,
  startsAt,
  endsAt,
  budget,
  maxRewardPerRun,
);
await transaction.wait();

console.log(
  JSON.stringify(
    {
      vault: await vault.getAddress(),
      seasonId: seasonId.toString(),
      startsAt: startsAt.toString(),
      endsAt: endsAt.toString(),
      budget: ethers.formatEther(budget),
      maxRewardPerRun: ethers.formatEther(maxRewardPerRun),
      transactionHash: transaction.hash,
    },
    null,
    2,
  ),
);
