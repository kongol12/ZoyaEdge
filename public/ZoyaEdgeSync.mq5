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

//+------------------------------------------------------------------+
//| Custom function to sync data                                     |
//+------------------------------------------------------------------+
void SyncData()
  {
   // Vérification de la connexion Internet
   if(!TerminalInfoInteger(TERMINAL_CONNECTED))
     {
      Print("ZoyaEdge: Terminal non connecté à Internet. En attente de reconnexion...");
      return;
     }

   Print("ZoyaEdge: Début de la synchronisation des données...");
   
   // Construction du payload JSON
   string json = "{";
   json += "\"syncKey\":\"" + InpSyncKey + "\",";
   json += "\"timestamp\":" + IntegerToString(TimeCurrent()) + ",";
   json += "\"pair\":\"" + _Symbol + "\",";
   json += "\"direction\":\"buy\",";
   json += "\"lotSize\":0.10,";
   json += "\"exitPrice\":" + DoubleToString(SymbolInfoDouble(_Symbol, SYMBOL_BID), _Digits) + ",";
   json += "\"pnl\":25.50";
   json += "}";

   // Préparation de la requête HTTP
   char post[], result[];
   string headers = "Content-Type: application/json\r\n";
   StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
   
   string result_headers;
   int res = WebRequest("POST", InpWebhookURL, headers, 5000, post, result, result_headers);
   
   if(res == 200)
     {
      Print("ZoyaEdge: Synchronisation réussie !");
     }
   else if(res == 403)
     {
      string msg = "ZoyaEdge: Abonnement expiré ou invalide. Synchronisation bloquée.";
      Print(msg);
      if(InpSendPush) SendNotification(msg);
      Alert(msg);
     }
   else if(res == -1)
     {
      Print("ZoyaEdge Erreur: Impossible de contacter le serveur. Vérifiez que l'URL est autorisée dans Outils > Options > Expert Advisors.");
     }
   else
     {
      Print("ZoyaEdge Erreur: Code HTTP ", res);
     }
  }
//+------------------------------------------------------------------+
