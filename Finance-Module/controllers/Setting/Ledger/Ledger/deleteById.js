import Ledger from "../../../../models/Ledger.js";

async function deleteById(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { id } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to delete this Ledger",
      });
    }

    const existingLedger = await Ledger.findOne({ _id: id, schoolId });

    if (!existingLedger) {
      return res.status(404).json({
        hasError: true,
        message: "Ledger not found.",
      });
    }

    await Ledger.deleteOne({ _id: id });

    return res.status(200).json({
      hasError: false,
      message: "Ledger deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default deleteById;
