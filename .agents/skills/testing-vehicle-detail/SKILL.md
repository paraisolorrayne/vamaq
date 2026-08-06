---
name: testing-vehicle-detail
description: Test the vehicle detail page (VehicleDetailView) end-to-end. Use when verifying vehicle page UI, layout, or gallery changes.
---

# Testing Vehicle Detail Page

## Environment

- **Dev server**: `npm run dev` in the repo root (runs on `localhost:3000`)
- **Preview page**: `http://localhost:3000/preview-veiculo` — renders `VehicleDetailView` with mock data (PORSCHE 911 GT3). Use this when the production DB has no vehicles.
- **Production**: `https://vamaq.vercel.app` — only works if vehicles exist in the database. Check `/acervo` first to confirm.
- **Branch**: Test on `main` or the feature branch with changes.

## Key Test Areas

### 1. Hero Section (Desktop ≥1024px)
- Split layout: vehicle info on LEFT, car image on RIGHT
- Cream/tan gradient background (`#F5F0EA` → `#E8E0D4` → `#DDD5C9`)
- Brand (uppercase), model (large italic), version (orange accent `#FF6A00`)
- Year, mileage, price (orange), "FAZER PROPOSTA" CTA button
- Image should NOT overlap text; should be side-by-side

### 2. Dark Gallery Section
- Dark background (`#0A0A0A`), white text
- Sidebar with brand/model/version and tab buttons
- "Imagens" tab (default active): shows horizontal image carousel
- "Informações principais" tab: shows specs list (Quilometragem, Ano, Câmbio, Combustível, Cor, Motor, Potência) + description + performance data
- Tab switching should toggle content without page reload

### 3. Gallery Navigation
- Counter format: "X/N" (e.g., "1/5")
- Right arrow (→) advances counter and scrolls gallery
- Left arrow (←) goes back
- Progress bar width updates proportionally
- Keyboard arrow keys also navigate (when gallery section is focused)

### 4. CTA + Related Vehicles
- "EXPANDA SEU HORIZONTE" eyebrow text
- "CONHECER ACERVO" button linking to `/acervo`
- "Você também pode gostar" section with 3-column vehicle grid on desktop
- Each card: image, brand, model, year, mileage, fuel, transmission, power, price, WhatsApp link

### 5. Responsive (Mobile <768px)
- Hero stacks vertically (image above info)
- Gallery sidebar stacks above images
- Related vehicles stack in single column
- Fixed CTA bar at bottom of screen

## Testing Tips

- The mock preview page (`/preview-veiculo`) is NOT committed to the repo — it may need to be recreated locally if missing. It lives at `src/app/preview-veiculo/page.js`.
- If production has real vehicles, prefer testing on the Vercel deployment for a more realistic test.
- Use browser DevTools responsive mode to test mobile breakpoints (640px, 768px, 1024px, 1280px).
- Gallery images are from Unsplash — they may load slowly on first visit.

## Devin Secrets Needed

No secrets required for local testing. Vercel deployment is automatic on push to main.
