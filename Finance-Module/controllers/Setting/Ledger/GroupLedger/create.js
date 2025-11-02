import GroupLedger from "../../../../models/GroupLedger.js";
import GroupLedgerValidator from "../../../../validators/GroupLedgerValidator.js";

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

    const { error } = GroupLedgerValidator.GroupLedgerValidator.validate(
      req.body
    );
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    const { groupLedgerName, headOfAccountId, bSPLLedgerId, financialYear } =
      req.body;

    const newGroupLedger = new GroupLedger({
      schoolId,
      headOfAccountId,
      bSPLLedgerId,
      groupLedgerName,
      financialYear,
    });

    await newGroupLedger.save();

    return res.status(201).json({
      hasError: false,
      message: "Group Ledger Created successfully!",
      data: newGroupLedger,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}.Group Ledger already exists.`,
      });
    }

    console.error("Error Creating Group Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
