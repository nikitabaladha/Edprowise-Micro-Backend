import SellerProfile from "../../models/SellerProfile.js";

async function sellersByProducts(req, res) {
  try {
    const { categoryIds, subCategoryIds } = req.body;

    const sellers = await SellerProfile.find({
      "dealingProducts.categoryId": { $in: categoryIds },
      "dealingProducts.subCategoryIds": { $in: subCategoryIds },
    }).populate("dealingProducts.categoryId dealingProducts.subCategoryIds");

    return res.status(200).json({
      hasError: false,
      message: "Seller profiles retrieved successfully.",
      data: sellers,
    });
  } catch (error) {
    console.error("Error retrieving Seller Profiles:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Failed to retrieve Seller Profiles.",
      error: error.message,
    });
  }
}

export default sellersByProducts;
