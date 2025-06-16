import mongoose from "mongoose";
import axios from "axios";
import Cart from "../../models/Cart.js";

async function create(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to request a quote.",
      });
    }

    let { enquiryNumber, products } = req.body;

    if (!enquiryNumber) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: "Enquiry number is required.",
      });
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: "At least one product is required.",
      });
    }

    if (typeof products === "string") products = JSON.parse(products);

    const selectedPrepareQuoteIds = products.map((p) => p.prepareQuoteId);

    if (
      selectedPrepareQuoteIds.includes(undefined) ||
      selectedPrepareQuoteIds.includes(null)
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: "Each product must have a valid prepareQuoteId.",
      });
    }

    // 1. Fetch PrepareQuotes from quote-proposal-service
    let prepareQuotes;
    try {
      const response = await axios.get(
        `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/get-prepare-quotes`,
        {
          params: {
            ids: selectedPrepareQuoteIds.join(","),
            enquiryNumber,
            fields: "",
          },
        }
      );
      prepareQuotes = response.data.data || [];
    } catch (error) {
      console.error("Error fetching prepare quotes:", error.message);
      await session.abortTransaction();
      session.endSession();
      return res.status(error.response?.status || 500).json({
        hasError: true,
        message: "Failed to fetch prepare quotes",
        error: error.message,
      });
    }

    const prepareQuoteMap = new Map(
      prepareQuotes.map((pq) => [pq._id.toString(), pq])
    );

    const cartEntries = [];

    for (const product of products) {
      const prepareQuoteEntry = prepareQuoteMap.get(product.prepareQuoteId);

      if (!prepareQuoteEntry) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          hasError: true,
          message: `PrepareQuote with ID ${product.prepareQuoteId} not found.`,
        });
      }

      if (!prepareQuoteEntry.sellerId) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          hasError: true,
          message: `PrepareQuote with ID ${product.prepareQuoteId} is missing a sellerId.`,
        });
      }

      cartEntries.push({
        schoolId,
        enquiryNumber,
        prepareQuoteId: product.prepareQuoteId,
        sellerId: prepareQuoteEntry?.sellerId || null,
        cartImages: prepareQuoteEntry?.prepareQuoteImages || [],
        subcategoryName: prepareQuoteEntry?.subcategoryName || "",
        subCategoryId: prepareQuoteEntry?.subCategoryId || "",
        hsnSacc: prepareQuoteEntry?.hsnSacc || "",
        listingRate: prepareQuoteEntry?.listingRate || 0,
        edprowiseMargin: prepareQuoteEntry?.edprowiseMargin || 0,
        quantity: prepareQuoteEntry?.quantity || 0,
        finalRateBeforeDiscount:
          prepareQuoteEntry?.finalRateBeforeDiscount || 0,
        discount: prepareQuoteEntry?.discount || 0,
        finalRate: prepareQuoteEntry?.finalRate || 0,
        taxableValue: prepareQuoteEntry?.taxableValue || 0,
        cgstRate: prepareQuoteEntry?.cgstRate || 0,
        cgstAmount: prepareQuoteEntry?.cgstAmount || 0,
        sgstRate: prepareQuoteEntry?.sgstRate || 0,
        sgstAmount: prepareQuoteEntry?.sgstAmount || 0,
        igstRate: prepareQuoteEntry?.igstRate || 0,
        igstAmount: prepareQuoteEntry?.igstAmount || 0,
        amountBeforeGstAndDiscount:
          prepareQuoteEntry?.amountBeforeGstAndDiscount || 0,
        discountAmount: prepareQuoteEntry?.discountAmount || 0,
        gstAmount: prepareQuoteEntry?.gstAmount || 0,
        totalAmount: prepareQuoteEntry?.totalAmount || 0,
      });
    }

    const savedEntries = await Cart.insertMany(cartEntries, { session });

    // 2. Update SubmitQuote in quote-proposal-service
    try {
      await axios.put(
        `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/update-submitquote-by-status`,
        {
          venderStatusFromBuyer: "Quote Accepted",
        },
        {
          params: {
            enquiryNumber,
            sellerId: cartEntries[0].sellerId,
          },
        }
      );
    } catch (error) {
      console.error("Error updating submit quote status:", error.message);
      await session.abortTransaction();
      session.endSession();
      return res.status(error.response?.status || 500).json({
        hasError: true,
        message: "Failed to update quote status",
        error: error.message,
      });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      hasError: false,
      message: "Selected products added to cart successfully.",
      data: savedEntries,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating Cart:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        hasError: true,
        message: "Duplicate entry: These products are already in the cart.",
      });
    }

    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default create;
