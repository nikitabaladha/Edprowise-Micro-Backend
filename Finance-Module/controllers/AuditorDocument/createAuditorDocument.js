import AuditorDocument from "../../models/AuditorDocument.js";

export async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    const { financialYear, ledgerId, remarks } = req.body;

    if (!financialYear) {
      return res.status(400).json({
        hasError: true,
        message: "Academic year is required.",
      });
    }

    const { auditorDocument: documentFiles } = req.files || {};

    // Process uploaded files
    const itemDetails = [];

    if (documentFiles && documentFiles.length > 0) {
      documentFiles.forEach((file, index) => {
        const documentPath = file.mimetype.startsWith("image/")
          ? "/Images/FinanceModule/AuditorDocument"
          : "/Documents/FinanceModule/AuditorDocument";

        const documentFullPath = `${documentPath}/${file.filename}`;

        const remark =
          remarks && Array.isArray(remarks)
            ? remarks[index] || ""
            : typeof remarks === "string"
            ? remarks
            : "";

        itemDetails.push({
          auditorDocument: documentFullPath,
          remark: remark || "",
        });
      });
    }

    // Check if document already exists for this school, financialYear, and ledgerId
    let existingDocument = await AuditorDocument.findOne({
      schoolId,
      financialYear,
      ledgerId: ledgerId || null, // Handle cases where ledgerId might be empty
    });

    if (existingDocument) {
      // Append new itemDetails to existing document
      existingDocument.itemDetails.push(...itemDetails);
      await existingDocument.save();

      return res.status(200).json({
        hasError: false,
        message: "Auditor Document updated successfully!",
        data: existingDocument,
      });
    } else {
      // Create new document
      const newAuditorDocument = new AuditorDocument({
        schoolId,
        financialYear,
        ledgerId: ledgerId || null,
        itemDetails,
      });

      await newAuditorDocument.save();

      return res.status(201).json({
        hasError: false,
        message: "Auditor Document created successfully!",
        data: newAuditorDocument,
      });
    }
  } catch (error) {
    console.error("Error creating Auditor Document:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
