import { expect } from 'chai';
import hre from 'hardhat';

const { ethers, networkHelpers } = await hre.network.create();
const { loadFixture } = networkHelpers;

describe('RushVestingWallet', function () {
  async function deployVestingFixture() {
    const [deployer, admin, treasury, beneficiary] = await ethers.getSigners();
    const token = await ethers.deployContract(
      'RushToken',
      [treasury.address, admin.address],
      deployer,
    );
    await token.waitForDeployment();

    const now = await networkHelpers.time.latest();
    const start = now + 20;
    const duration = 400;
    const cliff = 100;
    const allocation = ethers.parseEther('1000');
    const vesting = await ethers.deployContract(
      'RushVestingWallet',
      [beneficiary.address, start, duration, cliff],
      deployer,
    );
    await vesting.waitForDeployment();
    await token.connect(treasury).transfer(await vesting.getAddress(), allocation);

    return {
      token,
      vesting,
      beneficiary,
      start,
      duration,
      cliff,
      allocation,
    };
  }

  it('unlocks nothing before the cliff and accrued linear vesting at the cliff', async function () {
    const context = await loadFixture(deployVestingFixture);
    const tokenAddress = await context.token.getAddress();

    await networkHelpers.time.increaseTo(context.start + context.cliff - 1);
    expect(await context.vesting['releasable(address)'](tokenAddress)).to.equal(0n);

    await networkHelpers.time.increaseTo(context.start + context.cliff);
    expect(await context.vesting['releasable(address)'](tokenAddress)).to.equal(
      context.allocation / 4n,
    );
  });

  it('releases vested tokens only to the beneficiary', async function () {
    const context = await loadFixture(deployVestingFixture);
    const tokenAddress = await context.token.getAddress();

    await networkHelpers.time.increaseTo(context.start + context.duration);
    await context.vesting['release(address)'](tokenAddress);

    expect(await context.token.balanceOf(context.beneficiary.address)).to.equal(
      context.allocation,
    );
    expect(await context.token.balanceOf(await context.vesting.getAddress())).to.equal(0n);
  });

  it('rejects a cliff longer than the vesting duration', async function () {
    const [, , , beneficiary] = await ethers.getSigners();

    await expect(
      ethers.deployContract('RushVestingWallet', [
        beneficiary.address,
        100,
        365,
        366,
      ]),
    ).to.be.revertedWithCustomError(
      await ethers.getContractFactory('RushVestingWallet'),
      'CliffLongerThanDuration',
    );
  });
});
