import SellerProfile from "../../models/SellerProfile.js";

async function sellerByDealingProducts(req, res) {
  try {
    const seller = await SellerProfile.findOne({
      sellerId: req.params.sellerId,
    })
      .populate("dealingProducts.categoryId")
      .populate("dealingProducts.subCategoryIds");

    if (!seller) {
      return res.status(404).json({
        hasError: true,
        message: "Seller profile not found",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Seller profile retrieved successfully.",
      data: seller,
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

export default sellerByDealingProducts;
