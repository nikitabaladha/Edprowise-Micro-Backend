import BSPLLedger from "../../../../models/BSPLLedger.js";
import BSPLLedgerValidator from "../../../../validators/BSPLLedgerValidator.js";

async function updateById(req, res) {
  try {
    const { id } = req.params;

    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const { error } = BSPLLedgerValidator.BSPLLedgerValidator.validate(
      req.body
    );
    if (error?.details?.length) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({ hasError: true, message: errorMessages });
    }

    const { bSPLLedgerName, headOfAccountId } = req.body;

    const existingBSPLLedger = await BSPLLedger.findOne({ _id: id, schoolId });
    if (!existingBSPLLedger) {
      return res.status(404).json({
        hasError: true,
        message: "B/S & P&L Ledger not found.",
      });
    }

    existingBSPLLedger.bSPLLedgerName =
      bSPLLedgerName || existingBSPLLedger.bSPLLedgerName;

    existingBSPLLedger.headOfAccountId =
      headOfAccountId || existingBSPLLedger.headOfAccountId;

    await existingBSPLLedger.save();

    return res.status(200).json({
      hasError: false,
      message: "B/S & P&L Ledger updated successfully!",
      data: existingBSPLLedger,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. B/S & P&L Ledger already exists.`,
      });
    }

    console.error("Error updating B/S & P&L Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
