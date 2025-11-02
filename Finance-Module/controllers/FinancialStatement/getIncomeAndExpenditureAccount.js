import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";
import Ledger from "../../models/Ledger.js";
import BSPLLedger from "../../models/BSPLLedger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";
import moment from "moment";
import mongoose from "mongoose";

async function getIncomeAndExpenditureAccount(req, res) {
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

    // Step 1: Find HeadOfAccount IDs for "Income" and "Expenses"
    const incomeHead = await HeadOfAccount.findOne({
      schoolId,
      financialYear,
      headOfAccountName: "Income",
    });

    const expensesHead = await HeadOfAccount.findOne({
      schoolId,
      financialYear,
      headOfAccountName: "Expenses",
    });

    if (!incomeHead && !expensesHead) {
      return res.status(200).json({
        hasError: false,
        message: "No Income or Expenses head accounts found",
        data: {
          income: [],
          expenses: [],
        },
      });
    }

    // Step 2: Find all ledgers under Income and Expenses heads with proper population
    const ledgerQuery = {
      schoolId,
      financialYear,
      $or: [],
    };

    if (incomeHead) {
      ledgerQuery.$or.push({ headOfAccountId: incomeHead._id });
    }
    if (expensesHead) {
      ledgerQuery.$or.push({ headOfAccountId: expensesHead._id });
    }

    const ledgers = await Ledger.find(ledgerQuery)
      .populate({
        path: "bSPLLedgerId",
        select: "bSPLLedgerName", // Only populate the name field
      })
      .populate("headOfAccountId");

    if (ledgers.length === 0) {
      return res.status(200).json({
        hasError: false,
        message: "No ledgers found for Income or Expenses heads",
        data: {
          income: [],
          expenses: [],
        },
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

    // Step 6: Get all BSPL Ledger names in bulk for better performance

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

    const bspLedgerIds = [
      ...new Set(
        ledgers.map((ledger) => ledger.bSPLLedgerId?._id).filter((id) => id)
      ),
    ];
    const bspLedgers = await BSPLLedger.find({
      _id: { $in: bspLedgerIds },
    }).select("_id bSPLLedgerName");

    // Create a map for quick lookup
    const bspLedgerMap = {};
    bspLedgers.forEach((ledger) => {
      bspLedgerMap[ledger._id.toString()] = ledger.bSPLLedgerName;
    });

    // Step 7: Group by HeadOfAccount and BSPLLedger
    const result = {
      income: [],
      expenses: [],
    };

    const groupedData = {};

    for (const ledger of ledgers) {
      const ledgerId = ledger._id.toString();
      const balance = ledgerBalances[ledgerId] || 0;
      const headOfAccountName = ledger.headOfAccountId?.headOfAccountName;
      const bspLedgerId = ledger.bSPLLedgerId?._id.toString();

      // Get BSPL Ledger name from our map or use fallback
      const bspLedgerName = bspLedgerId
        ? bspLedgerMap[bspLedgerId] || `Ledger ${bspLedgerId}`
        : "Uncategorized";

      if (!bspLedgerId || !headOfAccountName) continue;

      const key = `${headOfAccountName}_${bspLedgerId}`;

      if (!groupedData[key]) {
        groupedData[key] = {
          headOfAccountName,
          bSPLLedgerId: bspLedgerId,
          bSPLLedgerName: bspLedgerName,
          closingBalance: 0,
        };
      }

      groupedData[key].closingBalance += balance;
    }

    // Step 8: Organize into income and expenses arrays
    for (const key in groupedData) {
      const item = groupedData[key];
      if (item.headOfAccountName === "Income") {
        result.income.push({
          headOfAccountName: item.headOfAccountName,
          bSPLLedgerId: item.bSPLLedgerId,
          bSPLLedgerName: item.bSPLLedgerName,
          closingBalance: item.closingBalance,
        });
      } else if (item.headOfAccountName === "Expenses") {
        result.expenses.push({
          headOfAccountName: item.headOfAccountName,
          bSPLLedgerId: item.bSPLLedgerId,
          bSPLLedgerName: item.bSPLLedgerName,
          closingBalance: item.closingBalance,
        });
      }
    }

    // Filter out BSPL ledgers with zero balance (keep only positive or negative values)
    result.income = result.income.filter((item) => item.closingBalance !== 0);

    result.expenses = result.expenses.filter(
      (item) => item.closingBalance !== 0
    );
    // Sort by BSPLLedger name with safe handling
    result.income.sort((a, b) => {
      const nameA = a.bSPLLedgerName || "";
      const nameB = b.bSPLLedgerName || "";
      return nameA.localeCompare(nameB);
    });

    result.expenses.sort((a, b) => {
      const nameA = a.bSPLLedgerName || "";
      const nameB = b.bSPLLedgerName || "";
      return nameA.localeCompare(nameB);
    });

    return res.status(200).json({
      hasError: false,
      message: "Income And Expenditure Account fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching Income And Expenditure Account:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getIncomeAndExpenditureAccount;
