import axios from "axios";

export async function getCart(enquiryNumber, ids, fields) {
  try {
    const idArray = Array.isArray(ids)
      ? ids
      : typeof ids === "string"
      ? ids.split(",")
      : [];

    const response = await axios.get(
      `${process.env.PROCUREMENT_CART_SERVICE_URL}/api/get-cart`,
      {
        params: {
          enquiryNumber,
          ids: idArray.join(","),
          fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get cart.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting cart:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get cart.",
      error: err.message,
    };
  }
}

export async function deleteCarts(enquiryNumber, schoolId, cartIds) {
  try {
    const response = await axios.delete(
      `${process.env.PROCUREMENT_CART_SERVICE_URL}/api/delete-carts`,
      {
        data: { enquiryNumber, schoolId, cartIds },
      }
    );

    return response.data;
  } catch (err) {
    console.error("Error deleting carts from cart service:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });

    return {
      hasError: true,
      message: "Cart deletion failed.",
      error: err.message,
    };
  }
}
