/*
 * Store Apps - Daily Sales OCR
 * ADDITIVE MODULE ONLY
 * Does not modify Daily Sales API, save, search, validation or database logic.
 */
(function () {
    "use strict";

    const OCR_SRC = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    const IDS = {
        totalSales: "dsTotalSales",
        merch: "dsTotalMerchandiseSales",
        services: "dsServices",
        food: "dsFood",
        beverage: "dsBeverage",
        general: "dsGeneralMerchandise",
        tobacco: "dsTobacco",
        supply: "dsSupply",
        foodService: "dsFoodService",
        alcoholic: "dsAlcoholic"
    };

    let ocrBusy = false;
    let ocrStatusEl = null;
    let galleryInput = null;
    let cameraInput = null;

    function el(id) { return document.getElementById(id); }

    function waitForElement(id, timeout = 20000) {
        return new Promise(resolve => {
            const start = Date.now();
            const timer = setInterval(() => {
                const node = el(id);
                if (node) {
                    clearInterval(timer);
                    resolve(node);
                } else if (Date.now() - start > timeout) {
                    clearInterval(timer);
                    resolve(null);
                }
            }, 100);
        });
    }

    function setStatus(text, busy) {
        if (!ocrStatusEl) return;
        ocrStatusEl.textContent = text || "";
        ocrStatusEl.style.display = text ? "block" : "none";
        ocrStatusEl.style.minHeight = "18px";
        ocrStatusEl.style.fontSize = "12px";
        ocrStatusEl.style.lineHeight = "18px";
        ocrStatusEl.style.fontWeight = "600";
        ocrStatusEl.style.color = busy ? "#64748B" : "#475569";
    }

    function ensureEditable(id) {
        const node = el(id);
        if (!node) return;
        node.readOnly = false;
        node.disabled = false;
        node.removeAttribute("readonly");
        node.removeAttribute("disabled");
    }

    function ensureMerchEditable() {
        // Explicitly keep this field manually editable.
        ensureEditable(IDS.merch);
    }

    function numberFromText(text) {
        if (text == null) return null;
        let s = String(text).trim()
            .replace(/[Oo]/g, "0")
            .replace(/[Il|]/g, "1")
            .replace(/[Ss]/g, "5")
            .replace(/\s/g, "");
        // Keep the last plausible monetary number in a token.
        const m = s.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})|-?\d+(?:\.\d{1,2})?/g);
        if (!m || !m.length) return null;
        const v = Number(m[m.length - 1].replace(/,/g, ""));
        return Number.isFinite(v) ? v : null;
    }

    function money(v) {
        return Number(v || 0).toFixed(2);
    }

    function setValue(id, value, triggerCalc = false) {
        const node = el(id);
        if (!node || value == null || !Number.isFinite(Number(value))) return false;
        node.value = money(value);
        if (triggerCalc) {
            try {
                if (typeof calculateDailySales === "function") calculateDailySales();
            } catch (_) {}
        }
        return true;
    }

    function fieldHasManualValue(id) {
        const node = el(id);
        return !!(node && String(node.value || "").trim() !== "");
    }

    function ensureInputs() {
        Object.values(IDS).forEach(ensureEditable);
        const supply = el(IDS.supply);
        if (supply && String(supply.value || "").trim() === "") supply.value = "0.00";
    }

    function findScanButtons() {
        return Array.from(document.querySelectorAll("button")).filter(btn => {
            const t = String(btn.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
            return t.includes("scan / take picture") || t === "scan/take picture";
        });
    }

    function ensureStatusAndButton() {
        const buttons = findScanButtons();
        if (!buttons.length) return false;

        // Keep the first existing Scan button and hide duplicate scan buttons.
        const main = buttons[0];
        buttons.slice(1).forEach(b => { b.style.display = "none"; });
        main.type = "button";
        main.onclick = openDailySalesScanner;
        main.style.position = "relative";

        // Put status below the button, never beside it, so the button cannot move.
        let wrap = main.parentElement;
        if (!wrap) return true;
        if (!wrap.dataset.ocrLayoutReady) {
            wrap.dataset.ocrLayoutReady = "1";
            wrap.style.display = "flex";
            wrap.style.flexDirection = "column";
            wrap.style.alignItems = "flex-start";
            wrap.style.gap = "4px";
        }

        ocrStatusEl = wrap.querySelector("[data-ds-ocr-status]");
        if (!ocrStatusEl) {
            ocrStatusEl = document.createElement("div");
            ocrStatusEl.setAttribute("data-ds-ocr-status", "1");
            ocrStatusEl.style.minHeight = "18px";
            ocrStatusEl.style.fontSize = "12px";
            ocrStatusEl.style.lineHeight = "18px";
            ocrStatusEl.style.fontWeight = "600";
            ocrStatusEl.style.display = "none";
            wrap.appendChild(ocrStatusEl);
        }
        return true;
    }

    function ensureFileInputs() {
        if (!galleryInput) {
            galleryInput = document.createElement("input");
            galleryInput.type = "file";
            galleryInput.accept = "image/*";
            galleryInput.style.display = "none";
            galleryInput.id = "dsOcrGalleryInput";
            document.body.appendChild(galleryInput);
            galleryInput.addEventListener("change", onFileSelected);
        }
        if (!cameraInput) {
            cameraInput = document.createElement("input");
            cameraInput.type = "file";
            cameraInput.accept = "image/*";
            cameraInput.setAttribute("capture", "environment");
            cameraInput.style.display = "none";
            cameraInput.id = "dsOcrCameraInput";
            document.body.appendChild(cameraInput);
            cameraInput.addEventListener("change", onFileSelected);
        }
    }

    function buildChoiceMenu(anchor) {
        let menu = document.getElementById("dsOcrChoiceMenu");
        if (menu) menu.remove();

        menu = document.createElement("div");
        menu.id = "dsOcrChoiceMenu";
        menu.style.position = "fixed";
        menu.style.zIndex = "99999";
        menu.style.background = "#fff";
        menu.style.border = "1px solid #CBD5E1";
        menu.style.borderRadius = "12px";
        menu.style.boxShadow = "0 12px 30px rgba(15,23,42,.16)";
        menu.style.padding = "6px";
        menu.style.minWidth = "210px";

        const rect = anchor.getBoundingClientRect();
        menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 230)) + "px";
        menu.style.top = Math.min(window.innerHeight - 110, rect.bottom + 6) + "px";

        const add = (label, icon, action) => {
            const b = document.createElement("button");
            b.type = "button";
            b.innerHTML = `<i class="fa-solid ${icon}" style="width:20px"></i><span>${label}</span>`;
            b.style.display = "flex";
            b.style.alignItems = "center";
            b.style.gap = "9px";
            b.style.width = "100%";
            b.style.border = "0";
            b.style.background = "transparent";
            b.style.padding = "11px 12px";
            b.style.borderRadius = "8px";
            b.style.cursor = "pointer";
            b.style.textAlign = "left";
            b.style.fontWeight = "700";
            b.style.color = "#1E293B";
            b.addEventListener("click", () => { menu.remove(); action(); });
            menu.appendChild(b);
        };

        add("Gallery Picture", "fa-image", () => galleryInput.click());
        add("Camera Picture", "fa-camera", () => cameraInput.click());

        document.body.appendChild(menu);
        setTimeout(() => {
            const close = e => {
                if (!menu.contains(e.target) && e.target !== anchor) {
                    menu.remove(); document.removeEventListener("pointerdown", close);
                }
            };
            document.addEventListener("pointerdown", close);
        }, 0);
    }

    async function openDailySalesScanner(event) {
        if (event) event.preventDefault();
        if (ocrBusy) return;
        ensureInputs();
        ensureFileInputs();
        const button = event?.currentTarget || findScanButtons()[0];
        buildChoiceMenu(button || document.body);
    }

    window.openDailySalesScanner = openDailySalesScanner;

    async function onFileSelected(e) {
        const file = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!file || ocrBusy) return;
        await runOCR(file);
    }

    function loadTesseract() {
        if (window.Tesseract) return Promise.resolve(window.Tesseract);
        return new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-ds-tesseract]');
            if (existing) {
                existing.addEventListener("load", () => resolve(window.Tesseract));
                existing.addEventListener("error", reject);
                return;
            }
            const s = document.createElement("script");
            s.src = OCR_SRC;
            s.async = true;
            s.dataset.dsTesseract = "1";
            s.onload = () => resolve(window.Tesseract);
            s.onerror = () => reject(new Error("Unable to load OCR engine."));
            document.head.appendChild(s);
        });
    }

    function preprocess(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                const maxW = 2600;
                const scale = Math.min(3, Math.max(1.6, maxW / img.naturalWidth));
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.naturalWidth * scale);
                canvas.height = Math.round(img.naturalHeight * scale);
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                ctx.imageSmoothingEnabled = true;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < data.data.length; i += 4) {
                    const r = data.data[i], g = data.data[i + 1], b = data.data[i + 2];
                    let gray = 0.299*r + 0.587*g + 0.114*b;
                    gray = (gray - 128) * 1.35 + 128;
                    gray = Math.max(0, Math.min(255, gray));
                    data.data[i] = data.data[i+1] = data.data[i+2] = gray;
                }
                ctx.putImageData(data, 0, 0);
                resolve(canvas);
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Unable to read image.")); };
            img.src = url;
        });
    }

    function normalizeLabel(s) {
        return String(s || "")
            .toLowerCase()
            .replace(/[|]/g, "i")
            .replace(/[0]/g, "o")
            .replace(/[^a-z]/g, "");
    }

    function fuzzyScore(text, target) {
        const a = normalizeLabel(text), b = normalizeLabel(target);
        if (!a || !b) return 0;
        if (a === b) return 1;
        if (a.includes(b)) return 0.88;
        if (b.includes(a)) return 0.82;
        let same = 0;
        const n = Math.min(a.length, b.length);
        for (let i=0;i<n;i++) if (a[i] === b[i]) same++;
        return same / Math.max(a.length, b.length);
    }

    function parseMoneyToken(s) {
        if (!s) return null;
        let t = String(s).replace(/[Oo]/g,"0").replace(/[Il|]/g,"1").replace(/[Ss]/g,"5");
        t = t.replace(/[^0-9,.-]/g, "");
        if (!/\d/.test(t)) return null;
        const candidates = t.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})|-?\d+(?:\.\d{1,2})?/g);
        if (!candidates) return null;
        const v = Number(candidates[candidates.length-1].replace(/,/g,""));
        return Number.isFinite(v) ? v : null;
    }

    function reconstructRows(words) {
        const usable = (words || []).filter(w => {
            const t = String(w.text || "").trim();
            return t && w.bbox && Number.isFinite(w.bbox.y0) && Number.isFinite(w.bbox.y1);
        }).map(w => ({
            text: String(w.text).trim(),
            x: Number(w.bbox.x0),
            y: (Number(w.bbox.y0)+Number(w.bbox.y1))/2,
            h: Math.max(1, Number(w.bbox.y1)-Number(w.bbox.y0)),
            x1: Number(w.bbox.x1)
        })).sort((a,b) => a.y-b.y || a.x-b.x);

        const rows = [];
        usable.forEach(w => {
            let row = null;
            for (let i=rows.length-1;i>=0;i--) {
                const r = rows[i];
                const tolerance = Math.max(10, Math.min(30, Math.max(w.h, r.avgH)*0.65));
                if (Math.abs(w.y-r.y) <= tolerance) { row = r; break; }
                if (r.y < w.y - 35) break;
            }
            if (!row) { row = {y:w.y, avgH:w.h, words:[]}; rows.push(row); }
            row.words.push(w);
            row.y = row.words.reduce((a,b)=>a+b.y,0)/row.words.length;
            row.avgH = row.words.reduce((a,b)=>a+b.h,0)/row.words.length;
        });
        rows.forEach(r => r.words.sort((a,b)=>a.x-b.x));
        return rows;
    }

    function rowText(row) { return row.words.map(w=>w.text).join(" ").replace(/\s+/g," ").trim(); }

    function rowNumbers(row) {
        const out=[];
        for (const w of row.words) {
            const v=parseMoneyToken(w.text);
            if (v!=null && v>=0 && v<100000000) out.push({value:v,x:w.x});
        }
        return out;
    }

    function extractPSA(words) {
        const rows = reconstructRows(words);
        const targets = [
            {key:"services", labels:["Services"]},
            {key:"foodService", labels:["Food Service"]},
            {key:"food", labels:["Food"]},
            {key:"beverage", labels:["Beverage","Beverages"]},
            {key:"general", labels:["General Merchandise"]},
            {key:"tobacco", labels:["Tobacco/Alcoholic","Tobacco Alcoholic","Tobacco"]},
            {key:"supply", labels:["Supply"]},
            {key:"alcoholic", labels:["Alcoholic"]}
        ];
        const found={};

        // Exact phrase rows first. This prevents Food Service -> Food and Tobacco/Alcoholic -> Alcoholic.
        for (const row of rows) {
            const text=rowText(row);
            const compact=normalizeLabel(text);
            const nums=rowNumbers(row).sort((a,b)=>a.x-b.x);
            if (!nums.length) continue;

            // Total is the rightmost monetary number on the row.
            const total=nums[nums.length-1].value;
            for (const t of targets) {
                if (found[t.key] != null) continue;
                for (const label of t.labels) {
                    const lp=normalizeLabel(label);
                    if (compact.includes(lp)) {
                        // Protect specific rows from generic labels.
                        if (t.key === "food" && compact.includes("foodservice")) continue;
                        if (t.key === "alcoholic" && compact.includes("tobaccoalcoholic")) continue;
                        if (t.key === "services" && compact.includes("foodservice")) continue;
                        found[t.key]=total;
                        break;
                    }
                }
            }
        }

        // If OCR splits a label badly, use nearest fuzzy row match.
        for (const t of targets) {
            if (found[t.key] != null) continue;
            let best=null;
            for (const row of rows) {
                const text=rowText(row);
                const nums=rowNumbers(row).sort((a,b)=>a.x-b.x);
                if (!nums.length) continue;
                let score=0;
                for (const label of t.labels) score=Math.max(score,fuzzyScore(text,label));
                if (t.key === "food" && normalizeLabel(text).includes("foodservice")) score=0;
                if (t.key === "services" && normalizeLabel(text).includes("foodservice")) score=0;
                if (t.key === "alcoholic" && normalizeLabel(text).includes("tobaccoalcoholic")) score=0;
                if (!best || score>best.score) best={score,row,value:nums[nums.length-1].value};
            }
            if (best && best.score>=0.72) found[t.key]=best.value;
        }

        // Total Gross Sales row.
        let totalSales=null;
        for (const row of rows) {
            const c=normalizeLabel(rowText(row));
            if (c.includes("totalgrosssales") || (c.includes("grosssales") && c.includes("total"))) {
                const nums=rowNumbers(row).sort((a,b)=>a.x-b.x);
                if (nums.length) totalSales=nums[nums.length-1].value;
            }
        }
        if (totalSales==null) {
            // fallback: look for the largest monetary row near the PSA section
            const candidates=rows.map(r=>({r, n:rowNumbers(r).sort((a,b)=>a.x-b.x)})).filter(x=>x.n.length && /gross|sales/i.test(rowText(x.r)));
            if (candidates.length) totalSales=candidates[candidates.length-1].n[candidates[candidates.length-1].n.length-1].value;
        }
        found.totalSales=totalSales;
        return found;
    }

    async function recognize(canvas) {
        const T=await loadTesseract();
        if (!T || typeof T.recognize !== "function") throw new Error("OCR engine is unavailable.");
        const result=await T.recognize(canvas,"eng",{
            logger: m => {
                if (m && m.status === "recognizing text") {
                    const pct=Math.round((m.progress||0)*100);
                    setStatus(`Reading document... ${pct}%`, true);
                } else {
                    setStatus("Reading document...", true);
                }
            }
        });
        return result && result.data ? result.data : {};
    }

    async function runOCR(file) {
        ocrBusy=true;
        ensureInputs(); ensureMerchEditable(); ensureFileInputs(); ensureStatusAndButton();
        setStatus("Reading document...", true);
        try {
            const canvas=await preprocess(file);
            const data=await recognize(canvas);
            const words=data.words || [];
            const result=extractPSA(words);

            let filled=0;
            if (result.totalSales != null) { setValue(IDS.totalSales,result.totalSales); filled++; }
            if (result.services != null) { setValue(IDS.services,result.services); filled++; }
            if (result.food != null) { setValue(IDS.food,result.food); filled++; }
            if (result.beverage != null) { setValue(IDS.beverage,result.beverage); filled++; }
            if (result.general != null) { setValue(IDS.general,result.general); filled++; }
            if (result.tobacco != null) { setValue(IDS.tobacco,result.tobacco); filled++; }
            if (result.foodService != null) { setValue(IDS.foodService,result.foodService); filled++; }
            if (result.alcoholic != null) { setValue(IDS.alcoholic,result.alcoholic); filled++; }

            // Supply is intentionally 0.00 when the OEOD report has no Supply row.
            if (result.supply != null) setValue(IDS.supply,result.supply);
            else { const s=el(IDS.supply); if (s) s.value="0.00"; }
            filled++;

            // Merchandise is a suggested calculation only. Never overwrite a manual value.
            ensureMerchEditable();
            const merch=el(IDS.merch);
            if (merch && String(merch.value||"").trim()==="" && result.totalSales!=null && result.services!=null) {
                merch.value=money(result.totalSales-result.services);
            }

            try { if (typeof calculateDailySales === "function") calculateDailySales(); } catch (_) {}
            setStatus(`Scan complete — ${filled} fields filled.`, false);
        } catch (err) {
            console.error("Daily Sales OCR error:",err);
            setStatus("Unable to read document. Please try a clearer picture.",false);
        } finally {
            ensureMerchEditable();
            ocrBusy=false;
        }
    }

    function init() {
        const timer=setInterval(()=>{
            const hasForm=!!el("dsTotalSales");
            if (!hasForm) return;
            ensureInputs();
            ensureStatusAndButton();
            ensureFileInputs();
        },500);
        setTimeout(()=>clearInterval(timer),30000);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init);
    else init();

    // Re-run when the dynamic Daily Sales component is injected.
    const observer=new MutationObserver(()=>{
        if (el("dsTotalSales")) {
            ensureInputs();
            ensureStatusAndButton();
            ensureFileInputs();
        }
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});

    window.openDailySalesScanner=openDailySalesScanner;
})();
