# Faaruuq-Hospital-managment

Hospital Management System (HMS) for FSH Hospital — React, TypeScript, Vite, and Supabase.

## Features

- Reception, doctor, nurse, laboratory, pharmacy, and admin workflows
- Patient registration, visits, lab, surgery, and inpatient management
- Supabase-backed data sync with offline-capable store

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and set your Supabase credentials
3. Install dependencies: `npm install`
4. Run migrations in `supabase/migrations/` via Supabase SQL Editor
5. Start dev server: `npm run dev`

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run preview` — preview production build
