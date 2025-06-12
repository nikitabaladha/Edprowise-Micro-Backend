import Notification from "./notification.js";

import InterServiceCommunication from "./inter-service-communication.js";

export default (app) => {
  app.use("/api", Notification);

  app.use("/api", InterServiceCommunication);
};
