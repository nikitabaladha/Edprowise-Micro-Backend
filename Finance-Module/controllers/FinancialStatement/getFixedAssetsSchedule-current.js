import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";
import Ledger from "../../models/Ledger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";

import BSPLLedger from "../../models/BSPLLedger.js";
import DepreciationMaster from "../../models/DepreciationMaster.js";
import GroupLedger from "../../models/GroupLedger.js";
import moment from "moment";

// example:
//        entryDate	HeadofAccount	BS&P&LLedger	GroupLedger	        Ledger               OpeningBalance.  debit  credit.  closingBalance
//entry-1 19-09-2025	Assets	      Fixed Assets	Furniture&Fixture	  ElectricalEquipemts  1000             100    0        1100
//entry-2 19-09-2025	Assets	      Fixed Assets	Furniture&Fixture	  ElectricalEquipemts  1100             100    0        1200
//entry-3 19-09-2025	Assets	      Fixed Assets	Plant&Machinery	    WaterCooler&Filter   1000             0      100      900
//entry-4 19-09-2025	Assets	      Fixed Assets	Plant&Machinery	    WaterCooler&Filter   900              0      100      800

// see for example if user give startDate like 19-09-2025 and end Date: 19-09-2025
// then for openingBalance you need to use whatever the openingBalance of that perticular date which is first entry
// here you need to use 1000 as opening and for closing whatever last of that that perticular date and ledger here
// 1200

// but if user give startDate like 20-09-2025 and endDate:25-09-2025
// then at that time you need to use closing balance of last date as opening Balance and you need to give 1200 as openingBalance and for closing also 1200 becuuse there is no
// enrty on that day....if there is enrty then use that data

// but if user give startDate like 01-09-2025 and endDate:18-09-2025
// and if there is not any data in opening closing Balance tabale then at that time
// you need to use openingBalance present in ledgerTable as base value example 1000 and give it as
// opening balance 1000 debit 0 credit 0 and closing balance also 0
// because whenever ledger created i have stored openingBalance so you can use it

// but currently for Furniture & Fixture for OpeningBalance you are giving 1,900.00 and for closing you are giving 1700
// which is wrong
// but currently for Plant & Machinery for OpeningBalance you are giving 2100.00 and for closing you are giving 2300
// which is wrong

// [
//     {
//         "bSPLLedgerId": "6888dae7481f4c4cfb3716c3",
//         "bSPLLedgerName": "Fixed Assets",
//         "groupLedgers": [
//             {
//                 "groupLedgerId": "6888dae7481f4c4cfb3716d9",
//                 "groupLedgerName": "Furniture & Fixture",
//                 "rate":20,
//                 openingBalance:1000
//                 closingBalance:1200
//                 "totalAddition":(100+100=200)-(0+0=0)=200
//             },
//             {
//                 "groupLedgerId": "6888dae7481f4c4cfb3716df",
//                 "Electrical Equipemts": "Plant & Machinery",
//                "rate":10,
//                openingBalance:1000
//                closingBalance:800
//                "totalAddition":(0+0=0)-(100+100=200)=-200
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

    // Step 5: Get opening/closing balances for these ledgers within the date range
    const ledgerIds = ledgers.map((l) => l._id);
    const openingClosingBalances = await OpeningClosingBalance.find({
      schoolId,
      ledgerId: { $in: ledgerIds },
      academicYear,
      "balanceDetails.entryDate": {
        $gte: start.toDate(),
        $lte: end.toDate(),
      },
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
      balancesByGroupLedger[groupLedger._id.toString()] = {
        groupLedgerId: groupLedger._id,
        groupLedgerName: groupLedger.groupLedgerName,
        rate: depreciationRateMap[groupLedger._id.toString()] || 0,
        openingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0,
        totalAddition: 0,
      };
    });

    // Calculate totals for each group ledger
    openingClosingBalances.forEach((ocb) => {
      const groupLedgerId = ocb.ledgerId.groupLedgerId.toString();

      if (balancesByGroupLedger[groupLedgerId]) {
        ocb.balanceDetails.forEach((balanceDetail) => {
          balancesByGroupLedger[groupLedgerId].openingBalance +=
            balanceDetail.openingBalance || 0;
          balancesByGroupLedger[groupLedgerId].totalDebit +=
            balanceDetail.debit || 0;
          balancesByGroupLedger[groupLedgerId].totalCredit +=
            balanceDetail.credit || 0;
          balancesByGroupLedger[groupLedgerId].closingBalance +=
            balanceDetail.closingBalance || 0;
        });
      }
    });

    // Calculate totalAddition for each group ledger
    Object.keys(balancesByGroupLedger).forEach((key) => {
      const groupLedger = balancesByGroupLedger[key];
      groupLedger.totalAddition =
        groupLedger.totalDebit - groupLedger.totalCredit;

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
