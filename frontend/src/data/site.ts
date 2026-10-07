export const site = {
  name: "BLACKLISTED",
  parent: "TRENDMAKER",
  city: "Nizamabad",
  region: "Telangana",
  tagline: "Not just for everyone",
  instagramStore: "https://www.instagram.com/blacklisted_store1/",
  instagramOwner: "https://www.instagram.com/trend______maker/",
  // Sid's link (maps.app.goo.gl/xK3uPRjRQAed8j2m6) resolved to its full Google Maps place: the short
  // goo.gl domain is blocked by some Indian ISPs' DNS (it failed on Sid's own Jio connection).
  maps: "https://maps.app.goo.gl/xRq2bcPEHNpKgbDa9",
  // The same place as the short link above, in full. Desktop browsers get this one: the goo.gl
  // short-link domain is blocked by some ISPs' DNS (Jio), and on phones the Maps app catches it first.
  mapsDesktop:
    "https://www.google.com/maps/place/TREND+MAKER+SALOON/@18.669083,78.1064653,19z/data=!4m6!3m5!1s0x3bcddba4552b7d49:0x786c775430278264!8m2!3d18.669083!4d78.1064653!16s%2Fg%2F11yttmzrcc",
  directions: "https://www.google.com/maps/dir/?api=1&destination=18.669083%2C78.1064653",
  geo: { lat: 18.669083, lng: 78.1064653 },
  heroFrames: 240,
  // Shop details for Google (JSON-LD), matching the Google Business Profile. Empty until Sid has them
  // from the owner; nothing here is guessed, and empty fields are left out of the page.
  business: {
    telephone: "", // "+91 …"
    streetAddress: "",
    postalCode: "",
    // e.g. { days: ["Monday", "Tuesday"], opens: "10:00", closes: "21:00" }
    hours: [] as { days: string[]; opens: string; closes: string }[],
  },
  // Google Search Console HTML-tag token (only the content="…" value). Empty: no tag rendered.
  googleVerification: "",
  // false adds <meta name="robots" content="noindex"> (a declined demo never shows in search).
  indexable: true,
  // The Vessels HQ "designed & built by" signature in the footer. false removes it (paying clients).
  credit: true,
};
