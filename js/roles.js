/*************************************************
 * Manual OT Claim System
 * FILE : roles.js
 * PURPOSE : ROLE & ACCESS CONTROL
 *
 * ROLE:
 * ADMIN = Full Access
 * USER  = Standard Access
 *
 * IMPORTANT:
 * This file does NOT modify:
 * - calculation
 * - search
 * - validation
 * - reset
 * - save
 * - API
 *************************************************/


/* ==========================================
   ROLE CONSTANTS
========================================== */

const USER_ROLES = {

    ADMIN: "Admin",
    USER: "User"

};


/* ==========================================
   GET CURRENT USER
========================================== */

function getCurrentUserRole(){

    if(
        typeof currentUser !== "undefined" &&
        currentUser &&
        currentUser.role
    ){

        return String(currentUser.role).trim();

    }

    try{

        const stored =
            sessionStorage.getItem("currentUser");

        if(!stored){
            return "";
        }

        const user = JSON.parse(stored);

        return String(user.role || "").trim();

    }catch(err){

        console.error(
            "Unable to read current user role:",
            err
        );

        return "";

    }

}


/* ==========================================
   NORMALIZE ROLE
========================================== */

function normalizeRole(role){

    return String(role || "")
        .trim()
        .toLowerCase();

}


/* ==========================================
   CHECK ADMIN
========================================== */

function isAdmin(){

    return normalizeRole(
        getCurrentUserRole()
    ) === "admin";

}


/* ==========================================
   CHECK USER
========================================== */

function isUser(){

    return normalizeRole(
        getCurrentUserRole()
    ) === "user";

}


/* ==========================================
   CHECK LOGIN
========================================== */

function isLoggedIn(){

    return !!getCurrentUserRole();

}


/* ==========================================
   REQUIRE ADMIN
========================================== */

function requireAdmin(){

    if(isAdmin()){
        return true;
    }

    showError(
        "Access denied. Administrator permission required."
    );

    return false;

}


/* ==========================================
   APPLY ROLE TO BODY
========================================== */

function applyRoleAccess(){

    const role = getCurrentUserRole();

    if(!role){
        return;
    }

    document.body.dataset.userRole =
        normalizeRole(role);

    console.log(
        "ROLE ACCESS :",
        role
    );


    /* ==========================================
       ROLE BADGE
    ========================================== */

    const roleElements =
        document.querySelectorAll(
            "[data-role-display]"
        );

    roleElements.forEach(function(el){

        el.textContent = role;

    });


    /* ==========================================
       ADMIN ONLY ELEMENTS
    ========================================== */

    const adminElements =
        document.querySelectorAll(
            "[data-role='admin']"
        );

    adminElements.forEach(function(el){

        if(isAdmin()){

            el.style.display = "";

        }else{

            el.style.display = "none";

        }

    });


    /* ==========================================
       USER ONLY ELEMENTS
    ========================================== */

    const userElements =
        document.querySelectorAll(
            "[data-role='user']"
        );

    userElements.forEach(function(el){

        if(isUser()){

            el.style.display = "";

        }else{

            el.style.display = "none";

        }

    });

}


/* ==========================================
   ROLE DEBUG
========================================== */

function debugRole(){

    console.log(
        "================================="
    );

    console.log(
        "CURRENT USER :",
        typeof currentUser !== "undefined"
            ? currentUser
            : null
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
        "================================="
    );

}
