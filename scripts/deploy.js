/**
 * DecentAI Compute Market — 主部署脚本
 *
 * 部署顺序（严格按依赖关系）：
 * 1. DecentAIToken（无依赖）
 * 2. StakingManager（依赖Token地址）
 * 3. ReputationOracle（无依赖，但需Oracle地址）
 * 4. ComputeMarket（依赖上述三个合约地址）
 * 5. 设置StakingManager的authorizedMarket（后置授权）
 *
 * 使用方法：
 *   npx hardhat run scripts/deploy.js --network localhost
 *   npx hardhat run scripts/deploy.js --network sepolia
 */

const hre = require("hardhat");

async function main() {
  // 获取部署账户
  const [deployer, oracle] = await hre.ethers.getSigners();
  console.log(`\n🔧 部署账户: ${deployer.address}`);
  console.log(`🔮 Oracle账户: ${oracle.address}\n`);

  // ========== 1. 部署 DecentAIToken ==========
  console.log("--- 部署 DecentAIToken ---");
  const DecentAIToken = await hre.ethers.getContractFactory("DecentAIToken");
  const token = await DecentAIToken.deploy(deployer.address);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`✅ DecentAIToken 已部署: ${tokenAddr}`);

  // ========== 2. 部署 StakingManager ==========
  console.log("\n--- 部署 StakingManager ---");
  const StakingManager = await hre.ethers.getContractFactory("StakingManager");
  const staking = await StakingManager.deploy(deployer.address, tokenAddr);
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log(`✅ StakingManager 已部署: ${stakingAddr}`);

  // ========== 3. 部署 ReputationOracle ==========
  console.log("\n--- 部署 ReputationOracle ---");
  const ReputationOracle = await hre.ethers.getContractFactory("ReputationOracle");
  const reputation = await ReputationOracle.deploy(deployer.address, oracle.address);
  await reputation.waitForDeployment();
  const reputationAddr = await reputation.getAddress();
  console.log(`✅ ReputationOracle 已部署: ${reputationAddr}`);

  // ========== 4. 部署 ComputeMarket ==========
  console.log("\n--- 部署 ComputeMarket ---");
  const ComputeMarket = await hre.ethers.getContractFactory("ComputeMarket");
  const market = await ComputeMarket.deploy(stakingAddr, reputationAddr, tokenAddr);
  await market.waitForDeployment();
  const marketAddr = await market.getAddress();
  console.log(`✅ ComputeMarket 已部署: ${marketAddr}`);

  // ========== 5. 设置授权关系 ==========
  console.log("\n--- 设置合约授权 ---");
  const tx = await staking.setAuthorizedMarket(marketAddr);
  await tx.wait();
  console.log(`✅ StakingManager已授权ComputeMarket: ${marketAddr}`);

  // ========== 部署摘要 ==========
  console.log("\n" + "=".repeat(60));
  console.log("📋 部署摘要");
  console.log("=".repeat(60));
  console.log(`DecentAIToken:      ${tokenAddr}`);
  console.log(`StakingManager:     ${stakingAddr}`);
  console.log(`ReputationOracle:   ${reputationAddr}`);
  console.log(`ComputeMarket:      ${marketAddr}`);
  console.log(`Oracle账户:         ${oracle.address}`);
  console.log("=".repeat(60) + "\n");

  console.log("💡 将以下地址填入 backend/.env 和 frontend/.env：");
  console.log(`CONTRACT_ADDRESS_TOKEN=${tokenAddr}`);
  console.log(`CONTRACT_ADDRESS_STAKING_MANAGER=${stakingAddr}`);
  console.log(`CONTRACT_ADDRESS_REPUTATION_ORACLE=${reputationAddr}`);
  console.log(`CONTRACT_ADDRESS_COMPUTE_MARKET=${marketAddr}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
