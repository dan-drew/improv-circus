export default {
  pagination: {
    data: "shows",
    size: 1,
    alias: "show",
  },
  permalink: ({ pagination }) => pagination?.items?.[0]?.permaLink,
};
