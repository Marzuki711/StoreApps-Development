/* ==========================================================
   STORE APPS - DAILY SALES OCR
   File: js/daily-sales-ocr.js

   Adds Scan / Take Picture to the existing Daily Sales form.
   It does NOT replace Daily Sales API/database logic.

   OCR source: Tesseract.js loaded on demand from jsDelivr.
========================================================== */
(function () {
    "use strict";

    const TESSERACT_VERSION = "5.1.1";
    const TESSERACT_URL =
        `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`;

    let tesseractPromise = null;
    let lastContainer = null;

    const FIELD_MAP = [
        { key: "services", ids: ["dsServices"], labels: ["services", "service"] },
        { key: "food", ids: ["dsFood"], labels: ["food"] },
        { key: "beverage", ids: ["dsBeverage"], labels: ["beverage", "beverages", "bevarage", "bevarages"] },
        { key: "generalMerchandise", ids: ["dsGeneralMerchandise"], labels: ["general merchandise", "generalmerchandise"] },
        { key: "tobacco", ids: ["dsTobacco"], labels: ["tobacco/alcoholic", "tobacco alcoholic", "tobacco", "tobacco/alcoholic"] },
        { key: "supply", ids: ["dsSupply"], labels: ["supply"] },
        { key: "foodService", ids: ["dsFoodService"], labels: ["food service", "foodservice"] },
        { key: "alcoholic", ids: ["dsAlcoholic"], labels: ["alcoholic", "alcohol"] },
        { key: "totalSales", ids: ["dsTotalSales"], labels: ["total gross sales (incl.gst)", "total gross sales incl.gst", "total gross sales", "gross sales"] }
    ];

    function $(id) { return document.getElementById(id); }

    function loadTesseract() {
        if (window.Tesseract) return Promise.resolve(window.Tesseract);
        if (tesseractPromise) return tesseractPromise;

        tesseractPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-storeapps-tesseract="1"]');
            if (existing) {
                existing.addEventListener("load", () => resolve(window.Tesseract));
                existing.addEventListener("error", reject);
                return;
            }
            const script = document.createElement("script");
            script.src = TESSERACT_URL;
            script.async = true;
            script.dataset.storeappsTesseract = "1";
            script.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error("Tesseract.js failed to load."));
            script.onerror = () => reject(new Error("Unable to load OCR engine. Please check your internet connection."));
            document.head.appendChild(script);
        });
        return tesseractPromise;
    }

    function ensureControls() {
        const form = $("dailySalesFormWrapper");
        if (!form) return false;
        if ($("dsOcrFileInput") && $("dsScanButton")) return true;

        const salesTitle = Array.from(form.querySelectorAll(".ds-section-title"))
            .find(el => /sales information/i.test(el.textContent || ""));
        const grid = salesTitle ? salesTitle.nextElementSibling : null;
        if (!grid || !grid.classList.contains("ds-grid")) return false;

        if (!$('dsScanButton')) {
            const wrap = document.createElement("div");
            wrap.className = "ds-field ds-field-wide";
            wrap.innerHTML = `
                <label>Scan Sales Report</label>
                <button type="button" id="dsScanButton" class="ds-secondary-btn" style="width:100%;">
                    <i class="fa-solid fa-camera"></i> Scan / Take Picture
                </button>
                <input id="dsOcrFileInput" type="file" accept="image/*" capture="environment" style="display:none;">
                <small id="dsOcrStatus" style="display:block;margin-top:6px;opacity:.75;"></small>
            `;
            grid.insertBefore(wrap, grid.firstElementChild);
        }

        $("dsScanButton").onclick = () => $("dsOcrFileInput")?.click();
        $("dsOcrFileInput").onchange = handleFile;
        return true;
    }

    function setStatus(message, busy) {
        const status = $("dsOcrStatus");
        if (status) status.textContent = message || "";
        const btn = $("dsScanButton");
        if (btn) {
            btn.disabled = !!busy;
            btn.innerHTML = busy
                ? '<i class="fa-solid fa-spinner fa-spin"></i> Reading Document...'
                : '<i class="fa-solid fa-camera"></i> Scan / Take Picture';
        }
    }

    async function handleFile(event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (!file) return;

        setStatus("Preparing OCR...", true);
        try {
            const Tesseract = await loadTesseract();
            const result = await Tesseract.recognize(file, "eng", {
                logger: m => {
                    if (m && m.status && typeof m.progress === "number") {
                        const p = Math.round(m.progress * 100);
                        setStatus(`Reading document... ${p}%`, true);
                    }
                }
            });

            const text = result?.data?.text || "";
            const values = parseReport(text);
            const filled = applyValues(values);

            if (typeof window.calculateDailySales === "function") {
                window.calculateDailySales();
            }

            if (!filled.length) {
                setStatus("No matching sales data found. Please use a clearer image.", false);
                await showInfo("No matching sales data found. Please take a clear photo of the OEOD sales report.");
                return;
            }

            setStatus(`Scan complete — ${filled.length} fields filled.`, false);
            await showInfo(`Scan Complete\n\n${filled.join("\n")}`);
        } catch (error) {
            console.error("Daily Sales OCR error:", error);
            setStatus("OCR failed. Please try again.", false);
            await showError(error?.message || "Unable to read the document.");
        }
    }

    function normalize(s) {
        return String(s || "")
            .toLowerCase()
            .replace(/[|]/g, " ")
            .replace(/\s+/g, " ")
            .replace(/[‘’]/g, "'")
            .trim();
    }

    function amountCandidates(line) {
        const matches = String(line || "").match(/(?:RM\s*)?\(?-?\d{1,3}(?:[, ]\d{3})*(?:\.\d{1,2})?\)?|(?:RM\s*)?\d+(?:\.\d{1,2})?/gi) || [];
        return matches.map(raw => {
            let s = raw.replace(/RM/ig, "").replace(/[()]/g, "").trim();
            s = s.replace(/\s/g, "");
            if ((s.match(/,/g) || []).length > 0) s = s.replace(/,/g, "");
            const n = Number(s);
            return Number.isFinite(n) ? n : null;
        }).filter(v => v !== null);
    }

    function lineMatchesLabel(line, labels) {
        const n = normalize(line);
        return labels.some(label => n.includes(normalize(label)));
    }

    function parseReport(text) {
        const lines = String(text || "")
            .split(/\r?\n/)
            .map(s => s.trim())
            .filter(Boolean);

        const values = {};

        // Prefer row-by-row parsing because OEOD reports put the PSA label and
        // the Total amount on the same visual row in most scans.
        for (const field of FIELD_MAP) {
            for (let i = 0; i < lines.length; i++) {
                if (!lineMatchesLabel(lines[i], field.labels)) continue;

                let nums = amountCandidates(lines[i]);
                // If OCR split the amount onto the next line, inspect a few lines.
                for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1) && nums.length === 0; j++) {
                    nums = amountCandidates(lines[j]);
                }

                if (nums.length) {
                    // The Total column is the rightmost amount on the row.
                    values[field.key] = nums[nums.length - 1];
                    break;
                }
            }
        }

        // Fallback: OCR can sometimes return the label and numbers on separate
        // lines. Search the whole text around each label.
        for (const field of FIELD_MAP) {
            if (values[field.key] !== undefined) continue;
            const joined = normalize(text);
            for (const label of field.labels) {
                const idx = joined.indexOf(normalize(label));
                if (idx < 0) continue;
                const nearby = joined.slice(idx, idx + 160);
                const nums = amountCandidates(nearby);
                if (nums.length) {
                    values[field.key] = nums[nums.length - 1];
                    break;
                }
            }
        }

        return values;
    }

    function setNumber(id, value) {
        const el = $(id);
        if (!el || value === undefined || value === null) return false;
        el.value = Number(value).toFixed(2);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
    }

    function applyValues(values) {
        const filled = [];
        const names = {
            totalSales: "Total Sales",
            services: "Services",
            food: "Food",
            beverage: "Beverage",
            generalMerchandise: "General Merchandise",
            tobacco: "Tobacco",
            supply: "Supply",
            foodService: "Food Service",
            alcoholic: "Alcoholic"
        };

        for (const field of FIELD_MAP) {
            if (values[field.key] === undefined) continue;
            if (setNumber(field.ids[0], values[field.key])) filled.push(names[field.key] || field.key);
        }

        // Total Merchandise Sales is intentionally editable. OCR only calculates
        // a suggested value when both Total Sales and Services were detected.
        if (values.totalSales !== undefined && values.services !== undefined) {
            const merchandise = values.totalSales - values.services;
            if (Number.isFinite(merchandise)) {
                setNumber("dsTotalMerchandiseSales", merchandise);
                filled.push("Total Merchandise Sales (calculated)");
            }
        }

        return filled;
    }

    async function showInfo(message) {
        if (typeof Swal !== "undefined") {
            return Swal.fire({ icon: "info", title: "Daily Sales Scan", text: message, confirmButtonText: "OK" });
        }
        alert(message);
    }

    async function showError(message) {
        if (typeof Swal !== "undefined") {
            return Swal.fire({ icon: "error", title: "OCR Error", text: message, confirmButtonText: "OK" });
        }
        alert(message);
    }

    function observe() {
        ensureControls();
        const root = document.body;
        if (!root) return;
        const observer = new MutationObserver(() => {
            if (lastContainer !== $("dailySalesFormWrapper")) {
                lastContainer = $("dailySalesFormWrapper");
            }
            ensureControls();
        });
        observer.observe(root, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", observe);
    } else {
        observe();
    }

    window.openDailySalesScanner = function () {
        ensureControls();
        $("dsOcrFileInput")?.click();
    };
})();
