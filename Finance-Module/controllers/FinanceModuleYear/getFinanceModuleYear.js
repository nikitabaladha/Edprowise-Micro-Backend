import FinanceModuleYear from "../../models/FinanceModuleYear.js";

const getAcademicYearsBySchoolId = async (req, res) => {
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
    const currentAcademicYear = `${currentYear}-${nextYear}`;

    const existing = await FinanceModuleYear.findOne({
      schoolId,
      academicYear: currentAcademicYear,
    });

    if (!existing) {
      await FinanceModuleYear.create({
        schoolId,
        academicYear: currentAcademicYear,
      });
    }

    const academicYears = await FinanceModuleYear.find({ schoolId }).sort({
      academicYear: 1,
    });

    res.status(200).json({
      hasError: false,
      message: "Academic years fetched successfully.",
      data: academicYears,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      hasError: true,
      message: "Server error while fetching academic years.",
    });
  }
};

export default getAcademicYearsBySchoolId;
