import { buildApp } from "./app";
import { loadConfig } from "../libs/config";
import { exitOnSignal } from "../libs/shutdown";
import { createContainer } from "../services/container";

const config = loadConfig();
const container = createContainer(config);
const app = await buildApp({
  services: container.services,
  appOrigin: config.appOrigin,
  cookieSecure: config.cookieSecure,
  trustProxy: config.trustProxy,
});

try {
  // Bound to localhost by default. In production it listens on the container network,
  // where only the reverse proxy and the UI server reach it.
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

// Stops accepting requests and waits for those in flight, up to 10 s.
exitOnSignal(
  "api",
  async () => {
    await app.close();
    await container.close();
  },
  10_000,
);
