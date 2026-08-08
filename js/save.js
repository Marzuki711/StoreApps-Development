/* ==========================================
   SAVE FULL TIMER
========================================== */

async function saveFullTimer() {

    if (!validateForm("fullTimerForm")) return;

    const data = {

        employeeType: "Full Timer",

        unit: document.getElementById("ft_unit").value.trim(),

        employeeId: document.getElementById("ft_employeeId").value.trim(),

        employeeName: document.getElementById("ft_employeeName").value.trim(),

        position: document.getElementById("ft_position").value,

        actualDate: document.getElementById("ft_actualDate").value,

        firstIn: document.getElementById("ft_firstIn").value,

        lastOut: document.getElementById("ft_lastOut").value,

        workHours: document.getElementById("ft_workHours").value,

        appHours: document.getElementById("ft_appHours").value,

        approvedOT: document.getElementById("ft_approvedOT").value,

        publicHoliday: document.getElementById("ft_publicHoliday").value,

        restDay: document.getElementById("ft_restDay").value,

        nightShift: document.getElementById("ft_nightShift").value,

        reason: document.getElementById("ft_reason").value,

        reportNo: document.getElementById("ft_reportNo").value.trim(),

        reasonOT: document.getElementById("ft_reasonOT").value,

        remark: document.getElementById("ft_remark").value.trim()

    };

    const result = await callAPI("saveData", data);

    if (result && result.status) {

        showSuccess("Data Saved Successfully");

        resetForm("fullTimerForm");

    } else {

        showError(result.message);

    }

}

/* ==========================================
   SAVE PART TIMER
========================================== */

async function savePartTimer() {

    if (!validateForm("partTimerForm")) return;

    const data = {

        employeeType: "Part Timer",

        unit: document.getElementById("pt_unit").value.trim(),

        employeeId: document.getElementById("pt_employeeId").value.trim(),

        employeeName: document.getElementById("pt_employeeName").value.trim(),

        actualDate: document.getElementById("pt_actualDate").value,

        firstIn: document.getElementById("pt_firstIn").value,

        lastOut: document.getElementById("pt_lastOut").value,

        workHours: document.getElementById("pt_workHours").value,

        floorHours: document.getElementById("pt_floorHours").value,

        firstFour: document.getElementById("pt_firstFour").value,

        secondFour: document.getElementById("pt_secondFour").value,

        afterEight: document.getElementById("pt_afterEight").value,

        publicHoliday: document.getElementById("pt_publicHoliday").value,

        restDay: document.getElementById("pt_restDay").value,

        reason: document.getElementById("pt_reason").value,

        reportNo: document.getElementById("pt_reportNo").value.trim(),

        reasonOT: document.getElementById("pt_reasonOT").value,

        remark: document.getElementById("pt_remark").value.trim()

    };

    const result = await callAPI("saveData", data);

    if (result && result.status) {

        showSuccess("Data Saved Successfully");

        resetForm("partTimerForm");

    } else {

        showError(result.message);

    }

}

/* ==========================================
   SAVE FOREIGN WORKER
========================================== */

async function saveForeignWorker() {

    if (!validateForm("foreignWorkerForm")) return;

    const data = {

        employeeType: "Foreign Worker",

        om: document.getElementById("fw_om").value.trim(),

        fm: document.getElementById("fw_fm").value.trim(),

        unit: document.getElementById("fw_unit").value.trim(),

        employeeId: document.getElementById("fw_employeeId").value.trim(),

        employeeName: document.getElementById("fw_employeeName").value.trim(),

        position: document.getElementById("fw_position").value,

        actualDate: document.getElementById("fw_actualDate").value,

        firstIn: document.getElementById("fw_firstIn").value,

        lastOut: document.getElementById("fw_lastOut").value,

        workHours: document.getElementById("fw_workHours").value,

        appHours: document.getElementById("fw_appHours").value,

        approvedOT: document.getElementById("fw_approvedOT").value,

        publicHoliday: document.getElementById("fw_publicHoliday").value,

        restDay: document.getElementById("fw_restDay").value,

        replacementLeave: document.getElementById("fw_replacementLeave").value,

        reason: document.getElementById("fw_reason").value,

        reportNo: document.getElementById("fw_reportNo").value.trim(),

        reasonOT: document.getElementById("fw_reasonOT").value,

        remark: document.getElementById("fw_remark").value.trim()

    };

    const result = await callAPI("saveData", data);

    if (result && result.status) {

    showSuccess(result.message || "Saved Successfully");

    resetForm("foreignWorkerForm");

} else {

    showError(result?.message || "Save Failed");

    }

}

