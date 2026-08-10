/*
 * Store Apps - Daily Sales OCR
 *
 * Add-on only. Existing Daily Sales API/database flow is untouched.
 * Reads the OEOD/PSA report and fills the existing Daily Sales fields.
 * Total Merchandise Sales is calculated by the existing Daily Sales
 * calculation: Total Sales - Services.
 */

(function () {
    "use strict";

    const OCR_SCRIPT_URL =
        "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

    let ocrScriptPromise = null;
    let ocrModal = null;

    function loadTesseract() {
        if (window.Tesseract) {
            return Promise.resolve(window.Tesseract);
        }

        if (ocrScriptPromise) {
            return ocrScriptPromise;
        }

        ocrScriptPromise = new Promise(function (resolve, reject) {
            const existing = document.querySelector(
                'script[data-daily-sales-ocr="tesseract"]'
            );

            if (existing) {
                existing.addEventListener("load", function () {
                    resolve(window.Tesseract);
                }, { once: true });
                existing.addEventListener("error", reject, { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = OCR_SCRIPT_URL;
            script.async = true;
            script.dataset.dailySalesOcr = "tesseract";

            script.onload = function () {
                if (window.Tesseract) {
                    resolve(window.Tesseract);
                } else {
                    reject(new Error("OCR engine failed to load."));
                }
            };

            script.onerror = function () {
                reject(new Error("Unable to load OCR engine."));
            };

            document.head.appendChild(script);
        });

        return ocrScriptPromise;
    }

    function openModal() {
        closeModal();

        ocrModal = document.createElement("div");
        ocrModal.className = "ds-ocr-modal";
        ocrModal.innerHTML = `
            <div class="ds-ocr-modal-box" role="dialog" aria-modal="true" aria-label="Scanning Daily Sales">
                <h3 class="ds-ocr-modal-title">Scanning Daily Sales Report</h3>
                <p class="ds-ocr-modal-text">
                    Please wait while the system reads the PSA Report and matches each label with the amount in the Total column.
                </p>
                <div class="ds-ocr-progress">
                    <div class="ds-ocr-progress-bar" id="dsOcrProgressBar"></div>
                </div>
                <div class="ds-ocr-status" id="dsOcrStatus">Preparing OCR...</div>
            </div>
        `;

        document.body.appendChild(ocrModal);
        return ocrModal;
    }

    function updateModal(status, progress) {
        const statusEl = document.getElementById("dsOcrStatus");
        const bar = document.getElementById("dsOcrProgressBar");

        if (statusEl) {
            statusEl.textContent = status;
        }

        if (bar && Number.isFinite(progress)) {
            const value = Math.max(0, Math.min(100, progress));
            bar.style.width = value + "%";
        }
    }

    function closeModal() {
        if (ocrModal && ocrModal.parentNode) {
            ocrModal.parentNode.removeChild(ocrModal);
        }
        ocrModal = null;
    }

    function openDailySalesScanner() {
        const input = document.getElementById("dsOcrFileInput");

        if (!input) {
            return;
        }

        input.value = "";
        input.click();
    }

    function handleDailySalesScanFile(file) {
        if (!file) {
            return;
        }

        scanDailySalesImage(file).catch(function (error) {
            console.error("Daily Sales OCR error:", error);
            closeModal();

            if (typeof dsShowError === "function") {
                dsShowError(
                    error && error.message
                        ? error.message
                        : "Unable to read the Daily Sales document."
                );
            } else {
                alert("Unable to read the Daily Sales document.");
            }
        });
    }

    async function scanDailySalesImage(file) {
        if (!file.type || !file.type.startsWith("image/")) {
            throw new Error("Please select or take a picture of the Daily Sales document.");
        }

        openModal();
        updateModal("Loading OCR engine...", 5);

        const Tesseract = await loadTesseract();
        const image = await prepareDailySalesImage(file);

        updateModal("Reading document...", 15);

        const result = await Tesseract.recognize(image, "eng", {
            logger: function (message) {
                if (!message) {
                    return;
                }

                const progress = Number(message.progress);
                const percent = Number.isFinite(progress)
                    ? 15 + Math.round(progress * 75)
                    : 15;

                let status = "Reading document...";

                if (message.status === "recognizing text") {
                    status = "Recognising PSA labels and amounts...";
                } else if (message.status) {
                    status = String(message.status)
                        .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
                }

                updateModal(status, percent);
            }
        });

        updateModal("Matching PSA labels with the Total column...", 92);

        const values = extractDailySalesValues(result && result.data);
        applyDailySalesOcrValues(values);

        updateModal("Completed.", 100);

        await new Promise(function (resolve) {
            setTimeout(resolve, 350);
        });

        closeModal();

        const missing = values.missingLabels || [];
        const foundCount = Object.keys(values.found || {}).length;

        if (foundCount === 0) {
            throw new Error(
                "No Daily Sales PSA values were detected. Please take a clearer picture showing the full PSA Report."
            );
        }

        if (typeof showSuccess === "function") {
            showSuccess(
                missing.length
                    ? "Scan completed. Please check the fields before saving."
                    : "Scan completed successfully. Please check the fields before saving."
            );
        }
    }

    async function prepareDailySalesImage(file) {
        const url = URL.createObjectURL(file);

        try {
            const image = new Image();

            await new Promise(function (resolve, reject) {
                image.onload = resolve;
                image.onerror = function () {
                    reject(new Error("Unable to open the selected picture."));
                };
                image.src = url;
            });

            const maxDimension = 2600;
            const sourceWidth = image.naturalWidth || image.width;
            const sourceHeight = image.naturalHeight || image.height;
            const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));

            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(sourceWidth * scale));
            canvas.height = Math.max(1, Math.round(sourceHeight * scale));

            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) {
                throw new Error("Unable to prepare the picture for OCR.");
            }

            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

            // Light grayscale/contrast enhancement improves photographed reports
            // while preserving the original image file in the user's device.
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = pixels.data;

            for (let i = 0; i < data.length; i += 4) {
                const gray =
                    (0.299 * data[i]) +
                    (0.587 * data[i + 1]) +
                    (0.114 * data[i + 2]);

                const contrast = ((gray - 128) * 1.25) + 128;
                const value = Math.max(0, Math.min(255, contrast));

                data[i] = value;
                data[i + 1] = value;
                data[i + 2] = value;
            }

            ctx.putImageData(pixels, 0, 0);

            return canvas;
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    function extractDailySalesValues(data) {
        const found = {};

        const words = Array.isArray(data && data.words)
            ? data.words
            : [];

        const rows = buildOcrRows(words);

        const rules = [
            {
                key: "services",
                label: "Services",
                test: function (text) {
                    return /\bservices?\b/i.test(text) && !/food service/i.test(text);
                }
            },
            {
                key: "food",
                label: "Food",
                test: function (text) {
                    return /^food$/i.test(normalizeText(text));
                }
            },
            {
                key: "beverage",
                label: "Beverage",
                test: function (text) {
                    return /^beverages?$/i.test(normalizeText(text));
                }
            },
            {
                key: "generalMerchandise",
                label: "General Merchandise",
                test: function (text) {
                    return /gener\w*\s+merchandise/i.test(normalizeText(text));
                }
            },
            {
                key: "tobacco",
                label: "Tobacco/Alcoholic",
                test: function (text) {
                    const normalized = normalizeText(text);
                    return /^tobacco\b/i.test(normalized) ||
                        /tobacco\s*\/\s*(?:alcoholic|aicoholic|alcoh)/i.test(normalized);
                }
            },
            {
                key: "supply",
                label: "Supply",
                test: function (text) {
                    return /^supply$/i.test(normalizeText(text));
                }
            },
            {
                key: "foodService",
                label: "Food Service",
                test: function (text) {
                    const normalized = normalizeText(text);
                    return /food\s+(?:service|senice|emice|service)/i.test(normalized);
                }
            },
            {
                key: "alcoholic",
                label: "Alcoholic",
                test: function (text) {
                    const normalized = normalizeText(text);
                    return /^alcoholic$/i.test(normalized) || /^alcoholic\b/i.test(normalized);
                }
            },
            {
                key: "totalSales",
                label: "Total Gross Sales",
                test: function (text) {
                    const normalized = normalizeText(text);
                    return /total\s+gross\s+sales/i.test(normalized) ||
                        /total\s+gross/i.test(normalized) ||
                        /total\s+sales/i.test(normalized);
                }
            }
        ];

        rules.forEach(function (rule) {
            const candidates = rows
                .filter(function (row) {
                    return rule.test(row.text);
                })
                .map(function (row) {
                    return {
                        amount: findRightmostAmount(row.words),
                        row: row
                    };
                })
                .filter(function (item) {
                    return item.amount !== null;
                });

            if (candidates.length) {
                // Prefer the row with the largest number of label words when
                // multiple OCR rows accidentally match the same label.
                candidates.sort(function (a, b) {
                    return b.row.words.length - a.row.words.length;
                });

                found[rule.key] = candidates[0].amount;
            }
        });

        // The document shown by the user has no Supply row. Treat it as zero.
        if (found.supply === undefined) {
            found.supply = 0;
        }

        const missingLabels = [];
        [
            ["services", "Services"],
            ["food", "Food"],
            ["beverage", "Beverage"],
            ["generalMerchandise", "General Merchandise"],
            ["tobacco", "Tobacco/Alcoholic"],
            ["foodService", "Food Service"],
            ["alcoholic", "Alcoholic"],
            ["totalSales", "Total Gross Sales"]
        ].forEach(function (pair) {
            if (found[pair[0]] === undefined) {
                missingLabels.push(pair[1]);
            }
        });

        return {
            found: found,
            missingLabels: missingLabels
        };
    }

    function buildOcrRows(words) {
        const usable = words
            .filter(function (word) {
                return word && word.text && word.bbox;
            })
            .map(function (word) {
                const bbox = word.bbox;
                const x0 = Number(bbox.x0) || 0;
                const x1 = Number(bbox.x1) || x0;
                const y0 = Number(bbox.y0) || 0;
                const y1 = Number(bbox.y1) || y0;

                return {
                    text: String(word.text).trim(),
                    x0: x0,
                    x1: x1,
                    y0: y0,
                    y1: y1,
                    cy: (y0 + y1) / 2
                };
            })
            .sort(function (a, b) {
                return a.cy - b.cy || a.x0 - b.x0;
            });

        const rows = [];
        const tolerance = 18;

        usable.forEach(function (word) {
            let target = null;
            let smallestDistance = Infinity;

            rows.forEach(function (row) {
                const distance = Math.abs(row.cy - word.cy);
                if (distance <= tolerance && distance < smallestDistance) {
                    target = row;
                    smallestDistance = distance;
                }
            });

            if (!target) {
                target = {
                    cy: word.cy,
                    words: []
                };
                rows.push(target);
            }

            target.words.push(word);
            target.words.sort(function (a, b) {
                return a.x0 - b.x0;
            });
            target.cy = target.words.reduce(function (sum, item) {
                return sum + item.cy;
            }, 0) / target.words.length;
        });

        rows.forEach(function (row) {
            row.text = row.words.map(function (word) {
                return word.text;
            }).join(" ");
        });

        return rows;
    }

    function findRightmostAmount(words) {
        const candidates = [];

        words.forEach(function (word) {
            const matches = String(word.text || "").match(
                /\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2}/g
            );

            if (!matches) {
                return;
            }

            matches.forEach(function (match) {
                const cleaned = match.replace(/,/g, "");
                const number = Number(cleaned);

                if (!Number.isFinite(number)) {
                    return;
                }

                candidates.push({
                    value: number,
                    x1: word.x1
                });
            });
        });

        if (!candidates.length) {
            return null;
        }

        candidates.sort(function (a, b) {
            return b.x1 - a.x1;
        });

        return candidates[0].value;
    }

    function normalizeText(value) {
        return String(value || "")
            .replace(/[|]/g, " ")
            .replace(/[^a-z0-9/]+/gi, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function applyDailySalesOcrValues(values) {
        const found = values && values.found
            ? values.found
            : {};

        const setNumber = function (id, value) {
            if (value === undefined || value === null) {
                return;
            }

            if (typeof dsSet === "function") {
                dsSet(id, Number(value).toFixed(2));
            } else {
                const input = document.getElementById(id);
                if (input) {
                    input.value = Number(value).toFixed(2);
                }
            }
        };

        setNumber("dsTotalSales", found.totalSales);
        setNumber("dsServices", found.services);
        setNumber("dsFood", found.food);
        setNumber("dsBeverage", found.beverage);
        setNumber("dsGeneralMerchandise", found.generalMerchandise);
        setNumber("dsTobacco", found.tobacco);
        setNumber("dsSupply", found.supply);
        setNumber("dsFoodService", found.foodService);
        setNumber("dsAlcoholic", found.alcoholic);

        // Requested calculation: Total Merchandise Sales = Total Sales - Services.
        if (typeof dsCalculate === "function") {
            dsCalculate();
        }
    }

    window.openDailySalesScanner = openDailySalesScanner;
    window.handleDailySalesScanFile = handleDailySalesScanFile;
    window.scanDailySalesImage = scanDailySalesImage;
})();

