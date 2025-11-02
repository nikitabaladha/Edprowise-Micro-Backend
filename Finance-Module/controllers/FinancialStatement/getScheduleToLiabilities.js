import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";
import Ledger from "../../models/Ledger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";
import moment from "moment";

async function getScheduleToLiabilities(req, res) {
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

    // Step 1: Find HeadOfAccount IDs for "Liabilities"
    const liabilitiesHead = await HeadOfAccount.findOne({
      schoolId,
      financialYear,
      headOfAccountName: "Liabilities",
    });

    if (!liabilitiesHead) {
      return res.status(200).json({
        hasError: false,
        message: "No Liabilities head accounts found",
        data: [],
      });
    }

    // Step 2: Find all ledgers under Liabilities with proper population
    const ledgers = await Ledger.find({
      schoolId,
      financialYear,
      headOfAccountId: liabilitiesHead._id,
    })
      .populate({
        path: "groupLedgerId",
        select: "groupLedgerName",
      })
      .populate({
        path: "bSPLLedgerId",
        select: "bSPLLedgerName",
      });

    if (ledgers.length === 0) {
      return res.status(200).json({
        hasError: false,
        message: "No ledgers found for Liabilities head",
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
    }).populate({
      path: "ledgerId",
      populate: [
        { path: "groupLedgerId", select: "groupLedgerName" },
        { path: "bSPLLedgerId", select: "bSPLLedgerName" },
      ],
    });

    // Create a map of balance records by ledgerId for easier access
    const balanceRecordsMap = {};
    balanceRecords.forEach((record) => {
      balanceRecordsMap[record.ledgerId._id.toString()] = record;
    });

    // Step 5: Create a map to organize data by BSPL Ledger -> Group Ledger -> Ledger
    const bspLedgerMap = {};

    for (const ledger of ledgers) {
      const bspLedgerId = ledger.bSPLLedgerId?._id.toString();
      const bspLedgerName =
        ledger.bSPLLedgerId?.bSPLLedgerName || "Uncategorized";

      const groupLedgerId = ledger.groupLedgerId?._id.toString();
      const groupLedgerName =
        ledger.groupLedgerId?.groupLedgerName || "Uncategorized";

      const ledgerId = ledger._id.toString();
      const ledgerName = ledger.ledgerName;

      if (!bspLedgerId || !groupLedgerId) continue;

      // Initialize BSPL Ledger entry if it doesn't exist
      if (!bspLedgerMap[bspLedgerId]) {
        bspLedgerMap[bspLedgerId] = {
          bSPLLedgerId: bspLedgerId,
          bSPLLedgerName: bspLedgerName,
          groupLedgers: {},
        };
      }

      // Initialize Group Ledger entry if it doesn't exist
      if (!bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId]) {
        bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId] = {
          groupLedgerId: groupLedgerId,
          groupLedgerName: groupLedgerName,
          ledgers: {},
        };
      }

      // Initialize Ledger entry if it doesn't exist
      if (
        !bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId].ledgers[ledgerId]
      ) {
        bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId].ledgers[
          ledgerId
        ] = {
          ledgerId: ledgerId,
          ledgerName: ledgerName,
          openingBalance: 0,
          debit: 0,
          credit: 0,
          closingBalance: 0,
        };
      }

      const balanceRecord = balanceRecordsMap[ledgerId];
      let openingBalance = ledger.openingBalance || 0;
      let totalDebit = 0;
      let totalCredit = 0;

      if (balanceRecord && balanceRecord.balanceDetails.length > 0) {
        // Get all entries within the date range
        const entriesInRange = balanceRecord.balanceDetails.filter((detail) => {
          const detailDate = moment(detail.entryDate);
          return detailDate.isBetween(start, end, null, "[]");
        });

        if (entriesInRange.length > 0) {
          // Sort entries by date to get the correct order
          entriesInRange.sort(
            (a, b) => moment(a.entryDate) - moment(b.entryDate)
          );

          // Get the opening balance from the first entry in the range
          openingBalance = entriesInRange[0].openingBalance || 0;

          // Sum all debit and credit transactions within the range
          entriesInRange.forEach((entry) => {
            totalDebit += entry.debit || 0;
            totalCredit += entry.credit || 0;
          });
        } else {
          // No entries in range, find the latest entry before the start date
          const entriesBeforeStart = balanceRecord.balanceDetails.filter(
            (detail) => {
              const detailDate = moment(detail.entryDate);
              return detailDate.isBefore(start);
            }
          );

          if (entriesBeforeStart.length > 0) {
            // Get the latest entry before start date
            entriesBeforeStart.sort(
              (a, b) => moment(b.entryDate) - moment(a.entryDate)
            );
            openingBalance = entriesBeforeStart[0].closingBalance || 0;
          }
          // If no entries before start date, use ledger's opening balance
        }
      }

      const isCreditBalance = ledger.balanceType === "Credit";
      if (isCreditBalance) {
        openingBalance = -Math.abs(openingBalance);
      }

      // Calculate closing balance
      const closingBalance = openingBalance + totalDebit - totalCredit;

      // Update ledger balances
      bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId].ledgers[
        ledgerId
      ].openingBalance = openingBalance;
      bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId].ledgers[
        ledgerId
      ].debit = totalDebit;
      bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId].ledgers[
        ledgerId
      ].credit = totalCredit;
      bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId].ledgers[
        ledgerId
      ].closingBalance = closingBalance;
    }

    // Step 6: Convert the map to the desired array format

    const result = Object.values(bspLedgerMap)
      .map((bspLedger) => ({
        bSPLLedgerId: bspLedger.bSPLLedgerId,
        bSPLLedgerName: bspLedger.bSPLLedgerName,
        groupLedgers: Object.values(bspLedger.groupLedgers)
          .map((groupLedger) => ({
            groupLedgerId: groupLedger.groupLedgerId,
            groupLedgerName: groupLedger.groupLedgerName,
            ledgers: Object.values(groupLedger.ledgers),
          }))

          .sort((a, b) => a.groupLedgerName.localeCompare(b.groupLedgerName)),
      }))

      .sort((a, b) => a.bSPLLedgerName.localeCompare(b.bSPLLedgerName));

    result.forEach((bspLedger) => {
      bspLedger.groupLedgers.forEach((groupLedger) => {
        groupLedger.ledgers = groupLedger.ledgers.filter((ledger) => {
          return !(
            ledger.openingBalance === 0 &&
            ledger.closingBalance === 0 &&
            ledger.debit === 0 &&
            ledger.credit === 0
          );
        });
      });
    });

    // Also filter out empty group ledgers and BSPL ledgers
    result.forEach((bspLedger) => {
      bspLedger.groupLedgers = bspLedger.groupLedgers.filter(
        (groupLedger) => groupLedger.ledgers.length > 0
      );
    });

    // Filter out BSPL ledgers that have no group ledgers after filtering
    const filteredResult = result.filter(
      (bspLedger) => bspLedger.groupLedgers.length > 0
    );

    return res.status(200).json({
      hasError: false,
      message: "Schedule To Liabilities fetched successfully",
      data: filteredResult,
    });
  } catch (error) {
    console.error("Error fetching Schedule To Liabilities:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getScheduleToLiabilities;
