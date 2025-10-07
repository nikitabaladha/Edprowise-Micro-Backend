import Ledger from "../../../../models/Ledger.js";
import GroupLedger from "../../../../models/GroupLedger.js";
import BSPLLedger from "../../../../models/BSPLLedger.js";

async function getAllByBankAndBankFixedDepisits(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    // 1. Get GroupLedger based data (Bank and Bank Fixed Deposits)
    const groupLedgers = await GroupLedger.find({
      schoolId,
      academicYear,
      groupLedgerName: { $in: ["Bank", "Bank Fixed Deposits"] },
    });

    const groupLedgerIds = groupLedgers.map((group) => group._id);

    const groupBasedLedgers = await Ledger.find({
      schoolId,
      academicYear,
      groupLedgerId: { $in: groupLedgerIds },
    })
      .populate("headOfAccountId")
      .populate("groupLedgerId")
      .sort({ createdAt: -1 });

    // 2. Get BSPLLedger based data (Fixed Assets)
    const bsplFixedAssets = await BSPLLedger.findOne({
      schoolId,
      academicYear,
      bSPLLedgerName: "Fixed Assets",
    });

    let fixedAssetsLedgers = [];
    if (bsplFixedAssets) {
      fixedAssetsLedgers = await Ledger.find({
        schoolId,
        academicYear,
        bSPLLedgerId: bsplFixedAssets._id,
      })
        .populate("headOfAccountId")
        .populate("groupLedgerId")
        .populate("bSPLLedgerId")
        .sort({ createdAt: -1 });
    }

    // Create a map to group ledgers by their group ledger name
    const groupedLedgers = {
      Bank: [],
      "Bank Fixed Deposits": [],
      "Fixed Assets": [],
    };

    // Group the GroupLedger based ledgers
    groupBasedLedgers.forEach((ledger) => {
      const groupName = ledger.groupLedgerId?.groupLedgerName;
      if (groupName && groupedLedgers[groupName]) {
        const formattedLedger = {
          _id: ledger._id,
          ledgerName: ledger.ledgerName,
          headOfAccountName: ledger.headOfAccountId?.headOfAccountName,
          groupLedgerName: groupName,
          type: "group", // to identify it's from group ledger
          ...ledger.toObject(),
        };
        groupedLedgers[groupName].push(formattedLedger);
      }
    });

    // Add Fixed Assets ledgers
    fixedAssetsLedgers.forEach((ledger) => {
      const formattedLedger = {
        _id: ledger._id,
        ledgerName: ledger.ledgerName,
        headOfAccountName: ledger.headOfAccountId?.headOfAccountName,
        bSPLLedgerName: ledger.bSPLLedgerId?.bSPLLedgerName,
        type: "bspl", // to identify it's from BSPL ledger
        ...ledger.toObject(),
      };
      groupedLedgers["Fixed Assets"].push(formattedLedger);
    });

    return res.status(200).json({
      hasError: false,
      message: "Ledgers fetched successfully!",
      data: {
        bankLedgers: groupedLedgers["Bank"] || [],
        fixedDepositLedgers: groupedLedgers["Bank Fixed Deposits"] || [],
        fixedAssetsLedgers: groupedLedgers["Fixed Assets"] || [],
      },
    });
  } catch (error) {
    console.error("Error fetching Ledgers:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllByBankAndBankFixedDepisits;
