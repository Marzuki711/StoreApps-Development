/*************************************************
 * STORE APPS
 * FILE : roles.js
 * VERSION : Dynamic Permission Engine V1
 *
 * LOCK:
 * - OT calculation
 * - Search
 * - Save
 * - Reset
 * - Validation
 * - Existing module functions
 *
 * This file does NOT hard-code module names.
 * Permission keys come from currentUser.permissions.
 *************************************************/

const USER_ROLES = {
    ADMIN: "admin",
    USER: "user"
};

function getCurrentUser(){

    if(typeof currentUser !== "undefined" && currentUser){
        return currentUser;
    }

    try{

        const stored =
            sessionStorage.getItem("currentUser");

        if(!stored){
            return null;
        }

        return JSON.parse(stored);

    }catch(err){

        console.error(
            "Unable to read current user:",
            err
        );

        return null;

    }

}

function normalizeRole(role){

    return String(role || "")
        .trim()
        .toLowerCase();

}

function normalizePermissionName(name){

    return String(name || "")
        .trim()
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

}

function getCurrentUserRole(){

    const user = getCurrentUser();

    if(!user){
        return "";
    }

    return String(
        user.role || ""
    ).trim();

}

function isAdmin(){

    return (
        normalizeRole(
            getCurrentUserRole()
        ) === USER_ROLES.ADMIN
    );

}

function isUser(){

    return (
        normalizeRole(
            getCurrentUserRole()
        ) === USER_ROLES.USER
    );

}

function isLoggedIn(){

    return !!getCurrentUser();

}


/* ==========================================
   DYNAMIC PERMISSIONS
========================================== */

function getUserPermissions(){

    const user = getCurrentUser();

    if(!user){
        return {};
    }

    /*
     * Admin is always allowed.
     * This means a brand-new module automatically
     * becomes visible to Admin as soon as its card
     * has data-permission="module_name".
     */

    if(isAdmin()){

        return {
            ...(user.permissions || {})
        };

    }

    /*
     * Normal User permissions come from backend.
     */

    if(
        user.permissions &&
        typeof user.permissions === "object"
    ){

        return user.permissions;

    }

    return {};

}


/* ==========================================
   PERMISSION CHECK
========================================== */

function hasPermission(permission){

    const key =
        normalizePermissionName(permission);

    if(!key){
        return false;
    }

    /*
     * Admin = full access to ANY module.
     */

    if(isAdmin()){
        return true;
    }

    const permissions =
        getUserPermissions();

    return permissions[key] === true;

}


/* ==========================================
   REQUIRED ACCESS
========================================== */

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


/* ==========================================
   APPLY PERMISSION TO ALL ELEMENTS
========================================== */

function applyPermissionAccess(){

    const elements =
        document.querySelectorAll(
            "[data-permission]"
        );

    elements.forEach(function(element){

        const permission =
            element.getAttribute(
                "data-permission"
            );

        if(hasPermission(permission)){

            element.style.display = "";

            element.removeAttribute(
                "aria-hidden"
            );

        }else{

            element.style.display = "none";

            element.setAttribute(
                "aria-hidden",
                "true"
            );

        }

    });

}


/* ==========================================
   ROLE ACCESS
========================================== */

function updateUserDisplay(){

    const user = getCurrentUser();

    if(!user){
        return;
    }

    const fullName = String(
        user.fullName ||
        user.name ||
        user.username ||
        "Store User"
    ).trim();

    const role = String(
        user.role || "User"
    ).trim();

    /* Topbar account name */
    const accountName =
        document.getElementById("accountName");

    if(accountName){
        accountName.textContent = fullName;
        accountName.title = fullName;
    }

    /* Sidebar user name */
    document
        .querySelectorAll("[data-user-name-display]")
        .forEach(function(element){
            element.textContent = fullName;
            element.title = fullName;
        });

    /* Sidebar + dashboard role */
    document
        .querySelectorAll("[data-role-display]")
        .forEach(function(element){
            element.textContent = role;
        });
}

function applyRoleAccess(){

    const role =
        getCurrentUserRole();

    if(!role){
        return;
    }

    document.body.dataset.userRole =
        normalizeRole(role);

    updateUserDisplay();

    console.log(
        "ROLE ACCESS :",
        role
    );

    /*
     * Optional role-specific elements.
     */

    document
        .querySelectorAll(
            "[data-role='admin']"
        )
        .forEach(function(element){

            element.style.display =
                isAdmin() ? "" : "none";

        });

    document
        .querySelectorAll(
            "[data-role='user']"
        )
        .forEach(function(element){

            element.style.display =
                isUser() ? "" : "none";

        });

    applyPermissionAccess();

}


/* ==========================================
   DYNAMIC HOME CONTENT
========================================== */

function watchDynamicPermissionContent(){

    const container =
        document.getElementById(
            "homeContainer"
        );

    if(!container){
        return;
    }

    if(
        container.dataset
            .permissionObserver === "1"
    ){

        applyPermissionAccess();

        return;

    }

    const observer =
        new MutationObserver(
            function(){

                applyPermissionAccess();

            }
        );

    observer.observe(
        container,
        {
            childList: true,
            subtree: true
        }
    );

    container.dataset.permissionObserver =
        "1";

    applyPermissionAccess();

}


/* ==========================================
   INITIALIZE ROLE ACCESS
========================================== */

function initRoleAccess(){

    applyRoleAccess();

    watchDynamicPermissionContent();

}


/* ==========================================
   DEBUG
========================================== */

function debugRole(){

    console.log(
        "================================="
    );

    console.log(
        "CURRENT USER :",
        getCurrentUser()
    );

    console.log(
        "CURRENT ROLE :",
        getCurrentUserRole()
    );

    console.log(
        "IS ADMIN :",
        isAdmin()
    );

    console.log(
        "IS USER :",
        isUser()
    );

    console.log(
        "PERMISSIONS :",
        getUserPermissions()
    );

    console.log(
        "================================="
    );

}
