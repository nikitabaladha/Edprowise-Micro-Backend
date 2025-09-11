import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";
import Ledger from "../../models/Ledger.js";
import moment from "moment";

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

    // Validate required parameters
    if (!ledgerId || !academicYear) {
      return res.status(400).json({
        hasError: true,
        message: "ledgerId and academicYear are required parameters.",
      });
    }

    // Get the ledger details including opening balance
    const ledger = await Ledger.findOne({
      schoolId,
      _id: ledgerId,
      academicYear,
    });

    if (!ledger) {
      return res.status(404).json({
        hasError: true,
        message: "Ledger not found for the given academic year.",
      });
    }

    // Get the opening closing balance record
    const openingClosingBalance = await OpeningClosingBalance.findOne({
      schoolId,
      ledgerId,
      academicYear,
    }).populate("ledgerId", "ledgerName");

    // Parse date range or use academic year range
    const academicYearStart = moment(
      `04/01/${academicYear.split("-")[0]}`,
      "MM/DD/YYYY"
    );
    const academicYearEnd = moment(
      `03/31/${academicYear.split("-")[1]}`,
      "MM/DD/YYYY"
    );

    const start = startDate ? moment(startDate) : academicYearStart;
    const end = endDate ? moment(endDate) : academicYearEnd;

    // If we have existing balance details, use them directly
    if (
      openingClosingBalance &&
      openingClosingBalance.balanceDetails.length > 0
    ) {
      // Filter balance details for the requested date range
      const filteredBalanceDetails = openingClosingBalance.balanceDetails
        .filter((detail) => {
          const detailDate = moment(detail.entryDate);
          const detailDateFormatted = detailDate.format("YYYY-MM-DD");
          const startFormatted = start.format("YYYY-MM-DD");
          const endFormatted = end.format("YYYY-MM-DD");

          // Compare formatted dates to avoid timezone issues
          return (
            detailDateFormatted >= startFormatted &&
            detailDateFormatted <= endFormatted
          );
        })
        .sort((a, b) => moment(a.entryDate) - moment(b.entryDate));

      // If no filtered data found, check if it's a single date request
      if (filteredBalanceDetails.length === 0 && start.isSame(end, "day")) {
        // Look for the specific date in all balance details
        const targetDateFormatted = start.format("YYYY-MM-DD");
        const specificDateData = openingClosingBalance.balanceDetails.find(
          (detail) =>
            moment(detail.entryDate).format("YYYY-MM-DD") ===
            targetDateFormatted
        );

        if (specificDateData) {
          // Return just the specific date data
          return res.status(200).json({
            hasError: false,
            message: "Opening Closing Balance fetched successfully",
            data: [
              {
                _id: openingClosingBalance._id,
                schoolId,
                academicYear,
                ledgerId: ledger._id,
                ledgerName: ledger.ledgerName,
                balanceDetails: [specificDateData],
                balanceType: ledger.balanceType,
              },
            ],
          });
        }
      }

      return res.status(200).json({
        hasError: false,
        message: "Opening Closing Balance fetched successfully",
        data: [
          {
            _id: openingClosingBalance._id,
            schoolId,
            academicYear,
            ledgerId: ledger._id,
            ledgerName: ledger.ledgerName,
            balanceDetails: filteredBalanceDetails,
            balanceType: ledger.balanceType,
          },
        ],
      });
    }

    // If no existing balance details, generate empty balances for the date range
    const allDates = [];
    let currentDate = moment(start);
    while (currentDate.isSameOrBefore(end)) {
      allDates.push(moment(currentDate));
      currentDate.add(1, "day");
    }

    const dailyBalances = allDates.map((date) => ({
      entryDate: date.utc().toDate(),
      openingBalance: ledger.openingBalance,
      debit: 0,
      credit: 0,
      closingBalance: ledger.openingBalance,
    }));

    return res.status(200).json({
      hasError: false,
      message: "Opening Closing Balance fetched successfully",
      data: [
        {
          _id: null,
          schoolId,
          academicYear,
          ledgerId: ledger._id,
          ledgerName: ledger.ledgerName,
          balanceDetails: dailyBalances,
          balanceType: ledger.balanceType,
        },
      ],
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
