import AuditorDocument from "../../models/AuditorDocument.js";

export async function getAll(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { academicYear, ledgerId } = req.query;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    const query = { schoolId };
    if (academicYear) query.academicYear = academicYear;
    if (ledgerId) query.ledgerId = ledgerId;

    const documents = await AuditorDocument.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      hasError: false,
      message: "Auditor Documents retrieved successfully!",
      data: documents,
    });
  } catch (error) {
    console.error("Error retrieving Auditor Documents:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAll;
