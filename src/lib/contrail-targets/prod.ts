// Generated from the deployed Contrail contract by scripts/update-prod-contrail.mjs.
import { createPublicServiceClient } from "@atmo-dev/contrail/client";
import type {} from "$lib/contrail/types/index.js";

export const contrailMethods = [
  "watch.atmo.comment.getRecord",
  "watch.atmo.comment.listRecords",
  "watch.atmo.getCursor",
  "watch.atmo.getProfile",
  "watch.atmo.like.getRecord",
  "watch.atmo.like.listRecords",
  "watch.atmo.list.getRecord",
  "watch.atmo.list.listRecords",
  "watch.atmo.listItem.getRecord",
  "watch.atmo.listItem.listRecords",
  "watch.atmo.notifyOfUpdate",
  "watch.atmo.review.getRecord",
  "watch.atmo.review.listRecords",
  "watch.atmo.review.listWrittenRecords",
] as const;

export const contrail = createPublicServiceClient({
  endpoint: "https://api.atmo.watch",
  contractDigest:
    "sha256:edfc8edad45272bc6a66e56d2ea4bc61d1d7f3724304fdd492f9486c33d4032c",
  serviceDid: "did:web:api.atmo.watch#contrail",
  scope:
    "rpc?lxm=watch.atmo.notifyOfUpdate&aud=did:web:api.atmo.watch%23contrail",
  serviceMethods: [
    "watch.atmo.comment.getRecord",
    "watch.atmo.comment.listRecords",
    "watch.atmo.getCursor",
    "watch.atmo.getProfile",
    "watch.atmo.like.getRecord",
    "watch.atmo.like.listRecords",
    "watch.atmo.list.getRecord",
    "watch.atmo.list.listRecords",
    "watch.atmo.listItem.getRecord",
    "watch.atmo.listItem.listRecords",
    "watch.atmo.notifyOfUpdate",
    "watch.atmo.review.getRecord",
    "watch.atmo.review.listRecords",
    "watch.atmo.review.listWrittenRecords",
  ],
  collections: [
    "app.bsky.actor.profile",
    "social.popfeed.actor.profile",
    "social.popfeed.feed.comment",
    "social.popfeed.feed.like",
    "social.popfeed.feed.list",
    "social.popfeed.feed.listItem",
    "social.popfeed.feed.review",
  ],
  notifyMethod: "watch.atmo.notifyOfUpdate",
});
