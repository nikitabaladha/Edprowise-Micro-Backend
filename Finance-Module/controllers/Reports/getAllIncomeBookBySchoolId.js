import PaymentEntry from "../../models/PaymentEntry.js";
import Receipt from "../../models/Receipt.js";
import Journal from "../../models/Journal.js";
import Contra from "../../models/Contra.js";

import Ledger from "../../models/Ledger.js";
import GroupLedger from "../../models/GroupLedger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";
import mongoose from "mongoose";

async function getAllIncomeBookBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { academicYear } = req.params;
    const { startDate, endDate } = req.query;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    // Create date filter object
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.entryDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (academicYear) {
      const yearParts = academicYear.split("-");
      if (yearParts.length === 2) {
        const startYear = parseInt(yearParts[0]);
        const endYear = parseInt(yearParts[1]);
        dateFilter.entryDate = {
          $gte: new Date(`${startYear}-04-01`),
          $lte: new Date(`${endYear}-03-31`),
        };
      }
    }

    const paymentEntries = await PaymentEntry.find({
      schoolId,
      ...dateFilter,
      status: "Posted",
    })
      .sort({ createdAt: -1 })
      .lean();

    const receiptEntries = await Receipt.find({
      schoolId,
      ...dateFilter,
      status: "Posted",
    })
      .sort({ createdAt: -1 })
      .lean();

    const JournalEntries = await Journal.find({
      schoolId,
      ...dateFilter,
      status: "Posted",
    })
      .sort({ createdAt: -1 })
      .lean();

    const contraEntries = await Contra.find({
      schoolId,
      ...dateFilter,
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

          amountAfterGST: item.amountAfterGST || null,
          creditAmount: item.creditAmount || null,

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
        TDSTCSRateWithAmountBeforeGST: entry.TDSTCSRateWithAmountBeforeGST,
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
        customizeEntry: entry.customizeEntry,

        subTotalAmountAfterGST: entry.subTotalAmountAfterGST || null,
        subTotalOfCredit: entry.subTotalOfCredit || null,

        totalAmountAfterGST: entry.totalAmountAfterGST || null,
        totalCreditAmount: entry.totalCreditAmount || null,
      };

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
          ledgerName: ledger?.ledgerName || null,
          groupLedgerId: ledger?.groupLedgerId || null,
          groupLedgerName: groupLedger?.groupLedgerName || null,
          debitAmount: item.debitAmount || null,
          amount: item.amount,
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
        customizeEntry: entry.customizeEntry,

        subTotalAmount: entry.subTotalAmount || null,
        subTotalOfDebit: entry.subTotalOfDebit || null,
        totalAmount: entry.totalAmount || null,
        totalDebitAmount: entry.totalDebitAmount || null,
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

      const entryData = {
        accountingEntry: "Journal",
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        documentDate: entry.documentDate,
        narration: entry.narration,
        subTotalOfDebit: entry.subTotalOfDebit,
        totalAmountOfDebit: entry.totalAmountOfDebit,
        totalAmountOfCredit: entry.totalAmountOfCredit,
        journalVoucherNumber: entry.journalVoucherNumber || null,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        // Item details
        itemDetails: itemsWithLedgerNames,
        customizeEntry: entry.customizeEntry,
      };

      formattedData.push(entryData);
    }

    // Find Contra Entries

    for (const entry of contraEntries) {
      let hasIncomeHeadOfAccount = false;
      const itemsWithLedgerNames = [];

      // Collect all ledger IDs (both ledgerId and ledgerIdOfCashAccount)
      const allLedgerIds = new Set();
      entry.itemDetails.forEach((item) => {
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          allLedgerIds.add(item.ledgerId.toString());
        }
        if (
          item.ledgerIdOfCashAccount &&
          mongoose.Types.ObjectId.isValid(item.ledgerIdOfCashAccount)
        ) {
          allLedgerIds.add(item.ledgerIdOfCashAccount.toString());
        }
      });

      // Fetch all required ledgers in one query
      const ledgers = await Ledger.find({
        _id: { $in: Array.from(allLedgerIds) },
        schoolId,
      })
        .select("ledgerName groupLedgerId headOfAccountId")
        .lean();

      // Check if any ledger has "Income" HeadOfAccount
      for (const ledger of ledgers) {
        if (ledger.headOfAccountId) {
          const headOfAccount = await HeadOfAccount.findOne({
            _id: ledger.headOfAccountId,
            schoolId,
            headOfAccountName: "Income",
          }).lean();

          if (headOfAccount) {
            hasIncomeHeadOfAccount = true;
            break; // No need to check further if we found one
          }
        }
      }

      // Skip this entry if no Income head of account found
      if (!hasIncomeHeadOfAccount) {
        continue;
      }

      // Create maps for quick lookup
      const ledgerMap = {};
      const ledgerGroupMap = {};
      ledgers.forEach((ledger) => {
        ledgerMap[ledger._id.toString()] = {
          ledgerName: ledger.ledgerName,
          groupLedgerId: ledger.groupLedgerId?.toString(),
        };
      });

      // Get all unique group ledger IDs
      const groupLedgerIds = new Set(
        ledgers
          .map((ledger) => ledger.groupLedgerId?.toString())
          .filter((id) => id)
      );

      // Fetch all required group ledgers in one query
      const groupLedgers = await GroupLedger.find({
        _id: { $in: Array.from(groupLedgerIds) },
        schoolId,
      })
        .select("groupLedgerName")
        .lean();

      // Create map for group ledgers
      const groupLedgerMap = {};
      groupLedgers.forEach((groupLedger) => {
        groupLedgerMap[groupLedger._id.toString()] =
          groupLedger.groupLedgerName;
      });

      // Process each item in the contra entry
      for (const item of entry.itemDetails) {
        const ledgerInfo = ledgerMap[item.ledgerId?.toString()] || {};
        const cashLedgerInfo =
          ledgerMap[item.ledgerIdOfCashAccount?.toString()] || {};

        itemsWithLedgerNames.push({
          ledgerId: item.ledgerId || null,
          ledgerName: ledgerInfo.ledgerName || null,
          groupLedgerId: ledgerInfo.groupLedgerId || null,
          groupLedgerName: ledgerInfo.groupLedgerId
            ? groupLedgerMap[ledgerInfo.groupLedgerId]
            : null,

          ledgerIdOfCashAccount: item.ledgerIdOfCashAccount || null,
          ledgerNameOfCashAccount: cashLedgerInfo.ledgerName || null,
          groupLedgerIdOfCashAccount: cashLedgerInfo.groupLedgerId || null,
          groupLedgerNameOfCashAccount: cashLedgerInfo.groupLedgerId
            ? groupLedgerMap[cashLedgerInfo.groupLedgerId]
            : null,

          debitAmount: item.debitAmount || 0,
          creditAmount: item.creditAmount || 0,
        });
      }

      // Handle TDS/TCS information if present
      let TDSorTCSGroupLedgerName = null;
      let TDSorTCSLedgerName = null;

      if (entry.TDSorTCS) {
        const tdsOrTcsGroupLedger = await GroupLedger.findOne({
          schoolId,
          groupLedgerName: entry.TDSorTCS,
        })
          .select("_id groupLedgerName")
          .lean();

        if (tdsOrTcsGroupLedger) {
          TDSorTCSGroupLedgerName = tdsOrTcsGroupLedger.groupLedgerName;

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
        accountingEntry: "Contra",
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        dateOfCashDepositedWithdrawlDate:
          entry.dateOfCashDepositedWithdrawlDate,
        contraEntryName: entry.contraEntryName,
        narration: entry.narration,
        chequeNumber: entry.chequeNumber || null,
        chequeImageForContra: entry.chequeImageForContra || null,
        subTotalOfDebit: entry.subTotalOfDebit,
        subTotalOfCredit: entry.subTotalOfCredit,
        totalAmountOfCredit: entry.totalAmountOfCredit,
        totalAmountOfDebit: entry.totalAmountOfDebit,
        TDSTCSRateAmount: entry.TDSTCSRateAmount,
        contraVoucherNumber: entry.contraVoucherNumber || null,
        TDSorTCS: entry.TDSorTCS || null,
        status: entry.status,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        TDSorTCSGroupLedgerName,
        TDSorTCSLedgerName,
        itemDetails: itemsWithLedgerNames,
        customizeEntry: entry.customizeEntry,
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
