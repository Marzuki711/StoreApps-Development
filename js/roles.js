/*************************************************
 * Store Apps
 * FILE : roles.js
 * ROLE + BUTTON PERMISSION CONTROL
 *************************************************/

const USER_ROLES = {
    ADMIN: "admin",
    USER: "user"
};

const PERMISSIONS = {
    MANUAL_OT: "manual_ot",
    EMPLOYEE_DATABASE: "employee_database",
    DASHBOARD: "dashboard",
    REPORTS: "reports",
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
        return stored ? JSON.parse(stored) : null;
    }catch(err){
        console.error("Unable to read current user:", err);
        return null;
    }
}

function normalizeRole(role){
    return String(role || "").trim().toLowerCase();
}

function getCurrentUserRole(){
    const user = getCurrentUser();
    return user ? String(user.role || "").trim() : "";
}

function isAdmin(){
    return normalizeRole(getCurrentUserRole()) === USER_ROLES.ADMIN;
}

function isUser(){
    return normalizeRole(getCurrentUserRole()) === USER_ROLES.USER;
}

function getUserPermissions(){

    const user = getCurrentUser();

    if(!user){
        return {};
    }

    // Admin always has full access.
    if(isAdmin()){
        return {
            [PERMISSIONS.MANUAL_OT]: true,
            [PERMISSIONS.EMPLOYEE_DATABASE]: true,
            [PERMISSIONS.DASHBOARD]: true,
            [PERMISSIONS.REPORTS]: true,
            [PERMISSIONS.USER_MANAGEMENT]: true,
            [PERMISSIONS.SETTINGS]: true,
            [PERMISSIONS.ACCOUNT]: true
        };
    }

    // User permissions can be supplied by the login/session object.
    if(user.permissions && typeof user.permissions === "object"){
        return user.permissions;
    }

    // Safe default for User:
    // only Manual OT Claim is visible.
    return {
        [PERMISSIONS.MANUAL_OT]: true,
        [PERMISSIONS.EMPLOYEE_DATABASE]: false,
        [PERMISSIONS.DASHBOARD]: false,
        [PERMISSIONS.REPORTS]: false,
        [PERMISSIONS.USER_MANAGEMENT]: false,
        [PERMISSIONS.SETTINGS]: false,
        [PERMISSIONS.ACCOUNT]: true
    };
}

function hasPermission(permission){
    if(isAdmin()){
        return true;
    }
    return getUserPermissions()[permission] === true;
}

function requirePermission(permission){
    if(hasPermission(permission)){
        return true;
    }

    if(typeof showError === "function"){
        showError("You do not have permission to access this function.");
    }

    return false;
}

function applyPermissionAccess(){

    document.querySelectorAll("[data-permission]").forEach(function(element){

        const permission = element.getAttribute("data-permission");

        if(hasPermission(permission)){
            element.style.display = "";
            element.removeAttribute("aria-hidden");
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

    document.body.dataset.userRole = normalizeRole(role);

    console.log("ROLE ACCESS :", role);

    document.querySelectorAll("[data-role='admin']").forEach(function(element){
        element.style.display = isAdmin() ? "" : "none";
    });

    document.querySelectorAll("[data-role='user']").forEach(function(element){
        element.style.display = isUser() ? "" : "none";
    });

    applyPermissionAccess();
}

function watchDynamicPermissionContent(){

    const homeContainer =
        document.getElementById("homeContainer");

    if(!homeContainer || homeContainer.dataset.permissionObserver === "1"){
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
