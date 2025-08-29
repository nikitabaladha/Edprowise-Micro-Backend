import Journal from "../../../models/Journal.js";
import JournalValidator from "../../../validators/JournalValidator.js";

import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";

async function generateJournalVoucherNumber(schoolId, academicYear) {
  const count = await Journal.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `JVN/${academicYear}/${nextNumber}`;
}

export async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    const { error } = JournalValidator.JournalValidator.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    const {
      entryDate,
      documentDate,
      narration,
      itemDetails,
      status,
      academicYear,
    } = req.body;

    const { documentImage } = req.files || {};

    const documentImagePath = documentImage?.[0]?.mimetype.startsWith("image/")
      ? "/Images/FinanceModule/DocumentImageForJournal"
      : "/Documents/FinanceModule/DocumentImageForJournal";

    const documentImageFullPath = documentImage?.[0]
      ? `${documentImagePath}/${documentImage[0].filename}`
      : null;

    const JournalVoucherNumber = await generateJournalVoucherNumber(
      schoolId,
      academicYear
    );

    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      debitAmount: parseFloat(item.debitAmount) || 0,
      creditAmount: parseFloat(item.creditAmount) || 0,
    }));

    const subTotalOfDebit = updatedItemDetails.reduce(
      (sum, item) => sum + item.debitAmount,
      0
    );

    const subTotalOfCredit = updatedItemDetails.reduce(
      (sum, item) => sum + item.creditAmount,
      0
    );

    const totalAmountOfDebit = subTotalOfDebit;

    const totalAmountOfCredit = subTotalOfCredit;

    if (totalAmountOfDebit !== totalAmountOfCredit) {
      return res.status(400).json({
        hasError: true,
        message: "Total Debit and Credit amounts must be equal.",
      });
    }

    const newJournal = new Journal({
      schoolId,
      journalVoucherNumber: JournalVoucherNumber,
      entryDate,
      documentDate,
      narration,
      itemDetails: updatedItemDetails,
      subTotalOfCredit: subTotalOfCredit,
      subTotalOfDebit: subTotalOfDebit,
      totalAmountOfDebit,
      totalAmountOfCredit,
      documentImage: documentImageFullPath,
      status,
      academicYear,
    });

    await newJournal.save();

    // here after journal entry i want to store data in Opening And closing balance table
    // example this is my entry in journal table

    // _id:68ad7bb92c64e02d8f7c902d
    // schoolId:"SID144732"
    // academicYear:"2025-2026"
    // journalVoucherNumber:"JVN/2025-2026/1"
    // entryDate:2025-08-26T00:00:00.000+00:00
    // documentDate:2025-08-26T00:00:00.000+00:00
    // itemDetails:[
    // {
    // ledgerId:"68a9a476f46f002cf6a5433e"
    // description:"Deficit"
    // debitAmount:100
    // creditAmount:0
    // _id
    // 68ad7bb92c64e02d8f7c902e},
    // {
    // ledgerId:"68a9a476f46f002cf6a54339"
    // description:"Surplus"
    // debitAmount:0
    // creditAmount:100
    // _id:68ad7bb92c64e02d8f7c902f
    // }
    // ]
    // subTotalOfDebit:100
    // subTotalOfCredit:100
    // totalAmountOfDebit:100
    // totalAmountOfCredit:100
    // documentImage:null
    // narration:"Test"
    // status:"Posted"
    // createdAt:2025-08-26T09:17:45.217+00:00
    // updatedAt:2025-08-26T09:17:45.217+00:00
    // __v
    // 0

    // now see in opening and closing balance if no entry for that perticular ledger fo that schoolId and academic
    // year then create new entry otherwise store in existing one
    //  exammple

    // _id:68ad73310b68fbd38f255253
    // schoolId:"SID144732"
    // academicYear:"2025-2026"
    // ledgerId:itemDetails.ledgerId
    // balanceDetails:[
    // {
    // entryId:receitEntry id whatever the _id in receit table
    // entryDate:2025-08-26T00:00:00.000+00:00
    // openingBalance:whatever present in ledgerTable for that perticular ledger or previous entries closing balance
    // debit:debitAmount
    // credit:creditAmount
    // closingBalance: if balancetype Debit -> (opening+debit-credit). if balancetype Credit ->opening+credit-debit
    // _id:68ad73310b68fbd38f255254
    // },
    // balanceType:what ever balanceType of that ledger
    // createdAt:2025-08-26T08:41:21.879+00:00
    // updatedAt:2025-08-26T08:59:05.215+00:00
    // __v
    // 7

    // _id:68ad73310b68fbd38f255253
    // schoolId:"SID144732"
    // academicYear:"2025-2026"
    // ledgerId:itemDetails.ledgerId
    // balanceDetails:[
    // {
    // entryId:receitEntry id whatever the _id in receit table
    // entryDate:2025-08-26T00:00:00.000+00:00
    // openingBalance:whatever present in ledgerTable for that perticular ledger or previous entries closing balance
    // debit:debitAmount
    // credit:creditAmount
    // closingBalance: if balancetype Debit -> (opening+debit-credit). if balancetype Credit ->opening+credit-debit
    // },
    // balanceType:what ever balanceType of that ledger
    // createdAt:2025-08-26T08:41:21.879+00:00
    // updatedAt:2025-08-26T08:59:05.215+00:00
    // __v
    // 7

    return res.status(201).json({
      hasError: false,
      message: "Journal created successfully!",
      data: newJournal,
    });
  } catch (error) {
    console.error("Error creating Journal:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default create;
