import ItDeclaration from "../../../models/Employee/ItDeclaration.js";

const updateItDeclaration = async (req, res) => {
  try {
    const { schoolId, employeeId } = req.params;
    const {
      academicYear,
      updates,
      section80C,
      section80D,
      otherSections,
      hraExemption,
      otherExemption,
      status,
    } = req.body;

    if (!schoolId || !employeeId || !academicYear) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Get current declaration
    const declaration = await ItDeclaration.findOne({
      schoolId,
      employeeId,
      academicYear,
    });
    if (!declaration) {
      return res.status(404).json({
        success: false,
        message: "Declaration not found",
      });
    }

    // Process updates for section80C, section80D, otherSections
    if (updates) {
      const { section, index, status, proofSubmitted, adminRemarks } = updates;

      if (
        ["section80C", "section80D", "otherSections"].includes(section) &&
        declaration[section]?.items[index]
      ) {
        const item = declaration[section].items[index];

        // Update only the changed fields
        if (status !== undefined) item.status = status;
        if (proofSubmitted !== undefined)
          item.proofSubmitted = status === "Approved" ? proofSubmitted : 0;
        if (adminRemarks !== undefined) item.adminRemarks = adminRemarks;

        // Calculate final deduction based on status
        if (status) {
          item.categoryFinalDeduction =
            status === "Approved"
              ? section === "section80D" || section === "otherSections"
                ? Math.min(item.proofSubmitted, item.categoryLimit || Infinity)
                : item.proofSubmitted
              : 0;
        }

        // Recalculate section totals
        const { finalDeduction } = calculateSectionTotals(
          section,
          declaration[section].items
        );
        declaration[section].finalDeduction = finalDeduction;
      } else if (section === "hraExemption" && declaration.hraExemption) {
        // Handle hraExemption updates
        if (status !== undefined) declaration.hraExemption.status = status;
        if (proofSubmitted !== undefined)
          declaration.hraExemption.proofSubmitted =
            status === "Approved" ? proofSubmitted : 0;
        if (adminRemarks !== undefined)
          declaration.hraExemption.adminRemarks = adminRemarks;
      } else if (
        ["ltaExemption", "telephoneAllowance", "internetAllowance"].includes(
          section
        ) &&
        declaration.otherExemption[section]
      ) {
        // Handle otherExemption updates
        if (status !== undefined)
          declaration.otherExemption[section].status = status;
        if (proofSubmitted !== undefined)
          declaration.otherExemption[section].proofSubmitted =
            status === "Approved" ? proofSubmitted : 0;
        if (adminRemarks !== undefined)
          declaration.otherExemption[section].adminRemarks = adminRemarks;

        // Calculate final deduction for otherExemption
        if (status) {
          declaration.otherExemption[section].categoryFinalDeduction =
            status === "Approved"
              ? Math.min(
                  declaration.otherExemption[section].proofSubmitted,
                  declaration.otherExemption[section].categoryLimit || Infinity
                )
              : 0;
        }
      }
    }

    // Handle bulk updates (e.g., from handleSubmit)
    if (section80C) declaration.section80C = section80C;
    if (section80D) declaration.section80D = section80D;
    if (otherSections) declaration.otherSections = otherSections;
    if (hraExemption) declaration.hraExemption = hraExemption;
    if (otherExemption) declaration.otherExemption = otherExemption;
    if (status) declaration.status = status;

    // Save the updated declaration
    await declaration.save();

    return res.status(200).json({
      success: true,
      data: declaration,
      message: "Declaration updated successfully",
    });
  } catch (error) {
    console.error("Error updating declaration:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

function calculateSectionTotals(section, items) {
  const totalProofSubmitted = items.reduce(
    (sum, item) =>
      sum + (item.status === "Approved" ? item.proofSubmitted || 0 : 0),
    0
  );
  let finalDeduction = totalProofSubmitted;

  if (section === "section80C") {
    finalDeduction = Math.min(totalProofSubmitted, 150000);
  } else if (section === "section80D" || section === "otherSections") {
    finalDeduction = items.reduce(
      (sum, item) =>
        sum +
        (item.status === "Approved" ? item.categoryFinalDeduction || 0 : 0),
      0
    );
  }

  return { totalProofSubmitted, finalDeduction };
}
export default updateItDeclaration;
