import QuoteRequest from "../../models/QuoteRequest.js";
import Product from "../../models/Product.js";

import {
  getCategoryById,
  getSubCategoriesByIds,
} from "../AxiosRequestService/categoryServiceRequest.js";

async function getFirstProductForAdmin(req, res) {
  try {
    const quoteRequests = await QuoteRequest.find().sort({ createdAt: -1 });

    const responseData = await Promise.all(
      quoteRequests.map(async (quote) => {
        const product = await Product.findOne({
          enquiryNumber: quote.enquiryNumber,
        }).exec();

        let categoryData = null;
        let subCategoryData = null;

        if (product?.categoryId) {
          const categoryRes = await getCategoryById(product.categoryId);
          if (!categoryRes.hasError) {
            categoryData = categoryRes.data || null;
          } else {
            console.error("Failed to fetch category:", categoryRes.error);
          }
        }

        if (product?.subCategoryId) {
          const subCategoryRes = await getSubCategoriesByIds([
            product.subCategoryId,
          ]);
          if (!subCategoryRes.hasError) {
            subCategoryData = subCategoryRes.data?.[0] || null;
          } else {
            console.error("Failed to fetch subcategory:", subCategoryRes.error);
          }
        }

        return {
          id: quote._id,
          schoolId: quote.schoolId,
          enquiryNumber: quote.enquiryNumber,
          deliveryAddress: quote.deliveryAddress,
          deliveryLocation: quote.deliveryLocation,
          deliveryLandMark: quote.deliveryLandMark,
          deliveryPincode: quote.deliveryPincode,
          expectedDeliveryDate: quote.expectedDeliveryDate,
          buyerStatus: quote.buyerStatus,
          supplierStatus: quote.supplierStatus,
          edprowiseStatus: quote.edprowiseStatus,
          createdAt: quote.createdAt,
          updatedAt: quote.updatedAt,
          categoryId: product?.categoryId || null,
          categoryName: categoryData?.categoryName || null,
          subCategoryId: product?.subCategoryId || null,
          subCategoryName: subCategoryData?.subCategoryName || null,
          description: product?.description || null,
          productImages: product?.productImages || [],
          unit: product?.unit || null,
          quantity: product?.quantity || null,
          productEnquiryNumber: product?.enquiryNumber || null,
          productCreatedAt: product?.createdAt || null,
          productUpdatedAt: product?.updatedAt || null,
        };
      })
    );

    return res.status(200).json({
      hasError: false,
      message: "Quote requests retrieved successfully.",
      data: responseData,
    });
  } catch (error) {
    console.error("Error retrieving quote requests:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Failed to retrieve quote requests.",
      error: error.message,
    });
  }
}

export default getFirstProductForAdmin;
