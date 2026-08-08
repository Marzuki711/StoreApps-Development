/*************************************************
 * Manual OT Claim System
 * ui.js
 *
 * UI CORE
 * - SweetAlert
 * - Loading
 * - Internet status
 * - HTML component loader
 * - Form switching/reset/validation
 * - Employee info clearing
 * - Search button state
 *
 * This file does NOT load or depend on script.js.
 *************************************************/

/* ==========================================
   SWEET ALERT
========================================== */

function showSuccess(message){

    if(typeof Swal === "undefined"){
        alert(message || "Saved successfully");
        return;
    }

    Swal.fire({

        icon: "success",
        title: "SUCCESS",
        text: message,
        confirmButtonText: "OK",
        confirmButtonColor: "#198754",
        allowOutsideClick: false,
        didOpen: function(){

            const container =
                document.querySelector(".swal2-container");

            if(container){

                container.style.zIndex = "20000";

            }

        }

    });

}


function showError(message){

    if(typeof Swal === "undefined"){
        alert(message || "Validation error");
        return;
    }

    Swal.fire({

        icon: "error",
        title: "VALIDATION",
        text: message,
        confirmButtonText: "OK",
        confirmButtonColor: "#dc3545",
        allowOutsideClick: false,
        didOpen: function(){

            const container =
                document.querySelector(".swal2-container");

            if(container){

                container.style.zIndex = "20000";

            }

        }

    });

}


function showWarning(message){

    if(typeof Swal === "undefined"){
        alert(message || "Warning");
        return;
    }

    Swal.fire({

        icon: "warning",
        title: "WARNING",
        text: message,
        confirmButtonText: "OK",
        confirmButtonColor: "#ffc107",
        allowOutsideClick: false,
        didOpen: function(){

            const container =
                document.querySelector(".swal2-container");

            if(container){

                container.style.zIndex = "20000";

            }

        }

    });

}

/* ==========================================
   LOADING
========================================== */

function showLoading(){

    const loading=document.getElementById("loading");

    if(loading){
        loading.style.display="flex";
    }

}

function hideLoading(){

    const loading=document.getElementById("loading");

    if(loading){
        loading.style.display="none";
    }

}

/* ==========================================
   INTERNET CHECK
========================================== */

function checkInternet(){

    if(!navigator.onLine){

        if(typeof Swal !== "undefined"){

            Swal.fire({
                icon:"error",
                title:"No Internet Connection",
                text:"Please check your internet connection and try again.",
                confirmButtonColor:"#C1121F"
            });

        }else{

            alert("No Internet Connection");

        }

        return false;
    }

    return true;
}

/* ==========================================
   HTML COMPONENT LOADER
========================================== */

const componentCache = new Map();

async function loadComponent(file,target){

    try{

        let html=componentCache.get(file);

        if(!html){

            const response=await fetch(file);

            if(!response.ok){
                throw new Error(file+" not found");
            }

            html=await response.text();

            componentCache.set(file,html);
        }

        const container=document.getElementById(target);

        if(container){
            container.innerHTML=html;
        }

    }catch(err){

        console.error("Component Error :",err);

    }

}

/* ==========================================
   SHOW / HIDE FORM
========================================== */

function showForm(type){

    const ft=document.getElementById("fullTimerForm");
    const pt=document.getElementById("partTimerForm");
    const fw=document.getElementById("foreignWorkerForm");

    if(ft) ft.style.display="none";
    if(pt) pt.style.display="none";
    if(fw) fw.style.display="none";

    switch(type){

        case "Full Timer":

            if(ft) ft.style.display="block";

            break;

        case "Part Timer":

            if(pt) pt.style.display="block";

            break;

        case "Foreign Worker":

            if(fw) fw.style.display="block";

            break;

    }

}

/* ==========================================
   SAFE DOM HELPERS
========================================== */

function setValue(id,value){

    const el=document.getElementById(id);

    if(el){
        el.value=value;
    }

}

function setSelectFirst(id){

    const el=document.getElementById(id);

    if(el){
        el.selectedIndex=0;
    }

}

function focusElement(id){

    const el=document.getElementById(id);

    if(el){
        el.focus();
    }

}

/* ==========================================
   CLEAR EMPLOYEE INFO
========================================== */

function clearEmployeeInfo(employeeType){

    switch(employeeType){

        case "Full Timer":

            setValue("ft_unit","");
            setValue("ft_employeeName","");
            setSelectFirst("ft_position");
            focusElement("ft_employeeId");

            break;

        case "Part Timer":

            setValue("pt_unit","");
            setValue("pt_employeeName","");
            focusElement("pt_employeeId");

            break;

        case "Foreign Worker":

            setValue("fw_unit","");
            setValue("fw_employeeName","");
            setSelectFirst("fw_position");
            setValue("fw_om","");
            setValue("fw_fm","");
            focusElement("fw_employeeId");

            break;

    }

}

/* ==========================================
   RESTORE SEARCH BUTTON
========================================== */

function restoreSearchButton(btn){

    if(!btn){
        return;
    }

    btn.disabled=false;
    btn.classList.remove("loading");
    btn.style.color="";

    btn.innerHTML=`
        <i class="fa-solid fa-magnifying-glass"></i>
    `;

}

/* ==========================================
   RESET FORM
========================================== */

function resetForm(formId){

    const form=document.getElementById(formId);

    if(!form) return;

    form.querySelectorAll("input").forEach(input=>{

        switch(input.type){

            case "text":
            case "date":
            case "time":
            case "number":
            case "email":

                input.value="";

                break;

            case "checkbox":
            case "radio":

                input.checked=false;

                break;

        }

        input.classList.remove("input-error");

    });

    form.querySelectorAll("select").forEach(select=>{

        select.selectedIndex=0;
        select.classList.remove("input-error");

    });

    form.querySelectorAll("textarea").forEach(textarea=>{

        textarea.value="";
        textarea.classList.remove("input-error");

    });

}

/* ==========================================
   VALIDATE FORM
========================================== */

function validateForm(formId){

    const form=document.getElementById(formId);

    if(!form) return false;

    let valid=true;
    const missingFields=[];

    const requiredFields=
        form.querySelectorAll("[data-required='true']");

    requiredFields.forEach(field=>{

        field.classList.remove("input-error");

        /* Report No is optional for OT Capped */

        if(field.id==="ft_reportNo"){

            const reason=document.getElementById("ft_reason");

            if(reason && reason.value==="Ot Capped"){
                return;
            }

        }

        if(field.id==="pt_reportNo"){

            const reason=document.getElementById("pt_reason");

            if(reason && reason.value==="Ot Capped"){
                return;
            }

        }

        if(field.id==="fw_reportNo"){

            const reason=document.getElementById("fw_reason");

            if(reason && reason.value==="Ot Capped"){
                return;
            }

        }

        const value=(field.value || "").trim();

        if(value===""){

            valid=false;

            field.classList.add("input-error");

            missingFields.push(
                field.dataset.label ||
                field.getAttribute("name") ||
                "Required field"
            );

        }

    });

    if(!valid && typeof Swal !== "undefined"){

        Swal.fire({

            icon:"error",

            title:"Validation Failed",

            html:`
                <div style="
                    text-align:left;
                    font-size:15px;
                    line-height:1.8;
                ">

                    <b>Please complete the following field(s):</b>

                    <br><br>

                    ${missingFields.map(item=>`
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
   UI INITIALISATION
========================================== */

/*
 * IMPORTANT:
 * ui.js does not import, fetch, inject or execute
 * script.js.
 *
 * Search, calculation and save functions should
 * be provided by their own dedicated modules.
 */

document.addEventListener("DOMContentLoaded",()=>{

    console.log("UI module loaded.");

});
