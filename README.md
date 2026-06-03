# ManEng BI — Sistema de Gestão de Manutenção

Sistema web integrado ao Google Sheets para controle de ordens de serviço de manutenção preventiva.

## Estrutura do Projeto

```
maneng-bi/
├── index.html          → Redireciona para login ou dashboard
├── login.html          → Tela de login / auto-cadastro
├── dashboard.html      → Indicadores (estilo Power BI)
├── cronograma.html     → Cronograma visual mensal/anual
├── os.html             → Ordens de Serviço com filtros
├── clientes.html       → Cadastro de clientes/unidades
├── auditoria.html      → Auditoria e faturamento
├── usuarios.html       → Gestão de usuários (Admin)
├── logs.html           → Log de todas as alterações
├── css/main.css        → Estilos globais
├── js/
│   ├── config.js       → Firebase config + constantes
│   ├── auth.js         → Autenticação e controle de acesso
│   └── utils.js        → Funções utilitárias
├── scripts/
│   ├── sync-sheets.js  → Script de sincronização (GitHub Actions)
│   └── package.json
└── .github/workflows/
    └── daily-sync.yml  → Agendamento diário às 02h BRT
```

---

## GUIA DE DEPLOY — Passo a Passo

### ETAPA 1 — Criar o repositório no GitHub

1. Acesse [github.com](https://github.com) e faça login com sua conta
2. Clique em **"New repository"** (botão verde no canto superior direito)
3. Nome do repositório: `maneng-bi`
4. Deixe como **Public** (obrigatório para GitHub Pages gratuito)
5. Clique em **"Create repository"**
6. Na próxima tela, faça upload de todos os arquivos desta pasta arrastando para o navegador

### ETAPA 2 — Ativar GitHub Pages

1. No repositório, clique em **Settings** (engrenagem)
2. No menu lateral esquerdo, clique em **Pages**
3. Em "Source", selecione **Deploy from a branch**
4. Branch: **main** | Folder: **/ (root)**
5. Clique em **Save**
6. Em alguns minutos o site estará em: `https://thaisbarbosamng-svg.github.io/maneng-bi/`

### ETAPA 3 — Configurar Secrets do GitHub Actions

1. No repositório, clique em **Settings → Secrets and variables → Actions**
2. Clique em **"New repository secret"** e adicione os 3 secrets abaixo:

**Secret 1 — GOOGLE_CREDENTIALS**
- Nome: `GOOGLE_CREDENTIALS`
- Valor: cole o conteúdo completo do arquivo `flawless-age-451415-e6-936db9480b79.json`

**Secret 2 — FIREBASE_CREDENTIALS**
- Nome: `FIREBASE_CREDENTIALS`
- Valor: cole o conteúdo do JSON da Service Account Firebase Admin
  - Para gerar: Firebase Console → ⚙️ Project Settings → Service Accounts → "Generate new private key"

**Secret 3 — SPREADSHEET_ID**
- Nome: `SPREADSHEET_ID`
- Valor: `1DlYvpydGGF6S5nxTPe-wzNhSG2A2sofgJgX_UhqBHUE`

### ETAPA 4 — Configurar Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. No projeto, vá em **Authentication → Sign-in method**
3. Ative **"E-mail/senha"** e salve
4. Vá em **Firestore Database → Create database**
5. Selecione **"Start in production mode"** → escolha a região `southamerica-east1 (São Paulo)` → Enable
6. Em **Firestore → Rules**, cole as regras abaixo e publique:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read, write: if request.auth != null &&
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.perfil == 'admin';
    }
    match /{collection}/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.status == 'ativo';
    }
  }
}
```

### ETAPA 5 — Criar o primeiro usuário Admin

1. Acesse o sistema: `https://thaisbarbosamng-svg.github.io/maneng-bi/`
2. Clique em **"Primeiro acesso? Criar conta"** e crie sua conta
3. No Firebase Console → Firestore → coleção `usuarios` → encontre seu documento
4. Edite os campos: `perfil = "admin"` e `status = "ativo"`
5. Faça login no sistema — você terá acesso total

### ETAPA 6 — Executar a primeira sincronização

1. No GitHub, vá em **Actions**
2. Clique em **"Sincronização Diária ManEng"**
3. Clique em **"Run workflow"** → **"Run workflow"**
4. Aguarde alguns minutos — os dados da planilha serão carregados no Firestore
5. Acesse o dashboard — os dados estarão disponíveis

---

## URL do Sistema

```
https://thaisbarbosamng-svg.github.io/maneng-bi/
```

---

## Perfis de Usuário

| Perfil | Acesso |
|--------|--------|
| Admin | Tudo |
| Coordenador | Dashboard, Cronograma, OS, Clientes, Equipes |
| PCM | Cadastro de clientes, geração de cronograma |
| Supervisor | Dashboard, OS da sua supervisão |
| Auditor | Auditoria e faturamento |
| Operador | Somente leitura |

---

## Sincronização

A sincronização entre Google Sheets e o sistema ocorre:
- **Automaticamente** todos os dias às 02h00 (BRT)
- **Manualmente** pelo botão "Run workflow" no GitHub Actions

Direção: Sheets → Firestore (novos dados) + Firestore → Sheets (alterações feitas no sistema)
