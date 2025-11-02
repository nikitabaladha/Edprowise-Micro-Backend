import TDSTCSRateChart from "../../../models/TDSTCSRateChart.js";

async function deleteById(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    const { id, financialYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const existingTDSTCSRateChart = await TDSTCSRateChart.findOne({
      _id: id,
      schoolId,
      financialYear,
    });

    if (!existingTDSTCSRateChart) {
      return res.status(404).json({
        hasError: true,
        message: "TDS/TCS Rate Chart not found.",
      });
    }

    await TDSTCSRateChart.deleteOne({ _id: id });

    return res.status(200).json({
      hasError: false,
      message: "TDS/TCS Rate Chart deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting TDS/TCS Rate Chart:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default deleteById;
