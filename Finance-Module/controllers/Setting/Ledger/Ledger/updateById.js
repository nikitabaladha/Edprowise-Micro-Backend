import Ledger from "../../../../models/Ledger.js";
import HeadOfAccount from "../../../../models/HeadOfAccount.js";
import LedgerValidator from "../../../../validators/LedgerValidator.js";
import TotalNetdeficitNetSurplus from "../../../../models/TotalNetdeficitNetSurplus.js";

async function updateById(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    const { id, financialYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to update a ledger.",
      });
    }

    const { error } = LedgerValidator.LedgerValidatorUpdate.validate(req.body);
    if (error?.details?.length) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({ hasError: true, message: errorMessages });
    }

    const {
      ledgerName,
      headOfAccountId,
      groupLedgerId,
      bSPLLedgerId,
      openingBalance,
    } = req.body;

    const existingLedger = await Ledger.findOne({
      _id: id,
      schoolId,
      financialYear,
    });
    if (!existingLedger) {
      return res.status(404).json({
        hasError: true,
        message: "Ledger not found.",
      });
    }

    // Get the HeadOfAccount to determine the balance type
    let headOfAccount;
    if (headOfAccountId && headOfAccountId !== existingLedger.headOfAccountId) {
      headOfAccount = await HeadOfAccount.findById(headOfAccountId);
      if (!headOfAccount) {
        return res.status(404).json({
          hasError: true,
          message: "Head of Account not found",
        });
      }
    } else {
      // Use the existing head of account if not changed
      headOfAccount = await HeadOfAccount.findById(
        existingLedger.headOfAccountId
      );
    }

    const currentOpeningBalance =
      openingBalance !== undefined
        ? openingBalance
        : existingLedger.openingBalance;

    let balanceType;
    if (Number(currentOpeningBalance) < 0) {
      balanceType = "Credit";
    } else {
      balanceType = "Debit";
    }

    existingLedger.ledgerName = ledgerName || existingLedger.ledgerName;
    existingLedger.headOfAccountId =
      headOfAccountId || existingLedger.headOfAccountId;
    existingLedger.groupLedgerId =
      groupLedgerId || existingLedger.groupLedgerId;
    existingLedger.bSPLLedgerId = bSPLLedgerId || existingLedger.bSPLLedgerId;

    existingLedger.openingBalance =
      openingBalance ?? existingLedger.openingBalance;

    existingLedger.balanceType = balanceType;

    await existingLedger.save();

    if (existingLedger.ledgerName.toLowerCase() === "net surplus/(deficit)") {
      const existingTotalNetRecord = await TotalNetdeficitNetSurplus.findOne({
        schoolId,
        financialYear,
      });

      if (!existingTotalNetRecord) {
        // If not found, create new
        const newTotalNetRecord = new TotalNetdeficitNetSurplus({
          schoolId,
          financialYear,
          ledgerId: existingLedger._id,
          balanceDetails: [],
        });

        await newTotalNetRecord.save();
        console.log(
          `TotalNetdeficitNetSurplus record created for ledger: ${ledgerName}`
        );
      } else {
        // If found, ensure it's linked to the correct ledgerId
        if (
          !existingTotalNetRecord.ledgerId ||
          existingTotalNetRecord.ledgerId.toString() !==
            existingLedger._id.toString()
        ) {
          existingTotalNetRecord.ledgerId = existingLedger._id;
          await existingTotalNetRecord.save();
          console.log(
            `TotalNetdeficitNetSurplus record updated with new ledger ID for: ${ledgerName}`
          );
        }
      }
    }

    return res.status(200).json({
      hasError: false,
      message: "Ledger updated successfully!",
      data: existingLedger,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Ledger already exists.`,
      });
    }

    console.error("Error updating Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
