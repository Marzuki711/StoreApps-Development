/*************************************************
 * Manual OT Claim System
 * script.js
 * GitHub Version
 *************************************************/

/* ==========================================
   SEARCH EMPLOYEE V3 STABLE
========================================== */

async function searchEmployee(employeeId){

    console.log("SEARCH :", employeeId);

    const btn =
        event?.currentTarget ||
        document.activeElement;

    if(btn){
        btn.disabled = true;
        btn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    showLoading();

   hideLoading();
   restoreSearchButton(btn);

    // ==========================
    // EMPLOYEE TYPE
    // ==========================

    const employeeType =
        document.getElementById("employeeType").value;

    // ==========================
    // BUTTON LOADING
    // ==========================

    if(btn){

        btn.disabled = true;

        btn.classList.add("loading");

        btn.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
        `;

    }

    // ==========================
    // EMPTY EMPLOYEE ID
    // ==========================

    if(employeeId===""){

        restoreSearchButton(btn);

        showError("Please enter Employee ID.");

        return;

    }

    // ==========================
    // API
    // ==========================

    let result;

    try{

        result = await callAPI("searchEmployee",{

            employeeId:employeeId

        });

    }catch(err){

        restoreSearchButton(btn);

        console.error(err);

        showError("Unable to connect to server.");

        return;

    }

    console.log(result);

    if(!result){

        restoreSearchButton(btn);

        showError("No response from server.");

        return;

    }

    // ==========================
    // NOT FOUND
    // ==========================

    if(!result.status){

        clearEmployeeInfo(employeeType);

        restoreSearchButton(btn);

        showError(result.message);

        return;

    }

    // ==========================
    // FULL TIMER
    // ==========================

    if(employeeType==="Full Timer"){

        document.getElementById("ft_unit").value = result.unit;

        document.getElementById("ft_employeeName").value = result.employeeName;

        document.getElementById("ft_position").value = result.position;

        calculateFullTimer();

        document.getElementById("ft_actualDate").focus();

    }

    // ==========================
    // PART TIMER
    // ==========================

    else if(employeeType==="Part Timer"){

        document.getElementById("pt_unit").value = result.unit;

        document.getElementById("pt_employeeName").value = result.employeeName;

        document.getElementById("pt_actualDate").focus();

    }

    // ==========================
    // FOREIGN WORKER
    // ==========================

    else{

        document.getElementById("fw_unit").value = result.unit;

        document.getElementById("fw_employeeName").value = result.employeeName;

        document.getElementById("fw_position").value = result.position;

        document.getElementById("fw_om").value = result.om;

        document.getElementById("fw_fm").value = result.fm;

        calculateForeignWorker();

        document.getElementById("fw_actualDate").focus();

    }

    // ==========================
    // SUCCESS ICON
    // ==========================

    if(btn){

        btn.innerHTML = `
            <i class="fa-solid fa-check"></i>
        `;

        btn.style.color="#16A34A";

    }

    setTimeout(()=>{

        restoreSearchButton(btn);

    },800);

}
