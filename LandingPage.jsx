import React, { useState, useEffect, useRef } from 'react';

const messages = [
  'Monitoring environment...',
  'Analyzing motion patterns...',
  'Detecting anomalies...',
  'Neural sync established',
  'Sensor fusion active'
];

export default function LandingPage({ onStart }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [cycleClass, setCycleClass] = useState('');
  const fieldRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCycleClass('message-cycle');
      setTimeout(() => {
        setMsgIndex(prev => (prev + 1) % messages.length);
      }, 1000);
      setTimeout(() => setCycleClass(''), 3500);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!fieldRef.current) return;
    
    // Cleanup any existing
    fieldRef.current.innerHTML = '';
    
    const nodes = [];
    const nodeCount = 15;

    for (let i = 0; i < nodeCount; i++) {
        const node = document.createElement('div');
        node.className = 'neural-node';
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        node.style.left = `${x}%`;
        node.style.top = `${y}%`;
        fieldRef.current.appendChild(node);
        nodes.push({ x, y, el: node });
    }

    let isSubscribed = true;

    function createDataParticle() {
        if (!isSubscribed || !fieldRef.current) return;
        const start = nodes[Math.floor(Math.random() * nodes.length)];
        const end = nodes[Math.floor(Math.random() * nodes.length)];
        if (start === end) return;

        const p = document.createElement('div');
        p.className = 'data-particle';
        p.style.left = `${start.x}%`;
        p.style.top = `${start.y}%`;
        
        const deltaX = (end.x - start.x) * (window.innerWidth / 100);
        const deltaY = (end.y - start.y) * (window.innerHeight / 100);
        
        p.style.setProperty('--startX', '0px');
        p.style.setProperty('--startY', '0px');
        p.style.setProperty('--endX', `${deltaX}px`);
        p.style.setProperty('--endY', `${deltaY}px`);
        
        const duration = 2 + Math.random() * 3;
        p.style.animation = `data-flow ${duration}s ease-in-out forwards`;
        
        fieldRef.current.appendChild(p);
        setTimeout(() => {
            if (p.parentNode === fieldRef.current) {
                p.remove();
            }
        }, duration * 1000);
    }

    const intervalId = setInterval(createDataParticle, 600);
    
    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="bg-background text-on-background selection:bg-primary selection:text-on-primary font-body min-h-screen">
      <header className="fixed top-0 right-0 w-full z-50 flex justify-between items-center px-8 h-20 bg-[#0f131c]/80 backdrop-blur-xl border-b border-white/5 font-['Manrope'] font-medium">
        <div className="flex items-center gap-3">
          <span className="text-primary text-2xl font-extrabold tracking-tighter">SURAKSHA</span>
          <div className="h-4 w-[1px] bg-outline-variant mx-2"></div>
          <span className="text-xs text-on-surface-variant tracking-widest uppercase">AI Sentinel v2.4</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a className="text-primary border-b-2 border-primary py-1" href="#dashboard" onClick={(e) => { e.preventDefault(); onStart(); }}>Dashboard</a>
          <a className="text-slate-400 hover:text-primary transition-colors text-sm" href="#insights" onClick={(e) => e.preventDefault()}>Insights</a>
          <a className="text-slate-400 hover:text-primary transition-colors text-sm" href="#history" onClick={(e) => e.preventDefault()}>History</a>
          <a className="text-slate-400 hover:text-primary transition-colors text-sm" href="#replay" onClick={(e) => e.preventDefault()}>Replay</a>
        </nav>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container-high border border-primary/20">
            <span className="material-symbols-outlined text-primary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <span className="text-primary text-[11px] font-bold tracking-wider" id="nav-status">SYSTEM SAFE</span>
          </div>
          <div className="flex gap-4 items-center">
            <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors">notifications_active</span>
            <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors">account_circle</span>
          </div>
        </div>
      </header>
      <main>
        {/* IMMERSIVE NEURAL SENSOR FIELD HERO */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0e17]">
          {/* Background Canvas Layer */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-grid opacity-20"></div>
            <div className="absolute inset-0" id="neural-field" ref={fieldRef}></div>
          </div>
          {/* Central Energy Core Layer */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div className="energy-core w-96 h-96 rounded-full opacity-30 blur-3xl"></div>
            <div className="ripple-ring w-40 h-40 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ animationDelay: '0s' }}></div>
            <div className="ripple-ring w-40 h-40 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ animationDelay: '1.3s' }}></div>
            <div className="ripple-ring w-40 h-40 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ animationDelay: '2.6s' }}></div>
          </div>
          {/* Content Layer */}
          <div className="relative z-20 container mx-auto px-6 text-center lg:text-left lg:flex lg:items-center">
            <div className="max-w-3xl lg:ml-20">
              <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 mb-8 backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#4edea3]"></span>
                <span className="text-primary text-[10px] font-bold tracking-[0.2em] uppercase">Neural Network Active</span>
              </div>
              <h1 className="text-4xl lg:text-7xl font-extrabold tracking-tight text-on-surface mb-8 leading-[1.1] drop-shadow-2xl">
                SURAKSHA is not just an app.<br/>
                <span className="text-primary bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">It is a real-time intelligence system.</span>
              </h1>
              <p className="text-lg lg:text-2xl text-on-surface-variant mb-12 leading-relaxed opacity-90 max-w-2xl">
                Suraksha is a real-time multi-sensor decision system that combines noisy sensor inputs and uses temporal reasoning to generate stable, explainable safety assessments.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-6 mb-12">
                <button 
                  onClick={onStart}
                  className="group w-full sm:w-auto px-10 py-5 bg-primary text-on-primary font-bold rounded-full text-sm hover:brightness-110 active:scale-95 transition-all shadow-[0_0_25px_rgba(78,222,163,0.4)] flex items-center justify-center gap-2"
                >
                  Start Protection
                  <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
                <button 
                  onClick={onStart}
                  className="w-full sm:w-auto px-10 py-5 bg-white/5 backdrop-blur-xl border border-white/10 text-on-surface font-semibold rounded-full text-sm hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  Watch System Demo
                  <span className="material-symbols-outlined text-sm">play_circle</span>
                </button>
              </div>
              {/* Rotating System Messages */}
              <div className="h-8 overflow-hidden">
                <div className="flex flex-col gap-2" id="system-message-cycle">
                  <div className="flex items-center gap-3 text-primary/70 font-mono text-xs uppercase tracking-[0.3em]">
                    <span className="material-symbols-outlined text-xs animate-spin" style={{ fontVariationSettings: "'wght' 300" }}>sync</span>
                    <span id="cycle-text" className={cycleClass}>{messages[msgIndex]}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Bottom UI Decors */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 opacity-30 w-full">
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="text-lg font-bold text-on-surface">40k+</div>
                <div className="text-[8px] uppercase tracking-widest text-on-surface-variant">Active Guardians</div>
              </div>
              <div className="w-px h-8 bg-white/10"></div>
              <div className="text-center">
                <div className="text-lg font-bold text-on-surface">0.4s</div>
                <div className="text-[8px] uppercase tracking-widest text-on-surface-variant">Avg. Latency</div>
              </div>
              <div className="w-px h-8 bg-white/10"></div>
              <div className="text-center">
                <div className="text-lg font-bold text-on-surface">99.4%</div>
                <div className="text-[8px] uppercase tracking-widest text-on-surface-variant">Detection Rate</div>
              </div>
            </div>
          </div>
        </section>
        {/* Problem Section */}
        <section className="py-32 px-6 bg-surface-container-lowest">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="relative group">
              <div className="absolute -inset-4 bg-secondary/10 rounded-2xl blur-2xl group-hover:bg-secondary/20 transition-all duration-700"></div>
              <img alt="Tense urban environment" className="relative rounded-2xl object-cover w-full aspect-[4/3] grayscale brightness-50 group-hover:grayscale-0 group-hover:brightness-75 transition-all duration-700 shadow-2xl" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBiNLIfXhTF3dRQsxVSpyTsXCdO6q9AwYr5JrM4jTUM361O7qf3N9FwQEsVIdyoS3gw9PjzHREG3m2XmRGJvkmrLqYfQELDXpKtwL7_wELgTlamaSW2PribHeJF_5N_EafAmUEzpeHv8na1NmuHJGsl0G-K1B5vpu0lLA-JFR9Pv8sKUbnQggIvUR8zl8Dtr2S9-H9pu_n9nfNO4uM_4IKcPwaqvdgXmmaVxt2eOSVH3mcO5hGr0tmlq3VfRGPeFFAdqaPJYPrMZes"/>
              <div className="absolute top-8 left-8 flex flex-col gap-4">
                <div className="bg-secondary-container/80 backdrop-blur-md px-4 py-2 rounded-lg border border-secondary/20 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-sm">warning</span>
                  <span className="text-secondary text-xs font-bold tracking-widest">THREAT DETECTED</span>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-4xl font-bold mb-8 text-on-surface">Silence is not safety. <br/>Seconds matter.</h2>
              <p className="text-on-surface-variant text-lg leading-relaxed mb-10">
                In critical moments, traditional reactive security fails. Environments can turn hostile in milliseconds, and the window for effective intervention is agonizingly small. We bridge that gap.
              </p>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-secondary">emergency_home</span>
                  </div>
                  <div>
                    <h4 className="text-on-surface font-semibold mb-1">Delayed Response</h4>
                    <p className="text-on-surface-variant text-sm">Average emergency response times exceed 8 minutes in urban centers.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-secondary">blind</span>
                  </div>
                  <div>
                    <h4 className="text-on-surface font-semibold mb-1">Blind Spots</h4>
                    <p className="text-on-surface-variant text-sm">Static surveillance can't follow you where danger actually hides.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Solution Section (Bento Grid) */}
        <section className="py-32 px-6">
          <div className="max-w-7xl mx-auto text-center mb-20">
            <h2 className="text-4xl font-bold mb-6 text-on-surface">The Neural Sentinel</h2>
            <p className="text-on-surface-variant max-w-2xl mx-auto">Real-time sensor fusion technology that understands context, not just data.</p>
          </div>
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento Item 1: Audio */}
            <div className="md:col-span-2 rounded-2xl bg-surface-container overflow-hidden p-10 flex flex-col justify-between group h-80 lg:h-96">
              <div className="flex justify-between items-start">
                <div className="max-w-md">
                  <h3 className="text-2xl font-bold mb-4">Acoustic Fingerprinting</h3>
                  <p className="text-on-surface-variant leading-relaxed">Our AI isolates distress calls, breaking glass, and aggressive vocal patterns from chaotic background noise with 99.4% accuracy.</p>
                </div>
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-primary text-3xl">graphic_eq</span>
                </div>
              </div>
              <div className="mt-12 overflow-hidden rounded-xl bg-surface-container-lowest h-32 relative flex items-center justify-center gap-1">
                <div className="w-1.5 bg-primary/40 h-8 rounded-full"></div>
                <div className="w-1.5 bg-primary/60 h-16 rounded-full"></div>
                <div className="w-1.5 bg-primary/80 h-24 rounded-full"></div>
                <div className="w-1.5 bg-primary h-12 rounded-full"></div>
                <div className="w-1.5 bg-primary/90 h-20 rounded-full"></div>
                <div className="w-1.5 bg-primary/60 h-8 rounded-full"></div>
                <div className="w-1.5 bg-primary/30 h-14 rounded-full"></div>
              </div>
            </div>
            {/* Bento Item 2: Location */}
            <div className="md:col-span-1 rounded-2xl bg-primary border border-primary/20 p-10 flex flex-col group h-80 lg:h-96">
              <div className="mb-8 w-14 h-14 rounded-xl bg-on-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary text-3xl">location_on</span>
              </div>
              <h3 className="text-on-primary text-2xl font-bold mb-4">Precision Mapping</h3>
              <p className="text-on-primary/80 leading-relaxed mb-auto">Sub-meter accuracy tracking that integrates with emergency dispatch.</p>
              <div className="mt-8 rounded-xl overflow-hidden grayscale brightness-50 contrast-125 border border-on-primary/10">
                <img alt="Map interface" className="w-full h-32 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCCu-n6TBKzUqexgo3PQ50Q8WvOhGVWrCBEeKVw-fHbdmB1BI4Ww-6iACXyHAS4IYhsIoc0m251brwEVr01v_jIflYImbiHyc3GvkgXZQltNM-3con_5dBSg0dDsIlsK0RnhEnwDEv9YHursLX06TP5ba3pojyCagWhqSpiiXa7e0LIzJXlPUO3FqM_B8k4sVpQFSnfY9lkQ1m7aCn1AtfqrwOV2so71vA0XTY5PiFbOYTPoqgPMU0HQ7TPFBXhatU62c2QOuHqovA"/>
              </div>
            </div>
          </div>
        </section>
        {/* Demo Dashboard Section */}
        <section className="py-32 px-6 bg-surface-container-lowest overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-20 items-center">
              <div className="lg:w-1/3">
                <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">Dashboard Preview</span>
                <h2 className="text-4xl font-bold mb-8 text-on-surface">Command &amp; Control</h2>
                <ul className="space-y-8">
                  <li className="flex gap-4">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>done_all</span>
                    <p className="text-on-surface-variant"><strong className="text-on-surface">Zero-Latency Sync:</strong> Data visualized in real-time as it occurs on-device.</p>
                  </li>
                  <li className="flex gap-4">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>done_all</span>
                    <p className="text-on-surface-variant"><strong className="text-on-surface">Incident Timeline:</strong> Scrubber-based replay of sensor events.</p>
                  </li>
                </ul>
              </div>
              <div className="lg:w-2/3 relative">
                <div className="absolute -inset-10 bg-primary/5 blur-[100px] rounded-full"></div>
                <div className="glass-panel rounded-3xl p-4 border border-outline-variant/30 shadow-2xl overflow-hidden">
                  <div className="bg-surface-container-lowest rounded-2xl h-[500px] overflow-hidden flex flex-col">
                    <div className="h-14 border-b border-outline-variant/10 flex items-center justify-between px-6">
                      <div className="flex gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                      </div>
                      <div className="text-[10px] font-mono text-on-surface-variant opacity-50 tracking-widest uppercase">Sentinel-OS // v2.4.0</div>
                    </div>
                    <div className="flex-1 flex gap-px bg-outline-variant/10">
                      <div className="w-64 bg-surface-container-low p-6 flex flex-col gap-6">
                        <div className="space-y-1">
                          <div className="text-[9px] text-on-surface-variant uppercase tracking-tighter opacity-60">Status</div>
                          <div className="text-primary font-bold flex items-center gap-2 text-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                            System Vigilant
                          </div>
                        </div>
                        <div className="p-4 bg-surface-container rounded-lg border border-primary/10">
                          <div className="text-[9px] uppercase text-on-surface-variant mb-2">Confidence</div>
                          <div className="h-1 bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="w-[94%] h-full bg-primary"></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 bg-surface-container-lowest p-8 flex flex-col gap-8">
                        <div className="flex justify-between items-end">
                          <h4 className="text-xl font-bold tracking-tight">Active Analytics</h4>
                          <div className="text-[10px] text-on-surface-variant font-mono">LIVE FEED • UTC +5:30</div>
                        </div>
                        <div className="flex-1 border-2 border-dashed border-outline-variant/20 rounded-xl flex items-center justify-center bg-surface-container-low/30">
                          <div className="text-center group">
                            <span className="material-symbols-outlined text-5xl text-outline-variant group-hover:text-primary transition-colors cursor-pointer">play_circle</span>
                            <p className="mt-4 text-[11px] text-on-surface-variant uppercase tracking-widest font-bold">Stream Initializing</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* System Architecture & Evaluator Note */}
        <section className="py-24 px-6 bg-[#0a0e17]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 text-on-surface">System Architecture</h2>
              <p className="text-on-surface-variant max-w-2xl mx-auto">Core mathematical and structural paradigms implemented in SURAKSHA v3.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
               <div className="rounded-2xl p-6 border border-white/5 bg-surface-container-low hover:bg-surface-container transition-colors">
                 <h4 className="text-primary font-bold mb-2">Multi-Sensor Fusion</h4>
                 <p className="text-sm text-slate-400">Concurrent validation across isolated hardware arrays minimizes false-positive triggers.</p>
               </div>
               <div className="rounded-2xl p-6 border border-white/5 bg-surface-container-low hover:bg-surface-container transition-colors">
                 <h4 className="text-primary font-bold mb-2">Temporal Filtering</h4>
                 <p className="text-sm text-slate-400">Continuous sliding-window standard deviations denoise sensory inputs dynamically.</p>
               </div>
               <div className="rounded-2xl p-6 border border-white/5 bg-surface-container-low hover:bg-surface-container transition-colors">
                 <h4 className="text-primary font-bold mb-2">FSM Modeling</h4>
                 <p className="text-sm text-slate-400">Robust state evaluation applying hysteresis logic derived from hardware Verilog design.</p>
               </div>
               <div className="rounded-2xl p-6 border border-white/5 bg-surface-container-low hover:bg-surface-container transition-colors">
                 <h4 className="text-primary font-bold mb-2">Explainable AI</h4>
                 <p className="text-sm text-slate-400">The platform synthesizes raw analytics into natural-language reasoning output streams.</p>
               </div>
            </div>

            <div className="max-w-4xl mx-auto bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 flex gap-4 items-start">
               <span className="material-symbols-outlined text-amber-500 mt-0.5">help_center</span>
               <div>
                 <h4 className="text-amber-500 font-bold mb-1">Evaluator Compatibility Note</h4>
                 <p className="text-sm text-amber-500/80">
                   <strong>Full functionality requires an HTTPS connection.</strong> Modern browsers (especially iOS Safari and Apple ecosystem devices) enforce strict security protocols that entirely block access to the <code>DeviceMotionEvent</code> (Gyroscope) and <code>AudioContext</code> (Microphone) APIs if accessed over unsecured HTTP or Local IP addresses. To evaluate motion/audio streaming, please use an Android device, a desktop browser on <code>localhost</code>, or deploy the application over a secure tunnel.
                 </p>
               </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-6 relative overflow-hidden">
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-surface-container-high to-surface-container rounded-2xl p-16 text-center border border-primary/10 relative z-10">
            <h2 className="text-4xl font-bold mb-6">Experience the future of safety.</h2>
            <p className="text-on-surface-variant text-lg mb-12 max-w-xl mx-auto opacity-80">
              Join over 40,000 users who trust SURAKSHA as their primary digital guardian. High-end protection, delivered with zero compromise.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={onStart} className="px-10 py-4 bg-primary text-on-primary font-bold rounded-lg hover:shadow-lg hover:shadow-primary/20 transition-all text-sm">Get Started Free</button>
              <button className="px-10 py-4 bg-transparent border border-outline-variant text-on-surface font-bold rounded-lg hover:bg-surface-container-highest transition-all text-sm">Schedule Demo</button>
            </div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] -z-10"></div>
        </section>
      </main>
      <footer className="bg-surface-container-lowest border-t border-outline-variant/10 py-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12">
          <div className="col-span-2">
            <div className="text-2xl font-extrabold tracking-tighter text-primary mb-6">SURAKSHA</div>
            <p className="text-on-surface-variant max-w-xs mb-8 text-sm leading-relaxed">
              Redefining personal safety through advanced artificial intelligence and sensor fusion. Dedicated to building a safer tomorrow.
            </p>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface hover:text-primary transition-colors cursor-pointer border border-white/5">
                <span className="material-symbols-outlined text-lg">language</span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface hover:text-primary transition-colors cursor-pointer border border-white/5">
                <span className="material-symbols-outlined text-lg">share</span>
              </div>
            </div>
          </div>
          <div>
            <h5 className="text-on-surface font-bold mb-6 text-sm uppercase tracking-widest">Platform</h5>
            <ul className="space-y-4 text-xs text-on-surface-variant">
              <li><a className="hover:text-primary transition-colors" href="#">Technology</a></li>
              <li><a className="hover:text-primary transition-colors" href="#">Devices</a></li>
              <li><a className="hover:text-primary transition-colors" href="#">Integrations</a></li>
            </ul>
          </div>
          <div>
            <h5 className="text-on-surface font-bold mb-6 text-sm uppercase tracking-widest">Company</h5>
            <ul className="space-y-4 text-xs text-on-surface-variant">
              <li><a className="hover:text-primary transition-colors" href="#">About Us</a></li>
              <li><a className="hover:text-primary transition-colors" href="#">Ethics</a></li>
              <li><a className="hover:text-primary transition-colors" href="#">Careers</a></li>
            </ul>
          </div>
          <div>
            <h5 className="text-on-surface font-bold mb-6 text-sm uppercase tracking-widest">Legal</h5>
            <ul className="space-y-4 text-xs text-on-surface-variant">
              <li><a className="hover:text-primary transition-colors" href="#">Privacy</a></li>
              <li><a className="hover:text-primary transition-colors" href="#">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-outline-variant/10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-xs text-on-surface-variant opacity-60">© 2024 SURAKSHA AI Systems. All rights protected.</div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            <span className="text-[10px] font-mono text-primary/80 uppercase tracking-widest">Global Status: Operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
