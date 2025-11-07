const allowedOrigins = require('./allowedOrigins')

const corsOptions = {
  origin: true,      // autorise tout
  credentials: true,
  optionsSuccessStatus: 200
}

module.exports = corsOptions 
