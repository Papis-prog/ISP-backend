const express = require('express')
const router = express.Router()
const path = require('path')
const multer = require('multer')
const inscriptionController = require('../controllers/inscriptionControllers')

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'public', 'uploads'))
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
        const ext = path.extname(file.originalname)
        cb(null, unique + ext)
    }
})

const upload = multer({ storage })

router.route('/')
    .post(
        upload.fields([
            { name: 'diplome', maxCount: 1 },
            { name: 'carteIdentite', maxCount: 1 },
            { name: 'recuPaiement', maxCount: 1 }
        ]),
        inscriptionController.createNewInscription
    )

module.exports = router
