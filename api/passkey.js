import { Redis } from '@upstash/redis';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
const COOKIE = 'notes_session';
const MAX_AGE = 30 * 24 * 60 * 60;
const RP_ID = 'carnet-notes.vercel.app';
const RP_NAME = 'Carnet de Notes';
const ORIGIN = 'https://carnet-notes.vercel.app';

function safeEqual(left, right) {
  return timingSafeEqual(
    createHash('sha256').update(String(left ?? '')).digest(),
    createHash('sha256').update(String(right ?? '')).digest()
  );
}
function signSession(expiresAt) {
  return createHmac('sha256', process.env.SESSION_SECRET).update(String(expiresAt)).digest('base64url');
}
function hasSession(req) {
  const item = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='));
  if (!item) return false;
  const [expiresAt, signature] = item.slice(COOKIE.length + 1).split('.');
  return !!expiresAt && !!signature && /^\d+$/.test(expiresAt) &&
    Number(expiresAt) >= Date.now() && safeEqual(signature, signSession(expiresAt));
}
function setSession(res) {
  const expiresAt = Date.now() + MAX_AGE * 1000;
  const signature = signSession(expiresAt);
  res.setHeader('Set-Cookie', `${COOKIE}=${expiresAt}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/`);
}
function getHost(req) {
  return (req.headers.host || '').split(':')[0].toLowerCase();
}
function assertProductionHost(req) {
  if (getHost(req) !== RP_ID) throw new Error('Passkeys disponibles uniquement sur le site de production.');
}
async function credentials() {
  return (await redis.get('notes_passkeys')) || [];
}
export default async function handler(req, res) {
  try {
    assertProductionHost(req);
    if (req.method === 'GET') {
      const list = await credentials();
      return res.status(200).json({ available: list.length > 0 });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
    const { action } = req.body || {};

    if (action === 'register-options') {
      if (!hasSession(req)) return res.status(401).json({ error: 'Reconnecte-toi avec ton mot de passe.' });
      const list = await credentials();
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: 'proprietaire-carnet-notes',
        userDisplayName: 'Propriétaire du Carnet de Notes',
        userID: new TextEncoder().encode('carnet-notes-owner'),
        attestationType: 'none',
        excludeCredentials: list.map(c => ({ id: c.id, transports: c.transports })),
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      });
      await redis.set('notes_passkey_challenge', options.challenge, { ex: 300 });
      return res.status(200).json(options);
    }

    if (action === 'register-verify') {
      if (!hasSession(req)) return res.status(401).json({ error: 'Session expirée.' });
      const expectedChallenge = await redis.get('notes_passkey_challenge');
      if (!expectedChallenge) return res.status(400).json({ error: 'Demande expirée, réessaie.' });
      const verification = await verifyRegistrationResponse({
        response: req.body.response,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: true,
      });
      await redis.del('notes_passkey_challenge');
      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: 'Empreinte non vérifiée.' });
      }
      const info = verification.registrationInfo;
      const credential = info.credential || {
        id: info.credentialID ? Buffer.from(info.credentialID).toString('base64url') : req.body.response.id,
        publicKey: info.credentialPublicKey,
        counter: info.counter,
      };
      const list = await credentials();
      const id = credential.id || req.body.response.id;
      const publicKey = credential.publicKey || info.credentialPublicKey;
      const counter = credential.counter ?? info.counter ?? 0;
      const transports = req.body.response.response?.transports || [];
      const updated = list.filter(c => c.id !== id);
      updated.push({ id, publicKey: Buffer.from(publicKey).toString('base64url'), counter, transports });
      await redis.set('notes_passkeys', updated);
      return res.status(200).json({ success: true });
    }

    if (action === 'auth-options') {
      const list = await credentials();
      if (!list.length) return res.status(404).json({ error: 'Aucune empreinte enregistrée. Connecte-toi avec ton mot de passe.' });
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: list.map(c => ({ id: c.id, transports: c.transports })),
        userVerification: 'required',
      });
      await redis.set('notes_passkey_challenge', options.challenge, { ex: 300 });
      return res.status(200).json(options);
    }

    if (action === 'auth-verify') {
      const expectedChallenge = await redis.get('notes_passkey_challenge');
      if (!expectedChallenge) return res.status(400).json({ error: 'Demande expirée, réessaie.' });
      const list = await credentials();
      const saved = list.find(c => c.id === req.body.response?.id);
      if (!saved) return res.status(401).json({ error: 'Cette clé de sécurité n’est pas reconnue.' });
      const verification = await verifyAuthenticationResponse({
        response: req.body.response,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id: saved.id,
          publicKey: Buffer.from(saved.publicKey, 'base64url'),
          counter: saved.counter,
          transports: saved.transports,
        },
        requireUserVerification: true,
      });
      await redis.del('notes_passkey_challenge');
      if (!verification.verified) return res.status(401).json({ error: 'Vérification biométrique échouée.' });
      saved.counter = verification.authenticationInfo.newCounter;
      await redis.set('notes_passkeys', list.map(c => c.id === saved.id ? saved : c));
      setSession(res);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Action inconnue' });
  } catch (error) {
    console.error('Erreur passkey:', error);
    return res.status(500).json({ error: error.message || 'Erreur interne du serveur' });
  }
}
