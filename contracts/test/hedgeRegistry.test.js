const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("HedgeRegistry + HedgeReceiptNFT", function () {
  async function deployFixture() {
    const [owner, user, other] = await ethers.getSigners();

    const HedgeReceiptNFT = await ethers.getContractFactory("HedgeReceiptNFT");
    const nft = await HedgeReceiptNFT.deploy(owner.address);

    const HedgeRegistry = await ethers.getContractFactory("HedgeRegistry");
    const registry = await HedgeRegistry.deploy(nft.target, owner.address);

    // wire registry into NFT
    await nft.connect(owner).setHedgeRegistry(registry.target);

    const riskHash = ethers.keccak256(ethers.toUtf8Bytes("risk-1"));
    const marketId = "market-xyz";
    const amount = 1_000_000; // 1 USDC in 6 decimals
    const tradeTxHash = "0xtxhash";

    return { owner, user, other, nft, registry, riskHash, marketId, amount, tradeTxHash };
  }

  it("records a hedge and mints receipt", async function () {
    const { user, nft, registry, riskHash, marketId, amount, tradeTxHash } = await loadFixture(
      deployFixture
    );

    console.log("[test] user:", user.address);
    console.log("[test] calling recordHedge with", { riskHash, marketId, amount, tradeTxHash });
    await expect(
      registry.connect(user).recordHedge(riskHash, marketId, amount, tradeTxHash)
    )
      .to.emit(registry, "HedgeRecorded")
      .withArgs(0, user.address, riskHash, marketId, amount, tradeTxHash, 1);

    const hedge = await registry.hedges(0);
    console.log("[test] hedge stored:", hedge);
    expect(hedge.user).to.equal(user.address);
    expect(hedge.riskHash).to.equal(riskHash);
    expect(hedge.marketId).to.equal(marketId);
    expect(hedge.amount).to.equal(amount);
    expect(hedge.tradeTxHash).to.equal(tradeTxHash);
    expect(hedge.receiptTokenId).to.equal(1);

    const userHedges = await registry.getUserHedges(user.address);
    expect(userHedges.map((x) => Number(x))).to.deep.equal([0]);

    const riskHedges = await registry.getRiskHedges(riskHash);
    expect(riskHedges.map((x) => Number(x))).to.deep.equal([0]);

    expect(await nft.ownerOf(1)).to.equal(user.address);

    const receiptData = await nft.getReceiptData(1);
    console.log("[test] receiptData:", receiptData);
    expect(receiptData.riskHash).to.equal(riskHash);
    expect(receiptData.marketId).to.equal(marketId);
    expect(receiptData.amount).to.equal(amount);
    expect(receiptData.hedgeId).to.equal(0);
    expect(receiptData.resolved).to.equal(false);

    const uri = await nft.tokenURI(1);
    expect(uri).to.contain("data:application/json;base64,");
  });

  it("reverts mintReceipt when caller is not registry", async function () {
    const { owner, user, nft } = await loadFixture(deployFixture);
    console.log("[test] expect mintReceipt revert when caller != registry");
    await expect(
      nft.connect(owner).mintReceipt(user.address, 0, ethers.ZeroHash, "mkt", 1, 1)
    ).to.be.revertedWith("Only HedgeRegistry can mint");
  });

  it("updates settlement only by owner", async function () {
    const { owner, user, nft, registry, riskHash, marketId, amount, tradeTxHash } =
      await loadFixture(deployFixture);

    console.log("[test] record hedge to mint tokenId 1");
    await registry.connect(user).recordHedge(riskHash, marketId, amount, tradeTxHash);

    console.log("[test] expect updateSettlement revert when called by user");
    await expect(
      nft.connect(user).updateSettlement(1, "YES", 2_000_000, 1234)
    ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");

    console.log("[test] owner updating settlement on tokenId 1");
    await nft.connect(owner).updateSettlement(1, "YES", 2_000_000, 1234);
    const receipt = await nft.getReceiptData(1);
    console.log("[test] receipt after settlement:", receipt);
    expect(receipt.resolved).to.equal(true);
    expect(receipt.resolvedOutcome).to.equal("YES");
    expect(receipt.settlementPrice).to.equal(2_000_000);
    expect(receipt.settlementTimestamp).to.equal(1234);
  });
});

