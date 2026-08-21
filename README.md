# treino_timer

Cronómetro de intervalos para treino, em forma de PWA instalável no Android — sem
Android Studio, sem build nativo. Adiciona ao ecrã principal a partir do Chrome e
comporta-se como uma app normal (ícone próprio, ecrã completo, funciona offline).

## Conceito

Um **plano** é uma lista de exercícios nomeados, cada um definido de uma de duas
formas:

- **Tempo** — conta o tempo decrescente (ex: "Prancha" 45s), avança sozinho.
- **Repetições** — só informativo (ex: "Flexões" × 12); não há forma de o
  sistema verificar quantas repetições fizeste de facto, por isso não conta
  nada — mostra o número e esperas pelo botão "Concluído" para avançar, ao
  teu próprio ritmo. Autodisciplina, não automação.

Descanso configurável entre exercícios e possibilidade de repetir o circuito
inteiro N vezes. Planos podem ser guardados com nome e reutilizados.

Grafismo inspirado na app "Timer Plus": anel de progresso circular grande, tema
escuro, uma cor de destaque por fase (preparação / trabalho / descanso).

## Ficheiros

- `index.html` / `style.css` / `app.js` — a app (vanilla JS, sem dependências,
  sem build step).
- `manifest.json` + `service-worker.js` — tornam a app instalável e utilizável
  offline (cache do app shell).
- `icons/` — ícones gerados com Pillow (`icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png`).

## Correr localmente

```
cd treino_timer/
python3 -m http.server 8000
```

Abre `http://localhost:8000` no telemóvel (mesma rede) ou no browser do PC.

## Instalar no telemóvel Android

1. Hospeda a pasta nalgum lado estático e com HTTPS (Netlify Drop, GitHub Pages,
   etc. — o Service Worker exige HTTPS ou localhost).
2. Abre o link no Chrome do telemóvel.
3. Menu ⋮ → "Adicionar ao ecrã principal" / "Instalar app".

## Notas técnicas

- Sem dependências externas, sem framework — só HTML/CSS/JS.
- Áudio dos beeps gerado via Web Audio API (osciladores), sem ficheiros de som.
- Vibração via Vibration API, mantém o ecrã aceso durante o treino via Wake
  Lock API (com fallback silencioso se o browser não suportar).
- Planos guardados em `localStorage` — não sincroniza entre dispositivos.
