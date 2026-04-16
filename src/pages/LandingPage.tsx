import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { 
  TrendingUp, 
  Brain, 
  Shield, 
  Zap, 
  BarChart3, 
  BookOpen, 
  Globe, 
  Menu, 
  X, 
  ChevronRight, 
  Star,
  CheckCircle2,
  ArrowRight,
  LayoutDashboard,
  Smartphone,
  Cpu,
  Lock,
  Target,
  LineChart,
  Activity,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // SEO Meta Tags
  useEffect(() => {
    document.title = "ZoyaEdge | Intelligence Comportementale & Performance Trading";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Découvrez ZoyaEdge, la plateforme d\'analyse de trading qui transforme vos données en discipline. Journal intelligent, détection de biais par IA et optimisation de l\'Alpha.');
    }
  }, []);

  const navLinks = [
    { name: 'L\'Écosystème', href: '#features' },
    { name: 'Intelligence IA', href: '#ai-coach' },
    { name: 'Solutions', href: '#pricing' },
    { name: 'FAQ', href: '#faq' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 overflow-x-hidden selection:bg-zoya-red selection:text-white">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl shadow-sm py-4' : 'bg-transparent py-8'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-zoya-red rounded-xl flex items-center justify-center shadow-lg shadow-zoya-red/20 group-hover:rotate-6 transition-all duration-300">
              <TrendingUp className="text-white" size={22} />
            </div>
            <span className="text-xl font-poppins font-black text-gray-900 dark:text-white tracking-tight">
              Zoya<span className="text-zoya-red">Edge</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.href}
                className="text-[13px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 hover:text-zoya-red dark:hover:text-zoya-red transition-colors"
              >
                {link.name}
              </a>
            ))}
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 mx-2" />
            {user ? (
              <div className="flex items-center gap-6">
                <Link to="/" className="zoya-button-primary py-2.5 px-6 text-xs uppercase tracking-widest">
                  Console
                </Link>
                <button 
                  onClick={() => logout()}
                  className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-zoya-red transition-colors"
                >
                  Sortir
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <Link to="/auth" className="text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white hover:text-zoya-red transition-colors">
                  Login
                </Link>
                <Link to="/auth" className="zoya-button-primary py-2.5 px-6 text-xs uppercase tracking-widest">
                  Accès Prioritaire
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900 rounded-xl transition-colors"
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] md:hidden"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-white dark:bg-gray-900 z-[70] p-10 shadow-2xl md:hidden"
            >
              <div className="flex items-center justify-between mb-16">
                <span className="text-2xl font-poppins font-black text-gray-900 dark:text-white">
                  Zoya<span className="text-zoya-red">Edge</span>
                </span>
                <button onClick={() => setIsMenuOpen(false)} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-500">
                  <X size={20} />
                </button>
              </div>
              <div className="flex flex-col gap-8">
                {navLinks.map((link) => (
                  <a 
                    key={link.name} 
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="text-2xl font-black text-gray-900 dark:text-white hover:text-zoya-red transition-colors"
                  >
                    {link.name}
                  </a>
                ))}
                <div className="h-px bg-gray-100 dark:bg-gray-800 my-4" />
                {user ? (
                  <>
                    <Link to="/" className="zoya-button-primary text-center py-4">
                      Accéder à la Console
                    </Link>
                    <button 
                      onClick={() => {
                        logout();
                        setIsMenuOpen(false);
                      }}
                      className="text-lg font-bold text-gray-400 text-left px-4"
                    >
                      Déconnexion
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/auth" className="text-2xl font-black text-gray-900 dark:text-white">
                      Connexion
                    </Link>
                    <Link to="/auth" className="zoya-button-primary text-center py-4">
                      Ouvrir un Compte
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative pt-40 pb-24 md:pt-56 md:pb-40 overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-zoya-red/5 blur-[140px] rounded-full" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/5 blur-[140px] rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/grid-me.png')] opacity-[0.03] dark:opacity-[0.05]" />
        </div>

        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 text-[11px] uppercase tracking-[0.2em] font-black mb-10"
            >
              <Activity size={14} className="text-zoya-red animate-pulse" />
              <span>L'Intelligence au service de l'Alpha — par ZoyaFX</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-6xl lg:text-7xl font-poppins font-black text-gray-900 dark:text-white mb-10 leading-[1.05] tracking-tight"
            >
              Ne tradez plus contre vos <br />
              <span className="text-zoya-red">propres émotions.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-gray-500 dark:text-gray-400 mb-14 max-w-3xl mx-auto leading-relaxed font-medium"
            >
              ZoyaEdge est la première plateforme d'intelligence comportementale conçue pour les traders institutionnels et particuliers. Nous transformons votre historique de trading en un avantage compétitif grâce à l'analyse prédictive des biais cognitifs.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6"
            >
              <Link to="/auth" className="zoya-button-primary w-full sm:w-auto px-12 py-5 text-sm uppercase tracking-widest flex items-center justify-center gap-3 group">
                Démarrer l'audit gratuit <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#features" className="w-full sm:w-auto px-12 py-5 text-sm uppercase tracking-widest font-black text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900 rounded-2xl transition-all border border-gray-200 dark:border-gray-800">
                Explorer l'Écosystème
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="mt-24 relative group"
            >
              <div className="absolute -inset-4 bg-gradient-to-b from-zoya-red/20 to-transparent rounded-[3rem] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-200 dark:border-gray-800 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-white/10 dark:from-black/10 to-transparent pointer-events-none" />
                <img 
                  src="https://picsum.photos/seed/zoya_pro_dashboard/1600/900" 
                  alt="ZoyaEdge Institutional Interface" 
                  className="w-full h-auto object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="py-24 border-y border-gray-100 dark:border-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-16">
            {[
              {
                icon: <Target className="text-zoya-red" />,
                title: "Précision Analytique",
                desc: "Identifiez vos setups les plus rentables avec une précision mathématique. Arrêtez de deviner, commencez à savoir."
              },
              {
                icon: <Shield className="text-blue-500" />,
                title: "Discipline de Fer",
                desc: "Notre moteur d'IA agit comme un garde-fou émotionnel, vous alertant dès que vous déviez de votre plan de trading."
              },
              {
                icon: <Award className="text-emerald-500" />,
                title: "Optimisation de l'Alpha",
                desc: "Maximisez vos gains sur vos meilleures opportunités tout en coupant drastiquement vos pertes comportementales."
              }
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center mb-8 border border-gray-100 dark:border-gray-800">
                  {item.icon}
                </div>
                <h3 className="text-xl font-poppins font-black mb-4 text-gray-900 dark:text-white">{item.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-poppins font-black text-gray-900 dark:text-white mb-6 leading-tight">
                L'infrastructure ultime <br /> pour le <span className="text-zoya-red">Trading Moderne.</span>
              </h2>
              <p className="text-lg text-gray-500 dark:text-gray-400 font-medium">
                Nous avons condensé des années d'expertise en finance quantitative dans une interface intuitive et surpuissante.
              </p>
            </div>
            <Link to="/auth" className="flex items-center gap-2 text-zoya-red font-black uppercase tracking-widest text-xs group">
              Découvrir tous les modules <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <LayoutDashboard />,
                color: "text-zoya-red",
                title: "Analytics Institutionnels",
                desc: "Accédez à des métriques de performance que seuls les hedge funds utilisaient jusqu'à présent : Ratio de Sharpe, Sortino, et Expectancy avancée."
              },
              {
                icon: <Brain />,
                color: "text-blue-500",
                title: "Moteur de Biais Cognitifs",
                desc: "Notre IA identifie le FOMO, le Revenge Trading et l'Overconfidence en analysant vos patterns de saisie et vos résultats."
              },
              {
                icon: <Smartphone />,
                color: "text-emerald-500",
                title: "Synchronisation Temps Réel",
                desc: "Connectez vos comptes MT4, MT5 ou TradeLocker. Vos trades sont importés instantanément via notre infrastructure cloud sécurisée."
              },
              {
                icon: <BookOpen />,
                color: "text-purple-500",
                title: "Journal de Bord Dynamique",
                desc: "Documentez votre état psychologique avant et après chaque session. L'IA corrèle votre humeur avec votre rentabilité."
              },
              {
                icon: <Cpu />,
                color: "text-orange-500",
                title: "Stratégie Builder",
                desc: "Définissez vos règles d'entrée et de sortie. ZoyaEdge vérifie si vous respectez votre propre système à chaque trade."
              },
              {
                icon: <Lock />,
                color: "text-rose-500",
                title: "Confidentialité Totale",
                desc: "Vos données sont votre propriété exclusive. Cryptage AES-256 et conformité RGPD stricte pour une sécurité sans compromis."
              }
            ].map((feature, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -8 }}
                className="zoya-card p-10 group hover:border-zoya-red/20 transition-all duration-500"
              >
                <div className={cn("w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500", feature.color)}>
                  {React.cloneElement(feature.icon as React.ReactElement, { size: 24 })}
                </div>
                <h3 className="text-xl font-poppins font-black text-gray-900 dark:text-white mb-5">{feature.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm font-medium">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Coach - Psychological Focus */}
      <section id="ai-coach" className="py-32 bg-gray-950 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-zoya-red/10 blur-[160px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-1/2 h-full bg-blue-600/5 blur-[160px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-24 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-zoya-red/10 border border-zoya-red/20 text-zoya-red text-[10px] uppercase tracking-[0.2em] font-black mb-10">
                <Brain size={14} />
                <span>Intelligence Artificielle de Pointe</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-poppins font-black mb-10 leading-[1.15] tracking-tight">
                L'IA qui comprend <br />
                <span className="text-zoya-red">votre psychologie.</span>
              </h2>
              <p className="text-lg text-gray-400 mb-12 leading-relaxed font-medium">
                Le trading est à 90% psychologique. Zoya AI n'analyse pas seulement vos chiffres, elle décode vos comportements. Elle apprend de vos erreurs passées pour vous empêcher de les répéter, agissant comme un mentor infatigable et impartial.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-8 mb-14">
                {[
                  { title: "Biais de Récence", desc: "Évitez de sur-réagir à vos derniers trades." },
                  { title: "Gestion du Stress", desc: "Identifiez quand vos émotions prennent le dessus." },
                  { title: "Discipline de Session", desc: "Optimisez vos heures de présence sur les marchés." },
                  { title: "Risk Management", desc: "Alertes automatiques sur les déviances de levier." }
                ].map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center gap-3 text-zoya-red">
                      <CheckCircle2 size={18} />
                      <span className="font-black text-xs uppercase tracking-widest">{item.title}</span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>

              <Link to="/auth" className="zoya-button-primary px-12 py-5 text-sm uppercase tracking-widest inline-flex items-center gap-3">
                Activer mon Coach IA <ArrowRight size={18} />
              </Link>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
              whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="relative"
            >
              <div className="absolute -inset-10 bg-zoya-red/20 rounded-full blur-[100px] animate-pulse" />
              <div className="relative bg-gray-900/80 backdrop-blur-xl border border-gray-800 p-10 rounded-[3rem] shadow-2xl">
                <div className="flex items-center justify-between mb-12">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-zoya-red flex items-center justify-center shadow-lg shadow-zoya-red/20">
                      <Brain className="text-white" size={28} />
                    </div>
                    <div>
                      <div className="font-poppins font-black text-lg">Zoya Intelligence</div>
                      <div className="text-[10px] text-zoya-red font-black uppercase tracking-[0.2em]">Analyse Comportementale Active</div>
                    </div>
                  </div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                </div>
                
                <div className="space-y-6">
                  <div className="p-6 bg-gray-800/40 rounded-3xl border border-gray-700/50">
                    <p className="text-sm text-gray-300 leading-relaxed italic">
                      "Attention : Votre fréquence de trading a augmenté de 40% suite à votre dernière perte. Vous entrez dans une phase de 'Revenge Trading'. Je vous suggère de fermer vos graphiques pour les 4 prochaines heures."
                    </p>
                  </div>
                  <div className="p-6 bg-zoya-red/5 rounded-3xl border border-zoya-red/20 flex items-start gap-4">
                    <Zap className="text-zoya-red mt-1 shrink-0" size={20} />
                    <div>
                      <p className="text-sm font-black text-zoya-red uppercase tracking-widest mb-1">Recommandation Immédiate</p>
                      <p className="text-sm text-gray-300">Verrouillage temporaire de la saisie de trades activé.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <span>Discipline</span>
                        <span className="text-emerald-500">92%</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 w-[92%]" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <span>Risque</span>
                        <span className="text-amber-500">45%</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 w-[45%]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-5xl font-poppins font-black text-gray-900 dark:text-white mb-8">
              Investissez dans votre <span className="text-zoya-red">Edge.</span>
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto font-medium">
              Choisissez le plan qui correspond à votre volume de trading et à vos ambitions de croissance.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-10 items-stretch">
            {[
              {
                name: "Discovery",
                price: "0€",
                desc: "Pour poser les bases de votre journalisation.",
                features: ["Journaling manuel illimité", "Statistiques de base", "1 compte de trading", "Insights IA limités"],
                button: "Commencer Gratuitement",
                popular: false
              },
              {
                name: "Professional",
                price: "29€",
                period: "/mois",
                desc: "L'outil standard pour les traders actifs.",
                features: ["Sync MT4/MT5/TradeLocker", "AI Coach Standard", "Analyses de biais cognitifs", "Rapports de performance PDF", "Support prioritaire 24/7"],
                button: "Démarrer l'essai Pro",
                popular: true
              },
              {
                name: "Institutional",
                price: "59€",
                period: "/mois",
                desc: "Pour ceux qui exigent l'excellence absolue.",
                features: ["AI Coach Illimité & Prédictif", "Builder de stratégies avancé", "Alertes multi-canaux", "Accès Academy Premium", "Consultation mensuelle IA"],
                button: "Passer en Institutional",
                popular: false
              }
            ].map((plan, idx) => (
              <div 
                key={idx}
                className={`flex flex-col zoya-card p-12 relative transition-all duration-500 ${plan.popular ? 'border-zoya-red ring-4 ring-zoya-red/5 scale-105 z-10 shadow-2xl' : 'hover:border-gray-300 dark:hover:border-gray-700'}`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zoya-red text-white text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-[0.2em] shadow-lg shadow-zoya-red/20">
                    Recommandé
                  </div>
                )}
                <div className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-6">{plan.name}</div>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-5xl font-poppins font-black text-gray-900 dark:text-white">{plan.price}</span>
                  <span className="text-gray-500 font-bold">{plan.period}</span>
                </div>
                <p className="text-sm text-gray-500 mb-10 font-medium leading-relaxed">{plan.desc}</p>
                
                <div className="space-y-5 mb-12 flex-1">
                  {plan.features.map((feat, fidx) => (
                    <div key={fidx} className="flex items-start gap-4 text-sm font-bold text-gray-700 dark:text-gray-300">
                      <CheckCircle2 size={18} className="text-zoya-red shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
                
                <button className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 ${
                  plan.popular ? 'zoya-button-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}>
                  {plan.button}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-40 bg-gray-50 dark:bg-gray-900/20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-poppins font-black mb-6">Questions Stratégiques</h2>
            <p className="text-gray-500 font-medium">Tout ce que vous devez savoir pour intégrer ZoyaEdge à votre routine.</p>
          </div>
          <div className="space-y-6">
            {[
              { q: "Comment la synchronisation broker fonctionne-t-elle ?", a: "Nous utilisons des protocoles sécurisés pour lire votre historique de trading via des Webhooks ou des API. Nous n'avons jamais accès à vos fonds, uniquement à la lecture de vos données de performance." },
              { q: "L'IA peut-elle vraiment améliorer mon winrate ?", a: "L'IA ne prédit pas le marché, elle prédit vos erreurs. En réduisant les pertes causées par des biais psychologiques, votre winrate et votre profit factor s'améliorent mécaniquement." },
              { q: "Quelles plateformes sont supportées ?", a: "ZoyaEdge est compatible nativement avec MetaTrader 4, MetaTrader 5 et TradeLocker. Pour les autres plateformes, un import CSV universel est disponible." },
              { q: "Mes données sont-elles partagées ?", a: "Jamais. Vos données sont cryptées et utilisées uniquement pour générer vos analyses personnelles. Nous respectons les standards de sécurité les plus stricts de l'industrie financière." }
            ].map((item, idx) => (
              <details key={idx} className="group zoya-card p-8 cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-all">
                <summary className="flex items-center justify-between font-black text-lg list-none text-gray-900 dark:text-white">
                  {item.q}
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-open:rotate-180 transition-transform duration-300">
                    <ChevronRight size={18} />
                  </div>
                </summary>
                <div className="overflow-hidden">
                  <p className="mt-6 text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                    {item.a}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA - High Conversion */}
      <section className="py-40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-zoya-red rounded-[4rem] p-16 md:p-32 text-center text-white relative overflow-hidden shadow-[0_48px_96px_-24px_rgba(255,68,79,0.4)]">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/grid-me.png')] opacity-10" />
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 blur-[100px] rounded-full" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-black/10 blur-[100px] rounded-full" />
            
            <div className="relative z-10">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-4xl md:text-7xl font-poppins font-black mb-10 leading-tight tracking-tight"
              >
                Le futur du trading <br /> est discipliné.
              </motion.h2>
              <p className="text-xl text-white/80 mb-16 max-w-2xl mx-auto font-medium leading-relaxed">
                Rejoignez l'élite des traders qui ne laissent plus rien au hasard. Votre avantage compétitif commence ici.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <Link to="/auth" className="bg-white text-zoya-red hover:bg-gray-100 font-poppins font-black px-14 py-6 rounded-2xl text-sm uppercase tracking-[0.2em] transition-all shadow-2xl active:scale-95">
                  Ouvrir mon accès pro
                </Link>
              </div>
              <div className="mt-12 flex items-center justify-center gap-8 text-white/60">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Sans engagement</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Setup en 2 minutes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 border-t border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-16 mb-24">
            <div className="col-span-1 md:col-span-2">
              <Link to="/" className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-zoya-red rounded-xl flex items-center justify-center">
                  <TrendingUp className="text-white" size={20} />
                </div>
                <span className="text-2xl font-poppins font-black text-gray-900 dark:text-white tracking-tight">
                  Zoya<span className="text-zoya-red">Edge</span>
                </span>
              </Link>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-xs font-medium">
                La plateforme de référence pour l'analyse comportementale et l'optimisation de la performance en trading. Propulsé par ZoyaFX.
              </p>
              <div className="flex items-center gap-6 mt-10">
                <a href="#" className="text-gray-400 hover:text-zoya-red transition-colors"><Globe size={20} /></a>
                <a href="#" className="text-gray-400 hover:text-zoya-red transition-colors"><Smartphone size={20} /></a>
                <a href="#" className="text-gray-400 hover:text-zoya-red transition-colors"><Zap size={20} /></a>
              </div>
            </div>
            
            <div>
              <h4 className="font-black text-xs uppercase tracking-[0.2em] mb-8 text-gray-900 dark:text-white">Écosystème</h4>
              <ul className="space-y-5 text-sm font-bold text-gray-500 dark:text-gray-400">
                <li><a href="#features" className="hover:text-zoya-red transition-colors">Fonctionnalités</a></li>
                <li><a href="#ai-coach" className="hover:text-zoya-red transition-colors">Intelligence IA</a></li>
                <li><a href="#pricing" className="hover:text-zoya-red transition-colors">Tarification</a></li>
                <li><Link to="/academy" className="hover:text-zoya-red transition-colors">Zoya Academy</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-black text-xs uppercase tracking-[0.2em] mb-8 text-gray-900 dark:text-white">Ressources</h4>
              <ul className="space-y-5 text-sm font-bold text-gray-500 dark:text-gray-400">
                <li><Link to="/faq" className="hover:text-zoya-red transition-colors">Centre d'aide</Link></li>
                <li><Link to="/support" className="hover:text-zoya-red transition-colors">Contact Pro</Link></li>
                <li><a href="#" className="hover:text-zoya-red transition-colors">Documentation API</a></li>
                <li><a href="#" className="hover:text-zoya-red transition-colors">Blog Performance</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-black text-xs uppercase tracking-[0.2em] mb-8 text-gray-900 dark:text-white">Légal</h4>
              <ul className="space-y-5 text-sm font-bold text-gray-500 dark:text-gray-400">
                <li><a href="#" className="hover:text-zoya-red transition-colors">Confidentialité</a></li>
                <li><a href="#" className="hover:text-zoya-red transition-colors">Conditions (CGU)</a></li>
                <li><a href="#" className="hover:text-zoya-red transition-colors">Gestion des Risques</a></li>
                <li><a href="#" className="hover:text-zoya-red transition-colors">Cookies</a></li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-12 border-t border-gray-100 dark:border-gray-900">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">
              © 2026 ZoyaEdge by ZoyaFX. Tous droits réservés.
            </div>
            <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <span>Paris</span>
              <span>London</span>
              <span>New York</span>
              <span>Dubai</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
