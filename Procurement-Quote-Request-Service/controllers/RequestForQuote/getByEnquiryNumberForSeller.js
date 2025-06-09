// import QuoteRequest from "../../models/QuoteRequest.js";
// import Product from "../../models/Product.js";

// // import OrderFromBuyer from "../../models/OrderFromBuyer.js";

// import axios from "axios";

// async function getByEnquiryNumberForSeller(req, res) {
//   try {
//     const sellerId = req.user?.id;

//     if (!sellerId) {
//       return res.status(401).json({
//         hasError: true,
//         message:
//           "Access denied: You do not have permission to request for a quote.",
//       });
//     }

//     const { enquiryNumber } = req.params;

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

//     // Build category + subcategory match conditions
//     const productMatchConditions = sellerProfile.dealingProducts.flatMap(
//       (product) =>
//         product.subCategoryIds.map((subCategoryId) => ({
//           categoryId: product.categoryId,
//           subCategoryId: subCategoryId,
//         }))
//     );

//     const queryConditions = {
//       $or: productMatchConditions.map((condition) => ({
//         categoryId: condition.categoryId,
//         subCategoryId: condition.subCategoryId,
//       })),
//     };

//     if (enquiryNumber) {
//       queryConditions.enquiryNumber = enquiryNumber;
//     }

//     const products = await Product.find(queryConditions)
//       .populate({ path: "categoryId", select: "categoryName edprowiseMargin" })
//       .populate({ path: "subCategoryId", select: "subCategoryName" });

//     const enquiryNumbers = [...new Set(products.map((p) => p.enquiryNumber))];

//     const orders = await OrderFromBuyer.find({
//       enquiryNumber: { $in: enquiryNumbers },
//     });

//     // Map: key = enquiryNumber-subCategoryId, value = array of sellerIds who placed orders
//     const orderMap = new Map();
//     orders.forEach((order) => {
//       const key = `${order.enquiryNumber}-${order.subCategoryId}`;
//       if (!orderMap.has(key)) {
//         orderMap.set(key, []);
//       }
//       orderMap.get(key).push(order.sellerId.toString());
//     });

//     // ✅ Filter products: include only if no one ordered OR current seller has ordered
//     const filteredProducts = products.filter((product) => {
//       const key = `${product.enquiryNumber}-${product.subCategoryId._id}`;
//       const sellerIds = orderMap.get(key);

//       if (!sellerIds || sellerIds.includes(sellerId.toString())) {
//         return true; // include
//       }

//       return false; // exclude
//     });

//     // Map quoteRequests by enquiryNumber
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

//     const formattedProducts = filteredProducts.map((product) => {
//       const quoteRequest = quoteRequestsMap[product.enquiryNumber] || null;

//       return {
//         id: product._id,
//         schoolId: product.schoolId,
//         categoryId: product.categoryId?._id || null,
//         edprowiseMargin: product.categoryId?.edprowiseMargin || null,
//         categoryName: product.categoryId?.categoryName || null,
//         subCategoryId: product.subCategoryId?._id || null,
//         subCategoryName: product.subCategoryId?.subCategoryName || null,
//         description: product.description,
//         productImages: product.productImages || [],
//         unit: product.unit,
//         quantity: product.quantity,
//         enquiryNumber: product.enquiryNumber,
//         quoteRequestId: quoteRequest?.id || null,
//         deliveryAddress: quoteRequest?.deliveryAddress || null,
//         deliveryLocation: quoteRequest?.deliveryLocation || null,
//         deliveryLandMark: quoteRequest?.deliveryLandMark || null,
//         deliveryPincode: quoteRequest?.deliveryPincode || null,
//         expectedDeliveryDate: quoteRequest?.expectedDeliveryDate || null,
//         buyerStatus: quoteRequest?.buyerStatus || null,
//         supplierStatus: quoteRequest?.supplierStatus || null,
//         edprowiseStatus: quoteRequest?.edprowiseStatus || null,
//         createdAt: quoteRequest?.createdAt || null,
//         updatedAt: quoteRequest?.updatedAt || null,
//       };
//     });

//     return res.status(200).json({
//       hasError: false,
//       message: "Data fetched successfully.",
//       data: {
//         products: formattedProducts,
//       },
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

// export default getByEnquiryNumberForSeller;

import QuoteRequest from "../../models/QuoteRequest.js";
import Product from "../../models/Product.js";
import axios from "axios";

async function getByEnquiryNumberForSeller(req, res) {
  try {
    const sellerId = req.user?.id;

    if (!sellerId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to request for a quote.",
      });
    }

    const { enquiryNumber } = req.params;

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
      console.error("Error fetching seller profile:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config,
      });
      return res.status(error.response?.status || 500).json({
        hasError: true,
        message: "Failed to fetch seller profile",
        error: error.message,
      });
    }

    // Build category + subcategory match conditions (same as before)
    const productMatchConditions = sellerProfile.dealingProducts.flatMap(
      (product) =>
        product.subCategoryIds.map((subCategoryId) => ({
          categoryId: product.categoryId,
          subCategoryId: subCategoryId,
        }))
    );

    const queryConditions = {
      $or: productMatchConditions.map((condition) => ({
        categoryId: condition.categoryId,
        subCategoryId: condition.subCategoryId,
      })),
    };

    if (enquiryNumber) {
      queryConditions.enquiryNumber = enquiryNumber;
    }

    // 2. Find products (remove populate calls)
    const products = await Product.find(queryConditions);

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
      console.error("Error fetching categories/subcategories:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config,
      });
      // Continue with empty arrays
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
      console.error("Error fetching orders:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config,
      });
      // Continue with empty array
    }

    // Create order map (modified to work with raw IDs)
    const orderMap = new Map();
    orders.forEach((order) => {
      const key = `${order.enquiryNumber}-${order.subCategoryId}`;
      if (!orderMap.has(key)) {
        orderMap.set(key, []);
      }
      orderMap.get(key).push(order.sellerId.toString());
    });

    // Filter products (same logic as before)
    const filteredProducts = products.filter((product) => {
      const key = `${product.enquiryNumber}-${product.subCategoryId}`;
      const sellerIds = orderMap.get(key);

      if (!sellerIds || sellerIds.includes(sellerId.toString())) {
        return true; // include
      }
      return false; // exclude
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

    // Format products with data from all services
    const formattedProducts = filteredProducts.map((product) => {
      const quoteRequest = quoteRequestsMap[product.enquiryNumber] || null;
      const category = categoryMap[product.categoryId] || null;
      const subCategory = subCategoryMap[product.subCategoryId] || null;

      return {
        id: product._id,
        schoolId: product.schoolId,
        categoryId: product.categoryId || null,
        edprowiseMargin: category?.edprowiseMargin || null,
        categoryName: category?.categoryName || null,
        subCategoryId: product.subCategoryId || null,
        subCategoryName: subCategory?.subCategoryName || null,
        description: product.description,
        productImages: product.productImages || [],
        unit: product.unit,
        quantity: product.quantity,
        enquiryNumber: product.enquiryNumber,
        quoteRequestId: quoteRequest?.id || null,
        deliveryAddress: quoteRequest?.deliveryAddress || null,
        deliveryLocation: quoteRequest?.deliveryLocation || null,
        deliveryLandMark: quoteRequest?.deliveryLandMark || null,
        deliveryPincode: quoteRequest?.deliveryPincode || null,
        expectedDeliveryDate: quoteRequest?.expectedDeliveryDate || null,
        buyerStatus: quoteRequest?.buyerStatus || null,
        supplierStatus: quoteRequest?.supplierStatus || null,
        edprowiseStatus: quoteRequest?.edprowiseStatus || null,
        createdAt: quoteRequest?.createdAt || null,
        updatedAt: quoteRequest?.updatedAt || null,
      };
    });

    return res.status(200).json({
      hasError: false,
      message: "Data fetched successfully.",
      data: {
        products: formattedProducts,
      },
    });
  } catch (error) {
    console.error("Error fetching products for seller:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config,
    });
    return res.status(500).json({
      hasError: true,
      message: "Failed to fetch data.",
      error: error.message,
    });
  }
}

export default getByEnquiryNumberForSeller;
