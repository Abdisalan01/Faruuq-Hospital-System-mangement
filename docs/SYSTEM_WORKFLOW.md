# FSH Hospital HMS — System Workflow Chart

> **Ujeeddo:** Qaab-dhismeedka nidaamka si backend loo xiro frontend-ka.  
> **Frontend:** React/TypeScript (`src/`) — hadda xogtu waa **in-memory** (`hmsStore.ts`).  
> **Backend:** API waa inuu beddelaa store-ka — isla workflow-ga hoos ku qoran.

---

## 1. Guud — Nidaamka Hospital-ka

```mermaid
flowchart TB
    subgraph AUTH["🔐 Authentication"]
        LOGIN[Login API] --> ROLE[Role + Permissions]
    end

    subgraph CORE["🏥 Core Clinical"]
        REG[Patient Registration]
        VISIT[Visit / Queue]
        CONSULT[Consultation]
        REG --> VISIT --> CONSULT
    end

    subgraph ORDERS["📋 Clinical Orders"]
        RX[Prescription]
        LAB[Lab Request]
        SURG[Surgery Request]
        ADM[Admission Request]
        CONSULT --> RX
        CONSULT --> LAB
        CONSULT --> SURG
        CONSULT --> ADM
    end

    subgraph PAY["💰 Reception / Billing"]
        BILL[Consultation Fee]
        LABPAY[Lab Fees]
        SURGPAY[Surgery Payment]
        INPBILL[Inpatient Billing]
        CREDIT[Credit Accounts]
    end

    subgraph FULFILL["✅ Fulfillment"]
        PHARM[Pharmacy Dispense]
        LABPROC[Lab Process Results]
        SURGCOMP[Surgery Completed]
        NURSE[Nursing / Inpatient Care]
    end

    subgraph ADMIN["⚙️ Administration"]
        CATALOG[Catalogs: Lab / Medicine / Surgery]
        USERS[Users & Settings]
        REPORTS[Reports & Accounting]
    end

    ROLE --> REG
    LAB --> LABPAY --> LABPROC
    SURG --> SURGPAY --> SURGCOMP
    RX --> PHARM
    ADM --> INPBILL --> NURSE
    VISIT --> BILL
    ROLE --> ADMIN
```

---

## 2. Workflow-ga Bukaanka (Outpatient)

```mermaid
flowchart LR
    A["1. Reception<br/>Register Patient"] --> B["2. Visit Created<br/>Status: Waiting"]
    B --> C["3. Doctor<br/>Start Consultation<br/>Status: In Consultation"]
    C --> D{Orders?}

    D -->|Prescription| E["Pharmacy Pending"]
    D -->|Lab| F["Lab: Awaiting Payment"]
    D -->|Surgery| G["Surgery: Pending"]
    D -->|None| H["Completed Consultation"]

    F --> I["Reception<br/>Collect Lab Fee"]
    I --> J["Lab: Pending"]
    J --> K["Lab Staff<br/>In Progress"]
    K --> L["Lab: Completed"]
    L --> H

    G --> M["Reception<br/>Pay + Schedule"]
    M --> N["Surgery: Scheduled"]
    N --> O["Doctor/Reception<br/>Mark Completed"]
    O --> H

    E --> P["Pharmacy<br/>Dispense"]
    P --> H

    H --> Q["Visit: Completed"]
```

---

## 3. Workflow-ga Lab

```mermaid
stateDiagram-v2
    [*] --> AwaitingPayment: Doctor/Nurse/Emergency creates request
    AwaitingPayment --> Pending: Reception collects payment
    Pending --> InProgress: Lab staff starts test
    InProgress --> Completed: Lab enters results
    Completed --> [*]: Doctor views results

    note right of AwaitingPayment
        Doctor orders from Lab Test Catalog
        (Laboratory / Radiology / Imaging)
    end note
```

**Xiriirka xogta:**
- `LabRequest` → `tests[]` (testName, result, normalRange)
- Qiimaha → `LabTestCatalog` (testId, category, price, sampleType)
- Lacag → `Payment` + `ReceptionReceipt` (type: lab)

---

## 4. Workflow-ga Surgery

```mermaid
stateDiagram-v2
    [*] --> Pending: Doctor/Nurse submits request
    Pending --> Scheduled: Reception pays + sets date
    Scheduled --> Completed: Doctor or Reception marks done
    Completed --> [*]

    note right of Pending
        Inpatient credit book:
        fee on All Inpatients ledger
        (skip outpatient payment)
    end note
```

**Xiriirka xogta:**
- `SurgeryRequest` → `surgeryCatalogId`, surgeryName, notes
- Catalog → `SurgeryCatalog` (category, anesthesia, risk, pre/post-op)
- Lacag → `Payment` + `ReceptionReceipt` (type: surgery)

---

## 5. Workflow-ga Inpatient (Admission)

```mermaid
flowchart TD
    A["Doctor: Admission Request<br/>Status: Pending"] --> B["Reception: In Patient Request"]
    B --> C["Assign Ward / Room / Bed"]
    C --> D["Admission Active<br/>billingMode: cash or credit_book"]
    D --> E["Nightly bed charges"]
    D --> F["Nurse/Doctor: Clinical orders<br/>Rx, Lab, Surgery on inpatient"]
    F --> G["Reception: All Inpatients<br/>Collect charges / book"]
    D --> H["Nurse/Doctor: Discharge"]
    H --> I["Admission: Discharged<br/>Bed freed"]
```

---

## 6. Workflow-ga Pharmacy

```mermaid
flowchart LR
    A["Doctor/Emergency/Nurse<br/>Creates Prescription"] --> B["Status: Pending"]
    B --> C["Pharmacy: Prescription Queue"]
    C --> D["Dispense Medicine"]
    D --> E["StockTransaction<br/>Inventory qty -"]
    D --> F["Status: Dispensed"]
    F --> G{Patient type?}
    G -->|Cash outpatient| H["Visit workflow continues"]
    G -->|Credit / Inpatient book| I["AccountTransaction charge"]
```

---

## 7. Workflow-ga Emergency

```mermaid
flowchart TD
    A["Emergency Register<br/>New or existing patient"] --> B["EmergencyCase Active"]
    B --> C["Triage + Treatment"]
    C --> D["Prescription"]
    C --> E["Lab Request"]
    C --> F["Admission Request"]
    C --> G["Complete Case<br/>outcome recorded"]
    D --> PHARM[Pharmacy]
    E --> LABPAY[Reception Lab Fees]
    F --> ADM[Reception Inpatient]
```

**Ogsoonow:** Emergency **ma laha** `receive_payments` — lacagta waxaa qaada Reception.

---

## 8. Workflow-ga Admin & Catalogs

```mermaid
flowchart TB
    ADMIN[Admin] --> USERS[Users CRUD]
    ADMIN --> LABCAT[Lab Test Catalog]
    ADMIN --> MEDCAT[Medicine Catalog]
    ADMIN --> SURGCAT[Surgery Catalog]
    ADMIN --> ROOMS[Wards / Rooms / Beds]
    ADMIN --> DISC[Discount Limits + Patient Discounts]
    ADMIN --> ACCT[Accounting & Reports]

    LABCAT --> DOCTOR[Doctor orders lab]
    MEDCAT --> PHARM[Pharmacy catalog + stock]
    SURGCAT --> DOCTOR2[Doctor orders surgery]
    ROOMS --> RECEPTION[Reception assigns beds]
```

---

## 9. Visit Status — State Machine (Backend waa inuu ilaaliyaa)

```mermaid
stateDiagram-v2
    [*] --> Waiting: Visit created
    Waiting --> InConsultation: Doctor starts
    InConsultation --> LabRequested: Unpaid/pending lab
    InConsultation --> PharmacyPending: Pending prescription
    InConsultation --> Admitted: Active admission
    InConsultation --> CompletedConsultation: Orders cleared
    LabRequested --> InConsultation: Lab still blocking
    PharmacyPending --> InConsultation: Rx still blocking
    CompletedConsultation --> Completed: All done
    InConsultation --> Cancelled: Cancelled
    Completed --> [*]
    Cancelled --> [*]
```

**Xeerarka xannibaadda** (`visitConsultation.ts`):
- Visit ma dhammaan karo haddii lab **Awaiting Payment** / **Pending** / **In Progress**
- Visit ma dhammaan karo haddii prescription **Pending**
- Visit ma dhammaan karo haddii admission request **Pending**
- Visit ma dhammaan karo haddii surgery **Pending** (aan la bixin)

---

## 10. Role → Qaybaha Nidaamka (Overview)

| Role | Home Route | Mas'uuliyadda ugu weyn |
|------|------------|------------------------|
| **Admin** | `/hms/dashboard` | Users, catalogs, rooms, discounts, reports |
| **Reception** | `/hms/dashboard` | Register, billing, lab/surgery payment, inpatient |
| **Doctor** | `/hms/doctor/dashboard` | Consultation, orders, surgery complete |
| **Nurse** | `/hms/inpatient/dashboard` | Inpatient care, clinical orders, discharge |
| **Laboratory** | `/hms/laboratory/dashboard` | Process lab, enter results |
| **Pharmacy** | `/hms/pharmacy/dashboard` | Dispense, stock, supply approval |
| **Emergency** | `/hms/emergency/queue` | Triage, emergency treatment, register |

---

## 11. Backend API Endpoints (Suggested)

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login → JWT + role + permissions |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Logout |

### Core flow (priority)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/patients` | Register patient |
| POST | `/api/visits` | Create visit |
| PATCH | `/api/visits/:id/start-consultation` | Waiting → In Consultation |
| POST | `/api/visits/:id/clinical-notes` | Save note |
| POST | `/api/visits/:id/prescriptions` | Create prescription |
| POST | `/api/visits/:id/lab-requests` | Create lab order |
| POST | `/api/visits/:id/surgery-requests` | Create surgery order |
| POST | `/api/visits/:id/admission-requests` | Create admission order |
| POST | `/api/lab-requests/:id/pay` | Reception payment |
| PATCH | `/api/lab-requests/:id/process` | Lab status + results |
| POST | `/api/surgery-requests/:id/pay` | Reception pay + schedule |
| PATCH | `/api/surgery-requests/:id/complete` | Mark completed |
| POST | `/api/prescriptions/:id/dispense` | Pharmacy dispense |
| POST | `/api/admission-requests/:id/assign` | Assign bed |
| POST | `/api/admissions/:id/discharge` | Discharge patient |

### Catalogs (Admin)
| Method | Endpoint |
|--------|----------|
| CRUD | `/api/catalog/lab-tests` |
| CRUD | `/api/catalog/medicines` |
| CRUD | `/api/catalog/surgeries` |
| CRUD | `/api/wards`, `/api/rooms`, `/api/beds` |

---

## 12. Faylasha Tixraaca Frontend

| Fayl | Waxa ku jira |
|------|--------------|
| `src/shared/types/roles.ts` | Roles + permissions |
| `src/shared/types/index.ts` | Dhammaan entity types |
| `src/shared/services/hmsStore.ts` | Business logic + seed data |
| `src/shared/utils/visitConsultation.ts` | Visit workflow rules |
| `src/shared/config/hmsMenu.ts` | Menu per role |
| `src/routes/hmsRoutes.tsx` | Dhammaan routes |
| `docs/SYSTEM_ANALYSIS.md` | Falanqaynta user kasta + xogta |

---

*Last updated: June 2026 — FSH Hospital HMS*
