# 📖 DnD Custom Grimoire

A full-stack spell and character management app for D&D 5e players. Manage your spells, build homebrew creations, link spells to characters, and track prepared spells — all in a sleek, video-game-inspired interface.

---

## 🏗️ Architecture

```
dnd_custom_grimoire/
├── backend/           # AWS CDK infrastructure + Lambda functions
│   ├── bin/           # CDK app entry point
│   ├── lib/           # CDK stacks & constructs
│   │   └── constructs/
│   ├── lambdas/       # Lambda function handlers
│   │   ├── shared/    # Shared utilities (response, DynamoDB client)
│   │   ├── spells/    # Spell CRUD handlers
│   │   └── characters/# Character CRUD handlers
│   ├── seed/          # Seed data (spells, characters, users)
│   └── scripts/       # Deployment scripts (seed, create-users)
├── shared/            # Code used by both: spell standard + source registry
├── docs/              # SPELL_STANDARD.md — rules for adding spells
└── frontend/          # React + Vite + Tailwind + Framer Motion
    └── src/
        ├── api/       # API client layer
        ├── components/# UI components
        ├── context/   # Auth context
        ├── hooks/     # Custom React hooks
        ├── pages/     # Route pages
        ├── styles/    # Global CSS
        └── types/     # TypeScript types
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- AWS CLI configured (`aws configure`)
- AWS CDK CLI (`npm install -g aws-cdk`)

### Backend Setup

```bash
cd backend
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy all stacks
npm run deploy
```

After deployment, note the **stack outputs**:
- `GrimoireApiUrl` → API Gateway endpoint
- `GrimoireUserPoolId` → Cognito User Pool ID
- `GrimoireUserPoolClientId` → Cognito App Client ID

### Seed the Database

```bash
# Copy and configure the seed environment
cp .env.example .env
# Fill in SPELLS_TABLE, CHARACTERS_TABLE from stack outputs

npm run seed
```

### Managing Users

Sign-up is invite-only. Admins manage members from the **Admin** page
(`/admin`): invite by email (as a player or admin), resend invites, reset
passwords, promote/demote, disable/enable and delete. Invited members choose
their own password the first time they sign in.

Accounts listed under `ownerEmails` in `backend/cdk.json` can't be demoted,
disabled or deleted through the app, and no admin can change their own access.

To bootstrap the very first admin (or bulk-create accounts) from the CLI:

```bash
# Fill in USER_POOL_ID in .env first
npm run create-users
npm run assign-admins
```

### Patron-only Access (optional)

Admin → **Patreon** can limit the Grimoire to your Patreon patrons. It's off
until you connect it:

1. In the [Patreon developer portal](https://www.patreon.com/portal/registration/register-clients),
   create a client (API v2) as the campaign owner.
2. Paste its Client ID, Client Secret, Creator's Access Token and Creator's
   Refresh Token into the Patreon tab. They're stored encrypted in SSM
   (`/grimoire/patreon/credentials`) and never returned to the browser.
3. Start in **Report only** to see who would lose access, link members whose
   Patreon email differs, and add exemptions. Then switch to **Enforce**.

Members are matched to patrons by email (or a manual link). Admins, owner
accounts and exempt emails always keep access. A sync runs every 6 hours and on
demand. In Enforce mode, non-entitled members are disabled and signed out, and
they're re-enabled when they pledge again. Enforcement is skipped if a sync fails
or Patreon returns no patrons. Switching away from Enforce, or disconnecting,
re-enables everyone the sync disabled.

### Adding Spells

Every spell must meet the [Spell Standard](docs/SPELL_STANDARD.md): required
fields, house style, and a source from the attribution registry. The app, API
and seed scripts all enforce it; `npm run audit:spells:db` reports anything
that has drifted.

### Frontend Setup

```bash
cd frontend
npm install

# Copy and configure environment
cp .env.example .env
# Fill in VITE_API_URL, VITE_USER_POOL_ID, VITE_USER_POOL_CLIENT_ID

npm run dev
```

---

## 🔌 API Endpoints

| Method | Path                       | Description            |
|--------|----------------------------|------------------------|
| GET    | `/spells`                  | List all spells        |
| POST   | `/spells`                  | Create a spell         |
| GET    | `/spells/{spellId}`        | Get a spell            |
| PUT    | `/spells/{spellId}`        | Update a spell         |
| DELETE | `/spells/{spellId}`        | Delete a spell         |
| GET    | `/characters`              | List user's characters |
| POST   | `/characters`              | Create a character     |
| GET    | `/characters/{characterId}`| Get a character        |
| PUT    | `/characters/{characterId}`| Update a character     |
| DELETE | `/characters/{characterId}`| Delete a character     |
| PUT    | `/users/username`          | Set your display name  |
| GET    | `/admin/users`             | List members (admin)   |
| POST   | `/admin/users`             | Invite / re-invite (admin) |
| PUT    | `/admin/users/{username}`  | Change role or enable/disable (admin) |
| DELETE | `/admin/users/{username}`  | Delete member + their characters (admin) |

All endpoints require a valid Cognito JWT Bearer token.

---

## 🧩 Tech Stack

| Layer          | Technology                          |
|----------------|-------------------------------------|
| Infrastructure | AWS CDK v2 (TypeScript)             |
| Database       | AWS DynamoDB (Pay-per-request)      |
| Auth           | AWS Cognito User Pools              |
| API            | AWS API Gateway v2 (HTTP API)       |
| Compute        | AWS Lambda (Node.js 20, TypeScript) |
| Frontend       | React 18 + Vite + TypeScript        |
| Styling        | Tailwind CSS v3                     |
| Animation      | Framer Motion                       |
| State          | TanStack Query (React Query)        |
| Auth Client    | AWS Amplify v6                      |
| Forms          | React Hook Form + Zod               |

---

## 📝 Notes

- Non-homebrew spells seeded from the SRD are visible to all users.
- Homebrew spells are private to their author unless the author ticks
  "Share with other members" (this includes homebrew created before sharing
  existed). A spell already in one of your characters' spellbooks stays
  visible to you even if its author later makes it private. Admins see all.
- Characters and their spellbooks are private to the owning user.
- [Live Site](https://dndcustomgrimoire.netlify.app)
