import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { syncCards } from './cards'

// Stari napredak (statusi rečenica, ponavljanje riječi) dobiva FSRS kartice, ako ih još nema.
void syncCards()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
