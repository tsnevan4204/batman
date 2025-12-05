// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract HedgeReceiptNFT is ERC721URIStorage, Ownable {
    using Strings for uint256;

    address public hedgeRegistry;
    
    struct ReceiptMetadata {
        bytes32 riskHash;
        string marketId;
        uint256 amount;
        uint256 timestamp;
        uint256 hedgeId;
        bool resolved;
        string resolvedOutcome;
        uint256 settlementPrice;
        uint256 settlementTimestamp;
    }
    
    mapping(uint256 => ReceiptMetadata) public receiptData;
    uint256 private _tokenIdCounter;

    event ReceiptMinted(address indexed to, uint256 indexed tokenId, uint256 indexed hedgeId);

    constructor(address initialOwner) ERC721("Hedge Receipt", "HEDGE") Ownable(initialOwner) {
        _tokenIdCounter = 1;
    }

    function setHedgeRegistry(address _hedgeRegistry) external onlyOwner {
        hedgeRegistry = _hedgeRegistry;
    }

    function mintReceipt(
        address to,
        uint256 hedgeId,
        bytes32 riskHash,
        string memory marketId,
        uint256 amount,
        uint256 timestamp
    ) external returns (uint256) {
        require(msg.sender == hedgeRegistry, "Only HedgeRegistry can mint");
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        receiptData[tokenId] = ReceiptMetadata({
            riskHash: riskHash,
            marketId: marketId,
            amount: amount,
            timestamp: timestamp,
            hedgeId: hedgeId,
            resolved: false,
            resolvedOutcome: "",
            settlementPrice: 0,
            settlementTimestamp: 0
        });
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, _generateTokenURI(tokenId));
        
        emit ReceiptMinted(to, tokenId, hedgeId);
        
        return tokenId;
    }

    /**
     * @notice Update settlement/resolution details for an existing receipt.
     * @dev Restricted to owner (could be backend-controlled or registry-controlled).
     */
    function updateSettlement(
        uint256 tokenId,
        string calldata resolvedOutcome,
        uint256 settlementPrice,
        uint256 settlementTimestamp
    ) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        ReceiptMetadata storage data = receiptData[tokenId];
        data.resolved = true;
        data.resolvedOutcome = resolvedOutcome;
        data.settlementPrice = settlementPrice;
        data.settlementTimestamp = settlementTimestamp;
        _setTokenURI(tokenId, _generateTokenURI(tokenId));
    }

    function _generateTokenURI(uint256 tokenId) internal view returns (string memory) {
        ReceiptMetadata memory data = receiptData[tokenId];
        
        string memory json = string(abi.encodePacked(
            '{"name":"Hedge Receipt #', tokenId.toString(), '",',
            '"description":"Proof of hedge on Polymarket",',
            '"attributes":[',
            '{"trait_type":"Market ID","value":"', data.marketId, '"},',
            '{"trait_type":"Amount","value":"', _formatAmount(data.amount), '"},',
            '{"trait_type":"Timestamp","value":"', data.timestamp.toString(), '"},',
            '{"trait_type":"Resolved","value":"', data.resolved ? "true" : "false", '"},',
            '{"trait_type":"Resolved Outcome","value":"', data.resolvedOutcome, '"},',
            '{"trait_type":"Settlement Price","value":"', _formatAmount(data.settlementPrice), '"},',
            '{"trait_type":"Settlement Time","value":"', data.settlementTimestamp.toString(), '"}',
            '],',
            '"image":"data:image/svg+xml;base64,', _generateSVG(tokenId, data), '"',
            '}'
        ));
        
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    function _generateSVG(uint256 tokenId, ReceiptMetadata memory data) internal pure returns (string memory) {
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">',
            '<rect width="400" height="400" fill="#1a1a2e"/>',
            '<text x="200" y="50" font-family="Arial" font-size="24" fill="#fff" text-anchor="middle">Hedge Receipt</text>',
            '<text x="200" y="100" font-family="Arial" font-size="18" fill="#4ecdc4" text-anchor="middle">#', tokenId.toString(), '</text>',
            '<text x="200" y="150" font-family="Arial" font-size="14" fill="#fff" text-anchor="middle">Market: ', data.marketId, '</text>',
            '<text x="200" y="200" font-family="Arial" font-size="14" fill="#fff" text-anchor="middle">Amount: ', _formatAmount(data.amount), ' USDC</text>',
            '</svg>'
        ));
        
        return Base64.encode(bytes(svg));
    }

    function _formatAmount(uint256 amount) internal pure returns (string memory) {
        if (amount == 0) return "0";
        uint256 decimals = 6; // USDC has 6 decimals
        uint256 whole = amount / 10**decimals;
        uint256 fraction = amount % 10**decimals;
        
        if (fraction == 0) {
            return whole.toString();
        }
        
        // Format with up to 6 decimal places
        string memory fractionStr = fraction.toString();
        while (bytes(fractionStr).length < decimals) {
            fractionStr = string(abi.encodePacked("0", fractionStr));
        }
        
        // Remove trailing zeros
        bytes memory fractionBytes = bytes(fractionStr);
        uint256 len = fractionBytes.length;
        while (len > 0 && fractionBytes[len - 1] == '0') {
            len--;
        }
        
        if (len == 0) {
            return whole.toString();
        }
        
        string memory trimmedFraction = new string(len);
        for (uint256 i = 0; i < len; i++) {
            bytes(trimmedFraction)[i] = fractionBytes[i];
        }
        
        return string(abi.encodePacked(whole.toString(), ".", trimmedFraction));
    }

    function getReceiptData(uint256 tokenId) external view returns (ReceiptMetadata memory) {
        return receiptData[tokenId];
    }
}

