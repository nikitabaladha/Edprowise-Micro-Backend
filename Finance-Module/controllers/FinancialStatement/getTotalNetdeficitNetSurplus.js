import moment from "moment";
import TotalNetdeficitNetSurplus from "../../models/TotalNetdeficitNetSurplus.js";

async function getTotalNetdeficitNetSurplus(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    const { startDate, endDate, academicYear } = req.query;

    // Validate required parameters
    if (!academicYear) {
      return res.status(400).json({
        hasError: true,
        message: "academicYear is a required parameter.",
      });
    }

    // Parse date range or use academic year range
    const academicYearStart = moment(
      `04/01/${academicYear.split("-")[0]}`,
      "MM/DD/YYYY"
    ).startOf("day");
    const academicYearEnd = moment(
      `03/31/${academicYear.split("-")[1]}`,
      "MM/DD/YYYY"
    ).endOf("day");

    // Normalize query range
    const start = startDate
      ? moment(startDate).startOf("day")
      : academicYearStart.clone();
    const end = endDate
      ? moment(endDate).endOf("day")
      : academicYearEnd.clone();

    // Validate date range
    if (end.isBefore(start)) {
      return res.status(400).json({
        hasError: true,
        message: "End date cannot be before start date.",
      });
    }

    // Find the TotalNetdeficitNetSurplus record for the school and academic year
    const totalNetRecord = await TotalNetdeficitNetSurplus.findOne({
      schoolId,
      academicYear,
    });

    if (!totalNetRecord) {
      return res.status(200).json({
        hasError: false,
        message: "No data found for the specified criteria.",
        data: [
          {
            incomeBalance: 0,
            expensesBalance: 0,
            totalBalances: 0,
          },
        ],
      });
    }

    // Filter balanceDetails based on date range
    const filteredBalanceDetails = totalNetRecord.balanceDetails.filter(
      (detail) => {
        const entryDate = moment(detail.entryDate);
        return entryDate.isBetween(start, end, null, "[]"); // [] includes start and end
      }
    );

    // Calculate totals for the period
    const totalIncome = filteredBalanceDetails.reduce(
      (sum, detail) => sum + (detail.incomeBalance || 0),
      0
    );

    const totalExpenses = filteredBalanceDetails.reduce(
      (sum, detail) => sum + (detail.expensesBalance || 0),
      0
    );

    const totalBalances = totalIncome - totalExpenses;

    // Prepare simplified response data
    const responseData = [
      {
        incomeBalance: totalIncome,
        expensesBalance: totalExpenses,
        totalBalances: totalBalances,
      },
    ];

    return res.status(200).json({
      hasError: false,
      message: "Total Netdeficit NetSurplus fetched successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching Total Netdeficit NetSurplus:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getTotalNetdeficitNetSurplus;
