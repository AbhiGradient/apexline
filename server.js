require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const { pool } = require('./config/db');
const site = require('./config/site');
const { bootstrap } = require('./database/bootstrap');
const locals = require('./middleware/locals');
const navData = require('./middleware/navData');
const csrf = require('./middleware/csrf');
const refreshUser = require('./middleware/refreshUser');

const isProd = process.env.NODE_ENV === 'production';
const app = express();

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'https:'],
        'upgrade-insecure-requests': isProd ? [] : null
      }
    }
  })
);
app.use(compression());
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: isProd ? '7d' : 0
  })
);

app.get('/healthz', (req, res) => res.type('text').send('ok'));

app.get('/ping', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    await pool.query('SELECT 1');
    res.type('text').send('pong');
  } catch (err) {
    res.status(503).type('text').send('database unavailable');
  }
});

app.use(rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));

app.use(
  session({
    name: 'apx.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    store: new MySQLStore({ clearExpired: true, expiration: 1000 * 60 * 60 * 24 * 14 }, pool),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: 'auto',
      maxAge: 1000 * 60 * 60 * 24 * 14
    }
  })
);

app.use(locals);
app.use(navData);
app.use(csrf);
app.use(refreshUser);

const routesEntry = path.join(__dirname, 'routes', 'index.js');
if (fs.existsSync(routesEntry)) {
  app.use(require(routesEntry));
} else {
  app.get('/', (req, res) => res.type('text').send(`${site.name} core is running. Routes arrive in the next batches.`));
}

const renderOrText = (res, view, options, fallback) =>
  res.render(view, options, (err, html) => (err ? res.type('text').send(fallback) : res.send(html)));

app.use((req, res) => {
  res.status(404);
  renderOrText(res, 'pages/error', { status: 404, message: 'This page could not be found.', seo: { title: 'Page not found', noindex: true } }, 'Page not found');
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
 if (status >= 500) console.error(`[${req.method}] ${req.originalUrl}`, err);
  res.status(status);
  renderOrText(
    res,
    'pages/error',
    {
      status,
      message: status >= 500 ? 'Something went wrong on our side. Please try again shortly.' : err.message,
      seo: { title: `Error ${status}`, noindex: true }
    },
    `Error ${status}`
  );
});

const PORT = Number(process.env.PORT) || 3000;

(async () => {
  try {
    const { seeded } = await bootstrap();
    if (seeded) console.log('Database created and seeded with starter data.');
  } catch (err) {
    console.error('Database setup failed:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, '0.0.0.0', () => console.log(`${site.name} is live at ${site.url} (port ${PORT})`));
  server.keepAliveTimeout = 65 * 1000;
  server.headersTimeout = 66 * 1000;

  const shutdown = () => {
    server.close(() => pool.end().catch(() => {}).finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})();

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));