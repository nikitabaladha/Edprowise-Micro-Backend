import axios from "axios";

class SMTPServiceClient {
  constructor() {
    this.settings = null;
    this.lastFetch = null;
    this.cacheTTL = 300000;
  }

  async getSettings(accessToken) {
    if (this.settings && Date.now() - this.lastFetch < this.cacheTTL) {
      return this.settings;
    }

    try {
      const response = await axios.get(
        `${process.env.EMAIL_SERVICE_URL}/api/get-smtp-email-settings`,
        {
          headers: {
            access_token: accessToken,
          },
        }
      );

      http: if (response.data.hasError || !response.data.data) {
        throw new Error("Failed to fetch SMTP settings");
      }

      // Cache the settings
      this.settings = response.data.data;
      this.lastFetch = Date.now();

      return this.settings;
    } catch (error) {
      console.error("SMTP Service Error:", {
        message: error.message,
        config: error.config,
        response: error.response?.data,
      });
      throw new Error("Email service temporarily unavailable");
    }
  }
}

export default new SMTPServiceClient();
