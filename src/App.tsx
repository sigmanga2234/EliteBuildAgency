/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { Search, Instagram, Layout, MessageSquare, CheckCircle2, Users, Bell, LogIn } from "lucide-react";
import { useEffect, useState, ReactNode, FormEvent } from "react";
import { db, auth } from "./firebase";
import { collection, addDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";

const Reveal = ({ children, className = "" }: { children: ReactNode; className?: string; key?: any }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className={`w-full ${className}`}
    >
      {children}
    </motion.div>
  );
};

const Notification = ({ show, message, onClose }: { show: boolean, message: string, onClose: () => void }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ y: -100, opacity: 0, x: "-50%" }}
        animate={{ y: 20, opacity: 1, x: "-50%" }}
        exit={{ y: -100, opacity: 0, x: "-50%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed top-0 left-1/2 z-[2000] w-[90%] max-w-[400px]"
      >
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-4 rounded-[24px] shadow-2xl flex items-center gap-4">
          <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-white shadow-lg shadow-accent/20">
            <Bell size={20} />
          </div>
          <div className="flex-1">
            <h4 className="text-white font-semibold text-sm">Success</h4>
            <p className="text-text-secondary text-xs">{message}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-text-secondary hover:text-white transition-colors p-1"
          >
            <Users size={16} className="rotate-45" /> {/* Using Users as a close icon for simplicity or just an X */}
          </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

const ServiceCard = ({ icon: Icon, title, description, delay = 0 }: { icon: any, title: string, description: string, delay?: number }) => (
  <Reveal className="group relative bg-card-bg backdrop-blur-2xl border border-glass-border p-10 rounded-[36px] hover:border-white/30 hover:bg-white/5 transition-all overflow-hidden h-full">
    {/* Liquid Blur Effect */}
    <div className="absolute -top-20 -right-20 w-40 h-40 bg-accent/10 blur-[60px] rounded-full group-hover:bg-accent/20 transition-all duration-700" />
    <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-white/5 blur-[60px] rounded-full group-hover:bg-white/10 transition-all duration-700" />
    
    <div className="relative z-10">
      <div className="w-12 h-12 bg-white/8 rounded-xl flex items-center justify-center mb-7 text-white group-hover:scale-110 transition-transform duration-500">
        <Icon size={24} />
      </div>
      <h3 className="text-[1.6rem] mb-4.5 tracking-[-0.02em] font-semibold">{title}</h3>
      <p className="text-text-secondary text-[1.05rem] leading-relaxed">{description}</p>
    </div>
  </Reveal>
);

export default function App() {
  const [scrolled, setScrolled] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [googleTokens, setGoogleTokens] = useState<any>(null);
  const [showAdminTrigger, setShowAdminTrigger] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email === "ballssigma2234@gmail.com") {
        setIsAdmin(true);
        // Load tokens from Firestore if they exist
        const configDoc = await getDoc(doc(db, "config", "admin"));
        if (configDoc.exists()) {
          setGoogleTokens(configDoc.data().googleTokens);
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const tokens = event.data.tokens;
        setGoogleTokens(tokens);
        // Save tokens to Firestore
        if (auth.currentUser) {
          setDoc(doc(db, "config", "admin"), { googleTokens: tokens }, { merge: true });
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleAdminLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleConnectCalendar = async () => {
    try {
      const response = await fetch('/api/auth/url');
      const { url } = await response.json();
      window.open(url, 'google_auth', 'width=600,height=700');
    } catch (error) {
      console.error("Failed to get auth URL:", error);
    }
  };

  const handleBooking = async (e: FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const bookingData = {
      fullName: formData.get("fullName") as string,
      email: formData.get("email") as string,
      serviceType: formData.get("serviceType") as string,
      preferredDate: formData.get("preferredDate") as string,
      socialPlatform: formData.get("socialPlatform") as string,
      socialUsername: formData.get("socialUsername") as string,
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Save to Firestore
      await addDoc(collection(db, "bookings"), bookingData);

      // 2. Add to Google Calendar if tokens exist
      if (googleTokens) {
        await fetch('/api/calendar/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokens: googleTokens, booking: bookingData })
        });
      }

      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error("Booking failed:", error);
    }
  };

  return (
    <div className="min-h-screen selection:bg-accent selection:text-white">
      <Notification 
        show={showNotification} 
        message="Call booked on the specified date" 
        onClose={() => setShowNotification(false)} 
      />
      {/* Liquid Background */}
      <div className="liquid-bg">
        <div className="blob top-[-10%] left-[-5%]" />
        <div 
          className="blob bottom-[-15%] right-[-5%] bg-[radial-gradient(circle,_rgba(255,255,255,0.05)_0%,_transparent_70%)]" 
          style={{ animationDelay: "-8s" }} 
        />
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 w-full h-[54px] z-[1000] flex justify-center transition-all duration-300 ${scrolled ? 'bg-black/85 backdrop-blur-2xl border-b border-glass-border' : 'bg-transparent'}`}>
        <div className="w-full max-w-[1100px] flex justify-between items-center px-6">
          <div className="flex items-center gap-4">
            <a href="#" className="text-white font-bold text-[1rem] tracking-tighter hover:opacity-80 transition-opacity">
              Elite Build Agency
            </a>
          </div>
          <div className="flex items-center gap-8">
            <a href="#services" className="text-text-secondary text-[0.8rem] hover:text-white transition-colors">Services</a>
            <a href="#about" className="text-text-secondary text-[0.8rem] hover:text-white transition-colors">About</a>
            <a href="#contact" className="text-text-secondary text-[0.8rem] hover:text-white transition-colors">Contact</a>
            <a href="#book" className="text-white text-[0.8rem] font-medium hover:opacity-80 transition-opacity">Book Strategy Call</a>
            <a 
              href="https://www.instagram.com/elitebuildagency/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-white transition-colors"
              title="Follow us on Instagram"
            >
              <Instagram size={18} />
            </a>
            {showAdminTrigger && (
              isAdmin ? (
                <button 
                  onClick={handleConnectCalendar}
                  className={`text-[0.7rem] px-3 py-1 rounded-full border transition-all ${googleTokens ? 'border-green-500 text-green-500' : 'border-accent text-accent'}`}
                >
                  {googleTokens ? 'Calendar Connected' : 'Connect Calendar'}
                </button>
              ) : (
                <button onClick={handleAdminLogin} className="text-text-secondary hover:text-white transition-colors">
                  <LogIn size={16} />
                </button>
              )
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="h-screen flex flex-col justify-center items-center text-center px-6">
        <Reveal>
          <span className="text-accent font-semibold text-[0.85rem] tracking-[1.5px] uppercase mb-4 block">Premier Growth Agency</span>
        </Reveal>
        <Reveal>
          <h1 className="text-[clamp(2.8rem,10vw,6rem)] font-extrabold tracking-[-0.06em] leading-[0.95] mb-7 text-white">
            Next-Gen <span className="text-accent">Lead</span> <br /> Generation.
          </h1>
        </Reveal>
        <Reveal>
          <p className="text-[clamp(1.1rem,3vw,1.4rem)] text-text-secondary max-w-[600px] mx-auto mb-12 font-normal">
            We combine high-performance Google & Meta advertising with conversion-first design to scale local service businesses.
          </p>
        </Reveal>
        <Reveal>
          <a href="#book" className="bg-accent text-white px-10 py-4.5 rounded-full font-semibold text-base transition-all hover:scale-[1.04] hover:shadow-[0_0_30px_rgba(208,0,0,0.25)]">
            Scale Your Revenue
          </a>
        </Reveal>

        {/* Horizontal Reviews */}
        <Reveal className="w-full mt-16 overflow-hidden relative">
          <div className="absolute left-0 top-0 w-20 h-full bg-gradient-to-r from-black to-transparent z-10" />
          <div className="absolute right-0 top-0 w-20 h-full bg-gradient-to-l from-black to-transparent z-10" />
          <motion.div 
            className="flex gap-8 whitespace-nowrap"
            animate={{ x: [0, -1000] }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          >
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-8">
                {[
                  { text: "Elite Build transformed our lead flow. Highly recommend!", author: "John D., Roofer" },
                  { text: "The best ROI we've ever seen from Meta ads.", author: "Sarah L., HVAC" },
                  { text: "Professional, fast, and results-driven. 5 stars.", author: "Mike R., Contractor" },
                  { text: "Our website finally converts. Game changer.", author: "David K., Painter" }
                ].map((review, idx) => (
                  <div key={idx} className="bg-white/5 backdrop-blur-md border border-white/10 px-8 py-4 rounded-2xl flex flex-col gap-1">
                    <p className="text-white text-sm font-medium italic">"{review.text}"</p>
                    <p className="text-text-secondary text-[0.7rem] uppercase tracking-widest">{review.author}</p>
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
        </Reveal>
      </header>

      {/* Services Section */}
      <section id="services" className="relative z-10 py-[140px] px-6 max-w-[1100px] mx-auto">
        <Reveal>
          <span className="text-accent font-semibold text-[0.85rem] tracking-[1.5px] uppercase mb-4 block">Expertise</span>
          <h2 className="text-[clamp(2rem,6vw,3.5rem)] font-bold mb-16 tracking-[-0.04em]">Dominating Local Markets.</h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ServiceCard 
            icon={Search} 
            title="Google Ads" 
            description="Intercept high-intent customers the moment they search for your trade. We focus on cost-per-lead optimization." 
          />
          <ServiceCard 
            icon={Instagram} 
            title="Meta Ads" 
            description="Social engineering and creative strategy designed to keep your pipeline full and your brand top-of-mind." 
          />
          <ServiceCard 
            icon={Layout} 
            title="Conversion Sites" 
            description="High-speed, premium websites that turn traffic into trackable revenue. Built for performance and aesthetics." 
          />
          <ServiceCard 
            icon={Users} 
            title="Social Media Management" 
            description="Build a loyal community and maintain a professional presence. We handle content, engagement, and growth." 
          />
        </div>
      </section>

      {/* Growth Section */}
      <section className="relative z-10 py-[140px] px-6 max-w-[1100px] mx-auto overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <Reveal>
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-white">
              We ensure you the best growth with high-performance Google and Meta advertising, high quality websites that will make customers want your service, Social media management with <span className="text-accent">Money back Guarantee</span>
            </p>
          </Reveal>
          <Reveal className="relative h-[380px] w-full bg-card-bg rounded-[36px] border border-glass-border p-8 flex items-end justify-center overflow-hidden">
            <svg viewBox="0 0 400 200" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="graphGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D00000" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#D00000" stopOpacity="0" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Grid lines - Horizontal */}
              {[20, 60, 100, 140, 180].map((y) => (
                <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              ))}
              
              {/* Grid lines - Vertical */}
              {[0, 100, 200, 300, 400].map((x) => (
                <line key={x} x1={x} y1="0" x2={x} y2="200" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              ))}

              {/* Gradient Area */}
              <motion.path
                d="M 0 180 Q 50 170 100 140 T 200 100 T 300 40 T 400 10 L 400 200 L 0 200 Z"
                fill="url(#graphGradient)"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 2, delay: 0.5 }}
              />

              {/* Main Growth Line */}
              <motion.path
                d="M 0 180 Q 50 170 100 140 T 200 100 T 300 40 T 400 10"
                fill="none"
                stroke="#D00000"
                strokeWidth="4"
                strokeLinecap="round"
                filter="url(#glow)"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 2.5, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
              />

              {/* Floating Data Points & Labels */}
              <motion.g
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 2.5, duration: 0.5 }}
              >
                {[
                  { x: 100, y: 140, label: "Q1", val: "+45%" },
                  { x: 200, y: 100, label: "Q2", val: "+120%" },
                  { x: 300, y: 40, label: "Q3", val: "+210%" },
                ].map((pt, i) => (
                  <g key={i}>
                    <circle cx={pt.x} cy={pt.y} r="4" fill="#D00000" />
                    <text x={pt.x} y={pt.y - 12} textAnchor="middle" className="text-[8px] fill-text-secondary font-medium uppercase tracking-widest">{pt.label}</text>
                    <text x={pt.x} y={pt.y + 18} textAnchor="middle" className="text-[9px] fill-white font-bold">{pt.val}</text>
                  </g>
                ))}
                
                {/* Final Target Point */}
                <g>
                  <circle cx="400" cy="10" r="6" fill="#D00000" className="animate-pulse" />
                  <line x1="385" y1="10" x2="415" y2="10" stroke="#D00000" strokeWidth="1" strokeDasharray="2 2" />
                  <line x1="400" y1="-5" x2="400" y2="25" stroke="#D00000" strokeWidth="1" strokeDasharray="2 2" />
                </g>
              </motion.g>

              {/* ROI Badge */}
              <motion.g
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 3 }}
              >
                <rect x="340" y="-25" width="60" height="20" rx="4" fill="#D00000" fillOpacity="0.2" stroke="#D00000" strokeWidth="1" />
                <text
                  x="370" y="-11"
                  textAnchor="middle"
                  className="text-[10px] fill-white font-bold uppercase tracking-tighter"
                >
                  +340% ROI
                </text>
              </motion.g>
            </svg>
            <div className="absolute top-4 right-6 text-[0.7rem] text-text-secondary uppercase tracking-widest font-medium">Live Performance Metrics</div>
            <div className="absolute bottom-4 left-6 flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_#D00000]" />
                <span className="text-[0.65rem] text-text-secondary uppercase tracking-wider">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/10" />
                <span className="text-[0.65rem] text-text-secondary uppercase tracking-wider">Projected</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Process Section */}
      <section className="relative z-10 py-[140px] px-6 max-w-[1100px] mx-auto">
        <Reveal className="text-center mb-20">
          <span className="text-accent font-semibold text-[0.85rem] tracking-[1.5px] uppercase mb-4 block">Our Method</span>
          <h2 className="text-[clamp(2rem,6vw,3.5rem)] font-bold tracking-[-0.04em]">The 3-Step Scaling System.</h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            { step: "01", title: "Audit & Strategy", desc: "We analyze your current lead flow, competitors, and market opportunity to build a custom roadmap." },
            { step: "02", title: "Build & Launch", desc: "Our team deploys high-performance ads and conversion-first landing pages tailored to your trade." },
            { step: "03", title: "Scale & Dominate", desc: "We optimize daily, pushing ad spend into what works to maximize your ROI and market share." }
          ].map((item, i) => (
            <Reveal key={i} className="relative">
              <div className="text-[5rem] font-bold text-white/5 absolute -top-10 -left-4 select-none">{item.step}</div>
              <div className="relative z-10">
                <h3 className="text-[1.5rem] font-bold mb-4 text-white">{item.title}</h3>
                <p className="text-text-secondary leading-relaxed">{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="relative z-10 py-[140px] px-6 max-w-[1100px] mx-auto">
        <Reveal>
          <span className="text-accent font-semibold text-[0.85rem] tracking-[1.5px] uppercase mb-4 block">About Us</span>
          <h2 className="text-[clamp(2rem,6vw,3.5rem)] font-bold mb-12 tracking-[-0.04em]">Elite Build Agency</h2>
          <div className="max-w-3xl">
            <p className="text-xl md:text-2xl leading-relaxed font-stretched text-white mb-8">
              Hi, we are Elite Build Agency.
            </p>
            <p className="text-xl md:text-2xl leading-relaxed font-stretched text-white mb-8">
              We specialize in helping service-based businesses like roofers, plumbers, and contractors scale their revenue through targeted advertising and conversion-focused websites.
            </p>
            <p className="text-xl md:text-2xl leading-relaxed font-stretched text-white">
              No guesswork. No wasted ad spend. Just results.
            </p>
          </div>
        </Reveal>
      </section>

      {/* FAQ Section */}
      <section className="relative z-10 py-[140px] px-6 max-w-[1100px] mx-auto">
        <Reveal className="mb-16">
          <span className="text-accent font-semibold text-[0.85rem] tracking-[1.5px] uppercase mb-4 block">FAQ</span>
          <h2 className="text-[clamp(2rem,6vw,3.5rem)] font-bold tracking-[-0.04em]">Common Questions.</h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
          {[
            { q: "How fast will I see results?", a: "Most clients see their first qualified leads within 7-14 days of launching their custom campaigns." },
            { q: "Do you work with any trade?", a: "We specialize in high-ticket service businesses: Roofing, HVAC, Plumbing, and General Contracting." },
            { q: "Is there a long-term contract?", a: "We believe in results. We offer month-to-month partnerships because our performance keeps you around." },
            { q: "What is the Money Back Guarantee?", a: "If we don't hit our agreed-upon lead targets in the first 30 days, you don't pay our management fee. Period." }
          ].map((item, i) => (
            <Reveal key={i}>
              <h4 className="text-white font-bold text-[1.1rem] mb-3">{item.q}</h4>
              <p className="text-text-secondary text-[0.95rem] leading-relaxed">{item.a}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="relative z-10 py-[140px] px-6 max-w-[1100px] mx-auto">
        <Reveal>
          <span className="text-accent font-semibold text-[0.85rem] tracking-[1.5px] uppercase mb-4 block">Connect</span>
          <h2 className="text-[clamp(2rem,6vw,3.5rem)] font-bold mb-16 tracking-[-0.04em]">Direct Access.</h2>
        </Reveal>
        <div className="flex justify-center">
          <Reveal className="w-full max-w-xl">
            <a href="https://www.instagram.com/elitebuildagency/" target="_blank" rel="noopener noreferrer" className="bg-card-bg border border-glass-border p-9 rounded-[28px] flex items-center gap-6 hover:bg-white/8 hover:border-white transition-all group">
              <div className="w-12 h-12 bg-white/8 rounded-xl flex items-center justify-center text-white">
                <Instagram size={24} />
              </div>
              <div>
                <h4 className="text-[0.75rem] text-text-secondary uppercase tracking-wider mb-1">Instagram</h4>
                <p className="text-[1.3rem] font-semibold tracking-[-0.02em]">elitebuildagency</p>
              </div>
            </a>
          </Reveal>
        </div>
      </section>

      {/* Booking Section */}
      <section id="book" className="relative z-10 py-[140px] px-6 max-w-[1100px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-24 items-center">
          <Reveal>
            <span className="text-accent font-semibold text-[0.85rem] tracking-[1.5px] uppercase mb-4 block">Limited Availability</span>
            <h2 className="text-[2.8rem] mb-6 tracking-[-0.04em] font-bold">Ready to Scale?</h2>
            <p className="text-text-secondary mb-8 text-[1.1rem]">Schedule a 15-minute consultation to see if your business qualifies for our growth program.</p>
            <div className="flex items-center gap-4 mb-4.5">
              <CheckCircle2 size={20} className="text-[#34c759]" />
              <span className="text-[0.95rem] text-white">Free Ad Performance Audit</span>
            </div>
            <div className="flex items-center gap-4">
              <CheckCircle2 size={20} className="text-[#34c759]" />
              <span className="text-[0.95rem] text-white">Custom Revenue Roadmap</span>
            </div>
          </Reveal>
          <Reveal>
            <form className="space-y-4.5" onSubmit={handleBooking}>
              <input name="fullName" type="text" placeholder="Full Name" className="w-full p-5 bg-[#0a0a0a] border border-[#222] rounded-2xl text-white outline-none focus:border-accent transition-colors" required />
              <input name="email" type="email" placeholder="Business Email" className="w-full p-5 bg-[#0a0a0a] border border-[#222] rounded-2xl text-white outline-none focus:border-accent transition-colors" required />
              <select name="serviceType" className="w-full p-5 bg-[#0a0a0a] border border-[#222] rounded-2xl text-white outline-none focus:border-accent transition-colors appearance-none" defaultValue="" required>
                <option value="" disabled>Service Type</option>
                <option>Roofing</option>
                <option>Plumbing / HVAC</option>
                <option>Painting / Renovation</option>
                <option>Other</option>
              </select>
              <div className="relative">
                <input name="preferredDate" type="date" className="w-full p-5 bg-[#0a0a0a] border border-[#222] rounded-2xl text-white outline-none focus:border-accent transition-colors [color-scheme:dark]" required />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[0.7rem] text-text-secondary uppercase tracking-widest pointer-events-none">Preferred Date</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
                <select name="socialPlatform" className="w-full p-5 bg-[#0a0a0a] border border-[#222] rounded-2xl text-white outline-none focus:border-accent transition-colors appearance-none" defaultValue="" required>
                  <option value="" disabled>Social Platform</option>
                  <option>Instagram</option>
                  <option>Facebook</option>
                  <option>TikTok</option>
                  <option>Other</option>
                </select>
                <input name="socialUsername" type="text" placeholder="Social Username" className="w-full p-5 bg-[#0a0a0a] border border-[#222] rounded-2xl text-white outline-none focus:border-accent transition-colors" required />
              </div>
              <button type="submit" className="w-full bg-accent text-white py-5 rounded-2xl font-semibold text-[1.05rem] hover:opacity-90 transition-opacity mt-4">
                Claim Your Strategy Call
              </button>
            </form>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 text-center border-t border-glass-border">
        <p 
          className="text-text-secondary text-[0.75rem] tracking-widest uppercase cursor-default select-none"
          onClick={() => setShowAdminTrigger(!showAdminTrigger)}
        >
          &copy; {new Date().getFullYear()} PREMIUM SMMA PARTNER. ALL RIGHTS RESERVED.
        </p>
      </footer>
    </div>
  );
}
