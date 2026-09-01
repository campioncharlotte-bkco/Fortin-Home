// ============================================================
// FORTIN HOME | /api/parse.js
// Fonction serverless Vercel. Clé dans les variables Vercel
// (ANTHROPIC_API_KEY), jamais dans le code.
// ============================================================

const MODELE = 'claude-haiku-4-5-20251001';   // rapide et peu coûteux ; 'claude-sonnet-5' si besoin de finesse

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Clé API absente' });

  const { message, contexte } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Message vide' });

  const system = `Tu es l'assistant de saisie de Fortin Home, l'organisation d'un couple.
On te dicte ce qu'il y a à faire à la maison, souvent en style télégraphique. Tu en fais des tâches.

CONTEXTE (source de vérité) :
Date du jour : ${contexte.date}
Les deux personnes : ${JSON.stringify(contexte.utilisateurs)}
Qui te parle : ${JSON.stringify(contexte.moi)}
Catégories : ${JSON.stringify(contexte.categories)}

NOTRE MONDE — ce qu'ils t'ont raconté de leur vie. Sers-t'en pour comprendre de qui et de quoi on parle :
${contexte.foyer || '(rien de renseigné pour le moment)'}

RÈGLES
1. Un message peut contenir plusieurs tâches : sépare-les. Une idée = une tâche.
2. titre : court et actionnable, 80 caractères max, commençant par un verbe ("Appeler le plombier"). Garde ses mots.
3. categorie : l'id exact de la liste. Appuie-toi sur NOTRE MONDE : un prénom qui n'est pas l'un des deux utilisateurs est un proche (enfant, filleul, frère, neveu) et relève de "famille" ; l'animal du foyer relève de "exterieur" ; le lieu de la maison relève de "maison". Ne mets "maison" par défaut que si rien d'autre ne colle.
4. priorite : 1 si urgent ou bloquant, 3 si c'est un "un jour", 2 sinon.
5. echeance : AAAA-MM-JJ calculée depuis la date du jour ("demain", "samedi", "avant la fin du mois"). null si rien n'est dit.
6. assigne_id : si un prénom de la liste est cité comme devant s'en occuper, mets son id. Si la personne parle d'elle-même ("je dois", "je m'en occupe"), mets son propre id. Sinon null.
7. prive : true seulement si elle dit que c'est personnel ("perso", "pour moi seule"). Par défaut false : dans un couple, l'organisation est partagée.
8. description : uniquement le contexte réellement dicté, sinon null.
9. actions : découpe en étapes seulement si plusieurs sont énoncées.

Réponds UNIQUEMENT par un JSON valide, sans balise de code :
{"sujets":[{"titre":"","categorie":"maison","priorite":2,"statut":"À faire","echeance":null,"assigne_id":null,"prive":false,"description":null,"actions":[]}]}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: MODELE, max_tokens: 1200, system, messages: [{ role: 'user', content: message }] })
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: 'API Anthropic : ' + r.status, detail: t.slice(0, 300) });
    }
    const data = await r.json();
    const texte = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const json = JSON.parse(texte.replace(/```json|```/g, '').trim());
    if (!json.sujets || !Array.isArray(json.sujets)) throw new Error('Format inattendu');
    return res.status(200).json({ sujets: json.sujets });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
