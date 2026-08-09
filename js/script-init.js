/*************************************************
 * Manual OT Claim System
 * script-init.js
 *
 * APPLICATION INITIALIZATION
 *
 * IMPORTANT:
 * - UI functions live in ui.js
 * - Employee search lives in script-search.js
 * - Calculations live in calculator.js
 * - Save functions live in save.js
 *
 * This file does NOT load or depend on script.js.
 *************************************************/

/* ==========================================
   INITIALIZE APPLICATION
========================================== */

async function initializeApplication(){

    console.log("APP INIT START");

    try{

        /* ==========================
           LOAD ALL COMPONENTS
        ========================== */

        await Promise.all([

            loadComponent("components/login.html","loginContainer"),
            loadComponent("components/home.html","homeContainer"),
            loadComponent("components/fulltimer.html","fullTimerContainer"),
            loadComponent("components/parttimer.html","partTimerContainer"),
            loadComponent("components/foreignworker.html","foreignWorkerContainer"),
            loadComponent("components/user-management","userManagementContainer"),
            loadComponent("components/daily-sales.html","dailySalesContainer")

        ]);

        console.log("COMPONENTS LOADED");

        /* ==========================
           USER MANAGEMENT UI
           Component must be bound AFTER
           it has been loaded into the DOM.
        ========================== */

        if(typeof initUserManagementUI === "function"){
            initUserManagementUI();
        }

        /* Re-apply permissions because User Management
           is a dynamically loaded component. */
        if(typeof applyRoleAccess === "function"){
            applyRoleAccess();
        }

        /* ==========================
           PASSWORD SHOW / HIDE
           PRESERVE ORIGINAL FUNCTION
        ========================== */

        initAllPasswordToggle();

        /* ==========================
           BUTTON EVENTS
        ========================== */

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

        /* ==========================
           SEARCH BUTTONS
        ========================== */

        const searchMap = [
            ["btnSearchFT","ft_employeeId"],
            ["btnSearchPT","pt_employeeId"],
            ["btnSearchFW","fw_employeeId"]
        ];

        searchMap.forEach(([buttonId,inputId])=>{

            const button=document.getElementById(buttonId);
            const input=document.getElementById(inputId);

            if(button && input){

                button.addEventListener("click",()=>{
                    searchEmployee(input.value.trim());
                });

                input.addEventListener("keydown",e=>{

                    if(e.key==="Enter"){
                        e.preventDefault();
                        button.click();
                    }

                });

            }

        });

        /* ==========================
           INITIAL SCREEN
           LOGIN = VISIBLE
        ========================== */

        const loginContainer=document.getElementById("loginContainer");
        const homeContainer=document.getElementById("homeContainer");
        const otModule=document.getElementById("otModule");
        const topbar=document.querySelector(".topbar");

        if(loginContainer){
            loginContainer.style.display="block";
        }

        if(homeContainer){
            homeContainer.style.display="none";
        }

        if(otModule){
            otModule.style.display="none";
        }

        /* User Management must never appear on the login screen. */
        const userManagementContainer =
            document.getElementById("userManagementContainer");

        if(userManagementContainer){
            userManagementContainer.style.display="none";
        }

        const userManagementModule =
            document.getElementById("userManagementModule");

        if(userManagementModule){
            userManagementModule.style.display="none";
        }

        const dailySalesContainer = document.getElementById("dailySalesContainer");
        if(dailySalesContainer){ dailySalesContainer.style.display="none"; }

        if(topbar){
            topbar.style.display="none";
        }

        /* IMPORTANT: release page if index.html hides body */
        document.body.style.visibility="visible";

        /* ==========================
           EMPLOYEE TYPE
        ========================== */

        const employeeType=document.getElementById("employeeType");

        if(employeeType){

            employeeType.addEventListener("change",function(){
                showForm(this.value);
            });

        }

        /* ==========================
           NUMBER ONLY
        ========================== */

        numberOnly(document.getElementById("ft_unit"),4);
        numberOnly(document.getElementById("pt_unit"),4);
        numberOnly(document.getElementById("fw_unit"),4);

        numberOnly(document.getElementById("ft_employeeId"),8);
        numberOnly(document.getElementById("pt_employeeId"),8);
        numberOnly(document.getElementById("fw_employeeId"),8);

        /* ==========================
           EMPLOYEE ID FORMAT
        ========================== */

        formatEmployeeID(document.getElementById("ft_employeeId"));
        formatEmployeeID(document.getElementById("pt_employeeId"));
        formatEmployeeID(document.getElementById("fw_employeeId"));

        /* ==========================
           FULL TIMER
        ========================== */

        document.getElementById("ft_position")
            ?.addEventListener("change",calculateFullTimer);

        document.getElementById("ft_firstIn")
            ?.addEventListener("change",calculateFullTimer);

        document.getElementById("ft_lastOut")
            ?.addEventListener("change",calculateFullTimer);

        /* ==========================
           PART TIMER
        ========================== */

        document.getElementById("pt_firstIn")
            ?.addEventListener("change",calculatePartTimer);

        document.getElementById("pt_lastOut")
            ?.addEventListener("change",calculatePartTimer);

        /* ==========================
           FOREIGN WORKER
        ========================== */

        document.getElementById("fw_firstIn")
            ?.addEventListener("change",calculateForeignWorker);

        document.getElementById("fw_lastOut")
            ?.addEventListener("change",calculateForeignWorker);

        /* ==========================
           RESET BUTTONS
        ========================== */

        document.getElementById("btnResetFT")
            ?.addEventListener("click",()=>resetForm("fullTimerForm"));

        document.getElementById("btnResetPT")
            ?.addEventListener("click",()=>resetForm("partTimerForm"));

        document.getElementById("btnResetFW")
            ?.addEventListener("click",()=>resetForm("foreignWorkerForm"));

        /* ==========================
           SAVE BUTTONS
        ========================== */

        document.getElementById("btnSaveFT")
            ?.addEventListener("click",saveFullTimer);

        document.getElementById("btnSavePT")
            ?.addEventListener("click",savePartTimer);

        document.getElementById("btnSaveFW")
            ?.addEventListener("click",saveForeignWorker);

        console.log("APP INIT COMPLETE");

    }catch(error){

        console.error("APP INIT ERROR:",error);

        /* Never leave a blank page */
        document.body.style.visibility="visible";

        const login=document.getElementById("loginContainer");

        if(login){
            login.style.display="block";
        }

    }

}

/* Run correctly whether script loads before OR after DOMContentLoaded */
if(document.readyState === "loading"){

    document.addEventListener("DOMContentLoaded",initializeApplication,{once:true});

}else{

    initializeApplication();

}

/* ==========================================
   NUMBER ONLY
========================================== */

function numberOnly(input, maxLength){

    if(!input){
        return;
    }

    input.addEventListener("input", function(){

        // Buang semua selain nombor
        this.value =
            this.value.replace(/\D/g,"");

        // Had maksimum digit
        if(this.value.length > maxLength){

            this.value =
                this.value.substring(0,maxLength);

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

        let value =
            this.value.replace(/\D/g,"");

        if(value !== ""){

            this.value =
                value.padStart(8,"0");

        }

    });

}

/* ==========================================
   REGISTER SERVICE WORKER
========================================== */

if("serviceWorker" in navigator){

    window.addEventListener("load", () => {

        navigator.serviceWorker
            .register("./sw.js")

            .then(() => {

                console.log("PWA Ready");

            })

            .catch(err => {

                console.log(err);

            });

    });

}

/* ==========================================
   SHOW HOME
========================================== */

function showHome(){

    const topbar =
        document.querySelector(".topbar");

    if(topbar){

        topbar.style.display = "flex";

        if(window.innerWidth <= 768){

            topbar.style.flexDirection =
                "column";

        }else{

            topbar.style.flexDirection =
                "row";

        }

    }

    const loginContainer =
        document.getElementById("loginContainer");

    const homeContainer =
        document.getElementById("homeContainer");

    const otModule =
        document.getElementById("otModule");

    const userManagementContainer =
        document.getElementById("userManagementContainer");

    if(loginContainer){
        loginContainer.style.display = "none";
    }

    if(homeContainer){
        homeContainer.style.display = "block";
    }

    if(otModule){
        otModule.style.display = "none";
    }

    /* Home must always close User Management. */
    if(userManagementContainer){
        userManagementContainer.style.display = "none";
    }

    const dailySalesContainer = document.getElementById("dailySalesContainer");
    if(dailySalesContainer){ dailySalesContainer.style.display = "none"; }

    /* Home Sales Dashboard loads only for authenticated users. */
    if(typeof getCurrentUser === "function" && getCurrentUser()){
        if(typeof initHomeSalesDashboard === "function"){
            initHomeSalesDashboard();
        }
    }

}

/* ==========================================
   OPEN USER MANAGEMENT
========================================== */

function openUserManagement(){

    if(typeof requirePermission === "function" && !requirePermission("user_management")){
        return;
    }

    const loginContainer = document.getElementById("loginContainer");
    const homeContainer = document.getElementById("homeContainer");
    const otModule = document.getElementById("otModule");
    const userManagementContainer = document.getElementById("userManagementContainer");
    const dailySalesContainer = document.getElementById("dailySalesContainer");

    if(loginContainer) loginContainer.style.display = "none";
    if(homeContainer) homeContainer.style.display = "none";
    if(otModule) otModule.style.display = "none";
    if(userManagementContainer) userManagementContainer.style.display = "block";
    if(dailySalesContainer) dailySalesContainer.style.display = "none";

    const toggle = document.getElementById("saSidebarToggle");
    if(toggle) toggle.checked = false;

    if(typeof umLoadUsers === "function"){
        umLoadUsers();
    }
}

/* ==========================================
   CLOSE USER MANAGEMENT
========================================== */

function closeUserManagement(){

    const userManagementContainer = document.getElementById("userManagementContainer");
    const homeContainer = document.getElementById("homeContainer");
    const otModule = document.getElementById("otModule");
    const dailySalesContainer = document.getElementById("dailySalesContainer");

    if(userManagementContainer) userManagementContainer.style.display = "none";
    if(dailySalesContainer) dailySalesContainer.style.display = "none";
    if(otModule) otModule.style.display = "none";
    if(homeContainer) homeContainer.style.display = "block";

    if(typeof applyRoleAccess === "function") applyRoleAccess();
}

/* ==========================================
   OPEN MANUAL OT
========================================== */

function openManualOT(){

    const homeContainer =
        document.getElementById("homeContainer");

    const otModule =
        document.getElementById("otModule");

    const dailySalesContainer =
        document.getElementById("dailySalesContainer");

    const employeeType =
        document.getElementById("employeeType");

    if(homeContainer){
        homeContainer.style.display = "none";
    }

    if(otModule){
        otModule.style.display = "block";
    }

    if(dailySalesContainer){
        dailySalesContainer.style.display = "none";
    }

    if(employeeType){

        employeeType.value = "Full Timer";

        showForm("Full Timer");

    }

}


function closeDailySales(){
    const dailySalesContainer=document.getElementById("dailySalesContainer");
    const homeContainer=document.getElementById("homeContainer");
    const otModule=document.getElementById("otModule");
    const userManagementContainer=document.getElementById("userManagementContainer");
    if(dailySalesContainer) dailySalesContainer.style.display="none";
    if(otModule) otModule.style.display="none";
    if(userManagementContainer) userManagementContainer.style.display="none";
    if(homeContainer) homeContainer.style.display="block";
    if(typeof applyRoleAccess==="function") applyRoleAccess();
}
