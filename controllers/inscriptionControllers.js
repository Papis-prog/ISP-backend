// controllers/inscriptionControllers.js
const asyncHandler = require('express-async-handler')
const nodemailer = require('nodemailer')
const Inscription = require('../models/inscription.model').default

// petit helper pour parser le JSON venant de multipart
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

  // 1. récupérer les données multipart
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
      message: 'Les champs prénom et nom de la fiche de renseignement sont obligatoires'
    })
  }

  // 4. construire les URLs publiques vers les fichiers (pour la BDD)
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
    // 6. enregistrer en base
    const inscription = await Inscription.create(inscriptionObject)
    console.log('[INSCRIPTION ENREGISTRÉE] :', inscription)

    // on regarde si on a le droit d’envoyer le mail
    // (comme ça en prod/render tu peux mettre SEND_EMAIL=false)
    const canSendMail =
      process.env.SEND_EMAIL === 'true' &&
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASS

    // HTML du mail
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

    // si on ne veut pas/peut pas envoyer → on s’arrête ici
    if (!canSendMail) {
      return res.status(201).json({
        success: true,
        message: "Inscription enregistrée. (Envoi e-mail désactivé ou non configuré.)",
        inscription
      })
    }

    // 7. transporteur “à l’ancienne” comme ton ancien code
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // mot de passe d'appli
      }
    })

    // 8. attachements comme avant (on prend le chemin physique)
    const attachments = []
    if (diplomeFile) {
      attachments.push({
        filename: diplomeFile.originalname,
        path: diplomeFile.path   // <- multer nous donne le chemin exact
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

    // 9. envoi du mail
    try {
      await transporter.sendMail({
        from: `"Institut Sup" <${process.env.EMAIL_USER}>`,
        to: process.env.INSTITUTE_EMAIL || process.env.EMAIL_USER,
        subject: 'Nouvelle inscription en ligne',
        html: message,
        attachments
      })

      return res.json({
        success: true,
        message: 'Inscription envoyée avec succès !',
        inscription
      })
    } catch (error) {
      // si c’est Render qui bloque le SMTP → on remet OK
      console.error("Erreur lors de l'envoi du mail (on renvoie quand même OK) :", error.message)
      return res.status(201).json({
        success: true,
        message: "Inscription enregistrée, mais l'e-mail n'a pas pu être envoyé.",
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
