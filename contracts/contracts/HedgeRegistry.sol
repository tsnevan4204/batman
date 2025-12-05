// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./HedgeReceiptNFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract HedgeRegistry is Ownable {
    using Strings for uint256;

    HedgeReceiptNFT public hedgeReceiptNFT;
    
    struct Hedge {
        address user;
        bytes32 riskHash;
        string marketId;
        uint256 amount;
        string tradeTxHash;
        string bridgeTxHash;        // CCTP burn tx on source chain (Base)
        bytes32 bridgeMessageHash;  // Circle message hash for attestation/claim
        uint256 timestamp;
        uint256 receiptTokenId;
    }
    
    mapping(uint256 => Hedge) public hedges;
    mapping(address => uint256[]) public userHedges;
    mapping(bytes32 => uint256[]) public riskHedges;
    
    uint256 private _hedgeIdCounter;
    
    event HedgeRecorded(
        uint256 indexed hedgeId,
        address indexed user,
        bytes32 indexed riskHash,
        string marketId,
        uint256 amount,
        string tradeTxHash,
        string bridgeTxHash,
        bytes32 bridgeMessageHash,
        uint256 receiptTokenId
    );

    constructor(address _hedgeReceiptNFT, address initialOwner) Ownable(initialOwner) {
        hedgeReceiptNFT = HedgeReceiptNFT(_hedgeReceiptNFT);
    }

    function recordHedge(
        bytes32 riskHash,
        string calldata marketId,
        uint256 amount,
        string calldata tradeTxHash,
        string calldata bridgeTxHash,
        bytes32 bridgeMessageHash
    ) external returns (uint256 receiptTokenId) {
        uint256 hedgeId = _hedgeIdCounter;
        _hedgeIdCounter++;
        
        Hedge memory hedge = Hedge({
            user: msg.sender,
            riskHash: riskHash,
            marketId: marketId,
            amount: amount,
            tradeTxHash: tradeTxHash,
            bridgeTxHash: bridgeTxHash,
            bridgeMessageHash: bridgeMessageHash,
            timestamp: block.timestamp,
            receiptTokenId: 0
        });
        
        hedges[hedgeId] = hedge;
        userHedges[msg.sender].push(hedgeId);
        riskHedges[riskHash].push(hedgeId);
        
        // Mint NFT receipt
        receiptTokenId = hedgeReceiptNFT.mintReceipt(
            msg.sender,
            hedgeId,
            riskHash,
            marketId,
            amount,
            block.timestamp
        );
        
        hedges[hedgeId].receiptTokenId = receiptTokenId;
        
        emit HedgeRecorded(
            hedgeId,
            msg.sender,
            riskHash,
            marketId,
            amount,
            tradeTxHash,
            bridgeTxHash,
            bridgeMessageHash,
            receiptTokenId
        );
        
        return receiptTokenId;
    }

    function getHedge(uint256 hedgeId) external view returns (Hedge memory) {
        return hedges[hedgeId];
    }

    function getUserHedges(address user) external view returns (uint256[] memory) {
        return userHedges[user];
    }

    function getRiskHedges(bytes32 riskHash) external view returns (uint256[] memory) {
        return riskHedges[riskHash];
    }

    function getHedgeCount() external view returns (uint256) {
        return _hedgeIdCounter;
    }
}
