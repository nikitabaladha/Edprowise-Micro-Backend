import mongoose from "mongoose";
import HeadOfAccount from "./HeadOfAccount.js";
import BSPLLedger from "./BSPLLedger.js";
import GroupLedger from "./GroupLedger.js";
import Ledger from "./Ledger.js";
import CounterForFinaceLedger from "./CounterForFinaceLedger.js";
import TotalNetdeficitNetSurplus from "./TotalNetdeficitNetSurplus.js";

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
    isDataCopiedFromPreviousYear: {
      // Add this field
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
          {
            name: "Income Tax Refund",
            ledgers: [
              "TDS on Receipts",
              "TDS on Cash Withdrawn/Deposited",
              "TCS Deducted",
            ],
          },
        ],
      },
    ],
  },
  {
    headOfAccount: "Liabilities",
    bsplLedgers: [
      {
        name: "Current Liabilities",
        groupLedgers: [
          {
            name: "TDS Payable",
            ledgers: ["TDS Deducted"],
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

FinanceModuleYearSchema.methods.createDefaultAccountsIfNeeded = async function (
  session = null
) {
  if (this.isDefaultAccountsCreated || this.isDataCopiedFromPreviousYear) {
    return; // Already created or data was copied, skip
  }

  try {
    await createDefaultChartOfAccounts(
      this.schoolId,
      this.financialYear,
      session
    );

    // Mark as created but DON'T save here - the pre-save hook will handle the final save
    this.isDefaultAccountsCreated = true;

    console.log(`Default accounts created for ${this.financialYear}`);
  } catch (err) {
    if (err.code === 11000) {
      console.log("Default accounts already exist, marking as created");
      this.isDefaultAccountsCreated = true;
      return;
    }
    console.error("Error creating default chart of accounts:", err);
    throw err;
  }
};

// Helper function to create default chart of accounts (only missing ones)
async function createDefaultChartOfAccounts(
  schoolId,
  financialYear,
  session = null
) {
  // Initialize counters
  await initializeCounters(schoolId, session);

  const saveOptions = session ? { session } : {};
  let netSurplusDeficitLedgerId = null;

  for (const account of DEFAULT_CHART_OF_ACCOUNTS) {
    // Check if Head of Account already exists
    let headOfAccount = await HeadOfAccount.findOne({
      schoolId,
      headOfAccountName: account.headOfAccount,
      financialYear,
    }).session(session || null);

    if (!headOfAccount) {
      headOfAccount = new HeadOfAccount({
        schoolId,
        headOfAccountName: account.headOfAccount,
        financialYear,
      });
      await headOfAccount.save(saveOptions);
    }

    for (const bsplLedger of account.bsplLedgers) {
      let bspl = await BSPLLedger.findOne({
        schoolId,
        headOfAccountId: headOfAccount._id,
        bSPLLedgerName: bsplLedger.name,
        financialYear,
      }).session(session || null);

      if (!bspl) {
        bspl = new BSPLLedger({
          schoolId,
          headOfAccountId: headOfAccount._id,
          bSPLLedgerName: bsplLedger.name,
          financialYear,
        });
        await bspl.save(saveOptions);
      }

      for (const groupLedger of bsplLedger.groupLedgers) {
        let group = await GroupLedger.findOne({
          schoolId,
          headOfAccountId: headOfAccount._id,
          bSPLLedgerId: bspl._id,
          groupLedgerName: groupLedger.name,
          financialYear,
        }).session(session || null);

        if (!group) {
          group = new GroupLedger({
            schoolId,
            headOfAccountId: headOfAccount._id,
            bSPLLedgerId: bspl._id,
            groupLedgerName: groupLedger.name,
            financialYear,
          });
          await group.save(saveOptions);
        }

        for (const ledgerName of groupLedger.ledgers) {
          const ledger = await createLedgerIfNotExists(
            schoolId,
            headOfAccount._id,
            group._id,
            bspl._id,
            ledgerName,
            financialYear,
            account.headOfAccount,
            session
          );

          if (ledgerName === "Net Surplus/(Deficit)" && ledger) {
            netSurplusDeficitLedgerId = ledger._id;
            console.log(
              `Stored Net Surplus/(Deficit) ledger ID: ${netSurplusDeficitLedgerId}`
            );
          }
        }
      }
    }
  }

  if (netSurplusDeficitLedgerId) {
    await createTotalNetdeficitNetSurplusRecord(
      schoolId,
      financialYear,
      netSurplusDeficitLedgerId,
      session
    );
  }
}

// Function to create TotalNetdeficitNetSurplus record
async function createTotalNetdeficitNetSurplusRecord(
  schoolId,
  financialYear,
  ledgerId,
  session = null
) {
  try {
    const saveOptions = session ? { session } : {};

    // Check if record already exists
    const existingRecord = await TotalNetdeficitNetSurplus.findOne({
      schoolId,
      financialYear,
      ledgerId,
    }).session(session || null);

    if (!existingRecord) {
      const totalNetdeficitNetSurplus = new TotalNetdeficitNetSurplus({
        schoolId,
        financialYear,
        ledgerId,
        balanceDetails: [],
      });

      await totalNetdeficitNetSurplus.save(saveOptions);
      console.log(
        `Created TotalNetdeficitNetSurplus record for ledger: ${ledgerId}`
      );
    } else {
      console.log(
        `TotalNetdeficitNetSurplus record already exists for ledger: ${ledgerId}`
      );
    }
  } catch (error) {
    if (error.code === 11000) {
      console.log(
        `TotalNetdeficitNetSurplus record already exists (duplicate key)`
      );
      return;
    }
    console.error("Error creating TotalNetdeficitNetSurplus record:", error);
    throw error;
  }
}

async function initializeCounters(schoolId, session = null) {
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
      { upsert: true, new: true, session }
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
  headOfAccountType,
  session = null
) {
  try {
    const existingLedger = await Ledger.findOne({
      schoolId,
      headOfAccountId,
      groupLedgerId,
      bSPLLedgerId,
      ledgerName,
      financialYear,
    }).session(session || null);

    if (existingLedger) {
      console.log(`Ledger ${ledgerName} already exists, skipping`);
      return existingLedger;
    }

    const counter = await CounterForFinaceLedger.findOneAndUpdate(
      { schoolId, headOfAccountType },
      { $inc: { lastLedgerCode: 1 } },
      { new: true, upsert: true, session }
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

    const newLedger = new Ledger({
      schoolId,
      headOfAccountId,
      groupLedgerId,
      bSPLLedgerId,
      ledgerName,
      openingBalance: 0,
      balanceType: "Debit",
      paymentMode: "Not Defined",
      ledgerCode,
      financialYear,
    });

    const saveOptions = session ? { session } : {};
    await newLedger.save(saveOptions);
    console.log(`Created ledger: ${ledgerName} with code: ${ledgerCode}`);

    return newLedger;
  } catch (error) {
    if (error.code === 11000) {
      console.log(`Ledger ${ledgerName} already exists (duplicate key)`);
      const existingLedger = await Ledger.findOne({
        schoolId,
        headOfAccountId,
        groupLedgerId,
        bSPLLedgerId,
        ledgerName,
        financialYear,
      }).session(session || null);
      return existingLedger;
    }
    throw error;
  }
}

FinanceModuleYearSchema.pre("save", async function (next) {
  // Only run if this is a new document and accounts aren't created yet AND data is not being copied
  if (
    this.isNew &&
    !this.isDefaultAccountsCreated &&
    !this.isDataCopiedFromPreviousYear
  ) {
    try {
      console.log(
        "Auto-creating default accounts for new FinanceModuleYear..."
      );

      const session = this.$session();
      await this.createDefaultAccountsIfNeeded(session);

      next();
    } catch (error) {
      console.error("Error creating default accounts in pre-save hook:", error);
      next(error);
    }
  } else {
    next();
  }
});

export default mongoose.model("FinanceModuleYear", FinanceModuleYearSchema);
