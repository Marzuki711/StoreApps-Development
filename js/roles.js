/*************************************************
 * Store Apps
 * FILE : roles.js
 *
 * ROLE + BUTTON PERMISSION CONTROL
 *
 * LOCK:
 * - Calculation
 * - Search
 * - Save
 * - Reset
 * - Validation
 * - OT API
 *************************************************/

const USER_ROLES = {
    ADMIN: "admin",
    USER: "user"
};

const PERMISSIONS = {
    MANUAL_OT: "manual_ot",
    EMPLOYEE_DATABASE: "employee_database",
    DASHBOARD: "dashboard",
    USER_MANAGEMENT: "user_management",
    SETTINGS: "settings",
    ACCOUNT: "account"
};

function getCurrentUser(){

    if(typeof currentUser !== "undefined" && currentUser){
        return currentUser;
    }

    try{

        const stored = sessionStorage.getItem("currentUser");

        if(!stored){
            return null;
        }

        return JSON.parse(stored);

    }catch(err){

        console.error("Unable to read current user:", err);
        return null;

    }
}

function getCurrentUserRole(){

    const user = getCurrentUser();

    if(!user){
        return "";
    }

    return String(user.role || "").trim();
}

function normalizeRole(role){

    return String(role || "")
        .trim()
        .toLowerCase();

}

function isAdmin(){

    return normalizeRole(getCurrentUserRole()) === USER_ROLES.ADMIN;

}

function isUser(){

    return normalizeRole(getCurrentUserRole()) === USER_ROLES.USER;

}

function isLoggedIn(){

    return !!getCurrentUser();

}

function getUserPermissions(){

    const user = getCurrentUser();

    if(!user){
        return {};
    }

    /* ADMIN = FULL ACCESS */
    if(isAdmin()){

        return {
            [PERMISSIONS.MANUAL_OT]: true,
            [PERMISSIONS.EMPLOYEE_DATABASE]: true,
            [PERMISSIONS.DASHBOARD]: true,
            [PERMISSIONS.USER_MANAGEMENT]: true,
            [PERMISSIONS.SETTINGS]: true,
            [PERMISSIONS.ACCOUNT]: true
        };

    }

    /* USER = PERMISSIONS FROM BACKEND */
    if(
        user.permissions &&
        typeof user.permissions === "object"
    ){

        return user.permissions;

    }

    return {};

}

function hasPermission(permission){

    if(isAdmin()){
        return true;
    }

    const permissions = getUserPermissions();

    return permissions[permission] === true;

}

function requirePermission(permission){

    if(hasPermission(permission)){
        return true;
    }

    if(typeof showError === "function"){
        showError(
            "You do not have permission to access this function."
        );
    }

    return false;

}

function applyPermissionAccess(){

    const elements = document.querySelectorAll(
        "[data-permission]"
    );

    elements.forEach(function(element){

        const permission =
            element.getAttribute("data-permission");

        if(hasPermission(permission)){

            element.style.display = "";
            element.removeAttribute("aria-hidden");

            if("disabled" in element){
                element.disabled = false;
            }

        }else{

            element.style.display = "none";
            element.setAttribute("aria-hidden", "true");

        }

    });

}

function applyRoleAccess(){

    const role = getCurrentUserRole();

    if(!role){
        return;
    }

    document.body.dataset.userRole =
        normalizeRole(role);

    console.log("ROLE ACCESS :", role);

    const roleElements =
        document.querySelectorAll("[data-role-display]");

    roleElements.forEach(function(element){
        element.textContent = role;
    });

    const adminElements =
        document.querySelectorAll("[data-role='admin']");

    adminElements.forEach(function(element){

        element.style.display =
            isAdmin() ? "" : "none";

    });

    const userElements =
        document.querySelectorAll("[data-role='user']");

    userElements.forEach(function(element){

        element.style.display =
            isUser() ? "" : "none";

    });

    applyPermissionAccess();

}

/*
 * IMPORTANT:
 * Home/module HTML is loaded dynamically after login.
 * Observe only the Home container so permission rules
 * are automatically applied when the cards are inserted.
 */
function watchDynamicPermissionContent(){

    const homeContainer =
        document.getElementById("homeContainer");

    if(!homeContainer){
        return;
    }

    if(homeContainer.dataset.permissionObserver === "1"){
        return;
    }

    const observer = new MutationObserver(function(){

        applyPermissionAccess();

    });

    observer.observe(homeContainer, {
        childList: true,
        subtree: true
    });

    homeContainer.dataset.permissionObserver = "1";

    applyPermissionAccess();

}

function initRoleAccess(){

    applyRoleAccess();
    watchDynamicPermissionContent();

}

function debugRole(){

    console.log("=================================");
    console.log("CURRENT USER :", getCurrentUser());
    console.log("CURRENT ROLE :", getCurrentUserRole());
    console.log("IS ADMIN :", isAdmin());
    console.log("IS USER :", isUser());
    console.log("PERMISSIONS :", getUserPermissions());
    console.log("=================================");

}
