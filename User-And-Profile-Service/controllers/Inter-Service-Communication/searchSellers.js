// sellerController.js
import SellerProfile from "../../models/SellerProfile.js";
import mongoose from "mongoose";

async function searchSellers(req, res) {
  const { query } = req.query;

  try {
    const baseCondition = { status: { $in: ["Pending", "Completed"] } };

    const conditions = [
      { companyName: query, ...baseCondition },
      { emailId: query, ...baseCondition },
      { contactNo: query, ...baseCondition },
      { randomId: query, ...baseCondition },
    ];

    if (mongoose.Types.ObjectId.isValid(query)) {
      conditions.push({
        sellerId: new mongoose.Types.ObjectId(query),
        ...baseCondition,
      });
    }

    const matches = await SellerProfile.find({ $or: conditions }).populate(
      "sellerId"
    );

    return res.json({
      hasError: false,
      data: matches,
    });
  } catch (error) {
    console.error("Error in searchSellers:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error while searching sellers",
      error: error.message,
    });
  }
}

export default searchSellers;
