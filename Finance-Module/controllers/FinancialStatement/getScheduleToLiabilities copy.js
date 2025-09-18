// // Here i want all date whose headOfAccountName is "Liabilities"

// // now see in OpeningClosingBalance table there is ledgerId that ledgerId is connected with LedgerTable
// // so you can easily find HeadOfAccountName for that perticular ledger
// // now example
// // entryDate   HeadofAccount	BS&P&LLedger	         Group Ledger	     Ledger	          OpeningBalance	 Debit	 Credit	  Closing Balance
// // 17-09-2025  Liabilities	  CapitalFund	           Capital Fund	     Net Deficit	    -1000	           100	    0       -900
// // 17-09-2025  Liabilities	  CapitalFund	           Capital Fund	     Net Surplus	    -900	           100      0	      -800
// // 18-09-2025  Liabilities	  CapitalFund	           Capital Fund	     Net Surplus	    -800	           100      0	      -700

// // see in OpeningClosingBalance table the stored data for that perticular ledger is

// // _id
// // 68ca728047d83d5625c47618
// // schoolId
// // "SID144732"
// // academicYear
// // "2025-2026"
// // ledgerId
// // 68a9a476f46f002cf6a5433e

// // balanceDetails
// // Array (3)

// // 0
// // Object
// // entryId
// // "68ca728047d83d5625c47613"
// // entryDate
// // 2025-09-17T00:00:00.000+00:00
// // openingBalance
// // -1000
// // debit
// // 100
// // credit
// // 0
// // closingBalance
// // -900
// // _id
// // 68ca728047d83d5625c47619

// // 1
// // Object
// // entryId
// // "68ca729647d83d5625c47654"
// // entryDate
// // 2025-09-17T00:00:00.000+00:00
// // openingBalance
// // -900
// // debit
// // 100
// // credit
// // 0
// // closingBalance
// // -800
// // _id
// // 68ca729647d83d5625c4765a

// // 2
// // Object
// // entryId
// // "68ca733847d83d5625c47723"
// // entryDate
// // 2025-09-18T00:00:00.000+00:00
// // openingBalance
// // -800
// // debit
// // 100
// // credit
// // 0
// // closingBalance
// // -700
// // _id
// // 68ca733847d83d5625c4772a
// // balanceType
// // "Credit"
// // createdAt
// // 2025-09-17T08:34:08.167+00:00
// // updatedAt
// // 2025-09-17T08:37:12.893+00:00
// // __v
// // 5
// // _id
// // 68ca728047d83d5625c47620
// // schoolId
// // "SID144732"
// // academicYear
// // "2025-2026"
// // ledgerId
// // 68a9a474f46f002cf6a54302

// // balanceDetails
// // Array (3)
// // balanceType
// // "Credit"
// // createdAt
// // 2025-09-17T08:34:08.419+00:00
// // updatedAt
// // 2025-09-17T08:37:13.066+00:00
// // __v
// // 5

// // now see if user type startDate 17-09-2025 endDate 17-09-2025then it gives correct data like

// [
//   {
//     bSPLLedgerId: "6888dac5481f4c4cfb3712b4",
//     bSPLLedgerName: "CapitalFund",
//     groupLedgers: [
//       {
//         groupLedgerId: "6888dac6481f4c4cfb3712ca",
//         groupLedgerName: "Capital Fund",
//         ledgers: [
//           {
//             ledgerId: "68a9a476f46f002cf6a5433e",
//             ledgerName: "Net Deficit",
//             OpeningBalance: -1000,
//             debit: 0,
//             credit: 200,
//             closingBalance: -800,
//           },
//         ],
//       },
//     ],
//   },
// ];

// // now see if user type startDate 18-09-2025 endDate 18-09-2025 then it gives correct data like

// [
//   {
//     bSPLLedgerId: "6888dac5481f4c4cfb3712b4",
//     bSPLLedgerName: "CapitalFund",
//     groupLedgers: [
//       {
//         groupLedgerId: "6888dac6481f4c4cfb3712ca",
//         groupLedgerName: "Capital Fund",
//         ledgers: [
//           {
//             ledgerId: "68a9a476f46f002cf6a5433e",
//             ledgerName: "Net Deficit",
//             OpeningBalance: -800,
//             debit: 0,
//             credit: 100,
//             closingBalance: -700,
//           },
//         ],
//       },
//     ],
//   },
// ];

// // now see if user type startDate 19-09-2025 endDate 19-09-2025 then it must give correct data like

// [
//   {
//     bSPLLedgerId: "6888dac5481f4c4cfb3712b4",
//     bSPLLedgerName: "CapitalFund",
//     groupLedgers: [
//       {
//         groupLedgerId: "6888dac6481f4c4cfb3712ca",
//         groupLedgerName: "Capital Fund",
//         ledgers: [
//           {
//             ledgerId: "68a9a476f46f002cf6a5433e",
//             ledgerName: "Net Deficit",
//             OpeningBalance: -800,
//             debit: 0,
//             credit: 0,
//             closingBalance: -800,
//           },
//         ],
//       },
//     ],
//   },
// ];

// // now see if user type startDate 19-09-2025 endDate 31-03-2025 then it must give correct data like

// [
//   {
//     bSPLLedgerId: "6888dac5481f4c4cfb3712b4",
//     bSPLLedgerName: "CapitalFund",
//     groupLedgers: [
//       {
//         groupLedgerId: "6888dac6481f4c4cfb3712ca",
//         groupLedgerName: "Capital Fund",
//         ledgers: [
//           {
//             ledgerId: "6888dac6481f4c4cfb3712ca",
//             ledgerName: "Net Deficit",
//             OpeningBalance: -800,
//             debit: 0,
//             credit: 0,
//             closingBalance: -800,
//           },
//         ],
//       },
//     ],
//   },
// ];

// // now see if user type startDate 01-04-2025 endDate 31-04-2025 then it must give correct data like
// [
//   {
//     bSPLLedgerId: "6888dac5481f4c4cfb3712b4",
//     bSPLLedgerName: "CapitalFund",
//     groupLedgers: [
//       {
//         groupLedgerId: "6888dac6481f4c4cfb3712ca",
//         groupLedgerName: "Capital Fund",
//         ledgers: [
//           {
//             ledgerId: "6888dac6481f4c4cfb3712ca",
//             ledgerName: "Net Deficit",
//             OpeningBalance: -100,
//             debit: 0,
//             credit: 0,
//             closingBalance: -100,
//           },
//         ],
//       },
//     ],
//   },
// ];

// // because in see when ledger is created at that time i already have stored openingBalance for that perticular Ledger
// // so if there is no entry in OpeningClosingBalance Table at that time you can use that OpeningBalance Stored In Ledger table
// // as OpeningBalance for that perticular ledger

// // so tell me what to do ?

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

    // Step 1: Find HeadOfAccount IDs for "Liabilities"
    const liabilitiesHead = await HeadOfAccount.findOne({
      schoolId,
      academicYear,
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
      academicYear,
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

    // =======Here all removed Capital Fund======

    // Filter out ledgers with bSPLLedgerName "Capital Fund"
    const filteredLedgers = ledgers.filter(
      (ledger) => ledger.bSPLLedgerId?.bSPLLedgerName !== "Capital Fund"
    );

    // Step 3: Get all ledger IDs from filtered ledgers
    const ledgerIds = filteredLedgers.map((ledger) => ledger._id);

    // Step 3: Get all ledger IDs
    // =======Here all coming======
    // const ledgerIds = ledgers.map((ledger) => ledger._id);

    // Step 4: Find OpeningClosingBalance records for these ledgers
    const balanceRecords = await OpeningClosingBalance.find({
      schoolId,
      academicYear,
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

    // for (const ledger of ledgers) {
    //   const bspLedgerId = ledger.bSPLLedgerId?._id.toString();
    //   const bspLedgerName =
    //     ledger.bSPLLedgerId?.bSPLLedgerName || "Uncategorized";

    //   const groupLedgerId = ledger.groupLedgerId?._id.toString();
    //   const groupLedgerName =
    //     ledger.groupLedgerId?.groupLedgerName || "Uncategorized";

    //   const ledgerId = ledger._id.toString();
    //   const ledgerName = ledger.ledgerName;

    //   if (!bspLedgerId || !groupLedgerId) continue;

    //   // Initialize BSPL Ledger entry if it doesn't exist
    //   if (!bspLedgerMap[bspLedgerId]) {
    //     bspLedgerMap[bspLedgerId] = {
    //       bSPLLedgerId: bspLedgerId,
    //       bSPLLedgerName: bspLedgerName,
    //       groupLedgers: {},
    //     };
    //   }

    //   // Initialize Group Ledger entry if it doesn't exist
    //   if (!bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId]) {
    //     bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId] = {
    //       groupLedgerId: groupLedgerId,
    //       groupLedgerName: groupLedgerName,
    //       ledgers: {},
    //     };
    //   }

    //   // Initialize Ledger entry if it doesn't exist
    //   if (
    //     !bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId].ledgers[ledgerId]
    //   ) {
    //     bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId].ledgers[
    //       ledgerId
    //     ] = {
    //       ledgerId: ledgerId,
    //       ledgerName: ledgerName,
    //       openingBalance: 0,
    //       debit: 0,
    //       credit: 0,
    //       closingBalance: 0,
    //     };
    //   }

    //   const balanceRecord = balanceRecordsMap[ledgerId];
    //   let openingBalance = ledger.openingBalance || 0;
    //   let totalDebit = 0;
    //   let totalCredit = 0;

    //   if (balanceRecord && balanceRecord.balanceDetails.length > 0) {
    //     // Get all entries within the date range
    //     const entriesInRange = balanceRecord.balanceDetails.filter((detail) => {
    //       const detailDate = moment(detail.entryDate);
    //       return detailDate.isBetween(start, end, null, "[]");
    //     });

    //     if (entriesInRange.length > 0) {
    //       // Sort entries by date to get the correct order
    //       entriesInRange.sort(
    //         (a, b) => moment(a.entryDate) - moment(b.entryDate)
    //       );

    //       // Get the opening balance from the first entry in the range
    //       openingBalance = entriesInRange[0].openingBalance || 0;

    //       // Sum all debit and credit transactions within the range
    //       entriesInRange.forEach((entry) => {
    //         totalDebit += entry.debit || 0;
    //         totalCredit += entry.credit || 0;
    //       });
    //     } else {
    //       // No entries in range, find the latest entry before the start date
    //       const entriesBeforeStart = balanceRecord.balanceDetails.filter(
    //         (detail) => {
    //           const detailDate = moment(detail.entryDate);
    //           return detailDate.isBefore(start);
    //         }
    //       );

    //       if (entriesBeforeStart.length > 0) {
    //         // Get the latest entry before start date
    //         entriesBeforeStart.sort(
    //           (a, b) => moment(b.entryDate) - moment(a.entryDate)
    //         );
    //         openingBalance = entriesBeforeStart[0].closingBalance || 0;
    //       }
    //       // If no entries before start date, use ledger's opening balance
    //     }
    //   }

    //   // Adjust for balance type (Credit balances are typically negative in accounting)
    //   const isCreditBalance = ledger.balanceType === "Credit";
    //   if (isCreditBalance) {
    //     openingBalance = -Math.abs(openingBalance);
    //   }

    //   // Calculate closing balance
    //   const closingBalance = openingBalance + totalDebit - totalCredit;

    //   // Update ledger balances
    //   bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId].ledgers[
    //     ledgerId
    //   ].openingBalance = openingBalance;
    //   bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId].ledgers[
    //     ledgerId
    //   ].debit = totalDebit;
    //   bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId].ledgers[
    //     ledgerId
    //   ].credit = totalCredit;
    //   bspLedgerMap[bspLedgerId].groupLedgers[groupLedgerId].ledgers[
    //     ledgerId
    //   ].closingBalance = closingBalance;
    // }

    for (const ledger of filteredLedgers) {
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

      // Adjust for balance type (Credit balances are typically negative in accounting)
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
    const result = Object.values(bspLedgerMap).map((bspLedger) => ({
      bSPLLedgerId: bspLedger.bSPLLedgerId,
      bSPLLedgerName: bspLedger.bSPLLedgerName,
      groupLedgers: Object.values(bspLedger.groupLedgers).map(
        (groupLedger) => ({
          groupLedgerId: groupLedger.groupLedgerId,
          groupLedgerName: groupLedger.groupLedgerName,
          ledgers: Object.values(groupLedger.ledgers),
        })
      ),
    }));

    return res.status(200).json({
      hasError: false,
      message: "Schedule To Liabilities fetched successfully",
      data: result,
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
