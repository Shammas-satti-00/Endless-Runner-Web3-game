import { expect } from 'chai';
import hre from 'hardhat';
import { RUN_RECEIPT_TYPES } from '../../src/web3/rushContracts.js';

const { ethers, networkHelpers } = await hre.network.create();
const { loadFixture } = networkHelpers;
let receiptSequence = 0;

describe('RunRewardVault', function () {
  async function deployVaultFixture() {
    const [deployer, admin, treasury, attestor, player, relayer, attacker] =
      await ethers.getSigners();
    const token = await ethers.deployContract(
      'RushToken',
      [treasury.address, admin.address],
      deployer,
    );
    await token.waitForDeployment();

    const vault = await ethers.deployContract(
      'RunRewardVault',
      [await token.getAddress(), admin.address, attestor.address],
      deployer,
    );
    await vault.waitForDeployment();

    const vaultAllocation = ethers.parseEther('350000000');
    await token.connect(treasury).transfer(await vault.getAddress(), vaultAllocation);

    const now = await networkHelpers.time.latest();
    const season = {
      id: 7,
      startsAt: now - 1,
      endsAt: now + 30 * 24 * 60 * 60,
      budget: ethers.parseEther('10000000'),
      maxReward: ethers.parseEther('500'),
    };
    await vault.connect(admin).configureSeason(
      season.id,
      season.startsAt,
      season.endsAt,
      season.budget,
      season.maxReward,
    );

    return {
      token,
      vault,
      deployer,
      admin,
      treasury,
      attestor,
      player,
      relayer,
      attacker,
      season,
      vaultAllocation,
    };
  }

  async function makeReceipt(context, overrides = {}) {
    const timestamp = await networkHelpers.time.latest();
    return {
      player: context.player.address,
      runId: ethers.id(`run-${timestamp}-${receiptSequence++}`),
      seasonId: context.season.id,
      score: 82_500,
      distance: 4_900,
      coins: 164,
      momentumBps: 13_500,
      reward: ethers.parseEther('42'),
      deadline: timestamp + 900,
      ...overrides,
    };
  }

  async function signReceipt(context, receipt, signer = context.attestor) {
    const network = await ethers.provider.getNetwork();
    return signer.signTypedData(
      {
        name: 'Subway Rush Run Rewards',
        version: '1',
        chainId: network.chainId,
        verifyingContract: await context.vault.getAddress(),
      },
      RUN_RECEIPT_TYPES,
      receipt,
    );
  }

  it('rejects unsafe constructor and season configurations', async function () {
    const context = await loadFixture(deployVaultFixture);
    const factory = await ethers.getContractFactory('RunRewardVault');
    const now = await networkHelpers.time.latest();

    await expect(
      factory.deploy(
        ethers.ZeroAddress,
        context.admin.address,
        context.attestor.address,
      ),
    ).to.be.revertedWithCustomError(factory, 'ZeroAddress');
    await expect(
      context.vault.connect(context.admin).configureSeason(
        context.season.id,
        now,
        now + 100,
        1,
        1,
      ),
    ).to.be.revertedWithCustomError(context.vault, 'SeasonAlreadyConfigured');
    await expect(
      context.vault.connect(context.admin).configureSeason(
        8,
        now + 100,
        now,
        1,
        1,
      ),
    ).to.be.revertedWithCustomError(context.vault, 'InvalidSeasonWindow');
    await expect(
      context.vault.connect(context.admin).configureSeason(
        8,
        now,
        now + 100,
        0,
        1,
      ),
    ).to.be.revertedWithCustomError(context.vault, 'InvalidSeasonBudget');

    const unavailableBudget =
      context.vaultAllocation - context.season.budget + 1n;
    await expect(
      context.vault.connect(context.admin).configureSeason(
        8,
        now,
        now + 100,
        unavailableBudget,
        1,
      ),
    ).to.be.revertedWithCustomError(context.vault, 'InsufficientFunding');
  });

  it('accepts explicit funding through transferFrom', async function () {
    const [deployer, admin, treasury, attestor] = await ethers.getSigners();
    const token = await ethers.deployContract('RushToken', [
      treasury.address,
      admin.address,
    ]);
    const vault = await ethers.deployContract('RunRewardVault', [
      await token.getAddress(),
      admin.address,
      attestor.address,
    ]);
    const amount = ethers.parseEther('2500');

    await token.connect(treasury).approve(await vault.getAddress(), amount);
    await expect(vault.connect(treasury).fund(amount))
      .to.emit(vault, 'Funded')
      .withArgs(treasury.address, amount);
    expect(await token.balanceOf(await vault.getAddress())).to.equal(amount);
    expect(deployer.address).not.to.equal(ethers.ZeroAddress);
  });

  it('pays a valid server-attested run to its bound player', async function () {
    const context = await loadFixture(deployVaultFixture);
    const receipt = await makeReceipt(context);
    const signature = await signReceipt(context, receipt);

    await expect(context.vault.connect(context.relayer).claim(receipt, signature))
      .to.emit(context.vault, 'RunClaimed')
      .withArgs(
        receipt.runId,
        receipt.seasonId,
        receipt.player,
        receipt.reward,
        receipt.score,
        receipt.distance,
        receipt.coins,
        receipt.momentumBps,
      );

    expect(await context.token.balanceOf(context.player.address)).to.equal(receipt.reward);
    expect(await context.vault.claimedRuns(receipt.runId)).to.equal(true);
    expect(await context.vault.totalReserved()).to.equal(
      context.season.budget - receipt.reward,
    );
  });

  it('rejects replayed run IDs', async function () {
    const context = await loadFixture(deployVaultFixture);
    const receipt = await makeReceipt(context);
    const signature = await signReceipt(context, receipt);

    await context.vault.claim(receipt, signature);
    await expect(
      context.vault.claim(receipt, signature),
    ).to.be.revertedWithCustomError(context.vault, 'RunAlreadyClaimed');
  });

  it('rejects tampered receipts and untrusted signers', async function () {
    const context = await loadFixture(deployVaultFixture);
    const receipt = await makeReceipt(context);
    const signature = await signReceipt(context, receipt);

    await expect(
      context.vault.claim(
        { ...receipt, reward: receipt.reward + 1n },
        signature,
      ),
    ).to.be.revertedWithCustomError(context.vault, 'InvalidSignature');

    const forgedReceipt = await makeReceipt(context);
    const forgedSignature = await signReceipt(
      context,
      forgedReceipt,
      context.attacker,
    );
    await expect(
      context.vault.claim(forgedReceipt, forgedSignature),
    ).to.be.revertedWithCustomError(context.vault, 'InvalidSignature');
  });

  it('rotates the attestor and exposes the canonical EIP-712 digest', async function () {
    const context = await loadFixture(deployVaultFixture);
    const receipt = await makeReceipt(context);
    const oldSignature = await signReceipt(context, receipt);
    const network = await ethers.provider.getNetwork();
    const expectedDigest = ethers.TypedDataEncoder.hash(
      {
        name: 'Subway Rush Run Rewards',
        version: '1',
        chainId: network.chainId,
        verifyingContract: await context.vault.getAddress(),
      },
      RUN_RECEIPT_TYPES,
      receipt,
    );

    expect(await context.vault.hashReceipt(receipt)).to.equal(expectedDigest);
    await expect(
      context.vault
        .connect(context.admin)
        .setTrustedSigner(context.attacker.address),
    )
      .to.emit(context.vault, 'TrustedSignerUpdated')
      .withArgs(context.attestor.address, context.attacker.address);
    await expect(
      context.vault.claim(receipt, oldSignature),
    ).to.be.revertedWithCustomError(context.vault, 'InvalidSignature');

    const newSignature = await signReceipt(
      context,
      receipt,
      context.attacker,
    );
    await context.vault.claim(receipt, newSignature);
    expect(await context.token.balanceOf(context.player.address)).to.equal(receipt.reward);

    await expect(
      context.vault
        .connect(context.admin)
        .setTrustedSigner(ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(context.vault, 'ZeroAddress');
  });

  it('enforces receipt deadlines and the per-run reward ceiling', async function () {
    const context = await loadFixture(deployVaultFixture);
    const expired = await makeReceipt(context, {
      deadline: (await networkHelpers.time.latest()) - 1,
    });
    const expiredSignature = await signReceipt(context, expired);

    await expect(
      context.vault.claim(expired, expiredSignature),
    ).to.be.revertedWithCustomError(context.vault, 'ReceiptExpired');

    const excessive = await makeReceipt(context, {
      reward: context.season.maxReward + 1n,
    });
    const excessiveSignature = await signReceipt(context, excessive);
    await expect(
      context.vault.claim(excessive, excessiveSignature),
    ).to.be.revertedWithCustomError(context.vault, 'InvalidReward');

    const invalidMomentum = await makeReceipt(context, { momentumBps: 20_001 });
    await expect(
      context.vault.claim(invalidMomentum, '0x'),
    ).to.be.revertedWithCustomError(context.vault, 'InvalidMomentum');

    const zeroPlayer = await makeReceipt(context, {
      player: ethers.ZeroAddress,
    });
    await expect(
      context.vault.claim(zeroPlayer, '0x'),
    ).to.be.revertedWithCustomError(context.vault, 'InvalidReward');
  });

  it('enforces season windows and remaining budgets', async function () {
    const context = await loadFixture(deployVaultFixture);
    const now = await networkHelpers.time.latest();
    const futureSeason = {
      id: 8,
      startsAt: now + 100,
      endsAt: now + 1_000,
      budget: ethers.parseEther('50'),
      maxReward: ethers.parseEther('50'),
    };
    await context.vault.connect(context.admin).configureSeason(
      futureSeason.id,
      futureSeason.startsAt,
      futureSeason.endsAt,
      futureSeason.budget,
      futureSeason.maxReward,
    );

    const earlyReceipt = await makeReceipt(context, {
      seasonId: futureSeason.id,
      reward: ethers.parseEther('40'),
      deadline: futureSeason.endsAt,
    });
    await expect(
      context.vault.claim(
        earlyReceipt,
        await signReceipt(context, earlyReceipt),
      ),
    ).to.be.revertedWithCustomError(context.vault, 'SeasonNotStarted');

    await networkHelpers.time.increaseTo(futureSeason.startsAt);
    await context.vault.claim(
      earlyReceipt,
      await signReceipt(context, earlyReceipt),
    );

    const overBudget = await makeReceipt(context, {
      seasonId: futureSeason.id,
      reward: ethers.parseEther('20'),
      deadline: futureSeason.endsAt,
    });
    await expect(
      context.vault.claim(
        overBudget,
        await signReceipt(context, overBudget),
      ),
    ).to.be.revertedWithCustomError(
      context.vault,
      'InsufficientSeasonBudget',
    );

    await networkHelpers.time.increaseTo(futureSeason.endsAt + 1);
    const lateReceipt = await makeReceipt(context, {
      seasonId: futureSeason.id,
      reward: 1,
      deadline: futureSeason.endsAt + 100,
    });
    await expect(
      context.vault.claim(lateReceipt, '0x'),
    ).to.be.revertedWithCustomError(context.vault, 'SeasonEnded');
  });

  it('cancels only an unstarted, unused season', async function () {
    const context = await loadFixture(deployVaultFixture);
    const now = await networkHelpers.time.latest();
    const budget = ethers.parseEther('1000');
    const reservedBefore = await context.vault.totalReserved();

    await context.vault.connect(context.admin).configureSeason(
      8,
      now + 1_000,
      now + 2_000,
      budget,
      ethers.parseEther('100'),
    );
    await expect(context.vault.connect(context.admin).cancelSeason(8))
      .to.emit(context.vault, 'SeasonCancelled')
      .withArgs(8, budget);
    expect(await context.vault.totalReserved()).to.equal(reservedBefore);

    await expect(
      context.vault.connect(context.admin).cancelSeason(context.season.id),
    ).to.be.revertedWithCustomError(context.vault, 'SeasonAlreadyStarted');
    await expect(
      context.vault.connect(context.admin).cancelSeason(99),
    ).to.be.revertedWithCustomError(context.vault, 'SeasonNotConfigured');
  });

  it('reserves configured budgets and only withdraws unallocated tokens', async function () {
    const context = await loadFixture(deployVaultFixture);
    const unallocated = context.vaultAllocation - context.season.budget;

    expect(await context.vault.unallocatedBalance()).to.equal(unallocated);
    await expect(
      context.vault
        .connect(context.admin)
        .withdrawUnallocated(context.treasury.address, unallocated + 1n),
    ).to.be.revertedWithCustomError(
      context.vault,
      'InsufficientUnallocatedBalance',
    );

    await context.vault
      .connect(context.admin)
      .withdrawUnallocated(context.treasury.address, unallocated);
    expect(await context.vault.unallocatedBalance()).to.equal(0n);
    expect(await context.token.balanceOf(await context.vault.getAddress())).to.equal(
      context.season.budget,
    );

    await expect(
      context.vault
        .connect(context.admin)
        .withdrawUnallocated(ethers.ZeroAddress, 0),
    ).to.be.revertedWithCustomError(context.vault, 'ZeroAddress');
    await expect(
      context.vault
        .connect(context.attacker)
        .withdrawUnallocated(context.attacker.address, 0),
    ).to.be.revertedWithCustomError(
      context.vault,
      'AccessControlUnauthorizedAccount',
    );
  });

  it('pauses claims without invalidating their run receipts', async function () {
    const context = await loadFixture(deployVaultFixture);
    const receipt = await makeReceipt(context);
    const signature = await signReceipt(context, receipt);

    await context.vault.connect(context.admin).pause();
    await expect(
      context.vault.claim(receipt, signature),
    ).to.be.revertedWithCustomError(context.vault, 'EnforcedPause');

    await context.vault.connect(context.admin).unpause();
    await context.vault.claim(receipt, signature);
    expect(await context.token.balanceOf(context.player.address)).to.equal(receipt.reward);
  });

  it('releases unused season reserves after the season closes', async function () {
    const context = await loadFixture(deployVaultFixture);

    await networkHelpers.time.increaseTo(context.season.endsAt + 1);
    await expect(context.vault.connect(context.relayer).closeSeason(context.season.id))
      .to.emit(context.vault, 'SeasonClosed')
      .withArgs(context.season.id, context.season.budget);

    expect(await context.vault.totalReserved()).to.equal(0n);
    expect(await context.vault.unallocatedBalance()).to.equal(context.vaultAllocation);

    await expect(
      context.vault.closeSeason(context.season.id),
    ).to.be.revertedWithCustomError(context.vault, 'SeasonNotActive');

    const receipt = await makeReceipt(context, {
      deadline: context.season.endsAt + 100,
    });
    await expect(
      context.vault.claim(receipt, '0x'),
    ).to.be.revertedWithCustomError(context.vault, 'SeasonNotActive');
  });

  it('cannot close a season while it is still live', async function () {
    const context = await loadFixture(deployVaultFixture);
    await expect(
      context.vault.closeSeason(context.season.id),
    ).to.be.revertedWithCustomError(context.vault, 'SeasonStillRunning');
  });
});
