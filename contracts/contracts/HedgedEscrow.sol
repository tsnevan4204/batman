// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title HedgedEscrow
 * @notice Simple B2B escrow with optional linkage to a HedgeRouter intent.
 *         Funds (e.g., USDC) are held until release/cancel conditions.
 *         This is a hackathon-friendly scaffold; production would need
 *         robust dispute/arbiter/oracle logic.
 */
contract HedgedEscrow is Ownable {
    IERC20 public immutable asset; // e.g., USDC on Base

    struct Escrow {
        address payer;
        address payee;
        uint256 amount;         // token amount (assumed 6 decimals for USDC)
        bytes32 condition;      // opaque condition identifier (off-chain evaluated)
        uint256 hedgeIntentId;  // link to HedgeRouter intent (optional)
        bool released;
        bool canceled;
    }

    mapping(uint256 => Escrow) public escrows;
    uint256 public escrowCount;

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed payer,
        address indexed payee,
        uint256 amount,
        bytes32 condition,
        uint256 hedgeIntentId
    );
    event EscrowReleased(uint256 indexed escrowId, address indexed payee);
    event EscrowCanceled(uint256 indexed escrowId, address indexed payer);

    constructor(address token, address initialOwner) Ownable(initialOwner) {
        require(token != address(0), "Invalid token");
        asset = IERC20(token);
    }

    /**
     * @notice Create an escrow by transferring funds from payer to contract.
     * @param payee recipient
     * @param amount token amount (caller must have approved this contract)
     * @param condition opaque identifier for off-chain logic
     * @param hedgeIntentId optional link to HedgeRouter intent
     */
    function createEscrow(
        address payee,
        uint256 amount,
        bytes32 condition,
        uint256 hedgeIntentId
    ) external returns (uint256 escrowId) {
        require(payee != address(0), "Invalid payee");
        require(amount > 0, "Amount must be >0");

        escrowId = escrowCount;
        escrowCount++;

        escrows[escrowId] = Escrow({
            payer: msg.sender,
            payee: payee,
            amount: amount,
            condition: condition,
            hedgeIntentId: hedgeIntentId,
            released: false,
            canceled: false
        });

        // Pull funds into escrow
        require(asset.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        emit EscrowCreated(escrowId, msg.sender, payee, amount, condition, hedgeIntentId);
    }

    /**
     * @notice Release escrow to payee. For demo, owner (trusted) or payer can release.
     *         In production, tie to oracle/arbiter.
     */
    function release(uint256 escrowId) external {
        Escrow storage e = escrows[escrowId];
        require(!e.released && !e.canceled, "Already settled");
        require(msg.sender == e.payer || msg.sender == owner(), "Not authorized");

        e.released = true;
        require(asset.transfer(e.payee, e.amount), "Transfer failed");
        emit EscrowReleased(escrowId, e.payee);
    }

    /**
     * @notice Cancel escrow and return funds to payer. For demo, owner (trusted) or payer can cancel.
     */
    function cancel(uint256 escrowId) external {
        Escrow storage e = escrows[escrowId];
        require(!e.released && !e.canceled, "Already settled");
        require(msg.sender == e.payer || msg.sender == owner(), "Not authorized");

        e.canceled = true;
        require(asset.transfer(e.payer, e.amount), "Transfer failed");
        emit EscrowCanceled(escrowId, e.payer);
    }
}

