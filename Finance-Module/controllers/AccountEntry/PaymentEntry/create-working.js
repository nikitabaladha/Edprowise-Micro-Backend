import mongoose from "mongoose";
import moment from "moment";
import PaymentEntry from "../../../models/PaymentEntry.js";
import PaymentEntryValidator from "../../../validators/PaymentEntryValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js"; // Import GroupLedger model

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
  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  });

  let openingBalance = 0;
  let balanceType = "Debit";

  if (ledger) {
    balanceType = ledger.balanceType;
    openingBalance = ledger.openingBalance || 0;
  }

  let record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  });

  if (!record) {
    record = new OpeningClosingBalance({
      schoolId,
      academicYear,
      ledgerId,
      balanceDetails: [],
      balanceType,
    });
  }

  const previousBalanceDetails = record.balanceDetails
    .filter((detail) => new Date(detail.entryDate) < new Date(entryDate))
    .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

  if (previousBalanceDetails.length > 0) {
    const lastBalanceDetail = previousBalanceDetails[0];
    openingBalance = lastBalanceDetail.closingBalance;
  }

  return { record, openingBalance, balanceType };
}

// ✅ FIXED: Handles chaining of multiple entries on the same date
async function updateOpeningClosingBalance(
  schoolId,
  academicYear,
  ledgerId,
  entryDate,
  paymentEntryId,
  debitAmount = 0,
  creditAmount = 0
) {
  debitAmount = Number(debitAmount);
  creditAmount = Number(creditAmount);

  const { record, openingBalance, balanceType } =
    await getOrCreateOpeningBalanceRecord(
      schoolId,
      academicYear,
      ledgerId,
      entryDate
    );

  // --- FIX: Determine effective opening balance ---
  const previousBalanceDetails = record.balanceDetails
    .filter((detail) => new Date(detail.entryDate) <= new Date(entryDate))
    .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

  let effectiveOpeningBalance = openingBalance;
  if (previousBalanceDetails.length > 0) {
    effectiveOpeningBalance = previousBalanceDetails[0].closingBalance;
  }

  // --- Calculate closing balance ---
  let closingBalance;
  if (balanceType === "Debit") {
    closingBalance = effectiveOpeningBalance + debitAmount - creditAmount;
  } else {
    closingBalance = effectiveOpeningBalance + creditAmount - debitAmount;
  }

  // --- Check if exact same entry already exists ---
  const existingEntryIndex = record.balanceDetails.findIndex(
    (detail) =>
      new Date(detail.entryDate).getTime() === new Date(entryDate).getTime() &&
      detail.entryId?.toString() === paymentEntryId.toString()
  );

  if (existingEntryIndex !== -1) {
    record.balanceDetails[existingEntryIndex] = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: paymentEntryId,
    };
  } else {
    const newBalanceDetail = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: paymentEntryId,
    };

    record.balanceDetails.push(newBalanceDetail);
  }

  // Sort by date (and then by _id to ensure chaining order within same day)
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    return dateDiff !== 0
      ? dateDiff
      : a._id.toString().localeCompare(b._id.toString());
  });

  await record.save();
  return record;
}

// ✅ FIXED: Recalculate respects same-day chaining
async function recalculateLedgerBalances(schoolId, academicYear, ledgerId) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  });

  if (!record || record.balanceDetails.length === 0) {
    return;
  }

  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  });

  const balanceType = ledger?.balanceType || "Debit";

  // Sort all entries by date, then by _id for consistent same-day order
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    return dateDiff !== 0
      ? dateDiff
      : a._id.toString().localeCompare(b._id.toString());
  });

  let currentBalance = record.balanceDetails[0].openingBalance;

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];

    if (i === 0) {
      currentBalance = detail.openingBalance;
    } else {
      detail.openingBalance = record.balanceDetails[i - 1].closingBalance;
      currentBalance = detail.openingBalance;
    }

    if (balanceType === "Debit") {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    } else {
      detail.closingBalance = currentBalance + detail.credit - detail.debit;
    }

    currentBalance = detail.closingBalance;
  }

  await record.save();
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
      return res.status(400).json({ hasError: true, message: errorMessages });
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

    // 1. Item Ledgers (Debit)
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

    // 2. TDS/TCS Ledger (Credit) - FIXED
    if (TDSorTCS && TDSTCSRateWithAmountBeforeGST > 0) {
      // First try exact match (case insensitive)
      let tdsTcsGroupLedger = await GroupLedger.findOne({
        schoolId,
        academicYear,
        groupLedgerName: { $regex: new RegExp(`^${TDSorTCS}$`, "i") },
      });

      // If not found, try partial match
      if (!tdsTcsGroupLedger) {
        tdsTcsGroupLedger = await GroupLedger.findOne({
          schoolId,
          academicYear,
          groupLedgerName: { $regex: new RegExp(TDSorTCS, "i") },
        });
      }

      if (!tdsTcsGroupLedger) {
        throw new Error(
          `${TDSorTCS} GroupLedger not found for school ${schoolId} and academic year ${academicYear}`
        );
      }

      // Find the ledger with exact match first
      let tdsLedgerToUpdate = await Ledger.findOne({
        schoolId,
        academicYear,
        groupLedgerId: tdsTcsGroupLedger._id,
        ledgerName: { $regex: new RegExp(`^${TDSorTCS}$`, "i") },
      });

      // If not found, get any ledger in this group
      if (!tdsLedgerToUpdate) {
        tdsLedgerToUpdate = await Ledger.findOne({
          schoolId,
          academicYear,
          groupLedgerId: tdsTcsGroupLedger._id,
        });
      }

      if (!tdsLedgerToUpdate) {
        throw new Error(
          `${TDSorTCS} Ledger not found for GroupLedger ID ${tdsTcsGroupLedger._id}, school ${schoolId} and academic year ${academicYear}`
        );
      }

      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        tdsLedgerToUpdate._id,
        entryDate,
        newPaymentEntry._id,
        0,
        Number(TDSTCSRateWithAmountBeforeGST)
      );
    }

    // 3. Payment Mode Ledger (Credit)
    const paymentAmount = TDSorTCS
      ? subTotalAmountAfterGST - TDSTCSRateWithAmountBeforeGST
      : subTotalAmountAfterGST;

    await updateOpeningClosingBalance(
      schoolId,
      academicYear,
      ledgerIdWithPaymentMode,
      entryDate,
      newPaymentEntry._id,
      0,
      paymentAmount
    );

    // --- Recalculate all ledgers ---
    for (const item of updatedItemDetails) {
      await recalculateLedgerBalances(schoolId, academicYear, item.ledgerId);
    }

    // Recalculate TDS/TCS ledger if applicable
    if (TDSorTCS && TDSTCSRateWithAmountBeforeGST > 0) {
      let tdsTcsGroupLedger = await GroupLedger.findOne({
        schoolId,
        academicYear,
        groupLedgerName: { $regex: new RegExp(`^${TDSorTCS}$`, "i") },
      });

      if (!tdsTcsGroupLedger) {
        tdsTcsGroupLedger = await GroupLedger.findOne({
          schoolId,
          academicYear,
          groupLedgerName: { $regex: new RegExp(TDSorTCS, "i") },
        });
      }

      if (tdsTcsGroupLedger) {
        let tdsTcsLedger = await Ledger.findOne({
          schoolId,
          academicYear,
          groupLedgerId: tdsTcsGroupLedger._id,
          ledgerName: { $regex: new RegExp(`^${TDSorTCS}$`, "i") },
        });

        if (!tdsTcsLedger) {
          tdsTcsLedger = await Ledger.findOne({
            schoolId,
            academicYear,
            groupLedgerId: tdsTcsGroupLedger._id,
          });
        }

        if (tdsTcsLedger) {
          await recalculateLedgerBalances(
            schoolId,
            academicYear,
            tdsTcsLedger._id
          );
        }
      }
    }

    await recalculateLedgerBalances(
      schoolId,
      academicYear,
      ledgerIdWithPaymentMode
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
