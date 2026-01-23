import { network } from 'hardhat';

const TOKENS = 10n ** 18n;
const TOTAL_SUPPLY = 1_000_000_000n * TOKENS;
const REWARD_POOL = 350_000_000n * TOKENS;
const TEAM_ALLOCATION = 150_000_000n * TOKENS;
const TREASURY_ALLOCATION = TOTAL_SUPPLY - REWARD_POOL - TEAM_ALLOCATION;
const FOUR_YEARS = 4 * 365 * 24 * 60 * 60;
const ONE_YEAR = 365 * 24 * 60 * 60;

function configuredAddress(name, fallback, localNetwork, ethers) {
  const value = process.env[name]?.trim();
  if (value) {
    if (!ethers.isAddress(value)) throw new Error(`${name} is not a valid address.`);
    return ethers.getAddress(value);
  }
  if (localNetwork) return fallback;
  throw new Error(`${name} is required for a public-network deployment.`);
}

const { ethers, networkName } = await network.create();
const [deployer] = await ethers.getSigners();
const localNetwork =
  networkName === 'default' ||
  networkName === 'hardhatMainnet' ||
  networkName === 'hardhatOp';

const admin = configuredAddress(
  'RUSH_ADMIN',
  deployer.address,
  localNetwork,
  ethers,
);
const treasury = configuredAddress(
  'RUSH_TREASURY',
  deployer.address,
  localNetwork,
  ethers,
);
const rewardSigner = configuredAddress(
  'RUSH_REWARD_SIGNER',
  deployer.address,
  localNetwork,
  ethers,
);
const teamBeneficiary = configuredAddress(
  'RUSH_TEAM_BENEFICIARY',
  deployer.address,
  localNetwork,
  ethers,
);

const latestBlock = await ethers.provider.getBlock('latest');
const vestingStart = Number(process.env.RUSH_VESTING_START || latestBlock.timestamp);

console.log(`Deploying RUSH Momentum Engine to ${networkName}...`);
console.log(`Deployer: ${deployer.address}`);
console.log(`Admin: ${admin}`);
console.log(`Treasury: ${treasury}`);

const token = await ethers.deployContract('RushToken', [deployer.address, admin]);
await token.waitForDeployment();

const rewardVault = await ethers.deployContract('RunRewardVault', [
  await token.getAddress(),
  admin,
  rewardSigner,
]);
await rewardVault.waitForDeployment();

const teamVesting = await ethers.deployContract('RushVestingWallet', [
  teamBeneficiary,
  vestingStart,
  FOUR_YEARS,
  ONE_YEAR,
]);
await teamVesting.waitForDeployment();

await (
  await token.transfer(await rewardVault.getAddress(), REWARD_POOL)
).wait();
await (
  await token.transfer(await teamVesting.getAddress(), TEAM_ALLOCATION)
).wait();
await (await token.transfer(treasury, TREASURY_ALLOCATION)).wait();

const deployment = {
  network: networkName,
  contracts: {
    rushToken: await token.getAddress(),
    runRewardVault: await rewardVault.getAddress(),
    rushVestingWallet: await teamVesting.getAddress(),
  },
  roles: {
    admin,
    treasury,
    rewardSigner,
    teamBeneficiary,
  },
  tokenomics: {
    totalSupply: '1,000,000,000 RUSH',
    runRewards: '350,000,000 RUSH (35%)',
    teamVesting: '150,000,000 RUSH (15%; 1-year cliff, 4-year linear)',
    treasury: '500,000,000 RUSH (50%)',
  },
};

console.log(JSON.stringify(deployment, null, 2));
console.log('Deployment complete. Configure Season 1 from the admin multisig.');
