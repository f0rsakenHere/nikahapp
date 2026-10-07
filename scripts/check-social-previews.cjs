const assert = require("node:assert/strict");
const sharp = require("sharp");

const base = process.env.PREVIEW_BASE ?? "http://localhost:3000";
const pages = [
  ["/", "NikahCanada | Muslim Marriage Match & Matrimony Service", "social-share-v1.jpg"],
  ["/pricing", "Simple, transparent pricing | NikahCanada", "social-pricing-v1.jpg"],
  ["/how-it-works", "How it works | NikahCanada", "social-how-it-works-v3.jpg"],
  ["/register", "Create your account | NikahCanada", "social-share-v1.jpg"],
  ["/login", "Sign in | NikahCanada", "social-share-v1.jpg"],
  ["/forgot-password", "Reset your password | NikahCanada", "social-share-v1.jpg"],
  ["/reset-password", "Choose a new password | NikahCanada", "social-share-v1.jpg"],
  ["/verify-email", "Confirm your email | NikahCanada", "social-share-v1.jpg"],
  ["/wali/invite", "Wali invitation | NikahCanada", "social-share-v1.jpg"],
  ["/legal/privacy", "Privacy Policy | NikahCanada", "social-share-v1.jpg"],
  ["/legal/terms", "Terms and Conditions | NikahCanada", "social-share-v1.jpg"],
];

function tags(head) {
  return [...head.matchAll(/<meta\s+([^>]+)>/g)].map((match) =>
    Object.fromEntries(
      [...match[1].matchAll(/([\w:]+)="([^"]*)"/g)].map((attribute) => [
        attribute[1],
        attribute[2].replaceAll("&amp;", "&"),
      ]),
    ),
  );
}

async function main() {
  const agents = ["WhatsApp/2.24.1", "facebookexternalhit/1.1", "Twitterbot/1.0"];
  let origin;
  for (const agent of agents) {
    for (const [path, title, image] of pages) {
      const response = await fetch(base + path, { headers: { "user-agent": agent }, redirect: "manual" });
      assert.equal(response.status, 200, `${agent} ${path} should be public`);
      const head = (await response.text()).match(/<head>([\s\S]*?)<\/head>/)?.[1];
      assert.ok(head, `${agent} ${path} must expose metadata in the HTML head`);
      const meta = tags(head);
      const get = (name) => meta.filter((tag) => tag.property === name || tag.name === name).map((tag) => tag.content);
      assert.deepEqual(get("og:title"), [title], `${agent} ${path} title`);
      assert.deepEqual(get("og:type"), ["website"]);
      assert.deepEqual(get("twitter:card"), ["summary_large_image"]);
      assert.deepEqual(get("og:image:width"), ["1200"]);
      assert.deepEqual(get("og:image:height"), ["630"]);
      assert.deepEqual(get("og:image:type"), ["image/jpeg"]);
      assert.equal(get("og:description").length, 1);
      assert.equal(get("og:image:alt").length, 1);
      const url = new URL(get("og:url")[0]);
      const imageUrl = new URL(get("og:image")[0]);
      const twitterUrl = new URL(get("twitter:image")[0]);
      assert.equal(url.pathname, path);
      assert.equal(imageUrl.pathname, `/images/${image}`);
      assert.equal(twitterUrl.href, imageUrl.href);
      assert.equal(url.origin, imageUrl.origin);
      if (origin) assert.equal(url.origin, origin);
      origin = url.origin;
      if (!["/", "/pricing", "/how-it-works"].includes(path)) {
        assert.ok(get("robots").some((value) => value.includes("noindex")), `${path} should not be indexed`);
      }
    }
    console.log(`PASS: ${agent} previews on ${pages.length} public pages`);
  }

  for (const image of ["social-share-v1.jpg", "social-pricing-v1.jpg", "social-how-it-works-v3.jpg"]) {
    const response = await fetch(`${base}/images/${image}`, { redirect: "manual" });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^image\/jpeg/);
    const buffer = Buffer.from(await response.arrayBuffer());
    const dimensions = await sharp(buffer).metadata();
    assert.equal(dimensions.width, 1200);
    assert.equal(dimensions.height, 630);
    assert.ok(buffer.length < 400000, `${image} should stay lightweight`);
    console.log(`PASS: ${image} (${buffer.length} bytes)`);
  }

  const protectedResponse = await fetch(`${base}/dashboard`, { redirect: "manual" });
  assert.equal(protectedResponse.status, 307);
  assert.ok(protectedResponse.headers.get("location")?.includes("/login"));
  console.log("PASS: protected pages still redirect sharing crawlers to sign in");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
