// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";

/**
 * @title RushVestingWallet
 * @notice Linear RUSH vesting with a cliff for the core team allocation.
 * @dev Vesting accrues from `start()`, but nothing is releasable until `cliff()`.
 *      At the cliff, the linearly accrued amount unlocks.
 */
contract RushVestingWallet is VestingWallet {
    uint64 public immutable cliffDuration;

    error CliffLongerThanDuration();

    constructor(
        address beneficiary,
        uint64 startTimestamp,
        uint64 durationSeconds,
        uint64 cliffDurationSeconds
    ) VestingWallet(beneficiary, startTimestamp, durationSeconds) {
        if (cliffDurationSeconds > durationSeconds) revert CliffLongerThanDuration();
        cliffDuration = cliffDurationSeconds;
    }

    function cliff() public view returns (uint256) {
        return start() + cliffDuration;
    }

    function _vestingSchedule(uint256 totalAllocation, uint64 timestamp)
        internal
        view
        override
        returns (uint256)
    {
        if (timestamp < cliff()) return 0;
        return super._vestingSchedule(totalAllocation, timestamp);
    }
}
