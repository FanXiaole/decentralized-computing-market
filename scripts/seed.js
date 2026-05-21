/**
 * DecentAI Compute Market — 测试数据初始化脚本
 *
 * 用途：向本地Hardhat网络注入测试数据，用于前端开发调试
 *
 * 注入的数据包括：
 * - 3个GPU节点（各自质押DAIT并设置信誉分）
 * - 5个不同规格的算力任务（模拟真实市场场景）
 *
 * 使用方法：
 *   npx hardhat run scripts/seed.js --network localhost
 */

const hre = require("hardhat");

// 合约地址（部署后填入，或通过环境变量读取）
const CONFIG = {
  token: process.env.CONTRACT_ADDRESS_TOKEN,
  staking: process.env.CONTRACT_ADDRESS_STAKING_MANAGER,
  reputation: process.env.CONTRACT_ADDRESS_REPUTATION_ORACLE,
  market: process.env.CONTRACT_ADDRESS_COMPUTE_MARKET,
};

async function main() {
  const [deployer, oracle, node1, node2, node3, requester1, requester2] =
    await hre.ethers.getSigners();

  console.log("🌱 开始注入测试数据...\n");

  // 获取合约实例
  const token = await hre.ethers.getContractAt("DecentAIToken", CONFIG.token);
  const staking = await hre.ethers.getContractAt("StakingManager", CONFIG.staking);
  const reputation = await hre.ethers.getContractAt("ReputationOracle", CONFIG.reputation);
  const market = await hre.ethers.getContractAt("ComputeMarket", CONFIG.market);

  // ========== 1. 分发测试代币给节点和需求方 ==========
  console.log("--- 分发测试代币 ---");
  const mintAmount = hre.ethers.parseEther("100000"); // 10万DAIT每人

  for (const account of [node1, node2, node3, requester1, requester2]) {
    const tx = await token.mint(account.address, mintAmount);
    await tx.wait();
    console.log(`✅ 已铸造 100000 DAIT -> ${account.address}`);
  }

  // ========== 2. 节点质押 ==========
  console.log("\n--- 节点质押 ---");

  async function stakeAndApprove(node, amount) {
    const tx1 = await token.connect(node).approve(CONFIG.staking, amount);
    await tx1.wait();
    const tx2 = await staking.connect(node).stake(amount);
    await tx2.wait();
    console.log(`✅ ${node.address.slice(0, 10)}... 已质押 ${hre.ethers.formatEther(amount)} DAIT`);
  }

  // node1: 大节点，质押50000 DAIT（能接高额任务）
  await stakeAndApprove(node1, hre.ethers.parseEther("50000"));
  // node2: 中等节点，质押20000 DAIT
  await stakeAndApprove(node2, hre.ethers.parseEther("20000"));
  // node3: 小节点，质押5000 DAIT（只能接小额任务）
  await stakeAndApprove(node3, hre.ethers.parseEther("5000"));

  // ========== 3. 设置初始信誉分 ==========
  console.log("\n--- 设置信誉分 ---");

  async function setReputation(node, score, breakdown) {
    const tx = await reputation.connect(oracle).updateScore(
      node.address,
      score,
      JSON.stringify(breakdown)
    );
    await tx.wait();
    console.log(
      `✅ ${node.address.slice(0, 10)}... 信誉分: ${score}`
    );
  }

  await setReputation(node1, 95, { completion: 98, dispute: 100, speed: 90, maturity: 85 });
  await setReputation(node2, 78, { completion: 80, dispute: 85, speed: 75, maturity: 70 });
  await setReputation(node3, 60, { completion: 65, dispute: 70, speed: 55, maturity: 40 });

  // ========== 4. 发布测试任务 ==========
  console.log("\n--- 发布测试任务 ---");

  async function postTask(requester, description, rewardEth, daysFromNow, minRep) {
    const reward = hre.ethers.parseEther(rewardEth);
    const deadline = Math.floor(Date.now() / 1000) + daysFromNow * 86400;

    const tx1 = await token.connect(requester).approve(CONFIG.market, reward);
    await tx1.wait();
    const tx2 = await market.connect(requester).postTask(
      description,
      reward,
      deadline,
      minRep
    );
    const receipt = await tx2.wait();
    console.log(`✅ 任务已发布: "${description}" (${rewardEth} DAIT)`);
  }

  // 需求方approve代币给Market合约
  await postTask(
    requester1,
    "训练GPT-2模型（124M参数），10个epoch，需要8x H100 GPU",
    "1000",
    7,
    70
  );
  await postTask(
    requester1,
    "Stable Diffusion XL图片批量推理，10000张图片",
    "500",
    3,
    80
  );
  await postTask(
    requester2,
    "运行LLaMA-7B模型推理服务，提供API接口",
    "2000",
    14,
    90
  );
  await postTask(
    requester2,
    "小型CNN模型训练（MNIST规模），快速验证用",
    "100",
    1,
    50
  );
  await postTask(
    requester1,
    "强化学习环境模拟，1000个episode的DQN训练",
    "800",
    5,
    60
  );

  console.log("\n🌱 测试数据注入完成！");
  console.log("---");
  console.log("可用账户:");
  console.log(`  Oracle:       ${oracle.address}`);
  console.log(`  Node1 (大):   ${node1.address} - 质押50000, 信誉95`);
  console.log(`  Node2 (中):   ${node2.address} - 质押20000, 信誉78`);
  console.log(`  Node3 (小):   ${node3.address} - 质押5000, 信誉60`);
  console.log(`  Requester1:   ${requester1.address}`);
  console.log(`  Requester2:   ${requester2.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
