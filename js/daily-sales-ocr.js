/*
 * ==========================================================
 * StoreApps - Daily Sales OCR
 * File: js/daily-sales-ocr.js
 *
 * Scan / Take Picture -> OCR -> Auto Fill
 *
 * This file only handles image/OCR input. It does not call
 * the Daily Sales API or alter the database flow.
 * ==========================================================
 */
(function () {
    "use strict";

    const TESSERACT_URL =
        "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

    let loadingPromise = null;

    function el(id) {
        return document.getElementById(id);
    }

    function normalise(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
    }

    function num(value) {
        if (value == null) return null;

        const cleaned = String(value)
            .replace(/rm/gi, "")
            .replace(/,/g, "")
            .replace(/[^\d.-]/g, "");

        if (!cleaned) return null;

        const n = Number(cleaned);
        return Number.isFinite(n) ? n : null;
    }

    function setValue(id, value) {
        const input = el(id);
        if (!input) return;

        input.value =
            value == null
                ? ""
                : Number(value).toFixed(2);

        input.dispatchEvent(
            new Event("input", { bubbles: true })
        );
        input.dispatchEvent(
            new Event("change", { bubbles: true })
        );
    }

    function amountCandidates(line) {
        /*
         * Only decimal currency-looking values are considered.
         * This prevents POS codes such as 0048POS01 from becoming
         * sales values.
         */
        const matches =
            String(line || "").match(
                /-?\d{1,3}(?:,\d{3})*\.\d{2}|-?\d+\.\d{2}/g
            ) || [];

        return matches
            .map(num)
            .filter(v => v !== null);
    }

    function lastAmount(line) {
        const values = amountCandidates(line);
        return values.length
            ? values[values.length - 1]
            : null;
    }

    function labelField(line) {
        const n = normalise(line)
            .replace(/[|]/g, " ");

        /*
         * Food Service must be checked before Food.
         */
        if (/food\s*(service|senice|servlce)/i.test(n)) {
            return "dsFoodService";
        }

        if (
            /tobacco\s*\/?\s*alcoholic/i.test(n) ||
            /tobacco\s+alcoholic/i.test(n)
        ) {
            return "dsTobacco";
        }

        if (
            /general\s*merchandise/i.test(n)
        ) {
            return "dsGeneralMerchandise";
        }

        if (/\bbeverages?\b/i.test(n)) {
            return "dsBeverage";
        }

        if (/\bservices?\b/i.test(n)) {
            return "dsServices";
        }

        if (/\balcoholic\b/i.test(n)) {
            return "dsAlcoholic";
        }

        if (/\bsupply\b/i.test(n)) {
            return "dsSupply";
        }

        if (/\bfood\b/i.test(n)) {
            return "dsFood";
        }

        return null;
    }

    function parsePSA(text) {
        const lines =
            String(text || "")
                .split(/\r?\n/)
                .map(v => v.trim())
                .filter(Boolean);

        const result = {};

        /*
         * Pass 1: label and Total value are on the same OCR line.
         */
        lines.forEach(function (line) {

            const field = labelField(line);
            if (!field) return;

            const value = lastAmount(line);

            if (value !== null) {
                result[field] = value;
            }
        });

        /*
         * Pass 2: OCR separated the label and amount into
         * neighbouring lines.
         */
        for (let i = 0; i < lines.length; i++) {

            const field = labelField(lines[i]);

            if (!field || result[field] != null) {
                continue;
            }

            for (
                let j = i + 1;
                j <= Math.min(i + 3, lines.length - 1);
                j++
            ) {
                const value = lastAmount(lines[j]);

                if (value !== null) {
                    result[field] = value;
                    break;
                }
            }
        }

        return result;
    }

    function parseTotalSales(text) {
        const lines =
            String(text || "")
                .split(/\r?\n/)
                .map(v => v.trim())
                .filter(Boolean);

        for (let i = 0; i < lines.length; i++) {

            const n = normalise(lines[i]);

            if (
                /total\s*gross\s*sales/i.test(n) ||
                /gross\s*sales/i.test(n)
            ) {
                const sameLine = lastAmount(lines[i]);

                if (sameLine !== null) {
                    return sameLine;
                }

                for (
                    let j = i + 1;
                    j <= Math.min(i + 2, lines.length - 1);
                    j++
                ) {
                    const next = lastAmount(lines[j]);

                    if (next !== null) {
                        return next;
                    }
                }
            }
        }

        return null;
    }

    function calculateMerchandise(totalSales, services) {
        if (
            totalSales == null ||
            services == null
        ) {
            return null;
        }

        return Math.max(
            0,
            totalSales - services
        );
    }

    function fillFromOCR(text) {
        const psa = parsePSA(text);
        const totalSales = parseTotalSales(text);

        let count = 0;

        Object.keys(psa).forEach(function (id) {
            setValue(id, psa[id]);
            count++;
        });

        if (totalSales !== null) {
            setValue(
                "dsTotalSales",
                totalSales
            );
            count++;
        }

        const total =
            totalSales !== null
                ? totalSales
                : num(el("dsTotalSales")?.value);

        const services =
            psa.dsServices != null
                ? psa.dsServices
                : num(el("dsServices")?.value);

        const merchandise =
            calculateMerchandise(
                total,
                services
            );

        if (merchandise !== null) {
            setValue(
                "dsTotalMerchandiseSales",
                merchandise
            );
        }

        /*
         * Existing Daily Sales calculation remains responsible
         * for Transaction Size and Food Service %.
         */
        if (
            typeof window.calculateDailySales ===
            "function"
        ) {
            window.calculateDailySales();
        }

        return {
            count,
            psa,
            totalSales,
            merchandise
        };
    }

    function loadTesseract() {

        if (window.Tesseract) {
            return Promise.resolve(
                window.Tesseract
            );
        }

        if (loadingPromise) {
            return loadingPromise;
        }

        loadingPromise =
            new Promise(function (resolve, reject) {

                const script =
                    document.createElement("script");

                script.src = TESSERACT_URL;
                script.async = true;

                script.onload = function () {
                    if (!window.Tesseract) {
                        reject(
                            new Error(
                                "OCR engine failed to load."
                            )
                        );
                        return;
                    }

                    resolve(
                        window.Tesseract
                    );
                };

                script.onerror = function () {
                    reject(
                        new Error(
                            "Unable to load the OCR engine. Check the internet connection."
                        )
                    );
                };

                document.head.appendChild(script);
            });

        return loadingPromise;
    }

    function status(text) {
        const node = el("dsOcrStatus");

        if (node) {
            node.textContent =
                text || "";
        }
    }

    function busy(value) {
        const button =
            el("dsScanButton");

        if (!button) return;

        button.disabled = !!value;

        button.innerHTML =
            value
                ? '<i class="fa-solid fa-spinner fa-spin"></i> Reading...'
                : '<i class="fa-solid fa-camera"></i> Scan / Take Picture';
    }

    function message(text, type) {

        if (window.Swal) {
            return window.Swal.fire({
                icon: type || "info",
                title:
                    type === "error"
                        ? "Scan Error"
                        : "Scan Complete",
                text: text
            });
        }

        alert(text);
    }

    async function processImage(file) {

        if (!file) return;

        busy(true);
        status("Preparing OCR...");

        try {

            const Tesseract =
                await loadTesseract();

            status("Reading document...");

            const result =
                await Tesseract.recognize(
                    file,
                    "eng",
                    {
                        logger: function (info) {

                            if (
                                info &&
                                info.status ===
                                "recognizing text" &&
                                typeof info.progress ===
                                "number"
                            ) {
                                status(
                                    "Reading document " +
                                    Math.round(
                                        info.progress * 100
                                    ) +
                                    "%..."
                                );
                            }
                        }
                    }
                );

            const text =
                result?.data?.text || "";

            console.log(
                "[Daily Sales OCR] Raw text:",
                text
            );

            if (!text.trim()) {
                throw new Error(
                    "No readable text was found."
                );
            }

            const parsed =
                fillFromOCR(text);

            if (!parsed.count) {
                throw new Error(
                    "No Daily Sales values were recognised. Please take a clearer picture of the OEOD report."
                );
            }

            status(
                parsed.count +
                " value(s) filled. Please check before Save."
            );

            message(
                "Scan completed. " +
                parsed.count +
                " value(s) have been filled automatically. Please check the values before Save.",
                "success"
            );

        } catch (error) {

            console.error(
                "[Daily Sales OCR]",
                error
            );

            status("OCR failed.");

            message(
                error?.message ||
                "Unable to read the document.",
                "error"
            );

        } finally {

            busy(false);

            const input =
                el("dsOcrFileInput");

            if (input) {
                input.value = "";
            }
        }
    }

    function openDailySalesScanner() {

        const input =
            el("dsOcrFileInput");

        if (!input) {
            message(
                "The Scan / Take Picture input is missing. Please make sure the Daily Sales OCR script is loaded.",
                "error"
            );
            return;
        }

        input.click();
    }

    function bindInput() {

        const input =
            el("dsOcrFileInput");

        if (!input) return;

        if (
            input.dataset.ocrBound ===
            "1"
        ) {
            return;
        }

        input.dataset.ocrBound =
            "1";

        input.addEventListener(
            "change",
            function () {
                const file =
                    this.files &&
                    this.files[0];

                if (file) {
                    processImage(file);
                }
            }
        );
    }

    function injectScannerUI() {

        /*
         * If daily-sales.html already contains the button/input,
         * use those elements. Otherwise create them automatically.
         */
        if (
            el("dsScanButton") &&
            el("dsOcrFileInput")
        ) {
            bindInput();
            return;
        }

        const wrapper =
            el("dailySalesFormWrapper");

        if (!wrapper) return;

        const section =
            Array.from(
                wrapper.querySelectorAll(
                    ".ds-section-title"
                )
            ).find(function (node) {
                return normalise(
                    node.textContent
                ) === "sales information";
            });

        if (!section) return;

        const toolbar =
            document.createElement("div");

        toolbar.id =
            "dsOcrToolbar";

        toolbar.style.display =
            "flex";

        toolbar.style.alignItems =
            "center";

        toolbar.style.gap =
            "10px";

        toolbar.style.margin =
            "0 0 14px";

        toolbar.innerHTML = `
            <button
                type="button"
                id="dsScanButton"
                class="ds-primary-btn">
                <i class="fa-solid fa-camera"></i>
                Scan / Take Picture
            </button>

            <input
                id="dsOcrFileInput"
                type="file"
                accept="image/*"
                capture="environment"
                style="display:none">

            <span
                id="dsOcrStatus"
                style="font-size:12px;color:#64748B;">
            </span>
        `;

        section.after(toolbar);

        el("dsScanButton").addEventListener(
            "click",
            openDailySalesScanner
        );

        bindInput();
    }

    window.openDailySalesScanner =
        openDailySalesScanner;

    window.dailySalesOCR = {
        processImage: processImage,
        fillFromOCR: fillFromOCR
    };

    function init() {
        injectScannerUI();
        bindInput();
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init
        );
    } else {
        init();
    }

})();

