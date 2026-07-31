// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20TransferFrom {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BatchTransfer
/// @notice Sends one ERC20 token to many recipients in a single transaction.
contract BatchTransfer {
    uint256 public constant RATIO_DENOMINATOR = 10_000;
    uint256 public constant MAX_RECIPIENTS = 500;

    uint256 private locked = 1;

    event BatchTransferExecuted(
        address indexed sender,
        address indexed token,
        uint256 recipientCount,
        uint256 totalAmount
    );

    event SplitTransferExecuted(
        address indexed sender,
        address indexed token,
        uint256 recipientCount,
        uint256 totalAmount
    );

    modifier nonReentrant() {
        require(locked == 1, "BatchTransfer: reentrant call");
        locked = 2;
        _;
        locked = 1;
    }

    function batchTransfer(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external nonReentrant {
        uint256 length = recipients.length;
        require(token != address(0), "BatchTransfer: token zero");
        require(length > 0, "BatchTransfer: empty recipients");
        require(length == amounts.length, "BatchTransfer: length mismatch");
        require(length <= MAX_RECIPIENTS, "BatchTransfer: too many recipients");

        uint256 totalAmount;
        for (uint256 i = 0; i < length; i++) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];
            require(recipient != address(0), "BatchTransfer: recipient zero");
            require(amount > 0, "BatchTransfer: amount zero");

            totalAmount += amount;
            _safeTransferFrom(token, msg.sender, recipient, amount);
        }

        emit BatchTransferExecuted(msg.sender, token, length, totalAmount);
    }

    /// @notice Splits totalAmount by basis-point ratios. The final recipient receives any rounding remainder.
    function splitTransfer(
        address token,
        address[] calldata recipients,
        uint256[] calldata ratios,
        uint256 totalAmount
    ) external nonReentrant {
        uint256 length = recipients.length;
        require(token != address(0), "BatchTransfer: token zero");
        require(length > 0, "BatchTransfer: empty recipients");
        require(length == ratios.length, "BatchTransfer: length mismatch");
        require(length <= MAX_RECIPIENTS, "BatchTransfer: too many recipients");
        require(totalAmount > 0, "BatchTransfer: total zero");

        uint256 ratioSum;
        for (uint256 i = 0; i < length; i++) {
            require(recipients[i] != address(0), "BatchTransfer: recipient zero");
            require(ratios[i] > 0, "BatchTransfer: ratio zero");
            ratioSum += ratios[i];
        }
        require(ratioSum == RATIO_DENOMINATOR, "BatchTransfer: ratio sum not 100%");

        uint256 allocated;
        for (uint256 i = 0; i < length; i++) {
            uint256 amount = i == length - 1
                ? totalAmount - allocated
                : (totalAmount * ratios[i]) / RATIO_DENOMINATOR;
            require(amount > 0, "BatchTransfer: split amount zero");

            allocated += amount;
            _safeTransferFrom(token, msg.sender, recipients[i], amount);
        }

        emit SplitTransferExecuted(msg.sender, token, length, totalAmount);
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeCall(IERC20TransferFrom.transferFrom, (from, to, amount))
        );
        require(success, "BatchTransfer: transfer failed");
        require(data.length == 0 || abi.decode(data, (bool)), "BatchTransfer: transfer returned false");
    }
}
