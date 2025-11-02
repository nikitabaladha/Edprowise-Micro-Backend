import Vendor from "../../../models/Vendor.js";
import VendorValidator from "../../../validators/VendorValidator.js";
import HeadOfAccount from "../../../models/HeadOfAccount.js";
import BSPLLedger from "../../../models/BSPLLedger.js";
import GroupLedger from "../../../models/GroupLedger.js";
import Ledger from "../../../models/Ledger.js";
import CounterForFinaceLedger from "../../../models/CounterForFinaceLedger.js";

async function generateVendorCode(schoolId) {
  const count = await Vendor.countDocuments({ schoolId });
  const nextNumber = count + 1;
  const formattedNumber = String(nextNumber).padStart(3, "0");
  return `VEN-${formattedNumber}`;
}

async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to create a Vendor.",
      });
    }

    const { error } = VendorValidator.VendorValidator.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    const vendorCode = await generateVendorCode(schoolId);

    const {
      nameOfVendor,
      email,
      contactNumber,
      panNumber,
      gstNumber,
      address,
      state,
      nameOfAccountHolder,
      nameOfBank,
      ifscCode,
      accountNumber,
      accountType,
      financialYear,
      openingBalance,
      paymentTerms,
    } = req.body;

    const { documentImage } = req.files || {};

    const documentImagePath = documentImage?.[0]?.mimetype.startsWith("image/")
      ? "/Images/FinanceModule/DocumentImageForVendor"
      : "/Documents/FinanceModule/DocumentImageForVendor";

    const documentImageFullPath = documentImage?.[0]
      ? `${documentImagePath}/${documentImage[0].filename}`
      : null;

    const newVendor = new Vendor({
      schoolId,
      vendorCode,
      nameOfVendor,
      email,
      contactNumber,
      panNumber,
      gstNumber,
      address,
      state,
      nameOfAccountHolder,
      nameOfBank,
      ifscCode,
      accountNumber,
      accountType,
      financialYear,
      openingBalance,
      paymentTerms,
      documentImage: documentImageFullPath,
    });

    await newVendor.save();

    // Create accounting hierarchy for the vendor
    // 1. Create Head of Account "Liabilities" if not exists
    let headOfAccount = await HeadOfAccount.findOneAndUpdate(
      {
        schoolId,
        headOfAccountName: "Liabilities",
        financialYear,
      },
      {
        schoolId,
        headOfAccountName: "Liabilities",
        financialYear,
      },
      {
        new: true,
        upsert: true,
      }
    );

    // 2. Create B/S P&L Ledger "Current Liabilities" if not exists
    let bsplLedger = await BSPLLedger.findOneAndUpdate(
      {
        schoolId,
        headOfAccountId: headOfAccount._id,
        bSPLLedgerName: "Current Liabilities",
        financialYear,
      },
      {
        schoolId,
        headOfAccountId: headOfAccount._id,
        bSPLLedgerName: "Current Liabilities",
        financialYear,
      },
      {
        new: true,
        upsert: true,
      }
    );

    // 3. Create Group Ledger "Payable" if not exists
    let groupLedger = await GroupLedger.findOneAndUpdate(
      {
        schoolId,
        headOfAccountId: headOfAccount._id,
        bSPLLedgerId: bsplLedger._id,
        groupLedgerName: "Payable",
        financialYear,
      },
      {
        schoolId,
        headOfAccountId: headOfAccount._id,
        bSPLLedgerId: bsplLedger._id,
        groupLedgerName: "Payable",
        financialYear,
      },
      {
        new: true,
        upsert: true,
      }
    );

    // Generate ledger code for the vendor ledger
    const typeToBaseCode = {
      Assets: 1000,
      Liabilities: 2000,
      Income: 3000,
      Expenses: 4000,
    };

    const baseCode = typeToBaseCode[headOfAccount.headOfAccountName] || 2000; // Default to 2000 if not found

    // Atomically find and increment the counter for Liabilities
    const counter = await CounterForFinaceLedger.findOneAndUpdate(
      { schoolId, headOfAccountType: headOfAccount.headOfAccountName },
      { $inc: { lastLedgerCode: 1 } },
      { new: true, upsert: true }
    );

    const ledgerCode = baseCode + counter.lastLedgerCode;

    let openingBal = Number(openingBalance) || 0;
    let balanceType = openingBal < 0 ? "Credit" : "Debit";

    // 4. Create Ledger with vendor's name and generated ledger code
    let ledger = await Ledger.findOneAndUpdate(
      {
        schoolId,
        headOfAccountId: headOfAccount._id,
        bSPLLedgerId: bsplLedger._id,
        groupLedgerId: groupLedger._id,
        ledgerName: nameOfVendor,
        financialYear,
      },
      {
        schoolId,
        headOfAccountId: headOfAccount._id,
        bSPLLedgerId: bsplLedger._id,
        groupLedgerId: groupLedger._id,
        ledgerName: nameOfVendor,
        openingBalance: openingBal,
        balanceType,
        paymentMode: "Not Defined",
        ledgerCode: ledgerCode.toString(),
        financialYear,
      },
      {
        new: true,
        upsert: true,
      }
    );

    newVendor.ledgerId = ledger._id;
    await newVendor.save();

    return res.status(201).json({
      hasError: false,
      message: "Vendor created successfully with accounting entries!",
      data: {
        vendor: newVendor,
        accountingEntries: {
          headOfAccount,
          bsplLedger,
          groupLedger,
          ledger,
        },
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Vendor already exists.`,
      });
    }

    console.error("Error Creating Vendor:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
