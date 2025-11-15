// Finance-Module/controllers/Inter-Service-Communication/AddLedgerForFeesType.js

import mongoose from "mongoose";
import Ledger from "../../models/Ledger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";
import BSPLLedger from "../../models/BSPLLedger.js";
import GroupLedger from "../../models/GroupLedger.js";
import CounterForFinaceLedger from "../../models/CounterForFinaceLedger.js";

async function addLedgerForFeesType(req, res) {
  try {
    const { financialYear, schoolId } = req.query;
    const { feesTypeName } = req.body;

    if (!financialYear || !schoolId) {
      return res.status(400).json({
        hasError: true,
        message: "Both 'financialYear' and 'schoolId' are required in query.",
      });
    }

    if (!feesTypeName) {
      return res.status(400).json({
        hasError: true,
        message: "feesTypeName is required in request body.",
      });
    }

    // Step 1: Find or Create HeadOfAccount as "Income"
    let headOfAccount = await HeadOfAccount.findOne({
      schoolId,
      headOfAccountName: "Income",
      financialYear,
    });

    if (!headOfAccount) {
      headOfAccount = new HeadOfAccount({
        schoolId,
        headOfAccountName: "Income",
        financialYear,
      });
      await headOfAccount.save();
    }

    // Step 2: Find or Create BSPL Ledger as "School Fees"
    let bsplLedger = await BSPLLedger.findOne({
      schoolId,
      headOfAccountId: headOfAccount._id,
      bSPLLedgerName: "School Fees",
      financialYear,
    });

    if (!bsplLedger) {
      bsplLedger = new BSPLLedger({
        schoolId,
        headOfAccountId: headOfAccount._id,
        bSPLLedgerName: "School Fees",
        financialYear,
      });
      await bsplLedger.save();
    }

    // Step 3: Find or Create Group Ledger as "School Fees"
    let groupLedger = await GroupLedger.findOne({
      schoolId,
      headOfAccountId: headOfAccount._id,
      bSPLLedgerId: bsplLedger._id,
      groupLedgerName: "School Fees",
      financialYear,
    });

    if (!groupLedger) {
      groupLedger = new GroupLedger({
        schoolId,
        headOfAccountId: headOfAccount._id,
        bSPLLedgerId: bsplLedger._id,
        groupLedgerName: "School Fees",
        financialYear,
      });
      await groupLedger.save();
    }

    // Step 4: Check if Ledger already exists
    const existingLedger = await Ledger.findOne({
      schoolId,
      headOfAccountId: headOfAccount._id,
      groupLedgerId: groupLedger._id,
      bSPLLedgerId: bsplLedger._id,
      ledgerName: feesTypeName,
      financialYear,
    });

    if (existingLedger) {
      return res.status(200).json({
        hasError: false,
        message: "Ledger already exists for this Fees Type.",
        data: existingLedger,
      });
    }

    // Step 5: Generate ledger code (similar to your create API)
    const typeToBaseCode = {
      Assets: 1000,
      Liabilities: 2000,
      Income: 3000,
      Expenses: 4000,
      "Capital Fund": 5000,
      "Net Surplus/(Deficit)": 6000,
    };

    const baseCode = typeToBaseCode[headOfAccount.headOfAccountName] || 3000;

    const counter = await CounterForFinaceLedger.findOneAndUpdate(
      { schoolId, headOfAccountType: headOfAccount.headOfAccountName },
      { $inc: { lastLedgerCode: 1 } },
      { new: true, upsert: true }
    );

    const ledgerCode = baseCode + counter.lastLedgerCode;

    // Step 6: Create the Ledger
    const newLedger = new Ledger({
      schoolId,
      headOfAccountId: headOfAccount._id,
      groupLedgerId: groupLedger._id,
      bSPLLedgerId: bsplLedger._id,
      ledgerName: feesTypeName,
      openingBalance: 0,
      balanceType: "Debit",
      paymentMode: "Not Defined",
      ledgerCode: ledgerCode.toString(),
      financialYear,
    });

    await newLedger.save();

    return res.status(201).json({
      hasError: false,
      message: "Ledger Created successfully for Fees Type.",
      data: newLedger,
    });
  } catch (error) {
    console.error("Error creating Ledger for Fees Type:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        hasError: true,
        message:
          "Ledger with this name already exists for the given financial year.",
      });
    }

    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
      error: error.message,
    });
  }
}

export default addLedgerForFeesType;
