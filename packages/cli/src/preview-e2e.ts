import { startStudioServer } from "./server.js";

startStudioServer({
  port: Number(process.env.PORT ?? 4173),
  openBrowser: false
});
