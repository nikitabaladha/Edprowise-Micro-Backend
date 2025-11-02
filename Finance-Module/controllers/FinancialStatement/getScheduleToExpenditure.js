import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";
import Ledger from "../../models/Ledger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";
import moment from "moment";
import mongoose from "mongoose";

async function getScheduleToExpenditure(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    const { startDate, endDate, financialYear } = req.query;

    // Validate required parameters
    if (!financialYear) {
      return res.status(400).json({
        hasError: true,
        message: "financialYear is a required parameter.",
      });
    }

    // Parse date range or use academic year range
    const financialYearStart = moment(
      `04/01/${financialYear.split("-")[0]}`,
      "MM/DD/YYYY"
    ).startOf("day");
    const financialYearEnd = moment(
      `03/31/${financialYear.split("-")[1]}`,
      "MM/DD/YYYY"
    ).endOf("day");

    // Normalize query range
    const start = startDate
      ? moment(startDate).startOf("day")
      : financialYearStart.clone();
    const end = endDate
      ? moment(endDate).endOf("day")
      : financialYearEnd.clone();

    // Validate date range
    if (end.isBefore(start)) {
      return res.status(400).json({
        hasError: true,
        message: "End date cannot be before start date.",
      });
    }

    // Step 1: Find HeadOfAccount IDs for "Expenses"
    const expensesHead = await HeadOfAccount.findOne({
      schoolId,
      financialYear,
      headOfAccountName: "Expenses",
    });

    if (!expensesHead) {
      return res.status(200).json({
        hasError: false,
        message: "No Expenses head accounts found",
        data: [],
      });
    }

    // Step 2: Find all ledgers under Income with proper population
    const ledgers = await Ledger.find({
      schoolId,
      financialYear,
      headOfAccountId: expensesHead._id,
    })
      .populate({
        path: "groupLedgerId",
        select: "groupLedgerName",
      })
      .populate({
        path: "bSPLLedgerId",
        select: "bSPLLedgerName",
      })
      .populate("headOfAccountId");

    if (ledgers.length === 0) {
      return res.status(200).json({
        hasError: false,
        message: "No ledgers found for Expenses head",
        data: [],
      });
    }

    // Step 3: Get all ledger IDs
    const ledgerIds = ledgers.map((ledger) => ledger._id);

    // Step 4: Find OpeningClosingBalance records for these ledgers
    const balanceRecords = await OpeningClosingBalance.find({
      schoolId,
      financialYear,
      ledgerId: { $in: ledgerIds },
    }).populate("ledgerId");

    // Step 5: Calculate closing balances for each ledger within date range
    const ledgerBalances = {};

    // Step 6: Group data by BSPL Ledger and then by Group Ledger

    for (const record of balanceRecords) {
      const ledgerId = record.ledgerId._id.toString();

      // Group by date and get the latest entry for each date
      const dateGroups = {};

      record.balanceDetails.forEach((detail) => {
        const detailDate = moment(detail.entryDate).format("YYYY-MM-DD");
        if (moment(detailDate).isBetween(start, end, null, "[]")) {
          if (!dateGroups[detailDate]) {
            dateGroups[detailDate] = [];
          }
          dateGroups[detailDate].push(detail);
        }
      });

      // For each date, get the latest entry
      let latestClosingBalance = 0;
      let hasEntriesInRange = false;

      for (const date in dateGroups) {
        const entriesForDate = dateGroups[date];
        // Sort by creation time (using _id) to get the latest entry for this date
        const sortedEntries = entriesForDate.sort((a, b) => {
          const aTimestamp = new mongoose.Types.ObjectId(a._id).getTimestamp();
          const bTimestamp = new mongoose.Types.ObjectId(b._id).getTimestamp();
          return bTimestamp - aTimestamp;
        });

        latestClosingBalance = sortedEntries[0].closingBalance;
        hasEntriesInRange = true;
      }

      if (hasEntriesInRange) {
        ledgerBalances[ledgerId] = latestClosingBalance;
      } else {
        // If no entries in date range, use the last balance before the range
        const previousDetails = record.balanceDetails
          .filter((detail) => moment(detail.entryDate).isBefore(start))
          .sort((a, b) => {
            const aTimestamp = new mongoose.Types.ObjectId(
              a._id
            ).getTimestamp();
            const bTimestamp = new mongoose.Types.ObjectId(
              b._id
            ).getTimestamp();
            return bTimestamp - aTimestamp;
          });

        if (previousDetails.length > 0) {
          ledgerBalances[ledgerId] = previousDetails[0].closingBalance;
        } else {
          // If no entries at all, use opening balance from ledger
          const ledger = ledgers.find((l) => l._id.toString() === ledgerId);
          ledgerBalances[ledgerId] = ledger?.openingBalance || 0;
        }
      }
    }

    const bspLedgerMap = {};

    for (const ledger of ledgers) {
      const ledgerId = ledger._id.toString();
      const balance = ledgerBalances[ledgerId] || 0;

      const bspLedgerId = ledger.bSPLLedgerId?._id.toString();
      const bspLedgerName =
        ledger.bSPLLedgerId?.bSPLLedgerName || "Uncategorized";

      const groupLedgerId = ledger.groupLedgerId?._id.toString();
      const groupLedgerName =
        ledger.groupLedgerId?.groupLedgerName || "Uncategorized";

      if (!bspLedgerId || !groupLedgerId) continue;

      // Create or get BSPL Ledger entry
      if (!bspLedgerMap[bspLedgerId]) {
        bspLedgerMap[bspLedgerId] = {
          bSPLLedgerId: bspLedgerId,
          bSPLLedgerName: bspLedgerName,
          groupLedgers: {},
          totalBalance: 0,
        };
      }

      // Create or get Group Ledger entry within BSPL Ledger
      if (!bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId]) {
        bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId] = {
          groupLedgerId: groupLedgerId,
          groupLedgerName: groupLedgerName,
          closingBalance: 0,
        };
      }

      // Add balance to Group Ledger and total
      bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId].closingBalance +=
        balance;
      bspLedgerMap[bspLedgerId].totalBalance += balance;
    }

    // Step 7: Convert the map to the desired array format
    const result = Object.values(bspLedgerMap).map((bspLedger) => ({
      bSPLLedgerId: bspLedger.bSPLLedgerId,
      bSPLLedgerName: bspLedger.bSPLLedgerName,
      totalBalance: bspLedger.totalBalance,
      groupLedgers: Object.values(bspLedger.groupLedgers),
    }));

    // Filter out group ledgers with zero balance
    result.forEach((bspLedger) => {
      bspLedger.groupLedgers = bspLedger.groupLedgers.filter(
        (groupLedger) => groupLedger.closingBalance !== 0
      );
    });

    // Also filter out BSPL ledgers that have no group ledgers after filtering
    const filteredResult = result.filter(
      (bspLedger) => bspLedger.groupLedgers.length > 0
    );

    // Step 8: Sort by BSPL Ledger name alphabetically (to match getIncomeAndExpenditureAccount)
    filteredResult.sort((a, b) => {
      const nameA = a.bSPLLedgerName || "";
      const nameB = b.bSPLLedgerName || "";
      return nameA.localeCompare(nameB);
    });

    // Step 9: Sort group ledgers within each BSPL ledger alphabetically
    filteredResult.forEach((bspLedger) => {
      bspLedger.groupLedgers.sort((a, b) => {
        const nameA = a.groupLedgerName || "";
        const nameB = b.groupLedgerName || "";
        return nameA.localeCompare(nameB);
      });
    });

    return res.status(200).json({
      hasError: false,
      message: "Schedule To Expenses fetched successfully",
      data: filteredResult,
    });
  } catch (error) {
    console.error("Error fetching Schedule To Expenses:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getScheduleToExpenditure;
