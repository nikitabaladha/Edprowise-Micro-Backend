import Seller from "../../models/Seller.js";

import mongoose from "mongoose";

async function getSellerById(req, res) {
  try {
    const { _id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({
        hasError: true,
        message: "Invalid seller ID format.",
      });
    }

    const seller = await Seller.findById(_id).select(req.query.fields || "");

    if (!seller) {
      return res.status(404).json({
        hasError: true,
        message: "Seller not found",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Seller retrieved successfully.",
      data: seller,
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

export default getSellerById;
