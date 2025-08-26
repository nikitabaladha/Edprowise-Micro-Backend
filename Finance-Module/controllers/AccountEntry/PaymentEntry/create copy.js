import moment from "moment";

import PaymentEntry from "../../../models/PaymentEntry.js";
import PaymentEntryValidator from "../../../validators/PaymentEntryValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";

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

async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
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

    await newPaymentEntry.save();

    // example : data going to be stored in payment table

    // _id:68ab00a2513a09dc77511db0
    // schoolId:"SID144732"
    // academicYear:"2025-2026"
    // paymentVoucherNumber:"PVN/2025-2026/1"
    // vendorCode:"VEN-001"
    // vendorId:"6889a25b3a71e55803bf9747"
    // entryDate:2025-08-24T00:00:00.000+00:00
    // invoiceDate:2025-08-24T00:00:00.000+00:00
    // invoiceNumber:"1234567890"
    // poNumber:""
    // dueDate:2025-08-24T00:00:00.000+00:00
    // narration:"Test"
    // paymentMode:"Cash"
    // chequeNumber:""
    // transactionNumber:null
    // itemDetails:[
    // {
    // itemName:"Deficit",
    // ledgerId:"68a9a476f46f002cf6a5433e",
    // amountBeforeGST:100,
    // GSTAmount:10,
    // amountAfterGST:110,
    // _id:68ab00a2513a09dc77511db1
    // },
    // {
    // itemName:"Surplus",
    // ledgerId:"68a9a476f46f002cf6a54339",
    // amountBeforeGST:100,
    // GSTAmount:10,
    // amountAfterGST:110,
    // _id:68ab0f3ea23368dd177d44d7
    // }
    // ]
    // subTotalAmountAfterGST:110
    // TDSorTCS:"TDS"
    // TDSTCSRateChartId:"6889a4ca3a71e55803bf97f0"
    // TDSTCSRate:5
    // TDSTCSRateWithAmountBeforeGST:5
    // totalAmountBeforeGST:100
    // totalGSTAmount:10
    // totalAmountAfterGST:105
    // invoiceImage:null
    // chequeImage:null
    // ledgerIdWithPaymentMode:"68a9a46af46f002cf6a5420d"
    // status:"Posted"

    // after payment entry i want that in table OpeningClosingBalance
    // find for entryDate and itemDetilas.ledgerId,ledgerIdWithPaymentMode, and TDSTCSRateChartId
    // if not exist then store

    //schoolId:SID144732
    //academicYear: 2025-2026
    //ledgerId: 68a9a476f46f002cf6a5433e
    //entryDate:2025-08-24T00:00:00.000+00:00,
    //if this is first entry of this academicYear for this perticular ledgerId
    //then here in openingBalance store whatever openingBalance is with ledgerId in ledgerTable
    //or if any previous date entry present and have closingbalance then store that closing balance as opening Balance for this entry
    //here i am assuming there in no entry then store
    //balanceDetails: [
    //{entryId:68ab00a2513a09dc77511db0
    //openingBalance: 1000
    //debit:amountAfterGST=110
    //credit:0
    //closingBalance:openingBalance+credit-debit = 1000+0-110=890
    //},
    //],
    // balanceType:Credit(It is stored in ledgerTable),

    //schoolId:SID144732
    //academicYear: 2025-2026
    //ledgerId: 68a9a476f46f002cf6a54339
    //entryDate:2025-08-24T00:00:00.000+00:00,
    //if this is first entry of this academicYear for this perticular ledgerId
    //then here in openingBalance store whatever openingBalance is with ledgerId in ledgerTable
    //or if any previous date entry present and have closingbalance then store that closing balance as opening Balance for this entry
    //here i am assuming there in no entry then store
    //balanceDetails: [
    //{entryId:68ab00a2513a09dc77511db0
    //openingBalance: 1000
    //debit:amountAfterGST=110
    //credit:0
    //closingBalance:openingBalance+credit-debit = 1000+0-110=890
    //},
    //],
    // balanceType:Credit(It is stored in ledgerTable),

    // if TDS
    //schoolId:SID144732
    //academicYear: 2025-2026
    //ledgerId: 6889a4ca3a71e55803bf97f0
    //entryDate:2025-08-24T00:00:00.000+00:00,
    //balanceDetails: [
    //{entryId:68ab00a2513a09dc77511db0
    //openingBalance: 1000
    //debit:0
    //credit:TDSTCSRateWithAmountBeforeGST=5
    //closingBalance:openingBalance+credit-debit = 1000+5-0=1005
    //},
    //],
    // balanceType:Credit(It is stored in ledgerTable),

    // Cash Account
    //schoolId:SID144732
    //academicYear: 2025-2026
    //ledgerId: 68a9a46af46f002cf6a5420d
    //entryDate:2025-08-24T00:00:00.000+00:00,
    //balanceDetails: [
    //{entryId:68ab00a2513a09dc77511db0
    //openingBalance: 1000
    //debit:0
    //credit:subTotalAmountAfterGST-TDSTCSRateWithAmountBeforeGST= 220-5=215
    //closingBalance:openingBalance+debit-credit = 1000+0-215=785
    //},
    //],
    // balanceType:Debit(It is stored in ledgerTable),

    //if new entry but if ledger alredy exist then closing balance will be openingBalnce for new entry
    // other things will be according to calculation
    // if entryDate change then store new entry for that perticular ledger but make sure
    // opening date will be like last date of that perticular ledgerId and its closingbalance
    // so each time for new entryDate there wll be new data will be store in OpeningClosingBalance
    // if same entryDate then just add one more entry thing in balanceDetails

    // example: cash account

    // entryDate	  Op.Balance	Debit	Credit	  Cl. Balance
    // 24-08-2025	    1000	     0.00	 105.00	  895
    // 24-08-2025	     895	     0.00	 105.00	  790
    // 24-08-2025	     790	     0.00	 105.00	  685
    // 27-08-2025	     685	     0.00	 205.00   480

    // above three for 24-08-2025 will be in same and for date change like 27-08-2025 it will be
    // so stored in another entry with same ledger id but the opening balance will be closing balance of
    // last date

    return res.status(201).json({
      hasError: false,
      message: "Payment Entry created successfully!",
      data: newPaymentEntry,
    });
  } catch (error) {
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
