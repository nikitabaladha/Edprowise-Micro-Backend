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
    isDefaultAccountsCreated: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

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
              "Excess",
              "Fine",
            ],
          },
        ],
      },
    ],
  },
  {
    headOfAccount: "NetSurplus/(Deficit)",
    bsplLedgers: [
      {
        name: "Net Surplus/(Deficit)",
        groupLedgers: [
          {
            name: "Net Surplus/(Deficit)",
            ledgers: ["Net Surplus/(Deficit)"],
          },
        ],
      },
    ],
  },
  {
    headOfAccount: "Expenses",
    bsplLedgers: [
      {
        name: "School Fee Concession & Educational Assistance",
        groupLedgers: [
          {
            name: "School Fee Concession & Educational Assistance",
            ledgers: ["School Fee Concession & Educational Assistance"],
          },
        ],
      },
    ],
  },
  {
    headOfAccount: "Capital Fund",
    bsplLedgers: [
      {
        name: "Capital Fund",
        groupLedgers: [
          {
            name: "Capital Fund",
            ledgers: ["Capital Fund"],
          },
        ],
      },
    ],
  },
];

// Remove the post-save hook and create a separate method
FinanceModuleYearSchema.methods.createDefaultAccountsIfNeeded =
  async function () {
    if (this.isDefaultAccountsCreated) {
      return; // Already created, skip
    }

    try {
      await createDefaultChartOfAccounts(this.schoolId, this.financialYear);

      // Mark as created
      this.isDefaultAccountsCreated = true;
      await this.save();

      console.log(`Default accounts created for ${this.financialYear}`);
    } catch (err) {
      if (err.code === 11000) {
        console.log("Default accounts already exist, marking as created");
        this.isDefaultAccountsCreated = true;
        await this.save();
        return;
      }
      console.error("Error creating default chart of accounts:", err);
      throw err;
    }
  };

// Helper function to create default chart of accounts (only missing ones)
async function createDefaultChartOfAccounts(schoolId, financialYear) {
  // Initialize counters
  await initializeCounters(schoolId);

  for (const account of DEFAULT_CHART_OF_ACCOUNTS) {
    // Check if Head of Account already exists
    let headOfAccount = await HeadOfAccount.findOne({
      schoolId,
      headOfAccountName: account.headOfAccount,
      financialYear,
    });

    if (!headOfAccount) {
      // Create only if it doesn't exist
      headOfAccount = new HeadOfAccount({
        schoolId,
        headOfAccountName: account.headOfAccount,
        financialYear,
      });
      await headOfAccount.save();
    }

    for (const bsplLedger of account.bsplLedgers) {
      // Check if BS & P&L Ledger already exists
      let bspl = await BSPLLedger.findOne({
        schoolId,
        headOfAccountId: headOfAccount._id,
        bSPLLedgerName: bsplLedger.name,
        financialYear,
      });

      if (!bspl) {
        // Create only if it doesn't exist
        bspl = new BSPLLedger({
          schoolId,
          headOfAccountId: headOfAccount._id,
          bSPLLedgerName: bsplLedger.name,
          financialYear,
        });
        await bspl.save();
      }

      for (const groupLedger of bsplLedger.groupLedgers) {
        // Check if Group Ledger already exists
        let group = await GroupLedger.findOne({
          schoolId,
          headOfAccountId: headOfAccount._id,
          bSPLLedgerId: bspl._id,
          groupLedgerName: groupLedger.name,
          financialYear,
        });

        if (!group) {
          // Create only if it doesn't exist
          group = new GroupLedger({
            schoolId,
            headOfAccountId: headOfAccount._id,
            bSPLLedgerId: bspl._id,
            groupLedgerName: groupLedger.name,
            financialYear,
          });
          await group.save();
        }

        // Create only missing Ledgers
        for (const ledgerName of groupLedger.ledgers) {
          await createLedgerIfNotExists(
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
  const counterTypes = [
    "Assets",
    "Expenses",
    "Income",
    "NetSurplus/(Deficit)",
    "Capital Fund",
  ];

  for (const type of counterTypes) {
    await CounterForFinaceLedger.findOneAndUpdate(
      { schoolId, headOfAccountType: type },
      { $setOnInsert: { lastLedgerCode: 0 } },
      { upsert: true, new: true }
    );
  }
}

async function createLedgerIfNotExists(
  schoolId,
  headOfAccountId,
  groupLedgerId,
  bSPLLedgerId,
  ledgerName,
  financialYear,
  headOfAccountType
) {
  try {
    // Check if ledger already exists
    const existingLedger = await Ledger.findOne({
      schoolId,
      headOfAccountId,
      groupLedgerId,
      bSPLLedgerId,
      ledgerName,
      financialYear,
    });

    if (existingLedger) {
      console.log(`Ledger ${ledgerName} already exists, skipping`);
      return;
    }

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
      "NetSurplus/(Deficit)": 5000,
      "Capital Fund": 6000,
    };

    const ledgerCode = (
      baseCodes[headOfAccountType] + counter.lastLedgerCode
    ).toString();

    const openingBalance = 0;
    const balanceType = "Debit";
    const paymentMode = "Not Defined";

    const newLedger = new Ledger({
      schoolId,
      headOfAccountId,
      groupLedgerId,
      bSPLLedgerId,
      ledgerName,
      openingBalance,
      balanceType,
      paymentMode,
      ledgerCode,
      financialYear,
    });

    await newLedger.save();
    console.log(`Created ledger: ${ledgerName} with code: ${ledgerCode}`);
  } catch (error) {
    if (error.code === 11000) {
      console.log(`Ledger ${ledgerName} already exists (duplicate key)`);
      return;
    }
    throw error;
  }
}

export default mongoose.model("FinanceModuleYear", FinanceModuleYearSchema);
