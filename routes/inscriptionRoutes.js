const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const inscriptionController = require('../controllers/inscriptionControllers')

// dossier de destination
const uploadDir = path.join(__dirname, '..', 'public', 'uploads')

// on s’assure qu’il existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, unique + ext)
  }
})

const upload = multer({ storage })

router.post(
  '/',
  upload.fields([
    { name: 'diplome', maxCount: 1 },
    { name: 'carteIdentite', maxCount: 1 },
    { name: 'recuPaiement', maxCount: 1 }
  ]),
  inscriptionController.createNewInscription
)

module.exports = router
