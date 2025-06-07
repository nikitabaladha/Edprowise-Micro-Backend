import QuoteRequest from "../../models/QuoteRequest.js";
import Product from "../../models/Product.js";

// import OrderFromBuyer from "../../models/OrderFromBuyer.js";

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

    // Build category + subcategory match conditions
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

    const products = await Product.find(queryConditions)
      .populate({ path: "categoryId", select: "categoryName edprowiseMargin" })
      .populate({ path: "subCategoryId", select: "subCategoryName" });

    const enquiryNumbers = [...new Set(products.map((p) => p.enquiryNumber))];

    const orders = await OrderFromBuyer.find({
      enquiryNumber: { $in: enquiryNumbers },
    });

    // Map: key = enquiryNumber-subCategoryId, value = array of sellerIds who placed orders
    const orderMap = new Map();
    orders.forEach((order) => {
      const key = `${order.enquiryNumber}-${order.subCategoryId}`;
      if (!orderMap.has(key)) {
        orderMap.set(key, []);
      }
      orderMap.get(key).push(order.sellerId.toString());
    });

    // ✅ Filter products: include only if no one ordered OR current seller has ordered
    const filteredProducts = products.filter((product) => {
      const key = `${product.enquiryNumber}-${product.subCategoryId._id}`;
      const sellerIds = orderMap.get(key);

      if (!sellerIds || sellerIds.includes(sellerId.toString())) {
        return true; // include
      }

      return false; // exclude
    });

    // Map quoteRequests by enquiryNumber
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

    const formattedProducts = filteredProducts.map((product) => {
      const quoteRequest = quoteRequestsMap[product.enquiryNumber] || null;

      return {
        id: product._id,
        schoolId: product.schoolId,
        categoryId: product.categoryId?._id || null,
        edprowiseMargin: product.categoryId?.edprowiseMargin || null,
        categoryName: product.categoryId?.categoryName || null,
        subCategoryId: product.subCategoryId?._id || null,
        subCategoryName: product.subCategoryId?.subCategoryName || null,
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
    console.error("Error fetching products for seller:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Failed to fetch data.",
      error: error.message,
    });
  }
}

export default getByEnquiryNumberForSeller;
