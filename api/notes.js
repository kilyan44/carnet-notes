import { Redis } from '@upstash/redis';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Compatible Vercel KV et Upstash Redis direct
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Vos notes initiales (chargées depuis notes_rows.json)
const DEFAULT_DATA = { semesters: [] };

const SESSION_COOKIE = 'notes_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function safeEqual(left, right) {
  const a = createHash('sha256').update(String(left ?? '')).digest();
  const b = createHash('sha256').update(String(right ?? '')).digest();
  return timingSafeEqual(a, b);
}

function signSession(expiresAt) {
  return createHmac('sha256', process.env.SESSION_SECRET)
    .update(String(expiresAt))
    .digest('base64url');
}

function hasValidSession(req) {
  const cookieHeader = req.headers.cookie || '';
  const item = cookieHeader.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(SESSION_COOKIE + '='));
  if (!item) return false;

  const value = item.slice(SESSION_COOKIE.length + 1);
  const [expiresAt, signature] = value.split('.');
  if (!expiresAt || !signature || !/^\\d+$/.test(expiresAt)) return false;
  if (Number(expiresAt) < Date.now()) return false;

  return safeEqual(signature, signSession(expiresAt));
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST' && req.body?.action === 'login') {
      if (!process.env.APP_PASSWORD || !process.env.SESSION_SECRET) {
        return res.status(500).json({ error: 'Authentification non configurée' });
      }
      if (!safeEqual(req.body.password, process.env.APP_PASSWORD)) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }

      const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
      const signature = signSession(expiresAt);
      res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${expiresAt}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE}`);
      return res.status(200).json({ success: true });
    }

    if (!hasValidSession(req)) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    if (req.method === 'GET') {
      let data = await redis.get('notes_data');
      if (!data) {
        await redis.set('notes_data', DEFAULT_DATA);
        data = DEFAULT_DATA;
      }
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const payload = req.body;
      if (!payload || !Array.isArray(payload.semesters)) {
        return res.status(400).json({ error: 'Données invalides' });
      }
      await redis.set('notes_data', payload);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (error) {
    console.error('Erreur Redis/Upstash:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}
