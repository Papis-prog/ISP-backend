const asyncHandler = require('express-async-handler')
const nodemailer = require('nodemailer')
const Inscription = require('../models/inscription.model').default


const parseMaybeJSON = (value) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch (e) {
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

  
  const ficheRenseignement = parseMaybeJSON(req.body?.ficheRenseignement)
  const etablissements = parseMaybeJSON(req.body?.etablissements)
  const formulaireBtsDts = parseMaybeJSON(req.body?.formulaireBtsDts)
  const paiement = parseMaybeJSON(req.body?.paiement)
  const documentsBody = parseMaybeJSON(req.body?.documents)

 
  const diplomeFile = req.files?.diplome?.[0]
  const cniFile = req.files?.carteIdentite?.[0]
  const recuFile = req.files?.recuPaiement?.[0]

  if (
    !ficheRenseignement ||
    !ficheRenseignement.prenom ||
    !ficheRenseignement.nom
  ) {
    console.warn('[VALIDATION] prénom/nom manquants dans ficheRenseignement')
    return res.status(400).json({
      message: 'Les champs prénom et nom de la fiche de renseignement sont obligatoires',
      debug: {
        ficheRenseignement
      }
    })
  }

  
  // ex: http://localhost:3500/uploads/xxx.pdf
  const baseUrl = `${req.protocol}://${req.get('host')}`

  const documents = {
    // priorité aux fichiers uploadés
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

  const inscriptionObject = {
    ficheRenseignement,
    etablissements: Array.isArray(etablissements) ? etablissements : (etablissements ? [etablissements] : []),
    formulaireBtsDts,
    documents,
    paiement: {
      mode: paiement?.mode || 'AUCUN',
      reference: paiement?.reference || ''
    }
  }

  console.log('[OBJET A ENREGISTRER] :', JSON.stringify(inscriptionObject, null, 2))

  try {
    
    const inscription = await Inscription.create(inscriptionObject)
    console.log('[INSCRIPTION ENREGISTRÉE] :', inscription)

    
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    })

    const message = `
      <h2>Nouvelle inscription en ligne</h2>
      <p><strong>Prénom :</strong> ${ficheRenseignement.prenom}</p>
      <p><strong>Nom :</strong> ${ficheRenseignement.nom}</p>
      <p><strong>Adresse :</strong> ${ficheRenseignement.adresse || ''}</p>
      <p><strong>Filière demandée :</strong> ${formulaireBtsDts?.filiere || ''}</p>
      <p><strong>Mode de paiement :</strong> ${inscriptionObject.paiement.mode}</p>
      <p><strong>Référence paiement :</strong> ${inscriptionObject.paiement.reference}</p>
      <p><strong>ID inscription :</strong> ${inscription._id}</p>
      <p><strong>Diplôme :</strong> ${documents.diplomeUrl || 'Non fourni'}</p>
      <p><strong>CNI :</strong> ${documents.carteIdentiteUrl || 'Non fournie'}</p>
      <p><strong>Reçu paiement :</strong> ${documents.recuPaiementUrl || 'Non fourni'}</p>
    `

    
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
      console.error("Erreur lors de l'envoi :", error)
      return res.status(500).json({
        success: false,
        message: 'Inscription enregistrée mais erreur lors de l’envoi du mail.',
        error: error.message,
        inscription
      })
    }
  } catch (err) {
    console.error('[ERREUR MONGODB create] :', err)
    return res.status(500).json({
      message: 'Erreur serveur lors de la création',
      error: err.message,
      stack: err.stack
    })
  }
})

module.exports = {
  createNewInscription
}
