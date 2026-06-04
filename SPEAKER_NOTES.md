# Speaker Notes — Decentralized Computing Market: Algorithm & Mechanism Design

**Duration:** ~10 minutes | **Slides:** 15 | **Pace:** ~40 seconds per slide

---

## Slide 1 — Title (30 sec)

**Say:** "Good morning/afternoon. I'm going to walk you through the algorithm and mechanism layer of a decentralized computing market — a system where GPU nodes compete to run AI workloads, and smart contracts enforce trust without any middleman."

**Pause.** Let them read the slide.

"Four Solidity contracts on-chain, two Python modules off-chain. Let me show you how they fit together."

**Transition:** "First — the big picture."

---

## Slide 2 — System Architecture (45 sec)

**Say:** "The system is split into two layers. On the left, everything that touches money or state lives on Ethereum — the token, the staking engine, the reputation ledger, and the task marketplace. On the right, the computation-heavy work — reputation scoring and result validation — runs off-chain in Python."

**Point to the green column:** "Why split it? Because running a multi-factor scoring algorithm with exponential decay on-chain would cost hundreds of dollars per update in gas. We use the Oracle pattern — same approach Chainlink uses for price feeds."

**Point to the amber column:** "The design philosophy: code enforces trust, economics deter cheating, and we only put on-chain what absolutely must be trustless."

**Transition:** "Let's start with the foundation — the token."

---

## Slide 3 — DecentAIToken (40 sec)

**Say:** "DAIT is a standard ERC-20 token — nothing exotic. Ten million initial supply, eighteen decimals to match ETH. It inherits from OpenZeppelin's audited contracts, so we don't reinvent the wheel."

**Point to the right card:** "The key design decision: we kept the mint function. Why? Because the token economy should evolve. Early stage, you might want inflationary rewards to attract GPU nodes. Mature stage, you might want to renounce ownership and go fixed-supply. Keeping mint gives us that optionality."

**Transition:** "Tokens only matter if they're at stake. That's the StakingManager."

---

## Slide 4 — Staking: Collateral & Lock (45 sec)

**Say:** "Every GPU node must deposit DAIT as collateral before accepting tasks. Think of it as a security deposit — skin in the game."

**Walk through the flow:** "Node approves the contract to spend tokens, calls stake, and the contract locks them. Simple."

**Point to the code on the right:** "The critical line is here — `if (_activeTaskCount[msg.sender] > 0) revert HasActiveTasks()`. This means: if you have active jobs, you cannot withdraw your stake. Period. Enforced by code, not by promise. It prevents the most obvious attack: accept a big job, pull your collateral, deliver garbage, walk away."

**Transition:** "But what happens when a node actually delivers garbage? That's the slash mechanism."

---

## Slide 5 — Slashing: Economic Deterrence (50 sec)

**Say:** "If a node cheats, the ComputeMarket contract calls slash — and 50 percent of their stake is confiscated."

**Pause.** "The natural question: why only 50 percent? Why not take everything?"

**Count on fingers:** "Three reasons. One: Sybil resistance. If you take 100 percent, the node just abandons that address, creates a new one, and cheats again. Fifty percent leaves residual value — they'd rather recover than start over. Two: over-collateralization. We require 150 percent collateral, so 50 percent of 150 percent is 75 percent of the task reward — they lose more than they could have gained. Three: progressive discipline. A first offense costs stake plus reputation. Repeated offenses compound through the reputation system."

**Point to the right:** "The equilibrium is simple. Honest node earns reward plus keeps stake. Dishonest node loses 75 percent of reward value plus compute cost plus reputation. There is no scenario where cheating pays."

**Transition:** "Reputation is the other half of that equation. And reputation lives in its own contract."

---

## Slide 6 — Reputation Oracle Pattern (45 sec)

**Say:** "Here's a common mistake people make when designing blockchain systems: they try to put everything on-chain. Reputation scoring involves exponential decay, sigmoid curves, historical data traversal — this is math that costs a fortune in Solidity."

**Point to the left column:** "If we computed reputation on-chain, every score update would cost about 500,000 gas. At today's prices, that's roughly 50 dollars per update. Multiply by hundreds of nodes, updating after every task — it doesn't scale."

**Point to the right column:** "So we use the Oracle pattern. Python does the heavy math — for free. Then the backend server, acting as an Oracle, writes a single number — a uint8 between 0 and 100 — to the contract. One storage slot. Twenty thousand gas. About fifty cents. This is the same architecture Chainlink, UMA, and Tellor use in production."

**Transition:** "Now let's look at the centerpiece — the task marketplace contract."

---

## Slide 7 — Task Lifecycle State Machine (45 sec)

**Say:** "Every task in the system moves through exactly five states. The transitions are irreversible — no state can go backward. This prevents an entire class of attacks where someone tries to roll back a completed task."

**Walk the timeline left to right:** "Open means the task is published and funds are locked in escrow. A node accepts it, passing reputation and stake checks — now it's InProgress. The node submits a result hash — UnderReview. The poster confirms — Completed, and payment is automatic. Or the poster disputes — Disputed, and the slash mechanism fires."

**Point to the red arrow:** "Notice the dispute path bypasses completion entirely. A disputed task goes straight from review to dispute — no intermediate state where funds could be in limbo."

**Point to the bottom card:** "Every state change emits an event with indexed parameters. The frontend never polls — it subscribes to these events and updates in real time."

**Transition:** "Let's zoom into the two most important operations: posting and accepting."

---

## Slide 8 — Post & Accept: Trustless Escrow (45 sec)

**Say:** "When a task is posted, the reward is immediately transferred from the poster's wallet into the contract. The poster cannot withdraw it. The platform cannot touch it. Only two things can release those funds: the poster confirming the result, or the poster disputing it. That's trustless escrow — no human in the loop."

**Point to the right card:** "When a node wants to accept, it must pass two checks. First: is its reputation score above the minimum the poster set? This calls the ReputationOracle. Second: does it have enough stake — at least 150 percent of the reward? This calls the StakingManager."

**Emphasize:** "Notice the order: we check the free on-chain state first — the task status. Only then do we make external contract calls, which cost additional gas. If the task isn't even open, we revert immediately and save those calls."

**Transition:** "After the node runs the computation, it submits a result."

---

## Slide 9 — Submit & Confirm: Gas-Optimized (45 sec)

**Say:** "This is one of the most important design choices in the system. When a node finishes an AI training job, the output could be gigabytes — model weights, logs, metrics. We do not store that on-chain."

**Point to the code:** "The node submits only the keccak256 hash of the result — 32 bytes. The actual output goes to IPFS or Arweave. Why? Because storing one megabyte on Ethereum costs millions of gas. Storing 32 bytes costs about 20,000 gas. The hash proves the result wasn't tampered with after submission."

**Point to confirmResult:** "When the poster confirms, payment is automatic. The contract calculates the platform fee — 3 percent — sends 97 percent to the node, 3 percent to the platform treasury, and unblocks the node's stake. All in one atomic transaction protected by a reentrancy guard."

**Transition:** "But what if the poster isn't satisfied? That's the dispute path."

---

## Slide 10 — Dispute: Game Theory in Action (50 sec)

**Say:** "This is the slide that explains why the entire system works without needing to verify every computation."

**Point to the payoff matrix on the right:** "Let's do the math. Task reward is R. Required stake is one point five R. If you're honest, you earn R for the task, keep your one point five R stake, and gain reputation for future jobs. Total: two point five R plus reputation."

**Pause.** "If you cheat and get caught: you lose your reward — it's refunded. You lose 50 percent of your stake — that's zero point seven five R. You lose whatever compute cost you spent trying to fake the result. And your reputation tanks, meaning fewer future jobs. Total: negative zero point seven five R minus compute minus reputation."

**Slow down:** "At any positive reward value, honesty is the strictly dominant strategy. This isn't a moral argument — it's math. The incentives make cheating irrational."

**Transition:** "Now let's move off-chain to the reputation algorithm."

---

## Slide 11 — Reputation: 4-Factor Model (45 sec)

**Say:** "Reputation isn't a simple average. It's a weighted composite of four independent factors."

**Point to each card:** "Completion rate at 40 percent — the foundation. Can you finish what you start? Dispute penalty at 30 percent — the most heavily punished dimension, because disputes mean someone got harmed. Response speed at 20 percent — rewards fast nodes, because users care about turnaround time. And maturity at 10 percent — an anti-Sybil factor that prevents new accounts from immediately looking trustworthy."

**Point to the maturity card at bottom:** "Without maturity, a node could create a hundred tiny self-dealing tasks, get a hundred percent completion rate, then accept a huge task and defraud it. Maturity caps reputation until the node has a verifiable history of real work. Five tasks gets you to 50 percent maturity. Twenty tasks to essentially full."

**Transition:** "Two mathematical mechanisms make this model particularly robust."

---

## Slide 12 — Time Decay & Maturity Curves (45 sec)

**Say:** "The reputation system uses two mathematical functions that deserve attention."

**Point to left card:** "Time decay. Every task's contribution to your score decays exponentially with a 30-day half-life. A task you did 30 days ago counts half as much as one you did yesterday. A task from 90 days ago counts about 12 percent. This means reputation reflects current behavior, not ancient history. And it gives nodes a path to recovery — if you messed up six months ago, that mistake is fading."

**Point to right card:** "The sigmoid maturity curve. This is the elegant solution to the cold-start problem. A brand new node with one task gets about 12 percent maturity. It climbs steeply through 5 to 10 tasks — the proving phase. After 20 tasks, you're essentially fully mature and the curve flattens. The sigmoid shape means it's hard to fake maturity but achievable through honest work."

**Transition:** "Reputation tells you who to trust. But we still verify — just not everything."

---

## Slide 13 — Result Validator: Trust but Verify (45 sec)

**Say:** "Full verification of every AI training task would require re-executing every computation — a hundred percent overhead. That defeats the point of a decentralized compute network."

**Point to the tax audit analogy:** "Think of it like tax audits. The IRS doesn't check every return. They audit about one percent, randomly, plus flag anomalies. The possibility of audit plus the severity of penalties is what drives compliance. Same principle here."

**Point to the right card:** "At a 10 percent sample rate, the math works out. Cheat once — 10 percent chance of getting caught. Cheat ten times — 65 percent chance. Cheat twenty times — 88 percent chance. Combine that with a 50 percent stake slash and reputation destruction, and the expected value of cheating is negative even before reputation costs."

**Emphasize:** "The sampling is deterministic — seeded by the task ID. Anyone can verify: should task number 42 be audited? Run the hash, check the answer. Total transparency, no backend discretion."

**Transition:** "Which brings me to the philosophical question behind the whole design."

---

## Slide 14 — Economic Security vs ZK Proofs (50 sec)

**Say:** "Someone will ask: why not use zero-knowledge proofs? ZKPs can mathematically prove a computation was correct without revealing the data. They're elegant, they're trustless, they're the gold standard."

**Pause.** "And they don't work for AI."

**Explain:** "A neural network forward pass involves millions of matrix multiplications. Compiling that into a ZK circuit is an active research area — it's called zkML. But today, the proving overhead is 100 to 1000 times the original computation. A one-hour GPU training run would take 100-plus hours to prove. That's not production-ready."

**Point to the right card:** "Economic security — staking, slashing, random sampling — gives us deterrence without overhead. The computation runs at full speed. The verification is probabilistic but the deterrence is certain. This is the same approach Filecoin uses for storage proofs and Eigenlayer uses for restaking security. It works, it's deployed, it's battle-tested."

**Transition:** "Let me pull it all together."

---

## Slide 15 — Summary & Discussion (45 sec)

**Say:** "Four Solidity contracts and two Python modules. The on-chain layer handles value — who gets paid, who gets slashed, what the state is. The off-chain layer handles computation — who deserves trust, whether results should be verified."

**Point to the amber column:** "Three insights I want you to take away. First: economic security is practical today where cryptographic proofs aren't. Game theory plus slashing scales to AI workloads. Second: prevention beats cure. The dual threshold — reputation plus stake — filters bad actors before they touch a task. Third: modular design means each piece can be audited, upgraded, or replaced independently."

**Open for questions:** "I've prepared four discussion questions. Pick whichever interests you most, or ask your own."

---

## Timing Notes

- **Total:** ~10 minutes at conversational pace
- **Slow down on:** Slides 5 (slashing rationale), 10 (payoff matrix), 14 (ZKP comparison) — these are the intellectual core
- **Move quickly through:** Slides 1, 2, 3 — setup, not substance
- **If running short:** Skip slide 12 (decay/maturity detail) — it's reinforcement, not essential
- **If running long:** Condense slides 8-9 into one — the code speaks for itself

## Key Phrases to Land

1. "Code enforces trust, economics deter cheating"
2. "Honesty is the strictly dominant strategy — and we can prove it mathematically"
3. "We don't verify every computation. We make cheating unprofitable."
4. "ZKP is elegant. Economic security ships today."
5. "Trust but verify — and you don't need to verify much when the penalty is high enough"
