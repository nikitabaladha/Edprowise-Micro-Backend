import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";
import Ledger from "../../models/Ledger.js";
import BSPLLedger from "../../models/BSPLLedger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";
import moment from "moment";
import mongoose from "mongoose";

async function getBalanceSheetForAssetsLiabilities(req, res) {
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

    // Step 1: Find HeadOfAccount IDs for "Assets" and "Liabilities"
    const assetsHead = await HeadOfAccount.findOne({
      schoolId,
      academicYear,
      headOfAccountName: "Assets",
    });

    const liabilitiesHead = await HeadOfAccount.findOne({
      schoolId,
      academicYear,
      headOfAccountName: "Liabilities",
    });

    if (!assetsHead && !liabilitiesHead) {
      return res.status(200).json({
        hasError: false,
        message: "No Assets or Liabilities head accounts found",
        data: {
          assets: [],
          liabilities: [],
        },
      });
    }

    // Step 2: Find all ledgers under Assets and Liabilities heads
    const ledgerQuery = {
      schoolId,
      academicYear,
      $or: [],
    };

    if (assetsHead) {
      ledgerQuery.$or.push({ headOfAccountId: assetsHead._id });
    }
    if (liabilitiesHead) {
      ledgerQuery.$or.push({ headOfAccountId: liabilitiesHead._id });
    }

    const ledgers = await Ledger.find(ledgerQuery)
      .populate({
        path: "groupLedgerId",
        select: "groupLedgerName",
      })
      .populate({
        path: "bSPLLedgerId",
        select: "bSPLLedgerName",
      })
      .populate({
        path: "headOfAccountId",
        select: "headOfAccountName",
      });

    if (ledgers.length === 0) {
      return res.status(200).json({
        hasError: false,
        message: "No ledgers found for Assets or Liabilities heads",
        data: {
          assets: [],
          liabilities: [],
        },
      });
    }

    // Step 3: Get all ledger IDs
    const ledgerIds = ledgers.map((ledger) => ledger._id);

    // Step 4: Find OpeningClosingBalance records for these ledgers
    const balanceRecords = await OpeningClosingBalance.find({
      schoolId,
      academicYear,
      ledgerId: { $in: ledgerIds },
    }).populate("ledgerId");

    // Step 5: Calculate closing balances for each ledger within date range
    const ledgerBalances = {};

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

    // Step 6: Group data by HeadOfAccount → BSPLLedger → GroupLedger
    const result = {
      assets: [],
      liabilities: [],
    };

    // Create a nested structure for grouping
    const groupedData = {};

    for (const ledger of ledgers) {
      const ledgerId = ledger._id.toString();
      const balance = ledgerBalances[ledgerId] || 0;
      const headOfAccountName = ledger.headOfAccountId?.headOfAccountName;
      const bspLedgerId = ledger.bSPLLedgerId?._id.toString();
      const bspLedgerName = ledger.bSPLLedgerId?.bSPLLedgerName;
      const groupLedgerId = ledger.groupLedgerId?._id.toString();
      const groupLedgerName = ledger.groupLedgerId?.groupLedgerName;

      if (!headOfAccountName || !bspLedgerId || !groupLedgerId) continue;

      // Initialize head of account
      if (!groupedData[headOfAccountName]) {
        groupedData[headOfAccountName] = {};
      }

      // Initialize BSPL ledger
      if (!groupedData[headOfAccountName][bspLedgerId]) {
        groupedData[headOfAccountName][bspLedgerId] = {
          bSPLLedgerId: bspLedgerId,
          bSPLLedgerName: bspLedgerName,
          totalBalance: 0,
          groupLedgers: {},
        };
      }

      // Initialize Group ledger
      if (
        !groupedData[headOfAccountName][bspLedgerId].groupLedgers[groupLedgerId]
      ) {
        groupedData[headOfAccountName][bspLedgerId].groupLedgers[
          groupLedgerId
        ] = {
          groupLedgerId: groupLedgerId,
          groupLedgerName: groupLedgerName,
          closingBalance: 0,
        };
      }

      // Add balance to group ledger
      groupedData[headOfAccountName][bspLedgerId].groupLedgers[
        groupLedgerId
      ].closingBalance += balance;
      // Add balance to BSPL ledger total
      groupedData[headOfAccountName][bspLedgerId].totalBalance += balance;
    }

    // Step 7: Convert the nested structure to the desired format
    for (const headOfAccountName in groupedData) {
      const bspLedgers = groupedData[headOfAccountName];

      for (const bspLedgerId in bspLedgers) {
        const bspLedgerData = bspLedgers[bspLedgerId];

        const formattedBspLedger = {
          bSPLLedgerId: bspLedgerData.bSPLLedgerId,
          bSPLLedgerName: bspLedgerData.bSPLLedgerName,
          totalBalance: bspLedgerData.totalBalance,
          groupLedgers: Object.values(bspLedgerData.groupLedgers),
        };

        // Add to the appropriate result array
        if (headOfAccountName === "Assets") {
          result.assets.push(formattedBspLedger);
        } else if (headOfAccountName === "Liabilities") {
          result.liabilities.push(formattedBspLedger);
        }
      }
    }

    // Step 8: Sort the results
    result.assets.sort((a, b) =>
      a.bSPLLedgerName.localeCompare(b.bSPLLedgerName)
    );
    result.liabilities.sort((a, b) =>
      a.bSPLLedgerName.localeCompare(b.bSPLLedgerName)
    );

    // Sort group ledgers within each BSPL ledger
    result.assets.forEach((asset) => {
      asset.groupLedgers.sort((a, b) =>
        a.groupLedgerName.localeCompare(b.groupLedgerName)
      );
    });
    result.liabilities.forEach((liability) => {
      liability.groupLedgers.sort((a, b) =>
        a.groupLedgerName.localeCompare(b.groupLedgerName)
      );
    });

    return res.status(200).json({
      hasError: false,
      message: "Assets And Liabilities Account fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching Assets And Liabilities Account:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getBalanceSheetForAssetsLiabilities;
