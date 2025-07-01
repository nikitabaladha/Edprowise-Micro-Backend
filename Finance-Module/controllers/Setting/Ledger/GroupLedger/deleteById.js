import GroupLedger from "../../../../models/GroupLedger.js";

async function deleteById(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { id } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const existingLedger = await GroupLedger.findOne({ _id: id, schoolId });

    if (!existingLedger) {
      return res.status(404).json({
        hasError: true,
        message: "Group Ledger not found.",
      });
    }

    await GroupLedger.deleteOne({ _id: id });

    return res.status(200).json({
      hasError: false,
      message: "Group Ledger deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting Group Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default deleteById;
