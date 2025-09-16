import mongoose from "mongoose";
import moment from "moment";
import PaymentEntry from "../../../models/PaymentEntry.js";
import PaymentEntryValidator from "../../../validators/PaymentEntryValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";

async function generatePaymentVoucherNumber(schoolId, academicYear) {
  const count = await PaymentEntry.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `PVN/${academicYear}/${nextNumber}`;
}

async function generateTransactionNumber() {
  const now = moment();
  const dateTimeStr = now.format("DDMMYYYYHHmmss");
  let baseTransactionNumber = `TRA-${dateTimeStr}`;
  let transactionNumber = baseTransactionNumber;
  let counter = 1;

  while (await PaymentEntry.exists({ transactionNumber })) {
    const suffix = String(counter).padStart(2, "0");
    transactionNumber = `${baseTransactionNumber}${suffix}`;
    counter++;
  }

  return transactionNumber;
}

async function getOrCreateOpeningBalanceRecord(
  schoolId,
  academicYear,
  ledgerId,
  entryDate
) {
  // First, get the ledger to always have the correct balanceType
  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  });

  let openingBalance = 0;
  let balanceType = "Debit";

  // If ledger exists, use its balanceType
  if (ledger) {
    balanceType = ledger.balanceType;
  }

  // Check if a record already exists for this date
  let record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
    entryDate,
  });

  // If record exists, use the last closing balance as opening balance
  if (record && record.balanceDetails.length > 0) {
    const lastBalanceDetail =
      record.balanceDetails[record.balanceDetails.length - 1];
    openingBalance = lastBalanceDetail.closingBalance;
  } else {
    // If no record for this date, find the most recent balance record before the current entry date
    const previousRecord = await OpeningClosingBalance.findOne({
      schoolId,
      academicYear,
      ledgerId,
      entryDate: { $lt: entryDate },
    }).sort({ entryDate: -1 });

    // If there's a previous record, use its closing balance as opening
    if (previousRecord) {
      const lastBalanceDetail =
        previousRecord.balanceDetails[previousRecord.balanceDetails.length - 1];
      openingBalance = lastBalanceDetail.closingBalance;
    } else if (ledger) {
      // If no previous record, get the opening balance from the Ledger table
      openingBalance = ledger.openingBalance || 0;
    }

    // If record doesn't exist, create a new one
    if (!record) {
      record = new OpeningClosingBalance({
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        balanceDetails: [],
        balanceType, // Use the balanceType from the ledger
      });
    }
  }

  return { record, openingBalance, balanceType };
}

// Helper function to update opening/closing balance

async function updateOpeningClosingBalance(
  schoolId,
  academicYear,
  ledgerId,
  entryDate,
  paymentEntryId,
  debitAmount = 0,
  creditAmount = 0
) {
  // Convert amounts to numbers to avoid string concatenation issues
  debitAmount = Number(debitAmount);
  creditAmount = Number(creditAmount);

  const { record, openingBalance, balanceType } =
    await getOrCreateOpeningBalanceRecord(
      schoolId,
      academicYear,
      ledgerId,
      entryDate
    );

  // Add debug logging
  console.log("Updating balance for ledger:", {
    ledgerId,
    balanceType,
    openingBalance,
    debitAmount,
    creditAmount,
    debitAmountType: typeof debitAmount,
    creditAmountType: typeof creditAmount,
  });

  // Calculate closing balance based on balance type
  let closingBalance;
  if (balanceType === "Debit") {
    closingBalance = openingBalance + debitAmount - creditAmount;
  } else {
    closingBalance = openingBalance + creditAmount - debitAmount;
  }

  console.log("Calculated closing balance:", closingBalance);

  // Add new balance detail
  record.balanceDetails.push({
    openingBalance,
    debit: debitAmount,
    credit: creditAmount,
    closingBalance,
    entryId: paymentEntryId,
  });

  await record.save();
  return record;
}

async function create(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    const { error } = PaymentEntryValidator.PaymentEntryValidator.validate(
      req.body
    );
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    const {
      vendorCode,
      vendorId,
      entryDate,
      invoiceDate,
      invoiceNumber,
      poNumber,
      dueDate,
      narration,
      paymentMode,
      chequeNumber,
      itemDetails,
      TDSorTCS,
      TDSTCSRateChartId,
      TDSTCSRate,
      status,
      totalAmountAfterGST,
      TDSTCSRateWithAmountBeforeGST,
      ledgerIdWithPaymentMode,
      academicYear,
    } = req.body;

    const paymentVoucherNumber = await generatePaymentVoucherNumber(
      schoolId,
      academicYear
    );

    const { invoiceImage, chequeImage } = req.files || {};

    const invoiceImageFullPath = invoiceImage?.[0]
      ? `${
          invoiceImage[0].mimetype.startsWith("image/")
            ? "/Images/FinanceModule/InvoiceImage"
            : "/Documents/FinanceModule/InvoiceImage"
        }/${invoiceImage[0].filename}`
      : null;

    const chequeImageFullPath = chequeImage?.[0]
      ? `${
          chequeImage[0].mimetype.startsWith("image/")
            ? "/Images/FinanceModule/ChequeImage"
            : "/Documents/FinanceModule/ChequeImage"
        }/${chequeImage[0].filename}`
      : null;

    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      amountBeforeGST: parseFloat(item.amountBeforeGST) || 0,
      GSTAmount: parseFloat(item.GSTAmount) || 0,
      amountAfterGST:
        (parseFloat(item.amountBeforeGST) || 0) +
        (parseFloat(item.GSTAmount) || 0),
    }));

    const totalAmountBeforeGST = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.amountBeforeGST) || 0),
      0
    );

    const totalGSTAmount = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.GSTAmount) || 0),
      0
    );

    const subTotalAmountAfterGST = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.amountAfterGST) || 0),
      0
    );

    const transactionNumber =
      paymentMode === "Online" ? await generateTransactionNumber() : null;

    const newPaymentEntry = new PaymentEntry({
      schoolId,
      paymentVoucherNumber,
      vendorCode,
      vendorId,
      entryDate,
      invoiceDate,
      invoiceNumber,
      poNumber,
      dueDate,
      narration,
      paymentMode,
      chequeNumber,
      transactionNumber,
      itemDetails: updatedItemDetails,
      subTotalAmountAfterGST,
      TDSorTCS,
      TDSTCSRateChartId,
      TDSTCSRate,
      TDSTCSRateWithAmountBeforeGST,
      totalAmountBeforeGST,
      totalGSTAmount,
      totalAmountAfterGST,
      invoiceImage: invoiceImageFullPath,
      chequeImage: chequeImageFullPath,
      ledgerIdWithPaymentMode,
      status,
      academicYear,
    });

    await newPaymentEntry.save({ session });

    // Update OpeningClosingBalance for each ledger involved in the transaction

    // 1. Update for each item ledger (debit)
    for (const item of updatedItemDetails) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        item.ledgerId,
        entryDate,
        newPaymentEntry._id,
        item.amountAfterGST,
        0
      );
    }

    if (TDSorTCS && TDSTCSRateWithAmountBeforeGST > 0) {
      // First, find the GroupLedger with exact TDS/TCS name (more specific search)
      const GroupLedger = mongoose.model("GroupLedger");

      // Try to find exact match first, then fallback to partial match
      let tdsTcsGroupLedger = await GroupLedger.findOne({
        schoolId,
        academicYear,
        groupLedgerName: { $regex: `^${TDSorTCS}$`, $options: "i" }, // Exact match
      });

      const allTDSGroupLedgers = await GroupLedger.find({
        schoolId: "SID144732",
        academicYear: "2025-2026",
        groupLedgerName: { $regex: "TDS", $options: "i" },
      });
      console.log("All TDS GroupLedgers:", allTDSGroupLedgers);

      console.log("All TDS GroupLedgers:", allTDSGroupLedgers);

      // If exact match not found, try partial match
      if (!tdsTcsGroupLedger) {
        tdsTcsGroupLedger = await GroupLedger.findOne({
          schoolId,
          academicYear,
          groupLedgerName: { $regex: TDSorTCS, $options: "i" }, // Partial match
        });
      }

      if (!tdsTcsGroupLedger) {
        throw new Error(
          `${TDSorTCS} GroupLedger not found for school ${schoolId} and academic year ${academicYear}`
        );
      }

      console.log("Found GroupLedger:", {
        id: tdsTcsGroupLedger._id,
        name: tdsTcsGroupLedger.groupLedgerName,
      });

      // Now find the Ledger that has this GroupLedger ID and contains TDS/TCS in its name
      const tdsTcsLedger = await Ledger.findOne({
        schoolId,
        academicYear,
        groupLedgerId: tdsTcsGroupLedger._id,
        ledgerName: { $regex: TDSorTCS, $options: "i" }, // ADDED: Also check ledger name contains TDS/TCS
      });

      if (!tdsTcsLedger) {
        // If not found with name filter, try without name filter as fallback
        const fallbackLedger = await Ledger.findOne({
          schoolId,
          academicYear,
          groupLedgerId: tdsTcsGroupLedger._id,
        });

        if (!fallbackLedger) {
          throw new Error(
            `${TDSorTCS} Ledger not found for GroupLedger ID ${tdsTcsGroupLedger._id}, school ${schoolId} and academic year ${academicYear}`
          );
        }

        console.warn(`Using fallback ledger (no TDS/TCS in name):`, {
          id: fallbackLedger._id,
          name: fallbackLedger.ledgerName,
        });

        // Add debug logging to see what ledger is found
        console.log("Found TDS/TCS Ledger:", {
          id: fallbackLedger._id,
          name: fallbackLedger.ledgerName,
          balanceType: fallbackLedger.balanceType,
          openingBalance: fallbackLedger.openingBalance,
        });

        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          fallbackLedger._id,
          entryDate,
          newPaymentEntry._id,
          0, // debit amount
          Number(TDSTCSRateWithAmountBeforeGST) // credit amount
        );
      } else {
        // Add debug logging to see what ledger is found
        console.log("Found TDS/TCS Ledger:", {
          id: tdsTcsLedger._id,
          name: tdsTcsLedger.ledgerName,
          balanceType: tdsTcsLedger.balanceType,
          openingBalance: tdsTcsLedger.openingBalance,
        });

        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          tdsTcsLedger._id,
          entryDate,
          newPaymentEntry._id,
          0, // debit amount
          Number(TDSTCSRateWithAmountBeforeGST) // credit amount
        );
      }
    }
    // 3. Update for payment mode ledger (credit)
    const paymentAmount = TDSorTCS
      ? subTotalAmountAfterGST - TDSTCSRateWithAmountBeforeGST
      : subTotalAmountAfterGST;

    await updateOpeningClosingBalance(
      schoolId,
      academicYear,
      ledgerIdWithPaymentMode,
      entryDate,
      newPaymentEntry._id,
      0, // debit amount
      paymentAmount // credit amount
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      hasError: false,
      message: "Payment Entry created successfully!",
      data: newPaymentEntry,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Payment Entry already exists.`,
      });
    }

    console.error("Error creating Payment Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
