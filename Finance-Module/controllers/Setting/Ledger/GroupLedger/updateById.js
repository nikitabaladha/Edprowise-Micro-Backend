import GroupLedger from "../../../../models/GroupLedger.js";
import GroupLedgerValidator from "../../../../validators/GroupLedgerValidator.js";

async function updateById(req, res) {
  try {
    const { id, academicYear } = req.params;

    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const { error } = GroupLedgerValidator.GroupLedgerValidatorUpdate.validate(
      req.body
    );
    if (error?.details?.length) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({ hasError: true, message: errorMessages });
    }

    const { groupLedgerName, headOfAccountId, bSPLLedgerId } = req.body;

    const existingGroupLedger = await GroupLedger.findOne({
      _id: id,
      schoolId,
      academicYear,
    });
    if (!existingGroupLedger) {
      return res.status(404).json({
        hasError: true,
        message: "Group Ledger not found.",
      });
    }

    existingGroupLedger.groupLedgerName =
      groupLedgerName || existingGroupLedger.groupLedgerName;

    existingGroupLedger.headOfAccountId =
      headOfAccountId || existingGroupLedger.headOfAccountId;

    existingGroupLedger.bSPLLedgerId =
      bSPLLedgerId || existingGroupLedger.bSPLLedgerId;

    await existingGroupLedger.save();

    return res.status(200).json({
      hasError: false,
      message: "Group Ledger updated successfully!",
      data: existingGroupLedger,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Group Ledger already exists.`,
      });
    }

    console.error("Error updating Group Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
