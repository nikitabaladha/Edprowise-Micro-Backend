import QuoteRequest from "../../models/QuoteRequest.js";
import Product from "../../models/Product.js";

import axios from "axios";

async function getBySchoolId(req, res) {
  const schoolId = req.user?.schoolId;

  if (!schoolId) {
    return res.status(401).json({
      hasError: true,
      message:
        "Access denied: You do not have permission to view quote requests.",
    });
  }

  try {
    const quoteRequests = await QuoteRequest.find({ schoolId })
      .sort({ createdAt: -1 })
      .exec();

    const responseData = await Promise.all(
      quoteRequests.map(async (quote) => {
        const products = await Product.find({
          enquiryNumber: quote.enquiryNumber,
        }).exec();

        // Get only the first product if available
        const firstProduct = products.length > 0 ? products[0] : null;

        let categoryName = null;
        let subCategoryName = null;

        if (firstProduct) {
          try {
            // Fetch category data
            if (firstProduct.categoryId) {
              const categoryResponse = await axios.get(
                `${process.env.PROCUREMENT_CATEGORY_SERVICE_URL}/api/categories/${firstProduct.categoryId}`
              );
              categoryName = categoryResponse.data.data?.categoryName || null;
            }

            // Fetch subcategory data
            if (firstProduct.subCategoryId) {
              const subCategoryResponse = await axios.get(
                `${process.env.PROCUREMENT_CATEGORY_SERVICE_URL}/api/subcategories?ids=${firstProduct.subCategoryId}`
              );
              subCategoryName =
                subCategoryResponse.data.data?.[0]?.subCategoryName || null;
            }
          } catch (error) {
            console.error("Error fetching category/subcategory data:", {
              message: error.message,
              response: error.response?.data,
              status: error.response?.status,
              config: error.config,
            });
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
          // product fields
          categoryId: firstProduct ? firstProduct.categoryId : null,
          categoryName: categoryName,
          subCategoryId: firstProduct ? firstProduct.subCategoryId : null,
          subCategoryName: subCategoryName,
          description: firstProduct ? firstProduct.description : null,
          productImages: firstProduct ? firstProduct.productImages : [],
          unit: firstProduct ? firstProduct.unit : null,
          quantity: firstProduct ? firstProduct.quantity : null,
          productEnquiryNumber: firstProduct
            ? firstProduct.enquiryNumber
            : null,
          productCreatedAt: firstProduct ? firstProduct.createdAt : null,
          productUpdatedAt: firstProduct ? firstProduct.updatedAt : null,
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

export default getBySchoolId;
