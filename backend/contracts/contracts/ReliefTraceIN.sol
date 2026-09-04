// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ReliefTraceIN
/// @notice Attestation-only registry for disaster relief campaigns. The chain never
///         custodies value: there is no `payable` function, no `receive`/`fallback`,
///         no transfer/send/call{value:}, and no ERC-20 reference anywhere in this file.
///         Every write is a hash-anchored attestation about money that already moved
///         through UPI/banking, off-chain.
/// @dev Reentrancy: no function in this contract makes an external call (no
///      `.call`, `.delegatecall`, or calls into another contract/interface),
///      so there is no reentrancy surface to guard -- reviewed as part of
///      issue #17's access-control/reentrancy pass.
contract ReliefTraceIN {
    enum Category {
        FOOD,
        WATER,
        MEDICAL,
        SHELTER,
        LOGISTICS,
        ADMIN
    }

    struct Campaign {
        address operator; // NGO signing wallet
        address oracle; // backend key permitted to attest donations
        string disasterTag; // e.g. "KL-WAYANAD-2026-07"
        string darpanId; // NGO Darpan registration number
        string reg80G; // 80G registration number
        bytes32 promiseHash; // keccak256 of the public appeal text
        uint256 raisedPaise;
        uint256 spentPaise;
        bool active;
    }

    mapping(uint256 => Campaign) public campaigns;
    uint256 public campaignCount;

    event CampaignCreated(
        uint256 indexed id,
        address operator,
        string disasterTag,
        string darpanId,
        bytes32 promiseHash,
        uint256 ts
    );

    event DonationAttested(
        uint256 indexed id,
        bytes32 utrHash,
        bytes32 donorRef,
        uint256 amountPaise,
        uint256 ts
    );

    event SpendAttested(
        uint256 indexed id,
        bytes32 indexed spendRef,
        bytes32 utrHash,
        bytes32 vendorRef,
        uint256 amountPaise,
        Category cat,
        string evidenceCID,
        string memo,
        uint256 ts
    );

    event DeliveryAttested(uint256 indexed id, bytes32 indexed spendRef, address attestor, uint256 ts);

    modifier onlyOperator(uint256 id) {
        require(msg.sender == campaigns[id].operator, "not operator");
        _;
    }

    modifier onlyOracle(uint256 id) {
        require(msg.sender == campaigns[id].oracle, "not oracle");
        _;
    }

    modifier onlyActive(uint256 id) {
        require(campaigns[id].active, "inactive");
        _;
    }

    function createCampaign(
        address oracle,
        string calldata disasterTag,
        string calldata darpanId,
        string calldata reg80G,
        bytes32 promiseHash
    ) external returns (uint256 id) {
        // msg.sender can never be the zero address for a real transaction, so
        // onlyOperator/onlyOracle already reject calls against an
        // uninitialized campaign correctly -- but a zero oracle address would
        // pass validation here and then be permanently unattestable (no real
        // sender can ever satisfy onlyOracle), silently bricking donation
        // attestation for that campaign with no way to recover it.
        require(oracle != address(0), "oracle required");

        id = campaignCount++;
        campaigns[id] = Campaign({
            operator: msg.sender,
            oracle: oracle,
            disasterTag: disasterTag,
            darpanId: darpanId,
            reg80G: reg80G,
            promiseHash: promiseHash,
            raisedPaise: 0,
            spentPaise: 0,
            active: true
        });

        emit CampaignCreated(id, msg.sender, disasterTag, darpanId, promiseHash, block.timestamp);
    }

    function attestDonation(
        uint256 id,
        bytes32 utrHash,
        bytes32 donorRef,
        uint256 amountPaise
    ) external onlyOracle(id) onlyActive(id) {
        campaigns[id].raisedPaise += amountPaise;

        emit DonationAttested(id, utrHash, donorRef, amountPaise, block.timestamp);
    }

    function attestSpend(
        uint256 id,
        bytes32 utrHash,
        bytes32 vendorRef,
        uint256 amountPaise,
        Category cat,
        string calldata evidenceCID,
        string calldata memo
    ) external onlyOperator(id) onlyActive(id) returns (bytes32 spendRef) {
        require(bytes(evidenceCID).length > 0, "evidence required");

        uint256 ts = block.timestamp;
        spendRef = keccak256(abi.encodePacked(id, vendorRef, amountPaise, ts));

        campaigns[id].spentPaise += amountPaise;

        emit SpendAttested(id, spendRef, utrHash, vendorRef, amountPaise, cat, evidenceCID, memo, ts);
    }

    function attestDelivery(uint256 id, bytes32 spendRef) external onlyActive(id) {
        // No on-chain access control: the attestor allowlist is enforced at the API
        // layer (MVP0). A real attestor registry is an MVP2+ concern (HLD 4.2).
        emit DeliveryAttested(id, spendRef, msg.sender, block.timestamp);
    }

    function closeCampaign(uint256 id) external onlyOperator(id) {
        campaigns[id].active = false;
    }
}
