import { type CSSProperties } from "react";
import "./css/App.css";
import RegistrationForm from "./Components/RegistrationForm";

const BULBS = 14;

export default function App() {
  return (
    <div className="page">
      <div className="page__snow" aria-hidden />

      <header className="masthead">
        <div className="masthead__bulbs" aria-hidden>
          {Array.from({ length: BULBS }, (_, index) => (
            <span
              key={index}
              className="masthead__bulb"
              style={{ "--delay": `${index * 110}ms` } as CSSProperties}
            />
          ))}
        </div>

        <p className="masthead__kicker">Edição especial de Natal</p>
        <h1 className="masthead__title">
          Organizador de <span>Amigo Secreto</span>
        </h1>
        <p className="masthead__sub">
          Sorteio confidencial por e-mail — sem papéis a circular e sem ninguém
          a espiar.
        </p>

        <svg
          className="masthead__tinsel"
          viewBox="0 0 800 44"
          preserveAspectRatio="none"
          aria-hidden
          focusable="false"
        >
          <defs>
            <linearGradient id="tinsel" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#b8862a" />
              <stop offset="0.2" stopColor="#f0c14b" />
              <stop offset="0.35" stopColor="#fff3bf" />
              <stop offset="0.55" stopColor="#d9a441" />
              <stop offset="0.75" stopColor="#f0c14b" />
              <stop offset="1" stopColor="#a97a22" />
            </linearGradient>
          </defs>
          <path
            d="M0 12 Q 25 34 50 12 T 100 12 T 150 12 T 200 12 T 250 12 T 300 12 T 350 12 T 400 12 T 450 12 T 500 12 T 550 12 T 600 12 T 650 12 T 700 12 T 750 12 T 800 12"
            fill="none"
            stroke="url(#tinsel)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M0 12 Q 25 34 50 12 T 100 12 T 150 12 T 200 12 T 250 12 T 300 12 T 350 12 T 400 12 T 450 12 T 500 12 T 550 12 T 600 12 T 650 12 T 700 12 T 750 12 T 800 12"
            fill="none"
            stroke="#7a0b12"
            strokeWidth="2"
            strokeDasharray="3 9"
            opacity="0.55"
          />
        </svg>
      </header>

      <main className="page__main">
        <RegistrationForm />
      </main>

      <footer className="page__footer">
        <p>Um amigo secreto por pessoa. Um presente por amigo.</p>
      </footer>
    </div>
  );
}
