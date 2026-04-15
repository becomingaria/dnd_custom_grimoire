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

### Create Users

```bash
# Fill in USER_POOL_ID in .env first
npm run create-users
```

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
- Homebrew spells are private to the creating user.
- Characters and their spellbooks are private to the owning user.
- [Live Site](https://dndcustomgrimoire.netlify.app)
