/* ==========================================
   js/account.js
   ACCOUNT + LOGOUT

   DYNAMIC PERMISSION PATCH
   - Account permission controls Account button
   - Existing logout / password functions LOCKED
   ========================================== */


/* ==========================================
   LOGOUT
========================================== */

function logout(){

    Swal.fire({

        title: "Logout",

        text: "Are you sure you want to logout?",

        icon: "question",

        showCancelButton: true,

        confirmButtonText: "Logout",

        cancelButtonText: "Cancel",

        confirmButtonColor: "#C1121F",

        cancelButtonColor: "#6B7280"

    }).then((result)=>{

        if(!result.isConfirmed){
            return;
        }

        sessionStorage.clear();

        currentUser = null;

        document.querySelector(".topbar").style.display="none";

        document.getElementById("homeContainer").style.display="none";

        document.getElementById("otModule").style.display="none";

        /* ==========================================
           HIDE USER MANAGEMENT ON LOGOUT
           ========================================== */

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

         document.getElementById("loginContainer").style.display="block";

        document.getElementById("loginUsername").value="";

        document.getElementById("loginPassword").value="";

        Swal.fire({

            icon:"success",

            title:"Logged Out",

            text:"You have been logged out successfully.",

            confirmButtonColor:"#C1121F"

        });

    });

}


/* ==========================================
   CHANGE PASSWORD
========================================== */

function openChangePassword(){

    /*
     * Permission check is defensive.
     * Existing password function remains unchanged.
     */

    if(
        typeof hasPermission === "function" &&
        !hasPermission("account")
    ){

        if(typeof showError === "function"){
            showError(
                "You do not have permission to access Account."
            );
        }

        return;

    }


    document
        .getElementById("accountDropdown")
        ?.classList
        .remove("show");

    document
        .getElementById("changePasswordModal")
        .style.display="flex";

}


/* ==========================================================
   CHANGE PASSWORD MODAL
========================================================== */

function closeChangePassword(){

    document
        .getElementById("changePasswordModal")
        .style.display="none";

    document.getElementById("currentPassword").value="";

    document.getElementById("newPassword").value="";

    document.getElementById("confirmPassword").value="";


    [
        "currentPassword",
        "newPassword",
        "confirmPassword"
    ].forEach(id=>{

        const input =
            document.getElementById(id);

        if(input){

            input.type="password";

        }

    });


    document
        .querySelectorAll(
            "#changePasswordModal .password-toggle"
        )
        .forEach(icon=>{

            icon.classList.remove(
                "fa-eye-slash"
            );

            icon.classList.add(
                "fa-eye"
            );

        });

}


/* ==========================================================
   PASSWORD TOGGLE
   LOCKED
========================================================== */

function initPasswordToggle(inputId, iconId){

    const input =
        document.getElementById(inputId);

    const icon =
        document.getElementById(iconId);


    if(!input || !icon){
        return;
    }


    // Elak duplicate event

    icon.onclick = function(){

        if(input.type === "password"){

            input.type = "text";

            icon.classList.remove(
                "fa-eye"
            );

            icon.classList.add(
                "fa-eye-slash"
            );

        }else{

            input.type = "password";

            icon.classList.remove(
                "fa-eye-slash"
            );

            icon.classList.add(
                "fa-eye"
            );

        }

    };

}


/* ==========================================================
   ACCOUNT MENU
========================================================== */

function toggleAccountMenu(e){

    e.stopPropagation();


    /*
     * Account permission.
     *
     * User1 has Account = TRUE,
     * therefore this remains fully usable.
     */

    if(
        typeof hasPermission === "function" &&
        !hasPermission("account")
    ){

        if(typeof showError === "function"){
            showError(
                "You do not have permission to access Account."
            );
        }

        return;

    }


    document
        .getElementById("accountDropdown")
        .classList
        .toggle("show");

}


/* ==========================================
   CLOSE ACCOUNT MENU
========================================== */

document.addEventListener(
    "click",
    function(){

        document
            .getElementById("accountDropdown")
            ?.classList
            .remove("show");

    }
);


/* ==========================================================
   DYNAMIC PERMISSION
   Do NOT change HTML/header.
========================================================== */

function initAccountPermission(){

    const accountButton =
        document.getElementById("btnAccount");


    if(!accountButton){
        return;
    }


    /*
     * This is equivalent to adding:
     *
     * data-permission="account"
     *
     * directly to the header button.
     *
     * We do it here so header.html does not need
     * to be replaced.
     */

    accountButton.setAttribute(
        "data-permission",
        "account"
    );


    /*
     * Apply immediately if the dynamic permission
     * engine is already available.
     */

    if(
        typeof applyPermissionAccess ===
        "function"
    ){

        applyPermissionAccess();

    }

}


/* ==========================================
   INITIALIZE ACCOUNT PERMISSION
========================================== */

if(
    document.readyState === "loading"
){

    document.addEventListener(
        "DOMContentLoaded",
        initAccountPermission
    );

}else{

    initAccountPermission();

}
