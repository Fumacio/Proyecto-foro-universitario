const { ValidationError } = require('../utils/errors');

/**
 * Middleware de validación con Zod.
 * Uso: validate(schema)            → valida req.body
 *      validate(schema, 'query')   → valida req.query
 *      valida y reemplaza la fuente con los datos parseados/coeridos
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.') || source,
        message: issue.message
      }));
      return next(new ValidationError('Datos inválidos', details));
    }

    // defineProperty para poder pisar getters (ej: req.query en Express 5)
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true
    });

    next();
  };
}

module.exports = validate;
