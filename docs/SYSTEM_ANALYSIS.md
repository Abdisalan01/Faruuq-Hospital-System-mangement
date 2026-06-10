# FSH Hospital HMS — System Analysis (User & Data)

> **Ujeeddo:** Falanqayn user kasta — waxa uu sameyn karo iyo **xogta uu xareyn karo** (Create / Read / Update).  
> Backend API waa inuu **xoogga saaraa permissions** iyo **entities** hoos ku qoran.

---

## Legend

| Calaamad | Macnaha |
|----------|---------|
| **C** | Create (abuuri / kaydi) |
| **R** | Read (akhri / arag) |
| **U** | Update (wax ka beddel) |
| **—** | Ma sameeyo / Delete ma jiro UI-ga |

**Ogsoonow:** Nidaamkan hadda **ma tirtiro** xogta dhabta ah (no hard delete) — waxaa la isticmaalaa `isActive`, `Cancelled`, `Discharged`, `Inactive`.

---

## 1. Admin (`admin`)

**Permissions:** `user_management`, `department_management`, `accounting`, `reports`, `system_settings`

### Mas'uuliyadda
- Maamulka isticmaalayaasha, catalogs, qolalka/sariiraha, qiimaha, discounts, warbixinnada
- Ma sameeyo consultation toos ah

### Xogta uu xareyn karo

| Entity | C | R | U | Fields muhiim ah |
|--------|---|---|---|------------------|
| **StaffUser** | ✓ | ✓ | ✓ | username, email, name, role, serviceFee, isActive |
| **Department** | ✓ | ✓ | ✓ | name, description, isActive |
| **LabTestCatalog** | ✓ | ✓ | ✓ | testId, testName, category, price, sampleType, normalRange, TAT, status |
| **MedicineCatalogItem** | ✓ | ✓ | ✓ | medicineId, name, category, unit, price, stock link |
| **SurgeryCatalog** | ✓ | ✓ | ✓ | surgeryId, name, category, price, anesthesia, risk, pre/post-op |
| **Ward / Room / Bed** | ✓ | ✓ | ✓ | name, bedCount, dailyRate, occupancy |
| **PatientDiscount** | ✓ | ✓ | ✓ | patientId, doctorId, feeType, discount%, send to reception |
| **DiscountLimits** | — | ✓ | ✓ | max % per fee type (registration, lab, surgery, inpatient, pharmacy) |
| **SystemSettings** | — | ✓ | ✓ | hospitalName, fees, code prefixes (MED/LAB/SUR) |
| **ExpenseRecord** | ✓ | ✓ | — | category, amount, description |
| **IncomeRecord** | — | ✓ | — | read-only from payments |
| **Patient / Visit / Clinical** | — | ✓ | — | reports only |

### Routes ugu muhiimsan
`/hms/administration/users`, `/lab-tests`, `/medicines`, `/surgeries`, `/rooms-beds`, `/discounts`, `/patient-discounts`, `/accounting/*`

---

## 2. Reception & Cashier (`reception_cashier`)

**Permissions:** `register_patients`, `create_visits`, `manage_queue`, `receive_payments`, `print_receipts`, `manage_patient_credit`

### Mas'uuliyadda
- Diiwaangelinta bukaanka, lacag qaadista, jadwalka surgery, inpatient bed assignment
- **Ma abuuro** clinical orders (waxaa sameeya doctor)

### Xogta uu xareyn karo

| Entity | C | R | U | Fields muhiim ah |
|--------|---|---|---|------------------|
| **Patient** | ✓ | ✓ | ✓ | fullName, gender, age, phone, address, paymentType (cash/credit) |
| **Visit** | ✓ | ✓ | ✓ | patientId, assignedDoctorId, queueNumber, status (limited) |
| **Payment** | ✓ | ✓ | — | amount, method, receiptNumber, visitId |
| **ReceptionReceipt** | ✓ | ✓ | — | type: registration/lab/surgery/checkout, lineItems, discount |
| **IncomeRecord** | ✓ | ✓ | — | auto from payments |
| **LabRequest** | — | ✓ | ✓ | status: Awaiting Payment → Pending (after pay) |
| **SurgeryRequest** | — | ✓ | ✓ | payment, scheduledDate, status → Scheduled |
| **AdmissionRequest** | — | ✓ | ✓ | assign ward/room/bed → Assigned |
| **Admission** | ✓ | ✓ | ✓ | billingMode, book charges, collect payments |
| **Bed** | — | ✓ | ✓ | isOccupied on assign/discharge |
| **AccountTransaction** | ✓ | ✓ | — | charges + payments for credit patients |
| **PatientAccount** | — | ✓ | ✓ | outstandingBalance |
| **PatientDiscount** | — | ✓ | ✓ | collect payment (sent from admin) |

### Lacagaha uu qaado
| Nooca | Page |
|-------|------|
| Registration fee | Register Patient / Billing |
| Consultation fee | Billing |
| Lab fees | Lab Fees |
| Surgery fees | Surgery |
| Inpatient (bed, lab, surgery, pharmacy on book) | All Inpatients |
| Patient discounts | Patient Discounts |
| Credit balance | Credit Accounts |

### Routes ugu muhiimsan
`/hms/reception/register-patient`, `/billing`, `/lab-fees`, `/surgery`, `/inpatient-request`, `/all-inpatients`, `/credit-accounts`, `/receipts`

---

## 3. Doctor (`doctor`)

**Permissions:** `view_assigned_patients`, `diagnosis`, `clinical_notes`, `prescriptions`, `lab_requests`, `admission_requests`, `view_patient_lab_results`, `create_nurse_orders`, `request_pharmacy_supplies`, `request_department_supplies`, `surgery_requests`

### Mas'uuliyadda
- Consultation, clinical orders, aragtida natiijooyinka lab, surgery complete
- **Ma qaado** lacag

### Xogta uu xareyn karo

| Entity | C | R | U | Fields muhiim ah |
|--------|---|---|---|------------------|
| **ClinicalNote** | ✓ | ✓ | ✓ | visitId, note text |
| **Prescription** + items | ✓ | ✓ | — | medicine, dosage, frequency, duration, instructions |
| **LabRequest** | ✓ | ✓ | — | tests[] from catalog, status: Awaiting Payment |
| **SurgeryRequest** | ✓ | ✓ | ✓ | surgeryCatalogId, notes; **complete** when Scheduled |
| **AdmissionRequest** | ✓ | ✓ | — | reason, visitId — bed assigned by reception |
| **DoctorOrder** | ✓ | ✓ | — | nurse orders (medication, etc.) |
| **DepartmentSupplyRequest** | ✓ | ✓ | — | items[], department: Doctor |
| **Visit** | — | ✓ | ✓ | status via consultation workflow |
| **Patient** | — | ✓ | — | assigned patients only |
| **LabRequest (results)** | — | ✓ | ✓ | mark doctorViewedAt |
| **Admission** | — | ✓ | ✓ | discharge (inpatient) |

### Consultation tabs (hal visit)
1. Consultant Note  
2. Prescription → Pharmacy  
3. Lab Request → Reception payment → Lab  
4. In-Patient Order → Reception assign bed  
5. Surgery → Reception payment → Complete  

### Routes ugu muhiimsan
`/hms/doctor/dashboard`, `/patients`, `/consultation/:visitId`, `/lab-results`, `/surgery`, `/inpatients`, `/nurse-orders`

---

## 4. Nurse (`nurse`)

**Permissions:** `manage_admitted_patients`, `view_rooms_beds`, `medication_administration`, `nursing_notes`, `patient_monitoring`, `prescriptions`, `lab_requests`, `surgery_requests`, `request_department_supplies`

### Mas'uuliyadda
- Daryeelka inpatient, notes, medication admin, clinical orders (sida doctor inpatient view)
- **Ma qaado** lacag

### Xogta uu xareyn karo

| Entity | C | R | U | Fields muhiim ah |
|--------|---|---|---|------------------|
| **NursingNote** | ✓ | ✓ | — | admissionId, note |
| **MedicationAdministration** | ✓ | ✓ | — | medicine, quantity, admissionId |
| **Prescription** | ✓ | ✓ | — | inpatient clinical modal |
| **LabRequest** | ✓ | ✓ | — | inpatient clinical modal |
| **SurgeryRequest** | ✓ | ✓ | — | inpatient clinical modal |
| **DepartmentSupplyRequest** | ✓ | — | — | department: Nursing |
| **Admission** | — | ✓ | ✓ | discharge |
| **DoctorOrder** | — | ✓ | — | read nurse orders from doctor |
| **Patient / Visit / Bed** | — | ✓ | — | inpatient context |

### Routes ugu muhiimsan
`/hms/inpatient/dashboard`, `/inpatient/all`, `/inpatient/supply-request`, `/inpatient/admissions/:id`, `/inpatient/medications`

---

## 5. Laboratory Staff (`laboratory`)

**Permissions:** `view_lab_requests`, `process_lab_tests`, `enter_lab_results`, `print_lab_results`, `send_lab_results`, `request_lab_supplies`, `request_department_supplies`

### Mas'uuliyadda
- Process lab requests **ka dib** reception payment
- Geli natiijooyinka, daabac warbixinta
- **Ma abuuro** lab order (waxaa sameeya doctor/nurse/emergency)

### Xogta uu xareyn karo

| Entity | C | R | U | Fields muhiim ah |
|--------|---|---|---|------------------|
| **LabRequest** | — | ✓ | ✓ | status: Pending → In Progress → Completed |
| **LabTestItem** (results) | — | ✓ | ✓ | result, normalRange per test |
| **LabTestCatalog** | — | ✓ | — | browse only (read catalog) |
| **DepartmentSupplyRequest** | ✓ | — | — | department: Laboratory |

### Lab request statuses (uu wax ka beddelo)
| Status | Macnaha |
|--------|---------|
| Awaiting Payment | Reception — lab ma arko |
| Pending | Paid — lab wuu bilaabi karaa |
| In Progress | Test socda |
| Completed | Natiijo la geliyay |

### Routes ugu muhiimsan
`/hms/laboratory/dashboard`, `/all`, `/active`, `/completed`, `/catalog`, `/requests/:id/edit`

---

## 6. Pharmacy Staff (`pharmacy`)

**Permissions:** `inventory_management`, `stock_management`, `dispense_medicines`, `process_prescriptions`, `internal_consumption`

### Mas'uuliyadda
- Dispense prescriptions, maamul stock, ansixi supply requests
- **Ma abuuro** prescription (waxaa sameeya doctor)

### Xogta uu xareyn karo

| Entity | C | R | U | Fields muhiim ah |
|--------|---|---|---|------------------|
| **MedicineCatalogItem** | ✓ | ✓ | ✓ | full catalog CRUD |
| **InventoryItem** | ✓ | ✓ | ✓ | quantity, reorderLevel, unitPrice |
| **StockTransaction** | ✓ | ✓ | — | Purchase, Dispense, Adjustment |
| **Prescription** | — | ✓ | ✓ | status → Dispensed |
| **DepartmentSupplyRequest** | — | ✓ | ✓ | status → Approved |
| **AccountTransaction** | ✓ | — | — | credit patient / inpatient book charge on dispense |

### Dispense side-effects (backend transaction)
1. Prescription status → `Dispensed`  
2. Inventory quantity −  
3. StockTransaction record  
4. Haddii credit/inpatient book → AccountTransaction charge  

### Routes ugu muhiimsan
`/hms/pharmacy/dashboard`, `/catalog`, `/prescriptions`, `/stock`, `/supply-requests`, `/inventory/*`

---

## 7. Emergency Staff (`emergency`)

**Permissions:** `emergency_registration`, `triage`, `emergency_treatment`, `emergency_prescription`, `emergency_lab_requests`, `emergency_admission`, `register_patients`, `create_visits`, `request_department_supplies`

### Mas'uuliyadda
- Degdeg: register, triage, treat, orders
- Wuxuu diiwaan gelin karaa bukaan + visit (sida reception)
- **Ma qaado** lacag — reception ayaa qaadata

### Xogta uu xareyn karo

| Entity | C | R | U | Fields muhiim ah |
|--------|---|---|---|------------------|
| **EmergencyCase** | ✓ | ✓ | ✓ | severity, triageNotes, diagnosis, outcome, status |
| **Patient** | ✓ | ✓ | — | emergency registration |
| **Visit** | ✓ | ✓ | — | isEmergency: true |
| **Prescription** | ✓ | — | — | emergency case |
| **LabRequest** | ✓ | — | — | → reception lab fees |
| **DepartmentSupplyRequest** | ✓ | — | — | department: Emergency |

### Routes ugu muhiimsan
`/hms/emergency/register`, `/queue`, `/consultation/:id`, `/supply-request`  
+ qaar ka mid ah `/hms/patients`, `/hms/reception/register-patient`, `/inpatient-request`

---

## 8. Isbarbardhig — Waxa user kasta abuuri karo

| Entity | Admin | Reception | Doctor | Nurse | Lab | Pharmacy | Emergency |
|--------|:-----:|:---------:|:------:|:-----:|:---:|:--------:|:---------:|
| Patient | — | ✓ | — | — | — | — | ✓ |
| Visit | — | ✓ | — | — | — | — | ✓ |
| ClinicalNote | — | — | ✓ | — | — | — | — |
| Prescription | — | — | ✓ | ✓ | — | U dispense | ✓ |
| LabRequest | — | U pay | ✓ | ✓ | U process | — | ✓ |
| SurgeryRequest | — | U pay | ✓ | ✓ | — | — | — |
| AdmissionRequest | — | U assign | ✓ | — | — | — | — |
| Admission | — | ✓ | U discharge | U discharge | — | — | — |
| Payment/Receipt | — | ✓ | — | — | — | — | — |
| Lab Catalog | ✓ | — | — | — | R | — | — |
| Medicine Catalog | ✓ | — | — | — | — | ✓ | — |
| Surgery Catalog | ✓ | — | — | — | — | — | — |
| Users | ✓ | — | — | — | — | — | — |
| Supply Request | — | — | ✓ | ✓ | ✓ | U approve | ✓ |
| EmergencyCase | — | — | — | — | — | — | ✓ |

---

## 9. Entities Backend — Database Tables (Suggested)

```
users (staff)
departments
patients
patient_accounts
account_transactions
visits
clinical_notes
diagnoses
prescriptions
prescription_items
lab_test_catalog
lab_requests
lab_test_items
surgery_catalog
surgery_requests
admission_requests
wards
rooms
beds
admissions
nursing_notes
medication_administrations
doctor_orders
medicine_catalog
inventory_items
stock_transactions
payments
reception_receipts
income_records
expense_records
discounts
patient_discounts
department_supply_requests
emergency_cases
system_settings
```

---

## 10. Xeerarka Backend (Waa in la ilaaliyo)

### 10.1 Authorization
- Hubi `role` + `permission` server-side — ha ku tiirsanin frontend kaliya
- `GET /api/auth/me` → `{ user, role, permissions[] }`

### 10.2 Payment gates
| Entity | Gate |
|--------|------|
| LabRequest | Ma noqon karo Pending ilaa lacag la qaado |
| SurgeryRequest | Ma noqon karo Scheduled ilaa lacag la qaado (ama credit book) |
| Prescription | Pharmacy waxay aragtaa Pending |

### 10.3 Discount limits
- `getMaxDiscountPercent(role, feeType)` — enforce server-side
- Admin sets limits in `systemSettings.discountLimits`

### 10.4 Code generation
- Medicine: `MED-001` (prefix + counter)
- Lab: `LAB-001`
- Surgery: `SUR-001`
- Sync counter from existing catalog on create

### 10.5 No delete policy
- Use `isActive: false`, `status: Cancelled/Discharged/Inactive`
- Audit trail: `createdAt`, `createdBy`, `updatedAt`

### 10.6 Transactions (atomic)
| Operation | Entities touched |
|-----------|------------------|
| Register patient + visit | Patient, Visit, Payment?, Receipt? |
| Lab payment | LabRequest, Payment, Receipt, IncomeRecord |
| Surgery payment | SurgeryRequest, Payment, Receipt, IncomeRecord |
| Dispense | Prescription, Inventory, StockTransaction, AccountTransaction? |
| Assign admission | AdmissionRequest, Admission, Bed, first bed charge |
| Discharge | Admission, Bed, Visit workflow |

---

## 11. Frontend → Backend Migration Checklist

- [ ] Beddel `hmsStore.ts` → API service layer (`api/patients.ts`, `api/visits.ts`, …)
- [ ] JWT / session auth beddel cookie mock
- [ ] Loading + error states per page
- [ ] Optimistic updates ama refetch after mutation
- [ ] Pagination server-side (patients list, lab queue, etc.)
- [ ] File upload haddii loo baahdo (lab reports PDF)
- [ ] WebSocket optional: queue updates, lab completed notification

---

## 12. Tixraac

| Document | Content |
|----------|---------|
| `docs/SYSTEM_WORKFLOW.md` | Workflow charts + API suggestions |
| `src/shared/types/roles.ts` | Roles & permissions source of truth |
| `src/shared/types/index.ts` | TypeScript entity definitions |
| `src/shared/services/hmsStore.ts` | Current business logic |

---

*Last updated: June 2026 — FSH Hospital HMS*
