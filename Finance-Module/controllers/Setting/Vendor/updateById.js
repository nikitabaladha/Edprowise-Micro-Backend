import Vendor from "../../../models/Vendor.js";
import VendorValidator from "../../../validators/VendorValidator.js";
import Ledger from "../../../models/Ledger.js";

async function updateById(req, res) {
  try {
    const { id, academicYear } = req.params;

    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to update a ledger.",
      });
    }

    const { error } = VendorValidator.VendorValidatorUpdate.validate(req.body);
    if (error?.details?.length) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({ hasError: true, message: errorMessages });
    }

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
      openingBalance,
      paymentTerms,
    } = req.body;

    const existingVendor = await Vendor.findOne({
      _id: id,
      schoolId,
      academicYear,
    });
    if (!existingVendor) {
      return res.status(404).json({
        hasError: true,
        message: "Vendor not found.",
      });
    }

    const { documentImage } = req.files || {};

    if (documentImage?.[0]) {
      const documentImagePath = documentImage[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/DocumentImageForVendor"
        : "/Documents/FinanceModule/DocumentImageForVendor";
      existingVendor.documentImage = `${documentImagePath}/${documentImage[0].filename}`;
    }

    const isNameChanged =
      nameOfVendor && nameOfVendor !== existingVendor.nameOfVendor;

    // ---- Opening Balance & Balance Type Logic ----
    let newOpeningBalance = existingVendor.openingBalance;
    let newBalanceType = existingVendor.balanceType;

    if (openingBalance !== undefined) {
      let openingBalNum = Number(openingBalance);

      if (openingBalNum < 0) {
        newBalanceType = "Credit";
        newOpeningBalance = openingBalNum;
      } else {
        newBalanceType = "Debit";
        newOpeningBalance = openingBalNum;
      }
    }

    existingVendor.nameOfVendor = nameOfVendor || existingVendor.nameOfVendor;
    existingVendor.email = email || existingVendor.email;
    existingVendor.contactNumber =
      contactNumber || existingVendor.contactNumber;
    existingVendor.panNumber = panNumber || existingVendor.panNumber;
    existingVendor.gstNumber = gstNumber || existingVendor.gstNumber;
    existingVendor.address = address || existingVendor.address;
    existingVendor.state = state || existingVendor.state;
    existingVendor.nameOfAccountHolder =
      nameOfAccountHolder || existingVendor.nameOfAccountHolder;
    existingVendor.nameOfBank = nameOfBank || existingVendor.nameOfBank;
    existingVendor.ifscCode = ifscCode || existingVendor.ifscCode;
    existingVendor.accountNumber =
      accountNumber || existingVendor.accountNumber;
    existingVendor.accountType = accountType || existingVendor.accountType;

    existingVendor.openingBalance = newOpeningBalance;
    existingVendor.paymentTerms = paymentTerms || existingVendor.paymentTerms;
    existingVendor.openingBalance = newOpeningBalance;
    existingVendor.balanceType = newBalanceType;

    await existingVendor.save();

    if (existingVendor.ledgerId) {
      const ledgerUpdates = {
        openingBalance: newOpeningBalance,
        balanceType: newBalanceType,
      };

      if (isNameChanged) {
        ledgerUpdates.ledgerName = existingVendor.nameOfVendor;
      }

      await Ledger.findByIdAndUpdate(existingVendor.ledgerId, ledgerUpdates);
    }

    return res.status(200).json({
      hasError: false,
      message: "Vendor updated successfully!",
      data: existingVendor,
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

    console.error("Error updating Vendor:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
