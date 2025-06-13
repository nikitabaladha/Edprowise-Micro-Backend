import SellerProfile from "../../models/SellerProfile.js";
import Seller from "../../models/Seller.js";

import {
  getCategoryById,
  getSubCategoriesByIds,
} from "../AxiosRequestService/categoryServiceRequest.js";

import { getQuoteProposalBySellerId } from "../AxiosRequestService/quoteProposalServiceRequest.js";

async function getById(req, res) {
  try {
    const sellerId = req.user?.id;

    if (!sellerId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Seller ID is missing in authentication.",
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
            const categoryRes = await getCategoryById(product.categoryId);
            if (!categoryRes.hasError && categoryRes.data) {
              product.categoryName = categoryRes.data.categoryName;
            }

            if (product.subCategoryIds?.length > 0) {
              const subRes = await getSubCategoriesByIds(
                product.subCategoryIds
              );
              if (!subRes.hasError && subRes.data) {
                product.subCategoryName = subRes.data.map(
                  (sub) => sub.subCategoryName
                );
              }
            }
          } catch (error) {
            console.error("Error enriching dealing products:", error.message);
          }
        })
      );
    }

    let totalCount = 0;
    let averageRating = 0;
    try {
      const ratingRes = await getQuoteProposalBySellerId(sellerId, {
        include: "ratings",
      });

      if (!ratingRes.hasError && ratingRes.data) {
        totalCount = ratingRes.data.totalCount || 0;
        averageRating = ratingRes.data.averageRating || 0;
      }
    } catch (error) {
      console.error(
        "Failed to fetch ratings from Procurement-Service:",
        error.message
      );
    }

    const responseData = {
      _id: seller._id,
      sellerId: sellerProfile.sellerId,
      randomId: seller.randomId,
      userId: seller?.userId,
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
        subCategoryNames: product.subCategoryName || [],
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

export default getById;
