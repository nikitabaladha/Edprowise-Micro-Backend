import {
  getCategoriesByIds,
  getSubCategoriesByIds,
} from "../AxiosRequestService/categoryServiceRequest.js";

import { getSellerByDealingProducts } from "../AxiosRequestService/userServiceRequest.js";

import { getOrderFromBuyerByEnquiryNumbers } from "../AxiosRequestService/orderServiceRequest.js";

import { fetchSubmitQuoteBySellerIdAndEnqNos } from "../AxiosRequestService/quoteProposalServiceRequest.js";

import QuoteRequest from "../../models/QuoteRequest.js";
import Product from "../../models/Product.js";

async function getProductsForSeller(req, res) {
  try {
    const sellerId = req.user?.id;

    if (!sellerId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to request for a quote.",
      });
    }

    // 1. Fetch seller profile
    const sellerProfileResponse = await getSellerByDealingProducts(sellerId);
    if (sellerProfileResponse.hasError || !sellerProfileResponse.data) {
      return res.status(404).json({
        hasError: true,
        message: "Seller profile not found.",
        error: sellerProfileResponse.error || "Unknown error",
      });
    }
    const sellerProfile = sellerProfileResponse.data;

    const productMatchConditions = sellerProfile.dealingProducts.flatMap(
      (product) =>
        product.subCategoryIds.map((subCategoryId) => ({
          categoryId: product.categoryId,
          subCategoryId,
        }))
    );

    const queryConditions = {
      $or: productMatchConditions.map((condition) => ({
        categoryId: condition.categoryId,
        subCategoryId: condition.subCategoryId,
      })),
    };

    const products = await Product.find(queryConditions).sort({
      createdAt: -1,
    });

    const categoryIds = [...new Set(products.map((p) => p.categoryId))];
    const subCategoryIds = [...new Set(products.map((p) => p.subCategoryId))];

    // 2. Fetch categories
    const [categoriesResponse, subCategoriesResponse] = await Promise.all([
      getCategoriesByIds(categoryIds),
      getSubCategoriesByIds(subCategoryIds),
    ]);

    const categories = categoriesResponse.hasError
      ? []
      : categoriesResponse.data || [];

    const subCategories = subCategoriesResponse.hasError
      ? []
      : subCategoriesResponse.data || [];

    const categoryMap = categories.reduce((acc, category) => {
      acc[category._id] = category;
      return acc;
    }, {});

    const subCategoryMap = subCategories.reduce((acc, subCategory) => {
      acc[subCategory._id] = subCategory;
      return acc;
    }, {});

    const enquiryNumbers = [...new Set(products.map((p) => p.enquiryNumber))];

    // 3. Fetch orders
    const ordersResponse = await getOrderFromBuyerByEnquiryNumbers(
      enquiryNumbers,
      "enquiryNumber,subCategoryId,sellerId"
    );
    const orders = ordersResponse.hasError ? [] : ordersResponse.data || [];

    const orderMap = new Map();
    orders.forEach((order) => {
      const key = `${order.enquiryNumber}-${order.subCategoryId}`;
      if (!orderMap.has(key)) {
        orderMap.set(key, new Set());
      }
      orderMap.get(key).add(order.sellerId.toString());
    });

    // 4. Fetch quote requests
    const quoteRequests = await QuoteRequest.find();
    const quoteRequestsMap = quoteRequests.reduce((acc, quoteRequest) => {
      acc[quoteRequest.enquiryNumber] = {
        id: quoteRequest._id,
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
        enquiryNumber: quoteRequest.enquiryNumber,
      };
      return acc;
    }, {});

    // 5. Fetch submitted quotes
    const quotesResponse = await fetchSubmitQuoteBySellerIdAndEnqNos(
      sellerId,
      enquiryNumbers,
      "enquiryNumber,venderStatusFromBuyer,rejectCommentFromBuyer"
    );
    const submittedQuotes = quotesResponse.hasError
      ? []
      : quotesResponse.data || [];

    const submittedQuotesMap = submittedQuotes.reduce((acc, quote) => {
      acc[quote.enquiryNumber] = quote;
      return acc;
    }, {});

    // 6. Process products
    const filteredProducts = [];
    const seenEnquiryNumbers = new Set();

    for (const product of products) {
      const key = `${product.enquiryNumber}-${product.subCategoryId}`;
      const sellerIdsForKey = orderMap.get(key) || new Set();

      const isExcluded =
        sellerIdsForKey.size > 0 && !sellerIdsForKey.has(sellerId.toString());

      if (!isExcluded && !seenEnquiryNumbers.has(product.enquiryNumber)) {
        seenEnquiryNumbers.add(product.enquiryNumber);

        const existingSubmittedQuote =
          submittedQuotesMap[product.enquiryNumber];

        filteredProducts.push({
          id: product._id,
          schoolId: product.schoolId,
          categoryId: product.categoryId || null,
          categoryName: categoryMap[product.categoryId]?.categoryName || null,
          subCategoryId: product.subCategoryId || null,
          subCategoryName:
            subCategoryMap[product.subCategoryId]?.subCategoryName || null,
          description: product.description,
          productImages: product.productImages || [],
          unit: product.unit,
          quantity: product.quantity,
          enquiryNumber: product.enquiryNumber,
          quoteRequestId: quoteRequestsMap[product.enquiryNumber]?.id || null,
          deliveryAddress:
            quoteRequestsMap[product.enquiryNumber]?.deliveryAddress || null,
          deliveryLocation:
            quoteRequestsMap[product.enquiryNumber]?.deliveryLocation || null,
          deliveryLandMark:
            quoteRequestsMap[product.enquiryNumber]?.deliveryLandMark || null,
          deliveryPincode:
            quoteRequestsMap[product.enquiryNumber]?.deliveryPincode || null,
          expectedDeliveryDate:
            quoteRequestsMap[product.enquiryNumber]?.expectedDeliveryDate ||
            null,
          buyerStatus:
            quoteRequestsMap[product.enquiryNumber]?.buyerStatus || null,
          supplierStatus:
            quoteRequestsMap[product.enquiryNumber]?.supplierStatus || null,
          edprowiseStatus:
            quoteRequestsMap[product.enquiryNumber]?.edprowiseStatus || null,
          createdAt: quoteRequestsMap[product.enquiryNumber]?.createdAt || null,
          updatedAt: quoteRequestsMap[product.enquiryNumber]?.updatedAt || null,
          venderStatusFromBuyer:
            existingSubmittedQuote?.venderStatusFromBuyer || null,
          rejectCommentFromBuyer:
            existingSubmittedQuote?.rejectCommentFromBuyer || null,
        });
      }
    }

    return res.status(200).json({
      hasError: false,
      message: "Data fetched successfully.",
      data: filteredProducts,
    });
  } catch (error) {
    console.error("Error fetching products for seller:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Failed to fetch data.",
      error: error.message,
    });
  }
}

export default getProductsForSeller;
