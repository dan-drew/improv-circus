import { Social } from "../_models/social.js";

const DEFAULT_SITE_URL = "http://localhost:8111";
const siteUrl = process.env.SITE_URL ?? DEFAULT_SITE_URL;

export default {
  title: "Improv Circus",
  description: "Improv Circus is a travelling troupe of hilarious improvisers with decades of experience" +
    " performing across the nation. We do it all: short form games in \"Who's Line Is It Anyway?\" tradition," +
    " competitive short form, long form and musical.",
  url: siteUrl,
  organization: {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "Improv Circus",
    url: siteUrl,
    logo: `${siteUrl}/images/improv-circus.png`,
    email: "info@improv-circus.com",
  },
  social: [
    new Social('instagram', 'improv.circus'),
    new Social('facebook', 'improv.circus'),
    new Social('tiktok', 'improv.circus'),
    new Social('youtube', 'improv-circus'),
  ]
};
