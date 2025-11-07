import mongoose from "mongoose";

const EtablissementSchema = new mongoose.Schema(
  {
    annee: { type: String, trim: true },
    etablissement: { type: String, trim: true },
    classe: { type: String, trim: true },
  },
  { _id: false }
);

const InscriptionSchema = new mongoose.Schema(
  {
    
    ficheRenseignement: {
      prenom: { type: String, required: true, trim: true },
      nom: { type: String, required: true, trim: true },
      dateNaissance: { type: Date },
      lieuNaissance: { type: String, trim: true },
      adresse: { type: String, trim: true },
      bacAnnee: { type: String, trim: true },
      mention: { type: String, trim: true },
    },

    
    etablissements: {
      type: [EtablissementSchema],
      default: [],
    },

    
    formulaireBtsDts: {
      filiere: { type: String, trim: true },
      annee: { type: String, trim: true },
      prenom: { type: String, trim: true },
      nom: { type: String, trim: true },
      dateNaissance: { type: Date },
      lieuNaissance: { type: String, trim: true },
      dernierDiplomeIntitule: { type: String, trim: true },
      dernierDiplomeAnnee: { type: String, trim: true },
      adresse: { type: String, trim: true },
      telephone: { type: String, trim: true },
      email: { type: String, trim: true },
      tuteur: {
        nom: { type: String, trim: true },
        prenom: { type: String, trim: true },
        telephone: { type: String, trim: true },
      },
    },

    
    documents: {
      diplomeUrl: { type: String, trim: true },           
      carteIdentiteUrl: { type: String, trim: true },
      recuPaiementUrl: { type: String, trim: true },
    },

    
    paiement: {
      mode: {
        type: String,
        enum: ["AUCUN", "INSTITUT", "WAVE", "ORANGE_MONEY"],
        default: "AUCUN",
      },
      reference: { type: String, trim: true } 
    },
  },
  {
    timestamps: true,
    collection: "inscription",
  }
);

const Inscription = mongoose.model("Inscription", InscriptionSchema);

export default Inscription;
