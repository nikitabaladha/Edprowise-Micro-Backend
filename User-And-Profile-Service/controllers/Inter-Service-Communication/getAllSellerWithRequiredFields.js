import SellerProfile from "../../models/SellerProfile.js";

async function getAllSellerWithRequiredFields(req, res) {
  try {
    const sellerProfiles = await SellerProfile.find().select(
      req.query.fields || ""
    );

    if (!sellerProfiles) {
      return res.status(404).json({
        hasError: true,
        message: "SellerProfiles not found",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "SellerProfiles retrieved successfully.",
      data: admins,
    });
  } catch (error) {
    console.error("Error retrieving SellerProfiles:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Failed to retrieve SellerProfiles.",
      error: error.message,
    });
  }
}

export default getAllSellerWithRequiredFields;
