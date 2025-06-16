import axios from "axios";

export async function updateQuoteProposal(enquiryNumber, sellerId, updateData) {
  try {
    const response = await axios.put(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/update-quote-proposal`,
      updateData,
      {
        params: { enquiryNumber, sellerId },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to update quote proposal.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error updating quote proposal:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to update quote proposal.",
      error: err.message,
    };
  }
}

export async function updateSubmitQuote(enquiryNumber, sellerId, updateData) {
  try {
    const response = await axios.put(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/update-submitquote-by-status`,
      updateData,
      {
        params: { enquiryNumber, sellerId },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to update submit quote.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error updating submit quote:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to update submit quote.",
      error: err.message,
    };
  }
}

export async function getQuoteProposal(enquiryNumber, sellerId, fields) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/get-quote-proposal`,
      {
        params: { enquiryNumber, sellerId, fields },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get quote proposal.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting quote proposal:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get quote proposal.",
      error: err.message,
    };
  }
}

export async function getQuoteProposalBySellerIdEnqNoQuoteNo(
  enquiryNumber,
  quoteNumber,
  sellerId,
  fields
) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/quote-proposal-by-Sellerid-enqno-quoteno`,
      {
        params: { enquiryNumber, quoteNumber, sellerId, fields },
      }
    );

    console.log("Raw service response:", response.data);

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get quote proposal.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting quote proposal:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get quote proposal.",
      error: err.message,
    };
  }
}

export async function fetchPrepareQuotes(enquiryNumber, ids, fields) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/get-prepare-quotes`,
      {
        params: {
          enquiryNumber,
          ids: Array.isArray(ids) ? ids.join(",") : ids,
          fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get prepare quotes.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting prepare quotes:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get prepare quotes.",
      error: err.message,
    };
  }
}

export async function fetchSubmitQuoteBySellerIdAndEnqNos(
  sellerId,
  enquiryNumbers,
  fields
) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/submitquote-by-Sellerid-and-enq-nos`,
      {
        params: {
          sellerId,
          enquiryNumbers: Array.isArray(enquiryNumbers)
            ? enquiryNumbers.join(",")
            : enquiryNumbers,
          fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get submit quotes.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting submit quotes:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get submit quotes.",
      error: err.message,
    };
  }
}

export async function fetchSubmitQuoteBySellerIdAndEnqNo(
  sellerId,
  enquiryNumber,
  fields
) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/submitquote-by-Sellerid-and-enqno`,
      {
        params: {
          sellerId,
          enquiryNumber,
          fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get submit quotes.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting submit quotes:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get submit quotes.",
      error: err.message,
    };
  }
}

export async function fetchSubmitQuoteBySellerIdsAndEnqNo(
  sellerIds,
  enquiryNumber,
  fields
) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/submitquote-by-Sellerids-and-enq-no`,
      {
        params: {
          sellerIds: Array.isArray(sellerIds) ? sellerIds.join(",") : sellerIds,
          enquiryNumber,
          fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get submit quotes.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting submit quotes:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get submit quotes.",
      error: err.message,
    };
  }
}

export async function fetchSubmitQuoteBySellerIdsAndEnqNos(
  sellerIds,
  enquiryNumbers,
  fields
) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/submitquote-by-Sellerids-and-enq-nos`,
      {
        params: {
          sellerIds: Array.isArray(sellerIds) ? sellerIds.join(",") : sellerIds,
          enquiryNumbers: Array.isArray(enquiryNumbers)
            ? enquiryNumbers.join(",")
            : enquiryNumbers,
          fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get submit quotes.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting submit quotes:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get submit quotes.",
      error: err.message,
    };
  }
}

export async function fetchQuoteProposalBySellerIdsAndEnqNos(
  sellerIds,
  enquiryNumbers,
  fields
) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/quote-proposal-by-Sellerids-and-enq-nos`,
      {
        params: {
          sellerIds: Array.isArray(sellerIds) ? sellerIds.join(",") : sellerIds,
          enquiryNumbers: Array.isArray(enquiryNumbers)
            ? enquiryNumbers.join(",")
            : enquiryNumbers,
          fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get quote proposal.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting quote proposal:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get quote proposal.",
      error: err.message,
    };
  }
}

export async function fetchPrepareQuoteBySellerIdsAndEnqNos(
  sellerIds,
  enquiryNumbers,
  fields
) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/preparequote-by-Sellerids-and-enq-nos`,
      {
        params: {
          sellerIds: Array.isArray(sellerIds) ? sellerIds.join(",") : sellerIds,
          enquiryNumbers: Array.isArray(enquiryNumbers)
            ? enquiryNumbers.join(",")
            : enquiryNumbers,
          fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get prepare quote.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting prepare quote:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get prepare quote.",
      error: err.message,
    };
  }
}

export async function fetchPrepareQuoteBySellerIdAndEnqNo(
  sellerId,
  enquiryNumber,
  fields
) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/prepare-quote-by-Sellerid-and-enqno`,
      {
        params: {
          sellerId,
          enquiryNumber,
          fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get prepare quote.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting prepare quote:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get prepare quote.",
      error: err.message,
    };
  }
}

export async function fetchInvoiceForBuyerPDFRequirementsForEmail(
  sellerId,
  enquiryNumber,
  schoolId
) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/invoiceForBuyerPDFRequirementsForEmail/${sellerId}/${enquiryNumber}/${schoolId}`
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get Invoice For Buyer PDFRequirements For Email.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error(
      "Error getting Invoice For Buyer PDFRequirements For Email:",
      {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        config: err.config,
      }
    );

    return {
      hasError: true,
      message: "Failed to get Invoice For Buyer PDFRequirements For Email.",
      error: err.message,
    };
  }
}

export async function fetchInvoiceForEdprowisePDFRequirementsForEmail(
  sellerId,
  enquiryNumber,
  schoolId
) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/invoice-for-buyer-PDF-requirements-for-email/${sellerId}/${enquiryNumber}/${schoolId}`
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message:
          "Failed to get Invoice For Edprowise PDFRequirements For Email.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error(
      "Error getting Invoice For Edprowise PDFRequirements For Email:",
      {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        config: err.config,
      }
    );

    return {
      hasError: true,
      message: "Failed to get Invoice For Edprowise PDFRequirements For Email.",
      error: err.message,
    };
  }
}
