/*
 * Store Apps - Daily Sales OCR
 *
 * LOCKED CORE SAFE MODULE
 * - Does not modify Daily Sales API / save flow.
 * - Adds Scan / Take Picture only.
 * - OCR is targeted to OEOD PSA Report layout.
 */
(function () {
    'use strict';

    var OCR_SCRIPT_ID = 'dsTesseractScript';
    var OCR_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js';
    var CONTROL_ID = 'dsOcrControl';
    var MENU_ID = 'dsOcrMenu';
    var STATUS_ID = 'dsOcrStatus';
    var GALLERY_ID = 'dsOcrGalleryInput';
    var CAMERA_ID = 'dsOcrCameraInput';

    var FIELDS = {
        totalSales: 'dsTotalSales',
        merchandise: 'dsTotalMerchandiseSales',
        services: 'dsServices',
        food: 'dsFood',
        beverage: 'dsBeverage',
        generalMerchandise: 'dsGeneralMerchandise',
        tobacco: 'dsTobacco',
        supply: 'dsSupply',
        foodService: 'dsFoodService',
        alcoholic: 'dsAlcoholic'
    };

    var LABELS = [
        { key: 'generalMerchandise', variants: ['general merchandise', 'generai merchandise', 'general merchandlse'] },
        { key: 'tobacco', variants: ['tobacco/alcoholic', 'tobacco alcoholic', 'tobacco/alcoholic'] },
        { key: 'foodService', variants: ['food service', 'food senice', 'food servlce', 'food seruice'] },
        { key: 'services', variants: ['services', 'service', 'servlces'] },
        { key: 'beverage', variants: ['beverage', 'beverages'] },
        { key: 'food', variants: ['food'] },
        { key: 'alcoholic', variants: ['alcoholic', 'aicoholic', 'alcohollc'] }
    ];

    var state = {
        ready: false,
        processing: false,
        observer: null
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function setStatus(text, busy) {
        var el = byId(STATUS_ID);
        if (!el) return;
        el.textContent = text || '';
        el.classList.toggle('is-busy', !!busy);
        el.setAttribute('aria-live', 'polite');
    }

    function normalizeText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[|]/g, 'i')
            .replace(/[!]/g, 'l')
            .replace(/[’']/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeWord(value) {
        var s = normalizeText(value)
            .replace(/[^a-z0-9/]+/g, '');
        var fixes = {
            'generai': 'general',
            'merchandlse': 'merchandise',
            'merchandlise': 'merchandise',
            'senice': 'service',
            'servlce': 'service',
            'servlces': 'services',
            'seruice': 'service',
            'aicoholic': 'alcoholic',
            'alcohollc': 'alcoholic',
            'beuerage': 'beverage',
            'beverages': 'beverages'
        };
        return fixes[s] || s;
    }

    function loadTesseract() {
        if (window.Tesseract) return Promise.resolve(window.Tesseract);
        var existing = byId(OCR_SCRIPT_ID);
        if (existing) {
            return new Promise(function (resolve, reject) {
                var tries = 0;
                var timer = setInterval(function () {
                    if (window.Tesseract) {
                        clearInterval(timer);
                        resolve(window.Tesseract);
                    } else if (++tries > 100) {
                        clearInterval(timer);
                        reject(new Error('OCR library could not be loaded.'));
                    }
                }, 100);
            });
        }
        return new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.id = OCR_SCRIPT_ID;
            script.src = OCR_SCRIPT_SRC;
            script.async = true;
            script.onload = function () {
                if (window.Tesseract) resolve(window.Tesseract);
                else reject(new Error('OCR library loaded but Tesseract is unavailable.'));
            };
            script.onerror = function () {
                reject(new Error('Unable to load OCR library. Check internet connection.'));
            };
            document.head.appendChild(script);
        });
    }

    function createEnhancedImage(file) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            var url = URL.createObjectURL(file);
            img.onload = function () {
                try {
                    var maxW = 2400;
                    var scale = Math.min(2.2, maxW / img.naturalWidth);
                    if (scale < 1) scale = 1;
                    var canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.naturalWidth * scale);
                    canvas.height = Math.round(img.naturalHeight * scale);
                    var ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    var data = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    for (var i = 0; i < data.data.length; i += 4) {
                        var r = data.data[i], g = data.data[i + 1], b = data.data[i + 2];
                        var gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                        gray = gray < 150 ? Math.max(0, gray - 18) : Math.min(255, gray + 12);
                        data.data[i] = data.data[i + 1] = data.data[i + 2] = gray;
                    }
                    ctx.putImageData(data, 0, 0);
                    canvas.toBlob(function (blob) {
                        URL.revokeObjectURL(url);
                        if (!blob) reject(new Error('Unable to prepare image.'));
                        else resolve(blob);
                    }, 'image/png', 1);
                } catch (e) {
                    URL.revokeObjectURL(url);
                    reject(e);
                }
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('Unable to read selected image.'));
            };
            img.src = url;
        });
    }

    function moneyValue(text) {
        var s = String(text || '')
            .replace(/[OQ]/g, '0')
            .replace(/[Il]/g, '1')
            .replace(/[Ss]/g, '5')
            .replace(/\s/g, '')
            .replace(/RM/gi, '');
        var m = s.match(/-?\d{1,3}(?:,\d{3})*\.\d{2}|-?\d+\.\d{2}/);
        if (!m) return null;
        var n = Number(m[0].replace(/,/g, ''));
        return Number.isFinite(n) ? n : null;
    }

    function isMoneyToken(text) {
        return /(?:\d[\d,]*\.\d{2})/.test(String(text || '').replace(/[OQ]/g, '0'));
    }

    function centerY(word) {
        return word.bbox ? (word.bbox.y0 + word.bbox.y1) / 2 : 0;
    }

    function centerX(word) {
        return word.bbox ? (word.bbox.x0 + word.bbox.x1) / 2 : 0;
    }

    function clusterRows(words) {
        var sorted = words.slice().sort(function (a, b) {
            return centerY(a) - centerY(b) || centerX(a) - centerX(b);
        });
        var rows = [];
        var tolerance = 34;
        sorted.forEach(function (word) {
            var y = centerY(word);
            var best = null;
            var bestDiff = Infinity;
            rows.forEach(function (row) {
                var diff = Math.abs(y - row.y);
                if (diff < tolerance && diff < bestDiff) {
                    best = row;
                    bestDiff = diff;
                }
            });
            if (!best) {
                best = { y: y, words: [] };
                rows.push(best);
            }
            best.words.push(word);
            best.y = best.words.reduce(function (sum, w) { return sum + centerY(w); }, 0) / best.words.length;
        });
        rows.forEach(function (row) {
            row.words.sort(function (a, b) { return centerX(a) - centerX(b); });
            row.text = row.words.map(function (w) { return w.text; }).join(' ');
        });
        return rows.sort(function (a, b) { return a.y - b.y; });
    }

    function findLabel(row, label) {
        var words = row.words.map(function (w) { return normalizeWord(w.text); });
        for (var v = 0; v < label.variants.length; v++) {
            var parts = label.variants[v].split(/\s+/).map(normalizeWord);
            for (var i = 0; i <= words.length - parts.length; i++) {
                var ok = true;
                for (var j = 0; j < parts.length; j++) {
                    if (words[i + j] !== parts[j]) { ok = false; break; }
                }
                if (ok) return i;
            }
        }
        return -1;
    }

    function extractRowAmount(row, minXRatio) {
        var candidates = row.words.filter(function (w) {
            return isMoneyToken(w.text) && centerX(w) >= minXRatio;
        });
        if (!candidates.length) {
            candidates = row.words.filter(function (w) { return isMoneyToken(w.text); });
        }
        if (!candidates.length) return null;
        candidates.sort(function (a, b) { return centerX(b) - centerX(a); });
        return moneyValue(candidates[0].text);
    }

    function parseReport(data) {
        var words = (data && data.words ? data.words : []).filter(function (w) {
            return w && w.text && w.bbox;
        });
        if (!words.length) throw new Error('No readable text was found in the document.');

        var rows = clusterRows(words);
        var result = {};
        var found = 0;

        /*
         * OEOD PSA parser:
         * IMPORTANT: classify the WHOLE row before matching short labels.
         * This prevents:
         *   "Food Service" -> Food
         *   "Tobacco/Alcoholic" -> Alcoholic
         * and makes Services independent from Food Service.
         */
        function rowLabel(row) {
            var raw = normalizeText(row.text)
                .replace(/[|]/g, 'i')
                .replace(/\s+/g, ' ')
                .trim();

            // OCR clean-up for common camera errors.
            raw = raw
                .replace(/\bfood\s+senice\b/g, 'food service')
                .replace(/\bfood\s+servlce\b/g, 'food service')
                .replace(/\bfood\s+seruice\b/g, 'food service')
                .replace(/\bservlces\b/g, 'services')
                .replace(/\bservlce\b/g, 'service')
                .replace(/\bseruice\b/g, 'service')
                .replace(/\baicoholic\b/g, 'alcoholic')
                .replace(/\balcohollc\b/g, 'alcoholic')
                .replace(/\bbeuerage\b/g, 'beverage')
                .replace(/\bgenerai\b/g, 'general')
                .replace(/\bmerchandlse\b/g, 'merchandise');

            /*
             * Longest / most specific labels FIRST.
             * Never classify a row as Food or Alcoholic if it contains
             * the longer combined label.
             */
            if (/\bfood\s+service\b/.test(raw)) return 'foodService';
            if (/\btobacco\s*\/?\s*alcoholic\b/.test(raw) ||
                /\btobacco\s+alcoholic\b/.test(raw)) return 'tobacco';
            if (/\bgeneral\s+merchandise\b/.test(raw)) return 'generalMerchandise';
            if (/\bservices\b/.test(raw) || /\bservice\b/.test(raw)) return 'services';
            if (/\bbeverage(?:s)?\b/.test(raw)) return 'beverage';
            if (/\bfood\b/.test(raw)) return 'food';
            if (/\balcoholic\b/.test(raw)) return 'alcoholic';
            if (/\bsupply\b/.test(raw)) return 'supply';
            return null;
        }

        rows.forEach(function (row) {
            var key = rowLabel(row);
            if (!key) return;

            var amount = extractRowAmount(row, 0.45);
            if (amount == null) return;

            // One row = one PSA. Keep the first valid occurrence.
            if (result[key] == null) {
                result[key] = amount;
            }
        });

        // Total Gross Sales (Incl.GST): right-most amount on the total row.
        rows.forEach(function (row) {
            var text = normalizeText(row.text).replace(/\s+/g, ' ');
            if (text.indexOf('total gross sales') >= 0 ||
                (text.indexOf('gross sales') >= 0 && text.indexOf('incl') >= 0)) {
                var amount = extractRowAmount(row, 0.45);
                if (amount !== null) result.totalSales = amount;
            }
        });

        // Fallback for OCR variations of the total row.
        if (result.totalSales == null) {
            rows.forEach(function (row) {
                var t = normalizeText(row.text);
                if (t.indexOf('total') >= 0 && t.indexOf('sales') >= 0) {
                    var a = extractRowAmount(row, 0.45);
                    if (a !== null) {
                        if (result.totalSales == null || a > result.totalSales) {
                            result.totalSales = a;
                        }
                    }
                }
            });
        }

        // Count only fields actually present in the document.
        Object.keys(result).forEach(function (k) {
            if (result[k] != null) found++;
        });

        return { result: result, found: found };
    }

    function setField(id, value, overwrite) {
        var el = byId(id);
        if (!el || value == null) return false;
        if (!overwrite && String(el.value || '').trim() !== '') return false;
        el.value = Number(value).toFixed(2);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    function fillFields(parsed) {
        var r = parsed.result;
        var count = 0;
        if (setField(FIELDS.totalSales, r.totalSales, true)) count++;
        if (setField(FIELDS.services, r.services, true)) count++;
        if (setField(FIELDS.food, r.food, true)) count++;
        if (setField(FIELDS.beverage, r.beverage, true)) count++;
        if (setField(FIELDS.generalMerchandise, r.generalMerchandise, true)) count++;
        if (setField(FIELDS.tobacco, r.tobacco, true)) count++;
        if (setField(FIELDS.foodService, r.foodService, true)) count++;
        if (setField(FIELDS.alcoholic, r.alcoholic, true)) count++;

        // Supply is not present in the supplied OEOD page. Default to 0.00, but never lock it.
        var supply = r.supply != null ? r.supply : 0;
        if (setField(FIELDS.supply, supply, false)) count++;

        // Merchandise sales is a calculated suggestion only. Keep it editable and never overwrite user input.
        var merch = byId(FIELDS.merchandise);
        if (merch && String(merch.value || '').trim() === '' && r.totalSales != null && r.services != null) {
            merch.value = Math.max(0, r.totalSales - r.services).toFixed(2);
            merch.dispatchEvent(new Event('input', { bubbles: true }));
            merch.dispatchEvent(new Event('change', { bubbles: true }));
            count++;
        }

        if (typeof window.calculateDailySales === 'function') {
            try { window.calculateDailySales(); } catch (e) {}
        }
        return count;
    }

    function showMenu() {
        var menu = byId(MENU_ID);
        if (!menu) return;
        var open = menu.hidden;
        menu.hidden = !open;
    }

    function closeMenu() {
        var menu = byId(MENU_ID);
        if (menu) menu.hidden = true;
    }

    function startInput(inputId) {
        var input = byId(inputId);
        if (!input) return;
        closeMenu();
        input.value = '';
        input.click();
    }

    function processFile(file) {
        if (!file || state.processing) return;
        state.processing = true;
        setStatus('Reading document...', true);

        loadTesseract()
            .then(function (Tesseract) {
                return Tesseract.recognize(file, 'eng', {
                    logger: function (m) {
                        if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
                            var pct = Math.round(m.progress * 100);
                            setStatus('Reading document... ' + pct + '%', true);
                        }
                    }
                });
            })
            .then(function (first) {
                var parsed = parseReport(first.data);
                // The original image should be sufficient for the supplied OEOD format.
                // If fewer than 7 PSA/total values were found, retry with enhanced image.
                if (parsed.found < 7) {
                    setStatus('Reading document... 50%', true);
                    return createEnhancedImage(window.__dsOcrPendingFile).then(function (enhanced) {
                        return loadTesseract().then(function (Tesseract) {
                            return Tesseract.recognize(enhanced, 'eng', {
                                logger: function (m) {
                                    if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
                                        setStatus('Reading document... ' + Math.round(50 + m.progress * 50) + '%', true);
                                    }
                                }
                            });
                        }).then(function (second) {
                            var parsed2 = parseReport(second.data);
                            return parsed2.found > parsed.found ? parsed2 : parsed;
                        });
                    });
                }
                return parsed;
            })
            .then(function (parsed) {
                var filled = fillFields(parsed);
                setStatus('Scan complete — ' + filled + ' fields filled.', false);
            })
            .catch(function (err) {
                console.error('Daily Sales OCR error:', err);
                setStatus('Unable to read document. Please try a clearer picture.', false);
            })
            .finally(function () {
                state.processing = false;
                window.__dsOcrPendingFile = null;
            });
    }

    function buildControl(button) {
        if (byId(CONTROL_ID)) return;
        var parent = button.parentElement;
        if (!parent) return;

        // Remove/hide duplicate Scan buttons anywhere in the loaded Daily Sales form.
        var allButtons = Array.prototype.slice.call(document.querySelectorAll('button'));
        allButtons.forEach(function (b) {
            if (b !== button && normalizeText(b.textContent).indexOf('scan / take picture') >= 0) {
                b.style.display = 'none';
            }
        });

        var wrapper = document.createElement('div');
        wrapper.id = CONTROL_ID;
        wrapper.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:stretch;width:260px;min-width:260px;box-sizing:border-box;';

        button.parentNode.insertBefore(wrapper, button);
        wrapper.appendChild(button);
        button.style.width = '100%';
        button.style.boxSizing = 'border-box';
        button.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            showMenu();
        };

        var status = document.createElement('div');
        status.id = STATUS_ID;
        status.textContent = '';
        status.style.cssText = 'min-height:18px;height:18px;line-height:18px;margin-top:3px;font-size:11px;font-weight:600;color:#64748b;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        wrapper.appendChild(status);

        var menu = document.createElement('div');
        menu.id = MENU_ID;
        menu.hidden = true;
        menu.style.cssText = 'position:absolute;z-index:9999;top:calc(100% - 18px);left:0;width:100%;padding:6px;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 10px 25px rgba(15,23,42,.15);box-sizing:border-box;';

        function option(text, icon, handler) {
            var b = document.createElement('button');
            b.type = 'button';
            b.innerHTML = '<i class="fa-solid ' + icon + '"></i> ' + text;
            b.style.cssText = 'display:block;width:100%;padding:10px 12px;border:0;border-radius:7px;background:#fff;color:#1e293b;text-align:left;font-weight:700;cursor:pointer;';
            b.onmouseenter = function () { b.style.background = '#f1f5f9'; };
            b.onmouseleave = function () { b.style.background = '#fff'; };
            b.onclick = function (e) { e.stopPropagation(); handler(); };
            menu.appendChild(b);
        }
        option('Gallery Picture', 'fa-image', function () { startInput(GALLERY_ID); });
        option('Camera Picture', 'fa-camera', function () { startInput(CAMERA_ID); });
        wrapper.appendChild(menu);

        var gallery = document.createElement('input');
        gallery.id = GALLERY_ID;
        gallery.type = 'file';
        gallery.accept = 'image/*';
        gallery.style.display = 'none';
        gallery.addEventListener('change', function () {
            if (gallery.files && gallery.files[0]) {
                window.__dsOcrPendingFile = gallery.files[0];
                processFile(gallery.files[0]);
            }
        });
        wrapper.appendChild(gallery);

        var camera = document.createElement('input');
        camera.id = CAMERA_ID;
        camera.type = 'file';
        camera.accept = 'image/*';
        camera.setAttribute('capture', 'environment');
        camera.style.display = 'none';
        camera.addEventListener('change', function () {
            if (camera.files && camera.files[0]) {
                window.__dsOcrPendingFile = camera.files[0];
                processFile(camera.files[0]);
            }
        });
        wrapper.appendChild(camera);

        document.addEventListener('click', function (e) {
            if (!wrapper.contains(e.target)) closeMenu();
        });
        state.ready = true;
    }

    function findScanButton() {
        var buttons = Array.prototype.slice.call(document.querySelectorAll('button'));
        return buttons.find(function (b) {
            return normalizeText(b.textContent).indexOf('scan / take picture') >= 0;
        }) || null;
    }

    function init() {
        var button = findScanButton();
        if (button) buildControl(button);
    }

    function observe() {
        if (state.observer) return;
        state.observer = new MutationObserver(function () {
            if (!state.ready) init();
        });
        state.observer.observe(document.body, { childList: true, subtree: true });
        init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observe);
    } else {
        observe();
    }

    window.openDailySalesScanner = function () {
        var button = findScanButton();
        if (button) {
            if (!state.ready) buildControl(button);
            showMenu();
        }
    };
})();
