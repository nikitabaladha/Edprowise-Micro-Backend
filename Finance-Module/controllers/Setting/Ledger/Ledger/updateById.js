import Ledger from "../../../../models/Ledger.js";
import LedgerValidator from "../../../../validators/LedgerValidator.js";

async function updateById(req, res) {
  try {
    const { id } = req.params;

    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to update a ledger.",
      });
    }

    const { error } = LedgerValidator.LedgerValidator.validate(req.body);
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
    } = req.body;

    const existingLedger = await Ledger.findOne({ _id: id, schoolId });
    if (!existingLedger) {
      return res.status(404).json({
        hasError: true,
        message: "Ledger not found.",
      });
    }

    existingLedger.ledgerName = ledgerName || existingLedger.ledgerName;

    existingLedger.headOfAccountId =
      headOfAccountId || existingLedger.headOfAccountId;

    existingLedger.groupLedgerId =
      groupLedgerId || existingLedger.groupLedgerId;

    existingLedger.bSPLLedgerId = bSPLLedgerId || existingLedger.bSPLLedgerId;

    existingLedger.openingBalance =
      openingBalance || existingLedger.openingBalance;

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
