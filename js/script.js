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

/* ==========================================
   RESTORE SEARCH BUTTON
========================================== */

function restoreSearchButton(btn){

    if(!btn){

        return;

    }

    btn.disabled = false;

    btn.classList.remove("loading");

    btn.style.color = "";

    btn.innerHTML = `
        <i class="fa-solid fa-magnifying-glass"></i>
    `;

}

/* ==========================================
   CLEAR EMPLOYEE INFO
========================================== */

function clearEmployeeInfo(employeeType){

    switch(employeeType){

        case "Full Timer":

            document.getElementById("ft_unit").value = "";

            document.getElementById("ft_employeeName").value = "";

            document.getElementById("ft_position").selectedIndex = 0;

            document.getElementById("ft_employeeId").focus();

            break;

        case "Part Timer":

            document.getElementById("pt_unit").value = "";

            document.getElementById("pt_employeeName").value = "";

            document.getElementById("pt_employeeId").focus();

            break;

        case "Foreign Worker":

            document.getElementById("fw_unit").value = "";

            document.getElementById("fw_employeeName").value = "";

            document.getElementById("fw_position").selectedIndex = 0;

            document.getElementById("fw_om").value = "";

            document.getElementById("fw_fm").value = "";

            document.getElementById("fw_employeeId").focus();

            break;

    }

}

/* ==========================================
   SWEET ALERT
========================================== */

function showSuccess(message){

    Swal.fire({

        icon: "success",

        title: "SUCCESS",

        text: message,

        confirmButtonText: "OK",

        confirmButtonColor: "#198754",

        allowOutsideClick: false

    });

}

function showError(message){

    Swal.fire({

        icon: "error",

        title: "VALIDATION",

        text: message,

        confirmButtonText: "OK",

        confirmButtonColor: "#dc3545"

    });

}

function showWarning(message){

    Swal.fire({

        icon: "warning",

        title: "WARNING",

        text: message,

        confirmButtonText: "OK",

        confirmButtonColor: "#ffc107"

    });

}

/* ==========================================
   LOADING
========================================== */

function showLoading() {

    const loading = document.getElementById("loading");

    if (loading) {

        loading.style.display = "flex";

    }

}

function hideLoading() {

    const loading = document.getElementById("loading");

    if (loading) {

        loading.style.display = "none";

    }

}

function checkInternet(){

    if(!navigator.onLine){

        Swal.fire({
            icon:"error",
            title:"No Internet Connection",
            text:"Please check your internet connection and try again.",
            confirmButtonColor:"#C1121F"
        });

        return false;

    }

    return true;

}

/* ==========================================
   LOAD HTML COMPONENT
========================================== */

const componentCache = new Map();

async function loadComponent(file, target) {

    try {

        let html = componentCache.get(file);

        if (!html) {

            const response = await fetch(file);

            if (!response.ok) {
                throw new Error(file + " not found");
            }

            html = await response.text();

            componentCache.set(file, html);

        }

        const container = document.getElementById(target);

        if (container) {
            container.innerHTML = html;
        }

    } catch (err) {

        console.error("Component Error :", err);

    }

}

/* ==========================================
   SHOW / HIDE FORM
========================================== */

function showForm(type) {

    const ft = document.getElementById("fullTimerForm");
    const pt = document.getElementById("partTimerForm");
    const fw = document.getElementById("foreignWorkerForm");

    if (ft) ft.style.display = "none";
    if (pt) pt.style.display = "none";
    if (fw) fw.style.display = "none";

    switch (type) {

        case "Full Timer":

            if (ft) ft.style.display = "block";

            break;

        case "Part Timer":

            if (pt) pt.style.display = "block";

            break;

        case "Foreign Worker":

            if (fw) fw.style.display = "block";

            break;

    }

}

/* ==========================================
   RESET FORM
========================================== */

function resetForm(formId) {

    const form = document.getElementById(formId);

    if (!form) return;

    // Reset Input
    form.querySelectorAll("input").forEach(input => {

        switch (input.type) {

            case "text":
            case "date":
            case "time":
            case "number":
            case "email":
                input.value = "";
                break;

            case "checkbox":
            case "radio":
                input.checked = false;
                break;

        }

        input.classList.remove("input-error");

    });

    // Reset Select
    form.querySelectorAll("select").forEach(select => {

        select.selectedIndex = 0;

        select.classList.remove("input-error");

    });

    // Reset Textarea
    form.querySelectorAll("textarea").forEach(textarea => {

        textarea.value = "";

        textarea.classList.remove("input-error");

    });

}

/* ==========================================
   VALIDATE FORM V2
========================================== */

function validateForm(formId){

    const form = document.getElementById(formId);

    if(!form) return false;

    let valid = true;

    let missingFields = [];

    const requiredFields = form.querySelectorAll("[data-required='true']");

    requiredFields.forEach(field => {

        field.classList.remove("input-error");

        // ===============================
        // SMART VALIDATION REPORT NUMBER
        // ===============================

        if(field.id === "ft_reportNo"){

            const reason = document.getElementById("ft_reason").value;

            if(reason === "Ot Capped") return;

        }

        if(field.id === "pt_reportNo"){

            const reason = document.getElementById("pt_reason").value;

            if(reason === "Ot Capped") return;

        }

        if(field.id === "fw_reportNo"){

            const reason = document.getElementById("fw_reason").value;

            if(reason === "Ot Capped") return;

        }

        const value = (field.value || "").trim();

        if(value === ""){

            valid = false;

            field.classList.add("input-error");

            missingFields.push(field.dataset.label);

        }

    });

    if(!valid){

        Swal.fire({

            icon:"error",

            title:"Validation Failed",

            html: `
            <div style="text-align:left;font-size:15px;line-height:1.8">

                <b>Please complete the following field(s):</b>

                <br><br>

                ${missingFields.map(item => `
                    <div style="
                        padding:8px;
                        margin-bottom:6px;
                        background:#fff5f5;
                        border-left:5px solid #dc3545;
                        border-radius:6px;
                    ">
                        ❌ ${item}
                    </div>
                `).join("")}

            </div>
            `,

            confirmButtonText:"OK",

            confirmButtonColor:"#dc3545",

            allowOutsideClick:false

        });

    }

    return valid;

}

/* ==========================================
   INITIALIZE APPLICATION
========================================== */

document.addEventListener("DOMContentLoaded", async () => {

    // ==========================
    // LOAD COMPONENT
    // ==========================

    await Promise.all([

    loadComponent(
        "components/login.html",
        "loginContainer"
    ),

    loadComponent(
        "components/home.html",
        "homeContainer"
    ),

    loadComponent(
        "components/fulltimer.html",
        "fullTimerContainer"
    ),

    loadComponent(
        "components/parttimer.html",
        "partTimerContainer"
    ),

    loadComponent(
        "components/foreignworker.html",
        "foreignWorkerContainer"
    )

]);

   registerEmployeeEvents();
   initAllPasswordToggle();

   document
   .getElementById("btnLogin")
   ?.addEventListener("click",loginSystem);

   document
   .getElementById("btnHome")
   ?.addEventListener("click",showHome);

   document
   .getElementById("btnLogout")
   ?.addEventListener("click",logout);

   document
   .getElementById("btnAccount")
   ?.addEventListener("click",toggleAccountMenu);

   document
   .getElementById("btnChangePassword")
   ?.addEventListener("click",openChangePassword);

     // ==========================
   // FIRST SCREEN
   // ==========================

   document.getElementById("loginContainer").style.display = "block";
   document.getElementById("homeContainer").style.display = "none";
   document.getElementById("otModule").style.display = "none";
   document.querySelector(".topbar").style.display = "none";

   document.body.style.visibility = "visible";

   
    // ==========================
    // EMPLOYEE TYPE
    // ==========================

    const employeeType = document.getElementById("employeeType");
    employeeType.addEventListener("change", function () {
    showForm(this.value);

    });

    // ==========================
    // NUMBER ONLY
    // ==========================

    numberOnly(document.getElementById("ft_unit"),4);
    numberOnly(document.getElementById("pt_unit"),4);
    numberOnly(document.getElementById("fw_unit"),4);

    numberOnly(document.getElementById("ft_employeeId"),8);
    numberOnly(document.getElementById("pt_employeeId"),8);
    numberOnly(document.getElementById("fw_employeeId"),8);

    // ==========================
    // FORMAT EMPLOYEE ID
    // ==========================

    formatEmployeeID(document.getElementById("ft_employeeId"));
    formatEmployeeID(document.getElementById("pt_employeeId"));
    formatEmployeeID(document.getElementById("fw_employeeId"));

    // ==========================
    // FULL TIMER
    // ==========================

    document.getElementById("ft_position")
        ?.addEventListener("change",calculateFullTimer);

    document.getElementById("ft_firstIn")
        ?.addEventListener("change",calculateFullTimer);

    document.getElementById("ft_lastOut")
        ?.addEventListener("change",calculateFullTimer);

    // ==========================
    // PART TIMER
    // ==========================

    document.getElementById("pt_firstIn")
        ?.addEventListener("change",calculatePartTimer);

    document.getElementById("pt_lastOut")
        ?.addEventListener("change",calculatePartTimer);

    // ==========================
    // FOREIGN WORKER
    // ==========================

    document.getElementById("fw_firstIn")
        ?.addEventListener("change",calculateForeignWorker);

    document.getElementById("fw_lastOut")
        ?.addEventListener("change",calculateForeignWorker);

    // ==========================
    // RESET BUTTON
    // ==========================

    document.getElementById("btnResetFT")
        ?.addEventListener("click",()=>resetForm("fullTimerForm"));

    document.getElementById("btnResetPT")
        ?.addEventListener("click",()=>resetForm("partTimerForm"));

    document.getElementById("btnResetFW")
        ?.addEventListener("click",()=>resetForm("foreignWorkerForm"));

    // ==========================
    // SAVE BUTTON
    // ==========================

    document.getElementById("btnSaveFT")
        ?.addEventListener("click",saveFullTimer);

    document.getElementById("btnSavePT")
        ?.addEventListener("click",savePartTimer);

    document.getElementById("btnSaveFW")
        ?.addEventListener("click",saveForeignWorker);

});

/* ==========================================
   NUMBER ONLY
========================================== */

function numberOnly(input, maxLength){

    if(!input){
        return;
    }

    input.addEventListener("input", function(){

        // Buang semua selain nombor
        this.value = this.value.replace(/\D/g,"");

        // Had maksimum digit
        if(this.value.length > maxLength){

            this.value = this.value.substring(0,maxLength);

        }

    });

}

/* ==========================================
   EMPLOYEE ID FORMAT
========================================== */

function formatEmployeeID(input){

    if(!input){
        return;
    }

    input.addEventListener("blur", function(){

        let value = this.value.replace(/\D/g,"");

        if(value !== ""){

            this.value = value.padStart(8,"0");

        }

    });

}

/* ==========================================
   REGISTER SERVICE WORKER
========================================== */

if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker.register("./sw.js")

            .then(() => {

                console.log("PWA Ready");

            })

            .catch(err => {

                console.log(err);

            });

    });

}

function showHome(){

    const topbar = document.querySelector(".topbar");

    topbar.style.display = "flex";

    if(window.innerWidth <= 768){
        topbar.style.flexDirection = "column";
    }else{
        topbar.style.flexDirection = "row";
    }

    document.getElementById("loginContainer").style.display = "none";
    document.getElementById("homeContainer").style.display = "block";
    document.getElementById("otModule").style.display = "none";
}

function openManualOT(){
     
    document.getElementById("homeContainer").style.display="none";

    document.getElementById("otModule").style.display="block";

    document.getElementById("employeeType").value="Full Timer";

    showForm("Full Timer");

}
