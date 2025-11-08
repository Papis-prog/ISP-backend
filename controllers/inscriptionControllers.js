// controllers/inscriptionControllers.js
const asyncHandler = require('express-async-handler')
const nodemailer = require('nodemailer')
const Inscription = require('../models/inscription.model').default

// helper pour parser le JSON qui vient d'un formData
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
 * @desc Create new inscription
 * @route POST /inscriptions
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

  // 2. récupérer les fichiers uploadés
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

  // 5. objet à enregistrer
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
    res.status(201).json({
      success: true,
      emailSent: false, // on mettra true plus bas si ça passe
      message: "Inscription enregistrée. Tentative d’envoi de l’e-mail à l’administration...",
      inscription
    })

    // 8. ensuite seulement on tente d’envoyer l’e-mail

    const canSendMail =
      process.env.SEND_EMAIL === 'true' &&
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASS

    if (!canSendMail) {
      console.log('[MAIL] Envoi désactivé ou configuration manquante.')
      return
    }

    // transporteur Gmail (comme ton ancien code qui marchait)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // mot de passe d’application
      }
    })

    // contenu du mail
    const message = `
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

    // pièces jointes réelles
    const attachments = []
    if (diplomeFile) {
      attachments.push({ filename: diplomeFile.originalname, path: diplomeFile.path })
    }
    if (cniFile) {
      attachments.push({ filename: cniFile.originalname, path: cniFile.path })
    }
    if (recuFile) {
      attachments.push({ filename: recuFile.originalname, path: recuFile.path })
    }

    // envoi “en arrière-plan”
    transporter
      .sendMail({
        from: `"Institut Sup" <${process.env.EMAIL_USER}>`,
        to: process.env.INSTITUTE_EMAIL || process.env.EMAIL_USER,
        subject: 'Nouvelle inscription en ligne',
        html: message,
        attachments
      })
      .then(() => {
        console.log('[MAIL] e-mail envoyé avec succès')
      })
      .catch((err) => {
        console.error("[MAIL] échec d'envoi :", err.message)
      })
  } catch (err) {
    console.error('[ERREUR MONGODB create] :', err)
    return res.status(500).json({
      success: false,
      emailSent: false,
      message: 'Erreur serveur lors de la création',
      error: err.message
    })
  }
})

module.exports = {
  createNewInscription
}
