# UOL Secure Email System - Complete Features Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Core Email Features](#core-email-features)
3. [Security Features](#security-features)
4. [Privacy Features](#privacy-features)
5. [Email Management Features](#email-management-features)
6. [User Settings & Customization](#user-settings--customization)
7. [Authentication & Account Management](#authentication--account-management)
8. [Code Locations](#code-locations)
9. [Navigation Guide](#navigation-guide)
10. [API Endpoints](#api-endpoints)

---

## Introduction

The UOL Secure Email System is a comprehensive, secure email platform built with modern web technologies. It provides end-to-end encryption, blockchain-based verification, disposable email addresses, secure vault functionality, and advanced spam/phishing protection.

**Technology Stack:**
- **Frontend:** React.js with Vite, Tailwind CSS
- **Backend:** Node.js with Express.js
- **Database:** MongoDB with Mongoose
- **Authentication:** JWT (JSON Web Tokens)
- **Encryption:** RSA-2048 for E2E encryption, AES-256-GCM for key storage

---

## Core Email Features

### 1. Compose Email
**Location:** `/compose` or click "Compose" in sidebar

**Features:**
- Send emails to multiple recipients (To, CC, BCC)
- Rich text email composition
- File attachments support
- Self-destruct timer options (1 min, 5 min, 1 hour, 1 day)
- End-to-end encryption toggle
- Auto-save drafts functionality
- Edit existing drafts

**Code Location:**
- Frontend: `frontend/src/pages/dashboard/Compose.jsx`
- Backend: `backend/src/controllers/emailController.js` → `sendEmail()`
- Route: `POST /api/email/send`

**How to Access:**
1. Click "Compose" button in the sidebar
2. Or navigate to `/compose` URL
3. Fill in recipient(s), subject, and message
4. Optionally enable encryption or set self-destruct timer
5. Click "Send Email"

---

### 2. Inbox
**Location:** `/dashboard` (default route)

**Features:**
- View all received emails
- Unread email count badge
- Search functionality
- Email filtering
- Mark as read/unread
- Delete emails (moves to trash)
- Reply and Forward options
- View email details
- AI-powered spam detection indicators

**Code Location:**
- Frontend: `frontend/src/pages/dashboard/Inbox.jsx`
- Backend: `backend/src/controllers/emailController.js` → `getEmails()`
- Route: `GET /api/email?folder=inbox`

**How to Access:**
1. Click "Inbox" in sidebar (default view)
2. Or navigate to `/dashboard`
3. Click on any email to view details
4. Use search bar to find specific emails

---

### 3. Sent Emails
**Location:** `/sent`

**Features:**
- View all sent emails
- Delivery status tracking (pending, delivered, failed)
- Retry failed emails
- View sent email details
- Search sent emails

**Code Location:**
- Frontend: `frontend/src/pages/dashboard/Sent.jsx`
- Backend: `backend/src/controllers/emailController.js` → `getEmails()`
- Route: `GET /api/email?folder=sent`

**How to Access:**
1. Click "Sent" in sidebar
2. Or navigate to `/sent`
3. View delivery status for each email
4. Click "Retry" for failed emails

---

### 4. Drafts
**Location:** `/drafts`

**Features:**
- View all saved drafts
- Auto-save every 30 seconds while composing
- Edit existing drafts
- Delete drafts
- Continue composing from draft

**Code Location:**
- Frontend: `frontend/src/pages/dashboard/Drafts.jsx`
- Backend: `backend/src/controllers/emailController.js` → `saveDraft()`, `getDrafts()`, `deleteDraft()`
- Routes: 
  - `POST /api/email/save-draft`
  - `GET /api/email/drafts`
  - `DELETE /api/email/draft/:id`

**How to Access:**
1. Click "Drafts" in sidebar
2. Or navigate to `/drafts`
3. Click on any draft to edit
4. Drafts are auto-saved while composing

---

### 5. Trash Bin
**Location:** `/trash`

**Features:**
- View soft-deleted emails
- Restore deleted emails
- Permanently delete emails
- Automatic cleanup after 30 days
- Search trash emails

**Code Location:**
- Frontend: `frontend/src/pages/dashboard/Trash.jsx`
- Backend: `backend/src/controllers/emailController.js` → `getTrash()`, `restoreEmail()`, `permanentDeleteEmail()`
- Routes:
  - `GET /api/email/trash`
  - `POST /api/email/restore/:id`
  - `DELETE /api/email/permanent/:id`

**How to Access:**
1. Click "Trash" in sidebar
2. Or navigate to `/trash`
3. Click "Restore" to move email back to inbox
4. Click "Delete Permanently" to permanently remove

---

## Security Features

### 1. End-to-End Encryption (E2E)
**Location:** Settings → Security → End-to-End Encryption Keys

**Features:**
- RSA-2048 key pair generation
- Public key stored in user profile
- Private key encrypted with user password (AES-256-GCM)
- Encrypt emails before sending
- Decrypt received encrypted emails
- Lock icon indicator for encrypted emails
- Password-protected decryption

**Code Location:**
- Frontend: 
  - Settings: `frontend/src/pages/dashboard/Settings.jsx`
  - Compose: `frontend/src/pages/dashboard/Compose.jsx` (encrypt toggle)
  - Viewer: `frontend/src/components/email/EmailViewer.jsx` (decryption)
- Backend:
  - Key Generation: `backend/src/controllers/encryptionController.js`
  - Encryption Utils: `backend/src/utils/encryption.js`
  - Email Encryption: `backend/src/controllers/emailController.js` → `sendEmail()`
- Routes:
  - `POST /api/email/generate-keys`
  - `GET /api/email/public-key`
  - `POST /api/email/decrypt/:id`

**How to Access:**
1. Go to Settings → Security tab
2. Scroll to "End-to-End Encryption Keys"
3. Click "Generate Keys" (if not already generated)
4. Enter your password
5. Keys will be generated automatically
6. When composing, toggle "Encrypt Email" to enable encryption
7. When viewing encrypted emails, enter password to decrypt

**Note:** Both sender and recipient must have encryption keys generated to use E2E encryption.

---

### 2. Blockchain-Based Email Verification
**Location:** Email detail view → "Verify Authenticity" button

**Features:**
- Hash-chain blockchain ledger
- Content integrity verification
- Tamper detection
- Verification status badge (Verified/Tampered)
- SHA-256 hashing for email content

**Code Location:**
- Frontend: `frontend/src/components/email/EmailViewer.jsx`
- Backend: 
  - `backend/src/utils/blockchain.js`
  - `backend/src/controllers/emailController.js` → `verifyEmail()`, `sendEmail()`
- Route: `GET /api/email/verify/:id`

**How to Access:**
1. Open any email in inbox/sent
2. Click "Verify Authenticity" button
3. View verification status badge
4. Green "Verified" = content is authentic
5. Red "Tampered" = content has been modified

---

### 3. Secure Email Vault
**Location:** `/vault` or "Secure Vault" in sidebar

**Features:**
- PIN-protected private inbox (4-digit PIN)
- Move emails to vault for extra security
- Remove emails from vault
- PIN hashing with bcrypt
- Token-based vault access (1-hour session)
- Separate from regular inbox

**Code Location:**
- Frontend: `frontend/src/pages/dashboard/Vault.jsx`
- Backend: `backend/src/controllers/vaultController.js`
- Routes:
  - `POST /api/vault/set-pin`
  - `POST /api/vault/verify-pin`
  - `GET /api/vault/emails`
  - `POST /api/vault/move/:emailId`
  - `POST /api/vault/remove/:emailId`

**How to Access:**
1. First, set PIN in Settings → Security → Secure Vault PIN
2. Click "Secure Vault" in sidebar
3. Enter 4-digit PIN
4. View private emails in vault
5. Move emails to vault from email detail view
6. Remove emails from vault when done

---

### 4. AI-Powered Spam & Phishing Detection
**Location:** Automatic (all emails)

**Features:**
- Real-time email analysis
- Spam probability scoring
- Phishing detection
- Threat level classification
- Automatic spam folder routing
- Visual indicators (spam/phishing badges)
- Confidence scoring

**Code Location:**
- Backend: `backend/src/utils/aiAnalysis.js`
- Email Controller: `backend/src/controllers/emailController.js` → `sendEmail()`
- Frontend: `frontend/src/components/email/EmailItem.jsx`, `EmailViewer.jsx`

**How to Access:**
- Automatic on all incoming emails
- Spam emails automatically moved to Spam folder
- Phishing emails marked with warning badge
- View analysis details in email viewer

---

## Privacy Features

### 1. Disposable Email Addresses
**Location:** Settings → Privacy → Disposable Email Addresses

**Features:**
- Generate temporary email addresses
- Custom expiration time (1-720 hours)
- Usage tracking
- Automatic cleanup of expired addresses
- Copy email address to clipboard
- Emails received on disposable addresses marked with badge
- Privacy protection

**Code Location:**
- Frontend: `frontend/src/pages/dashboard/PrivacySettings.jsx`
- Backend: `backend/src/controllers/privacyController.js`
- Model: `backend/src/models/TemporaryEmail.js`
- Routes:
  - `POST /api/privacy/create-temp-email`
  - `GET /api/privacy/temp-emails`
  - `DELETE /api/privacy/temp-email/:id`

**How to Access:**
1. Go to Settings → Privacy tab
2. Scroll to "Disposable Email Addresses" section
3. Set expiration hours (default: 24)
4. Click "Generate Disposable Email"
5. Copy the generated email address
6. Use it for sign-ups or temporary communications
7. Emails sent to this address appear in your inbox with "Disposable Address" badge

---

### 2. Self-Destruct Timer
**Location:** Compose screen → Self-Destruct Timer dropdown

**Features:**
- Set automatic deletion time
- Options: 1 minute, 5 minutes, 1 hour, 1 day
- Default timer from settings
- Visual indicator in email
- Automatic cleanup via cron job

**Code Location:**
- Frontend: `frontend/src/pages/dashboard/Compose.jsx`
- Backend: `backend/src/controllers/emailController.js` → `sendEmail()`
- Cleanup: `backend/src/jobs/emailCleanup.js`

**How to Access:**
1. Open Compose screen
2. Find "Self-Destruct Timer" dropdown
3. Select desired time (1 min, 5 min, 1 hour, 1 day)
4. Email will auto-delete after selected time
5. Set default timer in Settings → Privacy

---

### 3. Blocked Senders
**Location:** Settings → Privacy → Blocked Senders

**Features:**
- Add email addresses to block list
- Automatic spam folder routing
- Remove blocked senders
- Email validation
- List management

**Code Location:**
- Frontend: `frontend/src/pages/dashboard/PrivacySettings.jsx`
- Backend: `backend/src/controllers/settingsController.js`
- Route: `PUT /api/settings`

**How to Access:**
1. Go to Settings → Privacy tab
2. Find "Blocked Senders" section
3. Enter email address to block
4. Click "Block" button
5. Blocked emails automatically moved to spam
6. Click "X" to unblock

---

### 4. External Images Control
**Location:** Settings → Privacy → External Images

**Features:**
- Disable automatic image loading
- Privacy protection from tracking pixels
- Toggle switch interface

**Code Location:**
- Frontend: `frontend/src/pages/dashboard/PrivacySettings.jsx`
- Backend: `backend/src/controllers/settingsController.js`

**How to Access:**
1. Go to Settings → Privacy tab
2. Find "External Images" section
3. Toggle "Disable External Image Loading"
4. Prevents senders from tracking email opens

---

## Email Management Features

### 1. Email Search
**Location:** All email views (Inbox, Sent, Drafts, Trash, Vault)

**Features:**
- Real-time search across emails
- Search by sender, subject, content
- Filter results
- Search in all folders

**Code Location:**
- Frontend: All email list components filter by search query
- Components: `frontend/src/components/email/EmailList.jsx`

**How to Access:**
- Use search bar at top of any email folder
- Type keywords to filter emails

---

### 2. Email Actions
**Location:** Email detail view

**Features:**
- Reply to email
- Forward email
- Delete email (move to trash)
- Mark as spam
- Move to vault
- Verify authenticity
- Decrypt encrypted emails

**Code Location:**
- Frontend: `frontend/src/components/email/EmailViewer.jsx`
- Backend: `backend/src/controllers/emailController.js`

**How to Access:**
1. Open any email
2. Use action buttons in email header
3. Reply, Forward, Delete, etc.

---

### 3. Email Status Indicators
**Location:** All email lists

**Features:**
- Unread/Read indicators
- Encrypted email lock icon
- Spam badge
- Phishing warning badge
- Disposable address badge
- Delivery status (for sent emails)

**Code Location:**
- Frontend: `frontend/src/components/email/EmailItem.jsx`

---

## User Settings & Customization

### 1. Account Settings
**Location:** Settings → Account tab

**Features:**
- View account email
- View account creation date
- Language selection (English, Spanish, French)
- Timezone settings

**Code Location:**
- Frontend: `frontend/src/pages/dashboard/Settings.jsx`
- Backend: `backend/src/controllers/settingsController.js`

**How to Access:**
1. Click Settings in sidebar
2. Go to Account tab
3. View and update account information

---

### 2. Notification Settings
**Location:** Settings → Notifications tab

**Features:**
- New email notifications toggle
- Important email alerts toggle
- Security alerts toggle
- Email notification preferences

**Code Location:**
- Frontend: `frontend/src/pages/dashboard/Settings.jsx`
- Backend: `backend/src/controllers/settingsController.js`

**How to Access:**
1. Go to Settings → Notifications tab
2. Toggle notification preferences
3. Click "Save Settings"

---

### 3. Privacy Settings
**Location:** Settings → Privacy tab

**Features:**
- Default self-destruct timer
- Blocked senders list
- External images control
- Auto-mark spam/phishing
- Disposable email management

**Code Location:**
- Frontend: `frontend/src/pages/dashboard/PrivacySettings.jsx`
- Backend: `backend/src/controllers/settingsController.js`, `privacyController.js`

**How to Access:**
1. Go to Settings → Privacy tab
2. Configure all privacy options
3. Click "Save Settings"

---

## Authentication & Account Management

### 1. User Registration
**Location:** `/register`

**Features:**
- Email validation
- Password strength requirements (8+ chars, uppercase, lowercase, number)
- Password confirmation
- Automatic encryption key generation
- Email verification (optional)

**Code Location:**
- Frontend: `frontend/src/pages/auth/Register.jsx`
- Backend: `backend/src/controllers/authController.js` → `register()`
- Route: `POST /api/auth/register`

**How to Access:**
1. Navigate to `/register`
2. Enter email and password
3. Confirm password
4. Click "Register"
5. Automatic login after registration

---

### 2. User Login
**Location:** `/login`

**Features:**
- Email/password authentication
- JWT token generation
- Account lockout after 5 failed attempts (15 minutes)
- Login attempt tracking
- Last login timestamp

**Code Location:**
- Frontend: `frontend/src/pages/auth/Login.jsx`
- Backend: `backend/src/controllers/authController.js` → `login()`
- Route: `POST /api/auth/login`

**How to Access:**
1. Navigate to `/login`
2. Enter email and password
3. Click "Login"
4. Redirected to dashboard on success

---

### 3. Password Change
**Location:** Settings → Security → Password

**Features:**
- Change account password
- Current password verification
- New password validation
- Password confirmation

**Code Location:**
- Frontend: `frontend/src/pages/dashboard/Settings.jsx`
- Backend: `backend/src/controllers/authController.js` → `changePassword()`
- Route: `PUT /api/auth/change-password`

**How to Access:**
1. Go to Settings → Security tab
2. Find "Password" section
3. Click "Change" button
4. Enter current password, new password, confirm
5. Click "Change Password"

---

### 4. Logout
**Location:** Sidebar → Logout button

**Features:**
- Clear authentication tokens
- Clear user data from localStorage
- Redirect to login page

**Code Location:**
- Frontend: `frontend/src/components/layout/Sidebar.jsx`

**How to Access:**
1. Click "Logout" in sidebar
2. Confirmed logout and redirect to login

---

## Code Locations

### Frontend Structure

```
frontend/src/
├── api/
│   └── api.js                    # API client configuration
├── components/
│   ├── email/
│   │   ├── EmailItem.jsx         # Email list item component
│   │   ├── EmailList.jsx          # Email list container
│   │   └── EmailViewer.jsx        # Email detail viewer
│   └── layout/
│       ├── DashboardLayout.jsx    # Main dashboard layout
│       └── Sidebar.jsx           # Navigation sidebar
├── pages/
│   ├── auth/
│   │   ├── Login.jsx             # Login page
│   │   └── Register.jsx          # Registration page
│   └── dashboard/
│       ├── Compose.jsx           # Compose email page
│       ├── Drafts.jsx           # Drafts folder
│       ├── Inbox.jsx             # Inbox folder
│       ├── PrivacySettings.jsx   # Privacy settings
│       ├── Sent.jsx              # Sent folder
│       ├── Settings.jsx          # Main settings page
│       ├── Trash.jsx             # Trash folder
│       └── Vault.jsx             # Secure vault
├── router/
│   └── routes.jsx                # Application routes
└── utils/
    ├── formatTimestamp.js        # Date formatting
    ├── settings.js               # Settings cache
    └── toast.js                  # Toast notifications
```

### Backend Structure

```
backend/src/
├── config/
│   └── db.js                     # Database connection
├── controllers/
│   ├── authController.js         # Authentication logic
│   ├── emailController.js        # Email operations
│   ├── encryptionController.js   # E2E encryption
│   ├── privacyController.js      # Privacy/disposable emails
│   ├── settingsController.js     # User settings
│   └── vaultController.js        # Secure vault
├── jobs/
│   └── emailCleanup.js           # Scheduled cleanup jobs
├── middleware/
│   └── authMiddleware.js          # JWT authentication
├── models/
│   ├── Email.js                  # Email schema
│   ├── TemporaryEmail.js         # Disposable email schema
│   ├── User.js                   # User schema
│   └── UserSettings.js           # Settings schema
├── routes/
│   ├── authRoutes.js             # Auth endpoints
│   ├── emailRoutes.js            # Email endpoints
│   ├── privacyRoutes.js          # Privacy endpoints
│   ├── settingsRoutes.js         # Settings endpoints
│   └── vaultRoutes.js            # Vault endpoints
├── utils/
│   ├── aiAnalysis.js             # Spam/phishing detection
│   ├── blockchain.js             # Blockchain ledger
│   ├── encryption.js             # Encryption utilities
│   └── jwt.js                    # JWT token management
└── server.js                     # Express server setup
```

---

## Navigation Guide

### Main Navigation (Sidebar)

1. **Inbox** (`/dashboard`)
   - Default view
   - Shows all received emails
   - Unread count badge

2. **Sent** (`/sent`)
   - All sent emails
   - Delivery status

3. **Drafts** (`/drafts`)
   - Saved draft emails
   - Auto-saved while composing

4. **Trash** (`/trash`)
   - Soft-deleted emails
   - Restore or permanent delete

5. **Secure Vault** (`/vault`)
   - PIN-protected private emails
   - Requires PIN setup first

6. **Compose** (`/compose`)
   - Create new email
   - Edit drafts

7. **Settings** (`/settings`)
   - Account, Security, Privacy, Notifications tabs

8. **Logout**
   - Sign out of account

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `PUT /api/auth/change-password` - Change password

### Email Operations
- `POST /api/email/send` - Send email
- `GET /api/email` - Get emails by folder
- `GET /api/email/:id` - Get email by ID
- `DELETE /api/email/:id` - Delete email (soft delete)
- `POST /api/email/:id/retry` - Retry failed email
- `POST /api/email/:id/spam` - Mark as spam
- `GET /api/email/verify/:id` - Verify email authenticity

### Drafts
- `POST /api/email/save-draft` - Save draft
- `GET /api/email/drafts` - Get all drafts
- `DELETE /api/email/draft/:id` - Delete draft

### Trash
- `GET /api/email/trash` - Get trash emails
- `POST /api/email/restore/:id` - Restore email
- `DELETE /api/email/permanent/:id` - Permanent delete

### Encryption
- `POST /api/email/generate-keys` - Generate encryption keys
- `GET /api/email/public-key` - Get public key status
- `POST /api/email/decrypt/:id` - Decrypt email

### Vault
- `POST /api/vault/set-pin` - Set vault PIN
- `POST /api/vault/verify-pin` - Verify PIN
- `GET /api/vault/emails` - Get vault emails
- `POST /api/vault/move/:emailId` - Move email to vault
- `POST /api/vault/remove/:emailId` - Remove from vault

### Privacy
- `POST /api/privacy/create-temp-email` - Create disposable email
- `GET /api/privacy/temp-emails` - Get disposable emails
- `DELETE /api/privacy/temp-email/:id` - Delete disposable email

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings

---

## Feature Summary Table

| Feature | Location | Code File | API Endpoint |
|---------|----------|-----------|--------------|
| Compose Email | `/compose` | `Compose.jsx` | `POST /api/email/send` |
| Inbox | `/dashboard` | `Inbox.jsx` | `GET /api/email?folder=inbox` |
| Sent | `/sent` | `Sent.jsx` | `GET /api/email?folder=sent` |
| Drafts | `/drafts` | `Drafts.jsx` | `GET /api/email/drafts` |
| Trash | `/trash` | `Trash.jsx` | `GET /api/email/trash` |
| Secure Vault | `/vault` | `Vault.jsx` | `GET /api/vault/emails` |
| E2E Encryption | Settings → Security | `encryptionController.js` | `POST /api/email/generate-keys` |
| Blockchain Verification | Email viewer | `blockchain.js` | `GET /api/email/verify/:id` |
| Disposable Emails | Settings → Privacy | `privacyController.js` | `POST /api/privacy/create-temp-email` |
| Self-Destruct Timer | Compose screen | `Compose.jsx` | Included in send |
| Blocked Senders | Settings → Privacy | `PrivacySettings.jsx` | `PUT /api/settings` |
| Password Change | Settings → Security | `Settings.jsx` | `PUT /api/auth/change-password` |

---

## Security Best Practices Implemented

1. **Password Security**
   - Bcrypt hashing (10 rounds)
   - Minimum 8 characters
   - Uppercase, lowercase, number required
   - Account lockout after 5 failed attempts

2. **Encryption**
   - RSA-2048 for E2E encryption
   - AES-256-GCM for private key storage
   - PBKDF2 for key derivation (100,000 iterations)

3. **Authentication**
   - JWT tokens with expiration
   - Refresh token mechanism
   - Secure token storage

4. **Data Protection**
   - Soft delete (trash functionality)
   - PIN-protected vault
   - Encrypted private keys
   - Blockchain verification

5. **Privacy**
   - Disposable email addresses
   - External image blocking
   - Self-destruct emails
   - Blocked senders

---

## Automated Jobs

### Email Cleanup
- **Location:** `backend/src/jobs/emailCleanup.js`
- **Schedule:** Daily at 2 AM
- **Function:** Permanently delete emails in trash older than 30 days

### Temporary Email Cleanup
- **Location:** `backend/src/jobs/emailCleanup.js`
- **Schedule:** Hourly
- **Function:** Delete expired temporary email addresses

### Self-Destruct Cleanup
- **Location:** `backend/src/jobs/emailCleanup.js`
- **Schedule:** Every 5 minutes
- **Function:** Delete emails past their self-destruct time

---

## Notes

- All timestamps are stored in UTC and converted to user's timezone
- Email attachments are currently stored as metadata (file encryption for attachments is placeholder)
- Blockchain ledger is stored in `backend/data/email_ledger.json`
- Private keys are encrypted with user password and cannot be recovered if password is lost
- Disposable emails expire automatically based on set expiration time
- Vault PIN session expires after 1 hour of inactivity

---

## Support & Troubleshooting

### Common Issues

1. **"Recipient does not have encryption keys"**
   - Solution: Recipient must generate keys in Settings → Security → End-to-End Encryption Keys

2. **Cannot access Vault**
   - Solution: Set PIN first in Settings → Security → Secure Vault PIN

3. **Drafts not saving**
   - Solution: Check internet connection, drafts auto-save every 30 seconds

4. **Email not appearing in inbox**
   - Solution: Check spam folder, verify recipient email is correct

---

**Document Version:** 1.0  
**Last Updated:** Week 10  
**Application Version:** UOL Secure Email System v1.0

