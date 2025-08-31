import Ledger from "../../../../models/Ledger.js";
import HeadOfAccount from "../../../../models/HeadOfAccount.js";
import LedgerValidator from "../../../../validators/LedgerValidator.js";

async function updateById(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    const { id, academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to update a ledger.",
      });
    }

    const { error } = LedgerValidator.LedgerValidatorUpdate.validate(req.body);
    if (error?.details?.length) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({ hasError: true, message: errorMessages });
    }

    const {
      ledgerName,
      headOfAccountId,
      groupLedgerId,
      bSPLLedgerId,
      openingBalance,
      // balanceType,
    } = req.body;

    const existingLedger = await Ledger.findOne({
      _id: id,
      schoolId,
      academicYear,
    });
    if (!existingLedger) {
      return res.status(404).json({
        hasError: true,
        message: "Ledger not found.",
      });
    }

    // Get the HeadOfAccount to determine the balance type
    let headOfAccount;
    if (headOfAccountId && headOfAccountId !== existingLedger.headOfAccountId) {
      headOfAccount = await HeadOfAccount.findById(headOfAccountId);
      if (!headOfAccount) {
        return res.status(404).json({
          hasError: true,
          message: "Head of Account not found",
        });
      }
    } else {
      // Use the existing head of account if not changed
      headOfAccount = await HeadOfAccount.findById(
        existingLedger.headOfAccountId
      );
    }

    // Automatically set balanceType based on headOfAccountName
    let balanceType;
    if (headOfAccount.headOfAccountName === "Liabilities") {
      balanceType = "Credit"; // Liabilities have credit balance
    } else {
      balanceType = "Debit"; // Assets, Income, Expenses have debit balance
    }

    existingLedger.ledgerName = ledgerName || existingLedger.ledgerName;

    existingLedger.headOfAccountId =
      headOfAccountId || existingLedger.headOfAccountId;

    existingLedger.groupLedgerId =
      groupLedgerId || existingLedger.groupLedgerId;

    existingLedger.bSPLLedgerId = bSPLLedgerId || existingLedger.bSPLLedgerId;

    existingLedger.openingBalance =
      openingBalance || existingLedger.openingBalance;

    existingLedger.balanceType = balanceType;

    await existingLedger.save();

    return res.status(200).json({
      hasError: false,
      message: "Ledger updated successfully!",
      data: existingLedger,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Ledger already exists.`,
      });
    }

    console.error("Error updating Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
