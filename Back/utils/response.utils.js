const sendError = (res, err, message, status = 500) => {
  if (process.env.NODE_ENV === 'production') {
    console.error(`${message}: ${err.message}`);
  } else {
    console.error(message, err);
  }
  res.status(status).json({ error: message });
};

module.exports = { sendError };
