//+------------------------------------------------------------------+
//|                                                 ZoyaEdgeSync.mq5 |
//|                                            Copyright 2026, ZoyaEdge|
//|                                             https://zoyaedge.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, ZoyaEdge"
#property link      "https://zoyaedge.com"
#property version   "1.00"
#property description "Expert Advisor pour synchroniser les trades avec ZoyaEdge"
#property strict

//--- Input parameters
input string   InpSyncKey     = ""; // Clé de synchronisation ZoyaEdge
input string   InpWebhookSecret = ""; // Secret HMAC ZoyaEdge (généré depuis l'app)
input string   InpWebhookURL  = "https://ais-dev-rfxiof64ksocck56i2gztu-109322411969.europe-west3.run.app/api/webhook/mt5"; // URL du Webhook
input int      InpSyncTimer   = 3600; // Intervalle de synchronisation (en secondes, défaut: 1h)
input bool     InpSendPush    = true; // Envoyer des notifications Push sur mobile (MetaQuotes ID)

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   // Vérification de la clé
   if(InpSyncKey == "")
     {
      Print("ZoyaEdge Erreur: La clé de synchronisation est requise !");
      Alert("ZoyaEdge: Veuillez entrer votre clé de synchronisation dans les paramètres de l'EA.");
      return(INIT_PARAMETERS_INCORRECT);
     }
     
   // Configuration du timer
   EventSetTimer(InpSyncTimer);
   Print("ZoyaEdge EA Initialisé. Synchronisation toutes les ", InpSyncTimer, " secondes.");
   
   // Notification de démarrage
   if(InpSendPush) 
      SendNotification("ZoyaEdge: EA démarré sur " + _Symbol + ". Synchronisation active.");
   
   // Lancement de la première synchronisation
   SyncData();
   
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   if(InpSendPush)
      SendNotification("ZoyaEdge: EA arrêté sur " + _Symbol + ". La synchronisation est coupée.");
   Print("ZoyaEdge EA Arrêté.");
  }

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
  {
   // Appelée automatiquement toutes les X secondes (InpSyncTimer)
   SyncData();
  }

//--- Global variables
long           lastSyncedTickets[]; // Local cache of synced tickets

//+------------------------------------------------------------------+
//| Custom function to sync data                                     |
//+------------------------------------------------------------------+
void SyncData()
  {
   if(!TerminalInfoInteger(TERMINAL_CONNECTED)) return;

   // Select history for the last 24 hours
   datetime end = TimeCurrent();
   datetime start = end - (24 * 3600);
   
   if(!HistorySelect(start, end))
     {
      Print("ZoyaEdge: Failed to select history.");
      return;
     }

   int totalDeals = HistoryDealsTotal();
   for(int i = 0; i < totalDeals; i++)
     {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket <= 0) continue;
      
      // Only process closed trades (DEAL_ENTRY_OUT or DEAL_ENTRY_INOUT)
      long entryType = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(entryType != DEAL_ENTRY_OUT && entryType != DEAL_ENTRY_INOUT) continue;

      // Check for duplicates in local cache
      bool alreadySynced = false;
      for(int j = 0; j < ArraySize(lastSyncedTickets); j++)
        {
         if(lastSyncedTickets[j] == (long)ticket)
           {
            alreadySynced = true;
            break;
           }
        }
      if(alreadySynced) continue;

      // Extract data
      string symbol    = HistoryDealGetString(ticket, DEAL_SYMBOL);
      long type      = HistoryDealGetInteger(ticket, DEAL_TYPE);
      double volume    = HistoryDealGetDouble(ticket, DEAL_VOLUME);
      double price     = HistoryDealGetDouble(ticket, DEAL_PRICE);
      double profit    = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      long time      = HistoryDealGetInteger(ticket, DEAL_TIME);
      
      long positionId = HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
      double entryPrice = 0;
      
      // Find the corresponding ENTRY_IN deal to get the entry price
      if(HistorySelectByPosition(positionId))
        {
         int posDeals = HistoryDealsTotal();
         for(int k = 0; k < posDeals; k++)
           {
            ulong t = HistoryDealGetTicket(k);
            if(HistoryDealGetInteger(t, DEAL_ENTRY) == DEAL_ENTRY_IN)
              {
               entryPrice = HistoryDealGetDouble(t, DEAL_PRICE);
               break;
              }
           }
        }
      
      if(entryPrice == 0) entryPrice = price; // Fallback

      // Construct JSON
      string direction = (type == DEAL_TYPE_BUY) ? "buy" : "sell";
      string json = "{";
      json += "\"syncKey\":\"" + InpSyncKey + "\",";
      json += "\"ticket\":" + IntegerToString(ticket) + ",";
      json += "\"pair\":\"" + symbol + "\",";
      json += "\"direction\":\"" + direction + "\",";
      json += "\"lotSize\":" + DoubleToString(volume, 2) + ",";
      json += "\"entryPrice\":" + DoubleToString(entryPrice, _Digits) + ",";
      json += "\"exitPrice\":" + DoubleToString(price, _Digits) + ",";
      json += "\"pnl\":" + DoubleToString(profit, 2) + ",";
      json += "\"timestamp\":" + IntegerToString(time);
      json += "}";

      // Send to server
      char post[], result[];
      string headers = "Content-Type: application/json\r\n";
      if(InpWebhookSecret != "")
         headers += "x-zoyaedge-signature: " + HmacSHA256(InpWebhookSecret, json) + "\r\n";

      StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
      string result_headers;
      int res = WebRequest("POST", InpWebhookURL, headers, 5000, post, result, result_headers);
      
      if(res == 200)
        {
         Print("ZoyaEdge: Synced ticket ", ticket);
         // Add to local cache
         int size = ArraySize(lastSyncedTickets);
         ArrayResize(lastSyncedTickets, size + 1);
         lastSyncedTickets[size] = (long)ticket;
        }
      else
        {
         Print("ZoyaEdge Error: Ticket ", ticket, " failed with code ", res);
        }
     }
  }

string HmacSHA256(const string key, const string message)
{
   uchar keyBytes[], msgBytes[];
   StringToCharArray(key, keyBytes, 0, WHOLE_ARRAY, CP_UTF8);
   StringToCharArray(message, msgBytes, 0, WHOLE_ARRAY, CP_UTF8);
   int kLen = ArraySize(keyBytes) - 1;
   int mLen = ArraySize(msgBytes) - 1;
   ArrayResize(keyBytes, kLen);
   ArrayResize(msgBytes, mLen);

   uchar paddedKey[64];
   ArrayInitialize(paddedKey, 0);
   for(int i = 0; i < kLen && i < 64; i++) paddedKey[i] = keyBytes[i];

   uchar ipad[64], opad[64];
   for(int i = 0; i < 64; i++) {
      ipad[i] = paddedKey[i] ^ 0x36;
      opad[i] = paddedKey[i] ^ 0x5C;
   }

   uchar inner[];
   ArrayResize(inner, 64 + mLen);
   ArrayCopy(inner, ipad, 0, 0, 64);
   ArrayCopy(inner, msgBytes, 64, 0, mLen);
   uchar innerHash[];
   CryptEncode(CRYPT_HASH_SHA256, inner, inner, innerHash);

   int hLen = ArraySize(innerHash);
   uchar outer[];
   ArrayResize(outer, 64 + hLen);
   ArrayCopy(outer, opad, 0, 0, 64);
   ArrayCopy(outer, innerHash, 64, 0, hLen);
   uchar outerHash[];
   CryptEncode(CRYPT_HASH_SHA256, outer, outer, outerHash);

   string result = "";
   for(int i = 0; i < ArraySize(outerHash); i++)
      result += StringFormat("%02x", outerHash[i]);
   return result;
}
//+------------------------------------------------------------------+
