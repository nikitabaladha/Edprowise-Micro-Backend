import { getOrderFromBuyerByOrdNo } from "../AxiosRequestService/orderServiceRequest.js";

import { getQuoteRequestByEnquiryNumber } from "../AxiosRequestService/quoteRequestServiceRequest.js";

import {
  getSchoolByQuery,
  getSellerByQuery,
} from "../AxiosRequestService/userServiceRequest.js";

async function get(req, res) {
  const { query } = req.query;

  try {
    const results = [];

    // 1. Search QuoteRequests
    const quoteRequestRes = await getQuoteRequestByEnquiryNumber(
      query,
      "_id,enquiryNumber"
    );
    if (!quoteRequestRes.hasError && quoteRequestRes.data) {
      results.push({
        type: "quoteRequest",
        id: quoteRequestRes.data._id,
        text: quoteRequestRes.data.enquiryNumber,
        exactMatchForEnquiryNumber: true,
      });
    }

    // 2. Search OrderFromBuyer
    const orderRes = await getOrderFromBuyerByOrdNo(query, "_id,orderNumber");
    if (!orderRes.hasError && orderRes.data) {
      results.push({
        type: "orderFromBuyer",
        id: orderRes.data._id,
        text: orderRes.data.orderNumber,
        exactMatchForOrderNumber: true,
      });
    }

    // 3. Search Schools
    const schoolRes = await getSchoolByQuery(query);

    if (!schoolRes.hasError && Array.isArray(schoolRes.data)) {
      const schoolMatches = schoolRes.data;

      if (schoolMatches.length === 1) {
        const schoolMatch = schoolMatches[0];

        const matchedField =
          schoolMatch.schoolName === query
            ? "exactMatchForSchoolName"
            : schoolMatch.schoolId === query
            ? "exactMatchForSchoolId"
            : schoolMatch.schoolEmail === query
            ? "exactMatchForSchoolEmail"
            : schoolMatch.schoolMobileNo === query
            ? "exactMatchForSchoolMobileNumber"
            : null;

        if (matchedField) {
          results.push({
            type: "school",
            id: schoolMatch._id,
            text: schoolMatch[
              matchedField
                .replace("exactMatchFor", "")
                .charAt(0)
                .toLowerCase() +
                matchedField.replace("exactMatchFor", "").slice(1)
            ],
            [matchedField]: true,
            isSingleMatch: true,
            schoolId: schoolMatch.schoolId,
          });
        }
      } else if (schoolMatches.length > 1) {
        results.push({
          type: "school",
          text: query,
          exactMatchForSchoolName: true,
          isSingleMatch: false,
          matchCount: schoolMatches.length,
        });
      }
    }

    // 4. Search Sellers
    const sellerRes = await getSellerByQuery(query);

    if (!sellerRes.hasError && Array.isArray(sellerRes.data)) {
      const sellerMatches = sellerRes.data;

      if (sellerMatches.length === 1) {
        const seller = sellerMatches[0];

        const matchedField =
          seller.companyName === query
            ? "exactMatchForCompanyName"
            : seller.emailId === query
            ? "exactMatchForSellerEmail"
            : seller.contactNo === query
            ? "exactMatchForSellerMobileNumber"
            : seller.randomId === query
            ? "exactMatchForSellerRandomId"
            : seller.sellerId && seller.sellerId.toString() === query
            ? "exactMatchForsellerId"
            : null;

        if (matchedField) {
          results.push({
            type: "seller",
            id: seller._id,
            text: seller[
              matchedField
                .replace("exactMatchFor", "")
                .replace("seller", "")
                .charAt(0)
                .toLowerCase() +
                matchedField
                  .replace("exactMatchFor", "")
                  .replace("seller", "")
                  .slice(1)
            ],
            [matchedField]: true,
            isSingleMatch: true,
            sellerId: seller.sellerId?._id,
          });
        }
      } else if (sellerMatches.length > 1) {
        // Check if multiple matches are from company name
        const companyNameMatches = sellerMatches.filter(
          (s) => s.companyName === query
        );
        if (companyNameMatches.length > 0) {
          results.push({
            type: "seller",
            text: query,
            exactMatchForCompanyName: true,
            isSingleMatch: false,
            matchCount: companyNameMatches.length,
          });
        } else {
          // Handle other multiple matches if needed
          results.push({
            type: "seller",
            text: query,
            isSingleMatch: false,
            matchCount: sellerMatches.length,
          });
        }
      }
    }

    if (results.length > 0) {
      return res.json({ success: true, data: results });
    }

    return res.json({
      success: true,
      data: [
        {
          type: "noResults",
          text: "No matching records found",
        },
      ],
    });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error during search",
      details: error.message,
    });
  }
}

export default get;
