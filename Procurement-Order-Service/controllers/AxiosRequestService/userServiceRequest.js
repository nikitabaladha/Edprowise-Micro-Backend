import axios from "axios";

export async function getallSellersByIds(sellerIds, fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/bulk-required-fields-from-seller-profile`,
      {
        params: { ids: sellerIds.join(",") },
        fields,
      }
    );
    return response.data;
  } catch (err) {
    console.error("Error in getallSellersByIds:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to fetch all sellers.",
      error: err.message,
    };
  }
}

export async function getRequiredFieldsBySellerIds(sellerIds, fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/required-field-by-sellerids`,
      {
        params: {
          sellerIds: Array.isArray(sellerIds) ? sellerIds.join(",") : sellerIds,
          fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get seller profiles.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting seller profile:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get seller profile.",
      error: err.message,
    };
  }
}

export async function getAllEdprowiseAdmins(fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/required-field-from-all-admins`,
      {
        params: fields ? { fields } : {},
      }
    );
    return response.data;
  } catch (err) {
    console.error("Error in getAllEdprowiseAdmins:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });
    return {
      hasError: true,
      message: "Failed to fetch all Edprowise admins",
      error: err.message,
    };
  }
}

export async function getrequiredFieldsFromEdprowiseProfile(fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/required-field-from-edprowise-profile`,
      {
        params: fields ? { fields } : {},
      }
    );
    return response.data;
  } catch (err) {
    console.error("Error in get required fields from Edprowise Profile:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to fetch required fields from Edprowise Profile.",
      error: err.message,
    };
  }
}

export async function getSchoolById(schoolId, fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/required-field-from-school-profile/${schoolId}`,
      {
        params: fields ? { fields } : {},
      }
    );
    return response.data;
  } catch (err) {
    console.error("Error in getSchoolById:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });
    return {
      hasError: true,
      message: "Failed to fetch school profile.",
      error: err.message,
    };
  }
}

export async function getSellerById(sellerId, fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/required-field-from-seller-profile/${sellerId}`,
      {
        params: fields ? { fields } : {},
      }
    );
    return response.data;
  } catch (err) {
    console.error("Error in getSellerById:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to fetch seller profile.",
      error: err.message,
    };
  }
}

export async function getSellerByDealingProducts(sellerId) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/seller-by-dealing-products/${sellerId}`
    );
    return response.data;
  } catch (err) {
    console.error("Error in get Seller by dealing products", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to fetch seller by dealing products.",
      error: err.message,
    };
  }
}
