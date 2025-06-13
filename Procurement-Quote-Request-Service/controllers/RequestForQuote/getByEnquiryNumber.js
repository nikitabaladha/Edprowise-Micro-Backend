import Product from "../../models/Product.js";
import QuoteRequest from "../../models/QuoteRequest.js";

import {
  getCategoryById,
  getSubCategoriesByIds,
} from "../AxiosRequestService/categoryServiceRequest.js";

async function getByEnquiryNumber(req, res) {
  try {
    const { enquiryNumber } = req.params;
    const quoteRequest = await QuoteRequest.findOne({ enquiryNumber });

    if (!quoteRequest) {
      return res.status(404).json({
        hasError: true,
        message: "Quote request not found.",
      });
    }

    const products = await Product.find({ enquiryNumber });

    const formattedProducts = [];

    for (const product of products) {
      let categoryName = null;
      let subCategoryName = null;

      if (product.categoryId) {
        const categoryResponse = await getCategoryById(product.categoryId);
        if (!categoryResponse.hasError) {
          categoryName = categoryResponse.data?.categoryName || null;
        } else {
          console.error(
            `Error fetching category for ${product.categoryId}:`,
            categoryResponse.error
          );
        }
      }

      if (product.subCategoryId) {
        const subCategoryResponse = await getSubCategoriesByIds([
          product.subCategoryId,
        ]);
        if (!subCategoryResponse.hasError) {
          subCategoryName =
            subCategoryResponse.data?.[0]?.subCategoryName || null;
        } else {
          console.error(
            `Error fetching subcategory for ${product.subCategoryId}:`,
            subCategoryResponse.error
          );
        }
      }

      formattedProducts.push({
        id: product._id,
        schoolId: product.schoolId,
        categoryId: product.categoryId || null,
        categoryName,
        subCategoryId: product.subCategoryId || null,
        subCategoryName,
        description: product.description,
        productImages: product.productImages || [],
        unit: product.unit,
        quantity: product.quantity,
        enquiryNumber: product.enquiryNumber,
        quoteRequestId: quoteRequest._id,
        deliveryAddress: quoteRequest.deliveryAddress,
        deliveryLocation: quoteRequest.deliveryLocation,
        deliveryLandMark: quoteRequest.deliveryLandMark,
        deliveryPincode: quoteRequest.deliveryPincode,
        expectedDeliveryDate: quoteRequest.expectedDeliveryDate,
        buyerStatus: quoteRequest.buyerStatus,
        supplierStatus: quoteRequest.supplierStatus,
        edprowiseStatus: quoteRequest.edprowiseStatus,
        createdAt: quoteRequest.createdAt,
        updatedAt: quoteRequest.updatedAt,
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Data fetched successfully.",
      data: {
        products: formattedProducts,
      },
    });
  } catch (error) {
    console.error("Error fetching data by enquiry number:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Failed to fetch data.",
      error: error.message,
    });
  }
}

export default getByEnquiryNumber;
