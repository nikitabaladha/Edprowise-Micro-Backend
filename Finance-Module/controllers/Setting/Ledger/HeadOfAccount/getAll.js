import HeadOfAccount from "../../../../models/HeadOfAccount.js";

async function getAll(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    const financialYear = req.params.financialYear;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Missing school ID.",
      });
    }

    const headOfAccounts = await HeadOfAccount.find({
      schoolId,
      financialYear,
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      hasError: false,
      message: "Head Of Accounts fetched successfully.",
      data: headOfAccounts,
    });
  } catch (error) {
    console.error("Error fetching Head Of Accounts:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAll;
