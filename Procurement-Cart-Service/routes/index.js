import CartRoutes from "./cart-by-school.js";

import InterServiceCommunication from "./inter-service-communication.js";

export default (app) => {
  app.use("/api", CartRoutes);

  app.use("/api", InterServiceCommunication);
};
