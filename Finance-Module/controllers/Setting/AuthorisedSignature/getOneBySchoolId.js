import AuthorisedSignature from "../../../models/AuthorisedSignature.js";

async function getOneBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    const signature = await AuthorisedSignature.findOne({ schoolId });

    if (!signature) {
      return res.status(404).json({
        hasError: true,
        message: "Authorised Signature not found for this school.",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Authorised Signature retrieved successfully.",
      data: signature,
    });
  } catch (error) {
    console.error("Error retrieving authorised signature:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getOneBySchoolId;
