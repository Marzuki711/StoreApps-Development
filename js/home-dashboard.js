/*
 * Store Apps - Home Sales Dashboard
 * FIX v4
 *
 * Fixes:
 * 1. Submitted label now updates correctly (4 SUBMITTED, etc.).
 * 2. APSD Budget actual/target use the real HTML IDs.
 * 3. Budget caption and progress bar are updated.
 * 4. Default date is ALWAYS yesterday in Malaysia time (Asia/Kuala_Lumpur).
 * 5. User-selected date is preserved after initialization.
 * 6. Missing HTML elements never cause a null.textContent error.
 * 7. Date calculation uses explicit UTC+08:00, independent of PC timezone.
 * 8. Duplicate decorative calendar icon is hidden automatically.
 */

let homeSalesDate = "";
let homeSalesStores = [];
let homeSalesDashboardInitialized = false;

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

/* Malaysia business date. Avoid browser/local timezone differences. */
function homeTodayMalaysiaISO(){
    /*
     * Malaysia is UTC+08:00. Calculate from UTC milliseconds so the
     * browser/PC timezone can NEVER move the dashboard back one day.
     */
    const malaysiaMs = Date.now() + (8 * 60 * 60 * 1000);
    const d = new Date(malaysiaMs);
    return [
        d.getUTCFullYear(),
        String(d.getUTCMonth()+1).padStart(2,"0"),
        String(d.getUTCDate()).padStart(2,"0")
    ].join("-");
}

function homeYesterdayISO(){
    /* Calculate yesterday from the Malaysia calendar date, not browser UTC/local date. */
    const today = homeTodayMalaysiaISO();
    const p = today.split("-").map(Number);
    const d = new Date(Date.UTC(p[0],p[1]-1,p[2]));
    d.setUTCDate(d.getUTCDate()-1);
    return [
        d.getUTCFullYear(),
        String(d.getUTCMonth()+1).padStart(2,"0"),
        String(d.getUTCDate()).padStart(2,"0")
    ].join("-");
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
    const parts = String(iso).split("-");
    if(parts.length !== 3) return iso;
    const d = new Date(Number(parts[0]),Number(parts[1])-1,Number(parts[2]));
    return d.toLocaleDateString("en-GB",{
        day:"2-digit",
        month:"long",
        year:"numeric"
    });
}

function homeSetText(id,value){
    const el = document.getElementById(id);
    if(el){
        el.textContent = value == null ? "" : String(value);
    }
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

    const hour = new Date().getHours();
    const part = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

    const el = document.querySelector("[data-home-greeting]");
    if(el) el.textContent = part + ", " + name;
}

function homeSetDashboardDate(date){
    const input = document.getElementById("homeSalesDate");
    if(input) input.value = date;
}

function homeResetDashboard(){
    const values = {
        homeTotalSales:"RM 0.00",
        homeApsdSales:"RM 0.00",
        homeTotalCustomer:"0",
        homeApsdCustomer:"0",
        homeSubmittedStores:"0",
        homeTotalStores:"0",
        homePendingStores:"0",
        homeSubmissionPct:"0%",
        homeSubmittedLabel:"0 SUBMITTED",
        homeTotalRecord:"0",
        homeBusinessDate:"—",
        homeBudgetPct:"0.00%",
        homeApsdBudgetActual:"RM 0.00",
        homeApsdBudgetTarget:"RM 0.00",
        homeBudgetCaption:"0.00% of Budget Achieved"
    };

    Object.keys(values).forEach(id=>homeSetText(id,values[id]));

    const donut = document.getElementById("homeSubmissionDonut");
    const budgetBar = document.getElementById("homeBudgetBar");

    if(donut){
        donut.style.background =
            "conic-gradient(#C1121F 0deg,#E5E7EB 0deg 360deg)";
    }
    if(budgetBar) budgetBar.style.width = "0%";
}

async function loadHomeSalesDashboard(dateOverride=""){
    const authenticatedUser = homeCurrentUser();
    if(!authenticatedUser || !authenticatedUser.username){
        homeSetLoading(false);
        return;
    }

    if(typeof callDailySalesAPI !== "function"){
        console.warn("Daily Sales API is not available.");
        homeSetLoading(false);
        return;
    }

    const user = homeCurrentUser();
    const username = user.username || "";
    const role = user.role || "";

    homeSalesDate = dateOverride || homeSalesDate || homeYesterdayISO();
    homeSetDashboardDate(homeSalesDate);
    homeSetGreeting();
    homeSetLoading(true);

    try{
        const [storeResponse,listResponse] = await Promise.all([
            callDailySalesAPI("getDailySalesStores",{username,role}),
            callDailySalesAPI("getDailySalesList",{
                username,
                role,
                date:homeSalesDate
            })
        ]);

        if(!storeResponse || !storeResponse.status){
            throw new Error(storeResponse?.message || "Unable to load store data.");
        }
        if(!listResponse || !listResponse.status){
            throw new Error(listResponse?.message || "Unable to load Daily Sales.");
        }

        homeSalesStores = Array.isArray(storeResponse.stores)
            ? storeResponse.stores
            : [];

        const rows = Array.isArray(listResponse.rows)
            ? listResponse.rows
            : [];

        const totalStores = homeSalesStores.length;

        /* One submitted store = one unique Store No. */
        const submittedSet = new Set(
            rows
                .map(r=>String(r?.storeNo ?? "").replace(/^#/ , "").trim())
                .filter(Boolean)
        );

        const submittedStores = submittedSet.size;
        const totalRecord = rows.length;

        const merchandiseSales = rows.reduce((sum,r)=>{
            return sum + (Number(String(r?.totalMerchandiseSales ?? "").replace(/,/g,"")) || 0);
        },0);

        const totalCustomer = rows.reduce((sum,r)=>{
            return sum + (Number(String(r?.totalCustomer ?? "").replace(/,/g,"")) || 0);
        },0);

        /* Budget comes from Area for all stores. */
        const totalBudget = homeSalesStores.reduce((sum,s)=>{
            return sum + (Number(String(s?.budgetSales ?? "").replace(/,/g,"")) || 0);
        },0);

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

        /* KPI */
        homeSetText("homeTotalSales",homeMoney(merchandiseSales));
        homeSetText("homeApsdSales",homeMoney(apsdSales));
        homeSetText("homeTotalCustomer",homeNumber(totalCustomer));
        homeSetText("homeApsdCustomer",homeNumber(apsdCustomer));

        /* Submission */
        homeSetText("homeSubmittedStores",homeNumber(submittedStores));
        homeSetText("homeTotalStores",homeNumber(totalStores));
        homeSetText("homePendingStores",homeNumber(pendingStores) + " PENDING");
        homeSetText("homeSubmittedLabel",homeNumber(submittedStores) + " SUBMITTED");
        homeSetText("homeSubmissionPct",Math.round(submissionPct) + "%");

        /* Dates */
        homeSetText("homeBusinessDate",homeDisplayDate(homeSalesDate));
        homeSetText("homeTotalRecord",homeNumber(totalRecord));
        homeSetText("homeSalesLabel",homeDisplayDate(homeSalesDate));

        /* APSD Budget Performance */
        homeSetText("homeBudgetPct",homePercent(budgetPerformance));
        homeSetText("homeApsdBudgetActual",homeMoney(apsdSales));
        homeSetText("homeApsdBudgetTarget",homeMoney(apsdBudget));
        homeSetText("homeBudgetCaption",homePercent(budgetPerformance) + " of Budget Achieved");

        /* Submission donut */
        const degrees = Math.min(Math.max(submissionPct,0),100) * 3.6;
        const donut = document.getElementById("homeSubmissionDonut");
        if(donut){
            donut.style.background =
                "conic-gradient(#C1121F 0deg " + degrees + "deg,#E5E7EB " +
                degrees + "deg 360deg)";
        }

        /* Budget bar */
        const budgetBar = document.getElementById("homeBudgetBar");
        if(budgetBar){
            budgetBar.style.width = Math.min(Math.max(budgetPerformance,0),100) + "%";
        }

        console.log("HOME DASHBOARD FIX v3",{
            date:homeSalesDate,
            totalStores,
            submittedStores,
            pendingStores,
            merchandiseSales,
            totalCustomer,
            apsdSales,
            apsdBudget,
            budgetPerformance,
            totalRecord
        });

    }catch(err){
        console.error("Home Sales Dashboard:",err);
        if(typeof showError === "function"){
            showError(err.message || "Unable to load Sales Dashboard.");
        }
    }finally{
        homeSetLoading(false);
    }
}

function initHomeSalesDashboard(){
    const user = homeCurrentUser();
    if(!user || !user.username){
        return;
    }

    if(homeSalesDashboardInitialized){
        loadHomeSalesDashboard(
            document.getElementById("homeSalesDate")?.value || homeSalesDate || homeYesterdayISO()
        );
        return;
    }

    homeSalesDashboardInitialized = true;

    const input = document.getElementById("homeSalesDate");
    const refresh = document.getElementById("homeRefreshSales");

    /* Keep only the browser's functional calendar icon. */
    const decorativeCalendar = document.querySelector(".sa-date-control > i:first-child");
    if(decorativeCalendar){
        decorativeCalendar.style.display = "none";
    }

    if(input){
        /* IMPORTANT: default is always yesterday in Malaysia. */
        homeSalesDate = homeYesterdayISO();
        input.value = homeSalesDate;

        input.addEventListener("change",()=>{
            const selectedDate = input.value;
            if(selectedDate){
                homeSalesDate = selectedDate;
                loadHomeSalesDashboard(selectedDate);
            }
        });
    }else{
        homeSalesDate = homeYesterdayISO();
    }

    if(refresh){
        refresh.addEventListener("click",()=>{
            const selectedDate =
                document.getElementById("homeSalesDate")?.value ||
                homeSalesDate ||
                homeYesterdayISO();

            homeSalesDate = selectedDate;
            loadHomeSalesDashboard(selectedDate);
        });
    }

    homeResetDashboard();
    homeSetGreeting();

    setTimeout(()=>{
        loadHomeSalesDashboard(homeSalesDate || homeYesterdayISO());
    },0);
}
