// /Users/nikita/Desktop/EDPROWISE_Nikita_FINAL/Edprowise_Backend/Edprowise-Micro-Backend/Finance-Module/controllers/Inter-Service-Communication/addRegistartionPaymentInFinance.js

import mongoose from "mongoose";
import Receipt from "../../models/Receipt.js";
import Ledger from "../../models/Ledger.js";

// here i want that as soon as entry occur in Registration Paymnet Table or Admission Paymnet Table or TC payment
// i want that

//for example if Registration Payment entry 1

// entryDate             05-11-2025
// Registration Fee      1000
// Payment mide Cash

// then in Receipt table
// i wnat to store

// _id
// 690b383b9ad65252bee363e3
// schoolId
// "SID144732"
// financialYear
// "2025-2026"
// receiptVoucherNumber
// "RVN/2025-2026/1"
// customizeEntry
// true
// entryDate
// 2025-11-05T00:00:00.000+00:00
// receiptDate
// 2025-11-05T00:00:00.000+00:00
// narration
// "Test"
// itemDetails
// Array (2)
// 0
// Object
// itemName
// ""
// ledgerId.  (example : it is from Registration Fee)
// "690b3375fd990fcc0f997768"
// amount
// 1000
// debitAmount
// 0
// _id
// 690b383b9ad65252bee363e4
// 1
// Object
// itemName
// ""
// ledgerId.  (example : it is from Payment Mode  Cash)
// "690b3375fd990fcc0f997764"
// amount
// 0
// debitAmount
// 1000
// _id
// 690b383b9ad65252bee363e5
// subTotalAmount
// 1000
// subTotalOfDebit
// 1000
// totalAmount
// 1000
// totalDebitAmount
// 1000
// receiptImage
// null
// status
// "Posted"
// approvalStatus
// "Pending"
// sourceModule
// "Fees"
// createdAt
// 2025-11-05T11:42:51.708+00:00
// updatedAt
// 2025-11-05T11:42:51.708+00:00
// __v

//for example if Registration Payment entry 2
// now for example if another entry for Registration Fees and on same date 05-11-2025 and pament mode is also Cash
// then in same entry you need to update like

// _id
// 690b383b9ad65252bee363e3
// schoolId
// "SID144732"
// financialYear
// "2025-2026"
// receiptVoucherNumber
// "RVN/2025-2026/1"
// customizeEntry
// true
// entryDate
// 2025-11-05T00:00:00.000+00:00
// receiptDate
// 2025-11-05T00:00:00.000+00:00
// narration
// "Test"
// itemDetails
// Array (2)
// 0
// Object
// itemName
// ""
// ledgerId.  (example : it is from Registration Fee)
// "690b3375fd990fcc0f997768"
// amount
// 2000
// debitAmount
// 0
// _id
// 690b383b9ad65252bee363e4
// 1
// Object
// itemName
// ""
// ledgerId.  (example : it is from Payment Mode  Cash)
// "690b3375fd990fcc0f997764"
// amount
// 0
// debitAmount
// 2000
// _id
// 690b383b9ad65252bee363e5
// subTotalAmount
// 2000
// subTotalOfDebit
// 2000
// totalAmount
// 2000
// totalDebitAmount
// 2000
// receiptImage
// null
// status
// "Posted"
// approvalStatus
// "Pending"
// sourceModule
// "Fees"
// createdAt
// 2025-11-05T11:42:51.708+00:00
// updatedAt
// 2025-11-05T11:42:51.708+00:00
// __v

//for example if Registration Payment entry 3
//now for example if another entry for Registration Fees and on same date 05-11-2025 and pament mode is Online Then
//then you need to create new Receipt entry like

// _id
// 690b383b9ad65252bee363e4
// schoolId
// "SID144732"
// financialYear
// "2025-2026"
// receiptVoucherNumber
// "RVN/2025-2026/2"
// customizeEntry
// true
// entryDate
// 2025-11-05T00:00:00.000+00:00
// receiptDate
// 2025-11-05T00:00:00.000+00:00
// narration
// "Test"
// itemDetails
// Array (2)
// 0
// Object
// itemName
// ""
// ledgerId.  (example : it is from Registration Fee)
// "690b3375fd990fcc0f997768"
// amount
// 1000
// debitAmount
// 0
// _id
// 690b383b9ad65252bee363e5
// 1
// Object
// itemName
// ""
// ledgerId.  (example : it is from Payment Mode  Online)
// "690b3375fd990fcc0f997764"
// amount
// 0
// debitAmount
// 1000
// _id
// 690b383b9ad65252bee363e5
// subTotalAmount
// 1000
// subTotalOfDebit
// 1000
// totalAmount
// 1000
// totalDebitAmount
// 1000
// receiptImage
// null
// status
// "Posted"
// approvalStatus
// "Pending"
// sourceModule
// "Fees"
// createdAt
// 2025-11-05T11:42:51.708+00:00
// updatedAt
// 2025-11-05T11:42:51.708+00:00
// __v

//for example if Admission Payment entry 4
//now for example if another entry for Admission Fees and on same date 05-11-2025 and pament mode is Cash Then
//then you need to update 1st Receipt entry

// _id
// 690b383b9ad65252bee363e3
// schoolId
// "SID144732"
// financialYear
// "2025-2026"
// receiptVoucherNumber
// "RVN/2025-2026/1"
// customizeEntry
// true
// entryDate
// 2025-11-05T00:00:00.000+00:00
// receiptDate
// 2025-11-05T00:00:00.000+00:00
// narration
// "Test"
// itemDetails
// Array (3)
// 0
// Object
// itemName
// ""
// ledgerId.  (example : it is from Registration Fee)
// "690b3375fd990fcc0f997768"
// amount
// 2000
// debitAmount
// 0
// _id
// 690b383b9ad65252bee363e4
// 1
// Object
// itemName
// ""
// ledgerId.  (example : it is from Admission Fee)
// "690b3375fd990fcc0f997766"
// amount
// 0
// debitAmount
// 1000
// _id
// 690b383b9ad65252bee363e7
// 3
// Object
// itemName
// ""
// ledgerId.  (example : it is from Payment Mode  Cash)
// "690b3375fd990fcc0f997764"
// amount
// 0
// debitAmount
// 3000
// _id
// 690b383b9ad65252bee363e5

// subTotalAmount
// 3000
// subTotalOfDebit
// 3000
// totalAmount
// 3000
// totalDebitAmount
// 3000
// receiptImage
// null
// status
// "Posted"
// approvalStatus
// "Pending"
// sourceModule
// "Fees"
// createdAt
// 2025-11-05T11:42:51.708+00:00
// updatedAt
// 2025-11-05T11:42:51.708+00:00
// __v

// so are yo getting what i am saying see based on Payment mode new entry of Receipt will be done
// see for example if there are 5 entries in Regestration Payment, Admission Payments or Tc Paymnets
// but on the basis of payment mode they will be segregated

// so for this what to do?

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

async function addInReceiptForFees(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { schoolId, financialYear } = req.query;
    const registrationData = req.body;

    if (!schoolId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    if (!financialYear) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: "Financial Year is required in query.",
      });
    }

    // Validate required registration data
    const { paymentId, finalAmount, paymentDate, academicYear, paymentMode } =
      registrationData;

    if (!paymentId || !finalAmount || !paymentDate || !paymentMode) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message:
          "Missing required fields: paymentId, finalAmount, paymentDate, paymentMode",
      });
    }

    // Skip if payment mode is "null"
    if (paymentMode === "null") {
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({
        hasError: false,
        message: "Payment mode is 'null', skipping finance update.",
      });
    }

    // ===== 1. Update Registration Fee Ledger (Income Account) =====
    const registrationFeeLedger = await Ledger.findOne({
      schoolId,
      financialYear,
      ledgerName: "Registration Fee",
    }).session(session);

    if (!registrationFeeLedger) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        hasError: true,
        message: "Registration Fee ledger not found in the system",
      });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      hasError: false,
      message: "Registration Payment stored in Finance successfully.",
      data: {},
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error storing Registration Payment in Finance:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
      error: error.message,
    });
  }
}

export default addInReceiptForFees;
