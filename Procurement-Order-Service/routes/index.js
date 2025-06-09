import UpdateVenderStatusRoutes from "./update-vender-status.js";
import OrderFromBuyerRoutes from "./order-from-buyer.js";
import OrderDetailsFromSellerRoutes from "./order-details-from-seller.js";
import OrderProgressStatusRoutes from "./order-progress-status.js";
import UpdateTDSRoutes from "./update-tds.js";
import CancelOrder from "./order-cancel.js";
import FeedBackAndRating from "./feedback-and-rating.js";

import InterServiceCommunication from "./inter-service-communication.js";

export default (app) => {
  app.use("/api", UpdateVenderStatusRoutes);
  app.use("/api", OrderFromBuyerRoutes);
  app.use("/api", OrderDetailsFromSellerRoutes);
  app.use("/api", OrderProgressStatusRoutes);
  app.use("/api", UpdateTDSRoutes);
  app.use("/api", CancelOrder);
  app.use("/api", FeedBackAndRating);

  app.use("/api", InterServiceCommunication);
};
