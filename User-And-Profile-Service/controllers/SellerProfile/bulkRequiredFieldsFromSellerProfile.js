// controllers/SellerProfile/bulkRequiredFields.js

import SellerProfile from "../../models/SellerProfile.js";

async function bulkRequiredFieldsFromSellerProfile(req, res) {
  try {
    const ids = req.query.ids?.split(",");
    const fields = req.query.fields || "";

    if (!ids?.length) {
      return res.status(400).json({
        hasError: true,
        message: "Seller IDs are required.",
      });
    }

    const sellers = await SellerProfile.find({
      sellerId: { $in: ids },
    }).select(`sellerId ${fields}`);

    return res.status(200).json({
      hasError: false,
      message: "Seller profiles retrieved.",
      data: sellers,
    });
  } catch (error) {
    console.error("Error in bulkRequiredFields:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Failed to retrieve sellers.",
    });
  }
}

export default bulkRequiredFieldsFromSellerProfile;
