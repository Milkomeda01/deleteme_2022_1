/**
 * Traitement du formulaire de contact — Cloudflare Pages Function (Worker).
 *
 * Deux garanties :
 *  1. chaque demande est écrite dans la base D1 `CONTACT_DB` avant tout envoi,
 *     donc aucun prospect n'est perdu même si l'e-mail échoue ;
 *  2. aucun service de formulaire tiers n'intervient — seules les données
 *     circulent vers l'API d'envoi d'e-mail configurée.
 *
 * Variables d'environnement attendues (voir README) :
 *   RESEND_API_KEY  clé de l'API d'envoi (secret)
 *   CONTACT_TO      destinataire, ex. deniscartier@mac.com
 *   CONTACT_FROM    expéditeur vérifié, ex. "Site web <site@deniscartierarchitecte.fr>"
 * Binding : CONTACT_DB → base D1.
 */

interface Env {
  CONTACT_DB?: D1Database;
  RESEND_API_KEY?: string;
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
}

type Demande = {
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  projet: string;
  message: string;
};

const MAX_PAR_HEURE = 5;
const LIMITES = { nom: 120, prenom: 120, telephone: 40, email: 160, projet: 120, message: 5000 };

const clean = (v: FormDataEntryValue | null, max: number) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const emailValide = (v: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v);

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** Réponse HTML pour les navigateurs sans JavaScript. */
function page(titre: string, corps: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="fr"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escape(titre)}</title>
<style>
 body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbfaf7;color:#14140f;
      font:400 17px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif;padding:2rem}
 main{max-width:34rem;text-align:center}
 h1{font-family:Georgia,serif;font-weight:400;font-size:2.2rem;line-height:1.15;margin:0 0 1rem}
 p{color:#3d3d35}
 a{display:inline-block;margin-top:1.5rem;padding:.9rem 1.8rem;background:#14140f;color:#fbfaf7;
   text-decoration:none;font-size:.8rem;letter-spacing:.11em;text-transform:uppercase}
</style>
<main><h1>${escape(titre)}</h1><p>${corps}</p><a href="/">Retour à l'accueil</a></main>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );
}

async function assurerTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS demandes (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         recu_le TEXT NOT NULL,
         nom TEXT, prenom TEXT, telephone TEXT, email TEXT,
         projet TEXT, message TEXT, ip TEXT, pays TEXT, envoye INTEGER DEFAULT 0
       )`
    )
    .run();
}

async function envoyerEmail(env: Env, d: Demande, id: number | null): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.CONTACT_TO || !env.CONTACT_FROM) return false;

  const lignes = [
    ['Nom', `${d.prenom} ${d.nom}`.trim()],
    ['Téléphone', d.telephone],
    ['E-mail', d.email],
    ['Type de projet', d.projet || '—'],
  ];

  const html = `
    <div style="font:400 15px/1.6 system-ui,sans-serif;color:#14140f;max-width:36rem">
      <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8a6f3c;margin:0 0 1rem">
        Nouvelle demande — deniscartierarchitecte.fr
      </p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:1.5rem">
        ${lignes
          .map(
            ([k, v]) =>
              `<tr><td style="padding:.45rem 1rem .45rem 0;color:#6b6b60;white-space:nowrap;vertical-align:top">${k}</td>
                   <td style="padding:.45rem 0"><strong>${escape(v)}</strong></td></tr>`
          )
          .join('')}
      </table>
      <p style="color:#6b6b60;margin:0 0 .4rem">Message</p>
      <div style="white-space:pre-wrap;border-left:2px solid #e0dbd1;padding-left:1rem">${escape(d.message)}</div>
      <p style="color:#9a9a90;font-size:12px;margin-top:2rem">
        Répondez directement à ce message pour écrire à ${escape(d.email)}.${id ? ` — demande n°${id}` : ''}
      </p>
    </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.CONTACT_FROM,
      to: [env.CONTACT_TO],
      reply_to: d.email,
      subject: `Demande de ${`${d.prenom} ${d.nom}`.trim()}${d.projet ? ` — ${d.projet}` : ''}`,
      html,
    }),
  });

  if (!res.ok) console.error('Envoi e-mail refusé', res.status, await res.text());
  return res.ok;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const veutJson = (request.headers.get('accept') || '').includes('application/json');
  const echec = (msg: string, status = 400) =>
    veutJson ? json({ ok: false, error: msg }, status) : page('Envoi impossible', escape(msg), status);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return echec('Requête illisible.');
  }

  // Piège à robots : un humain ne voit jamais ce champ.
  if (clean(form.get('societe'), 200)) return veutJson ? json({ ok: true }) : page('Merci', 'Votre message a bien été transmis.');

  const d: Demande = {
    nom: clean(form.get('nom'), LIMITES.nom),
    prenom: clean(form.get('prenom'), LIMITES.prenom),
    telephone: clean(form.get('telephone'), LIMITES.telephone),
    email: clean(form.get('email'), LIMITES.email),
    projet: clean(form.get('projet'), LIMITES.projet),
    message: clean(form.get('message'), LIMITES.message),
  };

  if (!d.nom || !d.telephone || !d.email || !d.message) return echec('Merci de compléter les champs obligatoires.');
  if (!emailValide(d.email)) return echec("L'adresse e-mail semble incorrecte.");
  if (!form.get('consentement')) return echec('Le consentement au traitement des données est nécessaire.');
  // En-têtes injectés dans le sujet / reply-to : refus net.
  if (/[\r\n]/.test(d.email + d.nom + d.prenom)) return echec('Requête invalide.');

  const ip = request.headers.get('cf-connecting-ip') || '';
  const pays = (request as { cf?: { country?: string } }).cf?.country || '';

  let id: number | null = null;
  if (env.CONTACT_DB) {
    try {
      await assurerTable(env.CONTACT_DB);

      if (ip) {
        const { results } = await env.CONTACT_DB.prepare(
          `SELECT COUNT(*) AS n FROM demandes WHERE ip = ?1 AND recu_le > datetime('now','-1 hour')`
        )
          .bind(ip)
          .all<{ n: number }>();
        if ((results?.[0]?.n ?? 0) >= MAX_PAR_HEURE) {
          return echec('Trop de demandes envoyées depuis cette connexion. Réessayez plus tard.', 429);
        }
      }

      const r = await env.CONTACT_DB.prepare(
        `INSERT INTO demandes (recu_le, nom, prenom, telephone, email, projet, message, ip, pays)
         VALUES (datetime('now'), ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
        .bind(d.nom, d.prenom, d.telephone, d.email, d.projet, d.message, ip, pays)
        .run();
      id = (r.meta?.last_row_id as number) ?? null;
    } catch (e) {
      // La base ne doit jamais bloquer l'envoi : on log et on continue.
      console.error('Écriture D1 impossible', e);
    }
  }

  let envoye = false;
  try {
    envoye = await envoyerEmail(env, d, id);
  } catch (e) {
    console.error('Envoi e-mail impossible', e);
  }

  if (envoye && id && env.CONTACT_DB) {
    try {
      await env.CONTACT_DB.prepare('UPDATE demandes SET envoye = 1 WHERE id = ?1').bind(id).run();
    } catch { /* sans conséquence */ }
  }

  // La demande est enregistrée et/ou envoyée : dans les deux cas elle est arrivée.
  if (!envoye && id === null) {
    return echec("Le message n'a pas pu être transmis. Appelez le 05 40 25 05 05.", 502);
  }

  return veutJson
    ? json({ ok: true })
    : page(
        'Merci, votre demande est bien arrivée',
        'Denis Cartier vous recontacte sous 48 h ouvrées. Pour une question urgente : <a href="tel:+33540250505" style="all:unset;color:#8a6f3c;cursor:pointer">05 40 25 05 05</a>.'
      );
};

/** Les requêtes GET n'ont rien à faire ici. */
export const onRequestGet: PagesFunction<Env> = () =>
  new Response(null, { status: 303, headers: { location: '/contact/' } });
