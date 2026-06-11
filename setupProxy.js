const { createProxyMiddleware } = require('http-proxy-middleware');
//process.env.REACT_APP_API_PROXY ||
const target =
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_PROXY ||
  'http://localhost:8081';

console.log('[setupProxy] API →', target);

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      secure: false,
      logLevel: 'warn',
      onProxyReq: (proxyReq, req) => {
        const auth = req.headers.authorization;
        if (auth) proxyReq.setHeader('Authorization', auth);
        const xAuth = req.headers['x-auth-token'];
        if (xAuth) proxyReq.setHeader('X-Auth-Token', xAuth);
      },
    })
  );
};
