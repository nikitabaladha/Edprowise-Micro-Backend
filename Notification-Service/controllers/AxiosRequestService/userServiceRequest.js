import axios from "axios";

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

export async function getSchoolByQuery(query) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/search-schools`,
      {
        params: { query },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get schools.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting school:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });

    return {
      hasError: true,
      message: "Failed to get schools.",
      error: err.message,
    };
  }
}

export async function getSellerByQuery(query) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/search-sellers`,
      {
        params: { query },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get sellers.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting seller:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });

    return {
      hasError: true,
      message: "Failed to get sellers.",
      error: err.message,
    };
  }
}
