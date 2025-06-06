import EdprowiseProfile from "../../models/EdprowiseProfile.js";

async function requiredFieldFromEdprowise(req, res) {
  try {
    const profile = await EdprowiseProfile.findOne().select(
      req.query.fields || ""
    );

    if (!profile) {
      return res.status(404).json({
        hasError: true,
        message: "Edprowise profile not found",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Edprowise profile retrieved successfully.",
      data: profile,
    });
  } catch (error) {
    console.error("Error retrieving Edprowise Profile:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Failed to retrieve Edprowise Profile.",
      error: error.message,
    });
  }
}

export default requiredFieldFromEdprowise;
