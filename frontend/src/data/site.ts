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
  // The Vessels HQ "designed & built by" signature in the footer. false removes it (paying clients).
  credit: true,
};
