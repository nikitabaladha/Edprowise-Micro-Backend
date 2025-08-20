import PaymentEntry from "../../../models/PaymentEntry.js";
import Receipt from "../../../models/Receipt.js";
import Contra from "../../../models/Contra.js";
import Journal from "../../../models/Journal.js";

import BSPLLedger from "../../../models/BSPLLedger.js";
import HeadOfAccount from "../../../models/HeadOfAccount.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";
import mongoose from "mongoose";

async function getAllBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { academicYear } = req.params;
    const { startDate, endDate, month } = req.query;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    const baseQuery = {
      schoolId,
      status: "Posted",
    };

    if (!startDate && !endDate) {
      baseQuery.academicYear = academicYear;
    }

    if (month) {
      // Parse month string like "January 2025"
      const [monthName, year] = month.split(" ");

      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      const monthIndex = monthNames.findIndex(
        (m) => m.toLowerCase() === monthName.toLowerCase()
      );

      if (monthIndex === -1) {
        return res.status(400).json({
          hasError: true,
          message: "Invalid month name provided.",
        });
      }

      // Calculate start and end dates for the specific month
      const startOfMonth = new Date(year, monthIndex, 1);
      const endOfMonth = new Date(year, monthIndex + 1, 0);

      startOfMonth.setHours(0, 0, 0, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      baseQuery.entryDate = {
        $gte: startOfMonth,
        $lte: endOfMonth,
      };
    }
    // Add date range filter if provided (override academic year)
    else if (startDate || endDate) {
      baseQuery.entryDate = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Start of day
        baseQuery.entryDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day
        baseQuery.entryDate.$lte = end;
      }
    } else {
      // Default to academic year if no date range provided
      baseQuery.academicYear = academicYear;
    }

    const [paymentEntries, receiptEntries, contraEntries, journalEntries] =
      await Promise.all([
        PaymentEntry.find(baseQuery).sort({ createdAt: -1 }).lean(),
        Receipt.find(baseQuery).sort({ createdAt: -1 }).lean(),
        Contra.find(baseQuery).sort({ createdAt: -1 }).lean(),
        Journal.find(baseQuery).sort({ createdAt: -1 }).lean(),
      ]);

    const allEntries = [
      ...paymentEntries,
      ...receiptEntries,
      ...contraEntries,
      ...journalEntries,
    ];

    const formattedData = [];
    const months = [];

    // Find Payment Entries

    for (const entry of paymentEntries) {
      const itemsWithLedgerNames = [];

      for (const item of entry.itemDetails) {
        let ledger = null;
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          ledger = await Ledger.findOne({
            _id: item.ledgerId,
            schoolId,
          })
            .select(
              "ledgerName groupLedgerId headOfAccountId bSPLLedgerId openingBalance"
            )
            .lean();
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

        const headOfAccount = ledger?.headOfAccountId
          ? await HeadOfAccount.findOne({ _id: ledger.headOfAccountId })
              .select("headOfAccountName")
              .lean()
          : null;

        const bsplLedger = ledger?.bSPLLedgerId
          ? await BSPLLedger.findOne({ _id: ledger.bSPLLedgerId })
              .select("bSPLLedgerName")
              .lean()
          : null;

        itemsWithLedgerNames.push({
          itemName: item.itemName || null,
          amountBeforeGST: item.amountBeforeGST || 0,
          GSTAmount: item.GSTAmount || 0,
          amountAfterGST: item.amountAfterGST || 0,

          ledgerId: item.ledgerId || null,
          ledgerName: ledger?.ledgerName || null,
          openingBalance: ledger?.openingBalance || null,

          groupLedgerId: ledger?.groupLedgerId || null,
          groupLedgerName: groupLedger?.groupLedgerName || null,

          headOfAccountId: ledger?.headOfAccountId || null,
          headOfAccountName: headOfAccount?.headOfAccountName || null,

          bSPLLedgerId: ledger?.bSPLLedgerId || null,
          bSPLLedgerName: bsplLedger?.bSPLLedgerName || null,
        });
      }

      const ledgerWithPaymentMode =
        entry.ledgerIdWithPaymentMode &&
        mongoose.Types.ObjectId.isValid(entry.ledgerIdWithPaymentMode)
          ? await Ledger.findById(entry.ledgerIdWithPaymentMode)
              .select(
                "ledgerName groupLedgerId headOfAccountId bSPLLedgerId openingBalance"
              )
              .lean()
          : null;

      let groupLedgerWithPaymentMode = null;
      if (ledgerWithPaymentMode?.groupLedgerId) {
        groupLedgerWithPaymentMode = await GroupLedger.findOne({
          _id: ledgerWithPaymentMode.groupLedgerId,
          schoolId,
        })
          .select("groupLedgerName")
          .lean();
      }

      const headOfAccountWithPaymentMode =
        ledgerWithPaymentMode?.headOfAccountId
          ? await HeadOfAccount.findOne({
              _id: ledgerWithPaymentMode.headOfAccountId,
            })
              .select("headOfAccountName")
              .lean()
          : null;

      const bsplLedgerWithPaymentMode = ledgerWithPaymentMode?.bSPLLedgerId
        ? await BSPLLedger.findOne({
            _id: ledgerWithPaymentMode.bSPLLedgerId,
          })
            .select("bSPLLedgerName")
            .lean()
        : null;

      let TDSorTCSGroupLedgerName = null;
      let TDSorTCSLedgerName = null;
      let TDSorTCSHeadOfAccountName = null;
      let TDSorTCSBSPLLedgerName = null;
      let TDSorTCSOpeningBalance = null;

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
            .select("ledgerName headOfAccountId bSPLLedgerId openingBalance")
            .lean();

          if (tdsOrTcsLedger) {
            TDSorTCSLedgerName = tdsOrTcsLedger.ledgerName;
            TDSorTCSOpeningBalance = tdsOrTcsLedger.openingBalance || null;

            // Get headOfAccountName
            const headOfAccount = tdsOrTcsLedger.headOfAccountId
              ? await HeadOfAccount.findOne({
                  _id: tdsOrTcsLedger.headOfAccountId,
                })
                  .select("headOfAccountName")
                  .lean()
              : null;

            // Get bSPLLedgerName
            const bsplLedger = tdsOrTcsLedger.bSPLLedgerId
              ? await BSPLLedger.findOne({ _id: tdsOrTcsLedger.bSPLLedgerId })
                  .select("bSPLLedgerName")
                  .lean()
              : null;

            TDSorTCSHeadOfAccountName =
              headOfAccount?.headOfAccountName || null;
            TDSorTCSBSPLLedgerName = bsplLedger?.bSPLLedgerName || null;
          }
        }
      }

      const entryData = {
        // PaymentEntry fields
        accountingEntry: "Payment",
        _id: entry._id,
        schoolId: entry.schoolId,
        subTotalAmountAfterGST: entry.subTotalAmountAfterGST,
        TDSTCSRateWithAmountBeforeGST: entry.TDSTCSRateWithAmountBeforeGST || 0,
        totalAmountAfterGST: entry.totalAmountAfterGST || 0,
        ledgerIdWithPaymentMode: entry.ledgerIdWithPaymentMode || null,
        ledgerNameWithPaymentMode: ledgerWithPaymentMode?.ledgerName || null,
        openingBalanceWithPaymentMode:
          ledgerWithPaymentMode?.openingBalance || null,

        groupLedgerIdWithPaymentMode:
          ledgerWithPaymentMode?.groupLedgerId || null,
        groupLedgerNameWithPaymentMode:
          groupLedgerWithPaymentMode?.groupLedgerName || null,

        headOfAccountIdWithPaymentMode:
          ledgerWithPaymentMode?.headOfAccountId || null,
        headOfAccountNameWithPaymentMode:
          headOfAccountWithPaymentMode?.headOfAccountName || null,

        bSPLLedgerIdWithPaymentMode:
          ledgerWithPaymentMode?.bSPLLedgerId || null,
        bSPLLedgerNameWithPaymentMode:
          bsplLedgerWithPaymentMode?.bSPLLedgerName || null,

        TDSorTCS: entry.TDSorTCS || null,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        TDSorTCSGroupLedgerName,
        TDSorTCSLedgerName,
        TDSorTCSHeadOfAccountName,
        TDSorTCSBSPLLedgerName,
        TDSorTCSOpeningBalance: TDSorTCSOpeningBalance || null,

        // Item details
        itemDetails: itemsWithLedgerNames,

        entryDate: entry.entryDate,
        academicYear: entry.academicYear,
      };

      formattedData.push(entryData);
    }

    // For Receipt Entries // Find Receipt Entries

    for (const entry of receiptEntries) {
      const itemsWithLedgerNames = [];

      for (const item of entry.itemDetails) {
        let ledger = null;
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          ledger = await Ledger.findOne({
            _id: item.ledgerId,
            schoolId,
          })
            .select(
              "ledgerName groupLedgerId headOfAccountId bSPLLedgerId openingBalance"
            )
            .lean();
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

        const headOfAccount = ledger?.headOfAccountId
          ? await HeadOfAccount.findOne({ _id: ledger.headOfAccountId })
              .select("headOfAccountName")
              .lean()
          : null;

        const bsplLedger = ledger?.bSPLLedgerId
          ? await BSPLLedger.findOne({ _id: ledger.bSPLLedgerId })
              .select("bSPLLedgerName")
              .lean()
          : null;

        itemsWithLedgerNames.push({
          itemName: item.itemName,
          amount: item.amount || 0,

          ledgerId: item.ledgerId || null,
          ledgerName: ledger?.ledgerName || null,
          openingBalance: ledger?.openingBalance || null,

          groupLedgerId: ledger?.groupLedgerId || null,
          groupLedgerName: groupLedger?.groupLedgerName || null,

          headOfAccountId: ledger?.headOfAccountId || null,
          headOfAccountName: headOfAccount?.headOfAccountName || null,

          bSPLLedgerId: ledger?.bSPLLedgerId || null,
          bSPLLedgerName: bsplLedger?.bSPLLedgerName || null,
        });
      }

      const ledgerWithPaymentMode =
        entry.ledgerIdWithPaymentMode &&
        mongoose.Types.ObjectId.isValid(entry.ledgerIdWithPaymentMode)
          ? await Ledger.findById(entry.ledgerIdWithPaymentMode)
              .select(
                "ledgerName groupLedgerId headOfAccountId bSPLLedgerId openingBalance"
              )
              .lean()
          : null;

      let groupLedgerWithPaymentMode = null;
      if (ledgerWithPaymentMode?.groupLedgerId) {
        groupLedgerWithPaymentMode = await GroupLedger.findOne({
          _id: ledgerWithPaymentMode.groupLedgerId,
          schoolId,
        })
          .select("groupLedgerName")
          .lean();
      }

      const headOfAccountWithPaymentMode =
        ledgerWithPaymentMode?.headOfAccountId
          ? await HeadOfAccount.findOne({
              _id: ledgerWithPaymentMode.headOfAccountId,
            })
              .select("headOfAccountName")
              .lean()
          : null;

      const bsplLedgerWithPaymentMode = ledgerWithPaymentMode?.bSPLLedgerId
        ? await BSPLLedger.findOne({
            _id: ledgerWithPaymentMode.bSPLLedgerId,
          })
            .select("bSPLLedgerName")
            .lean()
        : null;

      let TDSorTCSGroupLedgerName = null;
      let TDSorTCSLedgerName = null;
      let TDSorTCSHeadOfAccountName = null;
      let TDSorTCSBSPLLedgerName = null;
      let TDSorTCSOpeningBalance = null;

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
            .select("ledgerName headOfAccountId bSPLLedgerId openingBalance")
            .lean();

          if (tdsOrTcsLedger) {
            TDSorTCSLedgerName = tdsOrTcsLedger.ledgerName;
            TDSorTCSOpeningBalance = tdsOrTcsLedger.openingBalance || null;

            const headOfAccount = tdsOrTcsLedger.headOfAccountId
              ? await HeadOfAccount.findOne({
                  _id: tdsOrTcsLedger.headOfAccountId,
                })
                  .select("headOfAccountName")
                  .lean()
              : null;

            // Get bSPLLedgerName
            const bsplLedger = tdsOrTcsLedger.bSPLLedgerId
              ? await BSPLLedger.findOne({ _id: tdsOrTcsLedger.bSPLLedgerId })
                  .select("bSPLLedgerName")
                  .lean()
              : null;

            TDSorTCSHeadOfAccountName =
              headOfAccount?.headOfAccountName || null;
            TDSorTCSBSPLLedgerName = bsplLedger?.bSPLLedgerName || null;
          }
        }
      }

      const entryData = {
        // PaymentEntry fields
        accountingEntry: "Receipt",
        _id: entry._id,
        schoolId: entry.schoolId,
        subTotalAmount: entry.subTotalAmount || 0,
        totalAmount: entry.totalAmount,

        TDSTCSRateWithAmount: entry.TDSTCSRateWithAmount || 0,

        ledgerIdWithPaymentMode: entry.ledgerIdWithPaymentMode || null,
        ledgerNameWithPaymentMode: ledgerWithPaymentMode?.ledgerName || null,
        openingBalanceWithPaymentMode:
          ledgerWithPaymentMode?.openingBalance || null,

        groupLedgerIdWithPaymentMode:
          ledgerWithPaymentMode?.groupLedgerId || null,
        groupLedgerNameWithPaymentMode:
          groupLedgerWithPaymentMode?.groupLedgerName || null,

        headOfAccountIdWithPaymentMode:
          ledgerWithPaymentMode?.headOfAccountId || null,
        headOfAccountNameWithPaymentMode:
          headOfAccountWithPaymentMode?.headOfAccountName || null,

        bSPLLedgerIdWithPaymentMode:
          ledgerWithPaymentMode?.bSPLLedgerId || null,
        bSPLLedgerNameWithPaymentMode:
          bsplLedgerWithPaymentMode?.bSPLLedgerName || null,

        TDSorTCS: entry.TDSorTCS || null,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        TDSorTCSGroupLedgerName,
        TDSorTCSLedgerName,
        TDSorTCSHeadOfAccountName,
        TDSorTCSBSPLLedgerName,
        TDSorTCSOpeningBalance: TDSorTCSOpeningBalance || null,

        // Item details
        itemDetails: itemsWithLedgerNames,

        entryDate: entry.entryDate,
        academicYear: entry.academicYear,
      };

      formattedData.push(entryData);
    }

    // Find Contra Entries

    for (const entry of contraEntries) {
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
        .select("ledgerName groupLedgerId")
        .lean();

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
        subTotalOfDebit: entry.subTotalOfDebit || 0,
        subTotalOfCredit: entry.subTotalOfCredit || 0,
        totalAmountOfCredit: entry.totalAmountOfCredit || 0,
        totalAmountOfDebit: entry.totalAmountOfDebit || 0,
        TDSTCSRateAmount: entry.TDSTCSRateAmount || 0,
        contraVoucherNumber: entry.contraVoucherNumber || null,
        TDSorTCS: entry.TDSorTCS || null,
        status: entry.status,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        TDSorTCSGroupLedgerName,
        TDSorTCSLedgerName,
        itemDetails: itemsWithLedgerNames,

        entryDate: entry.entryDate,
        academicYear: entry.academicYear,
      };

      formattedData.push(entryData);
    }

    // Find Journal Entries

    for (const entry of journalEntries) {
      const itemsWithLedgerNames = [];

      for (const item of entry.itemDetails) {
        let ledger = null;
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          ledger = await Ledger.findOne({
            _id: item.ledgerId,
            schoolId,
          })
            .select("ledgerName groupLedgerId")
            .lean();
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
          debitAmount: item.debitAmount || 0,
          creditAmount: item.creditAmount || 0,
          ledgerName: ledger?.ledgerName || null,
          groupLedgerId: ledger?.groupLedgerId || null,
          groupLedgerName: groupLedger?.groupLedgerName || null,
        });
      }

      const entryData = {
        accountingEntry: "Journal",
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        documentDate: entry.documentDate,
        narration: entry.narration,
        subTotalOfDebit: entry.subTotalOfDebit || 0,
        totalAmountOfDebit: entry.totalAmountOfDebit || 0,
        totalAmountOfCredit: entry.totalAmountOfCredit || 0,
        journalVoucherNumber: entry.journalVoucherNumber || null,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        // Item details
        itemDetails: itemsWithLedgerNames,

        entryDate: entry.entryDate,
        academicYear: entry.academicYear,
      };

      formattedData.push(entryData);
    }

    return res.status(200).json({
      hasError: false,
      message: "Entries fetched successfully",
      data: formattedData,
    });
  } catch (error) {
    console.error("Error fetching Entries:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllBySchoolId;
