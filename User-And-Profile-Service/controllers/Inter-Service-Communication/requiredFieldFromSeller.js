// Edprowise-Micro-Backend\User-And-Profile-Service\controllers\SchoolRegistration\requiredFieldFromSchoolProfile.js

import Seller from "../../models/Seller.js";

async function requiredFieldFromSeller(req, res) {
  try {
    const seller = await Seller.findOne({
      userId: req.params.userId,
    }).select(req.query.fields || "");

    if (!seller) {
      return res.status(404).json({
        hasError: true,
        message: "Seller not found",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Seller retrieved successfully.",
      data: user,
    });
  } catch (error) {
    console.error("Error retrieving Seller:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Failed to retrieve Seller.",
      error: error.message,
    });
  }
}

export default requiredFieldFromSeller;
