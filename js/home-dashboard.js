/*
 * Store Apps - Home Sales Dashboard
 * Uses Daily Sales API only.
 * Default business date = Yesterday.
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

function homeYesterdayISO(){
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return [
        d.getFullYear(),
        String(d.getMonth()+1).padStart(2,"0"),
        String(d.getDate()).padStart(2,"0")
    ].join("-");
}

function homeMoney(value){
    const n = Number(String(value ?? "").replace(/,/g,"")) || 0;
    return "RM " + n.toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2});
}

function homeNumber(value){
    const n = Number(String(value ?? "").replace(/,/g,"")) || 0;
    return n.toLocaleString("en-MY",{maximumFractionDigits:0});
}

function setHomeText(id, value){
    const el = document.getElementById(id);
    if(el && value !== undefined && value !== null){
        el.textContent = value;
    }
}

function homePercent(value){
    const n = Number(value) || 0;
    return n.toFixed(2) + "%";
}

function homeDisplayDate(iso){
    if(!iso) return "—";
    const parts = iso.split("-");
    if(parts.length !== 3) return iso;
    const d = new Date(Number(parts[0]),Number(parts[1])-1,Number(parts[2]));
    return d.toLocaleDateString("en-GB",{
        day:"2-digit",month:"long",year:"numeric"
    });
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
    if(el){
        el.textContent = part + ", " + name;
        el.title = name;
    }
}

function homeSetDashboardDate(date){
    const input = document.getElementById("homeSalesDate");
    if(input) input.value = date;
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
        homeBudgetValues:"RM 0.00 / RM 0.00"
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

    homeSalesDate = dateOverride || homeSalesDate || homeYesterdayISO();
    homeSetDashboardDate(homeSalesDate);
    homeSetGreeting();
    homeSetLoading(true);

    try{
        const [storeResponse,listResponse] = await Promise.all([
            callDailySalesAPI("getDailySalesStores",{username,role}),
            callDailySalesAPI("getDailySalesList",{
                username,role,date:homeSalesDate
            })
        ]);

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
            rows.map(r => String(r.storeNo || "").replace(/^#/,"").trim()).filter(Boolean)
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

        setHomeText("homeTotalSales", homeMoney(merchandiseSales));
        setHomeText("homeApsdSales", homeMoney(apsdSales));
        setHomeText("homeTotalCustomer", homeNumber(totalCustomer));
        setHomeText("homeApsdCustomer", homeNumber(apsdCustomer));

        setHomeText("homeSubmittedStores", homeNumber(submittedStores));
        setHomeText("homeTotalStores", homeNumber(totalStores));
        setHomeText("homePendingStores", homeNumber(pendingStores));
        setHomeText("homeSubmissionPct", Math.round(submissionPct) + "%");

        setHomeText("homeBusinessDate", homeDisplayDate(homeSalesDate));
        setHomeText("homeTotalRecord", homeNumber(totalRecord));

        setHomeText("homeBudgetPct", homePercent(budgetPerformance));
        setHomeText("homeApsdBudgetActual", homeMoney(apsdSales));
        setHomeText("homeApsdBudgetTarget", homeMoney(apsdBudget));
        setHomeText("homeBudgetCaption", homePercent(budgetPerformance) + " of Budget Achieved");

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

        const label = document.getElementById("homeSalesLabel");
        if(label) label.textContent = homeDisplayDate(homeSalesDate);

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

    /* Never call Daily Sales API before authentication. */
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

    if(input){
        input.value = homeSalesDate || homeYesterdayISO();
        input.addEventListener("change",()=>{
            loadHomeSalesDashboard(input.value);
        });
    }

    if(refresh){
        refresh.addEventListener("click",()=>{
            loadHomeSalesDashboard(
                document.getElementById("homeSalesDate")?.value || homeYesterdayISO()
            );
        });
    }

    homeResetDashboard();
    homeSetGreeting();

    // Delay one tick so the Daily Sales module functions are fully available.
    setTimeout(()=>{
        loadHomeSalesDashboard(
            input?.value || homeYesterdayISO()
        );
    },0);
}


function homeDateDDMMYYYY(value){
    if(!value) return "—";
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m) return `${m[3]}/${m[2]}/${m[1]}`;
    return value;
}

function syncHomeSalesDateDisplay(value){
    const el=document.getElementById("homeSalesDateDisplay");
    if(el) el.textContent=homeDateDDMMYYYY(value);
}

document.addEventListener("DOMContentLoaded", ()=>{
    const input=document.getElementById("homeSalesDate");
    if(input) syncHomeSalesDateDisplay(input.value);
    if(input) input.addEventListener("change", e=>{
        syncHomeSalesDateDisplay(e.target.value);
    });
});
