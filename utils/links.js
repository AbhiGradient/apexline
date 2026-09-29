const makeLink = (path, state) => (overrides = {}) => {
  const params = new URLSearchParams();
  Object.entries({ ...state, ...overrides }).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined && value !== false) params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

const pageInfo = (total, page, size) => ({
  pages: Math.max(1, Math.ceil(total / size)),
  offset: (Math.max(1, page) - 1) * size
});

module.exports = { makeLink, pageInfo };