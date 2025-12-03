const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy HedgeReceiptNFT first
  const HedgeReceiptNFT = await hre.ethers.getContractFactory("HedgeReceiptNFT");
  const receiptNFT = await HedgeReceiptNFT.deploy(deployer.address);
  await receiptNFT.waitForDeployment();
  const receiptNFTAddress = await receiptNFT.getAddress();
  console.log("HedgeReceiptNFT deployed to:", receiptNFTAddress);

  // Deploy HedgeRegistry
  const HedgeRegistry = await hre.ethers.getContractFactory("HedgeRegistry");
  const registry = await HedgeRegistry.deploy(receiptNFTAddress, deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("HedgeRegistry deployed to:", registryAddress);

  // Set HedgeRegistry in HedgeReceiptNFT
  const setRegistryTx = await receiptNFT.setHedgeRegistry(registryAddress);
  await setRegistryTx.wait();
  console.log("HedgeRegistry set in HedgeReceiptNFT");

  console.log("\n=== Deployment Summary ===");
  console.log("HedgeReceiptNFT:", receiptNFTAddress);
  console.log("HedgeRegistry:", registryAddress);
  console.log("\nSave these addresses for your frontend and backend configuration!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

