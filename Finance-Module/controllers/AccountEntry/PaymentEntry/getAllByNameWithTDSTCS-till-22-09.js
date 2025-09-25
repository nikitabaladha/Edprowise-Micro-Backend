import PaymentEntry from "../../../models/PaymentEntry.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";

async function getById(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { id, academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const paymentEntry = await PaymentEntry.findOne({
      _id: id,
      schoolId,
      academicYear,
    });

    if (!paymentEntry) {
      return res.status(404).json({
        hasError: true,
        message: "PaymentEntry not found.",
      });
    }

    if (!["TDS", "TCS"].includes(paymentEntry.TDSorTCS)) {
      return res.status(200).json({
        hasError: false,
        message: "No TDS or TCS linked to this PaymentEntry.",
        data: [],
      });
    }

    const groupLedger = await GroupLedger.findOne({
      schoolId,
      academicYear,
      groupLedgerName: paymentEntry.TDSorTCS,
    });

    if (!groupLedger) {
      return res.status(404).json({
        hasError: true,
        message: `No GroupLedger found for ${paymentEntry.TDSorTCS}.`,
      });
    }

    const ledgers = await Ledger.find({
      schoolId,
      academicYear,
      groupLedgerId: groupLedger._id,
    }).select("_id ledgerName");

    return res.status(200).json({
      hasError: false,
      message: "Ledgers fetched successfully!",
      data: ledgers,
    });
  } catch (error) {
    console.error("Error fetching Ledgers:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getById;
