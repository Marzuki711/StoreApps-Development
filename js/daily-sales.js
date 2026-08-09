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

        const formData = new FormData();

        formData.append(
            "payload",
            JSON.stringify({
                action: action,
                data: data
            })
        );

        const response = await fetch(
            url,
            {
                method: "POST",
                body: formData,
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
            message: err.message
        };
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

async function dsLoad() {

    const user =
        dsGetCurrentUser() || {};

    const username =
        user.username || "";

    const [
        storeResponse,
        listResponse
    ] = await Promise.all([

        callDailySalesAPI(
            "getDailySalesStores",
            {
                username: username,
                role: user.role || ""
            }
        ),

        callDailySalesAPI(
            "getDailySalesList",
            {
                username: username,
                role: user.role || ""
            }
        )

    ]);

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
        storeResponse.stores || [];

    dsRows =
        listResponse.rows || [];

    dsPopulateStoreSelect();
    dsRenderTable();
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
   ADD FORM
========================================== */

function dsOpenAdd() {

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

    dsToggleForm(true);
}


/* ==========================================
   EDIT FORM
========================================== */

function dsOpenEdit(id) {

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

        dsShowSuccess(
            response.message ||
            "Daily Sales saved successfully."
        );

        dsCloseForm();

        await dsLoad();

    } catch (error) {

        console.error(error);

        dsShowError(
            "Unable to connect to the Daily Sales server."
        );

    } finally {

        if (button) {

            button.disabled = false;

            button.innerHTML =
                '<i class="fa-solid fa-floppy-disk"></i> Save Daily Sales';
        }
    }
}


/* ==========================================
   CALCULATIONS
========================================== */

function dsCalculate() {

    const sales =
        dsNum("dsTotalSales");

    const customers =
        dsNum("dsTotalCustomer");

    const budget =
        dsNum("dsBudgetSales");

    const transactionSize =
        customers > 0
            ? sales / customers
            : 0;

    const percentage =
        budget > 0
            ? sales / budget * 100
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
            '<tr><td colspan="9" class="ds-empty">No Daily Sales records found.</td></tr>';

        return;
    }

    body.innerHTML =
        rows.map(
            function (row) {

                return `
                    <tr>
                        <td>
                            ${dsEsc(
                                row.dailySalesNo
                            )}
                        </td>

                        <td>
                            ${dsEsc(
                                row.businessDate
                            )}
                        </td>

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

                        <td class="ds-number">
                            ${dsMoney(
                                row.totalSales
                            )}
                        </td>

                        <td class="ds-number">
                            ${dsMoney(
                                row.budgetSales
                            )}
                        </td>

                        <td class="ds-number">
                            ${dsEsc(
                                row.totalCustomer
                            )}
                        </td>

                        <td class="ds-number">
                            ${dsEsc(
                                row.transactionSize
                            )}
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
