/* ==========================================
   js/account.js
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

function openChangePassword(){

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

    ["currentPassword","newPassword","confirmPassword"].forEach(id=>{

        const input=document.getElementById(id);

        if(input){
            input.type="password";
        }

    });

    document
        .querySelectorAll("#changePasswordModal .password-toggle")
        .forEach(icon=>{

            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");

        });

}

/* ==========================================================
   PASSWORD TOGGLE
========================================================== */

function initPasswordToggle(inputId, iconId){

    const input = document.getElementById(inputId);
    const icon  = document.getElementById(iconId);

    if(!input || !icon){
        return;
    }

    // Elak duplicate event
    icon.onclick = function(){

        if(input.type === "password"){

            input.type = "text";

            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");

        }else{

            input.type = "password";

            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");

        }

    };

}

/* ==========================================================
   ACCOUNT MENU
========================================================== */

function toggleAccountMenu(e){

    e.stopPropagation();

    document
        .getElementById("accountDropdown")
        .classList
        .toggle("show");

}

document.addEventListener("click",function(){

    document
        .getElementById("accountDropdown")
        ?.classList
        .remove("show");

});

