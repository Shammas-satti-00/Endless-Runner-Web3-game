// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/**
 * @title RunRewardVault
 * @notice Turns signed proof-of-run receipts into RUSH rewards.
 * @dev Rewards are paid from pre-funded season budgets. The game client cannot
 *      mint or choose a reward; an authorized attestor signs the receipt after
 *      server-side anti-cheat validation.
 */
contract RunRewardVault is AccessControl, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    bytes32 public constant SEASON_MANAGER_ROLE = keccak256("SEASON_MANAGER_ROLE");
    bytes32 public constant SIGNER_MANAGER_ROLE = keccak256("SIGNER_MANAGER_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    bytes32 public constant RUN_RECEIPT_TYPEHASH = keccak256(
        "RunReceipt(address player,bytes32 runId,uint32 seasonId,uint64 score,uint64 distance,uint32 coins,uint32 momentumBps,uint128 reward,uint64 deadline)"
    );

    uint32 public constant MAX_MOMENTUM_BPS = 20_000;

    struct Season {
        uint64 startsAt;
        uint64 endsAt;
        uint96 maxRewardPerRun;
        uint128 budget;
        uint128 claimed;
        bool active;
    }

    struct RunReceipt {
        address player;
        bytes32 runId;
        uint32 seasonId;
        uint64 score;
        uint64 distance;
        uint32 coins;
        uint32 momentumBps;
        uint128 reward;
        uint64 deadline;
    }

    IERC20 public immutable rewardToken;
    address public trustedSigner;
    uint256 public totalReserved;

    mapping(uint32 seasonId => Season season) public seasons;
    mapping(bytes32 runId => bool claimed) public claimedRuns;

    event Funded(address indexed sender, uint256 amount);
    event SeasonConfigured(
        uint32 indexed seasonId,
        uint64 startsAt,
        uint64 endsAt,
        uint128 budget,
        uint96 maxRewardPerRun
    );
    event SeasonClosed(uint32 indexed seasonId, uint256 releasedBudget);
    event SeasonCancelled(uint32 indexed seasonId, uint256 releasedBudget);
    event TrustedSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event RunClaimed(
        bytes32 indexed runId,
        uint32 indexed seasonId,
        address indexed player,
        uint128 reward,
        uint64 score,
        uint64 distance,
        uint32 coins,
        uint32 momentumBps
    );
    event UnallocatedWithdrawn(address indexed recipient, uint256 amount);

    error ZeroAddress();
    error InvalidSeasonWindow();
    error InvalidSeasonBudget();
    error SeasonAlreadyConfigured(uint32 seasonId);
    error SeasonNotConfigured(uint32 seasonId);
    error SeasonNotActive(uint32 seasonId);
    error SeasonNotStarted(uint32 seasonId);
    error SeasonEnded(uint32 seasonId);
    error SeasonStillRunning(uint32 seasonId);
    error SeasonAlreadyStarted(uint32 seasonId);
    error InsufficientFunding(uint256 required, uint256 available);
    error RunAlreadyClaimed(bytes32 runId);
    error ReceiptExpired(uint64 deadline);
    error InvalidReward(uint256 reward);
    error InvalidMomentum(uint32 momentumBps);
    error InvalidSignature();
    error InsufficientSeasonBudget(uint256 remaining, uint256 requested);
    error InsufficientUnallocatedBalance(uint256 available, uint256 requested);

    constructor(IERC20 rewardToken_, address admin, address trustedSigner_)
        EIP712("Subway Rush Run Rewards", "1")
    {
        if (
            address(rewardToken_) == address(0) ||
            admin == address(0) ||
            trustedSigner_ == address(0)
        ) {
            revert ZeroAddress();
        }

        rewardToken = rewardToken_;
        trustedSigner = trustedSigner_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SEASON_MANAGER_ROLE, admin);
        _grantRole(SIGNER_MANAGER_ROLE, admin);
        _grantRole(TREASURER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function fund(uint256 amount) external {
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(msg.sender, amount);
    }

    function configureSeason(
        uint32 seasonId,
        uint64 startsAt,
        uint64 endsAt,
        uint128 budget,
        uint96 maxRewardPerRun
    ) external onlyRole(SEASON_MANAGER_ROLE) {
        if (seasons[seasonId].endsAt != 0) revert SeasonAlreadyConfigured(seasonId);
        if (startsAt >= endsAt || endsAt <= block.timestamp) revert InvalidSeasonWindow();
        if (budget == 0 || maxRewardPerRun == 0 || maxRewardPerRun > budget) {
            revert InvalidSeasonBudget();
        }

        uint256 requiredBalance = totalReserved + budget;
        uint256 currentBalance = rewardToken.balanceOf(address(this));
        if (currentBalance < requiredBalance) {
            revert InsufficientFunding(requiredBalance, currentBalance);
        }

        seasons[seasonId] = Season({
            startsAt: startsAt,
            endsAt: endsAt,
            maxRewardPerRun: maxRewardPerRun,
            budget: budget,
            claimed: 0,
            active: true
        });
        totalReserved = requiredBalance;

        emit SeasonConfigured(seasonId, startsAt, endsAt, budget, maxRewardPerRun);
    }

    function cancelSeason(uint32 seasonId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Season storage season = _configuredSeason(seasonId);
        if (block.timestamp >= season.startsAt || season.claimed != 0) {
            revert SeasonAlreadyStarted(seasonId);
        }

        uint256 releasedBudget = season.budget;
        season.active = false;
        totalReserved -= releasedBudget;

        emit SeasonCancelled(seasonId, releasedBudget);
    }

    function closeSeason(uint32 seasonId) external {
        Season storage season = _configuredSeason(seasonId);
        if (!season.active) revert SeasonNotActive(seasonId);
        if (block.timestamp <= season.endsAt) revert SeasonStillRunning(seasonId);

        uint256 releasedBudget = uint256(season.budget) - season.claimed;
        season.active = false;
        totalReserved -= releasedBudget;

        emit SeasonClosed(seasonId, releasedBudget);
    }

    function claim(RunReceipt calldata receipt, bytes calldata signature)
        external
        nonReentrant
        whenNotPaused
    {
        Season storage season = _configuredSeason(receipt.seasonId);
        if (!season.active) revert SeasonNotActive(receipt.seasonId);
        if (block.timestamp < season.startsAt) revert SeasonNotStarted(receipt.seasonId);
        if (block.timestamp > season.endsAt) revert SeasonEnded(receipt.seasonId);
        if (receipt.deadline < block.timestamp) revert ReceiptExpired(receipt.deadline);
        if (claimedRuns[receipt.runId]) revert RunAlreadyClaimed(receipt.runId);
        if (
            receipt.player == address(0) ||
            receipt.reward == 0 ||
            receipt.reward > season.maxRewardPerRun
        ) {
            revert InvalidReward(receipt.reward);
        }
        if (receipt.momentumBps > MAX_MOMENTUM_BPS) {
            revert InvalidMomentum(receipt.momentumBps);
        }

        uint256 remaining = uint256(season.budget) - season.claimed;
        if (receipt.reward > remaining) {
            revert InsufficientSeasonBudget(remaining, receipt.reward);
        }

        bytes32 digest = _hashTypedDataV4(_hashReceipt(receipt));
        if (!SignatureChecker.isValidSignatureNowCalldata(trustedSigner, digest, signature)) {
            revert InvalidSignature();
        }

        claimedRuns[receipt.runId] = true;
        season.claimed += receipt.reward;
        totalReserved -= receipt.reward;

        rewardToken.safeTransfer(receipt.player, receipt.reward);

        emit RunClaimed(
            receipt.runId,
            receipt.seasonId,
            receipt.player,
            receipt.reward,
            receipt.score,
            receipt.distance,
            receipt.coins,
            receipt.momentumBps
        );
    }

    function setTrustedSigner(address newSigner) external onlyRole(SIGNER_MANAGER_ROLE) {
        if (newSigner == address(0)) revert ZeroAddress();
        address previousSigner = trustedSigner;
        trustedSigner = newSigner;
        emit TrustedSignerUpdated(previousSigner, newSigner);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function withdrawUnallocated(address recipient, uint256 amount)
        external
        onlyRole(TREASURER_ROLE)
    {
        if (recipient == address(0)) revert ZeroAddress();
        uint256 available = unallocatedBalance();
        if (amount > available) {
            revert InsufficientUnallocatedBalance(available, amount);
        }

        rewardToken.safeTransfer(recipient, amount);
        emit UnallocatedWithdrawn(recipient, amount);
    }

    function unallocatedBalance() public view returns (uint256) {
        uint256 balance = rewardToken.balanceOf(address(this));
        return balance > totalReserved ? balance - totalReserved : 0;
    }

    function hashReceipt(RunReceipt calldata receipt) external view returns (bytes32) {
        return _hashTypedDataV4(_hashReceipt(receipt));
    }

    function _configuredSeason(uint32 seasonId) private view returns (Season storage season) {
        season = seasons[seasonId];
        if (season.endsAt == 0) revert SeasonNotConfigured(seasonId);
    }

    function _hashReceipt(RunReceipt calldata receipt) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                RUN_RECEIPT_TYPEHASH,
                receipt.player,
                receipt.runId,
                receipt.seasonId,
                receipt.score,
                receipt.distance,
                receipt.coins,
                receipt.momentumBps,
                receipt.reward,
                receipt.deadline
            )
        );
    }
}
