// Edprowise-Micro-Backend\User-And-Profile-Service\controllers\SellerProfile\requiredFieldFromSellerProfile.js

import SellerProfile from "../../models/SellerProfile.js";

async function requiredFieldFromSellerProfile(req, res) {
  try {
    const seller = await SellerProfile.findOne({
      sellerId: req.params.sellerId,
    }).select(req.query.fields || "");

    if (!seller) {
      return res.status(404).json({
        hasError: true,
        message: "Seller not found",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Seller profile retrieved successfully.",
      data: seller,
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

export default requiredFieldFromSellerProfile;
