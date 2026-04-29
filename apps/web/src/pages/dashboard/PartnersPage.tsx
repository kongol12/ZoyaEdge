import React from 'react';
import { motion } from 'motion/react';
import { Handshake, ExternalLink, Globe, Shield, Zap, TrendingUp } from 'lucide-react';

interface Partner {
  name: string;
  category: string;
  description: string;
  logo: string;
  website: string;
  affiliateLink?: string;
  features: string[];
  tag: string;
}

const partners: Partner[] = [
  {
    name: 'Araka Pay',
    category: 'Paiements & Infrastructure',
    description: 'Leader des solutions de paiement mobile en Afrique Centrale, Araka Pay sécurise toutes vos transactions sur ZoyaEdge.',
    logo: 'https://api.arakapay.com/assets/img/logo.png', // Placeholder if real one unknown
    website: 'https://arakapay.com',
    features: ['Dépôts Instantanés', 'Sécurité Bancaire', 'Support 24/7'],
    tag: 'Partenaire Premium'
  },
  {
    name: 'ZoyaPay',
    category: 'Solutions de Paiement',
    description: 'La branche fintech du groupe Zoya, offrant des solutions de paiement intégrées et optimisées pour le trading haute performance.',
    logo: '', 
    website: '#',
    features: ['Intégration Directe', 'Frais Réduits', 'Support Local'],
    tag: 'Groupe Zoya'
  },
  {
    name: 'Deriv',
    category: 'Courtier Partenaire',
    description: 'Courtier de confiance spécialisé dans les indices synthétiques et les marchés mondiaux, parfaitement intégré à ZoyaEdge.',
    logo: 'https://deriv.com/static/32de1e90141f6c4f039e102657e3f848/7e9c5/deriv-logo-black.png', 
    website: 'https://deriv.com',
    affiliateLink: 'https://deriv.partners/rx?sidc=EC98FD16-0048-4E94-A61D-4DAC269F1044&utm_campaign=dynamicworks&utm_medium=affiliate&utm_source=CU26059',
    features: ['Indices Synthétiques', 'Levier Avancé', 'Dépôts Mobiles'],
    tag: 'Courtier'
  },
  {
    name: 'TradingView',
    category: 'Analyse Technique',
    description: 'La plateforme de graphiques la plus avancée au monde, utilisée par ZoyaEdge pour fournir des données de marché précises.',
    logo: 'https://www.tradingview.com/static/images/free-widgets/tradingview-logo.svg',
    website: 'https://fr.tradingview.com',
    features: ['Graphiques Avancés', 'Données Temps Réel', 'Indicateurs'],
    tag: 'Technologie'
  },
  {
    name: 'MetaQuotes',
    category: 'Exécution Trading',
    description: 'Développeur des plateformes MetaTrader 4 et 5, au cœur de notre écosystème de journalisation de transactions.',
    logo: 'https://www.metatrader5.com/source/images/logo.png',
    website: 'https://www.metaquotes.net',
    features: ['Exécution Rapide', 'Multi-Plateforme', 'Fiabilité'],
    tag: 'Infrastructure'
  }
];

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-12">
      {/* Header section */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 pt-10 md:pt-16 pb-20 md:pb-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none hidden md:block">
          <Handshake size={300} />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 md:gap-3 mb-4"
          >
            <div className="p-1.5 md:p-2 bg-zoya-red/10 rounded-lg md:rounded-xl">
              <Handshake className="text-zoya-red" size={20} />
            </div>
            <span className="text-[10px] md:text-xs font-black text-zoya-red uppercase tracking-widest">Écosystème Zoya</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 10 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white leading-tight md:leading-none mb-4 md:mb-6"
          >
            Nos Partenaires <br className="hidden md:block"/>
            <span className="text-gray-400">Stratégiques</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl text-base md:text-lg text-gray-500 font-medium leading-relaxed"
          >
            ZoyaEdge collabore avec les leaders de l'industrie pour vous offrir une expérience de trading et de gestion de performance sans compromis.
          </motion.p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 -mt-10 md:-mt-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {partners.map((partner, index) => (
            <motion.div
              key={partner.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 * index }}
              className="group bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl p-6 md:p-8 border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-none hover:border-zoya-red transition-all duration-300 relative overflow-hidden"
            >
              {/* Badge */}
              <div className="absolute top-0 right-0 mt-4 md:mt-6 mr-4 md:mr-6">
                <span className="px-2 md:px-3 py-1 bg-gray-50 dark:bg-gray-900 text-[8px] md:text-[10px] font-black text-gray-400 group-hover:text-zoya-red group-hover:bg-zoya-red/10 rounded-full uppercase tracking-widest transition-colors">
                  {partner.tag}
                </span>
              </div>

              <div className="flex flex-col h-full">
                <div className="mb-6 md:mb-8">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gray-50 dark:bg-gray-900 mb-4 md:mb-6 flex items-center justify-center overflow-hidden border border-gray-100 dark:border-gray-700 p-2">
                    {partner.logo ? (
                       <img src={partner.logo} alt={partner.name} className="max-w-full max-h-full object-contain grayscale group-hover:grayscale-0 transition-all duration-500" referrerPolicy="no-referrer" />
                    ) : (
                       <Zap className="text-gray-300 group-hover:text-zoya-red transition-colors" size={24} />
                    )}
                  </div>
                  <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white mb-1 md:mb-2">{partner.name}</h3>
                  <p className="text-[10px] md:text-xs font-black text-zoya-red uppercase tracking-widest mb-3 md:mb-4">{partner.category}</p>
                </div>

                <p className="text-sm text-gray-500 font-medium mb-6 md:mb-8 leading-relaxed">
                  {partner.description}
                </p>

                <div className="space-y-2 md:space-y-3 mb-6 md:mb-8">
                  {partner.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-3 text-xs md:text-sm text-gray-600 dark:text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-zoya-red shadow-sm shadow-zoya-red/50" />
                      <span className="font-bold">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto space-y-2 md:space-y-3">
                  {partner.affiliateLink && (
                    <a 
                      href={partner.affiliateLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 md:py-4 bg-zoya-red text-white rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:scale-[1.02] transition-all active:scale-95 shadow-lg shadow-zoya-red/20"
                    >
                      Créer un compte <TrendingUp size={14} />
                    </a>
                  )}
                  <a 
                    href={partner.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 w-full py-3 md:py-4 ${partner.affiliateLink ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'bg-gray-900 dark:bg-gray-700 text-white'} rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95`}
                  >
                    {partner.affiliateLink ? 'En savoir plus' : 'Visiter le site'} <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Invitation section */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 md:mt-20 p-8 md:p-12 bg-gray-900 dark:bg-white rounded-[32px] md:rounded-[40px] relative overflow-hidden text-center"
        >
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none hidden md:block">
            <Globe className="absolute -top-20 -left-20 w-96 h-96 text-white dark:text-gray-900" />
          </div>
          
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-4xl font-black text-white dark:text-gray-900 mb-4 md:mb-6">Vous souhaitez devenir partenaire ?</h2>
            <p className="text-gray-400 dark:text-gray-500 font-medium text-sm md:text-lg mb-8 md:mb-10">
              Rejoignez notre réseau et contribuez à façonner l'avenir du trading en Afrique. Nous sommes toujours à la recherche de collaborations innovantes.
            </p>
            <button className="w-full md:w-auto px-10 py-4 md:py-5 bg-zoya-red text-white rounded-full font-black text-[10px] md:text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-zoya-red/20 outline outline-4 outline-zoya-red/10">
              Contactez notre équipe
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
