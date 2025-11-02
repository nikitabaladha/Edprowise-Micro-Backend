import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";
import Ledger from "../../models/Ledger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";

import BSPLLedger from "../../models/BSPLLedger.js";
import DepreciationMaster from "../../models/DepreciationMaster.js";
import GroupLedger from "../../models/GroupLedger.js";
import moment from "moment";

async function getFixedAssetsSchedule(req, res) {
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

    // Calculate first half and second half dates
    const firstHalfStart = financialYearStart.clone(); // April 1
    const firstHalfEnd = moment(
      `09/30/${financialYear.split("-")[0]}`,
      "MM/DD/YYYY"
    ).endOf("day"); // September 30

    const secondHalfStart = moment(
      `10/01/${financialYear.split("-")[0]}`,
      "MM/DD/YYYY"
    ).startOf("day"); // October 1
    const secondHalfEnd = financialYearEnd.clone(); // March 31

    // Step 1: Get the Fixed Assets BSPLLedger
    const fixedAssetsBSPL = await BSPLLedger.findOne({
      schoolId,
      bSPLLedgerName: "Fixed Assets",
      financialYear,
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
      financialYear,
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
      financialYear,
    });

    // Create a map for easy access to depreciation rates by groupLedgerId
    const depreciationRateMap = {};
    const chargeDepreciationMap = {};

    depreciationRates.forEach((dr) => {
      // Use whichever rate is greater than 0, prefer rateAsPerIncomeTaxAct if both are > 0
      let rate = 0;
      if (dr.rateAsPerIncomeTaxAct > 0) {
        rate = dr.rateAsPerIncomeTaxAct;
      } else if (dr.rateAsPerICAI > 0) {
        rate = dr.rateAsPerICAI;
      }

      depreciationRateMap[dr.groupLedgerId.toString()] = rate;
      chargeDepreciationMap[dr.groupLedgerId.toString()] =
        dr.chargeDepreciation;
    });

    // Step 4: Get all ledgers under these group ledgers
    const ledgers = await Ledger.find({
      schoolId,
      groupLedgerId: { $in: groupLedgers.map((gl) => gl._id) },
      financialYear,
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
      financialYear,
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
      const chargeDepreciation =
        chargeDepreciationMap[groupLedger._id.toString()] || false;
      balancesByGroupLedger[groupLedger._id.toString()] = {
        groupLedgerId: groupLedger._id,
        groupLedgerName: groupLedger.groupLedgerName,
        rate: rate,
        chargeDepreciation: chargeDepreciation,
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
