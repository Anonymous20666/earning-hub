import type { GrowthCreativeEngine } from "./growthCreative";
import express from "express";
import rateLimit from "express-rate-limit";
import type { Database } from "./database";
import { GrowthPaymentGateway } from "./growthPayments";
import {
  growthWorkspace,
  growthDetail,
  saveGrowth,
  submitGrowth,
  setGrowthPrice,
  addGrowthAdmin,
  assignGrowthAdmins,
  recordGrowthVerification,
  createGrowthQuote,
  acceptGrowthQuote,
  cancelGrowth,
  confirmGrowthLeave,
  proposeGrowthExtension,
  decideGrowthExtension,
  recordGrowthAudience,
  growthInventory,
  setGrowthAudiencePolicy,
  growthWorkerShift,
  setGrowthWorkerShift,
} from "./growth";
export function growthWebhookRouter(gateway: GrowthPaymentGateway) {
  const router = express.Router();
  router.use(
    rateLimit({
      windowMs: 60000,
      limit: 60,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  router.post("/kora", express.json({ limit: "24kb" }), async (req, res) => {
    try {
      res.json(
        await gateway.koraWebhook(
          req.body,
          String(req.get("x-korapay-signature") || ""),
        ),
      );
    } catch {
      res
        .status(400)
        .json({ error: "Webhook was not verified; no live funds moved" });
    }
  });
  router.post("/squad", (_req, res) =>
    res.status(503).json({
      error:
        "Squad webhook validation is not certified. Use authenticated sandbox server-side verification; no live funds moved",
    }),
  );
  return router;
}
export function registerGrowthRoutes(
  app: express.Express,
  db: Database,
  guard: any,
  role: any,
  gateway: GrowthPaymentGateway,
  creatives: GrowthCreativeEngine,
) {
  const handle =
    (fn: (req: any) => any): express.RequestHandler =>
    (req, res) => {
      Promise.resolve()
        .then(() => fn(req))
        .then((data) => res.json(data))
        .catch((e) =>
          res.status(400).json({
            error: e.message || "Campaign action could not be completed",
          }),
        );
    };
  const advertiser = role("ADVERTISER"),
    admin = role("ADMIN");
  const compose = rateLimit({
    windowMs: 60000,
    limit: 20,
    keyGenerator: (req: any) => req.account.id,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.get(
    "/api/growth-availability",
    guard,
    role("EARNER"),
    handle((req) => growthWorkerShift(db, req.account.id)),
  );
  app.put(
    "/api/growth-availability",
    guard,
    role("EARNER"),
    handle((req) => setGrowthWorkerShift(db, req.account.id, req.body.minutes)),
  );
  app.put(
    "/api/admin/growth-audience-policy",
    guard,
    admin,
    handle((req) => setGrowthAudiencePolicy(db, req.account.id, req.body)),
  );
  app.get(
    "/api/growth",
    guard,
    advertiser,
    handle((req) => growthWorkspace(db, req.account.id)),
  );
  app.post(
    "/api/growth/:id/creative-preview",
    guard,
    advertiser,
    compose,
    handle((req) =>
      creatives.gallery(
        req.account.id,
        req.params.id,
        req.body.count === undefined ? 4 : req.body.count,
      ),
    ),
  );
  app.get(
    "/api/growth/:id",
    guard,
    advertiser,
    handle((req) => growthDetail(db, req.params.id, req.account.id)),
  );
  app.post(
    "/api/growth",
    guard,
    advertiser,
    compose,
    handle((req) =>
      saveGrowth(
        db,
        req.account.id,
        req.body,
        String(req.get("Idempotency-Key") || ""),
      ),
    ),
  );
  app.put(
    "/api/growth/:id",
    guard,
    advertiser,
    compose,
    handle((req) =>
      saveGrowth(
        db,
        req.account.id,
        req.body,
        String(req.get("Idempotency-Key") || ""),
        req.params.id,
      ),
    ),
  );
  app.post(
    "/api/growth/:id/submit",
    guard,
    advertiser,
    compose,
    handle((req) =>
      submitGrowth(db, req.account.id, req.params.id, req.body.revision),
    ),
  );
  app.post(
    "/api/growth/:id/accept",
    guard,
    advertiser,
    handle((req) =>
      acceptGrowthQuote(db, req.account.id, req.params.id, req.body.quoteId),
    ),
  );
  app.post(
    "/api/growth/:id/cancel",
    guard,
    advertiser,
    handle((req) => cancelGrowth(db, req.account.id, req.params.id)),
  );
  app.post(
    "/api/growth/:id/extensions/:extension",
    guard,
    advertiser,
    handle((req) => {
      if (typeof req.body.accept !== "boolean")
        throw Error("Accept or decline the extension");
      return decideGrowthExtension(
        db,
        req.account.id,
        req.params.id,
        req.params.extension,
        req.body.accept,
      );
    }),
  );
  app.get(
    "/api/growth/:id/report",
    guard,
    advertiser,
    handle((req) => {
      const d = growthDetail(db, req.params.id, req.account.id);
      return {
        version: 1,
        id: d.id,
        product: d.input.product,
        status: d.status,
        target: d.input.quantity,
        delivered: d.delivered,
        baseline: d.baseline,
        latestCount: d.latestCount,
        startedAt: d.startedAt,
        completedAt: d.completedAt,
        terms: d.terms,
        events: d.events,
        privacy:
          "Participant identifiers and other users’ private account information are not included.",
      };
    }),
  );
  app.post(
    "/api/growth/:id/sandbox-checkout",
    guard,
    advertiser,
    compose,
    handle((req) => {
      if (req.body.confirmSandbox !== true)
        throw Error(
          "This is a sandbox test only. Explicit confirmation required",
        );
      return gateway.initiate(req.account.id, req.params.id, req.body.provider);
    }),
  );
  app.post(
    "/api/growth-payments/:reference/verify",
    guard,
    advertiser,
    compose,
    handle((req) => gateway.verify(req.account.id, req.params.reference)),
  );
  app.get(
    "/api/admin/growth",
    guard,
    admin,
    handle((req) => growthWorkspace(db, req.account.id, true)),
  );
  app.put(
    "/api/admin/growth-prices/:product",
    guard,
    admin,
    handle((req) =>
      setGrowthPrice(db, req.account.id, req.params.product, req.body),
    ),
  );
  app.post(
    "/api/admin/growth-service-admins",
    guard,
    admin,
    handle((req) => addGrowthAdmin(db, req.account.id, req.body)),
  );
  app.post(
    "/api/admin/growth/:id/assign",
    guard,
    admin,
    handle((req) =>
      assignGrowthAdmins(
        db,
        req.account.id,
        req.params.id,
        req.body.serviceAdminIds,
      ),
    ),
  );
  app.post(
    "/api/admin/growth/:id/verify",
    guard,
    admin,
    handle((req) =>
      recordGrowthVerification(db, req.account.id, req.params.id, req.body),
    ),
  );
  app.post(
    "/api/admin/growth/:id/quote",
    guard,
    admin,
    handle((req) =>
      createGrowthQuote(db, req.account.id, req.params.id, req.body),
    ),
  );
  app.post(
    "/api/admin/growth/:id/extensions",
    guard,
    admin,
    handle((req) =>
      proposeGrowthExtension(db, req.account.id, req.params.id, req.body),
    ),
  );
  app.post(
    "/api/admin/growth-assignments/:id/left",
    guard,
    admin,
    handle((req) => confirmGrowthLeave(db, req.account.id, req.params.id)),
  );
  app.post(
    "/api/admin/growth-audiences",
    guard,
    admin,
    handle((req) => recordGrowthAudience(db, req.account.id, req.body)),
  );
  app.get(
    "/api/admin/growth/:id/inventory",
    guard,
    admin,
    handle((req) => {
      const order = growthDetail(db, req.params.id, req.account.id, true);
      return growthInventory(
        db,
        order.input.product,
        order.input.countries,
        order.id,
      );
    }),
  );
  // A real launch cannot be enabled merely by changing a price or pressing an admin button.
  app.post("/api/growth/:id/launch", guard, advertiser, (_req, res) =>
    res.status(503).json({
      error:
        "Live campaigns require approved merchant funding, verified provider counting and a certified paid delivery adapter. No payment or broadcast was started.",
    }),
  );
}
