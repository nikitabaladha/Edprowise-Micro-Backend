import mongoose from "mongoose";
import OrderFromBuyer from "../../models/OrderFromBuyer.js";
import OrderDetailsFromSeller from "../../models/OrderDetailsFromSeller.js";

import nodemailer from "nodemailer";
import smtpServiceClient from "../Inter-Service-Communication/smtpServiceClient.js";

// import QuoteRequest from "../../models/QuoteRequest.js";

// import QuoteProposal from "../../models/QuoteProposal.js";
// import SubmitQuote from "../../models/SubmitQuote.js";

// import Cart from "../../models/Cart.js";

// import School from "../../../models/School.js";
// import SellerProfile from "../../../models/SellerProfile.js";
// import AdminUser from "../../../models/AdminUser.js";

// import { NotificationService } from "../../../notificationService.js";

import {
  getSchoolById,
  getSellerById,
  getallSellersByIds,
  getAllEdprowiseAdmins,
} from "./userServiceClient.js";

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function create(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to request a quote.",
      });
    }

    const accessToken = req.headers["access_token"];

    if (!accessToken) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        hasError: true,
        message: "Access token is missing",
      });
    }

    let {
      enquiryNumber,
      products,
      deliveryAddress,
      deliveryCountry,
      deliveryState,
      deliveryCity,
      deliveryLandMark,
      deliveryPincode,
      expectedDeliveryDate,
    } = req.body;

    if (!enquiryNumber) {
      return res
        .status(400)
        .json({ hasError: true, message: "Enquiry number is required." });
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res
        .status(400)
        .json({ hasError: true, message: "At least one product is required." });
    }

    const selectedCartIds = products.map((p) => p.cartId);

    if (selectedCartIds.includes(undefined) || selectedCartIds.includes(null)) {
      return res.status(400).json({
        hasError: true,
        message: "Each product must have a valid cartId.",
      });
    }

    const carts = await Cart.find({
      _id: { $in: selectedCartIds },
      enquiryNumber,
    });
    if (carts.length === 0) {
      return res.status(404).json({
        hasError: true,
        message: "No carts found for the given enquiry number.",
      });
    }

    const cartMap = new Map(carts.map((cart) => [cart._id.toString(), cart]));

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    let financialYearStart, financialYearEnd;
    if (currentMonth >= 4) {
      financialYearStart = currentYear;
      financialYearEnd = currentYear + 1;
    } else {
      financialYearStart = currentYear - 1;
      financialYearEnd = currentYear;
    }
    const financialYear = `${financialYearStart}-${financialYearEnd
      .toString()
      .slice(-2)}`;

    const orderSequence = await getNextOrderSequence(financialYear);
    const edprowiseSequence = await getNextInvoiceSequence(
      financialYear,
      "edprowise"
    );
    const schoolSequence = await getNextInvoiceSequence(
      financialYear,
      "school"
    );

    const sellerIds = Array.from(
      new Set(
        products
          .map((p) => cartMap.get(p.cartId)?.sellerId?.toString())
          .filter(Boolean)
      )
    );

    const sellerOrderNumbers = new Map();
    const sellerInvoiceNumbers = new Map();

    let currentOrderSequence = orderSequence;
    let currentEdprowiseSequence = edprowiseSequence;
    let currentSchoolSequence = schoolSequence;

    for (const sellerId of sellerIds) {
      const orderNumber = await generateOrderNumber(currentOrderSequence++);
      sellerOrderNumbers.set(sellerId.toString(), orderNumber);

      const invoiceForEdprowise = await generateInvoiceNumberForEdprowise(
        currentEdprowiseSequence++
      );
      const invoiceForSchool = await generateInvoiceNumberForSchool(
        currentSchoolSequence++
      );

      sellerInvoiceNumbers.set(sellerId.toString(), {
        invoiceForEdprowise,
        invoiceForSchool,
      });
    }

    const orderFromBuyerEntries = [];
    const orderDetailsFromSellerEntries = new Map();

    for (const product of products) {
      const cartEntry = cartMap.get(product.cartId);
      if (!cartEntry) {
        return res.status(400).json({
          hasError: true,
          message: `Cart with ID ${product.cartId} not found.`,
        });
      }

      if (!cartEntry.sellerId) {
        return res.status(400).json({
          hasError: true,
          message: `Cart with ID ${product.cartId} is missing a sellerId.`,
        });
      }

      const sellerIdStr = cartEntry.sellerId.toString();
      const orderNumber = sellerOrderNumbers.get(sellerIdStr);
      const { invoiceForEdprowise, invoiceForSchool } =
        sellerInvoiceNumbers.get(sellerIdStr);

      orderFromBuyerEntries.push({
        orderNumber,
        schoolId,
        enquiryNumber,
        cartId: product.cartId,
        sellerId: cartEntry.sellerId,
        cartImages: cartEntry.cartImages || [],
        subcategoryName: cartEntry.subcategoryName || "",
        subCategoryId: cartEntry.subCategoryId || "",
        hsnSacc: cartEntry.hsnSacc || "",
        listingRate: cartEntry.listingRate || 0,
        edprowiseMargin: cartEntry.edprowiseMargin || 0,
        quantity: cartEntry.quantity || 0,
        finalRateBeforeDiscount: cartEntry.finalRateBeforeDiscount || 0,
        discount: cartEntry.discount || 0,
        finalRate: cartEntry.finalRate || 0,
        taxableValue: cartEntry.taxableValue || 0,
        cgstRate: cartEntry.cgstRate || 0,
        cgstAmount: cartEntry.cgstAmount || 0,
        sgstRate: cartEntry.sgstRate || 0,
        sgstAmount: cartEntry.sgstAmount || 0,
        igstRate: cartEntry.igstRate || 0,
        igstAmount: cartEntry.igstAmount || 0,
        amountBeforeGstAndDiscount: cartEntry.amountBeforeGstAndDiscount || 0,
        discountAmount: cartEntry.discountAmount || 0,
        gstAmount: cartEntry.gstAmount || 0,
        totalAmount: cartEntry.totalAmount || 0,
      });

      const quoteProposal = await QuoteProposal.findOne({
        sellerId: cartEntry.sellerId,
        enquiryNumber: enquiryNumber,
      }).session(session);

      const quoteNumber = quoteProposal ? quoteProposal.quoteNumber : null;

      if (!orderDetailsFromSellerEntries.has(cartEntry.sellerId.toString())) {
        orderDetailsFromSellerEntries.set(cartEntry.sellerId.toString(), {
          orderNumber,
          sellerId: cartEntry.sellerId,
          schoolId,
          enquiryNumber,
          invoiceForSchool,
          invoiceForEdprowise,
          quoteNumber,
        });
      }
    }

    if (orderFromBuyerEntries.length === 0) {
      return res.status(400).json({
        hasError: true,
        message: "No valid products to add to Order.",
      });
    }

    const savedEntries = await OrderFromBuyer.insertMany(
      orderFromBuyerEntries,
      { session }
    );

    const orderDetailsList = Array.from(orderDetailsFromSellerEntries.values());
    const savedOrderDetails = await OrderDetailsFromSeller.insertMany(
      orderDetailsList,
      { session }
    );

    await QuoteRequest.findOneAndUpdate(
      { schoolId, enquiryNumber },
      [
        {
          $set: {
            deliveryAddress: { $ifNull: [deliveryAddress, "$deliveryAddress"] },
            deliveryCountry: {
              $ifNull: [deliveryCountry, "$deliveryCountry"],
            },
            deliveryState: {
              $ifNull: [deliveryState, "$deliveryState"],
            },
            deliveryCity: {
              $ifNull: [deliveryCity, "$deliveryCity"],
            },
            deliveryLandMark: {
              $ifNull: [deliveryLandMark, "$deliveryLandMark"],
            },
            deliveryPincode: { $ifNull: [deliveryPincode, "$deliveryPincode"] },
            expectedDeliveryDate: {
              $ifNull: [expectedDeliveryDate, "$expectedDeliveryDate"],
            },
          },
        },
      ],
      { session, upsert: true, new: true }
    );

    for (const entry of orderFromBuyerEntries) {
      await QuoteProposal.findOneAndUpdate(
        { sellerId: entry.sellerId, enquiryNumber: enquiryNumber },
        {
          supplierStatus: "Order Received",
          edprowiseStatus: "Order Placed",
          buyerStatus: "Order Placed",
        },
        { new: true }
      );

      await SubmitQuote.findOneAndUpdate(
        { sellerId: entry.sellerId, enquiryNumber: enquiryNumber },
        {
          venderStatusFromBuyer: "Order Placed",
        },
        { new: true }
      );
    }

    for (const sellerId of sellerIds) {
      await Cart.deleteMany({
        _id: { $in: selectedCartIds },
        enquiryNumber: enquiryNumber,
        schoolId: schoolId,
      }).session(session);
    }

    const schoolDetail = await getSchoolById(schoolId);

    const schoolEmail = schoolDetail.data.schoolEmail;
    const schoolName = schoolDetail.data.schoolName;

    await sendSchoolRequestQuoteEmail(
      schoolName,
      schoolEmail,
      {
        orders: await Promise.all(
          Array.from(sellerOrderNumbers.entries()).map(
            async ([sellerId, orderNumber]) => ({
              orderNumber,
              seller: await SellerProfile.findById(sellerId),
              products: orderFromBuyerEntries.filter(
                (o) => o.sellerId.toString() === sellerId
              ),
            })
          )
        ),
      },
      accessToken
    );

    for (const [sellerId, orderNumber] of sellerOrderNumbers.entries()) {
      const sellerDetails = await getSellerById(sellerId);

      if (!sellerDetails) {
        console.error(`Seller profile not found for ID: ${sellerId}`);
        continue;
      }

      const allSellerIds = Array.from(sellerOrderNumbers.keys());

      // Then fetch all sellers in one go
      const allSellersResponse = await getallSellersByIds(allSellerIds);
      if (!allSellersResponse || allSellersResponse.hasError) {
        console.error("Failed to fetch seller profiles");
        continue;
      }

      const allSellers = allSellersResponse.data;

      // Then use them in your mapping
      const sellerProducts = orderFromBuyerEntries.filter(
        (o) => o.sellerId.toString() === sellerId
      );

      await sendEmailsToSellers(
        allSellers.companyName,
        allSellers.emailId,
        schoolName,
        {
          orderNumber,
          products: sellerProducts,
          deliveryAddress,
          deliveryCountry,
          deliveryState,
          deliveryCity,
          deliveryLandMark,
          deliveryPincode,
          expectedDeliveryDate,
        },
        accessToken
      );
    }

    for (const savedEntry of savedOrderDetails) {
      const sellerId = savedEntry.sellerId.toString();
      const orderNumber = savedEntry.orderNumber;

      // await NotificationService.sendNotification(
      //   "SELLER_RECEIVED_ORDER",
      //   [{ id: sellerId, type: "seller" }],
      //   {
      //     schoolName: schoolProfile?.schoolName || "Unknown School",
      //     enquiryNumber: enquiryNumber,
      //     orderNumber: orderNumber,
      //     entityId: savedEntry._id,
      //     entityType: "Order From Buyer",
      //     senderType: "school",
      //     senderId: schoolId,
      //     metadata: {
      //       enquiryNumber,
      //       orderNumber,
      //       type: "seller_received_order",
      //     },
      //   }
      // );
    }

    for (const savedEntry of savedOrderDetails) {
      const orderNumber = savedEntry.orderNumber;

      const sellerProfileResponse = await getSellerById(
        savedEntry.sellerId.toString()
      );

      const sellerProfile = sellerProfileResponse.data;

      // await NotificationService.sendNotification(
      //   "SCHOOL_PLACED_ORDER",
      //   [{ id: schoolId, type: "school" }],
      //   {
      //     schoolName: schoolProfile?.schoolName || "Unknown School",
      //     companyName: sellerProfile?.companyName || "Unknown Company",
      //     enquiryNumber: enquiryNumber,
      //     orderNumber: orderNumber,
      //     entityId: savedEntry._id,
      //     entityType: "Order From Buyer",
      //     senderType: "school",
      //     senderId: schoolId,
      //     metadata: {
      //       enquiryNumber,
      //       orderNumber,
      //       type: "school_placed_order",
      //     },
      //   }
      // );
    }

    const relevantAdminsResponse = await getAllEdprowiseAdmins();
    const relevantAdmins = relevantAdminsResponse.data;

    for (const savedEntry of savedOrderDetails) {
      const sellerProfileResponse = await getSellerById(
        savedEntry.sellerId.toString()
      );

      const sellerProfile = sellerProfileResponse.data;

      //   for (const admin of relevantAdmins) {
      //     await NotificationService.sendNotification(
      //       "EDPROWISE_RECEIVED_ORDER",
      //       [{ id: admin._id.toString(), type: "edprowise" }],
      //       {
      //         schoolName: schoolName || "Unknown School",
      //         companyName: sellerProfile?.companyName || "Unknown Company",
      //         enquiryNumber: enquiryNumber,
      //         orderNumber: savedEntry.orderNumber,
      //         entityId: savedEntry._id,
      //         entityType: "Order From Buyer",
      //         senderType: "school",
      //         senderId: schoolId,
      //         metadata: {
      //           enquiryNumber,
      //           orderNumber: savedEntry.orderNumber,
      //           type: "edprowise_received_order",
      //         },
      //       }
      //     );
      //   }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      hasError: false,
      message: "Selected products added to Order successfully.",
      data: savedEntries,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating OrderFromBuyer:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        hasError: true,
        message: "Duplicate entry: These products are already in the Order.",
      });
    }

    return res
      .status(500)
      .json({ hasError: true, message: "Internal server error." });
  }
}

export default create;
