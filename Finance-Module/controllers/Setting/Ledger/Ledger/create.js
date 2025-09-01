import Ledger from "../../../../models/Ledger.js";
import HeadOfAccount from "../../../../models/HeadOfAccount.js";
import CounterForFinaceLedger from "../../../../models/CounterForFinaceLedger.js";
import LedgerValidator from "../../../../validators/LedgerValidator.js";

async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to create a ledger.",
      });
    }

    const { error } = LedgerValidator.LedgerValidator.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    const {
      ledgerName,
      headOfAccountId,
      groupLedgerId,
      bSPLLedgerId,
      openingBalance,
      academicYear,
    } = req.body;

    // First, get the HeadOfAccount to determine the type
    const headOfAccount = await HeadOfAccount.findById(headOfAccountId);
    if (!headOfAccount) {
      return res.status(404).json({
        hasError: true,
        message: "Head of Account not found",
      });
    }

    // Determine the base code based on HeadOfAccount type
    const typeToBaseCode = {
      Assets: 1000,
      Liabilities: 2000,
      Income: 3000,
      Expenses: 4000,
    };

    const baseCode = typeToBaseCode[headOfAccount.headOfAccountName];
    if (!baseCode) {
      return res.status(400).json({
        hasError: true,
        message:
          "Head of Account must from 'Assets','Liabilities','Income', or 'Expenses'",
      });
    }

    // Determine balanceType based on openingBalance
    let balanceType;
    if (Number(openingBalance) < 0) {
      balanceType = "Credit";
    } else {
      balanceType = "Debit"; // includes 0 and positive
    }

    // Atomically find and increment the counter
    const counter = await CounterForFinaceLedger.findOneAndUpdate(
      { schoolId, headOfAccountType: headOfAccount.headOfAccountName },
      { $inc: { lastLedgerCode: 1 } },
      { new: true, upsert: true }
    );

    const ledgerCode = baseCode + counter.lastLedgerCode;

    const isAssetOrLiability = ["Assets", "Liabilities"].includes(
      headOfAccount.headOfAccountName
    );
    const finalOpeningBalance = isAssetOrLiability ? openingBalance || 0 : 0;

    const newLedger = new Ledger({
      schoolId,
      headOfAccountId,
      groupLedgerId,
      bSPLLedgerId,
      ledgerName,
      openingBalance: finalOpeningBalance,
      academicYear,
      ledgerCode: ledgerCode.toString(),
      balanceType,
    });

    await newLedger.save();

    return res.status(201).json({
      hasError: false,
      message: "Ledger created successfully!",
      data: newLedger,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Ledger already exists.`,
      });
    }

    console.error("Error Creating Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}
export default create;
