export const DEFAULT_PACK_FILES = {
    ZoyaEdgePackPro_Indicator_mq5: `//+------------------------------------------------------------------+
//|                                   ZoyaEdgePackPro_Indicator.mq5 |
//|                        ZoyaEdge Pack Pro v2.0                    |
//|                 Multi-Actifs & Multi-Timezone                     |
//+------------------------------------------------------------------+
#property copyright "ZoyaEdge"
#property link      ""
#property version   "2.00"
#property indicator_chart_window
#property indicator_buffers 16
#property indicator_plots   8

// --- Buffers de signaux d'entrée ---
#property indicator_label1  "BuySignal"
#property indicator_type1   DRAW_ARROW
#property indicator_color1  clrLime
#property indicator_width1  2

#property indicator_label2  "SellSignal"
#property indicator_type2   DRAW_ARROW
#property indicator_color2  clrRed
#property indicator_width2  2

#property indicator_label3  "BuySL"
#property indicator_type3   DRAW_NONE

#property indicator_label4  "SellSL"
#property indicator_type4   DRAW_NONE

// --- Buffers de signaux BOS ---
#property indicator_label5  "BOS_Buy"
#property indicator_type5   DRAW_ARROW
#property indicator_color5  clrCyan
#property indicator_width5  2

#property indicator_label6  "BOS_Sell"
#property indicator_type6   DRAW_ARROW
#property indicator_color6  clrDeepPink
#property indicator_width6  2

// --- Buffers de confirmation MTF ---
#property indicator_label7  "MTF_Confirm_Buy"
#property indicator_type7   DRAW_ARROW
#property indicator_color7  clrGreen
#property indicator_width7  3

#property indicator_label8  "MTF_Confirm_Sell"
#property indicator_type8   DRAW_ARROW
#property indicator_color8  clrCrimson
#property indicator_width8  3

#include <Arrays\\ArrayObj.mqh>

//+------------------------------------------------------------------+
//| Inputs                                                           |
//+------------------------------------------------------------------+
input bool     InpUseOB        = true;         // Utiliser Order Blocks
input bool     InpUseFVG       = true;         // Utiliser Fair Value Gaps
input bool     InpTrendFilter  = true;         // Filtrer avec Break of Structure
input bool     InpShowBOSLines = true;         // Afficher les lignes BOS
input bool     InpShowBOSSignals= false;       // Afficher les flèches BOS

// --- Paramètres Multi-Timeframe ---
input bool     InpUseMTF       = true;         // Activer l'analyse Multi-Timeframe
input ENUM_TIMEFRAMES InpMTF_TF1 = PERIOD_M15; // Timeframe confirmation 1
input ENUM_TIMEFRAMES InpMTF_TF2 = PERIOD_H1;  // Timeframe confirmation 2
input bool     InpMTF_RequireAll= false;       // Exiger tous les TF alignés (sinon 1 suffit)

input int      InpSwingLR      = 5;            // Barres gauche/droite pour swings
input int      InpMinFVGPips   = 5;            // Écart minimum en pips (FVG)
input int      InpMaxZoneBars  = 200;          // Âge maximum d'une zone
input color    InpColorBullOB  = clrDodgerBlue;
input color    InpColorBearOB  = clrOrangeRed;
input color    InpColorBullFVG = clrMediumSpringGreen;
input color    InpColorBearFVG = clrTomato;
input bool     InpAlertOnSignal = false;       // Alerte sonore

// --- Buffers internes ---
double BuyBuffer[], SellBuffer[];
double BuySLBuffer[], SellSLBuffer[];
double BuyTPBuffer[], SellTPBuffer[];
double BOSBuyBuffer[], BOSSellBuffer[];
double MTFBuyBuffer[], MTFSellBuffer[];
double Dummy1[], Dummy2[], Dummy3[], Dummy4[], Dummy5[], Dummy6[];

// --- Structures ---
struct SWING { datetime time; double price; int dir; };
struct OBZONE { datetime start,end; double high,low; int dir; bool mitigated; };
struct FVGZONE { datetime start,end; double high,low; int dir; bool mitigated; };

CArrayObj Swings;
CArrayObj OBZones;
CArrayObj FVGZones;
datetime lastBarTime;

SWING lastBrokenSwingBuy, lastBrokenSwingSell;

const int SIGNAL_BUY  = 1;
const int SIGNAL_SELL = -1;

// Handles pour les timeframes de confirmation
int hMTF1, hMTF2;

//+------------------------------------------------------------------+
int OnInit()
  {
   SetIndexBuffer(0,BuyBuffer,INDICATOR_DATA);
   SetIndexBuffer(1,SellBuffer,INDICATOR_DATA);
   SetIndexBuffer(2,BuySLBuffer,INDICATOR_DATA);
   SetIndexBuffer(3,SellSLBuffer,INDICATOR_DATA);
   SetIndexBuffer(4,BOSBuyBuffer,INDICATOR_DATA);
   SetIndexBuffer(5,BOSSellBuffer,INDICATOR_DATA);
   SetIndexBuffer(6,MTFBuyBuffer,INDICATOR_DATA);
   SetIndexBuffer(7,MTFSellBuffer,INDICATOR_DATA);
   SetIndexBuffer(8,Dummy1,INDICATOR_CALCULATIONS);
   SetIndexBuffer(9,Dummy2,INDICATOR_CALCULATIONS);
   SetIndexBuffer(10,Dummy3,INDICATOR_CALCULATIONS);
   SetIndexBuffer(11,Dummy4,INDICATOR_CALCULATIONS);
   SetIndexBuffer(12,Dummy5,INDICATOR_CALCULATIONS);
   SetIndexBuffer(13,Dummy6,INDICATOR_CALCULATIONS);
   SetIndexBuffer(14,BuyTPBuffer,INDICATOR_CALCULATIONS);
   SetIndexBuffer(15,SellTPBuffer,INDICATOR_CALCULATIONS);

   PlotIndexSetInteger(0,PLOT_ARROW,233);
   PlotIndexSetInteger(1,PLOT_ARROW,234);
   PlotIndexSetInteger(4,PLOT_ARROW,233);
   PlotIndexSetInteger(5,PLOT_ARROW,234);
   PlotIndexSetInteger(6,PLOT_ARROW,108); // étoile pour confirmation MTF
   PlotIndexSetInteger(7,PLOT_ARROW,108);

   Swings.Clear();
   OBZones.Clear();
   FVGZones.Clear();
   lastBarTime = 0;
   lastBrokenSwingBuy.time = 0;
   lastBrokenSwingSell.time = 0;

   // Initialiser les handles MTF
   if(InpUseMTF)
     {
      hMTF1 = iCustom(_Symbol, InpMTF_TF1, "ZoyaEdgePackPro_Indicator",
                       InpUseOB, InpUseFVG, false, false, false, InpSwingLR,
                       InpMinFVGPips, InpMaxZoneBars, InpColorBullOB, InpColorBearOB,
                       InpColorBullFVG, InpColorBearFVG, false);
      hMTF2 = iCustom(_Symbol, InpMTF_TF2, "ZoyaEdgePackPro_Indicator",
                       InpUseOB, InpUseFVG, false, false, false, InpSwingLR,
                       InpMinFVGPips, InpMaxZoneBars, InpColorBullOB, InpColorBearOB,
                       InpColorBullFVG, InpColorBearFVG, false);
     }

   return(INIT_SUCCEEDED);
  }
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   ObjectsDeleteAll(0,"ZEDGE_");
   if(hMTF1 != INVALID_HANDLE) IndicatorRelease(hMTF1);
   if(hMTF2 != INVALID_HANDLE) IndicatorRelease(hMTF2);
  }
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
  {
   if(rates_total < 10) return(0);
   int start = prev_calculated>0 ? prev_calculated-1 : 0;
   bool newBar = (time[rates_total-1] != lastBarTime);
   if(newBar) lastBarTime = time[rates_total-1];

   for(int i=start; i<rates_total; i++)
      DetectSwing(i,high,low,time);

   for(int i=start; i<rates_total; i++)
      if(InpShowBOSLines || InpShowBOSSignals)
         DetectBOS(i,high,low,close,time);

   for(int i=start; i<rates_total; i++)
     {
      DetectOB(i,high,low,close,time);
      DetectFVG(i,high,low,time);
     }

   for(int i=OBZones.Total()-1; i>=0; i--)
     {
      OBZONE *ob = OBZones.At(i);
      if(time[rates_total-1] - ob->start > InpMaxZoneBars*PeriodSeconds())
         OBZones.Delete(i);
     }
   for(int i=FVGZones.Total()-1; i>=0; i--)
     {
      FVGZONE *fvg = FVGZones.At(i);
      if(time[rates_total-1] - fvg->start > InpMaxZoneBars*PeriodSeconds())
         FVGZones.Delete(i);
     }

   ArrayInitialize(BuyBuffer,0);
   ArrayInitialize(SellBuffer,0);
   ArrayInitialize(BuySLBuffer,0);
   ArrayInitialize(SellSLBuffer,0);
   ArrayInitialize(BOSBuyBuffer,0);
   ArrayInitialize(BOSSellBuffer,0);
   ArrayInitialize(MTFBuyBuffer,0);
   ArrayInitialize(MTFSellBuffer,0);
   ArrayInitialize(BuyTPBuffer,0);
   ArrayInitialize(SellTPBuffer,0);

   int signalBar = rates_total-2;
   if(signalBar<0) return(rates_total);

   double priceClose = close[signalBar];
   int trendDir = InpTrendFilter ? GetTrendDirection(rates_total,high,low) : 0;

   // --- Analyse Multi-Timeframe ---
   int mtfConfirmation = 0; // 0=neutre, 1=tous haussier, -1=tous baissier
   if(InpUseMTF)
     {
      mtfConfirmation = GetMTFConfirmation(signalBar);
      // Afficher les confirmations MTF
      if(mtfConfirmation == 1)
        {
         MTFBuyBuffer[signalBar] = low[signalBar] - 35*_Point;
        }
      else if(mtfConfirmation == -1)
        {
         MTFSellBuffer[signalBar] = high[signalBar] + 35*_Point;
        }
     }

   // Signaux avec filtre MTF
   if(InpUseOB && IsPriceInsideOB(priceClose, SIGNAL_BUY, time[signalBar], trendDir))
     {
      if(!InpUseMTF || mtfConfirmation == 1 || (!InpMTF_RequireAll && mtfConfirmation != -1))
        {
         BuyBuffer[signalBar] = low[signalBar] - 20*_Point;
         BuySLBuffer[signalBar] = GetSLFromOB(priceClose,SIGNAL_BUY);
         if(InpAlertOnSignal) Alert(_Symbol," Signal ACHAT (OB)");
        }
     }
   else if(InpUseFVG && IsPriceInsideFVG(priceClose, SIGNAL_BUY, time[signalBar], trendDir))
     {
      if(!InpUseMTF || mtfConfirmation == 1 || (!InpMTF_RequireAll && mtfConfirmation != -1))
        {
         BuyBuffer[signalBar] = low[signalBar] - 20*_Point;
         BuySLBuffer[signalBar] = GetSLFromFVG(priceClose,SIGNAL_BUY);
         if(InpAlertOnSignal) Alert(_Symbol," Signal ACHAT (FVG)");
        }
     }

   if(InpUseOB && IsPriceInsideOB(priceClose, SIGNAL_SELL, time[signalBar], trendDir))
     {
      if(!InpUseMTF || mtfConfirmation == -1 || (!InpMTF_RequireAll && mtfConfirmation != 1))
        {
         SellBuffer[signalBar] = high[signalBar] + 20*_Point;
         SellSLBuffer[signalBar] = GetSLFromOB(priceClose,SIGNAL_SELL);
         if(InpAlertOnSignal) Alert(_Symbol," Signal VENTE (OB)");
        }
     }
   else if(InpUseFVG && IsPriceInsideFVG(priceClose, SIGNAL_SELL, time[signalBar], trendDir))
     {
      if(!InpUseMTF || mtfConfirmation == -1 || (!InpMTF_RequireAll && mtfConfirmation != 1))
        {
         SellBuffer[signalBar] = high[signalBar] + 20*_Point;
         SellSLBuffer[signalBar] = GetSLFromFVG(priceClose,SIGNAL_SELL);
         if(InpAlertOnSignal) Alert(_Symbol," Signal VENTE (FVG)");
        }
     }

   return(rates_total);
  }

//+------------------------------------------------------------------+
//| Analyse Multi-Timeframe                                          |
//+------------------------------------------------------------------+
int GetMTFConfirmation(int bar)
  {
   int bullishCount = 0;
   int bearishCount = 0;
   int validTF = 0;

   // Vérifier TF1
   if(hMTF1 != INVALID_HANDLE)
     {
      double mtf1Buy[], mtf1Sell[];
      ArraySetAsSeries(mtf1Buy,true);
      ArraySetAsSeries(mtf1Sell,true);
      if(CopyBuffer(hMTF1,0,0,3,mtf1Buy)>=3 && CopyBuffer(hMTF1,1,0,3,mtf1Sell)>=3)
        {
         validTF++;
         double currentClose = iClose(_Symbol, InpMTF_TF1, 1);
         int trendMTF1 = GetTrendFromIndicator(mtf1Buy, mtf1Sell);
         if(trendMTF1 == 1) bullishCount++;
         else if(trendMTF1 == -1) bearishCount++;
        }
     }

   // Vérifier TF2
   if(hMTF2 != INVALID_HANDLE)
     {
      double mtf2Buy[], mtf2Sell[];
      ArraySetAsSeries(mtf2Buy,true);
      ArraySetAsSeries(mtf2Sell,true);
      if(CopyBuffer(hMTF2,0,0,3,mtf2Buy)>=3 && CopyBuffer(hMTF2,1,0,3,mtf2Sell)>=3)
        {
         validTF++;
         int trendMTF2 = GetTrendFromIndicator(mtf2Buy, mtf2Sell);
         if(trendMTF2 == 1) bullishCount++;
         else if(trendMTF2 == -1) bearishCount++;
        }
     }

   if(validTF == 0) return 0;

   if(InpMTF_RequireAll)
     {
      if(bullishCount == validTF) return 1;
      if(bearishCount == validTF) return -1;
      return 0;
     }
   else
     {
      if(bullishCount > bearishCount) return 1;
      if(bearishCount > bullishCount) return -1;
      return 0;
     }
  }
//+------------------------------------------------------------------+
int GetTrendFromIndicator(const double &buy[], const double &sell[])
  {
   // Analyse les 3 dernières barres de l'indicateur sur l'autre timeframe
   for(int i=0; i<3; i++)
     {
      if(buy[i] != 0 && buy[i] != EMPTY_VALUE) return 1;
      if(sell[i] != 0 && sell[i] != EMPTY_VALUE) return -1;
     }
   return 0;
  }
//+------------------------------------------------------------------+
void DetectSwing(int i, const double &h[], const double &l[], const datetime &t[])
  {
   if(i < InpSwingLR*2+1) return;
   int leftRight = InpSwingLR;
   bool isHigh=true;
   double maxH = h[i-leftRight];
   for(int k=1; k<=leftRight; k++)
      if(h[i-leftRight-k] > maxH || h[i-leftRight+k] > maxH) {isHigh=false; break;}
   if(isHigh && h[i-leftRight]==maxH)
     {
      SWING *sw = new SWING();
      sw.time = t[i-leftRight]; sw.price = h[i-leftRight]; sw.dir = 1;
      Swings.Add(sw);
      if(InpShowBOSLines)
        {
         ObjectCreate(0,"ZEDGE_SWING_H_"+_Symbol+"_"+string(sw.time),OBJ_ARROW,0,sw.time,sw.price);
         ObjectSetInteger(0,"ZEDGE_SWING_H_"+_Symbol+"_"+string(sw.time),OBJPROP_ARROWCODE,234);
         ObjectSetInteger(0,"ZEDGE_SWING_H_"+_Symbol+"_"+string(sw.time),OBJPROP_COLOR,clrYellow);
        }
     }
   bool isLow=true;
   double minL = l[i-leftRight];
   for(int k=1; k<=leftRight; k++)
      if(l[i-leftRight-k] < minL || l[i-leftRight+k] < minL) {isLow=false; break;}
   if(isLow && l[i-leftRight]==minL)
     {
      SWING *sw = new SWING();
      sw.time = t[i-leftRight]; sw.price = l[i-leftRight]; sw.dir = -1;
      Swings.Add(sw);
      if(InpShowBOSLines)
        {
         ObjectCreate(0,"ZEDGE_SWING_L_"+_Symbol+"_"+string(sw.time),OBJ_ARROW,0,sw.time,sw.price);
         ObjectSetInteger(0,"ZEDGE_SWING_L_"+_Symbol+"_"+string(sw.time),OBJPROP_ARROWCODE,233);
         ObjectSetInteger(0,"ZEDGE_SWING_L_"+_Symbol+"_"+string(sw.time),OBJPROP_COLOR,clrYellow);
        }
     }
  }
//+------------------------------------------------------------------+
void DetectBOS(int i, const double &h[], const double &l[], const double &c[], const datetime &t[])
  {
   if(Swings.Total() < 2) return;
   double currentHigh = h[i], currentLow = l[i];
   datetime currentTime = t[i];
   for(int s=Swings.Total()-1; s>=1; s--)
     {
      SWING *prev = Swings.At(s);
      if(prev.dir == 1 && currentHigh > prev.price && currentTime > prev.time)
        {
         if(lastBrokenSwingBuy.time != prev.time)
           {
            lastBrokenSwingBuy = prev;
            if(InpShowBOSLines)
              {
               string name = "ZEDGE_BOS_H_"+_Symbol+"_"+string(prev.time);
               if(ObjectFind(0,name)<0)
                 {
                  ObjectCreate(0,name,OBJ_HLINE,0,prev.time,prev.price);
                  ObjectSetInteger(0,name,OBJPROP_COLOR,clrLimeGreen);
                  ObjectSetInteger(0,name,OBJPROP_STYLE,STYLE_DASH);
                  ObjectSetInteger(0,name,OBJPROP_BACK,true);
                  ObjectSetString(0,name,OBJPROP_TEXT,"BOS↑ "+_Symbol);
                 }
              }
            if(InpShowBOSSignals)
              { BOSBuyBuffer[i] = low[i] - 15*_Point; if(InpAlertOnSignal) Alert(_Symbol," BOS haussier"); }
           }
         break;
        }
      else if(prev.dir == -1 && currentLow < prev.price && currentTime > prev.time)
        {
         if(lastBrokenSwingSell.time != prev.time)
           {
            lastBrokenSwingSell = prev;
            if(InpShowBOSLines)
              {
               string name = "ZEDGE_BOS_L_"+_Symbol+"_"+string(prev.time);
               if(ObjectFind(0,name)<0)
                 {
                  ObjectCreate(0,name,OBJ_HLINE,0,prev.time,prev.price);
                  ObjectSetInteger(0,name,OBJPROP_COLOR,clrRed);
                  ObjectSetInteger(0,name,OBJPROP_STYLE,STYLE_DASH);
                  ObjectSetInteger(0,name,OBJPROP_BACK,true);
                  ObjectSetString(0,name,OBJPROP_TEXT,"BOS↓ "+_Symbol);
                 }
              }
            if(InpShowBOSSignals)
              { BOSSellBuffer[i] = high[i] + 15*_Point; if(InpAlertOnSignal) Alert(_Symbol," BOS baissier"); }
           }
         break;
        }
     }
  }
//+------------------------------------------------------------------+
void DetectOB(int i, const double &h[], const double &l[], const double &c[], const datetime &t[])
  {
   if(i<3) return;
   int bar1=i-2, bar2=i-1, bar3=i;
   double diff1=c[bar1]-c[bar2], diff2=c[bar2]-c[bar3];
   if(diff1*diff2>0) return;
   int dir = (c[bar3]>c[bar1]) ? 1 : -1;
   int obBar = bar2;
   double obHigh = h[obBar], obLow = l[obBar];
   for(int k=0;k<OBZones.Total();k++)
      if(OBZones.At(k).start == t[obBar]) return;
   OBZONE *ob = new OBZONE();
   ob.start = t[obBar]; ob.end = t[bar3];
   ob.high = dir==1 ? obLow : obHigh;
   ob.low  = dir==1 ? l[bar3] : obLow;
   ob.dir = dir; ob.mitigated = false;
   OBZones.Add(ob);
   string name = "ZEDGE_OB_"+_Symbol+"_"+string(ob.start);
   ObjectCreate(0,name,OBJ_RECTANGLE,0,ob.start,ob.high,ob.end,ob.low);
   ObjectSetInteger(0,name,OBJPROP_COLOR, dir==1?InpColorBullOB:InpColorBearOB);
   ObjectSetInteger(0,name,OBJPROP_BACK,true);
   ObjectSetInteger(0,name,OBJPROP_WIDTH,1);
  }
//+------------------------------------------------------------------+
void DetectFVG(int i, const double &h[], const double &l[], const datetime &t[])
  {
   if(i<2) return;
   int bar1=i-2, bar2=i-1, bar3=i;
   double minGap = InpMinFVGPips * _Point * 10;
   if(l[bar1] > h[bar3] && (l[bar1]-h[bar3])>=minGap && c[bar2]>c[bar1])
     {
      FVGZONE *fvg = new FVGZONE();
      fvg.start = t[bar1]; fvg.end = t[bar3];
      fvg.high = l[bar1]; fvg.low = h[bar3];
      fvg.dir = 1; fvg.mitigated = false;
      FVGZones.Add(fvg);
      string name = "ZEDGE_FVG_"+_Symbol+"_"+string(fvg.start);
      ObjectCreate(0,name,OBJ_RECTANGLE,0,fvg.start,fvg.high,fvg.end,fvg.low);
      ObjectSetInteger(0,name,OBJPROP_COLOR,InpColorBullFVG);
      ObjectSetInteger(0,name,OBJPROP_BACK,true);
     }
   if(h[bar1] < l[bar3] && (l[bar3]-h[bar1])>=minGap && c[bar2]<c[bar1])
     {
      FVGZONE *fvg = new FVGZONE();
      fvg.start = t[bar1]; fvg.end = t[bar3];
      fvg.high = l[bar3]; fvg.low = h[bar1];
      fvg.dir = -1; fvg.mitigated = false;
      FVGZones.Add(fvg);
      string name = "ZEDGE_FVG_"+_Symbol+"_"+string(fvg.start);
      ObjectCreate(0,name,OBJ_RECTANGLE,0,fvg.start,fvg.high,fvg.end,fvg.low);
      ObjectSetInteger(0,name,OBJPROP_COLOR,InpColorBearFVG);
      ObjectSetInteger(0,name,OBJPROP_BACK,true);
     }
  }
//+------------------------------------------------------------------+
int GetTrendDirection(int total, const double &h[], const double &l[])
  {
   for(int i=Swings.Total()-1; i>=1; i--)
     {
      SWING *s0 = Swings.At(i), *s1 = Swings.At(i-1);
      if(s0.dir==1 && s0.price > s1.price && s1.dir==-1) return 1;
      if(s0.dir==-1 && s0.price < s1.price && s1.dir==1) return -1;
     }
   return 0;
  }
bool IsPriceInsideOB(double price, int signalDir, datetime barTime, int trendDir)
  {
   for(int i=OBZones.Total()-1; i>=0; i--)
     {
      OBZONE *ob = OBZones.At(i);
      if(ob.mitigated || ob.dir != signalDir) continue;
      if(trendDir!=0 && ob.dir != trendDir) continue;
      if(price >= ob.low && price <= ob.high)
        { ob.mitigated = true; return true; }
     }
   return false;
  }
bool IsPriceInsideFVG(double price, int signalDir, datetime barTime, int trendDir)
  {
   for(int i=FVGZones.Total()-1; i>=0; i--)
     {
      FVGZONE *fvg = FVGZones.At(i);
      if(fvg.mitigated || fvg.dir != signalDir) continue;
      if(trendDir!=0 && fvg.dir != trendDir) continue;
      if(price >= fvg.low && price <= fvg.high)
        { fvg.mitigated = true; return true; }
     }
   return false;
  }
double GetSLFromOB(double entry, int dir)
  { return (dir==1) ? entry - 200*_Point : entry + 200*_Point; }
double GetSLFromFVG(double entry, int dir)
  { return (dir==1) ? entry - 150*_Point : entry + 150*_Point; }
//+------------------------------------------------------------------+`,
    ZoyaEdgePackPro_EA_mq5: `//+------------------------------------------------------------------+
//|                                         ZoyaEdgePackPro_EA.mq5  |
//|                        ZoyaEdge Pack Pro v2.0                    |
//|                 Multi-Actifs & Multi-Timezone                     |
//+------------------------------------------------------------------+
#property copyright "ZoyaEdge"
#property link      ""
#property version   "2.00"
#include <Trade\\Trade.mqh>

//+------------------------------------------------------------------+
//| Inputs généraux                                                  |
//+------------------------------------------------------------------+
input string   InpIndicatorName = "ZoyaEdgePackPro_Indicator"; // Nom indicateur
input bool     InpAsyncOrder    = false;       // OrderSendAsync

//+------------------------------------------------------------------+
//| Liste des symboles (séparés par des virgules)                    |
//+------------------------------------------------------------------+
input string   InpSymbols       = "EURUSD,GBPUSD,USDJPY,XAUUSD,BTCUSD"; // Symboles à trader
input int      InpTotalMagic    = 202407;      // Magic number de base

//+------------------------------------------------------------------+
//| Paramètres par défaut (si non définis par symbole)               |
//+------------------------------------------------------------------+
input double   InpDefaultRisk   = 1.0;         // Risque % par défaut
input double   InpDefaultFixedLot=0.1;         // Lot fixe par défaut
input int      InpDefaultSL     = 200;         // SL par défaut (pips)
input int      InpDefaultTP     = 400;         // TP par défaut (pips)
input double   InpDefaultRR     = 2.0;         // Ratio R:R par défaut
input int      InpDefaultMaxSpread=30;         // Spread max par défaut
input string   InpDefaultStart  = "02:00";     // Heure début
input string   InpDefaultEnd    = "22:00";     // Heure fin

//+------------------------------------------------------------------+
//| Gestion des risques globaux                                      |
//+------------------------------------------------------------------+
input int      InpMaxDailyLoss  = 500;         // Perte max quotidienne
input int      InpMaxDailyTrades= 10;          // Max trades/jour
input int      InpMaxTotalPositions=5;         // Max positions simultanées
input bool     InpUseTrailStop  = true;        // Trailing Stop
input int      InpTrailStartPips= 20;          // Déclenchement trail
input int      InpTrailStepPips = 5;           // Pas du trail
input bool     InpUseBreakEven  = true;        // Break Even
input int      InpBreakEvenPips = 15;          // Déclenchement BE

//+------------------------------------------------------------------+
//| Filtres MTF (lus depuis l'indicateur)                            |
//+------------------------------------------------------------------+
input bool     InpUseMTF_Filter = true;        // Utiliser le filtre MTF de l'indicateur

//+------------------------------------------------------------------+
//| Structures par symbole                                           |
//+------------------------------------------------------------------+
struct SymbolConfig
  {
   string            symbol;
   ENUM_TIMEFRAMES   timeframe;
   int               magic;
   double            riskPercent;
   double            fixedLot;
   int               slPips;
   int               tpPips;
   double            rrRatio;
   int               maxSpread;
   string            startHour;
   string            endHour;
   bool              enabled;
   datetime          lastTradeBar;
   int               handleIndicator;
  };

SymbolConfig Symbols[];
CTrade Trade;
double dailyLoss=0, startBalance=0;
int dailyTrades=0;

//+------------------------------------------------------------------+
int OnInit()
  {
   Trade.SetAsyncMode(InpAsyncOrder);
   startBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   dailyTrades=0;

   // Parser la liste des symboles
   string symList[];
   int symCount = StringSplit(InpSymbols, ',', symList);

   ArrayResize(Symbols, symCount);

   for(int i=0; i<symCount; i++)
     {
      StringTrimLeft(symList[i]);
      StringTrimRight(symList[i]);

      Symbols[i].symbol       = symList[i];
      Symbols[i].timeframe    = PERIOD_M1;  // Peut être personnalisé
      Symbols[i].magic        = InpTotalMagic + i;
      Symbols[i].riskPercent  = InpDefaultRisk;
      Symbols[i].fixedLot     = InpDefaultFixedLot;
      Symbols[i].slPips       = InpDefaultSL;
      Symbols[i].tpPips       = InpDefaultTP;
      Symbols[i].rrRatio      = InpDefaultRR;
      Symbols[i].maxSpread    = InpDefaultMaxSpread;
      Symbols[i].startHour    = InpDefaultStart;
      Symbols[i].endHour      = InpDefaultEnd;
      Symbols[i].enabled      = true;
      Symbols[i].lastTradeBar = 0;
      Symbols[i].handleIndicator = iCustom(symList[i], Symbols[i].timeframe, InpIndicatorName);

      if(Symbols[i].handleIndicator == INVALID_HANDLE)
         Print("⚠️ Impossible de charger l'indicateur pour ", symList[i]);
      else
         Print("✅ Indicateur chargé pour ", symList[i]);
     }

   Print("🚀 ZoyaEdge Pack Pro v2.0 initialisé avec ", symCount, " symboles");
   return(INIT_SUCCEEDED);
  }
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   for(int i=0; i<ArraySize(Symbols); i++)
      if(Symbols[i].handleIndicator != INVALID_HANDLE)
         IndicatorRelease(Symbols[i].handleIndicator);
  }
//+------------------------------------------------------------------+
void OnTick()
  {
   // Réinitialisation quotidienne
   static datetime lastDay=0;
   datetime today = (datetime)(TimeCurrent()/86400)*86400;
   if(today != lastDay)
     {
      lastDay = today;
      dailyLoss = 0;
      dailyTrades = 0;
      startBalance = AccountInfoDouble(ACCOUNT_BALANCE);
     }

   // Contrôle perte quotidienne
   if(InpMaxDailyLoss>0)
     {
      double equity = AccountInfoDouble(ACCOUNT_EQUITY);
      if(equity < startBalance - InpMaxDailyLoss)
        { Print("⛔ Limite de perte quotidienne atteinte"); return; }
     }

   if(InpMaxDailyTrades>0 && dailyTrades >= InpMaxDailyTrades) return;

   // Compter les positions actuelles
   int currentPositions = CountOpenPositions();
   if(currentPositions >= InpMaxTotalPositions) return;

   // Boucle sur tous les symboles
   for(int s=0; s<ArraySize(Symbols); s++)
     {
      if(!Symbols[s].enabled) continue;
      if(Symbols[s].handleIndicator == INVALID_HANDLE) continue;

      ProcessSymbol(s);
     }
  }
//+------------------------------------------------------------------+
void ProcessSymbol(int idx)
  {
   string sym = Symbols[idx].symbol;
   ENUM_TIMEFRAMES tf = Symbols[idx].timeframe;

   // Filtre horaire
   if(!IsTradingHours(sym, Symbols[idx].startHour, Symbols[idx].endHour)) return;

   // Filtre spread
   double spread = GetSpreadPips(sym);
   if(spread > Symbols[idx].maxSpread) return;

   // Vérifier si position déjà ouverte sur ce symbole
   if(PositionSelect(sym))
      if(PositionGetInteger(POSITION_MAGIC) == Symbols[idx].magic)
        {
         if(InpUseTrailStop) ApplyTrailingStop(sym, Symbols[idx].magic);
         if(InpUseBreakEven) ApplyBreakEven(sym, Symbols[idx].magic);
         return;
        }

   // Lire les signaux de l'indicateur
   double buySignal[], sellSignal[], buySL[], sellSL[];
   ArraySetAsSeries(buySignal,true);
   ArraySetAsSeries(sellSignal,true);
   ArraySetAsSeries(buySL,true);
   ArraySetAsSeries(sellSL,true);

   int copied = CopyBuffer(Symbols[idx].handleIndicator, 0, 0, 3, buySignal);
   if(copied < 3) return;
   CopyBuffer(Symbols[idx].handleIndicator, 1, 0, 3, sellSignal);
   CopyBuffer(Symbols[idx].handleIndicator, 2, 0, 3, buySL);
   CopyBuffer(Symbols[idx].handleIndicator, 3, 0, 3, sellSL);

   datetime time[];
   ArraySetAsSeries(time,true);
   CopyTime(sym, tf, 0, 3, time);

   bool newBar = (time[0] != Symbols[idx].lastTradeBar);
   if(newBar) Symbols[idx].lastTradeBar = time[0];

   int signalBar = 1;

   // Signal Achat
   if(buySignal[signalBar] != 0 && buySignal[signalBar] != EMPTY_VALUE && time[signalBar] > Symbols[idx].lastTradeBar)
     {
      double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
      double entry = ask;
      double sl = Symbols[idx].slPips > 0 ? entry - Symbols[idx].slPips * GetPoint(sym) * 10 : buySL[signalBar];
      double tp = Symbols[idx].tpPips > 0 ? entry + Symbols[idx].tpPips * GetPoint(sym) * 10 : entry + (entry-sl) * Symbols[idx].rrRatio;
      if(sl >= entry || sl <= 0) return;

      double lot = Symbols[idx].riskPercent > 0 ? CalculateLotRisk(sym, entry, sl, Symbols[idx].riskPercent) : Symbols[idx].fixedLot;
      Trade.SetExpertMagicNumber(Symbols[idx].magic);
      if(Trade.Buy(lot, sym, entry, sl, tp, "ZoyaEdge Pro Buy "+sym))
        {
         dailyTrades++;
         Print("✅ ACHAT ", sym, " | Lot=", lot, " | SL=", sl, " | TP=", tp);
        }
     }

   // Signal Vente
   else if(sellSignal[signalBar] != 0 && sellSignal[signalBar] != EMPTY_VALUE && time[signalBar] > Symbols[idx].lastTradeBar)
     {
      double bid = SymbolInfoDouble(sym, SYMBOL_BID);
      double entry = bid;
      double sl = Symbols[idx].slPips > 0 ? entry + Symbols[idx].slPips * GetPoint(sym) * 10 : sellSL[signalBar];
      double tp = Symbols[idx].tpPips > 0 ? entry - Symbols[idx].tpPips * GetPoint(sym) * 10 : entry - (sl-entry) * Symbols[idx].rrRatio;
      if(sl <= entry || sl <= 0) return;

      double lot = Symbols[idx].riskPercent > 0 ? CalculateLotRisk(sym, entry, sl, Symbols[idx].riskPercent) : Symbols[idx].fixedLot;
      Trade.SetExpertMagicNumber(Symbols[idx].magic);
      if(Trade.Sell(lot, sym, entry, sl, tp, "ZoyaEdge Pro Sell "+sym))
        {
         dailyTrades++;
         Print("✅ VENTE ", sym, " | Lot=", lot, " | SL=", sl, " | TP=", tp);
        }
     }
  }
//+------------------------------------------------------------------+
double CalculateLotRisk(string sym, double entry, double sl, double riskPercent)
  {
   double riskMoney = AccountInfoDouble(ACCOUNT_BALANCE) * riskPercent / 100.0;
   double tickValue = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
   double slPoints = MathAbs(entry - sl) / GetPoint(sym);
   if(slPoints <= 0) return 0.01;
   double lot = riskMoney / (tickValue * slPoints);
   double minLot = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
   double stepLot = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   lot = MathMax(minLot, MathMin(maxLot, lot));
   lot = MathRound(lot / stepLot) * stepLot;
   return NormalizeDouble(lot, 2);
  }
//+------------------------------------------------------------------+
double GetSpreadPips(string sym)
  {
   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   double bid = SymbolInfoDouble(sym, SYMBOL_BID);
   return (ask - bid) / GetPoint(sym) / 10;
  }
//+------------------------------------------------------------------+
double GetPoint(string sym)
  {
   double point = SymbolInfoDouble(sym, SYMBOL_POINT);
   return (point == 0) ? 0.00001 : point;
  }
//+------------------------------------------------------------------+
bool IsTradingHours(string sym, string startStr, string endStr)
  {
   datetime now = TimeCurrent();
   MqlDateTime dt;
   TimeToStruct(now, dt);

   int startMin = StringToInteger(StringSubstr(startStr,0,2))*60 + StringToInteger(StringSubstr(startStr,3,2));
   int endMin   = StringToInteger(StringSubstr(endStr,0,2))*60   + StringToInteger(StringSubstr(endStr,3,2));
   int currentMin = dt.hour*60 + dt.min;

   if(startMin <= endMin)
      return (currentMin >= startMin && currentMin < endMin);
   else
      return (currentMin >= startMin || currentMin < endMin);
  }
//+------------------------------------------------------------------+
int CountOpenPositions()
  {
   int count = 0;
   for(int i=0; i<PositionsTotal(); i++)
     {
      if(PositionSelectByTicket(PositionGetTicket(i)))
        {
         long magic = PositionGetInteger(POSITION_MAGIC);
         if(magic >= InpTotalMagic && magic < InpTotalMagic + 100) // plage de magics ZoyaEdge
            count++;
        }
     }
   return count;
  }
//+------------------------------------------------------------------+
void ApplyTrailingStop(string sym, int magic)
  {
   if(!PositionSelect(sym)) return;
   if(PositionGetInteger(POSITION_MAGIC) != magic) return;

   double sl = PositionGetDouble(POSITION_SL);
   double tp = PositionGetDouble(POSITION_TP);
   double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
   int dir = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? 1 : -1;

   double bid = SymbolInfoDouble(sym, SYMBOL_BID);
   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   double currentPrice = (dir == 1) ? bid : ask;
   double point = GetPoint(sym);

   double trailStart = InpTrailStartPips * point * 10;
   double trailStep  = InpTrailStepPips * point * 10;

   Trade.SetExpertMagicNumber(magic);

   if(dir == 1)
     {
      if(currentPrice - openPrice < trailStart) return;
      double newSL = currentPrice - trailStep;
      if(newSL > sl && newSL > openPrice)
         Trade.PositionModify(sym, newSL, tp);
     }
   else
     {
      if(openPrice - currentPrice < trailStart) return;
      double newSL = currentPrice + trailStep;
      if((sl == 0 || newSL < sl) && newSL < openPrice)
         Trade.PositionModify(sym, newSL, tp);
     }
  }
//+------------------------------------------------------------------+
void ApplyBreakEven(string sym, int magic)
  {
   if(!PositionSelect(sym)) return;
   if(PositionGetInteger(POSITION_MAGIC) != magic) return;

   double sl = PositionGetDouble(POSITION_SL);
   double tp = PositionGetDouble(POSITION_TP);
   double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
   int dir = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? 1 : -1;

   double bid = SymbolInfoDouble(sym, SYMBOL_BID);
   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   double currentPrice = (dir == 1) ? bid : ask;
   double point = GetPoint(sym);
   double beLevel = InpBreakEvenPips * point * 10;

   Trade.SetExpertMagicNumber(magic);

   if(dir == 1)
     {
      if(currentPrice - openPrice >= beLevel && sl < openPrice)
         Trade.PositionModify(sym, openPrice, tp);
     }
   else
     {
      if(openPrice - currentPrice >= beLevel && sl > openPrice)
         Trade.PositionModify(sym, openPrice, tp);
     }
  }
//+------------------------------------------------------------------+`,
    ZoyaEdge_History_Sync_EA_mq5: `//+------------------------------------------------------------------+
//|                                    ZoyaEdge_History_Sync_EA.mq5 |
//|                        ZoyaEdge Tracker                          |
//+------------------------------------------------------------------+
#property copyright "ZoyaFX Tracker"
#property link      "https://zoyafx.com"
#property version   "1.00"
#property strict

//--- INPUTS
input string   InpSyncKey     = "VOTRE_CLE_ICI";   // Clé de tracking ZoyaEdge
input int      InpSyncTimer   = 30;                // Intervalle d'envoi en secondes

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   EventSetTimer(InpSyncTimer);
   Print("ZoyaEdge Tracker Initialisé - Synchronisation de l'historique prête.");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   // Synchronisation en arrière-plan :
   // 1. Parcourir HistoryDealsTotal() 
   // 2. Préparer payload JSON
   // 3. WebRequest vers votre backend
}`,
    ZoyaEdgePackPro_tpl: `<chart>
id=0
symbol=EURUSD
description=ZoyaEdge_Pack_Pro_v2_Multi
period_type=0
period_size=1
digits=5
scale_fix=0
scale_fixed_min=0.00000
scale_fixed_max=0.00000
volume_visible=0
chart_shift=0
chart_scale=4
chart_fixed_pos=0
chart_autoscroll=1
chart_color_background=0x1C1C1C
chart_color_foreground=0xD0D0D0
chart_color_candle_up=0x00FF00
chart_color_candle_down=0xFF0000
chart_color_bar_up=0x00FF00
chart_color_bar_down=0xFF0000
chart_color_bid=0xFF0000
chart_color_ask=0x0000FF
chart_color_line=0xD0D0D0
chart_color_volumes=0x00FF00
chart_color_grid=0x505050
indicator_1=ZoyaEdgePackPro_Indicator
indicator_1_period=Current
indicator_1_inputs=InpUseOB=true;InpUseFVG=true;InpTrendFilter=true;InpShowBOSLines=true;InpShowBOSSignals=false;InpUseMTF=true;InpMTF_TF1=PERIOD_M15;InpMTF_TF2=PERIOD_H1;InpMTF_RequireAll=false;InpSwingLR=5;InpMinFVGPips=5;InpMaxZoneBars=200;InpAlertOnSignal=false
</chart>`
  };
