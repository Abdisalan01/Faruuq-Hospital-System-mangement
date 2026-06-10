import { createHotContext as __vite__createHotContext } from "/Faaruuq_hms/@vite/client";import.meta.hot = __vite__createHotContext("/src/shared/components/LabTestCatalogView.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/Faaruuq_hms/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=16a081dd"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
var _s = $RefreshSig$();
import __vite__cjsImport1_react from "/Faaruuq_hms/node_modules/.vite/deps/react.js?v=16a081dd"; const useEffect = __vite__cjsImport1_react["useEffect"]; const useMemo = __vite__cjsImport1_react["useMemo"]; const useState = __vite__cjsImport1_react["useState"];
import { Alert, Badge, Button, Card, CardBody, Col, Form, InputGroup, Modal, Row, Table } from "/Faaruuq_hms/node_modules/.vite/deps/react-bootstrap.js?v=16a081dd";
import PageMetaData from "/Faaruuq_hms/src/components/PageTitle.tsx";
import IconifyIcon from "/Faaruuq_hms/src/components/wrappers/IconifyIcon.tsx";
import { currency } from "/Faaruuq_hms/src/context/constants.ts";
import { useHmsStoreContext } from "/Faaruuq_hms/src/context/HmsStoreContext.tsx?t=1781034842439";
import PageHeader from "/Faaruuq_hms/src/shared/components/PageHeader.tsx";
import { PermissionGuard } from "/Faaruuq_hms/src/shared/components/PermissionGuard.tsx?t=1781034842439";
import StatusBadge from "/Faaruuq_hms/src/shared/components/StatusBadge.tsx";
import {
  labTestCatalog,
  persistLabCatalogNowAsync,
  peekNextLabTestCode,
  saveLabTestCatalogEntry,
  systemSettings
} from "/Faaruuq_hms/src/shared/services/hmsStore.ts?t=1781034842439";
import {
  downloadLabTestCatalogTemplate,
  importLabTestCatalogFromExcel,
  LAB_TEST_CATALOG_HEADERS
} from "/Faaruuq_hms/src/shared/utils/labTestCatalogExcel.ts?t=1781034842439";
const PAGE_SIZE = 10;
const CATEGORIES = ["Laboratory", "Radiology", "Imaging"];
const SAMPLE_TYPES = ["Blood", "Urine", "Stool", "Other", "N/A"];
const emptyForm = () => ({
  testId: "",
  testName: "",
  category: "Laboratory",
  price: 0,
  isActive: true,
  description: "",
  normalRange: "",
  unit: "",
  sampleType: "Blood"
});
const LabTestCatalogView = ({
  breadcrumbs,
  permissions,
  readOnly = false,
  title = "Lab Tests Catalog",
  subtitle = "Manage test ID, category, pricing, and clinical details"
}) => {
  _s();
  const { dataVersion, isSupabase } = useHmsStoreContext();
  const [, setRefresh] = useState(0);
  const refresh = () => setRefresh((t) => t + 1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sampleFilter, setSampleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [pageMessage, setPageMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(
    null
  );
  const [form, setForm] = useState(emptyForm());
  const nextTestCode = useMemo(
    () => peekNextLabTestCode(),
    [labTestCatalog.length, systemSettings.labTestCodeNextNumber]
  );
  const items = useMemo(() => {
    const q = search.toLowerCase().trim();
    return labTestCatalog.filter((t) => categoryFilter === "all" || t.category === categoryFilter).filter((t) => sampleFilter === "all" || t.sampleType === sampleFilter).filter((t) => {
      if (!q) return true;
      return `${t.testId} ${t.testName} ${t.category} ${t.sampleType ?? ""} ${t.description ?? ""}`.toLowerCase().includes(q);
    }).sort((a, b) => a.category.localeCompare(b.category) || a.testName.localeCompare(b.testName));
  }, [search, categoryFilter, sampleFilter, labTestCatalog.length, dataVersion]);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, safePage]);
  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, sampleFilter]);
  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm(), testId: peekNextLabTestCode() });
    setFormError("");
    setShowModal(true);
  };
  const openEdit = (item) => {
    setEditId(item.id);
    setForm({
      testId: item.testId,
      testName: item.testName,
      category: item.category,
      price: item.price,
      isActive: item.isActive,
      description: item.description ?? "",
      normalRange: item.normalRange ?? "",
      unit: item.unit ?? "",
      sampleType: item.sampleType ?? (item.category === "Laboratory" ? "Blood" : "N/A")
    });
    setFormError("");
    setShowModal(true);
  };
  const persistCatalog = async (successMessage) => {
    if (!isSupabase) {
      setPageMessage(`${successMessage} (database mode is off — enable VITE_USE_SUPABASE in .env)`);
      refresh();
      return;
    }
    setSaving(true);
    try {
      await persistLabCatalogNowAsync();
      setPageMessage(`${successMessage} Saved to database.`);
      refresh();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      setPageMessage(`Database save failed: ${detail}`);
      refresh();
    } finally {
      setSaving(false);
    }
  };
  const openImport = () => {
    setImportFile(null);
    setImportMessage(null);
    setShowImportModal(true);
  };
  const handleSave = async () => {
    if (!form.testName.trim()) {
      setFormError("Test name is required");
      return;
    }
    if (form.price < 0 || Number.isNaN(form.price)) {
      setFormError("Price is required");
      return;
    }
    try {
      saveLabTestCatalogEntry({
        id: editId ?? void 0,
        ...form,
        sampleType: form.category === "Laboratory" ? form.sampleType : "N/A"
      });
      setShowModal(false);
      await persistCatalog(editId ? "Test updated." : "Test added.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save test");
    }
  };
  const toggleActive = async (item) => {
    saveLabTestCatalogEntry({ ...item, isActive: !item.isActive });
    await persistCatalog(item.isActive ? "Test deactivated." : "Test activated.");
  };
  const handleImport = async () => {
    if (!importFile) {
      setImportMessage({ type: "danger", text: "Please choose an Excel file first." });
      return;
    }
    setImporting(true);
    setImportMessage(null);
    try {
      const result = await importLabTestCatalogFromExcel(importFile);
      const saved = result.imported + result.updated;
      if (saved === 0) {
        setImportMessage({
          type: "danger",
          text: result.errors[0] ?? "No rows were imported."
        });
      } else {
        if (isSupabase) {
          await persistLabCatalogNowAsync();
        }
        const parts = [
          result.imported > 0 ? `${result.imported} new` : "",
          result.updated > 0 ? `${result.updated} updated` : "",
          result.skipped > 0 ? `${result.skipped} skipped` : ""
        ].filter(Boolean);
        setImportMessage({
          type: result.errors.length > 0 ? "warning" : "success",
          text: `Import complete: ${parts.join(", ")}.${isSupabase ? " Saved to database." : ""}`
        });
        refresh();
        if (result.errors.length === 0) {
          setTimeout(() => setShowImportModal(false), 1800);
        }
      }
    } catch {
      setImportMessage({ type: "danger", text: "Could not read the Excel file. Use the template format." });
    } finally {
      setImporting(false);
    }
  };
  const updateForm = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "category" && value !== "Laboratory") {
        next.sampleType = "N/A";
      }
      if (key === "category" && value === "Laboratory" && prev.sampleType === "N/A") {
        next.sampleType = "Blood";
      }
      return next;
    });
  };
  return /* @__PURE__ */ jsxDEV(PermissionGuard, { permissions, children: [
    /* @__PURE__ */ jsxDEV(PageMetaData, { title }, void 0, false, {
      fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
      lineNumber: 252,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(
      PageHeader,
      {
        title,
        subtitle,
        breadcrumbs,
        actionLabel: readOnly ? void 0 : "Add Test",
        actionIcon: "solar:add-circle-broken",
        onAction: readOnly ? void 0 : openCreate,
        children: !readOnly && /* @__PURE__ */ jsxDEV(Button, { variant: "outline-primary", onClick: openImport, children: [
          /* @__PURE__ */ jsxDEV(IconifyIcon, { icon: "solar:upload-minimalistic-broken", className: "me-1" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 263,
            columnNumber: 13
          }, this),
          "Import Excel"
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 262,
          columnNumber: 9
        }, this)
      },
      void 0,
      false,
      {
        fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
        lineNumber: 253,
        columnNumber: 7
      },
      this
    ),
    pageMessage && /* @__PURE__ */ jsxDEV(Alert, { variant: "success", dismissible: true, onClose: () => setPageMessage(""), children: pageMessage }, void 0, false, {
      fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
      lineNumber: 270,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(Card, { children: /* @__PURE__ */ jsxDEV(CardBody, { children: [
      /* @__PURE__ */ jsxDEV(Row, { className: "g-3 mb-3", children: [
        /* @__PURE__ */ jsxDEV(Col, { md: 5, children: /* @__PURE__ */ jsxDEV(InputGroup, { children: [
          /* @__PURE__ */ jsxDEV(InputGroup.Text, { children: /* @__PURE__ */ jsxDEV(IconifyIcon, { icon: "solar:magnifer-broken" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 281,
            columnNumber: 19
          }, this) }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 280,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(
            Form.Control,
            {
              placeholder: "Search by ID, name, category...",
              value: search,
              onChange: (e) => setSearch(e.target.value)
            },
            void 0,
            false,
            {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 283,
              columnNumber: 17
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 279,
          columnNumber: 15
        }, this) }, void 0, false, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 278,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(Col, { md: 3, children: /* @__PURE__ */ jsxDEV(Form.Select, { value: categoryFilter, onChange: (e) => setCategoryFilter(e.target.value), children: [
          /* @__PURE__ */ jsxDEV("option", { value: "all", children: "All categories" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 292,
            columnNumber: 17
          }, this),
          CATEGORIES.map(
            (c) => /* @__PURE__ */ jsxDEV("option", { value: c, children: c }, c, false, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 294,
              columnNumber: 17
            }, this)
          )
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 291,
          columnNumber: 15
        }, this) }, void 0, false, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 290,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(Col, { md: 3, children: /* @__PURE__ */ jsxDEV(
          Form.Select,
          {
            value: sampleFilter,
            onChange: (e) => setSampleFilter(e.target.value),
            disabled: categoryFilter !== "all" && categoryFilter !== "Laboratory",
            children: [
              /* @__PURE__ */ jsxDEV("option", { value: "all", children: "All sample types" }, void 0, false, {
                fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
                lineNumber: 306,
                columnNumber: 17
              }, this),
              SAMPLE_TYPES.map(
                (s) => /* @__PURE__ */ jsxDEV("option", { value: s, children: s }, s, false, {
                  fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
                  lineNumber: 308,
                  columnNumber: 17
                }, this)
              )
            ]
          },
          void 0,
          true,
          {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 301,
            columnNumber: 15
          },
          this
        ) }, void 0, false, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 300,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(Col, { md: 1, className: "d-flex align-items-center justify-content-end text-muted small", children: [
          items.length,
          " tests"
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 314,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
        lineNumber: 277,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "table-responsive", children: /* @__PURE__ */ jsxDEV(Table, { hover: true, className: "mb-0 align-middle", children: [
        /* @__PURE__ */ jsxDEV("thead", { className: "bg-light bg-opacity-50", children: /* @__PURE__ */ jsxDEV("tr", { children: [
          /* @__PURE__ */ jsxDEV("th", { children: "Test ID" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 323,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("th", { children: "Test Name" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 324,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("th", { children: "Category" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 325,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("th", { children: "Sample" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 326,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("th", { children: "Price" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 327,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("th", { children: "Normal Range" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 328,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("th", { children: "Status" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 329,
            columnNumber: 19
          }, this),
          !readOnly && /* @__PURE__ */ jsxDEV("th", {}, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 330,
            columnNumber: 33
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 322,
          columnNumber: 17
        }, this) }, void 0, false, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 321,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("tbody", { children: pageItems.length === 0 ? /* @__PURE__ */ jsxDEV("tr", { children: /* @__PURE__ */ jsxDEV("td", { colSpan: readOnly ? 7 : 8, className: "text-center text-muted py-4", children: "No tests found" }, void 0, false, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 336,
          columnNumber: 21
        }, this) }, void 0, false, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 335,
          columnNumber: 17
        }, this) : pageItems.map(
          (t) => /* @__PURE__ */ jsxDEV("tr", { className: !t.isActive ? "text-muted" : void 0, children: [
            /* @__PURE__ */ jsxDEV("td", { className: "fw-medium", children: t.testId }, void 0, false, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 343,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { children: [
              /* @__PURE__ */ jsxDEV("div", { children: t.testName }, void 0, false, {
                fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
                lineNumber: 345,
                columnNumber: 25
              }, this),
              t.description && /* @__PURE__ */ jsxDEV("div", { className: "small text-muted", children: t.description }, void 0, false, {
                fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
                lineNumber: 346,
                columnNumber: 43
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 344,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { children: /* @__PURE__ */ jsxDEV(Badge, { bg: "light", text: "dark", children: t.category }, void 0, false, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 349,
              columnNumber: 25
            }, this) }, void 0, false, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 348,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { children: t.sampleType ?? "—" }, void 0, false, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 353,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { children: [
              currency,
              t.price.toLocaleString()
            ] }, void 0, true, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 354,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { className: "small", children: t.normalRange ?? "—" }, void 0, false, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 358,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { children: /* @__PURE__ */ jsxDEV(StatusBadge, { status: t.isActive ? "Active" : "Inactive" }, void 0, false, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 360,
              columnNumber: 25
            }, this) }, void 0, false, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 359,
              columnNumber: 23
            }, this),
            !readOnly && /* @__PURE__ */ jsxDEV("td", { className: "text-end", children: [
              /* @__PURE__ */ jsxDEV(Button, { size: "sm", variant: "light", className: "me-1", onClick: () => openEdit(t), children: "Edit" }, void 0, false, {
                fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
                lineNumber: 364,
                columnNumber: 27
              }, this),
              /* @__PURE__ */ jsxDEV(Button, { size: "sm", variant: "outline-secondary", onClick: () => toggleActive(t), children: t.isActive ? "Deactivate" : "Activate" }, void 0, false, {
                fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
                lineNumber: 367,
                columnNumber: 27
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 363,
              columnNumber: 19
            }, this)
          ] }, t.id, true, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 342,
            columnNumber: 17
          }, this)
        ) }, void 0, false, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 333,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
        lineNumber: 320,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
        lineNumber: 319,
        columnNumber: 11
      }, this),
      totalPages > 1 && /* @__PURE__ */ jsxDEV("div", { className: "d-flex justify-content-between align-items-center mt-3", children: [
        /* @__PURE__ */ jsxDEV("span", { className: "text-muted small", children: [
          "Page ",
          safePage,
          " of ",
          totalPages
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 381,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "d-flex gap-2", children: [
          /* @__PURE__ */ jsxDEV(Button, { size: "sm", variant: "light", disabled: safePage <= 1, onClick: () => setPage(safePage - 1), children: "Previous" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 385,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(
            Button,
            {
              size: "sm",
              variant: "light",
              disabled: safePage >= totalPages,
              onClick: () => setPage(safePage + 1),
              children: "Next"
            },
            void 0,
            false,
            {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 388,
              columnNumber: 17
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 384,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
        lineNumber: 380,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
      lineNumber: 276,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
      lineNumber: 275,
      columnNumber: 7
    }, this),
    !readOnly && /* @__PURE__ */ jsxDEV(Modal, { show: showModal, onHide: () => setShowModal(false), centered: true, size: "lg", children: [
      /* @__PURE__ */ jsxDEV(Modal.Header, { closeButton: true, children: /* @__PURE__ */ jsxDEV(Modal.Title, { children: editId ? "Edit Lab Test" : "Add Lab Test" }, void 0, false, {
        fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
        lineNumber: 405,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
        lineNumber: 404,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(Modal.Body, { children: [
        formError && /* @__PURE__ */ jsxDEV(Alert, { variant: "danger", children: formError }, void 0, false, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 408,
          columnNumber: 27
        }, this),
        /* @__PURE__ */ jsxDEV(Row, { children: [
          /* @__PURE__ */ jsxDEV(Col, { md: 6, children: /* @__PURE__ */ jsxDEV(Form.Group, { className: "mb-3", children: [
            /* @__PURE__ */ jsxDEV(Form.Label, { children: "Test ID *" }, void 0, false, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 412,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              Form.Control,
              {
                value: form.testId,
                onChange: (e) => updateForm("testId", e.target.value),
                placeholder: nextTestCode,
                disabled: Boolean(editId)
              },
              void 0,
              false,
              {
                fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
                lineNumber: 413,
                columnNumber: 19
              },
              this
            ),
            !editId && /* @__PURE__ */ jsxDEV(Form.Text, { muted: true, children: [
              "Leave blank to auto-generate (",
              nextTestCode,
              ")"
            ] }, void 0, true, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 419,
              columnNumber: 31
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 411,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 410,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV(Col, { md: 6, children: /* @__PURE__ */ jsxDEV(Form.Group, { className: "mb-3", children: [
            /* @__PURE__ */ jsxDEV(Form.Label, { children: "Status *" }, void 0, false, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 424,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              Form.Select,
              {
                value: form.isActive ? "active" : "inactive",
                onChange: (e) => updateForm("isActive", e.target.value === "active"),
                children: [
                  /* @__PURE__ */ jsxDEV("option", { value: "active", children: "Active" }, void 0, false, {
                    fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
                    lineNumber: 429,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "inactive", children: "Inactive" }, void 0, false, {
                    fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
                    lineNumber: 430,
                    columnNumber: 21
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
                lineNumber: 425,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 423,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 422,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 409,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(Form.Group, { className: "mb-3", children: [
          /* @__PURE__ */ jsxDEV(Form.Label, { children: "Test Name *" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 436,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV(Form.Control, { value: form.testName, onChange: (e) => updateForm("testName", e.target.value), required: true }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 437,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 435,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(Row, { children: [
          /* @__PURE__ */ jsxDEV(Col, { md: 6, children: /* @__PURE__ */ jsxDEV(Form.Group, { className: "mb-3", children: [
            /* @__PURE__ */ jsxDEV(Form.Label, { children: "Category / Type *" }, void 0, false, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 442,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              Form.Select,
              {
                value: form.category,
                onChange: (e) => updateForm("category", e.target.value),
                children: CATEGORIES.map(
                  (c) => /* @__PURE__ */ jsxDEV("option", { value: c, children: c }, c, false, {
                    fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
                    lineNumber: 448,
                    columnNumber: 19
                  }, this)
                )
              },
              void 0,
              false,
              {
                fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
                lineNumber: 443,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 441,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 440,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV(Col, { md: 6, children: /* @__PURE__ */ jsxDEV(Form.Group, { className: "mb-3", children: [
            /* @__PURE__ */ jsxDEV(Form.Label, { children: [
              "Price (",
              currency,
              ") *"
            ] }, void 0, true, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 457,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              Form.Control,
              {
                type: "number",
                min: 0,
                step: 0.01,
                value: form.price,
                onChange: (e) => updateForm("price", Number(e.target.value))
              },
              void 0,
              false,
              {
                fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
                lineNumber: 458,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 456,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 455,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 439,
          columnNumber: 13
        }, this),
        form.category === "Laboratory" && /* @__PURE__ */ jsxDEV(Form.Group, { className: "mb-3", children: [
          /* @__PURE__ */ jsxDEV(Form.Label, { children: "Sample Type" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 470,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(
            Form.Select,
            {
              value: form.sampleType,
              onChange: (e) => updateForm("sampleType", e.target.value),
              children: ["Blood", "Urine", "Stool", "Other"].map(
                (s) => /* @__PURE__ */ jsxDEV("option", { value: s, children: s }, s, false, {
                  fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
                  lineNumber: 476,
                  columnNumber: 15
                }, this)
              )
            },
            void 0,
            false,
            {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 471,
              columnNumber: 17
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 469,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(Form.Group, { className: "mb-3", children: [
          /* @__PURE__ */ jsxDEV(Form.Label, { children: "Description" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 484,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV(
            Form.Control,
            {
              as: "textarea",
              rows: 2,
              value: form.description,
              onChange: (e) => updateForm("description", e.target.value)
            },
            void 0,
            false,
            {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 485,
              columnNumber: 15
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 483,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(Row, { children: [
          /* @__PURE__ */ jsxDEV(Col, { md: 6, children: /* @__PURE__ */ jsxDEV(Form.Group, { className: "mb-3", children: [
            /* @__PURE__ */ jsxDEV(Form.Label, { children: "Normal Range" }, void 0, false, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 495,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(Form.Control, { value: form.normalRange, onChange: (e) => updateForm("normalRange", e.target.value) }, void 0, false, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 496,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 494,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 493,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV(Col, { md: 6, children: /* @__PURE__ */ jsxDEV(Form.Group, { className: "mb-3", children: [
            /* @__PURE__ */ jsxDEV(Form.Label, { children: "Unit" }, void 0, false, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 501,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(Form.Control, { value: form.unit, onChange: (e) => updateForm("unit", e.target.value) }, void 0, false, {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 502,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 500,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 499,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 492,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
        lineNumber: 407,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(Modal.Footer, { children: [
        /* @__PURE__ */ jsxDEV(Button, { variant: "light", onClick: () => setShowModal(false), children: "Cancel" }, void 0, false, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 508,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(
          Button,
          {
            variant: "success",
            onClick: handleSave,
            disabled: !form.testName.trim() || saving,
            children: saving ? "Saving..." : "Save"
          },
          void 0,
          false,
          {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 511,
            columnNumber: 13
          },
          this
        )
      ] }, void 0, true, {
        fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
        lineNumber: 507,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
      lineNumber: 403,
      columnNumber: 7
    }, this),
    !readOnly && /* @__PURE__ */ jsxDEV(Modal, { show: showImportModal, onHide: () => setShowImportModal(false), centered: true, size: "lg", children: [
      /* @__PURE__ */ jsxDEV(Modal.Header, { closeButton: true, children: /* @__PURE__ */ jsxDEV(Modal.Title, { children: "Import Lab Tests from Excel" }, void 0, false, {
        fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
        lineNumber: 525,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
        lineNumber: 524,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(Modal.Body, { children: [
        importMessage && /* @__PURE__ */ jsxDEV(Alert, { variant: importMessage.type, className: "mb-3", children: importMessage.text }, void 0, false, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 529,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-muted", children: [
          "Upload Excel to add many tests at once. Use the same ",
          /* @__PURE__ */ jsxDEV("strong", { children: "Test ID" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 535,
            columnNumber: 68
          }, this),
          " to update an existing test. Leave Test ID blank to auto-generate (e.g. ",
          nextTestCode,
          ")."
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 534,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "border rounded p-3 bg-light bg-opacity-50 mb-3", children: [
          /* @__PURE__ */ jsxDEV("p", { className: "fw-medium mb-2", children: "Columns" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 540,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "small text-muted mb-0", children: LAB_TEST_CATALOG_HEADERS.join(" · ") }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 541,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 539,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(Button, { variant: "outline-secondary", className: "mb-3", onClick: downloadLabTestCatalogTemplate, children: [
          /* @__PURE__ */ jsxDEV(IconifyIcon, { icon: "solar:download-minimalistic-broken", className: "me-1" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 545,
            columnNumber: 15
          }, this),
          "Download template"
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 544,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(Form.Group, { children: [
          /* @__PURE__ */ jsxDEV(Form.Label, { children: "Excel file" }, void 0, false, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 550,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV(
            Form.Control,
            {
              type: "file",
              accept: ".xlsx,.xls,.csv",
              onChange: (e) => {
                const target = e.target;
                setImportFile(target.files?.[0] ?? null);
                setImportMessage(null);
              }
            },
            void 0,
            false,
            {
              fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
              lineNumber: 551,
              columnNumber: 15
            },
            this
          ),
          importFile && /* @__PURE__ */ jsxDEV(Form.Text, { className: "text-muted", children: [
            "Selected: ",
            importFile.name
          ] }, void 0, true, {
            fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
            lineNumber: 560,
            columnNumber: 30
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 549,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
        lineNumber: 527,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(Modal.Footer, { children: [
        /* @__PURE__ */ jsxDEV(Button, { variant: "light", onClick: () => setShowImportModal(false), children: "Cancel" }, void 0, false, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 564,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(Button, { variant: "primary", onClick: handleImport, disabled: !importFile || importing, children: importing ? "Importing..." : "Import data" }, void 0, false, {
          fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
          lineNumber: 567,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
        lineNumber: 563,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
      lineNumber: 523,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx",
    lineNumber: 251,
    columnNumber: 5
  }, this);
};
_s(LabTestCatalogView, "UmY5vuDBQPdY/uBatRXt8BSijuE=", false, function() {
  return [useHmsStoreContext];
});
_c = LabTestCatalogView;
export default LabTestCatalogView;
var _c;
$RefreshReg$(_c, "LabTestCatalogView");
import * as RefreshRuntime from "/Faaruuq_hms/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
function $RefreshReg$(type, id) {
  return RefreshRuntime.register(type, "C:/Users/HP/Videos/faruuq last/src/shared/components/LabTestCatalogView.tsx " + id);
}
function $RefreshSig$() {
  return RefreshRuntime.createSignatureFunctionForTransform();
}

//# sourceMappingURL=data:application/json;base64,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QVlBO0FBQUEsV0FsQ0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQW1DQTtBQUFBLE1BQ0EsdUJBQUMsTUFBTSxRQUFOLEVBQ0M7QUFBQSwrQkFBQyxVQUFPLFNBQVEsU0FBUSxTQUFTLE1BQU1oRixtQkFBbUIsS0FBSyxHQUFFLHNCQUFqRTtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBRUE7QUFBQSxRQUNBLHVCQUFDLFVBQU8sU0FBUSxXQUFVLFNBQVN1RCxjQUFjLFVBQVUsQ0FBQzlDLGNBQWNFLFdBQ3ZFQSxzQkFBWSxpQkFBaUIsaUJBRGhDO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFFQTtBQUFBLFdBTkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQU9BO0FBQUEsU0EvQ0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQWdEQTtBQUFBLE9BaFVKO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FrVUE7QUFFSjtBQUFDNUIsR0F6Z0JLTixvQkFBa0I7QUFBQSxVQU9jekIsa0JBQWtCO0FBQUE7QUFBQWlJLEtBUGxEeEc7QUEyZ0JOLGVBQWVBO0FBQWtCLElBQUF3RztBQUFBQyxhQUFBRCxJQUFBIiwibmFtZXMiOlsidXNlRWZmZWN0IiwidXNlTWVtbyIsInVzZVN0YXRlIiwiQWxlcnQiLCJCYWRnZSIsIkJ1dHRvbiIsIkNhcmQiLCJDYXJkQm9keSIsIkNvbCIsIkZvcm0iLCJJbnB1dEdyb3VwIiwiTW9kYWwiLCJSb3ciLCJUYWJsZSIsIlBhZ2VNZXRhRGF0YSIsIkljb25pZnlJY29uIiwiY3VycmVuY3kiLCJ1c2VIbXNTdG9yZUNvbnRleHQiLCJQYWdlSGVhZGVyIiwiUGVybWlzc2lvbkd1YXJkIiwiU3RhdHVzQmFkZ2UiLCJsYWJUZXN0Q2F0YWxvZyIsInBlcnNpc3RMYWJDYXRhbG9nTm93QXN5bmMiLCJwZWVrTmV4dExhYlRlc3RDb2RlIiwic2F2ZUxhYlRlc3RDYXRhbG9nRW50cnkiLCJzeXN0ZW1TZXR0aW5ncyIsImRvd25sb2FkTGFiVGVzdENhdGFsb2dUZW1wbGF0ZSIsImltcG9ydExhYlRlc3RDYXRhbG9nRnJvbUV4Y2VsIiwiTEFCX1RFU1RfQ0FUQUxPR19IRUFERVJTIiwiUEFHRV9TSVpFIiwiQ0FURUdPUklFUyIsIlNBTVBMRV9UWVBFUyIsImVtcHR5Rm9ybSIsInRlc3RJZCIsInRlc3ROYW1lIiwiY2F0ZWdvcnkiLCJwcmljZSIsImlzQWN0aXZlIiwiZGVzY3JpcHRpb24iLCJub3JtYWxSYW5nZSIsInVuaXQiLCJzYW1wbGVUeXBlIiwiTGFiVGVzdENhdGFsb2dWaWV3IiwiYnJlYWRjcnVtYnMiLCJwZXJtaXNzaW9ucyIsInJlYWRPbmx5IiwidGl0bGUiLCJzdWJ0aXRsZSIsIl9zIiwiZGF0YVZlcnNpb24iLCJpc1N1cGFiYXNlIiwic2V0UmVmcmVzaCIsInJlZnJlc2giLCJ0Iiwic2VhcmNoIiwic2V0U2VhcmNoIiwiY2F0ZWdvcnlGaWx0ZXIiLCJzZXRDYXRlZ29yeUZpbHRlciIsInNhbXBsZUZpbHRlciIsInNldFNhbXBsZUZpbHRlciIsInBhZ2UiLCJzZXRQYWdlIiwic2hvd01vZGFsIiwic2V0U2hvd01vZGFsIiwic2hvd0ltcG9ydE1vZGFsIiwic2V0U2hvd0ltcG9ydE1vZGFsIiwiZWRpdElkIiwic2V0RWRpdElkIiwicGFnZU1lc3NhZ2UiLCJzZXRQYWdlTWVzc2FnZSIsImZvcm1FcnJvciIsInNldEZvcm1FcnJvciIsInNhdmluZyIsInNldFNhdmluZyIsImltcG9ydEZpbGUiLCJzZXRJbXBvcnRGaWxlIiwiaW1wb3J0aW5nIiwic2V0SW1wb3J0aW5nIiwiaW1wb3J0TWVzc2FnZSIsInNldEltcG9ydE1lc3NhZ2UiLCJmb3JtIiwic2V0Rm9ybSIsIm5leHRUZXN0Q29kZSIsImxlbmd0aCIsImxhYlRlc3RDb2RlTmV4dE51bWJlciIsIml0ZW1zIiwicSIsInRvTG93ZXJDYXNlIiwidHJpbSIsImZpbHRlciIsImluY2x1ZGVzIiwic29ydCIsImEiLCJiIiwibG9jYWxlQ29tcGFyZSIsInRvdGFsUGFnZXMiLCJNYXRoIiwibWF4IiwiY2VpbCIsInNhZmVQYWdlIiwibWluIiwicGFnZUl0ZW1zIiwic3RhcnQiLCJzbGljZSIsIm9wZW5DcmVhdGUiLCJvcGVuRWRpdCIsIml0ZW0iLCJpZCIsInBlcnNpc3RDYXRhbG9nIiwic3VjY2Vzc01lc3NhZ2UiLCJlcnIiLCJkZXRhaWwiLCJFcnJvciIsIm1lc3NhZ2UiLCJvcGVuSW1wb3J0IiwiaGFuZGxlU2F2ZSIsIk51bWJlciIsImlzTmFOIiwidW5kZWZpbmVkIiwidG9nZ2xlQWN0aXZlIiwiaGFuZGxlSW1wb3J0IiwidHlwZSIsInRleHQiLCJyZXN1bHQiLCJzYXZlZCIsImltcG9ydGVkIiwidXBkYXRlZCIsImVycm9ycyIsInBhcnRzIiwic2tpcHBlZCIsIkJvb2xlYW4iLCJqb2luIiwic2V0VGltZW91dCIsInVwZGF0ZUZvcm0iLCJrZXkiLCJ2YWx1ZSIsInByZXYiLCJuZXh0IiwiZSIsInRhcmdldCIsIm1hcCIsImMiLCJzIiwidG9Mb2NhbGVTdHJpbmciLCJmaWxlcyIsIm5hbWUiLCJfYyIsIiRSZWZyZXNoUmVnJCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJMYWJUZXN0Q2F0YWxvZ1ZpZXcudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHVzZUVmZmVjdCwgdXNlTWVtbywgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCdcbmltcG9ydCB7IEFsZXJ0LCBCYWRnZSwgQnV0dG9uLCBDYXJkLCBDYXJkQm9keSwgQ29sLCBGb3JtLCBJbnB1dEdyb3VwLCBNb2RhbCwgUm93LCBUYWJsZSB9IGZyb20gJ3JlYWN0LWJvb3RzdHJhcCdcblxuaW1wb3J0IFBhZ2VNZXRhRGF0YSBmcm9tICdAL2NvbXBvbmVudHMvUGFnZVRpdGxlJ1xuaW1wb3J0IEljb25pZnlJY29uIGZyb20gJ0AvY29tcG9uZW50cy93cmFwcGVycy9JY29uaWZ5SWNvbidcbmltcG9ydCB7IGN1cnJlbmN5IH0gZnJvbSAnQC9jb250ZXh0L2NvbnN0YW50cydcbmltcG9ydCB7IHVzZUhtc1N0b3JlQ29udGV4dCB9IGZyb20gJ0AvY29udGV4dC9IbXNTdG9yZUNvbnRleHQnXG5pbXBvcnQgUGFnZUhlYWRlciBmcm9tICdAL3NoYXJlZC9jb21wb25lbnRzL1BhZ2VIZWFkZXInXG5pbXBvcnQgeyBQZXJtaXNzaW9uR3VhcmQgfSBmcm9tICdAL3NoYXJlZC9jb21wb25lbnRzL1Blcm1pc3Npb25HdWFyZCdcbmltcG9ydCBTdGF0dXNCYWRnZSBmcm9tICdAL3NoYXJlZC9jb21wb25lbnRzL1N0YXR1c0JhZGdlJ1xuaW1wb3J0IHtcbiAgbGFiVGVzdENhdGFsb2csXG4gIHBlcnNpc3RMYWJDYXRhbG9nTm93QXN5bmMsXG4gIHBlZWtOZXh0TGFiVGVzdENvZGUsXG4gIHNhdmVMYWJUZXN0Q2F0YWxvZ0VudHJ5LFxuICBzeXN0ZW1TZXR0aW5ncyxcbn0gZnJvbSAnQC9zaGFyZWQvc2VydmljZXMvaG1zU3RvcmUnXG5pbXBvcnQgdHlwZSB7IExhYlNhbXBsZVR5cGUsIExhYlRlc3RDYXRhbG9nLCBMYWJUZXN0Q2F0ZWdvcnkgfSBmcm9tICdAL3NoYXJlZC90eXBlcydcbmltcG9ydCB0eXBlIHsgUGVybWlzc2lvbiB9IGZyb20gJ0Avc2hhcmVkL3R5cGVzL3JvbGVzJ1xuaW1wb3J0IHtcbiAgZG93bmxvYWRMYWJUZXN0Q2F0YWxvZ1RlbXBsYXRlLFxuICBpbXBvcnRMYWJUZXN0Q2F0YWxvZ0Zyb21FeGNlbCxcbiAgTEFCX1RFU1RfQ0FUQUxPR19IRUFERVJTLFxufSBmcm9tICdAL3NoYXJlZC91dGlscy9sYWJUZXN0Q2F0YWxvZ0V4Y2VsJ1xuXG5jb25zdCBQQUdFX1NJWkUgPSAxMFxuXG5jb25zdCBDQVRFR09SSUVTOiBMYWJUZXN0Q2F0ZWdvcnlbXSA9IFsnTGFib3JhdG9yeScsICdSYWRpb2xvZ3knLCAnSW1hZ2luZyddXG5jb25zdCBTQU1QTEVfVFlQRVM6IExhYlNhbXBsZVR5cGVbXSA9IFsnQmxvb2QnLCAnVXJpbmUnLCAnU3Rvb2wnLCAnT3RoZXInLCAnTi9BJ11cblxudHlwZSBDYXRlZ29yeUZpbHRlciA9ICdhbGwnIHwgTGFiVGVzdENhdGVnb3J5XG50eXBlIFNhbXBsZUZpbHRlciA9ICdhbGwnIHwgTGFiU2FtcGxlVHlwZVxuXG5leHBvcnQgdHlwZSBMYWJUZXN0Q2F0YWxvZ1ZpZXdQcm9wcyA9IHtcbiAgYnJlYWRjcnVtYnM6IHsgbGFiZWw6IHN0cmluZzsgaHJlZj86IHN0cmluZyB9W11cbiAgcGVybWlzc2lvbnM6IFBlcm1pc3Npb25bXVxuICByZWFkT25seT86IGJvb2xlYW5cbiAgdGl0bGU/OiBzdHJpbmdcbiAgc3VidGl0bGU/OiBzdHJpbmdcbn1cblxuY29uc3QgZW1wdHlGb3JtID0gKCkgPT4gKHtcbiAgdGVzdElkOiAnJyxcbiAgdGVzdE5hbWU6ICcnLFxuICBjYXRlZ29yeTogJ0xhYm9yYXRvcnknIGFzIExhYlRlc3RDYXRlZ29yeSxcbiAgcHJpY2U6IDAsXG4gIGlzQWN0aXZlOiB0cnVlLFxuICBkZXNjcmlwdGlvbjogJycsXG4gIG5vcm1hbFJhbmdlOiAnJyxcbiAgdW5pdDogJycsXG4gIHNhbXBsZVR5cGU6ICdCbG9vZCcgYXMgTGFiU2FtcGxlVHlwZSxcbn0pXG5cbmNvbnN0IExhYlRlc3RDYXRhbG9nVmlldyA9ICh7XG4gIGJyZWFkY3J1bWJzLFxuICBwZXJtaXNzaW9ucyxcbiAgcmVhZE9ubHkgPSBmYWxzZSxcbiAgdGl0bGUgPSAnTGFiIFRlc3RzIENhdGFsb2cnLFxuICBzdWJ0aXRsZSA9ICdNYW5hZ2UgdGVzdCBJRCwgY2F0ZWdvcnksIHByaWNpbmcsIGFuZCBjbGluaWNhbCBkZXRhaWxzJyxcbn06IExhYlRlc3RDYXRhbG9nVmlld1Byb3BzKSA9PiB7XG4gIGNvbnN0IHsgZGF0YVZlcnNpb24sIGlzU3VwYWJhc2UgfSA9IHVzZUhtc1N0b3JlQ29udGV4dCgpXG4gIGNvbnN0IFssIHNldFJlZnJlc2hdID0gdXNlU3RhdGUoMClcbiAgY29uc3QgcmVmcmVzaCA9ICgpID0+IHNldFJlZnJlc2goKHQpID0+IHQgKyAxKVxuXG4gIGNvbnN0IFtzZWFyY2gsIHNldFNlYXJjaF0gPSB1c2VTdGF0ZSgnJylcbiAgY29uc3QgW2NhdGVnb3J5RmlsdGVyLCBzZXRDYXRlZ29yeUZpbHRlcl0gPSB1c2VTdGF0ZTxDYXRlZ29yeUZpbHRlcj4oJ2FsbCcpXG4gIGNvbnN0IFtzYW1wbGVGaWx0ZXIsIHNldFNhbXBsZUZpbHRlcl0gPSB1c2VTdGF0ZTxTYW1wbGVGaWx0ZXI+KCdhbGwnKVxuICBjb25zdCBbcGFnZSwgc2V0UGFnZV0gPSB1c2VTdGF0ZSgxKVxuICBjb25zdCBbc2hvd01vZGFsLCBzZXRTaG93TW9kYWxdID0gdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtzaG93SW1wb3J0TW9kYWwsIHNldFNob3dJbXBvcnRNb2RhbF0gPSB1c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgW2VkaXRJZCwgc2V0RWRpdElkXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpXG4gIGNvbnN0IFtwYWdlTWVzc2FnZSwgc2V0UGFnZU1lc3NhZ2VdID0gdXNlU3RhdGUoJycpXG4gIGNvbnN0IFtmb3JtRXJyb3IsIHNldEZvcm1FcnJvcl0gPSB1c2VTdGF0ZSgnJylcbiAgY29uc3QgW3NhdmluZywgc2V0U2F2aW5nXSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbaW1wb3J0RmlsZSwgc2V0SW1wb3J0RmlsZV0gPSB1c2VTdGF0ZTxGaWxlIHwgbnVsbD4obnVsbClcbiAgY29uc3QgW2ltcG9ydGluZywgc2V0SW1wb3J0aW5nXSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbaW1wb3J0TWVzc2FnZSwgc2V0SW1wb3J0TWVzc2FnZV0gPSB1c2VTdGF0ZTx7IHR5cGU6ICdzdWNjZXNzJyB8ICdkYW5nZXInIHwgJ3dhcm5pbmcnOyB0ZXh0OiBzdHJpbmcgfSB8IG51bGw+KFxuICAgIG51bGwsXG4gIClcblxuICBjb25zdCBbZm9ybSwgc2V0Rm9ybV0gPSB1c2VTdGF0ZShlbXB0eUZvcm0oKSlcblxuICBjb25zdCBuZXh0VGVzdENvZGUgPSB1c2VNZW1vKFxuICAgICgpID0+IHBlZWtOZXh0TGFiVGVzdENvZGUoKSxcbiAgICBbbGFiVGVzdENhdGFsb2cubGVuZ3RoLCBzeXN0ZW1TZXR0aW5ncy5sYWJUZXN0Q29kZU5leHROdW1iZXJdLFxuICApXG5cbiAgY29uc3QgaXRlbXMgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBjb25zdCBxID0gc2VhcmNoLnRvTG93ZXJDYXNlKCkudHJpbSgpXG4gICAgcmV0dXJuIGxhYlRlc3RDYXRhbG9nXG4gICAgICAuZmlsdGVyKCh0KSA9PiBjYXRlZ29yeUZpbHRlciA9PT0gJ2FsbCcgfHwgdC5jYXRlZ29yeSA9PT0gY2F0ZWdvcnlGaWx0ZXIpXG4gICAgICAuZmlsdGVyKCh0KSA9PiBzYW1wbGVGaWx0ZXIgPT09ICdhbGwnIHx8IHQuc2FtcGxlVHlwZSA9PT0gc2FtcGxlRmlsdGVyKVxuICAgICAgLmZpbHRlcigodCkgPT4ge1xuICAgICAgICBpZiAoIXEpIHJldHVybiB0cnVlXG4gICAgICAgIHJldHVybiBgJHt0LnRlc3RJZH0gJHt0LnRlc3ROYW1lfSAke3QuY2F0ZWdvcnl9ICR7dC5zYW1wbGVUeXBlID8/ICcnfSAke3QuZGVzY3JpcHRpb24gPz8gJyd9YFxuICAgICAgICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgICAgICAgLmluY2x1ZGVzKHEpXG4gICAgICB9KVxuICAgICAgLnNvcnQoKGEsIGIpID0+IGEuY2F0ZWdvcnkubG9jYWxlQ29tcGFyZShiLmNhdGVnb3J5KSB8fCBhLnRlc3ROYW1lLmxvY2FsZUNvbXBhcmUoYi50ZXN0TmFtZSkpXG4gIH0sIFtzZWFyY2gsIGNhdGVnb3J5RmlsdGVyLCBzYW1wbGVGaWx0ZXIsIGxhYlRlc3RDYXRhbG9nLmxlbmd0aCwgZGF0YVZlcnNpb25dKVxuXG4gIGNvbnN0IHRvdGFsUGFnZXMgPSBNYXRoLm1heCgxLCBNYXRoLmNlaWwoaXRlbXMubGVuZ3RoIC8gUEFHRV9TSVpFKSlcbiAgY29uc3Qgc2FmZVBhZ2UgPSBNYXRoLm1pbihwYWdlLCB0b3RhbFBhZ2VzKVxuXG4gIGNvbnN0IHBhZ2VJdGVtcyA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IHN0YXJ0ID0gKHNhZmVQYWdlIC0gMSkgKiBQQUdFX1NJWkVcbiAgICByZXR1cm4gaXRlbXMuc2xpY2Uoc3RhcnQsIHN0YXJ0ICsgUEFHRV9TSVpFKVxuICB9LCBbaXRlbXMsIHNhZmVQYWdlXSlcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIHNldFBhZ2UoMSlcbiAgfSwgW3NlYXJjaCwgY2F0ZWdvcnlGaWx0ZXIsIHNhbXBsZUZpbHRlcl0pXG5cbiAgY29uc3Qgb3BlbkNyZWF0ZSA9ICgpID0+IHtcbiAgICBzZXRFZGl0SWQobnVsbClcbiAgICBzZXRGb3JtKHsgLi4uZW1wdHlGb3JtKCksIHRlc3RJZDogcGVla05leHRMYWJUZXN0Q29kZSgpIH0pXG4gICAgc2V0Rm9ybUVycm9yKCcnKVxuICAgIHNldFNob3dNb2RhbCh0cnVlKVxuICB9XG5cbiAgY29uc3Qgb3BlbkVkaXQgPSAoaXRlbTogTGFiVGVzdENhdGFsb2cpID0+IHtcbiAgICBzZXRFZGl0SWQoaXRlbS5pZClcbiAgICBzZXRGb3JtKHtcbiAgICAgIHRlc3RJZDogaXRlbS50ZXN0SWQsXG4gICAgICB0ZXN0TmFtZTogaXRlbS50ZXN0TmFtZSxcbiAgICAgIGNhdGVnb3J5OiBpdGVtLmNhdGVnb3J5LFxuICAgICAgcHJpY2U6IGl0ZW0ucHJpY2UsXG4gICAgICBpc0FjdGl2ZTogaXRlbS5pc0FjdGl2ZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBpdGVtLmRlc2NyaXB0aW9uID8/ICcnLFxuICAgICAgbm9ybWFsUmFuZ2U6IGl0ZW0ubm9ybWFsUmFuZ2UgPz8gJycsXG4gICAgICB1bml0OiBpdGVtLnVuaXQgPz8gJycsXG4gICAgICBzYW1wbGVUeXBlOiBpdGVtLnNhbXBsZVR5cGUgPz8gKGl0ZW0uY2F0ZWdvcnkgPT09ICdMYWJvcmF0b3J5JyA/ICdCbG9vZCcgOiAnTi9BJyksXG4gICAgfSlcbiAgICBzZXRGb3JtRXJyb3IoJycpXG4gICAgc2V0U2hvd01vZGFsKHRydWUpXG4gIH1cblxuICBjb25zdCBwZXJzaXN0Q2F0YWxvZyA9IGFzeW5jIChzdWNjZXNzTWVzc2FnZTogc3RyaW5nKSA9PiB7XG4gICAgaWYgKCFpc1N1cGFiYXNlKSB7XG4gICAgICBzZXRQYWdlTWVzc2FnZShgJHtzdWNjZXNzTWVzc2FnZX0gKGRhdGFiYXNlIG1vZGUgaXMgb2ZmIOKAlCBlbmFibGUgVklURV9VU0VfU1VQQUJBU0UgaW4gLmVudilgKVxuICAgICAgcmVmcmVzaCgpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBzZXRTYXZpbmcodHJ1ZSlcbiAgICB0cnkge1xuICAgICAgYXdhaXQgcGVyc2lzdExhYkNhdGFsb2dOb3dBc3luYygpXG4gICAgICBzZXRQYWdlTWVzc2FnZShgJHtzdWNjZXNzTWVzc2FnZX0gU2F2ZWQgdG8gZGF0YWJhc2UuYClcbiAgICAgIHJlZnJlc2goKVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc3QgZGV0YWlsID0gZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6ICdVbmtub3duIGVycm9yJ1xuICAgICAgc2V0UGFnZU1lc3NhZ2UoYERhdGFiYXNlIHNhdmUgZmFpbGVkOiAke2RldGFpbH1gKVxuICAgICAgcmVmcmVzaCgpXG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldFNhdmluZyhmYWxzZSlcbiAgICB9XG4gIH1cblxuICBjb25zdCBvcGVuSW1wb3J0ID0gKCkgPT4ge1xuICAgIHNldEltcG9ydEZpbGUobnVsbClcbiAgICBzZXRJbXBvcnRNZXNzYWdlKG51bGwpXG4gICAgc2V0U2hvd0ltcG9ydE1vZGFsKHRydWUpXG4gIH1cblxuICBjb25zdCBoYW5kbGVTYXZlID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmICghZm9ybS50ZXN0TmFtZS50cmltKCkpIHtcbiAgICAgIHNldEZvcm1FcnJvcignVGVzdCBuYW1lIGlzIHJlcXVpcmVkJylcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBpZiAoZm9ybS5wcmljZSA8IDAgfHwgTnVtYmVyLmlzTmFOKGZvcm0ucHJpY2UpKSB7XG4gICAgICBzZXRGb3JtRXJyb3IoJ1ByaWNlIGlzIHJlcXVpcmVkJylcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBzYXZlTGFiVGVzdENhdGFsb2dFbnRyeSh7XG4gICAgICAgIGlkOiBlZGl0SWQgPz8gdW5kZWZpbmVkLFxuICAgICAgICAuLi5mb3JtLFxuICAgICAgICBzYW1wbGVUeXBlOiBmb3JtLmNhdGVnb3J5ID09PSAnTGFib3JhdG9yeScgPyBmb3JtLnNhbXBsZVR5cGUgOiAnTi9BJyxcbiAgICAgIH0pXG4gICAgICBzZXRTaG93TW9kYWwoZmFsc2UpXG4gICAgICBhd2FpdCBwZXJzaXN0Q2F0YWxvZyhlZGl0SWQgPyAnVGVzdCB1cGRhdGVkLicgOiAnVGVzdCBhZGRlZC4nKVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgc2V0Rm9ybUVycm9yKGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiAnQ291bGQgbm90IHNhdmUgdGVzdCcpXG4gICAgfVxuICB9XG5cbiAgY29uc3QgdG9nZ2xlQWN0aXZlID0gYXN5bmMgKGl0ZW06IExhYlRlc3RDYXRhbG9nKSA9PiB7XG4gICAgc2F2ZUxhYlRlc3RDYXRhbG9nRW50cnkoeyAuLi5pdGVtLCBpc0FjdGl2ZTogIWl0ZW0uaXNBY3RpdmUgfSlcbiAgICBhd2FpdCBwZXJzaXN0Q2F0YWxvZyhpdGVtLmlzQWN0aXZlID8gJ1Rlc3QgZGVhY3RpdmF0ZWQuJyA6ICdUZXN0IGFjdGl2YXRlZC4nKVxuICB9XG5cbiAgY29uc3QgaGFuZGxlSW1wb3J0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmICghaW1wb3J0RmlsZSkge1xuICAgICAgc2V0SW1wb3J0TWVzc2FnZSh7IHR5cGU6ICdkYW5nZXInLCB0ZXh0OiAnUGxlYXNlIGNob29zZSBhbiBFeGNlbCBmaWxlIGZpcnN0LicgfSlcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIHNldEltcG9ydGluZyh0cnVlKVxuICAgIHNldEltcG9ydE1lc3NhZ2UobnVsbClcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBpbXBvcnRMYWJUZXN0Q2F0YWxvZ0Zyb21FeGNlbChpbXBvcnRGaWxlKVxuICAgICAgY29uc3Qgc2F2ZWQgPSByZXN1bHQuaW1wb3J0ZWQgKyByZXN1bHQudXBkYXRlZFxuXG4gICAgICBpZiAoc2F2ZWQgPT09IDApIHtcbiAgICAgICAgc2V0SW1wb3J0TWVzc2FnZSh7XG4gICAgICAgICAgdHlwZTogJ2RhbmdlcicsXG4gICAgICAgICAgdGV4dDogcmVzdWx0LmVycm9yc1swXSA/PyAnTm8gcm93cyB3ZXJlIGltcG9ydGVkLicsXG4gICAgICAgIH0pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoaXNTdXBhYmFzZSkge1xuICAgICAgICAgIGF3YWl0IHBlcnNpc3RMYWJDYXRhbG9nTm93QXN5bmMoKVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcnRzID0gW1xuICAgICAgICAgIHJlc3VsdC5pbXBvcnRlZCA+IDAgPyBgJHtyZXN1bHQuaW1wb3J0ZWR9IG5ld2AgOiAnJyxcbiAgICAgICAgICByZXN1bHQudXBkYXRlZCA+IDAgPyBgJHtyZXN1bHQudXBkYXRlZH0gdXBkYXRlZGAgOiAnJyxcbiAgICAgICAgICByZXN1bHQuc2tpcHBlZCA+IDAgPyBgJHtyZXN1bHQuc2tpcHBlZH0gc2tpcHBlZGAgOiAnJyxcbiAgICAgICAgXS5maWx0ZXIoQm9vbGVhbilcblxuICAgICAgICBzZXRJbXBvcnRNZXNzYWdlKHtcbiAgICAgICAgICB0eXBlOiByZXN1bHQuZXJyb3JzLmxlbmd0aCA+IDAgPyAnd2FybmluZycgOiAnc3VjY2VzcycsXG4gICAgICAgICAgdGV4dDogYEltcG9ydCBjb21wbGV0ZTogJHtwYXJ0cy5qb2luKCcsICcpfS4ke2lzU3VwYWJhc2UgPyAnIFNhdmVkIHRvIGRhdGFiYXNlLicgOiAnJ31gLFxuICAgICAgICB9KVxuICAgICAgICByZWZyZXNoKClcbiAgICAgICAgaWYgKHJlc3VsdC5lcnJvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiBzZXRTaG93SW1wb3J0TW9kYWwoZmFsc2UpLCAxODAwKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgICBzZXRJbXBvcnRNZXNzYWdlKHsgdHlwZTogJ2RhbmdlcicsIHRleHQ6ICdDb3VsZCBub3QgcmVhZCB0aGUgRXhjZWwgZmlsZS4gVXNlIHRoZSB0ZW1wbGF0ZSBmb3JtYXQuJyB9KVxuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRJbXBvcnRpbmcoZmFsc2UpXG4gICAgfVxuICB9XG5cbiAgY29uc3QgdXBkYXRlRm9ybSA9IDxLIGV4dGVuZHMga2V5b2YgdHlwZW9mIGZvcm0+KGtleTogSywgdmFsdWU6ICh0eXBlb2YgZm9ybSlbS10pID0+IHtcbiAgICBzZXRGb3JtKChwcmV2KSA9PiB7XG4gICAgICBjb25zdCBuZXh0ID0geyAuLi5wcmV2LCBba2V5XTogdmFsdWUgfVxuICAgICAgaWYgKGtleSA9PT0gJ2NhdGVnb3J5JyAmJiB2YWx1ZSAhPT0gJ0xhYm9yYXRvcnknKSB7XG4gICAgICAgIG5leHQuc2FtcGxlVHlwZSA9ICdOL0EnXG4gICAgICB9XG4gICAgICBpZiAoa2V5ID09PSAnY2F0ZWdvcnknICYmIHZhbHVlID09PSAnTGFib3JhdG9yeScgJiYgcHJldi5zYW1wbGVUeXBlID09PSAnTi9BJykge1xuICAgICAgICBuZXh0LnNhbXBsZVR5cGUgPSAnQmxvb2QnXG4gICAgICB9XG4gICAgICByZXR1cm4gbmV4dFxuICAgIH0pXG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxQZXJtaXNzaW9uR3VhcmQgcGVybWlzc2lvbnM9e3Blcm1pc3Npb25zfT5cbiAgICAgIDxQYWdlTWV0YURhdGEgdGl0bGU9e3RpdGxlfSAvPlxuICAgICAgPFBhZ2VIZWFkZXJcbiAgICAgICAgdGl0bGU9e3RpdGxlfVxuICAgICAgICBzdWJ0aXRsZT17c3VidGl0bGV9XG4gICAgICAgIGJyZWFkY3J1bWJzPXticmVhZGNydW1ic31cbiAgICAgICAgYWN0aW9uTGFiZWw9e3JlYWRPbmx5ID8gdW5kZWZpbmVkIDogJ0FkZCBUZXN0J31cbiAgICAgICAgYWN0aW9uSWNvbj1cInNvbGFyOmFkZC1jaXJjbGUtYnJva2VuXCJcbiAgICAgICAgb25BY3Rpb249e3JlYWRPbmx5ID8gdW5kZWZpbmVkIDogb3BlbkNyZWF0ZX1cbiAgICAgID5cbiAgICAgICAgeyFyZWFkT25seSAmJiAoXG4gICAgICAgICAgPEJ1dHRvbiB2YXJpYW50PVwib3V0bGluZS1wcmltYXJ5XCIgb25DbGljaz17b3BlbkltcG9ydH0+XG4gICAgICAgICAgICA8SWNvbmlmeUljb24gaWNvbj1cInNvbGFyOnVwbG9hZC1taW5pbWFsaXN0aWMtYnJva2VuXCIgY2xhc3NOYW1lPVwibWUtMVwiIC8+XG4gICAgICAgICAgICBJbXBvcnQgRXhjZWxcbiAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgKX1cbiAgICAgIDwvUGFnZUhlYWRlcj5cblxuICAgICAge3BhZ2VNZXNzYWdlICYmIChcbiAgICAgICAgPEFsZXJ0IHZhcmlhbnQ9XCJzdWNjZXNzXCIgZGlzbWlzc2libGUgb25DbG9zZT17KCkgPT4gc2V0UGFnZU1lc3NhZ2UoJycpfT5cbiAgICAgICAgICB7cGFnZU1lc3NhZ2V9XG4gICAgICAgIDwvQWxlcnQ+XG4gICAgICApfVxuXG4gICAgICA8Q2FyZD5cbiAgICAgICAgPENhcmRCb2R5PlxuICAgICAgICAgIDxSb3cgY2xhc3NOYW1lPVwiZy0zIG1iLTNcIj5cbiAgICAgICAgICAgIDxDb2wgbWQ9ezV9PlxuICAgICAgICAgICAgICA8SW5wdXRHcm91cD5cbiAgICAgICAgICAgICAgICA8SW5wdXRHcm91cC5UZXh0PlxuICAgICAgICAgICAgICAgICAgPEljb25pZnlJY29uIGljb249XCJzb2xhcjptYWduaWZlci1icm9rZW5cIiAvPlxuICAgICAgICAgICAgICAgIDwvSW5wdXRHcm91cC5UZXh0PlxuICAgICAgICAgICAgICAgIDxGb3JtLkNvbnRyb2xcbiAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiU2VhcmNoIGJ5IElELCBuYW1lLCBjYXRlZ29yeS4uLlwiXG4gICAgICAgICAgICAgICAgICB2YWx1ZT17c2VhcmNofVxuICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRTZWFyY2goZS50YXJnZXQudmFsdWUpfVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIDwvSW5wdXRHcm91cD5cbiAgICAgICAgICAgIDwvQ29sPlxuICAgICAgICAgICAgPENvbCBtZD17M30+XG4gICAgICAgICAgICAgIDxGb3JtLlNlbGVjdCB2YWx1ZT17Y2F0ZWdvcnlGaWx0ZXJ9IG9uQ2hhbmdlPXsoZSkgPT4gc2V0Q2F0ZWdvcnlGaWx0ZXIoZS50YXJnZXQudmFsdWUgYXMgQ2F0ZWdvcnlGaWx0ZXIpfT5cbiAgICAgICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiYWxsXCI+QWxsIGNhdGVnb3JpZXM8L29wdGlvbj5cbiAgICAgICAgICAgICAgICB7Q0FURUdPUklFUy5tYXAoKGMpID0+IChcbiAgICAgICAgICAgICAgICAgIDxvcHRpb24ga2V5PXtjfSB2YWx1ZT17Y30+XG4gICAgICAgICAgICAgICAgICAgIHtjfVxuICAgICAgICAgICAgICAgICAgPC9vcHRpb24+XG4gICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgIDwvRm9ybS5TZWxlY3Q+XG4gICAgICAgICAgICA8L0NvbD5cbiAgICAgICAgICAgIDxDb2wgbWQ9ezN9PlxuICAgICAgICAgICAgICA8Rm9ybS5TZWxlY3RcbiAgICAgICAgICAgICAgICB2YWx1ZT17c2FtcGxlRmlsdGVyfVxuICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0U2FtcGxlRmlsdGVyKGUudGFyZ2V0LnZhbHVlIGFzIFNhbXBsZUZpbHRlcil9XG4gICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2NhdGVnb3J5RmlsdGVyICE9PSAnYWxsJyAmJiBjYXRlZ29yeUZpbHRlciAhPT0gJ0xhYm9yYXRvcnknfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cImFsbFwiPkFsbCBzYW1wbGUgdHlwZXM8L29wdGlvbj5cbiAgICAgICAgICAgICAgICB7U0FNUExFX1RZUEVTLm1hcCgocykgPT4gKFxuICAgICAgICAgICAgICAgICAgPG9wdGlvbiBrZXk9e3N9IHZhbHVlPXtzfT5cbiAgICAgICAgICAgICAgICAgICAge3N9XG4gICAgICAgICAgICAgICAgICA8L29wdGlvbj5cbiAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgPC9Gb3JtLlNlbGVjdD5cbiAgICAgICAgICAgIDwvQ29sPlxuICAgICAgICAgICAgPENvbCBtZD17MX0gY2xhc3NOYW1lPVwiZC1mbGV4IGFsaWduLWl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNvbnRlbnQtZW5kIHRleHQtbXV0ZWQgc21hbGxcIj5cbiAgICAgICAgICAgICAge2l0ZW1zLmxlbmd0aH0gdGVzdHNcbiAgICAgICAgICAgIDwvQ29sPlxuICAgICAgICAgIDwvUm93PlxuXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0YWJsZS1yZXNwb25zaXZlXCI+XG4gICAgICAgICAgICA8VGFibGUgaG92ZXIgY2xhc3NOYW1lPVwibWItMCBhbGlnbi1taWRkbGVcIj5cbiAgICAgICAgICAgICAgPHRoZWFkIGNsYXNzTmFtZT1cImJnLWxpZ2h0IGJnLW9wYWNpdHktNTBcIj5cbiAgICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgICA8dGg+VGVzdCBJRDwvdGg+XG4gICAgICAgICAgICAgICAgICA8dGg+VGVzdCBOYW1lPC90aD5cbiAgICAgICAgICAgICAgICAgIDx0aD5DYXRlZ29yeTwvdGg+XG4gICAgICAgICAgICAgICAgICA8dGg+U2FtcGxlPC90aD5cbiAgICAgICAgICAgICAgICAgIDx0aD5QcmljZTwvdGg+XG4gICAgICAgICAgICAgICAgICA8dGg+Tm9ybWFsIFJhbmdlPC90aD5cbiAgICAgICAgICAgICAgICAgIDx0aD5TdGF0dXM8L3RoPlxuICAgICAgICAgICAgICAgICAgeyFyZWFkT25seSAmJiA8dGggLz59XG4gICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgICAgIHtwYWdlSXRlbXMubGVuZ3RoID09PSAwID8gKFxuICAgICAgICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgICAgICA8dGQgY29sU3Bhbj17cmVhZE9ubHkgPyA3IDogOH0gY2xhc3NOYW1lPVwidGV4dC1jZW50ZXIgdGV4dC1tdXRlZCBweS00XCI+XG4gICAgICAgICAgICAgICAgICAgICAgTm8gdGVzdHMgZm91bmRcbiAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgIHBhZ2VJdGVtcy5tYXAoKHQpID0+IChcbiAgICAgICAgICAgICAgICAgICAgPHRyIGtleT17dC5pZH0gY2xhc3NOYW1lPXshdC5pc0FjdGl2ZSA/ICd0ZXh0LW11dGVkJyA6IHVuZGVmaW5lZH0+XG4gICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cImZ3LW1lZGl1bVwiPnt0LnRlc3RJZH08L3RkPlxuICAgICAgICAgICAgICAgICAgICAgIDx0ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXY+e3QudGVzdE5hbWV9PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICB7dC5kZXNjcmlwdGlvbiAmJiA8ZGl2IGNsYXNzTmFtZT1cInNtYWxsIHRleHQtbXV0ZWRcIj57dC5kZXNjcmlwdGlvbn08L2Rpdj59XG4gICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICA8dGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICA8QmFkZ2UgYmc9XCJsaWdodFwiIHRleHQ9XCJkYXJrXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHt0LmNhdGVnb3J5fVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9CYWRnZT5cbiAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgIDx0ZD57dC5zYW1wbGVUeXBlID8/ICfigJQnfTwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgPHRkPlxuICAgICAgICAgICAgICAgICAgICAgICAge2N1cnJlbmN5fVxuICAgICAgICAgICAgICAgICAgICAgICAge3QucHJpY2UudG9Mb2NhbGVTdHJpbmcoKX1cbiAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9XCJzbWFsbFwiPnt0Lm5vcm1hbFJhbmdlID8/ICfigJQnfTwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgPHRkPlxuICAgICAgICAgICAgICAgICAgICAgICAgPFN0YXR1c0JhZGdlIHN0YXR1cz17dC5pc0FjdGl2ZSA/ICdBY3RpdmUnIDogJ0luYWN0aXZlJ30gLz5cbiAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgIHshcmVhZE9ubHkgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInRleHQtZW5kXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxCdXR0b24gc2l6ZT1cInNtXCIgdmFyaWFudD1cImxpZ2h0XCIgY2xhc3NOYW1lPVwibWUtMVwiIG9uQ2xpY2s9eygpID0+IG9wZW5FZGl0KHQpfT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBFZGl0XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8QnV0dG9uIHNpemU9XCJzbVwiIHZhcmlhbnQ9XCJvdXRsaW5lLXNlY29uZGFyeVwiIG9uQ2xpY2s9eygpID0+IHRvZ2dsZUFjdGl2ZSh0KX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge3QuaXNBY3RpdmUgPyAnRGVhY3RpdmF0ZScgOiAnQWN0aXZhdGUnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICkpXG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgICAgIDwvVGFibGU+XG4gICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICB7dG90YWxQYWdlcyA+IDEgJiYgKFxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJkLWZsZXgganVzdGlmeS1jb250ZW50LWJldHdlZW4gYWxpZ24taXRlbXMtY2VudGVyIG10LTNcIj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1tdXRlZCBzbWFsbFwiPlxuICAgICAgICAgICAgICAgIFBhZ2Uge3NhZmVQYWdlfSBvZiB7dG90YWxQYWdlc31cbiAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImQtZmxleCBnYXAtMlwiPlxuICAgICAgICAgICAgICAgIDxCdXR0b24gc2l6ZT1cInNtXCIgdmFyaWFudD1cImxpZ2h0XCIgZGlzYWJsZWQ9e3NhZmVQYWdlIDw9IDF9IG9uQ2xpY2s9eygpID0+IHNldFBhZ2Uoc2FmZVBhZ2UgLSAxKX0+XG4gICAgICAgICAgICAgICAgICBQcmV2aW91c1xuICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgIHNpemU9XCJzbVwiXG4gICAgICAgICAgICAgICAgICB2YXJpYW50PVwibGlnaHRcIlxuICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e3NhZmVQYWdlID49IHRvdGFsUGFnZXN9XG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRQYWdlKHNhZmVQYWdlICsgMSl9XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgTmV4dFxuICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvQ2FyZEJvZHk+XG4gICAgICA8L0NhcmQ+XG5cbiAgICAgIHshcmVhZE9ubHkgJiYgKFxuICAgICAgICA8TW9kYWwgc2hvdz17c2hvd01vZGFsfSBvbkhpZGU9eygpID0+IHNldFNob3dNb2RhbChmYWxzZSl9IGNlbnRlcmVkIHNpemU9XCJsZ1wiPlxuICAgICAgICAgIDxNb2RhbC5IZWFkZXIgY2xvc2VCdXR0b24+XG4gICAgICAgICAgICA8TW9kYWwuVGl0bGU+e2VkaXRJZCA/ICdFZGl0IExhYiBUZXN0JyA6ICdBZGQgTGFiIFRlc3QnfTwvTW9kYWwuVGl0bGU+XG4gICAgICAgICAgPC9Nb2RhbC5IZWFkZXI+XG4gICAgICAgICAgPE1vZGFsLkJvZHk+XG4gICAgICAgICAgICB7Zm9ybUVycm9yICYmIDxBbGVydCB2YXJpYW50PVwiZGFuZ2VyXCI+e2Zvcm1FcnJvcn08L0FsZXJ0Pn1cbiAgICAgICAgICAgIDxSb3c+XG4gICAgICAgICAgICAgIDxDb2wgbWQ9ezZ9PlxuICAgICAgICAgICAgICAgIDxGb3JtLkdyb3VwIGNsYXNzTmFtZT1cIm1iLTNcIj5cbiAgICAgICAgICAgICAgICAgIDxGb3JtLkxhYmVsPlRlc3QgSUQgKjwvRm9ybS5MYWJlbD5cbiAgICAgICAgICAgICAgICAgIDxGb3JtLkNvbnRyb2xcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2Zvcm0udGVzdElkfVxuICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHVwZGF0ZUZvcm0oJ3Rlc3RJZCcsIGUudGFyZ2V0LnZhbHVlKX1cbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9e25leHRUZXN0Q29kZX1cbiAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e0Jvb2xlYW4oZWRpdElkKX1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICB7IWVkaXRJZCAmJiA8Rm9ybS5UZXh0IG11dGVkPkxlYXZlIGJsYW5rIHRvIGF1dG8tZ2VuZXJhdGUgKHtuZXh0VGVzdENvZGV9KTwvRm9ybS5UZXh0Pn1cbiAgICAgICAgICAgICAgICA8L0Zvcm0uR3JvdXA+XG4gICAgICAgICAgICAgIDwvQ29sPlxuICAgICAgICAgICAgICA8Q29sIG1kPXs2fT5cbiAgICAgICAgICAgICAgICA8Rm9ybS5Hcm91cCBjbGFzc05hbWU9XCJtYi0zXCI+XG4gICAgICAgICAgICAgICAgICA8Rm9ybS5MYWJlbD5TdGF0dXMgKjwvRm9ybS5MYWJlbD5cbiAgICAgICAgICAgICAgICAgIDxGb3JtLlNlbGVjdFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZT17Zm9ybS5pc0FjdGl2ZSA/ICdhY3RpdmUnIDogJ2luYWN0aXZlJ31cbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiB1cGRhdGVGb3JtKCdpc0FjdGl2ZScsIGUudGFyZ2V0LnZhbHVlID09PSAnYWN0aXZlJyl9XG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJhY3RpdmVcIj5BY3RpdmU8L29wdGlvbj5cbiAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cImluYWN0aXZlXCI+SW5hY3RpdmU8L29wdGlvbj5cbiAgICAgICAgICAgICAgICAgIDwvRm9ybS5TZWxlY3Q+XG4gICAgICAgICAgICAgICAgPC9Gb3JtLkdyb3VwPlxuICAgICAgICAgICAgICA8L0NvbD5cbiAgICAgICAgICAgIDwvUm93PlxuICAgICAgICAgICAgPEZvcm0uR3JvdXAgY2xhc3NOYW1lPVwibWItM1wiPlxuICAgICAgICAgICAgICA8Rm9ybS5MYWJlbD5UZXN0IE5hbWUgKjwvRm9ybS5MYWJlbD5cbiAgICAgICAgICAgICAgPEZvcm0uQ29udHJvbCB2YWx1ZT17Zm9ybS50ZXN0TmFtZX0gb25DaGFuZ2U9eyhlKSA9PiB1cGRhdGVGb3JtKCd0ZXN0TmFtZScsIGUudGFyZ2V0LnZhbHVlKX0gcmVxdWlyZWQgLz5cbiAgICAgICAgICAgIDwvRm9ybS5Hcm91cD5cbiAgICAgICAgICAgIDxSb3c+XG4gICAgICAgICAgICAgIDxDb2wgbWQ9ezZ9PlxuICAgICAgICAgICAgICAgIDxGb3JtLkdyb3VwIGNsYXNzTmFtZT1cIm1iLTNcIj5cbiAgICAgICAgICAgICAgICAgIDxGb3JtLkxhYmVsPkNhdGVnb3J5IC8gVHlwZSAqPC9Gb3JtLkxhYmVsPlxuICAgICAgICAgICAgICAgICAgPEZvcm0uU2VsZWN0XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlPXtmb3JtLmNhdGVnb3J5fVxuICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHVwZGF0ZUZvcm0oJ2NhdGVnb3J5JywgZS50YXJnZXQudmFsdWUgYXMgTGFiVGVzdENhdGVnb3J5KX1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge0NBVEVHT1JJRVMubWFwKChjKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiBrZXk9e2N9IHZhbHVlPXtjfT5cbiAgICAgICAgICAgICAgICAgICAgICAgIHtjfVxuICAgICAgICAgICAgICAgICAgICAgIDwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgIDwvRm9ybS5TZWxlY3Q+XG4gICAgICAgICAgICAgICAgPC9Gb3JtLkdyb3VwPlxuICAgICAgICAgICAgICA8L0NvbD5cbiAgICAgICAgICAgICAgPENvbCBtZD17Nn0+XG4gICAgICAgICAgICAgICAgPEZvcm0uR3JvdXAgY2xhc3NOYW1lPVwibWItM1wiPlxuICAgICAgICAgICAgICAgICAgPEZvcm0uTGFiZWw+UHJpY2UgKHtjdXJyZW5jeX0pICo8L0Zvcm0uTGFiZWw+XG4gICAgICAgICAgICAgICAgICA8Rm9ybS5Db250cm9sXG4gICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxuICAgICAgICAgICAgICAgICAgICBtaW49ezB9XG4gICAgICAgICAgICAgICAgICAgIHN0ZXA9ezAuMDF9XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlPXtmb3JtLnByaWNlfVxuICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHVwZGF0ZUZvcm0oJ3ByaWNlJywgTnVtYmVyKGUudGFyZ2V0LnZhbHVlKSl9XG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIDwvRm9ybS5Hcm91cD5cbiAgICAgICAgICAgICAgPC9Db2w+XG4gICAgICAgICAgICA8L1Jvdz5cbiAgICAgICAgICAgIHtmb3JtLmNhdGVnb3J5ID09PSAnTGFib3JhdG9yeScgJiYgKFxuICAgICAgICAgICAgICA8Rm9ybS5Hcm91cCBjbGFzc05hbWU9XCJtYi0zXCI+XG4gICAgICAgICAgICAgICAgPEZvcm0uTGFiZWw+U2FtcGxlIFR5cGU8L0Zvcm0uTGFiZWw+XG4gICAgICAgICAgICAgICAgPEZvcm0uU2VsZWN0XG4gICAgICAgICAgICAgICAgICB2YWx1ZT17Zm9ybS5zYW1wbGVUeXBlfVxuICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiB1cGRhdGVGb3JtKCdzYW1wbGVUeXBlJywgZS50YXJnZXQudmFsdWUgYXMgTGFiU2FtcGxlVHlwZSl9XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgeyhbJ0Jsb29kJywgJ1VyaW5lJywgJ1N0b29sJywgJ090aGVyJ10gYXMgTGFiU2FtcGxlVHlwZVtdKS5tYXAoKHMpID0+IChcbiAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiBrZXk9e3N9IHZhbHVlPXtzfT5cbiAgICAgICAgICAgICAgICAgICAgICB7c31cbiAgICAgICAgICAgICAgICAgICAgPC9vcHRpb24+XG4gICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICA8L0Zvcm0uU2VsZWN0PlxuICAgICAgICAgICAgICA8L0Zvcm0uR3JvdXA+XG4gICAgICAgICAgICApfVxuICAgICAgICAgICAgPEZvcm0uR3JvdXAgY2xhc3NOYW1lPVwibWItM1wiPlxuICAgICAgICAgICAgICA8Rm9ybS5MYWJlbD5EZXNjcmlwdGlvbjwvRm9ybS5MYWJlbD5cbiAgICAgICAgICAgICAgPEZvcm0uQ29udHJvbFxuICAgICAgICAgICAgICAgIGFzPVwidGV4dGFyZWFcIlxuICAgICAgICAgICAgICAgIHJvd3M9ezJ9XG4gICAgICAgICAgICAgICAgdmFsdWU9e2Zvcm0uZGVzY3JpcHRpb259XG4gICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiB1cGRhdGVGb3JtKCdkZXNjcmlwdGlvbicsIGUudGFyZ2V0LnZhbHVlKX1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvRm9ybS5Hcm91cD5cbiAgICAgICAgICAgIDxSb3c+XG4gICAgICAgICAgICAgIDxDb2wgbWQ9ezZ9PlxuICAgICAgICAgICAgICAgIDxGb3JtLkdyb3VwIGNsYXNzTmFtZT1cIm1iLTNcIj5cbiAgICAgICAgICAgICAgICAgIDxGb3JtLkxhYmVsPk5vcm1hbCBSYW5nZTwvRm9ybS5MYWJlbD5cbiAgICAgICAgICAgICAgICAgIDxGb3JtLkNvbnRyb2wgdmFsdWU9e2Zvcm0ubm9ybWFsUmFuZ2V9IG9uQ2hhbmdlPXsoZSkgPT4gdXBkYXRlRm9ybSgnbm9ybWFsUmFuZ2UnLCBlLnRhcmdldC52YWx1ZSl9IC8+XG4gICAgICAgICAgICAgICAgPC9Gb3JtLkdyb3VwPlxuICAgICAgICAgICAgICA8L0NvbD5cbiAgICAgICAgICAgICAgPENvbCBtZD17Nn0+XG4gICAgICAgICAgICAgICAgPEZvcm0uR3JvdXAgY2xhc3NOYW1lPVwibWItM1wiPlxuICAgICAgICAgICAgICAgICAgPEZvcm0uTGFiZWw+VW5pdDwvRm9ybS5MYWJlbD5cbiAgICAgICAgICAgICAgICAgIDxGb3JtLkNvbnRyb2wgdmFsdWU9e2Zvcm0udW5pdH0gb25DaGFuZ2U9eyhlKSA9PiB1cGRhdGVGb3JtKCd1bml0JywgZS50YXJnZXQudmFsdWUpfSAvPlxuICAgICAgICAgICAgICAgIDwvRm9ybS5Hcm91cD5cbiAgICAgICAgICAgICAgPC9Db2w+XG4gICAgICAgICAgICA8L1Jvdz5cbiAgICAgICAgICA8L01vZGFsLkJvZHk+XG4gICAgICAgICAgPE1vZGFsLkZvb3Rlcj5cbiAgICAgICAgICAgIDxCdXR0b24gdmFyaWFudD1cImxpZ2h0XCIgb25DbGljaz17KCkgPT4gc2V0U2hvd01vZGFsKGZhbHNlKX0+XG4gICAgICAgICAgICAgIENhbmNlbFxuICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgIHZhcmlhbnQ9XCJzdWNjZXNzXCJcbiAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlU2F2ZX1cbiAgICAgICAgICAgICAgZGlzYWJsZWQ9eyFmb3JtLnRlc3ROYW1lLnRyaW0oKSB8fCBzYXZpbmd9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtzYXZpbmcgPyAnU2F2aW5nLi4uJyA6ICdTYXZlJ31cbiAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgIDwvTW9kYWwuRm9vdGVyPlxuICAgICAgICA8L01vZGFsPlxuICAgICAgKX1cblxuICAgICAgeyFyZWFkT25seSAmJiAoXG4gICAgICAgIDxNb2RhbCBzaG93PXtzaG93SW1wb3J0TW9kYWx9IG9uSGlkZT17KCkgPT4gc2V0U2hvd0ltcG9ydE1vZGFsKGZhbHNlKX0gY2VudGVyZWQgc2l6ZT1cImxnXCI+XG4gICAgICAgICAgPE1vZGFsLkhlYWRlciBjbG9zZUJ1dHRvbj5cbiAgICAgICAgICAgIDxNb2RhbC5UaXRsZT5JbXBvcnQgTGFiIFRlc3RzIGZyb20gRXhjZWw8L01vZGFsLlRpdGxlPlxuICAgICAgICAgIDwvTW9kYWwuSGVhZGVyPlxuICAgICAgICAgIDxNb2RhbC5Cb2R5PlxuICAgICAgICAgICAge2ltcG9ydE1lc3NhZ2UgJiYgKFxuICAgICAgICAgICAgICA8QWxlcnQgdmFyaWFudD17aW1wb3J0TWVzc2FnZS50eXBlfSBjbGFzc05hbWU9XCJtYi0zXCI+XG4gICAgICAgICAgICAgICAge2ltcG9ydE1lc3NhZ2UudGV4dH1cbiAgICAgICAgICAgICAgPC9BbGVydD5cbiAgICAgICAgICAgICl9XG5cbiAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtbXV0ZWRcIj5cbiAgICAgICAgICAgICAgVXBsb2FkIEV4Y2VsIHRvIGFkZCBtYW55IHRlc3RzIGF0IG9uY2UuIFVzZSB0aGUgc2FtZSA8c3Ryb25nPlRlc3QgSUQ8L3N0cm9uZz4gdG8gdXBkYXRlIGFuIGV4aXN0aW5nIHRlc3QuXG4gICAgICAgICAgICAgIExlYXZlIFRlc3QgSUQgYmxhbmsgdG8gYXV0by1nZW5lcmF0ZSAoZS5nLiB7bmV4dFRlc3RDb2RlfSkuXG4gICAgICAgICAgICA8L3A+XG5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYm9yZGVyIHJvdW5kZWQgcC0zIGJnLWxpZ2h0IGJnLW9wYWNpdHktNTAgbWItM1wiPlxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJmdy1tZWRpdW0gbWItMlwiPkNvbHVtbnM8L3A+XG4gICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInNtYWxsIHRleHQtbXV0ZWQgbWItMFwiPntMQUJfVEVTVF9DQVRBTE9HX0hFQURFUlMuam9pbignIMK3ICcpfTwvcD5cbiAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICA8QnV0dG9uIHZhcmlhbnQ9XCJvdXRsaW5lLXNlY29uZGFyeVwiIGNsYXNzTmFtZT1cIm1iLTNcIiBvbkNsaWNrPXtkb3dubG9hZExhYlRlc3RDYXRhbG9nVGVtcGxhdGV9PlxuICAgICAgICAgICAgICA8SWNvbmlmeUljb24gaWNvbj1cInNvbGFyOmRvd25sb2FkLW1pbmltYWxpc3RpYy1icm9rZW5cIiBjbGFzc05hbWU9XCJtZS0xXCIgLz5cbiAgICAgICAgICAgICAgRG93bmxvYWQgdGVtcGxhdGVcbiAgICAgICAgICAgIDwvQnV0dG9uPlxuXG4gICAgICAgICAgICA8Rm9ybS5Hcm91cD5cbiAgICAgICAgICAgICAgPEZvcm0uTGFiZWw+RXhjZWwgZmlsZTwvRm9ybS5MYWJlbD5cbiAgICAgICAgICAgICAgPEZvcm0uQ29udHJvbFxuICAgICAgICAgICAgICAgIHR5cGU9XCJmaWxlXCJcbiAgICAgICAgICAgICAgICBhY2NlcHQ9XCIueGxzeCwueGxzLC5jc3ZcIlxuICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gZS50YXJnZXQgYXMgSFRNTElucHV0RWxlbWVudFxuICAgICAgICAgICAgICAgICAgc2V0SW1wb3J0RmlsZSh0YXJnZXQuZmlsZXM/LlswXSA/PyBudWxsKVxuICAgICAgICAgICAgICAgICAgc2V0SW1wb3J0TWVzc2FnZShudWxsKVxuICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIHtpbXBvcnRGaWxlICYmIDxGb3JtLlRleHQgY2xhc3NOYW1lPVwidGV4dC1tdXRlZFwiPlNlbGVjdGVkOiB7aW1wb3J0RmlsZS5uYW1lfTwvRm9ybS5UZXh0Pn1cbiAgICAgICAgICAgIDwvRm9ybS5Hcm91cD5cbiAgICAgICAgICA8L01vZGFsLkJvZHk+XG4gICAgICAgICAgPE1vZGFsLkZvb3Rlcj5cbiAgICAgICAgICAgIDxCdXR0b24gdmFyaWFudD1cImxpZ2h0XCIgb25DbGljaz17KCkgPT4gc2V0U2hvd0ltcG9ydE1vZGFsKGZhbHNlKX0+XG4gICAgICAgICAgICAgIENhbmNlbFxuICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICA8QnV0dG9uIHZhcmlhbnQ9XCJwcmltYXJ5XCIgb25DbGljaz17aGFuZGxlSW1wb3J0fSBkaXNhYmxlZD17IWltcG9ydEZpbGUgfHwgaW1wb3J0aW5nfT5cbiAgICAgICAgICAgICAge2ltcG9ydGluZyA/ICdJbXBvcnRpbmcuLi4nIDogJ0ltcG9ydCBkYXRhJ31cbiAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgIDwvTW9kYWwuRm9vdGVyPlxuICAgICAgICA8L01vZGFsPlxuICAgICAgKX1cbiAgICA8L1Blcm1pc3Npb25HdWFyZD5cbiAgKVxufVxuXG5leHBvcnQgZGVmYXVsdCBMYWJUZXN0Q2F0YWxvZ1ZpZXdcbiJdLCJmaWxlIjoiQzovVXNlcnMvSFAvVmlkZW9zL2ZhcnV1cSBsYXN0L3NyYy9zaGFyZWQvY29tcG9uZW50cy9MYWJUZXN0Q2F0YWxvZ1ZpZXcudHN4In0=