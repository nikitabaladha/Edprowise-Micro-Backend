import Ledger from "../../../../models/Ledger.js";

async function deleteById(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { id, academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to delete this Ledger",
      });
    }

    if (!id) {
      return res.status(400).json({
        hasError: true,
        message: "Missing Ledger ID.",
      });
    }

    if (!academicYear) {
      return res.status(400).json({
        hasError: true,
        message: "Missing Academic Year.",
      });
    }

    const deletedLedger = await Ledger.findOneAndDelete({
      _id: id,
      schoolId,
      academicYear,
    });

    if (!deletedLedger) {
      return res.status(404).json({
        hasError: true,
        message:
          "Ledger not found or does not belong to your school for the given academic year.",
      });
    }

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
