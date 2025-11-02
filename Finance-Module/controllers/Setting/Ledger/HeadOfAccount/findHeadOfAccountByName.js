import HeadOfAccount from "../../../../models/HeadOfAccount.js";

async function findHeadOfAccount(req, res) {
  try {
    const { headOfAccountName, financialYear } = req.body;
    const schoolId = req.user?.schoolId;

    const headOfAccount = await HeadOfAccount.findOne({
      schoolId,
      headOfAccountName,
      financialYear,
    });

    return res.status(200).json({
      hasError: false,
      data: headOfAccount || null,
    });
  } catch (error) {
    console.error("Error finding Head Of Account:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default findHeadOfAccount;
