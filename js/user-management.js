/* ==========================================================
   Store Apps - User Management V1
   ADD / EDIT USERS
   ========================================================== */

let umUsers = [];
let umPermissionHeaders = [];

function umHasAdminAccess(){
    const user = window.currentUser || JSON.parse(sessionStorage.getItem("currentUser") || "null");
    return !!user && String(user.role || "").trim().toLowerCase() === "admin";
}

async function openUserManagement(){
    if(!umHasAdminAccess()){
        if(typeof showError === "function") showError("Administrator access is required.");
        return;
    }
    const loginContainer = document.getElementById("loginContainer");
    const homeContainer = document.getElementById("homeContainer");
    const otModule = document.getElementById("otModule");
    const userManagementContainer = document.getElementById("userManagementContainer");
    const topbar = document.querySelector(".topbar");

    if(loginContainer) loginContainer.style.display = "none";
    if(homeContainer) homeContainer.style.display = "none";
    if(otModule) otModule.style.display = "none";
    if(topbar) topbar.style.display = "flex";

    if(userManagementContainer){
        userManagementContainer.style.display = "block";
    }

    const module = document.getElementById("userManagementModule");
    if(module) module.style.display = "block";

    if(typeof applyRoleAccess === "function"){
        applyRoleAccess();
    }

    await umLoadUsers();
}

async function umLoadUsers(){
    const body = document.getElementById("umUserTableBody");
    if(body) body.innerHTML = '<tr><td colspan="7" class="um-empty">Loading users...</td></tr>';

    const result = await callAPI("getUserManagementData", {
        username: (currentUser || {}).username || ""
    });

    if(!result || !result.status){
        if(body) body.innerHTML = `<tr><td colspan="7" class="um-empty">${result?.message || "Unable to load users."}</td></tr>`;
        return;
    }

    umUsers = result.users || [];
    umPermissionHeaders = result.permissionHeaders || [];
    umRenderUsers();
}

function umRenderUsers(){
    const body = document.getElementById("umUserTableBody");
    const query = (document.getElementById("umSearch")?.value || "").trim().toLowerCase();

    const rows = umUsers.filter(u =>
        [u.employeeId,u.fullName,u.username,u.role,u.status]
        .some(v => String(v || "").toLowerCase().includes(query))
    );

    document.getElementById("umCount").textContent =
        `${rows.length} User${rows.length === 1 ? "" : "s"}`;

    if(!rows.length){
        body.innerHTML = '<tr><td colspan="7" class="um-empty">No users found.</td></tr>';
        return;
    }

    body.innerHTML = rows.map(u => `
        <tr>
            <td>${umEsc(u.employeeId)}</td>
            <td><strong>${umEsc(u.fullName)}</strong><br><span style="color:#94a3b8">${umEsc(u.email)}</span></td>
            <td>${umEsc(u.username)}</td>
            <td class="um-role">${umEsc(u.role)}</td>
            <td><span class="um-status ${String(u.status).toLowerCase()==="active" ? "um-active":"um-disabled"}">${umEsc(u.status)}</span></td>
            <td>${umEsc(u.lastLogin || "-")}</td>
            <td class="um-action-col"><button class="um-edit" type="button" data-edit-user="${umAttr(u.username)}"><i class="fa-solid fa-pen"></i> Edit</button></td>
        </tr>
    `).join("");

    body.querySelectorAll("[data-edit-user]").forEach(btn => {
        btn.addEventListener("click", () => umEditUser(btn.getAttribute("data-edit-user")));
    });
}

function umOpenModal(user=null){
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
    document.getElementById("umPasswordHint").textContent =
        user ? "Leave blank to keep the existing password." : "Minimum 6 characters for a new user.";

    const grid = document.getElementById("umPermissionGrid");
    grid.innerHTML = umPermissionHeaders.map(h => {
        const checked = user?.permissions?.[h.key] === true;
        return `<label class="um-permission-item">
            <input type="checkbox" data-permission-key="${umAttr(h.key)}" ${checked ? "checked":""}>
            <span>${umEsc(h.label)}</span>
        </label>`;
    }).join("") || '<div class="um-empty">No permission columns found.</div>';

    umApplyRoleUI();
    document.getElementById("umUserModal").classList.add("show");
    document.getElementById("umUserModal").setAttribute("aria-hidden","false");
}

function umEditUser(username){
    const user = umUsers.find(u => String(u.username).toLowerCase() === String(username).toLowerCase());
    if(user) umOpenModal(user);
}

function umCloseModal(){
    document.getElementById("umUserModal").classList.remove("show");
    document.getElementById("umUserModal").setAttribute("aria-hidden","true");
}

function umApplyRoleUI(){
    const isAdmin = document.getElementById("umRole").value.toLowerCase() === "admin";
    document.querySelectorAll("#umPermissionGrid input").forEach(cb => {
        cb.checked = isAdmin ? true : cb.checked;
        cb.disabled = isAdmin;
    });
}

async function umSaveUser(e){
    e.preventDefault();

    if(!umHasAdminAccess()){
        if(typeof showError === "function") showError("Administrator access is required.");
        return;
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
        if(typeof showError === "function") showError("Please complete Employee ID, Full Name and Username.");
        return;
    }

    if(data.mode === "add" && data.password.length < 6){
        if(typeof showError === "function") showError("Password must be at least 6 characters.");
        return;
    }

    const btn = document.getElementById("umSaveUser");
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    const result = await callAPI("saveUser", {
        adminUsername: (currentUser || {}).username || "",
        user: data
    });

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save User';

    if(!result || !result.status){
        if(typeof showError === "function") showError(result?.message || "Unable to save user.");
        return;
    }

    umCloseModal();
    if(typeof showSuccess === "function") showSuccess(result.message || "User saved successfully.");
    await umLoadUsers();
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
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
}
function umAttr(v){ return umEsc(v).replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btnAddUser")?.addEventListener("click", () => umOpenModal());
    document.getElementById("umCloseModal")?.addEventListener("click", umCloseModal);
    document.getElementById("umCancel")?.addEventListener("click", umCloseModal);
    document.getElementById("umUserForm")?.addEventListener("submit", umSaveUser);
    document.getElementById("umSearch")?.addEventListener("input", umRenderUsers);
    document.getElementById("umRole")?.addEventListener("change", umApplyRoleUI);
    document.getElementById("umSelectAll")?.addEventListener("click", () =>
        document.querySelectorAll("#umPermissionGrid input").forEach(cb => { if(!cb.disabled) cb.checked=true; })
    );
    document.getElementById("umClearAll")?.addEventListener("click", () =>
        document.querySelectorAll("#umPermissionGrid input").forEach(cb => { if(!cb.disabled) cb.checked=false; })
    );
    document.querySelectorAll(".um-eye").forEach(b => b.addEventListener("click", umTogglePassword));
});

