// Finance-Module/models/FinanceModuleYear.js
import mongoose from "mongoose";
import HeadOfAccount from "./HeadOfAccount.js";
import BSPLLedger from "./BSPLLedger.js";
import GroupLedger from "./GroupLedger.js";
import Ledger from "./Ledger.js";
import CounterForFinaceLedger from "./CounterForFinaceLedger.js";

const FinanceModuleYearSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    financialYear: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// i want to add few things more like
// HeadofAccount	       BS&P&LLedger	          GroupLedger	           Ledger
// NetSurplus/(Deficit)	 Net Surplus/(Deficit)	Net Surplus/(Deficit)	 Net Surplus/(Deficit)
// Capital Fund	         Capital Fund	          Capital Fund	         Capital Fund

// Default chart of accounts structure
const DEFAULT_CHART_OF_ACCOUNTS = [
  {
    headOfAccount: "Assets",
    bsplLedgers: [
      {
        name: "Current Assets",
        groupLedgers: [
          {
            name: "Loan & Advances",
            ledgers: ["Cheque", "Online"],
          },
          {
            name: "Cash",
            ledgers: ["Cash Account"],
          },
        ],
      },
    ],
  },
  {
    headOfAccount: "Income",
    bsplLedgers: [
      {
        name: "School Fees",
        groupLedgers: [
          {
            name: "School Fees",
            ledgers: [
              "Registration Fee",
              "Admission Fee",
              "Transfer Certificate Fee",
              "Board Exam Fee",
              "Board Registration Fee",
            ],
          },
        ],
      },
    ],
  },
];

// Post-save hook to automatically create chart of accounts
FinanceModuleYearSchema.post("save", async function (doc, next) {
  try {
    await createDefaultChartOfAccounts(doc.schoolId, doc.financialYear);
    next();
  } catch (err) {
    if (err.code === 11000) return next(); // Handle duplicates gracefully
    console.error("Error creating default chart of accounts:", err);
    next(err);
  }
});

// Helper function to create default chart of accounts
async function createDefaultChartOfAccounts(schoolId, financialYear) {
  // Initialize counters
  await initializeCounters(schoolId);

  for (const account of DEFAULT_CHART_OF_ACCOUNTS) {
    // Create or get Head of Account
    let headOfAccount = await HeadOfAccount.findOneAndUpdate(
      {
        schoolId,
        headOfAccountName: account.headOfAccount,
        financialYear,
      },
      {
        $setOnInsert: {
          schoolId,
          headOfAccountName: account.headOfAccount,
          financialYear,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    for (const bsplLedger of account.bsplLedgers) {
      // Create or get BS & P&L Ledger
      let bspl = await BSPLLedger.findOneAndUpdate(
        {
          schoolId,
          headOfAccountId: headOfAccount._id,
          bSPLLedgerName: bsplLedger.name,
          financialYear,
        },
        {
          $setOnInsert: {
            schoolId,
            headOfAccountId: headOfAccount._id,
            bSPLLedgerName: bsplLedger.name,
            financialYear,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      for (const groupLedger of bsplLedger.groupLedgers) {
        // Create or get Group Ledger
        let group = await GroupLedger.findOneAndUpdate(
          {
            schoolId,
            headOfAccountId: headOfAccount._id,
            bSPLLedgerId: bspl._id,
            groupLedgerName: groupLedger.name,
            financialYear,
          },
          {
            $setOnInsert: {
              schoolId,
              headOfAccountId: headOfAccount._id,
              bSPLLedgerId: bspl._id,
              groupLedgerName: groupLedger.name,
              financialYear,
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );

        // Create Ledgers
        for (const ledgerName of groupLedger.ledgers) {
          await createLedger(
            schoolId,
            headOfAccount._id,
            group._id,
            bspl._id,
            ledgerName,
            financialYear,
            account.headOfAccount
          );
        }
      }
    }
  }
}

async function initializeCounters(schoolId) {
  const counterTypes = ["Assets", "Income"];

  for (const type of counterTypes) {
    await CounterForFinaceLedger.findOneAndUpdate(
      { schoolId, headOfAccountType: type },
      { $setOnInsert: { lastLedgerCode: 0 } },
      { upsert: true, new: true }
    );
  }
}

async function createLedger(
  schoolId,
  headOfAccountId,
  groupLedgerId,
  bSPLLedgerId,
  ledgerName,
  financialYear,
  headOfAccountType
) {
  try {
    // Get next ledger code
    const counter = await CounterForFinaceLedger.findOneAndUpdate(
      { schoolId, headOfAccountType },
      { $inc: { lastLedgerCode: 1 } },
      { new: true, upsert: true }
    );

    const baseCodes = {
      Assets: 1000,
      Liabilities: 2000,
      Income: 3000,
      Expenses: 4000,
    };

    const ledgerCode = (
      baseCodes[headOfAccountType] + counter.lastLedgerCode
    ).toString();

    // Set defaults as specified
    const openingBalance = 0; // Default 0
    const balanceType = "Debit"; // Default Debit for all
    const paymentMode = "Not Defined"; // Default "Not Defined"

    await Ledger.findOneAndUpdate(
      {
        schoolId,
        headOfAccountId,
        groupLedgerId,
        bSPLLedgerId,
        ledgerName,
        financialYear,
      },
      {
        $setOnInsert: {
          schoolId,
          headOfAccountId,
          groupLedgerId,
          bSPLLedgerId,
          ledgerName,
          openingBalance, // Default 0
          balanceType, // Default "Debit"
          paymentMode, // Default "Not Defined"
          ledgerCode,
          financialYear,
        },
      },
      {
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    console.log(
      `Created/Verified ledger: ${ledgerName} with code: ${ledgerCode}`
    );
  } catch (error) {
    if (error.code === 11000) {
      console.log(`Ledger ${ledgerName} already exists`);
      return;
    }
    throw error;
  }
}

export default mongoose.model("FinanceModuleYear", FinanceModuleYearSchema);
