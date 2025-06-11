import axios from "axios";

export async function getCartById(id) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_CATEGORY_SERVICE_URL}/api/categories/${id}`
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get category.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting category:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get category.",
      error: err.message,
    };
  }
}

export async function getCartByIds(ids) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_CATEGORY_SERVICE_URL}/api/categories-by-ids`,
      {
        params: {
          ids: Array.isArray(ids) ? ids.join(",") : ids,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get category.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting category:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get category.",
      error: err.message,
    };
  }
}

export async function getSubCategoriesByIds(ids) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_CATEGORY_SERVICE_URL}/api/subcategories`,
      {
        params: {
          ids: Array.isArray(ids) ? ids.join(",") : ids,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get sub category.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting sub category:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get subcategory.",
      error: err.message,
    };
  }
}
