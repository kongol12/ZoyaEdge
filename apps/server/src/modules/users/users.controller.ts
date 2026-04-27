import { Response, Request } from 'express';
import { AuthenticatedRequest } from '../../core/middleware/auth.middleware';
import { usersService } from './users.service';

export const userSync = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await usersService.userSync(req.user.uid);
    return res.json(result);
  } catch (error: any) {
    return res.status(error.code || 500).json({ error: process.env.NODE_ENV === 'production' ? "Internal server error" : error.message });
  }
};

export const connectionSync = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await usersService.connectionSync(req.user.uid, req.params.connectionId);
    return res.json(result);
  } catch (error: any) {
    return res.status(error.code || 500).json({ error: process.env.NODE_ENV === 'production' ? "Internal server error" : error.message });
  }
};

export const generateSecret = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await usersService.generateSecret(req.user.uid, req.params.connectionId);
    return res.json(result);
  } catch (error: any) {
    return res.status(error.code || 500).json({ error: process.env.NODE_ENV === 'production' ? "Internal server error" : error.message });
  }
};

export const downloadEa = (req: Request, res: Response) => {
  const { platform, syncKey } = req.query;
  const isMT4 = platform === 'MT4';
  const ext = isMT4 ? 'mq4' : 'mq5';
  const host = req.get('host');
  const protocol = req.protocol === 'http' && host?.includes('europe-west3.run.app') ? 'https' : req.protocol;
  const webhookUrl = `${protocol}://${host}/api/webhook/mt5`;
  
  let content = '';
    if (isMT4) {
    content = `//+------------------------------------------------------------------+
//|                                                 ZoyaEdgeSync.mq4 |
//|                                            Copyright 2026, ZoyaEdge|
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, ZoyaEdge"
#property link      "https://zoyaedge.com"
#property version   "1.02"
#property description "Expert Advisor pour synchroniser les trades avec ZoyaEdge (MT4)"
#property strict

input string InpSyncKey = "${syncKey || ""}"; // Clé de synchronisation
input string InpWebhookURL = "${webhookUrl}"; // URL du Webhook
input int    InpSyncTimer = 60; // Intervalle (sec)

enum ENUM_HISTORY_DEPTH {
   DEPTH_1_DAY = 1,
   DEPTH_1_WEEK = 7,
   DEPTH_1_MONTH = 30,
   DEPTH_ALL = 0
};

input ENUM_HISTORY_DEPTH InpHistoryDepth = DEPTH_ALL; // Profondeur historique

// Global variables for tracking
double LastBalance = 0;
bool   InitialSyncDone = false;
string SyncFile = "ZoyaEdgeSync_" + InpSyncKey + ".dat";

int OnInit() {
   if(InpSyncKey == "") { Alert("Clé manquante !"); return(INIT_PARAMETERS_INCORRECT); }
   
   if(FileIsExist(SyncFile)) InitialSyncDone = true;
   
   LastBalance = AccountBalance();
   
   EventSetTimer(InpSyncTimer);
   
   if(!InitialSyncDone) {
      if(ScanAndSendHistory()) {
         InitialSyncDone = true;
         int file_handle = FileOpen(SyncFile, FILE_WRITE|FILE_BIN);
         if(file_handle != INVALID_HANDLE) {
            FileWriteInteger(file_handle, 1);
            FileClose(file_handle);
         }
      }
   }
   
   SyncData();
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { EventKillTimer(); }

void OnTimer() { SyncData(); }

void OnTick() {
   double currentBalance = AccountBalance();
   if(MathAbs(currentBalance - LastBalance) > 0.01) {
      SendBalanceUpdate(currentBalance);
      LastBalance = currentBalance;
   }
}

bool ScanAndSendHistory() {
   if(!IsConnected()) return false;
   
   Print("ZoyaEdge: Scanning full history...");
   
   datetime from = 0;
   if(InpHistoryDepth > 0) from = TimeCurrent() - (InpHistoryDepth * 86400);
   
   int total = OrdersHistoryTotal();
   string tradesJson = "";
   int count = 0;
   
   for(int i = 0; i < total; i++) {
      if(OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) {
         if(OrderSymbol() == "" || OrderType() > 1) continue;
         if(OrderCloseTime() < from && from > 0) continue;
         
         if(count > 0) tradesJson += ",";
         
         tradesJson += "{";
         tradesJson += "\\"ticket\\":\\"" + IntegerToString(OrderTicket()) + "\\",";
         tradesJson += "\\"pair\\":\\"" + OrderSymbol() + "\\",";
         tradesJson += "\\"direction\\":\\"" + (OrderType()==OP_BUY?"buy":"sell") + "\\",";
         tradesJson += "\\"lotSize\\":" + DoubleToString(OrderLots(), 2) + ",";
         tradesJson += "\\"entryPrice\\":" + DoubleToString(OrderOpenPrice(), Digits) + ",";
         tradesJson += "\\"exitPrice\\":" + DoubleToString(OrderClosePrice(), Digits) + ",";
         tradesJson += "\\"pnl\\":" + DoubleToString(OrderProfit() + OrderCommission() + OrderSwap(), 2) + ",";
         tradesJson += "\\"timestamp\\":" + IntegerToString(OrderCloseTime());
         tradesJson += "}";
         
         count++;
      }
   }
   
   if(count == 0) return true;
   
   string fullJson = "{\\"syncKey\\":\\"" + InpSyncKey + "\\",\\"type\\":\\"initial_history\\",\\"trades\\":[";
   fullJson += tradesJson;
   fullJson += "],\\"reqTime\\":" + IntegerToString(TimeCurrent()) + "}";
   
   return SendWithRetry(fullJson, "Initial History Sync");
}

bool SendWithRetry(string json, string desc) {
   char post[], result[];
   string headers = "Content-Type: application/json\\r\\n";
   StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
   
   for(int attempt = 1; attempt <= 3; attempt++) {
      string result_headers;
      int res = WebRequest("POST", InpWebhookURL, headers, 10000, post, result, result_headers);
      
      if(res >= 200 && res < 300) {
         string responseStr = CharArrayToString(result);
         if(StringFind(responseStr, "\\"success\\":true") >= 0) {
            Print("ZoyaEdge: ", desc, " success on attempt ", attempt);
            return true;
         }
      }
      
      Print("ZoyaEdge: ", desc, " failed (Attempt ", attempt, "/3). Error: ", res);
      if(attempt < 3) Sleep(5000);
   }
   
   return false;
}

void SendBalanceUpdate(double balance) {
   string json = "{\\"syncKey\\":\\"" + InpSyncKey + "\\",\\"type\\":\\"balance_update\\",\\"balance\\":" + DoubleToString(balance, 2) + ",\\"reqTime\\":" + IntegerToString(TimeCurrent()) + "}";
   char post[], result[];
   string headers = "Content-Type: application/json\\r\\n";
   StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
   string result_headers;
   WebRequest("POST", InpWebhookURL, headers, 5000, post, result, result_headers);
}

void SyncData() {
   if(!IsConnected()) return;
   
   datetime from = TimeCurrent() - 3600;
   int total = OrdersHistoryTotal();
   int synced = 0;
   
   for(int i = 0; i < total; i++) {
      if(OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) {
         if(OrderSymbol() == "" || OrderType() > 1) continue;
         if(OrderCloseTime() < from) continue;
         
         string json = "{";
         json += "\\"syncKey\\":\\"" + InpSyncKey + "\\",";
         json += "\\"ticket\\":\\"" + IntegerToString(OrderTicket()) + "\\",";
         json += "\\"pair\\":\\"" + OrderSymbol() + "\\",";
         json += "\\"direction\\":\\"" + (OrderType()==OP_BUY?"buy":"sell") + "\\",";
         json += "\\"lotSize\\":" + DoubleToString(OrderLots(), 2) + ",";
         json += "\\"entryPrice\\":" + DoubleToString(OrderOpenPrice(), Digits) + ",";
         json += "\\"exitPrice\\":" + DoubleToString(OrderClosePrice(), Digits) + ",";
         json += "\\"pnl\\":" + DoubleToString(OrderProfit() + OrderCommission() + OrderSwap(), 2) + ",";
         json += "\\"timestamp\\":" + IntegerToString(OrderCloseTime()) + ",";
         json += "\\"reqTime\\":" + IntegerToString(TimeCurrent());
         json += "}";
         
         char post[], result[];
         string headers = "Content-Type: application/json\\r\\n";
         StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
         string result_headers;
         int res = WebRequest("POST", InpWebhookURL, headers, 5000, post, result, result_headers);
         if(res >= 200 && res < 300) synced++;
      }
   }
   
   // Heartbeat & Push Notifications
   string hb_json = "{\\"syncKey\\":\\"" + InpSyncKey + "\\",\\"action\\":\\"heartbeat\\",\\"platform\\":\\"MT4\\",\\"balance\\":" + DoubleToString(AccountBalance(), 2) + "}";
   char hb_post[], hb_result[];
   string hb_headers = "Content-Type: application/json\\r\\n";
   StringToCharArray(hb_json, hb_post, 0, WHOLE_ARRAY, CP_UTF8);
   string hb_res_headers;
   int hb_res = WebRequest("POST", InpWebhookURL, hb_headers, 5000, hb_post, hb_result, hb_res_headers);
   if(hb_res >= 200 && hb_res < 300) {
      string responseStr = CharArrayToString(hb_result);
      int msgPos = StringFind(responseStr, "\\"pushMessage\\":\\"");
      if(msgPos >= 0) {
         msgPos += 15;
         int endPos = StringFind(responseStr, "\\"", msgPos);
         if(endPos > msgPos) {
            string msg = StringSubstr(responseStr, msgPos, endPos - msgPos);
            if(msg != "") { SendNotification(msg); Print("ZoyaEdge Push Notification envoyée: ", msg); }
         }
      }
   }
}
`;
  } else {
    // MT5 Template
    content = `//+------------------------------------------------------------------+
//|                                                 ZoyaEdgeSync.mq5 |
//|                                            Copyright 2026, ZoyaEdge|
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, ZoyaEdge"
#property link      "https://zoyaedge.com"
#property version   "1.02"
#property description "Expert Advisor pour synchroniser les trades avec ZoyaEdge (MT5)"

input string InpSyncKey = "${syncKey || ""}"; // Clé de synchronisation
input string InpWebhookURL = "${webhookUrl}"; // URL du Webhook
input int    InpSyncTimer = 60; // Intervalle (sec)

enum ENUM_HISTORY_DEPTH {
   DEPTH_1_DAY = 1,
   DEPTH_1_WEEK = 7,
   DEPTH_1_MONTH = 30,
   DEPTH_ALL = 0
};

input ENUM_HISTORY_DEPTH InpHistoryDepth = DEPTH_ALL; // Profondeur historique

// Global variables for tracking
double LastBalance = 0;
bool   InitialSyncDone = false;
string SyncFile = "ZoyaEdgeSync_" + InpSyncKey + ".dat";

int OnInit() {
   if(InpSyncKey == "") { Alert("Clé manquante !"); return(INIT_PARAMETERS_INCORRECT); }
   
   // Check if history already synced
   if(FileIsExist(SyncFile)) InitialSyncDone = true;
   
   LastBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   
   EventSetTimer(InpSyncTimer);
   
   if(!InitialSyncDone) {
      if(ScanAndSendHistory()) {
         InitialSyncDone = true;
         int file_handle = FileOpen(SyncFile, FILE_WRITE|FILE_BIN);
         if(file_handle != INVALID_HANDLE) {
            FileWriteInteger(file_handle, 1);
            FileClose(file_handle);
         }
      }
   }
   
   SyncData();
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { EventKillTimer(); }

void OnTimer() { SyncData(); }

void OnTick() {
   double currentBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   if(MathAbs(currentBalance - LastBalance) > 0.01) {
      SendBalanceUpdate(currentBalance);
      LastBalance = currentBalance;
   }
}

bool ScanAndSendHistory() {
   if(!TerminalInfoInteger(TERMINAL_CONNECTED)) return false;
   
   Print("ZoyaEdge: Scanning full history...");
   
   datetime from = 0;
   if(InpHistoryDepth > 0) from = TimeCurrent() - (InpHistoryDepth * 86400);
   
   HistorySelect(from, TimeCurrent());
   int total = HistoryDealsTotal();
   
   string tradesJson = "";
   int count = 0;
   
   for(int i = 0; i < total; i++) {
      ulong ticket = HistoryDealGetTicket(i);
      long type = HistoryDealGetInteger(ticket, DEAL_TYPE);
      
      if(type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL) continue;
      
      long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_INOUT) continue;
      
      string symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
      double volume = HistoryDealGetDouble(ticket, DEAL_VOLUME);
      double price = HistoryDealGetDouble(ticket, DEAL_PRICE);
      double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT) + HistoryDealGetDouble(ticket, DEAL_COMMISSION) + HistoryDealGetDouble(ticket, DEAL_SWAP);
      long time = HistoryDealGetInteger(ticket, DEAL_TIME);
      
      if(count > 0) tradesJson += ",";
      
      tradesJson += "{";
      tradesJson += "\\"ticket\\":\\"" + IntegerToString(ticket) + "\\",";
      tradesJson += "\\"pair\\":\\"" + symbol + "\\",";
      tradesJson += "\\"direction\\":\\"" + (type == DEAL_TYPE_BUY ? "buy" : "sell") + "\\",";
      tradesJson += "\\"lotSize\\":" + DoubleToString(volume, 2) + ",";
      tradesJson += "\\"exitPrice\\":" + DoubleToString(price, _Digits) + ",";
      tradesJson += "\\"pnl\\":" + DoubleToString(profit, 2) + ",";
      tradesJson += "\\"timestamp\\":" + IntegerToString(time);
      tradesJson += "}";
      
      count++;
   }
   
   if(count == 0) return true;
   
   string fullJson = "{\\"syncKey\\":\\"" + InpSyncKey + "\\",\\"type\\":\\"initial_history\\",\\"trades\\":[";
   fullJson += tradesJson;
   fullJson += "],\\"reqTime\\":" + IntegerToString(TimeCurrent()) + "}";
   
   return SendWithRetry(fullJson, "Initial History Sync");
}

bool SendWithRetry(string json, string desc) {
   char post[], result[];
   string headers = "Content-Type: application/json\\r\\n";
   StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
   
   for(int attempt = 1; attempt <= 3; attempt++) {
      string result_headers;
      int res = WebRequest("POST", InpWebhookURL, headers, 10000, post, result, result_headers);
      
      if(res >= 200 && res < 300) {
         string responseStr = CharArrayToString(result);
         if(StringFind(responseStr, "\\"success\\":true") >= 0) {
            Print("ZoyaEdge: ", desc, " success on attempt ", attempt);
            return true;
         }
      }
      
      Print("ZoyaEdge: ", desc, " failed (Attempt ", attempt, "/3). Error: ", res);
      if(attempt < 3) Sleep(5000);
   }
   
   return false;
}

void SendBalanceUpdate(double balance) {
   string json = "{\\"syncKey\\":\\"" + InpSyncKey + "\\",\\"type\\":\\"balance_update\\",\\"balance\\":" + DoubleToString(balance, 2) + ",\\"reqTime\\":" + IntegerToString(TimeCurrent()) + "}";
   char post[], result[];
   string headers = "Content-Type: application/json\\r\\n";
   StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
   string result_headers;
   WebRequest("POST", InpWebhookURL, headers, 5000, post, result, result_headers);
}

void SyncData() {
   if(!TerminalInfoInteger(TERMINAL_CONNECTED)) return;
   
   datetime from = TimeCurrent() - 3600; // Last hour for safety
   HistorySelect(from, TimeCurrent());
   int total = HistoryDealsTotal();
   int synced = 0;
   
   for(int i = 0; i < total; i++) {
      ulong ticket = HistoryDealGetTicket(i);
      long type = HistoryDealGetInteger(ticket, DEAL_TYPE);
      if(type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL) continue;
      long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_INOUT) continue;
      
      string symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
      double volume = HistoryDealGetDouble(ticket, DEAL_VOLUME);
      double price = HistoryDealGetDouble(ticket, DEAL_PRICE);
      double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT) + HistoryDealGetDouble(ticket, DEAL_COMMISSION) + HistoryDealGetDouble(ticket, DEAL_SWAP);
      long time = HistoryDealGetInteger(ticket, DEAL_TIME);
      
      string json = "{";
      json += "\\"syncKey\\":\\"" + InpSyncKey + "\\",";
      json += "\\"ticket\\":\\"" + IntegerToString(ticket) + "\\",";
      json += "\\"pair\\":\\"" + symbol + "\\",";
      json += "\\"direction\\":\\"" + (type == DEAL_TYPE_BUY ? "buy" : "sell") + "\\",";
      json += "\\"lotSize\\":" + DoubleToString(volume, 2) + ",";
      json += "\\"exitPrice\\":" + DoubleToString(price, _Digits) + ",";
      json += "\\"pnl\\":" + DoubleToString(profit, 2) + ",";
      json += "\\"timestamp\\":" + IntegerToString(time) + ",";
      json += "\\"reqTime\\":" + IntegerToString(TimeCurrent());
      json += "}";
      
      char post[], result[];
      string headers = "Content-Type: application/json\\r\\n";
      StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
      string result_headers;
      int res = WebRequest("POST", InpWebhookURL, headers, 5000, post, result, result_headers);
      if(res >= 200 && res < 300) synced++;
   }
   
   // Heartbeat & Push Notifications
   string hb_json = "{\\"syncKey\\":\\"" + InpSyncKey + "\\",\\"action\\":\\"heartbeat\\",\\"platform\\":\\"MT5\\",\\"balance\\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + "}";
   char hb_post[], hb_result[];
   string hb_headers = "Content-Type: application/json\\r\\n";
   StringToCharArray(hb_json, hb_post, 0, WHOLE_ARRAY, CP_UTF8);
   string hb_res_headers;
   int hb_res = WebRequest("POST", InpWebhookURL, hb_headers, 5000, hb_post, hb_result, hb_res_headers);
   if(hb_res >= 200 && hb_res < 300) {
      string responseStr = CharArrayToString(hb_result);
      int msgPos = StringFind(responseStr, "\\"pushMessage\\":\\"");
      if(msgPos >= 0) {
         msgPos += 15;
         int endPos = StringFind(responseStr, "\\"", msgPos);
         if(endPos > msgPos) {
            string msg = StringSubstr(responseStr, msgPos, endPos - msgPos);
            if(msg != "") { SendNotification(msg); Print("ZoyaEdge Push Notification envoyée: ", msg); }
         }
      }
   }
}
`;
  }

  const crlfContent = content.replace(/\n/g, '\r\n');
  const buffer = Buffer.from(crlfContent, 'utf16le');
  const bom = Buffer.from([0xFF, 0xFE]);
  const finalBuffer = Buffer.concat([bom, buffer]);
  
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="ZoyaEdgeSync_${platform}.${ext}"`);
  res.send(finalBuffer);
};
