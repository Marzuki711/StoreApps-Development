/* ==========================================================
   STORE APPS - DAILY SALES OCR
   File: js/daily-sales-ocr.js

   OCR is isolated from Daily Sales API / Save / Database logic.
   - Keeps ONE Scan / Take Picture button (the first/top button).
   - Keeps the Reading document / Scan complete status.
   - Supply defaults to 0.00 when not present, but remains editable.
   - Total Merchandise Sales remains editable. OCR only calculates it
     when the field is empty.
========================================================== */
(function () {
    "use strict";

    const TESSERACT_VERSION = "5.1.1";
    const TESSERACT_URL =
        `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`;

    let tesseractPromise = null;
    let observerStarted = false;

    const FIELD_MAP = [
        { key: "services", id: "dsServices", labels: ["services", "service"] },
        { key: "food", id: "dsFood", labels: ["food"] },
        { key: "beverage", id: "dsBeverage", labels: ["beverage", "beverages", "bevarage", "bevarages"] },
        { key: "generalMerchandise", id: "dsGeneralMerchandise", labels: ["general merchandise", "generalmerchandise"] },
        { key: "tobacco", id: "dsTobacco", labels: ["tobacco/alcoholic", "tobacco alcoholic", "tobacco"] },
        { key: "supply", id: "dsSupply", labels: ["supply"] },
        { key: "foodService", id: "dsFoodService", labels: ["food service", "foodservice"] },
        { key: "alcoholic", id: "dsAlcoholic", labels: ["alcoholic", "alcohol"] },
        { key: "totalSales", id: "dsTotalSales", labels: ["total gross sales (incl.gst)", "total gross sales incl.gst", "total gross sales", "gross sales"] }
    ];

    const DISPLAY_NAMES = {
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

    function $(id) {
        return document.getElementById(id);
    }

    function loadTesseract() {
        if (window.Tesseract) return Promise.resolve(window.Tesseract);
        if (tesseractPromise) return tesseractPromise;

        tesseractPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-storeapps-tesseract="1"]');
            if (existing) {
                existing.addEventListener("load", () => resolve(window.Tesseract), { once: true });
                existing.addEventListener("error", reject, { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = TESSERACT_URL;
            script.async = true;
            script.dataset.storeappsTesseract = "1";
            script.onload = () => {
                if (window.Tesseract) resolve(window.Tesseract);
                else reject(new Error("OCR engine failed to load."));
            };
            script.onerror = () => reject(new Error("Unable to load OCR engine. Please check your internet connection."));
            document.head.appendChild(script);
        });

        return tesseractPromise;
    }

    function getScanButtons() {
        return Array.from(document.querySelectorAll("button"))
            .filter(btn => /scan\s*\/\s*take\s*picture/i.test((btn.textContent || "").trim()));
    }

    function ensureScannerControls() {
        const wrapper = $("dailySalesFormWrapper");
        if (!wrapper) return false;

        const buttons = getScanButtons();
        if (!buttons.length) return false;

        // Keep ONLY the first/top Scan / Take Picture button.
        const mainButton = buttons[0];
        buttons.slice(1).forEach(btn => btn.remove());

        mainButton.type = "button";
        mainButton.onclick = openDailySalesScanner;
        mainButton.removeAttribute("disabled");

        let fileInput = $("dsOcrFileInput");
        if (!fileInput) {
            fileInput = document.createElement("input");
            fileInput.id = "dsOcrFileInput";
            fileInput.type = "file";
            fileInput.accept = "image/*";
            fileInput.setAttribute("capture", "environment");
            fileInput.style.display = "none";
            document.body.appendChild(fileInput);
        }

        fileInput.onchange = handleFile;

        // Keep status OUTSIDE the button so the button never changes size or moves.
        let status = $("dsOcrStatus");
        if (!status) {
            status = document.createElement("div");
            status.id = "dsOcrStatus";
            status.style.cssText = [
                "margin-top:5px",
                "min-height:18px",
                "font-size:12px",
                "line-height:18px",
                "font-weight:500",
                "opacity:.82",
                "text-align:left",
                "display:block"
            ].join(";");
            // Place status directly below the single scan button.
            mainButton.parentElement?.appendChild(status);
        }

        // Supply is always usable manually and starts at 0.00 when blank.
        const supply = $("dsSupply");
        if (supply && String(supply.value || "").trim() === "") {
            supply.value = "0.00";
        }

        // Make sure these fields are editable.
        ["dsTotalMerchandiseSales", "dsSupply"].forEach(id => {
            const el = $(id);
            if (!el) return;
            el.readOnly = false;
            el.disabled = false;
            el.removeAttribute("readonly");
            el.removeAttribute("disabled");
        });

        return true;
    }

    function setStatus(message, busy) {
        const status = $("dsOcrStatus");
        if (status) {
            status.textContent = message || "";
            status.setAttribute("aria-live", "polite");
        }

        const buttons = getScanButtons();
        const button = buttons[0];
        if (button) {
            // Never replace button HTML/text. This keeps the button fixed in place.
            button.disabled = !!busy;
            button.setAttribute("aria-busy", busy ? "true" : "false");
        }
    }

    function openDailySalesScanner() {
        ensureScannerControls();
        const input = $("dsOcrFileInput");
        if (input) input.click();
    }

    async function handleFile(event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (!file) return;

        setStatus("Reading document...", true);

        try {
            const Tesseract = await loadTesseract();
            const result = await Tesseract.recognize(file, "eng", {
                logger: message => {
                    if (!message || !message.status) return;
                    if (typeof message.progress === "number") {
                        const percent = Math.max(0, Math.min(100, Math.round(message.progress * 100)));
                        setStatus(`Reading document... ${percent}%`, true);
                    } else {
                        setStatus("Reading document...", true);
                    }
                }
            });

            const text = result?.data?.text || "";
            const values = parseReport(text);
            const filled = applyValues(values);

            // Supply must always have a usable value, but remains editable.
            const supply = $("dsSupply");
            if (supply && String(supply.value || "").trim() === "") {
                supply.value = "0.00";
                supply.dispatchEvent(new Event("input", { bubbles: true }));
            }

            if (typeof window.calculateDailySales === "function") {
                window.calculateDailySales();
            }

            if (!filled.length) {
                setStatus("Scan complete — 0 fields filled. Please use a clearer image.", false);
                return;
            }

            setStatus(`Scan complete — ${filled.length} fields filled.`, false);
        } catch (error) {
            console.error("Daily Sales OCR error:", error);
            setStatus("Reading document failed. Please try again.", false);
        }
    }

    function normalize(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[|]/g, " ")
            .replace(/[‘’]/g, "'")
            .replace(/\s+/g, " ")
            .trim();
    }

    function amountCandidates(line) {
        const matches = String(line || "").match(/(?:RM\s*)?\(?-?\d{1,3}(?:[, ]\d{3})*(?:\.\d{1,2})?\)?|(?:RM\s*)?\d+(?:\.\d{1,2})?/gi) || [];
        return matches.map(raw => {
            let s = raw.replace(/RM/ig, "").replace(/[()]/g, "").replace(/\s/g, "");
            s = s.replace(/,/g, "");
            const number = Number(s);
            return Number.isFinite(number) ? number : null;
        }).filter(v => v !== null);
    }

    function isAlcoholicLine(line) {
        const n = normalize(line);
        // Do NOT let "Tobacco/Alcoholic" satisfy the Alcoholic field.
        if (n.includes("tobacco")) return false;
        return /(^|\s)alcoholic(\s|$)/.test(n) || /(^|\s)alcohol(\s|$)/.test(n);
    }

    function lineMatchesField(line, field) {
        const n = normalize(line);
        if (field.key === "alcoholic") return isAlcoholicLine(line);
        if (field.key === "tobacco") return n.includes("tobacco");
        return field.labels.some(label => n.includes(normalize(label)));
    }

    function parseReport(text) {
        const lines = String(text || "")
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        const values = {};

        for (const field of FIELD_MAP) {
            for (let i = 0; i < lines.length; i++) {
                if (!lineMatchesField(lines[i], field)) continue;

                let nums = amountCandidates(lines[i]);
                if (!nums.length) {
                    for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
                        nums = amountCandidates(lines[j]);
                        if (nums.length) break;
                    }
                }

                if (nums.length) {
                    // OEOD: right-most number on the row is the Total column.
                    values[field.key] = nums[nums.length - 1];
                    break;
                }
            }
        }

        return values;
    }

    function setNumber(id, value) {
        const element = $(id);
        if (!element || value === undefined || value === null) return false;
        element.readOnly = false;
        element.disabled = false;
        element.value = Number(value).toFixed(2);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
    }

    function applyValues(values) {
        const filled = [];

        for (const field of FIELD_MAP) {
            if (values[field.key] === undefined) continue;
            if (setNumber(field.id, values[field.key])) {
                filled.push(DISPLAY_NAMES[field.key]);
            }
        }

        // Supply is required as a usable editable field even when the report
        // does not show a Supply row.
        if (values.supply === undefined) {
            const supply = $("dsSupply");
            if (supply && String(supply.value || "").trim() === "") {
                setNumber("dsSupply", 0);
                filled.push("Supply");
            }
        }

        // Total Merchandise Sales is EDITABLE. Only calculate it if the user
        // has not already entered a value.
        const merchandise = $("dsTotalMerchandiseSales");
        if (merchandise) {
            merchandise.readOnly = false;
            merchandise.disabled = false;

            const current = String(merchandise.value || "").trim();
            if (!current && values.totalSales !== undefined && values.services !== undefined) {
                const calculated = values.totalSales - values.services;
                if (Number.isFinite(calculated)) {
                    setNumber("dsTotalMerchandiseSales", calculated);
                    filled.push("Total Merchandise Sales");
                }
            }
        }

        return filled;
    }

    function observe() {
        if (observerStarted) return;
        observerStarted = true;

        const start = () => ensureScannerControls();
        start();

        const observer = new MutationObserver(() => start());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    window.openDailySalesScanner = openDailySalesScanner;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", observe, { once: true });
    } else {
        observe();
    }
})();
