import HeadOfAccount from "../../../../models/HeadOfAccount.js";

async function deleteBySchoolAndYear(req, res) {
  try {
    const { financialYear, schoolId } = req.params;

    if (!financialYear) {
      return res.status(400).json({
        hasError: true,
        message: "Missing Academic Year.",
      });
    }

    // 🔸 Perform bulk delete
    const result = await HeadOfAccount.deleteMany({ schoolId, financialYear });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        hasError: true,
        message: "No Ledgers found for this school and academic year.",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: `Successfully deleted ${result.deletedCount} HeadOfAccount(s) for academic year ${financialYear} for School ${schoolId}.`,
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
