import QuoteRoutes from "./quote-request.js";
import DeliveryLocationRoutes from "./delivery-location.js";

import InterServiceCommunication from "./inter-service-communication.js";

export default (app) => {
  app.use("/api", QuoteRoutes);

  app.use("/api", DeliveryLocationRoutes);

  app.use("/api", InterServiceCommunication);
};
