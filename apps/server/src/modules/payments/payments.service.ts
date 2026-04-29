import { getDb } from '../../infrastructure/firebase/firebase.client';
import admin from 'firebase-admin';

// Araka Helpers
let ARAKA_TOKEN: string | null = null;
let ARAKA_TOKEN_EXPIRES = 0;

export async function getArakaUrl() {
  let url = (process.env.ARAKA_API_URL || '').trim();
  if (!url) url = 'https://api.araka-pay.com';
  while (url.endsWith('/')) url = url.slice(0, -1);
  return url;
}

export async function getArakaToken() {
  if (ARAKA_TOKEN && Date.now() < ARAKA_TOKEN_EXPIRES) return ARAKA_TOKEN;

  const url = await getArakaUrl();
  const res = await fetch(`${url}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emailAddress: (process.env.ARAKA_EMAIL || '').trim(),
      password: (process.env.ARAKA_PASSWORD || '').trim()
    })
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("Failed to login to Araka", err);
    throw new Error('Erreur configuration paiement (Araka Login)');
  }
  
  const data = await res.json();
  // Documentation says 200 OK, usually returns a token string or { token: ... }
  // We'll handle common patterns
  let rawToken = data.token || data.accessToken || data.access_token || (typeof data === 'string' ? data : null);
  
  if (!rawToken) {
    throw new Error('Token non reçu après login Araka');
  }

  ARAKA_TOKEN = String(rawToken).trim();

  ARAKA_TOKEN_EXPIRES = Date.now() + (3600 * 1000); // Default to 1 hour if not specified
  return ARAKA_TOKEN;
}

export async function finalizePayment(txId: string, resultData: any) {
  const db = getDb();
  if (!db) return;

  let q = await db.collection('payments').where('transactionId', '==', txId).limit(1).get();

  if (q.empty) {
    try {
      const docRef = await db.collection('payments').doc(txId).get();
      if (docRef.exists) {
        q = { empty: false, docs: [docRef as any] } as any;
      }
    } catch (e) {}
  }

  if (q.empty) {
    console.warn(`[Payment] Finalization failed: Transaction ${txId} not found in DB.`);
    return;
  }

  const paymentDoc = q.docs[0];
  const paymentData = paymentDoc.data();

  if (paymentData.status === 'completed') {
    return { success: true, alreadyProcessed: true };
  }

  // Extraction robuste de tous les champs possibles de réponse Araka
  const getDeepStatus = (obj: any): string => {
    if (!obj || typeof obj !== 'object') return '';
    const keys = [
      'status', 'statusCode', 'transactionStatus', 'Status', 
      'statusText', 'code', 'responseCode', 'responseMessage',
      'paymentStatus', 'orderStatus', 'state', 'result',
      'StatusCode', 'StatusMessage', 'TransactionStatus'
    ];
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) {
        return String(obj[k]);
      }
    }
    // Chercher récursivement dans les sous-objets
    for (const nested of ['data', 'order', 'payment', 'transaction', 'response']) {
      if (obj[nested] && typeof obj[nested] === 'object') {
        const found = getDeepStatus(obj[nested]);
        if (found) return found;
      }
    }
    if (Array.isArray(obj) && obj.length > 0) return getDeepStatus(obj[0]);
    return '';
  };

  const rawStatus = getDeepStatus(resultData);
  const status = rawStatus.toUpperCase().trim();
  
  const isSuccess = 
    // Statuts explicites
    status === 'SUCCESSFUL' || status === 'SUCCESS' || status === 'COMPLETED' ||
    status === 'PAID' || status === 'APPROVED' || status === 'CONFIRMED' ||
    status === 'ACCEPTED' || status === '00' || status === '000' ||
    status === '200' || status === 'OK' || status === 'ACTIVE' ||
    // Détection par inclusion
    status.includes('SUCCESS') || status.includes('COMPLET') || 
    status.includes('APPROV') || status.includes('PAID') ||
    status.includes('CONFIRM') || status.includes('ACCEPT') ||
    // Détection dans description
    (resultData.statusDescription && String(resultData.statusDescription).toUpperCase().includes('SUCCESS')) ||
    (resultData.message && String(resultData.message).toUpperCase().includes('SUCCESS')) ||
    (resultData.statusDescription && String(resultData.statusDescription).toUpperCase().includes('PAID')) ||
    // Si "Manual override by admin"
    (resultData.statusDescription === 'Manual override by admin');

  const isFailed =
    !isSuccess && (
      status === 'FAILED' || status === 'FAIL' || status === 'REJECTED' ||
      status === 'CANCELLED' || status === 'CANCELED' || status === 'DECLINED' ||
      status === 'ERROR' || status === 'EXPIRED' || status === 'INVALID' ||
      status === 'DENIED' || status === 'STOPPED' ||
      status.includes('FAIL') || status.includes('REJECT') || 
      status.includes('CANCEL') || status.includes('DECLIN') ||
      status.includes('EXPIR') || status.includes('INVALID') ||
      status.includes('DENI') || status.includes('STOP') ||
      (resultData.statusDescription && String(resultData.statusDescription).toUpperCase().includes('FAIL')) ||
      (resultData.message && String(resultData.message).toUpperCase().includes('FAIL'))
    );

  // Log pour debug production
  console.log(`[finalizePayment] txId=${txId} rawStatus="${rawStatus}" isSuccess=${isSuccess} isFailed=${isFailed}`);

  if (isSuccess) {
    await paymentDoc.ref.update({ 
      status: 'completed',
      rawArakaResponse: resultData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const userRef = db.collection('users').doc(paymentData.userId);
    const durationDays = paymentData.cycle === 'yearly' ? 365 : 31;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    await userRef.update({
      subscription: paymentData.plan,
      subscriptionCycle: paymentData.cycle || 'monthly',
      subscriptionStatus: 'active',
      subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate),
      aiCredits: paymentData.plan === 'pro' ? 30 : (paymentData.plan === 'discovery' ? 3 : 9999),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('user_activity').add({
      message: `Abonnement ${paymentData.plan} activé avec succès.`,
      type: 'payment',
      severity: 'info',
      userId: paymentData.userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } else if (isFailed) {
    await paymentDoc.ref.update({ 
      status: 'failed',
      failureReason: resultData.message || resultData.statusDescription || "Transaction échouée",
      rawArakaResponse: resultData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: false, failed: true };
  }
  
  return { success: false, pending: true, status };
}

export const paymentsService = {
  finalizePayment,
  arakaDebug: async (txId: string) => {
    const token = await getArakaToken();
    const url = await getArakaUrl();
    const db = getDb();
    
    const results: any = {};
    
    // Test toutes les stratégies de lookup
    try {
      const r1 = await fetch(`${url}/api/Reporting/transactionstatus/${txId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' }
      });
      results.byTransactionId = { status: r1.status, body: await r1.text() };
    } catch (e) { results.byTransactionId = { error: String(e) }; }

    // Chercher en DB
    if (db) {
      const snap = await db.collection('payments').where('transactionId', '==', txId).limit(1).get();
      if (!snap.empty) {
        const pd = snap.docs[0].data();
        results.dbDocument = {
          transactionId: pd.transactionId,
          originatingTransactionId: pd.originatingTransactionId,
          transactionReference: pd.transactionReference,
          status: pd.status,
          plan: pd.plan
        };
        
        if (pd.originatingTransactionId && pd.originatingTransactionId !== txId) {
          try {
            const r2 = await fetch(`${url}/api/Reporting/transactionstatus/${pd.originatingTransactionId}`, {
              headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' }
            });
            results.byOriginatingId = { status: r2.status, body: await r2.text() };
          } catch (e) { results.byOriginatingId = { error: String(e) }; }
        }

        if (pd.transactionReference) {
          try {
            const r3 = await fetch(`${url}/api/Reporting/transactionstatusbyreference/${pd.transactionReference}`, {
              headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' }
            });
            results.byReference = { status: r3.status, body: await r3.text() };
          } catch (e) { results.byReference = { error: String(e) }; }
        }
      } else {
        results.dbDocument = null;
      }
    }
    
    return results;
  },
  syncSettings: async (userId: string, user: any, body: any) => {
    const db = getDb();
    if (!db) throw { code: 503, message: "DB not unavailable" };

    const { amount, currency, phoneNumber, provider, planId, billingCycle, fee, vat, vatRate, feeRate, userName } = body;
    let normalizedPhone = phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber;
    if (provider === 'MPESA' && !normalizedPhone.startsWith('+243') && normalizedPhone.length !== 13) {
      throw { code: 400, message: "Numéro invalide pour DRC. Format attendu: +243XXXXXXXXX" };
    }

    const token = await getArakaToken();
    const url = await getArakaUrl();
    
    let pageId = null;
    const settingsSnap = await db.collection('app_settings').doc('global').get();
    const settings = settingsSnap.data() || {};
      
    if (currency === 'CDF') {
      pageId = settings?.arakaCdfPageId || process.env.ARAKA_PAYMENT_PAGE_ID;
    } else if (currency === 'USD') {
      pageId = settings?.arakaUsdPageId || process.env.ARAKA_PAYMENT_PAGE_ID_USD;
    }

    if (pageId) pageId = String(pageId).trim();

    if (!pageId) throw { code: 500, message: `ARAKA_PAYMENT_PAGE_ID non configuré pour la devise ${currency}` };

    const exchangeRate = settings.exchangeRate || 2800;
    const transactionFee = settings.transactionFee || 2;
    const vRate = settings.vatRate || 16;
    const globalDiscount = settings.globalDiscount || 0;
    const useAutomaticConversion = settings.useAutomaticConversion ?? true;

    const priceMapUSD: Record<string, Record<string, number>> = {
      discovery: { monthly: settings.discoveryMonthlyUSD ?? 0, yearly: settings.discoveryYearlyUSD ?? 0 },
      pro: { monthly: settings.proMonthlyUSD ?? 20, yearly: settings.proYearlyUSD ?? 200 },
      premium: { monthly: settings.premiumMonthlyUSD ?? 50, yearly: settings.premiumYearlyUSD ?? 500 },
    };

    const priceMapCDF: Record<string, Record<string, number>> = {
      discovery: { monthly: settings.discoveryMonthlyCDF ?? 0, yearly: settings.discoveryYearlyCDF ?? 0 },
      pro: { monthly: settings.proMonthlyCDF ?? 56000, yearly: settings.proYearlyCDF ?? 560000 },
      premium: { monthly: settings.premiumMonthlyCDF ?? 140000, yearly: settings.premiumYearlyCDF ?? 1400000 },
    };

    let basePriceInCurrency: number;
    const discountMultiplier = 1 - (globalDiscount / 100);

    if (currency === 'CDF') {
      if (useAutomaticConversion) {
        const baseUSD = priceMapUSD[planId]?.[billingCycle];
        if (baseUSD === undefined) throw { code: 400, message: "Plan ou cycle invalide." };
        basePriceInCurrency = (baseUSD * discountMultiplier) * exchangeRate;
      } else {
        const baseCDF = priceMapCDF[planId]?.[billingCycle];
        if (baseCDF === undefined) throw { code: 400, message: "Plan ou cycle invalide." };
        basePriceInCurrency = baseCDF * discountMultiplier;
      }
    } else {
      const baseUSD = priceMapUSD[planId]?.[billingCycle];
      if (baseUSD === undefined) throw { code: 400, message: "Plan ou cycle invalide." };
      basePriceInCurrency = baseUSD * discountMultiplier;
    }
    
    const roundAmount = (val: number) => currency === 'USD' ? Math.round(val * 100) / 100 : Math.round(val);

    const vatAmount = roundAmount((basePriceInCurrency * vRate) / 100);
    const subtotalWithVat = basePriceInCurrency + vatAmount;
    const feeAmount = roundAmount((subtotalWithVat * transactionFee) / 100);
    const expectedTotal = roundAmount(subtotalWithVat + feeAmount);
    
    const clientAmount = parseFloat(amount);
    if (Math.abs(clientAmount - expectedTotal) / expectedTotal > 0.05) {
      console.warn(`[Payment Warning] Amount Mismatch -> Client Sent: ${clientAmount}, Server Computed: ${expectedTotal}. Billing Server Computed.`);
    }

    const transactionReference = `ZOYA_${userId.slice(0, 5)}_${Date.now()}`;
    
    const appUrl = (process.env.APP_URL || '').trim();
    const payload = {
      order: {
        paymentPageId: pageId,
        customerFullName: userName || user.name || user.email?.split('@')[0] || "Zoya User",
        customerPhoneNumber: normalizedPhone,
        customerEmailAddress: user.email,
        transactionReference: transactionReference,
        amount: expectedTotal,
        currency: currency || "USD",
        redirectURL: appUrl ? `${appUrl}/api/webhook/araka` : undefined
      },
      paymentChannel: {
        channel: "MOBILEMONEY",
        provider: provider,
        walletID: normalizedPhone
      }
    };

    const response = await fetch(`${url}/api/Pay/paymentrequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let finalDetails = errorText;
      if (finalDetails.includes('Load failed')) {
         finalDetails = "Araka a renvoyé une erreur interne ('Load failed'). Veuillez consulter les logs Araka ou réessayer.";
      }
      throw { code: response.status, message: "Le fournisseur de paiement a rejeté la requête.", details: finalDetails };
    }

    const result = await response.json();
    const actualTransactionId = result.transactionId || result.id || result.reference || result.data?.id || result.data?.transactionId || transactionReference;
    
    const originatingTxId = result.originatingTransactionId || 
                          result.originatingId || 
                          result.OrigTransactionId || 
                          actualTransactionId;

    // Log complet pour diagnostiquer la structure de réponse Araka en production
    console.log('[Araka Pay 201 Response]', JSON.stringify({
      transactionId: result.transactionId,
      originatingTransactionId: result.originatingTransactionId,
      paymentLink: result.paymentLink,
      allKeys: Object.keys(result),
      fullResult: result
    }));

    await db.collection('payments').add({
      userId,
      userName: userName || user.name || user.email?.split('@')[0] || "Client ZoyaEdge",
      userEmail: user.email,
      amount: expectedTotal,
      currency: currency || "USD",
      status: 'pending',
      plan: planId,
      cycle: billingCycle,
      fee: feeAmount || 0,
      vat: vatAmount || 0,
      vatRate: vRate || 0,
      feeRate: transactionFee || 0,
      method: 'Mobile Money',
      provider,
      operator: provider,
      transactionReference,
      transactionId: actualTransactionId,
      originatingTransactionId: originatingTxId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('user_activity').add({
      message: `Client ${userName || user.email} a initié un paiement ${currency} pour le plan ${planId}.`,
      type: 'payment',
      severity: 'info',
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const txId = actualTransactionId;

    // BACKGROUND POLLING (Server-to-Server)
    // This allows the server to update the database even if the iPhone loses data connection
    const runBackgroundCheck = async (tId: string, tRef: string, origId: string) => {
      let attempts = 0;
      const maxAttempts = 50; // ~4-5 minutes
      
      const check = async () => {
        if (attempts >= maxAttempts) return;
        attempts++;
        
        try {
          const dbCheck = getDb();
          if (!dbCheck) return;
          
          const pSnap = await dbCheck.collection('payments').where('transactionId', '==', tId).limit(1).get();
          if (pSnap.empty) return;
          
          const pData = pSnap.docs[0].data();
          if (pData.status !== 'pending') return; // Déjà finalisé

          const akToken = await getArakaToken();
          const akUrl = await getArakaUrl();
          let akResult: any = null;

          // Tentative par référence
          if (tRef) {
            try {
              const r = await fetch(`${akUrl}/api/Reporting/transactionstatusbyreference/${tRef}`, { headers: { 'Authorization': `Bearer ${akToken}` } });
              if (r.ok) akResult = await r.json();
            } catch (e) {}
          }
          
          // Tentative par ID
          if (!akResult) {
            try {
              const r = await fetch(`${akUrl}/api/Reporting/transactionstatus/${tId}`, { headers: { 'Authorization': `Bearer ${akToken}` } });
              if (r.ok) akResult = await r.json();
            } catch (e) {}
          }

          if (akResult) {
             await finalizePayment(tId, akResult);
          }
        } catch (err) {
          console.error("[BG Poll Error]", err);
        }
        
        setTimeout(check, 6000); // Toutes les 6 secondes
      };
      
      setTimeout(check, 10000); // Start after 10s
    };

    runBackgroundCheck(actualTransactionId, transactionReference, originatingTxId).catch(e => console.error(e));

    return { ...result, transactionId: actualTransactionId, transactionReference, originatingTransactionId: originatingTxId };
  },

  syncStatus: async (userId: string, txId: string) => {
    const db = getDb();
    if (!db) throw { code: 503, message: "Database unavailable" };

    let effectiveTxId = txId;
    if (txId === 'latest') {
      const q = await db.collection('payments')
        .where('userId', '==', userId)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      
      if (q.empty) {
        return { status: "NONE", details: "No pending transaction found" };
      }
      effectiveTxId = q.docs[0].data().transactionId;
    }

    const paymentSnap = await db.collection('payments').where('transactionId', '==', effectiveTxId).limit(1).get();
    if (paymentSnap.empty) throw { code: 404, message: "Transaction non trouvée." };

    const paymentData = paymentSnap.docs[0].data();
    if (paymentData.userId !== userId) throw { code: 403, message: "Accès non autorisé à cette transaction." };

    if (paymentData.status === 'completed') return { status: "SUCCESSFUL", _statusText: "SUCCESS" };
    if (paymentData.status === 'failed') return { status: "FAILED", _statusText: "FAILED", message: paymentData.failureReason };

    // Log du document payment trouvé pour debug
    console.log('[Sync-Status] Payment document found:', {
      transactionId: paymentData.transactionId,
      originatingTransactionId: paymentData.originatingTransactionId,
      transactionReference: paymentData.transactionReference,
      status: paymentData.status
    });

    const token = await getArakaToken();
    const url = await getArakaUrl();
    
    let arakaResponse: Response | null = null;
    let lastError = '';

    // Stratégie 1 : par transactionReference (notre référence interne)
    if (paymentData.transactionReference) {
      try {
        arakaResponse = await fetch(
          `${url}/api/Reporting/transactionstatusbyreference/${paymentData.transactionReference}`,
          { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' } }
        );
        if (!arakaResponse.ok) { lastError = `ref=${arakaResponse.status}`; arakaResponse = null; }
      } catch (e) { lastError = String(e); arakaResponse = null; }
    }

    // Stratégie 2 : par originatingTransactionId (ID retourné par Araka dans le callback)
    if (!arakaResponse && paymentData.originatingTransactionId && 
        paymentData.originatingTransactionId !== paymentData.transactionId) {
      try {
        arakaResponse = await fetch(
          `${url}/api/Reporting/transactionstatus/${paymentData.originatingTransactionId}`,
          { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' } }
        );
        if (!arakaResponse.ok) { lastError += ` origId=${arakaResponse.status}`; arakaResponse = null; }
      } catch (e) { lastError += String(e); arakaResponse = null; }
    }

    // Stratégie 3 : par transactionId direct (fallback)
    if (!arakaResponse) {
      try {
        arakaResponse = await fetch(
          `${url}/api/Reporting/transactionstatus/${txId}`,
          { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' } }
        );
      } catch (e) {
        console.error("Araka Strategy 3 failed", e);
      }
    }

    if (!arakaResponse || !arakaResponse.ok) {
      if (arakaResponse && arakaResponse.status === 404) {
        return { status: "PENDING", _statusText: "PENDING", details: "Transaction not found yet" };
      }
      if (arakaResponse && arakaResponse.status === 400) {
        return { status: "FAILED", _statusText: "FAILED", details: "Transaction invalid (400)" };
      }
      
      const errorText = arakaResponse ? await arakaResponse.text() : "No response from Araka";
      return { 
        status: "PENDING", 
        _statusText: "PENDING", 
        details: "Vérification en attente (Araka temporairement indisponible)",
        transactionId: effectiveTxId
      } as any;
    }

    const result = await arakaResponse.json();
    
    // LOG CRITIQUE : voir exactement ce que retourne Araka production
    console.log(`[Araka Status Response] txId=${txId}:`, JSON.stringify(result));

    const finalizationResult = await finalizePayment(effectiveTxId, result);
    
    // Construct a meaningful status text for the client
    const getDeepProp = (obj: any, keys: string[]): string => {
      for (const k of keys) {
        if (obj[k] && typeof obj[k] !== 'object') return String(obj[k]);
      }
      return '';
    };

    const statusMsg = getDeepProp(result, ['statusDescription', 'statusText', 'message', 'description']);
    const rawStatus = finalizationResult?.status || result.status || result.statusCode || result.transactionStatus || result.Status || (result.data && result.data.status);
    const statusStr = (String(rawStatus || '')).toUpperCase();
    
    let finalStatusText = statusStr;
    if (finalizationResult?.success) finalStatusText = 'SUCCESS';
    else if (finalizationResult?.failed) finalStatusText = 'FAILED';
    
    return { 
      ...result, 
      transactionId: effectiveTxId,
      _statusText: finalStatusText,
      _statusMessage: statusMsg
    };
  }
};
