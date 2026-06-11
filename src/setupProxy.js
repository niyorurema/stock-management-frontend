const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: process.env.REACT_APP_API_URL || 'http://localhost:8080',
      changeOrigin: true,
      secure: false,
      onProxyReq: (proxyReq, req) => {
        const auth = req.headers.authorization;
        if (auth) {
          proxyReq.setHeader('Authorization', auth);
        }
        const xAuth = req.headers['x-auth-token'];
        if (xAuth) {
          proxyReq.setHeader('X-Auth-Token', xAuth);
        }
      },
    })
  );
};
