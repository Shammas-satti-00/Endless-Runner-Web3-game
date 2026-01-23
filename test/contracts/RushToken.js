import { expect } from 'chai';
import hre from 'hardhat';

const { ethers, networkHelpers } = await hre.network.create();
const { loadFixture } = networkHelpers;

describe('RushToken', function () {
  async function deployTokenFixture() {
    const [deployer, admin, treasury, player, spender] = await ethers.getSigners();
    const token = await ethers.deployContract(
      'RushToken',
      [treasury.address, admin.address],
      deployer,
    );
    await token.waitForDeployment();

    return { token, deployer, admin, treasury, player, spender };
  }

  it('mints the entire fixed supply exactly once', async function () {
    const { token, treasury } = await loadFixture(deployTokenFixture);
    const supply = ethers.parseEther('1000000000');

    expect(await token.MAX_SUPPLY()).to.equal(supply);
    expect(await token.totalSupply()).to.equal(supply);
    expect(await token.balanceOf(treasury.address)).to.equal(supply);
    expect(token.interface.hasFunction('mint')).to.equal(false);
  });

  it('rejects zero-address deployment roles', async function () {
    const [, admin, treasury] = await ethers.getSigners();
    const factory = await ethers.getContractFactory('RushToken');

    await expect(
      factory.deploy(ethers.ZeroAddress, admin.address),
    ).to.be.revertedWithCustomError(factory, 'ZeroAddress');
    await expect(
      factory.deploy(treasury.address, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(factory, 'ZeroAddress');
  });

  it('supports burning without creating a replacement mint path', async function () {
    const { token, treasury } = await loadFixture(deployTokenFixture);
    const amount = ethers.parseEther('125');
    const supplyBefore = await token.totalSupply();

    await token.connect(treasury).burn(amount);

    expect(await token.totalSupply()).to.equal(supplyBefore - amount);
  });

  it('lets the pauser stop and resume all token movement', async function () {
    const { token, admin, treasury, player } = await loadFixture(deployTokenFixture);

    await token.connect(admin).pause();
    await expect(
      token.connect(treasury).transfer(player.address, 1n),
    ).to.be.revertedWithCustomError(token, 'EnforcedPause');

    await token.connect(admin).unpause();
    await token.connect(treasury).transfer(player.address, 1n);
    expect(await token.balanceOf(player.address)).to.equal(1n);

    await expect(token.connect(player).pause()).to.be.revertedWithCustomError(
      token,
      'AccessControlUnauthorizedAccount',
    );
  });

  it('supports gasless ERC-2612 approvals', async function () {
    const { token, treasury, spender, player } = await loadFixture(deployTokenFixture);
    const network = await ethers.provider.getNetwork();
    const deadline = BigInt((await networkHelpers.time.latest()) + 3_600);
    const value = ethers.parseEther('250');
    const nonce = await token.nonces(treasury.address);
    const domain = {
      name: 'Subway Rush',
      version: '1',
      chainId: network.chainId,
      verifyingContract: await token.getAddress(),
    };
    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    };
    const signature = ethers.Signature.from(
      await treasury.signTypedData(domain, types, {
        owner: treasury.address,
        spender: spender.address,
        value,
        nonce,
        deadline,
      }),
    );

    await token.connect(player).permit(
      treasury.address,
      spender.address,
      value,
      deadline,
      signature.v,
      signature.r,
      signature.s,
    );

    expect(await token.allowance(treasury.address, spender.address)).to.equal(value);
  });

  it('checkpoints delegated voting power', async function () {
    const { token, treasury, player } = await loadFixture(deployTokenFixture);
    const amount = ethers.parseEther('1000');

    await token.connect(treasury).delegate(treasury.address);
    expect(await token.getVotes(treasury.address)).to.equal(await token.totalSupply());

    await token.connect(treasury).transfer(player.address, amount);
    expect(await token.getVotes(treasury.address)).to.equal(
      (await token.totalSupply()) - amount,
    );
    expect(await token.getVotes(player.address)).to.equal(0n);

    await token.connect(player).delegate(player.address);
    expect(await token.getVotes(player.address)).to.equal(amount);
  });
});
