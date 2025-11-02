import TDSTCSRateChart from "../../../models/TDSTCSRateChart.js";

async function getAllByTDSOrTCS(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    const { TDSorTCS, financialYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    if (!TDSorTCS || !["TDS", "TCS"].includes(TDSorTCS)) {
      return res.status(400).json({
        hasError: true,
        message: "Invalid or missing TDSorTCS query parameter.",
      });
    }

    const charts = await TDSTCSRateChart.find({
      schoolId,
      TDSorTCS,
      financialYear,
    }).sort({
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

export default getAllByTDSOrTCS;
