import TDSTCSRateChart from "../../../models/TDSTCSRateChart.js";
import TDSTCSRateChartValidator from "../../../validators/TDSTCSRateChartValidator.js";

async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
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

    const { TDSorTCS, rate, natureOfTransaction, academicYear } = req.body;

    const newTDSTCSRateChart = new TDSTCSRateChart({
      schoolId,
      TDSorTCS,
      rate,
      natureOfTransaction,
      academicYear,
    });

    await newTDSTCSRateChart.save();

    return res.status(201).json({
      hasError: false,
      message: "TDS/TCS Rate Chart Created successfully!",
      data: newTDSTCSRateChart,
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

    console.error("Error Creating TDS/TCS Rate Chart:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
