/*
 * Store Apps - Home Sales Dashboard
 * DATE FIX V6
 *
 * IMPORTANT:
 * - The selected date is the single source of truth for the UI.
 * - Default date = yesterday in Malaysia (Asia/Kuala_Lumpur).
 * - The Daily Sales API receives the selected date.
 * - Labels are updated immediately when the user changes the date.
 */

let homeSalesDate = "";
let homeSalesStores = [];
let homeSalesDashboardInitialized = false;
let homeSalesRequestSeq = 0;

function homeCurrentUser(){
    if(typeof getCurrentUser === "function"){
        return getCurrentUser() || {};
    }
    if(typeof currentUser !== "undefined" && currentUser){
        return currentUser;
    }
    try{
        return JSON.parse(sessionStorage.getItem("currentUser") || "{}");
    }catch(e){
        return {};
    }
}

function homeMalaysiaISODate(offsetDays=0){
    const parts = new Intl.DateTimeFormat("en-CA",{
        timeZone:"Asia/Kuala_Lumpur",
        year:"numeric",
        month:"2-digit",
        day:"2-digit"
    }).formatToParts(new Date());

    const y = Number(parts.find(p=>p.type==="year")?.value);
    const m = Number(parts.find(p=>p.type==="month")?.value);
    const d = Number(parts.find(p=>p.type==="day")?.value);

    const utc = new Date(Date.UTC(y,m-1,d));
    utc.setUTCDate(utc.getUTCDate() + Number(offsetDays || 0));

    return [
        utc.getUTCFullYear(),
        String(utc.getUTCMonth()+1).padStart(2,"0"),
        String(utc.getUTCDate()).padStart(2,"0")
    ].join("-");
}

function homeYesterdayISO(){
    return homeMalaysiaISODate(-1);
}

function homeMoney(value){
    const n = Number(String(value ?? "").replace(/,/g,"")) || 0;
    return "RM " + n.toLocaleString("en-MY",{
        minimumFractionDigits:2,
        maximumFractionDigits:2
    });
}

function homeNumber(value){
    const n = Number(String(value ?? "").replace(/,/g,"")) || 0;
    return n.toLocaleString("en-MY",{maximumFractionDigits:0});
}

function homePercent(value){
    const n = Number(value) || 0;
    return n.toFixed(2) + "%";
}

function homeDisplayDate(iso){
    if(!iso) return "—";

    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m) return String(iso);

    // No Date object is used here, avoiding timezone/day-shift problems.
    return m[3] + "/" + m[2] + "/" + m[1];
}

function homeSetLoading(show){
    const el = document.getElementById("homeSalesLoading");
    if(el) el.style.display = show ? "flex" : "none";
}

function homeSetGreeting(){
    const user = homeCurrentUser();
    const name = String(
        user.fullName ||
        user.name ||
        user.username ||
        "User"
    ).trim();

    const hour = Number(new Intl.DateTimeFormat("en-US",{
        timeZone:"Asia/Kuala_Lumpur",
        hour:"numeric",
        hour12:false
    }).format(new Date()));

    const part = hour < 12
        ? "Good Morning"
        : hour < 18
            ? "Good Afternoon"
            : "Good Evening";

    const el = document.querySelector("[data-home-greeting]");
    if(el) el.textContent = part + ", " + name;
}

function homeApplySelectedDate(date){
    const iso = String(date || "").trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;

    homeSalesDate = iso;

    const input = document.getElementById("homeSalesDate");
    if(input && input.value !== iso){
        input.value = iso;
    }

    const display = homeDisplayDate(iso);

    const salesLabel = document.getElementById("homeSalesLabel");
    if(salesLabel) salesLabel.textContent = display;

    const businessDate = document.getElementById("homeBusinessDate");
    if(businessDate) businessDate.textContent = display;
}

function homeSetDashboardDate(date){
    homeApplySelectedDate(date);
}

function homeResetDashboard(){
    const ids = {
        homeTotalSales:"RM 0.00",
        homeApsdSales:"RM 0.00",
        homeTotalCustomer:"0",
        homeApsdCustomer:"0",
        homeSubmittedStores:"0",
        homeTotalStores:"0",
        homePendingStores:"0",
        homeSubmissionPct:"0%",
        homeTotalRecord:"0",
        homeBusinessDate:"—",
        homeBudgetPct:"0.00%",
        homeApsdBudgetActual:"RM 0.00",
        homeApsdBudgetTarget:"RM 0.00"
    };

    Object.keys(ids).forEach(id=>{
        const el=document.getElementById(id);
        if(el) el.textContent=ids[id];
    });

    const donut=document.getElementById("homeSubmissionDonut");
    const bar=document.getElementById("homeSubmissionBar");
    const budget=document.getElementById("homeBudgetBar");

    if(donut) donut.style.background =
        "conic-gradient(#C1121F 0deg,#E5E7EB 0deg 360deg)";
    if(bar) bar.style.width="0%";
    if(budget) budget.style.width="0%";
}

async function loadHomeSalesDashboard(dateOverride=""){
    const authenticatedUser = homeCurrentUser();
    if(!authenticatedUser || !authenticatedUser.username){
        homeSetLoading(false);
        return;
    }

    if(typeof callDailySalesAPI !== "function"){
        console.warn("Daily Sales API is not available.");
        return;
    }

    const user = homeCurrentUser();
    const username = user.username || "";
    const role = user.role || "";

    const selectedDate =
        String(dateOverride || homeSalesDate || homeYesterdayISO()).trim();

    if(!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)){
        console.warn("Invalid dashboard date:", selectedDate);
        return;
    }

    homeApplySelectedDate(selectedDate);
    homeSetGreeting();
    homeSetLoading(true);

    const requestSeq = ++homeSalesRequestSeq;

    try{
        const [storeResponse,listResponse] = await Promise.all([
            callDailySalesAPI("getDailySalesStores",{username,role}),
            callDailySalesAPI("getDailySalesList",{
                username,
                role,
                date:selectedDate
            })
        ]);

        // Ignore an older request if the user changed the date again.
        if(requestSeq !== homeSalesRequestSeq) return;

        if(!storeResponse || !storeResponse.status){
            throw new Error(storeResponse?.message || "Unable to load store data.");
        }
        if(!listResponse || !listResponse.status){
            throw new Error(listResponse?.message || "Unable to load Daily Sales.");
        }

        homeSalesStores = storeResponse.stores || [];
        const rows = listResponse.rows || [];

        const totalStores = homeSalesStores.length;

        // One submitted store = one unique Store No.
        const submittedSet = new Set(
            rows
                .map(r => String(r.storeNo || "").replace(/^#/ ,"").trim())
                .filter(Boolean)
        );

        const submittedStores = submittedSet.size;
        const totalRecord = rows.length;

        const merchandiseSales = rows.reduce(
            (sum,r)=>sum + (Number(String(r.totalMerchandiseSales ?? "").replace(/,/g,"")) || 0),0
        );

        const totalCustomer = rows.reduce(
            (sum,r)=>sum + (Number(String(r.totalCustomer ?? "").replace(/,/g,"")) || 0),0
        );

        // Budget is taken from Area for every store, not only submitted stores.
        const totalBudget = homeSalesStores.reduce(
            (sum,s)=>sum + (Number(String(s.budgetSales ?? "").replace(/,/g,"")) || 0),0
        );

        const apsdSales = totalStores ? merchandiseSales / totalStores : 0;
        const apsdCustomer = totalStores ? totalCustomer / totalStores : 0;
        const apsdBudget = totalStores ? totalBudget / totalStores : 0;
        const budgetPerformance = apsdBudget > 0
            ? (apsdSales / apsdBudget) * 100
            : 0;

        const submissionPct = totalStores
            ? (submittedStores / totalStores) * 100
            : 0;

        const pendingStores = Math.max(totalStores - submittedStores,0);

        document.getElementById("homeTotalSales").textContent = homeMoney(merchandiseSales);
        document.getElementById("homeApsdSales").textContent = homeMoney(apsdSales);
        document.getElementById("homeTotalCustomer").textContent = homeNumber(totalCustomer);
        document.getElementById("homeApsdCustomer").textContent = homeNumber(apsdCustomer);

        document.getElementById("homeSubmittedStores").textContent = homeNumber(submittedStores);
        document.getElementById("homeTotalStores").textContent = homeNumber(totalStores);
        document.getElementById("homePendingStores").textContent = homeNumber(pendingStores);
        document.getElementById("homeSubmittedLabel").textContent = homeNumber(submittedStores) + " SUBMITTED";
        document.getElementById("homeSubmissionPct").textContent = Math.round(submissionPct) + "%";

        // Always keep the UI date equal to the user's selected date.
        homeApplySelectedDate(selectedDate);
        document.getElementById("homeTotalRecord").textContent = homeNumber(totalRecord);

        document.getElementById("homeBudgetPct").textContent = homePercent(budgetPerformance);
        document.getElementById("homeApsdBudgetActual").textContent = homeMoney(apsdSales);
        document.getElementById("homeApsdBudgetTarget").textContent = homeMoney(apsdBudget);
        document.getElementById("homeApsdBudgetBottom").textContent = homeMoney(apsdBudget);
        document.getElementById("homeTotalStoresBottom").textContent = homeNumber(totalStores);
        document.getElementById("homeBudgetCaption").textContent =
            homePercent(budgetPerformance) + " of Budget Achieved";

        const degrees = Math.min(Math.max(submissionPct,0),100) * 3.6;
        const donut = document.getElementById("homeSubmissionDonut");
        if(donut){
            donut.style.background =
                "conic-gradient(#C1121F 0deg " + degrees + "deg,#E5E7EB " +
                degrees + "deg 360deg)";
        }

        const subBar = document.getElementById("homeSubmissionBar");
        if(subBar) subBar.style.width = Math.min(submissionPct,100) + "%";

        const budgetBar = document.getElementById("homeBudgetBar");
        if(budgetBar) budgetBar.style.width = Math.min(Math.max(budgetPerformance,0),100) + "%";

    }catch(err){
        console.error("Home Sales Dashboard:",err);
        if(typeof showError === "function"){
            showError(err.message || "Unable to load Sales Dashboard.");
        }
    }finally{
        if(requestSeq === homeSalesRequestSeq){
            homeSetLoading(false);
        }
    }
}

function initHomeSalesDashboard(){
    const user = homeCurrentUser();
    if(!user || !user.username) return;

    const input = document.getElementById("homeSalesDate");
    const refresh = document.getElementById("homeRefreshSales");

    // First initialization: ALWAYS use Malaysia yesterday unless a date
    // was already selected during this page session.
    if(!homeSalesDate){
        homeSalesDate = homeYesterdayISO();
    }

    homeApplySelectedDate(homeSalesDate);

    if(!homeSalesDashboardInitialized){
        homeSalesDashboardInitialized = true;

        if(input && !input.dataset.homeDateBound){
            input.dataset.homeDateBound = "1";
            input.addEventListener("change",function(){
                const selected = String(input.value || "").trim();
                if(!/^\d{4}-\d{2}-\d{2}$/.test(selected)) return;

                // Change the visible labels BEFORE the API request.
                homeApplySelectedDate(selected);
                loadHomeSalesDashboard(selected);
            });
        }

        if(refresh && !refresh.dataset.homeRefreshBound){
            refresh.dataset.homeRefreshBound = "1";
            refresh.addEventListener("click",function(){
                const selected =
                    document.getElementById("homeSalesDate")?.value ||
                    homeSalesDate ||
                    homeYesterdayISO();

                homeApplySelectedDate(selected);
                loadHomeSalesDashboard(selected);
            });
        }
    }

    homeResetDashboard();
    homeApplySelectedDate(homeSalesDate);
    homeSetGreeting();

    loadHomeSalesDashboard(homeSalesDate);
}
