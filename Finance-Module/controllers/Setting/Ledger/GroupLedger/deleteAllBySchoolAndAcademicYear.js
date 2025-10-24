import GroupLedger from "../../../../models/GroupLedger.js";

async function deleteBySchoolAndYear(req, res) {
  try {
    const { academicYear, schoolId } = req.params;

    if (!academicYear) {
      return res.status(400).json({
        hasError: true,
        message: "Missing Academic Year.",
      });
    }

    // 🔸 Perform bulk delete
    const result = await GroupLedger.deleteMany({ schoolId, academicYear });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        hasError: true,
        message: "No Ledgers found for this school and academic year.",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: `Successfully deleted ${result.deletedCount} GroupLedgers(s) for academic year ${academicYear} for School ${schoolId}.`,
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
