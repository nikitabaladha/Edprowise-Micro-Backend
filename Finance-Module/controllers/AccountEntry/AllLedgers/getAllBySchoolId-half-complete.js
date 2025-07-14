import PaymentEntry from "../../../models/PaymentEntry.js";
import Receipt from "../../../models/Receipt.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";

async function getAllBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    const paymentEntries = await PaymentEntry.find({ schoolId, academicYear })
      .sort({ createdAt: -1 })
      .lean();

    const receiptEntries = await Receipt.find({ schoolId, academicYear })
      .sort({ createdAt: -1 })
      .lean();

    const formattedData = [];

    for (const entry of paymentEntries) {
      const itemsWithLedgerNames = [];

      for (const item of entry.itemDetails) {
        const ledger = await Ledger.findOne({
          _id: item.ledgerId,
          schoolId,
        })
          .select("ledgerName groupLedgerId")
          .lean();

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
          ledgerId: item.ledgerId,
          ledgerName: ledger?.ledgerName || null,
          groupLedgerId: ledger?.groupLedgerId || null,
          groupLedgerName: groupLedger?.groupLedgerName || null,
        });
      }

      const entryData = {
        accountingEntry: "Payment",
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        invoiceDate: entry.invoiceDate,
        narration: entry.narration,
        transactionNumber: entry.transactionNumber || null,
        paymentVoucherNumber: entry.paymentVoucherNumber || null,
        itemDetails: itemsWithLedgerNames,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      };

      formattedData.push(entryData);
    }

    // for (const entry of receiptEntries) {
    //   const itemsWithLedgerNames = [];

    //   for (const item of entry.itemDetails) {
    //     const ledger = await Ledger.findOne({
    //       _id: item.ledgerId,
    //       schoolId,
    //     })
    //       .select("ledgerName groupLedgerId")
    //       .lean();

    //     let groupLedger = null;
    //     if (ledger?.groupLedgerId) {
    //       groupLedger = await GroupLedger.findOne({
    //         _id: ledger.groupLedgerId,
    //         schoolId,
    //       })
    //         .select("groupLedgerName")
    //         .lean();
    //     }

    //     itemsWithLedgerNames.push({
    //       ledgerId: item.ledgerId,
    //       ledgerName: ledger?.ledgerName || null,
    //       groupLedgerId: ledger?.groupLedgerId || null,
    //       groupLedgerName: groupLedger?.groupLedgerName || null,
    //     });
    //   }

    //   const entryData = {
    //     accountingEntry: "Receipt",
    //     _id: entry._id,
    //     schoolId: entry.schoolId,
    //     entryDate: entry.entryDate,
    //     receiptDate: entry.receiptDate || null,
    //     narration: entry.narration,
    //     transactionNumber: entry.transactionNumber || null,
    //     receiptVoucherNumber: entry.receiptVoucherNumber || null,
    //     itemDetails: itemsWithLedgerNames,
    //     createdAt: entry.createdAt,
    //     updatedAt: entry.updatedAt,
    //   };

    //   formattedData.push(entryData);
    // }

    return res.status(200).json({
      hasError: false,
      message: "Payment and Receipt entries fetched successfully.",
      data: formattedData,
    });
  } catch (error) {
    console.error("Error fetching entries:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllBySchoolId;
