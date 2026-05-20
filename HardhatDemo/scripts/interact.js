const { ethers } = require("hardhat")

async function main() {
    const addr = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    const fundFactory = await ethers.getContractFactory("CrowdFunding")
    const fund = fundFactory.attach(addr)

    // 查看合约地址
    console.log("合约地址:", fund.target)

    // 查看合约的creator
    const creator = await fund.creator()
    console.log("合约creator地址:", creator)

    // 查看目标金额
    const goalAmount = await fund.goalAmount()
    console.log("众筹目标金额(Wei):", goalAmount.toString())
    console.log("众筹目标金额(Eth):", ethers.formatEther(goalAmount))

    // 查看已筹集资金
    const raisedAmount = await fund.raisedAmount()
    console.log("已筹集金额(Eth):", ethers.formatEther(raisedAmount))

    // 查看众筹项目状态
    const status = await fund.closed()
    console.log("众筹项目是否关闭:", status)

    // 获取账户
    const accounts = await ethers.getSigners()
    const account = accounts[0]
    const account1 = accounts[1]

    // 查看账号余额
    const balanceWei = await ethers.provider.getBalance(account.address)
    console.log(`账户${account.address}的余额(Eth): ${ethers.formatEther(balanceWei)}`)

    // 查看合约余额
    const contractBalanceWei = await ethers.provider.getBalance(fund.target)
    console.log(`合约余额(Eth): ${ethers.formatEther(contractBalanceWei)}`)

    // 捐款
    if (!status) {
        console.log("第一次捐款...")
        const fundTx1 = await fund.connect(account).contribute({ value: ethers.parseEther("0.5") })
        await fundTx1.wait()
        const contractBalanceEth1 = ethers.formatEther(await ethers.provider.getBalance(fund.target))
        console.log(`捐款后合约余额(Eth): ${contractBalanceEth1}`)
        console.log("已筹集金额(Eth):", ethers.formatEther(await fund.raisedAmount()))

        console.log("第二次捐款...")
        const fundTx2 = await fund.connect(account1).contribute({ value: ethers.parseEther("0.5") })
        await fundTx2.wait()
        const contractBalanceEth2 = ethers.formatEther(await ethers.provider.getBalance(fund.target))
        console.log(`捐款后合约余额(Eth): ${contractBalanceEth2}`)
        console.log("已筹集金额(Eth):", ethers.formatEther(await fund.raisedAmount()))
    }

    // 查看最终状态
    console.log("众筹项目是否关闭:", await fund.closed())
    console.log("捐款人数:", (await fund.totalContributorsCount()).toString())

    const account0Fund = await fund.getContributionAmount(account)
    console.log(`地址${account.address}捐献金额(Eth):`, ethers.formatEther(account0Fund))
    const account1Fund = await fund.getContributionAmount(account1)
    console.log(`地址${account1.address}捐献金额(Eth):`, ethers.formatEther(account1Fund))

    // 提款
    const withdrawTx = await fund.connect(account1).withdraw()
    await withdrawTx.wait()
    console.log(`提款后合约余额(Eth): ${ethers.formatEther(await ethers.provider.getBalance(fund.target))}`)

    // 查看creator余额
    const _balanceEth = ethers.formatEther(await ethers.provider.getBalance(creator))
    console.log(`账户${creator}的余额(Eth): ${_balanceEth}`)
}

main()
    .then(() => { process.exit(0) })
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })