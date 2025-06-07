// Edprowise-Micro-Backend\Procurement-Service\controllers\QuoteProposal\getBySellerId.js

import QuoteProposal from "../../models/QuoteProposal.js";

async function getBySellerId(req, res) {
  try {
    const { sellerId } = req.params;
    const { fields, include } = req.query;

    if (!sellerId) {
      return res.status(400).json({
        hasError: true,
        message: "Seller ID is required.",
      });
    }

    // ===== 1. Base Query =====
    const baseQuery = { sellerId };

    // ===== 2. Dynamic Field Selection =====
    let projection = {};
    if (fields) {
      fields.split(",").forEach((field) => {
        projection[field.trim()] = 1; // { rating: 1, status: 1 }
      });
    }

    // ===== 3. Fetch Data =====
    let data;
    if (include === "ratings") {
      // Return rating stats (for User-Service's getByIdForAdmin)
      data = await QuoteProposal.aggregate([
        { $match: { sellerId, rating: { $ne: null } } },
        {
          $group: {
            _id: null,
            proposals: { $push: "$$ROOT" }, // Keep all proposal data
            totalCount: { $sum: 1 },
            totalRating: { $sum: "$rating" },
          },
        },
        {
          $project: {
            _id: 0,
            proposals: 1,
            averageRating: { $divide: ["$totalRating", "$totalCount"] },
            totalCount: 1,
          },
        },
      ]);
      data = data[0] || { proposals: [], totalCount: 0, averageRating: 0 };
    } else {
      // Return raw proposals (default behavior)
      data = await QuoteProposal.find(baseQuery, projection);
    }

    return res.status(200).json({
      hasError: false,
      message: "Quote Proposal retrieved successfully.",
      data, // Structure varies based on `include`
    });
  } catch (error) {
    console.error("Error retrieving Quote Proposal:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default getBySellerId;
