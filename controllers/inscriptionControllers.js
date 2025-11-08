// controllers/inscriptionControllers.js
const asyncHandler = require('express-async-handler')
const nodemailer = require('nodemailer')
const Inscription = require('../models/inscription.model').default

// parse les champs JSON envoyés en multipart/form-data
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

  // 1. récupérer les données (multipart → souvent string)
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
    console.warn('[VALIDATION] prénom/nom manquants dans ficheRenseignement')
    return res.status(400).json({
      message: 'Les champs prénom et nom de la fiche de renseignement sont obligatoires'
    })
  }

  // 4. construire les URLs publiques vers les fichiers
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

  // 5. construire l’objet à enregistrer
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
    // 6. enregistrer dans Mongo
    const inscription = await Inscription.create(inscriptionObject)
    console.log('[INSCRIPTION ENREGISTRÉE] :', inscription)

    // === IMPORTANT ===
    // on ne tente d'envoyer le mail QUE si SEND_EMAIL=true et qu'on a les identifiants
    const canSendMail =
      process.env.SEND_EMAIL === 'true' &&
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASS

    // message HTML à envoyer (on le prépare de toute façon)
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
        <li>Diplôme : ${
          documents.diplomeUrl
            ? `<a href="${documents.diplomeUrl}">${documents.diplomeUrl}</a>`
            : 'Non fourni'
        }</li>
        <li>CNI : ${
          documents.carteIdentiteUrl
            ? `<a href="${documents.carteIdentiteUrl}">${documents.carteIdentiteUrl}</a>`
            : 'Non fournie'
        }</li>
        <li>Reçu paiement : ${
          documents.recuPaiementUrl
            ? `<a href="${documents.recuPaiementUrl}">${documents.recuPaiementUrl}</a>`
            : 'Non fourni'
        }</li>
      </ul>
    `

    // si on ne peut pas/envoyer ne doit pas → on s'arrête là
    if (!canSendMail) {
      console.log('[EMAIL] Envoi désactivé (SEND_EMAIL !== "true" ou credentials manquants)')
      return res.status(201).json({
        success: true,
        message: "Inscription enregistrée. (Envoi e-mail désactivé sur ce serveur.)",
        inscription
      })
    }

    // 7. préparer le transport mail GMAIL
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000
    })

    // 8. tenter d’envoyer le mail
    try {
      await transporter.sendMail({
        from: `"Institut Sup" <${process.env.EMAIL_USER}>`,
        to: process.env.INSTITUTE_EMAIL || process.env.EMAIL_USER,
        subject: 'Nouvelle inscription en ligne',
        html: message
      })

      return res.json({
        success: true,
        message: 'Inscription envoyée avec succès !',
        inscription
      })
    } catch (error) {
      console.error("Erreur lors de l'envoi du mail (on renvoie quand même OK) :", error.message)

      return res.status(201).json({
        success: true,
        message:
          "Inscription enregistrée, mais le serveur n'a pas pu envoyer l'e-mail (timeout SMTP).",
        inscription
      })
    }
  } catch (err) {
    console.error('[ERREUR MONGODB create] :', err)
    return res.status(500).json({
      message: 'Erreur serveur lors de la création',
      error: err.message
    })
  }
})

module.exports = {
  createNewInscription
}
