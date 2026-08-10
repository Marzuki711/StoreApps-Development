/* ==========================================================
   STORE APPS - DAILY SALES OCR
   File: js/daily-sales-ocr.js

   OCR is isolated from Daily Sales API / Save / Database logic.
   - Keeps ONE Scan / Take Picture button (the first/top button).
   - Keeps the Reading document / Scan complete status below the button.
   - Scan button opens a small menu: Gallery Picture / Camera Picture.
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
    let outsideClickBound = false;
    let menuOpen = false;

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

        // Two separate pickers:
        // - Gallery: normal image picker
        // - Camera: mobile camera (capture=environment)
        let galleryInput = $("dsOcrGalleryInput");
        if (!galleryInput) {
            galleryInput = document.createElement("input");
            galleryInput.id = "dsOcrGalleryInput";
            galleryInput.type = "file";
            galleryInput.accept = "image/*";
            galleryInput.style.display = "none";
            document.body.appendChild(galleryInput);
        }

        let cameraInput = $("dsOcrCameraInput");
        if (!cameraInput) {
            cameraInput = document.createElement("input");
            cameraInput.id = "dsOcrCameraInput";
            cameraInput.type = "file";
            cameraInput.accept = "image/*";
            cameraInput.setAttribute("capture", "environment");
            cameraInput.style.display = "none";
            document.body.appendChild(cameraInput);
        }

        galleryInput.onchange = handleFile;
        cameraInput.onchange = handleFile;

        ensureScanMenu(mainButton);
        ensureStatus(mainButton);

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

    function ensureStatus(mainButton) {
        let status = $("dsOcrStatus");
        if (!status) {
            status = document.createElement("div");
            status.id = "dsOcrStatus";
            document.body.appendChild(status);
        }

        // Position the status below the button without taking up layout space.
        status.style.cssText = [
            "position:fixed",
            "display:none",
            "z-index:2147483000",
            "width:260px",
            "max-width:calc(100vw - 24px)",
            "box-sizing:border-box",
            "font-size:11px",
            "line-height:16px",
            "font-weight:500",
            "color:#64748B",
            "text-align:left",
            "white-space:nowrap",
            "overflow:hidden",
            "text-overflow:ellipsis",
            "pointer-events:none",
            "background:transparent",
            "margin:0",
            "padding:2px 0"
        ].join(";");

        positionFloatingElement(status, mainButton, 4);
    }

    function ensureScanMenu(mainButton) {
        let menu = $("dsOcrScanMenu");

        if (!menu) {
            menu = document.createElement("div");
            menu.id = "dsOcrScanMenu";
            menu.innerHTML = `
                <button type="button" data-ocr-source="gallery">
                    <span aria-hidden="true">🖼️</span>
                    <span>Gallery Picture</span>
                </button>
                <button type="button" data-ocr-source="camera">
                    <span aria-hidden="true">📷</span>
                    <span>Camera Picture</span>
                </button>
            `;
            document.body.appendChild(menu);

            menu.querySelectorAll("button").forEach(btn => {
                btn.style.cssText = [
                    "width:100%",
                    "display:flex",
                    "align-items:center",
                    "gap:10px",
                    "border:0",
                    "background:#fff",
                    "color:#172033",
                    "padding:11px 14px",
                    "font-size:13px",
                    "font-weight:600",
                    "text-align:left",
                    "cursor:pointer",
                    "box-sizing:border-box"
                ].join(";");
                btn.addEventListener("mouseenter", () => {
                    btn.style.background = "#F1F5F9";
                });
                btn.addEventListener("mouseleave", () => {
                    btn.style.background = "#fff";
                });
                btn.addEventListener("click", () => {
                    const source = btn.getAttribute("data-ocr-source");
                    closeScanMenu();
                    startFilePicker(source);
                });
            });
        }

        menu.style.position = "fixed";
        menu.style.zIndex = "2147482999";
        menu.style.width = "210px";
        menu.style.maxWidth = "calc(100vw - 24px)";
        menu.style.background = "#fff";
        menu.style.border = "1px solid #CBD5E1";
        menu.style.borderRadius = "10px";
        menu.style.boxShadow = "0 10px 28px rgba(15,23,42,.16)";
        menu.style.overflow = "hidden";
        menu.style.display = "none";

        positionFloatingElement(menu, mainButton, 6);

        if (!outsideClickBound) {
            outsideClickBound = true;
            document.addEventListener("click", function (event) {
                const button = getScanButtons()[0];
                const menuEl = $("dsOcrScanMenu");
                if (!menuEl || !menuOpen) return;
                if (event.target === button || menuEl.contains(event.target)) return;
                closeScanMenu();
            }, true);

            window.addEventListener("resize", () => {
                const button = getScanButtons()[0];
                if (!button) return;
                if (menuOpen) positionFloatingElement($("dsOcrScanMenu"), button, 6);
                const status = $("dsOcrStatus");
                if (status) positionFloatingElement(status, button, 4);
            });

            window.addEventListener("scroll", () => {
                const button = getScanButtons()[0];
                if (!button) return;
                if (menuOpen) positionFloatingElement($("dsOcrScanMenu"), button, 6);
                const status = $("dsOcrStatus");
                if (status && status.style.display !== "none") {
                    positionFloatingElement(status, button, 4);
                }
            }, true);
        }
    }

    function positionFloatingElement(element, anchor, gap) {
        if (!element || !anchor) return;

        const rect = anchor.getBoundingClientRect();
        const width = element.offsetWidth || parseFloat(getComputedStyle(element).width) || 210;
        const viewportPadding = 12;

        let left = rect.left;
        if (left + width > window.innerWidth - viewportPadding) {
            left = window.innerWidth - width - viewportPadding;
        }
        left = Math.max(viewportPadding, left);

        element.style.left = `${Math.round(left)}px`;
        element.style.top = `${Math.round(rect.bottom + gap)}px`;
    }

    function toggleScanMenu() {
        const menu = $("dsOcrScanMenu");
        const button = getScanButtons()[0];
        if (!menu || !button) return;

        menuOpen = !menuOpen;
        if (menuOpen) {
            positionFloatingElement(menu, button, 6);
            menu.style.display = "block";
        } else {
            menu.style.display = "none";
        }
    }

    function closeScanMenu() {
        const menu = $("dsOcrScanMenu");
        menuOpen = false;
        if (menu) menu.style.display = "none";
    }

    function startFilePicker(source) {
        const input =
            source === "camera"
                ? $("dsOcrCameraInput")
                : $("dsOcrGalleryInput");

        if (input) input.click();
    }

    function setStatus(message, busy) {
        const status = $("dsOcrStatus");
        const button = getScanButtons()[0];

        if (status && button) {
            status.textContent = message || "";
            status.style.display = message ? "block" : "none";
            status.setAttribute("aria-live", "polite");
            positionFloatingElement(status, button, 4);
        }

        if (button) {
            // Never replace button HTML/text. The button remains fixed.
            button.disabled = !!busy;
            button.setAttribute("aria-busy", busy ? "true" : "false");
        }
    }

    function openDailySalesScanner() {
        ensureScannerControls();
        toggleScanMenu();
    }

    async function handleFile(event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (!file) return;

        closeScanMenu();
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

        // Match the PSA label at the START of the row instead of using a
        // generic "includes" check. This prevents overlapping labels such
        // as "Services" vs "Food Service", and "Alcoholic" inside
        // "Tobacco/Alcoholic", from being assigned to the wrong field.
        if (field.key === "services") {
            return /^services(?:\s|$)/.test(n);
        }

        if (field.key === "food") {
            return /^food(?:\s|$)/.test(n) && !/^food\s+service(?:\s|$)/.test(n);
        }

        if (field.key === "beverage") {
            return /^(beverage|beverages|bevarage|bevarages)(?:\s|$)/.test(n);
        }

        if (field.key === "generalMerchandise") {
            return /^(general\s+merchandise|generalmerchandise)(?:\s|$)/.test(n);
        }

        if (field.key === "tobacco") {
            return /^tobacco(?:\/|\s|$)/.test(n);
        }

        if (field.key === "supply") {
            return /^supply(?:\s|$)/.test(n);
        }

        if (field.key === "foodService") {
            return /^food\s+service(?:\s|$)/.test(n) || /^foodservice(?:\s|$)/.test(n);
        }

        if (field.key === "alcoholic") {
            return isAlcoholicLine(line);
        }

        if (field.key === "totalSales") {
            return /^(total\s+gross\s+sales(?:\s+\(?(?:incl\.?\s*)?gst\)?|\s+incl\.?\s*gst)?|gross\s+sales)(?:\s|$)/.test(n);
        }

        return field.labels.some(label => n.startsWith(normalize(label)));
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
