// Edprowise-Micro-Backend\User-And-Profile-Service\controllers\SellerProfile\getByIdForAdmin.js

import SellerProfile from "../../models/SellerProfile.js";
import Seller from "../../models/Seller.js";

import axios from "axios";

async function getByIdForAdmin(req, res) {
  try {
    const { sellerId } = req.params;

    if (!sellerId) {
      return res.status(401).json({
        hasError: true,
        message: "Seller ID is required",
      });
    }

    const [sellerProfile, seller] = await Promise.all([
      SellerProfile.findOne({ sellerId }).populate(
        "dealingProducts.categoryId dealingProducts.subCategoryIds"
      ),
      Seller.findOne({ _id: sellerId }).select("-password -salt"),
    ]);

    if (!sellerProfile) {
      return res.status(404).json({
        hasError: true,
        message: "Seller Profile not found.",
      });
    }

    if (!seller) {
      return res.status(404).json({
        hasError: true,
        message: "Seller not found.",
      });
    }

    if (sellerProfile.dealingProducts?.length > 0) {
      await Promise.all(
        sellerProfile.dealingProducts.map(async (product) => {
          try {
            // Fetch category name with auth header

            const categoryRes = await axios.get(
              `${process.env.PROCUREMENT_SERVICE_URL}/api/categories/${product.categoryId}`
            );

            if (!categoryRes.data.hasError && categoryRes.data.data) {
              product.categoryName = categoryRes.data.data.categoryName;
            }

            // Fetch subcategory names with auth header
            if (product.subCategoryIds?.length > 0) {
              const subIds = product.subCategoryIds
                .map((id) => id.toString())
                .join(",");

              const subRes = await axios.get(
                `${process.env.PROCUREMENT_SERVICE_URL}/api/subcategories?ids=${subIds}`
              );

              if (!subRes.data.hasError && subRes.data.data) {
                product.subCategoryName = subRes.data.data.map(
                  (sub) => sub.subCategoryName
                );
              }
            }
          } catch (error) {
            console.error("Error fetching category data:", error.message);
          }
        })
      );
    }

    let totalCount = 0;
    let averageRating = 0;

    try {
      const response = await axios.get(
        `${process.env.PROCUREMENT_SERVICE_URL}/api/quote-proposal-by-seller-id/${sellerId}?include=ratings`
      );

      if (!response.data.hasError && response.data.data) {
        totalCount = response.data.data.totalCount || 0;
        averageRating = response.data.data.averageRating || 0;
      }
    } catch (error) {
      console.error(
        "Failed to fetch ratings from Procurement-Service:",
        error.message
      );
      // Proceed with default values (0) if the service fails
    }

    // Format response according to your required structure
    const responseData = {
      _id: seller._id,
      sellerId: sellerProfile.sellerId,
      randomId: seller.randomId,
      companyName: sellerProfile.companyName,
      companyType: sellerProfile.companyType,
      gstin: sellerProfile.gstin,
      pan: sellerProfile.pan,
      tan: sellerProfile.tan,
      cin: sellerProfile.cin,
      address: sellerProfile.address,
      city: sellerProfile.city,
      state: sellerProfile.state,
      country: sellerProfile.country,
      landmark: sellerProfile.landmark,
      pincode: sellerProfile.pincode,
      contactNo: sellerProfile.contactNo,
      alternateContactNo: sellerProfile.alternateContactNo,
      emailId: sellerProfile.emailId,
      sellerProfile: sellerProfile.sellerProfile,
      signature: sellerProfile.signature,
      panFile: sellerProfile.panFile,
      gstFile: sellerProfile.gstFile,
      tanFile: sellerProfile.tanFile,
      cinFile: sellerProfile.cinFile,
      accountNo: sellerProfile.accountNo,
      ifsc: sellerProfile.ifsc,
      accountHolderName: sellerProfile.accountHolderName,
      bankName: sellerProfile.bankName,
      branchName: sellerProfile.branchName,
      noOfEmployees: sellerProfile.noOfEmployees,
      ceoName: sellerProfile.ceoName,
      turnover: sellerProfile.turnover,
      dealingProducts: sellerProfile.dealingProducts.map((product) => ({
        categoryId: product.categoryId,
        categoryName: product.categoryName || null,
        subCategoryIds: product.subCategoryIds,
        subCategoryNames: product.subCategoryName || [], // Fixed property name
        _id: product._id,
      })),
      totalCount,
      averageRating: averageRating.toFixed(1),
    };

    return res.status(200).json({
      hasError: false,
      message: "Seller profile retrieved successfully.",
      data: responseData,
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

export default getByIdForAdmin;
