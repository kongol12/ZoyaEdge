import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';

// Mock Firebase infrastructure
vi.mock('../../apps/server/src/infrastructure/firebase/firebase.client', () => ({
  getDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({
            empty: false,
            docs: [{
              data: () => ({
                userId: 'user123',
                webhookSecret: 'test-secret'
              }),
              ref: { update: vi.fn() }
            }]
          }))
        }))
      })),
      doc: vi.fn(() => ({
        get: vi.fn(() => Promise.resolve({
          exists: true,
          data: () => ({
            subscription: 'pro',
            subscriptionStatus: 'active'
          })
        })),
        collection: vi.fn(() => ({
          add: vi.fn(),
          where: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve({ empty: true }))
            }))
          }))
        }))
      }))
    }))
  }))
}));

// Mock Firebase Admin
vi.mock('firebase-admin', () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => 'now'
      },
      Timestamp: {
        fromMillis: (ms: number) => ms
      }
    }
  }
}));

import app from '../../apps/server/src/core/app';

describe('Webhook MT5 Integration', () => {
  const secret = 'test-secret';
  const payload = {
    syncKey: 'key123',
    ticket: '12345',
    pair: 'EURUSD',
    direction: 'buy',
    lotSize: 0.1,
    pnl: 10,
    reqTime: Math.floor(Date.now() / 1000)
  };
  const rawBody = JSON.stringify(payload);

  it('should return 401 if signature is missing', async () => {
    const response = await request(app)
      .post('/api/webhook/mt5')
      .send(payload);
    
    expect(response.status).toBe(401);
  });

  it('should return 401 if signature is invalid', async () => {
    const response = await request(app)
      .post('/api/webhook/mt5')
      .set('x-zoyaedge-signature', 'wrong-signature')
      .send(payload);
    
    expect(response.status).toBe(401);
  });

  it('should return 401 if timestamp is expired', async () => {
    const expiredPayload = { ...payload, reqTime: Math.floor(Date.now() / 1000) - 600 };
    const expiredRawBody = JSON.stringify(expiredPayload);
    const signature = crypto.createHmac('sha256', secret).update(expiredRawBody).digest('hex');

    const response = await request(app)
      .post('/api/webhook/mt5')
      .set('x-zoyaedge-signature', signature)
      .send(expiredPayload);
    
    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Anti-replay');
  });

  it('should return 200 with valid payload and signature', async () => {
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const response = await request(app)
      .post('/api/webhook/mt5')
      .set('x-zoyaedge-signature', signature)
      .send(payload);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
