import QuoteRoutes from "./quote-request.js";
import DeliveryLocationRoutes from "./delivery-location.js";

export default (app) => {
  app.use("/api", QuoteRoutes);

  app.use("/api", DeliveryLocationRoutes);
};
