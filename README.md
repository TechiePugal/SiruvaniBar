# 🍺 Siruvani Bar & Kitchen — POS System

A full-featured, multi-outlet bar management POS built with **React JS + Firebase**, featuring an Apple-inspired dark UI with gold accents.

---

## 📁 Project Structure

```
src/
├── firebase.js                  ← Firebase config & exports
├── App.js                       ← Router + Auth guard
├── index.js                     ← React entry point
├── styles/
│   └── globals.css              ← All CSS (dark theme, components)
├── contexts/
│   └── AuthContext.js           ← Google Auth + Shop state
├── components/
│   └── Sidebar.js               ← Navigation sidebar
└── pages/
    ├── LoginPage.js             ← Google sign-in
    ├── Dashboard.js             ← KPI overview + charts
    ├── ShopsPage.js             ← Create/manage outlets
    ├── SalesPage.js             ← Daily sales entry
    ├── InvoicePage.js           ← Invoices + Quotations
    ├── ExpensePage.js           ← Expense tracking
    ├── PurchasePage.js          ← TASMAC purchase records
    ├── InventoryPage.js         ← Stock management + COGS
    ├── DayEndPage.js            ← Daily cash reconciliation
    ├── ReportsPage.js           ← P&L, Sales, Expenses, Growth
    ├── BankDepositPage.js       ← Bank deposit tracker
    ├── StaffPage.js             ← Staff access management
    └── SettingsPage.js          ← Lease mode + shop config
```

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm start

# 3. Build for production
npm run build
```

---

## 🔥 Firebase Setup

### 1. Authentication
Enable **Google Sign-In** in Firebase Console → Authentication → Sign-in methods.

### 2. Firestore Database
Create a Firestore database in **production mode**, then apply these security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    // Shops: owner has full access; members have read access
    match /shops/{shopId} {
      allow read: if request.auth != null &&
        (resource.data.ownerId == request.auth.uid ||
         request.auth.token.email in resource.data.memberEmails);

      allow create: if request.auth != null;

      allow update, delete: if request.auth != null &&
        resource.data.ownerId == request.auth.uid;

      // All subcollections follow shop access rules
      match /{subcollection}/{docId} {
        allow read: if request.auth != null && (
          get(/databases/$(database)/documents/shops/$(shopId)).data.ownerId == request.auth.uid ||
          request.auth.token.email in get(/databases/$(database)/documents/shops/$(shopId)).data.memberEmails
        );
        allow write: if request.auth != null && (
          get(/databases/$(database)/documents/shops/$(shopId)).data.ownerId == request.auth.uid ||
          request.auth.token.email in get(/databases/$(database)/documents/shops/$(shopId)).data.memberEmails
        );
      }
    }
  }
}
```

### 3. Firestore Indexes
You'll need these **composite indexes** (Firebase will prompt you with links on first query error):

| Collection | Fields | Order |
|---|---|---|
| `shops/{id}/sales` | `date` ▼, `createdAt` ▼ | DESC |
| `shops/{id}/expenses` | `date` ▼, `category` ▲ | Mixed |
| `shops/{id}/purchases` | `date` ▼ | DESC |
| `shops/{id}/inventory` | `date` ▼ | DESC |
| `shops/{id}/day_end` | `date` ▼ | DESC |
| `shops/{id}/bank_deposits` | `date` ▼ | DESC |

---

## 🗄️ Database Schema

```
/users/{uid}
  displayName, email, photoURL, createdAt

/shops/{shopId}
  name, type, address, phone, gstNumber, fssaiNumber
  ownerId, members[], memberEmails[]
  settings: {
    leaseMode, leaseDailyAmount, lesseeName, lesseePhone,
    lesseeAddress, leaseStartDate, leaseEndDate,
    openingTime, closingTime, taxRate, serviceCharge,
    lowStockAlert, dayEndReminder, reminderTime
  }

/shops/{shopId}/sales/{id}
  date, time, beer, spirits, wine, food, cigarettes,
  cool_drinks, ac_charges, other, total_amount,
  payment_cash, payment_bank, lease_mode_snapshot

/shops/{shopId}/expenses/{id}
  date, category, subCategory, amount, paymentMode,
  paidTo, notes

/shops/{shopId}/purchases/{id}
  date, type (tasmac/cigarette/cooldrink), vendorName,
  invoiceNo, amount, paymentMode

/shops/{shopId}/inventory/{id}
  date, opening_stock, purchases_added, closing_stock, cogs

/shops/{shopId}/day_end/{id}
  date, cash_expected, cash_actual, cash_variance,
  paytm_qr1_expected, paytm_qr1_actual,
  paytm_qr2_expected, paytm_qr2_actual,
  notes, locked, lockedAt

/shops/{shopId}/invoices/{id}
  type (invoice/quotation), partyName, partyAddress,
  partyPhone, partyGST, date, dueDate, items[],
  subtotal, taxRate, taxAmount, discount, grandTotal,
  status, paidAt, notes

/shops/{shopId}/bank_deposits/{id}
  date, depositType, amount, bankName, accountNumber,
  referenceNumber, depositedBy, linkedTo, linkedDate,
  status, notes

/shops/{shopId}/staff/{id}
  name, email, phone, role, status, invitedAt
```

---

## ✨ Features

### 🏠 Admin Dashboard
- KPI cards: Revenue, Sales Count, Expenses, Net Profit, Cash, Bank, COGS, Pending Bills
- Weekly revenue area chart (Recharts)
- Category sales pie chart
- Recent sales table
- Quick action grid

### 🏪 Multi-Shop Management
- Create unlimited bar/restaurant outlets
- Owner control over all shops
- Assign staff with email-based access
- Per-shop settings & lease mode

### 💰 Sales Entry
- Categories: Beer, Spirits, Wine, Food, Cigarettes, Cool Drinks, AC Charges, Other
- Lease mode hides kitchen categories
- Cash + Bank (UPI) payment split
- Balance validation (must equal total)

### 📄 Invoices & Quotations
- Line items with qty, rate, amount
- Tax % and discount %
- PDF print (browser print dialog)
- Mark as paid with date tracking
- Convert quotation → invoice

### 🛒 Purchase Records
- TASMAC liquor purchases
- Cigarette & cool drink purchases
- Payment modes: Cash, Bank Deposit, DD
- Vendor & invoice reference tracking

### 💸 Expense Tracking
- Categories: Kitchen, Utilities, Staff, Maintenance, Rent, Other
- Sub-categories per parent
- Kitchen hidden in lease mode
- Date range filtering

### 📦 Inventory Management
- Opening stock → Purchases → Closing stock
- Auto COGS calculation
- Historical records with variance

### 🌙 Day End Reconciliation
- Cash drawer: expected vs actual
- Paytm QR1 & QR2 reconciliation
- Variance highlighting (red if > ₹500)
- Mandatory notes for large variances
- Locked record — cannot edit after confirmation

### 📊 Reports
- **P&L Report**: Revenue, COGS, Gross Profit, Expenses, Net Profit
- **Sales Analysis**: Daily trend + category pie + payment split
- **Expense Breakdown**: Bar chart + category table
- **Growth Metrics**: MoM revenue, expenses, profit growth

### 🏦 Bank Deposits
- Track cash/DD/NEFT deposits
- Link to sales or purchase dates
- Confirm deposit status
- Running totals

### 👥 Staff Management
- Add staff by email (Google account)
- Roles: Manager, Cashier, Staff
- Activate/deactivate access
- Role-based UI visibility

### ⚙️ Settings
- Lease mode toggle with daily amount
- Lessee name, phone, address, dates
- Shop info & compliance numbers
- Business hours
- Tax rates & billing defaults
- Notification preferences

---

## 🎨 Design System

| Token | Value |
|---|---|
| Background | `#0a0a0a` |
| Surface | `#1c1c1e` |
| Surface Elevated | `#2c2c2e` |
| Gold Accent | `#d4a017` |
| Border | `#3a3a3c` |
| Text Primary | `#f5f5f7` |
| Text Secondary | `#8e8e93` |
| Success | `#34c759` |
| Danger | `#ff3b30` |
| Warning | `#ff9f0a` |
| Heading Font | Syne (Google) |
| Body Font | DM Sans (Google) |

---

## 📱 Responsive

- **Desktop**: Full sidebar + content layout
- **Tablet**: Collapsible sidebar with overlay
- **Mobile**: Top hamburger bar + full-screen sidebar drawer

---

## 🚢 Deployment (Firebase Hosting)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize (select Hosting, use build/ folder)
firebase init hosting

# Build & deploy
npm run build
firebase deploy
```

---

## 📋 Business Rules

1. **No credit sales** — Cash or Bank (UPI) only
2. **Lease Mode ON** → Food, Cigarettes, Cool Drinks, AC Charges hidden; daily lease income auto-applied
3. **Lease Mode OFF** → All categories visible, owner operates kitchen
4. `lease_mode_snapshot` saved per sales entry for historical accuracy
5. **Day End locked** after confirmation — cannot edit
6. Day End variance > ₹500 requires mandatory notes

---

*Built with React 18 + Firebase 10 + Recharts + date-fns + react-hot-toast + jsPDF*
