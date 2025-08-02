import PaymentEntry from "../../models/PaymentEntry.js";
import Receipt from "../../models/Receipt.js";
import Journal from "../../models/Journal.js";
import Ledger from "../../models/Ledger.js";
import GroupLedger from "../../models/GroupLedger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";
import mongoose from "mongoose";

async function getAllIncomeBookBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    const paymentEntries = await PaymentEntry.find({
      schoolId,
      academicYear,
      status: "Posted",
    })
      .sort({ createdAt: -1 })
      .lean();

    const receiptEntries = await Receipt.find({
      schoolId,
      academicYear,
      status: "Posted",
    })
      .sort({ createdAt: -1 })
      .lean();

    const JournalEntries = await Journal.find({
      schoolId,
      academicYear,
      status: "Posted",
    })
      .sort({ createdAt: -1 })
      .lean();

    const formattedData = [];

    // Find Payment Entries

    for (const entry of paymentEntries) {
      const itemsWithLedgerNames = [];
      let hasIncomeHeadOfAccount = false;

      for (const item of entry.itemDetails) {
        let ledger = null;
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          ledger = await Ledger.findOne({
            _id: item.ledgerId,
            schoolId,
          })
            .select("ledgerName groupLedgerId headOfAccountId")
            .lean();

          // Check if this ledger has "Income" HeadOfAccount
          if (ledger?.headOfAccountId) {
            const headOfAccount = await HeadOfAccount.findOne({
              _id: ledger.headOfAccountId,
              schoolId,
              headOfAccountName: "Income",
            }).lean();

            if (headOfAccount) {
              hasIncomeHeadOfAccount = true;
            }
          }
        }

        let groupLedger = null;
        if (ledger?.groupLedgerId) {
          groupLedger = await GroupLedger.findOne({
            _id: ledger.groupLedgerId,
            schoolId,
          })
            .select("groupLedgerName")
            .lean();
        }

        itemsWithLedgerNames.push({
          itemName: item.itemName,
          ledgerId: item.ledgerId || null,
          amountBeforeGST: item.amountBeforeGST,
          GSTAmount: item.GSTAmount,
          amountAfterGST: item.amountAfterGST,
          ledgerName: ledger?.ledgerName || null,
          groupLedgerId: ledger?.groupLedgerId || null,
          groupLedgerName: groupLedger?.groupLedgerName || null,
        });
      }

      const ledgerWithPaymentMode =
        entry.ledgerIdWithPaymentMode &&
        mongoose.Types.ObjectId.isValid(entry.ledgerIdWithPaymentMode)
          ? await Ledger.findById(entry.ledgerIdWithPaymentMode)
              .select("ledgerName groupLedgerId headOfAccountId")
              .lean()
          : null;

      if (ledgerWithPaymentMode?.headOfAccountId) {
        const headOfAccount = await HeadOfAccount.findOne({
          _id: ledgerWithPaymentMode.headOfAccountId,
          schoolId,
          headOfAccountName: "Income",
        }).lean();

        if (headOfAccount) {
          hasIncomeHeadOfAccount = true;
        }
      }

      // Skip this entry if no Income head of account found
      if (!hasIncomeHeadOfAccount) {
        continue;
      }

      let groupLedgerWithPaymentMode = null;
      if (ledgerWithPaymentMode?.groupLedgerId) {
        groupLedgerWithPaymentMode = await GroupLedger.findOne({
          _id: ledgerWithPaymentMode.groupLedgerId,
          schoolId,
        })
          .select("groupLedgerName")
          .lean();
      }

      let TDSorTCSGroupLedgerName = null;
      let TDSorTCSLedgerName = null;

      if (entry.TDSorTCS) {
        // 1. Find GroupLedger by name
        const tdsOrTcsGroupLedger = await GroupLedger.findOne({
          schoolId,
          groupLedgerName: entry.TDSorTCS,
        })
          .select("_id groupLedgerName")
          .lean();

        if (tdsOrTcsGroupLedger) {
          TDSorTCSGroupLedgerName = tdsOrTcsGroupLedger.groupLedgerName;

          // 2. Find Ledger under that GroupLedger
          const tdsOrTcsLedger = await Ledger.findOne({
            schoolId,
            groupLedgerId: tdsOrTcsGroupLedger._id,
          })
            .select("ledgerName")
            .lean();

          if (tdsOrTcsLedger) {
            TDSorTCSLedgerName = tdsOrTcsLedger.ledgerName;
          }
        }
      }

      const entryData = {
        accountingEntry: "Payment",
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        invoiceDate: entry.invoiceDate,
        narration: entry.narration,
        chequeNumber: entry.chequeNumber || null,
        transactionNumber: entry.transactionNumber || null,
        subTotalAmountAfterGST: entry.subTotalAmountAfterGST,
        TDSTCSRateWithAmountBeforeGST: entry.TDSTCSRateWithAmountBeforeGST,
        totalAmountAfterGST: entry.totalAmountAfterGST,
        ledgerIdWithPaymentMode: entry.ledgerIdWithPaymentMode || null,
        ledgerNameWithPaymentMode: ledgerWithPaymentMode?.ledgerName || null,
        groupLedgerIdWithPaymentMode:
          ledgerWithPaymentMode?.groupLedgerId || null,
        groupLedgerNameWithPaymentMode:
          groupLedgerWithPaymentMode?.groupLedgerName || null,
        paymentVoucherNumber: entry.paymentVoucherNumber || null,
        TDSorTCS: entry.TDSorTCS || null,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        TDSorTCSGroupLedgerName,
        TDSorTCSLedgerName,

        // Item details
        itemDetails: itemsWithLedgerNames,
      };

      // i want to push only that data whose ledgerId or ledgerIdWithPaymentMode having headOfAccount name is "Income"  otherwise dont push that  entry
      // i alredy have headofAccountId present in ledger table so from that you can find name "Income" from head of accounttable

      formattedData.push(entryData);
    }

    // Find Receipt Entries

    for (const entry of receiptEntries) {
      const itemsWithLedgerNames = [];
      let hasIncomeHeadOfAccount = false;

      for (const item of entry.itemDetails) {
        let ledger = null;
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          ledger = await Ledger.findOne({
            _id: item.ledgerId,
            schoolId,
          })
            .select("ledgerName groupLedgerId headOfAccountId")
            .lean();

          // Check if this ledger has "Income" HeadOfAccount
          if (ledger?.headOfAccountId) {
            const headOfAccount = await HeadOfAccount.findOne({
              _id: ledger.headOfAccountId,
              schoolId,
              headOfAccountName: "Income",
            }).lean();

            if (headOfAccount) {
              hasIncomeHeadOfAccount = true;
            }
          }
        }

        let groupLedger = null;
        if (ledger?.groupLedgerId) {
          groupLedger = await GroupLedger.findOne({
            _id: ledger.groupLedgerId,
            schoolId,
          })
            .select("groupLedgerName")
            .lean();
        }

        itemsWithLedgerNames.push({
          itemName: item.itemName,
          ledgerId: item.ledgerId || null,
          amount: item.amount,
          ledgerName: ledger?.ledgerName || null,
          groupLedgerId: ledger?.groupLedgerId || null,
          groupLedgerName: groupLedger?.groupLedgerName || null,
        });
      }

      const ledgerWithPaymentMode =
        entry.ledgerIdWithPaymentMode &&
        mongoose.Types.ObjectId.isValid(entry.ledgerIdWithPaymentMode)
          ? await Ledger.findById(entry.ledgerIdWithPaymentMode)
              .select("ledgerName groupLedgerId headOfAccountId")
              .lean()
          : null;

      if (ledgerWithPaymentMode?.headOfAccountId) {
        const headOfAccount = await HeadOfAccount.findOne({
          _id: ledgerWithPaymentMode.headOfAccountId,
          schoolId,
          headOfAccountName: "Income",
        }).lean();

        if (headOfAccount) {
          hasIncomeHeadOfAccount = true;
        }
      }

      // Skip this entry if no Income head of account found
      if (!hasIncomeHeadOfAccount) {
        continue;
      }

      let groupLedgerWithPaymentMode = null;
      if (ledgerWithPaymentMode?.groupLedgerId) {
        groupLedgerWithPaymentMode = await GroupLedger.findOne({
          _id: ledgerWithPaymentMode.groupLedgerId,
          schoolId,
        })
          .select("groupLedgerName")
          .lean();
      }

      let TDSorTCSGroupLedgerName = null;
      let TDSorTCSLedgerName = null;

      if (entry.TDSorTCS) {
        // 1. Find GroupLedger by name
        const tdsOrTcsGroupLedger = await GroupLedger.findOne({
          schoolId,
          groupLedgerName: entry.TDSorTCS,
        })
          .select("_id groupLedgerName")
          .lean();

        if (tdsOrTcsGroupLedger) {
          TDSorTCSGroupLedgerName = tdsOrTcsGroupLedger.groupLedgerName;

          // 2. Find Ledger under that GroupLedger
          const tdsOrTcsLedger = await Ledger.findOne({
            schoolId,
            groupLedgerId: tdsOrTcsGroupLedger._id,
          })
            .select("ledgerName")
            .lean();

          if (tdsOrTcsLedger) {
            TDSorTCSLedgerName = tdsOrTcsLedger.ledgerName;
          }
        }
      }

      const entryData = {
        // PaymentEntry fields
        accountingEntry: "Receipt",
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        receiptDate: entry.receiptDate,
        narration: entry.narration,
        chequeNumber: entry.chequeNumber || null,
        transactionNumber: entry.transactionNumber || null,
        subTotalAmount: entry.subTotalAmount,
        TDSTCSRateWithAmount: entry.TDSTCSRateWithAmount,

        ledgerIdWithPaymentMode: entry.ledgerIdWithPaymentMode || null,
        ledgerNameWithPaymentMode: ledgerWithPaymentMode?.ledgerName || null,
        groupLedgerIdWithPaymentMode:
          ledgerWithPaymentMode?.groupLedgerId || null,
        groupLedgerNameWithPaymentMode:
          groupLedgerWithPaymentMode?.groupLedgerName || null,
        receiptVoucherNumber: entry.receiptVoucherNumber || null,
        TDSorTCS: entry.TDSorTCS || null,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        TDSorTCSGroupLedgerName,
        TDSorTCSLedgerName,

        // Item details
        itemDetails: itemsWithLedgerNames,
      };

      formattedData.push(entryData);
    }

    // Find Journal Entries

    for (const entry of JournalEntries) {
      const itemsWithLedgerNames = [];
      let hasIncomeHeadOfAccount = false;

      for (const item of entry.itemDetails) {
        let ledger = null;
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          ledger = await Ledger.findOne({
            _id: item.ledgerId,
            schoolId,
          })
            .select("ledgerName groupLedgerId headOfAccountId")
            .lean();

          // Check if this ledger has "Income" HeadOfAccount
          if (ledger?.headOfAccountId) {
            const headOfAccount = await HeadOfAccount.findOne({
              _id: ledger.headOfAccountId,
              schoolId,
              headOfAccountName: "Income",
            }).lean();

            if (headOfAccount) {
              hasIncomeHeadOfAccount = true;
            }
          }
        }

        let groupLedger = null;
        if (ledger?.groupLedgerId) {
          groupLedger = await GroupLedger.findOne({
            _id: ledger.groupLedgerId,
            schoolId,
          })
            .select("groupLedgerName")
            .lean();
        }

        itemsWithLedgerNames.push({
          description: item.description,
          ledgerId: item.ledgerId || null,
          debitAmount: item.debitAmount,
          creditAmount: item.creditAmount,
          ledgerName: ledger?.ledgerName || null,
          groupLedgerId: ledger?.groupLedgerId || null,
          groupLedgerName: groupLedger?.groupLedgerName || null,
        });
      }

      // Skip this entry if no Income head of account found
      if (!hasIncomeHeadOfAccount) {
        continue;
      }

      // let TDSorTCSGroupLedgerName = null;
      // let TDSorTCSLedgerName = null;

      // if (entry.TDSorTCS) {
      //   // 1. Find GroupLedger by name
      //   const tdsOrTcsGroupLedger = await GroupLedger.findOne({
      //     schoolId,
      //     groupLedgerName: entry.TDSorTCS,
      //   })
      //     .select("_id groupLedgerName")
      //     .lean();

      //   if (tdsOrTcsGroupLedger) {
      //     TDSorTCSGroupLedgerName = tdsOrTcsGroupLedger.groupLedgerName;

      //     // 2. Find Ledger under that GroupLedger
      //     const tdsOrTcsLedger = await Ledger.findOne({
      //       schoolId,
      //       groupLedgerId: tdsOrTcsGroupLedger._id,
      //     })
      //       .select("ledgerName")
      //       .lean();

      //     if (tdsOrTcsLedger) {
      //       TDSorTCSLedgerName = tdsOrTcsLedger.ledgerName;
      //     }
      //   }
      // }

      const entryData = {
        accountingEntry: "Journal",
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        documentDate: entry.documentDate,
        narration: entry.narration,
        subTotalOfDebit: entry.subTotalOfDebit,
        // TDSTCSRateWithDebitAmount: entry.TDSTCSRateWithDebitAmount,
        // TDSTCSRateWithCreditAmount: entry.TDSTCSRateWithCreditAmount,
        totalAmountOfDebit: entry.totalAmountOfDebit,
        totalAmountOfCredit: entry.totalAmountOfCredit,
        journalVoucherNumber: entry.journalVoucherNumber || null,
        // TDSorTCS: entry.TDSorTCS,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        // TDSorTCSGroupLedgerName,
        // TDSorTCSLedgerName,

        // Item details
        itemDetails: itemsWithLedgerNames,
      };

      formattedData.push(entryData);
    }

    return res.status(200).json({
      hasError: false,
      message: "Entries fetched successfully with vendor and ledger info.",
      data: formattedData,
    });
  } catch (error) {
    console.error("Error fetching paymentEntries:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllIncomeBookBySchoolId;
