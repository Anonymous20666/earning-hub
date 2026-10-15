import { parentPort, threadId } from "node:worker_threads";
import { normalizeImage } from "./previewImage.mjs";
parentPort.on("message", async ({ id, bytes }) => {
  try {
    parentPort.postMessage({
      id,
      result: await normalizeImage(bytes),
      threadId,
    });
  } catch (e) {
    parentPort.postMessage({ id, error: e.message, threadId });
  }
});
