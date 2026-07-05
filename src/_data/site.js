const DEFAULT_SITE_URL = "http://localhost:8111";
const siteUrl = process.env.SITE_URL ?? DEFAULT_SITE_URL;

export default {
  title: "Improv Circus",
  url: siteUrl,
  organization: {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "Improv Circus",
    url: siteUrl,
    logo: `${siteUrl}/images/improv-circus.png`,
    email: "info@improv-circus.com",
  },
};
