import { ArrowLeft, Bot, ClipboardList, Gauge, LayoutDashboard, LogIn, ShieldCheck, Users, Zap } from "lucide-react";
import { SafeSilk } from "../components/SafeSilk.jsx";
import logo from "../images/logo.png";

const features = [
  {
    icon: <Bot size={28} />,
    title: "AI asistent v naravnem jeziku",
    description:
      "Ukazi v slovenščini ali angleščini — sistem razume naravni jezik in samodejno izvede pravo akcijo. Ni treba poznati nobenih posebnih ukazov."
  },
  {
    icon: <Gauge size={28} />,
    title: "Primerjava Ollama vs OpenAI",
    description:
      "Vgrajeni orodji za primerjavo lokalnega modela (Ollama qwen3:8b) in oblačnega (OpenAI gpt-4.1-mini). Meritve časa, točnosti in kakovosti odgovorov."
  },
  {
    icon: <Zap size={28} />,
    title: "Lokalni guard za hitrost",
    description:
      "Pogosti ukazi se prestrežejo z regex pravilami še pred klicem LLM — odziv je takojšen (~1ms). Guard je mogoče izklopiti za čisto primerjavo z LLM."
  },
  {
    icon: <ClipboardList size={28} />,
    title: "Celoten proizvodni workflow",
    description:
      "Sistem samodejno preveri zalogo, naroči manjkajoče dele, ustvari delovni nalog, generira faze in dodeli zaposlene — vse v enem ukazu."
  },
  {
    icon: <Users size={28} />,
    title: "Vloge: admin in delavec",
    description:
      "Admin ima polni dostop. Delavec vidi le svoje faze in delovne naloge, lahko posodablja status lastnih faz ter pošilja opozorila o manjkajočih delih."
  },
  {
    icon: <ShieldCheck size={28} />,
    title: "Potrditev pred izvedbo",
    description:
      "Vse mutacije (ustvari, posodobi, izbriši) zahtevajo eksplicitno potrditev. Sistem prikaže predogled akcije preden jo izvede."
  },
  {
    icon: <LayoutDashboard size={28} />,
    title: "Primerjalna analitika",
    description:
      "Stran Primerjava prikazuje statistike za vsakega od 37 MCP toolov — povprečni čas, točnost interpretacije in split view Ollama vs OpenAI."
  }
];

const stack = [
  { label: "MongoDB", desc: "Baza podatkov" },
  { label: "Express", desc: "REST API backend" },
  { label: "React", desc: "Frontend (Vite)" },
  { label: "Node.js", desc: "Izvajalno okolje" },
  { label: "Ollama", desc: "Lokalni LLM" },
  { label: "OpenAI", desc: "Oblačni LLM" },
  { label: "MCP", desc: "Model Context Protocol" }
];

export function AboutPage({ onBack, onLogin }) {
  return (
    <div className="aboutPage">
      <div className="aboutSilkBg"><SafeSilk /></div>

      <header className="aboutHeader">
        <button type="button" className="aboutBackBtn" onClick={onBack}>
          <ArrowLeft size={18} /> Nazaj
        </button>
        <img src={logo} alt="SPW" className="aboutLogo" />
        <button type="button" className="primary aboutLoginBtn" onClick={onLogin}>
          <LogIn size={16} /> Prijava
        </button>
      </header>

      <main className="aboutMain">

        {/* Hero */}
        <section className="aboutHero">
          <p className="aboutSupertitle">WorkOrder AI</p>
          <h1 className="aboutTitle">Smart Production Workflow</h1>
          <p className="aboutSubtitle">
            Pametni proizvodni sistem z integracijo jezikovnih modelov.<br />
            Upravljajte delovne naloge, zalogo in zaposlene — v naravnem jeziku.
          </p>
          <div className="aboutBadges">
            <span>Diplomska naloga 2026</span>
            <span>Ollama vs OpenAI</span>
            <span>MCP Protocol</span>
          </div>
        </section>

        {/* What is SPW */}
        <section className="aboutSection aboutWhat">
          <div className="aboutSectionInner">
            <h2>Kaj je SPW?</h2>
            <p>
              Smart Production Workflow je prototip industrijskega informacijskega sistema, ki
              zamenja klasične forme in klike z naravnim jezikom. Namesto da skrbnik kliče po
              menijih, napiše ukaz — sistem ga interpretira, izvede pravo akcijo in vrne
              strukturiran odgovor.
            </p>
            <p>
              Sistem je razvit kot praktični del diplomske naloge in primerja dva pristopa k
              interpretaciji ukazov: <strong>lokalni jezikovni model</strong> (Ollama z modelom
              qwen3:8b, 8 milijard parametrov) in <strong>oblačni jezikovni model</strong> (OpenAI
              gpt-4.1-mini). Oba modela prejmeta enak prompt in se primerjata po hitrosti,
              točnosti in kakovosti odgovorov.
            </p>
            <div className="aboutArchBox">
              <code>
                Uporabnik → LLM (Ollama / OpenAI) → MCP Tool → MongoDB → Rezultat
              </code>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="aboutSection">
          <div className="aboutSectionInner">
            <h2>Kaj sistem omogoča</h2>
            <div className="aboutFeatureGrid">
              {features.map((f) => (
                <div className="aboutFeatureCard" key={f.title}>
                  <div className="aboutFeatureIcon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stack */}
        <section className="aboutSection aboutStack">
          <div className="aboutSectionInner">
            <h2>Tehnologije</h2>
            <div className="aboutStackGrid">
              {stack.map((s) => (
                <div className="aboutStackItem" key={s.label}>
                  <strong>{s.label}</strong>
                  <span>{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="aboutCta">
          <h2>Preizkusite sistem</h2>
          <p>Prijavite se z demo računom in preizkusite AI asistenta.</p>
          <div className="aboutCtaCredentials">
            <code>admin / admin</code>
          </div>
          <button type="button" className="primary aboutCtaBtn" onClick={onLogin}>
            <LogIn size={18} /> Prijava v sistem
          </button>
        </section>

      </main>
    </div>
  );
}
