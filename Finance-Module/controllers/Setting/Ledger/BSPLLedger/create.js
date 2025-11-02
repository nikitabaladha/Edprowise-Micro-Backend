import BSPLLedger from "../../../../models/BSPLLedger.js";
import HeadOfAccount from "../../../../models/HeadOfAccount.js";
import BSPLLedgerValidator from "../../../../validators/BSPLLedgerValidator.js";

async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to request for a quote.",
      });
    }

    const { error } = BSPLLedgerValidator.BSPLLedgerValidator.validate(
      req.body
    );
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    const { bSPLLedgerName, headOfAccountId, financialYear } = req.body;

    const headExists = await HeadOfAccount.findOne({
      _id: headOfAccountId,
      schoolId,
    });
    if (!headExists) {
      return res.status(404).json({
        hasError: true,
        message: "Head Of Account not found.",
      });
    }

    const newBSPLLedger = new BSPLLedger({
      schoolId,
      headOfAccountId,
      bSPLLedgerName,
      financialYear,
    });

    await newBSPLLedger.save();

    return res.status(201).json({
      hasError: false,
      message: "B/S & P&L Ledger Created successfully!",
      data: newBSPLLedger,
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

    console.error("Error Creating B/S & P&L Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
