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
    console.error("Error in get All Edprowise Admins:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });
    return {
      hasError: true,
      message: "Failed to fetch All Edprowise Admins",
      error: err.message,
    };
  }
}

export async function getSchoolsByIds(schoolIds, fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/get-school-by-ids`,
      {
        params: {
          schoolIds: Array.isArray(schoolIds) ? schoolIds.join(",") : schoolIds,
          fields: Array.isArray(fields) ? fields.join(",") : fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get schools by schoolids.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting schools by schoolids:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to getschools by schoolids.",
      error: err.message,
    };
  }
}
