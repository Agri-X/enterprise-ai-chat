const cookies = require('cookie');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { isEnabled } = require('@librechat/api');
const { getUserById, findSession } = require('~/models');

/**
 * Custom Middleware to handle JWT authentication, with support for OpenID token reuse
 * Switches between JWT and OpenID authentication based on cookies and environment settings
 */
const requireJwtAuth = (req, res, next) => {
  // Check if token provider is specified in cookies
  const cookieHeader = req.headers.cookie;
  const tokenProvider = cookieHeader ? cookies.parse(cookieHeader).token_provider : null;

  // Use OpenID authentication if token provider is OpenID and OPENID_REUSE_TOKENS is enabled
  if (tokenProvider === 'openid' && isEnabled(process.env.OPENID_REUSE_TOKENS)) {
    return passport.authenticate('openidJwt', { session: false })(req, res, next);
  }

  // Default to standard JWT authentication
  passport.authenticate('jwt', { session: false }, async (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (user) {
      req.user = user;
      return next();
    }

    // Fallback: Check for refreshToken cookie
    const refreshToken = req.headers.cookie ? cookies.parse(req.headers.cookie).refreshToken : null;
    if (refreshToken) {
      try {
        const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const userId = payload.id;
        const session = await findSession({ userId, refreshToken });

        if (session && session.expiration > new Date()) {
          const dbUser = await getUserById(userId, '-password -__v -totpSecret -backupCodes');
          if (dbUser) {
            dbUser.id = dbUser._id.toString();
            req.user = dbUser;
            return next();
          }
        }
      } catch (e) {
        // Token invalid or expired, ignore
      }
    }

    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  })(req, res, next);
};

module.exports = requireJwtAuth;
