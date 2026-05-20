const { ethers } = require("hardhat")

async function main() {
    const fundFactory = await ethers.getContractFactory("CrowdFunding")
    console.log("contract deploying")
    // 部署合约，传入众筹目标 1 ETH
    const fund = await fundFactory.deploy(1)
    await fund.waitForDeployment()
    console.log(`contract has been deployed successfully, contract address is ${fund.target}`)
}

main()
    .then()
    .catch((error) => {
        console.error(error)
        process.exit(0)
    })