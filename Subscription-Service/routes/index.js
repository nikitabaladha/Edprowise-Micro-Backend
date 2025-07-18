import subscriptionRoutes from "./subscriptionRoutes.js";

import InterServiceCommunication from "./inter-service-communication.js";

export default (app) => {
  app.use("/api", subscriptionRoutes);

  app.use("/api", InterServiceCommunication);
};
