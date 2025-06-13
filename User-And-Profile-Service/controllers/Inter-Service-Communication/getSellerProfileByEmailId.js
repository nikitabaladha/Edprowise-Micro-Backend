import SellerProfile from "../../models/SellerProfile.js";

async function getSellerProfileByEmailId(req, res) {
  try {
    const { emailId } = req.params;
    const { fields } = req.query;

    const sellerProfile = await SellerProfile.findOne({ emailId }).select(
      fields || ""
    );

    if (!sellerProfile) {
      return res.status(404).json({
        hasError: true,
        message: "Seller profile not found",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Seller Profile retrieved successfully.",
      data: sellerProfile,
    });
  } catch (error) {
    console.error("Error retrieving Seller Profile:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Failed to retrieve Seller Profile.",
      error: error.message,
    });
  }
}

export default getSellerProfileByEmailId;
