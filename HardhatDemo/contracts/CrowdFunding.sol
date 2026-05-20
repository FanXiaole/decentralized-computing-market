// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CrowdFunding {
    address public creator;
    uint public goalAmount;
    uint public raisedAmount;
    bool public closed;
    uint public totalContributorsCount;
    mapping(address => uint) private contributions;

    constructor(uint _goalAmountInEth) {
        creator = msg.sender;
        goalAmount = _goalAmountInEth * 1 ether;
        closed = false;
    }

    function contribute() public payable {
        require(!closed, "Funding is closed");
        require(msg.value > 0, "Must send ETH");
        if (contributions[msg.sender] == 0) {
            totalContributorsCount++;
        }
        contributions[msg.sender] += msg.value;
        raisedAmount += msg.value;
        if (raisedAmount >= goalAmount) {
            closed = true;
        }
    }

    function getContributionAmount(address contributor) public view returns (uint) {
        return contributions[contributor];
    }

    function withdraw() public {
        require(closed, "Funding not yet closed");
        uint amount = contributions[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        contributions[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }
}