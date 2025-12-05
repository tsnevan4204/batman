// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HedgeRouter
 * @notice On-chain intent + trigger registry for hedging. Backend/off-chain executor
 *         listens to events and executes hedges on Polymarket CLOB when conditions are met.
 */
contract HedgeRouter {
    struct HedgeIntent {
        address user;
        string risk;          // free-form description
        string marketHint;    // optional hint for matching (keywords/slug)
        uint256 usdcAmount;   // 6-decimal USDC amount user wants to hedge
        uint256 triggerValue; // threshold (semantics defined by triggerType)
        bytes32 triggerType;  // e.g., "price_above", "price_below", "date", "oracle_feed"
        bool open;
    }

    mapping(uint256 => HedgeIntent) public intents;
    uint256 public intentCount;

    event HedgeIntentCreated(
        uint256 indexed intentId,
        address indexed user,
        string risk,
        string marketHint,
        uint256 usdcAmount,
        uint256 triggerValue,
        bytes32 triggerType
    );

    event HedgeIntentCancelled(uint256 indexed intentId, address indexed user);
    event HedgeIntentTriggered(uint256 indexed intentId, bytes32 triggerType, uint256 triggerValue, string marketUsed);

    /**
     * @notice Create a new hedge intent. Off-chain backend will watch this event
     *         and execute when trigger conditions are satisfied.
     */
    function createIntent(
        string calldata risk,
        string calldata marketHint,
        uint256 usdcAmount,
        uint256 triggerValue,
        bytes32 triggerType
    ) external returns (uint256 intentId) {
        intentId = intentCount;
        intents[intentId] = HedgeIntent({
            user: msg.sender,
            risk: risk,
            marketHint: marketHint,
            usdcAmount: usdcAmount,
            triggerValue: triggerValue,
            triggerType: triggerType,
            open: true
        });
        intentCount++;

        emit HedgeIntentCreated(intentId, msg.sender, risk, marketHint, usdcAmount, triggerValue, triggerType);
    }

    /**
     * @notice Cancel an open intent.
     */
    function cancelIntent(uint256 intentId) external {
        HedgeIntent storage intent = intents[intentId];
        require(intent.user == msg.sender, "Not intent owner");
        require(intent.open, "Already closed");
        intent.open = false;
        emit HedgeIntentCancelled(intentId, msg.sender);
    }

    /**
     * @notice Mark an intent as triggered. Intended to be called by off-chain
     *         executor after submitting a hedge to Polymarket. This emits an
     *         on-chain signal for provenance.
     */
    function markTriggered(
        uint256 intentId,
        bytes32 triggerType,
        uint256 triggerValue,
        string calldata marketUsed
    ) external {
        // Anyone can mark triggered for transparency; provenance is via event log.
        HedgeIntent storage intent = intents[intentId];
        require(intent.open, "Intent closed");
        intent.open = false;
        emit HedgeIntentTriggered(intentId, triggerType, triggerValue, marketUsed);
    }
}

