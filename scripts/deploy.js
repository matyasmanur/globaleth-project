const hre = require("hardhat");

async function main() {
  console.log("Deploying contracts...");

  // Deploy LegitToken
  const LegitToken = await hre.ethers.getContractFactory("LegitToken");
  const legitToken = await LegitToken.deploy();
  await legitToken.waitForDeployment();
  console.log("LegitToken deployed to:", await legitToken.getAddress());

  // Deploy SuspiciousToken
  const SuspiciousToken = await hre.ethers.getContractFactory("SuspiciousToken");
  const suspiciousToken = await SuspiciousToken.deploy();
  await suspiciousToken.waitForDeployment();
  console.log("SuspiciousToken deployed to:", await suspiciousToken.getAddress());

  // Wait for a few blocks for verification
  console.log("Waiting for block confirmations...");
  await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds delay

  // Verify LegitToken
  console.log("Verifying LegitToken...");
  try {
    await hre.run("verify:verify", {
      address: await legitToken.getAddress(),
      constructorArguments: [],
    });
    console.log("LegitToken verified successfully");
  } catch (error) {
    console.error("Error verifying LegitToken:", error);
  }

  // Verify SuspiciousToken
  console.log("Verifying SuspiciousToken...");
  try {
    await hre.run("verify:verify", {
      address: await suspiciousToken.getAddress(),
      constructorArguments: [],
    });
    console.log("SuspiciousToken verified successfully");
  } catch (error) {
    console.error("Error verifying SuspiciousToken:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 