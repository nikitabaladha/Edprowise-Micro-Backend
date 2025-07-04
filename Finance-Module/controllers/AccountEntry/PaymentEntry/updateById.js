import TDSTCSRateChart from "../../../models/TDSTCSRateChart.js";
import TDSTCSRateChartValidator from "../../../validators/TDSTCSRateChartValidator.js";

async function updateById(req, res) {
  try {
    const { id } = req.params;

    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const { error } =
      TDSTCSRateChartValidator.TDSTCSRateChartValidator.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    const { TDSorTCS, rate, natureOfTransaction } = req.body;

    const existingTDSTCSRateChart = await TDSTCSRateChart.findOne({
      _id: id,
      schoolId,
    });
    if (!existingTDSTCSRateChart) {
      return res.status(404).json({
        hasError: true,
        message: "TDS/TCS Rate Chart not found.",
      });
    }

    existingTDSTCSRateChart.TDSorTCS =
      TDSorTCS || existingTDSTCSRateChart.TDSorTCS;

    existingTDSTCSRateChart.rate = rate || existingTDSTCSRateChart.rate;

    existingTDSTCSRateChart.natureOfTransaction =
      natureOfTransaction || existingTDSTCSRateChart.natureOfTransaction;

    await existingTDSTCSRateChart.save();

    return res.status(200).json({
      hasError: false,
      message: "TDS/TCS Rate Chart updated successfully!",
      data: existingTDSTCSRateChart,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. TDS/TCS Rate Chart already exists.`,
      });
    }

    console.error("Error updating TDS/TCS Rate Chart :", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
