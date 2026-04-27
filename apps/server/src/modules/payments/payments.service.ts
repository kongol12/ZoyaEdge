import { getDb } from '../../infrastructure/firebase/firebase.client';
import admin from 'firebase-admin';

// Araka Helpers
let ARAKA_TOKEN: string | null = null;
let ARAKA_TOKEN_EXPIRES = 0;

export async function getArakaUrl() {
  let url = process.env.ARAKA_BASE_URL;
  if (!url) {
    const db = getDb();
    if (db) {
      try {
        const globalDoc = await db.collection('app_settings').doc('global').get();
        if (globalDoc.exists && globalDoc.data()?.sandboxEnabled !== undefined) {
          url = globalDoc.data()!.sandboxEnabled 
            ? 'https://sandbox.araka.co.cd' 
            : 'https://api.araka.co.cd';
        }
      } catch (e) {
        console.error("Failed to read Araka env from DB", e);
      }
    }
  }
  return url || 'https://sandbox.araka.co.cd'; 
}

export async function getArakaToken() {
  if (ARAKA_TOKEN && Date.now() < ARAKA_TOKEN_EXPIRES) return ARAKA_TOKEN;

  const url = await getArakaUrl();
  const res = await fetch(`${url}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.ARAKA_CLIENT_ID || '',
      client_secret: process.env.ARAKA_CLIENT_SECRET || '',
      scope: 'paymentapi'
    })
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("Failed to get Araka token", err);
    throw new Error('Erreur configuration paiement (Araka Token)');
  }
  
  const data = await res.json();
  ARAKA_TOKEN = data.access_token;
  ARAKA_TOKEN_EXPIRES = Date.now() + (data.expires_in * 1000) - 60000;
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

  const getDeepStatus = (obj: any): string => {
    if (!obj || typeof obj !== 'object') return '';
    const keys = ['status', 'statusCode', 'transactionStatus', 'Status', 'statusText', 'code', 'responseCode', 'responseMessage', 'paymentStatus', 'orderStatus', 'state', 'result', 'StatusCode', 'StatusMessage', 'TransactionStatus'];
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) return String(obj[k]);
    }
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
    status === 'SUCCESSFUL' || status === 'SUCCESS' || status === 'COMPLETED' ||
    status === 'PAID' || status === 'APPROVED' || status === 'CONFIRMED' ||
    status === 'ACCEPTED' || status === '00' || status === '000' ||
    status === '200' || status === 'OK' || status === 'ACTIVE' ||
    status.includes('SUCCESS') || status.includes('COMPLET') || 
    status.includes('APPROV') || status.includes('PAID') ||
    status.includes('CONFIRM') || status.includes('ACCEPT') ||
    (resultData.statusDescription && String(resultData.statusDescription).toUpperCase().includes('SUCCESS')) ||
    (resultData.message && String(resultData.message).toUpperCase().includes('SUCCESS')) ||
    (resultData.statusDescription && String(resultData.statusDescription).toUpperCase().includes('PAID')) ||
    (resultData.statusDescription === 'Manual override by admin');

  const isFailed = !isSuccess && (
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
    
    let pageId = process.env.ARAKA_PAYMENT_PAGE_ID; 
    const settingsSnap = await db.collection('app_settings').doc('global').get();
    const settings = settingsSnap.data() || {};
      
    if (currency === 'CDF' && settings?.arakaCdfPageId) {
      pageId = settings.arakaCdfPageId;
    } else if (currency === 'USD' && settings?.arakaUsdPageId) {
      pageId = settings.arakaUsdPageId;
    }

    if (!pageId) throw { code: 500, message: "ARAKA_PAYMENT_PAGE_ID non configuré pour cette devise" };

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
    
    const payload = {
      reference: transactionReference,
      transactionReference: transactionReference,
      order: {
        paymentPageId: pageId,
        customerFullName: userName || user.name || user.email?.split('@')[0] || "Zoya User",
        customerPhoneNumber: normalizedPhone,
        customerEmailAddress: user.email,
        transactionReference: transactionReference,
        reference: transactionReference,
        amount: expectedTotal,
        currency: currency || "USD",
        redirectURL: `${process.env.APP_URL}/api/webhook/araka`
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
    const originatingTxId = result.originatingTransactionId || result.originatingId || result.OrigTransactionId || actualTransactionId;

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

    return { ...result, transactionId: actualTransactionId, transactionReference, originatingTransactionId: originatingTxId };
  },

  syncStatus: async (userId: string, txId: string) => {
    const db = getDb();
    if (!db) throw { code: 503, message: "Database unavailable" };

    const paymentSnap = await db.collection('payments').where('transactionId', '==', txId).limit(1).get();
    if (paymentSnap.empty) throw { code: 404, message: "Transaction non trouvée." };

    const paymentData = paymentSnap.docs[0].data();
    if (paymentData.userId !== userId) throw { code: 403, message: "Accès non autorisé à cette transaction." };

    if (paymentData.status === 'completed') return { status: "SUCCESSFUL", _statusText: "SUCCESS" };

    const token = await getArakaToken();
    const url = await getArakaUrl();
    let arakaResponse: any = null;

    if (paymentData.transactionReference) {
      try {
        arakaResponse = await fetch(`${url}/api/Reporting/transactionstatusbyreference/${paymentData.transactionReference}`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
        if (!arakaResponse.ok) arakaResponse = null;
      } catch (e) { arakaResponse = null; }
    }

    if (!arakaResponse && paymentData.originatingTransactionId && paymentData.originatingTransactionId !== paymentData.transactionId) {
      try {
        arakaResponse = await fetch(`${url}/api/Reporting/transactionstatus/${paymentData.originatingTransactionId}`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
        if (!arakaResponse.ok) arakaResponse = null;
      } catch (e) { arakaResponse = null; }
    }

    if (!arakaResponse) {
      arakaResponse = await fetch(`${url}/api/Reporting/transactionstatus/${txId}`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
    }

    if (!arakaResponse.ok) {
      if (arakaResponse.status === 404) return { status: "PENDING", _statusText: "PENDING", details: "Transaction not found yet" };
      if (arakaResponse.status === 400) return { status: "FAILED", _statusText: "FAILED", details: "Transaction invalid" };
      throw { code: arakaResponse.status, message: "Vérification échouée" };
    }

    const result = await arakaResponse.json();
    const finalizationResult = await finalizePayment(txId, result);
    
    const rawStatus = finalizationResult?.status || result.status || result.statusCode || result.transactionStatus || result.Status || (result.data && result.data.status);
    const statusStr = (String(rawStatus || '')).toUpperCase();
    const finalStatusText = finalizationResult?.success ? 'SUCCESS' : (finalizationResult?.failed ? 'FAILED' : statusStr);
    
    return { ...result, _statusText: finalStatusText };
  }
};
