import Ledger from "../../../../models/Ledger.js";
import LedgerValidator from "../../../../validators/LedgerValidator.js";

async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to create a ledger.",
      });
    }

    const { error } = LedgerValidator.LedgerValidator.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    const {
      ledgerName,
      headOfAccountId,
      groupLedgerId,
      bSPLLedgerId,
      openingBalance,
    } = req.body;

    const newLedger = new Ledger({
      schoolId,
      headOfAccountId,
      groupLedgerId,
      bSPLLedgerId,
      ledgerName,
      openingBalance,
    });

    await newLedger.save();

    return res.status(201).json({
      hasError: false,
      message: "Ledger created successfully!",
      data: newLedger,
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

    console.error("Error Creating Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
