/*************************************************
 * Manual OT Claim System
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


/* ==========================================
   ROLE CONSTANTS
========================================== */

const USER_ROLES = {

    ADMIN: "admin",
    USER: "user"

};


/* ==========================================
   PERMISSION CONSTANTS
========================================== */

const PERMISSIONS = {

    MANUAL_OT: "manual_ot",

    EMPLOYEE_DATABASE: "employee_database",

    DASHBOARD: "dashboard",

    USER_MANAGEMENT: "user_management",

    SETTINGS: "settings",

    ACCOUNT: "account"

};


/* ==========================================
   GET CURRENT USER
========================================== */

function getCurrentUser(){

    if(
        typeof currentUser !== "undefined" &&
        currentUser
    ){

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


/* ==========================================
   GET CURRENT ROLE
========================================== */

function getCurrentUserRole(){

    const user = getCurrentUser();

    if(!user){

        return "";

    }

    return String(
        user.role || ""
    ).trim();

}


/* ==========================================
   NORMALIZE ROLE
========================================== */

function normalizeRole(role){

    return String(
        role || ""
    )
    .trim()
    .toLowerCase();

}


/* ==========================================
   CHECK ADMIN
========================================== */

function isAdmin(){

    return normalizeRole(
        getCurrentUserRole()
    ) === USER_ROLES.ADMIN;

}


/* ==========================================
   CHECK USER
========================================== */

function isUser(){

    return normalizeRole(
        getCurrentUserRole()
    ) === USER_ROLES.USER;

}


/* ==========================================
   CHECK LOGIN
========================================== */

function isLoggedIn(){

    return !!getCurrentUser();

}


/* ==========================================
   GET USER PERMISSIONS
========================================== */

function getUserPermissions(){

    const user = getCurrentUser();

    if(!user){

        return {};

    }


    /* ======================================
       ADMIN = FULL ACCESS
    ====================================== */

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


    /* ======================================
       USER PERMISSIONS
    ====================================== */

    if(
        user.permissions &&
        typeof user.permissions === "object"
    ){

        return user.permissions;

    }


    return {};

}


/* ==========================================
   HAS PERMISSION
========================================== */

function hasPermission(permission){

    if(isAdmin()){

        return true;

    }

    const permissions =
        getUserPermissions();

    return permissions[permission] === true;

}


/* ==========================================
   REQUIRE PERMISSION
========================================== */

function requirePermission(permission){

    if(hasPermission(permission)){

        return true;

    }

    showError(
        "You do not have permission to access this function."
    );

    return false;

}


/* ==========================================
   APPLY PERMISSIONS TO BUTTONS
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

            element.disabled = false;

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
   APPLY ROLE ACCESS
========================================== */

function applyRoleAccess(){

    const role =
        getCurrentUserRole();

    if(!role){

        return;

    }


    document.body.dataset.userRole =
        normalizeRole(role);


    console.log(
        "ROLE ACCESS :",
        role
    );


    /* ======================================
       ROLE DISPLAY
    ====================================== */

    const roleElements =
        document.querySelectorAll(
            "[data-role-display]"
        );

    roleElements.forEach(function(element){

        element.textContent =
            role;

    });


    /* ======================================
       ADMIN ONLY
    ====================================== */

    const adminElements =
        document.querySelectorAll(
            "[data-role='admin']"
        );

    adminElements.forEach(function(element){

        if(isAdmin()){

            element.style.display = "";

        }else{

            element.style.display = "none";

        }

    });


    /* ======================================
       USER ONLY
    ====================================== */

    const userElements =
        document.querySelectorAll(
            "[data-role='user']"
        );

    userElements.forEach(function(element){

        if(isUser()){

            element.style.display = "";

        }else{

            element.style.display = "none";

        }

    });


    /* ======================================
       BUTTON PERMISSIONS
    ====================================== */

    applyPermissionAccess();

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
