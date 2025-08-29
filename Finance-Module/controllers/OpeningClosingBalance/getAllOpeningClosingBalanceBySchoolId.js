import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";

async function getAllOpeningClosingBalanceBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    const { ledgerId, startDate, endDate, academicYear } = req.query;

    // Build the filter object
    const filter = { schoolId };

    if (academicYear) {
      filter.academicYear = academicYear;
    }

    if (ledgerId) {
      filter.ledgerId = ledgerId;
    }

    // Fetch records with populated ledgerId
    const openingClosingBalances = await OpeningClosingBalance.find(filter)
      .populate("ledgerId", "ledgerName") // only bring ledgerName + _id
      .lean();

    // Filter balanceDetails if date range provided
    let formattedData = openingClosingBalances;

    if (startDate || endDate) {
      formattedData = openingClosingBalances.map((record) => {
        const filteredBalanceDetails = record.balanceDetails.filter(
          (detail) => {
            const detailDate = new Date(detail.entryDate);
            let include = true;

            if (startDate) {
              const start = new Date(startDate);
              include = include && detailDate >= start;
            }

            if (endDate) {
              const end = new Date(endDate);
              end.setHours(23, 59, 59, 999);
              include = include && detailDate <= end;
            }

            return include;
          }
        );

        return {
          ...record,
          balanceDetails: filteredBalanceDetails,
        };
      });
    }

    // Transform data to desired format
    const transformedData = formattedData.map((record) => ({
      _id: record._id,
      schoolId: record.schoolId,
      academicYear: record.academicYear,
      ledgerId: record.ledgerId?._id || record.ledgerId, // keep just the ID
      ledgerName: record.ledgerId?.ledgerName || null, // flatten ledgerName
      balanceDetails: record.balanceDetails,
      balanceType: record.balanceType,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      __v: record.__v,
    }));

    if (transformedData.length === 0) {
      return res.status(200).json({
        hasError: false,
        message: "No opening closing balance records found",
        data: [],
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Opening Closing Balance fetched successfully",
      data: transformedData,
    });
  } catch (error) {
    console.error("Error fetching Opening Closing Balance:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllOpeningClosingBalanceBySchoolId;
