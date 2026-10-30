import { useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import api, { getErrorMessage } from "./api.js";

const difficulties = [
  { id: "easy", name: "Rookie", detail: "Clear leads, gentler twists", icon: "◌" },
  { id: "medium", name: "Detective", detail: "A balanced investigation", icon: "⌕" },
  { id: "hard", name: "Mastermind", detail: "Subtle clues, no easy outs", icon: "◇" }
];

function Brand({ compact = false }) {
  return (
    <Link className={`brand ${compact ? "brand-compact" : ""}`} to="/" aria-label="Casefile home">
      <span className="brand-mark">C</span>
      <span>CASEFILE<span className="brand-period">.</span></span>
    </Link>
  );
}

function Header({ eyebrow = "THE MYSTERY ROOM" }) {
  return (
    <header className="topbar">
      <Brand />
      <div className="topbar-status"><span className="status-dot" /> {eyebrow}</div>
      <span className="edition">AN INTERACTIVE DETECTIVE STORY</span>
    </header>
  );
}

function Home() {
  const navigate = useNavigate();
  const [premise, setPremise] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startInvestigation(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/cases", { premise: premise.trim(), difficulty });
      navigate(`/case/${data.id}`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="home-page">
      <Header />
      <section className="hero">
        <div className="hero-copy">
          <div className="overline"><span className="overline-line" /> YOUR NEXT CASE AWAITS</div>
          <h1>Every secret<br />leaves a <em>trace.</em></h1>
          <p className="hero-description">Step into a mystery built just for you. Follow the evidence, question everyone, and trust nothing but your instincts.</p>
          <div className="hero-stats">
            <div><strong>01</strong><span>CASE, NEVER THE SAME</span></div>
            <i />
            <div><strong>∞</strong><span>WAYS TO INVESTIGATE</span></div>
          </div>
        </div>
        <aside className="case-note" aria-label="Case briefing">
          <div className="note-top"><span>FIELD NOTES</span><span>NO. 001</span></div>
          <div className="note-rule" />
          <div className="note-stamp">CONFIDENTIAL</div>
          <p className="note-quote">“The truth is rarely loud. It waits in the details no one thought to hide.”</p>
          <div className="note-signature">— DET. MORROW</div>
          <div className="note-footer"><span>OPEN CASES</span><span>01 — 03</span></div>
        </aside>
      </section>

      <section className="setup-section" id="start">
        <div className="section-heading">
          <div><span className="section-kicker">01 / SET THE SCENE</span><h2>Build your case.</h2></div>
          <span className="section-aside">A good mystery starts<br />with one question.</span>
        </div>
        <form className="setup-form" onSubmit={startInvestigation}>
          <label className="field-label" htmlFor="premise">WHAT HAPPENED?</label>
          <div className="premise-wrap">
            <span className="field-icon">✳</span>
            <input id="premise" maxLength={300} minLength={10} placeholder="A priceless painting vanished during a midnight storm..." required value={premise} onChange={(event) => setPremise(event.target.value)} />
            <span className="char-count">{premise.length}/300</span>
          </div>
          <div className="difficulty-heading"><span className="field-label">CHOOSE YOUR DIFFICULTY</span><span>YOU CAN’T CHANGE THIS LATER</span></div>
          <div className="difficulty-grid">
            {difficulties.map((option) => (
              <button className={`difficulty-card ${difficulty === option.id ? "selected" : ""}`} key={option.id} onClick={() => setDifficulty(option.id)} type="button" aria-pressed={difficulty === option.id}>
                <span className="difficulty-icon">{option.icon}</span>
                <span className="difficulty-copy"><strong>{option.name}</strong><small>{option.detail}</small></span>
                <span className="radio-dot" />
              </button>
            ))}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button start-button" disabled={loading} type="submit">
            <span>{loading ? "PREPARING YOUR CASE..." : "START INVESTIGATION"}</span><span className="button-arrow">↗</span>
          </button>
          <p className="form-footnote">YOUR STORY IS GENERATED JUST FOR YOU. NO TWO CASES ARE ALIKE.</p>
        </form>
      </section>
      <footer className="site-footer"><Brand compact /><span>THE DETAILS ARE EVERYTHING.</span><span>© CASEFILE 2026</span></footer>
    </main>
  );
}

function useCase(caseId) {
  const [mystery, setMystery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      const { data } = await api.get(`/cases/${caseId}`);
      setMystery(data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return { mystery, setMystery, loading, error, refresh };
}

function Investigation() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { mystery, setMystery, loading, error, refresh } = useCase(caseId);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSuspect, setSelectedSuspect] = useState("");
  const [reasoning, setReasoning] = useState("");

  useEffect(() => { refresh(); }, [caseId]);

  async function act(action, payload = {}) {
    setBusy(action);
    setNotice("");
    try {
      const { data } = await api.post(`/cases/${caseId}/${action}`, payload);
      if (data.mystery) setMystery(data.mystery);
      if (data.clue) setNotice(`Evidence logged: ${data.clue.text}`);
      if (data.hint) setNotice(`A note from the case file: ${data.hint.text}`);
      if (data.suspect) {
        setMystery((current) => ({
          ...current,
          suspects: current.suspects.map((suspect) => suspect.id === data.suspect.id ? { ...suspect, ...data.suspect, isRevealed: true } : suspect)
        }));
      }
      if (action === "accuse") {
        sessionStorage.setItem(`case-result-${caseId}`, JSON.stringify(data));
        navigate(`/results/${caseId}`);
      }
    } catch (requestError) {
      setNotice(getErrorMessage(requestError));
    } finally {
      setBusy("");
    }
  }

  if (loading) return <LoadingPage label="OPENING THE CASE FILE" />;
  if (error && !mystery) return <ErrorPage message={error} />;
  if (!mystery) return null;

  return (
    <main className="app-shell">
      <Header eyebrow="ACTIVE INVESTIGATION" />
      <div className="room-heading">
        <div><span className="section-kicker">CASE FILE / {caseId.slice(-6).toUpperCase()}</span><h1>{mystery.premise}</h1></div>
        <div className="score-pill"><span>CASE SCORE</span><strong>{mystery.progress.score}<small> / 100</small></strong></div>
      </div>
      <div className="investigation-grid">
        <section className="story-panel">
          <div className="panel-title"><span className="panel-icon">✳</span><div><span className="section-kicker">THE BRIEFING</span><h2>What we know</h2></div></div>
          <p className="story-text">{mystery.story}</p>
          <div className="evidence-heading"><span className="section-kicker">EVIDENCE BOARD</span><span>{mystery.progress.discoveredClueCount} / {mystery.progress.totalClueCount} FOUND</span></div>
          {mystery.clues.length ? (
            <div className="clue-list">{mystery.clues.map((clue, index) => <article className="clue-card" key={clue.id}><span className="clue-number">0{index + 1}</span><p>{clue.text}</p></article>)}</div>
          ) : <div className="empty-evidence">The board is empty. Search the scene to find your first lead.</div>}
        </section>
        <section className="suspects-panel">
          <div className="panel-title"><span className="panel-icon">⌕</span><div><span className="section-kicker">PEOPLE OF INTEREST</span><h2>The suspects</h2></div></div>
          <p className="panel-intro">Everyone has a story. Not everyone is telling it.</p>
          <div className="suspect-list">{mystery.suspects.map((suspect, index) => (
            <button className={`suspect-card ${suspect.isRevealed ? "revealed" : ""}`} key={suspect.id} onClick={() => !suspect.isRevealed && act("interrogate", { suspectId: suspect.id })} disabled={busy !== ""}>
              <span className="suspect-avatar">{suspect.isRevealed ? suspect.name.charAt(0).toUpperCase() : "?"}</span>
              <span className="suspect-info"><strong>{suspect.name}</strong><small>{suspect.isRevealed ? suspect.bio : "Tap to interrogate"}</small></span>
              <span className="suspect-index">0{index + 1}</span>
            </button>
          ))}</div>
          <div className="suspect-footer"><span>{mystery.suspects.length} PERSONS OF INTEREST</span><span>ALL ARE INNOCENT UNTIL PROVEN OTHERWISE</span></div>
        </section>
      </div>
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
      <div className="action-bar">
        <div className="action-intro"><span className="section-kicker">YOUR NEXT MOVE</span><strong>Trust the evidence.</strong></div>
        <button className="secondary-button" disabled={busy !== "" || mystery.progress.discoveredClueCount >= mystery.progress.totalClueCount} onClick={() => act("search")}><span>⌕</span>{busy === "search" ? "SEARCHING..." : "SEARCH FOR A CLUE"}</button>
        <button className="secondary-button hint-button" disabled={busy !== "" || mystery.progress.usedHintCount >= mystery.progress.totalHintCount} onClick={() => act("hint")}><span>✳</span>{busy === "hint" ? "THINKING..." : "ASK FOR A HINT"}<small>−10 PTS</small></button>
        <button className="primary-button accuse-button" disabled={busy !== ""} onClick={() => setModalOpen(true)}>MAKE AN ACCUSATION <span>↗</span></button>
      </div>
      {modalOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModalOpen(false)}>
        <form className="accusation-modal" onSubmit={(event) => { event.preventDefault(); if (selectedSuspect) act("accuse", { suspectId: selectedSuspect, reasoning }); }}>
          <button className="modal-close" type="button" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
          <span className="section-kicker">THE MOMENT OF TRUTH</span><h2>Make your accusation.</h2>
          <p>Choose the person you believe is responsible. There’s no going back.</p>
          <label className="field-label" htmlFor="suspect-select">WHO DID IT?</label>
          <select id="suspect-select" required value={selectedSuspect} onChange={(event) => setSelectedSuspect(event.target.value)}>
            <option value="">Select a suspect</option>{mystery.suspects.map((suspect) => <option key={suspect.id} value={suspect.id}>{suspect.name}</option>)}
          </select>
          <label className="field-label reasoning-label" htmlFor="reasoning">YOUR REASONING <span>OPTIONAL</span></label>
          <textarea id="reasoning" maxLength={1000} placeholder="Connect the clues. Tell us how you solved it..." value={reasoning} onChange={(event) => setReasoning(event.target.value)} />
          <button className="primary-button modal-submit" disabled={!selectedSuspect || busy === "accuse"} type="submit">{busy === "accuse" ? "REVEALING THE TRUTH..." : "LOCK IN MY ACCUSATION"} <span>↗</span></button>
        </form>
      </div>}
    </main>
  );
}

function Results() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  let result = null;
  try {
    result = JSON.parse(sessionStorage.getItem(`case-result-${caseId}`) || "null");
  } catch {
    result = null;
  }

  if (!result) return <ErrorPage message="Your results aren’t available in this browser session. Start a new investigation to play again." />;

  return (
    <main className="results-page">
      <Header eyebrow="CASE CLOSED" />
      <section className="result-content">
        <span className="section-kicker">INVESTIGATION COMPLETE / {caseId.slice(-6).toUpperCase()}</span>
        <div className={`verdict-mark ${result.correct ? "correct" : "incorrect"}`}>{result.correct ? "✓" : "×"}</div>
        <h1>{result.correct ? "Well, detective." : "A clever misdirection."}</h1>
        <p className="verdict-copy">{result.correct ? "You followed the evidence and found the truth." : "The evidence pointed somewhere else. Every detail tells a story."}</p>
        <div className="result-score"><span>FINAL SCORE</span><strong>{result.score}<small> / 100</small></strong></div>
        <article className="reveal-card"><span className="section-kicker">THE CULPRIT</span><h2>{result.culprit}</h2><p>{result.explanation}</p></article>
        <div className="logic-card"><span className="section-kicker">HOW THE PIECES FIT</span><ol>{result.logicChain.map((step, index) => <li key={`${index}-${step}`}><span>0{index + 1}</span>{step}</li>)}</ol></div>
        <button className="primary-button play-again" onClick={() => navigate("/")}>TAKE ANOTHER CASE <span>↗</span></button>
      </section>
    </main>
  );
}

function LoadingPage({ label }) {
  return <main className="center-state"><span className="loading-mark">C</span><span className="section-kicker">{label}</span><div className="loading-line" /></main>;
}

function ErrorPage({ message }) {
  return <main className="center-state"><Brand /><span className="section-kicker">CASE FILE UNAVAILABLE</span><p>{message}</p><Link className="primary-button" to="/">RETURN TO THE CASE DESK <span>↗</span></Link></main>;
}

export default function App() {
  return <Routes><Route path="/" element={<Home />} /><Route path="/case/:caseId" element={<Investigation />} /><Route path="/results/:caseId" element={<Results />} /><Route path="*" element={<ErrorPage message="This page doesn’t exist. The trail ends here." />} /></Routes>;
}
