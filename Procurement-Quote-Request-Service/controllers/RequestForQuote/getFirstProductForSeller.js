// import axios from "axios";

// import QuoteRequest from "../../models/QuoteRequest.js";
// import Product from "../../models/Product.js";

// // import SubmitQuote from "../../models/SubmitQuote.js";

// // import OrderFromBuyer from "../../models/OrderFromBuyer.js";

// async function getProductsForSeller(req, res) {
//   try {
//     const sellerId = req.user?.id;

//     if (!sellerId) {
//       return res.status(401).json({
//         hasError: true,
//         message:
//           "Access denied: You do not have permission to request for a quote.",
//       });
//     }

//     let sellerProfile;
//     try {
//       const response = await axios.get(
//         `${process.env.USER_SERVICE_URL}/api/seller-by-dealing-products/${sellerId}`
//       );
//       sellerProfile = response.data.data;

//       if (!sellerProfile) {
//         return res.status(404).json({
//           hasError: true,
//           message: "Seller profile not found.",
//         });
//       }
//     } catch (error) {
//       console.error("Error fetching seller profile:", {
//         message: error.message,
//         response: error.response?.data,
//         status: error.response?.status,
//         config: error.config,
//       });
//       return res.status(error.response?.status || 500).json({
//         hasError: true,
//         message: "Failed to fetch seller profile",
//         error: error.message,
//       });
//     }

//     // Create an array of conditions for category and subcategory matches
//     const productMatchConditions = sellerProfile.dealingProducts.flatMap(
//       (product) => {
//         return product.subCategoryIds.map((subCategoryId) => ({
//           categoryId: product.categoryId,
//           subCategoryId: subCategoryId,
//         }));
//       }
//     );

//     // Build the query

//     const queryConditions = {
//       $or: productMatchConditions.map((condition) => ({
//         categoryId: condition.categoryId,
//         subCategoryId: condition.subCategoryId,
//       })),
//     };

//     // Find all products matching the seller's profile
//     const products = await Product.find(queryConditions).sort({
//       createdAt: -1,
//     });

//     const categoryIds = [...new Set(products.map((p) => p.categoryId))];
//     const subCategoryIds = [...new Set(products.map((p) => p.subCategoryId))];

//     let categories = [];
//     let subCategories = [];

//     try {
//       // Fetch categories in bulk
//       const categoriesResponse = await axios.get(
//         `${process.env.PROCUREMENT_CATEGORY_SERVICE_URL}/api/categories-by-ids`,
//         { params: { ids: categoryIds.join(",") } }
//       );
//       categories = categoriesResponse.data.data || [];

//       // Fetch subcategories in bulk
//       const subCategoriesResponse = await axios.get(
//         `${process.env.PROCUREMENT_CATEGORY_SERVICE_URL}/api/subcategories`,
//         { params: { ids: subCategoryIds.join(",") } }
//       );
//       subCategories = subCategoriesResponse.data.data || [];
//     } catch (error) {
//       console.error("Error fetching categories/subcategories:", error.message);
//       // Continue with empty arrays - names will be null
//     }

//     const categoryMap = categories.reduce((acc, category) => {
//       acc[category._id] = category;
//       return acc;
//     }, {});

//     const subCategoryMap = subCategories.reduce((acc, subCategory) => {
//       acc[subCategory._id] = subCategory;
//       return acc;
//     }, {});

//     const enquiryNumbers = [...new Set(products.map((p) => p.enquiryNumber))];

//     // Fetch all orders for these enquiry numbers
//     const orders = await OrderFromBuyer.find({
//       enquiryNumber: { $in: enquiryNumbers },
//     }).populate("subCategoryId");

//     // Create a map: key -> (enquiryNumber-subCategoryId), value -> Set of sellerIds
//     const orderMap = new Map();
//     orders.forEach((order) => {
//       const key = `${order.enquiryNumber}-${order.subCategoryId._id}`;
//       if (!orderMap.has(key)) {
//         orderMap.set(key, new Set());
//       }
//       orderMap.get(key).add(order.sellerId.toString());
//     });

//     // Fetch all quote requests
//     const quoteRequests = await QuoteRequest.find();
//     const quoteRequestsMap = quoteRequests.reduce((acc, quoteRequest) => {
//       acc[quoteRequest.enquiryNumber] = {
//         id: quoteRequest._id,
//         deliveryAddress: quoteRequest.deliveryAddress,
//         deliveryLocation: quoteRequest.deliveryLocation,
//         deliveryLandMark: quoteRequest.deliveryLandMark,
//         deliveryPincode: quoteRequest.deliveryPincode,
//         expectedDeliveryDate: quoteRequest.expectedDeliveryDate,
//         buyerStatus: quoteRequest.buyerStatus,
//         supplierStatus: quoteRequest.supplierStatus,
//         edprowiseStatus: quoteRequest.edprowiseStatus,
//         createdAt: quoteRequest.createdAt,
//         updatedAt: quoteRequest.updatedAt,
//         enquiryNumber: quoteRequest.enquiryNumber,
//       };
//       return acc;
//     }, {});

//     const filteredProducts = [];
//     const seenEnquiryNumbers = new Set();

//     for (const product of products) {
//       const key = `${product.enquiryNumber}-${product.subCategoryId._id}`;
//       const sellerIdsForKey = orderMap.get(key) || new Set();

//       // Exclude only if someone else placed an order AND this seller did not
//       const isExcluded =
//         sellerIdsForKey.size > 0 && !sellerIdsForKey.has(sellerId.toString());

//       if (!isExcluded && !seenEnquiryNumbers.has(product.enquiryNumber)) {
//         seenEnquiryNumbers.add(product.enquiryNumber);

//         const existingSubmittedQuote = await SubmitQuote.findOne({
//           enquiryNumber: product.enquiryNumber,
//           sellerId,
//         });

//         filteredProducts.push({
//           id: product._id,
//           schoolId: product.schoolId,
//           categoryId: product.categoryId?._id || null,
//           categoryName: product.categoryId?.categoryName || null,
//           subCategoryId: product.subCategoryId?._id || null,
//           subCategoryName: product.subCategoryId?.subCategoryName || null,
//           description: product.description,
//           productImages: product.productImages || [],
//           unit: product.unit,
//           quantity: product.quantity,
//           enquiryNumber: product.enquiryNumber,
//           quoteRequestId: quoteRequestsMap[product.enquiryNumber]?.id || null,
//           deliveryAddress:
//             quoteRequestsMap[product.enquiryNumber]?.deliveryAddress || null,
//           deliveryLocation:
//             quoteRequestsMap[product.enquiryNumber]?.deliveryLocation || null,
//           deliveryLandMark:
//             quoteRequestsMap[product.enquiryNumber]?.deliveryLandMark || null,
//           deliveryPincode:
//             quoteRequestsMap[product.enquiryNumber]?.deliveryPincode || null,
//           expectedDeliveryDate:
//             quoteRequestsMap[product.enquiryNumber]?.expectedDeliveryDate ||
//             null,
//           buyerStatus:
//             quoteRequestsMap[product.enquiryNumber]?.buyerStatus || null,
//           supplierStatus:
//             quoteRequestsMap[product.enquiryNumber]?.supplierStatus || null,
//           edprowiseStatus:
//             quoteRequestsMap[product.enquiryNumber]?.edprowiseStatus || null,
//           createdAt: quoteRequestsMap[product.enquiryNumber]?.createdAt || null,
//           updatedAt: quoteRequestsMap[product.enquiryNumber]?.updatedAt || null,
//           venderStatusFromBuyer:
//             existingSubmittedQuote?.venderStatusFromBuyer || null,
//           rejectCommentFromBuyer:
//             existingSubmittedQuote?.rejectCommentFromBuyer || null,
//         });
//       }
//     }

//     return res.status(200).json({
//       hasError: false,
//       message: "Data fetched successfully.",
//       data: filteredProducts,
//     });
//   } catch (error) {
//     console.error("Error fetching products for seller:", error.message);
//     return res.status(500).json({
//       hasError: true,
//       message: "Failed to fetch data.",
//       error: error.message,
//     });
//   }
// }

// export default getProductsForSeller;

import axios from "axios";
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

    // 1. Fetch seller profile (from user service)
    let sellerProfile;
    try {
      const response = await axios.get(
        `${process.env.USER_SERVICE_URL}/api/seller-by-dealing-products/${sellerId}`
      );
      sellerProfile = response.data.data;

      if (!sellerProfile) {
        return res.status(404).json({
          hasError: true,
          message: "Seller profile not found.",
        });
      }
    } catch (error) {
      console.error("Error fetching seller profile:", error.message);
      return res.status(error.response?.status || 500).json({
        hasError: true,
        message: "Failed to fetch seller profile",
        error: error.message,
      });
    }

    // Create product match conditions (same as before)
    const productMatchConditions = sellerProfile.dealingProducts.flatMap(
      (product) => {
        return product.subCategoryIds.map((subCategoryId) => ({
          categoryId: product.categoryId,
          subCategoryId: subCategoryId,
        }));
      }
    );

    // Build the query (same as before)
    const queryConditions = {
      $or: productMatchConditions.map((condition) => ({
        categoryId: condition.categoryId,
        subCategoryId: condition.subCategoryId,
      })),
    };

    // 2. Find products (local service) - remove populate calls
    const products = await Product.find(queryConditions).sort({
      createdAt: -1,
    });

    // 3. Fetch categories and subcategories from external service
    const categoryIds = [...new Set(products.map((p) => p.categoryId))];
    const subCategoryIds = [...new Set(products.map((p) => p.subCategoryId))];

    let categories = [];
    let subCategories = [];

    try {
      // Fetch categories in bulk
      const categoriesResponse = await axios.get(
        `${process.env.PROCUREMENT_CATEGORY_SERVICE_URL}/api/categories-by-ids`,
        { params: { ids: categoryIds.join(",") } }
      );
      categories = categoriesResponse.data.data || [];

      // Fetch subcategories in bulk
      const subCategoriesResponse = await axios.get(
        `${process.env.PROCUREMENT_CATEGORY_SERVICE_URL}/api/subcategories`,
        { params: { ids: subCategoryIds.join(",") } }
      );
      subCategories = subCategoriesResponse.data.data || [];
    } catch (error) {
      console.error("Error fetching categories/subcategories:", error.message);
      // Continue with empty arrays - names will be null
    }

    // Create lookup maps
    const categoryMap = categories.reduce((acc, category) => {
      acc[category._id] = category;
      return acc;
    }, {});

    const subCategoryMap = subCategories.reduce((acc, subCategory) => {
      acc[subCategory._id] = subCategory;
      return acc;
    }, {});

    const enquiryNumbers = [...new Set(products.map((p) => p.enquiryNumber))];

    // 4. Fetch orders (from procurement-order-service)
    let orders = [];
    try {
      const ordersResponse = await axios.get(
        `${process.env.PROCUREMENT_ORDER_SERVICE_URL}/api/get-order-from-buyer`,
        {
          params: {
            enquiryNumbers: enquiryNumbers.join(","),
            fields: "enquiryNumber,subCategoryId,sellerId",
          },
        }
      );
      orders = ordersResponse.data.data || [];
    } catch (error) {
      console.error("Error fetching orders:", error.message);
      // Continue with empty array
    }

    // Create order map (modified to work with raw IDs)
    const orderMap = new Map();
    orders.forEach((order) => {
      const key = `${order.enquiryNumber}-${order.subCategoryId}`;
      if (!orderMap.has(key)) {
        orderMap.set(key, new Set());
      }
      orderMap.get(key).add(order.sellerId.toString());
    });

    // 5. Fetch quote requests (local service)
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

    // 6. Fetch submitted quotes (from procurement-quote-proposal service)
    let submittedQuotes = [];
    try {
      const quotesResponse = await axios.get(
        `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/submitquote-by-Sellerid-and-enq-nos`,
        {
          params: {
            sellerId,
            enquiryNumbers: enquiryNumbers.join(","),
            fields:
              "enquiryNumber,venderStatusFromBuyer,rejectCommentFromBuyer",
          },
        }
      );
      submittedQuotes = quotesResponse.data.data || [];
    } catch (error) {
      console.error("Error fetching submitted quotes:", error.message);
      // Continue with empty array
    }

    // Create submitted quotes map
    const submittedQuotesMap = submittedQuotes.reduce((acc, quote) => {
      acc[quote.enquiryNumber] = quote;
      return acc;
    }, {});

    // Process products (same logic as before)
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
