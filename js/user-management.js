/* ==========================================================
   Store Apps - User Management V2
   UI only: Add / Edit / Permissions
   Backend API remains in Code.gs / UserManagement.gs
   ========================================================== */

let umUsers = [];
let umPermissionHeaders = [];

function umGetCurrentUser(){
    if(typeof getCurrentUser === "function"){
        return getCurrentUser();
    }
    if(typeof currentUser !== "undefined" && currentUser){
        return currentUser;
    }
    try{
        return JSON.parse(sessionStorage.getItem("currentUser") || "null");
    }catch(err){
        return null;
    }
}

function umHasAdminAccess(){
    const user = umGetCurrentUser();
    return !!user && String(user.role || "").trim().toLowerCase() === "admin";
}

async function openUserManagement(){
    if(typeof requirePermission === "function" && !requirePermission("user_management")){
        return;
    }
    const container = document.getElementById("userManagementContainer");
    const module = document.getElementById("userManagementModule");
    const home = document.getElementById("homeContainer");
    const ot = document.getElementById("otModule");

    if(container) container.style.display = "block";
    if(module) module.style.display = "block";
    if(home) home.style.display = "none";
    if(ot) ot.style.display = "none";

    const toggle = document.getElementById("saSidebarToggle");
    if(toggle) toggle.checked = false;

    await umLoadUsers();
}

async function umLoadUsers(){
    const body = document.getElementById("umUserTableBody");
    if(!body) return;

    body.innerHTML = '<tr><td colspan="7" class="um-empty">Loading users...</td></tr>';

    const user = umGetCurrentUser() || {};
    const result = await callAPI("getUserManagementData", { username: user.username || "" });

    if(!result || !result.status){
        body.innerHTML = `<tr><td colspan="7" class="um-empty">${umEsc(result?.message || "Unable to load users.")}</td></tr>`;
        return;
    }

    umUsers = Array.isArray(result.users) ? result.users : [];
    umPermissionHeaders = Array.isArray(result.permissionHeaders) ? result.permissionHeaders : [];
    umRenderUsers();
}

function umRenderUsers(){
    const body = document.getElementById("umUserTableBody");
    const count = document.getElementById("umCount");
    if(!body) return;

    const query = (document.getElementById("umSearch")?.value || "").trim().toLowerCase();
    const rows = umUsers.filter(u =>
        [u.employeeId,u.fullName,u.username,u.role,u.status]
            .some(v => String(v || "").toLowerCase().includes(query))
    );

    if(count) count.textContent = `${rows.length} User${rows.length === 1 ? "" : "s"}`;

    if(!rows.length){
        body.innerHTML = '<tr><td colspan="7" class="um-empty">No users found.</td></tr>';
        return;
    }

    body.innerHTML = rows.map(u => `
        <tr>
            <td>${umEsc(u.employeeId)}</td>
            <td><strong>${umEsc(u.fullName)}</strong><br><span class="um-email">${umEsc(u.email)}</span></td>
            <td>${umEsc(u.username)}</td>
            <td class="um-role">${umEsc(u.role)}</td>
            <td><span class="um-status ${String(u.status).toLowerCase() === "active" ? "um-active" : "um-disabled"}">${umEsc(u.status)}</span></td>
            <td>${umEsc(u.lastLogin || "-")}</td>
            <td class="um-action-col"><button class="um-edit" type="button" data-edit-user="${umAttr(u.username)}"><i class="fa-solid fa-pen"></i> Edit</button></td>
        </tr>`).join("");

    body.querySelectorAll("[data-edit-user]").forEach(btn => {
        btn.addEventListener("click", () => umEditUser(btn.getAttribute("data-edit-user")));
    });
}

function umOpenModal(user=null){
    const modal = document.getElementById("umUserModal");
    if(!modal) return;

    document.getElementById("umMode").value = user ? "edit" : "add";
    document.getElementById("umModalTitle").textContent = user ? "Edit User" : "Add User";
    document.getElementById("umEmployeeId").value = user?.employeeId || "";
    document.getElementById("umFullName").value = user?.fullName || "";
    document.getElementById("umEmail").value = user?.email || "";
    document.getElementById("umUsername").value = user?.username || "";
    document.getElementById("umPassword").value = "";
    document.getElementById("umRole").value = user?.role || "User";
    document.getElementById("umStatus").value = user?.status || "Active";

    document.getElementById("umUsername").readOnly = !!user;
    document.getElementById("umEmployeeId").readOnly = !!user;
    document.getElementById("umPasswordHint").textContent = user
        ? "Leave blank to keep the existing password."
        : "Minimum 6 characters for a new user.";

    const grid = document.getElementById("umPermissionGrid");
    grid.innerHTML = umPermissionHeaders.map(h => {
        const checked = user?.permissions?.[h.key] === true;
        return `<label class="um-permission-item">
            <input type="checkbox" data-permission-key="${umAttr(h.key)}" ${checked ? "checked" : ""}>
            <span>${umEsc(h.label)}</span>
        </label>`;
    }).join("") || '<div class="um-empty">No permission columns found.</div>';

    umApplyRoleUI();
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
}

function umEditUser(username){
    const user = umUsers.find(u => String(u.username).toLowerCase() === String(username).toLowerCase());
    if(user) umOpenModal(user);
}

function umCloseModal(){
    const modal = document.getElementById("umUserModal");
    if(!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
}

function umApplyRoleUI(){
    const role = document.getElementById("umRole");
    if(!role) return;
    const isAdmin = role.value.toLowerCase() === "admin";
    document.querySelectorAll("#umPermissionGrid input").forEach(cb => {
        if(isAdmin) cb.checked = true;
        cb.disabled = isAdmin;
    });
}

async function umSaveUser(e){
    if(e) e.preventDefault();

    if(!umHasAdminAccess()){
        showError("Administrator access is required.");
        return false;
    }

    const data = {
        mode: document.getElementById("umMode").value,
        employeeId: document.getElementById("umEmployeeId").value.trim(),
        fullName: document.getElementById("umFullName").value.trim(),
        email: document.getElementById("umEmail").value.trim(),
        username: document.getElementById("umUsername").value.trim(),
        password: document.getElementById("umPassword").value,
        role: document.getElementById("umRole").value,
        status: document.getElementById("umStatus").value,
        permissions: {}
    };

    document.querySelectorAll("#umPermissionGrid input[data-permission-key]").forEach(cb => {
        data.permissions[cb.dataset.permissionKey] = cb.checked;
    });

    if(!data.employeeId || !data.fullName || !data.username){
        showError("Please complete Employee ID, Full Name and Username.");
        return false;
    }

    if(data.mode === "add" && data.password.length < 6){
        showError("Password must be at least 6 characters.");
        return false;
    }

    const btn = document.getElementById("umSaveUser");
    if(btn){
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    const user = umGetCurrentUser() || {};
    let result;
    try{
        result = await callAPI("saveUser", { adminUsername: user.username || "", user: data });
    }catch(err){
        result = {status:false, message: err?.message || "Unable to connect to server."};
    }

    if(btn){
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save User';
    }

    if(!result || !result.status){
        showError(result?.message || "Unable to save user.");
        return false;
    }

    // IMPORTANT: Do not auto-close the edit form. User can close with X/Cancel.
    await umLoadUsers();

    if(typeof showSuccess === "function"){

        showSuccess(
            result.message ||
            "User saved successfully."
        );

    }else{

        if(typeof Swal !== "undefined"){

            Swal.fire({
                icon: "success",
                title: "SUCCESS",
                text:
                    result.message ||
                    "User saved successfully.",
                confirmButtonText: "OK",
                confirmButtonColor: "#198754",
                allowOutsideClick: false,
                didOpen: function(){

                    const container =
                        document.querySelector(
                            ".swal2-container"
                        );

                    if(container){
                        container.style.zIndex =
                            "20000";
                    }

                }
            });

        }else{

            alert(
                result.message ||
                "User saved successfully."
            );

        }

    }

    return true;
}

function umTogglePassword(e){
    const btn = e.currentTarget;
    const input = document.getElementById(btn.dataset.target);
    if(!input) return;
    input.type = input.type === "password" ? "text" : "password";
    btn.innerHTML = input.type === "password"
        ? '<i class="fa-solid fa-eye"></i>'
        : '<i class="fa-solid fa-eye-slash"></i>';
}

function umEsc(v){
    return String(v ?? "").replace(/[&<>"']/g, c => ({
        "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[c]));
}
function umAttr(v){ return umEsc(v); }

function initUserManagementUI(){
    const root = document.getElementById("userManagementModule");
    if(!root || root.dataset.umBound === "1") return;
    root.dataset.umBound = "1";

    document.getElementById("btnAddUser")?.addEventListener("click", () => umOpenModal());
    document.getElementById("umCloseModal")?.addEventListener("click", umCloseModal);
    document.getElementById("umCancel")?.addEventListener("click", umCloseModal);
    document.getElementById("umUserForm")?.addEventListener("submit", umSaveUser);
    document.getElementById("umSearch")?.addEventListener("input", umRenderUsers);
    document.getElementById("umRole")?.addEventListener("change", umApplyRoleUI);
    document.getElementById("umSelectAll")?.addEventListener("click", () =>
        document.querySelectorAll("#umPermissionGrid input").forEach(cb => { if(!cb.disabled) cb.checked = true; })
    );
    document.getElementById("umClearAll")?.addEventListener("click", () =>
        document.querySelectorAll("#umPermissionGrid input").forEach(cb => { if(!cb.disabled) cb.checked = false; })
    );
    root.querySelectorAll(".um-eye").forEach(b => b.addEventListener("click", umTogglePassword));
    document.getElementById("umBackHome")?.addEventListener("click", closeUserManagement);
}

// Backward-compatible automatic init if component already exists.
if(document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initUserManagementUI(), {once:true});
} else {
    initUserManagementUI();
}
