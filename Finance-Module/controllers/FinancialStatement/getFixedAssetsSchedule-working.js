import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";
import Ledger from "../../models/Ledger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";

import BSPLLedger from "../../models/BSPLLedger.js";
import DepreciationMaster from "../../models/DepreciationMaster.js";
import GroupLedger from "../../models/GroupLedger.js";
import moment from "moment";

// example:
//        entryDate	 HeadofAccount	BS&P&LLedger	GroupLedger	        Ledger               OpeningBalance.  debit  credit  closingBalance
//entry-1 01-04-2025	Assets	      Fixed Assets	Furniture&Fixture	  ElectricalEquipemts  1000             100    0        1100
//entry-2 02-04-2025	Assets	      Fixed Assets	Furniture&Fixture	  ElectricalEquipemts  1100             100    0        1200
//entry-1 01-08-2025	Assets	      Fixed Assets	Furniture&Fixture	  ElectricalEquipemts  1200             100    0        1300
//entry-2 02-08-2025	Assets	      Fixed Assets	Furniture&Fixture	  ElectricalEquipemts  1300             100    0        1400

// see here i am getting correct openingBalance, ClosingBalance, Toatl Addition, firstHalf ,second Half , openingBalanceOfDepriciation and depreciationOnAddition
// now i want one more field totalDepriciation = openingBalanceOfDepriciation +  depreciationOnAddition
// now i want one more field closingDepriciation = openingBalance + totalAddition -  totalDepriciation
//
// so how to do it...see other things are perfectly fine so no need to chnage just add this filed as i need in respnse

//
// [
//     {
//         "bSPLLedgerId": "6888dae7481f4c4cfb3716c3",
//         "bSPLLedgerName": "Fixed Assets",
//         "groupLedgers": [
//             {
//                 "groupLedgerId": "6888dae7481f4c4cfb3716d9",
//                 "groupLedgerName": "Furniture & Fixture",
//                 "rate":10,
//                 firstHalf: debit(100+100)-credit(0+0)=200.   here in first half data must be from 01-04 to 30-09
//                 secondHalf:debit(100+100)-credit(0+0)=200.   here in first half data must be from 01-10 to 31-03
//                 openingBalance:1000
//                 closingBalance:1400
//                 "totalAddition":(100+100+100+100=400)-(0+0+0+0=0)=400
//                 openingBalanceOfDepriciation= (10*1000)=10000/100=100
//                 depreciationOnAddition= 100
//                totalDepriciation= 200+100=300
//                closingDepriciation;1000+400-300=1100

//             },
//         ]
//     },
// ]

// tell me how to do it

async function getFixedAssetsSchedule(req, res) {
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

    // Calculate first half and second half dates
    const firstHalfStart = academicYearStart.clone(); // April 1
    const firstHalfEnd = moment(
      `09/30/${academicYear.split("-")[0]}`,
      "MM/DD/YYYY"
    ).endOf("day"); // September 30

    const secondHalfStart = moment(
      `10/01/${academicYear.split("-")[0]}`,
      "MM/DD/YYYY"
    ).startOf("day"); // October 1
    const secondHalfEnd = academicYearEnd.clone(); // March 31

    // Step 1: Get the Fixed Assets BSPLLedger
    const fixedAssetsBSPL = await BSPLLedger.findOne({
      schoolId,
      bSPLLedgerName: "Fixed Assets",
      academicYear,
    });

    if (!fixedAssetsBSPL) {
      return res.status(200).json({
        hasError: false,
        message: "No Fixed Assets found for this academic year",
        data: [],
      });
    }

    // Step 2: Get all GroupLedgers under Fixed Assets
    const groupLedgers = await GroupLedger.find({
      schoolId,
      bSPLLedgerId: fixedAssetsBSPL._id,
      academicYear,
    });

    if (groupLedgers.length === 0) {
      return res.status(200).json({
        hasError: false,
        message: "No Group Ledgers found under Fixed Assets",
        data: [],
      });
    }

    // Step 3: Get depreciation rates for these group ledgers
    const depreciationRates = await DepreciationMaster.find({
      schoolId,
      groupLedgerId: { $in: groupLedgers.map((gl) => gl._id) },
      academicYear,
    });

    // Create a map for easy access to depreciation rates by groupLedgerId
    const depreciationRateMap = {};
    depreciationRates.forEach((dr) => {
      depreciationRateMap[dr.groupLedgerId.toString()] =
        dr.rateAsPerIncomeTaxAct;
    });

    // Step 4: Get all ledgers under these group ledgers
    const ledgers = await Ledger.find({
      schoolId,
      groupLedgerId: { $in: groupLedgers.map((gl) => gl._id) },
      academicYear,
    });

    // Create a map for easy access to ledger opening balances
    const ledgerOpeningBalanceMap = {};
    ledgers.forEach((ledger) => {
      ledgerOpeningBalanceMap[ledger._id.toString()] =
        ledger.openingBalance || 0;
    });

    // Step 5: Get opening/closing balances for these ledgers within the date range
    const ledgerIds = ledgers.map((l) => l._id);
    const openingClosingBalances = await OpeningClosingBalance.find({
      schoolId,
      ledgerId: { $in: ledgerIds },
      academicYear,
    }).populate("ledgerId");

    // Step 6: Process the data to create the desired structure
    const result = {
      bSPLLedgerId: fixedAssetsBSPL._id,
      bSPLLedgerName: fixedAssetsBSPL.bSPLLedgerName,
      groupLedgers: [],
    };

    // Group balances by groupLedgerId
    const balancesByGroupLedger = {};

    groupLedgers.forEach((groupLedger) => {
      const rate = depreciationRateMap[groupLedger._id.toString()] || 0;
      balancesByGroupLedger[groupLedger._id.toString()] = {
        groupLedgerId: groupLedger._id,
        groupLedgerName: groupLedger.groupLedgerName,
        rate: rate,
        openingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0,
        totalAddition: 0,
        firstHalf: 0,
        secondHalf: 0,
        openingBalanceOfDepreciation: 0, // Add new field
        depreciationOnAddition: 0, // Add new field
      };
    });

    // Process each ledger to calculate correct balances
    for (const ledger of ledgers) {
      const groupLedgerId = ledger.groupLedgerId.toString();

      if (!balancesByGroupLedger[groupLedgerId]) continue;

      // Find the openingClosingBalance record for this ledger
      const ocbRecord = openingClosingBalances.find(
        (ocb) => ocb.ledgerId._id.toString() === ledger._id.toString()
      );

      let openingBalance = ledgerOpeningBalanceMap[ledger._id.toString()];
      let closingBalance = openingBalance;
      let totalDebit = 0;
      let totalCredit = 0;
      let firstHalfDebit = 0;
      let firstHalfCredit = 0;
      let secondHalfDebit = 0;
      let secondHalfCredit = 0;

      if (ocbRecord) {
        // Sort balanceDetails by entryDate to get chronological order
        const sortedBalanceDetails = ocbRecord.balanceDetails.sort(
          (a, b) => new Date(a.entryDate) - new Date(b.entryDate)
        );

        // Find the first entry before or on the start date to get the opening balance
        const entriesBeforeStart = sortedBalanceDetails.filter(
          (bd) => new Date(bd.entryDate) < start.toDate()
        );

        if (entriesBeforeStart.length > 0) {
          // Use the closing balance of the last entry before the start date as opening balance
          const lastEntryBeforeStart =
            entriesBeforeStart[entriesBeforeStart.length - 1];
          openingBalance = lastEntryBeforeStart.closingBalance;
          closingBalance = openingBalance;
        }

        // Process entries within the date range
        const entriesInRange = sortedBalanceDetails.filter(
          (bd) =>
            new Date(bd.entryDate) >= start.toDate() &&
            new Date(bd.entryDate) <= end.toDate()
        );

        for (const balanceDetail of entriesInRange) {
          totalDebit += balanceDetail.debit || 0;
          totalCredit += balanceDetail.credit || 0;
          closingBalance = balanceDetail.closingBalance;

          // Calculate first half and second half amounts
          const entryDate = moment(balanceDetail.entryDate);

          if (entryDate.isBetween(firstHalfStart, firstHalfEnd, null, "[]")) {
            // Entry is in first half (April 1 - September 30)
            firstHalfDebit += balanceDetail.debit || 0;
            firstHalfCredit += balanceDetail.credit || 0;
          } else if (
            entryDate.isBetween(secondHalfStart, secondHalfEnd, null, "[]")
          ) {
            // Entry is in second half (October 1 - March 31)
            secondHalfDebit += balanceDetail.debit || 0;
            secondHalfCredit += balanceDetail.credit || 0;
          }
        }
      }

      // Update group ledger totals
      balancesByGroupLedger[groupLedgerId].openingBalance += openingBalance;
      balancesByGroupLedger[groupLedgerId].totalDebit += totalDebit;
      balancesByGroupLedger[groupLedgerId].totalCredit += totalCredit;
      balancesByGroupLedger[groupLedgerId].closingBalance += closingBalance;
      balancesByGroupLedger[groupLedgerId].firstHalf +=
        firstHalfDebit - firstHalfCredit;
      balancesByGroupLedger[groupLedgerId].secondHalf +=
        secondHalfDebit - secondHalfCredit;
    }

    // Calculate totalAddition, openingBalanceOfDepreciation, and depreciationOnAddition for each group ledger
    Object.keys(balancesByGroupLedger).forEach((key) => {
      const groupLedger = balancesByGroupLedger[key];
      const rate = groupLedger.rate;

      groupLedger.totalAddition =
        groupLedger.totalDebit - groupLedger.totalCredit;

      // Calculate openingBalanceOfDepreciation: (rate * openingBalance) / 100
      groupLedger.openingBalanceOfDepreciation =
        (rate * groupLedger.openingBalance) / 100;

      // Calculate depreciationOnAddition according to the formula:
      // ((rate * firstHalf)/100) + ((rate * secondHalf)/100)/2
      const firstHalfDepreciation = (rate * groupLedger.firstHalf) / 100;
      const secondHalfDepreciation = (rate * groupLedger.secondHalf) / 100;
      groupLedger.depreciationOnAddition =
        firstHalfDepreciation + secondHalfDepreciation / 2;

      groupLedger.totalDepreciation =
        groupLedger.openingBalanceOfDepreciation +
        groupLedger.depreciationOnAddition;

      // Calculate closingDepreciation: openingBalance + totalAddition - totalDepreciation
      groupLedger.closingDepreciation =
        groupLedger.openingBalance +
        groupLedger.totalAddition -
        groupLedger.totalDepreciation;

      result.groupLedgers.push(groupLedger);
    });
    return res.status(200).json({
      hasError: false,
      message: "Fixed Assets Schedule fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching Fixed Assets Schedule:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getFixedAssetsSchedule;
