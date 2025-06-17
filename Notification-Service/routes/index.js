import Notification from "./notification.js";
import GlobalSearchRoutes from "./global-search.js";

import InterServiceCommunication from "./inter-service-communication.js";

export default (app) => {
  app.use("/api", Notification);
  app.use("/api", GlobalSearchRoutes);

  app.use("/api", InterServiceCommunication);
};
