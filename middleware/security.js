// Middleware to sanitize request body, query, and params to prevent XSS
const sanitizeInput = (req, res, next) => {
  const sanitizeValue = (val) => {
    if (typeof val === 'string') {
      // Basic HTML escaping
      return val
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    if (Array.isArray(val)) {
      return val.map(item => sanitizeValue(item));
    }
    if (typeof val === 'object' && val !== null) {
      const sanitized = {};
      for (let key in val) {
        sanitized[key] = sanitizeValue(val[key]);
      }
      return sanitized;
    }
    return val;
  };

  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  req.params = sanitizeValue(req.params);
  next();
};

module.exports = { sanitizeInput };
