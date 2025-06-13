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

export async function getUserById(userId, fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/required-field-from-user/${userId}`,
      {
        params: fields ? { fields } : {},
      }
    );
    return response.data;
  } catch (err) {
    console.error("Error in get user by Userid:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to fetch user by Userid.",
      error: err.message,
    };
  }
}

export async function getUserSelleById(userId, fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/required-field-from-seller/${userId}`,
      {
        params: fields ? { fields } : {},
      }
    );
    return response.data;
  } catch (err) {
    console.error("Error in get seller by Sellerid:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to fetch seller by Sellerid.",
      error: err.message,
    };
  }
}

export async function resetUserOrSellerPassword(userId, newPassword) {
  try {
    const response = await axios.put(
      `${process.env.USER_SERVICE_URL}/api/reset-user-or-seller-password`,
      {
        userId,
        newPassword,
      }
    );
    return response.data;
  } catch (err) {
    console.error("Error in updating user or seller password:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to update user or seller password.",
      error: err.message,
    };
  }
}

export async function getSchoolByEmailId(schoolEmail, fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/get-school-by-emailid/${schoolEmail}`,
      {
        params: fields ? { fields } : {},
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get school.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting school:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get school.",
      error: err.message,
    };
  }
}

export async function getSellerProfileByEmailId(emailId, fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/get-sellerprofile-by-emailid/${emailId}`,
      {
        params: fields ? { fields } : {},
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get seller profile.",
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

export async function getUserBySchoolId(schoolId, fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/get-user-by-schoolid/${schoolId}`,
      {
        params: { fields },
      }
    );
    return response.data;
  } catch (err) {
    console.error("Error in get user by SchoolId:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to fetch user by SchoolId",
      error: err.message,
    };
  }
}

export async function getSellerBymongooseid(_id, fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/get-seller-by-id/${_id}`,
      {
        params: { fields },
      }
    );
    return response.data;
  } catch (err) {
    console.error("Error in get seller by Id:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to fetch seller by id",
      error: err.message,
    };
  }
}

export async function getUserByEmailId(userId) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/get-user-email-by-userId/${userId}`
    );

    return response.data;
  } catch (err) {
    console.error("Error in get user by Email Id:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to fetch user by Email Id",
      error: err.message,
    };
  }
}

export async function checkEmailExists(email) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/check-email-exists`,
      {
        params: { email },
      }
    );

    return response.data;
  } catch (err) {
    console.error("Error in getting email", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to check email existence",
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
    console.error("Error in Get All Edprowise Admins:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });
    return {
      hasError: true,
      message: "Failed to fetch All Edprowise Admins.",
      error: err.message,
    };
  }
}

export async function getAllSchoolProfiles(fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/required-field-from-all-schools`,
      {
        params: fields ? { fields } : {},
      }
    );
    return response.data;
  } catch (err) {
    console.error("Error in Get All School Profile:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });
    return {
      hasError: true,
      message: "Failed to fetch All School Profile.",
      error: err.message,
    };
  }
}

export async function getAllSellerProfiles(fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/required-field-from-all-sellers`,
      {
        params: fields ? { fields } : {},
      }
    );
    return response.data;
  } catch (err) {
    console.error("Error in Get All Seller Profile:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });
    return {
      hasError: true,
      message: "Failed to fetch All Seller Profile.",
      error: err.message,
    };
  }
}
