import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";
import Ledger from "../../models/Ledger.js";
import moment from "moment";

async function getTrialBalanceBySchoolId(req, res) {
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

    // Get all ledgers for the school and academic year
    const allLedgers = await Ledger.find({
      schoolId,
      academicYear,
    })
      .populate("headOfAccountId", "headOfAccountName")
      .populate("groupLedgerId", "groupLedgerName")
      .populate("bSPLLedgerId", "bSPLLedgerName");

    if (!allLedgers || allLedgers.length === 0) {
      return res.status(404).json({
        hasError: true,
        message: "No ledgers found for the given academic year.",
      });
    }

    // Get all opening closing balance records
    const openingClosingBalances = await OpeningClosingBalance.find({
      schoolId,
      academicYear,
    });

    // Build day list with day granularity
    const allDates = [];
    let currentDate = start.clone();
    while (currentDate.isSameOrBefore(end, "day")) {
      allDates.push(currentDate.clone());
      currentDate.add(1, "day");
    }

    // Process each ledger
    const trialBalanceData = await Promise.all(
      allLedgers.map(async (ledger) => {
        // Find the opening closing balance record for this ledger
        const ledgerBalanceRecord = openingClosingBalances.find(
          (record) => record.ledgerId.toString() === ledger._id.toString()
        );

        // ----- Initial balance up to the day BEFORE start -----
        let initialBalance = ledger.openingBalance || 0;

        if (
          ledgerBalanceRecord &&
          ledgerBalanceRecord.balanceDetails.length > 0
        ) {
          const preStartDate = start.clone().subtract(1, "day"); // 1 day before start

          const transactionsBeforeStartDate = ledgerBalanceRecord.balanceDetails
            .filter((d) =>
              moment(d.entryDate).isSameOrBefore(preStartDate, "day")
            )
            .sort((a, b) => moment(a.entryDate).diff(moment(b.entryDate)));

          for (const t of transactionsBeforeStartDate) {
            const debit = Number(t.debit) || 0;
            const credit = Number(t.credit) || 0;
            initialBalance =
              ledger.balanceType === "Debit"
                ? initialBalance + debit - credit
                : initialBalance + debit - credit;
          }
        }

        // ----- Calculate totals for the date range -----
        let totalDebit = 0;
        let totalCredit = 0;
        let currentBalance = initialBalance;

        if (
          ledgerBalanceRecord &&
          ledgerBalanceRecord.balanceDetails.length > 0
        ) {
          const sortedTransactions = ledgerBalanceRecord.balanceDetails
            .map((d) => ({
              ...d,
              entryDateMoment: moment(d.entryDate).startOf("day"),
              debit: d.debit || 0,
              credit: d.credit || 0,
            }))
            .sort((a, b) => a.entryDateMoment.diff(b.entryDateMoment));

          // Filter transactions within the date range
          const transactionsInRange = sortedTransactions.filter((t) =>
            t.entryDateMoment.isBetween(start, end, "day", "[]")
          );

          // Calculate totals
          for (const t of transactionsInRange) {
            totalDebit += Number(t.debit) || 0;
            totalCredit += Number(t.credit) || 0;

            if (ledger.balanceType === "Debit") {
              currentBalance =
                currentBalance + Number(t.debit) - Number(t.credit);
            } else {
              currentBalance =
                currentBalance + Number(t.debit) - Number(t.credit);
            }
          }
        }

        // Calculate closing balance
        const closingBalance = currentBalance;

        return {
          ledgerId: ledger._id,
          ledgerName: ledger.ledgerName,
          headOfAccountName: ledger.headOfAccountId?.headOfAccountName || "",
          groupLedgerName: ledger.groupLedgerId?.groupLedgerName || "",
          BSPLLedgerName: ledger.bSPLLedgerId?.bSPLLedgerName || "",
          balanceType: ledger.balanceType,
          openingBalance: initialBalance,
          debit: totalDebit,
          credit: totalCredit,
          closingBalance: closingBalance,
        };
      })
    );

    const filteredTrialBalanceData = trialBalanceData.filter((ledger) => {
      return !(
        ledger.openingBalance === 0 &&
        ledger.debit === 0 &&
        ledger.credit === 0 &&
        ledger.closingBalance === 0
      );
    });

    filteredTrialBalanceData.sort((a, b) =>
      a.ledgerName.localeCompare(b.ledgerName)
    );
    return res.status(200).json({
      hasError: false,
      message: "Trial Balance fetched successfully",
      data: {
        dateRange: {
          start: start.format("YYYY-MM-DD"),
          end: end.format("YYYY-MM-DD"),
        },
        academicYear,
        trialBalance: filteredTrialBalanceData,
      },
    });
  } catch (error) {
    console.error("Error fetching Trial Balance:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getTrialBalanceBySchoolId;
