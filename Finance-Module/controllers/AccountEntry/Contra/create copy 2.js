import Contra from "../../../models/Contra.js";
import ContraValidator from "../../../validators/ContraValidator.js";

async function generateContraVoucherNumber(schoolId, academicYear) {
  const count = await Contra.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `CVN/${academicYear}/${nextNumber}`;
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

    const { error } = ContraValidator.ContraValidator.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    const {
      entryDate,
      contraEntryName,
      dateOfCashDepositedWithdrawlDate,
      narration,
      chequeNumber,
      itemDetails,
      TDSorTCS,
      TDSTCSRateAmount,
      status,
      academicYear,
    } = req.body;

    const ContraVoucherNumber = await generateContraVoucherNumber(
      schoolId,
      academicYear
    );

    const { chequeImageForContra } = req.files || {};

    let chequeImageForContraFullPath = "";
    if (chequeImageForContra?.[0]) {
      const basePath = chequeImageForContra[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/chequeImageForContra"
        : "/Documents/FinanceModule/chequeImageForContra";
      chequeImageForContraFullPath = `${basePath}/${chequeImageForContra[0].filename}`;
    }

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

    const totalAmountOfDebit =
      subTotalOfDebit + (parseFloat(TDSTCSRateAmount) || 0);
    const totalAmountOfCredit = subTotalOfCredit;

    if (totalAmountOfDebit !== totalAmountOfCredit) {
      return res.status(400).json({
        hasError: true,
        message: "Total Debit and Credit amounts must be equal.",
      });
    }

    if (["Cash Deposited", "Cash Withdrawn"].includes(contraEntryName)) {
      const missingCashAccount = updatedItemDetails.some(
        (item) => !item.ledgerIdOfCashAccount
      );
      if (missingCashAccount) {
        return res.status(400).json({
          hasError: true,
          message:
            "ledgerIdOfCashAccount is required for Cash Deposited or Cash Withdrawn entries.",
        });
      }
    }

    const newContra = new Contra({
      schoolId,
      contraVoucherNumber: ContraVoucherNumber,
      contraEntryName,
      entryDate,
      dateOfCashDepositedWithdrawlDate,
      narration,
      chequeNumber,
      itemDetails: updatedItemDetails,
      subTotalOfCredit: subTotalOfCredit,
      subTotalOfDebit: subTotalOfDebit,
      TDSorTCS,
      TDSTCSRateAmount,
      totalAmountOfDebit,
      totalAmountOfCredit,
      chequeImageForContra: chequeImageForContraFullPath,
      status,
      academicYear,
    });

    await newContra.save();

    // After contra entry i want to store OpeningClosingBalance Table

    //example 1: if contraEntryName : "Cash Deposited"

    // _id:68ad958809c993bbb7cfd576
    // schoolId:"SID144732"
    // academicYear:"2025-2026"
    // contraEntryName:"Cash Deposited"
    // contraVoucherNumber:"CVN/2025-2026/1"
    // entryDate:2025-08-26T00:00:00.000+00:00
    // dateOfCashDepositedWithdrawlDate:2025-08-26T00:00:00.000+00:00
    // itemDetails:[
    // {
    // ledgerId:"68a9a46af46f002cf6a54217"
    // ledgerIdOfCashAccount:"68a9a46af46f002cf6a5420d"
    // debitAmount:100
    // creditAmount:110
    // _id: 68ad958809c993bbb7cfd577
    // }
    // ]
    // subTotalOfDebit:100
    // subTotalOfCredit:110
    // TDSorTCS:"TDS"
    // TDSTCSRateAmount:10
    // totalAmountOfDebit:110
    // totalAmountOfCredit:110
    // narration:"Test"
    // chequeNumber:""
    // chequeImageForContra:""
    // status:"Posted"
    // createdAt:2025-08-26T11:07:52.365+00:00
    // updatedAt:2025-08-26T11:07:52.365+00:00
    // __v
    // 0

    // after contra entry i want that in table OpeningClosingBalance
    // find for academicYear,and schoold.
    // for itemDetilas.ledgerId,

    // _id:68ad81616d91ac68c16b00b9
    // schoolId:"SID144732"
    // academicYear:"2025-2026"
    // ledgerId:itemDetilas.ledgerId.(68a9a46af46f002cf6a54217)
    // balanceDetails:[
    // {
    // entryId:_id of contra table
    // entryDate:2025-08-26T00:00:00.000+00:00
    // openingBalance:1000
    // debit:debitAmount
    // credit:0
    // closingBalance:if balanceType Debit->(opening+debit-credit) if balanceType Credit-> (opening+credit-debit)
    // }
    // ]
    // balanceType:balnceType of that perticular ledger
    // createdAt:2025-08-26T09:41:53.291+00:00
    // updatedAt:2025-08-26T09:47:42.732+00:00

    // _id:68ad81616d91ac68c16b00b9
    // schoolId:"SID144732"
    // academicYear:"2025-2026"
    // ledgerId:itemDetilas.ledgerIdOfCashAccount.(68a9a46af46f002cf6a5420d)
    // balanceDetails:
    // [
    // {
    // entryId:_id of contra table
    // entryDate:2025-08-26T00:00:00.000+00:00
    // openingBalance:1000
    // debit:0
    // credit:creditAmount
    // closingBalance:if balanceType Debit->(opening+debit-credit) if balanceType Credit-> (opening+credit-debit)
    // }
    // ]
    // balanceType:balnceType of that perticular ledger
    // createdAt:2025-08-26T09:41:53.291+00:00
    // updatedAt:2025-08-26T09:47:42.732+00:00

    // if TCS or TCS then.   then find that perticular word TDS or TCS in groupLedgerTable where you find
    // that pick its _id and find that _id in ledger Table as name of groupLedgerId
    // and of that perticular ledger use balanceType and other things

    // _id:68ad81616d91ac68c16b00b9
    // schoolId:"SID144732"
    // academicYear:"2025-2026"
    // ledgerId:ledgerId
    // balanceDetails:[
    // {
    // entryId:_id of contra table
    // entryDate:2025-08-26T00:00:00.000+00:00
    // openingBalance:1000
    // debit:if TDS then store TDSTCSRateAmount otherwise 0
    // credit:if TCS then store TDSTCSRateAmount otherwise 0
    // closingBalance:if balanceType Debit->(opening+debit-credit) if balanceType Credit-> (opening+credit-debit)
    // }
    // ]
    // balanceType:balnceType of that perticular ledger
    // createdAt:2025-08-26T09:41:53.291+00:00
    // updatedAt:2025-08-26T09:47:42.732+00:00

    //example 2: if contraEntryName : "Cash Withdrawn"

    // _id:68ada57d9a348ed35a936454
    // schoolId:"SID144732"
    // academicYear:"2025-2026"
    // contraEntryName:"Cash Withdrawn"
    // contraVoucherNumber:"CVN/2025-2026/2"
    // entryDate:2025-08-26T00:00:00.000+00:00
    // dateOfCashDepositedWithdrawlDate:2025-08-26T00:00:00.000+00:00
    // itemDetails:[
    // {
    // ledgerId:"68a9a46af46f002cf6a54217"
    // ledgerIdOfCashAccount:"68a9a46af46f002cf6a5420d"
    // debitAmount:40
    // creditAmount:50
    // _id: 68ad958809c993bbb7cfd577
    // }
    // ]
    // subTotalOfDebit:40
    // subTotalOfCredit:50
    // TDSorTCS:"TDS"
    // TDSTCSRateAmount:10
    // totalAmountOfDebit:50
    // totalAmountOfCredit:50
    // narration:"Test"
    // chequeNumber:""
    // chequeImageForContra:""
    // status:"Posted"
    // createdAt:2025-08-26T11:07:52.365+00:00
    // updatedAt:2025-08-26T11:07:52.365+00:00
    // __v
    // 0

    // after contra entry i want that in table OpeningClosingBalance
    // find for academicYear,and schoold.
    // for itemDetilas.ledgerId,

    // _id:68ad81616d91ac68c16b00b9
    // schoolId:"SID144732"
    // academicYear:"2025-2026"
    // ledgerId:itemDetilas.ledgerId.(68a9a46af46f002cf6a54217)
    // balanceDetails:[
    // {
    // entryId:_id of contra table
    // entryDate:2025-08-26T00:00:00.000+00:00
    // openingBalance:1000
    // debit:0
    // credit:creditAmount
    // closingBalance:if balanceType Debit->(opening+debit-credit) if balanceType Credit-> (opening+credit-debit)
    // }
    // ]
    // balanceType:balnceType of that perticular ledger
    // createdAt:2025-08-26T09:41:53.291+00:00
    // updatedAt:2025-08-26T09:47:42.732+00:00

    // _id:68ad81616d91ac68c16b00b9
    // schoolId:"SID144732"
    // academicYear:"2025-2026"
    // ledgerId:itemDetilas.ledgerIdOfCashAccount.(68a9a46af46f002cf6a5420d)
    // balanceDetails:
    // [
    // {
    // entryId:_id of contra table
    // entryDate:2025-08-26T00:00:00.000+00:00
    // openingBalance:1000
    // debit:debitAmount
    // credit:0
    // closingBalance:if balanceType Debit->(opening+debit-credit) if balanceType Credit-> (opening+credit-debit)
    // }
    // ]
    // balanceType:balnceType of that perticular ledger
    // createdAt:2025-08-26T09:41:53.291+00:00
    // updatedAt:2025-08-26T09:47:42.732+00:00

    // if TCS or TCS then.   then find that perticular word TDS or TCS in groupLedgerTable where you find
    // that pick its _id and find that _id in ledger Table as name of groupLedgerId
    // and of that perticular ledger use balanceType and other things

    // _id:68ad81616d91ac68c16b00b9
    // schoolId:"SID144732"
    // academicYear:"2025-2026"
    // ledgerId:ledgerId
    // balanceDetails:[
    // {
    // entryId:_id of contra table
    // entryDate:2025-08-26T00:00:00.000+00:00
    // openingBalance:1000
    // debit:if TDS then store TDSTCSRateAmount otherwise 0
    // credit:if TCS then store TDSTCSRateAmount otherwise 0
    // closingBalance:if balanceType Debit->(opening+debit-credit) if balanceType Credit-> (opening+credit-debit)
    // }
    // ]
    // balanceType:balnceType of that perticular ledger
    // createdAt:2025-08-26T09:41:53.291+00:00
    // updatedAt:2025-08-26T09:47:42.732+00:00

    //example 2: if contraEntryName : "Bank Transfer"

    // _id:68ada718fbc7a108f6f6b40d
    // schoolId:"SID144732"
    // academicYear:"2025-2026"
    // contraEntryName:"Bank Transfer"
    // contraVoucherNumber:"CVN/2025-2026/3"
    // entryDate:2025-08-26T00:00:00.000+00:00
    // dateOfCashDepositedWithdrawlDate:2025-08-26T00:00:00.000+00:00
    // itemDetails:[
    // {
    // ledgerId:"68a9a46af46f002cf6a54217"
    // debitAmount:20
    // creditAmount:0
    // _id: 68ad958809c993bbb7cfd577
    // }
    // ]
    // subTotalOfDebit:20
    // subTotalOfCredit:20
    // TDSorTCS:""
    // TDSTCSRateAmount:0
    // totalAmountOfDebit:20
    // totalAmountOfCredit:20
    // narration:"Test"
    // chequeNumber:""
    // chequeImageForContra:""
    // status:"Posted"
    // createdAt:2025-08-26T11:07:52.365+00:00
    // updatedAt:2025-08-26T11:07:52.365+00:00
    // __v
    // 0

    // after contra entry i want that in table OpeningClosingBalance
    // find for academicYear,and schoold.
    // for itemDetilas.ledgerId,

    // _id:68ad81616d91ac68c16b00b9
    // schoolId:"SID144732"
    // academicYear:"2025-2026"
    // ledgerId:itemDetilas.ledgerId.(68a9a46af46f002cf6a54217)
    // balanceDetails:[
    // {
    // entryId:_id of contra table
    // entryDate:2025-08-26T00:00:00.000+00:00
    // openingBalance:1000
    // debit:if debitAmount then store
    // credit:if creditAmount then store (if both then store both)
    // closingBalance:if balanceType Debit->(opening+debit-credit) if balanceType Credit-> (opening+credit-debit)
    // }
    // ]
    // balanceType:balnceType of that perticular ledger
    // createdAt:2025-08-26T09:41:53.291+00:00
    // updatedAt:2025-08-26T09:47:42.732+00:00

    return res.status(201).json({
      hasError: false,
      message: "Contra created successfully!",
      data: newContra,
    });
  } catch (error) {
    console.error("Error creating Contra:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default create;
