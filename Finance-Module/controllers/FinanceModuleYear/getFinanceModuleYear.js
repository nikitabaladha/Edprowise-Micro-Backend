import FinanceModuleYear from "../../models/FinanceModuleYear.js";

const getFinancialYearsBySchoolId = async (req, res) => {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to create academic year data.",
      });
    }

    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const currentFinancialYear = `${currentYear}-${nextYear}`;

    const existing = await FinanceModuleYear.findOne({
      schoolId,
      financialYear: currentFinancialYear,
    });

    if (!existing) {
      await FinanceModuleYear.create({
        schoolId,
        financialYear: currentFinancialYear,
      });
    }

    const financialYears = await FinanceModuleYear.find({ schoolId }).sort({
      financialYear: 1,
    });

    res.status(200).json({
      hasError: false,
      message: "Academic years fetched successfully.",
      data: financialYears,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      hasError: true,
      message: "Server error while fetching academic years.",
    });
  }
};

export default getFinancialYearsBySchoolId;
