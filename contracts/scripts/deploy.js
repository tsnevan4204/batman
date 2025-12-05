const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Required USDC token address for HedgedEscrow
  // Defaults to Base mainnet USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54B268B0ed
  const usdcToken =
    process.env.USDC_TOKEN ||
    "0x833589fCD6eDb6E08f4c7C32D4f71b54B268B0ed";

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

  // Deploy HedgeRouter
  const HedgeRouter = await hre.ethers.getContractFactory("HedgeRouter");
  const router = await HedgeRouter.deploy();
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("HedgeRouter deployed to:", routerAddress);

  // Deploy HedgedEscrow (requires token address)
  const HedgedEscrow = await hre.ethers.getContractFactory("HedgedEscrow");
  const escrow = await HedgedEscrow.deploy(usdcToken, deployer.address);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("HedgedEscrow deployed to:", escrowAddress);

  // Set HedgeRegistry in HedgeReceiptNFT
  const setRegistryTx = await receiptNFT.setHedgeRegistry(registryAddress);
  await setRegistryTx.wait();
  console.log("HedgeRegistry set in HedgeReceiptNFT");

  console.log("\n=== Deployment Summary ===");
  console.log("HedgeReceiptNFT:", receiptNFTAddress);
  console.log("HedgeRegistry:", registryAddress);
  console.log("HedgeRouter:", routerAddress);
  console.log("HedgedEscrow:", escrowAddress);
  console.log("\nSave these addresses for your frontend and backend configuration!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

