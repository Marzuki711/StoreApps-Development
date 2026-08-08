/*************************************************
 * Manual OT Claim System
 * employee.js
 *************************************************/

/* ==========================================
   REGISTER EMPLOYEE EVENTS
========================================== */

function registerEmployeeEvents() {

    // ==========================
    // FULL TIMER
    // ==========================

    const btnSearchFT = document.getElementById("btnSearchFT");
    const txtEmployeeFT = document.getElementById("ft_employeeId");

    if (btnSearchFT) {

        btnSearchFT.addEventListener("click", () => {

            if (typeof searchEmployee === "function") {

                searchEmployee(
                    txtEmployeeFT.value.trim()
                );

            }

        });

    }

    if (txtEmployeeFT) {

        txtEmployeeFT.addEventListener("keydown", (e) => {

            if (e.key === "Enter") {

                e.preventDefault();

                btnSearchFT?.click();

            }

        });

    }

    // ==========================
    // PART TIMER
    // ==========================

    const btnSearchPT = document.getElementById("btnSearchPT");
    const txtEmployeePT = document.getElementById("pt_employeeId");

    if (btnSearchPT) {

        btnSearchPT.addEventListener("click", () => {

            if (typeof searchEmployee === "function") {

                searchEmployee(
                    txtEmployeePT.value.trim()
                );

            }

        });

    }

    if (txtEmployeePT) {

        txtEmployeePT.addEventListener("keydown", (e) => {

            if (e.key === "Enter") {

                e.preventDefault();

                btnSearchPT?.click();

            }

        });

    }

    // ==========================
    // FOREIGN WORKER
    // ==========================

    const btnSearchFW = document.getElementById("btnSearchFW");
    const txtEmployeeFW = document.getElementById("fw_employeeId");

    if (btnSearchFW) {

        btnSearchFW.addEventListener("click", () => {

            if (typeof searchEmployee === "function") {

                searchEmployee(
                    txtEmployeeFW.value.trim()
                );

            }

        });

    }

    if (txtEmployeeFW) {

        txtEmployeeFW.addEventListener("keydown", (e) => {

            if (e.key === "Enter") {

                e.preventDefault();

                btnSearchFW?.click();

            }

        });

    }

}
