import Ledger from "../../../../models/Ledger.js";

async function deleteBySchoolAndYear(req, res) {
  try {
    // const schoolId = req.user?.schoolId;

    const { financialYear, schoolId } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to delete these Ledgers.",
      });
    }

    if (!financialYear) {
      return res.status(400).json({
        hasError: true,
        message: "Missing Academic Year.",
      });
    }

    // 🔸 Perform bulk delete
    const result = await Ledger.deleteMany({ schoolId, financialYear });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        hasError: true,
        message: "No Ledgers found for this school and academic year.",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: `Successfully deleted ${result.deletedCount} Ledger(s) for academic year ${financialYear}.`,
    });
  } catch (error) {
    console.error("Error deleting Ledgers:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default deleteBySchoolAndYear;
