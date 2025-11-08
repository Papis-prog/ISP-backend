// controllers/inscriptionControllers.js
const asyncHandler = require('express-async-handler')
const nodemailer = require('nodemailer')
const Inscription = require('../models/inscription.model').default

// petit helper pour parser le JSON qui vient d'un formData (multipart)
const parseMaybeJSON = (value) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

/**
 * @desc Créer une nouvelle inscription
 * @route POST /inscriptions
 * @access Public
 */
const createNewInscription = asyncHandler(async (req, res) => {
  console.log('================= NOUVELLE REQUÊTE /inscriptions =================')
  console.log('[BODY RECU] :', req.body)
  console.log('[FILES RECUS] :', req.files)

  // 1. récupérer les données envoyées en multipart
  const ficheRenseignement = parseMaybeJSON(req.body?.ficheRenseignement)
  const etablissements = parseMaybeJSON(req.body?.etablissements)
  const formulaireBtsDts = parseMaybeJSON(req.body?.formulaireBtsDts)
  const paiement = parseMaybeJSON(req.body?.paiement)
  const documentsBody = parseMaybeJSON(req.body?.documents)

  // 2. récupérer les fichiers uploadés par multer
  const diplomeFile = req.files?.diplome?.[0]
  const cniFile = req.files?.carteIdentite?.[0]
  const recuFile = req.files?.recuPaiement?.[0]

  // 3. validation minimale
  if (!ficheRenseignement || !ficheRenseignement.prenom || !ficheRenseignement.nom) {
    return res.status(400).json({
      success: false,
      emailSent: false,
      message: 'Les champs prénom et nom de la fiche de renseignement sont obligatoires'
    })
  }

  // 4. construire les URLs publiques pour la BDD
  const baseUrl = `${req.protocol}://${req.get('host')}`
  const documents = {
    diplomeUrl: diplomeFile
      ? `${baseUrl}/uploads/${diplomeFile.filename}`
      : documentsBody?.diplomeUrl,
    carteIdentiteUrl: cniFile
      ? `${baseUrl}/uploads/${cniFile.filename}`
      : documentsBody?.carteIdentiteUrl,
    recuPaiementUrl: recuFile
      ? `${baseUrl}/uploads/${recuFile.filename}`
      : documentsBody?.recuPaiementUrl
  }

  // 5. objet à enregistrer en base
  const inscriptionObject = {
    ficheRenseignement,
    etablissements: Array.isArray(etablissements)
      ? etablissements
      : etablissements
      ? [etablissements]
      : [],
    formulaireBtsDts,
    documents,
    paiement: {
      mode: paiement?.mode || 'AUCUN',
      reference: paiement?.reference || ''
    }
  }

  console.log('[OBJET A ENREGISTRER] :', JSON.stringify(inscriptionObject, null, 2))

  try {
    // 6. on enregistre d'abord en base
    const inscription = await Inscription.create(inscriptionObject)
    console.log('[INSCRIPTION ENREGISTRÉE] :', inscription)

    // 7. on répond TOUT DE SUITE au frontend pour ne pas le bloquer
    // (important sur Render si l’envoi d’email prend trop de temps)
    res.status(201).json({
      success: true,
      emailSent: false,
      message: "Inscription enregistrée. Tentative d’envoi de l’e-mail à l’administration...",
      inscription
    })

    // 8. ensuite seulement on tente d’envoyer l’e-mail
    // on utilise EXACTEMENT la même config que ton autre fichier qui marche sur Render
    if (!process.env.MAIL || !process.env.PASSWORD_EMAIL) {
      console.log('[MAIL] MAIL ou PASSWORD_EMAIL manquant → pas d’envoi.')
      return
    }

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.MAIL,
        pass: process.env.PASSWORD_EMAIL
      }
    })

    // 9. préparer le contenu du mail
    const html = `
      <h2>Nouvelle inscription en ligne</h2>
      <p><strong>Prénom :</strong> ${ficheRenseignement.prenom}</p>
      <p><strong>Nom :</strong> ${ficheRenseignement.nom}</p>
      <p><strong>Adresse :</strong> ${ficheRenseignement.adresse || ''}</p>
      <p><strong>Filière demandée :</strong> ${formulaireBtsDts?.filiere || ''}</p>
      <p><strong>Mode de paiement :</strong> ${inscriptionObject.paiement.mode}</p>
      <p><strong>Référence paiement :</strong> ${inscriptionObject.paiement.reference}</p>
      <p><strong>ID inscription :</strong> ${inscription._id}</p>
      <h3>Documents</h3>
      <ul>
        <li>Diplôme : ${documents.diplomeUrl || 'Non fourni'}</li>
        <li>CNI : ${documents.carteIdentiteUrl || 'Non fournie'}</li>
        <li>Reçu paiement : ${documents.recuPaiementUrl || 'Non fourni'}</li>
      </ul>
    `

    // 10. pièces jointes si upload réel
    const attachments = []
    if (diplomeFile) {
      attachments.push({
        filename: diplomeFile.originalname,
        path: diplomeFile.path
      })
    }
    if (cniFile) {
      attachments.push({
        filename: cniFile.originalname,
        path: cniFile.path
      })
    }
    if (recuFile) {
      attachments.push({
        filename: recuFile.originalname,
        path: recuFile.path
      })
    }

    // 11. envoi en arrière-plan
    transporter
      .sendMail({
        from: process.env.MAIL,
        to: process.env.INSTITUTE_EMAIL || process.env.MAIL,
        subject: 'Nouvelle inscription en ligne',
        html,
        attachments
      })
      .then((info) => {
        console.log('[MAIL] e-mail envoyé avec succès :', info.messageId)
      })
      .catch((err) => {
        // c’est ici que sur Render tu verras par ex. "Connection timeout"
        console.error("[MAIL] échec d'envoi :", err.message)
      })

  } catch (err) {
    console.error('[ERREUR MONGODB create] :', err)
    // on a déjà répondu au front plus haut
  }
})

module.exports = {
  createNewInscription
}
