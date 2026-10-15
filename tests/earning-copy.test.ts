import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EarningRates } from "../src/components/EarningRates";
import { placementRewardMilli } from "../shared/earningRules";
test("public group examples derive exact unchanged confirmed-placement rewards", () => {
  const html = renderToStaticMarkup(React.createElement(EarningRates));
  for (const members of [100, 742, 1000]) {
    const card = html
      .split(`data-members="${members}"`)[1]
      .split("</article>")[0];
    assert.ok(card.includes((placementRewardMilli(members) / 1000).toFixed(3)));
  }
  assert.ok(html.includes(((placementRewardMilli(742) * 2) / 1000).toFixed(3)));
});
test("public earning explanation distinguishes preparation, qualifying funded work and unavailable cashout", () => {
  const html = renderToStaticMarkup(React.createElement(EarningRates));
  assert.ok(html.includes("Pairing alone does not earn Coins"));
  assert.ok(html.includes("Paid jobs and cashout are not open yet"));
  assert.ok(html.includes("Groups below 100 members earn 0 Coins"));
  assert.ok(html.includes("Shared groups count once per post type"));
  assert.ok(html.includes("not on how many people click or join"));
  assert.doesNotMatch(html, /₦|\bNGN\b|naira/i);
});
test("anonymous and signed-in rate calls to action describe their actual destinations", () => {
  const anonymous = renderToStaticMarkup(React.createElement(EarningRates));
  assert.ok(anonymous.includes('href="#/join/worker"'));
  assert.ok(anonymous.includes("Create a free worker account"));
  assert.ok(!anonymous.includes("Try the earning calculator"));
  const signedIn = renderToStaticMarkup(
    React.createElement(EarningRates, { calculatorHref: "#/app/calculator" }),
  );
  assert.ok(signedIn.includes('href="#/app/calculator"'));
  assert.ok(signedIn.includes("Try the earning calculator"));
  const nonWorker = renderToStaticMarkup(
    React.createElement(EarningRates, { calculatorHref: "#/app" }),
  );
  assert.ok(nonWorker.includes("Open my workspace"));
  assert.ok(!nonWorker.includes("Try the earning calculator"));
});
