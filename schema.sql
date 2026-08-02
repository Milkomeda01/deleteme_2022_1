-- Table des demandes de contact.
-- Le Worker la crée automatiquement au premier message ; ce fichier permet
-- de l'initialiser à la main :
--   npx wrangler d1 execute deniscartier-contact --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS demandes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  recu_le   TEXT NOT NULL,
  nom       TEXT,
  prenom    TEXT,
  telephone TEXT,
  email     TEXT,
  projet    TEXT,
  message   TEXT,
  ip        TEXT,
  pays      TEXT,
  envoye    INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_demandes_recu_le ON demandes (recu_le);
CREATE INDEX IF NOT EXISTS idx_demandes_ip ON demandes (ip, recu_le);
