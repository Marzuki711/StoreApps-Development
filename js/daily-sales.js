/*
 * Store Apps
 * Daily Sales
 *
 * IMPORTANT:
 * Daily Sales uses DAILY_SALES_API_URL.
 * It does NOT use CONFIG.WEB_APP_URL.
 */

let dsStores = [];
let dsRows = [];
let dsEditId = "";
let dsSelectedDate = "";


/* ==========================================
   DAILY SALES API
========================================== */

async function callDailySalesAPI(action, data = {}) {

    const url =
        typeof CONFIG !== "undefined" &&
        CONFIG.DAILY_SALES_API_URL
            ? CONFIG.DAILY_SALES_API_URL
            : "";

    if (!url) {
        return {
            status: false,
            message: "Daily Sales API URL is not configured."
        };
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 10000);

    try {

        const payload = JSON.stringify({
            action: action,
            data: data
        });

        /*
         * IMPORTANT:
         * Do NOT set Content-Type: application/json here.
         *
         * Google Apps Script Web Apps can trigger a browser
         * preflight request when application/json is used.
         * The Web App does not need that preflight.
         *
         * Sending the JSON string without custom headers keeps
         * this as a simple POST request. Apps Script receives it
         * through e.postData.contents.
         */
        const response = await fetch(
            url,
            {
                method: "POST",
                body: payload,
                redirect: "follow",
                signal: controller.signal
            }
        );

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(
                "HTTP " + response.status
            );
        }

        return await response.json();

    } catch (err) {

        clearTimeout(timeout);

        if (err.name === "AbortError") {
            return {
                status: false,
                message: "Daily Sales Server Timeout"
            };
        }

        return {
            status: false,
            message:
                err && err.message
                    ? err.message
                    : "Daily Sales API request failed."
        };
    }
}


/* ==========================================
   LIST LOADING
========================================== */

function dsSetListLoading(show) {

    let overlay =
        document.getElementById(
            "dsListLoading"
        );

    if (!overlay) {

        overlay =
            document.createElement("div");

        overlay.id =
            "dsListLoading";

        overlay.innerHTML = `
            <div class="ds-list-loading-box">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Loading Daily Sales...</span>
            </div>
        `;

        overlay.style.position = "absolute";
        overlay.style.inset = "0";
        overlay.style.display = "none";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.background = "rgba(255,255,255,.82)";
        overlay.style.backdropFilter = "blur(2px)";
        overlay.style.zIndex = "20";
        overlay.style.borderRadius = "18px";
        overlay.style.fontSize = "14px";
        overlay.style.fontWeight = "700";
        overlay.style.color = "#334155";

        const box =
            overlay.querySelector(
                ".ds-list-loading-box"
            );

        box.style.display = "flex";
        box.style.alignItems = "center";
        box.style.gap = "10px";
        box.style.padding = "12px 16px";
        box.style.borderRadius = "10px";
        box.style.background = "#fff";
        box.style.boxShadow =
            "0 8px 24px rgba(15,23,42,.12)";

        const tableBody =
            document.getElementById(
                "dsTableBody"
            );

        const table =
            tableBody?.closest("table");

        const tableCard =
            table?.closest(".ds-card");

        if (tableCard) {
            const position =
                getComputedStyle(tableCard).position;

            if (position === "static") {
                tableCard.style.position =
                    "relative";
            }

            tableCard.appendChild(overlay);
        }
    }

    if (overlay) {
        overlay.style.display =
            show ? "flex" : "none";
    }
}


/* ==========================================
   CURRENT USER
========================================== */


function dsGetCurrentUser() {

    if (
        typeof getCurrentUser === "function"
    ) {
        return getCurrentUser();
    }

    if (
        typeof currentUser !== "undefined" &&
        currentUser
    ) {
        return currentUser;
    }

    try {
        return JSON.parse(
            sessionStorage.getItem(
                "currentUser"
            ) || "null"
        );
    } catch (e) {
        return null;
    }
}


/* ==========================================
   PERMISSION
========================================== */

function dsHasAccess() {

    return typeof requirePermission === "function"
        ? requirePermission("daily_sales")
        : true;
}


/* ==========================================
   OPEN DAILY SALES
========================================== */

async function openDailySales() {

    dsSetFormLabels();

    if (!dsHasAccess()) {
        return;
    }

    document
        .getElementById("dailySalesContainer")
        ?.style.setProperty(
            "display",
            "block"
        );

    document
        .getElementById("homeContainer")
        ?.style.setProperty(
            "display",
            "none"
        );

    document
        .getElementById("otModule")
        ?.style.setProperty(
            "display",
            "none"
        );

    document
        .getElementById("userManagementContainer")
        ?.style.setProperty(
            "display",
            "none"
        );

    await dsLoad();
}


/* ==========================================
   LOAD DAILY SALES
========================================== */

async function dsLoad(
    dateOverride = ""
) {

    const user =
        dsGetCurrentUser() || {};

    const username =
        user.username || "";

    dsSelectedDate =
        dateOverride ||
        dsSelectedDate ||
        dsYesterdayISO();

    const listData = {

        username:
            username,

        role:
            user.role || "",

        date:
            dsSelectedDate
    };

    dsSetListLoading(true);

    try {

        let storeResponse = {
            status: true,
            stores: dsStores
        };

        if (!dsStores.length) {

            storeResponse =
                await callDailySalesAPI(
                    "getDailySalesStores",
                    {
                        username:
                            username,

                        role:
                            user.role || ""
                    }
                );
        }

        const listResponse =
            await callDailySalesAPI(
                "getDailySalesList",
                listData
            );

        if (!storeResponse?.status) {

            dsShowError(
                storeResponse?.message ||
                "Unable to load Store data."
            );

            return;
        }

        if (!listResponse?.status) {

            dsShowError(
                listResponse?.message ||
                "Unable to load Daily Sales."
            );

            return;
        }

        dsStores =
            storeResponse.stores ||
            dsStores ||
            [];

        dsRows =
            listResponse.rows || [];

        dsEnsureDateFilter();

        dsPopulateStoreSelect();
        dsRenderTable();

    } finally {

        dsSetListLoading(false);
    }
}

/* ==========================================
   DATE FILTER
========================================== */

function dsTodayISO() {

    const now =
        new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            now.getDate()
        ).padStart(2, "0");

    return (
        year +
        "-" +
        month +
        "-" +
        day
    );
}

function dsYesterdayISO() {

    const date =
        new Date();

    date.setDate(
        date.getDate() - 1
    );

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return (
        year +
        "-" +
        month +
        "-" +
        day
    );
}


function dsEnsureDateFilter() {

    const search =
        document.getElementById(
            "dsSearch"
        );

    if (!search) {
        return;
    }

    const toolbar =
        search.closest(
            ".ds-toolbar"
        );

    if (!toolbar) {
        return;
    }

    /*
     * Keep Business Date and Search on the same horizontal row.
     * The date label stays above the date controls, while the
     * search field is vertically aligned with the date input.
     */
    toolbar.style.display = "grid";
    toolbar.style.gridTemplateColumns =
        "minmax(430px, 480px) minmax(360px, 1fr) auto";
    toolbar.style.columnGap = "24px";
    toolbar.style.alignItems = "end";

    let filter =
        document.getElementById(
            "dsDateFilterWrap"
        );

    if (!filter) {

        filter =
            document.createElement(
                "div"
            );

        filter.id =
            "dsDateFilterWrap";

        filter.style.display =
            "flex";

        filter.style.flexDirection =
            "column";

        filter.style.alignItems =
            "flex-start";

        filter.style.gap =
            "8px";

        filter.style.minWidth =
            "0";

        const label =
            document.createElement(
                "span"
            );

        label.textContent =
            "Business Date:";

        label.style.fontSize =
            "13px";

        label.style.fontWeight =
            "700";

        label.style.color =
            "#334155";

        const input =
            document.createElement(
                "input"
            );

        input.type =
            "date";

        input.id =
            "dsDateFilter";

        input.style.height =
            "44px";

        input.style.boxSizing =
            "border-box";

        input.style.border =
            "1px solid #CBD5E1";

        input.style.borderRadius =
            "10px";

        input.style.padding =
            "0 12px";

        input.style.background =
            "#fff";

        input.style.color =
            "#172033";

        input.style.fontSize =
            "14px";

        input.style.outline =
            "none";

        input.addEventListener(
            "change",
            async function () {

                dsSelectedDate =
                    input.value ||
                    dsTodayISO();

                await dsLoad(
                    dsSelectedDate
                );
            }
        );

        const todayButton =
            document.createElement(
                "button"
            );

        todayButton.type =
            "button";

        todayButton.textContent =
            "Yesterday";

        todayButton.style.height =
            "44px";

        todayButton.style.border =
            "0";

        todayButton.style.borderRadius =
            "10px";

        todayButton.style.padding =
            "0 14px";

        todayButton.style.background =
            "#E2E8F0";

        todayButton.style.color =
            "#1E293B";

        todayButton.style.fontWeight =
            "700";

        todayButton.style.cursor =
            "pointer";

        todayButton.addEventListener(
            "click",
            async function () {

                const yesterday =
                    dsYesterdayISO();

                input.value =
                    yesterday;

                dsSelectedDate =
                    yesterday;

                await dsLoad(
                    yesterday
                );
            }
        );

        const dateControls =
            document.createElement(
                "div"
            );

        dateControls.style.display =
            "flex";

        dateControls.style.alignItems =
            "center";

        dateControls.style.gap =
            "8px";

        dateControls.style.width =
            "100%";

        input.style.flex =
            "1 1 auto";

        input.style.minWidth =
            "0";

        dateControls.appendChild(
            input
        );

        dateControls.appendChild(
            todayButton
        );

        filter.appendChild(
            label
        );

        filter.appendChild(
            dateControls
        );

        const searchWrap =
            search.closest(
                ".ds-search"
            );

        if (searchWrap) {

            toolbar.insertBefore(
                filter,
                searchWrap
            );

        } else {

            toolbar.insertBefore(
                filter,
                search
            );
        }
    }

    const searchWrap =
        search.closest(
            ".ds-search"
        );

    if (filter) {
        filter.style.gridColumn = "1";
        filter.style.gridRow = "1";
    }

    if (searchWrap) {
        searchWrap.style.gridColumn = "2";
        searchWrap.style.gridRow = "1";
        searchWrap.style.alignSelf = "end";
        searchWrap.style.width = "100%";
        searchWrap.style.boxSizing = "border-box";
    }

    const count =
        document.getElementById(
            "dsCount"
        );

    if (count) {
        count.style.gridColumn = "3";
        count.style.gridRow = "1";
        count.style.alignSelf = "center";
        count.style.whiteSpace = "nowrap";
    }

    const dateInput =
        document.getElementById(
            "dsDateFilter"
        );

    if (dateInput) {

        dateInput.value =
            dsSelectedDate ||
            dsYesterdayISO();
    }
}


/* ==========================================
   STORE SELECT
========================================== */

function dsPopulateStoreSelect() {

    const select =
        document.getElementById(
            "dsStoreNo"
        );

    if (!select) {
        return;
    }

    select.innerHTML =
        '<option value="">Select Store No</option>';

    dsStores.forEach(
        function (store) {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                store.storeNo;

            option.textContent =
                `${store.storeNo} - ${store.storeName}`;

            select.appendChild(option);
        }
    );
}


/* ==========================================
   STORE CHANGED
========================================== */

function dsStoreChanged() {

    const storeNo =
        document.getElementById(
            "dsStoreNo"
        )?.value || "";

    const store =
        dsStores.find(
            function (item) {
                return String(
                    item.storeNo
                ) === String(storeNo);
            }
        );

    [
        "dsStoreName",
        "dsOperatingHour",
        "dsOpeningDate",
        "dsBudgetSales",
        "dsPersonInCharge"
    ].forEach(
        function (id) {
            dsSet(id, "");
        }
    );

    if (!store) {
        return;
    }

    dsSet(
        "dsStoreName",
        store.storeName
    );

    dsSet(
        "dsOperatingHour",
        store.operatingHour
    );

    dsSet(
        "dsOpeningDate",
        store.openingDate
    );

    dsSet(
        "dsBudgetSales",
        dsMoney(store.budgetSales)
    );

    dsSet(
        "dsPersonInCharge",
        store.personInCharge
    );

    dsCalculate();
}


/* ==========================================
   FIELD HELPERS
========================================== */

function dsSet(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.value =
            value ?? "";
    }
}


function dsGet(id) {

    return (
        document.getElementById(id)
            ?.value
            ?.trim() || ""
    );
}


/* ==========================================
   FORM LABEL
========================================== */

function dsSetFormLabels() {

    const fields =
        document.querySelectorAll(
            "#dailySalesFormWrapper label"
        );

    fields.forEach(
        function(label) {

            const text =
                String(
                    label.textContent || ""
                )
                    .trim()
                    .toLowerCase();

            if (
                text === "percentage" ||
                text === "percentage:"
            ) {
                label.textContent =
                    "Food Service %";
            }
        }
    );
}


/* ==========================================
   ADD FORM
========================================== */


function dsOpenAdd() {

    dsSetFormLabels();

    if (!dsHasAccess()) {
        return;
    }

    dsEditId = "";

    dsResetFields();

    document.getElementById(
        "dsFormTitle"
    ).textContent =
        "Add Daily Sales";

    dsSet(
        "dsDailySalesNo",
        "Auto Generate"
    );

    dsSet(
        "dsTransactionSize",
        "0.00"
    );

    dsSet(
        "dsPercentage",
        "0.00%"
    );

    const saveButton =
        document.getElementById(
            "dsSaveButton"
        );

    if (saveButton) {
        saveButton.textContent = "Save";
    }

    dsToggleForm(true);
}


/* ==========================================
   EDIT FORM
========================================== */

function dsOpenEdit(id) {

    dsSetFormLabels();

    if (!dsHasAccess()) {
        return;
    }

    const row =
        dsRows.find(
            function (item) {
                return String(
                    item.dsId
                ) === String(id);
            }
        );

    if (!row) {

        dsShowError(
            "Daily Sales record not found."
        );

        return;
    }

    dsEditId =
        row.dsId;

    document.getElementById(
        "dsFormTitle"
    ).textContent =
        "Edit Daily Sales";

    dsSet(
        "dsDailySalesNo",
        row.dailySalesNo
    );

    dsSet(
        "dsStoreNo",
        row.storeNo
    );

    dsStoreChanged();

    dsSet(
        "dsBusinessDate",
        dsToInputDate(
            row.businessDate
        )
    );

    dsSet(
        "dsTotalSales",
        row.totalSales
    );

    dsSet(
        "dsTotalMerchandiseSales",
        row.totalMerchandiseSales
    );

    dsSet(
        "dsServices",
        row.services
    );

    dsSet(
        "dsFood",
        row.food
    );

    dsSet(
        "dsBeverage",
        row.beverage
    );

    dsSet(
        "dsGeneralMerchandise",
        row.generalMerchandise
    );

    dsSet(
        "dsTobacco",
        row.tobacco
    );

    dsSet(
        "dsSupply",
        row.supply
    );

    dsSet(
        "dsFoodService",
        row.foodService
    );

    dsSet(
        "dsAlcoholic",
        row.alcoholic
    );

    dsSet(
        "dsTotalCustomer",
        row.totalCustomer
    );

    dsCalculate();

    const saveButton =
        document.getElementById(
            "dsSaveButton"
        );

    if (saveButton) {
        saveButton.textContent = "Save";
    }

    dsToggleForm(true);
}


/* ==========================================
   RESET FORM
========================================== */

function dsResetFields() {

    [
        "dsDailySalesNo",
        "dsStoreNo",
        "dsBusinessDate",
        "dsStoreName",
        "dsOperatingHour",
        "dsOpeningDate",
        "dsBudgetSales",
        "dsPersonInCharge",
        "dsTotalSales",
        "dsTotalMerchandiseSales",
        "dsServices",
        "dsFood",
        "dsBeverage",
        "dsGeneralMerchandise",
        "dsTobacco",
        "dsSupply",
        "dsFoodService",
        "dsAlcoholic",
        "dsTotalCustomer",
        "dsTransactionSize",
        "dsPercentage"
    ].forEach(
        function (id) {
            dsSet(id, "");
        }
    );

    dsSet(
        "dsDailySalesNo",
        "Auto Generate"
    );

    dsSet(
        "dsTransactionSize",
        "0.00"
    );

    dsSet(
        "dsPercentage",
        "0.00%"
    );
}


/* ==========================================
   CLOSE FORM
========================================== */

function dsCloseForm() {

    dsToggleForm(false);

    dsEditId = "";
}


function dsToggleForm(show) {

    const wrapper =
        document.getElementById(
            "dailySalesFormWrapper"
        );

    if (!wrapper) {
        return;
    }

    wrapper.style.display =
        show ? "block" : "none";

    if (show) {

        wrapper.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}


/* ==========================================
   SAVE DAILY SALES
========================================== */

async function dsSave() {

    if (!dsHasAccess()) {
        return;
    }

    const storeNo =
        dsGet("dsStoreNo");

    const businessDate =
        dsGet("dsBusinessDate");

    if (!storeNo) {

        dsShowError(
            "Please select Store No."
        );

        return;
    }

    if (!businessDate) {

        dsShowError(
            "Please select Business Date."
        );

        return;
    }

    const user =
        dsGetCurrentUser() || {};

    const data = {

        mode:
            dsEditId
                ? "edit"
                : "add",

        dsId:
            dsEditId,

        dailySalesNo:
            dsGet("dsDailySalesNo") ===
            "Auto Generate"
                ? ""
                : dsGet(
                    "dsDailySalesNo"
                ),

        storeNo:
            storeNo,

        businessDate:
            businessDate,

        totalSales:
            dsNum("dsTotalSales"),

        totalMerchandiseSales:
            dsNum(
                "dsTotalMerchandiseSales"
            ),

        services:
            dsNum("dsServices"),

        food:
            dsNum("dsFood"),

        beverage:
            dsNum("dsBeverage"),

        generalMerchandise:
            dsNum(
                "dsGeneralMerchandise"
            ),

        tobacco:
            dsNum("dsTobacco"),

        supply:
            dsNum("dsSupply"),

        foodService:
            dsNum("dsFoodService"),

        alcoholic:
            dsNum("dsAlcoholic"),

        totalCustomer:
            dsNum("dsTotalCustomer")
    };

    const button =
        document.getElementById(
            "dsSaveButton"
        );

    if (button) {

        button.disabled = true;

        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {

        const response =
            await callDailySalesAPI(
                "saveDailySales",
                {
                    username:
                        user.username || "",

                    role:
                        user.role || "",

                    data:
                        data
                }
            );

        if (!response?.status) {

            dsShowError(
                response?.message ||
                "Unable to save Daily Sales."
            );

            return;
        }

        // Capture the saved values before closing the form.
        const savedReport = dsBuildShareReport();

        await dsShowSaveSuccessDialog(savedReport);

        dsCloseForm();

        await dsLoad(
            dsSelectedDate
        );

    } catch (error) {

        console.error(error);

        dsShowError(
            "Unable to connect to the Daily Sales server."
        );

    } finally {

        if (button) {

            button.disabled = false;

            button.textContent = "Save";
        }
    }
}


/* ==========================================
   SAVE SUCCESS + SHARE REPORT
   LOCKED DAILY SALES CORE
========================================== */

function dsFormatAmount(value) {

    const n = Number(value);

    return Number.isFinite(n)
        ? n.toLocaleString("en-MY", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
        : "0.00";
}

function dsBuildShareReport() {

    const storeNo = dsGet("dsStoreNo");
    const storeName = dsGet("dsStoreName");
    const operatingHour = dsGet("dsOperatingHour");
    const openingDate = dsGet("dsOpeningDate");
    const businessDate = dsGet("dsBusinessDate");
    const totalSales = dsNum("dsTotalSales");
    const budgetSales = dsNum("dsBudgetSales");
    const merchandise = dsNum("dsTotalMerchandiseSales");
    const services = dsNum("dsServices");
    const food = dsNum("dsFood");
    const beverage = dsNum("dsBeverage");
    const generalMerchandise = dsNum("dsGeneralMerchandise");
    const tobacco = dsNum("dsTobacco");
    const supply = dsNum("dsSupply");
    const foodService = dsNum("dsFoodService");
    const alcoholic = dsNum("dsAlcoholic");
    const customer = dsNum("dsTotalCustomer");
    const transactionSize = dsNum("dsTransactionSize");
    const percentage = dsNum("dsPercentage");

    const displayStore = storeNo
        ? `#${String(storeNo).replace(/^#/, "")} ${storeName}`.trim()
        : storeName;

    return [
        `Store No : *${displayStore}*`,
        `Operating Hour : *${operatingHour}*`,
        `Reopening Date : *${openingDate}*`,
        "",
        `Business Date : *${businessDate}*`,
        `Total Sales : *RM${dsFormatAmount(totalSales)}*`,
        `Budget Sales : *RM${dsFormatAmount(budgetSales)}*`,
        `Total Merchandise Sales : *RM${dsFormatAmount(merchandise)}*`,
        "",
        "Breakdown by PSA :",
        `Services : ${dsFormatAmount(services)}`,
        `Food : ${dsFormatAmount(food)}`,
        `Beverages : ${dsFormatAmount(beverage)}`,
        `General Merchandise : ${dsFormatAmount(generalMerchandise)}`,
        `Tobacco/Alcoholic : ${dsFormatAmount(tobacco)}`,
        `Supply : ${dsFormatAmount(supply)}`,
        `Food Service : ${dsFormatAmount(foodService)} *(${percentage.toFixed(2)}%)*`,
        `Alcoholic : ${dsFormatAmount(alcoholic)}`,
        "",
        `Total Customer : ${customer.toLocaleString("en-MY")}`,
        `Transaction Size : ${transactionSize.toFixed(2)}`
    ].join("\\n");
}

async function dsShareReport(report) {

    try {
        if (navigator.share) {
            await navigator.share({
                title: "Daily Sales Report",
                text: report
            });
            return;
        }
    } catch (error) {
        if (error && error.name === "AbortError") return;
        console.warn("Native share unavailable:", error);
    }

    const whatsappUrl =
        "https://wa.me/?text=" + encodeURIComponent(report);

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
}

async function dsShowSaveSuccessDialog(report) {

    if (typeof Swal !== "undefined") {

        const result = await Swal.fire({
            icon: "success",
            title: "Save Successfully",
            text: "Daily Sales has been saved successfully.",
            showCancelButton: true,
            confirmButtonText: "OK",
            cancelButtonText: "Share Report",
            reverseButtons: true,
            allowOutsideClick: false
        });

        if (result.dismiss === Swal.DismissReason.cancel) {
            await dsShareReport(report);
        }

        return;
    }

    const share = window.confirm(
        "Save Successfully\\n\\nPress OK to continue, or Cancel to Share Report."
    );

    if (!share) {
        await dsShareReport(report);
    }
}

/* ==========================================
   CALCULATIONS
========================================== */

function dsCalculate() {

    const totalMerchandiseSales =
        dsNum(
            "dsTotalMerchandiseSales"
        );

    const customers =
        dsNum(
            "dsTotalCustomer"
        );

    const foodService =
        dsNum(
            "dsFoodService"
        );

    /*
     * Transaction Size =
     * Total Merchandise Sales / Total Customer
     */
    const transactionSize =
        customers > 0
            ? totalMerchandiseSales /
              customers
            : 0;

    /*
     * Percentage =
     * Food Service / Total Merchandise Sales * 100
     */
    const percentage =
        totalMerchandiseSales > 0
            ? (
                foodService /
                totalMerchandiseSales
            ) * 100
            : 0;

    dsSet(
        "dsTransactionSize",
        transactionSize.toFixed(2)
    );

    dsSet(
        "dsPercentage",
        percentage.toFixed(2) + "%"
    );
}


function dsNum(id) {

    const number =
        Number(
            dsGet(id)
                .replace(/,/g, "")
                .replace(/[^\d.-]/g, "")
        );

    return Number.isFinite(number)
        ? number
        : 0;
}


function dsMoney(value) {

    const number =
        Number(
            String(value || "")
                .replace(/,/g, "")
                .replace(/[^\d.-]/g, "")
        );

    if (!Number.isFinite(number)) {
        return "";
    }

    return number.toLocaleString(
        "en-MY",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );
}


/* ==========================================
   DATE
========================================== */

function dsToInputDate(value) {

    const match =
        String(value || "").match(
            /^(\d{2})\/(\d{2})\/(\d{4})$/
        );

    return match
        ? `${match[3]}-${match[2]}-${match[1]}`
        : String(value || "");
}


/* ==========================================
   TABLE
========================================== */

function dsEnsurePercentageHeader() {

    const body =
        document.getElementById(
            "dsTableBody"
        );

    if (!body) {
        return;
    }

    const table =
        body.closest(
            "table"
        );

    if (!table) {
        return;
    }

    const headerRow =
        table.querySelector(
            "thead tr"
        );

    if (!headerRow) {
        return;
    }

    const headers =
        Array.from(
            headerRow.querySelectorAll(
                "th"
            )
        );

    const exists =
        headers.some(
            function(th) {

                return String(
                    th.textContent || ""
                )
                    .trim()
                    .toLowerCase() ===
                    "percentage";
            }
        );

    if (exists) {
        return;
    }

    /*
     * Insert Percentage immediately before Action.
     */
    const actionHeader =
        headers.find(
            function(th) {

                return String(
                    th.textContent || ""
                )
                    .trim()
                    .toLowerCase() ===
                    "action";
            }
        );

    const th =
        document.createElement(
            "th"
        );

    th.textContent =
        "Percentage";

    if (actionHeader) {

        headerRow.insertBefore(
            th,
            actionHeader
        );

    } else {

        headerRow.appendChild(th);
    }
}


function dsEnsureTableHeaders() {

    const body =
        document.getElementById(
            "dsTableBody"
        );

    if (!body) {
        return;
    }

    const table =
        body.closest(
            "table"
        );

    if (!table) {
        return;
    }

    const headerRow =
        table.querySelector(
            "thead tr"
        );

    if (!headerRow) {
        return;
    }

    const headers =
        Array.from(
            headerRow.querySelectorAll(
                "th"
            )
        );

    function headerText(th) {
        return String(
            th.textContent || ""
        )
            .trim()
            .toLowerCase();
    }

    let current =
        Array.from(
            headerRow.querySelectorAll("th")
        );

    const businessDateHeader =
        current.find(
            function(th) {
                return headerText(th) === "business date";
            }
        );

    /*
     * Add Month and Year immediately after
     * Business Date if the original HTML does
     * not already contain them.
     */
    if (
        businessDateHeader &&
        !current.some(
            function(th) {
                return headerText(th) === "month";
            }
        )
    ) {

        const th =
            document.createElement("th");

        th.textContent =
            "Month";

        businessDateHeader.after(th);
    }

    current =
        Array.from(
            headerRow.querySelectorAll("th")
        );

    const monthHeader =
        current.find(
            function(th) {
                return headerText(th) === "month";
            }
        );

    if (
        monthHeader &&
        !current.some(
            function(th) {
                return headerText(th) === "year";
            }
        )
    ) {

        const th =
            document.createElement("th");

        th.textContent =
            "Year";

        monthHeader.after(th);
    }

    /*
     * Percentage must be immediately before Action.
     */
    current =
        Array.from(
            headerRow.querySelectorAll("th")
        );

    if (
        !current.some(
            function(th) {
                return headerText(th) === "percentage";
            }
        )
    ) {

        const actionHeader =
            current.find(
                function(th) {
                    return headerText(th) === "action";
                }
            );

        const th =
            document.createElement("th");

        th.textContent =
            "Percentage";

        if (actionHeader) {
            headerRow.insertBefore(
                th,
                actionHeader
            );
        } else {
            headerRow.appendChild(th);
        }
    }

}


/* ==========================================
   TABLE
========================================== */

function dsRenderTable() {

    const body =
        document.getElementById(
            "dsTableBody"
        );

    const count =
        document.getElementById(
            "dsCount"
        );

    if (!body) {
        return;
    }

    const table =
        body.closest("table");

    const headerRow =
        table?.querySelector("thead tr");

    if (headerRow) {

        headerRow.innerHTML = `
            <th>Store No</th>
            <th>Store Name</th>
            <th>Business Date</th>
            <th class="ds-number">Merchandise Sales</th>
            <th class="ds-number">Customer</th>
            <th class="ds-number">Percentage</th>
            <th>Action</th>
        `;
    }

    const query =
        dsGet("dsSearch")
            .toLowerCase();

    const rows =
        dsRows.filter(
            function (row) {

                return [
                    row.dsId,
                    row.dailySalesNo,
                    row.storeNo,
                    row.storeName,
                    row.businessDate,
                    row.personInCharge
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(query);
            }
        );

    if (count) {

        count.textContent =
            `${rows.length} Record${
                rows.length === 1
                    ? ""
                    : "s"
            }`;
    }

    if (!rows.length) {

        body.innerHTML =
            '<tr><td colspan="7" class="ds-empty">No Daily Sales records found for the selected date.</td></tr>';

        return;
    }

    body.innerHTML =
        rows.map(
            function (row) {

                const merchandiseSales =
                    Number(
                        String(
                            row.totalMerchandiseSales ??
                            ""
                        )
                            .replace(/,/g, "")
                    ) || 0;

                const budgetSales =
                    Number(
                        String(
                            row.budgetSales ??
                            ""
                        )
                            .replace(/,/g, "")
                    ) || 0;

                /*
                 * LIST Percentage =
                 * Merchandise Sales / Budget Sales * 100
                 */
                const percentage =
                    budgetSales > 0
                        ? (
                            merchandiseSales /
                            budgetSales
                        ) * 100
                        : 0;

                return `
                    <tr>
                        <td>
                            ${dsEsc(
                                row.storeNo
                            )}
                        </td>

                        <td>
                            ${dsEsc(
                                row.storeName
                            )}
                        </td>

                        <td>
                            ${dsEsc(
                                row.businessDate
                            )}
                        </td>

                        <td class="ds-number">
                            ${dsMoney(
                                merchandiseSales
                            )}
                        </td>

                        <td class="ds-number">
                            ${dsEsc(
                                row.totalCustomer
                            )}
                        </td>

                        <td class="ds-number">
                            ${percentage.toFixed(2)}%
                        </td>

                        <td>
                            <button
                                class="ds-edit-btn"
                                type="button"
                                onclick="dsOpenEdit('${dsAttr(row.dsId)}')"
                            >
                                <i class="fa-solid fa-pen"></i>
                                Edit
                            </button>
                        </td>
                    </tr>
                `;
            }
        ).join("");
}

/* ==========================================
   ESCAPE HTML
========================================== */

function dsEsc(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function dsAttr(value) {

    return String(value ?? "")
        .replace(/'/g, "\\'");
}


/* ==========================================
   ALERT
========================================== */

function dsShowSuccess(message) {

    if (
        typeof showSuccess === "function"
    ) {
        return showSuccess(message);
    }

    if (
        typeof Swal !== "undefined"
    ) {

        return Swal.fire({

            icon: "success",

            title: "SUCCESS",

            text: message,

            confirmButtonColor:
                "#198754"
        });
    }

    alert(message);
}


function dsShowError(message) {

    if (
        typeof showError === "function"
    ) {
        return showError(message);
    }

    if (
        typeof Swal !== "undefined"
    ) {

        return Swal.fire({

            icon: "error",

            title: "VALIDATION",

            text: message,

            confirmButtonColor:
                "#dc3545"
        });
    }

    alert(message);
}


/* ==========================================
   EVENTS
========================================== */

document.addEventListener(
    "input",
    function (event) {

        if (
            event.target?.id ===
            "dsSearch"
        ) {
            dsRenderTable();
        }

        if (
            [
                "dsTotalSales",
                "dsTotalMerchandiseSales",
                "dsFoodService",
                "dsTotalCustomer"
            ].includes(
                event.target?.id
            )
        ) {
            dsCalculate();
        }
    }
);


document.addEventListener(
    "change",
    function (event) {

        if (
            event.target?.id ===
            "dsStoreNo"
        ) {
            dsStoreChanged();
        }
    }
);


/* ==========================================
   UI COMPATIBILITY ALIASES
========================================== */

function onDailySalesStoreChange() {

    if (
        typeof dsStoreChanged ===
        "function"
    ) {
        dsStoreChanged();
    }
}


function openDailySalesForm() {

    if (
        typeof dsOpenAdd ===
        "function"
    ) {
        dsOpenAdd();

    } else if (
        typeof dsToggleForm ===
        "function"
    ) {
        dsToggleForm(true);
    }
}


function closeDailySalesForm() {

    if (
        typeof dsCloseForm ===
        "function"
    ) {
        dsCloseForm();
    }
}


function saveDailySales() {

    if (
        typeof dsSave ===
        "function"
    ) {
        return dsSave();
    }
}


function filterDailySalesTable() {

    if (
        typeof dsRenderTable ===
        "function"
    ) {
        dsRenderTable();
    }
}


function editDailySales(id) {

    if (
        typeof dsOpenEdit ===
        "function"
    ) {
        dsOpenEdit(id);
    }
}


function calculateDailySales() {

    if (
        typeof dsCalculate ===
        "function"
    ) {
        dsCalculate();
    }
}


/* ==========================================
   INITIAL FORM LABEL COMPATIBILITY
========================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {
        dsSetFormLabels();
    }
);
