// Edprowise-Micro-Backend\User-And-Profile-Service\controllers\SellerProfile\bulkRequiredFieldsFromSellerProfile.js

import SellerProfile from "../../models/SellerProfile.js";

async function getRequiredFieldsBySellerIds(req, res) {
  try {
    const { sellerIds, fields } = req.query;
    if (!sellerIds) {
      return res.status(400).json({
        hasError: true,
        message: "sellerIds are required",
      });
    }

    const sellerIdArray = sellerIds.split(",").map((id) => id.trim());

    let projection = {};
    if (fields?.trim()) {
      fields.split(",").forEach((field) => {
        projection[field.trim()] = 1;
      });
    }

    const sellerProfile = await SellerProfile.find({
      sellerId: { $in: sellerIdArray },
    }).select(projection);

    return res.status(200).json({
      hasError: false,
      data: sellerProfile,
    });
  } catch (error) {
    return res.status(500).json({ hasError: true, message: "Server error" });
  }
}

export default getRequiredFieldsBySellerIds;
