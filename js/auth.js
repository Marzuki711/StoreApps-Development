async function loginSystem(){

    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;

    if(!username || !password){

        showError("Please enter Username and Password.");
        return;

    }

    const btn = document.getElementById("btnLogin");

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing In...';

    /* Login loading is shown on the Login button only.
       Do not trigger the global/full-screen loading overlay here. */
    const result = await callAPI("login",{
        username,
        password
    });

    btn.disabled = false;
    btn.innerHTML = "LOGIN";

    if(!result || !result.status){

        showError(result?.message || "Login Failed");
        return;

    }

    currentUser = result;

sessionStorage.setItem(
    "currentUser",
    JSON.stringify(result)
);

/* ==========================================
   APPLY USER ROLE
========================================== */

    applyRoleAccess();

    /*
     * LOGIN READINESS LOCK:
     * The user is considered fully logged in only after
     * the Home Dashboard has successfully loaded its data.
     * This prevents a successful login from opening a blank
     * dashboard and also avoids a second loading indicator.
     */
    let homeReady = false;

    try{
        if(typeof preloadHomeSalesDashboard === "function"){
            homeReady = await preloadHomeSalesDashboard();
        }
    }catch(err){
        console.error("Home Dashboard preload:",err);
        homeReady = false;
    }

    if(!homeReady){
        sessionStorage.removeItem("currentUser");
        currentUser = null;

        if(typeof applyRoleAccess === "function"){
            applyRoleAccess();
        }

        btn.disabled = false;
        btn.innerHTML = "LOGIN";

        showError(
            "Unable to load Home Dashboard data. Please try again."
        );

        return;
    }

    /* Only show Home after the required dashboard data is ready. */
    showHome();

    setTimeout(() => {

        callAPI("updateLastLogin",{
            username: currentUser.username
        }).catch(console.error);

    },300);

}

/* ==========================================
   INIT PASSWORD TOGGLES
========================================== */

function initAllPasswordToggle(){

    initPasswordToggle(
        "loginPassword",
        "toggleLoginPassword"
    );

    initPasswordToggle(
        "currentPassword",
        "toggleCurrentPassword"
    );

    initPasswordToggle(
        "newPassword",
        "toggleNewPassword"
    );

    initPasswordToggle(
        "confirmPassword",
        "toggleConfirmPassword"
    );

}

/* ==========================================
   CHANGE PASSWORD
========================================== */

async function changePassword(){

    const currentPassword =
        document.getElementById("currentPassword").value.trim();

    const newPassword =
        document.getElementById("newPassword").value.trim();

    const confirmPassword =
        document.getElementById("confirmPassword").value.trim();

    // ==========================
    // VALIDATION
    // ==========================

    if(currentPassword===""){

        showError("Please enter Current Password.");

        return;

    }

    if(newPassword===""){

        showError("Please enter New Password.");

        return;

    }

    if(confirmPassword===""){

        showError("Please confirm your New Password.");

        return;

    }

    if(newPassword!==confirmPassword){

        showError("New Password and Confirm Password do not match.");

        return;

    }

    if(newPassword.length<6){

        showError("Password must be at least 6 characters.");

        return;

    }

    if(currentPassword===newPassword){

        showError("New Password cannot be the same as Current Password.");

        return;

    }

    const btn =
        document.getElementById("btnSavePassword");

    btn.disabled = true;

    btn.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Saving...
    `;

    beginDatabaseLoading();

    let result;

    try{

        result = await callAPI("changePassword",{

            username: currentUser.username,

            currentPassword,

            newPassword

        });

    }catch(err){

        endDatabaseLoading();

        btn.disabled = false;

        btn.innerHTML = "Save";

        console.error(err);

        showError("Unable to connect to server.");

        return;

    }

    endDatabaseLoading();

    btn.disabled = false;

    btn.innerHTML = "Save";

    if(!result){

        showError("No response from server.");

        return;

    }

    if(!result.status){

        showError(result.message);

        return;

    }

    showSuccess(result.message);

    closeChangePassword();

}
