const sendError = (res, err, message, status = 500) => {
  console.error(message, err);
  res.status(status).json({ error: message });
};

module.exports = { sendError };
