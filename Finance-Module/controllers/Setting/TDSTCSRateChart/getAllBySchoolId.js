import TDSTCSRateChart from "../../../models/TDSTCSRateChart.js";

async function getAllBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const charts = await TDSTCSRateChart.find({ schoolId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      hasError: false,
      message: "TDS/TCS Rate Charts fetched successfully!",
      data: charts,
    });
  } catch (error) {
    console.error("Error fetching TDS/TCS Rate Charts:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllBySchoolId;
